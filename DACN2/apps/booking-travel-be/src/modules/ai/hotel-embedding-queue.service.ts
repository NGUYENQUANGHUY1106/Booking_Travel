import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  EmbeddingProvider,
  EmbeddingProviderError,
} from './embedding-provider';
import { HotelEmbeddingService } from './hotel-embedding.service';

@Injectable()
export class HotelEmbeddingQueueService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(HotelEmbeddingQueueService.name);
  private connection?: Redis;
  private queue?: Queue;
  private worker?: Worker<{ hotelId: string }>;
  private timer?: NodeJS.Timeout;
  private initialTimer?: NodeJS.Timeout;
  private readonly queueName =
    process.env.AI_EMBEDDING_QUEUE_NAME ?? 'hotel-embeddings';

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: EmbeddingProvider,
    private readonly embeddings: HotelEmbeddingService,
  ) {}

  onModuleInit(): void {
    if (
      !this.provider.configured ||
      process.env.SKIP_DATABASE_CONNECT === 'true'
    ) {
      this.logger.warn(
        'Hotel embeddings disabled: configure AI_EMBEDDING_* to start worker',
      );
      return;
    }
    this.connection = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      {
        maxRetriesPerRequest: null,
        lazyConnect: true,
        retryStrategy: (attempt) => Math.min(attempt * 1000, 10000),
      },
    );
    this.connection.on('error', () =>
      this.logger.warn('Hotel embedding Redis unavailable'),
    );
    this.queue = new Queue(this.queueName, { connection: this.connection });
    this.worker = new Worker<{ hotelId: string }>(
      this.queueName,
      async (job: Job<{ hotelId: string }>) => {
        try {
          return await this.embeddings.indexHotel(job.data.hotelId);
        } catch (error) {
          if (error instanceof EmbeddingProviderError && !error.retryable)
            job.discard();
          throw error;
        }
      },
      { connection: this.connection, concurrency: 2 },
    );
    this.worker.on('error', () =>
      this.logger.warn('Hotel embedding worker unavailable'),
    );
    this.worker.on('failed', (job, error) =>
      this.logger.warn(
        `embedding job failed hotelId=${job?.data.hotelId ?? 'unknown'} code=${error instanceof EmbeddingProviderError ? error.code : 'UNKNOWN'}`,
      ),
    );
    this.timer = setInterval(
      () =>
        void this.reconcileAll().catch(() =>
          this.logger.warn('Hotel embedding reconciliation failed'),
        ),
      5 * 60_000,
    );
    this.timer.unref();
    this.initialTimer = setTimeout(
      () =>
        void this.reconcileAll().catch(() =>
          this.logger.warn('Hotel embedding initial reconciliation failed'),
        ),
      10000,
    ).unref();
  }

  async enqueue(hotelId: string): Promise<void> {
    if (!this.queue || this.connection?.status !== 'ready') return;
    try {
      const jobId = `hotel-${hotelId}-${Math.floor(Date.now() / 300000)}`;
      const existing = await this.queue.getJob(jobId);
      if (existing && (await existing.getState()) === 'failed')
        await existing.remove();
      await this.queue.add(
        'index',
        { hotelId },
        {
          jobId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000, jitter: 0.3 },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
        },
      );
    } catch {
      this.logger.warn(`embedding enqueue unavailable hotelId=${hotelId}`);
    }
  }

  async reconcile(
    afterId = '',
    batchSize = 100,
    dryRun = false,
  ): Promise<{
    scanned: number;
    enqueued: number;
    removed: number;
    nextCursor: string | null;
  }> {
    const size = Math.max(1, Math.min(100, batchSize));
    const hotels = await this.prisma.hotel.findMany({
      where: { id: { gt: afterId } },
      orderBy: { id: 'asc' },
      take: size,
      select: { id: true, status: true, isVisible: true, deletedAt: true },
    });
    let enqueued = 0;
    let removed = 0;
    for (const hotel of hotels) {
      if (hotel.status !== 'APPROVED' || !hotel.isVisible || hotel.deletedAt) {
        if (!dryRun) await this.embeddings.removeHotel(hotel.id);
        removed++;
      } else if (await this.embeddings.needsIndex(hotel.id)) {
        if (!dryRun) await this.enqueue(hotel.id);
        enqueued++;
      }
    }
    const nextCursor =
      hotels.length === size ? hotels[hotels.length - 1].id : null;
    return { scanned: hotels.length, enqueued, removed, nextCursor };
  }

  async reconcileAll(): Promise<void> {
    let cursor: string | null = '';
    while (cursor !== null) {
      const report = await this.reconcile(cursor);
      cursor = report.nextCursor;
    }
  }

  async queueStatus() {
    if (!this.queue) return { enabled: false };
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'delayed',
      'failed',
    );
    const oldest = (await this.queue.getJobs(['waiting'], 0, 0))[0];
    return {
      enabled: true,
      ...counts,
      oldestWaitingSeconds: oldest
        ? Math.floor((Date.now() - oldest.timestamp) / 1000)
        : 0,
    };
  }

  async diagnostics() {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        revokedChunks: bigint;
        staleChunks: bigint;
        missingHotels: bigint;
      }>
    >`
      SELECT
        (SELECT count(*) FROM "HotelEmbeddingChunk" c
          LEFT JOIN "Hotel" h ON h.id = c."hotelId"
          WHERE h.id IS NULL OR h.status <> 'APPROVED' OR NOT h."isVisible" OR h."deletedAt" IS NOT NULL) AS "revokedChunks",
        (SELECT count(*) FROM "HotelEmbeddingChunk" c
          LEFT JOIN "HotelEmbeddingState" s ON s."hotelId" = c."hotelId" AND s.model = c.model
          WHERE s."hotelId" IS NULL OR s.status <> 'READY' OR s."sourceHash" <> c."sourceHash"
            OR s."sourceVersion" <> c."sourceVersion") AS "staleChunks",
        (SELECT count(*) FROM "Hotel" h
          WHERE h.status = 'APPROVED' AND h."isVisible" AND h."deletedAt" IS NULL
            AND EXISTS (SELECT 1 FROM "HotelSubmission" v WHERE v."hotelId" = h.id AND v.status = 'APPROVED')
            AND NOT EXISTS (SELECT 1 FROM "HotelEmbeddingState" s
              WHERE s."hotelId" = h.id AND s.model = ${this.provider.model}
                AND s.provider = ${this.provider.provider} AND s.dimensions = ${this.provider.dimensions}
                AND s.status = 'READY'
                AND s."sourceVersion" = (SELECT max(v.version) FROM "HotelSubmission" v
                  WHERE v."hotelId" = h.id AND v.status = 'APPROVED'))) AS "missingHotels"`;
    return {
      queue: await this.queueStatus(),
      revokedChunks: Number(row.revokedChunks),
      staleChunks: Number(row.staleChunks),
      missingHotels: Number(row.missingHotels),
      processCounters: this.embeddings.counters,
    };
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    if (this.initialTimer) clearTimeout(this.initialTimer);
    await this.worker?.close();
    await this.queue?.close();
    this.connection?.disconnect();
  }
}

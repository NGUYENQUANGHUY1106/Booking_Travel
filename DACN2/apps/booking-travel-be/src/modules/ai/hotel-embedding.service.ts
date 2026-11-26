import { Injectable, Logger } from '@nestjs/common';
import { HotelStatus, HotelSubmissionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  EmbeddingProvider,
  EmbeddingProviderError,
} from './embedding-provider';
import {
  buildPublicHotelChunks,
  CHUNK_SCHEMA,
  sha256,
} from './hotel-embedding-source';

type Database = PrismaService | Prisma.TransactionClient;
type Source = {
  hotelId: string;
  version: number;
  updatedAt: Date;
  chunks: ReturnType<typeof buildPublicHotelChunks>['chunks'];
  hash: string;
};

export type HotelRetrievalResult = {
  hotelId: string;
  resourceId: string;
  sourceType: string;
  sourceVersion: number;
  sourceUpdatedAt: Date;
  excerpt: string;
  score: number;
  citation: string;
};

@Injectable()
export class HotelEmbeddingService {
  private readonly logger = new Logger(HotelEmbeddingService.name);
  readonly counters = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    retrieved: 0,
    empty: 0,
    fallback: 0,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: EmbeddingProvider,
  ) {}

  private async source(db: Database, hotelId: string): Promise<Source | null> {
    const hotel = await db.hotel.findUnique({
      where: { id: hotelId },
      select: { status: true, isVisible: true, deletedAt: true },
    });
    if (
      !hotel ||
      hotel.status !== HotelStatus.APPROVED ||
      !hotel.isVisible ||
      hotel.deletedAt
    )
      return null;
    const approved = await db.hotelSubmission.findFirst({
      where: { hotelId, status: HotelSubmissionStatus.APPROVED },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        snapshot: true,
        decidedAt: true,
        submittedAt: true,
      },
    });
    if (!approved) return null;
    const built = buildPublicHotelChunks(hotelId, approved.snapshot);
    return {
      hotelId,
      version: approved.version,
      updatedAt: approved.decidedAt ?? approved.submittedAt,
      chunks: built.chunks,
      hash: built.sourceHash,
    };
  }

  async needsIndex(hotelId: string): Promise<boolean> {
    if (!this.provider.configured) return false;
    const source = await this.source(this.prisma, hotelId);
    if (!source) return true;
    const state = await this.prisma.hotelEmbeddingState.findUnique({
      where: { hotelId_model: { hotelId, model: this.provider.model } },
    });
    return (
      state?.status !== 'READY' ||
      state.provider !== this.provider.provider ||
      state.dimensions !== this.provider.dimensions ||
      state.sourceHash !== source.hash ||
      state.sourceVersion !== source.version
    );
  }

  async indexHotel(
    hotelId: string,
  ): Promise<'READY' | 'REMOVED' | 'UNCHANGED'> {
    if (!this.provider.configured)
      throw new EmbeddingProviderError('PROVIDER_UNCONFIGURED', false);
    const source = await this.source(this.prisma, hotelId);
    if (!source || !source.chunks.length) {
      await this.removeHotel(hotelId);
      return 'REMOVED';
    }
    const previous = await this.prisma.hotelEmbeddingState.findUnique({
      where: { hotelId_model: { hotelId, model: this.provider.model } },
    });
    if (
      previous?.status === 'READY' &&
      previous.provider === this.provider.provider &&
      previous.dimensions === this.provider.dimensions &&
      previous.sourceHash === source.hash &&
      previous.sourceVersion === source.version
    )
      return 'UNCHANGED';
    if (
      previous?.status === 'READY' &&
      previous.provider === this.provider.provider &&
      previous.dimensions === this.provider.dimensions &&
      previous.sourceHash === source.hash
    ) {
      return this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Hotel" WHERE id = ${hotelId} FOR UPDATE`;
        const current = await this.source(tx, hotelId);
        if (
          !current ||
          current.version !== source.version ||
          current.hash !== source.hash
        )
          return 'UNCHANGED' as const;
        await tx.$executeRaw`UPDATE "HotelEmbeddingChunk"
          SET "sourceVersion" = ${source.version}, "sourceUpdatedAt" = ${source.updatedAt}
          WHERE "hotelId" = ${hotelId} AND "model" = ${this.provider.model}
            AND "sourceHash" = ${source.hash}`;
        await tx.hotelEmbeddingState.updateMany({
          where: {
            hotelId,
            model: this.provider.model,
            status: 'READY',
            sourceHash: source.hash,
          },
          data: { sourceVersion: source.version, indexedAt: new Date() },
        });
        return 'UNCHANGED' as const;
      });
    }

    this.counters.attempted++;
    try {
      const vectors = await this.provider.embed(
        source.chunks.map((chunk) => chunk.excerpt),
      );
      const result = await this.prisma.$transaction(async (tx) => {
        // Serialize index writers and block moderation row updates until the final visibility check.
        await tx.$queryRaw`SELECT id FROM "Hotel" WHERE id = ${hotelId} FOR UPDATE`;
        const current = await this.source(tx, hotelId);
        if (
          !current ||
          current.version !== source.version ||
          current.hash !== source.hash
        )
          return 'STALE' as const;
        const state = await tx.hotelEmbeddingState.findUnique({
          where: { hotelId_model: { hotelId, model: this.provider.model } },
        });
        if (
          state?.status === 'READY' &&
          state.provider === this.provider.provider &&
          state.dimensions === this.provider.dimensions &&
          state.sourceHash === source.hash &&
          state.sourceVersion === source.version
        )
          return 'UNCHANGED' as const;
        await tx.$executeRaw`DELETE FROM "HotelEmbeddingChunk" WHERE "hotelId" = ${hotelId} AND "model" = ${this.provider.model}`;
        for (let i = 0; i < source.chunks.length; i++) {
          const chunk = source.chunks[i];
          const vector = `[${vectors[i].join(',')}]`;
          const id = sha256(
            `${hotelId}:${this.provider.model}:${source.version}:${chunk.sourceType}:${chunk.chunkIndex}`,
          );
          await tx.$executeRaw`INSERT INTO "HotelEmbeddingChunk"
            ("id","hotelId","sourceType","resourceId","sourceVersion","sourceUpdatedAt",
             "sourceHash","contentHash","chunkSchema","chunkIndex","language","excerpt",
             "provider","model","dimensions","embedding")
            VALUES (${id},${hotelId},${chunk.sourceType},${chunk.resourceId},${source.version},${source.updatedAt},
              ${source.hash},${chunk.contentHash},${CHUNK_SCHEMA},${chunk.chunkIndex},${chunk.language},${chunk.excerpt},
              ${this.provider.provider},${this.provider.model},${this.provider.dimensions},${vector}::vector)`;
        }
        await tx.hotelEmbeddingState.upsert({
          where: { hotelId_model: { hotelId, model: this.provider.model } },
          create: {
            hotelId,
            model: this.provider.model,
            provider: this.provider.provider,
            dimensions: this.provider.dimensions,
            sourceVersion: source.version,
            sourceHash: source.hash,
            status: 'READY',
            attempts: 1,
            attemptedAt: new Date(),
            indexedAt: new Date(),
          },
          update: {
            status: 'READY',
            provider: this.provider.provider,
            dimensions: this.provider.dimensions,
            sourceVersion: source.version,
            sourceHash: source.hash,
            indexedAt: new Date(),
            attemptedAt: new Date(),
            errorCode: null,
            attempts: { increment: 1 },
          },
        });
        return 'READY' as const;
      });
      if (result === 'STALE') return 'UNCHANGED';
      if (result === 'READY') this.counters.succeeded++;
      return result;
    } catch (error) {
      this.counters.failed++;
      const code =
        error instanceof EmbeddingProviderError
          ? error.code
          : 'INDEX_DATABASE_ERROR';
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Hotel" WHERE id = ${hotelId} FOR UPDATE`;
        const current = await this.source(tx, hotelId);
        if (
          !current ||
          current.version !== source.version ||
          current.hash !== source.hash
        )
          return;
        const state = await tx.hotelEmbeddingState.findUnique({
          where: { hotelId_model: { hotelId, model: this.provider.model } },
        });
        if (
          state?.status === 'READY' &&
          state.provider === this.provider.provider &&
          state.dimensions === this.provider.dimensions &&
          state.sourceHash === source.hash
        )
          return;
        await tx.hotelEmbeddingState.upsert({
          where: { hotelId_model: { hotelId, model: this.provider.model } },
          create: {
            hotelId,
            model: this.provider.model,
            provider: this.provider.provider,
            dimensions: this.provider.dimensions,
            sourceVersion: source.version,
            sourceHash: source.hash,
            status: 'FAILED',
            errorCode: code,
            attempts: 1,
            attemptedAt: new Date(),
          },
          update: {
            provider: this.provider.provider,
            dimensions: this.provider.dimensions,
            sourceVersion: source.version,
            sourceHash: source.hash,
            status: 'FAILED',
            errorCode: code,
            attempts: { increment: 1 },
            attemptedAt: new Date(),
          },
        });
      });
      this.logger.warn(
        `hotel embedding failed hotelId=${hotelId} code=${code}`,
      );
      throw error;
    }
  }

  async removeHotel(hotelId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Hotel" WHERE id = ${hotelId} FOR UPDATE`;
      if (await this.source(tx, hotelId)) return;
      await tx.$executeRaw`DELETE FROM "HotelEmbeddingChunk" WHERE "hotelId" = ${hotelId}`;
      await tx.hotelEmbeddingState.deleteMany({ where: { hotelId } });
    });
  }

  // Internal service contract only. hotelId must come from trusted server context, never model text.
  async retrieve(input: {
    useCase: 'PUBLIC_SEARCH' | 'HOTEL_SUPPORT';
    query: string;
    hotelId?: string;
    topK?: number;
  }): Promise<{
    status: 'OK' | 'INSUFFICIENT_DATA';
    results: HotelRetrievalResult[];
  }> {
    const query = input.query.trim().slice(0, 500);
    if (
      !query ||
      !this.provider.configured ||
      (input.useCase === 'HOTEL_SUPPORT' && !input.hotelId)
    ) {
      this.counters.fallback++;
      return { status: 'INSUFFICIENT_DATA', results: [] };
    }
    const topK = Math.max(1, Math.min(10, input.topK ?? 5));
    try {
      const [embedding] = await this.provider.embed([query]);
      const vector = `[${embedding.join(',')}]`;
      const scope = input.hotelId
        ? Prisma.sql`AND c."hotelId" = ${input.hotelId}`
        : Prisma.empty;
      const rows = await this.prisma.$queryRaw<
        Array<HotelRetrievalResult & { distance: number }>
      >`
        SELECT c."hotelId", c."resourceId", c."sourceType", c."sourceVersion",
               c."sourceUpdatedAt", c."excerpt",
               (c."embedding" <=> ${vector}::vector) AS distance
        FROM "HotelEmbeddingChunk" c
        JOIN "Hotel" h ON h.id = c."hotelId"
        JOIN "HotelEmbeddingState" s ON s."hotelId" = c."hotelId" AND s.model = c.model
        WHERE h.status = 'APPROVED' AND h."isVisible" = true AND h."deletedAt" IS NULL
          AND s.status = 'READY' AND s."sourceVersion" = c."sourceVersion"
          AND s."sourceHash" = c."sourceHash"
          AND c."sourceVersion" = (SELECT MAX(v.version) FROM "HotelSubmission" v
            WHERE v."hotelId" = h.id AND v.status = 'APPROVED')
          AND c.model = ${this.provider.model} AND c.dimensions = ${this.provider.dimensions}
          AND c.provider = ${this.provider.provider} AND s.provider = ${this.provider.provider}
          AND c."chunkSchema" = ${CHUNK_SCHEMA} ${scope}
        ORDER BY c."embedding" <=> ${vector}::vector ASC LIMIT ${topK}`;
      const results = rows
        .filter((row) => Number(row.distance) <= 0.65)
        .map((row) => ({
          hotelId: row.hotelId,
          resourceId: row.resourceId,
          sourceType: row.sourceType,
          sourceVersion: row.sourceVersion,
          sourceUpdatedAt: row.sourceUpdatedAt,
          excerpt: row.excerpt,
          score: 1 - Number(row.distance),
          citation: `hotel:${row.hotelId}:v${row.sourceVersion}:${row.sourceType}`,
        }));
      this.counters.retrieved++;
      if (!results.length) this.counters.empty++;
      return { status: results.length ? 'OK' : 'INSUFFICIENT_DATA', results };
    } catch {
      this.counters.fallback++;
      this.logger.warn('hotel embedding retrieval unavailable');
      return { status: 'INSUFFICIENT_DATA', results: [] };
    }
  }
}

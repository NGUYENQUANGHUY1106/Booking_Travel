import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { EmbeddingProvider } from './embedding-provider';
import { HotelEmbeddingQueueService } from './hotel-embedding-queue.service';
import { HotelEmbeddingService } from './hotel-embedding.service';

const describeRedis = process.env.AI_TEST_REDIS_URL ? describe : describe.skip;

describeRedis('hotel embedding BullMQ worker', () => {
  const originalEnv = { ...process.env };
  let queue: HotelEmbeddingQueueService;

  beforeAll(() => {
    process.env.REDIS_URL = process.env.AI_TEST_REDIS_URL;
    process.env.AI_EMBEDDING_QUEUE_NAME = `hotel-embeddings-test-${randomUUID()}`;
  });

  afterAll(async () => {
    await queue?.onModuleDestroy();
    process.env = { ...originalEnv };
  });

  it('consumes an enqueued hotel with the real Redis worker', async () => {
    let resolveProcessed!: (hotelId: string) => void;
    const processed = new Promise<string>((resolve) => {
      resolveProcessed = resolve;
    });
    const fakeEmbeddings = {
      indexHotel: (hotelId: string) => {
        resolveProcessed(hotelId);
        return Promise.resolve('READY' as const);
      },
    } as unknown as HotelEmbeddingService;
    const fakeProvider = { configured: true } as unknown as EmbeddingProvider;
    queue = new HotelEmbeddingQueueService(
      {} as unknown as PrismaService,
      fakeProvider,
      fakeEmbeddings,
    );
    queue.onModuleInit();
    expect((await queue.queueStatus()).enabled).toBe(true);
    const hotelId = `test-${randomUUID()}`;
    await queue.enqueue(hotelId);
    const result = await Promise.race([
      processed,
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('worker timeout')), 10000).unref();
      }),
    ]);
    expect(result).toBe(hotelId);
  }, 15000);
});

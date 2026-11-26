import { randomUUID } from 'node:crypto';
import { HotelStatus, HotelSubmissionStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  EmbeddingProvider,
  EmbeddingProviderError,
} from './embedding-provider';
import { HotelEmbeddingService } from './hotel-embedding.service';

const testDb = process.env.AI_TEST_DATABASE_URL;
const describeDb = testDb?.includes('booking_travel_ai14_test')
  ? describe
  : describe.skip;

describeDb('hotel embedding PostgreSQL/pgvector integration', () => {
  let prisma: PrismaService;
  let service: HotelEmbeddingService;
  let provider: EmbeddingProvider;
  const userIds: string[] = [];
  const hotelIds: string[] = [];

  function snapshot(name: string, description: string) {
    return {
      name,
      description,
      amenities: [{ id: 'pool', name: 'Hồ bơi' }],
      policy: {
        houseRules: 'Không hút thuốc',
        cancellationPolicy: 'Hủy trước một ngày',
      },
      contactEmail: 'private@example.com',
      licenseNumber: '123456789012',
      rooms: [{ name: 'Private room', basePrice: 2000000 }],
    };
  }

  async function makeHotel(
    ownerId: string,
    name: string,
    status: HotelStatus,
    visible = true,
  ) {
    const id = `ai14-${randomUUID()}`;
    hotelIds.push(id);
    await prisma.hotel.create({
      data: {
        id,
        ownerId,
        name,
        slug: id,
        status,
        isVisible: visible,
        profileVersion: 1,
      },
    });
    await prisma.hotelSubmission.create({
      data: {
        id: randomUUID(),
        hotelId: id,
        ownerId,
        version: 1,
        status:
          status === HotelStatus.APPROVED
            ? HotelSubmissionStatus.APPROVED
            : HotelSubmissionStatus.PENDING,
        snapshot: snapshot(name, `Mô tả ${name}`),
      },
    });
    return id;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = testDb;
    prisma = new PrismaService();
    await prisma.$connect();
    provider = {
      configured: true,
      model: 'test-model',
      provider: 'openai-compatible',
      dimensions: 1536,
      embed: (texts: string[]) =>
        Promise.resolve(
          texts.map((text) => {
            const vector = Array<number>(1536).fill(0);
            vector[/marina/i.test(text) ? 0 : 1] = 1;
            return vector;
          }),
        ),
    };
    service = new HotelEmbeddingService(prisma, provider);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.hotelEmbeddingChunk.deleteMany({
      where: { hotelId: { in: hotelIds } },
    });
    await prisma.hotelEmbeddingState.deleteMany({
      where: { hotelId: { in: hotelIds } },
    });
    await prisma.hotelSubmission.deleteMany({
      where: { hotelId: { in: hotelIds } },
    });
    await prisma.hotel.deleteMany({ where: { id: { in: hotelIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it('indexes approved public snapshots, blocks hidden/pending, and rejects stale versions', async () => {
    const ownerA = `ai14-${randomUUID()}`;
    const ownerB = `ai14-${randomUUID()}`;
    userIds.push(ownerA, ownerB);
    for (const id of userIds)
      await prisma.user.create({
        data: {
          id,
          fullName: id,
          passwordHash: 'test-only',
          role: UserRole.HOTEL_OWNER,
        },
      });
    const marina = await makeHotel(ownerA, 'Marina', HotelStatus.APPROVED);
    const river = await makeHotel(ownerB, 'Riverside', HotelStatus.APPROVED);
    const pending = await makeHotel(
      ownerA,
      'Pending Marina',
      HotelStatus.PENDING,
    );
    const hidden = await makeHotel(
      ownerB,
      'Hidden Marina',
      HotelStatus.APPROVED,
      false,
    );

    expect(await service.indexHotel(marina)).toBe('READY');
    expect(await service.indexHotel(marina)).toBe('UNCHANGED');
    expect(await service.indexHotel(river)).toBe('READY');
    expect(await service.indexHotel(pending)).toBe('REMOVED');
    expect(await service.indexHotel(hidden)).toBe('REMOVED');
    const first = await service.retrieve({
      useCase: 'PUBLIC_SEARCH',
      query: 'Marina',
      topK: 10,
    });
    expect(first.results.map((row) => row.hotelId)).toEqual([marina]);
    expect(
      first.results.every(
        (row) => !row.excerpt.includes('private@example.com'),
      ),
    ).toBe(true);
    const scoped = await service.retrieve({
      useCase: 'HOTEL_SUPPORT',
      query: 'Riverside',
      hotelId: river,
    });
    expect(scoped.results.length).toBeGreaterThan(0);
    expect(scoped.results.every((row) => row.hotelId === river)).toBe(true);
    expect(
      (await service.retrieve({ useCase: 'HOTEL_SUPPORT', query: 'Marina' }))
        .status,
    ).toBe('INSUFFICIENT_DATA');

    await prisma.hotel.update({
      where: { id: marina },
      data: { isVisible: false },
    });
    expect(
      (await service.retrieve({ useCase: 'PUBLIC_SEARCH', query: 'Marina' }))
        .results,
    ).toHaveLength(0);
    await prisma.hotel.update({
      where: { id: marina },
      data: { isVisible: true, profileVersion: 2 },
    });
    await prisma.hotelSubmission.create({
      data: {
        id: randomUUID(),
        hotelId: marina,
        ownerId: ownerA,
        version: 2,
        status: HotelSubmissionStatus.APPROVED,
        snapshot: snapshot('Marina new', 'New public description'),
      },
    });
    expect(
      (await service.retrieve({ useCase: 'PUBLIC_SEARCH', query: 'Marina' }))
        .results,
    ).toHaveLength(0);
    expect(await service.indexHotel(marina)).toBe('READY');
    const updated = await service.retrieve({
      useCase: 'PUBLIC_SEARCH',
      query: 'Marina',
    });
    expect(updated.results.every((row) => row.sourceVersion === 2)).toBe(true);
    expect(
      updated.results.some((row) => row.excerpt.includes('Marina new')),
    ).toBe(true);
    expect(
      await prisma.hotelEmbeddingChunk.count({ where: { hotelId: marina } }),
    ).toBe(4);
    await prisma.hotel.update({
      where: { id: marina },
      data: { profileVersion: 3 },
    });
    await prisma.hotelSubmission.create({
      data: {
        id: randomUUID(),
        hotelId: marina,
        ownerId: ownerA,
        version: 3,
        status: HotelSubmissionStatus.APPROVED,
        snapshot: snapshot('Marina new', 'New public description'),
      },
    });
    const embedSpy = jest.spyOn(provider, 'embed');
    expect(await service.indexHotel(marina)).toBe('UNCHANGED');
    expect(embedSpy).not.toHaveBeenCalled();
    embedSpy.mockRestore();
    expect(
      (
        await service.retrieve({ useCase: 'PUBLIC_SEARCH', query: 'Marina' })
      ).results.every((row) => row.sourceVersion === 3),
    ).toBe(true);
    const alternate = {
      ...provider,
      provider: 'alternate-test-provider',
    } as unknown as EmbeddingProvider;
    const alternateService = new HotelEmbeddingService(prisma, alternate);
    expect(await alternateService.indexHotel(marina)).toBe('READY');
    expect(
      (
        await service.retrieve({
          useCase: 'HOTEL_SUPPORT',
          query: 'Marina',
          hotelId: marina,
        })
      ).results,
    ).toHaveLength(0);
    expect(
      (
        await alternateService.retrieve({
          useCase: 'HOTEL_SUPPORT',
          query: 'Marina',
          hotelId: marina,
        })
      ).results.length,
    ).toBeGreaterThan(0);
  });

  it('does not publish after suspension while provider is still running', async () => {
    const hotelId = await makeHotel(
      userIds[0],
      'Marina race',
      HotelStatus.APPROVED,
    );
    const originalEmbed = provider.embed.bind(provider);
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    provider.embed = async (texts: string[]) => {
      started();
      await gate;
      return originalEmbed(texts);
    };
    try {
      const indexing = service.indexHotel(hotelId);
      await began;
      await prisma.hotel.update({
        where: { id: hotelId },
        data: { status: HotelStatus.SUSPENDED, isVisible: false },
      });
      release();
      expect(await indexing).toBe('UNCHANGED');
      expect(
        await prisma.hotelEmbeddingChunk.count({ where: { hotelId } }),
      ).toBe(0);
      expect(
        (
          await service.retrieve({
            useCase: 'HOTEL_SUPPORT',
            query: 'Marina',
            hotelId,
          })
        ).results,
      ).toHaveLength(0);
    } finally {
      release();
      provider.embed = originalEmbed;
    }
  });

  it('records provider failure without exposing data, then resumes idempotently', async () => {
    const hotelId = await makeHotel(
      userIds[1],
      'Marina retry',
      HotelStatus.APPROVED,
    );
    const originalEmbed = provider.embed.bind(provider);
    provider.embed = () =>
      Promise.reject(new EmbeddingProviderError('PROVIDER_RATE_LIMIT', true));
    try {
      await expect(service.indexHotel(hotelId)).rejects.toMatchObject({
        code: 'PROVIDER_RATE_LIMIT',
      });
      const state = await prisma.hotelEmbeddingState.findUnique({
        where: { hotelId_model: { hotelId, model: provider.model } },
      });
      expect(state?.status).toBe('FAILED');
      expect(state?.errorCode).toBe('PROVIDER_RATE_LIMIT');
      expect(
        (
          await service.retrieve({
            useCase: 'HOTEL_SUPPORT',
            query: 'Marina',
            hotelId,
          })
        ).status,
      ).toBe('INSUFFICIENT_DATA');
    } finally {
      provider.embed = originalEmbed;
    }
    expect(await service.indexHotel(hotelId)).toBe('READY');
    expect(await service.indexHotel(hotelId)).toBe('UNCHANGED');
    expect(await prisma.hotelEmbeddingChunk.count({ where: { hotelId } })).toBe(
      4,
    );
  });
});

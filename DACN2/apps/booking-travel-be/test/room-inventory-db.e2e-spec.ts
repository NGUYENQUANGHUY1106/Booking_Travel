import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AccommodationPreferenceType, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../src/common/types/authenticated-user';
import { AuditService } from '../src/common/authorization/audit.service';
import { AuthorizationService } from '../src/common/authorization/authorization.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { HotelMediaService } from '../src/modules/hotels/hotel-media.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import {
  BookingQuoteToken,
  policyFingerprint,
} from '../src/modules/bookings/booking-quote-token';
import { HotelsService } from '../src/modules/hotels/hotels.service';
import { InventoryService } from '../src/modules/rooms/inventory.service';
import { RoomsService } from '../src/modules/rooms/rooms.service';
import { PricingService } from '../src/modules/pricing/pricing.service';

const describeWithDatabase =
  process.env.RUN_DB_INVENTORY_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-OWN-08 PostgreSQL inventory and booking gate', () => {
  const prisma = new PrismaService();
  const ownerId = randomUUID();
  const otherOwnerId = randomUUID();
  const travelerId = randomUUID();
  const hotelId = randomUUID();
  const roomId = randomUUID();
  const amenityId = randomUUID();
  const owner: AuthenticatedUser = {
    id: ownerId,
    role: UserRole.HOTEL_OWNER,
    permissions: [],
  };
  const otherOwner: AuthenticatedUser = {
    id: otherOwnerId,
    role: UserRole.HOTEL_OWNER,
    permissions: [],
  };
  const inventory = new InventoryService(prisma);
  const pricing = new PricingService(prisma);
  const authorization = new AuthorizationService(prisma);
  const rooms = new RoomsService(
    prisma,
    authorization,
    {} as HotelMediaService,
    pricing,
  );
  const hotels = new HotelsService(
    prisma,
    {} as AuthorizationService,
    {
      listMetadata: () => Promise.resolve(new Map()),
    } as unknown as HotelMediaService,
  );
  const bookings = new BookingsService(
    prisma,
    {} as AuthorizationService,
    {} as AuditService,
    pricing,
  );
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const start = day(30);
  const end = day(33);
  const after = day(34);
  const traveler: AuthenticatedUser = {
    id: travelerId,
    role: UserRole.USER,
    permissions: [],
    sessionId: 'inventory-test-session',
  };
  const bookingRequest = (roomCount: number, adults: number) => ({
    roomId,
    checkIn: start,
    checkOut: end,
    adults,
    roomCount,
    guestName: 'QA Guest',
    guestEmail: 'qa@example.invalid',
    quoteId: new BookingQuoteToken().issue({
      userId: travelerId,
      sessionId: traveler.sessionId!,
      roomId,
      hotelId,
      checkIn: start,
      checkOut: end,
      adults,
      children: 0,
      roomCount,
      currency: 'VND',
      totalAmount: String(500000 * 3 * roomCount),
      cancellationPolicyHash: policyFingerprint(
        'Hủy miễn phí trước khi nhận phòng.',
      ),
    }).quoteId,
  });

  beforeAll(async () => {
    await prisma.$connect();
    for (const [id, role] of [
      [ownerId, UserRole.HOTEL_OWNER],
      [otherOwnerId, UserRole.HOTEL_OWNER],
      [travelerId, UserRole.USER],
    ] as const)
      await prisma.user.create({
        data: {
          id,
          email: `${id}@example.invalid`,
          fullName: 'Inventory QA',
          passwordHash: 'unused',
          role,
          status: 'ACTIVE',
          isActive: true,
        },
      });
    await prisma.amenityCatalog.create({
      data: { id: amenityId, name: 'QA Wi-Fi' },
    });
    await prisma.hotel.create({
      data: {
        id: hotelId,
        ownerId,
        name: 'Inventory QA hotel',
        slug: hotelId,
        accommodationType: AccommodationPreferenceType.HOTEL,
        starRating: 4,
        status: 'APPROVED',
        isVisible: true,
        amenityLinks: { create: { amenityId } },
        policy: {
          create: { cancellationPolicy: 'Hủy miễn phí trước khi nhận phòng.' },
        },
      },
    });
    await prisma.room.create({
      data: {
        id: roomId,
        hotelId,
        name: 'QA room type',
        type: 'QA',
        bedInfo: 'Double',
        quantity: 10,
        basePrice: 500000,
      },
    });
  });

  afterAll(async () => {
    await prisma.roomInventoryAudit.deleteMany({ where: { roomId } });
    await prisma.roomInventoryBlock.deleteMany({ where: { roomId } });
    await prisma.roomInventoryOverride.deleteMany({ where: { roomId } });
    await prisma.booking.deleteMany({ where: { roomId } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.hotel.deleteMany({ where: { id: hotelId } });
    await prisma.amenityCatalog.deleteMany({ where: { id: amenityId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, otherOwnerId, travelerId] } },
    });
    await prisma.$disconnect();
  });

  it('shares a room-night source across owner, public availability and booking create', async () => {
    await bookings.create(traveler, bookingRequest(4, 4));
    const current = await inventory.month(
      owner,
      hotelId,
      roomId,
      start.slice(0, 7),
    );
    const key = randomUUID();
    const command = {
      startDate: start,
      endDateExclusive: end,
      quantity: 3,
      reason: 'Bảo trì',
      idempotencyKey: key,
      expectedRevision: current.revision,
    };
    const block = await inventory.createBlock(owner, hotelId, roomId, command);
    expect(
      (await inventory.createBlock(owner, hotelId, roomId, command)).blockId,
    ).toBe(block.blockId);
    expect(
      (await rooms.availability(roomId, { checkIn: start, checkOut: end }))
        .availableRooms,
    ).toBe(3);
    expect(
      (await rooms.availability(roomId, { checkIn: end, checkOut: after }))
        .availableRooms,
    ).toBe(10);
    await expect(
      bookings.create(traveler, bookingRequest(4, 4)),
    ).rejects.toThrow(ConflictException);
    await expect(
      inventory.createBlock(otherOwner, hotelId, roomId, {
        ...command,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      inventory.setOverride(owner, hotelId, roomId, {
        startDate: start,
        endDateExclusive: end,
        sellableQty: 6,
        idempotencyKey: randomUUID(),
        expectedRevision: block.revision,
      }),
    ).rejects.toThrow(ConflictException);
    const released = await inventory.releaseBlock(
      owner,
      hotelId,
      roomId,
      block.blockId,
      {
        expectedRevision: block.revision,
        expectedVersion: 1,
        idempotencyKey: randomUUID(),
      },
    );
    expect(
      (await rooms.availability(roomId, { checkIn: start, checkOut: end }))
        .availableRooms,
    ).toBe(6);
    await bookings.create(traveler, bookingRequest(2, 2));
    await expect(
      inventory.createBlock(owner, hotelId, roomId, {
        ...command,
        quantity: 5,
        idempotencyKey: randomUUID(),
        expectedRevision: released.revision,
      }),
    ).rejects.toThrow(ConflictException);
    expect(
      (
        await inventory.month(owner, hotelId, roomId, start.slice(0, 7))
      ).days.find((item) => item.date === start)?.available,
    ).toBe(4);
  });

  it('serializes overlapping owner writes and rolls back a range when one night is short', async () => {
    const initial = await inventory.month(
      owner,
      hotelId,
      roomId,
      start.slice(0, 7),
    );
    const makeBlock = (
      quantity: number,
      startDate = start,
      endDateExclusive = end,
    ) =>
      inventory.createBlock(owner, hotelId, roomId, {
        startDate,
        endDateExclusive,
        quantity,
        reason: 'Bảo trì',
        expectedRevision: initial.revision,
        idempotencyKey: randomUUID(),
      });
    const results = await Promise.allSettled([makeBlock(3), makeBlock(3)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );
    const winner = results.find(
      (
        item,
      ): item is PromiseFulfilledResult<
        Awaited<ReturnType<typeof makeBlock>>
      > => item.status === 'fulfilled',
    )!.value;
    expect(
      (await rooms.availability(roomId, { checkIn: start, checkOut: end }))
        .availableRooms,
    ).toBe(1);
    const released = await inventory.releaseBlock(
      owner,
      hotelId,
      roomId,
      winner.blockId,
      {
        expectedRevision: winner.revision,
        expectedVersion: 1,
        idempotencyKey: randomUUID(),
      },
    );
    const partial = await inventory.createBlock(owner, hotelId, roomId, {
      startDate: start,
      endDateExclusive: day(31),
      quantity: 2,
      reason: 'Sử dụng riêng',
      expectedRevision: released.revision,
      idempotencyKey: randomUUID(),
    });
    const auditBefore = await prisma.roomInventoryAudit.count({
      where: { roomId },
    });
    try {
      await inventory.createBlock(owner, hotelId, roomId, {
        startDate: start,
        endDateExclusive: end,
        quantity: 3,
        reason: 'Bảo trì',
        expectedRevision: partial.revision,
        idempotencyKey: randomUUID(),
      });
      throw new Error('Expected inventory conflict');
    } catch (error) {
      if (!(error instanceof ConflictException)) throw error;
      expect(error.getResponse()).toMatchObject({
        date: start,
        availableQty: 2,
      });
    }
    expect(await prisma.roomInventoryAudit.count({ where: { roomId } })).toBe(
      auditBefore,
    );
    expect(
      (await rooms.availability(roomId, { checkIn: start, checkOut: end }))
        .availableRooms,
    ).toBe(2);
    await inventory.releaseBlock(owner, hotelId, roomId, partial.blockId, {
      expectedRevision: partial.revision,
      expectedVersion: 1,
      idempotencyKey: randomUUID(),
    });
  });

  it('rejects impossible overrides and restores base capacity after clearing', async () => {
    const current = await inventory.month(
      owner,
      hotelId,
      roomId,
      start.slice(0, 7),
    );
    await expect(
      inventory.setOverride(owner, hotelId, roomId, {
        startDate: start,
        endDateExclusive: end,
        sellableQty: 5,
        expectedRevision: current.revision,
        idempotencyKey: randomUUID(),
      }),
    ).rejects.toThrow(ConflictException);
    const changed = await inventory.setOverride(owner, hotelId, roomId, {
      startDate: start,
      endDateExclusive: end,
      sellableQty: 7,
      expectedRevision: current.revision,
      idempotencyKey: randomUUID(),
    });
    expect(
      (await rooms.availability(roomId, { checkIn: start, checkOut: end }))
        .availableRooms,
    ).toBe(1);
    await inventory.setOverride(owner, hotelId, roomId, {
      startDate: start,
      endDateExclusive: end,
      sellableQty: null,
      expectedRevision: changed.revision,
      idempotencyKey: randomUUID(),
    });
    expect(
      (await rooms.availability(roomId, { checkIn: start, checkOut: end }))
        .availableRooms,
    ).toBe(4);
    expect(() =>
      inventory.createBlock(owner, hotelId, roomId, {
        startDate: day(-1),
        endDateExclusive: day(1),
        quantity: 1,
        reason: 'Bảo trì',
        expectedRevision: changed.revision,
        idempotencyKey: randomUUID(),
      }),
    ).toThrow(BadRequestException);
  });

  it('removes a sold-out hotel from a dated public search and restores it on release', async () => {
    const current = await inventory.month(
      owner,
      hotelId,
      roomId,
      start.slice(0, 7),
    );
    const block = await inventory.createBlock(owner, hotelId, roomId, {
      startDate: start,
      endDateExclusive: end,
      quantity: 4,
      reason: 'Sử dụng riêng',
      expectedRevision: current.revision,
      idempotencyKey: randomUUID(),
    });
    const search = () =>
      hotels.list({
        search: 'Inventory QA hotel',
        checkIn: start,
        checkOut: end,
      });
    expect((await search()).some((hotel) => hotel.id === hotelId)).toBe(false);
    await inventory.releaseBlock(owner, hotelId, roomId, block.blockId, {
      expectedRevision: block.revision,
      expectedVersion: 1,
      idempotencyKey: randomUUID(),
    });
    expect((await search()).some((hotel) => hotel.id === hotelId)).toBe(true);
    expect(
      (
        await hotels.list({
          search: 'Inventory QA hotel',
          checkIn: start,
          checkOut: end,
          rooms: 5,
        })
      ).some((hotel) => hotel.id === hotelId),
    ).toBe(false);
    expect(
      (
        await hotels.list({
          search: 'Inventory QA hotel',
          checkIn: start,
          checkOut: end,
          rooms: 4,
        })
      ).some((hotel) => hotel.id === hotelId),
    ).toBe(true);
    expect(
      (
        await hotels.list({
          search: 'Inventory QA hotel',
          checkIn: start,
          checkOut: end,
          adults: 3,
          children: 0,
          rooms: 1,
        })
      ).some((hotel) => hotel.id === hotelId),
    ).toBe(false);
    expect(
      (
        await hotels.list({
          search: 'Inventory QA hotel',
          checkIn: start,
          checkOut: end,
          adults: 2,
          children: 1,
          rooms: 1,
        })
      ).some((hotel) => hotel.id === hotelId),
    ).toBe(false);

    const staySearch = await hotels.search({
      destination: 'Inventory QA hotel',
      checkIn: start,
      checkOut: end,
      adults: 8,
      children: 0,
      rooms: 4,
      page: 1,
      limit: 10,
    });
    expect(staySearch.items.some((hotel) => hotel.id === hotelId)).toBe(true);
    expect(staySearch.items[0]?.stayNights).toBe(3);
    expect(staySearch.items[0]?.stayPriceFrom).toBe('6000000');
    expect(staySearch.pagination.total).toBe(1);

    const filteredSearch = await hotels.search({
      destination: 'Inventory QA hotel',
      checkIn: start,
      checkOut: end,
      adults: 8,
      children: 0,
      rooms: 4,
      maxPrice: 500000,
      stars: [4],
      propertyTypes: [AccommodationPreferenceType.HOTEL],
      amenities: ['qa wi-fi'],
      freeCancellation: true,
      sort: 'priceAsc',
    });
    expect(filteredSearch.items.map((hotel) => hotel.id)).toEqual([hotelId]);
    expect(filteredSearch.facets.freeCancellation).toBe(1);
    expect(
      (
        await hotels.search({
          destination: 'Inventory QA hotel',
          checkIn: start,
          checkOut: end,
          adults: 8,
          children: 0,
          rooms: 4,
          minReviewScore: 8,
        })
      ).items,
    ).toEqual([]);
  });

  it('rejects shrinking total rooms below committed bookings or an active override', async () => {
    const first = await prisma.room.findUniqueOrThrow({
      where: { id: roomId },
    });
    await expect(
      rooms.update(roomId, owner, {
        expectedRevision: first.revision,
        quantity: 5,
      }),
    ).rejects.toThrow(ConflictException);
    const override = await inventory.setOverride(owner, hotelId, roomId, {
      startDate: start,
      endDateExclusive: end,
      sellableQty: 8,
      expectedRevision: first.revision,
      idempotencyKey: randomUUID(),
    });
    await expect(
      rooms.update(roomId, owner, {
        expectedRevision: override.revision,
        quantity: 7,
      }),
    ).rejects.toThrow(ConflictException);
    await inventory.setOverride(owner, hotelId, roomId, {
      startDate: start,
      endDateExclusive: end,
      sellableQty: null,
      expectedRevision: override.revision,
      idempotencyKey: randomUUID(),
    });
  });

  it('does not overbook when a booking and a block race on the same nights', async () => {
    const current = await inventory.month(
      owner,
      hotelId,
      roomId,
      start.slice(0, 7),
    );
    const results = await Promise.allSettled([
      inventory.createBlock(owner, hotelId, roomId, {
        startDate: start,
        endDateExclusive: end,
        quantity: 3,
        reason: 'Bảo trì',
        expectedRevision: current.revision,
        idempotencyKey: randomUUID(),
      }),
      bookings.create(traveler, bookingRequest(3, 2)),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(
      1,
    );
    expect(
      (await rooms.availability(roomId, { checkIn: start, checkOut: end }))
        .availableRooms,
    ).toBe(1);
  });

  it('allows zero sellable rooms on a free night and restores the base on delete', async () => {
    const current = await inventory.month(
      owner,
      hotelId,
      roomId,
      after.slice(0, 7),
    );
    const zero = await inventory.setOverride(owner, hotelId, roomId, {
      startDate: after,
      endDateExclusive: day(35),
      sellableQty: 0,
      expectedRevision: current.revision,
      idempotencyKey: randomUUID(),
    });
    expect(
      (await rooms.availability(roomId, { checkIn: after, checkOut: day(35) }))
        .availableRooms,
    ).toBe(0);
    await inventory.setOverride(owner, hotelId, roomId, {
      startDate: after,
      endDateExclusive: day(35),
      sellableQty: null,
      expectedRevision: zero.revision,
      idempotencyKey: randomUUID(),
    });
    expect(
      (await rooms.availability(roomId, { checkIn: after, checkOut: day(35) }))
        .availableRooms,
    ).toBe(10);
  });
});

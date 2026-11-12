import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuthorizationService } from '../src/common/authorization/authorization.service';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { HotelMediaService } from '../src/modules/hotels/hotel-media.service';
import { HotelsService } from '../src/modules/hotels/hotels.service';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { RoomsService } from '../src/modules/rooms/rooms.service';

const describeWithDatabase =
  process.env.RUN_DB_HTL09_E2E === '1' ? describe : describe.skip;

describeWithDatabase('ST-HTL-09 public stay availability', () => {
  const prisma = new PrismaService();
  const media = {
    listMetadata: () => Promise.resolve(new Map()),
    listPublicRoomMetadata: () => Promise.resolve(new Map()),
  } as unknown as HotelMediaService;
  const authorization = new AuthorizationService(prisma);
  const pricing = new PricingService(prisma);
  const hotels = new HotelsService(prisma, authorization, media);
  const rooms = new RoomsService(prisma, authorization, media, pricing);
  const ownerIds = [randomUUID(), randomUUID()];
  const hotelIds = [randomUUID(), randomUUID()];
  const roomIds = [randomUUID(), randomUUID()];
  const date = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  const checkIn = date(40);
  const secondNight = date(41);
  const checkOut = date(42);
  const after = date(43);

  beforeAll(async () => {
    await prisma.$connect();
    for (let i = 0; i < 2; i += 1) {
      await prisma.user.create({
        data: {
          id: ownerIds[i],
          email: `${ownerIds[i]}@example.invalid`,
          fullName: `HTL09 Owner ${i}`,
          passwordHash: 'unused',
          role: 'HOTEL_OWNER',
          status: 'ACTIVE',
          isActive: true,
        },
      });
      await prisma.hotel.create({
        data: {
          id: hotelIds[i],
          ownerId: ownerIds[i],
          name: `HTL09 QA hotel ${i}`,
          slug: hotelIds[i],
          status: 'APPROVED',
          isVisible: true,
        },
      });
      await prisma.room.create({
        data: {
          id: roomIds[i],
          hotelId: hotelIds[i],
          name: 'HTL09 Deluxe',
          type: 'QA',
          bedInfo: 'Double',
          quantity: 5,
          basePrice: 1000000,
          capacityAdults: 2,
        },
      });
    }
    await prisma.roomInventoryBlock.create({
      data: {
        hotelId: hotelIds[0],
        roomId: roomIds[0],
        startDate: new Date(`${secondNight}T00:00:00Z`),
        endDateExclusive: new Date(`${checkOut}T00:00:00Z`),
        quantity: 3,
        reason: 'QA block',
        active: true,
        actorId: ownerIds[0],
        idempotencyKey: randomUUID(),
      },
    });
  });

  afterAll(async () => {
    await prisma.roomInventoryBlock.deleteMany({
      where: { roomId: { in: roomIds } },
    });
    await prisma.roomInventoryOverride.deleteMany({
      where: { roomId: { in: roomIds } },
    });
    await prisma.roomPricingAudit.deleteMany({
      where: { roomId: { in: roomIds } },
    });
    await prisma.roomPricingRule.deleteMany({
      where: { roomId: { in: roomIds } },
    });
    await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
    await prisma.hotel.deleteMany({ where: { id: { in: hotelIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ownerIds } } });
    await prisma.$disconnect();
  });

  it('returns both owners in search and the minimum stock across the full stay', async () => {
    await pricing.createRule(
      { id: ownerIds[0], role: 'HOTEL_OWNER', permissions: [] },
      hotelIds[0],
      roomIds[0],
      {
        kind: 'DATE',
        startDate: secondNight,
        endDateExclusive: checkOut,
        price: '700000',
        expectedVersion: 1,
      },
    );
    const search = await hotels.list({
      search: 'HTL09 QA hotel',
      checkIn,
      checkOut,
      rooms: 2,
      adults: 2,
    });
    expect(search.map((hotel) => hotel.id).sort()).toEqual(
      [...hotelIds].sort(),
    );
    expect(
      search.find((hotel) => hotel.id === hotelIds[0])?.minPricePerNight,
    ).toBe('700000');
    const short = await rooms.availability(roomIds[0], {
      checkIn,
      checkOut,
      quantity: 3,
      adults: 2,
    });
    expect(short).toMatchObject({
      requestedQty: 3,
      availableQty: 2,
      canBook: false,
    });
    expect(short.rateSummary.minPricePerNight.toString()).toBe('700000');
    expect(short.rateSummary.totalRoomAmount.toString()).toBe('5100000');
    expect(short.availabilityByDate.map((night) => night.availableQty)).toEqual(
      [5, 2],
    );
    expect(
      (
        await rooms.availability(roomIds[0], {
          checkIn: checkOut,
          checkOut: after,
        })
      ).availableQty,
    ).toBe(5);
    const list = await rooms.listByHotel(hotelIds[0], undefined, {
      checkIn,
      checkOut,
      quantity: 3,
      adults: 2,
    });
    expect(list[0]).toHaveProperty('availability.availableQty', 2);
    expect(list[0]).toHaveProperty('availability.canBook', false);
    const tooMany = await hotels.list({
      search: 'HTL09 QA hotel',
      checkIn,
      checkOut,
      rooms: 3,
      adults: 2,
    });
    expect(tooMany.map((hotel) => hotel.id)).toEqual([hotelIds[1]]);
    const noCapacity = await hotels.list({
      search: 'HTL09 QA hotel',
      checkIn,
      checkOut,
      rooms: 2,
      adults: 5,
    });
    expect(noCapacity).toHaveLength(0);
    expect(
      await hotels.list({
        search: 'HTL09 QA hotel',
        checkIn,
        checkOut,
        rooms: 1,
        children: 1,
      }),
    ).toHaveLength(0);
    const block = await prisma.roomInventoryBlock.findFirstOrThrow({
      where: { roomId: roomIds[0] },
    });
    await prisma.roomInventoryBlock.update({
      where: { id: block.id },
      data: { quantity: 5 },
    });
    const soldOut = await rooms.availability(roomIds[0], { checkIn, checkOut });
    expect(
      soldOut.availabilityByDate.map((night) => night.availableQty),
    ).toEqual([5, 0]);
    expect(soldOut).toMatchObject({ availableQty: 0, canBook: false });
    await prisma.roomInventoryBlock.update({
      where: { id: block.id },
      data: { quantity: 3 },
    });
    expect(
      (await rooms.availability(roomIds[0], { checkIn, checkOut }))
        .availableQty,
    ).toBe(2);
  });

  it('hides a suspended hotel and inactive room from public search and direct requests', async () => {
    await prisma.hotel.update({
      where: { id: hotelIds[0] },
      data: { status: 'SUSPENDED' },
    });
    expect(
      (await hotels.list({ search: 'HTL09 QA hotel', checkIn, checkOut })).map(
        (hotel) => hotel.id,
      ),
    ).toEqual([hotelIds[1]]);
    await expect(
      rooms.availability(roomIds[0], { checkIn, checkOut }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      rooms.listByHotel(hotelIds[0], undefined, { checkIn, checkOut }),
    ).rejects.toThrow(ForbiddenException);
    await prisma.hotel.update({
      where: { id: hotelIds[0] },
      data: { status: 'APPROVED' },
    });
    await prisma.room.update({
      where: { id: roomIds[0] },
      data: { status: 'INACTIVE' },
    });
    await expect(
      rooms.availability(roomIds[0], { checkIn, checkOut }),
    ).rejects.toThrow(NotFoundException);
    expect(
      await rooms.listByHotel(hotelIds[0], undefined, { checkIn, checkOut }),
    ).toHaveLength(0);
  });
});

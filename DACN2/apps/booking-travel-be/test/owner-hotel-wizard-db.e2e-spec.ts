import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  AdministrativeCatalogMode,
  AdministrativeLevel,
  Prisma,
} from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { AdminModule } from '../src/modules/admin/admin.module';
import { HotelsModule } from '../src/modules/hotels/hotels.module';
import { RoomsModule } from '../src/modules/rooms/rooms.module';

const describeWithDatabase =
  process.env.RUN_DB_HOTEL_E2E === '1' ? describe : describe.skip;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9f9WcAAAAASUVORK5CYII=',
  'base64',
);
type HotelProfile = {
  id: string;
  status: string;
  profileVersion: number;
  completion: { location: boolean };
  gallery: { id: string; isCover: boolean; url: string }[];
  amenities: string[];
  readyForReview: boolean;
};
const profileBody = (response: { body: unknown }) =>
  response.body as HotelProfile;
const reservationBody = (response: { body: unknown }) =>
  response.body as { mediaId: string; uploadUrl: string };
const submissionErrorBody = (response: { body: unknown }) =>
  response.body as { code?: string; checklist?: unknown[] };
const submissionDetailBody = (response: { body: unknown }) =>
  response.body as {
    snapshot: { rooms: unknown[]; checklist: unknown[] };
    media: { id: string; url: string }[];
    evidence: { canApprove: boolean };
  };
const reviewQueueBody = (response: { body: unknown }) =>
  response.body as {
    items: {
      id: string;
      hotelId: string;
      version: number;
      accommodationType: string;
      coverImageUrl: string | null;
    }[];
    total: number;
  };
const decisionBody = (response: { body: unknown }) =>
  response.body as { requestId: string };

describeWithDatabase('ST-OWN-04 five-step owner hotel wizard', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerA: string;
  let ownerB: string;
  let admin: string;
  let hotelId: string;
  const sessionIds: string[] = [];
  const mediaIds: string[] = [];

  beforeAll(async () => {
    process.env.SKIP_DATABASE_CONNECT = 'false';
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env', '../../.env'],
          load: [configuration],
        }),
        DatabaseModule,
        AdminModule,
        HotelsModule,
        RoomsModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    const jwt = app.get(JwtService);
    const users = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'owner@bookingtravel.vn',
            'owner-b@bookingtravel.vn',
            'admin@bookingtravel.vn',
          ],
        },
      },
      select: { id: true, email: true },
    });
    const token = async (email: string) => {
      const userId = users.find((user) => user.email === email)?.id;
      if (!userId) throw new Error(`Thiếu tài khoản seed ${email}`);
      const sessionId = `owner-wizard-e2e-${Date.now()}-${userId}`;
      sessionIds.push(sessionId);
      await prisma.authSession.create({
        data: {
          id: sessionId,
          userId,
          refreshTokenHash: sessionId,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
      return `Bearer ${jwt.sign({ sub: userId, sessionId })}`;
    };
    ownerA = await token('owner@bookingtravel.vn');
    ownerB = await token('owner-b@bookingtravel.vn');
    admin = await token('admin@bookingtravel.vn');
  });

  afterAll(async () => {
    if (prisma) {
      if (hotelId) {
        await prisma.hotelSubmission.deleteMany({ where: { hotelId } });
        await prisma.hotelMedia.deleteMany({ where: { hotelId } });
        await prisma.hotelAmenity.deleteMany({ where: { hotelId } });
        await prisma.booking.deleteMany({ where: { hotelId } });
        await prisma.room.deleteMany({ where: { hotelId } });
        await prisma.hotelPolicy.deleteMany({ where: { hotelId } });
        await prisma.hotel.deleteMany({ where: { id: hotelId } });
      }
      await prisma.authSession.deleteMany({
        where: { id: { in: sessionIds } },
      });
    }
    await Promise.all(
      mediaIds.map((id) =>
        unlink(resolve('../../.local-media', id)).catch(() => undefined),
      ),
    );
    await app?.close();
  });

  it('persists location, three images, cover, amenities and submission with owner isolation', async () => {
    const server = app.getHttpServer();
    const create = profileBody(
      await request(server)
        .post('/api/owner/hotels')
        .set('Authorization', ownerA)
        .send({
          clientDraftId: `wizard-${Date.now()}`,
          name: 'Marriot kiểm thử',
          accommodationType: 'RESORT',
          description: 'Khách sạn thử nghiệm',
        })
        .expect(201),
    );
    hotelId = create.id;
    expect(create.status).toBe('DRAFT');
    await request(server)
      .get(`/api/owner/hotels/${hotelId}`)
      .set('Authorization', ownerB)
      .expect(403);
    const otherOwnerHotels = await request(server)
      .get('/api/owner/hotels')
      .set('Authorization', ownerB)
      .expect(200);
    expect(
      (otherOwnerHotels.body as { id: string }[]).some(
        (item) => item.id === hotelId,
      ),
    ).toBe(false);
    await request(server).get(`/api/hotels/${hotelId}`).expect(403);
    const province = await prisma.administrativeUnit.findFirstOrThrow({
      where: {
        catalogMode: AdministrativeCatalogMode.CURRENT,
        level: AdministrativeLevel.PROVINCE,
      },
      select: { id: true },
    });
    const ward = await prisma.administrativeUnit.findFirstOrThrow({
      where: {
        catalogMode: AdministrativeCatalogMode.CURRENT,
        level: AdministrativeLevel.COMMUNE,
        parentId: province.id,
      },
      select: { id: true },
    });
    const partialLocation = profileBody(
      await request(server)
        .patch(`/api/owner/hotels/${hotelId}/location`)
        .set('Authorization', ownerA)
        .send({
          expectedVersion: create.profileVersion,
          addressLine: '123 Đường Biển',
        })
        .expect(200),
    );
    expect(partialLocation.completion.location).toBe(false);
    const incompleteLocation = await request(server)
      .post(`/api/owner/hotels/${hotelId}/submit`)
      .set('Authorization', ownerA)
      .send({ expectedVersion: partialLocation.profileVersion })
      .expect(400);
    expect(submissionErrorBody(incompleteLocation).code).toBe(
      'HOTEL_SUBMISSION_INCOMPLETE',
    );
    expect(submissionErrorBody(incompleteLocation).checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'location',
          targetStep: 'hotel-location',
          complete: false,
        }),
      ]),
    );
    const location = profileBody(
      await request(server)
        .patch(`/api/owner/hotels/${hotelId}/location`)
        .set('Authorization', ownerA)
        .send({
          expectedVersion: partialLocation.profileVersion,
          addressLine: '123 Đường Biển',
          provinceUnitId: province.id,
          wardUnitId: ward.id,
          latitude: 16.0544,
          longitude: 108.2022,
        })
        .expect(200),
    );
    expect(location.completion.location).toBe(true);
    const incompleteMedia = await request(server)
      .post(`/api/owner/hotels/${hotelId}/submit`)
      .set('Authorization', ownerA)
      .send({ expectedVersion: location.profileVersion })
      .expect(400);
    expect(submissionErrorBody(incompleteMedia).checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'media',
          targetStep: 'hotel-media',
          complete: false,
        }),
      ]),
    );
    const point = await prisma.$queryRaw<
      { latitude: number; longitude: number; srid: number }[]
    >`
      SELECT ST_Y("location"::geometry) AS latitude,
             ST_X("location"::geometry) AS longitude,
             ST_SRID("location"::geometry) AS srid
      FROM "Hotel" WHERE "id" = ${hotelId}
    `;
    expect(point[0]?.latitude).toBeCloseTo(16.0544);
    expect(point[0]?.longitude).toBeCloseTo(108.2022);
    expect(point[0]?.srid).toBe(4326);
    await request(server)
      .patch(`/api/owner/hotels/${hotelId}/location`)
      .set('Authorization', ownerA)
      .send({
        expectedVersion: location.profileVersion,
        addressLine: 'Sai tọa độ',
        provinceUnitId: province.id,
        wardUnitId: ward.id,
        latitude: 25,
        longitude: 108.2022,
      })
      .expect(400);
    await request(server)
      .patch(`/api/owner/hotels/${hotelId}/location`)
      .set('Authorization', ownerB)
      .send({
        expectedVersion: location.profileVersion,
        addressLine: '456 Đường Sai',
        provinceUnitId: province.id,
        wardUnitId: ward.id,
        latitude: 16.0544,
        longitude: 108.2022,
      })
      .expect(404);

    for (let index = 0; index < 3; index++) {
      const bytes = Buffer.concat([PNG, Buffer.from([index])]);
      const reserved = reservationBody(
        await request(server)
          .post(`/api/owner/hotels/${hotelId}/media/presign`)
          .set('Authorization', ownerA)
          .send({ mimeType: 'image/png', sizeBytes: bytes.length })
          .expect(201),
      );
      mediaIds.push(reserved.mediaId);
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/media/finalize`)
        .set('Authorization', ownerB)
        .send({ mediaId: reserved.mediaId })
        .expect(404);
      await request(server)
        .put(reserved.uploadUrl)
        .set('Content-Type', 'image/png')
        .send(bytes)
        .expect(204);
      const finalized = profileBody(
        await request(server)
          .post(`/api/owner/hotels/${hotelId}/media/finalize`)
          .set('Authorization', ownerA)
          .send({ mediaId: reserved.mediaId })
          .expect(201),
      );
      expect(finalized.gallery).toHaveLength(index + 1);
    }
    let profile = profileBody(
      await request(server)
        .get(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .expect(200),
    );
    expect(profile.gallery).toHaveLength(3);
    await request(server)
      .post(`/api/owner/hotels/${hotelId}/media/presign`)
      .set('Authorization', ownerB)
      .send({ mimeType: 'image/png', sizeBytes: PNG.length })
      .expect(404);
    await request(server)
      .patch(`/api/owner/hotels/${hotelId}/media/cover`)
      .set('Authorization', ownerB)
      .send({ expectedVersion: profile.profileVersion, mediaId: mediaIds[1] })
      .expect(404);
    await request(server)
      .delete(`/api/owner/hotels/${hotelId}/media/${mediaIds[0]}`)
      .set('Authorization', ownerB)
      .send({ expectedVersion: profile.profileVersion })
      .expect(404);
    profile = profileBody(
      await request(server)
        .patch(`/api/owner/hotels/${hotelId}/media/cover`)
        .set('Authorization', ownerA)
        .send({
          expectedVersion: profile.profileVersion,
          mediaId: mediaIds[1],
        })
        .expect(200),
    );
    expect(
      profile.gallery.filter((image: { isCover: boolean }) => image.isCover),
    ).toHaveLength(1);
    expect(
      profile.gallery.find((image: { isCover: boolean }) => image.isCover)?.id,
    ).toBe(mediaIds[1]);
    await request(server)
      .put(`/api/owner/hotels/${hotelId}/media/order`)
      .set('Authorization', ownerB)
      .send({ expectedVersion: profile.profileVersion, mediaIds })
      .expect(404);
    profile = profileBody(
      await request(server)
        .put(`/api/owner/hotels/${hotelId}/media/order`)
        .set('Authorization', ownerA)
        .send({
          expectedVersion: profile.profileVersion,
          mediaIds: [...mediaIds].reverse(),
        })
        .expect(200),
    );
    expect(profile.gallery.map((image: { id: string }) => image.id)).toEqual(
      [...mediaIds].reverse(),
    );
    await request(server).get(profile.gallery[0].url).expect(200);

    const fourthBytes = Buffer.concat([PNG, Buffer.from([4])]);
    const fourth = reservationBody(
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/media/presign`)
        .set('Authorization', ownerA)
        .send({ mimeType: 'image/png', sizeBytes: fourthBytes.length })
        .expect(201),
    );
    mediaIds.push(fourth.mediaId);
    await request(server)
      .put(fourth.uploadUrl)
      .set('Content-Type', 'image/png')
      .send(fourthBytes)
      .expect(204);
    profile = profileBody(
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/media/finalize`)
        .set('Authorization', ownerA)
        .send({ mediaId: fourth.mediaId })
        .expect(201),
    );
    profile = profileBody(
      await request(server)
        .patch(`/api/owner/hotels/${hotelId}/media/cover`)
        .set('Authorization', ownerA)
        .send({
          expectedVersion: profile.profileVersion,
          mediaId: fourth.mediaId,
        })
        .expect(200),
    );
    profile = profileBody(
      await request(server)
        .delete(`/api/owner/hotels/${hotelId}/media/${fourth.mediaId}`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: profile.profileVersion })
        .expect(200),
    );
    expect(profile.gallery).toHaveLength(3);
    expect(profile.gallery.find((image) => image.isCover)?.id).toBe(
      mediaIds[2],
    );
    profile = profileBody(
      await request(server)
        .patch(`/api/owner/hotels/${hotelId}/media/cover`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: profile.profileVersion, mediaId: mediaIds[1] })
        .expect(200),
    );

    profile = profileBody(
      await request(server)
        .patch(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .send({
          expectedVersion: profile.profileVersion,
          amenityIds: ['WIFI', 'POOL'],
          contactEmail: 'owner@example.com',
          checkInTime: '14:00',
          checkOutTime: '12:00',
          policy: {
            cancellationPolicy: 'Hủy trước 24 giờ',
            houseRules: 'Không hút thuốc',
          },
        })
        .expect(200),
    );
    expect(profile.amenities).toEqual(expect.arrayContaining(['WIFI', 'POOL']));
    expect(profile.readyForReview).toBe(false);
    const incompleteRooms = await request(server)
      .post(`/api/owner/hotels/${hotelId}/submit`)
      .set('Authorization', ownerA)
      .send({ expectedVersion: profile.profileVersion })
      .expect(400);
    expect(submissionErrorBody(incompleteRooms).checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'rooms',
          targetStep: 'rooms',
          complete: false,
        }),
      ]),
    );
    expect(await prisma.hotelSubmission.count({ where: { hotelId } })).toBe(0);
    await request(server)
      .post(`/api/owner/hotels/${hotelId}/submit`)
      .set('Authorization', ownerB)
      .send({ expectedVersion: profile.profileVersion })
      .expect(403);
    const catalog = await request(server).get('/api/rooms/catalog').expect(200);
    const roomCatalog = catalog.body as {
      classes: unknown[];
      views: unknown[];
      beds: unknown[];
    };
    expect(roomCatalog.classes).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'VIP' })]),
    );
    expect(roomCatalog.views).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NOVIEW' })]),
    );
    expect(roomCatalog.beds).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SOFA' })]),
    );
    const room = await request(server)
      .post(`/api/hotels/${hotelId}/rooms`)
      .set('Authorization', ownerA)
      .send({
        name: 'Deluxe Sea View',
        type: 'DLX-SEA-KING',
        classCode: 'DLX',
        viewCode: 'SEA',
        bedConfigurations: [{ bedType: 'KING', quantity: 1 }],
        areaM2: 32,
        bedInfo: '1 giường King',
        capacityAdults: 2,
        capacityChildren: 0,
        quantity: 10,
        basePrice: 1450000,
        currency: 'VND',
        amenities: ['WIFI'],
      })
      .expect(201);
    const createdRoom = room.body as {
      id: string;
      bedConfigurations: unknown[];
      quantity: number;
    };
    const roomId = createdRoom.id;
    let roomRevision = 1;
    expect(createdRoom.bedConfigurations).toEqual([
      { bedType: 'KING', quantity: 1 },
    ]);
    expect(createdRoom.quantity).toBe(10);
    const listedRooms = await request(server)
      .get(`/api/hotels/${hotelId}/rooms`)
      .set('Authorization', ownerA)
      .expect(200);
    expect(listedRooms.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: roomId,
          classCode: 'DLX',
          viewCode: 'SEA',
        }),
      ]),
    );
    await request(server)
      .get(`/api/hotels/${hotelId}/rooms`)
      .set('Authorization', ownerB)
      .expect(403);
    await request(server)
      .post(`/api/hotels/${hotelId}/rooms`)
      .set('Authorization', ownerA)
      .send({
        name: 'Deluxe khác',
        type: 'dlx-sea-king',
        areaM2: 32,
        bedInfo: '1 giường King',
        capacityAdults: 2,
        quantity: 1,
        basePrice: 500000,
      })
      .expect(409);
    const legacy = await request(server)
      .post(`/api/hotels/${hotelId}/rooms`)
      .set('Authorization', ownerA)
      .send({
        name: 'Vip',
        type: 'lp',
        areaM2: 25,
        bedInfo: '1 giường đôi',
        capacityAdults: 2,
        quantity: 1,
        basePrice: 1500000,
      })
      .expect(201);
    const legacyId = (legacy.body as { id: string }).id;
    const repriced = await request(server)
      .patch(`/api/rooms/${legacyId}`)
      .set('Authorization', ownerA)
      .send({ basePrice: 1600000, expectedRevision: 1 })
      .expect(200);
    expect(repriced.body).toEqual(
      expect.objectContaining({
        name: 'Vip',
        type: 'LP',
        bedInfo: '1 giường đôi',
        classCode: null,
        viewCode: null,
      }),
    );
    const ownerId = (
      await prisma.hotel.findUniqueOrThrow({
        where: { id: hotelId },
        select: { ownerId: true },
      })
    ).ownerId;
    const futureBooking = await prisma.booking.create({
      data: {
        code: `OWN04-INVENTORY-${Date.now()}`,
        userId: ownerId,
        hotelId,
        roomId,
        roomNameSnapshot: 'Deluxe Sea View',
        roomTypeSnapshot: 'DLX-SEA-KING',
        checkIn: new Date(Date.now() + 86_400_000),
        checkOut: new Date(Date.now() + 3 * 86_400_000),
        adults: 2,
        roomCount: 6,
        nights: 2,
        pricePerNight: 1450000,
        totalAmount: 17400000,
        guestName: 'Kiểm thử tồn kho',
        guestEmail: 'inventory@example.com',
        status: 'CONFIRMED',
      },
    });
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ quantity: 5, expectedRevision: roomRevision })
      .expect(409);
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ quantity: 6, expectedRevision: roomRevision })
      .expect(200);
    roomRevision++;
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ quantity: 10, expectedRevision: roomRevision })
      .expect(200);
    roomRevision++;
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ status: 'INACTIVE', expectedRevision: roomRevision })
      .expect(200);
    roomRevision++;
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ name: 'Tên ghi đè từ thiết bị cũ', expectedRevision: 1 })
      .expect(409);
    const inactiveRooms = await request(server)
      .get(`/api/hotels/${hotelId}/rooms`)
      .set('Authorization', ownerA)
      .expect(200);
    expect(
      (inactiveRooms.body as { id: string; status: string }[]).find(
        (item) => item.id === roomId,
      )?.status,
    ).toBe('INACTIVE');
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: futureBooking.id },
        })
      ).status,
    ).toBe('CONFIRMED');
    await request(server)
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .expect(409);
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ status: 'ACTIVE', expectedRevision: roomRevision })
      .expect(200);
    roomRevision++;
    const roomImage = reservationBody(
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/presign`)
        .set('Authorization', ownerA)
        .send({ mimeType: 'image/png', sizeBytes: PNG.length })
        .expect(201),
    );
    mediaIds.push(roomImage.mediaId);
    await request(server)
      .post(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/presign`)
      .set('Authorization', ownerB)
      .send({ mimeType: 'image/png', sizeBytes: PNG.length })
      .expect(404);
    await request(server)
      .put(roomImage.uploadUrl)
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(204);
    const roomMedia = await request(server)
      .post(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/finalize`)
      .set('Authorization', ownerA)
      .send({ mediaId: roomImage.mediaId })
      .expect(201);
    expect(roomMedia.body).toEqual([
      expect.objectContaining({ id: roomImage.mediaId, isCover: true }),
    ]);
    const roomImageIds = [roomImage.mediaId];
    for (let index = 0; index < 2; index++) {
      const next = reservationBody(
        await request(server)
          .post(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/presign`)
          .set('Authorization', ownerA)
          .send({ mimeType: 'image/png', sizeBytes: PNG.length })
          .expect(201),
      );
      mediaIds.push(next.mediaId);
      roomImageIds.push(next.mediaId);
      await request(server)
        .put(next.uploadUrl)
        .set('Content-Type', 'image/png')
        .send(PNG)
        .expect(204);
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/finalize`)
        .set('Authorization', ownerA)
        .send({ mediaId: next.mediaId })
        .expect(201);
    }
    let roomVersion = profileBody(
      await request(server)
        .get(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .expect(200),
    ).profileVersion;
    await request(server)
      .patch(`/api/owner/hotels/${hotelId}/rooms/${legacyId}/media/cover`)
      .set('Authorization', ownerA)
      .send({ mediaId: roomImageIds[1], expectedVersion: roomVersion })
      .expect(404);
    await request(server)
      .patch(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/cover`)
      .set('Authorization', ownerB)
      .send({ mediaId: roomImageIds[1], expectedVersion: roomVersion })
      .expect(404);
    await request(server)
      .patch(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/cover`)
      .set('Authorization', ownerA)
      .send({ mediaId: roomImageIds[1], expectedVersion: roomVersion })
      .expect(200);
    await request(server)
      .put(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/order`)
      .set('Authorization', ownerA)
      .send({ mediaIds: roomImageIds, expectedVersion: roomVersion })
      .expect(409);
    roomVersion = profileBody(
      await request(server)
        .get(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .expect(200),
    ).profileVersion;
    await request(server)
      .put(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media/order`)
      .set('Authorization', ownerA)
      .send({
        mediaIds: roomImageIds.slice().reverse(),
        expectedVersion: roomVersion,
      })
      .expect(200);
    const orderedRoomImages = await request(server)
      .get(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media`)
      .set('Authorization', ownerA)
      .expect(200);
    expect(
      (orderedRoomImages.body as { id: string; isCover: boolean }[]).map(
        (item) => item.id,
      ),
    ).toEqual(roomImageIds.slice().reverse());
    expect(
      (orderedRoomImages.body as { id: string; isCover: boolean }[]).find(
        (item) => item.isCover,
      )?.id,
    ).toBe(roomImageIds[1]);
    await request(server)
      .get(`/api/owner/hotels/${hotelId}/rooms/${roomId}/media`)
      .set('Authorization', ownerB)
      .expect(404);
    await request(server)
      .post(`/api/owner/hotels/${hotelId}/media/finalize`)
      .set('Authorization', ownerA)
      .send({ mediaId: roomImage.mediaId })
      .expect(404);
    profile = profileBody(
      await request(server)
        .get(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .expect(200),
    );
    expect(profile.readyForReview).toBe(true);
    expect(profile.gallery).toHaveLength(3);
    const unfinished = reservationBody(
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/media/presign`)
        .set('Authorization', ownerA)
        .send({ mimeType: 'image/png', sizeBytes: PNG.length })
        .expect(201),
    );
    mediaIds.push(unfinished.mediaId);
    await request(server)
      .put(unfinished.uploadUrl)
      .set('Content-Type', 'image/png')
      .send(PNG)
      .expect(204);
    profile = profileBody(
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/submit`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: profile.profileVersion })
        .expect(201),
    );
    expect(profile.status).toBe('PENDING');
    await request(server)
      .post(`/api/owner/hotels/${hotelId}/media/finalize`)
      .set('Authorization', ownerA)
      .send({ mediaId: unfinished.mediaId })
      .expect(409);
    const firstVersion = profile.profileVersion;
    const repeated = profileBody(
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/submit`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: firstVersion - 1 })
        .expect(201),
    );
    expect(repeated.profileVersion).toBe(firstVersion);
    expect(
      await prisma.hotelSubmission.count({
        where: { hotelId, status: 'PENDING' },
      }),
    ).toBe(1);
    const finalizedAgain = profileBody(
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/media/finalize`)
        .set('Authorization', ownerA)
        .send({ mediaId: mediaIds[1] })
        .expect(201),
    );
    expect(finalizedAgain.gallery).toHaveLength(3);
    await request(server)
      .post(`/api/hotels/${hotelId}/rooms`)
      .set('Authorization', ownerA)
      .send({
        name: 'Phòng khác',
        type: 'STANDARD',
        areaM2: 25,
        bedInfo: '1 giường đôi',
        capacityAdults: 2,
        quantity: 1,
        basePrice: 100000,
      })
      .expect(409);
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ name: 'Phòng đã đổi', expectedRevision: roomRevision })
      .expect(409);
    await request(server)
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .expect(409);
    const submissions = await request(server)
      .get('/api/hotels/review/submissions')
      .set('Authorization', admin)
      .expect(200);
    const queue = reviewQueueBody(submissions);
    expect(queue.total).toBeGreaterThanOrEqual(1);
    const pending = queue.items.find((row) => row.hotelId === hotelId)!;
    expect(pending.accommodationType).toBe('RESORT');
    expect(pending.coverImageUrl).toContain(mediaIds[1]);
    await request(server)
      .get('/api/admin/dashboard/summary')
      .set('Authorization', ownerA)
      .expect(403);
    const dashboardSummary = await request(server)
      .get('/api/admin/dashboard/summary')
      .set('Authorization', admin)
      .expect(200);
    const summaryBody = dashboardSummary.body as {
      bookings: { count: number; period: string };
      activities: { action: string; hotelName: string }[];
    };
    expect(summaryBody.bookings.period).toBe('ROLLING_7_DAYS');
    expect(summaryBody.bookings.count).toBeGreaterThanOrEqual(0);
    expect(summaryBody.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'SUBMITTED',
          hotelName: 'Marriot kiểm thử',
        }),
      ]),
    );
    const resortQueue = await request(server)
      .get('/api/hotels/review/submissions')
      .query({
        types: 'HOTEL,RESORT',
        search: 'Marriot kiểm thử',
        page: 1,
        limit: 1,
      })
      .set('Authorization', admin)
      .expect(200);
    expect(reviewQueueBody(resortQueue).total).toBe(1);
    expect(reviewQueueBody(resortQueue).items[0].id).toBe(pending.id);
    await request(server)
      .get('/api/hotels/review/submissions')
      .query({ types: 'INVALID' })
      .set('Authorization', admin)
      .expect(400);
    expect(pending.version).toBe(firstVersion);
    await request(server)
      .get(`/api/hotels/review/submissions/${pending.id}`)
      .set('Authorization', ownerA)
      .expect(403);
    const reviewDetail = await request(server)
      .get(`/api/hotels/review/submissions/${pending.id}`)
      .set('Authorization', admin)
      .expect(200);
    expect(submissionDetailBody(reviewDetail).snapshot.rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: roomId, name: 'Deluxe Sea View' }),
      ]),
    );
    expect(submissionDetailBody(reviewDetail).media).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: mediaIds[1] })]),
    );
    expect(submissionDetailBody(reviewDetail).evidence.canApprove).toBe(true);
    expect(submissionDetailBody(reviewDetail).snapshot.checklist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'rooms', complete: true }),
      ]),
    );
    await request(server)
      .get(submissionDetailBody(reviewDetail).media[0].url)
      .expect(200);
    await request(server)
      .post(`/api/hotels/review/submissions/${pending.id}/decision`)
      .set('Authorization', admin)
      .send({ decision: 'APPROVE', expectedVersion: firstVersion - 1 })
      .expect(409);
    await request(server)
      .post(`/api/hotels/review/submissions/${pending.id}/decision`)
      .set('Authorization', admin)
      .send({ decision: 'REJECT', expectedVersion: firstVersion })
      .expect(400);
    const rejectRequestId = `adm04-reject-${Date.now()}`;
    const rejectedDecision = await request(server)
      .post(`/api/hotels/review/submissions/${pending.id}/decision`)
      .set('Authorization', admin)
      .send({
        decision: 'REJECT',
        expectedVersion: firstVersion,
        reason: 'Cần sửa thông tin hồ sơ.',
        requestId: rejectRequestId,
      })
      .expect(201);
    const repeatedDecision = await request(server)
      .post(`/api/hotels/review/submissions/${pending.id}/decision`)
      .set('Authorization', admin)
      .send({
        decision: 'REJECT',
        expectedVersion: firstVersion,
        reason: 'Cần sửa thông tin hồ sơ.',
        requestId: rejectRequestId,
      })
      .expect(201);
    expect(decisionBody(repeatedDecision).requestId).toBe(
      decisionBody(rejectedDecision).requestId,
    );
    expect(
      await prisma.hotelSubmissionAudit.count({
        where: { submissionId: pending.id, action: 'REJECTED' },
      }),
    ).toBe(1);
    await request(server)
      .get(`/api/hotels/review/submissions/${pending.id}`)
      .set('Authorization', admin)
      .expect(409);
    await request(server)
      .get(submissionDetailBody(reviewDetail).media[0].url)
      .expect(403);
    const rejected = profileBody(
      await request(server)
        .get(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .expect(200),
    );
    expect(rejected.status).toBe('REJECTED');
    expect(
      (rejected as HotelProfile & { latestSubmission: { reason: string } })
        .latestSubmission.reason,
    ).toBe('Cần sửa thông tin hồ sơ.');
    const [firstResubmit, secondResubmit] = await Promise.all([
      request(server)
        .post(`/api/owner/hotels/${hotelId}/submit`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: rejected.profileVersion })
        .expect(201),
      request(server)
        .post(`/api/owner/hotels/${hotelId}/submit`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: rejected.profileVersion })
        .expect(201),
    ]);
    const resubmitted = profileBody(firstResubmit);
    expect(profileBody(secondResubmit).profileVersion).toBe(
      resubmitted.profileVersion,
    );
    expect(resubmitted.status).toBe('PENDING');
    expect(await prisma.hotelSubmission.count({ where: { hotelId } })).toBe(2);
    const next = await prisma.hotelSubmission.findFirstOrThrow({
      where: { hotelId, status: 'PENDING' },
    });
    const completeSnapshot = next.snapshot as Record<string, unknown>;
    await prisma.hotelSubmission.update({
      where: { id: next.id },
      data: { snapshot: { ...completeSnapshot, checklist: null } },
    });
    await request(server)
      .post(`/api/hotels/review/submissions/${next.id}/decision`)
      .set('Authorization', admin)
      .send({ decision: 'APPROVE', expectedVersion: next.version })
      .expect(409);
    expect(
      (await prisma.hotel.findUniqueOrThrow({ where: { id: hotelId } })).status,
    ).toBe('PENDING');
    await prisma.hotelSubmission.update({
      where: { id: next.id },
      data: { snapshot: completeSnapshot as Prisma.InputJsonObject },
    });
    await request(server)
      .post(`/api/hotels/review/submissions/${next.id}/decision`)
      .set('Authorization', ownerA)
      .send({ decision: 'APPROVE', expectedVersion: next.version })
      .expect(403);
    await request(server)
      .post(`/api/hotels/review/submissions/${pending.id}/decision`)
      .set('Authorization', admin)
      .send({
        decision: 'APPROVE',
        expectedVersion: firstVersion,
        requestId: `adm04-stale-${Date.now()}`,
      })
      .expect(409);
    expect(
      (
        await prisma.hotelSubmission.findUniqueOrThrow({
          where: { id: pending.id },
        })
      ).status,
    ).toBe('REJECTED');
    await request(server)
      .get('/api/hotels/review/submissions')
      .set('Authorization', ownerA)
      .expect(403);
    const again = profileBody(
      await request(server)
        .get(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .expect(200),
    );
    expect(again.gallery).toHaveLength(3);
    expect(
      again.gallery.find((image: { isCover: boolean }) => image.isCover)?.id,
    ).toBe(mediaIds[1]);
    await request(server).get(`/api/hotels/${hotelId}`).expect(403);
    const publicSearch = await request(server)
      .get('/api/hotels')
      .query({ search: 'Marriot kiểm thử' })
      .expect(200);
    expect(
      (publicSearch.body as { id: string }[]).some(
        (item) => item.id === hotelId,
      ),
    ).toBe(false);
    const [approvalA, approvalB] = await Promise.all([
      request(server)
        .post(`/api/hotels/review/submissions/${next.id}/decision`)
        .set('Authorization', admin)
        .send({
          decision: 'APPROVE',
          expectedVersion: next.version,
          requestId: `adm04-approve-a-${Date.now()}`,
        }),
      request(server)
        .post(`/api/hotels/review/submissions/${next.id}/decision`)
        .set('Authorization', admin)
        .send({
          decision: 'APPROVE',
          expectedVersion: next.version,
          requestId: `adm04-approve-b-${Date.now()}`,
        }),
    ]);
    expect([approvalA.status, approvalB.status].sort()).toEqual([201, 409]);
    expect(
      await prisma.hotelSubmissionAudit.count({
        where: { submissionId: next.id, action: 'APPROVED' },
      }),
    ).toBe(1);
    expect(
      await prisma.hotelSubmissionNotification.count({
        where: { submissionId: next.id, kind: 'APPROVED' },
      }),
    ).toBe(1);
    const afterApproval = await request(server)
      .get('/api/hotels/review/submissions')
      .set('Authorization', admin)
      .expect(200);
    expect(
      reviewQueueBody(afterApproval).items.some((row) => row.id === next.id),
    ).toBe(false);
    const publicHotel = await request(server)
      .get(`/api/hotels/${hotelId}`)
      .expect(200);
    const approved = publicHotel.body as {
      gallery: { id: string; isCover: boolean; url: string }[];
      rooms: { id: string; images: { id: string; url: string }[] }[];
      coverImageUrl: string;
      amenities: { id: string; name: string }[];
    };
    expect(approved.gallery).toHaveLength(3);
    const publicRoom = approved.rooms.find((item) => item.id === roomId);
    expect(
      (publicRoom as { amenityLabels?: string[] }).amenityLabels,
    ).toContain('Wi-Fi');
    expect(publicRoom?.images.map((item) => item.id)).toEqual(
      roomImageIds.slice().reverse(),
    );
    const publicRoomDetail = await request(server)
      .get(`/api/rooms/${roomId}`)
      .expect(200);
    expect(
      (publicRoomDetail.body as { images: { id: string }[] }).images.map(
        (item) => item.id,
      ),
    ).toEqual(roomImageIds.slice().reverse());
    await request(server).get(publicRoom!.images[0].url).expect(200);
    expect(approved.gallery.find((item) => item.isCover)?.id).toBe(mediaIds[1]);
    expect(approved.coverImageUrl).toContain(mediaIds[1]);
    expect(approved.amenities.map((item) => item.id)).toEqual(
      expect.arrayContaining(['WIFI', 'POOL']),
    );
    const bookingUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner@bookingtravel.vn' },
      select: { id: true },
    });
    await prisma.booking.create({
      data: {
        code: `ADM04-DASH-${Date.now()}`,
        userId: bookingUser.id,
        hotelId,
        roomId,
        checkIn: new Date('2026-12-01'),
        checkOut: new Date('2026-12-02'),
        adults: 1,
        nights: 1,
        pricePerNight: new Prisma.Decimal(100000),
        totalAmount: new Prisma.Decimal(100000),
        guestName: 'Dashboard test',
        guestEmail: 'dashboard@example.com',
      },
    });
    const updatedSummary = await request(server)
      .get('/api/admin/dashboard/summary')
      .set('Authorization', admin)
      .expect(200);
    expect(
      (updatedSummary.body as { bookings: { count: number } }).bookings.count,
    ).toBe(summaryBody.bookings.count + 1);
    const nearby = await request(server)
      .get('/api/hotels')
      .query({
        latitude: 16.0544,
        longitude: 108.2022,
        radiusKm: 1,
        amenityIds: 'WIFI,POOL',
      })
      .expect(200);
    expect(
      (nearby.body as { id: string }[]).some((item) => item.id === hotelId),
    ).toBe(true);
    const farAway = await request(server)
      .get('/api/hotels')
      .query({ latitude: 21.0285, longitude: 105.8542, radiusKm: 1 })
      .expect(200);
    expect(
      (farAway.body as { id: string }[]).some((item) => item.id === hotelId),
    ).toBe(false);
    const wrongAmenity = await request(server)
      .get('/api/hotels')
      .query({ amenityIds: 'MISSING' })
      .expect(200);
    expect(
      (wrongAmenity.body as { id: string }[]).some(
        (item) => item.id === hotelId,
      ),
    ).toBe(false);
    await request(server).get(approved.gallery[0].url).expect(200);
    const availability = await request(server)
      .get(`/api/rooms/${roomId}/availability`)
      .query({
        checkIn: futureBooking.checkIn.toISOString().slice(0, 10),
        checkOut: futureBooking.checkOut.toISOString().slice(0, 10),
      })
      .expect(200);
    expect(availability.body).toEqual(
      expect.objectContaining({
        totalRooms: 10,
        availableRooms: 4,
      }),
    );
    const afterCheckout = await request(server)
      .get(`/api/rooms/${roomId}/availability`)
      .query({
        checkIn: futureBooking.checkOut.toISOString().slice(0, 10),
        checkOut: new Date(futureBooking.checkOut.getTime() + 86_400_000)
          .toISOString()
          .slice(0, 10),
      })
      .expect(200);
    expect(
      (afterCheckout.body as { availableRooms: number }).availableRooms,
    ).toBe(10);
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ name: 'Deluxe tên mới', expectedRevision: roomRevision })
      .expect(200);
    roomRevision++;
    expect(
      (
        await prisma.booking.findUniqueOrThrow({
          where: { id: futureBooking.id },
        })
      ).roomNameSnapshot,
    ).toBe('Deluxe Sea View');
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ status: 'INACTIVE', expectedRevision: roomRevision })
      .expect(200);
    const publicRoomsAfterPause = await request(server)
      .get(`/api/hotels/${hotelId}/rooms`)
      .expect(200);
    expect(
      (publicRoomsAfterPause.body as { id: string }[]).some(
        (item) => item.id === roomId,
      ),
    ).toBe(false);
    await request(server).get(publicRoom!.images[0].url).expect(403);
    const legacyRoom = await request(server)
      .get(`/api/rooms/${legacyId}`)
      .set('Authorization', ownerA)
      .expect(200);
    const legacyRevision = (legacyRoom.body as { revision: number }).revision;
    await request(server)
      .patch(`/api/rooms/${legacyId}`)
      .set('Authorization', ownerA)
      .send({ status: 'INACTIVE', expectedRevision: legacyRevision })
      .expect(200);
    const noActiveRooms = await request(server)
      .get('/api/hotels')
      .query({ search: 'Marriot kiểm thử' })
      .expect(200);
    expect(
      (noActiveRooms.body as { id: string }[]).some(
        (item) => item.id === hotelId,
      ),
    ).toBe(false);
    await prisma.hotel.update({
      where: { id: hotelId },
      data: { isVisible: false },
    });
    await request(server).get(`/api/hotels/${hotelId}`).expect(403);
    await request(server).get(approved.gallery[0].url).expect(403);
    const hidden = await request(server)
      .get('/api/hotels')
      .query({ latitude: 16.0544, longitude: 108.2022, radiusKm: 1 })
      .expect(200);
    expect(
      (hidden.body as { id: string }[]).some((item) => item.id === hotelId),
    ).toBe(false);
    await request(server).get(`/api/hotels/${hotelId}/rooms`).expect(403);
    const privateHotel = profileBody(
      await request(server)
        .get(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .expect(200),
    );
    await request(server).get(privateHotel.gallery[0].url).expect(200);
  });
});

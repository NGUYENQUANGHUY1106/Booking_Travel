import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AdministrativeCatalogMode, AdministrativeLevel } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
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
    const location = profileBody(
      await request(server)
        .patch(`/api/owner/hotels/${hotelId}/location`)
        .set('Authorization', ownerA)
        .send({
          expectedVersion: create.profileVersion,
          addressLine: '123 Đường Biển',
          provinceUnitId: province.id,
          wardUnitId: ward.id,
          latitude: 16.0544,
          longitude: 108.2022,
        })
        .expect(200),
    );
    expect(location.completion.location).toBe(true);
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
      .expect(403);

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
    await request(server)
      .post(`/api/owner/hotels/${hotelId}/submit`)
      .set('Authorization', ownerA)
      .send({ expectedVersion: profile.profileVersion })
      .expect(400);
    await request(server)
      .post(`/api/owner/hotels/${hotelId}/submit`)
      .set('Authorization', ownerB)
      .send({ expectedVersion: profile.profileVersion })
      .expect(403);
    const room = await request(server)
      .post(`/api/hotels/${hotelId}/rooms`)
      .set('Authorization', ownerA)
      .send({
        name: 'Deluxe Sea View',
        type: 'DELUXE',
        bedInfo: '1 giường đôi',
        capacityAdults: 2,
        quantity: 1,
        basePrice: 1450000,
        currency: 'VND',
      })
      .expect(201);
    const roomId = (room.body as { id: string }).id;
    profile = profileBody(
      await request(server)
        .get(`/api/owner/hotels/${hotelId}`)
        .set('Authorization', ownerA)
        .expect(200),
    );
    expect(profile.readyForReview).toBe(true);
    profile = profileBody(
      await request(server)
        .post(`/api/owner/hotels/${hotelId}/submit`)
        .set('Authorization', ownerA)
        .send({ expectedVersion: profile.profileVersion })
        .expect(201),
    );
    expect(profile.status).toBe('PENDING');
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
        bedInfo: '1 giường đôi',
        capacityAdults: 2,
        quantity: 1,
        basePrice: 100000,
      })
      .expect(409);
    await request(server)
      .patch(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .send({ name: 'Phòng đã đổi' })
      .expect(409);
    await request(server)
      .delete(`/api/rooms/${roomId}`)
      .set('Authorization', ownerA)
      .expect(409);
    const submissions = await request(server)
      .get('/api/hotels/review/submissions')
      .set('Authorization', admin)
      .expect(200);
    expect(
      (submissions.body as { hotelId: string }[]).some(
        (row) => row.hotelId === hotelId,
      ),
    ).toBe(true);
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
    await prisma.hotel.update({
      where: { id: hotelId },
      data: { status: 'APPROVED' },
    });
    const publicHotel = await request(server)
      .get(`/api/hotels/${hotelId}`)
      .expect(200);
    const approved = publicHotel.body as {
      gallery: { id: string; isCover: boolean }[];
      coverImageUrl: string;
    };
    expect(approved.gallery).toHaveLength(3);
    expect(approved.gallery.find((item) => item.isCover)?.id).toBe(mediaIds[1]);
    expect(approved.coverImageUrl).toContain(mediaIds[1]);
  });
});

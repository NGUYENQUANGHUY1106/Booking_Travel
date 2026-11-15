import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import configuration from '../src/config/configuration';
import { DatabaseModule } from '../src/infrastructure/database/database.module';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { PaymentsModule } from '../src/modules/payments/payments.module';

const describeWithDatabase =
  process.env.RUN_DB_PAYMENT_E2E === '1' ? describe : describe.skip;

function paymentId(response: request.Response) {
  const body: unknown = response.body;
  if (
    typeof body === 'object' &&
    body !== null &&
    'id' in body &&
    typeof body.id === 'string'
  ) {
    return body.id;
  }
  throw new Error('Payment response does not contain an id.');
}

describeWithDatabase('ST-BKG-04 payment initialization', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let bookingId: string;
  let ownerUserId: string;
  let otherUserId: string;
  const sessions: string[] = [];

  const token = (userId: string, sessionId: string) =>
    `Bearer ${jwt.sign({ sub: userId, sessionId })}`;

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
        PaymentsModule,
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
    jwt = app.get(JwtService);
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { code: 'BT-DEMO-002' },
      select: { id: true, userId: true },
    });
    const other = await prisma.user.findUniqueOrThrow({
      where: { email: 'traveler@bookingtravel.vn' },
      select: { id: true },
    });
    bookingId = booking.id;
    ownerUserId = booking.userId;
    otherUserId = other.id;

    for (const userId of [ownerUserId, otherUserId]) {
      const sessionId = `payment-e2e-${userId}`;
      sessions.push(sessionId);
      await prisma.authSession.upsert({
        where: { id: sessionId },
        update: {
          revokedAt: null,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
        create: {
          id: sessionId,
          userId,
          refreshTokenHash: sessionId,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });
    }
    await prisma.payment.deleteMany({ where: { bookingId } });
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.payment.deleteMany({ where: { bookingId } });
      await prisma.authSession.deleteMany({ where: { id: { in: sessions } } });
    }
    await app?.close();
  });

  it('requires authentication, UUID idempotency and a strict request body', async () => {
    await request(app.getHttpServer())
      .post('/api/payments/initialize')
      .send({ bookingId, method: 'PAY_AT_HOTEL' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/payments/initialize')
      .set('Authorization', token(ownerUserId, sessions[0]))
      .set('Idempotency-Key', 'not-a-uuid')
      .send({ bookingId, method: 'PAY_AT_HOTEL', amount: 1 })
      .expect(400);
  });

  it('uses booking ownership, amount and currency as the source of truth', async () => {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      select: { totalAmount: true, currency: true, status: true },
    });
    const response = await request(app.getHttpServer())
      .post('/api/payments/initialize')
      .set('Authorization', token(ownerUserId, sessions[0]))
      .set('Idempotency-Key', randomUUID())
      .send({ bookingId, method: 'PAY_AT_HOTEL' })
      .expect(201);

    expect(response.body).toMatchObject({
      bookingId,
      amount: booking.totalAmount.toString(),
      currency: booking.currency,
      method: 'PAY_AT_HOTEL',
      status: 'PENDING',
    });
    expect(booking.status).toBe('CONFIRMED');
  });

  it('is idempotent and hides another traveler booking', async () => {
    const key = randomUUID();
    const first = await request(app.getHttpServer())
      .post('/api/payments/initialize')
      .set('Authorization', token(ownerUserId, sessions[0]))
      .set('Idempotency-Key', key)
      .send({ bookingId, method: 'PAY_AT_HOTEL' })
      .expect(201);
    const repeated = await request(app.getHttpServer())
      .post('/api/payments/initialize')
      .set('Authorization', token(ownerUserId, sessions[0]))
      .set('Idempotency-Key', key)
      .send({ bookingId, method: 'PAY_AT_HOTEL' })
      .expect(201);
    expect(paymentId(repeated)).toBe(paymentId(first));

    await request(app.getHttpServer())
      .post('/api/payments/initialize')
      .set('Authorization', token(otherUserId, sessions[1]))
      .set('Idempotency-Key', randomUUID())
      .send({ bookingId, method: 'PAY_AT_HOTEL' })
      .expect(404);
  });

  it('creates only one payment during concurrent requests', async () => {
    await prisma.payment.deleteMany({ where: { bookingId } });
    const calls = [randomUUID(), randomUUID()].map((key) =>
      request(app.getHttpServer())
        .post('/api/payments/initialize')
        .set('Authorization', token(ownerUserId, sessions[0]))
        .set('Idempotency-Key', key)
        .send({ bookingId, method: 'PAY_AT_HOTEL' }),
    );
    const responses = await Promise.all(calls);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(paymentId(responses[0])).toBe(paymentId(responses[1]));
    await expect(prisma.payment.count({ where: { bookingId } })).resolves.toBe(
      1,
    );
  });
});

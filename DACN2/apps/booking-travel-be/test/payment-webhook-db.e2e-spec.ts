import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import {
  BookingPaymentMethod,
  BookingStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { AccessTokenGuard } from '../src/common/guards/access-token.guard';
import { PrismaService } from '../src/infrastructure/database/prisma.service';
import { PaymentsController } from '../src/modules/payments/payments.controller';
import { PaymentExpiryService } from '../src/modules/payments/payment-expiry.service';
import { PaymentsService } from '../src/modules/payments/payments.service';
import {
  SimulatorSignature,
  type SimulatorEvent,
} from '../src/modules/payments/simulator-signature';

const describeWithDatabase =
  process.env.RUN_DB_PAYMENT_E2E === '1' ? describe : describe.skip;

describeWithDatabase(
  'ST-BKG-05 signed webhook and PostgreSQL state machine',
  () => {
    const prisma = new PrismaService();
    const ownerId = randomUUID();
    const travelerId = randomUUID();
    const hotelId = randomUUID();
    const roomId = randomUUID();
    const merchantId = 'booking-travel-payment-e2e';
    const sentEventIds = new Set<string>();
    const original = {
      enabled: process.env.PAYMENT_SIMULATOR_ENABLED,
      merchant: process.env.PAYMENT_SIMULATOR_MERCHANT_ID,
      secret: process.env.PAYMENT_SIMULATOR_SECRET,
    };
    let signature: SimulatorSignature;
    let payments: PaymentsService;
    let app: INestApplication;

    const user = {
      id: travelerId,
      role: 'USER' as const,
      permissions: [],
      sessionId: 'payment-e2e-session',
    };
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    const makeBooking = async (deadline = new Date(Date.now() + 10 * 60_000)) =>
      prisma.booking.create({
        data: {
          code: `BT-${randomUUID().slice(0, 12)}`,
          userId: travelerId,
          hotelId,
          roomId,
          roomNameSnapshot: 'Payment E2E room',
          roomTypeSnapshot: 'QA',
          checkIn: new Date(`${day(30)}T00:00:00.000Z`),
          checkOut: new Date(`${day(32)}T00:00:00.000Z`),
          adults: 2,
          roomCount: 1,
          nights: 2,
          pricePerNight: new Prisma.Decimal('500000.00'),
          totalAmount: new Prisma.Decimal('1000000.00'),
          currency: 'VND',
          guestName: 'Payment E2E guest',
          guestEmail: 'guest@example.invalid',
          paymentMethod: BookingPaymentMethod.SIMULATOR,
          paymentDeadline: deadline,
        },
      });
    const eventFor = (
      reference: string,
      status: SimulatorEvent['status'],
      transactionId = randomUUID(),
    ): SimulatorEvent => ({
      eventId: randomUUID(),
      merchantId,
      merchantReference: reference,
      providerTxnId: transactionId,
      amount: '1000000.00',
      currency: 'VND',
      status,
    });
    const send = (event: SimulatorEvent, signatureOverride?: string) => {
      sentEventIds.add(event.eventId);
      const raw = JSON.stringify(event);
      const timestamp = String(Math.floor(Date.now() / 1000));
      return request(app.getHttpServer() as Server)
        .post('/api/payments/SIMULATOR/webhook')
        .set('Content-Type', 'application/json')
        .set('x-bt-simulator-timestamp', timestamp)
        .set(
          'x-bt-simulator-signature',
          signatureOverride ?? signature.sign(Buffer.from(raw), timestamp),
        )
        .send(raw);
    };

    beforeAll(async () => {
      process.env.PAYMENT_SIMULATOR_ENABLED = 'true';
      process.env.PAYMENT_SIMULATOR_MERCHANT_ID = merchantId;
      process.env.PAYMENT_SIMULATOR_SECRET =
        'payment-e2e-only-secret-longer-than-32-characters';
      signature = new SimulatorSignature();
      payments = new PaymentsService(prisma, signature);
      await prisma.$connect();
      for (const [id, role] of [
        [ownerId, 'HOTEL_OWNER'],
        [travelerId, 'USER'],
      ] as const)
        await prisma.user.create({
          data: {
            id,
            email: `${id}@example.invalid`,
            fullName: 'Payment E2E',
            passwordHash: 'unused',
            role,
            status: 'ACTIVE',
            isActive: true,
          },
        });
      await prisma.hotel.create({
        data: {
          id: hotelId,
          ownerId,
          name: 'Payment E2E hotel',
          slug: hotelId,
          status: 'APPROVED',
          isVisible: true,
        },
      });
      await prisma.room.create({
        data: {
          id: roomId,
          hotelId,
          name: 'Payment E2E room',
          type: 'QA',
          bedInfo: 'Double',
          quantity: 2,
          basePrice: 500000,
        },
      });
      const module = await Test.createTestingModule({
        controllers: [PaymentsController],
        providers: [
          PaymentsService,
          SimulatorSignature,
          { provide: PrismaService, useValue: prisma },
        ],
      })
        .overrideGuard(AccessTokenGuard)
        .useValue({ canActivate: () => true })
        .compile();
      app = module.createNestApplication({ rawBody: true });
      app.setGlobalPrefix('api');
      await app.init();
    });

    afterAll(async () => {
      if (app) await app.close();
      const bookings = await prisma.booking.findMany({
        where: { roomId },
        select: { id: true },
      });
      const ids = bookings.map((booking) => booking.id);
      const paymentIds = (
        await prisma.payment.findMany({
          where: { bookingId: { in: ids } },
          select: { id: true },
        })
      ).map((payment) => payment.id);
      await prisma.paymentOutboxEvent.deleteMany({
        where: { paymentId: { in: paymentIds } },
      });
      await prisma.paymentReconciliationCase.deleteMany({
        where: { paymentId: { in: paymentIds } },
      });
      await prisma.paymentWebhookReceipt.deleteMany({
        where: { provider: 'SIMULATOR', eventId: { in: [...sentEventIds] } },
      });
      await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
      await prisma.booking.deleteMany({ where: { id: { in: ids } } });
      await prisma.room.delete({ where: { id: roomId } });
      await prisma.hotel.delete({ where: { id: hotelId } });
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, travelerId] } },
      });
      await prisma.$disconnect();
      for (const [key, value] of [
        ['PAYMENT_SIMULATOR_ENABLED', original.enabled],
        ['PAYMENT_SIMULATOR_MERCHANT_ID', original.merchant],
        ['PAYMENT_SIMULATOR_SECRET', original.secret],
      ] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    });

    it('rejects invalid signatures and a signed amount mismatch without changing payment or booking', async () => {
      const booking = await makeBooking();
      const initiated = await payments.init(booking.id, user);
      const wrong = eventFor(initiated.merchantReference, 'SUCCESS');
      expect((await send(wrong, '0'.repeat(64))).status).toBe(401);
      expect(
        (await send({ ...wrong, merchantId: 'different-merchant' })).status,
      ).toBe(401);
      wrong.eventId = randomUUID();
      wrong.amount = '999999.00';
      expect((await send(wrong)).status).toBe(409);
      expect(
        (await send(eventFor('missing-payment-reference', 'SUCCESS'))).status,
      ).toBe(409);
      const currencyMismatch = eventFor(initiated.merchantReference, 'SUCCESS');
      currencyMismatch.currency = 'USD';
      expect((await send(currencyMismatch)).status).toBe(409);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: initiated.paymentId },
          })
        ).status,
      ).toBe(PaymentStatus.PENDING);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe(BookingStatus.PENDING_PAYMENT);
    });

    it('confirms once for eight concurrent copies and ignores later failure', async () => {
      const booking = await makeBooking();
      const initiated = await payments.init(booking.id, user);
      const event = eventFor(initiated.merchantReference, 'SUCCESS');
      const responses = await Promise.all(
        Array.from({ length: 8 }, () => send(event)),
      );
      expect(responses.every((response) => response.status === 201)).toBe(true);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: initiated.paymentId },
          })
        ).status,
      ).toBe(PaymentStatus.SUCCESS);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe(BookingStatus.CONFIRMED);
      expect(
        await prisma.paymentOutboxEvent.count({
          where: { paymentId: initiated.paymentId },
        }),
      ).toBe(1);
      expect(
        await prisma.paymentWebhookReceipt.count({
          where: { paymentId: initiated.paymentId },
        }),
      ).toBe(1);
      expect((await send({ ...event, status: 'FAILED' })).status).toBe(409);
      expect(
        (await send({ ...event, eventId: randomUUID(), status: 'FAILED' }))
          .status,
      ).toBe(201);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: initiated.paymentId },
          })
        ).status,
      ).toBe(PaymentStatus.SUCCESS);
    }, 30_000);

    it('allows fail then success before the deadline, but does not reconfirm expired bookings', async () => {
      const booking = await makeBooking();
      const initiated = await payments.init(booking.id, user);
      const failed = eventFor(initiated.merchantReference, 'FAILED');
      expect((await send(failed)).status).toBe(201);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe(BookingStatus.PENDING_PAYMENT);
      expect(
        (await send({ ...failed, eventId: randomUUID(), status: 'SUCCESS' }))
          .status,
      ).toBe(201);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe(BookingStatus.CONFIRMED);

      const lateBooking = await makeBooking(new Date(Date.now() + 1_000));
      const latePayment = await payments.init(lateBooking.id, user);
      await prisma.booking.update({
        where: { id: lateBooking.id },
        data: { paymentDeadline: new Date(Date.now() - 1_000) },
      });
      await new PaymentExpiryService(prisma).expireDue();
      expect(
        (await send(eventFor(latePayment.merchantReference, 'SUCCESS'))).status,
      ).toBe(201);
      expect(
        (
          await prisma.booking.findUniqueOrThrow({
            where: { id: lateBooking.id },
          })
        ).status,
      ).toBe(BookingStatus.EXPIRED);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: latePayment.paymentId },
          })
        ).reconciliationRequired,
      ).toBe(true);
      expect(
        await prisma.paymentReconciliationCase.count({
          where: { paymentId: latePayment.paymentId },
        }),
      ).toBe(1);
    });

    it('does not expose another traveler payment status', async () => {
      const booking = await makeBooking();
      const initiated = await payments.init(booking.id, user);
      await expect(
        payments.status(initiated.paymentId, { ...user, id: 'someone-else' }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('keeps only one booking confirmation when a failed attempt is retried', async () => {
      const booking = await makeBooking();
      const first = await payments.init(booking.id, user);
      const failed = eventFor(first.merchantReference, 'FAILED');
      expect((await send(failed)).status).toBe(201);
      const second = await payments.init(booking.id, user);
      expect(second.paymentId).not.toBe(first.paymentId);
      expect(
        (await send({ ...failed, eventId: randomUUID(), status: 'SUCCESS' }))
          .status,
      ).toBe(201);
      expect(
        (await send(eventFor(second.merchantReference, 'SUCCESS'))).status,
      ).toBe(201);
      expect(
        (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } }))
          .status,
      ).toBe(BookingStatus.CONFIRMED);
      expect(
        await prisma.paymentOutboxEvent.count({
          where: { payment: { bookingId: booking.id } },
        }),
      ).toBe(1);
      expect(
        (
          await prisma.payment.findUniqueOrThrow({
            where: { id: second.paymentId },
          })
        ).reconciliationRequired,
      ).toBe(true);
    });
  },
);

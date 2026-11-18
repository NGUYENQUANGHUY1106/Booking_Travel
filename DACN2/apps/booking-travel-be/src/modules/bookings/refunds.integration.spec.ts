import { randomUUID } from 'node:crypto';
import {
  BookingStatus,
  PaymentStatus,
  Prisma,
  RefundRequestStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SimulatorSignature } from '../payments/simulator-signature';
import { RefundsService } from './refunds.service';
import { AdminPaymentsService } from '../payments/admin-payments.service';
import {
  AdminPaymentsQueryDto,
  AdminRefundsQueryDto,
} from '../payments/admin-payments-query.dto';

const describeWithDatabase = process.env.DATABASE_URL
  ? describe
  : describe.skip;

describeWithDatabase('RefundsService PostgreSQL integration', () => {
  const prisma = new PrismaService();
  const service = new RefundsService(prisma, new SimulatorSignature());
  const monitoring = new AdminPaymentsService(prisma);
  const suffix = randomUUID();
  const ownerId = `refund-owner-${suffix}`;
  const guestId = `refund-guest-${suffix}`;
  const adminId = `refund-admin-${suffix}`;
  const hotelId = `refund-hotel-${suffix}`;
  const roomId = `refund-room-${suffix}`;
  const bookingIds: string[] = [];
  const paymentIds: string[] = [];
  const webhookIds: string[] = [];
  const priorSimulatorEnv = {
    enabled: process.env.PAYMENT_SIMULATOR_ENABLED,
    secret: process.env.PAYMENT_SIMULATOR_SECRET,
    merchant: process.env.PAYMENT_SIMULATOR_MERCHANT_ID,
  };
  const guest = { id: guestId, role: UserRole.USER, permissions: [] };
  const admin = {
    id: adminId,
    role: UserRole.ADMIN,
    permissions: ['BOOKING_SUPPORT'],
  };

  beforeAll(async () => {
    process.env.PAYMENT_SIMULATOR_ENABLED = 'true';
    process.env.PAYMENT_SIMULATOR_SECRET =
      'refund-test-secret-longer-than-32-characters';
    process.env.PAYMENT_SIMULATOR_MERCHANT_ID = 'refund-test-merchant';
    await prisma.$connect();
    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `${ownerId}@example.test`,
          fullName: 'Owner',
          passwordHash: 'test',
          role: UserRole.HOTEL_OWNER,
        },
        {
          id: guestId,
          email: `${guestId}@example.test`,
          fullName: 'Guest',
          passwordHash: 'test',
          role: UserRole.USER,
        },
        {
          id: adminId,
          email: `${adminId}@example.test`,
          fullName: 'Admin',
          passwordHash: 'test',
          role: UserRole.ADMIN,
        },
      ],
    });
    await prisma.hotel.create({
      data: {
        id: hotelId,
        ownerId,
        name: 'Refund test hotel',
        slug: hotelId,
        status: 'APPROVED',
        checkInTime: '14:00',
      },
    });
    await prisma.room.create({
      data: {
        id: roomId,
        hotelId,
        name: 'Test room',
        type: 'Standard',
        bedInfo: 'Double',
        basePrice: new Prisma.Decimal(1000),
      },
    });
  });

  afterAll(async () => {
    await prisma.refundWebhookReceipt.deleteMany({
      where: { eventId: { in: webhookIds } },
    });
    const requests = await prisma.refundRequest.findMany({
      where: { bookingId: { in: bookingIds } },
      select: { id: true },
    });
    await prisma.refundEvent.deleteMany({
      where: { refundRequestId: { in: requests.map((item) => item.id) } },
    });
    await prisma.refundRequest.deleteMany({
      where: { bookingId: { in: bookingIds } },
    });
    await prisma.paymentOutboxEvent.deleteMany({
      where: { paymentId: { in: paymentIds } },
    });
    await prisma.paymentWebhookReceipt.deleteMany({
      where: { paymentId: { in: paymentIds } },
    });
    await prisma.paymentReconciliationCase.deleteMany({
      where: { paymentId: { in: paymentIds } },
    });
    await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.room.deleteMany({ where: { id: roomId } });
    await prisma.hotel.deleteMany({ where: { id: hotelId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, guestId, adminId] } },
    });
    await prisma.$disconnect();
    if (priorSimulatorEnv.enabled === undefined)
      delete process.env.PAYMENT_SIMULATOR_ENABLED;
    else process.env.PAYMENT_SIMULATOR_ENABLED = priorSimulatorEnv.enabled;
    if (priorSimulatorEnv.secret === undefined)
      delete process.env.PAYMENT_SIMULATOR_SECRET;
    else process.env.PAYMENT_SIMULATOR_SECRET = priorSimulatorEnv.secret;
    if (priorSimulatorEnv.merchant === undefined)
      delete process.env.PAYMENT_SIMULATOR_MERCHANT_ID;
    else process.env.PAYMENT_SIMULATOR_MERCHANT_ID = priorSimulatorEnv.merchant;
  });

  async function fixture(refundPercent: number) {
    const id = randomUUID();
    const bookingId = `refund-booking-${id}`;
    const paymentId = `refund-payment-${id}`;
    bookingIds.push(bookingId);
    paymentIds.push(paymentId);
    await prisma.booking.create({
      data: {
        id: bookingId,
        code: `RF${id.replace(/-/g, '').slice(0, 16)}`,
        userId: guestId,
        hotelId,
        roomId,
        roomNameSnapshot: 'Test room',
        roomTypeSnapshot: 'Standard',
        checkIn: new Date('2030-01-10T00:00:00.000Z'),
        checkOut: new Date('2030-01-11T00:00:00.000Z'),
        adults: 1,
        nights: 1,
        pricePerNight: new Prisma.Decimal(1000),
        totalAmount: new Prisma.Decimal(1000),
        currency: 'VND',
        guestName: 'Guest',
        guestEmail: 'guest@example.test',
        status: BookingStatus.CONFIRMED,
        paymentMethod: 'SIMULATOR',
        checkInTimeSnapshot: '14:00',
        refundRulesSnapshot: [{ minimumHoursBeforeCheckIn: 0, refundPercent }],
      },
    });
    await prisma.payment.create({
      data: {
        id: paymentId,
        bookingId,
        userId: guestId,
        provider: 'SIMULATOR',
        merchantId: 'refund-test-merchant',
        merchantReference: `merchant-${id}`,
        providerTxnId: `txn-${id}`,
        amount: new Prisma.Decimal(1000),
        currency: 'VND',
        status: PaymentStatus.SUCCESS,
      },
    });
    return { bookingId, paymentId, txnId: `txn-${id}` };
  }

  it('filters and paginates real payment/refund data, masks guest PII, and denies non-admin access', async () => {
    const first = await fixture(50);
    const second = await fixture(50);
    const failedAttemptId = `refund-payment-${randomUUID()}`;
    paymentIds.push(failedAttemptId);
    await prisma.payment.create({
      data: {
        id: failedAttemptId,
        bookingId: first.bookingId,
        userId: guestId,
        provider: 'SIMULATOR',
        amount: new Prisma.Decimal(1000),
        currency: 'VND',
        status: PaymentStatus.FAILED,
      },
    });
    const eventId = `monitoring-${randomUUID()}`;
    await prisma.paymentWebhookReceipt.create({
      data: {
        provider: 'SIMULATOR',
        eventId,
        paymentId: first.paymentId,
        payloadHash: 'sensitive-hash',
        outcome: 'SUCCESS',
      },
    });
    await prisma.paymentReconciliationCase.create({
      data: { paymentId: first.paymentId, reason: 'PROVIDER_TIMEOUT' },
    });
    const query = Object.assign(new AdminPaymentsQueryDto(), {
      search: first.paymentId,
    });
    const page = await monitoring.list(admin, query);
    expect(page.total).toBe(1);
    expect(page.items[0].bookingId).toBe(first.bookingId);
    expect(page.items[0].guest).toContain('***');
    expect(JSON.stringify(page)).not.toContain('guest@example.test');
    const detail = await monitoring.detail(admin, first.paymentId);
    expect(detail.receipts[0].eventId).toBe(eventId);
    expect(detail.reconciliationCases[0].reason).toBe('PROVIDER_TIMEOUT');
    expect(detail.attempts).toHaveLength(2);
    expect(detail.remainingAmount).toBe('1000');
    expect(JSON.stringify(detail)).not.toContain('sensitive-hash');
    const secondPage = await monitoring.list(
      admin,
      Object.assign(new AdminPaymentsQueryDto(), {
        search: 'refund-payment-',
        page: 2,
        limit: 1,
      }),
    );
    expect(secondPage.page).toBe(2);
    expect(secondPage.items).toHaveLength(1);
    const reconcilePage = await monitoring.list(
      admin,
      Object.assign(new AdminPaymentsQueryDto(), {
        search: first.paymentId,
        scope: 'reconciliation',
        provider: 'SIMULATOR',
        status: PaymentStatus.SUCCESS,
      }),
    );
    expect(reconcilePage.total).toBe(1);
    await expect(monitoring.detail(guest, first.paymentId)).rejects.toThrow();
    await expect(
      monitoring.list(guest, new AdminPaymentsQueryDto()),
    ).rejects.toThrow();
    const cancelled = await service.cancel(
      second.bookingId,
      guest,
      'Đổi kế hoạch',
    );
    const refundPage = await service.listForAdmin(
      admin,
      Object.assign(new AdminRefundsQueryDto(), {
        search: cancelled.requests[0].id,
      }),
    );
    expect(refundPage.total).toBe(1);
    expect(refundPage.items[0].bookingId).toBe(second.bookingId);
  });

  it('allows only one concurrent Admin decision and records its reason once', async () => {
    const { bookingId } = await fixture(50);
    const requestId = (await service.cancel(bookingId, guest, 'Đổi kế hoạch'))
      .requests[0].id;
    const decisions = await Promise.allSettled([
      service.decide(requestId, admin, 'APPROVE', 'Đã đối chiếu giao dịch'),
      service.decide(requestId, admin, 'APPROVE', 'Đã đối chiếu giao dịch'),
    ]);
    expect(
      decisions.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      decisions.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    const request = await prisma.refundRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    expect(request.status).toBe(RefundRequestStatus.APPROVED);
    expect(request.reviewReason).toBe('Đã đối chiếu giao dịch');
    const events = await prisma.refundEvent.findMany({
      where: { refundRequestId: requestId, eventType: 'APPROVE' },
    });
    expect(events).toHaveLength(1);
    expect(events[0].actorId).toBe(adminId);
    expect(JSON.stringify(events[0].detail)).toContain('beforeStatus');
    await expect(service.dispatch(requestId, admin, '')).rejects.toThrow();
    const dispatches = await Promise.all([
      service.dispatch(requestId, admin, 'Đã đối soát trước khi gửi'),
      service.dispatch(requestId, admin, 'Đã đối soát trước khi gửi'),
    ]);
    expect(
      dispatches.every(
        (result) => result.status === RefundRequestStatus.PROCESSING,
      ),
    ).toBe(true);
    const dispatchEvents = await prisma.refundEvent.findMany({
      where: {
        refundRequestId: requestId,
        eventType: 'SIMULATOR_AWAITING_CALLBACK',
      },
    });
    expect(dispatchEvents).toHaveLength(1);
    expect(JSON.stringify(dispatchEvents[0].detail)).toContain(
      'Đã đối soát trước khi gửi',
    );
  });

  it('recalculates the policy before approval and keeps an invalid request pending', async () => {
    const { bookingId } = await fixture(100);
    const requestId = (await service.cancel(bookingId, guest, 'Đổi kế hoạch'))
      .requests[0].id;
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        refundRulesSnapshot: [
          { minimumHoursBeforeCheckIn: 0, refundPercent: 50 },
        ],
      },
    });
    await expect(
      service.decide(requestId, admin, 'APPROVE', 'Đã đối chiếu'),
    ).rejects.toThrow();
    expect(
      (
        await prisma.refundRequest.findUniqueOrThrow({
          where: { id: requestId },
        })
      ).status,
    ).toBe(RefundRequestStatus.PENDING_REVIEW);
    expect(
      await prisma.refundEvent.count({
        where: { refundRequestId: requestId, eventType: 'APPROVE' },
      }),
    ).toBe(0);
  });

  it('serializes duplicate cancellation and accepts a signed-result equivalent callback only once', async () => {
    const { bookingId, paymentId, txnId } = await fixture(50);
    const [first, second] = await Promise.all([
      service.cancel(bookingId, guest, 'Đổi kế hoạch'),
      service.cancel(bookingId, guest, 'Đổi kế hoạch'),
    ]);
    expect(first.requests).toHaveLength(1);
    expect(second.requests).toHaveLength(1);
    const requestId = first.requests[0].id;
    expect(first.requests[0].amount).toBe('500');
    expect(await prisma.refundRequest.count({ where: { bookingId } })).toBe(1);
    await service.decide(
      requestId,
      admin,
      'APPROVE',
      'Đúng snapshot và giao dịch',
    );
    await service.dispatch(
      requestId,
      admin,
      'Đã đối chiếu trước khi gửi mô phỏng',
    );
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
        .status,
    ).toBe(PaymentStatus.SUCCESS);
    await expect(
      service.preview(bookingId, {
        id: 'another-user',
        role: UserRole.USER,
        permissions: [],
      }),
    ).rejects.toThrow();
    const wrongEventId = `refund-event-${randomUUID()}`;
    webhookIds.push(wrongEventId);
    await expect(
      service.simulatorWebhook(
        {
          eventId: wrongEventId,
          merchantId: 'refund-test-merchant',
          providerRefundRef: `BT-REF-${requestId}`,
          originalProviderTxnId: txnId,
          amount: '999',
          currency: 'VND',
          status: 'SUCCESS',
        },
        'wrong-hash',
      ),
    ).rejects.toThrow();
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
        .status,
    ).toBe(PaymentStatus.SUCCESS);
    const eventId = `refund-event-${randomUUID()}`;
    webhookIds.push(eventId);
    const event = {
      eventId,
      merchantId: 'refund-test-merchant',
      providerRefundRef: `BT-REF-${requestId}`,
      originalProviderTxnId: txnId,
      amount: '500',
      currency: 'VND',
      status: 'SUCCESS' as const,
    };
    expect(
      (await service.simulatorWebhook(event, 'test-hash')).acknowledged,
    ).toBe(true);
    const duplicates = await Promise.all(
      Array.from({ length: 10 }, () =>
        service.simulatorWebhook(event, 'test-hash'),
      ),
    );
    expect(duplicates.every((result) => result.outcome === 'DUPLICATE')).toBe(
      true,
    );
    expect(
      (
        await prisma.refundRequest.findUniqueOrThrow({
          where: { id: requestId },
        })
      ).status,
    ).toBe(RefundRequestStatus.COMPLETED);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
        .status,
    ).toBe(PaymentStatus.PARTIALLY_REFUNDED);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }))
        .status,
    ).toBe(BookingStatus.CANCELLED);
    expect(
      await prisma.refundEvent.count({
        where: { refundRequestId: requestId, eventType: 'PROVIDER_SUCCESS' },
      }),
    ).toBe(1);
  });

  it('keeps a failed provider result from becoming a completed refund', async () => {
    const { bookingId, paymentId, txnId } = await fixture(100);
    const result = await service.cancel(bookingId, guest, 'Không thể đi');
    const requestId = result.requests[0].id;
    await service.decide(requestId, admin, 'APPROVE', 'Theo chính sách');
    await service.dispatch(
      requestId,
      admin,
      'Đã đối chiếu trước khi gửi mô phỏng',
    );
    const eventId = `refund-event-${randomUUID()}`;
    webhookIds.push(eventId);
    await service.simulatorWebhook(
      {
        eventId,
        merchantId: 'refund-test-merchant',
        providerRefundRef: `BT-REF-${requestId}`,
        originalProviderTxnId: txnId,
        amount: '1000',
        currency: 'VND',
        status: 'FAILED',
        failureCode: 'TEST_REFUSED',
      },
      'failed-hash',
    );
    expect(
      (
        await prisma.refundRequest.findUniqueOrThrow({
          where: { id: requestId },
        })
      ).status,
    ).toBe(RefundRequestStatus.FAILED);
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
        .status,
    ).toBe(PaymentStatus.SUCCESS);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }))
        .status,
    ).toBe(BookingStatus.CANCELLED);
    await service.reopenFailed(
      requestId,
      admin,
      'Cổng đã từ chối dứt khoát; thử lại cùng tham chiếu',
    );
    await service.decide(requestId, admin, 'APPROVE', 'Đối soát lại');
    await service.dispatch(
      requestId,
      admin,
      'Gửi lại cùng tham chiếu sau đối soát',
    );
    const secondEventId = `refund-event-${randomUUID()}`;
    webhookIds.push(secondEventId);
    await service.simulatorWebhook(
      {
        eventId: secondEventId,
        merchantId: 'refund-test-merchant',
        providerRefundRef: `BT-REF-${requestId}`,
        originalProviderTxnId: txnId,
        amount: '1000',
        currency: 'VND',
        status: 'SUCCESS',
      },
      'retry-success-hash',
    );
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } }))
        .status,
    ).toBe(PaymentStatus.REFUNDED);
    expect(
      (await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } }))
        .status,
    ).toBe(BookingStatus.REFUNDED);
  });
});

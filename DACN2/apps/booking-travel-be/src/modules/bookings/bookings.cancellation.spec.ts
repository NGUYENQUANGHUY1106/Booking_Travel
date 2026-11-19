import { NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { AuditService } from '../../common/authorization/audit.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { BookingsService } from './bookings.service';

describe('ST-BKG-08 booking cancellation', () => {
  const user = {
    id: 'user-1',
    role: UserRole.USER,
    permissions: [],
    sessionId: 'session-1',
  };

  const booking = {
    id: 'booking-1',
    code: 'BT-001',
    userId: user.id,
    status: BookingStatus.CONFIRMED,
    checkIn: new Date('2026-11-20T00:00:00.000Z'),
    totalAmount: new Prisma.Decimal(1_500_000),
    currency: 'VND',
    cancellationReason: null,
    cancellationFee: null,
    refundEstimate: null,
    cancellationPolicySnapshot: 'Hủy trước ngày nhận phòng.',
    cancelledAt: null,
    payments: [
      {
        amount: new Prisma.Decimal(1_500_000),
        status: PaymentStatus.SUCCESS,
      },
    ],
  };

  function subject(
    overrides: Partial<{
      status: BookingStatus;
      checkIn: Date;
      cancellationReason: string | null;
      cancellationFee: Prisma.Decimal | null;
      refundEstimate: Prisma.Decimal | null;
      cancelledAt: Date | null;
    }> = {},
  ) {
    const current = { ...booking, ...overrides };
    const bookingUpdateMany = jest
      .fn<Promise<{ count: number }>, [Prisma.BookingUpdateManyArgs]>()
      .mockResolvedValue({ count: 1 });
    const paymentUpdateMany = jest
      .fn<Promise<{ count: number }>, [Prisma.PaymentUpdateManyArgs]>()
      .mockResolvedValue({ count: 0 });
    const recordSuccess = jest.fn();
    const transaction = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ id: current.id }])
        .mockResolvedValueOnce([
          {
            now: new Date('2026-11-18T08:00:00.000Z'),
            today: new Date('2026-11-18T00:00:00.000Z'),
          },
        ]),
      booking: {
        findFirst: jest.fn().mockResolvedValue(current),
        updateMany: bookingUpdateMany,
      },
      payment: { updateMany: paymentUpdateMany },
      voucherRedemption: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          Promise.resolve(callback(transaction)),
      ),
    } as unknown as PrismaService;
    const audit = { recordSuccess } as unknown as AuditService;
    return {
      service: new BookingsService(
        prisma,
        {} as AuthorizationService,
        audit,
        new PricingService(prisma),
      ),
      transaction,
      bookingUpdateMany,
      paymentUpdateMany,
      recordSuccess,
    };
  }

  it('cancels a future booking, releases inventory and estimates a full refund', async () => {
    const { service, bookingUpdateMany, paymentUpdateMany, recordSuccess } =
      subject();

    await expect(
      service.cancel(booking.id, user, { reason: ' Thay đổi kế hoạch ' }),
    ).resolves.toMatchObject({
      bookingId: booking.id,
      status: BookingStatus.CANCELLED,
      reason: 'Thay đổi kế hoạch',
      cancellationFee: '0',
      refundEstimate: '1500000',
      refundRequired: true,
      inventoryReleased: true,
      alreadyCancelled: false,
    });
    expect(bookingUpdateMany.mock.calls[0]?.[0].data).toMatchObject({
      status: BookingStatus.CANCELLED,
      cancellationReason: 'Thay đổi kế hoạch',
    });
    expect(paymentUpdateMany).toHaveBeenCalledWith({
      where: { bookingId: booking.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.CANCELLED,
        cancelledAt: new Date('2026-11-18T08:00:00.000Z'),
      },
    });
    expect(recordSuccess).toHaveBeenCalledWith(
      user,
      'BOOKING_CANCEL',
      'BOOKING',
      booking.id,
    );
  });

  it('rejects cancellation on the check-in date', async () => {
    const { service, transaction } = subject({
      checkIn: new Date('2026-11-18T00:00:00.000Z'),
    });

    await expect(
      service.cancel(booking.id, user, { reason: 'Không thể nhận phòng' }),
    ).rejects.toMatchObject({
      response: { code: 'CANCELLATION_CUTOFF_PASSED' },
    });
    expect(transaction.booking.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a booking that was already checked in', async () => {
    const { service, transaction } = subject({
      status: BookingStatus.CHECKED_IN,
    });

    await expect(
      service.cancel(booking.id, user, { reason: 'Muốn hủy muộn' }),
    ).rejects.toMatchObject({
      response: { code: 'BOOKING_NOT_CANCELLABLE' },
    });
    expect(transaction.booking.updateMany).not.toHaveBeenCalled();
  });

  it('returns the same cancellation when the request is repeated', async () => {
    const cancelledAt = new Date('2026-11-17T08:00:00.000Z');
    const { service, transaction } = subject({
      status: BookingStatus.CANCELLED,
      cancellationReason: 'Đã hủy trước đó',
      cancellationFee: new Prisma.Decimal(0),
      refundEstimate: new Prisma.Decimal(1_500_000),
      cancelledAt,
    });

    await expect(
      service.cancel(booking.id, user, { reason: 'Gửi lại yêu cầu' }),
    ).resolves.toMatchObject({
      reason: 'Đã hủy trước đó',
      cancelledAt,
      alreadyCancelled: true,
    });
    expect(transaction.booking.updateMany).not.toHaveBeenCalled();
    expect(transaction.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('does not expose a booking owned by another user', async () => {
    const { service, transaction } = subject();
    transaction.booking.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.cancel(booking.id, user, { reason: 'Không phải của tôi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(transaction.booking.updateMany).not.toHaveBeenCalled();
  });
});

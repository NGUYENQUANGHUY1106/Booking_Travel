import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  const input = {
    bookingId: 'booking-1',
    method: PaymentMethod.PAY_AT_HOTEL,
  };
  const booking: {
    id: string;
    code: string;
    userId: string;
    totalAmount: Prisma.Decimal;
    currency: string;
    status: BookingStatus;
  } = {
    id: 'booking-1',
    code: 'BT-001',
    userId: 'user-1',
    totalAmount: new Prisma.Decimal('1960000'),
    currency: 'VND',
    status: BookingStatus.CONFIRMED,
  };
  const payment = {
    id: 'payment-1',
    reference: 'PAY-001',
    bookingId: booking.id,
    userId: booking.userId,
    amount: booking.totalAmount,
    currency: booking.currency,
    method: PaymentMethod.PAY_AT_HOTEL,
    status: PaymentStatus.PENDING,
    idempotencyKey: '11111111-1111-4111-8111-111111111111',
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date('2026-11-13T00:00:00.000Z'),
    updatedAt: new Date('2026-11-13T00:00:00.000Z'),
    booking: { code: booking.code },
  };

  function subject(options?: {
    booking?: typeof booking | null;
    repeated?: typeof payment | null;
    existing?: typeof payment | null;
  }) {
    const createdInputs: unknown[] = [];
    const create = jest.fn((input: unknown) => {
      createdInputs.push(input);
      return Promise.resolve(payment);
    });
    const findUnique = jest.fn((args: { where: { idempotencyKey?: string } }) =>
      Promise.resolve(
        args.where.idempotencyKey
          ? (options?.repeated ?? null)
          : (options?.existing ?? null),
      ),
    );
    const transaction = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      booking: {
        findFirst: jest
          .fn()
          .mockResolvedValue(
            options && 'booking' in options ? options.booking : booking,
          ),
      },
      payment: { findUnique, create },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          Promise.resolve(callback(transaction)),
      ),
    } as unknown as PrismaService;

    return {
      service: new PaymentsService(prisma),
      transaction,
      create,
      createdInputs,
    };
  }

  it('lấy số tiền từ booking và tạo payment chờ thanh toán tại khách sạn', async () => {
    const { service, create, createdInputs } = subject();

    await expect(
      service.initialize('user-1', payment.idempotencyKey, input),
    ).resolves.toMatchObject({
      id: payment.id,
      amount: booking.totalAmount,
      method: PaymentMethod.PAY_AT_HOTEL,
      status: PaymentStatus.PENDING,
    });
    expect(create).toHaveBeenCalledTimes(1);
    const call = createdInputs[0];
    expect(call).toMatchObject({
      data: {
        userId: booking.userId,
        bookingId: booking.id,
        amount: booking.totalAmount,
        currency: booking.currency,
        status: PaymentStatus.PENDING,
      },
    });
  });

  it('trả lại payment khi lặp đúng Idempotency-Key', async () => {
    const { service, create } = subject({ repeated: payment });

    await expect(
      service.initialize('user-1', payment.idempotencyKey, input),
    ).resolves.toMatchObject({ id: payment.id });
    expect(create).not.toHaveBeenCalled();
  });

  it('từ chối dùng lại Idempotency-Key cho booking khác', async () => {
    const { service, create } = subject({ repeated: payment });

    await expect(
      service.initialize('user-1', payment.idempotencyKey, {
        ...input,
        bookingId: 'booking-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('không tiết lộ booking không thuộc người dùng', async () => {
    const { service, create } = subject({ booking: null });

    await expect(
      service.initialize('user-2', payment.idempotencyKey, input),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(create).not.toHaveBeenCalled();
  });

  it('từ chối booking không còn ở trạng thái xác nhận', async () => {
    const { service, create } = subject({
      booking: { ...booking, status: BookingStatus.CANCELLED },
    });

    await expect(
      service.initialize('user-1', payment.idempotencyKey, input),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('không tạo payment thứ hai cho cùng booking và phương thức', async () => {
    const { service, create } = subject({ existing: payment });

    await expect(
      service.initialize(
        'user-1',
        '22222222-2222-4222-8222-222222222222',
        input,
      ),
    ).resolves.toMatchObject({ id: payment.id });
    expect(create).not.toHaveBeenCalled();
  });
});

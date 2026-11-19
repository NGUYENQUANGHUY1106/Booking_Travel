import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingPaymentMethod,
  BookingStatus,
  PaymentStatus,
  Prisma,
  RefundRequestStatus,
  UserRole,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuditService } from '../../common/authorization/audit.service';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminBookingsService } from './admin-bookings.service';
import { AdminBookingQueryDto } from './dto/admin-booking-query.dto';

const admin = {
  id: 'admin',
  role: UserRole.ADMIN,
  permissions: ['BOOKING_SUPPORT'],
};
const query = (value: Partial<AdminBookingQueryDto> = {}) =>
  Object.assign(new AdminBookingQueryDto(), value);
const day = (value: string) => new Date(`${value}T00:00:00Z`);

function setup() {
  const prisma = {
    booking: { count: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    payment: { findMany: jest.fn(), count: jest.fn(), aggregate: jest.fn() },
    refundRequest: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  };
  const audit = { recordSuccess: jest.fn() };
  const service = new AdminBookingsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { prisma, audit, service };
}

describe('Admin booking monitoring', () => {
  it('requires Admin and BOOKING_SUPPORT on both endpoints', async () => {
    expect(Reflect.getMetadata(ROLES_KEY, AdminBookingsController)).toEqual([
      UserRole.ADMIN,
    ]);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, AdminBookingsController),
    ).toEqual(['BOOKING_SUPPORT']);
    const { service, prisma } = setup();
    for (const role of [UserRole.USER, UserRole.HOTEL_OWNER]) {
      await expect(
        service.list({ ...admin, role }, query()),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        service.detail({ ...admin, role }, 'booking-a'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
    await expect(
      service.list({ ...admin, permissions: [] }, query()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('validates status, date, pagination and refuses invalid calendar ranges', async () => {
    const invalid = plainToInstance(AdminBookingQueryDto, {
      status: 'MADE_UP',
      page: 0,
      limit: 1000,
      from: 'yesterday',
    });
    expect(validateSync(invalid).length).toBeGreaterThanOrEqual(4);
    const { service } = setup();
    await expect(
      service.list(admin, query({ from: '2026-02-30' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.list(admin, query({ from: '2026-12-02', to: '2026-12-01' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('queries all hotels with stable pagination and uses booking snapshots', async () => {
    const { prisma, service } = setup();
    prisma.booking.count.mockResolvedValue(2);
    prisma.booking.findMany.mockResolvedValue([
      {
        id: 'a',
        code: 'BT-A',
        hotelId: 'hotel-a',
        userId: 'user-a',
        hotelNameSnapshot: 'Hotel A lúc đặt',
        roomNameSnapshot: 'Room A',
        roomTypeSnapshot: 'DOUBLE',
        guestEmail: 'alpha@example.test',
        checkIn: day('2026-12-01'),
        checkOut: day('2026-12-02'),
        adults: 2,
        children: 0,
        roomCount: 1,
        totalAmount: new Prisma.Decimal(100),
        currency: 'VND',
        status: BookingStatus.CONFIRMED,
        paymentMethod: BookingPaymentMethod.PAY_AT_HOTEL,
        createdAt: day('2026-11-01'),
        updatedAt: day('2026-11-01'),
        payments: [{ status: PaymentStatus.PAID }],
        refundRequests: [],
      },
      {
        id: 'b',
        code: 'BT-B',
        hotelId: 'hotel-b',
        userId: 'user-b',
        hotelNameSnapshot: 'Hotel B đã ẩn',
        roomNameSnapshot: 'Room B',
        roomTypeSnapshot: 'SINGLE',
        guestEmail: 'bravo@example.test',
        checkIn: day('2026-12-03'),
        checkOut: day('2026-12-04'),
        adults: 1,
        children: 0,
        roomCount: 1,
        totalAmount: new Prisma.Decimal(200),
        currency: 'VND',
        status: BookingStatus.CANCELLED,
        paymentMethod: BookingPaymentMethod.SIMULATOR,
        createdAt: day('2026-11-02'),
        updatedAt: day('2026-11-02'),
        payments: [{ status: PaymentStatus.SUCCESS }],
        refundRequests: [{ status: 'PENDING_REVIEW' }],
      },
    ]);
    const result = await service.list(
      admin,
      query({
        page: 1,
        limit: 20,
        dateField: 'checkIn',
        from: '2026-12-01',
        to: '2026-12-31',
      }),
    );
    expect(result.items).toHaveLength(2);
    expect(result.items[1].hotelName).toBe('Hotel B đã ẩn');
    expect(result.items[0].guest).toBe('al***@example.test');
    expect(result.items[0].paymentStatus).toBe(PaymentStatus.PAID);
    const calls: unknown = prisma.booking.findMany.mock.calls;
    const options = (
      calls as Array<[{ where: Prisma.BookingWhereInput; orderBy: unknown }]>
    )[0][0];
    expect(options.where.hotel).toBeUndefined();
    expect(options.where.checkIn).toEqual({
      gte: day('2026-12-01'),
      lte: day('2026-12-31'),
    });
    expect(options.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('applies Vietnam day boundaries and independent payment/refund filters', async () => {
    const { prisma, service } = setup();
    prisma.booking.count.mockResolvedValue(0);
    prisma.booking.findMany.mockResolvedValue([]);
    await service.list(
      admin,
      query({
        search: 'BT-123',
        hotelId: 'hotel-b',
        userId: 'user-b',
        paymentStatus: PaymentStatus.SUCCESS,
        refundStatus: RefundRequestStatus.COMPLETED,
        dateField: 'createdAt',
        from: '2026-11-19',
        to: '2026-11-19',
        sort: 'oldest',
        page: 2,
        limit: 10,
      }),
    );
    const calls: unknown = prisma.booking.findMany.mock.calls;
    const options = (
      calls as Array<
        [
          {
            where: Prisma.BookingWhereInput;
            orderBy: unknown;
            skip: number;
            take: number;
          },
        ]
      >
    )[0][0];
    expect(options.where).toEqual(
      expect.objectContaining({
        hotelId: 'hotel-b',
        userId: 'user-b',
        payments: { some: { status: PaymentStatus.SUCCESS } },
        refundRequests: { some: { status: 'COMPLETED' } },
        createdAt: {
          gte: new Date('2026-11-18T17:00:00Z'),
          lt: new Date('2026-11-19T17:00:00Z'),
        },
      }),
    );
    expect(options.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
    expect([options.skip, options.take]).toEqual([10, 10]);
  });

  it('returns 404 for missing booking', async () => {
    const { prisma, service } = setup();
    prisma.booking.findUnique.mockResolvedValue(null);
    await expect(service.detail(admin, 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('keeps payment attempts distinct, separates pay-at-hotel, and audits detail access', async () => {
    const { prisma, audit, service } = setup();
    prisma.booking.findUnique.mockResolvedValue({
      id: 'booking-a',
      code: 'BT-A',
      userId: 'user-a',
      hotelId: 'hotel-a',
      roomId: 'room-a',
      hotelNameSnapshot: 'Snapshot hotel',
      hotelAddressSnapshot: 'Snapshot address',
      roomNameSnapshot: 'Snapshot room',
      roomTypeSnapshot: 'DOUBLE',
      checkIn: day('2026-12-01'),
      checkOut: day('2026-12-02'),
      adults: 2,
      children: 0,
      roomCount: 1,
      nights: 1,
      pricePerNight: new Prisma.Decimal(100),
      totalAmount: new Prisma.Decimal(100),
      currency: 'VND',
      status: BookingStatus.CONFIRMED,
      paymentMethod: BookingPaymentMethod.PAY_AT_HOTEL,
      guestName: 'Guest',
      guestEmail: 'guest@example.test',
      guestPhone: '0901234567',
      createdAt: new Date('2026-11-01T00:00:00Z'),
      updatedAt: new Date('2026-11-02T00:00:00Z'),
      hotel: {
        name: 'Current hotel',
        status: 'SUSPENDED',
        ownerId: 'owner-a',
        owner: { fullName: 'Owner' },
      },
      user: { fullName: 'User' },
    });
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'payment-failed',
        status: PaymentStatus.FAILED,
        amount: new Prisma.Decimal(100),
        createdAt: new Date('2026-11-01T01:00:00Z'),
        failedAt: new Date('2026-11-01T01:05:00Z'),
        reconciliationRequired: false,
        reconciliationCases: [],
      },
      {
        id: 'payment-paid',
        status: PaymentStatus.PAID,
        amount: new Prisma.Decimal(100),
        createdAt: new Date('2026-11-01T02:00:00Z'),
        paidAt: new Date('2026-11-01T02:10:00Z'),
        reconciliationRequired: false,
        reconciliationCases: [],
      },
    ]);
    prisma.refundRequest.findMany.mockResolvedValue([]);
    prisma.payment.count.mockResolvedValue(2);
    prisma.refundRequest.count.mockResolvedValue(0);
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.refundRequest.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    const result = await service.detail(admin, 'booking-a');
    expect(result.payments).toHaveLength(2);
    expect(result.capturedOnlineAmount).toBe('0');
    expect(result.booking.hotelNameSnapshot).toBe('Snapshot hotel');
    expect(result.booking.guestEmail).toBe('gu***@example.test');
    expect(result.booking.guestPhone).toBe('09***67');
    expect(result.timeline.map((item) => item.id)).toEqual([
      'booking:booking-a',
      'payment:payment-failed',
      'payment-failed:payment-failed',
      'payment:payment-paid',
      'payment-success:payment-paid',
    ]);
    expect(audit.recordSuccess).toHaveBeenCalledWith(
      admin,
      'ADMIN_BOOKING_DETAIL_VIEW',
      'BOOKING',
      'booking-a',
    );
    expect(JSON.stringify(result)).not.toContain('guest@example.test');
  });
});

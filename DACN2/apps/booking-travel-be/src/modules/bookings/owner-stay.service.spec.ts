import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingPaymentMethod, BookingStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingQrToken } from './booking-qr-token';
import { OwnerBookingsService } from './owner-bookings.service';
import { OwnerStayService } from './owner-stay.service';

const owner = { id: 'owner-a', role: UserRole.HOTEL_OWNER, permissions: [] };
const booking = (status: BookingStatus = BookingStatus.CONFIRMED) => ({
  id: 'booking-a',
  code: 'BT-ABC12345',
  userId: 'guest-a',
  hotelId: 'hotel-a',
  status,
  checkIn: new Date('2026-11-18T00:00:00Z'),
  checkOut: new Date('2026-11-19T00:00:00Z'),
  checkInTimeSnapshot: '14:00',
  checkOutTimeSnapshot: '12:00',
  paymentMethod: BookingPaymentMethod.PAY_AT_HOTEL,
  actualCheckInAt: null,
  actualCheckOutAt: null,
  hotel: { ownerId: 'owner-a', checkInTime: '14:00', checkOutTime: '12:00' },
  payments: [],
  refundRequests: [],
});

function subject(current = booking(), now = new Date('2026-11-18T07:00:00Z')) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ now }]),
    booking: {
      findFirst: jest.fn().mockResolvedValue(current),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    bookingStayTransition: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: unknown }) =>
          Promise.resolve(data),
        ),
    },
  };
  const prisma = {
    booking: { findFirst: jest.fn().mockResolvedValue(current) },
    bookingStayTransition: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest
      .fn()
      .mockImplementation((callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
  };
  const details = {
    detail: jest
      .fn()
      .mockResolvedValue({ id: current.id, status: current.status }),
  };
  const service = new OwnerStayService(
    prisma as unknown as PrismaService,
    new BookingQrToken(),
    details as unknown as OwnerBookingsService,
  );
  return { service, prisma, tx, details };
}

describe('OwnerStayService', () => {
  beforeEach(() =>
    jest.useFakeTimers().setSystemTime(new Date('2026-11-18T07:00:00Z')),
  );
  afterEach(() => jest.useRealTimers());

  it('hides a booking belonging to another owner during verification and mutation', async () => {
    const { service, prisma, details } = subject();
    prisma.booking.findFirst.mockResolvedValue(null);
    await expect(
      service.verify(owner, { bookingCode: 'BT-ABC12345' }),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.checkOut(owner, 'booking-b', {
        confirmed: true,
        idempotencyKey: 'request_1234567890123456',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(details.detail).not.toHaveBeenCalled();
  });

  it('accepts an existing legacy booking code while keeping the lookup owner-scoped', async () => {
    const legacy = { ...booking(), code: 'BT-DEMO-001' };
    const { service, prisma } = subject(legacy);
    const result = await service.verify(owner, {
      bookingCode: ' bt-demo-001 ',
    });
    expect(result.booking.id).toBe(legacy.id);
    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { code: legacy.code, hotel: { ownerId: owner.id } },
      select: expect.any(Object) as unknown,
    });
  });

  it('verifies without mutating, then atomically records one check-in and replays the same key', async () => {
    const { service, prisma, tx } = subject();
    const verified = await service.verify(owner, {
      bookingCode: 'BT-ABC12345',
    });
    expect(verified.eligibility.eligible).toBe(true);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
    const input = {
      bookingCode: 'BT-ABC12345',
      verificationRef: verified.verificationRef!,
      confirmed: true as const,
      idempotencyKey: 'request_1234567890123456',
    };
    const result = await service.checkIn(owner, 'booking-a', input);
    expect(result.status).toBe(BookingStatus.CHECKED_IN);
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-a',
        status: BookingStatus.CONFIRMED,
        hotel: { ownerId: 'owner-a' },
      },
      data: {
        status: BookingStatus.CHECKED_IN,
        actualCheckInAt: new Date('2026-11-18T07:00:00Z'),
        checkedInById: 'owner-a',
      },
    });
    expect(tx.bookingStayTransition.create).toHaveBeenCalledTimes(1);
    const created = tx.bookingStayTransition.create.mock
      .calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(created[0].data).toMatchObject({
      previousStatus: BookingStatus.CONFIRMED,
      newStatus: BookingStatus.CHECKED_IN,
      verificationMethod: 'CODE',
      eventType: 'BOOKING_CHECKED_IN',
      actorId: 'owner-a',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    prisma.bookingStayTransition.findUnique.mockResolvedValue({
      bookingId: 'booking-a',
      action: 'CHECK_IN',
      happenedAt: new Date('2026-11-18T07:00:00Z'),
      newStatus: BookingStatus.CHECKED_IN,
    });
    await expect(
      service.checkIn(owner, 'booking-a', input),
    ).resolves.toMatchObject({ replayed: true });
    expect(tx.booking.updateMany).toHaveBeenCalledTimes(1);
  });

  it('rejects a stale verification when booking changes before mutation', async () => {
    const { service, tx } = subject();
    const verified = await service.verify(owner, {
      bookingCode: 'BT-ABC12345',
    });
    tx.booking.findFirst.mockResolvedValue(booking(BookingStatus.CANCELLED));
    await expect(
      service.checkIn(owner, 'booking-a', {
        bookingCode: 'BT-ABC12345',
        verificationRef: verified.verificationRef!,
        confirmed: true,
        idempotencyKey: 'request_1234567890123456',
      }),
    ).rejects.toThrow(ConflictException);
    expect(tx.booking.updateMany).not.toHaveBeenCalled();
  });

  it('checks out only CHECKED_IN bookings without touching payment or stay dates', async () => {
    const { service, tx } = subject(
      booking(BookingStatus.CHECKED_IN),
      new Date('2026-11-19T05:00:00Z'),
    );
    await service.checkOut(owner, 'booking-a', {
      confirmed: true,
      idempotencyKey: 'request_1234567890123456',
    });
    expect(tx.booking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-a',
        status: BookingStatus.CHECKED_IN,
        hotel: { ownerId: 'owner-a' },
      },
      data: {
        status: BookingStatus.COMPLETED,
        actualCheckOutAt: new Date('2026-11-19T05:00:00Z'),
        checkedOutById: 'owner-a',
      },
    });
    const created = tx.bookingStayTransition.create.mock
      .calls[0] as unknown as [{ data: Record<string, unknown> }];
    expect(created[0].data.eventType).toBe('BOOKING_COMPLETED');
  });
});

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
  UserRole,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AuditService } from '../../common/authorization/audit.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { OwnerBookingNoteDto } from './dto/owner-booking-note.dto';
import { OwnerBookingTab } from './dto/owner-booking-query.dto';
import { OwnerBookingsService } from './owner-bookings.service';

describe('OwnerBookingsService', () => {
  const ownerA = { id: 'owner-a', role: UserRole.HOTEL_OWNER, permissions: [] };
  const ownerB = { id: 'owner-b', role: UserRole.HOTEL_OWNER, permissions: [] };
  const user = { id: 'guest', role: UserRole.USER, permissions: [] };
  const hotels = [
    { id: 'hotel-1', ownerId: 'owner-a' },
    { id: 'hotel-2', ownerId: 'owner-a' },
    { id: 'hotel-3', ownerId: 'owner-b' },
  ];
  const makeBooking = (
    id: string,
    hotelId: string,
    status: BookingStatus = BookingStatus.CONFIRMED,
  ) => ({
    id,
    code: `BT-${id}`,
    hotelId,
    roomId: `room-${id}`,
    hotel: { name: hotelId },
    roomNameSnapshot: 'Phòng đã đặt',
    roomTypeSnapshot: 'DELUXE',
    checkIn: new Date('2026-12-01'),
    checkOut: new Date('2026-12-03'),
    adults: 2,
    children: 0,
    roomCount: 1,
    nights: 2,
    pricePerNight: new Prisma.Decimal(1000000),
    totalAmount: new Prisma.Decimal(2000000),
    currency: 'VND',
    status,
    paymentMethod: BookingPaymentMethod.SIMULATOR as BookingPaymentMethod,
    paymentDeadline: null,
    guestName: `Khách ${id}`,
    guestEmail: `${id}@example.test`,
    guestPhone: null,
    note: 'Yêu cầu của khách',
    cancellationPolicySnapshot: 'Chính sách khi đặt',
    nightlyRatesSnapshot: null,
    cancelledAt: null,
    createdAt: new Date('2026-11-16T08:00:00Z'),
    updatedAt: new Date('2026-11-16T08:00:00Z'),
    ownerInternalNote: null as string | null,
    ownerNoteUpdatedAt: null as Date | null,
    ownerNoteUpdatedBy: null as string | null,
    payments: [
      {
        status: PaymentStatus.FAILED as PaymentStatus,
        createdAt: new Date('2026-11-15'),
      },
      {
        status: PaymentStatus.SUCCESS as PaymentStatus,
        createdAt: new Date('2026-11-16'),
      },
    ],
  });

  function subject() {
    const records = [
      makeBooking('a1', 'hotel-1'),
      makeBooking('a2', 'hotel-2'),
      makeBooking('b1', 'hotel-3'),
    ];
    const ownerOf = (hotelId: string) =>
      hotels.find((hotel) => hotel.id === hotelId)?.ownerId;
    const match = (
      record: (typeof records)[number],
      where: {
        hotel?: { ownerId: string };
        id?: string;
        hotelId?: string;
        AND?: Array<{ hotel?: { ownerId: string }; hotelId?: string }>;
      },
    ) => {
      const clauses = where.AND ?? [where];
      return (
        clauses.every(
          (clause) =>
            (!clause.hotel ||
              ownerOf(record.hotelId) === clause.hotel.ownerId) &&
            (!clause.hotelId || record.hotelId === clause.hotelId),
        ) &&
        (!where.id || record.id === where.id)
      );
    };
    const findMany = jest.fn(
      ({
        where,
      }: {
        where: Parameters<typeof match>[1];
        orderBy?: unknown;
        skip?: number;
        take?: number;
      }) => Promise.resolve(records.filter((record) => match(record, where))),
    );
    const count = jest.fn(({ where }: { where: Parameters<typeof match>[1] }) =>
      Promise.resolve(records.filter((record) => match(record, where)).length),
    );
    const findFirst = jest.fn(
      ({ where }: { where: Parameters<typeof match>[1] }) =>
        Promise.resolve(records.find((record) => match(record, where)) ?? null),
    );
    const updateMany = jest.fn(
      ({
        where,
        data,
      }: {
        where: Parameters<typeof match>[1];
        data: {
          ownerInternalNote: string | null;
          ownerNoteUpdatedAt: Date;
          ownerNoteUpdatedBy: string;
        };
      }) => {
        const record = records.find((entry) => match(entry, where));
        if (record) Object.assign(record, data);
        return Promise.resolve({ count: record ? 1 : 0 });
      },
    );
    const findHotel = jest.fn(
      ({ where }: { where: { id: string; ownerId: string } }) =>
        Promise.resolve(
          hotels.find(
            (hotel) => hotel.id === where.id && hotel.ownerId === where.ownerId,
          ) ?? null,
        ),
    );
    const recordSuccess = jest.fn();
    const prisma = {
      booking: { findMany, count, findFirst, updateMany },
      hotel: { findFirst: findHotel },
      $transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    } as unknown as PrismaService;
    return {
      service: new OwnerBookingsService(prisma, {
        recordSuccess,
      } as unknown as AuditService),
      findMany,
      count,
      findFirst,
      updateMany,
      recordSuccess,
      records,
    };
  }

  it('trả đủ hai khách sạn Owner A, không lộ khách sạn Owner B và chỉ xuất DTO tóm tắt', async () => {
    const { service, findMany } = subject();
    const result = await service.list(ownerA, {});
    expect(result.items.map((item) => item.hotel.id)).toEqual([
      'hotel-1',
      'hotel-2',
    ]);
    expect(result.total).toBe(2);
    expect(result.items[0]).not.toHaveProperty('guestEmail');
    expect(result.items[0]).not.toHaveProperty('internalNote');
    expect(result.items[0].payment.state).toBe('PAID');
    expect(findMany.mock.calls[0][0].where.AND?.[0]).toEqual({
      hotel: { ownerId: 'owner-a' },
    });
    expect(findMany.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
  });

  it('không coi return URL hoặc Payment PENDING là đã thanh toán', async () => {
    const { service, records } = subject();
    records[0].status = BookingStatus.PENDING_PAYMENT;
    records[0].payments = [
      { status: PaymentStatus.PENDING, createdAt: new Date('2026-11-16') },
    ];
    records[1].paymentMethod = BookingPaymentMethod.PAY_AT_HOTEL;
    records[1].payments = [];
    const result = await service.list(ownerA, {});
    expect(result.items[0].payment.state).toBe('PENDING');
    expect(result.items[0].allowedActions.canCheckIn).toBe(false);
    expect(result.items[1].payment.state).toBe('PAY_AT_HOTEL');
  });

  it('kiểm tra hotelId, bookingId và mutation note theo owner ở mọi đường', async () => {
    const { service, updateMany, recordSuccess } = subject();
    expect(
      (await service.list(ownerA, { hotelId: 'hotel-2' })).items.map(
        (item) => item.id,
      ),
    ).toEqual(['a2']);
    await expect(
      service.list(ownerA, { hotelId: 'hotel-3' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.detail(ownerA, 'b1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.updateNote(ownerA, 'b1', { note: 'Không được ghi' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1', hotel: { ownerId: 'owner-a' } },
      }),
    );
    const updated = await service.updateNote(ownerA, 'a1', {
      note: '  Đón khách lúc 15h  ',
    });
    expect(updated.internalNote).toBe('Đón khách lúc 15h');
    expect(updated.specialRequest).toBe('Yêu cầu của khách');
    expect(recordSuccess).toHaveBeenCalledWith(
      ownerA,
      'OWNER_BOOKING_NOTE_UPDATE',
      'BOOKING',
      'a1',
    );
    expect(
      (await service.list(ownerB, {})).items.map((item) => item.id),
    ).toEqual(['b1']);
  });

  it('chặn User/Owner đình chỉ và kiểm tra ngày lọc', async () => {
    const { service } = subject();
    await expect(service.list(user, {})).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(
      service.detail({ ...ownerA, ownerAccessBlocked: true }, 'a1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.list(ownerA, { checkInFrom: '2026-02-30' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.list(ownerA, {
        checkInFrom: '2026-12-02',
        checkInTo: '2026-12-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lọc tab theo trạng thái thật và chặn body thay đổi tiền/trạng thái', async () => {
    const { service, findMany } = subject();
    await service.list(ownerA, {
      tab: OwnerBookingTab.UPCOMING,
      status: BookingStatus.CONFIRMED,
      limit: 10,
    });
    const conditions = JSON.stringify(findMany.mock.calls[0][0].where.AND);
    expect(conditions).toContain('"status":"CONFIRMED"');
    expect(conditions).toContain('"checkIn":{"gte":');
    expect(findMany.mock.calls[0][0]).toEqual(
      expect.objectContaining({ take: 11 }),
    );
    const input = plainToInstance(OwnerBookingNoteDto, {
      note: 'Ghi chú',
      status: 'CONFIRMED',
      totalAmount: 1,
    });
    expect(
      validateSync(input, { whitelist: true, forbidNonWhitelisted: true }),
    ).toHaveLength(2);
  });

  it('từ chối con trỏ không hợp lệ và lọc keyset trong phạm vi Owner', async () => {
    const { service, findMany } = subject();
    await expect(
      service.list(ownerA, { after: 'not-a-cursor' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    const after = Buffer.from(
      JSON.stringify({ createdAt: '2026-11-16T08:00:00.000Z', id: 'a2' }),
    ).toString('base64url');
    await service.list(ownerA, { after });
    expect(findMany.mock.calls[0][0].where.AND?.[0]).toEqual({
      hotel: { ownerId: 'owner-a' },
    });
    expect(JSON.stringify(findMany.mock.calls[0][0].where.AND)).toContain(
      '"id":{"lt":"a2"}',
    );
  });
});

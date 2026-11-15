import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { BookingStatus, Prisma, RoomStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../common/authorization/audit.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { BookingsService } from './bookings.service';
import { PricingService } from '../pricing/pricing.service';
import { BookingQuoteToken, policyFingerprint } from './booking-quote-token';
import { inventoryRange } from '../rooms/inventory';

describe('BookingsService', () => {
  type CapturedBookingData = {
    nights: number;
    pricePerNight: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    hotelId: string;
    roomNameSnapshot: string;
    roomTypeSnapshot: string;
    nightlyRatesSnapshot: { date: string; price: string; source: string }[];
  };

  const input = {
    roomId: 'room-1',
    checkIn: '2026-12-10',
    checkOut: '2026-12-13',
    adults: 2,
    roomCount: 2,
    guestName: 'Nguyễn Văn A',
    guestEmail: 'guest@example.com',
  };

  function createSubject(
    reservedRoomCount: number,
    reservations?: { checkIn: Date; checkOut: Date; roomCount: number }[],
    pricingRules: {
      id: string;
      kind: 'DATE';
      startDate: Date;
      endDateExclusive: Date;
      price: Prisma.Decimal;
      active: boolean;
    }[] = [],
  ) {
    const createdBooking = { id: 'booking-1' };
    let capturedData: CapturedBookingData | undefined;
    const transaction = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ hotelId: 'hotel-1' }])
        .mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      room: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'room-1',
          name: 'Deluxe Sea View',
          type: 'DLX-SEA',
          hotelId: 'hotel-1',
          quantity: 4,
          capacityAdults: 2,
          capacityChildren: 1,
          basePrice: new Prisma.Decimal(1_450_000),
          currency: 'VND',
          status: RoomStatus.ACTIVE,
          hotel: { id: 'hotel-1' },
        }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue(
          reservations ?? [
            {
              checkIn: new Date('2026-12-10'),
              checkOut: new Date('2026-12-13'),
              roomCount: reservedRoomCount,
            },
          ],
        ),
        create: jest.fn((args: { data: CapturedBookingData }) => {
          capturedData = args.data;
          return Promise.resolve(createdBooking);
        }),
      },
      roomInventoryBlock: { findMany: jest.fn().mockResolvedValue([]) },
      roomInventoryOverride: { findMany: jest.fn().mockResolvedValue([]) },
      roomPricingRule: { findMany: jest.fn().mockResolvedValue(pricingRules) },
    };
    const prisma = {
      $transaction: jest.fn(
        (callback: (client: typeof transaction) => unknown) =>
          Promise.resolve(callback(transaction)),
      ),
    } as unknown as PrismaService;

    return {
      service: new BookingsService(
        prisma,
        {} as AuthorizationService,
        {} as AuditService,
        new PricingService(prisma),
      ),
      transaction,
      createdBooking,
      book: async (bookingInput: typeof input) => {
        const rates = await new PricingService(prisma).loadRates(
          transaction as never,
          bookingInput.roomId,
          new Prisma.Decimal(1_450_000),
          inventoryRange(bookingInput.checkIn, bookingInput.checkOut),
        );
        const totalAmount = rates
          .reduce((sum, rate) => sum.add(rate.price), new Prisma.Decimal(0))
          .mul(bookingInput.roomCount ?? 1)
          .toString();
        const issued = new BookingQuoteToken().issue({
          userId: 'user-1',
          sessionId: 'session-1',
          roomId: bookingInput.roomId,
          hotelId: 'hotel-1',
          checkIn: bookingInput.checkIn,
          checkOut: bookingInput.checkOut,
          adults: bookingInput.adults,
          children: 0,
          roomCount: bookingInput.roomCount ?? 1,
          currency: 'VND',
          totalAmount,
          cancellationPolicyHash: policyFingerprint(null),
        });
        return new BookingsService(
          prisma,
          {} as AuthorizationService,
          {} as AuditService,
          new PricingService(prisma),
        ).create(
          {
            id: 'user-1',
            role: UserRole.USER,
            permissions: [],
            sessionId: 'session-1',
          },
          { ...bookingInput, quoteId: issued.quoteId },
        );
      },
      getCapturedData: () => {
        if (!capturedData) throw new Error('Booking data was not captured.');
        return capturedData;
      },
    };
  }

  it('tính tổng tiền từ giá phòng trên server', async () => {
    const { book, createdBooking, getCapturedData } = createSubject(1);

    await expect(book(input)).resolves.toEqual(createdBooking);
    const data = getCapturedData();

    expect(data.nights).toBe(3);
    expect(data.pricePerNight.toString()).toBe('1450000');
    expect(data.totalAmount.toString()).toBe('8700000');
    expect(data.hotelId).toBe('hotel-1');
    expect(data.roomNameSnapshot).toBe('Deluxe Sea View');
    expect(data.roomTypeSnapshot).toBe('DLX-SEA');
  });

  it('snapshots từng đêm theo rule thay vì nhân giá chuẩn cho mọi đêm', async () => {
    const specific = {
      id: 'rate-11',
      kind: 'DATE' as const,
      startDate: new Date('2026-12-11T00:00:00Z'),
      endDateExclusive: new Date('2026-12-12T00:00:00Z'),
      price: new Prisma.Decimal('1800000'),
      active: true,
    };
    const { book, getCapturedData } = createSubject(0, undefined, [specific]);
    await book(input);
    const booking = getCapturedData();
    expect(booking.nightlyRatesSnapshot.map((rate) => rate.price)).toEqual([
      '1450000',
      '1800000',
      '1450000',
    ]);
    expect(booking.totalAmount.toString()).toBe('9400000');
  });

  it('từ chối khi số phòng còn lại không đủ', async () => {
    const { book, transaction } = createSubject(3);

    await expect(book(input)).rejects.toBeInstanceOf(ConflictException);
    expect(transaction.booking.create).not.toHaveBeenCalled();
  });

  it('không cộng dồn đặt phòng ở những đêm khác nhau', async () => {
    const { book, createdBooking } = createSubject(0, [
      {
        checkIn: new Date('2026-12-10'),
        checkOut: new Date('2026-12-11'),
        roomCount: 2,
      },
      {
        checkIn: new Date('2026-12-11'),
        checkOut: new Date('2026-12-13'),
        roomCount: 2,
      },
    ]);
    await expect(book(input)).resolves.toEqual(createdBooking);
  });

  it('từ chối số khách vượt sức chứa theo số phòng đặt', async () => {
    const { book, transaction } = createSubject(0);

    await expect(
      book({
        ...input,
        adults: 5,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.booking.create).not.toHaveBeenCalled();
  });

  it('từ chối báo giá của phiên khác trước khi mở transaction', async () => {
    const { service, transaction } = createSubject(0);
    const quoteId = new BookingQuoteToken().issue({
      userId: 'user-1',
      sessionId: 'session-1',
      roomId: input.roomId,
      hotelId: 'hotel-1',
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: 0,
      roomCount: 2,
      currency: 'VND',
      totalAmount: '8700000',
      cancellationPolicyHash: policyFingerprint(null),
    }).quoteId;
    await expect(
      service.create(
        {
          id: 'user-1',
          role: UserRole.USER,
          permissions: [],
          sessionId: 'other-session',
        },
        { ...input, quoteId },
      ),
    ).rejects.toMatchObject({ response: { code: 'QUOTE_CONTEXT_MISMATCH' } });
    expect(transaction.booking.create).not.toHaveBeenCalled();
  });

  it('từ chối giá cũ sau khi Owner đổi giá và không tạo booking', async () => {
    const { service, transaction } = createSubject(0);
    const quoteId = new BookingQuoteToken().issue({
      userId: 'user-1',
      sessionId: 'session-1',
      roomId: input.roomId,
      hotelId: 'hotel-1',
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      adults: input.adults,
      children: 0,
      roomCount: 2,
      currency: 'VND',
      totalAmount: '8700000',
      cancellationPolicyHash: policyFingerprint(null),
    }).quoteId;
    transaction.roomPricingRule.findMany.mockResolvedValue([
      {
        id: 'new-rate',
        kind: 'DATE',
        startDate: new Date('2026-12-11'),
        endDateExclusive: new Date('2026-12-12'),
        price: new Prisma.Decimal('1800000'),
        active: true,
      },
    ]);
    await expect(
      service.create(
        {
          id: 'user-1',
          role: UserRole.USER,
          permissions: [],
          sessionId: 'session-1',
        },
        { ...input, quoteId },
      ),
    ).rejects.toMatchObject({ response: { code: 'PRICE_CHANGED' } });
    expect(transaction.booking.create).not.toHaveBeenCalled();
  });

  it('cho owner xem danh sách booking cá nhân ở khách sạn khác khi lọc chính mình', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const assertHotelOwner = jest.fn();
    const service = new BookingsService(
      { booking: { findMany } } as unknown as PrismaService,
      { assertHotelOwner } as unknown as AuthorizationService,
      {} as AuditService,
      {} as PricingService,
    );

    await service.list(
      { userId: 'owner-a', hotelId: 'hotel-b' },
      { id: 'owner-a', role: UserRole.HOTEL_OWNER, permissions: [] },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'owner-a',
          hotelId: 'hotel-b',
          status: undefined,
        },
      }),
    );
    expect(assertHotelOwner).not.toHaveBeenCalled();
  });
});

describe('BookingsService manual status authorization', () => {
  const owner = {
    id: 'owner-b',
    role: UserRole.HOTEL_OWNER,
    permissions: [],
  };
  const admin = {
    id: 'admin',
    role: UserRole.ADMIN,
    permissions: ['BOOKING_SUPPORT'],
  };

  function createSubject(
    currentStatus: BookingStatus = BookingStatus.CONFIRMED,
  ) {
    const booking = { id: 'booking-b', status: BookingStatus.CHECKED_IN };
    const findUnique = jest.fn().mockResolvedValue({ status: currentStatus });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findFirst = jest.fn().mockResolvedValue(booking);
    const assertBookingAccess = jest.fn().mockResolvedValue(undefined);
    const recordSuccess = jest.fn();
    const service = new BookingsService(
      {
        booking: { findUnique, updateMany, findFirst },
      } as unknown as PrismaService,
      { assertBookingAccess } as unknown as AuthorizationService,
      { recordSuccess } as unknown as AuditService,
      {} as PricingService,
    );

    return {
      service,
      booking,
      findUnique,
      updateMany,
      assertBookingAccess,
      recordSuccess,
    };
  }

  it('từ chối Owner và Admin tự đặt trạng thái hoàn tiền', async () => {
    const { service, updateMany, assertBookingAccess } = createSubject();

    await expect(
      service.updateStatus('booking-b', owner, {
        status: BookingStatus.REFUNDED,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateStatus('booking-b', admin, {
        status: BookingStatus.REFUND_PENDING,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(assertBookingAccess).toHaveBeenCalledTimes(2);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('chỉ cho phép check-in từ CONFIRMED và ràng buộc owner cùng trạng thái khi ghi', async () => {
    const { service, booking, updateMany, recordSuccess } = createSubject();

    await expect(
      service.updateStatus('booking-b', owner, {
        status: BookingStatus.CHECKED_IN,
      }),
    ).resolves.toEqual(booking);
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-b',
        status: BookingStatus.CONFIRMED,
        hotel: { ownerId: 'owner-b' },
      },
      data: { status: BookingStatus.CHECKED_IN },
    });
    expect(recordSuccess).not.toHaveBeenCalled();
  });

  it('cho phép check-out từ CHECKED_IN sang COMPLETED', async () => {
    const { service, updateMany } = createSubject(BookingStatus.CHECKED_IN);

    await service.updateStatus('booking-b', owner, {
      status: BookingStatus.COMPLETED,
    });
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-b',
        status: BookingStatus.CHECKED_IN,
        hotel: { ownerId: 'owner-b' },
      },
      data: { status: BookingStatus.COMPLETED },
    });
  });

  it('từ chối bước nhảy trạng thái và ghi audit sau thao tác Admin thành công', async () => {
    const pending = createSubject(BookingStatus.PENDING_PAYMENT);
    await expect(
      pending.service.updateStatus('booking-b', owner, {
        status: BookingStatus.CHECKED_IN,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(pending.updateMany).not.toHaveBeenCalled();

    const confirmed = createSubject();
    await confirmed.service.updateStatus('booking-b', admin, {
      status: BookingStatus.CHECKED_IN,
    });
    expect(confirmed.recordSuccess).toHaveBeenCalledWith(
      admin,
      'BOOKING_STATUS_UPDATE',
      'BOOKING',
      'booking-b',
    );
  });
});

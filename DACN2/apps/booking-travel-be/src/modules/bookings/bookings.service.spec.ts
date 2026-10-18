import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingStatus, Prisma, RoomStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AuditService } from '../../common/authorization/audit.service';
import { AuthorizationService } from '../../common/authorization/authorization.service';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  type CapturedBookingData = {
    nights: number;
    pricePerNight: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    hotelId: string;
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

  function createSubject(reservedRoomCount: number) {
    const createdBooking = { id: 'booking-1' };
    let capturedData: CapturedBookingData | undefined;
    const transaction = {
      room: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'room-1',
          hotelId: 'hotel-1',
          quantity: 4,
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
        aggregate: jest.fn().mockResolvedValue({
          _sum: { roomCount: reservedRoomCount },
        }),
        create: jest.fn((args: { data: CapturedBookingData }) => {
          capturedData = args.data;
          return Promise.resolve(createdBooking);
        }),
      },
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
      ),
      transaction,
      createdBooking,
      getCapturedData: () => {
        if (!capturedData) throw new Error('Booking data was not captured.');
        return capturedData;
      },
    };
  }

  it('tính tổng tiền từ giá phòng trên server', async () => {
    const { service, createdBooking, getCapturedData } = createSubject(1);

    await expect(service.create('user-1', input)).resolves.toEqual(
      createdBooking,
    );
    const data = getCapturedData();

    expect(data.nights).toBe(3);
    expect(data.pricePerNight.toString()).toBe('1450000');
    expect(data.totalAmount.toString()).toBe('8700000');
    expect(data.hotelId).toBe('hotel-1');
  });

  it('từ chối khi số phòng còn lại không đủ', async () => {
    const { service, transaction } = createSubject(3);

    await expect(service.create('user-1', input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.booking.create).not.toHaveBeenCalled();
  });

  it('cho owner xem danh sách booking cá nhân ở khách sạn khác khi lọc chính mình', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const assertHotelOwner = jest.fn();
    const service = new BookingsService(
      { booking: { findMany } } as unknown as PrismaService,
      { assertHotelOwner } as unknown as AuthorizationService,
      {} as AuditService,
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

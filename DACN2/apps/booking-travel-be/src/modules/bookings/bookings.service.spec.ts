import { ConflictException } from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  type CapturedBookingData = {
    nights: number;
    pricePerNight: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    hotelId: string;
  };

  const input = {
    userId: 'user-1',
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
      service: new BookingsService(prisma),
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

    await expect(service.create(input)).resolves.toEqual(createdBooking);
    const data = getCapturedData();

    expect(data.nights).toBe(3);
    expect(data.pricePerNight.toString()).toBe('1450000');
    expect(data.totalAmount.toString()).toBe('8700000');
    expect(data.hotelId).toBe('hotel-1');
  });

  it('từ chối khi số phòng còn lại không đủ', async () => {
    const { service, transaction } = createSubject(3);

    await expect(service.create(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(transaction.booking.create).not.toHaveBeenCalled();
  });
});

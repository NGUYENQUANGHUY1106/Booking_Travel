import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus, Prisma, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingConfirmationsService } from './booking-confirmations.service';
import { BookingQrToken } from './booking-qr-token';

describe('BookingConfirmationsService', () => {
  const user: AuthenticatedUser = {
    id: 'user-1',
    role: UserRole.USER,
    permissions: [],
  };
  const booking = {
    id: 'booking-1',
    code: 'BT-ABC12345',
    status: BookingStatus.CONFIRMED,
    hotelId: 'hotel-1',
    hotelNameSnapshot: 'Blue Hotel',
    hotelAddressSnapshot: '1 Đường Biển, Sơn Trà, Đà Nẵng, Đà Nẵng',
    roomNameSnapshot: 'Deluxe',
    roomTypeSnapshot: 'DOUBLE',
    checkIn: new Date('2030-01-10T00:00:00.000Z'),
    checkOut: new Date('2030-01-12T00:00:00.000Z'),
    adults: 2,
    children: 0,
    roomCount: 1,
    totalAmount: new Prisma.Decimal('1500000'),
    currency: 'VND',
    guestName: 'Nguyễn Văn A',
    guestEmail: 'guest@example.com',
    hotel: {
      checkInTime: '14:00',
      checkOutTime: '12:00',
    },
  };

  function setup(found: unknown = booking) {
    const prisma = {
      booking: { findFirst: jest.fn().mockResolvedValue(found) },
    };
    return {
      prisma,
      service: new BookingConfirmationsService(
        prisma as unknown as PrismaService,
        new BookingQrToken(),
      ),
    };
  }

  it('loads only a booking owned by the authenticated user', async () => {
    const { service, prisma } = setup(null);

    await expect(service.get('booking-other', user)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-other', userId: 'user-1' },
      }),
    );
  });

  it('does not create a QR for an unconfirmed booking', async () => {
    const { service } = setup({
      ...booking,
      status: BookingStatus.PENDING_PAYMENT,
    });

    await expect(service.get('booking-1', user)).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns a signed QR and a server confirmation without guest contact data', async () => {
    const { service } = setup();

    const result = await service.get('booking-1', user);

    expect(result.booking).toMatchObject({
      id: 'booking-1',
      code: 'BT-ABC12345',
      status: BookingStatus.CONFIRMED,
      roomName: 'Deluxe',
      totalAmount: '1500000',
    });
    expect(result.hotel.address).toBe(
      '1 Đường Biển, Sơn Trà, Đà Nẵng, Đà Nẵng',
    );
    expect(result.guest).toEqual({ name: 'Nguyễn Văn A' });
    expect(result.qr.value).toMatch(/^BTQR1\./);
    expect(JSON.stringify(result)).not.toContain('guest@example.com');
  });
});

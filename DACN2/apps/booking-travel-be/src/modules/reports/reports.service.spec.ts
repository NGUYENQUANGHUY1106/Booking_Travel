import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, HotelReportReason, UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ReportsService } from './reports.service';

const user: AuthenticatedUser = {
  id: 'user-1',
  role: UserRole.USER,
  permissions: [],
};
const input = {
  bookingId: 'booking-1',
  hotelId: 'hotel-1',
  reason: HotelReportReason.INCORRECT_INFORMATION,
  description: 'Thông tin địa chỉ khách sạn không đúng thực tế.',
};

function setup() {
  let captured:
    | { data: { hotelId: string; reporterId: string; bookingId?: string } }
    | undefined;
  const tx = {
    $executeRaw: jest.fn(),
    hotelReport: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(
        (args: {
          data: { hotelId: string; reporterId: string; bookingId?: string };
        }) => {
          captured = args;
          return Promise.resolve({ id: 'report-1', status: 'OPEN' });
        },
      ),
    },
  };
  const prisma = {
    hotel: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: 'hotel-1', ownerId: 'owner-1' }),
    },
    booking: {
      findFirst: jest.fn().mockResolvedValue({
        id: 'booking-1',
        hotelId: 'hotel-1',
        status: BookingStatus.COMPLETED,
      }),
    },
    hotelReport: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn((run: (transaction: unknown) => Promise<unknown>) =>
      run(tx),
    ),
  };
  return {
    service: new ReportsService(prisma as unknown as PrismaService),
    prisma,
    tx,
    getCaptured: () => captured,
  };
}

describe('ReportsService', () => {
  it('uses a completed booking and derives reporter from token', async () => {
    const { service, prisma, getCaptured } = setup();
    await service.create(user, input);
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: input.bookingId, userId: user.id },
      }),
    );
    expect(getCaptured()?.data).toMatchObject({
      hotelId: 'hotel-1',
      reporterId: 'user-1',
      bookingId: input.bookingId,
    });
  });

  it('checks booking ownership and hotel match', async () => {
    const { service, prisma } = setup();
    prisma.booking.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create(user, { ...input, bookingId: 'other' }),
    ).rejects.toThrow(NotFoundException);
    prisma.booking.findFirst.mockResolvedValueOnce({
      id: 'booking-1',
      hotelId: 'another',
    });
    await expect(
      service.create(user, { ...input, bookingId: 'booking-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a stay that is not completed', async () => {
    const { service, prisma, tx } = setup();
    prisma.booking.findFirst.mockResolvedValueOnce({
      id: 'booking-1',
      hotelId: 'hotel-1',
      status: BookingStatus.CONFIRMED,
    });
    await expect(service.create(user, input)).rejects.toThrow(
      ForbiddenException,
    );
    expect(tx.hotelReport.create).not.toHaveBeenCalled();
  });

  it('rejects a report on own hotel and arbitrary evidence URLs', async () => {
    const { service, prisma } = setup();
    prisma.hotel.findFirst.mockResolvedValueOnce({
      id: 'hotel-1',
      ownerId: 'user-1',
    });
    await expect(service.create(user, input)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.create(user, {
        ...input,
        evidenceUrls: ['https://example.com/fake.jpg'],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('prevents duplicate open reports for the same reporter and hotel', async () => {
    const { service, tx } = setup();
    tx.hotelReport.findFirst.mockResolvedValueOnce({ id: 'existing' });
    await expect(service.create(user, input)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.hotelReport.create).not.toHaveBeenCalled();
  });
});

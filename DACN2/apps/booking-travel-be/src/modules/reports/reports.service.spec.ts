import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  HotelReportReason,
  Prisma,
  UserRole,
} from '@prisma/client';
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

function setup(
  booking: unknown = {
    id: 'booking-1',
    hotelId: 'hotel-1',
    status: BookingStatus.COMPLETED,
  },
) {
  type CreateInput = {
    data: { bookingId: string; hotelId: string; reporterId: string };
  };
  let createInput: CreateInput | undefined;
  const createReport = jest.fn((args: CreateInput) => {
    createInput = args;
    return Promise.resolve({ id: 'report-1', status: 'OPEN' });
  });
  const prisma = {
    booking: { findFirst: jest.fn().mockResolvedValue(booking) },
    hotelReport: {
      create: createReport,
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
  return {
    prisma,
    service: new ReportsService(prisma as unknown as PrismaService),
    getCreateInput: () => createInput,
  };
}

describe('ReportsService', () => {
  it('requires a booking owned by the authenticated customer', async () => {
    const { service, prisma } = setup(null);
    await expect(service.create(user, input)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1', userId: 'user-1' },
      }),
    );
  });

  it('rejects a hotel id that does not belong to the booking', async () => {
    const { service } = setup();
    await expect(
      service.create(user, { ...input, hotelId: 'hotel-other' }),
    ).rejects.toThrow(BadRequestException);
  });

  it.each([BookingStatus.CONFIRMED, BookingStatus.CHECKED_IN])(
    'rejects a stay that is not completed (%s)',
    async (status) => {
      const { service } = setup({
        id: 'booking-1',
        hotelId: 'hotel-1',
        status,
      });
      await expect(service.create(user, input)).rejects.toThrow(
        ForbiddenException,
      );
    },
  );

  it('creates an OPEN report from the completed booking and never trusts another reporter', async () => {
    const { service, getCreateInput } = setup();
    await service.create(user, input);
    const call = getCreateInput();
    expect(call).toBeDefined();
    if (!call) throw new Error('Expected HotelReport create input');
    expect(call.data).toMatchObject({
      bookingId: 'booking-1',
      hotelId: 'hotel-1',
      reporterId: 'user-1',
    });
  });

  it('turns the unique booking constraint into a clear duplicate error', async () => {
    const { service, prisma } = setup();
    prisma.hotelReport.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );
    await expect(service.create(user, input)).rejects.toThrow(
      ConflictException,
    );
  });

  it('returns a not found response for an unknown admin detail id', async () => {
    const { service } = setup();
    await expect(service.getForAdmin('missing')).rejects.toThrow(
      NotFoundException,
    );
  });
});

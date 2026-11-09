import { NotFoundException } from '@nestjs/common';
import type { AuditService } from '../../common/authorization/audit.service';
import type { AuthorizationService } from '../../common/authorization/authorization.service';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingsService } from './bookings.service';

describe('BookingsService hotel restriction gate', () => {
  it('takes the hotel lock before room lock and refuses a room whose hotel is no longer public', async () => {
    const calls: string[] = [];
    const tx = {
      $queryRaw: jest.fn().mockImplementation(() => {
        calls.push('read-room-or-lock-room');
        return Promise.resolve(
          calls.length === 1 ? [{ hotelId: 'hotel-a' }] : [{ locked: 1 }],
        );
      }),
      $executeRaw: jest.fn().mockImplementation(() => {
        calls.push('lock-hotel');
        return Promise.resolve(1);
      }),
      room: {
        findFirst: jest.fn(
          (args: {
            where: {
              hotel: { deletedAt: null; status: string; isVisible: boolean };
            };
          }) => {
            calls.push('check-public-hotel');
            expect(args.where.hotel).toEqual({
              deletedAt: null,
              status: 'APPROVED',
              isVisible: true,
            });
            return Promise.resolve(null);
          },
        ),
      },
      booking: { create: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new BookingsService(
      prisma as unknown as PrismaService,
      {} as AuthorizationService,
      {} as AuditService,
    );
    await expect(
      service.create('guest-a', {
        roomId: 'room-a',
        checkIn: '2026-12-01',
        checkOut: '2026-12-02',
        adults: 1,
        guestName: 'Guest A',
        guestEmail: 'guest@example.com',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toEqual([
      'read-room-or-lock-room',
      'lock-hotel',
      'read-room-or-lock-room',
      'check-public-hotel',
    ]);
    expect(tx.booking.create).not.toHaveBeenCalled();
  });
});

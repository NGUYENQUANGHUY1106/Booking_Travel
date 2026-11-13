import { NotFoundException } from '@nestjs/common';
import type { AuditService } from '../../common/authorization/audit.service';
import type { AuthorizationService } from '../../common/authorization/authorization.service';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { BookingsService } from './bookings.service';
import type { PricingService } from '../pricing/pricing.service';
import { BookingQuoteToken, policyFingerprint } from './booking-quote-token';
import { UserRole } from '@prisma/client';

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
      booking: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const service = new BookingsService(
      prisma as unknown as PrismaService,
      {} as AuthorizationService,
      {} as AuditService,
      {} as PricingService,
    );
    await expect(
      service.create(
        {
          id: 'guest-a',
          role: UserRole.USER,
          permissions: [],
          sessionId: 'session-a',
        },
        {
          quoteId: new BookingQuoteToken().issue({
            userId: 'guest-a',
            sessionId: 'session-a',
            roomId: 'room-a',
            hotelId: 'hotel-a',
            checkIn: '2026-12-01',
            checkOut: '2026-12-02',
            adults: 1,
            children: 0,
            roomCount: 1,
            currency: 'VND',
            totalAmount: '1000000',
            cancellationPolicyHash: policyFingerprint(null),
          }).quoteId,
          roomId: 'room-a',
          checkIn: '2026-12-01',
          checkOut: '2026-12-02',
          adults: 1,
          guestName: 'Guest A',
          guestEmail: 'guest@example.com',
        },
      ),
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

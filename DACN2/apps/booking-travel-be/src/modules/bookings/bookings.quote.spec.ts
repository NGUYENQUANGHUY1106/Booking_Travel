import { Prisma, UserRole } from '@prisma/client';
import type { AuditService } from '../../common/authorization/audit.service';
import type { AuthorizationService } from '../../common/authorization/authorization.service';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { BookingQuoteToken } from './booking-quote-token';
import { BookingsService } from './bookings.service';

describe('BookingsService quote', () => {
  const user = {
    id: 'guest-a',
    sessionId: 'session-a',
    role: UserRole.USER,
    permissions: [],
  };
  const input = {
    roomId: 'room-a',
    checkIn: '2030-01-01',
    checkOut: '2030-01-04',
    adults: 2,
    roomCount: 2,
  };

  function subject(hotelId = 'hotel-a', blocked = 0) {
    const room = {
      id: 'room-a',
      hotelId,
      name: 'Deluxe',
      type: 'DLX',
      quantity: 3,
      capacityAdults: 2,
      capacityChildren: 1,
      currency: 'VND',
      basePrice: new Prisma.Decimal('1000000'),
      hotel: {
        id: hotelId,
        name: `Hotel ${hotelId}`,
        coverImageUrl: null,
        checkInTime: '14:00',
        checkOutTime: '12:00',
        policy: { cancellationPolicy: 'Theo chính sách khách sạn.' },
      },
    };
    const db = {
      room: { findFirst: jest.fn().mockResolvedValue(room) },
      booking: { findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
      roomInventoryBlock: {
        findMany: jest.fn().mockResolvedValue(
          blocked
            ? [
                {
                  startDate: new Date('2030-01-02'),
                  endDateExclusive: new Date('2030-01-03'),
                  quantity: blocked,
                },
              ]
            : [],
        ),
      },
      roomInventoryOverride: { findMany: jest.fn().mockResolvedValue([]) },
      roomPricingRule: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rate-two',
            kind: 'DATE',
            startDate: new Date('2030-01-02'),
            endDateExclusive: new Date('2030-01-03'),
            price: new Prisma.Decimal('1200000'),
            active: true,
          },
          {
            id: 'rate-three',
            kind: 'DATE',
            startDate: new Date('2030-01-03'),
            endDateExclusive: new Date('2030-01-04'),
            price: new Prisma.Decimal('1400000'),
            active: true,
          },
        ]),
      },
    };
    const prisma = db as unknown as PrismaService;
    return {
      db,
      service: new BookingsService(
        prisma,
        {} as AuthorizationService,
        {} as AuditService,
        new PricingService(prisma),
        new BookingQuoteToken(),
      ),
    };
  }

  it('sums each night times two rooms without including checkout or writing inventory', async () => {
    const { db, service } = subject();
    const quote = await service.quote(input, user);
    expect(quote.nightlyRates.map((rate) => rate.amount)).toEqual([
      '2000000',
      '2400000',
      '2800000',
    ]);
    expect(quote.nights).toBe(3);
    expect(quote.roomSubtotal).toBe('7200000');
    expect(quote.finalAmount).toBe('7200000');
    expect(quote.taxes).toEqual([]);
    expect(quote.discounts).toEqual([]);
    expect(new BookingQuoteToken().verify(quote.quoteId)).toMatchObject({
      userId: user.id,
      sessionId: user.sessionId,
      hotelId: 'hotel-a',
      totalAmount: '7200000',
    });
    expect(db.booking.create).not.toHaveBeenCalled();
  });

  it('rejects a blocked night and reports the minimum available quantity', async () => {
    const { service } = subject('hotel-a', 2);
    await expect(service.quote(input, user)).rejects.toMatchObject({
      response: { code: 'ROOM_UNAVAILABLE', availableQty: 1 },
    });
  });

  it('uses the requested public hotel and rejects a mismatched hotel id', async () => {
    const { service } = subject('hotel-b');
    expect((await service.quote(input, user)).hotel.id).toBe('hotel-b');
    await expect(
      service.quote({ ...input, hotelId: 'hotel-a' }, user),
    ).rejects.toThrow();
  });

  it('does not silently apply an unsupported voucher', async () => {
    const { service } = subject();
    await expect(
      service.quote({ ...input, voucherCode: 'MYKHE12' }, user),
    ).rejects.toMatchObject({ response: { code: 'VOUCHER_INVALID' } });
  });
});

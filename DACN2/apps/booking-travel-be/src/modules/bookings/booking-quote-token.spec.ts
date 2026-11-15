import { ConflictException } from '@nestjs/common';
import { BookingQuoteToken, policyFingerprint } from './booking-quote-token';

describe('BookingQuoteToken', () => {
  const signer = new BookingQuoteToken();
  const context = {
    userId: 'guest-a',
    sessionId: 'session-a',
    roomId: 'room-a',
    hotelId: 'hotel-a',
    checkIn: '2030-01-01',
    checkOut: '2030-01-04',
    adults: 2,
    children: 0,
    roomCount: 1,
    currency: 'VND',
    totalAmount: '3600000',
    cancellationPolicyHash: policyFingerprint(null),
  };

  it('binds the amount and context to an authenticated signature', () => {
    const issued = signer.issue(context);
    expect(signer.verify(issued.quoteId)).toMatchObject(context);
    const [body, signature] = issued.quoteId.split('.');
    const changed = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(body, 'base64url').toString()),
        totalAmount: '1',
      }),
    ).toString('base64url');
    expect(() => signer.verify(`${changed}.${signature}`)).toThrow(
      ConflictException,
    );
  });

  it('rejects an expired quote at the boundary', () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const issued = signer.issue(context);
      clock.mockReturnValue(new Date(issued.expiresAt).getTime());
      expect(() => signer.verify(issued.quoteId)).toThrow(ConflictException);
    } finally {
      clock.mockRestore();
    }
  });
});

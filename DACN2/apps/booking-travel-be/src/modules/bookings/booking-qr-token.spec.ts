import { ConflictException } from '@nestjs/common';
import { BookingQrToken } from './booking-qr-token';

describe('BookingQrToken', () => {
  const signer = new BookingQrToken();
  const input = {
    bookingId: 'booking-1',
    bookingCode: 'BT-ABC12345',
    hotelId: 'hotel-1',
    checkIn: '2030-01-10',
    checkOut: '2030-01-12',
  };

  it('issues a deterministic signed token without guest personal data', () => {
    const first = signer.issue(input);
    const second = signer.issue(input);

    expect(first).toEqual(second);
    expect(first.value).toMatch(/^BTQR1\./);
    expect(first.value).not.toContain('guest@example.com');
    expect(signer.verify(first.value)).toMatchObject(input);
  });

  it('rejects a token whose booking data was changed', () => {
    const issued = signer.issue(input);
    const [prefix, body, signature] = issued.value.split('.');
    const changed = Buffer.from(
      Buffer.from(body, 'base64url')
        .toString()
        .replace('"bookingId":"booking-1"', '"bookingId":"booking-other"'),
    ).toString('base64url');

    expect(() => signer.verify(`${prefix}.${changed}.${signature}`)).toThrow(
      ConflictException,
    );
  });

  it('rejects an expired token', () => {
    const issued = signer.issue(input);
    const clock = jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2030-01-13T00:00:00.000Z').getTime());
    try {
      expect(() => signer.verify(issued.value)).toThrow(ConflictException);
    } finally {
      clock.mockRestore();
    }
  });
});

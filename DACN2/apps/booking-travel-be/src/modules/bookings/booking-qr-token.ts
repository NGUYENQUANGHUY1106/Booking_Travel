import { ConflictException, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

const QR_PREFIX = 'BTQR1';

export interface BookingQrClaims {
  version: 1;
  purpose: 'BOOKING_CHECK_IN';
  bookingId: string;
  bookingCode: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  expiresAt: number;
}

@Injectable()
export class BookingQrToken {
  private secret(): string {
    const secret =
      process.env.BOOKING_QR_SECRET ?? process.env.JWT_ACCESS_SECRET;
    if (!secret && process.env.NODE_ENV !== 'test') {
      throw new Error(
        'BOOKING_QR_SECRET or JWT_ACCESS_SECRET must be configured',
      );
    }
    return `booking-check-in-v1:${secret ?? 'test-only-secret'}`;
  }

  issue(input: Omit<BookingQrClaims, 'version' | 'purpose' | 'expiresAt'>) {
    const expiresAt = Date.parse(`${input.checkOut}T23:59:59.999Z`);
    if (!Number.isFinite(expiresAt)) {
      throw new Error('Booking QR check-out date is invalid');
    }
    const claims: BookingQrClaims = {
      ...input,
      version: 1,
      purpose: 'BOOKING_CHECK_IN',
      expiresAt,
    };
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = createHmac('sha256', this.secret())
      .update(body)
      .digest('base64url');
    return {
      value: `${QR_PREFIX}.${body}.${signature}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  verify(value: string): BookingQrClaims {
    const parts = value.split('.');
    if (
      parts.length !== 3 ||
      parts[0] !== QR_PREFIX ||
      parts[1].length > 4000 ||
      !/^[A-Za-z0-9_-]+$/.test(parts[1]) ||
      !/^[A-Za-z0-9_-]+$/.test(parts[2])
    ) {
      throw this.invalid();
    }
    const expected = createHmac('sha256', this.secret())
      .update(parts[1])
      .digest();
    const received = Buffer.from(parts[2], 'base64url');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw this.invalid();
    }
    let claims: BookingQrClaims;
    try {
      claims = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as BookingQrClaims;
    } catch {
      throw this.invalid();
    }
    if (
      claims.version !== 1 ||
      claims.purpose !== 'BOOKING_CHECK_IN' ||
      !claims.bookingId ||
      !claims.bookingCode ||
      !claims.hotelId ||
      !/^\d{4}-\d{2}-\d{2}$/.test(claims.checkIn) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(claims.checkOut) ||
      !Number.isFinite(claims.expiresAt)
    ) {
      throw this.invalid();
    }
    if (Date.now() > claims.expiresAt) {
      throw new ConflictException({
        code: 'BOOKING_QR_EXPIRED',
        message: 'Mã QR nhận phòng đã hết hạn.',
      });
    }
    return claims;
  }

  private invalid() {
    return new ConflictException({
      code: 'BOOKING_QR_INVALID',
      message: 'Mã QR nhận phòng không hợp lệ.',
    });
  }
}

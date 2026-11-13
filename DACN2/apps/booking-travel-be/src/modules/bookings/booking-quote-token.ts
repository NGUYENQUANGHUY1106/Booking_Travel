import { ConflictException, Injectable } from '@nestjs/common';
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

export function policyFingerprint(value: string | null): string {
  return createHash('sha256')
    .update(value ?? '')
    .digest('hex');
}

export interface BookingQuoteClaims {
  version: 1;
  id: string;
  userId: string;
  sessionId: string;
  roomId: string;
  hotelId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomCount: number;
  currency: string;
  totalAmount: string;
  cancellationPolicyHash: string;
  issuedAt: number;
  expiresAt: number;
}

@Injectable()
export class BookingQuoteToken {
  private secret(): string {
    const secret =
      process.env.BOOKING_QUOTE_SECRET ?? process.env.JWT_ACCESS_SECRET;
    if (!secret && process.env.NODE_ENV !== 'test') {
      throw new Error(
        'BOOKING_QUOTE_SECRET or JWT_ACCESS_SECRET must be configured',
      );
    }
    return `booking-quote-v1:${secret ?? 'test-only-secret'}`;
  }

  issue(
    input: Omit<
      BookingQuoteClaims,
      'version' | 'id' | 'issuedAt' | 'expiresAt'
    >,
  ) {
    const now = Date.now();
    const ttlSeconds = Number(process.env.BOOKING_QUOTE_TTL_SECONDS ?? 600);
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 3600) {
      throw new Error('BOOKING_QUOTE_TTL_SECONDS must be between 60 and 3600');
    }
    const claims: BookingQuoteClaims = {
      ...input,
      version: 1,
      id: randomUUID(),
      issuedAt: now,
      expiresAt: now + ttlSeconds * 1000,
    };
    const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signature = createHmac('sha256', this.secret())
      .update(body)
      .digest('base64url');
    return {
      quoteId: `${body}.${signature}`,
      expiresAt: new Date(claims.expiresAt).toISOString(),
      checkedAt: new Date(now).toISOString(),
    };
  }

  verify(token: string): BookingQuoteClaims {
    const parts = token.split('.');
    if (
      parts.length !== 2 ||
      parts[0].length > 4000 ||
      !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
      !/^[A-Za-z0-9_-]+$/.test(parts[1])
    ) {
      throw new ConflictException({
        code: 'QUOTE_CONTEXT_MISMATCH',
        message: 'Báo giá không hợp lệ. Vui lòng lấy báo giá mới.',
      });
    }
    const expected = createHmac('sha256', this.secret())
      .update(parts[0])
      .digest();
    const received = Buffer.from(parts[1], 'base64url');
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new ConflictException({
        code: 'QUOTE_CONTEXT_MISMATCH',
        message: 'Báo giá đã bị thay đổi. Vui lòng lấy báo giá mới.',
      });
    }
    let claims: BookingQuoteClaims;
    try {
      claims = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      ) as BookingQuoteClaims;
    } catch {
      throw new ConflictException({
        code: 'QUOTE_CONTEXT_MISMATCH',
        message: 'Báo giá không hợp lệ.',
      });
    }
    if (
      claims.version !== 1 ||
      !claims.id ||
      !claims.userId ||
      !claims.sessionId ||
      !claims.roomId ||
      !claims.hotelId ||
      !claims.currency ||
      !claims.totalAmount ||
      !/^[a-f0-9]{64}$/.test(claims.cancellationPolicyHash) ||
      !Number.isFinite(claims.expiresAt)
    ) {
      throw new ConflictException({
        code: 'QUOTE_CONTEXT_MISMATCH',
        message: 'Báo giá không hợp lệ.',
      });
    }
    if (Date.now() >= claims.expiresAt) {
      throw new ConflictException({
        code: 'QUOTE_EXPIRED',
        message: 'Báo giá đã hết hạn. Vui lòng lấy báo giá mới.',
      });
    }
    return claims;
  }
}

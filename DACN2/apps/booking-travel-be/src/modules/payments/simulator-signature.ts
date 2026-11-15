import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const MAX_BODY_BYTES = 16_384;
const MAX_CLOCK_SKEW_SECONDS = 300;
const PROVIDER = 'SIMULATOR';

export function simulatorConfigured(): boolean {
  return (
    process.env.PAYMENT_SIMULATOR_ENABLED === 'true' &&
    (process.env.PAYMENT_SIMULATOR_SECRET?.length ?? 0) >= 32 &&
    Boolean(process.env.PAYMENT_SIMULATOR_MERCHANT_ID)
  );
}

export type SimulatorEvent = {
  eventId: string;
  merchantId: string;
  merchantReference: string;
  providerTxnId: string;
  amount: string;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  failureReason?: string;
};

function nonempty(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max;
}

@Injectable()
export class SimulatorSignature {
  readonly provider = PROVIDER;
  private readonly secret = process.env.PAYMENT_SIMULATOR_SECRET ?? '';
  readonly merchantId = process.env.PAYMENT_SIMULATOR_MERCHANT_ID ?? '';

  enabled(): boolean {
    return simulatorConfigured();
  }

  sign(rawBody: Buffer, timestamp: string): string {
    return createHmac('sha256', this.secret)
      .update(timestamp, 'utf8')
      .update('.')
      .update(rawBody)
      .digest('hex');
  }

  verify(
    rawBody: Buffer | undefined,
    timestamp: string | undefined,
    signature: string | undefined,
    now = Date.now(),
  ): { event: SimulatorEvent; payloadHash: string } {
    if (!this.enabled())
      throw new UnauthorizedException(
        'Cổng thanh toán mô phỏng chưa được cấu hình.',
      );
    if (!rawBody || rawBody.length > MAX_BODY_BYTES)
      throw new BadRequestException('Payload webhook không hợp lệ.');
    if (
      !timestamp ||
      !/^\d{10}$/.test(timestamp) ||
      Math.abs(now / 1000 - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS
    )
      throw new UnauthorizedException('Timestamp webhook không hợp lệ.');
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature))
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ.');

    const actual = Buffer.from(signature.toLowerCase(), 'hex');
    const expected = Buffer.from(this.sign(rawBody, timestamp), 'hex');
    if (!timingSafeEqual(actual, expected))
      throw new UnauthorizedException('Chữ ký webhook không hợp lệ.');

    let value: unknown;
    try {
      value = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('JSON webhook không hợp lệ.');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new BadRequestException('Payload webhook không hợp lệ.');
    const event = value as Record<string, unknown>;
    if (
      !nonempty(event.eventId) ||
      !nonempty(event.merchantId) ||
      !nonempty(event.merchantReference) ||
      !nonempty(event.providerTxnId) ||
      typeof event.amount !== 'string' ||
      !/^\d{1,12}(?:\.\d{1,2})?$/.test(event.amount) ||
      typeof event.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(event.currency) ||
      !['PENDING', 'SUCCESS', 'FAILED'].includes(String(event.status)) ||
      (event.failureReason !== undefined && !nonempty(event.failureReason, 200))
    )
      throw new BadRequestException('Payload webhook không hợp lệ.');
    if (event.merchantId !== this.merchantId)
      throw new UnauthorizedException('Merchant webhook không hợp lệ.');
    return {
      event: event as SimulatorEvent,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
    };
  }
}

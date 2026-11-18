import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { simulatorConfigured } from '../payments/simulator-signature';

export type RefundSimulatorEvent = {
  eventId: string;
  merchantId: string;
  providerRefundRef: string;
  originalProviderTxnId: string;
  amount: string;
  currency: string;
  status: 'SUCCESS' | 'FAILED';
  failureCode?: string;
};

@Injectable()
export class RefundSimulatorSignature {
  private readonly secret = process.env.PAYMENT_SIMULATOR_SECRET ?? '';
  readonly merchantId = process.env.PAYMENT_SIMULATOR_MERCHANT_ID ?? '';

  enabled() {
    return simulatorConfigured();
  }

  sign(rawBody: Buffer, timestamp: string) {
    return createHmac('sha256', this.secret)
      .update('refund:')
      .update(timestamp)
      .update('.')
      .update(rawBody)
      .digest('hex');
  }

  verify(
    rawBody?: Buffer,
    timestamp?: string,
    signature?: string,
    now = Date.now(),
  ) {
    if (!this.enabled())
      throw new UnauthorizedException('Cổng mô phỏng chưa được cấu hình.');
    if (!rawBody || rawBody.length > 16_384)
      throw new BadRequestException('Payload hoàn tiền không hợp lệ.');
    if (
      !timestamp ||
      !/^\d{10}$/.test(timestamp) ||
      Math.abs(now / 1000 - Number(timestamp)) > 300
    )
      throw new UnauthorizedException('Timestamp không hợp lệ.');
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature))
      throw new UnauthorizedException('Chữ ký không hợp lệ.');
    const expected = Buffer.from(this.sign(rawBody, timestamp), 'hex');
    const actual = Buffer.from(signature.toLowerCase(), 'hex');
    if (!timingSafeEqual(expected, actual))
      throw new UnauthorizedException('Chữ ký không hợp lệ.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('JSON không hợp lệ.');
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new BadRequestException('Payload không hợp lệ.');
    const event = parsed as Record<string, unknown>;
    const validText = (value: unknown, max = 128) =>
      typeof value === 'string' && value.length > 0 && value.length <= max;
    if (
      !validText(event.eventId) ||
      !validText(event.merchantId) ||
      !validText(event.providerRefundRef) ||
      !validText(event.originalProviderTxnId) ||
      typeof event.amount !== 'string' ||
      !/^\d{1,12}(?:\.\d{1,2})?$/.test(event.amount) ||
      typeof event.currency !== 'string' ||
      !/^[A-Z]{3}$/.test(event.currency) ||
      !['SUCCESS', 'FAILED'].includes(String(event.status)) ||
      (event.failureCode !== undefined && !validText(event.failureCode, 80))
    )
      throw new BadRequestException('Payload hoàn tiền không hợp lệ.');
    if (event.merchantId !== this.merchantId)
      throw new UnauthorizedException('Merchant không hợp lệ.');
    return {
      event: event as RefundSimulatorEvent,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
    };
  }
}

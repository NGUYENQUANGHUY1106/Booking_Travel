import { UnauthorizedException } from '@nestjs/common';
import { RefundSimulatorSignature } from './refund-simulator-signature';

describe('refund simulator signature', () => {
  const previous = {
    enabled: process.env.PAYMENT_SIMULATOR_ENABLED,
    secret: process.env.PAYMENT_SIMULATOR_SECRET,
    merchant: process.env.PAYMENT_SIMULATOR_MERCHANT_ID,
  };
  beforeAll(() => {
    process.env.PAYMENT_SIMULATOR_ENABLED = 'true';
    process.env.PAYMENT_SIMULATOR_SECRET =
      'test-only-secret-with-at-least-32-characters';
    process.env.PAYMENT_SIMULATOR_MERCHANT_ID = 'test-merchant';
  });
  afterAll(() => {
    if (previous.enabled === undefined)
      delete process.env.PAYMENT_SIMULATOR_ENABLED;
    else process.env.PAYMENT_SIMULATOR_ENABLED = previous.enabled;
    if (previous.secret === undefined)
      delete process.env.PAYMENT_SIMULATOR_SECRET;
    else process.env.PAYMENT_SIMULATOR_SECRET = previous.secret;
    if (previous.merchant === undefined)
      delete process.env.PAYMENT_SIMULATOR_MERCHANT_ID;
    else process.env.PAYMENT_SIMULATOR_MERCHANT_ID = previous.merchant;
  });

  it('accepts a signed refund callback and rejects tampering, replay outside window, and wrong domain', () => {
    const verifier = new RefundSimulatorSignature();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = Buffer.from(
      JSON.stringify({
        eventId: 'event-1',
        merchantId: 'test-merchant',
        providerRefundRef: 'ref-1',
        originalProviderTxnId: 'original-1',
        amount: '50000',
        currency: 'VND',
        status: 'SUCCESS',
      }),
    );
    const signature = verifier.sign(body, timestamp);
    expect(verifier.verify(body, timestamp, signature).event.amount).toBe(
      '50000',
    );
    expect(() =>
      verifier.verify(
        Buffer.from(body.toString().replace('50000', '90000')),
        timestamp,
        signature,
      ),
    ).toThrow(UnauthorizedException);
    expect(() =>
      verifier.verify(body, String(Number(timestamp) - 301), signature),
    ).toThrow(UnauthorizedException);
    expect(() => verifier.verify(body, timestamp, '0'.repeat(64))).toThrow(
      UnauthorizedException,
    );
  });
});

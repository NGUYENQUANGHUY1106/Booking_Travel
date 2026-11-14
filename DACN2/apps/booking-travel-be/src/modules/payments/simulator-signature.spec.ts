import { SimulatorSignature } from './simulator-signature';

describe('SIMULATOR webhook signature', () => {
  const original = {
    enabled: process.env.PAYMENT_SIMULATOR_ENABLED,
    merchant: process.env.PAYMENT_SIMULATOR_MERCHANT_ID,
    secret: process.env.PAYMENT_SIMULATOR_SECRET,
  };

  beforeEach(() => {
    process.env.PAYMENT_SIMULATOR_ENABLED = 'true';
    process.env.PAYMENT_SIMULATOR_MERCHANT_ID = 'merchant-test';
    process.env.PAYMENT_SIMULATOR_SECRET =
      'test-only-signing-secret-longer-than-32-characters';
  });

  afterAll(() => {
    for (const [key, value] of [
      ['PAYMENT_SIMULATOR_ENABLED', original.enabled],
      ['PAYMENT_SIMULATOR_MERCHANT_ID', original.merchant],
      ['PAYMENT_SIMULATOR_SECRET', original.secret],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const body = () =>
    Buffer.from(
      JSON.stringify({
        eventId: 'evt-1',
        merchantId: 'merchant-test',
        merchantReference: 'BT-PAY-1',
        providerTxnId: 'txn-1',
        amount: '1250000.00',
        currency: 'VND',
        status: 'SUCCESS',
      }),
    );

  it('accepts only the exact raw body and a current signed timestamp', () => {
    const verifier = new SimulatorSignature();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const raw = body();
    const signature = verifier.sign(raw, timestamp);
    expect(verifier.verify(raw, timestamp, signature).event.status).toBe(
      'SUCCESS',
    );
    expect(() =>
      verifier.verify(
        Buffer.from(raw.toString().replace('1250000', '1250001')),
        timestamp,
        signature,
      ),
    ).toThrow();
    expect(() =>
      verifier.verify(raw, String(Number(timestamp) - 301), signature),
    ).toThrow();
  });

  it('rejects a correctly signed event for the wrong merchant or oversized payload', () => {
    const verifier = new SimulatorSignature();
    const timestamp = String(Math.floor(Date.now() / 1000));
    const wrongMerchant = Buffer.from(
      body().toString().replace('merchant-test', 'another-merchant'),
    );
    expect(() =>
      verifier.verify(
        wrongMerchant,
        timestamp,
        verifier.sign(wrongMerchant, timestamp),
      ),
    ).toThrow();
    expect(() =>
      verifier.verify(Buffer.alloc(16_385), timestamp, '0'.repeat(64)),
    ).toThrow();
  });

  it('is closed when the simulator has no configured secret', () => {
    process.env.PAYMENT_SIMULATOR_SECRET = '';
    expect(new SimulatorSignature().enabled()).toBe(false);
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';

import { createIdempotencyKey } from '../src/features/traveler/payment-model.ts';

test('creates a UUID v4 idempotency key', () => {
  const key = createIdempotencyKey(() => 0.25);
  assert.match(
    key,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});

test('creates a fresh key for a new payment attempt', () => {
  let value = 0;
  const random = () => ((value += 0.01) % 1);
  assert.notEqual(createIdempotencyKey(random), createIdempotencyKey(random));
});

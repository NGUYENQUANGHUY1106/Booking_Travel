import assert from 'node:assert/strict';
import test from 'node:test';

import { formatDistance } from '../src/features/traveler/nearby-search.ts';

test('formats nearby hotel distances from server metres', () => {
  assert.equal(formatDistance(412.4), '412 m');
  assert.equal(formatDistance(1450), '1,5 km');
  assert.equal(formatDistance(null), null);
});

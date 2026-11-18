import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bookingHistoryGroup,
  bookingHistorySections,
  bookingStatusLabel,
} from '../src/features/traveler/booking-history.ts';

test('groups every booking status for the booking history tabs', () => {
  assert.equal(bookingHistoryGroup('PENDING_PAYMENT'), 'UPCOMING');
  assert.equal(bookingHistoryGroup('CONFIRMED'), 'UPCOMING');
  assert.equal(bookingHistoryGroup('CHECKED_IN'), 'CURRENT');
  assert.equal(bookingHistoryGroup('COMPLETED'), 'COMPLETED');
  assert.equal(bookingHistoryGroup('CANCELLED'), 'CANCELLED');
  assert.equal(bookingHistoryGroup('EXPIRED'), 'CANCELLED');
  assert.equal(bookingHistoryGroup('REFUND_PENDING'), 'CANCELLED');
  assert.equal(bookingHistoryGroup('REFUNDED'), 'CANCELLED');
});

test('builds non-empty sections and respects a selected filter', () => {
  const bookings = [
    { id: '1', status: 'CONFIRMED' },
    { id: '2', status: 'CHECKED_IN' },
    { id: '3', status: 'COMPLETED' },
  ];
  assert.deepEqual(
    bookingHistorySections(bookings, 'ALL').map(({ key, items }) => [key, items.length]),
    [['UPCOMING', 1], ['CURRENT', 1], ['COMPLETED', 1]],
  );
  assert.deepEqual(
    bookingHistorySections(bookings, 'CURRENT')[0].items,
    [{ id: '2', status: 'CHECKED_IN' }],
  );
  assert.equal(bookingStatusLabel('CONFIRMED'), 'Đã xác nhận');
});

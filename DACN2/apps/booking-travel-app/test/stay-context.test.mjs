import assert from 'node:assert/strict';
import test from 'node:test';

import {
  confirmedSearchStay,
  confirmedStayForHotel,
  guestContextKey,
  todayInVietnam,
  validStayDates,
} from '../src/features/traveler/stay-context.ts';

const SEARCH = { source: 'search', hotelId: null, confirmedAt: 42 };
const HOTEL = { source: 'hotel', hotelId: 'hotel-a', confirmedAt: 43 };

test('unconfirmed and legacy default dates never qualify as a booking stay', () => {
  assert.equal(confirmedStayForHotel(null, '2026-11-14', '2026-11-15', 'hotel-a', 'hotel-a'), false);
  assert.equal(confirmedSearchStay(null, '2026-11-14', '2026-11-15'), false);
  assert.equal(confirmedStayForHotel(SEARCH, '', '', 'hotel-a', 'hotel-a'), false);
});

test('confirmed search dates follow only the active hotel and hotel dates stay scoped', () => {
  assert.equal(confirmedStayForHotel(SEARCH, '2099-12-20', '2099-12-23', 'hotel-a', 'hotel-a'), true);
  assert.equal(confirmedStayForHotel(SEARCH, '2099-12-20', '2099-12-23', 'hotel-a', 'hotel-b'), false);
  assert.equal(confirmedStayForHotel(HOTEL, '2099-12-20', '2099-12-23', 'hotel-a', 'hotel-b'), false);
  assert.equal(confirmedSearchStay(HOTEL, '2099-12-20', '2099-12-23'), false);
});

test('date-only validation spans months and leap years without counting checkout', () => {
  assert.equal(validStayDates('2028-02-28', '2028-03-01', '2028-02-01'), true);
  assert.equal(validStayDates('2027-01-01', '2028-01-02', '2027-01-01'), true);
  assert.equal((Date.parse('2028-03-01T00:00:00Z') - Date.parse('2028-02-28T00:00:00Z')) / 86_400_000, 2);
  for (const [start, end] of [
    ['2026-12-20', '2026-12-20'], ['2026-12-20', '2026-12-19'],
    ['2026-02-29', '2026-03-01'], ['2026-11-13', '2026-11-15'],
    ['2026-12-01', '2028-01-01'],
  ]) assert.equal(validStayDates(start, end, '2026-11-14'), false, `${start} → ${end}`);
  assert.equal(todayInVietnam(new Date('2026-11-13T17:30:00Z')), '2026-11-14');
});

test('guest confirmation is invalid after room, dates, or headcount changes', () => {
  const initial = guestContextKey('room-a', '2026-12-20', '2026-12-23', 3, 0, 2, SEARCH);
  assert.notEqual(initial, guestContextKey('room-b', '2026-12-20', '2026-12-23', 3, 0, 2, SEARCH));
  assert.notEqual(initial, guestContextKey('room-a', '2026-12-21', '2026-12-23', 3, 0, 2, SEARCH));
  assert.notEqual(initial, guestContextKey('room-a', '2026-12-20', '2026-12-23', 2, 0, 2, SEARCH));
});

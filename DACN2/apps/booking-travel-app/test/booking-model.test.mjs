import assert from 'node:assert/strict';
import test from 'node:test';

import { toTravelerBooking } from '../src/features/traveler/booking-model.ts';

test('maps a database booking without inventing hotel, room or amount', () => {
  const result = toTravelerBooking({
    id: 'booking-1',
    code: 'BT-REAL-001',
    hotelId: 'hotel-1',
    roomId: 'room-1',
    checkIn: '2026-12-10T00:00:00.000Z',
    checkOut: '2026-12-12T00:00:00.000Z',
    adults: 2,
    children: 1,
    roomCount: 1,
    totalAmount: '1960000',
    currency: 'VND',
    status: 'CONFIRMED',
    guestName: 'Nguyễn Văn A',
    guestEmail: 'guest@example.com',
    guestPhone: '0901234567',
    note: null,
    hotel: { id: 'hotel-1', name: 'Riverside' },
    room: { id: 'room-1', name: 'Deluxe', type: 'DELUXE' },
  });

  assert.deepEqual(result, {
    id: 'booking-1',
    code: 'BT-REAL-001',
    hotelId: 'hotel-1',
    hotelName: 'Riverside',
    checkIn: '2026-12-10',
    checkOut: '2026-12-12',
    guests: 3,
    guestName: 'Nguyễn Văn A',
    room: 'Deluxe',
    amount: 1960000,
    status: 'CONFIRMED',
    live: true,
  });
});

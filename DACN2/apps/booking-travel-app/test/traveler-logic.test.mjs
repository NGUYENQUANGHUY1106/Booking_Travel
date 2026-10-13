import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateBookingQuote, nights, roomRate } from '../src/features/traveler/pricing.ts';
import { searchHotels } from '../src/features/traveler/search-engine.ts';
import { formatCurrency, setDisplayCurrency } from '../src/features/traveler/money.ts';
import { suggestHotel } from '../src/features/traveler/ai-demo.ts';

const hotels = [
  { id: 'blue', destination: 'Đà Nẵng', area: 'Mỹ Khê', type: 'HOTEL', price: 1450000, rating: 9.1, reviews: 1284, distanceMeters: 350, amenities: ['Hồ bơi', 'Hủy miễn phí'] },
  { id: 'sea', destination: 'Đà Nẵng', area: 'Mỹ Khê', type: 'HOTEL', price: 1190000, rating: 8.9, reviews: 746, distanceMeters: 180, amenities: ['Hồ bơi', 'Hủy miễn phí'] },
  { id: 'resort', destination: 'Đà Nẵng', area: 'Sơn Trà', type: 'RESORT', price: 1790000, rating: 9.4, reviews: 236, distanceMeters: 500, amenities: ['Hồ bơi'] },
  { id: 'hoi-an', destination: 'Hội An', area: 'Phố cổ', type: 'HOTEL', price: 990000, rating: 9.3, reviews: 864, distanceMeters: 250, amenities: ['Wi-Fi miễn phí'] },
];
const filters = { types: ['HOTEL'], amenities: ['Hồ bơi'], minPrice: 500000, maxPrice: 2000000, stars: [4, 5], minRating: 8, freeCancellation: true };

test('quote stays consistent with the Figma booking example', () => {
  const quote = calculateBookingQuote(1450000, '2026-10-12', '2026-10-15', 1, 'TRAVEL12');
  assert.deepEqual({ nights: quote.nights, roomSubtotal: quote.roomSubtotal, taxesAndFees: quote.taxesAndFees, discount: quote.discount, total: quote.total }, { nights: 3, roomSubtotal: 4350000, taxesAndFees: 360000, discount: 522000, total: 4188000 });
});

test('quote includes room count, validates dates, and ignores invalid vouchers', () => {
  assert.equal(calculateBookingQuote(1450000, '2026-10-12', '2026-10-15', 2, 'TRAVEL12').total, 8898000);
  assert.equal(calculateBookingQuote(1450000, '2026-10-12', '2026-10-15', 1, 'INVALID').discount, 0);
  assert.equal(nights('2026-10-15', '2026-10-12'), 0);
  assert.equal(calculateBookingQuote(1450000, '2026-10-15', '2026-10-12', 1, 'TRAVEL12').total, 0);
});

test('selected room rate is used in the final quote', () => {
  assert.equal(roomRate(1450000, 'Superior City View'), 1180000);
  assert.equal(calculateBookingQuote(roomRate(1450000, 'Superior City View'), '2026-10-12', '2026-10-15', 1, '').total, 3900000);
});

test('search combines filter groups with AND and sorts by price', () => {
  assert.deepEqual(searchHotels(hotels, 'Đà Nẵng', filters, 'priceAsc').map((hotel) => hotel.id), ['sea', 'blue']);
  assert.deepEqual(searchHotels(hotels, 'Đà Nẵng', filters, 'priceDesc').map((hotel) => hotel.id), ['blue', 'sea']);
});

test('search supports multiple accommodation types and amenities', () => {
  const selection = { ...filters, types: ['HOTEL', 'RESORT'], freeCancellation: false };
  assert.deepEqual(searchHotels(hotels, 'Đà Nẵng', selection, 'nearest').map((hotel) => hotel.id), ['sea', 'blue', 'resort']);
  assert.deepEqual(searchHotels(hotels, 'Đà Nẵng', { ...selection, amenities: ['Hồ bơi', 'Hủy miễn phí'] }, 'nearest').map((hotel) => hotel.id), ['sea', 'blue']);
});

test('search returns no results for an invalid price range or unmatched destination', () => {
  assert.equal(searchHotels(hotels, 'Đà Nẵng', { ...filters, minPrice: 3000000, maxPrice: 1000000 }, 'recommended').length, 0);
  assert.equal(searchHotels(hotels, 'Nha Trang', filters, 'recommended').length, 0);
});

test('currency preference changes display while booking totals remain in VND', () => {
  setDisplayCurrency('USD');
  assert.equal(formatCurrency(1450000), '≈ $58.00');
  assert.equal(calculateBookingQuote(1450000, '2026-10-12', '2026-10-15', 1, 'TRAVEL12').total, 4188000);
  setDisplayCurrency('VND');
  assert.equal(formatCurrency(1450000), '1.450.000 ₫');
});

test('AI demo suggests only a matching hotel from the mock dataset', () => {
  assert.equal(suggestHotel(hotels, 'Khách sạn có hồ bơi dưới 1,5 triệu', 'Đà Nẵng')?.id, 'blue');
  assert.equal(suggestHotel(hotels, 'Khách sạn có hồ bơi dưới 1,2 triệu', 'Đà Nẵng')?.id, 'sea');
  assert.equal(suggestHotel(hotels, 'Đi Hội An', 'Đà Nẵng')?.id, 'hoi-an');
  assert.equal(suggestHotel(hotels, 'Đi Phú Quốc', 'Đà Nẵng'), undefined);
  assert.equal(suggestHotel(hotels, 'Hồ bơi dưới 500 nghìn', 'Đà Nẵng'), undefined);
});

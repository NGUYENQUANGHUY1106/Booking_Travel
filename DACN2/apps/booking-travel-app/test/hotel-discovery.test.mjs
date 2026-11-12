import assert from "node:assert/strict";
import test from "node:test";

import {
  filterDiscoveryHotels,
  groupHotelDestinations,
  publicHotelPrice,
  splitDiscoveryHotels,
  validStaySearch,
} from "../src/features/traveler/hotel-discovery.ts";

function hotel(overrides) {
  return {
    id: "hotel-1",
    name: "Khách sạn Biển Xanh",
    addressLine: "1 Võ Nguyên Giáp",
    city: "Đà Nẵng",
    province: "Đà Nẵng",
    latitude: null,
    longitude: null,
    description: null,
    coverImageUrl: null,
    accommodationType: "HOTEL",
    starRating: 4,
    roomCount: 2,
    minPricePerNight: "1200000",
    currency: "VND",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    amenities: [],
    ...overrides,
  };
}

test("filters only hotels returned by the API fixture", () => {
  const hotels = [
    hotel({ id: "dn", name: "Biển Xanh" }),
    hotel({
      id: "pq",
      name: "Đảo Ngọc",
      city: "Phú Quốc",
      province: "Kiên Giang",
      accommodationType: "RESORT",
    }),
  ];
  assert.deepEqual(
    filterDiscoveryHotels(hotels, "phu quoc", "RESORT").map((item) => item.id),
    ["pq"],
  );
  assert.deepEqual(
    filterDiscoveryHotels(hotels, "", "HOTEL").map((item) => item.id),
    ["dn"],
  );
});

test("groups destinations and counts the real records without duplicates", () => {
  const hotels = [
    hotel({ id: "one" }),
    hotel({ id: "two" }),
    hotel({ id: "three", city: "Hội An", province: "Quảng Nam" }),
  ];
  assert.deepEqual(
    groupHotelDestinations(hotels).map(({ name, count }) => ({ name, count })),
    [
      { name: "Đà Nẵng", count: 2 },
      { name: "Hội An", count: 1 },
    ],
  );
});

test("featured and recommended sections never duplicate a hotel", () => {
  const hotels = Array.from({ length: 5 }, (_, index) =>
    hotel({ id: `hotel-${index}`, starRating: index }),
  );
  const sections = splitDiscoveryHotels(hotels);
  assert.equal(sections.featured.length, 3);
  assert.equal(sections.recommended.length, 2);
  assert.equal(
    new Set(
      [...sections.featured, ...sections.recommended].map((item) => item.id),
    ).size,
    5,
  );
});

test("does not invent a price when the database has no active room price", () => {
  assert.equal(publicHotelPrice(hotel({ minPricePerNight: null })), undefined);
});

test("validates complete stay conditions before calling hotel search", () => {
  assert.equal(
    validStaySearch("Đà Nẵng", "2099-12-10", "2099-12-13", 2, 1, 1),
    true,
  );
  assert.equal(validStaySearch("", "2099-12-10", "2099-12-13", 2, 0, 1), false);
  assert.equal(
    validStaySearch("Đà Nẵng", "2099-12-13", "2099-12-10", 2, 0, 1),
    false,
  );
  assert.equal(
    validStaySearch("Đà Nẵng", "2020-01-01", "2020-01-03", 2, 0, 1),
    false,
  );
  assert.equal(
    validStaySearch("Đà Nẵng", "2099-12-10", "2099-12-13", 0, 0, 1),
    false,
  );
  assert.equal(
    validStaySearch("Đà Nẵng", "2099-12-10", "2099-12-13", 2, 0, 0),
    false,
  );
});

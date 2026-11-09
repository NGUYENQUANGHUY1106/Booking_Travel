import assert from "node:assert/strict";
import test from "node:test";

import { applyRoomFilters, EMPTY_ROOM_FILTERS } from "../src/features/traveler/rooms/room-filter.ts";

const rooms = [
  {
    id: "deluxe",
    classCode: "DLX",
    viewCode: "SEA",
    bedConfigurations: [{ bedType: "KING", quantity: 1 }],
    amenities: ["wifi", "balcony"],
    basePrice: "1450000",
    capacityAdults: 2,
    capacityChildren: 1,
  },
  {
    id: "superior",
    classCode: "SUP",
    viewCode: "CITY",
    bedConfigurations: [{ bedType: "TWIN", quantity: 2 }],
    amenities: ["wifi"],
    basePrice: "980000",
    capacityAdults: 2,
    capacityChildren: 0,
  },
];

test("room filters combine class, view, bed and amenity conditions", () => {
  const result = applyRoomFilters(rooms, {
    ...EMPTY_ROOM_FILTERS,
    classes: ["DLX"],
    views: ["SEA"],
    beds: ["KING"],
    amenities: ["balcony"],
  });
  assert.deepEqual(result.map((room) => room.id), ["deluxe"]);
});

test("room sorting uses database prices without mutating API data", () => {
  const before = rooms.map((room) => room.id);
  const ascending = applyRoomFilters(rooms, EMPTY_ROOM_FILTERS);
  const descending = applyRoomFilters(rooms, { ...EMPTY_ROOM_FILTERS, sort: "priceDesc" });
  assert.deepEqual(ascending.map((room) => room.id), ["superior", "deluxe"]);
  assert.deepEqual(descending.map((room) => room.id), ["deluxe", "superior"]);
  assert.deepEqual(rooms.map((room) => room.id), before);
});

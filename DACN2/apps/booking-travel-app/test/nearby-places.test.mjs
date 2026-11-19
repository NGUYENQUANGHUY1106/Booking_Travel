import assert from "node:assert/strict";
import test from "node:test";

import {
  NEARBY_PLACE_CATEGORIES,
  formatNearbyDistance,
  nearbyPlaceMapUrl,
} from "../src/features/traveler/nearby-place-model.ts";

test("formats nearby place distances for metres and kilometres", () => {
  assert.equal(formatNearbyDistance(350), "350 m");
  assert.equal(formatNearbyDistance(2_450), "2.5 km");
  assert.equal(formatNearbyDistance(12_000), "12 km");
});

test("exposes each supported nearby place category once", () => {
  const values = NEARBY_PLACE_CATEGORIES.map((category) => category.value);
  assert.equal(new Set(values).size, values.length);
  assert.deepEqual(values, [
    "ATTRACTION",
    "BEACH",
    "FOOD",
    "SHOPPING",
    "TRANSPORT",
    "HEALTHCARE",
    "EDUCATION",
  ]);
});

test("opens a nearby place at its exact coordinates in Google Maps", () => {
  assert.equal(
    nearbyPlaceMapUrl("16.0611000", "108.2277000"),
    "https://www.google.com/maps/search/?api=1&query=16.0611000%2C108.2277000",
  );
});

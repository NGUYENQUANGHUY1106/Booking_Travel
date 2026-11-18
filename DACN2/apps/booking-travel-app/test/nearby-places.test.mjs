import assert from "node:assert/strict";
import test from "node:test";

import {
  NEARBY_PLACE_CATEGORIES,
  formatNearbyDistance,
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

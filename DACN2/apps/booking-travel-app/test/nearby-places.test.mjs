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

test("opens a nearby place by name and provider address in Google Maps", () => {
  assert.equal(
    nearbyPlaceMapUrl({
      name: "Non Nuoc Beach",
      address: "Ngũ Hành Sơn, Đà Nẵng, Việt Nam",
      latitude: "16.0205336",
      longitude: "108.2617440",
    }),
    "https://www.google.com/maps/search/?api=1&query=Non%20Nuoc%20Beach%2C%20Ng%C5%A9%20H%C3%A0nh%20S%C6%A1n%2C%20%C4%90%C3%A0%20N%E1%BA%B5ng%2C%20Vi%E1%BB%87t%20Nam",
  );
});

test("falls back to exact coordinates when a provider has no address", () => {
  assert.equal(
    nearbyPlaceMapUrl({
      name: "Unnamed place",
      address: null,
      latitude: "16.0611000",
      longitude: "108.2277000",
    }),
    "https://www.google.com/maps/search/?api=1&query=16.0611000%2C108.2277000",
  );
});

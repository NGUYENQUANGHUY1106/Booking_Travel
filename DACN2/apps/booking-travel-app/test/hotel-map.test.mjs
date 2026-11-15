import assert from "node:assert/strict";
import test from "node:test";

import { regionToBounds } from "../src/features/traveler/hotel-map.ts";

test("regionToBounds converts a map center and spans into the API bounding box", () => {
  assert.deepEqual(
    regionToBounds({
      latitude: 16,
      longitude: 108,
      latitudeDelta: 0.2,
      longitudeDelta: 0.4,
    }),
    {
      northEast: { latitude: 16.1, longitude: 108.2 },
      southWest: { latitude: 15.9, longitude: 107.8 },
    },
  );
});

test("regionToBounds clamps coordinates to valid world limits", () => {
  assert.deepEqual(
    regionToBounds({
      latitude: 89,
      longitude: 179,
      latitudeDelta: 10,
      longitudeDelta: 10,
    }),
    {
      northEast: { latitude: 90, longitude: 180 },
      southWest: { latitude: 84, longitude: 174 },
    },
  );
});

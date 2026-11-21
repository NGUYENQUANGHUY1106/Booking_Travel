import assert from "node:assert/strict";
import test from "node:test";

import {
  canUseWishlist,
  defaultWishlist,
  wishlistHotelIds,
} from "../src/features/favorites/model.ts";

const lists = [
  {
    id: "custom",
    name: "Biển",
    isDefault: false,
    itemCount: 1,
    createdAt: "",
    updatedAt: "",
    items: [
      {
        id: "1",
        hotelId: "hidden",
        hotelName: "Ẩn",
        available: false,
        createdAt: "",
      },
    ],
  },
  {
    id: "default",
    name: "Yêu thích",
    isDefault: true,
    itemCount: 2,
    createdAt: "",
    updatedAt: "",
    items: [
      {
        id: "2",
        hotelId: "hotel-1",
        hotelName: "Một",
        available: true,
        createdAt: "",
      },
      {
        id: "3",
        hotelId: "hotel-2",
        hotelName: "Hai",
        available: false,
        createdAt: "",
      },
    ],
  },
];

test("selects the server-defined default wishlist", () => {
  assert.equal(defaultWishlist(lists)?.id, "default");
});

test("only exposes currently public saved hotels", () => {
  assert.deepEqual([...wishlistHotelIds(defaultWishlist(lists))], ["hotel-1"]);
});

test("allows hotel owners to use wishlist in traveler mode without relogin", () => {
  assert.equal(canUseWishlist("USER"), true);
  assert.equal(canUseWishlist("HOTEL_OWNER"), true);
  assert.equal(canUseWishlist("ADMIN"), false);
});

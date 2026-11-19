export type WishlistItem = {
  id: string;
  hotelId: string;
  hotelName: string;
  available: boolean;
  createdAt: string;
};

export type Wishlist = {
  id: string;
  name: string;
  isDefault: boolean;
  itemCount: number;
  items: WishlistItem[];
  createdAt: string;
  updatedAt: string;
};

export const defaultWishlist = (wishlists: Wishlist[] | undefined) =>
  wishlists?.find((wishlist) => wishlist.isDefault);

export const wishlistHotelIds = (wishlist: Wishlist | undefined) =>
  new Set(
    wishlist?.items
      .filter((item) => item.available)
      .map((item) => item.hotelId) ?? [],
  );

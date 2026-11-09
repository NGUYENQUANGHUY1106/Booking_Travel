export type RoomGalleryImage = {
  id: string;
  url: string;
  sortOrder: number;
  isCover: boolean;
};

export type BedConfiguration = { bedType: string; quantity: number };

export type PublicRoom = {
  id: string;
  hotelId: string;
  name: string;
  type: string;
  description: string | null;
  classCode: string | null;
  classLabel: string | null;
  viewCode: string | null;
  viewLabel: string | null;
  bedConfigurations: BedConfiguration[] | null;
  bedInfo: string;
  areaM2: string | null;
  capacityAdults: number;
  capacityChildren: number;
  quantity: number;
  basePrice: string;
  currency: string;
  status: "ACTIVE";
  amenities: string[];
  amenityDetails: { id: string; name: string }[];
  gallery: RoomGalleryImage[];
};

export type PublicRoomDetail = PublicRoom & {
  hotel: {
    id: string;
    name: string;
    addressLine: string | null;
    city: string | null;
    province: string | null;
    district: string | null;
    ward: string | null;
    checkInTime: string | null;
    checkOutTime: string | null;
    coverImageUrl: string | null;
    starRating: number;
    policy: {
      cancellationPolicy: string | null;
      houseRules: string | null;
    } | null;
  };
};

export type RoomSort = "priceAsc" | "priceDesc" | "capacityDesc";
export type RoomFilters = {
  sort: RoomSort;
  classes: string[];
  views: string[];
  beds: string[];
  amenities: string[];
};

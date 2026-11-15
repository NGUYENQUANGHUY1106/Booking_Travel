import { Pressable, ScrollView, View } from "react-native";

import type { HotelMapBounds } from "./hotel-map";
import type { HotelMapMarker } from "./public-hotels";
import { T } from "./ui";

export function PublicHotelMap({
  hotels,
  selectedId,
  onSelect,
}: {
  hotels: HotelMapMarker[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBoundsChange: (bounds: HotelMapBounds) => void;
}) {
  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 12 }}>
      <T style={{ textAlign: "center" }}>
        Bản đồ kéo/thu phóng khả dụng trên Expo iOS/Android. Trên web bạn vẫn có
        thể chọn các điểm đã tìm thấy.
      </T>
      <ScrollView contentContainerStyle={{ gap: 8 }}>
        {hotels.map((hotel) => (
          <Pressable
            key={hotel.id}
            onPress={() => onSelect(hotel.id)}
            style={{
              backgroundColor: hotel.id === selectedId ? "#DBEAFE" : "#FFFFFF",
              borderRadius: 12,
              padding: 12,
            }}
          >
            <T weight="semibold">{hotel.name}</T>
            {hotel.minPricePerNight ? (
              <T style={{ fontSize: 12 }}>
                Từ {Number(hotel.minPricePerNight).toLocaleString("vi-VN")}{" "}
                {hotel.currency ?? "VND"}
              </T>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

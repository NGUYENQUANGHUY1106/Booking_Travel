import { Image, Pressable, StyleSheet, View } from "react-native";

import { publicMediaUrl, usePublicRoomPricing, type PublicHotelRoom } from "../public-hotels";
import { useTravelerStore } from '../store';
import { colors } from "../theme";
import { T } from "../ui";

function money(value: string, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function HotelRoomList({
  rooms,
  selectedId,
  onSelect,
  onDetail,
}: {
  rooms: PublicHotelRoom[];
  selectedId?: string;
  onSelect: (room: PublicHotelRoom) => void;
  onDetail?: (room: PublicHotelRoom) => void;
}) {
  if (!rooms.length)
    return (
      <View style={styles.empty}>
        <T weight="semibold">Chưa có phòng đang mở bán</T>
        <T style={styles.muted}>Khách sạn chưa công bố hạng phòng khả dụng.</T>
      </View>
    );
  return (
    <View style={styles.list}>
      {rooms.map((room) => {
        const image = [...room.gallery].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        )[0];
        const selected = selectedId === room.id;
        return (
          <View
            key={room.id}
            style={[styles.card, selected && styles.selected]}
          >
            {image ? (
              <Image
                resizeMode="cover"
                source={{ uri: publicMediaUrl(image.url) }}
                style={styles.image}
              />
            ) : (
              <View style={[styles.image, styles.imageEmpty]}>
                <T style={styles.muted}>Phòng chưa có ảnh</T>
              </View>
            )}
            <View style={styles.content}>
              <T weight="semibold" style={styles.name}>
                {room.name}
              </T>
              <T style={styles.muted}>
                {room.bedInfo} · Tối đa {room.capacityAdults} người lớn
                {room.capacityChildren
                  ? `, ${room.capacityChildren} trẻ em`
                  : ""}
              </T>
              {room.areaM2 ? (
                <T style={styles.muted}>Diện tích {Number(room.areaM2)} m²</T>
              ) : null}
              {room.amenities.length ? (
                <T numberOfLines={2} style={styles.amenities}>
                  {room.amenities.join(" · ")}
                </T>
              ) : null}
              <View style={styles.footer}>
                <View>
                  <T weight="bold" style={styles.price}>
                    <RoomRate room={room} />
                  </T>
                  <T style={styles.stock}>
                    Còn {room.quantity} phòng trong hạng này
                  </T>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onSelect(room)}
                  style={[styles.button, selected && styles.buttonSelected]}
                >
                  <T weight="semibold" style={styles.buttonText}>
                    {selected ? "Đã chọn" : "Chọn phòng"}
                  </T>
                </Pressable>
              </View>
              {onDetail ? (
                <Pressable onPress={() => onDetail(room)} style={styles.detailButton}>
                  <T weight="semibold" style={styles.detailText}>Xem chi tiết phòng</T>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function RoomRate({ room }: { room: PublicHotelRoom }) {
  const checkIn = useTravelerStore((state) => state.checkIn);
  const checkOut = useTravelerStore((state) => state.checkOut);
  const pricing = usePublicRoomPricing(room.id, checkIn, checkOut);
  return <>{money(pricing.data?.minPricePerNight ?? room.basePrice, room.currency)} / đêm{pricing.data ? ' · trong kỳ đã chọn' : ' · giá chuẩn tham khảo'}</>;
}

const styles = StyleSheet.create({
  list: { gap: 14 },
  card: {
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  selected: { borderWidth: 2, borderColor: colors.primary },
  image: { width: "100%", height: 168 },
  imageEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2F7",
  },
  content: { padding: 14, gap: 6 },
  name: { fontSize: 17 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  amenities: { color: colors.green, fontSize: 12 },
  footer: {
    marginTop: 4,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  price: { color: colors.primaryDark, fontSize: 16 },
  stock: { color: colors.orange, fontSize: 11, marginTop: 3 },
  button: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  buttonSelected: { backgroundColor: colors.green },
  buttonText: { color: colors.white, fontSize: 13 },
  detailButton: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  detailText: { color: colors.primary, fontSize: 13 },
  empty: { padding: 20, gap: 6, borderRadius: 14, backgroundColor: "#F1F5F9" },
});

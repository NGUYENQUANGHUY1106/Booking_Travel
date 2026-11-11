import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { publicHotelPrice } from "./hotel-discovery";
import { publicMediaUrl, type PublicHotel } from "./public-hotels";
import { useTravelerStore } from "./store";
import { colors } from "./theme";
import { T, go } from "./ui";

function formatPrice(hotel: PublicHotel, selectedDates: boolean) {
  const price = publicHotelPrice(hotel);
  if (price === undefined) return "Chưa có giá phòng";
  return `${selectedDates ? 'Từ' : 'Giá chuẩn từ'} ${new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: hotel.currency || "VND",
    maximumFractionDigits: 0,
  }).format(price)} / đêm`;
}

export function PublicHotelCard({
  hotel,
  compact = false,
}: {
  hotel: PublicHotel;
  compact?: boolean;
}) {
  const favorites = useTravelerStore((state) => state.favorites);
  const selectHotel = useTravelerStore((state) => state.selectHotel);
  const toggleFavorite = useTravelerStore((state) => state.toggleFavorite);
  const checkIn = useTravelerStore((state) => state.checkIn);
  const checkOut = useTravelerStore((state) => state.checkOut);
  const [imageFailed, setImageFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const favorite = favorites.includes(hotel.id);
  const address = [hotel.addressLine, hotel.city, hotel.province]
    .filter(Boolean)
    .join(", ");

  const open = () => {
    if (opening) return;
    setOpening(true);
    selectHotel(hotel.id);
    go("hotel-detail", { hotelId: hotel.id });
    setTimeout(() => setOpening(false), 700);
  };

  return (
    <View style={[styles.card, compact && styles.cardCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Xem ${hotel.name}`}
        disabled={opening}
        onPress={open}
        style={({ pressed }) => [pressed && styles.pressed]}
      >
        {hotel.coverImageUrl && !imageFailed ? (
          <Image
            accessibilityLabel={`Ảnh ${hotel.name}`}
            onError={() => setImageFailed(true)}
            resizeMode="cover"
            source={{ uri: publicMediaUrl(hotel.coverImageUrl) }}
            style={[styles.image, compact && styles.imageCompact]}
          />
        ) : (
          <View
            style={[
              styles.image,
              compact && styles.imageCompact,
              styles.imagePlaceholder,
            ]}
          >
            <T weight="semibold" style={styles.placeholderText}>
              Khách sạn chưa có ảnh công khai
            </T>
          </View>
        )}
        <View style={styles.content}>
          <T numberOfLines={2} weight="semibold" style={styles.name}>
            {hotel.name}
          </T>
          <T numberOfLines={2} style={styles.address}>
            {address || "Chưa cập nhật địa chỉ"}
          </T>
          <View style={styles.metaRow}>
            <T weight="semibold" style={styles.star}>
              {hotel.starRating > 0
                ? `★ ${hotel.starRating} sao`
                : "Chưa xếp hạng sao"}
            </T>
            <T style={styles.meta}>·</T>
            <T style={styles.meta}>
              {hotel.roomCount > 0
                ? `${hotel.roomCount} hạng phòng đang mở`
                : "Chưa có phòng khả dụng"}
            </T>
          </View>
          <T style={styles.review}>Chưa có dữ liệu đánh giá từ khách</T>
          <T weight="bold" style={styles.price}>
            {formatPrice(hotel, Boolean(checkIn && checkOut && checkOut > checkIn))}
          </T>
          {hotel.amenities.length ? (
            <T numberOfLines={1} style={styles.amenities}>
              {hotel.amenities
                .slice(0, 3)
                .map((amenity) => amenity.name)
                .join(" · ")}
            </T>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={
          favorite ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"
        }
        accessibilityRole="button"
        onPress={() => toggleFavorite(hotel.id)}
        style={({ pressed }) => [styles.favorite, pressed && styles.pressed]}
      >
        <T weight="bold" style={[styles.heart, favorite && styles.heartActive]}>
          {favorite ? "♥" : "♡"}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 2,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  cardCompact: { width: 286 },
  image: { width: "100%", height: 190 },
  imageCompact: { height: 168 },
  imagePlaceholder: {
    backgroundColor: "#E8EFF8",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  placeholderText: { color: colors.muted, textAlign: "center" },
  content: { padding: 14, gap: 6 },
  name: { color: "#1E293B", fontSize: 18, lineHeight: 24 },
  address: { color: "#64748B", fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  star: { color: "#B45309", fontSize: 13 },
  meta: { color: "#64748B", fontSize: 13 },
  review: { color: "#64748B", fontSize: 12 },
  price: { color: "#2563EB", fontSize: 17, lineHeight: 23 },
  amenities: { color: "#047857", fontSize: 12 },
  favorite: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.94)",
  },
  heart: { color: "#334155", fontSize: 24, lineHeight: 28 },
  heartActive: { color: "#EF4444" },
  pressed: { opacity: 0.72 },
});

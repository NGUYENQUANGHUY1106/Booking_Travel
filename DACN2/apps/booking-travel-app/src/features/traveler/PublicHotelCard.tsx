import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { useFavoriteHotel } from "@/features/favorites";
import { publicHotelPrice } from "./hotel-discovery";
import { publicMediaUrl, type PublicHotel } from "./public-hotels";
import { useTravelerStore } from "./store";
import { confirmedSearchStay } from "./stay-context";
import { formatDistance } from "./nearby-search";
import { colors } from "./theme";
import { T, go } from "./ui";

function formatPrice(hotel: PublicHotel, selectedDates: boolean) {
  const stayPrice = hotel.stayPriceFrom ? Number(hotel.stayPriceFrom) : null;
  const price =
    stayPrice !== null && Number.isFinite(stayPrice)
      ? stayPrice
      : publicHotelPrice(hotel);
  if (price === undefined) return "Chưa có giá phòng";
  const formatted = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: hotel.currency || "VND",
    maximumFractionDigits: 0,
  }).format(price);
  return hotel.stayPriceFrom && hotel.stayNights
    ? `Từ ${formatted} / ${hotel.stayNights} đêm`
    : `${selectedDates ? "Từ" : "Giá chuẩn từ"} ${formatted} / đêm`;
}

export function PublicHotelCard({
  hotel,
  compact = false,
  fromSearch = false,
}: {
  hotel: PublicHotel;
  compact?: boolean;
  fromSearch?: boolean;
}) {
  const selectHotel = useTravelerStore((state) => state.selectHotel);
  const checkIn = useTravelerStore((state) => state.checkIn);
  const checkOut = useTravelerStore((state) => state.checkOut);
  const staySelection = useTravelerStore((state) => state.staySelection);
  const [imageFailed, setImageFailed] = useState(false);
  const [opening, setOpening] = useState(false);
  const favorite = useFavoriteHotel(hotel.id);
  const address = [hotel.addressLine, hotel.city, hotel.province]
    .filter(Boolean)
    .join(", ");
  const distance = formatDistance(hotel.distanceMeters);

  const open = () => {
    if (opening) return;
    setOpening(true);
    selectHotel(hotel.id, fromSearch);
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
          {distance ? (
            <T weight="semibold" style={styles.distance}>
              Cách điểm tìm kiếm {distance}
            </T>
          ) : null}
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
          <T style={styles.review}>
            {hotel.reviewScore === null
              ? "Chưa có dữ liệu đánh giá từ khách"
              : `${hotel.reviewScore}/10 · ${new Intl.NumberFormat("vi-VN").format(hotel.reviewCount)} đánh giá`}
          </T>
          <T weight="bold" style={styles.price}>
            {formatPrice(
              hotel,
              fromSearch &&
                confirmedSearchStay(staySelection, checkIn, checkOut),
            )}
          </T>
          {hotel.amenities.length ? (
            <T numberOfLines={1} style={styles.amenities}>
              {hotel.amenities
                .slice(0, 3)
                .map((amenity) => amenity.name)
                .join(" · ")}
            </T>
          ) : null}
          {hotel.freeCancellation ? (
            <T style={styles.freeCancellation}>Hủy miễn phí</T>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel={
          favorite.saved ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"
        }
        accessibilityRole="button"
        accessibilityState={{ disabled: favorite.pending || favorite.loading }}
        disabled={favorite.pending || favorite.loading}
        onPress={() => {
          if (!favorite.authenticated) router.push("/auth/login");
          else favorite.toggle();
        }}
        style={({ pressed }) => [styles.favorite, pressed && styles.pressed]}
      >
        <T
          weight="bold"
          style={[styles.heart, favorite.saved && styles.heartActive]}
        >
          {favorite.saved ? "♥" : "♡"}
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
  distance: { color: "#0369A1", fontSize: 13 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  star: { color: "#B45309", fontSize: 13 },
  meta: { color: "#64748B", fontSize: 13 },
  review: { color: "#64748B", fontSize: 12 },
  freeCancellation: { color: "#047857", fontSize: 12 },
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

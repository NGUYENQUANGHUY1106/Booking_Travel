import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePublicHotel, type PublicHotelRoom } from "../public-hotels";
import { useTravelerStore } from "../store";
import { colors } from "../theme";
import { EmptyState, SectionTitle, T, go } from "../ui";
import { BookingBottomBar } from "./BookingBottomBar";
import { HotelImageGallery } from "./HotelImageGallery";
import { HotelLocationSection } from "./HotelLocationSection";
import { HotelRoomList } from "./HotelRoomList";

export function HotelDetailScreen({ hotelId }: { hotelId: string }) {
  const query = usePublicHotel(hotelId);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [roomSectionY, setRoomSectionY] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<PublicHotelRoom>();
  const favorites = useTravelerStore((state) => state.favorites);
  const toggleFavorite = useTravelerStore((state) => state.toggleFavorite);
  const selectHotel = useTravelerStore((state) => state.selectHotel);
  const selectRoom = useTravelerStore((state) => state.selectRoom);
  const hotel = query.data;

  const chooseRoom = (room: PublicHotelRoom) => {
    setSelectedRoom(room);
    selectHotel(hotelId);
    selectRoom(room.name, room.id, Number(room.basePrice));
  };
  const continueBooking = () => {
    if (!hotel?.rooms.length) return;
    if (!selectedRoom) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, roomSectionY - 20),
        animated: true,
      });
      return;
    }
    go("booking-review", { hotelId, roomId: selectedRoom.id });
  };

  if (query.isPending) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <T style={styles.muted}>Đang tải dữ liệu khách sạn...</T>
      </SafeAreaView>
    );
  }
  if (query.isError || !hotel) {
    return (
      <SafeAreaView style={styles.center}>
        <EmptyState
          action="Thử lại"
          detail="Khách sạn không tồn tại, đã ngừng công khai hoặc kết nối máy chủ đang gián đoạn."
          onPress={() => void query.refetch()}
          title="Không tải được khách sạn"
        />
        <Pressable onPress={() => router.back()}>
          <T weight="semibold" style={styles.link}>
            Quay lại
          </T>
        </Pressable>
      </SafeAreaView>
    );
  }

  const gallery = hotel.gallery ?? [];
  const address = [
    hotel.addressLine,
    hotel.ward,
    hotel.district,
    hotel.city,
    hotel.province,
  ]
    .filter(Boolean)
    .join(", ");
  const visibleAmenities = amenitiesExpanded
    ? hotel.amenities
    : hotel.amenities.slice(0, 6);
  const favorite = favorites.includes(hotel.id);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <HotelImageGallery images={gallery} />
          <View style={styles.header}>
            <Pressable
              accessibilityLabel="Quay lại"
              onPress={() => router.back()}
              style={styles.circle}
            >
              <T weight="bold" style={styles.circleText}>
                ‹
              </T>
            </Pressable>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Chia sẻ khách sạn"
                onPress={() =>
                  void Share.share({
                    message: `${hotel.name}${address ? ` · ${address}` : ""}`,
                  })
                }
                style={styles.circle}
              >
                <T style={styles.circleText}>↗</T>
              </Pressable>
              <Pressable
                accessibilityLabel={
                  favorite ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"
                }
                onPress={() => toggleFavorite(hotel.id)}
                style={styles.circle}
              >
                <T style={[styles.heart, favorite && styles.heartActive]}>
                  {favorite ? "♥" : "♡"}
                </T>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <T weight="bold" style={styles.title}>
              {hotel.name}
            </T>
            <T style={styles.muted}>{address || "Chưa cập nhật địa chỉ"}</T>
            <View style={styles.inline}>
              <T weight="semibold" style={styles.star}>
                {hotel.starRating > 0
                  ? `★ ${hotel.starRating} sao`
                  : "Chưa xếp hạng sao"}
              </T>
              <T style={styles.muted}>· Chưa có dữ liệu đánh giá từ khách</T>
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle title="Giới thiệu" />
            <T
              numberOfLines={descriptionExpanded ? undefined : 4}
              style={styles.body}
            >
              {hotel.description ||
                "Khách sạn chưa cập nhật nội dung giới thiệu."}
            </T>
            {hotel.description && hotel.description.length > 180 ? (
              <Pressable
                onPress={() => setDescriptionExpanded((value) => !value)}
              >
                <T weight="semibold" style={styles.link}>
                  {descriptionExpanded ? "Thu gọn" : "Xem thêm"}
                </T>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionTitle
              title="Tiện nghi"
              action={
                hotel.amenities.length > 6
                  ? amenitiesExpanded
                    ? "Thu gọn"
                    : "Xem tất cả"
                  : undefined
              }
              onPress={() => setAmenitiesExpanded((value) => !value)}
            />
            {visibleAmenities.length ? (
              <View style={styles.amenityGrid}>
                {visibleAmenities.map((amenity) => (
                  <View key={amenity.id} style={styles.amenity}>
                    <View style={styles.amenityIcon}>
                      <T weight="bold" style={styles.amenityIconText}>
                        ✓
                      </T>
                    </View>
                    <T style={styles.amenityText}>{amenity.name}</T>
                  </View>
                ))}
              </View>
            ) : (
              <T style={styles.muted}>Khách sạn chưa công bố tiện nghi.</T>
            )}
          </View>

          <View
            onLayout={(event) => setRoomSectionY(event.nativeEvent.layout.y)}
            style={styles.section}
          >
            <SectionTitle title="Loại phòng đang mở bán" />
            <HotelRoomList
              onSelect={chooseRoom}
              rooms={hotel.rooms}
              selectedId={selectedRoom?.id}
            />
          </View>

          <View style={styles.section}>
            <SectionTitle title="Vị trí" />
            <HotelLocationSection hotel={hotel} />
          </View>

          <View style={styles.section}>
            <SectionTitle title="Đánh giá của khách" />
            <View style={styles.notice}>
              <T weight="semibold">Chưa có đánh giá đã xác minh</T>
              <T style={styles.muted}>
                Hệ thống hiện chưa có dữ liệu đánh giá thực tế cho khách sạn
                này.
              </T>
            </View>
          </View>

          <View style={styles.section}>
            <SectionTitle title="Chính sách lưu trú" />
            <PolicyRow
              label="Nhận phòng"
              value={hotel.checkInTime ? `Từ ${hotel.checkInTime}` : null}
            />
            <PolicyRow
              label="Trả phòng"
              value={hotel.checkOutTime ? `Trước ${hotel.checkOutTime}` : null}
            />
            <PolicyRow
              label="Hủy phòng"
              value={hotel.policy?.cancellationPolicy ?? null}
            />
            <PolicyRow
              label="Quy định khác"
              value={hotel.policy?.houseRules ?? null}
            />
          </View>
        </View>
      </ScrollView>
      <BookingBottomBar
        currency={selectedRoom?.currency ?? hotel.currency}
        disabled={!hotel.rooms.length}
        onPress={continueBooking}
        price={selectedRoom?.basePrice ?? hotel.minPricePerNight}
        roomSelected={Boolean(selectedRoom)}
      />
    </SafeAreaView>
  );
}

function PolicyRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.policyRow}>
      <T weight="semibold" style={styles.policyLabel}>
        {label}
      </T>
      <T style={styles.policyValue}>{value || "Chưa có thông tin"}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  center: {
    flex: 1,
    gap: 16,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  scroll: { paddingBottom: 28 },
  header: {
    position: "absolute",
    left: 14,
    right: 14,
    top: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerActions: { flexDirection: "row", gap: 10 },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  circleText: { color: "#0F172A", fontSize: 24 },
  heart: { color: "#334155", fontSize: 26 },
  heartActive: { color: "#EF4444" },
  content: { padding: 16, gap: 22 },
  section: { gap: 10 },
  title: { color: colors.navy, fontSize: 24, lineHeight: 31 },
  muted: { color: colors.muted, lineHeight: 20 },
  body: { color: colors.gray, lineHeight: 22 },
  inline: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
  },
  star: { color: "#B45309" },
  link: { color: colors.primary },
  amenityGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amenity: {
    width: "48%",
    minHeight: 48,
    padding: 9,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  amenityIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
  },
  amenityIconText: { color: colors.primary },
  amenityText: { flex: 1, fontSize: 13 },
  notice: { padding: 16, gap: 5, borderRadius: 14, backgroundColor: "#F8FAFC" },
  policyRow: {
    paddingVertical: 10,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  policyLabel: { fontSize: 13 },
  policyValue: { color: colors.muted, lineHeight: 19 },
});

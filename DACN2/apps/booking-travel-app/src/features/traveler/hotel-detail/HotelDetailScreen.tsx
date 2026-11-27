import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  Share,
  StyleSheet,
  View,
  type ScrollViewInstance,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { StartConversationButton } from "@/features/chat";
import { useFavoriteHotel } from "@/features/favorites";
import { dateLabel, nights } from "../data";
import { usePublicHotel } from "../public-hotels";
import { usePublicRooms } from "../rooms/api";
import type { PublicRoom } from "../rooms/types";
import { useTravelerStore } from "../store";
import { confirmedStayForHotel } from "../stay-context";
import { colors } from "../theme";
import { EmptyState, SectionTitle, T, go, goBack } from "../ui";
import { BookingBottomBar } from "./BookingBottomBar";
import { HotelImageGallery } from "./HotelImageGallery";
import { HotelLocationSection } from "./HotelLocationSection";
import { HotelRoomList } from "./HotelRoomList";
import { NearbyPlacesPreview } from "./NearbyPlacesPreview";

function ReviewReportAction({
  reviewId,
  target,
}: {
  reviewId: string;
  target: "REVIEW" | "REPLY";
}) {
  const session = useTravelerStore((state) => state.session);
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");
  const [category, setCategory] = useState<
    "SPAM" | "OFFENSIVE" | "FALSE_INFORMATION" | "PRIVACY" | "OTHER"
  >("OTHER");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const submit = async () => {
    if (pending) return;
    if (session?.mode !== "api") {
      setMessage("Vui lòng đăng nhập để báo cáo.");
      return;
    }
    if (reason.trim().length < 10) {
      setMessage("Vui lòng mô tả ít nhất 10 ký tự.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      if (target === "REVIEW")
        await apiClient.post(`/reviews/${reviewId}/report`, {
          reason: category,
          description: reason.trim(),
        });
      else
        await apiClient.post(`/reviews/${reviewId}/reply/report`, {
          reason: reason.trim(),
          category,
        });
      setMessage("Đã gửi báo cáo đến Admin.");
      setExpanded(false);
      setReason("");
    } catch (error) {
      const data = (error as { response?: { data?: { message?: string } } })
        ?.response?.data;
      setMessage(data?.message ?? "Không gửi được báo cáo. Vui lòng thử lại.");
    } finally {
      setPending(false);
    }
  };
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <T style={{ color: colors.primary }}>
          Báo cáo {target === "REVIEW" ? "đánh giá" : "phản hồi"}
        </T>
      </Pressable>
      {expanded ? (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(
              [
                ["SPAM", "Spam"],
                ["OFFENSIVE", "Xúc phạm"],
                ["FALSE_INFORMATION", "Thông tin sai"],
                ["PRIVACY", "Riêng tư"],
                ["OTHER", "Khác"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setCategory(value)}
                style={{
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  backgroundColor: category === value ? "#DBEAFE" : "#F1F5F9",
                }}
              >
                <T
                  style={{
                    color: category === value ? colors.primary : colors.muted,
                  }}
                >
                  {label}
                </T>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Lý do báo cáo"
            placeholder="Nêu lý do báo cáo"
            value={reason}
            onChangeText={setReason}
            maxLength={500}
            multiline
            style={{ backgroundColor: "#fff", padding: 10, minHeight: 60 }}
          />
          <Pressable disabled={pending} onPress={() => void submit()}>
            <T style={{ color: colors.primary }}>
              {pending ? "Đang gửi..." : "Gửi báo cáo"}
            </T>
          </Pressable>
        </>
      ) : null}
      {message ? <T>{message}</T> : null}
    </View>
  );
}

export function HotelDetailScreen({ hotelId }: { hotelId: string }) {
  const hotelReviews = useQuery({
    queryKey: ["public-hotel-reviews", hotelId],
    queryFn: async () =>
      (
        await apiClient.get<
          {
            id: string;
            title: string | null;
            content: string;
            rating: number;
            author: { fullName: string };
            reply: { content: string; createdAt: string } | null;
          }[]
        >(`/reviews/hotel/${hotelId}`)
      ).data,
    enabled: !!hotelId,
  });
  const query = usePublicHotel(hotelId);
  const favorite = useFavoriteHotel(hotelId);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [roomSectionY, setRoomSectionY] = useState(0);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [amenitiesExpanded, setAmenitiesExpanded] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<string>();
  const [selectedRate, setSelectedRate] = useState<string>();
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const checkIn = useTravelerStore((state) => state.checkIn);
  const checkOut = useTravelerStore((state) => state.checkOut);
  const staySelection = useTravelerStore((state) => state.staySelection);
  const activeHotelId = useTravelerStore((state) => state.selectedHotelId);
  const rooms = useTravelerStore((state) => state.rooms);
  const adults = useTravelerStore((state) => state.adults);
  const children = useTravelerStore((state) => state.children);
  const validStay = confirmedStayForHotel(
    staySelection,
    checkIn,
    checkOut,
    activeHotelId,
    hotelId,
  );
  const roomsQuery = usePublicRooms(
    hotelId,
    validStay ? checkIn : "",
    validStay ? checkOut : "",
    rooms,
    adults,
    children,
  );
  const selectedRoom = roomsQuery.data?.find(
    (room) => room.id === selectedRoomId && room.availability?.canBook,
  );
  const selectHotel = useTravelerStore((state) => state.selectHotel);
  const selectRoom = useTravelerStore((state) => state.selectRoom);
  const hotel = query.data;

  const chooseRoom = (room: PublicRoom) => {
    if (!validStay) {
      selectHotel(hotelId);
      selectRoom(room.name, room.id);
      go("dates", { hotelId, roomId: room.id });
      return;
    }
    if (!room.availability?.canBook) return;
    setSelectedRoomId(room.id);
    setSelectedRate(room.availability.rateSummary.totalRoomAmount);
    setAvailabilityMessage("");
    selectHotel(hotelId);
    selectRoom(
      room.name,
      room.id,
      Number(room.availability.rateSummary.minPricePerNight),
    );
  };
  const continueBooking = async () => {
    if (!validStay) {
      go("dates", { hotelId });
      return;
    }
    if (!roomsQuery.data?.some((room) => room.availability?.canBook)) return;
    if (!selectedRoom) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, roomSectionY - 20),
        animated: true,
      });
      return;
    }
    const fresh = await roomsQuery.refetch();
    if (fresh.isError || !fresh.data) {
      setAvailabilityMessage(
        "Không kiểm tra lại được phòng trống. Kiểm tra kết nối và thử lại.",
      );
      return;
    }
    const latest = fresh.data.find((room) => room.id === selectedRoom.id);
    if (!latest?.availability?.canBook) {
      setAvailabilityMessage(
        "Phòng vừa hết hoặc không đủ cho kỳ này. Vui lòng chọn phòng hoặc ngày khác.",
      );
      return;
    }
    if (latest.availability.rateSummary.totalRoomAmount !== selectedRate) {
      setSelectedRate(latest.availability.rateSummary.totalRoomAmount);
      selectRoom(
        latest.name,
        latest.id,
        Number(latest.availability.rateSummary.minPricePerNight),
      );
      setAvailabilityMessage(
        "Giá phòng vừa thay đổi. Hãy kiểm tra giá mới rồi bấm tiếp tục lần nữa.",
      );
      return;
    }
    setAvailabilityMessage("");
    selectRoom(
      latest.name,
      latest.id,
      Number(latest.availability.rateSummary.minPricePerNight),
    );
    go("booking-review", { hotelId, roomId: latest.id });
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
        <Pressable onPress={goBack}>
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
              onPress={goBack}
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
                  favorite.saved ? "Bỏ khỏi yêu thích" : "Thêm vào yêu thích"
                }
                disabled={favorite.pending || favorite.loading}
                onPress={() => {
                  if (!favorite.authenticated) router.push("/auth/login");
                  else favorite.toggle();
                }}
                style={styles.circle}
              >
                <T style={[styles.heart, favorite.saved && styles.heartActive]}>
                  {favorite.saved ? "♥" : "♡"}
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
            <Pressable
              accessibilityRole="button"
              onPress={() => go("dates", { hotelId })}
              style={styles.staySummary}
            >
              <T weight="semibold">
                {validStay
                  ? `${dateLabel(checkIn)} – ${dateLabel(checkOut)} · ${nights(checkIn, checkOut)} đêm`
                  : "Chọn ngày lưu trú"}
              </T>
              <T style={styles.link}>
                {validStay
                  ? "Sửa ngày nhận và trả phòng ›"
                  : "Chọn ngày để xem giá và phòng trống ›"}
              </T>
            </Pressable>
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
            <View style={styles.staySummary}>
              <T weight="semibold">
                {validStay
                  ? `${dateLabel(checkIn)} – ${dateLabel(checkOut)} · ${nights(checkIn, checkOut)} đêm`
                  : "Chưa chọn ngày lưu trú"}
              </T>
              <T style={styles.muted}>
                {adults} người lớn · {children} trẻ em · {rooms} phòng
              </T>
              <View style={styles.stayActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => go("dates", { hotelId })}
                >
                  <T style={styles.link}>
                    {validStay ? "Sửa ngày" : "Chọn ngày"}
                  </T>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => go("guests", { hotelId })}
                >
                  <T style={styles.link}>Sửa khách và phòng</T>
                </Pressable>
              </View>
            </View>
            <SectionTitle
              title={validStay ? "Phòng còn trống" : "Hạng phòng đang mở bán"}
              action="Xem tất cả"
              onPress={() => go("rooms", { hotelId })}
            />
            {validStay &&
            roomsQuery.data?.length &&
            !roomsQuery.data.some((room) => room.availability?.canBook) ? (
              <View style={styles.soldOutNotice}>
                <T>
                  Không còn hạng phòng phù hợp cho ngày và số khách đã chọn.
                </T>
                <Pressable onPress={() => go("dates", { hotelId })}>
                  <T style={styles.link}>Đổi ngày lưu trú</T>
                </Pressable>
              </View>
            ) : null}
            {roomsQuery.isPending ? (
              <ActivityIndicator color={colors.primary} />
            ) : roomsQuery.isError ? (
              <EmptyState
                title="Không tải được danh sách phòng"
                detail="Vui lòng thử lại hoặc chọn ngày lưu trú khác."
                action="Thử lại"
                onPress={() => void roomsQuery.refetch()}
              />
            ) : (
              <HotelRoomList
                hasStay={validStay}
                onDetail={(room) =>
                  go("room-detail", { hotelId, roomId: room.id })
                }
                onSelect={chooseRoom}
                rooms={roomsQuery.data ?? []}
                selectedId={selectedRoomId}
              />
            )}
            {availabilityMessage ? (
              <T accessibilityRole="alert" style={styles.availabilityError}>
                {availabilityMessage}
              </T>
            ) : null}
          </View>

          <View style={styles.section}>
            <SectionTitle title="Vị trí" />
            <HotelLocationSection hotel={hotel} />
            <StartConversationButton hotelId={hotel.id} />
            <Pressable onPress={() => go("report-hotel", { hotelId })}>
              <T style={styles.link}>Báo cáo khách sạn</T>
            </Pressable>
          </View>

          <NearbyPlacesPreview hotelId={hotel.id} />

          <View style={styles.section}>
            <SectionTitle title="Đánh giá của khách" />
            {hotelReviews.isPending ? <T>Đang tải đánh giá...</T> : null}
            {hotelReviews.isError ? (
              <Pressable onPress={() => void hotelReviews.refetch()}>
                <T>Không tải được đánh giá. Chạm để thử lại.</T>
              </Pressable>
            ) : null}
            {hotelReviews.data?.length === 0 ? (
              <View style={styles.notice}>
                <T>Chưa có đánh giá đã xác minh.</T>
              </View>
            ) : null}
            {hotelReviews.data?.map((review) => (
              <View key={review.id} style={styles.notice}>
                <T weight="semibold">
                  {review.title || `${review.rating}/10 điểm`}
                </T>
                <T style={styles.muted}>
                  {review.author.fullName} · {review.rating}/10
                </T>
                <T>{review.content}</T>
                <ReviewReportAction reviewId={review.id} target="REVIEW" />
                {review.reply ? (
                  <View
                    style={{
                      borderLeftWidth: 3,
                      borderColor: colors.primary,
                      paddingLeft: 12,
                      marginTop: 8,
                    }}
                  >
                    <T weight="semibold">Phản hồi từ khách sạn</T>
                    <T>{review.reply.content}</T>
                    <ReviewReportAction reviewId={review.id} target="REPLY" />
                  </View>
                ) : null}
              </View>
            ))}
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
        disabled={
          validStay &&
          (!roomsQuery.data?.some((room) => room.availability?.canBook) ||
            roomsQuery.isFetching)
        }
        needsDates={!validStay}
        onPress={() => void continueBooking()}
        price={
          validStay
            ? (selectedRoom?.availability?.rateSummary.minPricePerNight ??
              roomsQuery.data?.find((room) => room.availability?.canBook)
                ?.availability?.rateSummary.minPricePerNight ??
              null)
            : hotel.minPricePerNight
        }
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
  staySummary: {
    padding: 12,
    gap: 5,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
  },
  stayActions: { flexDirection: "row", gap: 20, marginTop: 4 },
  soldOutNotice: {
    padding: 12,
    gap: 6,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
  },
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
  availabilityError: {
    color: colors.error,
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 10,
  },
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

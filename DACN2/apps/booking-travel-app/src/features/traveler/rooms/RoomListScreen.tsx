import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { dateLabel, nights } from "../data";
import { publicMediaUrl, usePublicHotel } from "../public-hotels";
import { useTravelerStore } from "../store";
import { todayInVietnam } from '../stay-dates';
import { colors } from "../theme";
import { EmptyState, T, go } from "../ui";
import { usePublicRooms } from "./api";
import { applyRoomFilters, EMPTY_ROOM_FILTERS } from "./room-filter";
import { RoomCard } from "./RoomCard";
import { RoomFilter } from "./RoomFilter";
import type { PublicRoom, RoomFilters } from "./types";

export function RoomListScreen({ hotelId }: { hotelId?: string }) {
  const { checkIn, checkOut, adults, children, rooms, selectedRoomId, selectHotel, selectRoom } = useTravelerStore();
  const hotel = usePublicHotel(hotelId ?? "");
  const roomsQuery = usePublicRooms(hotelId, checkIn, checkOut, rooms, adults, children);
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<RoomFilters>(EMPTY_ROOM_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const [error, setError] = useState("");
  const today = todayInVietnam();
  const validStay = checkIn >= today && checkOut > checkIn && rooms >= 1;
  const filtered = useMemo(() => applyRoomFilters(roomsQuery.data ?? [], filters), [roomsQuery.data, filters]);
  const activeFilters = filters.classes.length + filters.views.length + filters.beds.length + filters.amenities.length;

  const select = (room: PublicRoom) => {
    if (!room.availability?.canBook) return;
    setError("");
    selectHotel(room.hotelId);
    selectRoom(room.name, room.id, Number(room.availability.rateSummary.minPricePerNight));
  };
  const chosen = filtered.find((room) => room.id === selectedRoomId && room.hotelId === hotelId);
  const continueBooking = async () => {
    if (!chosen?.availability?.canBook) return;
    const fresh = await roomsQuery.refetch();
    const latest = fresh.data?.find((room) => room.id === chosen.id);
    if (!latest?.availability?.canBook) {
      setError('Phòng vừa hết hoặc không đủ cho kỳ này. Vui lòng chọn lại ngày, khách hoặc phòng.');
      return;
    }
    if (latest.availability.rateSummary.totalRoomAmount !== chosen.availability.rateSummary.totalRoomAmount) {
      selectRoom(latest.name, latest.id, Number(latest.availability.rateSummary.minPricePerNight));
      setError('Giá phòng vừa thay đổi. Hãy kiểm tra giá mới rồi bấm Tiếp tục lần nữa.');
      return;
    }
    setError('');
    selectRoom(latest.name, latest.id, Number(latest.availability.rateSummary.minPricePerNight));
    go('booking-review', { hotelId: chosen.hotelId, roomId: chosen.id });
  };

  if (!hotelId)
    return <SafeAreaView style={styles.center}><EmptyState title="Thiếu mã khách sạn" detail="Không thể tải danh sách phòng khi đường dẫn không có hotelId." action="Quay lại" onPress={() => router.back()} /></SafeAreaView>;
  if (!validStay)
    return <SafeAreaView style={styles.center}><EmptyState title="Chọn lại ngày lưu trú" detail="Ngày nhận phòng phải từ hôm nay và ngày trả phòng phải sau ngày nhận phòng." action="Chọn ngày" onPress={() => go('dates', { hotelId })} /></SafeAreaView>;
  if (hotel.isPending || roomsQuery.isPending)
    return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><T style={styles.muted}>Đang tải các loại phòng...</T></SafeAreaView>;
  if (hotel.isError || roomsQuery.isError || !hotel.data)
    return <SafeAreaView style={styles.center}><EmptyState title="Không tải được phòng" detail="Khách sạn không tồn tại, chưa công khai hoặc kết nối máy chủ bị gián đoạn." action="Thử lại" onPress={() => { void hotel.refetch(); void roomsQuery.refetch(); }} /></SafeAreaView>;

  const cover = hotel.data.coverImageUrl ?? hotel.data.gallery?.[0]?.url;
  const address = [hotel.data.addressLine, hotel.data.city, hotel.data.province].filter(Boolean).join(", ");
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={styles.back}><T weight="bold" style={styles.backText}>‹</T></Pressable>
        <View style={styles.headerTitle}><T weight="bold" numberOfLines={1}>Chọn phòng</T><T numberOfLines={1} style={styles.headerHotel}>{hotel.data.name}</T></View>
        <Pressable onPress={() => setFilterVisible(true)} style={styles.filterButton}><T weight="semibold" style={styles.filterText}>Lọc{activeFilters ? ` (${activeFilters})` : ""}</T></Pressable>
      </View>
      <FlatList
        contentContainerStyle={styles.list}
        data={filtered}
        keyExtractor={(room) => room.id}
        ListHeaderComponent={<>
          <View style={styles.summary}>
            {cover ? <Image source={{ uri: publicMediaUrl(cover) }} style={styles.hotelImage} /> : <View style={[styles.hotelImage, styles.imageEmpty]} />}
            <View style={styles.summaryText}><T weight="bold" numberOfLines={2}>{hotel.data.name}</T><T numberOfLines={2} style={styles.muted}>{address || "Chưa cập nhật địa chỉ"}</T>{hotel.data.starRating ? <T style={styles.rating}>★ {hotel.data.starRating} sao</T> : null}</View>
          </View>
          <View style={styles.trip}><T weight="semibold">{dateLabel(checkIn)} – {dateLabel(checkOut)} · {nights(checkIn, checkOut)} đêm</T><T style={styles.muted}>{adults} người lớn · {children} trẻ em · {rooms} phòng</T><Pressable accessibilityRole="button" onPress={() => go('dates', { hotelId })}><T style={styles.filterText}>Sửa ngày lưu trú</T></Pressable><Pressable accessibilityRole="button" onPress={() => go('guests', { hotelId })}><T style={styles.filterText}>Sửa số khách và phòng</T></Pressable></View>
          {roomsQuery.data?.length && !roomsQuery.data.some((room) => room.availability?.canBook) ? <View style={styles.soldOutNotice}><T>Không có phòng phù hợp cho kỳ này.</T><Pressable onPress={() => go('dates', { hotelId })}><T style={styles.filterText}>Đổi ngày lưu trú</T></Pressable></View> : null}
          {error ? <T accessibilityRole="alert" style={styles.error}>{error}</T> : null}
          <View style={styles.resultRow}><T weight="semibold">Chọn phòng phù hợp · {filtered.length} hạng phòng</T>{activeFilters ? <Pressable onPress={() => setFilters(EMPTY_ROOM_FILTERS)}><T style={styles.filterText}>Xóa lọc</T></Pressable> : null}</View>
        </>}
        ListEmptyComponent={<EmptyState title="Không có phòng phù hợp" detail={roomsQuery.data?.length ? "Hãy xóa bớt bộ lọc để xem các loại phòng khác." : "Khách sạn chưa có loại phòng đang mở bán."} action={roomsQuery.data?.length ? "Xóa bộ lọc" : "Quay lại"} onPress={() => roomsQuery.data?.length ? setFilters(EMPTY_ROOM_FILTERS) : router.back()} />}
        renderItem={({ item }) => <RoomCard room={item} selected={selectedRoomId === item.id && item.availability?.canBook === true} onDetail={() => go("room-detail", { hotelId, roomId: item.id })} onSelect={() => select(item)} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}><Pressable accessibilityRole="button" disabled={!chosen?.availability?.canBook || roomsQuery.isFetching} onPress={() => void continueBooking()} style={[styles.continueButton, (!chosen?.availability?.canBook || roomsQuery.isFetching) && styles.disabled]}><T weight="semibold" style={styles.continueText}>{roomsQuery.isFetching ? 'Đang kiểm tra lại...' : 'Tiếp tục đặt phòng'}</T></Pressable></View>
      <RoomFilter filters={filters} onChange={setFilters} onClose={() => setFilterVisible(false)} rooms={roomsQuery.data ?? []} visible={filterVisible} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  center: { flex: 1, gap: 12, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  header: { minHeight: 62, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.white },
  back: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 21, backgroundColor: "#F1F5F9" },
  backText: { color: colors.navy, fontSize: 28 },
  headerTitle: { flex: 1 },
  headerHotel: { color: colors.muted, fontSize: 11 },
  filterButton: { minHeight: 40, justifyContent: "center", paddingHorizontal: 10 },
  filterText: { color: colors.primary, fontSize: 13 },
  list: { padding: 14, paddingBottom: 32 },
  summary: { padding: 12, flexDirection: "row", gap: 12, borderRadius: 16, backgroundColor: colors.white },
  hotelImage: { width: 92, height: 78, borderRadius: 12 },
  imageEmpty: { backgroundColor: "#E8EFF8" },
  summaryText: { flex: 1, gap: 4 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  rating: { color: "#B45309", fontSize: 12 },
  trip: { marginTop: 10, padding: 13, gap: 4, borderRadius: 14, backgroundColor: "#EFF6FF" },
  error: { marginTop: 10, padding: 12, color: colors.error, borderRadius: 12, backgroundColor: "#FEF2F2" },
  soldOutNotice: { marginTop: 10, padding: 12, gap: 6, borderRadius: 12, backgroundColor: '#FEF2F2' },
  resultRow: { paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  separator: { height: 14 },
  footer: { paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line },
  continueButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.primary },
  continueText: { color: colors.white },
  disabled: { opacity: 0.5 },
});

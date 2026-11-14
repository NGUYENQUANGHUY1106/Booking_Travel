import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { dateLabel, nights } from "../data";
import { HotelImageGallery } from "../hotel-detail/HotelImageGallery";
import { useTravelerStore } from "../store";
import { confirmedStayForHotel } from '../stay-context';
import { colors } from "../theme";
import { EmptyState, SectionTitle, T, go, goBack } from "../ui";
import { usePublicRoom } from "./api";
import { usePublicRoomAvailability } from '../public-hotels';

function money(value: number, currency: string) {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function Policy({ label, value }: { label: string; value?: string | null }) {
  return <View style={styles.policy}><T weight="semibold" style={styles.policyLabel}>{label}</T><T style={styles.muted}>{value || "Chưa cập nhật"}</T></View>;
}

export function RoomDetailScreen({ hotelId, roomId }: { hotelId?: string; roomId?: string }) {
  const query = usePublicRoom(roomId);
  const [expanded, setExpanded] = useState(false);
  const [allAmenities, setAllAmenities] = useState(false);
  const [error, setError] = useState("");
  const insets = useSafeAreaInsets();
  const { checkIn, checkOut, staySelection, selectedHotelId, adults, children, rooms, selectHotel, selectRoom } = useTravelerStore();
  const validStay = confirmedStayForHotel(staySelection, checkIn, checkOut, selectedHotelId, hotelId ?? '');
  const availability = usePublicRoomAvailability(roomId ?? '', validStay ? checkIn : '', validStay ? checkOut : '', rooms, adults, children);
  if (!hotelId || !roomId)
    return <SafeAreaView style={styles.center}><EmptyState title="Đường dẫn phòng không hợp lệ" detail="Cần có cả hotelId và roomId để xem chi tiết phòng." action="Quay lại" onPress={goBack} /></SafeAreaView>;
  if (query.isPending)
    return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><T style={styles.muted}>Đang tải chi tiết phòng...</T></SafeAreaView>;
  if (query.isError || !query.data || query.data.hotelId !== hotelId)
    return <SafeAreaView style={styles.center}><EmptyState title="Không tìm thấy phòng" detail="Phòng không tồn tại, không mở bán hoặc không thuộc khách sạn trong đường dẫn." action="Thử lại" onPress={() => void query.refetch()} /><Pressable onPress={goBack}><T style={styles.link}>Quay lại</T></Pressable></SafeAreaView>;
  const room = query.data;
  const stayNights = nights(checkIn, checkOut);
  const subtotal = availability.data?.rateSummary.totalRoomAmount;
  const amenityDetails = room.amenityDetails ?? [];
  const amenities = allAmenities ? amenityDetails : amenityDetails.slice(0, 6);
  const address = [room.hotel.addressLine, room.hotel.ward, room.hotel.district, room.hotel.city, room.hotel.province].filter(Boolean).join(", ");
  const select = async () => {
    if (!validStay) { go('dates', { hotelId: room.hotelId, roomId: room.id }); return; }
    const previous = availability.data;
    if (!previous?.canBook) {
      setError('Không đủ phòng hoặc sức chứa cho kỳ lưu trú đã chọn.');
      return;
    }
    const fresh = await availability.refetch();
    if (fresh.isError || !fresh.data) {
      setError('Không kiểm tra lại được phòng trống. Kiểm tra kết nối và thử lại.');
      return;
    }
    if (!fresh.data?.canBook) {
      setError('Phòng vừa hết hoặc không đủ cho kỳ này. Vui lòng chọn lại.');
      return;
    }
    if (fresh.data.rateSummary.totalRoomAmount !== previous.rateSummary.totalRoomAmount) {
      setError('Giá phòng vừa thay đổi. Hãy xem giá mới rồi chọn lại.');
      return;
    }
    setError("");
    selectHotel(room.hotelId);
    selectRoom(room.name, room.id, Number(fresh.data.rateSummary.minPricePerNight));
    go("booking-review", { hotelId: room.hotelId, roomId: room.id });
  };
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View>
          <HotelImageGallery images={room.gallery ?? []} emptyMessage="Phòng chưa có ảnh được xác minh" />
          <Pressable accessibilityLabel="Quay lại" onPress={goBack} style={styles.back}><T weight="bold" style={styles.backText}>‹</T></Pressable>
        </View>
        <View style={styles.content}>
          <View style={styles.section}><T weight="bold" style={styles.title}>{room.name}</T><T style={styles.muted}>{room.hotel.name}</T><T style={styles.muted}>{address || "Chưa cập nhật địa chỉ"}</T></View>
          <View style={styles.stayCard}>
            <T weight="semibold">Ngày lưu trú</T>
            <T>{validStay ? `${dateLabel(checkIn)} – ${dateLabel(checkOut)} · ${stayNights} đêm` : 'Chưa chọn ngày nhận và trả phòng'}</T>
            <T style={styles.muted}>{adults} người lớn · {children} trẻ em · {rooms} phòng</T>
            <Pressable accessibilityRole="button" onPress={() => go('dates', { hotelId: room.hotelId, roomId: room.id })}><T weight="semibold" style={styles.link}>Chọn hoặc đổi ngày ›</T></Pressable>
          </View>
          <View style={styles.factGrid}>
            {room.areaM2 ? <View style={styles.fact}><T weight="bold">{Number(room.areaM2)} m²</T><T style={styles.muted}>Diện tích</T></View> : null}
            <View style={styles.fact}><T weight="bold">{room.capacityAdults + room.capacityChildren} khách</T><T style={styles.muted}>Sức chứa tối đa</T></View>
            <View style={styles.fact}><T weight="bold">{room.bedInfo}</T><T style={styles.muted}>Cấu hình giường</T></View>
            {room.viewLabel ? <View style={styles.fact}><T weight="bold">{room.viewLabel}</T><T style={styles.muted}>Hướng nhìn</T></View> : null}
          </View>
          <View style={styles.section}><SectionTitle title="Thông tin phòng" /><T numberOfLines={expanded ? undefined : 4} style={styles.body}>{room.description || "Loại phòng này chưa cập nhật mô tả chi tiết."}</T>{room.description && room.description.length > 150 ? <Pressable onPress={() => setExpanded((value) => !value)}><T weight="semibold" style={styles.link}>{expanded ? "Thu gọn" : "Xem thêm"}</T></Pressable> : null}<T style={styles.muted}>Mã loại phòng: {room.type}</T><T style={styles.muted}>Tối đa {room.capacityAdults} người lớn · {room.capacityChildren} trẻ em</T>{!validStay ? <Pressable onPress={() => go('dates', { hotelId: room.hotelId, roomId: room.id })}><T style={styles.link}>Chọn ngày lưu trú hợp lệ</T></Pressable> : availability.isPending ? <ActivityIndicator color={colors.primary} /> : null}{availability.data ? <T style={availability.data.canBook ? styles.muted : styles.error}>{availability.data.availableQty === 0 ? 'Hết phòng trong kỳ đã chọn.' : `Còn ${availability.data.availableQty} phòng trong cả kỳ · cần ${rooms} phòng${availability.data.capacityFits ? '' : ' · số khách vượt sức chứa'}`}</T> : null}{availability.isError ? <Pressable onPress={() => void availability.refetch()}><T style={styles.error}>Không kiểm tra được phòng trống. Bấm để thử lại.</T></Pressable> : null}</View>
          <View style={styles.section}><SectionTitle title="Cấu hình giường" />{room.bedConfigurations?.length ? room.bedConfigurations.map((bed, index) => <View key={`${bed.bedType}-${index}`} style={styles.row}><T weight="semibold">✓</T><T>{bed.quantity} × {bed.bedType}</T></View>) : <T style={styles.muted}>{room.bedInfo || "Chưa cập nhật"}</T>}</View>
          <View style={styles.section}><SectionTitle title="Tiện nghi trong phòng" action={amenityDetails.length > 6 ? allAmenities ? "Thu gọn" : "Xem tất cả" : undefined} onPress={() => setAllAmenities((value) => !value)} />{amenities.length ? <View style={styles.amenities}>{amenities.map((item) => <View key={item.id} style={styles.amenity}><T weight="bold" style={styles.check}>✓</T><T style={styles.amenityName}>{item.name}</T></View>)}</View> : <T style={styles.muted}>Phòng chưa cập nhật tiện nghi.</T>}</View>
          <View style={styles.section}><SectionTitle title="Chính sách" /><Policy label="Nhận phòng" value={room.hotel.checkInTime ? `Từ ${room.hotel.checkInTime}` : null} /><Policy label="Trả phòng" value={room.hotel.checkOutTime ? `Trước ${room.hotel.checkOutTime}` : null} /><Policy label="Hủy phòng" value={room.hotel.policy?.cancellationPolicy} /><Policy label="Quy định khác" value={room.hotel.policy?.houseRules} /></View>
          <View style={styles.section}><SectionTitle title="Thông tin giá" /><Policy label="Giá chuẩn tham khảo / đêm" value={money(Number(room.basePrice), room.currency)} />{validStay ? <Policy label="Thời gian lưu trú" value={`${dateLabel(checkIn)} – ${dateLabel(checkOut)} · ${stayNights} đêm · ${rooms} phòng`} /> : <T style={styles.muted}>Chọn ngày để xem giá từng đêm và phòng trống.</T>}{validStay ? availability.data?.nightlyRates.map((night) => <Policy key={night.date} label={dateLabel(night.date)} value={money(Number(night.price), room.currency)} />) : null}{validStay && subtotal ? <Policy label="Tạm tính tiền phòng" value={money(Number(subtotal), room.currency)} /> : null}<T style={styles.note}>Giá từng đêm và số phòng còn do máy chủ xác định. Kết quả được kiểm tra lại khi tiếp tục đặt.</T></View>
          {error ? <T accessibilityRole="alert" style={styles.error}>{error}</T> : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}><View style={styles.footerPrice}><T style={styles.muted}>{validStay ? `Tạm tính ${stayNights} đêm · ${availability.data?.availableQty ?? '…'} phòng còn` : 'Giá tham khảo / đêm'}</T><T weight="bold" style={styles.price}>{validStay ? subtotal ? money(Number(subtotal), room.currency) : 'Đang tải giá' : money(Number(room.basePrice), room.currency)}</T></View><Pressable accessibilityRole="button" disabled={validStay && (!availability.data?.canBook || availability.isFetching)} onPress={() => void select()} style={[styles.select, validStay && (!availability.data?.canBook || availability.isFetching) && { opacity: 0.5 }]}><T weight="bold" style={styles.selectText}>{validStay ? 'Chọn phòng này' : 'Chọn ngày lưu trú'}</T></Pressable></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, gap: 12, padding: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  scroll: { paddingBottom: 28 },
  back: { position: "absolute", top: 14, left: 14, width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#FFFFFFF2" },
  backText: { color: colors.navy, fontSize: 28 },
  content: { padding: 16, gap: 22 },
  section: { gap: 9 },
  stayCard: { padding: 14, gap: 8, borderRadius: 14, backgroundColor: '#EFF6FF' },
  title: { color: colors.navy, fontSize: 24, lineHeight: 31 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  body: { color: colors.gray, lineHeight: 22 },
  link: { color: colors.primary },
  factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  fact: { width: "48%", minHeight: 82, padding: 12, gap: 4, borderRadius: 14, backgroundColor: "#F8FAFC" },
  row: { flexDirection: "row", gap: 9, alignItems: "center" },
  amenities: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  amenity: { width: "48%", minHeight: 46, padding: 9, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, backgroundColor: "#F8FAFC" },
  check: { color: colors.primary },
  amenityName: { flex: 1, fontSize: 13 },
  policy: { paddingVertical: 9, gap: 3, borderBottomWidth: 1, borderBottomColor: colors.line },
  policyLabel: { fontSize: 13 },
  note: { color: colors.orange, fontSize: 12, lineHeight: 18 },
  error: { padding: 12, color: colors.error, borderRadius: 12, backgroundColor: "#FEF2F2" },
  footer: { padding: 14, flexDirection: "row", alignItems: "center", gap: 14, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.white },
  footerPrice: { flex: 1 },
  price: { color: colors.primaryDark, fontSize: 17 },
  select: { minWidth: 150, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.primary },
  selectText: { color: colors.white },
});

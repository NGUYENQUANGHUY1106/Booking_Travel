import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { publicMediaUrl } from "../public-hotels";
import { colors } from "../theme";
import { T } from "../ui";
import type { PublicRoom } from "./types";

function money(value: string, currency: string) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function RoomPhoto({ url, width }: { url: string; width: number }) {
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <View style={[styles.photo, styles.placeholder, { width }]}>
        <T style={styles.muted}>Không tải được ảnh phòng</T>
      </View>
    );
  return (
    <Image
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: publicMediaUrl(url) }}
      style={[styles.photo, { width }]}
    />
  );
}

export function RoomCard({
  room,
  selected,
  onDetail,
  onSelect,
}: {
  room: PublicRoom;
  selected: boolean;
  onDetail: () => void;
  onSelect: () => void;
}) {
  const [width, setWidth] = useState(320);
  const [photoIndex, setPhotoIndex] = useState(0);
  const availability = room.availability;
  const selectable = availability?.canBook === true;
  const images = [...(room.gallery ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const amenityDetails = room.amenityDetails ?? [];
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.card, selected && styles.selected]}
    >
      {images.length ? (
        <View>
          <ScrollView
            horizontal
            onMomentumScrollEnd={(event) =>
              setPhotoIndex(
                Math.round(event.nativeEvent.contentOffset.x / width),
              )
            }
            pagingEnabled
            showsHorizontalScrollIndicator={false}
          >
            {images.map((image) => (
              <Pressable key={image.id} onPress={onDetail}>
                <RoomPhoto url={image.url} width={width} />
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.counter}>
            <T style={styles.counterText}>
              {photoIndex + 1}/{images.length}
            </T>
          </View>
        </View>
      ) : (
        <Pressable onPress={onDetail} style={[styles.photo, styles.placeholder]}>
          <T style={styles.muted}>Phòng chưa có ảnh đã xác minh</T>
        </Pressable>
      )}
      <View style={styles.content}>
        <T weight="bold" style={styles.name}>{room.name}</T>
        <T style={styles.muted}>
          {[room.classLabel, room.viewLabel, room.areaM2 ? `${Number(room.areaM2)} m²` : null]
            .filter(Boolean)
            .join(" · ")}
        </T>
        <T style={styles.muted}>
          {room.bedInfo} · Tối đa {room.capacityAdults} người lớn
          {room.capacityChildren ? ` và ${room.capacityChildren} trẻ em` : ""}
        </T>
        {amenityDetails.length ? (
          <T numberOfLines={2} style={styles.amenities}>
            {amenityDetails.slice(0, 4).map((item) => item.name).join(" · ")}
          </T>
        ) : null}
        <T weight="bold" style={styles.price}>
          {money(availability?.rateSummary.minPricePerNight ?? room.basePrice, room.currency)} / đêm
        </T>
        <T style={styles.muted}>Giá từ trong kỳ lưu trú đã chọn</T>
        <T style={[styles.inventory, !selectable && styles.soldOut]}>{availability?.availableQty === 0 ? 'Hết phòng trong kỳ này' : availability ? `Còn ${availability.availableQty} phòng trong cả kỳ${availability.availableQty < availability.requestedQty ? ` · cần ${availability.requestedQty}` : ''}` : 'Đang kiểm tra phòng trống'}</T>
        {availability && !availability.capacityFits ? <T style={styles.soldOut}>Số khách vượt sức chứa của hạng phòng.</T> : null}
        <View style={styles.actions}>
          <Pressable onPress={onDetail} style={[styles.button, styles.secondary]}>
            <T weight="semibold" style={styles.secondaryText}>Xem chi tiết</T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Chọn ${room.name}, còn ${availability?.availableQty ?? 0} phòng`} disabled={!selectable} onPress={onSelect} style={[styles.button, styles.primary, !selectable && styles.disabled]}>
            <T weight="semibold" style={styles.primaryText}>
              {selected ? "Đã chọn" : "Chọn phòng"}
            </T>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.white },
  selected: { borderWidth: 2, borderColor: colors.primary },
  photo: { width: "100%", height: 210 },
  placeholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8EFF8" },
  counter: { position: "absolute", right: 12, bottom: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14, backgroundColor: "#0F172ACC" },
  counterText: { color: colors.white, fontSize: 12 },
  content: { padding: 15, gap: 7 },
  name: { color: colors.navy, fontSize: 18 },
  muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  amenities: { color: colors.green, fontSize: 12, lineHeight: 18 },
  price: { color: colors.primaryDark, fontSize: 18, marginTop: 3 },
  inventory: { color: colors.orange, fontSize: 11 },
  soldOut: { color: colors.error, fontSize: 12 },
  disabled: { opacity: 0.45 },
  actions: { flexDirection: "row", gap: 10, marginTop: 5 },
  button: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 11 },
  secondary: { borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.white },
  primary: { backgroundColor: colors.primary },
  secondaryText: { color: colors.primary, fontSize: 13 },
  primaryText: { color: colors.white, fontSize: 13 },
});

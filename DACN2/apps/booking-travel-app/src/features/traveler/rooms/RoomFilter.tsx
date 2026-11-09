import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { colors } from "../theme";
import { T } from "../ui";
import { EMPTY_ROOM_FILTERS } from "./room-filter";
import type { PublicRoom, RoomFilters, RoomSort } from "./types";

function toggle(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function Chips({
  items,
  values,
  onChange,
}: {
  items: { value: string; label: string }[];
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <View style={styles.chips}>
      {items.map((item) => {
        const active = values.includes(item.value);
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            key={item.value}
            onPress={() => onChange(toggle(values, item.value))}
            style={[styles.chip, active && styles.chipActive]}
          >
            <T style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RoomFilter({
  rooms,
  filters,
  visible,
  onChange,
  onClose,
}: {
  rooms: PublicRoom[];
  filters: RoomFilters;
  visible: boolean;
  onChange: (filters: RoomFilters) => void;
  onClose: () => void;
}) {
  const unique = (items: { value: string; label: string }[]) =>
    [...new Map(items.map((item) => [item.value, item])).values()];
  const classes = unique(rooms.flatMap((room) => room.classCode ? [{ value: room.classCode, label: room.classLabel ?? room.classCode }] : []));
  const views = unique(rooms.flatMap((room) => room.viewCode && room.viewCode !== "NONE" ? [{ value: room.viewCode, label: room.viewLabel ?? room.viewCode }] : []));
  const beds = unique(rooms.flatMap((room) => room.bedConfigurations?.map((bed) => ({ value: bed.bedType, label: bed.bedType })) ?? []));
  const amenities = unique(rooms.flatMap((room) => room.amenityDetails.map((item) => ({ value: item.id, label: item.name }))));
  const set = <K extends keyof RoomFilters>(key: K, value: RoomFilters[K]) => onChange({ ...filters, [key]: value });
  const sorts: { value: RoomSort; label: string }[] = [
    { value: "priceAsc", label: "Giá thấp đến cao" },
    { value: "priceDesc", label: "Giá cao đến thấp" },
    { value: "capacityDesc", label: "Sức chứa lớn nhất" },
  ];
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}><T weight="bold" style={styles.title}>Lọc và sắp xếp phòng</T><Pressable onPress={onClose}><T style={styles.close}>Đóng</T></Pressable></View>
          <ScrollView contentContainerStyle={styles.body}>
            <T weight="semibold">Sắp xếp</T>
            <Chips items={sorts} values={[filters.sort]} onChange={(values) => set("sort", (values.at(-1) as RoomSort | undefined) ?? "priceAsc")} />
            {classes.length ? <><T weight="semibold">Loại phòng</T><Chips items={classes} values={filters.classes} onChange={(value) => set("classes", value)} /></> : null}
            {views.length ? <><T weight="semibold">Hướng nhìn</T><Chips items={views} values={filters.views} onChange={(value) => set("views", value)} /></> : null}
            {beds.length ? <><T weight="semibold">Loại giường</T><Chips items={beds} values={filters.beds} onChange={(value) => set("beds", value)} /></> : null}
            {amenities.length ? <><T weight="semibold">Tiện nghi</T><Chips items={amenities} values={filters.amenities} onChange={(value) => set("amenities", value)} /></> : null}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable onPress={() => onChange(EMPTY_ROOM_FILTERS)} style={[styles.action, styles.reset]}><T style={styles.resetText}>Xóa bộ lọc</T></Pressable>
            <Pressable onPress={onClose} style={[styles.action, styles.apply]}><T weight="semibold" style={styles.applyText}>Xem kết quả</T></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "#0F172A88" },
  sheet: { maxHeight: "88%", borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: colors.white },
  header: { padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.line },
  title: { color: colors.navy, fontSize: 18 },
  close: { color: colors.primary },
  body: { padding: 18, gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 20 },
  chipActive: { borderColor: colors.primary, backgroundColor: "#DBEAFE" },
  chipText: { color: colors.gray, fontSize: 12 },
  chipTextActive: { color: colors.primaryDark, fontWeight: "700" },
  footer: { padding: 16, flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: colors.line },
  action: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  reset: { borderWidth: 1, borderColor: colors.primary },
  apply: { backgroundColor: colors.primary },
  resetText: { color: colors.primary },
  applyText: { color: colors.white },
});

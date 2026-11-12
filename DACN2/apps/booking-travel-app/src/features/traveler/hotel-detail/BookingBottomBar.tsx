import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme";
import { T } from "../ui";

export function BookingBottomBar({
  price,
  currency,
  roomSelected,
  disabled,
  onPress,
}: {
  price: string | null;
  currency: string | null;
  roomSelected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const formatted = price
    ? new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: currency || "VND",
        maximumFractionDigits: 0,
      }).format(Number(price))
    : null;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.copy}>
        <T style={styles.label}>
          {formatted ? "Giá tham khảo từ / đêm" : "Giá phòng"}
        </T>
        <T weight="bold" style={styles.price}>
          {formatted ?? "Chưa có giá"}
        </T>
      </View>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
        style={[styles.button, disabled && styles.disabled]}
      >
        <T weight="semibold" style={styles.buttonText}>
          {roomSelected ? "Tiếp tục đặt phòng" : "Chọn phòng"}
        </T>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: 12,
    paddingHorizontal: 16,
    gap: 14,
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
  },
  copy: { flex: 1 },
  label: { color: colors.muted, fontSize: 11 },
  price: { color: colors.primaryDark, fontSize: 17 },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.white },
});

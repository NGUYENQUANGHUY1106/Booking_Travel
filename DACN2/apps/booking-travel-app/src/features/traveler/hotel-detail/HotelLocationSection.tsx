import { Linking, Pressable, StyleSheet, View } from "react-native";

import { PublicHotelMap } from "../PublicHotelMap";
import type { PublicHotelDetail } from "../public-hotels";
import { colors } from "../theme";
import { T } from "../ui";

export function HotelLocationSection({ hotel }: { hotel: PublicHotelDetail }) {
  const address = [
    hotel.addressLine,
    hotel.ward,
    hotel.district,
    hotel.city,
    hotel.province,
  ]
    .filter(Boolean)
    .join(", ");
  const hasCoordinates = hotel.latitude !== null && hotel.longitude !== null;
  const openDirections = () => {
    const destination = hasCoordinates
      ? `${hotel.latitude},${hotel.longitude}`
      : address;
    void Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`,
    );
  };
  return (
    <View style={styles.card}>
      <T style={styles.address}>
        {address || "Khách sạn chưa cập nhật địa chỉ."}
      </T>
      {hasCoordinates ? (
        <View style={styles.map}>
          <PublicHotelMap
            hotels={[hotel]}
            onSearchArea={() => undefined}
            onSelect={() => undefined}
            selectedId={hotel.id}
          />
        </View>
      ) : (
        <T style={styles.note}>
          Chưa có tọa độ được xác minh nên bản đồ không được hiển thị.
        </T>
      )}
      {address || hasCoordinates ? (
        <Pressable
          accessibilityRole="button"
          onPress={openDirections}
          style={styles.button}
        >
          <T weight="semibold" style={styles.buttonText}>
            Mở chỉ đường
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  address: { color: colors.muted, lineHeight: 20 },
  map: {
    height: 190,
    overflow: "hidden",
    borderRadius: 14,
    backgroundColor: "#EAF1EC",
  },
  note: { color: colors.orange, fontSize: 12 },
  button: {
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary,
  },
  buttonText: { color: colors.primary },
});

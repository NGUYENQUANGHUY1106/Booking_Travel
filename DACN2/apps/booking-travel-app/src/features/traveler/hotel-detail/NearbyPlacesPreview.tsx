import { Pressable, StyleSheet, View } from "react-native";

import { formatNearbyDistance, useNearbyPlaces } from "../nearby-places";
import { colors } from "../theme";
import { SectionTitle, T, go } from "../ui";

export function NearbyPlacesPreview({ hotelId }: { hotelId: string }) {
  const query = useNearbyPlaces(hotelId, undefined, 3);
  const places = query.data?.items ?? [];

  if (query.isError || (!query.isPending && !places.length)) return null;

  return (
    <View style={styles.section}>
      <SectionTitle
        action="Xem tất cả"
        onPress={() => go("nearby-places", { hotelId })}
        title="Địa điểm lân cận"
      />
      {query.isPending ? (
        <T style={styles.muted}>Đang tìm địa điểm quanh khách sạn...</T>
      ) : (
        places.map((place) => (
          <Pressable
            key={place.id}
            onPress={() => go("nearby-places", { hotelId })}
            style={styles.row}
          >
            <T numberOfLines={1} style={styles.name} weight="medium">
              {place.name}
            </T>
            <T style={styles.distance} weight="semibold">
              {formatNearbyDistance(place.distanceMeters)}
            </T>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  row: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
  },
  name: { flex: 1 },
  distance: { color: colors.primaryDark },
  muted: { color: colors.muted },
});

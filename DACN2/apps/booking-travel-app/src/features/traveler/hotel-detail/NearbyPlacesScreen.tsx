import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  NEARBY_PLACE_CATEGORIES,
  formatNearbyDistance,
  nearbyPlaceMapUrl,
  useNearbyPlaces,
  type NearbyPlaceCategory,
} from "../nearby-places";
import { colors } from "../theme";
import { Card, Chip, EmptyState, T, TravelerScaffold } from "../ui";

export function NearbyPlacesScreen({ hotelId }: { hotelId: string }) {
  const [category, setCategory] = useState<NearbyPlaceCategory>();
  const query = useNearbyPlaces(hotelId, category, 30);
  const categoryLabel = NEARBY_PLACE_CATEGORIES.find(
    (item) => item.value === category,
  )?.label;

  return (
    <TravelerScaffold back title="Địa điểm lân cận">
      <ScrollView
        horizontal
        contentContainerStyle={styles.filters}
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
      >
        <Chip
          label="Tất cả"
          onPress={() => setCategory(undefined)}
          selected={!category}
        />
        {NEARBY_PLACE_CATEGORIES.map((item) => (
          <Chip
            key={item.value}
            label={item.label}
            onPress={() => setCategory(item.value)}
            selected={category === item.value}
          />
        ))}
      </ScrollView>

      {query.isPending ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <T style={styles.muted}>Đang tải địa điểm quanh khách sạn...</T>
        </View>
      ) : query.isError ? (
        <EmptyState
          action="Thử lại"
          detail="Nguồn địa điểm đang gián đoạn. Trang chi tiết khách sạn vẫn có thể sử dụng bình thường."
          onPress={() => void query.refetch()}
          title="Không tải được địa điểm"
        />
      ) : !query.data?.hasLocation ? (
        <EmptyState
          detail="Khách sạn chưa cập nhật tọa độ nên chưa thể tính khoảng cách."
          title="Chưa có vị trí khách sạn"
        />
      ) : !query.data.items.length ? (
        <EmptyState
          action={category ? "Xem tất cả" : undefined}
          detail={
            category
              ? `Chưa tìm thấy địa điểm ${categoryLabel?.toLowerCase()} trong bán kính 5 km.`
              : "Chưa tìm thấy địa điểm phù hợp trong bán kính 5 km."
          }
          onPress={category ? () => setCategory(undefined) : undefined}
          title={category ? `Chưa có ${categoryLabel}` : "Chưa có địa điểm lân cận"}
        />
      ) : (
        <>
          <Card>
            <T weight="semibold">Quanh {query.data.hotel.name}</T>
            <T style={styles.muted}>
              Khoảng cách đường chim bay, được tính từ tọa độ khách sạn.
            </T>
            {query.data.stale ? (
              <T style={styles.warning}>
                Đang hiển thị dữ liệu cache gần nhất.
              </T>
            ) : null}
          </Card>

          {query.data.groups.map((group) => (
            <View key={group.category} style={styles.group}>
              <T style={styles.groupTitle} weight="semibold">
                {group.label}
              </T>
              {group.items.map((place) => (
                <Card key={place.id}>
                  <View style={styles.placeHeader}>
                    <T
                      numberOfLines={2}
                      style={styles.placeName}
                      weight="semibold"
                    >
                      {place.name}
                    </T>
                    <T style={styles.distance} weight="bold">
                      {formatNearbyDistance(place.distanceMeters)}
                    </T>
                  </View>
                  {place.address ? (
                    <T style={styles.muted}>{place.address}</T>
                  ) : null}
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(nearbyPlaceMapUrl(place))
                    }
                  >
                    <T style={styles.link} weight="semibold">
                      Mở vị trí và địa chỉ trên Google Maps ↗
                    </T>
                  </Pressable>
                </Card>
              ))}
            </View>
          ))}

          <Pressable
            onPress={() => void Linking.openURL(query.data.attribution.url)}
          >
            <T style={styles.attribution}>{query.data.attribution.text}</T>
          </Pressable>
        </>
      )}
    </TravelerScaffold>
  );
}

const styles = StyleSheet.create({
  filtersScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { gap: 8, paddingRight: 12, alignItems: "center" },
  loading: { paddingVertical: 40, alignItems: "center", gap: 12 },
  muted: { color: colors.muted, lineHeight: 20 },
  warning: { color: "#B45309" },
  group: { gap: 10 },
  groupTitle: { color: colors.navy, fontSize: 18 },
  placeHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  placeName: { flex: 1, fontSize: 16 },
  distance: { color: colors.primaryDark },
  link: { color: colors.primary },
  attribution: { color: colors.muted, fontSize: 12, textAlign: "center" },
});

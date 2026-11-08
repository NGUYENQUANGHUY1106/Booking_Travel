import { router, type Href } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { absoluteMediaUrl } from "@/services/media-url";
import {
  ACCOMMODATION_TYPE_LABELS,
  filterDiscoveryHotels,
  groupHotelDestinations,
  splitDiscoveryHotels,
  type DiscoveryCategory,
} from "./hotel-discovery";
import { PublicHotelCard } from "./PublicHotelCard";
import {
  publicMediaUrl,
  usePublicHotelDiscovery,
  type PublicAccommodationType,
} from "./public-hotels";
import { useTravelerStore } from "./store";
import {
  EmptyState,
  FigmaIcon,
  SectionTitle,
  T,
  TravelerScaffold,
  go,
} from "./ui";

const notificationIcon = require("./assets/308c8.svg");
const searchIcon = require("./assets/0823a.svg");
const CATEGORY_ORDER: PublicAccommodationType[] = [
  "HOTEL",
  "RESORT",
  "HOMESTAY",
  "VILLA",
  "APARTMENT",
  "HOSTEL",
];

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "BT"
  );
}

export function HomeScreen() {
  const session = useTravelerStore((state) => state.session);
  const profile = useTravelerStore((state) => state.profile);
  const setSearch = useTravelerStore((state) => state.setSearch);
  const hotelsQuery = usePublicHotelDiscovery();
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState<DiscoveryCategory>("ALL");
  const hotels = useMemo(() => hotelsQuery.data ?? [], [hotelsQuery.data]);
  const filteredHotels = useMemo(
    () => filterDiscoveryHotels(hotels, keyword, category),
    [category, hotels, keyword],
  );
  const sections = useMemo(
    () => splitDiscoveryHotels(filteredHotels),
    [filteredHotels],
  );
  const destinations = useMemo(() => groupHotelDestinations(hotels), [hotels]);
  const displayName = session ? profile.name.trim() || session.email : "";
  const firstName = displayName.split(/\s+/).at(-1) || "bạn";

  const submitSearch = () => {
    const search = keyword.trim();
    setSearch({ destination: search });
    go("results");
  };

  return (
    <TravelerScaffold background="#F8FAFC">
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <T weight="bold" style={styles.brand}>
            BOOKING TRAVEL
          </T>
          <T style={styles.greeting}>
            {session ? `Xin chào, ${firstName}` : "Xin chào, bạn"}
          </T>
          <T weight="bold" style={styles.heading}>
            Khám phá chỗ ở thật
          </T>
        </View>
        <Pressable
          accessibilityLabel="Thông báo"
          onPress={() => go("notifications")}
          style={styles.roundButton}
        >
          <FigmaIcon source={notificationIcon} />
        </Pressable>
        <Pressable
          accessibilityLabel="Tài khoản"
          onPress={() => router.push("/user/profile" as Href)}
          style={[styles.roundButton, styles.avatar]}
        >
          {session && profile.avatarUrl ? (
            <Image
              source={{ uri: absoluteMediaUrl(profile.avatarUrl) }}
              style={styles.avatarImage}
            />
          ) : (
            <T weight="bold" style={styles.avatarText}>
              {session ? initials(displayName) : "BT"}
            </T>
          )}
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <FigmaIcon source={searchIcon} size={20} />
        <TextInput
          accessibilityLabel="Tìm khách sạn hoặc địa điểm"
          onChangeText={setKeyword}
          onSubmitEditing={submitSearch}
          placeholder="Bạn muốn đi đâu?"
          placeholderTextColor="#94A3B8"
          returnKeyType="search"
          style={styles.searchInput}
          value={keyword}
        />
        {keyword ? (
          <Pressable
            accessibilityLabel="Xóa tìm kiếm"
            onPress={() => setKeyword("")}
          >
            <T weight="bold" style={styles.clearSearch}>
              ×
            </T>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel="Tìm kiếm"
          onPress={submitSearch}
          style={styles.searchButton}
        >
          <T weight="semibold" style={styles.searchButtonText}>
            Tìm
          </T>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
      >
        <CategoryChip
          label="Tất cả"
          selected={category === "ALL"}
          onPress={() => setCategory("ALL")}
        />
        {CATEGORY_ORDER.map((type) => (
          <CategoryChip
            key={type}
            label={ACCOMMODATION_TYPE_LABELS[type]}
            selected={category === type}
            onPress={() => setCategory(type)}
          />
        ))}
      </ScrollView>

      {hotelsQuery.isPending ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color="#2563EB" />
          <T style={styles.stateText}>Đang tải khách sạn từ cơ sở dữ liệu...</T>
        </View>
      ) : null}
      {hotelsQuery.isError ? (
        <EmptyState
          action="Thử lại"
          detail="Không thể lấy danh sách khách sạn từ máy chủ. Hãy kiểm tra backend và kết nối mạng."
          onPress={() => void hotelsQuery.refetch()}
          title="Không tải được khách sạn"
        />
      ) : null}
      {!hotelsQuery.isPending && !hotelsQuery.isError && !hotels.length ? (
        <EmptyState
          detail="Cơ sở dữ liệu hiện chưa có khách sạn đã được duyệt và công khai."
          title="Chưa có khách sạn để khám phá"
        />
      ) : null}

      {!hotelsQuery.isPending && !hotelsQuery.isError && hotels.length ? (
        <>
          <SectionTitle title="Điểm đến có khách sạn" />
          {destinations.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.destinationList}
            >
              {destinations.map((destination) => (
                <Pressable
                  accessibilityRole="button"
                  key={destination.name}
                  onPress={() => {
                    setKeyword(destination.name);
                    setSearch({ destination: destination.name });
                    go("results");
                  }}
                  style={styles.destinationCard}
                >
                  {destination.coverImageUrl ? (
                    <Image
                      source={{
                        uri: publicMediaUrl(destination.coverImageUrl),
                      }}
                      style={styles.destinationImage}
                    />
                  ) : (
                    <View
                      style={[
                        styles.destinationImage,
                        styles.destinationPlaceholder,
                      ]}
                    >
                      <T style={styles.destinationPlaceholderText}>
                        Chưa có ảnh
                      </T>
                    </View>
                  )}
                  <View style={styles.destinationCopy}>
                    <T
                      numberOfLines={1}
                      weight="semibold"
                      style={styles.destinationName}
                    >
                      {destination.name}
                    </T>
                    <T style={styles.destinationCount}>
                      {destination.count} khách sạn trong CSDL
                    </T>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <T style={styles.stateText}>
              Các khách sạn chưa cập nhật thành phố hoặc tỉnh.
            </T>
          )}

          <SectionTitle title="Khách sạn nổi bật" />
          {sections.featured.length ? (
            sections.featured.map((hotel) => (
              <PublicHotelCard hotel={hotel} key={hotel.id} />
            ))
          ) : (
            <EmptyState
              detail="Không có khách sạn trong cơ sở dữ liệu khớp từ khóa hoặc danh mục đã chọn."
              title="Không tìm thấy khách sạn"
            />
          )}

          <SectionTitle title="Có thể bạn sẽ thích" />
          {sections.recommended.length ? (
            sections.recommended.map((hotel) => (
              <PublicHotelCard hotel={hotel} key={hotel.id} />
            ))
          ) : (
            <View style={styles.stateCard}>
              <T style={styles.stateText}>
                Chưa có thêm khách sạn công khai khác trong cơ sở dữ liệu.
              </T>
            </View>
          )}
        </>
      ) : null}
    </TravelerScaffold>
  );
}

function CategoryChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.categoryChip, selected && styles.categoryChipSelected]}
    >
      <T
        weight="semibold"
        style={[styles.categoryText, selected && styles.categoryTextSelected]}
      >
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerCopy: { flex: 1, minWidth: 0 },
  brand: { color: "#2563EB", fontSize: 11, letterSpacing: 1.2 },
  greeting: { color: "#64748B", fontSize: 13, marginTop: 3 },
  heading: { color: "#1E293B", fontSize: 24, lineHeight: 32 },
  roundButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  avatar: { overflow: "hidden", backgroundColor: "#2563EB" },
  avatarImage: { width: 42, height: 42 },
  avatarText: { color: "#FFFFFF", fontSize: 13 },
  searchBox: {
    minHeight: 56,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#1E293B",
    fontSize: 15,
    paddingVertical: 10,
  },
  clearSearch: { color: "#64748B", fontSize: 24, paddingHorizontal: 4 },
  searchButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563EB",
  },
  searchButtonText: { color: "#FFFFFF" },
  categoryList: { gap: 8, paddingRight: 16 },
  categoryChip: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryChipSelected: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
  categoryText: { color: "#475569", fontSize: 13 },
  categoryTextSelected: { color: "#FFFFFF" },
  stateCard: {
    minHeight: 90,
    padding: 20,
    gap: 10,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  stateText: { color: "#64748B", textAlign: "center", lineHeight: 20 },
  destinationList: { gap: 12, paddingRight: 16 },
  destinationCard: {
    width: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  destinationImage: { width: "100%", height: 112 },
  destinationPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E8EFF8",
  },
  destinationPlaceholderText: { color: "#64748B", fontSize: 12 },
  destinationCopy: { padding: 12, gap: 3 },
  destinationName: { color: "#1E293B", fontSize: 16 },
  destinationCount: { color: "#64748B", fontSize: 12 },
});

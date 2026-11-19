import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import {
  canUseWishlist,
  defaultWishlist,
  useWishlistMutations,
  useWishlists,
  wishlistHotelIds,
} from "@/features/favorites";
import { PublicHotelCard } from "./PublicHotelCard";
import { usePublicHotelDiscovery } from "./public-hotels";
import { useTravelerStore } from "./store";
import { colors } from "./theme";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  T,
  TravelerScaffold,
  go,
} from "./ui";

function LoginRequired({ title }: { title: string }) {
  return (
    <TravelerScaffold title={title} back>
      <EmptyState
        action="Đăng nhập"
        detail="Wishlist được lưu riêng theo tài khoản của bạn."
        onPress={() => router.push("/auth/login")}
        title="Bạn cần đăng nhập"
      />
    </TravelerScaffold>
  );
}

export function FavoritesScreen() {
  const session = useTravelerStore((state) => state.session);
  const lists = useWishlists();
  const hotelsQuery = usePublicHotelDiscovery();
  if (session?.mode !== "api" || !canUseWishlist(session.role))
    return <LoginRequired title="Khách sạn yêu thích" />;

  const ids = wishlistHotelIds(defaultWishlist(lists.data));
  const hotels = (hotelsQuery.data ?? []).filter((hotel) => ids.has(hotel.id));
  const pending = lists.isPending || hotelsQuery.isPending;
  const failed = lists.isError || hotelsQuery.isError;

  return (
    <TravelerScaffold title="Khách sạn yêu thích">
      <Card>
        <T weight="semibold">Danh sách đã lưu</T>
        <T style={{ color: colors.muted }}>
          Dữ liệu được đồng bộ với tài khoản và lưu trong database.
        </T>
      </Card>
      {pending ? <ActivityIndicator color={colors.primary} /> : null}
      {failed ? (
        <EmptyState
          action="Thử lại"
          detail="Không thể tải wishlist hoặc danh sách khách sạn từ máy chủ."
          onPress={() => {
            void lists.refetch();
            void hotelsQuery.refetch();
          }}
          title="Lỗi tải dữ liệu"
        />
      ) : null}
      {!pending && !failed
        ? hotels.map((hotel) => (
            <PublicHotelCard hotel={hotel} key={hotel.id} />
          ))
        : null}
      {!pending && !failed && !hotels.length ? (
        <EmptyState
          action="Tìm khách sạn"
          detail="Chạm biểu tượng trái tim ở khách sạn để lưu lại."
          onPress={() => go("results")}
          title="Chưa có khách sạn yêu thích"
        />
      ) : null}
    </TravelerScaffold>
  );
}

export function WishlistScreen() {
  const session = useTravelerStore((state) => state.session);
  const lists = useWishlists();
  const hotelsQuery = usePublicHotelDiscovery();
  const actions = useWishlistMutations();
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState("");
  const [rename, setRename] = useState("");

  const selected =
    lists.data?.find((wishlist) => wishlist.id === selectedId) ??
    defaultWishlist(lists.data);

  if (session?.mode !== "api" || !canUseWishlist(session.role))
    return <LoginRequired title="Wishlist" />;

  const selectedIds = wishlistHotelIds(selected);
  const hotels = (hotelsQuery.data ?? []).filter((hotel) =>
    selectedIds.has(hotel.id),
  );
  const favorite = defaultWishlist(lists.data);
  const suggestions = selected?.isDefault
    ? []
    : (hotelsQuery.data ?? []).filter(
        (hotel) =>
          favorite?.items.some(
            (item) => item.hotelId === hotel.id && item.available,
          ) && !selectedIds.has(hotel.id),
      );
  const mutationError =
    actions.create.isError ||
    actions.rename.isError ||
    actions.removeList.isError ||
    actions.save.isError ||
    actions.unsave.isError;

  return (
    <TravelerScaffold title="Wishlist" back>
      <Card>
        <T weight="semibold">Tạo danh sách mới</T>
        <Field
          label="Tên wishlist"
          maxLength={80}
          onChangeText={setNewName}
          value={newName}
        />
        <Button
          compact
          disabled={!newName.trim() || actions.create.isPending}
          label="Tạo wishlist"
          onPress={() =>
            actions.create.mutate(newName.trim(), {
              onSuccess: (created) => {
                setNewName("");
                setSelectedId(created.id);
                setRename(created.name);
              },
            })
          }
        />
      </Card>

      {lists.isPending ? <ActivityIndicator color={colors.primary} /> : null}
      {lists.isError ? (
        <EmptyState
          action="Thử lại"
          detail="Không thể tải wishlist từ máy chủ."
          onPress={() => void lists.refetch()}
          title="Lỗi tải dữ liệu"
        />
      ) : null}
      {lists.data?.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {lists.data.map((wishlist) => (
            <Chip
              key={wishlist.id}
              label={`${wishlist.name} (${wishlist.itemCount})`}
              onPress={() => {
                setSelectedId(wishlist.id);
                setRename(wishlist.name);
              }}
              selected={wishlist.id === selected?.id}
            />
          ))}
        </View>
      ) : null}

      {selected && !selected.isDefault ? (
        <Card>
          <T weight="semibold">Quản lý “{selected.name}”</T>
          <Field
            label="Đổi tên"
            maxLength={80}
            onChangeText={setRename}
            value={rename}
          />
          <Button
            compact
            disabled={!rename.trim() || actions.rename.isPending}
            label="Lưu tên mới"
            onPress={() =>
              actions.rename.mutate({
                wishlistId: selected.id,
                name: rename.trim(),
              })
            }
          />
          <Button
            compact
            disabled={actions.removeList.isPending}
            label="Xóa wishlist"
            onPress={() =>
              actions.removeList.mutate(selected.id, {
                onSuccess: () => setSelectedId(favorite?.id ?? ""),
              })
            }
            secondary
          />
        </Card>
      ) : null}

      {mutationError ? (
        <T style={{ color: colors.error }}>
          Không thể cập nhật wishlist. Hãy kiểm tra tên, quyền truy cập và thử
          lại.
        </T>
      ) : null}
      {hotelsQuery.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : null}
      {hotels.map((hotel) => (
        <View key={hotel.id} style={{ gap: 8 }}>
          <PublicHotelCard hotel={hotel} />
          {selected && !selected.isDefault ? (
            <Button
              compact
              label="Bỏ khỏi wishlist này"
              onPress={() =>
                actions.unsave.mutate({
                  wishlistId: selected.id,
                  hotelId: hotel.id,
                })
              }
              secondary
            />
          ) : null}
        </View>
      ))}
      {!lists.isPending &&
      !hotelsQuery.isPending &&
      selected &&
      !hotels.length ? (
        <EmptyState
          action="Xem yêu thích"
          detail="Danh sách này chưa có khách sạn công khai nào."
          onPress={() => setSelectedId(favorite?.id ?? "")}
          title="Wishlist đang trống"
        />
      ) : null}

      {selected && !selected.isDefault && suggestions.length ? (
        <Card>
          <T weight="semibold">Thêm từ khách sạn yêu thích</T>
          {suggestions.map((hotel) => (
            <Button
              compact
              key={hotel.id}
              label={`+ ${hotel.name}`}
              onPress={() =>
                actions.save.mutate({
                  wishlistId: selected.id,
                  hotelId: hotel.id,
                })
              }
              secondary
            />
          ))}
        </Card>
      ) : null}
    </TravelerScaffold>
  );
}

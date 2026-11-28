import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { apiClient } from "@/services/api-client";
import { AMENITIES, dateLabel } from "./data";
import { useTravelerStore } from "./store";
import {
  Button,
  Card,
  EmptyState,
  SectionTitle,
  T,
  TravelerScaffold,
  go,
} from "./ui";
import { colors } from "./theme";
import {
  historyAccountId,
  travelHistoryHeaders,
  travelHistoryKey,
  travelHistoryPath,
  useGuestHistory,
  useHistoryHydrated,
  type SearchCriteria,
  type TravelHistory,
} from "./travel-history";

type Action =
  | { type: "consent"; enabled: boolean }
  | { type: "clear" }
  | { type: "remove"; kind: "searches" | "hotels"; id: string };

function repeatSearch(criteria: SearchCriteria) {
  const { destination, checkIn, checkOut, adults, children, rooms } = criteria;
  const state = useTravelerStore.getState();
  state.setSearch({ destination, adults, children, rooms });
  state.setFilters({
    minPrice: criteria.minPrice ?? 0,
    maxPrice: criteria.maxPrice ?? 5_000_000,
    minRating: criteria.minReviewScore ?? 0,
    stars: criteria.stars,
    freeCancellation: criteria.freeCancellation,
    types: criteria.propertyTypes,
    amenities: AMENITIES.filter((amenity) =>
      criteria.amenities.includes(amenity),
    ),
  });
  state.setSort(criteria.sort);
  if (state.confirmStay(checkIn, checkOut)) go("results");
  else {
    state.setSearch({ checkIn: "", checkOut: "" });
    go("dates");
  }
}

export function TravelHistoryScreen() {
  const ready = useHistoryHydrated();
  const accountId = useTravelerStore((state) =>
    historyAccountId(state.session),
  );

  return (
    <TravelerScaffold title="Lịch sử hoạt động" back>
      {ready ? (
        <TravelHistoryContent
          key={accountId ?? "device"}
          accountId={accountId}
        />
      ) : (
        <ActivityIndicator />
      )}
    </TravelerScaffold>
  );
}

function TravelHistoryContent({ accountId }: { accountId?: string }) {
  const client = useQueryClient();
  const guest = useGuestHistory();
  const scope = accountId ?? "device";
  const [confirmation, setConfirmation] = useState<"clear" | "disable">();
  const [localError, setLocalError] = useState("");
  const [openingHotel, setOpeningHotel] = useState<string>();
  const query = useQuery({
    queryKey: travelHistoryKey(scope),
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<TravelHistory>(travelHistoryPath, {
          signal,
          headers: travelHistoryHeaders(scope),
        })
      ).data,
    enabled: Boolean(accountId),
    retry: false,
    gcTime: 0,
  });
  const act = useMutation({
    mutationFn: async (action: Action) => {
      if (historyAccountId(useTravelerStore.getState().session) !== accountId)
        throw new Error("SESSION_CHANGED");
      if (!accountId) {
        const device = useGuestHistory.getState();
        if (action.type === "consent") device.consent(action.enabled);
        else if (action.type === "clear") device.clear();
        else device.remove(action.kind, action.id);
        return;
      }
      const config = { headers: travelHistoryHeaders(accountId) };
      if (action.type === "consent")
        await apiClient.put(
          travelHistoryPath + "/consent",
          { enabled: action.enabled },
          config,
        );
      else if (action.type === "clear")
        await apiClient.delete(travelHistoryPath, config);
      else
        await apiClient.delete(
          travelHistoryPath +
            "/" +
            action.kind +
            "/" +
            encodeURIComponent(action.id),
          config,
        );
    },
    onSuccess: async () =>
      client.invalidateQueries({ queryKey: travelHistoryKey(scope) }),
  });
  const history = accountId ? query.data : guest;
  if (accountId && query.isPending) return <ActivityIndicator />;
  if (accountId && query.isError)
    return (
      <EmptyState
        title="Không tải được lịch sử"
        detail="Kiểm tra kết nối rồi thử lại."
        action="Thử lại"
        onPress={() => void query.refetch()}
      />
    );
  if (!history) return null;

  async function openHotel(entry: TravelHistory["hotels"][number]) {
    if (accountId) {
      go("hotel-detail", { hotelId: entry.hotelId });
      return;
    }
    if (openingHotel) return;
    setOpeningHotel(entry.hotelId);
    setLocalError("");
    try {
      await apiClient.get("/hotels/" + encodeURIComponent(entry.hotelId));
      if (!historyAccountId(useTravelerStore.getState().session))
        go("hotel-detail", { hotelId: entry.hotelId });
    } catch (error) {
      if (
        isAxiosError(error) &&
        [403, 404].includes(error.response?.status ?? 0)
      ) {
        useGuestHistory.getState().remove("hotels", entry.hotelId);
        setLocalError("Khách sạn này hiện không còn hiển thị.");
      } else setLocalError("Không tải được khách sạn. Hãy thử lại.");
    } finally {
      setOpeningHotel(undefined);
    }
  }

  return (
    <>
      <Card>
        <T weight="semibold">
          {accountId ? "Lưu vào tài khoản" : "Lưu trên thiết bị này"}
        </T>
        <T style={{ color: colors.muted }}>
          {history.enabled
            ? "Đang lưu tìm kiếm và khách sạn đã xem. Tắt lưu sẽ xóa toàn bộ lịch sử."
            : "Bật để lưu những lần tìm kiếm và xem khách sạn tiếp theo."}
        </T>
        <Button
          label={history.enabled ? "Tắt lưu lịch sử" : "Bật lưu lịch sử"}
          secondary
          disabled={act.isPending}
          onPress={() =>
            history.enabled
              ? setConfirmation("disable")
              : act.mutate({ type: "consent", enabled: true })
          }
        />
      </Card>
      {act.isError ? (
        <T style={{ color: colors.error }}>
          Không lưu được thay đổi. Hãy thử lại.
        </T>
      ) : null}
      {localError ? <T style={{ color: colors.error }}>{localError}</T> : null}
      {confirmation ? (
        <Card>
          <T weight="semibold">
            {confirmation === "disable"
              ? "Tắt lưu và xóa toàn bộ lịch sử?"
              : "Xóa toàn bộ lịch sử?"}
          </T>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button
              compact
              secondary
              label="Giữ lịch sử"
              onPress={() => setConfirmation(undefined)}
            />
            <Button
              compact
              label="Xác nhận xóa"
              onPress={() => {
                act.mutate(
                  confirmation === "disable"
                    ? { type: "consent", enabled: false }
                    : { type: "clear" },
                );
                setConfirmation(undefined);
              }}
            />
          </View>
        </Card>
      ) : null}
      <SectionTitle title="Tìm kiếm gần đây" />
      {history.searches.length ? (
        history.searches.map((entry) => (
          <Card key={entry.id}>
            <T weight="semibold">{entry.criteria.destination}</T>
            <T>
              {dateLabel(entry.criteria.checkIn)} –{" "}
              {dateLabel(entry.criteria.checkOut)} ·{" "}
              {entry.criteria.adults + entry.criteria.children} khách ·{" "}
              {entry.criteria.rooms} phòng
            </T>
            <T style={{ color: colors.muted }}>
              {new Date(entry.searchedAt).toLocaleString("vi-VN")}
            </T>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Button
                compact
                label="Tìm lại"
                onPress={() => repeatSearch(entry.criteria)}
              />
              <Button
                compact
                secondary
                label="Xóa tìm kiếm"
                disabled={act.isPending}
                onPress={() =>
                  act.mutate({ type: "remove", kind: "searches", id: entry.id })
                }
              />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <T style={{ color: colors.muted }}>Chưa có tìm kiếm nào được lưu.</T>
        </Card>
      )}
      <SectionTitle title="Khách sạn đã xem" />
      {history.hotels.length ? (
        history.hotels.map((entry) => (
          <Card key={entry.hotelId}>
            <T weight="semibold">{entry.hotelName}</T>
            <T style={{ color: colors.muted }}>
              {new Date(entry.viewedAt).toLocaleString("vi-VN")}
            </T>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Button
                compact
                label={openingHotel === entry.hotelId ? "Đang tải…" : "Xem lại"}
                disabled={Boolean(openingHotel)}
                onPress={() => void openHotel(entry)}
              />
              <Button
                compact
                secondary
                label="Xóa lượt xem"
                disabled={act.isPending}
                onPress={() =>
                  act.mutate({
                    type: "remove",
                    kind: "hotels",
                    id: entry.hotelId,
                  })
                }
              />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <T style={{ color: colors.muted }}>Chưa có khách sạn đã xem.</T>
        </Card>
      )}
      {history.searches.length || history.hotels.length ? (
        <Button
          label="Xóa toàn bộ lịch sử"
          secondary
          disabled={act.isPending}
          onPress={() => setConfirmation("clear")}
        />
      ) : null}
    </>
  );
}

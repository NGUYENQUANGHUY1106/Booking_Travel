import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { apiClient } from "@/services/api-client";
import { useTravelerStore } from "@/features/traveler/store";
import {
  InfoCard,
  OwnerButton,
  OwnerScaffold,
  SectionTitle,
} from "../components";
import { useOwnerHotels } from "../hotels/api";
import { ownerColors } from "../styles/tokens";

type Guest = {
  hotelId: string;
  hotelName: string;
  userId: string;
  userName: string;
  conversationId: string | null;
  bookingId: string | null;
  bookingCode: string | null;
  bookingStatus: string | null;
  checkIn: string | null;
  checkOut: string | null;
  guestName: string | null;
  stayPhase: "CHECK_IN_TODAY" | "UPCOMING" | "STAYING" | "COMPLETED" | "OTHER";
  bookingCount: number;
  stayCount: number;
  relation: "BOOKING" | "CHAT_ONLY";
};
type GuestPage = { items: Guest[]; total: number; page: number; limit: number };
type GuestDetail = {
  hotel: { id: string; name: string };
  user: { id: string; fullName: string };
  relation: "BOOKING" | "CHAT_ONLY";
  conversationId: string | null;
  bookingCount: number;
  stayCount: number;
  page: number;
  bookings: {
    id: string;
    code: string;
    guestName: string;
    status: string;
    checkIn: string;
    checkOut: string;
    roomCount: number;
    adults: number;
    children: number;
  }[];
};

const STATUS: Record<string, string> = {
  CONFIRMED: "Sắp nhận phòng",
  CHECKED_IN: "Đang lưu trú",
  COMPLETED: "Đã hoàn tất",
  PENDING_PAYMENT: "Chờ thanh toán",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  REFUND_PENDING: "Chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
};
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : "";
const errorText = (error: unknown) =>
  isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0)
    ? "Bạn không có quyền xem thông tin này hoặc phiên đăng nhập đã hết hạn."
    : "Không thể tải dữ liệu. Kiểm tra kết nối rồi thử lại.";
const detailHref = (hotelId: string, userId: string) =>
  ({
    pathname: "/hotel-owner/screen/[id]",
    params: { id: "guest-detail", hotelId, userId },
  }) as never;
const chatHref = (conversationId: string) =>
  ({
    pathname: "/hotel-owner/screen/[id]",
    params: { id: "chat-detail", conversationId },
  }) as never;

function useOwnerId() {
  const session = useTravelerStore((state) => state.session);
  return session?.mode === "api" && session.role === "HOTEL_OWNER"
    ? session.userId
    : undefined;
}

export function ContactButton({
  hotelId,
  userId,
  conversationId,
}: {
  hotelId: string;
  userId: string;
  conversationId: string | null;
}) {
  const mutation = useMutation({
    mutationFn: async () =>
      conversationId ??
      (
        await apiClient.post<{ id: string }>(
          `/owner/guests/${hotelId}/${userId}/conversation`,
        )
      ).data.id,
    onSuccess: (id) => router.push(chatHref(id)),
  });
  return (
    <View style={styles.gap}>
      <OwnerButton
        secondary
        label={mutation.isPending ? "Đang mở..." : "Nhắn tin với người đặt"}
        disabled={mutation.isPending}
        onPress={() => mutation.mutate()}
      />
      {mutation.isError ? (
        <Text style={styles.error}>{errorText(mutation.error)}</Text>
      ) : null}
    </View>
  );
}

export function GuestsScreen({ initialHotelId }: { initialHotelId?: string }) {
  const ownerId = useOwnerId();
  const hotels = useOwnerHotels(ownerId);
  const [hotelId, setHotelId] = useState(initialHotelId ?? "");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const queryKey = ["owner-guests", ownerId, hotelId, term, page];
  const guests = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await apiClient.get<GuestPage>("/owner/guests", {
          params: {
            hotelId: hotelId || undefined,
            search: term || undefined,
            page,
            limit: 20,
          },
        })
      ).data,
    enabled: !!ownerId,
    refetchOnReconnect: true,
  });
  useFocusEffect(
    useCallback(() => {
      if (ownerId)
        void client.invalidateQueries({ queryKey: ["owner-guests", ownerId] });
    }, [client, ownerId]),
  );
  const rows = guests.data?.items ?? [];
  return (
    <OwnerScaffold
      title="Khách lưu trú"
      testID="OWN-UI-26"
      onRefresh={() => void guests.refetch()}
      refreshing={guests.isRefetching}
    >
      {!ownerId ? (
        <InfoCard>
          <Text style={styles.error}>
            Đăng nhập bằng tài khoản Chủ khách sạn để xem khách.
          </Text>
        </InfoCard>
      ) : null}
      {hotels.data && hotels.data.length > 1 ? (
        <View style={styles.filters}>
          <Pressable
            onPress={() => {
              setHotelId("");
              setPage(1);
            }}
            style={[styles.chip, !hotelId && styles.selected]}
          >
            <Text style={styles.chipText}>Tất cả khách sạn</Text>
          </Pressable>
          {hotels.data.map((hotel) => (
            <Pressable
              key={hotel.id}
              onPress={() => {
                setHotelId(hotel.id);
                setPage(1);
              }}
              style={[styles.chip, hotelId === hotel.id && styles.selected]}
            >
              <Text style={styles.chipText}>{hotel.name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextInput
        accessibilityLabel="Tìm khách"
        placeholder="Tìm tên khách hoặc khách sạn"
        value={search}
        onChangeText={setSearch}
        style={styles.input}
      />
      {guests.isPending && ownerId ? (
        <ActivityIndicator color={ownerColors.primary} />
      ) : null}
      {guests.isError ? (
        <InfoCard>
          <Text style={styles.error}>{errorText(guests.error)}</Text>
          <OwnerButton
            secondary
            label="Thử lại"
            onPress={() => void guests.refetch()}
          />
        </InfoCard>
      ) : null}
      {guests.data ? (
        <Text style={styles.muted}>{guests.data.total} khách / hội thoại</Text>
      ) : null}
      {guests.data && !rows.length ? (
        <InfoCard>
          <Text style={styles.muted}>
            {term
              ? "Không có kết quả phù hợp."
              : "Chưa có khách đặt phòng hoặc hội thoại."}
          </Text>
        </InfoCard>
      ) : null}
      {rows.map((guest) => (
        <InfoCard key={`${guest.hotelId}:${guest.userId}`} style={styles.card}>
          <SectionTitle>{guest.userName}</SectionTitle>
          <Text style={styles.muted}>{guest.hotelName}</Text>
          {guest.relation === "CHAT_ONLY" ? (
            <Text style={styles.muted}>
              Chỉ có hội thoại · Chưa có booking tại khách sạn này
            </Text>
          ) : (
            <>
              <Text style={styles.muted}>
                Người đặt · {guest.bookingCount} booking · {guest.stayCount}{" "}
                lượt lưu trú
              </Text>
              <Text style={styles.muted}>
                Booking gần nhất: {guest.bookingCode} ·{" "}
                {guest.stayPhase === "CHECK_IN_TODAY"
                  ? "Nhận phòng hôm nay"
                  : guest.stayPhase === "STAYING"
                    ? "Đang lưu trú"
                    : (STATUS[guest.bookingStatus ?? ""] ??
                      guest.bookingStatus)}
              </Text>
              <Text style={styles.muted}>
                {date(guest.checkIn)} – {date(guest.checkOut)}
              </Text>
              {guest.guestName && guest.guestName !== guest.userName ? (
                <Text style={styles.muted}>
                  Khách lưu trú khai báo: {guest.guestName}
                </Text>
              ) : null}
            </>
          )}
          <OwnerButton
            label="Xem chi tiết"
            onPress={() => router.push(detailHref(guest.hotelId, guest.userId))}
          />
          <ContactButton
            hotelId={guest.hotelId}
            userId={guest.userId}
            conversationId={guest.conversationId}
          />
        </InfoCard>
      ))}
      {guests.data && page > 1 ? (
        <OwnerButton
          secondary
          label="Trang trước"
          onPress={() => setPage(page - 1)}
        />
      ) : null}
      {guests.data && page * guests.data.limit < guests.data.total ? (
        <OwnerButton
          secondary
          label="Trang sau"
          onPress={() => setPage(page + 1)}
        />
      ) : null}
      <OwnerButton
        secondary
        label="Đánh giá và phản hồi"
        onPress={() =>
          router.push({
            pathname: "/hotel-owner/screen/[id]",
            params: { id: "reviews" },
          } as never)
        }
      />
    </OwnerScaffold>
  );
}

export function GuestDetailScreen({
  hotelId,
  userId,
}: {
  hotelId?: string;
  userId?: string;
}) {
  const ownerId = useOwnerId();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ["owner-guest-detail", ownerId, hotelId, userId, page],
    queryFn: async () =>
      (
        await apiClient.get<GuestDetail>(`/owner/guests/${hotelId}/${userId}`, {
          params: { page },
        })
      ).data,
    enabled: !!ownerId && !!hotelId && !!userId,
    refetchOnReconnect: true,
  });
  return (
    <OwnerScaffold
      title="Chi tiết khách"
      testID="OWN-UI-26-detail"
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
    >
      <OwnerButton
        secondary
        label="‹ Quay lại danh sách khách"
        onPress={() =>
          router.canGoBack()
            ? router.back()
            : router.replace({
                pathname: "/hotel-owner/screen/[id]",
                params: { id: "guests", hotelId },
              } as never)
        }
      />
      {!ownerId || !hotelId || !userId ? (
        <InfoCard>
          <Text style={styles.error}>
            Chọn khách từ danh sách của Chủ khách sạn.
          </Text>
        </InfoCard>
      ) : null}
      {query.isPending && ownerId && hotelId && userId ? (
        <ActivityIndicator color={ownerColors.primary} />
      ) : null}
      {query.isError ? (
        <InfoCard>
          <Text style={styles.error}>{errorText(query.error)}</Text>
          <OwnerButton
            secondary
            label="Thử lại"
            onPress={() => void query.refetch()}
          />
        </InfoCard>
      ) : null}
      {query.data ? (
        <>
          <InfoCard style={styles.card}>
            <SectionTitle>{query.data.user.fullName}</SectionTitle>
            <Text style={styles.muted}>{query.data.hotel.name}</Text>
            <Text style={styles.muted}>
              {query.data.relation === "CHAT_ONLY"
                ? "Chỉ có hội thoại, chưa đặt phòng"
                : `${query.data.bookingCount} booking · ${query.data.stayCount} lượt lưu trú`}
            </Text>
            <ContactButton
              hotelId={query.data.hotel.id}
              userId={query.data.user.id}
              conversationId={query.data.conversationId}
            />
          </InfoCard>
          <SectionTitle>Booking tại {query.data.hotel.name}</SectionTitle>
          {!query.data.bookings.length ? (
            <InfoCard>
              <Text style={styles.muted}>
                Chưa có booking tại khách sạn này.
              </Text>
            </InfoCard>
          ) : null}
          {query.data.bookings.map((booking) => (
            <InfoCard key={booking.id} style={styles.card}>
              <Text style={styles.title}>
                #{booking.code} · {STATUS[booking.status] ?? booking.status}
              </Text>
              <Text style={styles.muted}>
                Người đặt: {query.data.user.fullName}
              </Text>
              <Text style={styles.muted}>
                Khách lưu trú khai báo: {booking.guestName}
              </Text>
              <Text style={styles.muted}>
                {date(booking.checkIn)} – {date(booking.checkOut)} ·{" "}
                {booking.roomCount} phòng · {booking.adults + booking.children}{" "}
                khách
              </Text>
              <OwnerButton
                label="Xem booking"
                onPress={() =>
                  router.push({
                    pathname: "/hotel-owner/screen/[id]",
                    params: { id: "booking-detail", bookingId: booking.id },
                  } as never)
                }
              />
            </InfoCard>
          ))}
          {page > 1 ? (
            <OwnerButton
              secondary
              label="Trang trước"
              onPress={() => setPage(page - 1)}
            />
          ) : null}
          {page * 20 < query.data.bookingCount ? (
            <OwnerButton
              secondary
              label="Trang sau"
              onPress={() => setPage(page + 1)}
            />
          ) : null}
        </>
      ) : null}
    </OwnerScaffold>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  gap: { gap: 5 },
  title: { fontSize: 16, fontWeight: "700", color: ownerColors.text },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 21 },
  error: { color: ownerColors.danger, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: ownerColors.border,
    borderRadius: 12,
    backgroundColor: ownerColors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: ownerColors.text,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: ownerColors.border,
    backgroundColor: ownerColors.surface,
    borderRadius: 12,
    padding: 10,
  },
  selected: { borderColor: ownerColors.primary, backgroundColor: "#DBEAFE" },
  chipText: { color: ownerColors.text, fontSize: 13 },
});

import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { ActivityIndicator, Image, Pressable, View } from "react-native";

import { useOwnerNotifications } from "@/features/owner-application/api";
import { ConversationListScreen, ConversationScreen } from "@/features/chat";
import {
  useNotifications,
  useReadNotification,
} from "@/features/notifications";

import { publicHotelPrice } from "./hotel-discovery";
import { PublicHotelCard } from "./PublicHotelCard";
import { usePublicHotelDiscovery } from "./public-hotels";
import { useTravelerStore } from "./store";
import { LiveMyReviews, LiveWriteReview } from "./LiveReviewScreens";
import { colors } from "./theme";
import { Button, Card, EmptyState, Field, T, TravelerScaffold, go } from "./ui";
import { FavoritesScreen, WishlistScreen } from "./WishlistScreens";

export type SocialScreenId =
  | "favorites"
  | "wishlist"
  | "compare"
  | "chat-list"
  | "chat-detail"
  | "chat-attachments"
  | "notifications"
  | "notification-preferences"
  | "write-review"
  | "review-submitted"
  | "edit-review"
  | "my-reviews"
  | "report-review";

function CompareScreen() {
  const { compare, toggleCompare } = useTravelerStore();
  const hotelsQuery = usePublicHotelDiscovery();
  const hotels = (hotelsQuery.data ?? []).filter((hotel) =>
    compare.includes(hotel.id),
  );
  return (
    <TravelerScaffold title="So sánh khách sạn" back>
      {hotelsQuery.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : null}
      {hotelsQuery.isError ? (
        <EmptyState
          action="Thử lại"
          detail="Không thể tải khách sạn từ máy chủ."
          onPress={() => void hotelsQuery.refetch()}
          title="Lỗi tải dữ liệu"
        />
      ) : null}
      {!hotelsQuery.isPending && !hotelsQuery.isError && hotels.length < 2 ? (
        <EmptyState
          action="Chọn khách sạn"
          detail="Chọn từ 2 đến 4 khách sạn trong kết quả tìm kiếm."
          onPress={() => go("results")}
          title="Chưa đủ khách sạn để so sánh"
        />
      ) : !hotelsQuery.isPending && !hotelsQuery.isError ? (
        <>
          <Card>
            <T weight="semibold">So sánh {hotels.length} khách sạn</T>
            <T style={{ color: colors.muted }}>
              {hotels.map((hotel) => hotel.name).join("  ↔  ")}
            </T>
          </Card>
          <Card>
            <T>Hạng sao</T>
            <T weight="semibold">
              {hotels
                .map((hotel) =>
                  hotel.starRating
                    ? `${hotel.starRating} sao`
                    : "Chưa xếp hạng",
                )
                .join(" / ")}
            </T>
          </Card>
          <Card>
            <T>Giá thấp nhất</T>
            <T weight="semibold">
              {hotels
                .map((hotel) => {
                  const price = publicHotelPrice(hotel);
                  return price === undefined
                    ? "Chưa có giá"
                    : new Intl.NumberFormat("vi-VN").format(price);
                })
                .join(" / ")}
            </T>
          </Card>
          <Card>
            <T>Vị trí</T>
            <T weight="semibold">
              {hotels
                .map((hotel) => hotel.city || hotel.province || "Chưa cập nhật")
                .join(" / ")}
            </T>
          </Card>
          {hotels.map((hotel) => (
            <View key={hotel.id} style={{ gap: 8 }}>
              <PublicHotelCard hotel={hotel} />
              <Button
                label="Bỏ khỏi so sánh"
                secondary
                onPress={() => toggleCompare(hotel.id)}
              />
            </View>
          ))}
        </>
      ) : null}
    </TravelerScaffold>
  );
}

function NotificationScreen({
  preferences = false,
}: {
  preferences?: boolean;
}) {
  const enabled = useTravelerStore((state) => state.notificationSettings);
  const update = useTravelerStore((state) => state.setNotificationSettings);
  const session = useTravelerStore((state) => state.session);
  const ownerNotifications = useOwnerNotifications(
    session?.mode === "api" ? session.userId : undefined,
  );
  const notifications = useNotifications(
    session?.mode === "api" ? session.userId : undefined,
  );
  const readNotification = useReadNotification(
    session?.mode === "api" ? session.userId : undefined,
  );
  if (preferences)
    return (
      <TravelerScaffold title="Tùy chọn thông báo" back>
        {(
          [
            { key: "booking", label: "Đặt phòng" },
            { key: "deal", label: "Ưu đãi" },
            { key: "chat", label: "Tin nhắn" },
          ] as const
        ).map((item) => (
          <Card
            key={item.key}
            onPress={() => update({ [item.key]: !enabled[item.key] })}
          >
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <T>{item.label}</T>
              <T
                style={{
                  color: enabled[item.key] ? colors.primary : colors.muted,
                }}
              >
                {enabled[item.key] ? "Bật" : "Tắt"}
              </T>
            </View>
          </Card>
        ))}
      </TravelerScaffold>
    );
  if (session?.mode === "api")
    return (
      <TravelerScaffold title="Thông báo" back>
        {notifications.isPending ? (
          <Card>
            <T>Đang tải thông báo...</T>
          </Card>
        ) : null}
        {notifications.isError ? (
          <Card>
            <T>Không thể tải thông báo.</T>
            <Button
              label="Thử lại"
              secondary
              onPress={() => void notifications.refetch()}
            />
          </Card>
        ) : null}
        {ownerNotifications.isPending ? (
          <Card>
            <T>Đang tải thông báo...</T>
          </Card>
        ) : null}
        {ownerNotifications.isError ? (
          <Card>
            <T>Không thể tải thông báo xác minh.</T>
            <Button
              label="Thử lại"
              secondary
              onPress={() => void ownerNotifications.refetch()}
            />
          </Card>
        ) : null}
        {notifications.data?.map((item) => (
          <Card
            key={item.id}
            onPress={() => {
              if (!item.readAt) readNotification.mutate(item.id);
              const route =
                typeof item.data?.route === "string" ? item.data.route : null;
              if (route) router.push(route as Href);
            }}
          >
            <T weight="semibold">{item.title}</T>
            <T style={{ color: colors.muted }}>{item.body}</T>
            {!item.readAt ? (
              <T style={{ color: colors.primary }}>Chưa đọc</T>
            ) : null}
          </Card>
        ))}
        {ownerNotifications.data?.map((item) => (
          <Card
            key={item.id}
            onPress={() => router.push("/owner-application/status" as Href)}
          >
            <T weight="semibold">{item.title}</T>
            <T style={{ color: colors.muted }}>{item.body}</T>
            <T style={{ color: colors.primary }}>Xem trạng thái hồ sơ</T>
          </Card>
        ))}
        {notifications.isSuccess &&
        ownerNotifications.isSuccess &&
        !notifications.data.length &&
        !ownerNotifications.data.length ? (
          <EmptyState
            title="Chưa có thông báo xác minh"
            detail="Kết quả xét duyệt hồ sơ sẽ xuất hiện tại đây."
          />
        ) : null}
      </TravelerScaffold>
    );
  return (
    <TravelerScaffold title="Thông báo" back>
      <Card onPress={() => go("my-bookings")}>
        <T weight="semibold">Đặt phòng đã xác nhận</T>
        <T style={{ color: colors.muted }}>BT-DEMO-001 · 12–15/09/2026</T>
      </Card>
      <Card onPress={() => go("results")}>
        <T weight="semibold">Ưu đãi cho chuyến đi Đà Nẵng</T>
        <T style={{ color: colors.muted }}>Thông báo mới · 2 giờ trước</T>
      </Card>
      <Card onPress={() => go("chat-list")}>
        <T weight="semibold">Khách sạn đã trả lời tin nhắn</T>
        <T style={{ color: colors.muted }}>Thông báo mới · 2 giờ trước</T>
      </Card>
      <Button
        label="Cập nhật tùy chọn"
        onPress={() => go("notification-preferences")}
      />
    </TravelerScaffold>
  );
}

function ReviewScreen({ edit = false }: { edit?: boolean }) {
  const bookingId = useTravelerStore((state) => state.selectedBookingId);
  const booking = useTravelerStore((state) =>
    state.bookings.find((item) => item.id === bookingId),
  );
  const reviews = useTravelerStore((state) => state.reviews);
  const existing = reviews.find((item) => item.bookingId === bookingId);
  const [ratingText, setRatingText] = useState(String(existing?.rating ?? 9));
  const [text, setText] = useState(
    existing?.text ?? "Phòng sạch, vị trí thuận tiện, nhân viên thân thiện.",
  );
  const [criteria, setCriteria] = useState(
    existing?.criteria ?? {
      "Sạch sẽ": 9,
      "Vị trí": 10,
      "Dịch vụ": 9,
      "Tiện nghi": 8,
      "Thoải mái": 9,
      "Giá trị": 9,
    },
  );
  const [imageUri, setImageUri] = useState(existing?.imageUri);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();
  const hotelName = booking?.hotelName ?? "Khách sạn trong booking";
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled) setImageUri(result.assets[0].uri);
    } catch {
      setError("Không thể mở thư viện ảnh lúc này.");
    }
  };
  return (
    <TravelerScaffold
      title={edit ? "Chỉnh sửa đánh giá" : "Viết đánh giá"}
      back
    >
      <Card>
        <T weight="semibold">{hotelName}</T>
        <T style={{ color: colors.muted }}>
          Chỉ đặt phòng đã hoàn tất mới được đánh giá.
        </T>
      </Card>
      <View style={{ width: 110 }}>
        <Field
          keyboardType="number-pad"
          label="Điểm tổng thể (1–10)"
          onChangeText={setRatingText}
          value={ratingText}
        />
      </View>
      <Field
        label="Trải nghiệm của bạn"
        multiline
        onChangeText={setText}
        placeholder="Chia sẻ trải nghiệm lưu trú"
        value={text}
      />
      <Card>
        <T weight="semibold">Điểm từng tiêu chí (1–10)</T>
        {Object.entries(criteria).map(([name, score]) => (
          <Pressable
            accessibilityLabel={`${name}: ${score} trên 10. Chạm để tăng điểm.`}
            key={name}
            onPress={() =>
              setCriteria({ ...criteria, [name]: score >= 10 ? 1 : score + 1 })
            }
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              minHeight: 28,
            }}
          >
            <T style={{ color: colors.muted }}>{name}</T>
            <T weight="semibold" style={{ color: colors.primary }}>
              {score}/10
            </T>
          </Pressable>
        ))}
      </Card>
      <Card>
        <T weight="semibold">Ảnh trải nghiệm (không bắt buộc)</T>
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ height: 130, width: 160, borderRadius: 10 }}
          />
        ) : null}
        <Pressable onPress={pickPhoto}>
          <T style={{ color: colors.primary }}>
            {imageUri ? "Thay ảnh" : "+ Thêm ảnh phòng hoặc tiện ích"}
          </T>
        </Pressable>
        {imageUri ? (
          <Pressable onPress={() => setImageUri(undefined)}>
            <T style={{ color: colors.error }}>Xóa ảnh</T>
          </Pressable>
        ) : null}
      </Card>
      {error ? (
        <T accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </T>
      ) : null}
      <Button
        label={sending ? "Đang gửi..." : edit ? "Lưu đánh giá" : "Gửi đánh giá"}
        onPress={async () => {
          if (sending) return;
          const rating = Number(ratingText);
          if (!bookingId || booking?.status !== "COMPLETED")
            return setError("Chỉ có thể đánh giá sau khi hoàn thành lưu trú.");
          if (!Number.isInteger(rating) || rating < 1 || rating > 10)
            return setError("Điểm tổng thể phải là số từ 1 đến 10.");
          if (text.trim().length < 10)
            return setError("Vui lòng nhập ít nhất 10 ký tự.");
          if (edit) return setError("Chỉnh sửa đánh giá hiện chưa hỗ trợ.");
          setSending(true);
          try {
            await apiClient.post("/reviews", {
              bookingId,
              rating,
              content: text.trim(),
            });
            await queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
            go("review-submitted");
          } catch {
            setError("Không gửi được đánh giá. Kiểm tra booking và thử lại.");
          } finally {
            setSending(false);
          }
        }}
      />
    </TravelerScaffold>
  );
}

function MyReviewsScreen() {
  const reviewQuery = useQuery({
    queryKey: ["my-reviews"],
    queryFn: async () =>
      (
        await apiClient.get<
          {
            id: string;
            rating: number;
            comment: string;
            hiddenAt: string | null;
            hotel: { name: string };
            reply: { content: string } | null;
          }[]
        >("/reviews/me")
      ).data,
  });
  const reviews = reviewQuery.data ?? [];
  return (
    <TravelerScaffold title="Đánh giá của tôi" back>
      {reviewQuery.isPending ? (
        <ActivityIndicator color={colors.primary} />
      ) : null}
      {reviewQuery.isError ? (
        <Button
          label="Không tải được đánh giá. Thử lại"
          onPress={() => void reviewQuery.refetch()}
        />
      ) : null}
      {reviews.length ? (
        reviews.map((review) => {
          const hotelName = review.hotel.name;
          return (
            <Card key={review.id}>
              <T weight="semibold">
                {hotelName} · {review.rating}/10
              </T>
              <T style={{ color: colors.muted }}>{review.comment}</T>
              {review.hiddenAt ? (
                <T>Đánh giá đã bị ẩn.</T>
              ) : review.reply ? (
                <T>Phản hồi từ khách sạn: {review.reply.content}</T>
              ) : null}
            </Card>
          );
        })
      ) : !reviewQuery.isPending && !reviewQuery.isError ? (
        <EmptyState
          action="Xem lịch sử đặt phòng"
          detail="Sau khi hoàn tất lưu trú, bạn có thể viết đánh giá cho khách sạn."
          onPress={() => go("my-bookings")}
          title="Chưa có đánh giá"
        />
      ) : null}
    </TravelerScaffold>
  );
}

function ReportReviewScreen() {
  const { reviewId } = useLocalSearchParams<{ reviewId?: string }>();
  const session = useTravelerStore((state) => state.session);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const submit = async () => {
    if (!reviewId) return setError("Hãy chọn đánh giá từ trang khách sạn.");
    if (session?.mode !== "api") return setError("Vui lòng đăng nhập.");
    if (reason.trim().length < 10)
      return setError("Lý do cần ít nhất 10 ký tự.");
    setPending(true);
    setError("");
    try {
      await apiClient.post("/content-reports", {
        targetType: "REVIEW",
        targetId: reviewId,
        reason: "OTHER",
        description: reason.trim(),
      });
      setSent(true);
    } catch (e) {
      setError(
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Không gửi được báo cáo.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <TravelerScaffold title="Báo cáo đánh giá" back>
      <Card>
        <T weight="semibold">Nội dung không phù hợp</T>
        <T style={{ color: colors.muted }}>Vui lòng mô tả lý do báo cáo.</T>
      </Card>
      <Field label="Lý do" onChangeText={setReason} value={reason} />
      {error ? (
        <T accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </T>
      ) : null}
      {sent ? (
        <T style={{ color: colors.green }}>Báo cáo đã gửi đến Admin.</T>
      ) : null}
      <Button
        label={pending ? "Đang gửi..." : "Gửi báo cáo"}
        disabled={pending || sent || !reviewId}
        onPress={() => void submit()}
      />
    </TravelerScaffold>
  );
}

function ReviewSubmittedScreen() {
  return (
    <TravelerScaffold title="Đã gửi đánh giá" back>
      <Card>
        <T weight="semibold">Cảm ơn bạn đã chia sẻ!</T>
        <T style={{ color: colors.muted }}>
          Đánh giá đã được lưu trên hệ thống.
        </T>
      </Card>
      <Button label="Xem đánh giá của tôi" onPress={() => go("my-reviews")} />
    </TravelerScaffold>
  );
}

export function SocialScreen({
  id,
  conversationId,
  bookingId,
}: {
  id: SocialScreenId;
  conversationId?: string;
  bookingId?: string;
}) {
  const live = useTravelerStore((state) => state.session?.mode === "api");
  if ((live || bookingId) && id === "write-review") return <LiveWriteReview key={bookingId} bookingId={bookingId} />;
  if (live && id === "my-reviews") return <LiveMyReviews />;
  if ((live || bookingId) && id === "edit-review") return <LiveWriteReview key={bookingId} bookingId={bookingId} edit />;
  if (live && id === "report-review") return <TravelerScaffold title="Báo cáo đánh giá" back>
    <T>Hãy mở trang khách sạn và chọn Báo cáo đánh giá ngay dưới đánh giá cần gửi.</T>
  </TravelerScaffold>;
  if (id === "favorites") return <FavoritesScreen />;
  if (id === "wishlist") return <WishlistScreen />;
  if (id === "compare") return <CompareScreen />;
  if (id === "chat-list") return <ConversationListScreen />;
  if (id === "chat-detail")
    return <ConversationScreen conversationId={conversationId} />;
  if (id === "chat-attachments")
    return (
      <TravelerScaffold title="Đính kèm" back>
        <Card>
          <T weight="semibold">Đính kèm trong bản demo</T>
          <T style={{ color: colors.muted }}>
            Bạn có thể mô tả yêu cầu trong tin nhắn.
          </T>
        </Card>
        <Button label="Trở lại trò chuyện" onPress={() => go("chat-detail")} />
      </TravelerScaffold>
    );
  if (id === "notifications" || id === "notification-preferences")
    return (
      <NotificationScreen preferences={id === "notification-preferences"} />
    );
  if (id === "write-review" || id === "edit-review")
    return <ReviewScreen edit={id === "edit-review"} />;
  if (id === "review-submitted") return <ReviewSubmittedScreen />;
  if (id === "my-reviews") return <MyReviewsScreen />;
  return <ReportReviewScreen />;
}

export { FavoritesScreen } from "./WishlistScreens";

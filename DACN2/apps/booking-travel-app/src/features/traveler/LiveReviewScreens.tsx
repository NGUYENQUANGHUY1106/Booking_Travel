import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { File } from "expo-file-system";
import { uploadAsync, FileSystemUploadType } from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { apiClient } from "@/services/api-client";
import { absoluteMediaUrl } from "@/services/media-url";
import {
  CONTENT_REPORT_REASONS,
  type ContentReportReason,
} from "@/features/content-report-reasons";
import { useTravelerStore } from "./store";
import { colors } from "./theme";
import { Button, Card, Chip, Field, T, TravelerScaffold, go } from "./ui";

const SCORES = {
  rating: "Điểm tổng thể",
  cleanliness: "Sạch sẽ",
  location: "Vị trí",
  service: "Dịch vụ",
  facilities: "Tiện nghi",
  comfort: "Thoải mái",
  value: "Đáng tiền",
} as const;
const SCORE_KEYS = Object.keys(SCORES) as (keyof typeof SCORES)[];
const CRITERIA = SCORE_KEYS.filter((key) => key !== "rating");
const STARS = [1, 2, 3, 4, 5];
const POINTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type Review = Record<keyof typeof SCORES, number> & {
  id: string;
  comment: string;
  reply?: { content: string } | null;
  images: string[];
  createdAt: string;
  moderationLockedAt?: string | null;
  hiddenAt?: string | null;
};
type OwnReview = Review & { bookingId: string; hotel: { name: string } };

function reviewError(error: unknown) {
  if (isAxiosError<{ message?: unknown }>(error)) {
    const message = error.response?.data.message;
    if (typeof message === "string") return message;
    if (error.response?.status === 429)
      return "Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.";
  }
  return "Không thể xử lý đánh giá lúc này. Vui lòng thử lại.";
}

async function uploadReviewImage(
  bookingPath: string,
  asset: ImagePicker.ImagePickerAsset,
) {
  const mimeType = asset.mimeType ?? asset.file?.type ?? "";
  const extension = IMAGE_EXTENSIONS[mimeType];
  const size =
    asset.file?.size ??
    asset.fileSize ??
    (Platform.OS === "web" ? 0 : new File(asset.uri).size);
  if (!extension || size < 8 || size > 5 * 1024 * 1024)
    throw new Error("Vui lòng chọn ảnh JPEG, PNG hoặc WebP tối đa 5 MB.");
  const { data } = await apiClient.post<{
    uploadUrl: string;
    imageId: string;
    contentType: string;
  }>(`${bookingPath}/images/presign`, { extension, sizeBytes: size });
  const uploadUrl = absoluteMediaUrl(data.uploadUrl);
  const headers = { "Content-Type": data.contentType };
  const status =
    Platform.OS === "web"
      ? (
          await fetch(uploadUrl, {
            method: "PUT",
            headers,
            body: asset.file,
          })
        ).status
      : (
          await uploadAsync(uploadUrl, asset.uri, {
            httpMethod: "PUT",
            uploadType: FileSystemUploadType.BINARY_CONTENT,
            headers,
          })
        ).status;
  if (status < 200 || status >= 300)
    throw new Error("Không thể tải ảnh đánh giá. Vui lòng thử lại.");
  return data.imageId;
}

function ReviewCard({ review, hotel }: { review: Review; hotel?: string }) {
  return (
    <Card>
      {hotel ? <T weight="semibold">{hotel}</T> : null}
      <T weight="semibold">★ {review.rating / 2}/5 · Đã xác minh lưu trú</T>
      <T>{review.comment}</T>
      {review.reply ? (
        <>
          <T weight="semibold">Ph?n h?i t? kh?ch s?n</T>
          <T>{review.reply.content}</T>
        </>
      ) : null}
      {review.images.map((uri) => (
        <Image
          key={uri}
          source={{ uri: absoluteMediaUrl(uri) }}
          style={{ width: "100%", height: 160, borderRadius: 12 }}
        />
      ))}
    </Card>
  );
}

function invalidateReviews(
  client: ReturnType<typeof useQueryClient>,
  userId?: string,
  bookingId?: string,
) {
  return Promise.all([
    client.invalidateQueries({
      queryKey: ["review-booking", userId, bookingId],
    }),
    client.invalidateQueries({ queryKey: ["my-reviews", userId] }),
    ...[
      "public-hotel-reviews",
      "public-hotel",
      "public-hotel-discovery",
      "public-hotels",
      "hotel-stay-search",
      "hotel-map-search",
      "nearby-hotel-search",
    ].map((key) => client.invalidateQueries({ queryKey: [key] })),
  ]);
}

export function LiveWriteReview({
  bookingId,
  edit = false,
}: {
  bookingId?: string;
  edit?: boolean;
}) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === "api" ? session.userId : undefined;
  const bookingPath = `/reviews/bookings/${encodeURIComponent(bookingId ?? "")}`;
  const queryKey = ["review-booking", userId, bookingId];
  const status = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await apiClient.get<{
          hotelName: string;
          review: Review | null;
          reviewDeleted: boolean;
        }>(bookingPath)
      ).data,
    enabled: Boolean(bookingId && userId),
    retry: false,
  });
  return (
    <TravelerScaffold title={edit ? "Sửa đánh giá" : "Viết đánh giá"} back>
      {!bookingId ? (
        <T>Hãy chọn một đặt phòng đã hoàn tất.</T>
      ) : status.isPending ? (
        <T>Đang kiểm tra đặt phòng…</T>
      ) : status.isError ? (
        <Card>
          <T>{reviewError(status.error)}</T>
          <Button label="Thử lại" onPress={() => void status.refetch()} />
        </Card>
      ) : status.data.reviewDeleted ? (
        <T>Đánh giá đã được xóa. Mỗi đặt phòng chỉ có một lượt đánh giá.</T>
      ) : status.data.review &&
        (!edit || status.data.review.moderationLockedAt) ? (
        <>
          <T weight="semibold">
            {status.data.review.moderationLockedAt
              ? "Đánh giá đang bị khóa kiểm duyệt."
              : "Đánh giá của bạn đã được gửi."}
          </T>
          <ReviewCard
            hotel={status.data.hotelName}
            review={status.data.review}
          />
          {!status.data.review.moderationLockedAt ? (
            <Button
              secondary
              label="Sửa đánh giá"
              onPress={() => go("edit-review", { bookingId })}
            />
          ) : null}
          <Button
            label="Xem đánh giá của tôi"
            onPress={() => go("my-reviews")}
          />
        </>
      ) : edit && !status.data.review ? (
        <T>Không tìm thấy đánh giá cần sửa.</T>
      ) : (
        <ReviewForm
          bookingId={bookingId}
          bookingPath={bookingPath}
          userId={userId}
          hotel={status.data.hotelName}
          initial={edit ? (status.data.review ?? undefined) : undefined}
        />
      )}
    </TravelerScaffold>
  );
}

function ReviewForm({
  bookingId,
  bookingPath,
  userId,
  hotel,
  initial,
}: {
  bookingId: string;
  bookingPath: string;
  userId?: string;
  hotel: string;
  initial?: Review;
}) {
  const client = useQueryClient();
  const [scores, setScores] = useState<
    Partial<Record<keyof typeof SCORES, number>>
  >(() =>
    initial
      ? Object.fromEntries(SCORE_KEYS.map((key) => [key, initial[key]]))
      : {},
  );
  const [selecting, setSelecting] = useState<(typeof CRITERIA)[number] | null>(
    null,
  );
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [imageId, setImageId] = useState<string>();
  const [error, setError] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      if (SCORE_KEYS.some((key) => scores[key] === undefined))
        throw new Error("Vui lòng chọn số sao và điểm cho tất cả tiêu chí.");
      if (!comment.trim()) throw new Error("Vui lòng nhập nhận xét.");
      const values = { ...scores, comment: comment.trim() };
      if (initial) {
        return (
          await apiClient.patch<Review>(
            `/reviews/me/${encodeURIComponent(initial.id)}`,
            values,
          )
        ).data;
      }
      const id =
        imageId ??
        (photo ? await uploadReviewImage(bookingPath, photo) : undefined);
      setImageId(id);
      return (
        await apiClient.post<Review>(bookingPath, {
          ...values,
          imageIds: id ? [id] : [],
        })
      ).data;
    },
    onSuccess: async (review) => {
      client.setQueryData(["review-booking", userId, bookingId], {
        hotelName: hotel,
        review,
        reviewDeleted: false,
      });
      await invalidateReviews(client, userId, bookingId);
      if (initial) go("my-reviews");
    },
    onError: (failure) => {
      setError(isAxiosError(failure) ? reviewError(failure) : failure.message);
      if (isAxiosError(failure) && failure.response?.status === 409)
        void client.invalidateQueries({
          queryKey: ["review-booking", userId, bookingId],
        });
    },
  });

  async function choosePhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled) return;
      setPhoto(result.assets[0]);
      setImageId(undefined);
    } catch {
      setError("Không thể mở thư viện ảnh.");
    }
  }

  return (
    <>
      <Card>
        <T weight="semibold">{hotel}</T>
        <T>Chọn từ 1 đến 5 sao cho trải nghiệm tổng thể.</T>
        {scores.rating ? (
          <T style={{ color: colors.muted }}>{scores.rating / 2}/5 sao</T>
        ) : null}
        <View style={reviewStyles.starRow}>
          {STARS.map((star) => (
            <Pressable
              key={star}
              accessibilityRole="button"
              accessibilityLabel={`${star} sao`}
              accessibilityState={{
                selected: Math.ceil((scores.rating ?? 0) / 2) === star,
                disabled: send.isPending,
              }}
              disabled={send.isPending}
              style={reviewStyles.starButton}
              onPress={() =>
                setScores((prev) => ({ ...prev, rating: star * 2 }))
              }
            >
              <T
                style={[
                  reviewStyles.star,
                  (scores.rating ?? 0) >= star * 2 && reviewStyles.starSelected,
                ]}
              >
                {(scores.rating ?? 0) >= star * 2 ? "★" : "☆"}
              </T>
            </Pressable>
          ))}
        </View>
      </Card>
      <View style={reviewStyles.criteria}>
        {CRITERIA.map((key) => (
          <View key={key} style={reviewStyles.criterion}>
            <T weight="semibold">{SCORES[key]}</T>
            <Button
              secondary
              label={scores[key] ? `${scores[key]}/10 ▾` : "Chọn điểm ▾"}
              disabled={send.isPending}
              onPress={() => setSelecting(key)}
            />
          </View>
        ))}
      </View>
      <Modal
        transparent
        visible={selecting !== null}
        onRequestClose={() => setSelecting(null)}
      >
        <View style={reviewStyles.backdrop}>
          <Card style={reviewStyles.picker}>
            <T weight="semibold">
              {selecting ? SCORES[selecting] : ""} · Chọn từ 1 đến 10
            </T>
            <View style={reviewStyles.criteria}>
              {POINTS.map((score) => (
                <Chip
                  key={score}
                  label={String(score)}
                  selected={selecting !== null && scores[selecting] === score}
                  onPress={() => {
                    if (selecting)
                      setScores((prev) => ({
                        ...prev,
                        [selecting]: score,
                      }));
                    setSelecting(null);
                  }}
                />
              ))}
            </View>
            <Button secondary label="Đóng" onPress={() => setSelecting(null)} />
          </Card>
        </View>
      </Modal>
      <Field
        label="Nhận xét"
        maxLength={2000}
        multiline
        editable={!send.isPending}
        value={comment}
        onChangeText={setComment}
      />
      {!initial ? (
        <>
          {photo ? (
            <Image
              source={{ uri: photo.uri }}
              style={{ width: "100%", height: 160, borderRadius: 12 }}
            />
          ) : null}
          <Button
            label={photo ? "Đổi ảnh" : "Thêm ảnh (tùy chọn)"}
            secondary
            disabled={send.isPending}
            onPress={() => void choosePhoto()}
          />
          {photo ? (
            <Button
              label="Bỏ ảnh"
              secondary
              disabled={send.isPending}
              onPress={() => {
                setPhoto(undefined);
                setImageId(undefined);
              }}
            />
          ) : null}
        </>
      ) : initial.images.length ? (
        <T style={{ color: colors.muted }}>Ảnh đã đính kèm được giữ nguyên.</T>
      ) : null}
      {error ? (
        <T accessibilityRole="alert" style={{ color: colors.error }}>
          {error}
        </T>
      ) : null}
      <Button
        label={
          send.isPending
            ? "Đang lưu…"
            : initial
              ? "Lưu thay đổi"
              : "Gửi đánh giá"
        }
        disabled={send.isPending}
        onPress={() => {
          setError("");
          send.mutate();
        }}
      />
    </>
  );
}

export function LiveMyReviews() {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === "api" ? session.userId : undefined;
  const client = useQueryClient();
  const [selected, setSelected] = useState<OwnReview | null>(null);
  const items = useQuery({
    queryKey: ["my-reviews", userId],
    queryFn: async () => (await apiClient.get<OwnReview[]>("/reviews/me")).data,
  });
  const remove = useMutation({
    mutationFn: (review: OwnReview) =>
      apiClient.delete(`/reviews/me/${encodeURIComponent(review.id)}`),
    onSuccess: async (_, review) => {
      client.setQueryData<OwnReview[]>(["my-reviews", userId], (reviews) =>
        reviews?.filter((item) => item.id !== review.id),
      );
      setSelected(null);
      await invalidateReviews(client, userId, review.bookingId);
    },
  });
  return (
    <TravelerScaffold title="Đánh giá của tôi" back>
      {items.isPending ? (
        <T>Đang tải đánh giá…</T>
      ) : items.isError ? (
        <Card>
          <T>{reviewError(items.error)}</T>
          <Button label="Thử lại" onPress={() => void items.refetch()} />
        </Card>
      ) : items.data.length ? (
        items.data.map((review) => (
          <View key={review.id} style={{ gap: 8 }}>
            <ReviewCard review={review} hotel={review.hotel.name} />
            {review.hiddenAt ? (
              <T style={{ color: colors.muted }}>Đánh giá này đang được ẩn.</T>
            ) : null}
            {review.moderationLockedAt ? (
              <T style={{ color: colors.muted }}>
                Đánh giá đang bị khóa kiểm duyệt.
              </T>
            ) : (
              <View style={reviewStyles.criteria}>
                <View style={reviewStyles.criterion}>
                  <Button
                    secondary
                    label="Sửa đánh giá"
                    onPress={() =>
                      go("edit-review", { bookingId: review.bookingId })
                    }
                  />
                </View>
                <View style={reviewStyles.criterion}>
                  <Button
                    secondary
                    label="Xóa đánh giá"
                    onPress={() => {
                      remove.reset();
                      setSelected(review);
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        ))
      ) : (
        <T>Bạn chưa gửi đánh giá nào.</T>
      )}
      <Modal
        transparent
        visible={selected !== null}
        onRequestClose={() => {
          if (!remove.isPending) setSelected(null);
        }}
      >
        <View style={reviewStyles.backdrop}>
          <Card style={reviewStyles.picker}>
            <T weight="semibold">Xóa đánh giá?</T>
            <T>
              Đánh giá của bạn sẽ bị gỡ khỏi trang khách sạn. Bạn không thể gửi
              lại đánh giá cho đơn này.
            </T>
            {remove.isError ? (
              <T accessibilityRole="alert" style={{ color: colors.error }}>
                {reviewError(remove.error)}
              </T>
            ) : null}
            <Button
              label={remove.isPending ? "Đang xóa…" : "Xác nhận xóa"}
              disabled={remove.isPending}
              onPress={() => {
                if (selected) remove.mutate(selected);
              }}
            />
            <Button
              secondary
              label="Giữ đánh giá"
              disabled={remove.isPending}
              onPress={() => setSelected(null)}
            />
          </Card>
        </View>
      </Modal>
    </TravelerScaffold>
  );
}

export function PublicHotelReviews({ hotelId }: { hotelId: string }) {
  const session = useTravelerStore((state) => state.session);
  const canReport =
    session?.mode === "api" &&
    (session.role === "USER" || session.role === "HOTEL_OWNER");
  const [target, setTarget] = useState<{
    review: Review;
    reply: boolean;
  } | null>(null);
  const items = useQuery({
    queryKey: ["public-hotel-reviews", hotelId],
    queryFn: async () =>
      (
        await apiClient.get<Review[]>(
          `/hotels/${encodeURIComponent(hotelId)}/reviews`,
        )
      ).data,
  });
  if (items.isPending) return <T>Đang tải đánh giá…</T>;
  if (items.isError)
    return (
      <Card>
        <T>Không tải được đánh giá.</T>
        <Button
          label="Thử lại"
          secondary
          onPress={() => void items.refetch()}
        />
      </Card>
    );
  if (!items.data.length) return <T>Chưa có đánh giá đã xác minh.</T>;
  return (
    <>
      {items.data.map((review) => (
        <View key={review.id} style={{ gap: 6 }}>
          <ReviewCard review={review} />
          {canReport ? (
            <Button
              compact
              secondary
              label="Báo cáo đánh giá"
              onPress={() => setTarget({ review, reply: false })}
            />
          ) : null}
          {canReport && review.reply ? (
            <Button
              compact
              secondary
              label="B?o c?o ph?n h?i"
              onPress={() => setTarget({ review, reply: true })}
            />
          ) : null}
        </View>
      ))}
      {canReport && target ? (
        <ReportReviewDialog
          key={target.review.id}
          review={target.review}
          reply={target.reply}
          close={() => setTarget(null)}
        />
      ) : null}
    </>
  );
}

function ReportReviewDialog({
  review,
  reply,
  close,
}: {
  review: Review;
  reply: boolean;
  close: () => void;
}) {
  const [reason, setReason] = useState<ContentReportReason>();
  const [description, setDescription] = useState("");
  const report = useMutation({
    mutationFn: async () =>
      reply
        ? (
            await apiClient.post<{ status?: string }>(
              `/reviews/${encodeURIComponent(review.id)}/reply/report`,
              {
                category: reason,
                reason:
                  description.trim() ||
                  (reason ? CONTENT_REPORT_REASONS[reason] : ""),
              },
            )
          ).data
        : (
            await apiClient.post<{ status: string }>("/content-reports", {
              targetType: "REVIEW",
              targetId: review.id,
              reason,
              description: description.trim(),
            })
          ).data,
  });
  return (
    <Modal
      transparent
      visible
      onRequestClose={() => {
        if (!report.isPending) close();
      }}
    >
      <View style={reviewStyles.backdrop}>
        <Card style={reviewStyles.picker}>
          <T weight="semibold">Báo cáo đánh giá</T>
          {report.isSuccess ? (
            <T accessibilityRole="alert">
              {report.data.status === "ALREADY_HANDLED"
                ? "Đánh giá đã được gỡ. Bạn không cần gửi báo cáo."
                : "Đã gửi báo cáo cho quản trị viên."}
            </T>
          ) : (
            <>
              <View style={reviewStyles.criteria}>
                {(
                  Object.keys(CONTENT_REPORT_REASONS) as ContentReportReason[]
                ).map((item) => (
                  <Chip
                    key={item}
                    selected={reason === item}
                    label={CONTENT_REPORT_REASONS[item]}
                    onPress={() => {
                      if (!report.isPending) setReason(item);
                    }}
                  />
                ))}
              </View>
              <Field
                label={
                  reason === "OTHER"
                    ? "Mô tả lý do"
                    : "Mô tả bổ sung (tùy chọn)"
                }
                value={description}
                onChangeText={setDescription}
                maxLength={reply ? 500 : 1000}
                multiline
                editable={!report.isPending}
              />
              {report.isError ? (
                <T accessibilityRole="alert" style={{ color: colors.error }}>
                  {reviewError(report.error)}
                </T>
              ) : null}
              <Button
                label={report.isPending ? "Đang gửi…" : "Gửi báo cáo"}
                disabled={
                  report.isPending ||
                  !reason ||
                  (reason === "OTHER" && !description.trim())
                }
                onPress={() => report.mutate()}
              />
            </>
          )}
          <Button
            secondary
            label="Đóng"
            disabled={report.isPending}
            onPress={close}
          />
        </Card>
      </View>
    </Modal>
  );
}

const reviewStyles = StyleSheet.create({
  starRow: { flexDirection: "row", flexWrap: "wrap" },
  starButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  star: { fontSize: 30, lineHeight: 36, color: colors.muted },
  starSelected: { color: colors.orange },
  criteria: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  criterion: { flexBasis: "45%", flexGrow: 1, gap: 6 },
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  picker: { width: "100%", maxWidth: 420, gap: 14 },
});

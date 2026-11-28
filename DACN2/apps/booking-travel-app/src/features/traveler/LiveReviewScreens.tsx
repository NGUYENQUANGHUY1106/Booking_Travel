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
  images: string[];
  createdAt: string;
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

export function LiveWriteReview({ bookingId }: { bookingId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === "api" ? session.userId : undefined;
  const client = useQueryClient();
  const bookingPath = `/reviews/bookings/${encodeURIComponent(bookingId ?? "")}`;
  const queryKey = ["review-booking", userId, bookingId];
  const status = useQuery({
    queryKey,
    queryFn: async () =>
      (
        await apiClient.get<{ hotelName: string; review: Review | null }>(
          bookingPath,
        )
      ).data,
    enabled: Boolean(bookingId && userId),
    retry: false,
  });
  const [scores, setScores] = useState<
    Partial<Record<keyof typeof SCORES, number>>
  >({});
  const [selecting, setSelecting] = useState<(typeof CRITERIA)[number] | null>(
    null,
  );
  const [comment, setComment] = useState("");
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset>();
  const [imageId, setImageId] = useState<string>();
  const [error, setError] = useState("");
  const send = useMutation({
    mutationFn: async () => {
      if (SCORE_KEYS.some((key) => scores[key] === undefined))
        throw new Error("Vui lòng chọn số sao và điểm cho tất cả tiêu chí.");
      if (!comment.trim()) throw new Error("Vui lòng nhập nhận xét.");
      const id =
        imageId ??
        (photo ? await uploadReviewImage(bookingPath, photo) : undefined);
      setImageId(id);
      return (
        await apiClient.post<Review>(bookingPath, {
          ...scores,
          comment: comment.trim(),
          imageIds: id ? [id] : [],
        })
      ).data;
    },
    onSuccess: (review) => {
      if (status.data)
        client.setQueryData(queryKey, { ...status.data, review });
      void client.invalidateQueries({ queryKey: ["my-reviews", userId] });
      void client.invalidateQueries({ queryKey: ["public-hotel-reviews"] });
      void client.invalidateQueries({ queryKey: ["public-hotel"] });
      void client.invalidateQueries({ queryKey: ["public-hotel-discovery"] });
      void client.invalidateQueries({ queryKey: ["public-hotels"] });
    },
    onError: (failure) => {
      setError(isAxiosError(failure) ? reviewError(failure) : failure.message);
      if (isAxiosError(failure) && failure.response?.status === 409)
        void status.refetch();
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
    <TravelerScaffold title="Viết đánh giá" back>
      {!bookingId ? (
        <T>Hãy chọn một đặt phòng đã hoàn tất.</T>
      ) : status.isPending ? (
        <T>Đang kiểm tra đặt phòng…</T>
      ) : status.isError ? (
        <Card>
          <T>{reviewError(status.error)}</T>
          <Button label="Thử lại" onPress={() => void status.refetch()} />
        </Card>
      ) : status.data.review ? (
        <>
          <T weight="semibold">Đánh giá của bạn đã được gửi.</T>
          <ReviewCard
            hotel={status.data.hotelName}
            review={status.data.review}
          />
          <Button
            label="Xem đánh giá của tôi"
            onPress={() => go("my-reviews")}
          />
        </>
      ) : (
        <>
          <Card>
            <T weight="semibold">{status.data.hotelName}</T>
            <T>Chọn từ 1 đến 5 sao cho trải nghiệm tổng thể.</T>
            <View style={reviewStyles.starRow}>
              {STARS.map((star) => (
                <Pressable
                  key={star}
                  accessibilityRole="button"
                  accessibilityLabel={`${star} sao`}
                  accessibilityState={{
                    selected: scores.rating === star * 2,
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
                      (scores.rating ?? 0) >= star * 2 &&
                        reviewStyles.starSelected,
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
                      selected={
                        selecting !== null && scores[selecting] === score
                      }
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
                <Button
                  secondary
                  label="Đóng"
                  onPress={() => setSelecting(null)}
                />
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
          {error ? (
            <T accessibilityRole="alert" style={{ color: colors.error }}>
              {error}
            </T>
          ) : null}
          <Button
            label={send.isPending ? "Đang gửi…" : "Gửi đánh giá"}
            disabled={send.isPending}
            onPress={() => {
              setError("");
              send.mutate();
            }}
          />
        </>
      )}
    </TravelerScaffold>
  );
}

export function LiveMyReviews() {
  const session = useTravelerStore((state) => state.session);
  const items = useQuery({
    queryKey: [
      "my-reviews",
      session?.mode === "api" ? session.userId : undefined,
    ],
    queryFn: async () => (await apiClient.get<OwnReview[]>("/reviews/me")).data,
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
          <ReviewCard
            key={review.id}
            review={review}
            hotel={review.hotel.name}
          />
        ))
      ) : (
        <T>Bạn chưa gửi đánh giá nào.</T>
      )}
    </TravelerScaffold>
  );
}

export function PublicHotelReviews({ hotelId }: { hotelId: string }) {
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
        <ReviewCard key={review.id} review={review} />
      ))}
    </>
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

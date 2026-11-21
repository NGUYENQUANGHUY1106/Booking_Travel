import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { useTravelerStore } from "@/features/traveler/store";
import {
  Button,
  Card,
  Chip,
  Field,
  T,
  TravelerScaffold,
  go,
} from "@/features/traveler/ui";
import { colors } from "@/features/traveler/theme";
import {
  createHotelReport,
  hotelReportError,
  type HotelReportReason,
} from "./api";

const REASONS: { value: HotelReportReason; label: string }[] = [
  { value: "INCORRECT_INFORMATION", label: "Thông tin không đúng" },
  { value: "MISLEADING_IMAGES", label: "Hình ảnh gây hiểu nhầm" },
  { value: "FRAUD", label: "Dấu hiệu gian lận" },
  { value: "SAFETY", label: "An toàn lưu trú" },
  { value: "OTHER", label: "Lý do khác" },
];

export function HotelReportScreen({
  bookingId,
  hotelId,
}: {
  bookingId?: string;
  hotelId: string;
}) {
  const session = useTravelerStore((state) => state.session);
  const [reason, setReason] = useState<HotelReportReason>(
    "INCORRECT_INFORMATION",
  );
  const [description, setDescription] = useState("");
  const report = useMutation({
    mutationFn: () =>
      createHotelReport({
        bookingId: bookingId!,
        hotelId,
        reason,
        description: description.trim(),
      }),
  });

  if (report.data)
    return (
      <TravelerScaffold title="Đã gửi báo cáo" back>
        <Card>
          <T weight="semibold">Báo cáo đã chuyển thẳng đến Admin tổng.</T>
          <T>Mã báo cáo: {report.data.id}</T>
          <T>Trạng thái: Đang mở</T>
          <T style={{ color: colors.muted }}>
            Chủ khách sạn không được xem danh tính người báo cáo.
          </T>
        </Card>
        <Button
          label="Về danh sách đặt phòng"
          onPress={() => go("my-bookings")}
        />
      </TravelerScaffold>
    );

  if (session?.mode !== "api")
    return (
      <TravelerScaffold title="Báo cáo khách sạn" back>
        <Card>
          <T>Bạn cần đăng nhập tài khoản thật để gửi báo cáo.</T>
        </Card>
        <Button label="Đăng nhập" onPress={() => go("profile")} />
      </TravelerScaffold>
    );

  if (!bookingId)
    return (
      <TravelerScaffold title="Báo cáo khách sạn" back>
        <Card>
          <T weight="semibold">Chưa có kỳ lưu trú đủ điều kiện.</T>
          <T>Chỉ khách đã hoàn thành kỳ lưu trú mới được báo cáo khách sạn.</T>
        </Card>
        <Button
          label="Xem đặt phòng của tôi"
          onPress={() => go("my-bookings")}
        />
      </TravelerScaffold>
    );

  return (
    <TravelerScaffold
      title="Báo cáo khách sạn"
      back
      footer={
        <Button
          label={report.isPending ? "Đang gửi..." : "Gửi báo cáo đến Admin"}
          disabled={description.trim().length < 10 || report.isPending}
          onPress={() => report.mutate()}
        />
      }
    >
      <Card>
        <T weight="semibold">Booking đã hoàn thành</T>
        <T style={{ color: colors.muted }}>
          Admin sẽ đối chiếu báo cáo với booking này trước khi xử lý.
        </T>
      </Card>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {REASONS.map((item) => (
          <Chip
            key={item.value}
            label={item.label}
            selected={reason === item.value}
            onPress={() => setReason(item.value)}
          />
        ))}
      </View>
      <Field
        label="Mô tả chi tiết"
        multiline
        maxLength={1000}
        value={description}
        onChangeText={setDescription}
        placeholder="Mô tả sự việc (ít nhất 10 ký tự)"
      />
      <T style={{ color: colors.muted }}>
        {description.trim().length}/1000 ký tự
      </T>
      {report.error ? (
        <T accessibilityRole="alert" style={{ color: colors.error }}>
          {hotelReportError(report.error)}
        </T>
      ) : null}
    </TravelerScaffold>
  );
}

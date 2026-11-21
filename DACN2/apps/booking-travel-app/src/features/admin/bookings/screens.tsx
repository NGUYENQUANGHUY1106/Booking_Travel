import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useTravelerStore } from "@/features/traveler/store";
import { AdminText } from "../dashboard/components";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPage,
  AdminRow,
  openAdminDetail,
} from "../shared/ui";
import { getAdminBooking, listAdminBookings } from "./api";

const BOOKING_STATUS: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  CONFIRMED: "Đã xác nhận",
  EXPIRED: "Hết hạn",
  CHECKED_IN: "Đã nhận phòng",
  COMPLETED: "Hoàn tất",
  CANCELLED: "Đã hủy",
  REFUND_PENDING: "Chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
};
const PAYMENT_STATUS: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thu tại chỗ",
  SUCCESS: "Thanh toán thành công",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  PARTIALLY_REFUNDED: "Hoàn một phần",
  REFUNDED: "Đã hoàn",
};
const REFUND_STATUS: Record<string, string> = {
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PROCESSING: "Đang xử lý",
  FAILED: "Thất bại",
  REJECTED: "Từ chối",
  COMPLETED: "Hoàn tất",
};
const DATE_FIELDS: Record<string, string> = {
  createdAt: "Ngày tạo",
  checkIn: "Ngày nhận phòng",
  checkOut: "Ngày trả phòng",
};
const RATE_SOURCE: Record<string, string> = {
  BASE: "Giá cơ bản",
  DATE: "Giá theo ngày",
  HOLIDAY: "Giá ngày lễ",
  SEASON: "Giá theo mùa",
  WEEKDAY: "Giá ngày thường",
  WEEKEND: "Giá cuối tuần",
};
const rowStyle = {
  flexDirection: "row" as const,
  flexWrap: "wrap" as const,
  gap: 8,
};
const muted = { color: "#57697D", fontSize: 13, lineHeight: 20 };

function money(value: string, currency: string) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(
        amount,
      ) + (currency === "VND" ? " ₫" : ` ${currency}`)
    : "Chưa xác định";
}

function day(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}
function nightlyRateLines(snapshot: unknown, currency: string): string[] {
  if (!Array.isArray(snapshot) || snapshot.length === 0)
    return ["Chưa có dữ liệu giá từng đêm."];

  const lines = snapshot.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const rate = item as Record<string, unknown>;
    if (
      typeof rate.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(rate.date) ||
      Number.isNaN(Date.parse(`${rate.date}T00:00:00Z`)) ||
      new Date(`${rate.date}T00:00:00Z`).toISOString().slice(0, 10) !==
        rate.date ||
      (typeof rate.price !== "string" && typeof rate.price !== "number") ||
      !Number.isFinite(Number(rate.price)) ||
      Number(rate.price) <= 0
    )
      return null;

    const source =
      typeof rate.source === "string" ? RATE_SOURCE[rate.source] : undefined;
    const rule =
      typeof rate.ruleId === "string" && rate.ruleId
        ? ` · Mã quy tắc: ${rate.ruleId}`
        : "";
    return `${day(rate.date)} · ${money(String(rate.price), currency)}${source ? ` · ${source}` : ""}${rule}`;
  });
  const valid = lines.filter((line): line is string => line !== null);
  if (valid.length < lines.length)
    valid.push("Một số mức giá đã lưu không đọc được.");
  return valid;
}

function refundRuleLines(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot) || snapshot.length === 0)
    return ["Chưa có quy tắc hoàn tiền được lưu."];

  const rules = snapshot.map((item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const rule = item as Record<string, unknown>;
    if (
      !Number.isInteger(rule.minimumHoursBeforeCheckIn) ||
      Number(rule.minimumHoursBeforeCheckIn) < 0 ||
      Number(rule.minimumHoursBeforeCheckIn) > 8760 ||
      !Number.isInteger(rule.refundPercent) ||
      Number(rule.refundPercent) < 0 ||
      Number(rule.refundPercent) > 100
    )
      return null;
    return {
      hours: Number(rule.minimumHoursBeforeCheckIn),
      percent: Number(rule.refundPercent),
    };
  });
  if (rules.some((rule) => rule === null))
    return ["Quy tắc hoàn tiền đã lưu không đúng định dạng."];

  const sorted = (rules as { hours: number; percent: number }[]).sort(
    (a, b) => a.hours - b.hours,
  );
  if (
    sorted[0].hours !== 0 ||
    sorted.some(
      (rule, index) =>
        index > 0 &&
        (rule.hours === sorted[index - 1].hours ||
          rule.percent < sorted[index - 1].percent),
    )
  )
    return [
      "Quy tắc hoàn tiền đã lưu không hợp lệ; hệ thống không tự tính mức hoàn.",
    ];
  return sorted.map((rule, index) => {
    const next = sorted[index + 1];
    const timing =
      rule.hours === 0
        ? next
          ? `Hủy trước hoặc đúng giờ nhận phòng, nhưng dưới ${next.hours} giờ`
          : "Hủy trước hoặc đúng giờ nhận phòng"
        : next
          ? `Hủy trước giờ nhận phòng từ ${rule.hours} đến dưới ${next.hours} giờ`
          : `Hủy trước giờ nhận phòng ít nhất ${rule.hours} giờ`;
    return `${timing}: hoàn ${rule.percent}% số tiền đã thanh toán (nếu có).`;
  });
}
function instant(value: string) {
  return `${new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} (VN)`;
}
function errorText(error: unknown) {
  if (isAxiosError(error)) {
    if (error.response?.status === 403)
      return "Bạn không có quyền BOOKING_SUPPORT.";
    if (error.response?.status === 404) return "Không tìm thấy booking này.";
    if (error.response?.status === 401) return "Phiên đăng nhập đã hết hạn.";
    const response = error.response?.data as
      { message?: string | string[] } | undefined;
    if (typeof response?.message === "string") return response.message;
    if (Array.isArray(response?.message)) return response.message.join(" ");
  }
  return "Không tải được dữ liệu. Kiểm tra kết nối và thử lại.";
}
function validDay(value: string) {
  return (
    !value ||
    (/^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value)
  );
}

export function BookingsScreen() {
  const params = useLocalSearchParams<{
    page?: string;
    q?: string;
    status?: string;
    hotelId?: string;
    userId?: string;
    dateField?: string;
    from?: string;
    to?: string;
    paymentStatus?: string;
    refundStatus?: string;
    sort?: string;
  }>();
  const session = useTravelerStore((state) => state.session);
  const apiMode = session?.mode === "api" && session.role === "ADMIN";
  const page = Math.max(1, Number(params.page) || 1);
  const [draft, setDraft] = useState({
    q: params.q ?? "",
    hotelId: params.hotelId ?? "",
    userId: params.userId ?? "",
    from: params.from ?? "",
    to: params.to ?? "",
  });
  const [validation, setValidation] = useState("");
  const filter = {
    search: params.q || undefined,
    status: params.status || undefined,
    hotelId: params.hotelId || undefined,
    userId: params.userId || undefined,
    dateField: params.dateField || "createdAt",
    from: params.from || undefined,
    to: params.to || undefined,
    paymentStatus: params.paymentStatus || undefined,
    refundStatus: params.refundStatus || undefined,
    sort: params.sort || "newest",
    page,
    limit: 20,
  };
  const query = useQuery({
    queryKey: [
      "admin-bookings",
      session?.mode === "api" ? session.userId : "",
      filter,
    ],
    queryFn: () => listAdminBookings(filter),
    enabled: apiMode,
    staleTime: 0,
  });
  const update = (values: Record<string, string>) =>
    router.setParams({ ...values, page: "1" });
  const apply = () => {
    if (
      !validDay(draft.from) ||
      !validDay(draft.to) ||
      (draft.from && draft.to && draft.from > draft.to)
    ) {
      setValidation(
        "Khoảng ngày không hợp lệ. Dùng YYYY-MM-DD và ngày bắt đầu không sau ngày kết thúc.",
      );
      return;
    }
    setValidation("");
    update({
      q: draft.q.trim(),
      hotelId: draft.hotelId.trim(),
      userId: draft.userId.trim(),
      from: draft.from.trim(),
      to: draft.to.trim(),
    });
  };
  return (
    <AdminPage
      title="Giám sát đặt phòng"
      subtitle="Booking và trạng thái thanh toán từ hệ thống; Admin chỉ giám sát, không sửa booking."
    >
      {!apiMode ? (
        <AdminCard>
          <AdminText>
            Đăng nhập bằng tài khoản Admin thật để xem booking toàn hệ thống.
          </AdminText>
        </AdminCard>
      ) : (
        <>
          {query.data?.items[0] ? (
            <>
              <AdminCard
                style={{
                  maxWidth: 340,
                  borderWidth: 1,
                  borderColor: "#E5E7EB",
                  borderRadius: 16,
                }}
              >
                <AdminText weight="semibold">
                  {query.data.items[0].hotelName}
                </AdminText>
                <AdminText style={muted}>
                  {day(query.data.items[0].checkIn)}–
                  {day(query.data.items[0].checkOut)} ·{" "}
                  {query.data.items[0].guests} khách
                </AdminText>
                <AdminText
                  weight="semibold"
                  style={{
                    color: ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(
                      query.data.items[0].status,
                    )
                      ? "#15803D"
                      : "#B85C14",
                  }}
                >
                  ●{" "}
                  {BOOKING_STATUS[query.data.items[0].status] ??
                    query.data.items[0].status}
                </AdminText>
                <AdminText weight="bold">
                  Tổng cộng{" "}
                  {money(
                    query.data.items[0].totalAmount,
                    query.data.items[0].currency,
                  )}
                </AdminText>
              </AdminCard>
              <AdminCard title={`Booking ${query.data.items[0].code}`}>
                <AdminText style={muted}>
                  Trạng thái và thanh toán từ hệ thống; Admin giám sát, không
                  tùy ý sửa booking.
                </AdminText>
              </AdminCard>
            </>
          ) : null}
          <AdminCard title="Tìm kiếm và lọc booking">
            <View style={rowStyle}>
              <AdminInput
                label="Mã booking hoặc ID"
                value={draft.q}
                onChangeText={(q) => setDraft((v) => ({ ...v, q }))}
                placeholder="BT-..."
              />
              <AdminInput
                label="ID khách sạn"
                value={draft.hotelId}
                onChangeText={(hotelId) => setDraft((v) => ({ ...v, hotelId }))}
                placeholder="Hotel ID"
              />
              <AdminInput
                label="ID người đặt"
                value={draft.userId}
                onChangeText={(userId) => setDraft((v) => ({ ...v, userId }))}
                placeholder="User ID"
              />
            </View>
            <AdminText weight="semibold">
              Loại ngày: {DATE_FIELDS[filter.dateField]}
            </AdminText>
            <View style={rowStyle}>
              {Object.entries(DATE_FIELDS).map(([key, label]) => (
                <AdminButton
                  key={key}
                  label={label}
                  variant={filter.dateField === key ? "primary" : "outline"}
                  onPress={() => update({ dateField: key })}
                />
              ))}
            </View>
            <View style={rowStyle}>
              <AdminInput
                label="Từ ngày (YYYY-MM-DD)"
                value={draft.from}
                onChangeText={(from) => setDraft((v) => ({ ...v, from }))}
                placeholder="YYYY-MM-DD"
              />
              <AdminInput
                label="Đến ngày (YYYY-MM-DD)"
                value={draft.to}
                onChangeText={(to) => setDraft((v) => ({ ...v, to }))}
                placeholder="YYYY-MM-DD"
              />
            </View>
            {validation ? (
              <AdminText style={{ color: "#B91C1C" }}>{validation}</AdminText>
            ) : null}
            <View style={rowStyle}>
              <AdminButton label="Áp dụng bộ lọc" onPress={apply} />
              <AdminButton
                label={filter.sort === "newest" ? "Mới nhất" : "Cũ nhất"}
                variant="outline"
                onPress={() =>
                  update({
                    sort: filter.sort === "newest" ? "oldest" : "newest",
                  })
                }
              />
              <AdminButton
                label="Làm mới"
                variant="outline"
                onPress={() => void query.refetch()}
              />
            </View>
            <AdminText weight="semibold">Trạng thái booking</AdminText>
            <View style={rowStyle}>
              {[["", "Tất cả"], ...Object.entries(BOOKING_STATUS)].map(
                ([key, label]) => (
                  <AdminButton
                    key={key || "all"}
                    label={label}
                    variant={
                      (params.status || "") === key ? "primary" : "outline"
                    }
                    onPress={() => update({ status: key })}
                  />
                ),
              )}
            </View>
            <AdminText weight="semibold">Thanh toán</AdminText>
            <View style={rowStyle}>
              {[["", "Tất cả"], ...Object.entries(PAYMENT_STATUS)].map(
                ([key, label]) => (
                  <AdminButton
                    key={key || "all"}
                    label={label}
                    variant={
                      (params.paymentStatus || "") === key
                        ? "primary"
                        : "outline"
                    }
                    onPress={() => update({ paymentStatus: key })}
                  />
                ),
              )}
            </View>
            <AdminText weight="semibold">Hoàn tiền</AdminText>
            <View style={rowStyle}>
              {[["", "Tất cả"], ...Object.entries(REFUND_STATUS)].map(
                ([key, label]) => (
                  <AdminButton
                    key={key || "all"}
                    label={label}
                    variant={
                      (params.refundStatus || "") === key
                        ? "primary"
                        : "outline"
                    }
                    onPress={() => update({ refundStatus: key })}
                  />
                ),
              )}
            </View>
          </AdminCard>
          {query.isPending ? (
            <AdminCard>
              <ActivityIndicator color="#2563EB" />
              <AdminText>Đang tải booking...</AdminText>
            </AdminCard>
          ) : null}
          {query.isError ? (
            <AdminCard title="Không thể tải booking">
              <AdminText style={{ color: "#B91C1C" }}>
                {errorText(query.error)}
              </AdminText>
              <AdminButton
                label="Thử lại"
                onPress={() => void query.refetch()}
              />
            </AdminCard>
          ) : null}
          {query.data ? (
            <AdminCard
              title={`Danh sách đặt phòng · ${query.data.total} kết quả`}
            >
              {query.isFetching ? (
                <AdminText style={muted}>Đang cập nhật...</AdminText>
              ) : null}
              {query.data.items.length === 0 ? (
                <AdminText>Không có booking phù hợp với bộ lọc.</AdminText>
              ) : (
                query.data.items.map((item) => (
                  <AdminRow
                    key={item.id}
                    title={`${item.code} · ${item.hotelName}`}
                    subtitle={`${item.roomName} · ${day(item.checkIn)}–${day(item.checkOut)} · ${item.guests} khách · ${item.guest}\n${BOOKING_STATUS[item.status] ?? item.status} · ${item.paymentMethod === "PAY_AT_HOTEL" ? "Trả tại khách sạn" : `Giao dịch gần nhất: ${PAYMENT_STATUS[item.paymentStatus ?? ""] ?? "Chưa có"}`}${item.refundStatus ? ` · Hoàn tiền: ${REFUND_STATUS[item.refundStatus] ?? item.refundStatus}` : ""}\nCập nhật ${instant(item.updatedAt)}`}
                    status={money(item.totalAmount, item.currency)}
                    onPress={() => openAdminDetail("bookings", item.id)}
                  />
                ))
              )}
              <View style={rowStyle}>
                <AdminText style={muted}>
                  Trang {page}/
                  {Math.max(1, Math.ceil(query.data.total / query.data.limit))}
                </AdminText>
                <AdminButton
                  label="Trước"
                  variant="outline"
                  disabled={page <= 1}
                  onPress={() => router.setParams({ page: String(page - 1) })}
                />
                <AdminButton
                  label="Sau"
                  variant="outline"
                  disabled={page * query.data.limit >= query.data.total}
                  onPress={() => router.setParams({ page: String(page + 1) })}
                />
              </View>
            </AdminCard>
          ) : null}
        </>
      )}
    </AdminPage>
  );
}

export function BookingDetailScreen({ id }: { id: string }) {
  const session = useTravelerStore((state) => state.session);
  const apiMode = session?.mode === "api" && session.role === "ADMIN";
  const query = useQuery({
    queryKey: [
      "admin-booking-detail",
      session?.mode === "api" ? session.userId : "",
      id,
    ],
    queryFn: () => getAdminBooking(id),
    enabled: apiMode && Boolean(id),
    staleTime: 0,
  });
  const back = () =>
    router.canGoBack() ? router.back() : router.replace("/admin/bookings");
  const result = query.data;
  const booking = result?.booking;
  return (
    <AdminPage
      title="Chi tiết đặt phòng"
      subtitle="Trạng thái và thanh toán từ hệ thống; Admin giám sát, không tùy ý sửa booking."
      trailing={
        <AdminButton label="Quay lại" variant="outline" onPress={back} />
      }
    >
      {!apiMode ? (
        <AdminCard>
          <AdminText>
            Chỉ Admin có quyền BOOKING_SUPPORT được xem chi tiết.
          </AdminText>
        </AdminCard>
      ) : null}
      {query.isPending && apiMode ? (
        <AdminCard>
          <ActivityIndicator color="#2563EB" />
          <AdminText>Đang tải chi tiết booking...</AdminText>
        </AdminCard>
      ) : null}
      {query.isError ? (
        <AdminCard title="Không thể tải chi tiết">
          <AdminText style={{ color: "#B91C1C" }}>
            {errorText(query.error)}
          </AdminText>
          <AdminButton label="Thử lại" onPress={() => void query.refetch()} />
        </AdminCard>
      ) : null}
      {booking && result ? (
        <>
          <AdminCard title={`Booking ${booking.code}`}>
            <AdminText weight="semibold">{booking.hotelNameSnapshot}</AdminText>
            <AdminText>
              {day(booking.checkIn)}–{day(booking.checkOut)} · {booking.nights}{" "}
              đêm · {booking.adults + booking.children} khách
            </AdminText>
            <AdminText weight="semibold">
              ● {BOOKING_STATUS[booking.status] ?? booking.status}
            </AdminText>
            <AdminText weight="bold">
              Tổng cộng {money(booking.totalAmount, booking.currency)}
            </AdminText>
            <AdminText style={muted}>
              ID: {booking.id} · Tạo {instant(booking.createdAt)}
            </AdminText>
          </AdminCard>
          <AdminCard title="Khách sạn và khách">
            <AdminRow
              title="Khách sạn lúc đặt"
              subtitle={`${booking.hotelNameSnapshot} · ${booking.hotelAddressSnapshot}`}
            />
            <AdminRow
              title="Khách sạn hiện tại"
              subtitle={`${booking.hotel.name} · ${booking.hotel.status} · ID ${booking.hotelId}`}
            />
            <AdminRow
              title="Chủ khách sạn"
              subtitle={`${booking.hotel.owner.fullName} · ID ${booking.hotel.ownerId}`}
            />
            <AdminRow
              title="Người đặt"
              subtitle={`${booking.user.fullName} · ID ${booking.userId}`}
            />
            <AdminRow
              title="Khách lưu trú"
              subtitle={`${booking.guestName} · ${booking.guestEmail}${booking.guestPhone ? ` · ${booking.guestPhone}` : ""}`}
            />
            <AdminRow
              title="Phòng lúc đặt"
              subtitle={`${booking.roomNameSnapshot} · ${booking.roomTypeSnapshot} · ${booking.roomCount} phòng · ID ${booking.roomId}`}
            />
          </AdminCard>
          <AdminCard title="Giá và chính sách đã chốt">
            <AdminText>
              Giá tham chiếu/đêm:{" "}
              {money(booking.pricePerNight, booking.currency)}
            </AdminText>
            <AdminText>
              Tổng tiền: {money(booking.totalAmount, booking.currency)}
            </AdminText>
            <AdminText weight="semibold">Giá từng đêm (mỗi phòng)</AdminText>
            {nightlyRateLines(
              booking.nightlyRatesSnapshot,
              booking.currency,
            ).map((line, index) => (
              <AdminText key={`nightly-rate-${index}`} style={muted}>
                • {line}
              </AdminText>
            ))}
            <AdminText style={muted}>
              Chính sách hủy:{" "}
              {booking.cancellationPolicySnapshot || "Chưa có dữ liệu"}
            </AdminText>
            <AdminText weight="semibold">Quy tắc hoàn tiền</AdminText>
            {refundRuleLines(booking.refundRulesSnapshot).map((line, index) => (
              <AdminText key={`refund-rule-${index}`} style={muted}>
                • {line}
              </AdminText>
            ))}
            <AdminText style={muted}>
              Giờ nhận phòng dự kiến:{" "}
              {booking.checkInTimeSnapshot || "Chưa có dữ liệu"}
            </AdminText>
            {booking.cancellationReason ? (
              <AdminText>Lý do hủy: {booking.cancellationReason}</AdminText>
            ) : null}
          </AdminCard>
          <AdminCard title="Thanh toán và hoàn tiền">
            <AdminText>
              Phương thức:{" "}
              {booking.paymentMethod === "PAY_AT_HOTEL"
                ? "Trả tại khách sạn"
                : "Trực tuyến"}
            </AdminText>
            <AdminText>
              Đã thu trực tuyến:{" "}
              {money(result.capturedOnlineAmount, booking.currency)} · Đã hoàn:{" "}
              {money(result.refundedAmount, booking.currency)}
            </AdminText>
            {result.needsReconciliation ? (
              <AdminText style={{ color: "#B85C14" }}>
                Có giao dịch cần đối soát.
              </AdminText>
            ) : null}
            <AdminText style={muted}>
              Hạn thanh toán dự kiến:{" "}
              {booking.paymentDeadline
                ? instant(booking.paymentDeadline)
                : "Không có"}
            </AdminText>
            <AdminText weight="semibold">
              Giao dịch ({result.paymentCount})
            </AdminText>
            {result.payments.length === 0 ? (
              <AdminText>Chưa có giao dịch.</AdminText>
            ) : (
              result.payments.map((payment) => (
                <AdminRow
                  key={payment.id}
                  title={`${PAYMENT_STATUS[payment.status] ?? payment.status} · ${money(payment.amount, payment.currency)}`}
                  subtitle={[
                    `Provider: ${payment.provider || "Không có"}`,
                    payment.reference && `Ref: ${payment.reference}`,
                    payment.merchantReference && `Merchant ref: ${payment.merchantReference}`,
                    payment.providerTxnId && `Provider txn: ${payment.providerTxnId}`,
                    `ID ${payment.id}`,
                  ].filter(Boolean).join(' · ')}
                  onPress={() => openAdminDetail("payments", payment.id)}
                />
              ))
            )}
            <AdminText weight="semibold">
              Yêu cầu hoàn ({result.refundCount})
            </AdminText>
            {result.refunds.length === 0 ? (
              <AdminText>Chưa có yêu cầu hoàn.</AdminText>
            ) : (
              result.refunds.map((refund) => (
                <AdminRow
                  key={refund.id}
                  title={`${REFUND_STATUS[refund.status] ?? refund.status} · ${refund.amount ? money(refund.amount, refund.currency) : "Chờ xử lý thủ công"}`}
                  subtitle={`Ref: ${refund.providerRefundRef || "Chưa có"} · ${refund.reason} · ID ${refund.id}`}
                  onPress={() => openAdminDetail("refunds", refund.id)}
                />
              ))
            )}
          </AdminCard>
          <AdminCard title="Dòng thời gian có thể truy vết">
            {result.timeline.map((event) => (
              <AdminRow
                key={event.id}
                title={`${event.kind === "scheduled" ? "Dự kiến" : "Thực tế"} · ${event.label}`}
                subtitle={`${instant(event.at)} · ${event.source}${event.actorId ? ` · Actor ${event.actorId}` : ""}${event.referenceId ? ` · Ref ${event.referenceId}` : ""}`}
              />
            ))}
            {result.dataGaps.map((gap) => (
              <AdminText key={gap} style={muted}>
                Chưa có dữ liệu: {gap}
              </AdminText>
            ))}
          </AdminCard>
          <AdminButton
            label="Làm mới chi tiết"
            variant="outline"
            onPress={() => void query.refetch()}
          />
        </>
      ) : null}
    </AdminPage>
  );
}

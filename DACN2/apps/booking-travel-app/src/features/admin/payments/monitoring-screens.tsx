import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Modal, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { bookingApiError } from "@/features/traveler/booking-quote-api";
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

type Page<T> = { items: T[]; total: number; page: number; limit: number };
type PaymentItem = {
  id: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  hotelName: string;
  guest: string;
  provider: string | null;
  reference: string | null;
  merchantReference: string | null;
  providerTxnId: string | null;
  amount: string;
  currency: string;
  status: string;
  reconciliationRequired: boolean;
  createdAt: string;
  updatedAt: string;
};
type RefundItem = {
  id: string;
  bookingId: string;
  bookingCode: string;
  hotelName: string;
  paymentId: string;
  provider: string;
  providerRefundRef: string | null;
  amount: string | null;
  currency: string;
  reason: string;
  status: string;
  reviewReason: string | null;
  createdAt: string;
};
type PaymentDetail = PaymentItem & {
  booking: {
    id: string;
    code: string;
    status: string;
    totalAmount: string;
    currency: string;
    guestEmail: string;
    hotel: { name: string };
  };
  attempts: {
    id: string;
    provider: string | null;
    providerTxnId: string | null;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  }[];
  receipts: {
    id: string;
    eventId: string;
    outcome: string;
    createdAt: string;
  }[];
  reconciliationCases: {
    id: string;
    reason: string;
    status: string;
    createdAt: string;
  }[];
  refunds: {
    id: string;
    amount: string | null;
    currency: string;
    status: string;
    providerRefundRef: string | null;
    events: {
      id: string;
      eventType: string;
      actorId: string | null;
      reason: string | null;
      createdAt: string;
    }[];
  }[];
  refundReceipts: {
    id: string;
    eventId: string;
    outcome: string;
    createdAt: string;
  }[];
  completedAmount: string;
  reservedAmount: string;
  remainingAmount: string;
};
type RefundDetail = RefundItem & {
  booking: {
    code: string;
    cancellationPolicySnapshot: string | null;
    checkIn: string;
    hotel: { name: string };
  };
  payment: {
    amount: string;
    currency: string;
    status: string;
    providerTxnId: string | null;
    merchantReference: string | null;
  };
  events: {
    id: string;
    eventType: string;
    actorId: string | null;
    createdAt: string;
    detail?: { reason?: string };
  }[];
  completedAmount: string;
  reservedAmount: string;
  remainingAmount: string;
};

const PAYMENT_STATUS: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  SUCCESS: "Đã thanh toán",
  PAID: "Đã thu tại chỗ",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  PARTIALLY_REFUNDED: "Đã hoàn một phần",
  REFUNDED: "Đã hoàn đủ",
};
const REFUND_STATUS: Record<string, string> = {
  PENDING_REVIEW: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  PROCESSING: "Đang xử lý",
  FAILED: "Thất bại",
  REJECTED: "Từ chối",
  COMPLETED: "Đã hoàn",
};
const PAYMENT_FILTERS = [
  "ALL",
  "PENDING",
  "SUCCESS",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;
const REFUND_FILTERS = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REJECTED",
] as const;
const money = (amount: string | null, currency: string) => {
  if (amount === null) return "Chờ đối soát thủ công";
  if (!/^-?\d+(?:\.\d+)?$/.test(amount)) return "Chưa xác định";
  const [integer, decimal] = amount.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return currency === "VND"
    ? `${grouped} ₫`
    : `${grouped}${decimal ? `,${decimal}` : ""} ${currency}`;
};
const date = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
const message = (error: unknown) => bookingApiError(error);

export function PaymentsScreen() {
  const userId = useTravelerStore((state) =>
    state.session?.mode === "api" ? state.session.userId : "",
  );
  const params = useLocalSearchParams<{ tab?: string; page?: string }>();
  const tab =
    params.tab === "refunds" || params.tab === "reconciliation"
      ? params.tab
      : "payments";
  const page = Math.max(1, Number(params.page) || 1);
  const [searchDraft, setSearchDraft] = useState("");
  const [providerDraft, setProviderDraft] = useState("");
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [filter, setFilter] = useState({
    search: "",
    provider: "",
    from: "",
    to: "",
    status: "ALL",
    sort: "newest",
  });
  const query = {
    page,
    limit: 20,
    search: filter.search || undefined,
    provider: filter.provider || undefined,
    from: filter.from ? `${filter.from}T00:00:00.000+07:00` : undefined,
    to: filter.to ? `${filter.to}T23:59:59.999+07:00` : undefined,
    status: filter.status === "ALL" ? undefined : filter.status,
    sort: filter.sort,
  };
  const payments = useQuery({
    queryKey: ["admin-payments", userId, tab, query],
    queryFn: async () =>
      (
        await apiClient.get<Page<PaymentItem>>("/admin/payments", {
          params: {
            ...query,
            scope: tab === "reconciliation" ? "reconciliation" : "all",
          },
        })
      ).data,
    enabled: tab !== "refunds",
    staleTime: 0,
  });
  const refunds = useQuery({
    queryKey: ["admin-refunds", userId, query],
    queryFn: async () =>
      (
        await apiClient.get<Page<RefundItem>>("/admin/refunds", {
          params: { ...query, type: "manual" },
        })
      ).data,
    enabled: tab === "refunds",
    staleTime: 0,
  });
  const result = tab === "refunds" ? refunds : payments;
  const total = result.data?.total ?? 0;
  const switchTab = (next: string) => {
    setFilter((current) => ({ ...current, status: "ALL" }));
    router.setParams({ tab: next, page: "1" });
  };
  const setStatus = (status: string) => {
    setFilter((current) => ({ ...current, status }));
    router.setParams({ page: "1" });
  };
  const apply = () => {
    setFilter((current) => ({
      ...current,
      search: searchDraft.trim(),
      provider: providerDraft.trim(),
      from: fromDraft.trim(),
      to: toDraft.trim(),
    }));
    router.setParams({ page: "1" });
  };
  return (
    <AdminPage
      title="Thanh toán và hoàn tiền"
      subtitle="Tra cứu giao dịch, đối soát phản hồi cổng và xử lý yêu cầu hoàn có kiểm soát."
    >
      <AdminCard title="Giao dịch · Hoàn tiền · Tra soát">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            ["payments", "Giao dịch"],
            ["refunds", "Hoàn tiền"],
            ["reconciliation", "Cần tra soát"],
          ].map(([value, label]) => (
            <AdminButton
              key={value}
              label={label}
              variant={tab === value ? "primary" : "outline"}
              onPress={() => switchTab(value)}
            />
          ))}
        </View>
      </AdminCard>
      <AdminCard title="Tìm kiếm và lọc">
        <AdminInput
          label="Mã booking, giao dịch, tham chiếu hoặc khách sạn"
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder="Nhập từ khóa"
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <AdminInput
            label="Cổng thanh toán"
            value={providerDraft}
            onChangeText={setProviderDraft}
            placeholder="SIMULATOR"
          />
          <AdminInput
            label="Từ ngày (YYYY-MM-DD)"
            value={fromDraft}
            onChangeText={setFromDraft}
            placeholder="YYYY-MM-DD"
          />
          <AdminInput
            label="Đến ngày (YYYY-MM-DD)"
            value={toDraft}
            onChangeText={setToDraft}
            placeholder="YYYY-MM-DD"
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <AdminButton label="Tìm kiếm" onPress={apply} />
          <AdminButton
            label={filter.sort === "newest" ? "Mới gửi nhất" : "Cũ nhất"}
            variant="outline"
            onPress={() =>
              setFilter((current) => ({
                ...current,
                sort: current.sort === "newest" ? "oldest" : "newest",
              }))
            }
          />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(tab === "refunds" ? REFUND_FILTERS : PAYMENT_FILTERS).map(
            (status) => (
              <AdminButton
                key={status}
                label={
                  status === "ALL"
                    ? "Tất cả"
                    : tab === "refunds"
                      ? REFUND_STATUS[status]
                      : PAYMENT_STATUS[status]
                }
                variant={filter.status === status ? "primary" : "outline"}
                onPress={() => setStatus(status)}
              />
            ),
          )}
        </View>
      </AdminCard>
      <AdminCard
        title={`${tab === "refunds" ? "Yêu cầu hoàn tiền" : tab === "reconciliation" ? "Giao dịch cần tra soát" : "Giao dịch"} · ${total} kết quả`}
      >
        {result.isLoading ? <AdminText>Đang tải dữ liệu...</AdminText> : null}
        {result.error ? (
          <>
            <AdminText>{message(result.error)}</AdminText>
            <AdminButton
              label="Thử lại"
              onPress={() => void result.refetch()}
            />
          </>
        ) : null}
        {tab === "refunds"
          ? refunds.data?.items.map((item) => (
              <AdminRow
                key={item.id}
                title={`${item.bookingCode} · ${item.hotelName}`}
                subtitle={`${item.id} · ${money(item.amount, item.currency)} · ${item.provider} · ${date(item.createdAt)}`}
                status={REFUND_STATUS[item.status] ?? item.status}
                onPress={() => openAdminDetail("refunds", item.id)}
              />
            ))
          : payments.data?.items.map((item) => (
              <AdminRow
                key={item.id}
                title={`${item.bookingCode} · ${item.hotelName}`}
                subtitle={`${item.id} · ${item.guest} · ${money(item.amount, item.currency)} · ${item.provider ?? "Chưa có cổng"} · ${date(item.createdAt)}`}
                status={
                  item.reconciliationRequired
                    ? "Cần tra soát"
                    : (PAYMENT_STATUS[item.status] ?? item.status)
                }
                onPress={() => openAdminDetail("payments", item.id)}
              />
            ))}
        {!result.isLoading && !result.error && total === 0 ? (
          <AdminText>Không có dữ liệu phù hợp bộ lọc.</AdminText>
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <AdminButton
            label="Trước"
            variant="outline"
            disabled={page <= 1}
            onPress={() => router.setParams({ page: String(page - 1) })}
          />
          <AdminText>
            Trang {page}/{Math.max(1, Math.ceil(total / 20))}
          </AdminText>
          <AdminButton
            label="Sau"
            variant="outline"
            disabled={page * 20 >= total}
            onPress={() => router.setParams({ page: String(page + 1) })}
          />
          <AdminButton
            label="Làm mới"
            variant="outline"
            onPress={() => void result.refetch()}
          />
        </View>
      </AdminCard>
    </AdminPage>
  );
}

export function PaymentDetailScreen({ id }: { id: string }) {
  const userId = useTravelerStore((state) =>
    state.session?.mode === "api" ? state.session.userId : "",
  );
  const detail = useQuery({
    queryKey: ["admin-payment", userId, id],
    queryFn: async () =>
      (await apiClient.get<PaymentDetail>(`/admin/payments/${id}`)).data,
    staleTime: 0,
  });
  const item = detail.data;
  const auditEvents =
    item?.refunds.flatMap((refund) =>
      refund.events.map((event) => ({ ...event, refundId: refund.id })),
    ) ?? [];
  return (
    <AdminPage
      title="Chi tiết giao dịch"
      subtitle="Đối chiếu giao dịch, phản hồi cổng và yêu cầu hoàn tiền từ dữ liệu thật."
    >
      {detail.isLoading ? (
        <AdminCard>
          <AdminText>Đang tải giao dịch...</AdminText>
        </AdminCard>
      ) : null}
      {detail.error ? (
        <AdminCard>
          <AdminText>{message(detail.error)}</AdminText>
          <AdminButton label="Thử lại" onPress={() => void detail.refetch()} />
        </AdminCard>
      ) : null}
      {item ? (
        <>
          <AdminCard title="Giao dịch">
            <AdminText>
              Booking: {item.booking.code} · {item.booking.hotel.name} ·{" "}
              {item.booking.guestEmail}
            </AdminText>
            <AdminText>Trạng thái booking: {item.booking.status}</AdminText>
            <AdminText>
              Trạng thái thanh toán:{" "}
              {PAYMENT_STATUS[item.status] ?? item.status}
            </AdminText>
            <AdminText>Số tiền: {money(item.amount, item.currency)}</AdminText>
            <AdminText>Cổng: {item.provider ?? "Chưa có"}</AdminText>
            <AdminText>
              Mã tham chiếu:{" "}
              {item.providerTxnId ??
                item.merchantReference ??
                item.reference ??
                "Chưa có"}
            </AdminText>
            <AdminText>
              Tạo: {date(item.createdAt)} · Cập nhật: {date(item.updatedAt)}
            </AdminText>
          </AdminCard>
          <AdminCard title="Số dư hoàn tiền">
            <AdminText>
              Đã hoàn: {money(item.completedAmount, item.currency)}
            </AdminText>
            <AdminText>
              Đang giữ: {money(item.reservedAmount, item.currency)}
            </AdminText>
            <AdminText>
              Còn theo tiền đã thu: {money(item.remainingAmount, item.currency)}
            </AdminText>
          </AdminCard>
          <AdminCard title="Các lần thanh toán">
            {item.attempts.length ? (
              item.attempts.map((attempt) => (
                <AdminRow
                  key={attempt.id}
                  title={`${attempt.id} · ${PAYMENT_STATUS[attempt.status] ?? attempt.status}`}
                  subtitle={`${money(attempt.amount, attempt.currency)} · ${attempt.providerTxnId ?? "Chưa có mã cổng"} · ${date(attempt.createdAt)}`}
                />
              ))
            ) : (
              <AdminText>Chưa có lần thanh toán.</AdminText>
            )}
          </AdminCard>
          <AdminCard title="Lịch sử webhook thanh toán">
            {item.receipts.length ? (
              item.receipts.map((receipt) => (
                <AdminRow
                  key={receipt.id}
                  title={receipt.outcome}
                  subtitle={`${receipt.eventId} · ${date(receipt.createdAt)}`}
                />
              ))
            ) : (
              <AdminText>
                Chưa có biên nhận webhook cho giao dịch này.
              </AdminText>
            )}
          </AdminCard>
          <AdminCard title="Hoàn tiền">
            {item.refunds.length ? (
              item.refunds.map((refund) => (
                <AdminRow
                  key={refund.id}
                  title={`${refund.id} · ${REFUND_STATUS[refund.status] ?? refund.status}`}
                  subtitle={`${money(refund.amount, refund.currency)} · ${refund.providerRefundRef ?? "Chưa có tham chiếu hoàn"}`}
                  onPress={() => openAdminDetail("refunds", refund.id)}
                />
              ))
            ) : (
              <AdminText>Chưa có yêu cầu hoàn tiền.</AdminText>
            )}
          </AdminCard>
          <AdminCard title="Webhook hoàn tiền">
            {item.refundReceipts.length ? (
              item.refundReceipts.map((receipt) => (
                <AdminRow
                  key={receipt.id}
                  title={receipt.outcome}
                  subtitle={`${receipt.eventId} · ${date(receipt.createdAt)}`}
                />
              ))
            ) : (
              <AdminText>Chưa có biên nhận hoàn tiền liên kết.</AdminText>
            )}
          </AdminCard>
          <AdminCard title="Tra soát và ngoại lệ">
            {item.reconciliationCases.length ? (
              item.reconciliationCases.map((entry) => (
                <AdminRow
                  key={entry.id}
                  title={`${entry.status} · ${entry.reason}`}
                  subtitle={date(entry.createdAt)}
                />
              ))
            ) : (
              <AdminText>
                Không có hồ sơ tra soát. Cổng hiện tại chưa hỗ trợ quy trình
                dispute độc lập.
              </AdminText>
            )}
          </AdminCard>
          <AdminCard title="Nhật ký quyết định hoàn tiền">
            {auditEvents.length ? (
              auditEvents.map((event) => (
                <AdminText key={event.id}>
                  {date(event.createdAt)} · {event.refundId} · {event.eventType}{" "}
                  · {event.actorId ?? "Cổng thanh toán"}
                  {event.reason ? ` · ${event.reason}` : ""}
                </AdminText>
              ))
            ) : (
              <AdminText>Chưa có quyết định hoàn tiền.</AdminText>
            )}
          </AdminCard>
          <AdminButton
            label="Làm mới trạng thái"
            variant="outline"
            onPress={() => void detail.refetch()}
          />
          <AdminButton
            label="Quay lại danh sách"
            variant="outline"
            onPress={() => router.replace("/admin/payments")}
          />
        </>
      ) : null}
    </AdminPage>
  );
}

export function RefundDetailScreen({ id }: { id: string }) {
  const userId = useTravelerStore((state) =>
    state.session?.mode === "api" ? state.session.userId : "",
  );
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState<"APPROVE" | "REJECT" | null>(
    null,
  );
  const detail = useQuery({
    queryKey: ["admin-refund", userId, id],
    queryFn: async () =>
      (await apiClient.get<RefundDetail>(`/admin/refunds/${id}`)).data,
    staleTime: 0,
  });
  const action = useMutation({
    mutationFn: async (
      decision: "APPROVE" | "REJECT" | "DISPATCH" | "REOPEN",
    ) =>
      (
        await apiClient.post(
          `/admin/refunds/${id}/${decision === "DISPATCH" ? "dispatch" : decision === "REOPEN" ? "reopen" : "decision"}`,
          decision === "DISPATCH"
            ? {}
            : decision === "REOPEN"
              ? { reason: reason.trim() }
              : { decision, reason: reason.trim() },
        )
      ).data,
    onSuccess: async () => {
      setReason("");
      setConfirmation(null);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["admin-refund", userId, id],
        }),
        queryClient.invalidateQueries({ queryKey: ["admin-refunds", userId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-payments", userId] }),
      ]);
    },
  });
  const item = detail.data;
  return (
    <AdminPage
      title="Tra soát hoàn tiền một phần"
      subtitle="Quyết định của Admin cần bằng chứng, lý do và nhật ký truy vết."
    >
      {detail.isLoading ? (
        <AdminCard>
          <AdminText>Đang tải yêu cầu...</AdminText>
        </AdminCard>
      ) : null}
      {detail.error ? (
        <AdminCard>
          <AdminText>{message(detail.error)}</AdminText>
          <AdminButton label="Thử lại" onPress={() => void detail.refetch()} />
        </AdminCard>
      ) : null}
      {item ? (
        <>
          <AdminCard
            title={`${item.booking.code} · ${item.booking.hotel.name}`}
          >
            <AdminText>
              Trạng thái hoàn: {REFUND_STATUS[item.status] ?? item.status}
            </AdminText>
            <AdminText>
              Dự kiến hoàn: {money(item.amount, item.currency)}
            </AdminText>
            <AdminText>Lý do khách: {item.reason}</AdminText>
            <AdminText>
              Chính sách lúc đặt:{" "}
              {item.booking.cancellationPolicySnapshot ??
                "Chưa có quy tắc cấu trúc"}
            </AdminText>
            <AdminText>
              Ngày nhận phòng:{" "}
              {new Date(item.booking.checkIn).toLocaleDateString("vi-VN")}
            </AdminText>
            {item.reviewReason ? (
              <AdminText>Lý do quyết định: {item.reviewReason}</AdminText>
            ) : null}
          </AdminCard>
          <AdminCard title="Bằng chứng cần kiểm tra">
            <AdminText>
              Đã thu: {money(item.payment.amount, item.payment.currency)} ·{" "}
              {PAYMENT_STATUS[item.payment.status] ?? item.payment.status}
            </AdminText>
            <AdminText>
              Đã hoàn: {money(item.completedAmount, item.currency)}
            </AdminText>
            <AdminText>
              Đang giữ: {money(item.reservedAmount, item.currency)}
            </AdminText>
            <AdminText>
              Còn theo tiền đã thu: {money(item.remainingAmount, item.currency)}
            </AdminText>
            <AdminText>
              Mã giao dịch gốc:{" "}
              {item.payment.providerTxnId ??
                item.payment.merchantReference ??
                "Chưa có"}
            </AdminText>
            <AdminText>
              Mã hoàn: {item.providerRefundRef ?? "Chưa có"}
            </AdminText>
            <AdminButton
              label="Xem giao dịch"
              variant="outline"
              onPress={() => openAdminDetail("payments", item.paymentId)}
            />
          </AdminCard>
          {item.amount === null ? (
            <AdminCard tone="yellow">
              <AdminText>
                Booking cũ chưa có quy tắc hoàn cấu trúc. Cần xử lý chính sách
                thủ công; hệ thống không cho duyệt số tiền chưa xác minh.
              </AdminText>
            </AdminCard>
          ) : null}
          {item.status === "PENDING_REVIEW" ? (
            <AdminCard title="Lý do quyết định">
              <AdminInput
                label="Lý do và bằng chứng (bắt buộc)"
                value={reason}
                onChangeText={setReason}
                placeholder="Ghi kết quả đối chiếu"
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <AdminButton
                  label="Duyệt hoàn"
                  disabled={
                    !reason.trim() || item.amount === null || action.isPending
                  }
                  onPress={() => setConfirmation("APPROVE")}
                />
                <AdminButton
                  label="Từ chối"
                  variant="danger"
                  disabled={!reason.trim() || action.isPending}
                  onPress={() => setConfirmation("REJECT")}
                />
              </View>
            </AdminCard>
          ) : null}
          {item.status === "APPROVED" ? (
            <AdminCard title="Thực hiện hoàn qua môi trường mô phỏng">
              <AdminText>
                Chuyển yêu cầu sang chờ callback đã xác thực. Thao tác này chưa
                xác nhận tiền đã hoàn.
              </AdminText>
              <AdminButton
                label="Gửi lệnh mô phỏng"
                disabled={action.isPending}
                onPress={() => action.mutate("DISPATCH")}
              />
            </AdminCard>
          ) : null}
          {item.status === "FAILED" ? (
            <AdminCard title="Xem xét lại giao dịch thất bại">
              <AdminInput
                label="Kết quả đối soát và lý do"
                value={reason}
                onChangeText={setReason}
                placeholder="Nhập lý do"
              />
              <AdminButton
                label="Đưa lại vào hàng duyệt"
                disabled={!reason.trim() || action.isPending}
                onPress={() => action.mutate("REOPEN")}
              />
            </AdminCard>
          ) : null}
          {action.error ? (
            <AdminCard tone="red">
              <AdminText>{message(action.error)}</AdminText>
              <AdminButton
                label="Tải trạng thái mới"
                onPress={() => void detail.refetch()}
              />
            </AdminCard>
          ) : null}
          <AdminCard title="Nhật ký xử lý">
            {item.events.length ? (
              item.events.map((event) => (
                <AdminText key={event.id}>
                  {date(event.createdAt)} · {event.eventType} ·{" "}
                  {event.actorId ?? "Cổng thanh toán"}
                  {event.detail?.reason ? ` · ${event.detail.reason}` : ""}
                </AdminText>
              ))
            ) : (
              <AdminText>Chưa có sự kiện.</AdminText>
            )}
          </AdminCard>
          <AdminButton
            label="Làm mới trạng thái"
            variant="outline"
            onPress={() => void detail.refetch()}
          />
          <AdminButton
            label="Quay lại danh sách"
            variant="outline"
            onPress={() => router.replace("/admin/payments?tab=refunds")}
          />
          <Modal
            visible={!!confirmation}
            transparent
            animationType="fade"
            onRequestClose={() => setConfirmation(null)}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                padding: 20,
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
            >
              <AdminCard title="Xác nhận quyết định">
                <AdminText>
                  {confirmation === "APPROVE"
                    ? `Duyệt ${money(item.amount, item.currency)}?`
                    : "Từ chối yêu cầu hoàn?"}
                </AdminText>
                <AdminText>
                  Cổng: {item.provider} · Mã giao dịch:{" "}
                  {item.payment.providerTxnId ?? "Chưa có"}
                </AdminText>
                <AdminText>Lý do: {reason}</AdminText>
                <AdminText>
                  Hệ thống sẽ kiểm tra lại trạng thái và số tiền trước khi ghi
                  quyết định.
                </AdminText>
                <AdminButton
                  label="Xác nhận"
                  disabled={action.isPending}
                  onPress={() => confirmation && action.mutate(confirmation)}
                />
                <AdminButton
                  label="Hủy"
                  variant="outline"
                  disabled={action.isPending}
                  onPress={() => setConfirmation(null)}
                />
              </AdminCard>
            </View>
          </Modal>
        </>
      ) : null}
    </AdminPage>
  );
}

import { ReviewSummaryCard } from "@/features/ai-review-summary/ReviewSummaryCard";
import { useRef, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import { absoluteMediaUrl } from "@/services/media-url";
import { CONTENT_REPORT_REASONS } from "@/features/content-report-reasons";
import { useTravelerStore } from "@/features/traveler/store";
import {
  appendMockAudit,
  mockAccommodationService,
  mockReportService,
} from "../shared/mock";
import { AdminText } from "../dashboard/components";
import {
  AdminButton,
  AdminCard,
  AdminDecisionDialog,
  AdminInput,
  AdminPage,
  AdminRow,
  openAdminDetail,
  openAdminScreen,
} from "../shared/ui";

type TargetType = "HOTEL" | "REVIEW" | "REPLY";
type Status = "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
type Action =
  | "HIDE"
  | "DISMISS"
  | "ALREADY_HANDLED"
  | "HIDE_HOTEL"
  | "SUSPEND_HOTEL"
  | "RESTORE";
type QueueItem = {
  id: string;
  targetType: TargetType;
  targetId: string;
  targetName: string;
  reason: string;
  description: string;
  status: Status;
  createdAt: string;
  assigneeId: string | null;
  target: { isVisible?: boolean } | null;
};
type Detail = QueueItem & {
  resolvedAt: string | null;
  resolution: string | null;
  reporter: { fullName: string; email?: string | null };
  target: {
    id: string;
    content?: string;
    rating?: number;
    isVisible?: boolean;
    status?: string;
  } | null;
  booking?: { code: string; status: string } | null;
  evidenceUrls: string[];
  related: { id: string; status: Status }[];
  actions: { id: string; action: string; reason: string; createdAt: string }[];
};
const labels: Record<string, string> = {
  ...CONTENT_REPORT_REASONS,
  HOTEL: "Khách sạn",
  REVIEW: "Đánh giá",
  REPLY: "Phản hồi của chủ",
  OPEN: "Mới",
  IN_REVIEW: "Đang xử lý",
  RESOLVED: "Đã xử lý",
  REJECTED: "Đã bác bỏ",
  HIDE: "Ẩn nội dung",
  HIDE_HOTEL: "Ẩn khách sạn",
  SUSPEND_HOTEL: "Đình chỉ khách sạn",
  RESTORE: "Khôi phục nội dung",
  DISMISS: "Không có vi phạm",
  ALREADY_HANDLED: "Đã xử lý ở báo cáo khác",
  INCORRECT_INFORMATION: "Thông tin sai",
  INCORRECT_LOCATION: "Vị trí sai",
  MISLEADING_IMAGES: "Ảnh gây hiểu nhầm",
  FRAUD: "Gian lận",
  INAPPROPRIATE_CONTENT: "Nội dung không phù hợp",
  SAFETY: "Vấn đề an toàn",
  SPAM: "Spam",
  OFFENSIVE: "Nội dung xúc phạm",
  FALSE_INFORMATION: "Thông tin sai",
  PRIVACY: "Xâm phạm riêng tư",
  OTHER: "Khác",
};
const errorText = (error: unknown) => {
  const data = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data;
  return Array.isArray(data?.message)
    ? data.message.join(". ")
    : (data?.message ?? "Không thể kết nối máy chủ. Hãy thử lại.");
};

export function ReportsScreen({ kind }: { kind: "REVIEW" | "REPORT" }) {
  const session = useTravelerStore((state) => state.session);
  if (kind === "REVIEW")
    return session?.mode === "api" ? (
      <AdminReviewsScreen />
    ) : (
      <MockReviewReportsScreen />
    );
  return <ModerationQueue />;
}

type ReviewModerationAction = "HIDE" | "DELETE" | "RESTORE";
type AdminReview = {
  id: string;
  rating: number;
  content: string;
  createdAt: string;
  isVisible: boolean;
  images: string[];
  hotel: { id: string; name: string };
  author: { fullName: string };
};

const REVIEW_ACTION_LABELS: Record<ReviewModerationAction, string> = {
  HIDE: "Ẩn đánh giá",
  DELETE: "Xóa đánh giá",
  RESTORE: "Hiện lại đánh giá",
};

function ModerationNavigation({ kind }: { kind: "REVIEW" | "REPORT" }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      <AdminButton
        label="Kiểm duyệt đánh giá"
        variant={kind === "REVIEW" ? "primary" : "outline"}
        onPress={() => openAdminScreen("reviews")}
      />
      <AdminButton
        label="Quản lý báo cáo"
        variant={kind === "REPORT" ? "primary" : "outline"}
        onPress={() => openAdminScreen("reports")}
      />
    </View>
  );
}

function AdminReviewsScreen() {
  const [summaryHotel, setSummaryHotel] = useState<string>();
  const session = useTravelerStore((state) => state.session);
  const client = useQueryClient();
  const [selection, setSelection] = useState<{
    review: AdminReview;
    action: ReviewModerationAction;
  } | null>(null);
  const queryKey = [
    "admin-reviews",
    session?.mode === "api" ? session.sessionId : "",
  ];
  const reviews = useInfiniteQuery({
    queryKey,
    initialPageParam: "",
    queryFn: async ({ pageParam, signal }) =>
      (
        await apiClient.get<AdminReview[]>("/admin/reviews", {
          params: pageParam ? { after: pageParam } : undefined,
          signal,
        })
      ).data,
    getNextPageParam: (page) =>
      page.length === 100 ? page.at(-1)?.id : undefined,
    enabled: session?.mode === "api" && session.role === "ADMIN",
    retry: false,
  });
  const moderate = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: ReviewModerationAction;
      reason: string;
    }) =>
      apiClient.patch(
        "/admin/reviews/" + encodeURIComponent(id) + "/moderation",
        { action, reason },
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey }),
        client.invalidateQueries({ queryKey: ["moderation-reports"] }),
        client.invalidateQueries({ queryKey: ["moderation-report"] }),
        client.invalidateQueries({ queryKey: ["ai-review-summary"] }),
      ]);
    },
  });
  const items = reviews.data?.pages.flat() ?? [];
  const select = (review: AdminReview, action: ReviewModerationAction) => {
    moderate.reset();
    setSelection({ review, action });
  };
  return (
    <AdminPage
      title="Kiểm duyệt đánh giá"
      subtitle="Đánh giá của khách sau lưu trú."
    >
      <ModerationNavigation kind="REVIEW" />
      <AdminCard title="Đánh giá đã gửi">
        <AdminButton
          label="Làm mới"
          variant="outline"
          disabled={reviews.isFetching}
          onPress={() => void reviews.refetch()}
        />
        {reviews.isPending ? <ActivityIndicator /> : null}
        {reviews.isError ? (
          <AdminText>{errorText(reviews.error)}</AdminText>
        ) : null}
        {reviews.isSuccess && items.length === 0 ? (
          <AdminText>Chưa có đánh giá.</AdminText>
        ) : null}
        {moderate.isError ? (
          <AdminText>{errorText(moderate.error)}</AdminText>
        ) : null}
      </AdminCard>
      {items.map((review) => (
        <AdminCard key={review.id} title={review.hotel.name}>
          <AdminButton
            label={
              summaryHotel === review.id
                ? "Đóng tóm tắt"
                : "Mở tóm tắt khách sạn"
            }
            variant="outline"
            onPress={() =>
              setSummaryHotel(
                summaryHotel === review.id ? undefined : review.id,
              )
            }
          />
          {summaryHotel === review.id ? (
            <ReviewSummaryCard hotelId={review.hotel.id} />
          ) : null}
          <AdminText>
            {review.author.fullName} · {review.rating}/10 ·{" "}
            {new Date(review.createdAt).toLocaleString("vi-VN")}
          </AdminText>
          <AdminText>{review.isVisible ? "Đang công khai" : "Đã ẩn"}</AdminText>
          <AdminText>{review.content}</AdminText>
          {review.isVisible && review.images.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {review.images.map((url) => (
                <Image
                  key={url}
                  accessibilityLabel="Ảnh đánh giá"
                  source={{ uri: absoluteMediaUrl(url) }}
                  resizeMode="contain"
                  style={{ width: 120, height: 100 }}
                />
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <AdminButton
              label={
                review.isVisible
                  ? REVIEW_ACTION_LABELS.HIDE
                  : REVIEW_ACTION_LABELS.RESTORE
              }
              variant="outline"
              disabled={moderate.isPending}
              onPress={() =>
                select(review, review.isVisible ? "HIDE" : "RESTORE")
              }
            />
            <AdminButton
              label={REVIEW_ACTION_LABELS.DELETE}
              variant="danger"
              disabled={moderate.isPending}
              onPress={() => select(review, "DELETE")}
            />
          </View>
        </AdminCard>
      ))}
      {reviews.hasNextPage ? (
        <AdminButton
          label="Tải thêm"
          variant="outline"
          disabled={reviews.isFetching}
          onPress={() => void reviews.fetchNextPage()}
        />
      ) : null}
      {selection ? (
        <AdminDecisionDialog
          visible
          title={REVIEW_ACTION_LABELS[selection.action]}
          target={selection.review.hotel.name}
          evidence={selection.review.content}
          reasonRequired
          auditNote="Thao tác và lý do sẽ được lưu trong nhật ký kiểm duyệt."
          confirmLabel="Xác nhận"
          danger={selection.action === "DELETE"}
          onCancel={() => setSelection(null)}
          onConfirm={(reason) => {
            moderate.mutate({
              id: selection.review.id,
              action: selection.action,
              reason,
            });
            setSelection(null);
          }}
        />
      ) : null}
    </AdminPage>
  );
}

function ModerationQueue() {
  const session = useTravelerStore((s) => s.session);
  const [status, setStatus] = useState<Status | undefined>();
  const [targetType, setTargetType] = useState<TargetType>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: [
      "moderation-reports",
      session?.mode === "api" ? session.userId : "",
      status,
      targetType,
      search,
      page,
    ],
    queryFn: async () =>
      (
        await apiClient.get<{ items: QueueItem[]; total: number }>(
          "/admin/hotel-reports/queue",
          {
            params: {
              status,
              targetType,
              search: search.trim() || undefined,
              page,
              limit: 10,
            },
          },
        )
      ).data,
    enabled: session?.mode === "api" && session.role === "ADMIN",
  });
  return (
    <AdminPage
      title="Quản lý báo cáo"
      subtitle="Báo cáo và quyết định thực tế được lưu để truy vết."
    >
      <ModerationNavigation kind="REPORT" />
      {session?.mode !== "api" || session.role !== "ADMIN" ? (
        <AdminCard>
          <AdminText>Cần đăng nhập tài khoản Admin.</AdminText>
        </AdminCard>
      ) : (
        <>
          <AdminCard title="Tìm kiếm và lọc báo cáo">
            <AdminInput
              label="Tìm theo mã, khách sạn hoặc người gửi"
              value={search}
              onChangeText={(v) => {
                setSearch(v);
                setPage(1);
              }}
              placeholder="Nhập từ khóa"
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[undefined, "OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"].map(
                (value) => (
                  <AdminButton
                    key={value ?? "ALL"}
                    label={value ? labels[value] : "Tất cả"}
                    variant={status === value ? "primary" : "outline"}
                    onPress={() => {
                      setStatus(value as Status | undefined);
                      setPage(1);
                    }}
                  />
                ),
              )}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {[undefined, "HOTEL", "REVIEW", "REPLY"].map((value) => (
                <AdminButton
                  key={value ?? "ALL"}
                  label={value ? labels[value] : "Mọi loại"}
                  variant={targetType === value ? "primary" : "outline"}
                  onPress={() => {
                    setTargetType(value as TargetType | undefined);
                    setPage(1);
                  }}
                />
              ))}
            </View>
          </AdminCard>
          {query.isPending ? (
            <ActivityIndicator />
          ) : query.isError ? (
            <AdminCard>
              <AdminText>{errorText(query.error)}</AdminText>
              <AdminButton
                label="Thử lại"
                onPress={() => void query.refetch()}
              />
            </AdminCard>
          ) : (
            <AdminCard
              title={`Danh sách báo cáo · ${query.data?.total ?? 0} kết quả`}
            >
              {query.data?.items.length ? (
                query.data.items.map((item) => (
                  <AdminRow
                    key={`${item.targetType}:${item.id}`}
                    title={`${labels[item.targetType]} · ${item.targetName}`}
                    subtitle={`${item.id} · ${labels[item.reason] ?? item.reason} · ${new Date(item.createdAt).toLocaleString("vi-VN")} · ${item.assigneeId ? `Admin ${item.assigneeId}` : "Chưa nhận"}`}
                    status={labels[item.status]}
                    onPress={() =>
                      openAdminDetail(
                        "reports",
                        `${item.targetType}:${item.id}`,
                      )
                    }
                  />
                ))
              ) : (
                <AdminText>Không có báo cáo phù hợp.</AdminText>
              )}
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <AdminButton
                  label="Trước"
                  variant="outline"
                  disabled={page <= 1}
                  onPress={() => setPage(page - 1)}
                />
                <AdminText>
                  Trang {page}/
                  {Math.max(1, Math.ceil((query.data?.total ?? 0) / 10))}
                </AdminText>
                <AdminButton
                  label="Sau"
                  variant="outline"
                  disabled={page * 10 >= (query.data?.total ?? 0)}
                  onPress={() => setPage(page + 1)}
                />
              </View>
            </AdminCard>
          )}
        </>
      )}
    </AdminPage>
  );
}

export function ReportDetailScreen({ id }: { id: string }) {
  const session = useTravelerStore((state) => state.session);
  const mock = mockReportService.useItems().some((report) => report.id === id);
  if (session?.mode !== "api" && mock) return <MockReportDetail id={id} />;
  return <ModerationReportDetail key={id} id={id} />;
}

function ModerationReportDetail({ id }: { id: string }) {
  const separator = id.indexOf(":");
  const kind =
    separator === -1 ? "HOTEL" : (id.slice(0, separator) as TargetType);
  const reportId = id.slice(separator + 1);
  const session = useTravelerStore((s) => s.session);
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const busy = useRef(false);
  const requestId = useRef("");
  const valid = ["HOTEL", "REVIEW", "REPLY"].includes(kind) && !!reportId;
  const path = `/admin/hotel-reports/queue/${kind}/${encodeURIComponent(reportId)}`;
  const detail = useQuery({
    queryKey: [
      "moderation-report",
      kind,
      reportId,
      session?.mode === "api" ? session.userId : "",
    ],
    queryFn: async () => (await apiClient.get<Detail>(path)).data,
    enabled: valid && session?.mode === "api" && session.role === "ADMIN",
    retry: false,
  });
  const refresh = async () => {
    await Promise.all([
      detail.refetch(),
      queryClient.invalidateQueries({ queryKey: ["moderation-reports"] }),
    ]);
  };
  const claim = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await apiClient.post(`${path}/claim`);
      await refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const choose = (next: Action) => {
    requestId.current = `moderate-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setAction(next);
    setDecisionReason("");
    setError("");
  };
  const decide = async (reason: string) => {
    if (!action || busy.current) return;
    if (reason.trim().length < 10) {
      setError("Lý do phải có ít nhất 10 ký tự.");
      return;
    }
    busy.current = true;
    setPending(true);
    setError("");
    try {
      if (action === "RESTORE")
        await apiClient.post(
          `/admin/hotel-reports/restore/${kind}/${encodeURIComponent(row!.targetId)}`,
          { reason: reason.trim(), requestId: requestId.current },
        );
      else
        await apiClient.post(`${path}/decision`, {
          action,
          reason: reason.trim(),
          requestId: requestId.current,
        });
      setAction(null);
      await refresh();
    } catch (e) {
      setError(errorText(e));
      await refresh();
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const row = detail.data;
  return (
    <AdminPage
      title="Chi tiết báo cáo"
      subtitle="Nội dung người gửi và quyết định của Admin được lưu riêng."
    >
      {!valid ? (
        <AdminCard>
          <AdminText>Mã báo cáo không hợp lệ.</AdminText>
        </AdminCard>
      ) : session?.mode !== "api" || session.role !== "ADMIN" ? (
        <AdminCard>
          <AdminText>Cần đăng nhập tài khoản Admin.</AdminText>
        </AdminCard>
      ) : detail.isPending ? (
        <ActivityIndicator />
      ) : detail.isError || !row ? (
        <AdminCard>
          <AdminText>{errorText(detail.error)}</AdminText>
          <AdminButton label="Thử lại" onPress={() => void detail.refetch()} />
        </AdminCard>
      ) : (
        <>
          <AdminCard title={`${labels[row.targetType]} · ${row.targetName}`}>
            <AdminText>
              Mã: {row.id} · {labels[row.status]}
            </AdminText>
            <AdminText>
              Lý do báo cáo: {labels[row.reason] ?? row.reason}
            </AdminText>
            <AdminText>
              Mô tả của người gửi: {row.description || "Không có"}
            </AdminText>
            <AdminText>
              Người gửi: {row.reporter.fullName} ·{" "}
              {row.reporter.email || "Không có email"}
            </AdminText>
            <AdminText>
              Ngày gửi: {new Date(row.createdAt).toLocaleString("vi-VN")}
            </AdminText>
            <AdminText>Người xử lý: {row.assigneeId || "Chưa có"}</AdminText>
          </AdminCard>
          <AdminCard title="Nội dung hiện tại">
            <AdminText>
              {row.target
                ? row.target.content || row.targetName
                : "Nội dung gốc không còn tồn tại."}
            </AdminText>
            {row.target?.rating ? (
              <AdminText>Điểm: {row.target.rating}/10</AdminText>
            ) : null}
            <AdminText>
              Hiển thị:{" "}
              {row.target?.isVisible === false ? "Đã ẩn" : "Đang hiển thị"}
            </AdminText>
            {row.booking ? (
              <AdminText>
                Booking đối chiếu: {row.booking.code} · {row.booking.status}
              </AdminText>
            ) : null}
            {row.evidenceUrls.length ? (
              <AdminText>Bằng chứng: {row.evidenceUrls.length} tệp</AdminText>
            ) : (
              <AdminText>Không có tệp bằng chứng.</AdminText>
            )}
          </AdminCard>
          <AdminCard title="Báo cáo liên quan và lịch sử quyết định">
            {row.related.length ? (
              row.related.map((item) => (
                <AdminText key={item.id}>
                  {item.id} · {labels[item.status]}
                </AdminText>
              ))
            ) : (
              <AdminText>Chưa có báo cáo khác cùng nội dung.</AdminText>
            )}
            {row.actions.length ? (
              row.actions.map((item) => (
                <AdminText key={item.id}>
                  {new Date(item.createdAt).toLocaleString("vi-VN")} ·{" "}
                  {labels[item.action] ?? item.action} · {item.reason}
                </AdminText>
              ))
            ) : (
              <AdminText>Chưa có quyết định.</AdminText>
            )}
          </AdminCard>
          {row.resolution ? (
            <AdminCard title="Kết luận của Admin">
              <AdminText>{row.resolution}</AdminText>
            </AdminCard>
          ) : null}
          {error ? (
            <AdminCard tone="red">
              <AdminText>{error}</AdminText>
            </AdminCard>
          ) : null}
          {row.status === "OPEN" ? (
            <AdminButton
              label={pending ? "Đang nhận..." : "Nhận xử lý"}
              disabled={pending}
              onPress={() => void claim()}
            />
          ) : null}
          {row.status === "IN_REVIEW" &&
          row.assigneeId === (session.mode === "api" ? session.userId : "") ? (
            <AdminCard title="Ra quyết định">
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {row.targetType !== "HOTEL" &&
                row.target?.isVisible !== false ? (
                  <AdminButton
                    label={
                      row.targetType === "REVIEW"
                        ? "Ẩn đánh giá"
                        : "Ẩn phản hồi"
                    }
                    disabled={pending}
                    onPress={() => choose("HIDE")}
                  />
                ) : null}
                {row.targetType === "HOTEL" &&
                row.target?.isVisible !== false ? (
                  <>
                    <AdminButton
                      label="Ẩn khách sạn"
                      disabled={pending}
                      onPress={() => choose("HIDE_HOTEL")}
                    />
                    <AdminButton
                      label="Đình chỉ khách sạn"
                      disabled={pending}
                      onPress={() => choose("SUSPEND_HOTEL")}
                    />
                  </>
                ) : null}
                {row.target?.isVisible === false ? (
                  <AdminButton
                    label="Đã được xử lý"
                    disabled={pending}
                    onPress={() => choose("ALREADY_HANDLED")}
                  />
                ) : null}
                <AdminButton
                  label="Bác bỏ báo cáo"
                  variant="outline"
                  disabled={pending}
                  onPress={() => choose("DISMISS")}
                />
              </View>
            </AdminCard>
          ) : null}
          {row.status === "IN_REVIEW" &&
          row.assigneeId !== (session.mode === "api" ? session.userId : "") ? (
            <AdminCard>
              <AdminText>Báo cáo đang do Admin khác xử lý.</AdminText>
            </AdminCard>
          ) : null}
          {(row.targetType === "REVIEW" || row.targetType === "REPLY") &&
          row.target?.isVisible === false ? (
            <AdminButton
              label="Khôi phục nội dung đã ẩn"
              variant="outline"
              disabled={pending}
              onPress={() => choose("RESTORE")}
            />
          ) : null}
          {action ? (
            <AdminCard title={`Xác nhận: ${labels[action]}`}>
              <AdminText>
                {action === "HIDE"
                  ? "Đánh giá bị ẩn sẽ không còn trong danh sách công khai và điểm trung bình; ẩn phản hồi giữ nguyên điểm."
                  : action === "RESTORE"
                    ? "Nội dung sẽ được hiển thị trở lại; điểm đánh giá được tính lại khi khôi phục review."
                    : action === "HIDE_HOTEL" || action === "SUSPEND_HOTEL"
                      ? "Khách sạn sẽ ngừng hiển thị và nhận booking mới. Booking cũ không bị tự hủy."
                      : "Báo cáo sẽ được đóng. Nội dung công khai không thay đổi."}
              </AdminText>
              <AdminInput
                label="Lý do quyết định (ít nhất 10 ký tự)"
                value={decisionReason}
                onChangeText={setDecisionReason}
                placeholder="Ghi lý do và bằng chứng đã đối chiếu"
              />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <AdminButton
                  label="Hủy"
                  variant="outline"
                  disabled={pending}
                  onPress={() => setAction(null)}
                />
                <AdminButton
                  label={pending ? "Đang lưu..." : "Xác nhận"}
                  disabled={pending || decisionReason.trim().length < 10}
                  onPress={() => void decide(decisionReason)}
                />
              </View>
            </AdminCard>
          ) : null}
        </>
      )}
    </AdminPage>
  );
}

function MockReviewReportsScreen() {
  const reports = mockReportService
    .useItems()
    .filter((item) => item.kind === "REVIEW");
  const hotels = mockAccommodationService.useItems();
  return (
    <AdminPage title="Kiểm duyệt đánh giá">
      <AdminCard title="Đánh giá cần xét duyệt">
        <AdminText>Dữ liệu minh họa cho luồng kiểm duyệt đánh giá.</AdminText>
      </AdminCard>
      <AdminCard>
        {reports.map((report) => (
          <AdminRow
            key={report.id}
            title={
              hotels.find((item) => item.id === report.hotelId)?.name ?? "Chỗ ở"
            }
            subtitle={report.evidence}
            status={report.status === "OPEN" ? "Mở" : report.status}
            onPress={() => openAdminDetail("reports", report.id)}
          />
        ))}
      </AdminCard>
      <AdminButton
        label="Quản lý báo cáo khách sạn"
        variant="outline"
        onPress={() => openAdminScreen("reports")}
        style={{ alignSelf: "flex-start" }}
      />
    </AdminPage>
  );
}

function MockReportDetail({ id }: { id: string }) {
  const report = mockReportService.useItems().find((item) => item.id === id);
  const hotel = mockAccommodationService
    .useItems()
    .find((item) => item.id === report?.hotelId);
  const [decision, setDecision] = useState<"resolve" | "reject" | null>(null);
  if (!report)
    return (
      <AdminPage title="Chi tiết báo cáo">
        <AdminCard>
          <AdminText>Không tìm thấy báo cáo.</AdminText>
        </AdminCard>
      </AdminPage>
    );
  const openDecision = (next: "resolve" | "reject") => {
    if (report.status === "OPEN")
      mockReportService.update(report.id, { status: "IN_REVIEW" });
    setDecision(next);
  };
  return (
    <AdminPage title="Chi tiết báo cáo">
      <AdminCard title={`Báo cáo khách sạn ${hotel?.name}`}>
        <AdminText>{report.reason}</AdminText>
        <AdminText>Trạng thái: {report.status}</AdminText>
      </AdminCard>
      <AdminCard title="Bằng chứng cần kiểm tra">
        <AdminText>{report.evidence}</AdminText>
      </AdminCard>
      {(report.status === "OPEN" || report.status === "IN_REVIEW") && (
        <>
          <AdminButton
            label="Ra quyết định báo cáo"
            onPress={() => openDecision("resolve")}
            style={{ width: 340 }}
          />
          <AdminButton
            label="Bác bỏ báo cáo"
            variant="outline"
            onPress={() => openDecision("reject")}
            style={{ width: 340 }}
          />
        </>
      )}
      <AdminDecisionDialog
        visible={decision !== null}
        title="Ra quyết định báo cáo"
        target={`Báo cáo khách sạn ${hotel?.name}`}
        evidence={report.evidence}
        reasonRequired
        confirmLabel="Xác nhận xử lý"
        danger={decision === "reject"}
        onCancel={() => setDecision(null)}
        onConfirm={(reason) => {
          mockReportService.update(report.id, {
            status: decision === "resolve" ? "RESOLVED" : "REJECTED",
          });
          appendMockAudit("Xử lý báo cáo", hotel?.name ?? report.id, reason);
          setDecision(null);
        }}
      />
    </AdminPage>
  );
}

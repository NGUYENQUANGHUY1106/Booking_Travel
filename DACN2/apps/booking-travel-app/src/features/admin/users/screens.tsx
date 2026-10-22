import { isAxiosError } from "axios";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { useTravelerStore } from "@/features/traveler/store";
import { AdminText } from "../dashboard/components";
import {
  AdminButton,
  AdminCard,
  AdminInput,
  AdminPage,
  AdminSkeleton,
  openAdminDetail,
} from "../shared/ui";
import { ADMIN_COLORS } from "../theme";
import type { UserStatus } from "@/features/auth/types";
import type { AccountAction, AdminUser, ManagedRole } from "./api";
import { AccountActionDialog } from "./AccountActionDialog";
import {
  UserDetailScreen as DemoUserDetailScreen,
  UsersScreen as DemoUsersScreen,
} from "./demo-screens";
import { useAccountAction, useAdminUserDetail, useAdminUsers } from "./queries";

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  SUSPENDED: "Đã đình chỉ",
  PENDING_VERIFICATION: "Chưa xác minh",
  DISABLED: "Vô hiệu hóa",
};
const STATUS_COLORS: Record<UserStatus, string> = {
  ACTIVE: "#15803D",
  LOCKED: "#B45309",
  SUSPENDED: "#B91C1C",
  PENDING_VERIFICATION: "#B45309",
  DISABLED: "#4B5563",
};
const STATUS_OPTIONS: { label: string; value?: UserStatus }[] = [
  { label: "Tất cả" },
  { label: "Đang hoạt động", value: "ACTIVE" },
  { label: "Đã khóa", value: "LOCKED" },
  { label: "Đã đình chỉ", value: "SUSPENDED" },
  { label: "Chưa xác minh", value: "PENDING_VERIFICATION" },
  { label: "Vô hiệu hóa", value: "DISABLED" },
];

function formatDate(date: string | null | undefined) {
  if (!date) return "Chưa có";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? "Chưa có"
    : parsed.toLocaleDateString("vi-VN");
}

function getAdminErrorMessage(error: unknown, fallback: string) {
  if (!isAxiosError<{ message?: string | string[] }>(error)) return fallback;
  const message = error.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message)) return message.join("\n");
  if (!error.response)
    return "Không thể kết nối backend. Hãy kiểm tra mạng và địa chỉ API.";
  if (error.response.status === 401)
    return "Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.";
  if (error.response.status === 403)
    return "Bạn không có quyền quản lý người dùng.";
  if (error.response.status === 409)
    return "Trạng thái tài khoản đã thay đổi. Vui lòng tải lại.";
  return fallback;
}

function useExitOnUnauthorized(error: unknown) {
  const logout = useTravelerStore((state) => state.logout);
  useEffect(() => {
    if (isAxiosError(error) && error.response?.status === 401) {
      logout();
      router.replace("/auth/login");
    }
  }, [error, logout]);
}

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <View style={[styles.badge, { borderColor: STATUS_COLORS[status] }]}>
      <AdminText
        weight="semibold"
        style={{ color: STATUS_COLORS[status], fontSize: 12 }}
      >
        {STATUS_LABELS[status]}
      </AdminText>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <AdminText
        weight="semibold"
        style={{ color: active ? "#FFFFFF" : "#374151", fontSize: 12 }}
      >
        {label}
      </AdminText>
    </Pressable>
  );
}

function UserListItem({ user }: { user: AdminUser }) {
  const mobile = useWindowDimensions().width < 768;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem chi tiết ${user.fullName}`}
      onPress={() => openAdminDetail("users", user.id)}
      style={({ pressed }) => [
        styles.userRow,
        mobile && styles.userRowMobile,
        pressed && { opacity: 0.72 },
      ]}
    >
      <View style={styles.avatar}>
        <AdminText weight="semibold" style={{ color: "#1D4ED8" }}>
          {user.fullName
            .trim()
            .split(/\s+/)
            .slice(-2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()}
        </AdminText>
      </View>
      <View style={styles.userBody}>
        <AdminText weight="semibold" style={styles.name}>
          {user.fullName}
        </AdminText>
        <AdminText style={styles.secondary}>
          {user.email ?? "Chưa có email"}
          {user.phone ? ` · ${user.phone}` : ""}
        </AdminText>
        <AdminText style={styles.secondary}>
          Tham gia: {formatDate(user.createdAt)} · Phiên gần nhất:{" "}
          {formatDate(user.lastSessionAt)}
        </AdminText>
      </View>
      <View style={[styles.userMeta, mobile && styles.userMetaMobile]}>
        <AdminText style={styles.secondary}>
          {user.role === "USER" ? "Khách hàng" : "Chủ khách sạn"}
        </AdminText>
        <StatusBadge status={user.status} />
        <AdminText weight="semibold" style={styles.viewLink}>
          Xem chi tiết →
        </AdminText>
      </View>
    </Pressable>
  );
}

export function UsersScreen() {
  const mode = useTravelerStore((state) => state.session?.mode);
  return mode === "api" ? <RealUsersScreen /> : <DemoUsersScreen />;
}

function RealUsersScreen() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<ManagedRole | undefined>();
  const [status, setStatus] = useState<UserStatus | undefined>();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState<"createdAt" | "fullName">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const result = useAdminUsers({
    search,
    role,
    status,
    page,
    limit,
    sortBy,
    sortOrder,
  });
  useExitOnUnauthorized(result.error);
  const hasFilters = !!(search || role || status);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const reset = () => {
    setSearchInput("");
    setSearch("");
    setRole(undefined);
    setStatus(undefined);
    setPage(1);
  };
  const chooseRole = (value?: ManagedRole) => {
    setRole(value);
    setPage(1);
  };
  const chooseStatus = (value?: UserStatus) => {
    setStatus(value);
    setPage(1);
  };
  const chooseSort = (
    field: "createdAt" | "fullName",
    order: "asc" | "desc",
  ) => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  };

  return (
    <AdminPage
      title="Quản lý người dùng"
      subtitle="Quản lý thông tin, quyền truy cập và trạng thái tài khoản trong hệ thống."
    >
      <AdminCard title="Tìm người dùng">
        <AdminText style={styles.secondary}>
          Tìm theo tên, email, số điện thoại · lọc theo vai trò và trạng thái.
        </AdminText>
        <AdminInput
          label="Tên, email hoặc số điện thoại"
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Nhập từ khóa tìm kiếm"
        />
        <View style={styles.controls}>
          <AdminButton
            label={showFilters ? "Ẩn bộ lọc" : "Bộ lọc và sắp xếp"}
            variant="outline"
            onPress={() => setShowFilters(!showFilters)}
          />
          <AdminButton label="Xóa bộ lọc" variant="outline" onPress={reset} />
        </View>
        {showFilters ? (
          <View style={styles.filterPanel}>
            <AdminText weight="semibold">Vai trò</AdminText>
            <View style={styles.chips}>
              <FilterChip
                label="Tất cả"
                active={!role}
                onPress={() => chooseRole()}
              />
              <FilterChip
                label="Khách hàng"
                active={role === "USER"}
                onPress={() => chooseRole("USER")}
              />
              <FilterChip
                label="Chủ khách sạn"
                active={role === "HOTEL_OWNER"}
                onPress={() => chooseRole("HOTEL_OWNER")}
              />
            </View>
            <AdminText weight="semibold">Trạng thái tài khoản</AdminText>
            <View style={styles.chips}>
              {STATUS_OPTIONS.map((option) => (
                <FilterChip
                  key={option.value ?? "ALL"}
                  label={option.label}
                  active={status === option.value}
                  onPress={() => chooseStatus(option.value)}
                />
              ))}
            </View>
            <AdminText weight="semibold">Sắp xếp</AdminText>
            <View style={styles.chips}>
              <FilterChip
                label="Mới nhất"
                active={sortBy === "createdAt" && sortOrder === "desc"}
                onPress={() => chooseSort("createdAt", "desc")}
              />
              <FilterChip
                label="Cũ nhất"
                active={sortBy === "createdAt" && sortOrder === "asc"}
                onPress={() => chooseSort("createdAt", "asc")}
              />
              <FilterChip
                label="Tên A–Z"
                active={sortBy === "fullName" && sortOrder === "asc"}
                onPress={() => chooseSort("fullName", "asc")}
              />
              <FilterChip
                label="Tên Z–A"
                active={sortBy === "fullName" && sortOrder === "desc"}
                onPress={() => chooseSort("fullName", "desc")}
              />
            </View>
          </View>
        ) : null}
      </AdminCard>
      {result.isPending ? (
        <AdminSkeleton />
      ) : result.isError ? (
        <AdminCard title="Không thể tải danh sách người dùng">
          <AdminText style={styles.error}>
            {getAdminErrorMessage(result.error, "Vui lòng thử lại.")}
          </AdminText>
          <AdminButton
            label="Thử lại"
            onPress={() => void result.refetch()}
            style={styles.smallButton}
          />
        </AdminCard>
      ) : (
        <>
          <AdminCard title={`Người dùng (${result.data.total})`}>
            {result.data.items.length ? (
              result.data.items.map((user) => (
                <UserListItem key={user.id} user={user} />
              ))
            ) : (
              <View style={styles.empty}>
                <AdminText>
                  {hasFilters
                    ? "Không tìm thấy tài khoản phù hợp."
                    : "Chưa có người dùng nào."}
                </AdminText>
                {hasFilters ? (
                  <AdminButton
                    label="Xóa bộ lọc"
                    variant="outline"
                    onPress={reset}
                  />
                ) : null}
              </View>
            )}
          </AdminCard>
          <AdminCard>
            <View style={styles.pagination}>
              <AdminText style={styles.secondary}>
                Trang {page} / {Math.max(1, result.data.totalPages)} · Tổng{" "}
                {result.data.total} tài khoản
              </AdminText>
              <View style={styles.controls}>
                <AdminButton
                  label="Trước"
                  variant="outline"
                  disabled={page <= 1}
                  onPress={() => setPage(page - 1)}
                />
                <AdminButton
                  label="Sau"
                  variant="outline"
                  disabled={page >= result.data.totalPages}
                  onPress={() => setPage(page + 1)}
                />
              </View>
            </View>
            <View style={styles.chips}>
              {[10, 20, 50].map((value) => (
                <FilterChip
                  key={value}
                  label={`${value}/trang`}
                  active={limit === value}
                  onPress={() => {
                    setLimit(value);
                    setPage(1);
                  }}
                />
              ))}
            </View>
          </AdminCard>
        </>
      )}
      <AdminCard title="Phạm vi hành động">
        <AdminText style={styles.secondary}>
          Mọi quyết định khóa hoặc đình chỉ cần lý do và được ghi vào nhật ký.
        </AdminText>
      </AdminCard>
    </AdminPage>
  );
}

export function UserDetailScreen({ id }: { id: string }) {
  const mode = useTravelerStore((state) => state.session?.mode);
  return mode === "api" ? (
    <RealUserDetailScreen id={id} />
  ) : (
    <DemoUserDetailScreen id={id} />
  );
}

function RealUserDetailScreen({ id }: { id: string }) {
  const session = useTravelerStore((state) => state.session);
  const detail = useAdminUserDetail(id);
  useExitOnUnauthorized(detail.error);
  const mutation = useAccountAction(id);
  const [action, setAction] = useState<AccountAction | null>(null);
  const [notice, setNotice] = useState("");
  const user = detail.data;
  const actions: AccountAction[] =
    user?.status === "ACTIVE"
      ? ["LOCK", "SUSPEND"]
      : user?.status === "LOCKED"
        ? ["UNLOCK"]
        : user?.status === "SUSPENDED"
          ? ["RESTORE"]
          : [];
  const actionLabels: Record<AccountAction, string> = {
    LOCK: "Khóa tài khoản",
    UNLOCK: "Mở khóa tài khoản",
    SUSPEND: "Đình chỉ tài khoản",
    RESTORE: "Khôi phục tài khoản",
  };

  return (
    <AdminPage
      title="Chi tiết người dùng"
      subtitle="Thông tin tài khoản và quyết định quản trị được truy vết."
    >
      <AdminButton
        label="← Quay lại danh sách"
        variant="outline"
        onPress={() => router.back()}
        style={styles.backButton}
      />
      {detail.isPending ? (
        <AdminSkeleton />
      ) : detail.isError ? (
        <AdminCard title="Không thể tải chi tiết người dùng">
          <AdminText style={styles.error}>
            {getAdminErrorMessage(detail.error, "Vui lòng thử lại.")}
          </AdminText>
          <AdminButton
            label="Thử lại"
            onPress={() => void detail.refetch()}
            style={styles.smallButton}
          />
        </AdminCard>
      ) : user ? (
        <>
          {notice ? (
            <AdminCard tone="blue">
              <AdminText>{notice}</AdminText>
            </AdminCard>
          ) : null}
          <AdminCard title={user.fullName}>
            <View style={styles.chips}>
              <StatusBadge status={user.status} />
              <AdminText style={styles.secondary}>
                {user.role === "USER" ? "Khách hàng" : "Chủ khách sạn"}
              </AdminText>
            </View>
            <AdminText style={styles.secondary}>
              Mã người dùng: {user.id}
            </AdminText>
            <AdminText>Email: {user.email ?? "Chưa có"}</AdminText>
            <AdminText>Điện thoại: {user.phone ?? "Chưa có"}</AdminText>
          </AdminCard>
          <AdminCard title="Thông tin tài khoản">
            <AdminText>Ngày tham gia: {formatDate(user.createdAt)}</AdminText>
            <AdminText>
              Cập nhật gần nhất: {formatDate(user.updatedAt)}
            </AdminText>
            <AdminText>
              Xác minh email:{" "}
              {user.emailVerifiedAt ? "Đã xác minh" : "Chưa xác minh"}
            </AdminText>
            <AdminText>
              Xác minh điện thoại:{" "}
              {user.phoneVerifiedAt ? "Đã xác minh" : "Chưa xác minh"}
            </AdminText>
          </AdminCard>
          <AdminCard title="Hoạt động">
            <AdminText>
              Số đặt phòng: {user.activitySummary.bookingCount}
            </AdminText>
            <AdminText>
              Số chỗ ở quản lý: {user.activitySummary.accommodationCount}
            </AdminText>
            <AdminText>
              Phiên gần nhất: {formatDate(user.activitySummary.lastSessionAt)}
            </AdminText>
          </AdminCard>
          <AdminCard title="Bằng chứng cần kiểm tra">
            <AdminText style={styles.secondary}>
              Kiểm tra lịch sử báo cáo và bằng chứng trước khi quyết định.
            </AdminText>
            <AdminText style={styles.secondary}>
              Chưa có báo cáo liên kết trong API quản lý người dùng.
            </AdminText>
          </AdminCard>
          <AdminCard title="Quản lý trạng thái">
            <AdminText style={styles.secondary}>
              Mọi thao tác cần lý do và được ghi audit. Khóa hoặc đình chỉ sẽ
              thu hồi các phiên đăng nhập.
            </AdminText>
            {session?.mode === "api" && session.userId === id ? (
              <AdminText style={styles.error}>
                Không thể tự thay đổi trạng thái tài khoản đang sử dụng.
              </AdminText>
            ) : (
              <View style={styles.controls}>
                {actions.map((item) => (
                  <AdminButton
                    key={item}
                    label={actionLabels[item]}
                    variant={
                      item === "LOCK" || item === "SUSPEND"
                        ? "danger"
                        : "primary"
                    }
                    onPress={() => setAction(item)}
                  />
                ))}
              </View>
            )}
            {actions.length === 0 ? (
              <AdminText style={styles.secondary}>
                Trạng thái này không hỗ trợ thao tác quản trị trong ST-ADM-02.
              </AdminText>
            ) : null}
          </AdminCard>
          <AdminCard title="Lịch sử quyết định">
            {user.audit.length ? (
              user.audit.map((event) => (
                <View key={event.id} style={styles.auditRow}>
                  <AdminText weight="semibold">
                    {actionLabels[event.action]} · {formatDate(event.createdAt)}
                  </AdminText>
                  <AdminText style={styles.secondary}>
                    {STATUS_LABELS[event.oldStatus]} →{" "}
                    {STATUS_LABELS[event.newStatus]} · {event.actor.fullName}
                  </AdminText>
                  <AdminText style={styles.secondary}>
                    Lý do: {event.reason}
                  </AdminText>
                </View>
              ))
            ) : (
              <AdminText style={styles.secondary}>
                Chưa có quyết định quản trị nào.
              </AdminText>
            )}
          </AdminCard>
          {action ? (
            <AccountActionDialog
              action={action}
              user={user}
              onCancel={() => setAction(null)}
              onConfirm={async (reason) => {
                try {
                  await mutation.mutateAsync({ action, reason });
                  setNotice(
                    `Đã ${actionLabels[action].toLowerCase()} thành công.`,
                  );
                } catch (error) {
                  throw new Error(
                    getAdminErrorMessage(
                      error,
                      "Không thể cập nhật trạng thái tài khoản.",
                    ),
                  );
                }
              }}
            />
          ) : null}
        </>
      ) : null}
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  secondary: { fontSize: 12, lineHeight: 18, color: "#4B5563" },
  error: { color: "#B91C1C", fontSize: 13, lineHeight: 20 },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterPanel: { gap: 10, paddingTop: 8 },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ADMIN_COLORS.border,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "#305CAD", borderColor: "#305CAD" },
  userRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  userRowMobile: { alignItems: "flex-start", flexWrap: "wrap" },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  userBody: { flex: 1, minWidth: 150, gap: 3 },
  userMeta: { alignItems: "flex-end", gap: 4 },
  userMetaMobile: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  name: { fontSize: 14, lineHeight: 20, color: "#111827" },
  badge: {
    minHeight: 28,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    justifyContent: "center",
  },
  viewLink: { fontSize: 12, color: "#1D4ED8" },
  empty: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  smallButton: { alignSelf: "flex-start" },
  backButton: { alignSelf: "flex-start" },
  auditRow: {
    gap: 4,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
});

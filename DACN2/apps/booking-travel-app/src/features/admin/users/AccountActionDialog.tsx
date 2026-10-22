import { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AdminText } from "../dashboard/components";
import { AdminButton, AdminCard } from "../shared/ui";
import { ADMIN_COLORS, ADMIN_FONT } from "../theme";
import type { AccountAction, AdminUserDetail } from "./api";

const ACTION_LABELS: Record<
  AccountAction,
  { title: string; confirm: string; verb: string }
> = {
  LOCK: {
    title: "Xác nhận khóa người dùng",
    confirm: "Xác nhận khóa",
    verb: "khóa",
  },
  UNLOCK: {
    title: "Xác nhận mở khóa người dùng",
    confirm: "Xác nhận mở khóa",
    verb: "mở khóa",
  },
  SUSPEND: {
    title: "Xác nhận đình chỉ người dùng",
    confirm: "Xác nhận đình chỉ",
    verb: "đình chỉ",
  },
  RESTORE: {
    title: "Xác nhận khôi phục người dùng",
    confirm: "Xác nhận khôi phục",
    verb: "khôi phục",
  },
};
const ACCOUNT_STATUS_LABELS = {
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khóa",
  SUSPENDED: "Đã đình chỉ",
  PENDING_VERIFICATION: "Chưa xác minh",
  DISABLED: "Vô hiệu hóa",
} as const;

export function AccountActionDialog({
  action,
  user,
  onCancel,
  onConfirm,
}: {
  action: AccountAction;
  user: AdminUserDetail;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const pending = useRef(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const details = ACTION_LABELS[action];
  const dangerous = action === "LOCK" || action === "SUSPEND";
  const cancel = () => {
    if (!pending.current) onCancel();
  };
  const submit = async () => {
    if (pending.current) return;
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setError(`Vui lòng nhập lý do ${details.verb} tài khoản.`);
      return;
    }
    if (normalizedReason.length > 500) {
      setError("Lý do không được vượt quá 500 ký tự.");
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await onConfirm(normalizedReason);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể cập nhật tài khoản. Vui lòng thử lại.",
      );
      pending.current = false;
      setBusy(false);
      return;
    }
    pending.current = false;
    setBusy(false);
    onCancel();
  };

  return (
    <Modal
      animationType="fade"
      transparent
      statusBarTranslucent
      visible
      onRequestClose={cancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.wrap,
            {
              paddingTop: Math.max(20, insets.top + 12),
              paddingBottom: Math.max(20, insets.bottom + 12),
            },
          ]}
        >
          <View style={[styles.dialog, width < 768 && styles.dialogMobile]}>
            <AdminText weight="bold" style={styles.title}>
              {details.title}
            </AdminText>
            <AdminText style={styles.subtitle}>
              Quyết định của Admin · cần bằng chứng, lý do và audit
            </AdminText>
            <AdminCard title="Đối tượng">
              <AdminText weight="semibold">
                {user.fullName} · {user.email ?? user.phone ?? user.id}
              </AdminText>
              <AdminText style={styles.muted}>
                {user.role === "USER" ? "Khách hàng" : "Chủ khách sạn"} ·{" "}
                {ACCOUNT_STATUS_LABELS[user.status]}
              </AdminText>
            </AdminCard>
            <AdminCard title="Bằng chứng cần kiểm tra">
              <AdminText style={styles.muted}>
                Kiểm tra lịch sử báo cáo và bằng chứng trước khi quyết định.
              </AdminText>
              <AdminText style={styles.muted}>
                Chưa có báo cáo liên kết trong API quản lý người dùng.
              </AdminText>
            </AdminCard>
            <AdminCard title="Lý do quyết định" tone="yellow">
              <TextInput
                accessibilityLabel="Lý do quyết định"
                multiline
                maxLength={500}
                onChangeText={setReason}
                placeholder="Ghi rõ lý do và bằng chứng đã đối chiếu"
                placeholderTextColor="#75879B"
                style={styles.reason}
                textAlignVertical="top"
                value={reason}
              />
              <AdminText style={styles.muted}>
                {reason.length}/500 ký tự
              </AdminText>
              {error ? (
                <AdminText style={styles.error}>{error}</AdminText>
              ) : null}
            </AdminCard>
            <AdminCard>
              <AdminText style={styles.muted}>
                Sau xác nhận: ghi người thao tác, thời gian, đối tượng và lý do
                vào audit log.
              </AdminText>
            </AdminCard>
            {dangerous ? (
              <AdminText style={styles.warning}>
                Tài khoản sẽ mất quyền đăng nhập và các phiên hiện tại sẽ bị thu
                hồi.
              </AdminText>
            ) : null}
            <View style={[styles.actions, width < 768 && styles.actionsMobile]}>
              <AdminButton
                label="Hủy"
                variant="outline"
                disabled={busy}
                onPress={cancel}
                style={styles.actionButton}
              />
              <AdminButton
                label={busy ? "Đang xử lý..." : details.confirm}
                variant={dangerous ? "danger" : "primary"}
                disabled={busy}
                onPress={() => void submit()}
                style={styles.actionButton}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.46)" },
  wrap: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  dialog: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    backgroundColor: ADMIN_COLORS.background,
    padding: 20,
    gap: 12,
  },
  dialogMobile: { padding: 12 },
  title: { fontSize: 24, lineHeight: 32, color: "#111827" },
  subtitle: { fontSize: 12, lineHeight: 18, color: "#4B5563" },
  muted: { fontSize: 13, lineHeight: 20, color: "#4B5563" },
  reason: {
    minHeight: 92,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D7E2EF",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    color: "#111827",
    fontFamily: ADMIN_FONT.regular,
    fontSize: 14,
  },
  error: { color: "#B91C1C", fontSize: 12 },
  warning: { color: "#B45309", fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", gap: 8 },
  actionsMobile: { flexDirection: "column" },
  actionButton: { flex: 1, minHeight: 44 },
});

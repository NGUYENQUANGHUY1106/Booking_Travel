import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

import { AdminText } from '../dashboard/components';
import { AdminButton } from '../shared/ui';
import { ADMIN_FONT } from '../theme';
import type { OwnerReviewDetail } from './api';

export function DecisionDialog({ application, decision, reason, setReason, error, busy, onCancel, onConfirm }: {
  application: OwnerReviewDetail;
  decision: 'APPROVE' | 'REJECT' | null;
  reason: string;
  setReason: (value: string) => void;
  error: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const mobile = useWindowDimensions().width < 768;
  return <Modal visible={decision !== null} transparent animationType="fade" onRequestClose={onCancel}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
        <View style={styles.dialog}>
          <AdminText weight="bold" style={styles.title}>{decision === 'APPROVE' ? 'Xác nhận phê duyệt chủ khách sạn' : 'Từ chối xác minh chủ khách sạn'}</AdminText>
          <AdminText>{decision === 'APPROVE' ? 'Bạn có chắc muốn phê duyệt hồ sơ này? Người đăng ký sẽ được cấp quyền Chủ khách sạn sau khi xác minh thành công.' : 'Vui lòng cung cấp lý do rõ ràng để người đăng ký có thể chỉnh sửa và gửi lại hồ sơ.'}</AdminText>
          <View style={styles.summary}>
            <AdminText weight="semibold">{application.user.fullName} · {application.businessName}</AdminText>
            <AdminText style={styles.muted}>Mã hồ sơ: {application.id} · Chờ duyệt · Phiên bản {application.version}</AdminText>
          </View>
          <AdminText weight="semibold">{decision === 'REJECT' ? 'Lý do từ chối (bắt buộc)' : 'Ghi chú xét duyệt (không bắt buộc)'}</AdminText>
          <TextInput accessibilityLabel="Lý do xét duyệt" multiline textAlignVertical="top" maxLength={500} value={reason} onChangeText={setReason} placeholder="Ghi rõ kết quả đối chiếu tài liệu" placeholderTextColor="#64748B" style={[styles.input, error && styles.inputError]} />
          {error ? <AdminText style={styles.error}>{error}</AdminText> : null}
          <AdminText style={styles.muted}>Quyết định được ghi vào nhật ký và thông báo cho người đăng ký.</AdminText>
          <View style={[styles.actions, mobile && styles.mobileActions]}>
            <AdminButton label="Hủy" variant="outline" disabled={busy} onPress={onCancel} style={mobile ? styles.mobileButton : styles.button} />
            <AdminButton label={busy ? 'Đang xử lý…' : decision === 'APPROVE' ? 'Xác nhận phê duyệt' : 'Xác nhận từ chối'} variant={decision === 'REJECT' ? 'danger' : 'primary'} disabled={busy} onPress={onConfirm} style={mobile ? styles.mobileButton : styles.button} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 480, padding: 20, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 12 },
  title: { color: '#111827', fontSize: 20, lineHeight: 28 },
  summary: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 9, gap: 6 },
  muted: { color: '#57697D', fontSize: 12, lineHeight: 18 },
  input: { minHeight: 96, padding: 12, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 9, color: '#111827', fontFamily: ADMIN_FONT.regular },
  inputError: { borderColor: '#B91C1C' }, error: { color: '#B91C1C', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10 }, mobileActions: { flexDirection: 'column' }, button: { flex: 1 }, mobileButton: { width: '100%' },
});

import { router, useLocalSearchParams, type Href } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminText } from '../dashboard/components';
import { ADMIN_COLORS, ADMIN_FONT } from '../theme';

export function AdminPage({ title, subtitle = 'Dữ liệu minh họa · quyết định được ghi nhận và truy vết', eyebrow = 'QUẢN TRỊ HỆ THỐNG', children, trailing }: PropsWithChildren<{ title: string; subtitle?: string; eyebrow?: string; trailing?: React.ReactNode }>) {
  const { width } = useWindowDimensions();
  const mobile = width < 768;
  const { demoState } = useLocalSearchParams<{ demoState?: string }>();
  const [retried, setRetried] = useState(false);
  return <View style={s.screen}>
    <ScrollView style={s.main} contentContainerStyle={[s.mainScroll, mobile && s.mainScrollMobile]} showsVerticalScrollIndicator={false}>
      <View style={s.content}>
        <View style={[s.heading, mobile && s.headingMobile]}>
          <View style={{ flex: 1, minWidth: 0 }}>{!mobile ? <AdminText weight="semibold" style={s.eyebrow}>{eyebrow}</AdminText> : null}<AdminText accessibilityRole="header" weight="bold" style={s.title}>{title}</AdminText><AdminText style={s.subtitle}>{subtitle}</AdminText></View>
          {trailing}
        </View>
        {demoState === 'loading' ? <AdminSkeleton /> : demoState === 'error' && !retried ? <AdminCard title="Không thể tải dữ liệu"><AdminText>Vui lòng thử lại.</AdminText><AdminButton label="Thử lại" onPress={() => setRetried(true)} style={{ alignSelf: 'flex-start' }} /></AdminCard> : demoState === 'empty' ? <AdminCard><AdminText>Không có dữ liệu phù hợp.</AdminText></AdminCard> : children}
      </View>
    </ScrollView>
  </View>;
}

export function AdminCard({ title, children, tone = 'default', style }: PropsWithChildren<{ title?: string; tone?: 'default' | 'blue' | 'yellow' | 'purple' | 'red'; style?: object }>) {
  const mobile = useWindowDimensions().width < 768;
  return <View style={[s.card, tone !== 'default' && { backgroundColor: { blue: '#DBEAFE', yellow: '#FEF3C7', purple: '#EDE9FE', red: '#FEF2F2' }[tone] }, style, mobile && s.cardMobile]}>{title ? <AdminText weight="semibold" style={s.cardTitle}>{title}</AdminText> : null}{children}</View>;
}

export function AdminButton({ label, onPress, variant = 'primary', disabled = false, style }: { label: string; onPress: () => void; variant?: 'primary' | 'danger' | 'outline'; disabled?: boolean; style?: object }) {
  const mobile = useWindowDimensions().width < 768;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [s.button, variant === 'danger' && s.danger, variant === 'outline' && s.outline, style, mobile && s.buttonMobile, pressed && { opacity: 0.75 }]}><AdminText weight="semibold" style={[s.buttonText, variant === 'outline' && s.outlineText]}>{label}</AdminText></Pressable>;
}

export function AdminInput({ label, value, onChangeText, placeholder, error, secureTextEntry, keyboardType }: { label?: string; value: string; onChangeText: (value: string) => void; placeholder?: string; error?: string; secureTextEntry?: boolean; keyboardType?: 'default' | 'email-address' | 'numeric' }) {
  const mobile = useWindowDimensions().width < 768;
  return <View style={[s.inputWrap, mobile && s.inputWrapMobile]}>{label ? <AdminText weight="medium" style={s.label}>{label}</AdminText> : null}<TextInput accessibilityLabel={label || placeholder} placeholder={placeholder} placeholderTextColor="#75879B" value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={keyboardType} style={[s.input, error && { borderColor: '#B91C1C' }]} />{error ? <AdminText style={s.error}>{error}</AdminText> : null}</View>;
}

export function AdminRow({ title, subtitle, status, onPress, leading }: { title: string; subtitle?: string; status?: string; onPress?: () => void; leading?: React.ReactNode }) {
  const mobile = useWindowDimensions().width < 768;
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={({ pressed }) => [s.row, mobile && s.rowMobile, pressed && { opacity: 0.7 }]}>{leading}<View style={[s.rowBody, mobile && s.rowBodyMobile]}><AdminText weight="semibold" style={s.rowTitle}>{title}</AdminText>{subtitle ? <AdminText style={s.rowSubtitle}>{subtitle}</AdminText> : null}</View>{status ? <AdminText weight="semibold" style={s.rowStatus}>{status}</AdminText> : null}</Pressable>;
}

export function AdminEmpty({ onRefresh }: { onRefresh?: () => void }) { return <View style={s.empty}><View style={s.emptyIcon}><AdminText weight="bold" style={{ fontSize: 32, color: '#1D4ED8' }}>⌕</AdminText></View><AdminText weight="semibold" style={{ fontSize: 20 }}>Không có yêu cầu đang chờ</AdminText><AdminText style={s.subtitle}>Hàng chờ đã được xử lý.</AdminText>{onRefresh ? <AdminButton label="Làm mới" onPress={onRefresh} style={{ width: 340 }} /> : null}</View>; }
export function AdminSkeleton() { return <View style={{ gap: 16 }}><View style={{ height: 96, borderRadius: 12, backgroundColor: '#E9EEF5' }} /><View style={{ height: 166, borderRadius: 12, backgroundColor: '#E9EEF5' }} /><View style={{ height: 80, borderRadius: 12, backgroundColor: '#E9EEF5' }} /></View>; }

export function AdminDecisionDialog({ visible, title, target, evidence, reasonRequired = false, confirmLabel, danger = false, onCancel, onConfirm }: { visible: boolean; title: string; target: string; evidence: string; reasonRequired?: boolean; confirmLabel: string; danger?: boolean; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const mobile = useWindowDimensions().width < 768;
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const close = () => { setReason(''); setError(''); onCancel(); };
  const confirm = () => { if (reasonRequired && !reason.trim()) { setError('Vui lòng nhập lý do quyết định.'); return; } onConfirm(reason.trim()); setReason(''); setError(''); };
  return <Modal animationType="fade" transparent statusBarTranslucent visible={visible} onRequestClose={close}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.modalWrap, { paddingTop: Math.max(20, insets.top + 12), paddingBottom: Math.max(20, insets.bottom + 12) }]}><View style={[s.modal, mobile && s.modalMobile]}><AdminText weight="bold" style={s.modalTitle}>{title}</AdminText><AdminText style={s.modalText}>{target}</AdminText><AdminText weight="semibold" style={s.label}>Bằng chứng cần kiểm tra</AdminText><AdminText style={s.modalText}>{evidence}</AdminText><AdminInput label={reasonRequired ? 'Lý do quyết định (bắt buộc)' : 'Lý do quyết định'} value={reason} onChangeText={setReason} placeholder="Ghi lý do và bằng chứng đã đối chiếu" error={error} /><AdminText style={s.auditNote}>Quyết định sẽ được ghi vào nhật ký minh họa.</AdminText><View style={[s.modalActions, mobile && s.modalActionsMobile]}><AdminButton label="Hủy" variant="outline" onPress={close} style={mobile ? s.modalButtonMobile : s.modalButtonDesktop} /><AdminButton label={confirmLabel} variant={danger ? 'danger' : 'primary'} onPress={confirm} style={mobile ? s.modalButtonMobile : s.modalButtonDesktop} /></View></View></ScrollView></KeyboardAvoidingView></Modal>;
}

export function AdminLink({ label, href }: { label: string; href: Href }) { return <AdminButton label={label} onPress={() => router.push(href)} />; }
export function openAdminScreen(section: string, id?: string) { router.push({ pathname: '/admin/[section]', params: { section, ...(id ? { id } : {}) } } as unknown as Href); }
export function openAdminDetail(kind: string, id: string) { router.push({ pathname: '/admin/detail/[kind]', params: { kind, id } } as unknown as Href); }

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ADMIN_COLORS.background },
  main: { flex: 1 }, mainScroll: { padding: 24, minHeight: '100%', alignItems: 'center' }, content: { width: '100%', maxWidth: 1040, gap: 16 },
  mainScrollMobile: { padding: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 1 }, eyebrow: { fontSize: 10, lineHeight: 14, letterSpacing: 0.6, color: '#175ED6', marginBottom: 16 }, title: { fontSize: 24, lineHeight: 32, color: '#111827' }, subtitle: { fontSize: 12, lineHeight: 18, color: '#57697D', marginTop: 8 },
  headingMobile: { flexWrap: 'wrap', alignItems: 'flex-start' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 12 }, cardTitle: { fontSize: 16, lineHeight: 24, color: '#111827' },
  cardMobile: { width: '100%', flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minWidth: 0 },
  button: { height: 40, minWidth: 140, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center' }, danger: { backgroundColor: '#B91C1C' }, outline: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D7E2EF' }, buttonText: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, textAlign: 'center' }, outlineText: { color: '#2563EB' },
  buttonMobile: { minWidth: 0, minHeight: 44, maxWidth: '100%', flexShrink: 1 },
  inputWrap: { gap: 5, flex: 1, minWidth: 180 },
  inputWrapMobile: { minWidth: 0, width: '100%', flex: 0, flexBasis: 'auto' },
  label: { color: '#344054', fontSize: 13, lineHeight: 20 }, input: { minHeight: 40, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 8, paddingHorizontal: 12, fontSize: 13, fontFamily: ADMIN_FONT.regular, color: '#122138', backgroundColor: '#FFFFFF' }, error: { fontSize: 12, color: '#B91C1C' },
  row: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }, rowTitle: { fontSize: 14, lineHeight: 20, color: '#111827' }, rowSubtitle: { fontSize: 12, lineHeight: 18, color: '#57697D' }, rowStatus: { fontSize: 12, color: '#B85C14' },
  rowMobile: { flexDirection: 'column', alignItems: 'flex-start', gap: 6, borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.border },
  rowBody: { flex: 1, minWidth: 0, gap: 3 },
  rowBodyMobile: { flexGrow: 0, flexShrink: 0, width: '100%' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 400 }, emptyIcon: { height: 96, width: 96, borderRadius: 48, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center' }, modalWrap: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }, modal: { width: '100%', maxWidth: 440, borderRadius: 22, padding: 24, backgroundColor: '#FFFFFF', gap: 14 }, modalTitle: { fontSize: 20, color: '#111827' }, modalText: { fontSize: 14, lineHeight: 20, color: '#475569' }, auditNote: { fontSize: 12, color: '#57697D' }, modalActions: { flexDirection: 'row', gap: 10 },
  modalMobile: { padding: 18 },
  modalActionsMobile: { flexDirection: 'column' },
  modalButtonDesktop: { flex: 1 },
  modalButtonMobile: { width: '100%' },
});
export const adminUiStyles = s;

import { isAxiosError } from 'axios';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';

import { useTravelerStore } from '@/features/traveler/store';
import { AdminText } from '../dashboard/components';
import { AdminButton, AdminCard, AdminPage, AdminSkeleton } from '../shared/ui';
import { ADMIN_COLORS, ADMIN_FONT } from '../theme';
import { DecisionDialog } from './DecisionDialog';
import { ownerVerificationApi, type OwnerReviewDocument, type OwnerReviewItem, type OwnerReviewQuery, type OwnerReviewStatus, type OwnerDocumentPurpose } from './api';
import { useOwnerDecision, useOwnerReviewDetail, useOwnerReviewQueue } from './queries';

const STATUS_LABELS: Record<OwnerReviewStatus, string> = { PENDING: 'Chờ duyệt', VERIFIED: 'Đã xác minh', REJECTED: 'Bị từ chối', SUSPENDED: 'Đình chỉ' };
const STATUS_COLORS: Record<OwnerReviewStatus, string> = { PENDING: '#B45309', VERIFIED: '#15803D', REJECTED: '#B91C1C', SUSPENDED: '#6B7280' };
const FILTERS: { label: string; value?: OwnerReviewStatus }[] = [
  { label: 'Tất cả' }, { label: 'Chờ duyệt', value: 'PENDING' }, { label: 'Đã xác minh', value: 'VERIFIED' },
  { label: 'Bị từ chối', value: 'REJECTED' }, { label: 'Đình chỉ', value: 'SUSPENDED' },
];
type ReturnParams = { search?: string; status?: string; page?: string; sortBy?: string; sortOrder?: string };

function date(value: string | null | undefined) {
  if (!value) return 'Chưa có';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Chưa có' : parsed.toLocaleString('vi-VN');
}

function errorText(error: unknown, fallback: string) {
  if (!isAxiosError<{ message?: string | string[] }>(error)) return fallback;
  const message = error.response?.data?.message;
  if (typeof message === 'string' && message.trim()) return message;
  if (Array.isArray(message)) return message.join('\n');
  if (!error.response) return 'Không thể kết nối backend. Vui lòng kiểm tra mạng và tải lại trạng thái.';
  if (error.response.status === 401) return 'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại.';
  if (error.response.status === 403) return 'Bạn không có quyền xác minh Chủ khách sạn.';
  if (error.response.status === 409) return 'Hồ sơ đã được cập nhật hoặc xử lý bởi người khác. Vui lòng tải lại thông tin mới nhất.';
  return fallback;
}

function Badge({ status }: { status: OwnerReviewStatus }) {
  return <View style={[styles.badge, { borderColor: STATUS_COLORS[status] }]}><AdminText weight="semibold" style={{ color: STATUS_COLORS[status], fontSize: 12 }}>{STATUS_LABELS[status]}</AdminText></View>;
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><AdminText weight="semibold" style={{ color: selected ? '#FFFFFF' : '#374151', fontSize: 12 }}>{label}</AdminText></Pressable>;
}

function Summary({ title, value, color }: { title: string; value: number; color: string }) {
  const mobile = useWindowDimensions().width < 768;
  return <View style={[styles.summaryItem, mobile && styles.summaryItemMobile]}><AdminText weight="bold" style={{ color, fontSize: 24 }}>{value}</AdminText><AdminText style={styles.muted}>{title}</AdminText></View>;
}

export function OwnerQueueScreen() {
  const params = useLocalSearchParams<ReturnParams>();
  const mode = useTravelerStore((state) => state.session?.mode);
  const mobile = useWindowDimensions().width < 768;
  const [searchInput, setSearchInput] = useState(params.search ?? '');
  const [search, setSearch] = useState(params.search ?? '');
  const [status, setStatus] = useState<OwnerReviewStatus | undefined>(params.status === '' ? undefined : FILTERS.some((item) => item.value && item.value === params.status) ? params.status as OwnerReviewStatus : 'PENDING');
  const [page, setPage] = useState(Math.max(1, Number(params.page) || 1));
  const [sortBy, setSortBy] = useState<OwnerReviewQuery['sortBy']>(params.sortBy === 'updatedAt' ? 'updatedAt' : 'submittedAt');
  const [sortOrder, setSortOrder] = useState<OwnerReviewQuery['sortOrder']>(params.sortOrder === 'asc' ? 'asc' : 'desc');
  const result = useOwnerReviewQueue({ search, status, page, limit: 10, sortBy, sortOrder }, mode === 'api');
  const changeStatus = (next?: OwnerReviewStatus) => { setStatus(next); setPage(1); };
  const submitSearch = () => { setSearch(searchInput.trim()); setPage(1); };
  const open = (item: OwnerReviewItem) => router.push({ pathname: '/admin/detail/[kind]', params: {
    kind: 'owner-verification', id: item.id, search, status: status ?? '', page: String(page), sortBy, sortOrder,
  } } as unknown as Href);

  return <AdminPage title="Hồ sơ chủ khách sạn" eyebrow="QUẢN TRỊ HỆ THỐNG / XÁC MINH CHỦ KHÁCH SẠN" subtitle="Kiểm tra hồ sơ đăng ký và đưa ra quyết định xác minh.">
    {mode !== 'api' ? <AdminCard title="Cần đăng nhập Admin"><AdminText>Đăng nhập bằng tài khoản Admin thật để xem hồ sơ từ backend.</AdminText></AdminCard> : null}
    {mode === 'api' && result.data ? <View style={[styles.summary, mobile && styles.stack]}><Summary title="Chờ xét duyệt" value={result.data.summary.pending} color="#B45309" /><Summary title="Đã xác minh" value={result.data.summary.verified} color="#15803D" /><Summary title="Bị từ chối" value={result.data.summary.rejected} color="#B91C1C" /></View> : null}
    {mode === 'api' ? <AdminCard title="Tìm kiếm và lọc hồ sơ">
      <View style={[styles.searchRow, mobile && styles.stack]}><TextInput accessibilityLabel="Tìm tên, liên hệ, doanh nghiệp hoặc mã hồ sơ" placeholder="Tên, liên hệ, doanh nghiệp hoặc mã hồ sơ" placeholderTextColor="#64748B" value={searchInput} onChangeText={setSearchInput} onSubmitEditing={submitSearch} returnKeyType="search" style={[styles.searchInput, mobile && styles.searchInputMobile]} /><AdminButton label="Tìm kiếm" onPress={submitSearch} style={mobile ? styles.fullButton : undefined} /></View>
      <View style={styles.chips}>{FILTERS.map((item) => <Chip key={item.label} label={item.label} selected={status === item.value} onPress={() => changeStatus(item.value)} />)}</View>
      <View style={styles.chips}><Chip label="Mới gửi nhất" selected={sortBy === 'submittedAt' && sortOrder === 'desc'} onPress={() => { setSortBy('submittedAt'); setSortOrder('desc'); setPage(1); }} /><Chip label="Cũ nhất" selected={sortBy === 'submittedAt' && sortOrder === 'asc'} onPress={() => { setSortBy('submittedAt'); setSortOrder('asc'); setPage(1); }} /><Chip label="Mới cập nhật" selected={sortBy === 'updatedAt'} onPress={() => { setSortBy('updatedAt'); setSortOrder('desc'); setPage(1); }} /></View>
    </AdminCard> : null}
    {mode === 'api' && result.isPending ? <AdminSkeleton /> : null}
    {mode === 'api' && result.isError ? <AdminCard title="Không thể tải hồ sơ"><AdminText>{errorText(result.error, 'Vui lòng thử lại.')}</AdminText><AdminButton label="Thử lại" onPress={() => void result.refetch()} style={styles.actionButton} /></AdminCard> : null}
    {mode === 'api' && result.data ? <AdminCard title={`Danh sách hồ sơ · ${result.data.total} kết quả`}>
      {!result.data.items.length ? <AdminText style={styles.muted}>{status === 'PENDING' ? 'Hiện không có hồ sơ đang chờ xét duyệt.' : 'Không có hồ sơ Chủ khách sạn nào phù hợp.'}</AdminText> : null}
      {!mobile && result.data.items.length ? <View style={styles.tableHeader}><AdminText style={[styles.column, { flex: 1.3 }]}>MÃ HỒ SƠ</AdminText><AdminText style={[styles.column, { flex: 2 }]}>NGƯỜI ĐĂNG KÝ</AdminText><AdminText style={[styles.column, { flex: 2 }]}>DOANH NGHIỆP</AdminText><AdminText style={[styles.column, { flex: 1.5 }]}>NGÀY GỬI</AdminText><AdminText style={[styles.column, { flex: 1.2 }]}>TRẠNG THÁI</AdminText></View> : null}
      {result.data.items.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Xem hồ sơ ${item.id}`} onPress={() => open(item)} style={({ pressed }) => [styles.tableRow, mobile && styles.tableRowMobile, pressed && styles.pressed]}>
        {mobile ? <><View style={styles.between}><AdminText weight="semibold">{item.user.fullName}</AdminText><Badge status={item.status} /></View><AdminText style={styles.muted}>{item.id}</AdminText><AdminText>{item.businessName || 'Chưa có tên cơ sở'}</AdminText><AdminText style={styles.muted}>{item.user.email || item.user.phone || 'Chưa có liên hệ'} · {date(item.submittedAt)}</AdminText><AdminText weight="semibold" style={styles.link}>Xem chi tiết →</AdminText></> : <><AdminText numberOfLines={1} style={[styles.cell, { flex: 1.3 }]}>{item.id}</AdminText><View style={{ flex: 2, minWidth: 0 }}><AdminText weight="semibold" numberOfLines={1}>{item.user.fullName}</AdminText><AdminText numberOfLines={1} style={styles.muted}>{item.user.email || item.user.phone || 'Chưa có liên hệ'}</AdminText></View><AdminText numberOfLines={2} style={[styles.cell, { flex: 2 }]}>{item.businessName || 'Chưa có tên cơ sở'}</AdminText><AdminText style={[styles.cell, { flex: 1.5 }]}>{date(item.submittedAt)}</AdminText><View style={{ flex: 1.2 }}><Badge status={item.status} /></View></>}
      </Pressable>)}
      <View style={styles.pager}><AdminText style={styles.muted}>Trang {result.data.page}/{Math.max(1, result.data.totalPages)} · {result.data.total} hồ sơ</AdminText><View style={styles.pagerActions}><AdminButton label="Trước" variant="outline" disabled={page <= 1 || result.isFetching} onPress={() => setPage((value) => value - 1)} /><AdminButton label="Sau" variant="outline" disabled={page >= result.data.totalPages || result.isFetching} onPress={() => setPage((value) => value + 1)} /></View></View>
    </AdminCard> : null}
  </AdminPage>;
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  const mobile = useWindowDimensions().width < 768;
  return <View style={[styles.info, mobile && styles.infoMobile]}><AdminText style={styles.muted}>{label}</AdminText><AdminText weight="semibold" style={styles.infoValue}>{value || 'Chưa có'}</AdminText></View>;
}

function DocumentCard({ title, document, opened, opening, onOpen }: { title: string; document: OwnerReviewDocument | null; opened: boolean; opening: boolean; onOpen: () => void }) {
  const mobile = useWindowDimensions().width < 768;
  const available = document?.status === 'READY' && Boolean(document.verifiedAt);
  return <View style={[styles.documentCard, mobile && styles.documentCardMobile]}><AdminText weight="semibold">{title}</AdminText><AdminText style={styles.muted}>{document ? `${document.mimeType} · ${(document.expectedSize / 1048576).toFixed(2)} MB · ${date(document.createdAt)}` : 'Chưa có tài liệu'}</AdminText><AdminText style={{ color: available ? '#15803D' : '#B91C1C', fontSize: 12 }}>{available ? opened ? 'Đã mở để xem' : 'Cần mở để đối chiếu' : 'Thiếu hoặc chưa xác minh tệp'}</AdminText><AdminButton label={opening ? 'Đang mở…' : 'Mở tài liệu riêng tư'} variant="outline" disabled={!available || opening} onPress={onOpen} style={mobile ? styles.fullButton : styles.actionButton} /></View>;
}

export function OwnerDetailScreen({ id }: { id: string }) {
  const params = useLocalSearchParams<ReturnParams>();
  const mode = useTravelerStore((state) => state.session?.mode);
  const mobile = useWindowDimensions().width < 768;
  const result = useOwnerReviewDetail(id, mode === 'api');
  const action = useOwnerDecision(id);
  const [opening, setOpening] = useState<OwnerDocumentPurpose | null>(null);
  const [openedDocs, setOpenedDocs] = useState<OwnerDocumentPurpose[]>([]);
  const [checked, setChecked] = useState(false);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const application = result.data;
  const back = () => router.replace({ pathname: '/admin/[section]', params: {
    section: 'owner-verification', search: params.search ?? '', status: params.status ?? 'PENDING',
    page: params.page ?? '1', sortBy: params.sortBy ?? 'submittedAt', sortOrder: params.sortOrder ?? 'desc',
  } } as unknown as Href);
  const openDocument = async (purpose: OwnerDocumentPurpose) => {
    setOpening(purpose); setNotice('');
    try {
      const access = await ownerVerificationApi.documentAccess(id, purpose);
      if (!access.accessUrl.startsWith('https://')) throw new Error('Liên kết tài liệu không an toàn.');
      await Linking.openURL(access.accessUrl);
      setOpenedDocs((old) => old.includes(purpose) ? old : [...old, purpose]);
      await result.refetch();
    } catch (error) { setNotice(errorText(error, 'Không thể mở tài liệu xác minh. Vui lòng thử lại hoặc kiểm tra hồ sơ trước khi quyết định.')); }
    finally { setOpening(null); }
  };
  const submit = async () => {
    if (!application || !decision || action.isPending) return;
    if (decision === 'REJECT' && (!reason.trim() || reason.trim().length > 500)) { setFormError('Lý do từ chối phải có từ 1 đến 500 ký tự.'); return; }
    setFormError('');
    try {
      const response = await action.mutateAsync({ decision, expectedVersion: application.version, reason: reason.trim() || undefined });
      setDecision(null); setReason(''); setOpenedDocs([]); setChecked(false);
      setNotice(response.status === 'VERIFIED' ? 'Đã phê duyệt hồ sơ và cấp quyền Chủ khách sạn.' : 'Đã từ chối hồ sơ và gửi thông báo cho người đăng ký.');
      await result.refetch();
    } catch (error) {
      if (isAxiosError(error) && (!error.response || error.response.status === 409)) { setDecision(null); await result.refetch(); }
      setNotice(errorText(error, 'Không thể ghi nhận quyết định. Vui lòng kiểm tra trạng thái mới nhất.'));
    }
  };
  const canApprove = Boolean(application && application.status === 'PENDING' && application.identityDocument?.status === 'READY' && application.businessLicenseDocument?.status === 'READY' && openedDocs.includes('IDENTITY') && openedDocs.includes('BUSINESS_LICENSE') && checked);

  return <AdminPage title="Chi tiết hồ sơ xác minh" eyebrow="QUẢN TRỊ HỆ THỐNG / XÁC MINH CHỦ KHÁCH SẠN" subtitle="Kiểm tra thông tin, tài liệu và ghi nhận quyết định của Admin." trailing={<AdminButton label="← Danh sách" variant="outline" onPress={back} />}>
    {mode !== 'api' ? <AdminCard><AdminText>Đăng nhập Admin thật để xem hồ sơ.</AdminText></AdminCard> : null}
    {mode === 'api' && result.isPending ? <AdminSkeleton /> : null}
    {mode === 'api' && result.isError ? <AdminCard title={isAxiosError(result.error) && result.error.response?.status === 404 ? 'Không tìm thấy hồ sơ' : 'Không thể tải hồ sơ'}><AdminText>{errorText(result.error, 'Vui lòng thử lại.')}</AdminText><AdminButton label="Tải lại" onPress={() => void result.refetch()} style={styles.actionButton} /></AdminCard> : null}
    {notice ? <View accessibilityRole="alert" style={styles.notice}><AdminText>{notice}</AdminText></View> : null}
    {application ? <>
      <AdminCard title="Thông tin hồ sơ"><View style={styles.between}><AdminText style={styles.muted}>Mã hồ sơ: {application.id}</AdminText><Badge status={application.status} /></View><View style={[styles.infoGrid, mobile && styles.stack]}><Info label="Ngày gửi" value={date(application.submittedAt)} /><Info label="Cập nhật" value={date(application.updatedAt)} /><Info label="Phiên bản" value={String(application.version)} /></View></AdminCard>
      <AdminCard title="Người đăng ký"><View style={[styles.infoGrid, mobile && styles.stack]}><Info label="Họ tên" value={application.user.fullName} /><Info label="Email" value={application.user.email} /><Info label="Số điện thoại" value={application.user.phone} /><Info label="Mã người dùng" value={application.user.id} /><Info label="Trạng thái tài khoản" value={application.user.status} /><Info label="Liên hệ đã xác minh" value={application.user.emailVerifiedAt || application.user.phoneVerifiedAt ? 'Có' : 'Chưa'} /></View></AdminCard>
      <AdminCard title="Cơ sở kinh doanh"><View style={[styles.infoGrid, mobile && styles.stack]}><Info label="Tên cơ sở" value={application.businessName} /><Info label="Người đại diện" value={application.representativeName} /><Info label="Số đăng ký kinh doanh" value={application.businessRegistrationNumber} /><Info label="Số điện thoại cơ sở" value={application.businessPhone} /><Info label="Địa chỉ" value={application.businessAddress} /></View></AdminCard>
      <AdminCard title="Tài liệu xác minh riêng tư"><AdminText style={styles.muted}>Liên kết xem tài liệu chỉ được cấp tạm thời. Hãy mở từng tài liệu để đối chiếu trước khi phê duyệt.</AdminText><View style={[styles.documents, mobile && styles.stack]}><DocumentCard title="Giấy tờ định danh" document={application.identityDocument} opening={opening === 'IDENTITY'} opened={openedDocs.includes('IDENTITY')} onOpen={() => void openDocument('IDENTITY')} /><DocumentCard title="Giấy phép kinh doanh" document={application.businessLicenseDocument} opening={opening === 'BUSINESS_LICENSE'} opened={openedDocs.includes('BUSINESS_LICENSE')} onOpen={() => void openDocument('BUSINESS_LICENSE')} /></View></AdminCard>
      {application.status === 'PENDING' ? <AdminCard title="Bằng chứng & quyết định" tone="blue"><AdminText>Kiểm tra thông tin cá nhân, doanh nghiệp và giấy tờ. Tệp đã tải lên không tự chứng minh tính hợp pháp.</AdminText><Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => setChecked((old) => !old)} style={styles.checkRow}><AdminText weight="semibold" style={{ fontSize: 18 }}>{checked ? '☑' : '□'}</AdminText><AdminText style={{ flex: 1 }}>Tôi đã đối chiếu thông tin và giấy tờ của hồ sơ này.</AdminText></Pressable><View style={[styles.actions, mobile && styles.stack]}><AdminButton label="Phê duyệt hồ sơ" disabled={!canApprove || action.isPending} onPress={() => { setDecision('APPROVE'); setReason(''); setFormError(''); }} style={[mobile ? styles.fullButton : styles.actionButton, (!canApprove || action.isPending) && styles.disabledAction]} /><AdminButton label="Từ chối hồ sơ" variant="danger" disabled={action.isPending} onPress={() => { setDecision('REJECT'); setReason(''); setFormError(''); }} style={mobile ? styles.fullButton : styles.actionButton} /></View></AdminCard> : <AdminCard title="Kết quả xét duyệt" tone={application.status === 'REJECTED' ? 'yellow' : 'blue'}><Info label="Người xét duyệt" value={application.reviewedBy?.fullName} /><Info label="Thời điểm" value={date(application.reviewedAt)} /><Info label="Lý do/ghi chú" value={application.rejectionReason || application.approvalNote} /></AdminCard>}
      {application.auditTrail.length ? <AdminCard title="Lịch sử xét duyệt">{application.auditTrail.map((entry) => <View key={entry.id} style={styles.auditRow}><AdminText weight="semibold">{entry.action === 'OWNER_DOCUMENT_ACCESS_GRANTED' ? 'Đã cấp liên kết xem tài liệu' : STATUS_LABELS[entry.newStatus]} · {entry.actor.fullName}</AdminText><AdminText style={styles.muted}>{date(entry.createdAt)} · Phiên bản {entry.version}</AdminText>{entry.reason ? <AdminText>{entry.reason === 'IDENTITY' ? 'Giấy tờ định danh' : entry.reason === 'BUSINESS_LICENSE' ? 'Giấy phép kinh doanh' : entry.reason}</AdminText> : null}</View>)}</AdminCard> : null}
      <DecisionDialog application={application} decision={decision} reason={reason} setReason={setReason} error={formError} busy={action.isPending} onCancel={() => setDecision(null)} onConfirm={() => void submit()} />
    </> : null}
  </AdminPage>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: 12 }, summaryItem: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 4 }, summaryItemMobile: { flexGrow: 0, flexBasis: 'auto', width: '100%' },
  muted: { color: '#57697D', fontSize: 12, lineHeight: 18 }, searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, stack: { flexDirection: 'column', alignItems: 'stretch' },
  searchInput: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 9, paddingHorizontal: 12, backgroundColor: '#FFFFFF', color: '#111827', fontFamily: ADMIN_FONT.regular, fontSize: 14 }, searchInputMobile: { flexGrow: 0, flexBasis: 'auto', width: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 9, backgroundColor: '#FFFFFF' }, chipSelected: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  badge: { paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderRadius: 9, alignSelf: 'flex-start' }, tableHeader: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.border, gap: 10 }, column: { color: '#667085', fontSize: 10, fontFamily: ADMIN_FONT.semibold },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, minHeight: 70, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }, tableRowMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 5, paddingVertical: 14 }, pressed: { backgroundColor: '#EFF6FF' }, cell: { minWidth: 0, color: '#344054', fontSize: 12, lineHeight: 18 }, link: { color: '#1D4ED8', fontSize: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, pager: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8 }, pagerActions: { flexDirection: 'row', gap: 8 },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, info: { minWidth: 150, flexGrow: 1, flexBasis: 180, gap: 3 }, infoMobile: { flexGrow: 0, flexBasis: 'auto', minWidth: 0, width: '100%' }, infoValue: { color: '#111827', fontSize: 14, lineHeight: 20 }, documents: { flexDirection: 'row', gap: 12 }, documentCard: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: '#E5E7EB', padding: 14, borderRadius: 12, gap: 8 }, documentCardMobile: { flexGrow: 0, flexBasis: 'auto', width: '100%' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, actionButton: { alignSelf: 'flex-start', minWidth: 180 }, disabledAction: { opacity: 0.45 }, fullButton: { width: '100%' }, notice: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1, borderRadius: 10, padding: 12 }, auditRow: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 8, gap: 4 },
});

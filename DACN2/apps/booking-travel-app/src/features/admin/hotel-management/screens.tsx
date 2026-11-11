import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useTravelerStore } from '@/features/traveler/store';
import { absoluteMediaUrl } from '@/services/media-url';
import { AdminText } from '../dashboard/components';
import { AdminButton, AdminCard, AdminInput, AdminPage, AdminRow, openAdminDetail, openAdminScreen } from '../shared/ui';
import { managedHotelApi, type ManagedHotelDetail, type RestrictionAction } from './api';
import { useInvalidateManagedHotels, useManagedHotel, useManagedHotels } from './queries';

const labels: Record<RestrictionAction, string> = { HIDE: 'Ẩn khách sạn', SUSPEND: 'Đình chỉ khách sạn', RESTORE: 'Khôi phục khách sạn' };
const stateLabel = (status: string, visible: boolean) => status === 'SUSPENDED' ? 'Đình chỉ' : status === 'APPROVED' && !visible ? 'Đã ẩn' : ({ APPROVED: 'Đang hiển thị', PENDING: 'Chờ duyệt', DRAFT: 'Bản nháp', REJECTED: 'Bị từ chối' } as Record<string, string>)[status] ?? status;
const errorMessage = (error: unknown) => isAxiosError(error) ? (error.response?.data as { message?: string } | undefined)?.message ?? (error.response?.status === 403 ? 'Tài khoản không có quyền quản lý khách sạn.' : 'Không tải được dữ liệu. Hãy thử lại.') : 'Không kết nối được máy chủ. Hãy thử lại.';

export function HotelsScreen() {
  const session = useTravelerStore((state) => state.session);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [ownerId, setOwnerId] = useState('');
  const [type, setType] = useState('ALL');
  const [visibility, setVisibility] = useState<'ALL' | 'VISIBLE' | 'HIDDEN'>('ALL');
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300); return () => clearTimeout(timer); }, [input]);
  const query = useManagedHotels({ search: search || undefined, ownerId: ownerId.trim() || undefined, type: type === 'ALL' ? undefined : type, status: status === 'ALL' ? undefined : status, visibility, page, limit: 10 });
  const pages = Math.max(1, Math.ceil((query.data?.total ?? 0) / 10));
  return <AdminPage title="Quản lý khách sạn" eyebrow="QUẢN TRỊ HỆ THỐNG / KHÁCH SẠN" subtitle="Xem trạng thái khách sạn và xử lý ẩn, đình chỉ hoặc khôi phục.">
    {session?.mode !== 'api' ? <AdminCard><AdminText>Đăng nhập Admin để xem dữ liệu thật.</AdminText></AdminCard> : <>
      <AdminCard title="Tìm kiếm và lọc"><View style={s.row}><AdminInput value={input} onChangeText={setInput} placeholder="Tên khách sạn, chủ, email hoặc mã" /><AdminButton label="Làm mới" variant="outline" onPress={() => void query.refetch()} /></View>
        <AdminInput label="Mã chủ sở hữu (nếu cần lọc chính xác)" value={ownerId} onChangeText={(value) => { setOwnerId(value); setPage(1); }} placeholder="Owner ID" />
        <View style={s.row}>{(['ALL', 'HOTEL', 'RESORT', 'VILLA', 'APARTMENT', 'HOMESTAY', 'HOSTEL'] as const).map((item) => <AdminButton key={item} label={item === 'ALL' ? 'Mọi loại' : item} variant={type === item ? 'primary' : 'outline'} onPress={() => { setType(item); setPage(1); }} />)}</View>
        <View style={s.row}>{(['ALL', 'APPROVED', 'SUSPENDED', 'PENDING', 'DRAFT', 'REJECTED'] as const).map((item) => <AdminButton key={item} label={item === 'ALL' ? 'Tất cả' : item === 'APPROVED' ? 'Đã duyệt' : item === 'SUSPENDED' ? 'Đình chỉ' : item === 'PENDING' ? 'Chờ duyệt' : item === 'DRAFT' ? 'Bản nháp' : 'Từ chối'} variant={status === item ? 'primary' : 'outline'} onPress={() => { setStatus(item); setPage(1); }} />)}</View>
        <View style={s.row}>{(['ALL', 'VISIBLE', 'HIDDEN'] as const).map((item) => <AdminButton key={item} label={item === 'ALL' ? 'Mọi hiển thị' : item === 'VISIBLE' ? 'Công khai' : 'Đang ẩn'} variant={visibility === item ? 'primary' : 'outline'} onPress={() => { setVisibility(item); setPage(1); }} />)}</View>
      </AdminCard>
      {query.isPending ? <ActivityIndicator /> : query.isError ? <AdminCard><AdminText style={s.error}>{errorMessage(query.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void query.refetch()} /></AdminCard> : <AdminCard title={`Danh sách khách sạn · ${query.data?.total ?? 0} kết quả`}>
        {query.data?.items.length ? query.data.items.map((hotel) => <AdminRow key={hotel.id} title={hotel.name} subtitle={`${hotel.id} · ${hotel.owner.fullName} · ${hotel.accommodationType ?? 'Chưa rõ loại'} · ${hotel.province ?? hotel.city ?? 'Chưa có địa chỉ'} · ${hotel.roomCount} hạng phòng · ${hotel.futureBookingCount} booking · ${new Date(hotel.updatedAt).toLocaleDateString('vi-VN')}`} status={stateLabel(hotel.status, hotel.isVisible)} leading={hotel.coverImageUrl ? <Image source={{ uri: absoluteMediaUrl(hotel.coverImageUrl) }} style={s.thumb} /> : undefined} onPress={() => openAdminDetail('hotels', hotel.id)} />) : <AdminText>Không có khách sạn phù hợp.</AdminText>}
        <View style={s.row}><AdminText>Trang {page}/{pages}</AdminText><AdminButton label="‹ Trước" variant="outline" disabled={page <= 1} onPress={() => setPage(page - 1)} /><AdminButton label="Sau ›" variant="outline" disabled={page >= pages} onPress={() => setPage(page + 1)} /></View>
      </AdminCard>}
    </>}
  </AdminPage>;
}

function DecisionModal({ hotel, action, onClose, onDone, onConflict }: { hotel: ManagedHotelDetail; action: RestrictionAction; onClose: () => void; onDone: () => void; onConflict: () => void }) {
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [requestId] = useState(() => `adm05-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (busy || conflict) return;
    if (reason.trim().length < 10) { setError('Lý do cần ít nhất 10 ký tự.'); return; }
    setBusy(true); setError('');
    try { await managedHotelApi.decide(hotel.id, { action, reason: reason.trim(), evidenceReference: evidence.trim() || undefined, expectedRestrictionVersion: hotel.restrictionVersion, expectedProfileVersion: hotel.profileVersion, requestId }); onDone(); }
    catch (err) { setError(errorMessage(err)); if (isAxiosError(err) && err.response?.status === 409) setConflict(true); } finally { setBusy(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modalScroll}><View style={s.modal}>
    <AdminText weight="bold" style={s.modalTitle}>{action ? labels[action] : ''}</AdminText><AdminText>{hotel.name} · {hotel.owner.fullName}</AdminText>
    <AdminCard><AdminText>{action === 'RESTORE' ? 'Khách sạn sẽ hiển thị và nhận booking mới.' : 'Khách sạn sẽ ngừng hiển thị và nhận booking mới.'}</AdminText><AdminText>{hotel.futureBookingCount} booking chưa kết thúc cần theo dõi{hotel.bookings[0] ? `, gần nhất nhận phòng ${hotel.bookings[0].checkIn.slice(0, 10)}` : ''}. Booking cũ không tự hủy.</AdminText></AdminCard>
    <AdminCard title="Bằng chứng cần kiểm tra"><AdminText>Đối chiếu hồ sơ, ảnh, booking và liên hệ chủ khách sạn. Chưa có báo cáo tự động; ghi nguồn đã kiểm tra bên dưới.</AdminText></AdminCard>
    <AdminCard title="Lý do quyết định" tone={action === 'SUSPEND' ? 'yellow' : 'blue'}><AdminInput label="Lý do (bắt buộc)" value={reason} onChangeText={setReason} placeholder="Ghi rõ lý do và căn cứ" /><AdminInput label="Tham chiếu bằng chứng (nếu có)" value={evidence} onChangeText={setEvidence} placeholder="Mã báo cáo hoặc thông tin đã đối chiếu" /></AdminCard>
    {error ? <AdminText style={s.error}>{error}</AdminText> : null}<AdminText style={s.muted}>Quyết định và người thực hiện sẽ được lưu. Chủ khách sạn nhận thông báo.</AdminText>
    <View style={s.row}><AdminButton label="Hủy" variant="outline" disabled={busy} onPress={onClose} />{conflict ? <AdminButton label="Tải lại khách sạn" onPress={() => { onClose(); onConflict(); }} /> : <AdminButton label={busy ? 'Đang xử lý...' : `Xác nhận ${action === 'HIDE' ? 'ẩn' : action === 'SUSPEND' ? 'đình chỉ' : 'khôi phục'}`} variant={action === 'SUSPEND' ? 'danger' : 'primary'} disabled={busy} onPress={() => void confirm()} />}</View>
  </View></ScrollView></KeyboardAvoidingView></Modal>;
}

export function HotelDetailScreen({ id }: { id: string }) {
  const session = useTravelerStore((state) => state.session);
  const query = useManagedHotel(id);
  const invalidate = useInvalidateManagedHotels();
  const [action, setAction] = useState<RestrictionAction | null>(null);
  const [notice, setNotice] = useState('');
  const hotel = query.data;
  return <AdminPage title="Chi tiết khách sạn" eyebrow="QUẢN TRỊ HỆ THỐNG / KHÁCH SẠN" subtitle="Xem hồ sơ, lịch sử quyết định và booking cần theo dõi."><AdminButton label="‹ Quay lại danh sách" variant="outline" style={{ alignSelf: 'flex-start' }} onPress={() => openAdminScreen('hotels')} />
    {session?.mode !== 'api' ? <AdminCard><AdminText>Đăng nhập Admin để xem dữ liệu thật.</AdminText></AdminCard> : query.isPending ? <ActivityIndicator /> : query.isError || !hotel ? <AdminCard><AdminText style={s.error}>{errorMessage(query.error)}</AdminText><AdminButton label="Thử lại" onPress={() => void query.refetch()} /></AdminCard> : <>
      {notice ? <AdminCard tone="blue"><AdminText>{notice}</AdminText></AdminCard> : null}
      <AdminCard title={hotel.name}><AdminText>{[hotel.addressLine, hotel.province].filter(Boolean).join(', ')}</AdminText><AdminText>Trạng thái: {stateLabel(hotel.status, hotel.isVisible)} · Phiên bản {hotel.profileVersion}</AdminText><AdminText>Chủ: {hotel.owner.fullName} · {hotel.owner.email ?? hotel.owner.phone ?? 'Chưa có liên hệ'}</AdminText><AdminText>Loại: {hotel.accommodationType ?? 'Chưa xác định'} · {hotel.rooms.length} hạng phòng</AdminText></AdminCard>
      <AdminCard title="Hình ảnh"><ScrollView horizontal contentContainerStyle={s.row}>{hotel.gallery.length ? hotel.gallery.map((image) => <Image key={image.id} source={{ uri: absoluteMediaUrl(image.url) }} style={s.gallery} />) : <AdminText>Chưa có ảnh.</AdminText>}</ScrollView></AdminCard>
      <AdminCard title="Phòng và chính sách">{hotel.rooms.map((room) => <AdminRow key={room.id} title={room.name} subtitle={`${room.quantity} phòng · ${Number(room.basePrice).toLocaleString('vi-VN')} ₫/đêm`} status={room.status} />)}<AdminText>Hủy phòng: {hotel.policy?.cancellationPolicy || 'Chưa có'}</AdminText><AdminText>Nội quy: {hotel.policy?.houseRules || 'Chưa có'}</AdminText></AdminCard>
      <AdminCard title="Booking cần theo dõi" tone={hotel.futureBookingCount ? 'yellow' : 'default'}><AdminText>{hotel.futureBookingCount} booking chưa kết thúc; quyết định không tự hủy booking.</AdminText>{hotel.bookings.map((booking) => <AdminRow key={booking.id} title={booking.code} subtitle={`${booking.checkIn.slice(0, 10)} → ${booking.checkOut.slice(0, 10)}`} status={booking.status} />)}{hotel.futureBookingCount > hotel.bookings.length ? <AdminText>Còn {hotel.futureBookingCount - hotel.bookings.length} booking khác.</AdminText> : null}</AdminCard>
      {hotel.operationalTasks.length ? <AdminCard title="Việc vận hành đang mở" tone="yellow">{hotel.operationalTasks.map((task) => <AdminRow key={task.id} title={task.booking.code} subtitle={`${task.booking.checkIn.slice(0, 10)} → ${task.booking.checkOut.slice(0, 10)}`} status={task.booking.status} />)}</AdminCard> : null}
      <AdminCard title="Quyết định quản lý"><AdminText>Đối chiếu thông tin rồi ghi lý do. Chưa có luồng báo cáo tự động; có thể nhập mã tham chiếu bằng chứng.</AdminText><View style={s.row}>{hotel.allowedActions.hide ? <AdminButton label="Ẩn khách sạn" variant="outline" onPress={() => setAction('HIDE')} /> : null}{hotel.allowedActions.suspend ? <AdminButton label="Đình chỉ" variant="danger" onPress={() => setAction('SUSPEND')} /> : null}{hotel.allowedActions.restore ? <AdminButton label="Khôi phục" onPress={() => setAction('RESTORE')} /> : null}</View>{hotel.status === 'SUSPENDED' || !hotel.isVisible ? hotel.restoreBlockers.map((reason, i) => <AdminText key={i} style={s.error}>{reason}</AdminText>) : null}</AdminCard>
      <AdminCard title="Lịch sử quyết định">{hotel.restrictionAudits.length ? hotel.restrictionAudits.map((audit) => <AdminRow key={audit.id} title={`${labels[audit.action]} · ${new Date(audit.createdAt).toLocaleString('vi-VN')}`} subtitle={`${audit.actor.fullName}: ${audit.reason}${audit.evidenceReference ? ` · ${audit.evidenceReference}` : ''}`} status={`${audit.futureBookingCount} booking`} />) : <AdminText>Chưa có quyết định hạn chế.</AdminText>}</AdminCard>
      {action ? <DecisionModal hotel={hotel} action={action} onClose={() => setAction(null)} onConflict={() => void query.refetch()} onDone={() => { setNotice('Đã lưu quyết định và thông báo cho chủ khách sạn.'); setAction(null); void invalidate(); void query.refetch(); }} /> : null}
    </>}
  </AdminPage>;
}

const s = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }, thumb: { width: 52, height: 52, borderRadius: 8 }, gallery: { width: 150, height: 110, borderRadius: 8 }, error: { color: '#B91C1C' }, muted: { color: '#64748B', fontSize: 12 }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }, modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 }, modal: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, gap: 14, width: '100%', maxWidth: 520 }, modalTitle: { fontSize: 22, color: '#111827' } });

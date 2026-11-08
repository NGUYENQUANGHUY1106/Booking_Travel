import { router, useLocalSearchParams, type Href } from 'expo-router';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { absoluteMediaUrl } from '@/services/media-url';
import { useTravelerStore } from '@/features/traveler/store';
import { AdminText } from '../dashboard/components';
import { AdminButton, AdminCard, AdminPage } from '../shared/ui';
import { ADMIN_COLORS, ADMIN_FONT } from '../theme';
import { ACCOMMODATION_LABELS, hotelReviewApi, type HotelDecision, type HotelReviewMedia } from './api';
import { useHotelReviewDetail, useInvalidateHotelReview } from './queries';

const dateTime = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const requestId = () => `adm04-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

function PhotoViewer({ photos, index, onChange, onClose }: { photos: HotelReviewMedia[]; index: number | null; onChange: (index: number) => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const current = index === null ? null : photos[index];
  return <Modal transparent animationType="fade" visible={Boolean(current)} onRequestClose={onClose}><View accessibilityViewIsModal style={[styles.viewer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
    <AdminText weight="semibold" style={styles.viewerTitle}>{current ? `Ảnh ${index! + 1}/${photos.length}` : ''}</AdminText>
    {current ? <Image source={{ uri: absoluteMediaUrl(current.url) }} resizeMode="contain" style={styles.viewerImage} /> : null}
    <View style={styles.viewerActions}><AdminButton label="‹ Trước" variant="outline" disabled={index === null || index <= 0} onPress={() => onChange(index! - 1)} /><AdminButton label="Sau ›" variant="outline" disabled={index === null || index >= photos.length - 1} onPress={() => onChange(index! + 1)} /><AdminButton label="Đóng" onPress={onClose} /></View>
  </View></Modal>;
}

export function HotelApprovalDetailScreen({ id }: { id: string }) {
  const returnQuery = useLocalSearchParams<{ search?: string; types?: string; sort?: string; page?: string }>();
  const queueParams = { section: 'hotel-moderation', search: returnQuery.search ?? '', types: returnQuery.types ?? '', sort: returnQuery.sort ?? 'newest', page: returnQuery.page ?? '1' };
  const queueHref = { pathname: '/admin/[section]', params: queueParams } as Href;
  const session = useTravelerStore((state) => state.session);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const detail = useHotelReviewDetail(id);
  const invalidate = useInvalidateHotelReview();
  const [dialog, setDialog] = useState<{ decision: HotelDecision; requestId: string } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const item = detail.data;
  const snapshot = item?.snapshot;
  const photos = item?.media ?? [];
  const cover = photos.find((photo) => photo.id === snapshot?.coverId) ?? photos.find((photo) => photo.isCover && !photo.roomId);
  const hotelPhotos = photos.filter((photo) => !photo.roomId).sort((a, b) => a.sortOrder - b.sortOrder);
  const openDecision = (decision: HotelDecision) => { setReason(''); setError(''); setConflict(false); setDialog({ decision, requestId: requestId() }); };
  const submit = async () => {
    if (!dialog || !item || busy || conflict) return;
    if (dialog.decision === 'APPROVE' && !item.evidence.canApprove) { setError('Bản nộp thiếu bằng chứng nên không thể duyệt.'); return; }
    if (dialog.decision === 'REJECT' && reason.trim().length < 3) { setError('Nhập lý do từ chối ít nhất 3 ký tự.'); return; }
    setBusy(true); setError('');
    try {
      await hotelReviewApi.decide(id, { decision: dialog.decision, expectedVersion: item.version, reason: dialog.decision === 'REJECT' ? reason.trim() : undefined, requestId: dialog.requestId });
      await invalidate();
      const decision = dialog.decision;
      setDialog(null);
      router.replace({ pathname: '/admin/[section]', params: { ...queueParams, decision } } as Href);
    } catch (cause) {
      const status = isAxiosError(cause) ? cause.response?.status : undefined;
      if (status === 409) { setConflict(true); setError('Hồ sơ đã thay đổi hoặc đã được xử lý. Tải lại hàng chờ trước khi quyết định.'); await detail.refetch(); }
      else setError(status === 403 ? 'Bạn không còn quyền kiểm duyệt hồ sơ này.' : status === 404 ? 'Không tìm thấy hồ sơ; hãy quay lại hàng chờ.' : status === 400 || status === 422 ? 'Thông tin quyết định không hợp lệ. Kiểm tra lại lý do.' : 'Chưa gửi được quyết định. Kiểm tra kết nối rồi thử lại.');
    } finally { setBusy(false); }
  };
  const openMap = () => {
    if (!snapshot?.latitude || !snapshot.longitude) return;
    const lat = Number(snapshot.latitude), lng = Number(snapshot.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) void Linking.openURL(`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`);
  };

  return <AdminPage title={snapshot?.name ?? 'Chi tiết duyệt chỗ ở'} eyebrow="CHỖ Ở / DUYỆT KHÁCH SẠN / HỒ SƠ" subtitle={item ? `Bản nộp số ${item.version} · ${dateTime(item.submittedAt)}` : 'Đang tải hồ sơ'} trailing={<AdminButton label="‹ Hàng chờ" variant="outline" onPress={() => router.replace(queueHref)} />}>
    {session?.mode !== 'api' ? <AdminCard><AdminText>Đăng nhập bằng tài khoản Admin để xem hồ sơ thật.</AdminText></AdminCard> : detail.isPending ? <ActivityIndicator color={ADMIN_COLORS.primary} /> : detail.isError || !item || !snapshot ? <AdminCard><AdminText style={styles.error}>{isAxiosError(detail.error) && detail.error.response?.status === 409 ? 'Hồ sơ đã được xử lý hoặc thay đổi. Hãy quay lại hàng chờ.' : isAxiosError(detail.error) && detail.error.response?.status === 403 ? 'Bạn không có quyền xem hồ sơ này.' : 'Không tải được hồ sơ.'}</AdminText><View style={styles.actions}><AdminButton label="Tải lại" onPress={() => void detail.refetch()} /><AdminButton label="Về hàng chờ" variant="outline" onPress={() => router.replace(queueHref)} /></View></AdminCard> : <>
      <View style={[styles.columns, width < 1024 && styles.columnsNarrow]}>
        <View style={[styles.column, width < 1024 && styles.columnNarrow]}>
          <AdminCard title="Thông tin chỗ ở">
            <AdminText weight="semibold" style={styles.typeBadge}>{ACCOMMODATION_LABELS[snapshot.accommodationType] ?? snapshot.accommodationType}</AdminText>
            {cover ? <Pressable accessibilityRole="button" accessibilityLabel="Xem ảnh bìa lớn" onPress={() => setPhotoIndex(photos.findIndex((photo) => photo.id === cover.id))}><Image source={{ uri: absoluteMediaUrl(cover.url) }} style={styles.cover} resizeMode="cover" /></Pressable> : <AdminText style={styles.error}>Thiếu ảnh bìa trong bản nộp.</AdminText>}
            <AdminText weight="semibold">Mô tả và vị trí</AdminText><AdminText style={styles.body}>{snapshot.description || 'Chưa có mô tả'}</AdminText>
            <AdminText style={styles.body}>{[snapshot.addressLine, snapshot.ward, snapshot.district, snapshot.province].filter(Boolean).join(', ') || 'Chưa có địa chỉ'}</AdminText>
            <AdminText style={styles.body}>Tọa độ: {snapshot.latitude ?? '—'}, {snapshot.longitude ?? '—'}</AdminText>
            {snapshot.latitude && snapshot.longitude ? <AdminButton label="Mở vị trí trên bản đồ" variant="outline" onPress={openMap} /> : null}
          </AdminCard>
          <AdminCard title={`Hình ảnh chỗ ở (${hotelPhotos.length})`}><ScrollView horizontal contentContainerStyle={styles.photos}>{hotelPhotos.map((photo) => <Pressable key={photo.id} accessibilityRole="button" accessibilityLabel={`Xem ảnh chỗ ở ${photo.id}`} onPress={() => setPhotoIndex(photos.findIndex((itemPhoto) => itemPhoto.id === photo.id))}><Image source={{ uri: absoluteMediaUrl(photo.url) }} style={styles.photo} /></Pressable>)}</ScrollView></AdminCard>
          <AdminCard title={`Hạng phòng (${snapshot.rooms?.length ?? 0})`}>{snapshot.rooms?.map((room) => <View key={room.id} style={styles.room}><AdminText weight="semibold">{room.name} · {room.type}</AdminText><AdminText style={styles.body}>{room.quantity} phòng · {room.capacityAdults} người lớn, {room.capacityChildren} trẻ em · {room.bedInfo}</AdminText><AdminText style={styles.body}>{room.areaM2 ? `${room.areaM2} m² · ` : ''}{Number(room.basePrice).toLocaleString('vi-VN')} {room.currency}/đêm</AdminText>{room.description ? <AdminText style={styles.body}>{room.description}</AdminText> : null}<ScrollView horizontal contentContainerStyle={styles.photos}>{photos.filter((photo) => photo.roomId === room.id).map((photo) => <Pressable key={photo.id} accessibilityRole="button" onPress={() => setPhotoIndex(photos.findIndex((itemPhoto) => itemPhoto.id === photo.id))}><Image source={{ uri: absoluteMediaUrl(photo.url) }} style={styles.photo} /></Pressable>)}</ScrollView></View>)}</AdminCard>
        </View>
        <View style={[styles.column, width < 1024 && styles.columnNarrow]}>
          <AdminCard title="Xác minh hồ sơ"><AdminText style={styles.label}>Chủ sở hữu</AdminText><AdminText weight="semibold">{item.hotel.owner.fullName}</AdminText><AdminText style={styles.body}>{item.hotel.owner.email || 'Chưa có email'} · {item.hotel.owner.phone || 'Chưa có số điện thoại'}</AdminText><AdminText style={styles.body}>Tài khoản Owner: {item.hotel.owner.ownerApplication?.status === 'VERIFIED' && item.hotel.owner.ownerProfile?.isActive ? 'Đã xác minh' : 'Cần kiểm tra lại'}</AdminText><AdminText style={styles.body}>Liên hệ chỗ ở: {[snapshot.contactEmail, snapshot.contactPhone].filter(Boolean).join(' · ') || 'Chưa có'}</AdminText><AdminText style={styles.body}>Nhận/trả: {snapshot.checkInTime || '—'} / {snapshot.checkOutTime || '—'}</AdminText></AdminCard>
          <AdminCard title="Tiện ích và chính sách"><AdminText style={styles.body}>Tiện ích: {snapshot.amenities?.map((itemAmenity) => itemAmenity.name).join(', ') || snapshot.amenityIds?.join(', ') || 'Chưa có'}</AdminText><AdminText style={styles.body}>Chính sách hủy: {snapshot.policy?.cancellationPolicy || 'Chưa có'}</AdminText><AdminText style={styles.body}>Nội quy: {snapshot.policy?.houseRules || 'Chưa có'}</AdminText></AdminCard>
          <AdminCard title="Điều kiện bản nộp">{snapshot.checklist?.map((check) => <View key={check.code} style={styles.check}><AdminText>{check.label}</AdminText><AdminText weight="semibold" style={check.complete ? styles.good : styles.error}>{check.complete ? 'Đã có' : 'Thiếu'}</AdminText></View>)}{!snapshot.checklist ? <AdminText style={styles.body}>Bản nộp cũ không lưu checklist tại thời điểm gửi.</AdminText> : null}{item.evidence.missing.length ? <AdminText style={styles.error}>Thiếu bằng chứng: {item.evidence.missing.join(', ')}. Không thể duyệt.</AdminText> : <AdminText style={styles.good}>Bằng chứng trong bản nộp đang khả dụng.</AdminText>}</AdminCard>
        </View>
      </View>
      <AdminCard><View style={styles.decisionBar}><View style={styles.decisionCopy}><AdminText weight="semibold">Quyết định cho bản nộp số {item.version}</AdminText><AdminText style={styles.body}>Duyệt sẽ công khai chỗ ở; từ chối sẽ gửi lý do cho Chủ khách sạn. Quyết định được ghi vào audit.</AdminText></View><View style={styles.actions}><AdminButton label="Duyệt chỗ ở" disabled={!item.evidence.canApprove} onPress={() => openDecision('APPROVE')} /><AdminButton label="Từ chối · cần lý do" variant="danger" onPress={() => openDecision('REJECT')} /></View></View></AdminCard>
    </>}
    <PhotoViewer photos={photos} index={photoIndex} onChange={setPhotoIndex} onClose={() => setPhotoIndex(null)} />
    <Modal transparent animationType="fade" visible={Boolean(dialog)} onRequestClose={() => { if (!busy) setDialog(null); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.dialogScroll, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}><View accessibilityViewIsModal style={styles.dialog}>
      <AdminText weight="bold" style={styles.dialogTitle}>{dialog?.decision === 'APPROVE' ? 'Xác nhận duyệt chỗ ở' : 'Xác nhận từ chối hồ sơ'}</AdminText>
      <AdminText style={styles.body}>{snapshot?.name} · Bản nộp số {item?.version}</AdminText>
      <AdminText style={styles.body}>Kiểm tra ảnh, vị trí, hạng phòng, tiện ích và chính sách của đúng bản nộp trước khi xác nhận. Quyết định và người thực hiện được ghi vào audit.</AdminText>
      {dialog?.decision === 'REJECT' ? <View style={styles.reasonWrap}><AdminText weight="semibold">Lý do từ chối *</AdminText><TextInput accessibilityLabel="Lý do từ chối" autoFocus multiline placeholder="Nêu thông tin cần chủ khách sạn sửa" value={reason} onChangeText={setReason} style={styles.reasonInput} /></View> : null}
      {error ? <View accessibilityRole="alert"><AdminText style={styles.error}>{error}</AdminText></View> : null}
      <View style={styles.actions}><AdminButton label={conflict ? 'Về hàng chờ' : 'Hủy'} variant="outline" disabled={busy} onPress={() => { setDialog(null); if (conflict) router.replace(queueHref); }} /><AdminButton label={busy ? 'Đang xử lý...' : dialog?.decision === 'APPROVE' ? 'Xác nhận duyệt' : 'Xác nhận từ chối'} variant={dialog?.decision === 'REJECT' ? 'danger' : 'primary'} disabled={busy || conflict || (dialog?.decision === 'APPROVE' && !item?.evidence.canApprove)} onPress={() => void submit()} /></View>
    </View></ScrollView></KeyboardAvoidingView></Modal>
  </AdminPage>;
}

const styles = StyleSheet.create({
  label: { color: '#475569', fontSize: 12 }, body: { color: '#475569', fontSize: 13, lineHeight: 20 }, error: { color: '#B91C1C', fontSize: 13, lineHeight: 19 }, good: { color: '#15803D', fontSize: 13 },
  typeBadge: { color: ADMIN_COLORS.primary, backgroundColor: '#EFF6FF', borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden', fontSize: 12, alignSelf: 'flex-start' },
  columns: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' }, columnsNarrow: { flexDirection: 'column' }, column: { flex: 1, gap: 16, minWidth: 0 }, columnNarrow: { width: '100%' },
  cover: { width: '100%', height: 190, borderRadius: 10 }, photos: { flexDirection: 'row', gap: 8 }, photo: { width: 115, height: 85, borderRadius: 8 }, room: { gap: 6, borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.border, paddingBottom: 12 }, check: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  decisionBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, decisionCopy: { flex: 1, minWidth: 220, gap: 4 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  viewer: { flex: 1, backgroundColor: '#101827', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 16 }, viewerTitle: { color: '#FFFFFF', fontSize: 17 }, viewerImage: { width: '100%', flex: 1, maxHeight: 600 }, viewerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' }, dialogScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }, dialog: { width: '100%', maxWidth: 460, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, gap: 14 }, dialogTitle: { fontSize: 20 }, reasonWrap: { gap: 7 }, reasonInput: { minHeight: 100, borderWidth: 1, borderColor: ADMIN_COLORS.border, borderRadius: 8, padding: 10, textAlignVertical: 'top', color: '#111827', fontFamily: ADMIN_FONT.regular },
});

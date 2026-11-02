import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { InfoCard, OwnerButton, OwnerScaffold } from '../components/owner-ui';
import { ownerScreenHref } from '../navigation/routes';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';
import { ownerHotelApi, ownerHotelKey, ownerHotelListKey, useOwnerHotel, type OwnerHotelProfile } from './api';
import { HotelGallery } from './HotelGallery';
import { leaveWizard, WizardNotice, WizardStep } from './wizard-ui';

const typeNames: Record<string, string> = { HOTEL: 'Khách sạn', RESORT: 'Resort', APARTMENT: 'Căn hộ', VILLA: 'Villa', HOMESTAY: 'Homestay', HOSTEL: 'Hostel' };
const checklist: { key: keyof OwnerHotelProfile['completion']; label: string; step: 'hotel-basic' | 'hotel-location' | 'hotel-media' | 'hotel-amenities' | 'room-edit' }[] = [
  { key: 'basic', label: 'Cơ bản', step: 'hotel-basic' },
  { key: 'location', label: 'Vị trí', step: 'hotel-location' },
  { key: 'media', label: 'Ảnh bìa', step: 'hotel-media' },
  { key: 'contact', label: 'Liên hệ và giờ nhận/trả', step: 'hotel-amenities' },
  { key: 'policy', label: 'Chính sách', step: 'hotel-amenities' },
  { key: 'rooms', label: 'Hạng phòng', step: 'room-edit' },
];

export function OwnerHotelReviewScreen({ hotelId }: { hotelId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const profile = useOwnerHotel(userId, hotelId);
  const amenities = useQuery({ queryKey: ['owner-hotel-amenities-catalog'], queryFn: ownerHotelApi.catalog, enabled: Boolean(userId), staleTime: 60_000 });
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!hotelId || !userId) return <OwnerScaffold title="Kiểm tra và gửi duyệt" testID="OWN-UI-12"><WizardNotice title="Chưa chọn chỗ ở" body="Mở bản nháp từ Chỗ ở của tôi." actionLabel="Chỗ ở của tôi" onAction={leaveWizard} /></OwnerScaffold>;
  if (profile.isPending) return <OwnerScaffold title="Kiểm tra và gửi duyệt" testID="OWN-UI-12"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
  if (!profile.data) return <OwnerScaffold title="Kiểm tra và gửi duyệt" testID="OWN-UI-12"><WizardNotice title="Không tải được hồ sơ" body="Kiểm tra mạng hoặc quyền truy cập rồi thử lại." error actionLabel="Thử lại" onAction={() => void profile.refetch()} /></OwnerScaffold>;
  const hotel = profile.data;
  const editable = hotel.status === 'DRAFT' || hotel.status === 'REJECTED';
  const go = (step: (typeof checklist)[number]['step']) => router.push(ownerScreenHref(step, hotel.id));
  const submit = async () => {
    if (busy || !editable || !hotel.readyForReview) return;
    setBusy(true); setError('');
    try {
      const saved = await ownerHotelApi.submit(hotel.id, hotel.profileVersion);
      client.setQueryData(ownerHotelKey(userId, hotel.id), saved);
      await client.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
      router.replace(ownerScreenHref('hotel-detail', hotel.id));
    } catch (cause) {
      await profile.refetch();
      const details = isAxiosError(cause) && cause.response?.status === 400 ? (cause.response.data as { missing?: unknown }).missing : undefined;
      setError(isAxiosError(cause) && cause.response?.status === 409 ? 'Hồ sơ đã đổi. Kiểm tra lại thông tin rồi gửi duyệt.' : isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0) ? 'Bạn không còn quyền gửi duyệt chỗ ở này.' : Array.isArray(details) && details.every((item) => typeof item === 'string') ? `Còn thiếu: ${details.join(', ')}.` : 'Chưa gửi được hồ sơ. Kiểm tra các mục còn thiếu và thử lại.');
    } finally { setBusy(false); }
  };
  const address = [hotel.addressLine, hotel.ward, hotel.district, hotel.province].filter(Boolean).join(', ');
  const amenityNames = hotel.amenities.map((id) => amenities.data?.find((item) => item.id === id)?.name ?? id);
  return <WizardStep title="Kiểm tra và gửi duyệt" number={5} subtitle="Kiểm tra thông tin" testID="OWN-UI-12" onBack={() => router.replace(ownerScreenHref('hotel-amenities', hotel.id))} onExit={leaveWizard} nextLabel="Gửi duyệt" onNext={() => void submit()} busy={busy} disabled={!editable || !hotel.readyForReview}>
    <InfoCard><Text style={styles.title}>{hotel.name}</Text><Text style={styles.muted}>{typeNames[hotel.accommodationType ?? ''] ?? 'Chưa chọn loại chỗ ở'} · {hotel.status === 'DRAFT' ? 'Bản nháp' : hotel.status === 'REJECTED' ? 'Cần chỉnh sửa' : hotel.status === 'PENDING' ? 'Đang chờ duyệt' : 'Trạng thái hiện tại: ' + hotel.status}</Text><Text style={styles.muted}>{hotel.description || 'Chưa có mô tả'}</Text><OwnerButton label="Sửa thông tin cơ bản" secondary onPress={() => go('hotel-basic')} /></InfoCard>
    <InfoCard><Text style={styles.title}>Vị trí</Text><Text style={styles.muted}>{address || 'Chưa có địa chỉ'}</Text><Text style={styles.muted}>{hotel.latitude && hotel.longitude ? `Tọa độ: ${hotel.latitude}, ${hotel.longitude}` : 'Chưa có tọa độ'}</Text><OwnerButton label="Sửa vị trí" secondary onPress={() => go('hotel-location')} /></InfoCard>
    <InfoCard><Text style={styles.title}>Hình ảnh</Text><Text style={styles.muted}>{hotel.gallery.length} ảnh đã lưu · {hotel.completion.media ? 'Đã có ảnh bìa' : 'Chưa có ảnh bìa'}</Text></InfoCard>
    <HotelGallery images={hotel.gallery} onExpired={() => void profile.refetch()} />
    <OwnerButton label="Sửa hình ảnh" secondary onPress={() => go('hotel-media')} />
    <InfoCard><Text style={styles.title}>Tiện ích, chính sách và liên hệ</Text><Text style={styles.muted}>Tiện ích: {amenityNames.length ? amenityNames.join(', ') : 'Chưa chọn'}</Text><Text style={styles.muted}>Liên hệ: {[hotel.contactEmail, hotel.contactPhone].filter(Boolean).join(' · ') || 'Chưa có'}</Text><Text style={styles.muted}>Nhận/trả phòng: {hotel.checkInTime || '—'} / {hotel.checkOutTime || '—'}</Text><Text style={styles.muted}>Chính sách hủy: {hotel.policy?.cancellationPolicy || 'Chưa có'}</Text><Text style={styles.muted}>Nội quy: {hotel.policy?.houseRules || 'Chưa có'}</Text><OwnerButton label="Sửa tiện ích và chính sách" secondary onPress={() => go('hotel-amenities')} /></InfoCard>
    <InfoCard><Text style={styles.title}>Điều kiện gửi duyệt</Text>{checklist.map(({ key, label, step }) => <View key={key} style={styles.check}><Text style={styles.muted}>{label}</Text><Text style={hotel.completion[key] ? styles.done : styles.missing}>{hotel.completion[key] ? 'Đã có' : 'Còn thiếu'}</Text>{!hotel.completion[key] ? <OwnerButton label={key === 'rooms' ? 'Thêm hạng phòng' : 'Bổ sung'} secondary onPress={() => go(step)} /> : null}</View>)}</InfoCard>
    {!hotel.readyForReview ? <WizardNotice title="Hồ sơ chưa đủ điều kiện" body="Hoàn thiện các mục còn thiếu ở trên rồi quay lại gửi duyệt. Bản nháp và ảnh đã lưu vẫn được giữ." /> : <WizardNotice title="Sẵn sàng gửi duyệt" body="Gửi duyệt sẽ chuyển chỗ ở sang trạng thái Đang chờ duyệt. Chỗ ở chưa hiển thị công khai cho khách." />}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </WizardStep>;
}

const styles = StyleSheet.create({
  title: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  check: { gap: 6, borderBottomWidth: 1, borderColor: ownerColors.border, paddingVertical: 10 },
  done: { color: ownerColors.success, fontWeight: '700' },
  missing: { color: ownerColors.warning, fontWeight: '700' },
  error: { color: ownerColors.danger, fontSize: 13 },
});

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, View } from 'react-native';
import { apiClient } from '@/services/api-client';
import { absoluteMediaUrl } from '@/services/media-url';
import { AdminText } from '../dashboard/components';
import { AdminButton, AdminCard, AdminInput, AdminPage, openAdminDetail } from '../shared/ui';

type Snapshot = { name: string; accommodationType: string; description?: string | null; addressLine?: string | null; province?: string | null; district?: string | null; ward?: string | null; latitude?: string | null; longitude?: string | null; contactEmail?: string | null; contactPhone?: string | null; checkInTime?: string | null; checkOutTime?: string | null; amenityIds?: string[]; policy?: { cancellationPolicy?: string | null; houseRules?: string | null } | null; rooms?: { id: string; name: string; type: string; quantity: number; basePrice: string; currency: string }[] };
type Submission = { id: string; hotelId: string; ownerId: string; version: number; status: string; submittedAt: string; snapshot: Snapshot; hotel: { name: string; status?: string; profileVersion: number; owner: { id: string; fullName: string; email: string | null } }; media?: { id: string; roomId: string | null; url: string; isCover: boolean }[] };
const key = ['admin', 'hotel-submissions'] as const;
const labels: Record<string, string> = { HOTEL: 'Khách sạn', RESORT: 'Resort', APARTMENT: 'Căn hộ', VILLA: 'Villa', HOMESTAY: 'Homestay', HOSTEL: 'Hostel' };

export function HotelModerationScreen() {
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const queue = useQuery({ queryKey: key, queryFn: async () => (await apiClient.get<Submission[]>('/hotels/review/submissions')).data, refetchOnMount: 'always' });
  const items = (queue.data ?? []).filter((item) => (!type || item.snapshot.accommodationType === type) && `${item.snapshot.name} ${item.hotel.owner.fullName} ${item.ownerId}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <AdminPage title="Chỗ ở chờ duyệt" eyebrow="CHỖ Ở / HÀNG CHỜ DUYỆT" subtitle="Hồ sơ do chủ khách sạn gửi và đang chờ kiểm duyệt." trailing={<AdminText>{queue.data?.length ?? 0} hồ sơ chờ duyệt</AdminText>}>
    <AdminInput value={search} onChangeText={setSearch} placeholder="Tìm tên khách sạn hoặc mã chủ" />
    <ScrollView horizontal contentContainerStyle={styles.row}>{['', ...Object.keys(labels)].map((item) => <AdminButton key={item} label={item ? labels[item] : 'Tất cả'} variant={type === item ? 'primary' : 'outline'} onPress={() => setType(item)} />)}</ScrollView>
    {queue.isPending ? <ActivityIndicator /> : queue.isError ? <AdminCard><AdminText>Không tải được hàng chờ.</AdminText><AdminButton label="Thử lại" onPress={() => void queue.refetch()} /></AdminCard> : items.length === 0 ? <AdminCard><AdminText>Chưa có hồ sơ phù hợp đang chờ duyệt.</AdminText></AdminCard> : items.map((item) => <AdminCard key={item.id} title={item.snapshot.name}>
      <AdminText style={styles.body}>{labels[item.snapshot.accommodationType] ?? item.snapshot.accommodationType} · {item.snapshot.rooms?.length ?? 0} hạng phòng</AdminText>
      <AdminText style={styles.body}>Chủ: {item.hotel.owner.fullName}</AdminText><AdminText style={styles.body}>Gửi: {new Date(item.submittedAt).toLocaleString('vi-VN')} · Phiên bản {item.version}</AdminText>
      <AdminButton label="Xem hồ sơ" onPress={() => openAdminDetail('hotel-moderation', item.id)} />
    </AdminCard>)}
  </AdminPage>;
}

export function HotelApprovalDetailScreen({ id }: { id: string }) {
  const client = useQueryClient();
  const detail = useQuery({ queryKey: [...key, id], queryFn: async () => (await apiClient.get<Submission>(`/hotels/review/submissions/${encodeURIComponent(id)}`)).data, refetchOnMount: 'always' });
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (decision: 'APPROVE' | 'REJECT') => {
    if (!detail.data || busy) return;
    if (decision === 'REJECT' && reason.trim().length < 3) { setError('Nhập lý do từ chối ít nhất 3 ký tự.'); return; }
    setBusy(true); setError('');
    try {
      await apiClient.post(`/hotels/review/submissions/${encodeURIComponent(id)}/decision`, { decision, expectedVersion: detail.data.version, reason: decision === 'REJECT' ? reason.trim() : undefined });
      await client.invalidateQueries({ queryKey: key });
      await detail.refetch();
    } catch (cause) { setError(isAxiosError(cause) && cause.response?.status === 409 ? 'Hồ sơ đã thay đổi. Hãy tải lại.' : 'Không thực hiện được. Kiểm tra kết nối rồi thử lại.'); await detail.refetch(); } finally { setBusy(false); }
  };
  const item = detail.data;
  const s = item?.snapshot;
  const photos = item?.media ?? [];
  return <AdminPage title={s?.name ?? 'Chi tiết duyệt chỗ ở'} eyebrow="CHỖ Ở / HỒ SƠ GỬI DUYỆT" subtitle={item ? `Phiên bản ${item.version} · ${new Date(item.submittedAt).toLocaleString('vi-VN')}` : 'Đang tải hồ sơ'}>
    {detail.isPending ? <ActivityIndicator /> : detail.isError || !item || !s ? <AdminCard><AdminText>Không tải được hồ sơ.</AdminText><AdminButton label="Thử lại" onPress={() => void detail.refetch()} /></AdminCard> : <>
      <AdminCard title="Thông tin chỗ ở"><AdminText style={styles.body}>Loại: {labels[s.accommodationType] ?? s.accommodationType}</AdminText><AdminText style={styles.body}>Mô tả: {s.description || 'Chưa có'}</AdminText><AdminText style={styles.body}>Địa chỉ: {[s.addressLine, s.ward, s.district, s.province].filter(Boolean).join(', ')}</AdminText><AdminText style={styles.body}>Tọa độ: {s.latitude}, {s.longitude}</AdminText><AdminText style={styles.body}>Liên hệ: {[s.contactEmail, s.contactPhone].filter(Boolean).join(' · ')}</AdminText><AdminText style={styles.body}>Nhận/trả phòng: {s.checkInTime} / {s.checkOutTime}</AdminText></AdminCard>
      <AdminCard title={`Ảnh khách sạn (${photos.filter((photo) => !photo.roomId).length})`}><ScrollView horizontal contentContainerStyle={styles.row}>{photos.filter((photo) => !photo.roomId).map((photo) => <Image key={photo.id} source={{ uri: absoluteMediaUrl(photo.url) }} style={styles.image} />)}</ScrollView></AdminCard>
      <AdminCard title="Chính sách và tiện nghi"><AdminText style={styles.body}>Hủy: {s.policy?.cancellationPolicy || 'Chưa có'}</AdminText><AdminText style={styles.body}>Nội quy: {s.policy?.houseRules || 'Chưa có'}</AdminText><AdminText style={styles.body}>Mã tiện nghi: {s.amenityIds?.join(', ') || 'Chưa có'}</AdminText></AdminCard>
      <AdminCard title={`Hạng phòng (${s.rooms?.length ?? 0})`}>{s.rooms?.map((room) => <View key={room.id} style={styles.room}><AdminText weight="semibold">{room.name} · {room.type}</AdminText><AdminText style={styles.body}>{room.quantity} phòng · {room.basePrice} {room.currency}/đêm</AdminText><ScrollView horizontal contentContainerStyle={styles.row}>{photos.filter((photo) => photo.roomId === room.id).map((photo) => <Image key={photo.id} source={{ uri: absoluteMediaUrl(photo.url) }} style={styles.image} />)}</ScrollView></View>)}</AdminCard>
      <AdminText style={styles.body}>Trạng thái: {item.status} · Chủ sở hữu: {item.hotel.owner.fullName} ({item.hotel.owner.email || item.ownerId})</AdminText>
      {item.status === 'PENDING' ? <><AdminInput label="Lý do từ chối" value={reason} onChangeText={setReason} placeholder="Nhập lý do nếu từ chối" /><View style={styles.row}><AdminButton label={busy ? 'Đang xử lý…' : 'Duyệt chỗ ở'} disabled={busy} onPress={() => void submit('APPROVE')} /><AdminButton label="Từ chối" variant="danger" disabled={busy} onPress={() => void submit('REJECT')} /></View></> : null}
      {error ? <AdminText style={styles.error}>{error}</AdminText> : null}
    </>}
  </AdminPage>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: 10, alignItems: 'center' }, body: { color: '#475569', fontSize: 13, lineHeight: 20 }, room: { gap: 6, marginBottom: 12 }, image: { width: 120, height: 88, borderRadius: 8 }, error: { color: '#B91C1C', fontSize: 13 } });

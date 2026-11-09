import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { InfoCard, OwnerButton, OwnerScaffold } from '../components/owner-ui';
import { ownerRoomHref, ownerScreenHref } from '../navigation/routes';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';
import { absoluteMediaUrl, ownerHotelKey, useOwnerHotel } from './api';
import { ownerRoomApi, ownerRoomKey, useOwnerRoomMedia, useOwnerRooms, type OwnerRoom } from './room-api';
import { invalidateOwnerDashboard } from '../dashboard/model';
import { WizardNotice } from './wizard-ui';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

function currency(value: string, unit: string) {
  return `${Number(value).toLocaleString('vi-VN')} ${unit === 'VND' ? '₫' : unit}`;
}

function RoomCard({ room, hotelId, userId, editable, busyId, changeStatus }: {
  room: OwnerRoom; hotelId: string; userId: string; editable: boolean; busyId: string | null; changeStatus: (room: OwnerRoom) => void;
}) {
  const images = useOwnerRoomMedia(userId, hotelId, room.id);
  return <InfoCard style={styles.roomCard}>
    {images.data?.[0] ? <Image source={{ uri: absoluteMediaUrl((images.data.find((item) => item.isCover) ?? images.data[0]).url) }} style={styles.roomImage} resizeMode="cover" onError={() => void images.refetch()} /> : null}
    <Text style={styles.roomName}>{room.name}</Text>
    <Text style={styles.muted}>{[room.areaM2 ? `${room.areaM2} m²` : null, room.bedInfo, `${room.capacityAdults} người lớn`, room.capacityChildren ? `${room.capacityChildren} trẻ em` : null].filter(Boolean).join(' · ')}</Text>
    <Text style={styles.muted}>Mã {room.type} · {room.quantity} phòng · {room.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm ngừng'}</Text>
    <Text style={styles.price}>{currency(room.basePrice, room.currency)} / đêm</Text>
    {editable ? <View style={styles.actions}>
      <View style={styles.action}><OwnerButton label="Sửa" secondary onPress={() => router.push(ownerRoomHref(hotelId, room.id))} /></View>
      <View style={styles.action}><OwnerButton label={busyId === room.id ? 'Đang lưu...' : room.status === 'ACTIVE' ? 'Tạm ngừng' : 'Mở lại'} secondary disabled={Boolean(busyId)} onPress={() => changeStatus(room)} /></View>
    </View> : null}
  </InfoCard>;
}

export function OwnerHotelRoomsScreen({ hotelId, returnTo }: { hotelId?: string; returnTo?: 'hotel-review' }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const hotel = useOwnerHotel(userId, hotelId);
  const rooms = useOwnerRooms(userId, hotelId);
  const client = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const editable = hotel.data?.status === 'DRAFT' || hotel.data?.status === 'REJECTED' || hotel.data?.status === 'APPROVED';

  const changeStatus = async (room: OwnerRoom) => {
    if (!hotelId || !userId || busyId) return;
    setBusyId(room.id);
    setError('');
    try {
      await ownerRoomApi.status(room.id, room.revision, room.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE');
      await client.invalidateQueries({ queryKey: ownerRoomKey(userId, hotelId) });
      await client.invalidateQueries({ queryKey: ownerHotelKey(userId, hotelId) });
      await invalidateOwnerDashboard(client, userId);
    } catch (cause) {
      setError(isAxiosError(cause) && cause.response?.status === 409 ? 'Hạng phòng hoặc hồ sơ đã thay đổi. Hãy tải lại danh sách trước khi thử lại.' : 'Chưa đổi được trạng thái phòng.');
    } finally {
      setBusyId(null);
    }
  };

  if (!hotelId || !userId) return <OwnerScaffold title="Hạng phòng" testID="OWN-UI-13"><WizardNotice title="Chưa chọn chỗ ở" body="Mở chỗ ở từ danh sách của bạn." actionLabel="Chỗ ở của tôi" onAction={() => router.replace('/hotel-owner/hotels')} /></OwnerScaffold>;

  return <OwnerScaffold title="Hạng phòng" testID="OWN-UI-13" onRefresh={() => { void rooms.refetch(); void hotel.refetch(); }} refreshing={rooms.isRefetching}>
    <OwnerButton label={returnTo === 'hotel-review' ? '‹ Quay lại kiểm tra' : '‹ Về chi tiết chỗ ở'} secondary onPress={() => router.replace(ownerScreenHref(returnTo ?? 'hotel-detail', hotelId))} />
    <InfoCard><Text style={styles.title}>{hotel.data?.name ?? 'Đang tải chỗ ở'}</Text><Text style={styles.muted}>Số phòng là tổng số phòng vật lý của từng hạng, không phải số phòng trống hôm nay.</Text></InfoCard>
    {rooms.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {rooms.isError || hotel.isError ? <WizardNotice title="Không tải được hạng phòng" body="Kiểm tra mạng hoặc quyền truy cập rồi thử lại." error actionLabel="Thử lại" onAction={() => { void rooms.refetch(); void hotel.refetch(); }} /> : null}
    {rooms.data?.length === 0 ? <WizardNotice title="Chưa có hạng phòng" body="Thêm hạng phòng để hoàn thiện điều kiện gửi duyệt." /> : null}
    {rooms.data?.map((room) => <RoomCard key={room.id} room={room} hotelId={hotelId} userId={userId} editable={Boolean(editable)} busyId={busyId} changeStatus={(item) => void changeStatus(item)} />)}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {editable ? <OwnerButton label="Thêm hạng phòng" onPress={() => router.push(ownerRoomHref(hotelId))} /> : null}
  </OwnerScaffold>;
}

const styles = StyleSheet.create({
  title: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  roomCard: { gap: 10, borderWidth: 1, borderColor: ownerColors.border },
  roomImage: { width: '100%', height: 150, borderRadius: 12, backgroundColor: ownerColors.primarySoft },
  roomName: { color: ownerColors.text, fontSize: 18, fontWeight: '700' },
  price: { color: ownerColors.primaryDark, fontSize: 18, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, minWidth: 0 },
  error: { color: ownerColors.danger, fontSize: 13 },
});

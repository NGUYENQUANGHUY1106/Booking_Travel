import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { InfoCard, OwnerButton, OwnerScaffold } from '../components/owner-ui';
import { ownerScreenHref } from '../navigation/routes';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';
import { apiClient } from '@/services/api-client';
import { ownerHotelKey, ownerHotelListKey, useOwnerHotel } from './api';
import { WizardField, WizardNotice } from './wizard-ui';

export function OwnerHotelRoomCreateScreen({ hotelId }: { hotelId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const profile = useOwnerHotel(userId, hotelId);
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [bedInfo, setBedInfo] = useState('');
  const [capacityAdults, setCapacityAdults] = useState('2');
  const [quantity, setQuantity] = useState('1');
  const [basePrice, setBasePrice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!hotelId || !userId) return <OwnerScaffold title="Thêm hạng phòng"><WizardNotice title="Chưa chọn chỗ ở" body="Mở hồ sơ từ Chỗ ở của tôi." actionLabel="Chỗ ở của tôi" onAction={() => router.replace('/hotel-owner/hotels')} /></OwnerScaffold>;
  if (profile.isPending) return <OwnerScaffold title="Thêm hạng phòng"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
  if (!profile.data) return <OwnerScaffold title="Thêm hạng phòng"><WizardNotice title="Không tải được hồ sơ" body="Kiểm tra mạng hoặc quyền truy cập." error actionLabel="Thử lại" onAction={() => void profile.refetch()} /></OwnerScaffold>;
  const editable = profile.data.status === 'DRAFT' || profile.data.status === 'REJECTED';
  const submit = async () => {
    if (busy || !editable) return;
    const adults = Number(capacityAdults); const count = Number(quantity); const price = Number(basePrice);
    if (name.trim().length < 2 || type.trim().length < 2 || bedInfo.trim().length < 2 || !Number.isInteger(adults) || adults < 1 || !Number.isInteger(count) || count < 1 || !basePrice.trim() || !Number.isFinite(price) || price < 0) return setError('Nhập đủ tên, loại, giường, sức chứa, số lượng và giá cơ bản hợp lệ.');
    setBusy(true); setError('');
    try {
      await apiClient.post(`/hotels/${hotelId}/rooms`, { name: name.trim(), type: type.trim(), bedInfo: bedInfo.trim(), capacityAdults: adults, quantity: count, basePrice: price, currency: 'VND' });
      await client.invalidateQueries({ queryKey: ownerHotelKey(userId, hotelId) });
      await client.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
      router.replace(ownerScreenHref('hotel-review', hotelId));
    } catch (cause) {
      setError(isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0) ? 'Bạn không còn quyền thêm phòng cho chỗ ở này.' : 'Chưa lưu được hạng phòng. Kiểm tra dữ liệu và mạng rồi thử lại.');
    } finally { setBusy(false); }
  };
  return <OwnerScaffold title="Thêm hạng phòng" footer={editable ? <OwnerButton label={busy ? 'Đang lưu...' : 'Lưu hạng phòng'} disabled={busy} onPress={() => void submit()} /> : undefined}>
    <OwnerButton label="‹ Quay lại kiểm tra" secondary onPress={() => router.replace(ownerScreenHref('hotel-review', hotelId))} />
    <InfoCard><Text style={styles.title}>Hạng phòng tối thiểu</Text><Text style={styles.muted}>Tạo một hạng phòng thật để hoàn thiện điều kiện gửi duyệt. Có thể quản lý chi tiết phòng sau.</Text></InfoCard>
    {!editable ? <WizardNotice title="Chỉ xem" body="Trạng thái này chưa cho thêm phòng." /> : null}
    <WizardField label="Tên hạng phòng" value={name} onChange={setName} placeholder="Deluxe hướng biển" />
    <WizardField label="Mã loại phòng" value={type} onChange={setType} placeholder="DELUXE" />
    <WizardField label="Thông tin giường" value={bedInfo} onChange={setBedInfo} placeholder="1 giường đôi" />
    <WizardField label="Số khách người lớn" value={capacityAdults} onChange={setCapacityAdults} keyboardType="decimal-pad" />
    <WizardField label="Số phòng" value={quantity} onChange={setQuantity} keyboardType="decimal-pad" />
    <WizardField label="Giá cơ bản (VND)" value={basePrice} onChange={setBasePrice} keyboardType="decimal-pad" placeholder="1450000" />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </OwnerScaffold>;
}

const styles = StyleSheet.create({
  title: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: ownerColors.danger, fontSize: 13 },
});

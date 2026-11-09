import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { InfoCard, OwnerScaffold } from '../components/owner-ui';
import { invalidateOwnerDashboard } from '../dashboard/model';
import { ownerScreenHref } from '../navigation/routes';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';
import { ownerHotelApi, ownerHotelKey, ownerHotelListKey, useOwnerHotel, type Amenity, type OwnerHotelProfile } from './api';
import { leaveWizard, WizardField, WizardNotice, WizardStep } from './wizard-ui';

export function OwnerHotelAmenitiesScreen({ hotelId }: { hotelId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const profile = useOwnerHotel(userId, hotelId);
  if (!hotelId || !userId) return <OwnerScaffold title="Tạo chỗ ở · tiện ích" testID="OWN-UI-11"><WizardNotice title="Chưa chọn chỗ ở" body="Mở bản nháp từ Chỗ ở của tôi." actionLabel="Chỗ ở của tôi" onAction={leaveWizard} /></OwnerScaffold>;
  if (profile.isPending) return <OwnerScaffold title="Tạo chỗ ở · tiện ích" testID="OWN-UI-11"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
  if (!profile.data) return <OwnerScaffold title="Tạo chỗ ở · tiện ích" testID="OWN-UI-11"><WizardNotice title="Không tải được hồ sơ" body="Kiểm tra mạng hoặc quyền truy cập rồi thử lại." error actionLabel="Thử lại" onAction={() => void profile.refetch()} /></OwnerScaffold>;
  return <AmenitiesForm key={`${userId}:${profile.data.id}`} hotel={profile.data} userId={userId} />;
}

function AmenitiesForm({ hotel, userId }: { hotel: OwnerHotelProfile; userId: string }) {
  const client = useQueryClient();
  const catalog = useQuery({ queryKey: ['owner-hotel-amenities-catalog'], queryFn: ownerHotelApi.catalog, staleTime: 60_000 });
  const [selected, setSelected] = useState<string[]>(hotel.amenities);
  const [search, setSearch] = useState('');
  const [contactEmail, setContactEmail] = useState(hotel.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(hotel.contactPhone ?? '');
  const [checkInTime, setCheckInTime] = useState(hotel.checkInTime ?? '');
  const [checkOutTime, setCheckOutTime] = useState(hotel.checkOutTime ?? '');
  const [cancellationPolicy, setCancellationPolicy] = useState(hotel.policy?.cancellationPolicy ?? '');
  const [houseRules, setHouseRules] = useState(hotel.policy?.houseRules ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const editable = hotel.status === 'DRAFT' || hotel.status === 'REJECTED';
  const change = (setter: (value: string) => void, value: string) => { setter(value); setDirty(true); setError(''); };
  const toggle = (id: string) => { setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]); setDirty(true); };
  const normalizedSearch = search.trim().toLocaleLowerCase('vi');
  const visibleAmenities = catalog.data?.filter((item) => item.name.toLocaleLowerCase('vi').includes(normalizedSearch) || item.id.toLocaleLowerCase('vi').includes(normalizedSearch)) ?? [];
  const unknownSelected = catalog.data ? selected.filter((id) => !catalog.data.some((item) => item.id === id)) : [];
  const save = async (next: 'review' | 'media' | 'exit') => {
    if (busy || !editable) return;
    if (!dirty) return navigate(next);
    if (catalog.isPending || catalog.isError) return setError('Chưa tải được danh mục tiện ích. Hãy thử lại.');
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return setError('Email liên hệ không hợp lệ.');
    if (contactPhone.trim() && !/^\+?[0-9 .()-]{7,25}$/.test(contactPhone.trim())) return setError('Số điện thoại liên hệ không hợp lệ.');
    if ([checkInTime, checkOutTime].some((time) => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return setError('Giờ nhận/trả phòng cần theo định dạng HH:mm.');
    if (cancellationPolicy.length > 3000 || houseRules.length > 3000) return setError('Mỗi chính sách tối đa 3000 ký tự.');
    setBusy(true); setError('');
    try {
      const saved = await ownerHotelApi.updateProfile(hotel.id, hotel.profileVersion, {
        amenityIds: selected,
        contactEmail: contactEmail.trim() || null,
        contactPhone: contactPhone.trim() || null,
        checkInTime: checkInTime || null,
        checkOutTime: checkOutTime || null,
        policy: { cancellationPolicy: cancellationPolicy.trim() || null, houseRules: houseRules.trim() || null },
      });
      client.setQueryData(ownerHotelKey(userId, hotel.id), saved);
      await client.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
      await invalidateOwnerDashboard(client, userId);
      setDirty(false);
      navigate(next);
    } catch (cause) {
      setError(isAxiosError(cause) && cause.response?.status === 409 ? 'Hồ sơ đã đổi. Tải lại trước khi lưu.' : isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0) ? 'Bạn không còn quyền sửa chỗ ở này.' : 'Chưa lưu được tiện ích và chính sách. Kiểm tra mạng rồi thử lại.');
    } finally { setBusy(false); }
  };
  const navigate = (next: 'review' | 'media' | 'exit') => next === 'exit' ? leaveWizard() : router.replace(ownerScreenHref(next === 'review' ? 'hotel-review' : 'hotel-media', hotel.id));

  return <WizardStep title="Tạo chỗ ở · tiện ích" number={4} subtitle="Tiện ích và chính sách" testID="OWN-UI-11" onBack={() => void save('media')} onExit={() => void save('exit')} onNext={() => void save('review')} busy={busy} disabled={!editable}>
    {!editable ? <WizardNotice title="Chỉ xem" body="Trạng thái này chưa cho sửa tiện ích và chính sách." /> : null}
    <InfoCard><Text style={styles.title}>Tiện ích</Text><Text style={styles.muted}>Chọn những tiện ích thật sự có tại chỗ ở.</Text></InfoCard>
    {catalog.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {catalog.isError ? <WizardNotice title="Không tải được tiện ích" body="Kiểm tra kết nối rồi thử lại." error actionLabel="Tải lại" onAction={() => void catalog.refetch()} /> : null}
    {catalog.data ? <WizardField label="Tìm tiện ích" value={search} onChange={setSearch} placeholder="Tên hoặc mã tiện ích" /> : null}
    {catalog.data ? <Text style={styles.muted}>{selected.length} tiện ích đã chọn</Text> : null}
    {catalog.data && !visibleAmenities.length ? <Text style={styles.muted}>Không tìm thấy tiện ích phù hợp.</Text> : null}
    <View style={styles.amenities}>{visibleAmenities.map((item: Amenity) => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(item.id), disabled: !editable || (!item.active && !selected.includes(item.id)) }} onPress={() => toggle(item.id)} disabled={!editable || (!item.active && !selected.includes(item.id))} style={[styles.amenity, selected.includes(item.id) && styles.amenitySelected]}><Text style={styles.amenityText}>{selected.includes(item.id) ? '✓ ' : ''}{item.name}{!item.active ? ' · Ngừng cung cấp' : ''}</Text></Pressable>)}</View>
    {unknownSelected.map((id) => <Pressable key={id} accessibilityRole="button" disabled={!editable} onPress={() => toggle(id)} style={styles.amenity}><Text style={styles.amenityText}>Tiện ích cũ: {id} · Chạm để bỏ</Text></Pressable>)}
    <InfoCard><Text style={styles.title}>Liên hệ và giờ nhận/trả</Text><Text style={styles.muted}>Cần ít nhất một kênh liên hệ và đủ hai giờ trước khi gửi duyệt.</Text></InfoCard>
    <WizardField label="Email liên hệ" value={contactEmail} onChange={(value) => change(setContactEmail, value)} keyboardType="email-address" placeholder="name@example.com" />
    <WizardField label="Số điện thoại" value={contactPhone} onChange={(value) => change(setContactPhone, value)} keyboardType="phone-pad" placeholder="+84..." />
    <WizardField label="Giờ nhận phòng (HH:mm)" value={checkInTime} onChange={(value) => change(setCheckInTime, value)} placeholder="14:00" />
    <WizardField label="Giờ trả phòng (HH:mm)" value={checkOutTime} onChange={(value) => change(setCheckOutTime, value)} placeholder="12:00" />
    <InfoCard><Text style={styles.title}>Chính sách</Text><Text style={styles.muted}>Không tự đánh dấu hủy miễn phí; hãy ghi điều kiện thật.</Text></InfoCard>
    <WizardField label="Chính sách hủy" value={cancellationPolicy} onChange={(value) => change(setCancellationPolicy, value)} multiline placeholder="Nhập điều kiện hủy" />
    <WizardField label="Nội quy" value={houseRules} onChange={(value) => change(setHouseRules, value)} multiline placeholder="Nhập nội quy" />
    <WizardNotice title="Lưu nháp" body={dirty ? 'Thay đổi chưa lưu lên máy chủ. Bấm Lưu & tiếp tục để lưu.' : 'Dữ liệu đang hiển thị là hồ sơ đã lưu trên máy chủ.'} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </WizardStep>;
}

const styles = StyleSheet.create({
  title: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  amenities: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenity: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: ownerColors.border, backgroundColor: ownerColors.surface, justifyContent: 'center', paddingHorizontal: 12 },
  amenitySelected: { borderColor: ownerColors.primary, backgroundColor: ownerColors.primarySoft },
  amenityText: { color: ownerColors.text, fontSize: 14 },
  error: { color: ownerColors.danger, fontSize: 13 },
});

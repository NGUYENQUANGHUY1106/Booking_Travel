import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { InfoCard, OwnerButton, OwnerScaffold } from '../components/owner-ui';
import { invalidateOwnerDashboard } from '../dashboard/model';
import { ownerScreenHref } from '../navigation/routes';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';
import { apiClient } from '@/services/api-client';
import { ownerHotelApi, ownerHotelKey, ownerHotelListKey, useOwnerHotel, type OwnerHotelProfile } from './api';
import { leaveWizard, WizardField, WizardNotice, WizardStep, WizardSummary } from './wizard-ui';
import { HotelPinMap } from './HotelPinMap';

type Unit = { id: string; name: string };
type Mode = 'CURRENT' | 'LEGACY';

function Selection({ label, value, options, onSelect, loading }: { label: string; value: string; options: Unit[]; onSelect: (id: string) => void; loading?: boolean }) {
  const [open, setOpen] = useState(false);
  const current = options.find((item) => item.id === value);
  return <View style={styles.group}><Text style={styles.label}>{label}</Text><Pressable accessibilityRole="button" onPress={() => setOpen(!open)} style={styles.optionButton}><Text style={styles.optionText}>{current?.name ?? (loading ? 'Đang tải danh mục...' : `Chọn ${label.toLowerCase()}`)}</Text><Text>⌄</Text></Pressable>{open ? <ScrollView nestedScrollEnabled style={styles.optionList}>{options.map((item) => <Pressable key={item.id} accessibilityRole="button" onPress={() => { onSelect(item.id); setOpen(false); }} style={styles.option}><Text style={styles.optionText}>{item.name}</Text></Pressable>)}</ScrollView> : null}</View>;
}

export function OwnerHotelLocationScreen({ hotelId }: { hotelId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const profile = useOwnerHotel(userId, hotelId);
  if (!hotelId || !userId) return <OwnerScaffold title="Tạo khách sạn · vị trí" testID="OWN-UI-09"><WizardNotice title="Chưa chọn chỗ ở" body="Mở một bản nháp từ Chỗ ở của tôi để nhập vị trí." actionLabel="Chỗ ở của tôi" onAction={leaveWizard} /></OwnerScaffold>;
  if (profile.isPending) return <OwnerScaffold title="Tạo khách sạn · vị trí" testID="OWN-UI-09"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
  if (!profile.data) return <OwnerScaffold title="Tạo khách sạn · vị trí" testID="OWN-UI-09"><WizardNotice title="Không mở được chỗ ở" body="Kiểm tra kết nối hoặc quyền truy cập rồi thử lại." error actionLabel="Thử lại" onAction={() => void profile.refetch()} /></OwnerScaffold>;
  return <LocationForm key={`${userId}:${profile.data.id}`} hotel={profile.data} userId={userId} />;
}

function LocationForm({ hotel, userId }: { hotel: OwnerHotelProfile; userId: string }) {
  const client = useQueryClient();
  const [mode, setMode] = useState<Mode>(hotel.districtUnitId ? 'LEGACY' : 'CURRENT');
  const [addressLine, setAddressLine] = useState(hotel.addressLine ?? '');
  const [provinceId, setProvinceId] = useState(hotel.provinceUnitId ?? '');
  const [districtId, setDistrictId] = useState(hotel.districtUnitId ?? '');
  const [wardId, setWardId] = useState(hotel.wardUnitId ?? '');
  const [latitude, setLatitude] = useState(hotel.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(hotel.longitude?.toString() ?? '');
  const [editing, setEditing] = useState(!hotel.completion.location);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [suggestedPin, setSuggestedPin] = useState<{ latitude: number; longitude: number } | null>(null);
  const provinces = useQuery({ queryKey: ['address-provinces', mode], queryFn: async () => (await apiClient.get<Unit[]>(`/addresses/catalog/provinces?mode=${mode}`)).data });
  const districts = useQuery({ queryKey: ['address-districts', provinceId], queryFn: async () => (await apiClient.get<Unit[]>(`/addresses/catalog/legacy/provinces/${provinceId}/districts`)).data, enabled: mode === 'LEGACY' && Boolean(provinceId) });
  const wards = useQuery({ queryKey: ['address-wards', mode, provinceId, districtId], queryFn: async () => (await apiClient.get<Unit[]>(mode === 'CURRENT' ? `/addresses/catalog/provinces/${provinceId}/communes` : `/addresses/catalog/legacy/districts/${districtId}/communes`)).data, enabled: mode === 'CURRENT' ? Boolean(provinceId) : Boolean(districtId) });
  const editable = hotel.status === 'DRAFT' || hotel.status === 'REJECTED';
  const summary = [addressLine, wards.data?.find((item) => item.id === wardId)?.name ?? (wardId === hotel.wardUnitId ? hotel.ward : null), districts.data?.find((item) => item.id === districtId)?.name ?? (districtId === hotel.districtUnitId ? hotel.district : null), provinces.data?.find((item) => item.id === provinceId)?.name ?? (provinceId === hotel.provinceUnitId ? hotel.province : null)].filter(Boolean).join(', ');
  const set = (setter: (value: string) => void, value: string) => { setter(value); setDirty(true); setError(''); setSuggestedPin(null); };

  const save = async (next: 'media' | 'basic' | 'exit') => {
    if (busy || !editable) return;
    const lat = Number(latitude); const lng = Number(longitude);
    const hasLat = Boolean(latitude.trim()), hasLng = Boolean(longitude.trim());
    const complete = addressLine.trim().length >= 2 && provinceId && wardId && (mode !== 'LEGACY' || districtId) && hasLat && hasLng;
    if (next === 'media' && !complete) return setError('Nhập đủ địa chỉ, đơn vị hành chính và ghim vị trí trước khi tiếp tục.');
    if (addressLine.trim() && addressLine.trim().length < 2) return setError('Số nhà, đường cần ít nhất 2 ký tự.');
    if (hasLat !== hasLng) return setError('Cần nhập cả vĩ độ và kinh độ, hoặc để trống cả hai.');
    if (hasLat && (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 7 || lat > 24.5 || lng < 102 || lng > 117.5)) return setError('Nhập tọa độ thuộc Việt Nam: vĩ độ 7–24.5, kinh độ 102–117.5.');
    if (!dirty) { navigate(next); return; }
    setBusy(true); setError('');
    try {
      const saved = await ownerHotelApi.location(hotel.id, { expectedVersion: hotel.profileVersion, addressLine: addressLine.trim() || null, provinceUnitId: provinceId || null, districtUnitId: mode === 'LEGACY' ? districtId || null : null, wardUnitId: wardId || null, latitude: hasLat ? lat : null, longitude: hasLng ? lng : null });
      client.setQueryData(ownerHotelKey(userId, hotel.id), saved);
      await client.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
      await invalidateOwnerDashboard(client, userId);
      setDirty(false);
      navigate(next);
    } catch (cause) {
      setError(isAxiosError(cause) && cause.response?.status === 409 ? 'Hồ sơ đã thay đổi ở nơi khác. Quay lại danh sách và mở lại.' : isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0) ? 'Bạn không còn quyền sửa vị trí này.' : 'Chưa lưu được vị trí. Kiểm tra danh mục, mạng và thử lại.');
    } finally { setBusy(false); }
  };
  const navigate = (next: 'media' | 'basic' | 'exit') => next === 'exit' ? leaveWizard() : router.replace(ownerScreenHref(next === 'media' ? 'hotel-media' : 'hotel-basic', hotel.id));
  const fillCurrentPosition = async () => {
    try { const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') return setError('Chưa được cấp quyền vị trí. Bạn có thể nhập tọa độ khách sạn thủ công.');
      const point = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); set(setLatitude, point.coords.latitude.toFixed(7)); set(setLongitude, point.coords.longitude.toFixed(7)); }
    catch { setError('Không lấy được vị trí hiện tại. Bạn có thể nhập tọa độ thủ công.'); }
  };
  const suggestPin = async () => {
    if (!addressLine.trim() || !provinceId || !wardId) return setError('Nhập địa chỉ, tỉnh và phường/xã trước khi tìm ghim.');
    setGeocoding(true); setError(''); setSuggestedPin(null);
    try {
      const matches = await Location.geocodeAsync(summary);
      const candidate = matches.find((point) => point.latitude >= 7 && point.latitude <= 24.5 && point.longitude >= 102 && point.longitude <= 117.5);
      if (!candidate) return setError('Không tìm thấy vị trí phù hợp. Hãy đặt ghim trên bản đồ hoặc nhập tọa độ.');
      setSuggestedPin({ latitude: candidate.latitude, longitude: candidate.longitude });
    } catch { setError('Không tìm được vị trí từ địa chỉ. Kiểm tra mạng hoặc đặt ghim thủ công.'); }
    finally { setGeocoding(false); }
  };

  return <WizardStep title="Tạo khách sạn · vị trí" number={2} subtitle="Địa chỉ" testID="OWN-UI-09" onBack={() => void save('basic')} onExit={() => void save('exit')} onNext={() => void save('media')} busy={busy} disabled={!editable}>
    {!editable ? <WizardNotice title="Chỉ xem" body="Trạng thái này chưa cho phép chỉnh sửa vị trí." /> : null}
    <WizardSummary label="Địa chỉ" value={summary || 'Chưa có địa chỉ'} onPress={() => setEditing(!editing)} />
    {editing && editable ? <InfoCard>
      <Text style={styles.label}>Danh mục địa chỉ</Text><View style={styles.modeRow}>{(['CURRENT', 'LEGACY'] as Mode[]).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: mode === value }} onPress={() => { setMode(value); setProvinceId(''); setDistrictId(''); setWardId(''); setSuggestedPin(null); setDirty(true); }} style={[styles.mode, mode === value && styles.modeActive]}><Text style={styles.optionText}>{value === 'CURRENT' ? 'Hiện hành (2 cấp)' : 'Địa chỉ cũ (3 cấp)'}</Text></Pressable>)}</View>
      <WizardField label="Số nhà, đường" value={addressLine} onChange={(value) => set(setAddressLine, value)} placeholder="Nhập địa chỉ chỗ ở" />
      {provinces.isError ? <Text style={styles.error}>Không tải được tỉnh/thành. Hãy kiểm tra dữ liệu danh mục.</Text> : null}
      <Selection label="Tỉnh/thành" value={provinceId} options={provinces.data ?? []} loading={provinces.isPending} onSelect={(value) => { set(setProvinceId, value); setDistrictId(''); setWardId(''); }} />
      {mode === 'LEGACY' ? <Selection label="Quận/huyện" value={districtId} options={districts.data ?? []} loading={districts.isPending} onSelect={(value) => { set(setDistrictId, value); setWardId(''); }} /> : null}
      <Selection label="Phường/xã" value={wardId} options={wards.data ?? []} loading={wards.isPending} onSelect={(value) => set(setWardId, value)} />
      <Text style={styles.muted}>Tọa độ ghim của chỗ ở; không tự thay đổi khi bạn sửa địa chỉ.</Text>
      {Platform.OS !== 'web' ? <OwnerButton label={geocoding ? 'Đang tìm vị trí...' : 'Gợi ý ghim từ địa chỉ'} secondary disabled={geocoding} onPress={() => void suggestPin()} /> : null}
      {suggestedPin ? <InfoCard><Text style={styles.muted}>Gợi ý: {suggestedPin.latitude.toFixed(5)}, {suggestedPin.longitude.toFixed(5)}. Kiểm tra trên bản đồ trước khi dùng; địa chỉ đã nhập không tự thay đổi.</Text><OwnerButton label="Dùng điểm gợi ý" secondary onPress={() => { setLatitude(suggestedPin.latitude.toFixed(7)); setLongitude(suggestedPin.longitude.toFixed(7)); setDirty(true); setSuggestedPin(null); }} /></InfoCard> : null}
      <View style={styles.coordinateRow}><View style={styles.coordinateField}><WizardField label="Vĩ độ" value={latitude} onChange={(value) => set(setLatitude, value)} keyboardType="decimal-pad" placeholder="16.0544" /></View><View style={styles.coordinateField}><WizardField label="Kinh độ" value={longitude} onChange={(value) => set(setLongitude, value)} keyboardType="decimal-pad" placeholder="108.2022" /></View></View>
      <HotelPinMap latitude={latitude.trim() && Number.isFinite(Number(latitude)) ? Number(latitude) : null} longitude={longitude.trim() && Number.isFinite(Number(longitude)) ? Number(longitude) : null} onChange={(lat, lng) => { setLatitude(lat.toFixed(7)); setLongitude(lng.toFixed(7)); setSuggestedPin(null); setDirty(true); setError(''); }} />
      <OwnerButton label="Dùng vị trí hiện tại" secondary onPress={() => void fillCurrentPosition()} />
    </InfoCard> : null}
    <WizardSummary label="Mô tả" value={hotel.description || 'Chưa có mô tả'} onPress={() => router.push(ownerScreenHref('hotel-basic', hotel.id))} />
    <WizardNotice title="Lưu tự động" body={dirty ? 'Vị trí chưa lưu lên máy chủ. Bấm Lưu & tiếp tục để lưu.' : 'Bản nháp đã lưu trên máy chủ trước khi gửi duyệt.'} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </WizardStep>;
}

const styles = StyleSheet.create({
  group: { gap: 8 }, label: { color: ownerColors.text, fontSize: 14, fontWeight: '600' },
  optionButton: { minHeight: 48, backgroundColor: ownerColors.surface, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionList: { maxHeight: 220, backgroundColor: ownerColors.surface, borderWidth: 1, borderColor: ownerColors.border, borderRadius: 12 },
  option: { minHeight: 44, paddingHorizontal: 14, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: ownerColors.border },
  optionText: { color: ownerColors.text, fontSize: 14 },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, mode: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: ownerColors.border }, modeActive: { borderColor: ownerColors.primary, backgroundColor: ownerColors.primarySoft },
  coordinateRow: { flexDirection: 'row', gap: 10 }, coordinateField: { flex: 1 }, muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 }, error: { color: ownerColors.danger, fontSize: 13, lineHeight: 18 },
});

import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { InfoCard, OwnerButton, OwnerScaffold } from '../components/owner-ui';
import { ownerScreenHref } from '../navigation/routes';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';
import { absoluteMediaUrl, ownerHotelApi, ownerHotelKey, ownerHotelListKey, useOwnerHotel } from './api';
import { ownerRoomApi, ownerRoomKey, ownerRoomMediaKey, useOwnerRoomMedia, useOwnerRooms, useRoomCatalog, type BedConfiguration, type RoomCatalogOption, type RoomChanges } from './room-api';
import { HotelGallery } from './HotelGallery';
import { WizardField, WizardNotice } from './wizard-ui';

type Draft = {
  classCode: string; viewCode: string; beds: BedConfiguration[]; name: string; code: string;
  legacyBed: string; area: string; adults: string; children: string; quantity: string; price: string;
  amenities: string[];
  ownName: boolean; ownCode: boolean;
};
const EMPTY: Draft = { classCode: '', viewCode: 'NONE', beds: [], name: '', code: '', legacyBed: '',
  area: '', adults: '', children: '0', quantity: '', price: '', amenities: [], ownName: false, ownCode: false };
const BED_PRESETS: { label: string; beds: BedConfiguration[] }[] = [
  { label: '1 King', beds: [{ bedType: 'KING', quantity: 1 }] },
  { label: '2 King', beds: [{ bedType: 'KING', quantity: 2 }] },
  { label: '1 Queen', beds: [{ bedType: 'QUEEN', quantity: 1 }] },
  { label: '2 Queen', beds: [{ bedType: 'QUEEN', quantity: 2 }] },
  { label: '1 Single', beds: [{ bedType: 'SINGLE', quantity: 1 }] },
  { label: '2 Single', beds: [{ bedType: 'SINGLE', quantity: 2 }] },
  { label: '3 Single', beds: [{ bedType: 'SINGLE', quantity: 3 }] },
  { label: '1 Double', beds: [{ bedType: 'DOUBLE', quantity: 1 }] },
  { label: '2 Double', beds: [{ bedType: 'DOUBLE', quantity: 2 }] },
  { label: 'King + Single', beds: [{ bedType: 'KING', quantity: 1 }, { bedType: 'SINGLE', quantity: 1 }] },
  { label: 'Double + Single', beds: [{ bedType: 'DOUBLE', quantity: 1 }, { bedType: 'SINGLE', quantity: 1 }] },
  { label: 'Queen + Single', beds: [{ bedType: 'QUEEN', quantity: 1 }, { bedType: 'SINGLE', quantity: 1 }] },
  { label: '1 Bunk Bed', beds: [{ bedType: 'BUNK', quantity: 1 }] },
  { label: '2 Bunk Bed', beds: [{ bedType: 'BUNK', quantity: 2 }] },
  { label: 'Sofa Bed', beds: [{ bedType: 'SOFA', quantity: 1 }] },
  { label: 'King + Sofa', beds: [{ bedType: 'KING', quantity: 1 }, { bedType: 'SOFA', quantity: 1 }] },
  { label: '2 Queen + Sofa', beds: [{ bedType: 'QUEEN', quantity: 2 }, { bedType: 'SOFA', quantity: 1 }] },
  { label: 'Futon', beds: [{ bedType: 'FUTON', quantity: 1 }] },
  { label: 'Khác', beds: [{ bedType: 'OTHER', quantity: 1 }] },
];
const money = (value: number) => value.toLocaleString('vi-VN');
const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

function Options({ title, items, visible, close, select }: { title: string; items: RoomCatalogOption[]; visible: boolean; close: () => void; select: (code: string) => void }) {
  const [search, setSearch] = useState('');
  const filtered = items.filter((item) => plain(item.label).includes(plain(search)) || plain(item.code).includes(plain(search)));
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={close}><View style={styles.backdrop}><View style={styles.sheet}>
    <Text style={styles.title}>{title}</Text>
    <TextInput accessibilityLabel={`Tìm ${title.toLowerCase()}`} style={styles.input} value={search} onChangeText={setSearch} placeholder="Tìm lựa chọn..." placeholderTextColor={ownerColors.muted} />
    <ScrollView keyboardShouldPersistTaps="handled">{filtered.map((item, index) => <View key={item.code}>
      {item.group && (index === 0 || filtered[index - 1].group !== item.group) ? <Text style={styles.group}>{item.group}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={item.label} style={styles.option} onPress={() => { select(item.code); setSearch(''); close(); }}><Text style={styles.text}>{item.label}</Text></Pressable>
    </View>)}
    {!filtered.length ? <Text style={styles.muted}>Không tìm thấy lựa chọn.</Text> : null}</ScrollView>
    <OwnerButton label="Đóng" secondary onPress={close} />
  </View></View></Modal>;
}

function Chips({ values, value, change, format }: { values: string[]; value: string; change: (value: string) => void; format?: (value: string) => string }) {
  return <View style={styles.chips}>{values.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: item === value }} onPress={() => change(item)} style={[styles.chip, item === value && styles.chipActive]}>
    <Text style={[styles.chipText, item === value && styles.chipTextActive]}>{format?.(item) ?? item}</Text>
  </Pressable>)}</View>;
}

export function OwnerHotelRoomCreateScreen({ hotelId, roomId, returnTo = 'hotel-review' }: { hotelId?: string; roomId?: string; returnTo?: 'hotel-review' | 'rooms' }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const hotel = useOwnerHotel(userId, hotelId);
  const rooms = useOwnerRooms(userId, hotelId);
  const catalog = useRoomCatalog();
  const amenities = useQuery({ queryKey: ['owner-hotel-amenities-catalog'], queryFn: ownerHotelApi.catalog, enabled: Boolean(userId), staleTime: 60_000 });
  const client = useQueryClient();
  const room = roomId ? rooms.data?.find((item) => item.id === roomId) : undefined;
  const media = useOwnerRoomMedia(userId, hotelId, roomId);
  const loaded = useRef('');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<{ kind: 'class' | 'view' | 'bed'; index?: number } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [pendingMedia, setPendingMedia] = useState<string | null>(null);
  const [failedAsset, setFailedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);

  useEffect(() => {
    const key = `${userId}:${hotelId}:${roomId ?? 'new'}`;
    if (loaded.current === key || (roomId && !room)) return;
    loaded.current = key;
    setDraft(room ? {
      classCode: room.classCode ?? '', viewCode: room.viewCode ?? 'NONE',
      beds: Array.isArray(room.bedConfigurations) ? room.bedConfigurations : [],
      name: room.name, code: room.type, legacyBed: room.bedInfo, area: room.areaM2 ?? '',
      adults: String(room.capacityAdults), children: String(room.capacityChildren),
      quantity: String(room.quantity), price: String(room.basePrice), amenities: room.amenities, ownName: true, ownCode: true,
    } : EMPTY);
    setDirty(false); setError('');
  }, [userId, hotelId, roomId, room]);

  const change = (partial: Partial<Draft>) => { setDraft((old) => ({ ...old, ...partial })); setDirty(true); setError(''); };
  const selectedClass = catalog.data?.classes.find((item) => item.code === draft.classCode);
  const selectedView = catalog.data?.views.find((item) => item.code === draft.viewCode);
  const nameSuggestion = draft.classCode && draft.classCode !== 'OTHER'
    ? `${selectedClass?.label ?? draft.classCode}${draft.viewCode !== 'NONE' ? ` ${selectedView?.label ?? ''}` : ''}`.trim() : '';
  const name = draft.ownName ? draft.name.trim() : nameSuggestion;
  const bedInfo = draft.beds.length
    ? draft.beds.map((bed) => `${bed.quantity} ${catalog.data?.beds.find((item) => item.code === bed.bedType)?.label ?? bed.bedType}`).join(' · ')
    : draft.legacyBed;
  const suggestion = [draft.classCode === 'OTHER' ? plain(name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) : draft.classCode,
    draft.viewCode !== 'NONE' ? draft.viewCode : '', ...draft.beds.map((bed) => `${bed.quantity > 1 ? bed.quantity : ''}${bed.bedType}`)].filter(Boolean).join('-');
  const code = draft.ownCode ? draft.code.trim() : suggestion.toUpperCase();
  const price = Number(draft.price.replace(/[^0-9]/g, ''));
  const editable = hotel.data?.status === 'DRAFT' || hotel.data?.status === 'REJECTED' || hotel.data?.status === 'APPROVED';
  const destination = () => ownerScreenHref(returnTo, hotelId);
  const leave = () => {
    if (uploading || pendingMedia) return setError('Hoàn tất hoặc xử lý ảnh đang tải trước khi rời form.');
    if (dirty) setConfirmLeave(true);
    else router.replace(destination());
  };
  const mediaEditable = hotel.data?.status === 'DRAFT' || hotel.data?.status === 'REJECTED';
  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!hotelId || !roomId || !userId || uploading || !mediaEditable) return;
    setUploading(true); setUploadProgress(0); setError(''); setFailedAsset(null); setPendingMedia(null);
    let reserved: string | null = null, uploaded = false;
    try {
      await ownerRoomApi.uploadImage(hotelId, roomId, asset, setUploadProgress, (id) => { reserved = id; }, () => { uploaded = true; });
      await client.invalidateQueries({ queryKey: ownerRoomMediaKey(userId, hotelId, roomId) });
      setUploadProgress(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được ảnh phòng.');
      if (uploaded && reserved) setPendingMedia(reserved);
      else setFailedAsset(asset);
    } finally { setUploading(false); }
  };
  const chooseImage = async () => {
    const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
    if (!selected.canceled && selected.assets[0]) await upload(selected.assets[0]);
  };
  const finalizeAgain = async () => {
    if (!hotelId || !roomId || !userId || !pendingMedia || uploading) return;
    setUploading(true); setError('');
    try {
      await ownerRoomApi.finalizeImage(hotelId, roomId, pendingMedia);
      await client.invalidateQueries({ queryKey: ownerRoomMediaKey(userId, hotelId, roomId) });
      setPendingMedia(null); setUploadProgress(null);
    } catch { setError('Chưa xác nhận được ảnh. Hãy thử lại.'); }
    finally { setUploading(false); }
  };
  const removeImage = async (mediaId: string) => {
    if (!hotelId || !roomId || !userId || uploading) return;
    setUploading(true); setError('');
    try {
      await ownerRoomApi.removeImage(hotelId, roomId, mediaId);
      await client.invalidateQueries({ queryKey: ownerRoomMediaKey(userId, hotelId, roomId) });
    } catch { setError('Chưa xóa được ảnh phòng.'); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (busy || !editable || !hotelId || !userId) return;
    const adults = Number(draft.adults), children = Number(draft.children), quantity = Number(draft.quantity);
    const area = draft.area.trim() ? Number(draft.area.replace(',', '.')) : undefined;
    if ((!room && !draft.classCode) || (draft.classCode && !draft.beds.length) || (draft.classCode === 'OTHER' && !draft.ownName) ||
      name.length < 2 || name.length > 120 || !/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/i.test(code) || code.length > 80 || bedInfo.trim().length < 2 ||
      !Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 ||
      !Number.isInteger(quantity) || quantity < 1 || !/^[\d.,\s]+$/.test(draft.price.trim()) || !Number.isSafeInteger(price) ||
      (area !== undefined && (!Number.isFinite(area) || area < 1 || area > 9999)) ||
      draft.beds.some((bed) => !Number.isInteger(bed.quantity) || bed.quantity < 1 || bed.quantity > 20)) {
      setError('Chọn hạng phòng và giường; nhập tên, mã, sức chứa, diện tích, số phòng và giá hợp lệ.'); return;
    }
    const payload: RoomChanges = {
      name, type: code, bedInfo, capacityAdults: adults, capacityChildren: children, quantity,
      basePrice: price, currency: 'VND', ...(area !== undefined ? { areaM2: area } : {}),
      amenities: draft.amenities,
      ...(draft.classCode ? { classCode: draft.classCode, viewCode: draft.viewCode } : {}),
      ...(draft.beds.length ? { bedConfigurations: draft.beds } : {}),
    };
    setBusy(true); setError('');
    try {
      if (room) {
        const changes: Partial<RoomChanges> = {};
        if (payload.name !== room.name) changes.name = payload.name;
        if (payload.type !== room.type) changes.type = payload.type;
        if (payload.bedInfo !== room.bedInfo) changes.bedInfo = payload.bedInfo;
        if (payload.classCode && payload.classCode !== room.classCode) changes.classCode = payload.classCode;
        if (payload.viewCode && payload.viewCode !== room.viewCode) changes.viewCode = payload.viewCode;
        if (payload.bedConfigurations && JSON.stringify(payload.bedConfigurations) !== JSON.stringify(room.bedConfigurations)) changes.bedConfigurations = payload.bedConfigurations;
        if (payload.areaM2 !== undefined && payload.areaM2 !== Number(room.areaM2)) changes.areaM2 = payload.areaM2;
        if (payload.capacityAdults !== room.capacityAdults) changes.capacityAdults = payload.capacityAdults;
        if (payload.capacityChildren !== room.capacityChildren) changes.capacityChildren = payload.capacityChildren;
        if (payload.quantity !== room.quantity) changes.quantity = payload.quantity;
        if (payload.basePrice !== Number(room.basePrice)) changes.basePrice = payload.basePrice;
        if (JSON.stringify(payload.amenities) !== JSON.stringify(room.amenities)) changes.amenities = payload.amenities;
        if (Object.keys(changes).length) await ownerRoomApi.update(room.id, changes);
      } else await ownerRoomApi.create(hotelId, payload);
      await client.invalidateQueries({ queryKey: ownerRoomKey(userId, hotelId) });
      await client.invalidateQueries({ queryKey: ownerHotelKey(userId, hotelId) });
      await client.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
      setDirty(false); router.replace(destination());
    } catch (cause) {
      setError(isAxiosError(cause) && cause.response?.status === 409
        ? 'Mã phòng trùng, số phòng thấp hơn booking đang có, hoặc trạng thái chỗ ở đã đổi. Kiểm tra rồi thử lại.'
        : isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0)
          ? 'Bạn không còn quyền sửa hạng phòng này.'
          : 'Chưa lưu được hạng phòng. Kiểm tra dữ liệu và mạng rồi thử lại.');
    } finally { setBusy(false); }
  };

  const title = roomId ? 'Sửa hạng phòng' : 'Thêm hạng phòng';
  if (!hotelId || !userId) return <OwnerScaffold title={title} testID="OWN-UI-14"><WizardNotice title="Chưa chọn chỗ ở" body="Mở hồ sơ từ Chỗ ở của tôi." actionLabel="Chỗ ở của tôi" onAction={() => router.replace('/hotel-owner/hotels')} /></OwnerScaffold>;
  if (hotel.isPending || rooms.isPending || catalog.isPending) return <OwnerScaffold title={title} testID="OWN-UI-14"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
  if (!hotel.data || !rooms.data || (roomId && !room)) return <OwnerScaffold title={title} testID="OWN-UI-14"><WizardNotice title="Không tải được hạng phòng" body="Kiểm tra mạng hoặc quyền truy cập." error actionLabel="Thử lại" onAction={() => { void hotel.refetch(); void rooms.refetch(); }} /></OwnerScaffold>;
  if (!catalog.data) return <OwnerScaffold title={title} testID="OWN-UI-14"><WizardNotice title="Không tải được danh mục" body="Kiểm tra mạng rồi tải lại." error actionLabel="Thử lại" onAction={() => void catalog.refetch()} /></OwnerScaffold>;

  const options = sheet?.kind === 'class' ? catalog.data.classes : sheet?.kind === 'view' ? catalog.data.views : catalog.data.beds;
  const choose = (value: string) => {
    if (sheet?.kind === 'class') change({ classCode: value });
    if (sheet?.kind === 'view') change({ viewCode: value });
    if (sheet?.kind === 'bed') {
      const beds = [...draft.beds], index = sheet.index ?? 0;
      beds[index] = { bedType: value, quantity: beds[index]?.quantity ?? 1 };
      change({ beds });
    }
  };

  return <OwnerScaffold title={title} testID="OWN-UI-14" footer={editable ? <OwnerButton label={busy ? 'Đang lưu...' : 'Lưu hạng phòng'} disabled={busy} onPress={() => void submit()} /> : undefined}>
    <OwnerButton label={returnTo === 'hotel-review' ? '‹ Quay lại kiểm tra' : '‹ Về danh sách hạng phòng'} secondary onPress={leave} />
    {returnTo === 'hotel-review' ? <InfoCard><Text style={styles.title}>Hạng phòng tối thiểu</Text><Text style={styles.muted}>Một hạng phòng có thể gồm nhiều phòng cùng loại. Chỉ bản ghi đã lưu mới được tính vào điều kiện gửi duyệt.</Text></InfoCard> : null}
    {!editable ? <WizardNotice title="Chỉ xem" body="Trạng thái chỗ ở hiện tại chưa cho sửa phòng." /> : null}
    <InfoCard style={styles.preview}>
      <Text style={styles.previewTitle}>{name || 'Tên hạng phòng dự kiến'}</Text>
      <Text style={styles.muted}>{[draft.area ? `${draft.area} m²` : null, bedInfo || null, draft.adults ? `${draft.adults} người lớn` : null, draft.children !== '0' ? `${draft.children} trẻ em` : null, draft.viewCode !== 'NONE' ? selectedView?.label : null].filter(Boolean).join(' · ') || 'Chọn hạng, hướng nhìn và giường'}</Text>
      <Text style={styles.muted}>Mã: {code || '—'} · {draft.quantity || '—'} phòng cùng hạng</Text>
      <Text style={styles.price}>{draft.price ? `${money(price)} ₫ / đêm` : 'Chưa có giá cơ bản'}</Text>
    </InfoCard>
    <Text style={styles.label}>Hạng phòng *</Text>
    <OwnerButton label={selectedClass?.label ?? (room ? `Cấu hình cũ: ${room.name}` : 'Chọn hạng phòng')} secondary onPress={() => setSheet({ kind: 'class' })} />
    <Text style={styles.label}>Hướng nhìn</Text>
    <OwnerButton label={selectedView?.label ?? 'Chọn hướng nhìn'} secondary onPress={() => setSheet({ kind: 'view' })} />
    <WizardField label="Tên hiển thị" value={name} onChange={(value) => change({ name: value, ownName: true })} placeholder="Tên hạng phòng" />
    <WizardField label="Mã loại phòng" value={code} onChange={(value) => change({ code: value.toUpperCase(), ownCode: true })} placeholder="DLX-SEA-KING" />
    <Text style={styles.muted}>Mã gợi ý được server kiểm tra trùng trong chỗ ở này trước khi lưu.</Text>
    <Text style={styles.label}>Cấu hình giường *</Text>
    {draft.beds.map((bed, index) => <View key={index} style={styles.bedRow}>
      <View style={styles.bedChoice}><OwnerButton label={catalog.data.beds.find((item) => item.code === bed.bedType)?.label ?? 'Chọn giường'} secondary onPress={() => setSheet({ kind: 'bed', index })} /></View>
      <TextInput accessibilityLabel={`Số lượng giường ${index + 1}`} keyboardType="number-pad" value={String(bed.quantity || '')} onChangeText={(value) => { const beds = [...draft.beds]; beds[index] = { ...bed, quantity: Number(value) }; change({ beds }); }} style={styles.bedCount} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Xóa giường ${index + 1}`} onPress={() => change({ beds: draft.beds.filter((_, i) => i !== index) })} style={styles.remove}><Text style={styles.removeText}>×</Text></Pressable>
    </View>)}
    {room && !draft.beds.length ? <WizardField label="Thông tin giường cũ" value={draft.legacyBed} onChange={(value) => change({ legacyBed: value })} /> : null}
    <OwnerButton label="+ Thêm loại giường" secondary onPress={() => change({ beds: [...draft.beds, { bedType: 'SINGLE', quantity: 1 }] })} />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bedPresets}>{BED_PRESETS.map((preset) => <Pressable key={preset.label} accessibilityRole="button" onPress={() => change({ beds: preset.beds.map((item) => ({ ...item })) })} style={styles.chip}><Text style={styles.chipText}>{preset.label}</Text></Pressable>)}</ScrollView>
    <WizardField label="Diện tích (m²)" value={draft.area} onChange={(value) => change({ area: value })} keyboardType="decimal-pad" placeholder="Ví dụ: 32" />
    <Text style={styles.label}>Tiện ích trong phòng</Text>
    {amenities.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {amenities.isError ? <Text style={styles.error}>Không tải được danh mục tiện ích.</Text> : null}
    <View style={styles.chips}>{amenities.data?.map((item) => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: draft.amenities.includes(item.id) }} onPress={() => change({ amenities: draft.amenities.includes(item.id) ? draft.amenities.filter((id) => id !== item.id) : [...draft.amenities, item.id] })} style={[styles.chip, draft.amenities.includes(item.id) && styles.chipActive]}>
      <Text style={[styles.chipText, draft.amenities.includes(item.id) && styles.chipTextActive]}>{item.name}</Text>
    </Pressable>)}</View>
    {draft.amenities.filter((id) => !amenities.data?.some((item) => item.id === id)).map((id) => <Text key={id} style={styles.muted}>Tiện ích cũ: {id}</Text>)}
    <WizardField label="Số khách người lớn" value={draft.adults} onChange={(value) => change({ adults: value })} keyboardType="decimal-pad" />
    <Chips values={['1', '2', '3', '4', '6', '12']} value={draft.adults} change={(value) => change({ adults: value })} />
    <WizardField label="Số trẻ em" value={draft.children} onChange={(value) => change({ children: value })} keyboardType="decimal-pad" />
    <Chips values={['0', '1', '2', '4', '10']} value={draft.children} change={(value) => change({ children: value })} />
    <WizardField label="Tổng số phòng cùng hạng" value={draft.quantity} onChange={(value) => change({ quantity: value })} keyboardType="decimal-pad" />
    <Chips values={['1', '2', '5', '10', '20']} value={draft.quantity} change={(value) => change({ quantity: value })} />
    <WizardField label="Giá cơ bản (VND / đêm)" value={draft.price} onChange={(value) => change({ price: value })} keyboardType="decimal-pad" placeholder="Ví dụ: 1450000" />
    <Chips values={['300000', '500000', '750000', '1000000', '1450000', '2000000', '3000000', '5000000', '10000000']} value={draft.price} change={(value) => change({ price: value })} format={(value) => `${money(Number(value))} ₫`} />
    <Text style={styles.label}>Ảnh của hạng phòng</Text>
    {!roomId ? <Text style={styles.muted}>Lưu hạng phòng trước, sau đó mở Sửa để thêm ảnh. Ảnh phòng không vào gallery chỗ ở.</Text> : null}
    {roomId && media.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {roomId && media.isError ? <WizardNotice title="Không tải được ảnh phòng" body="Thử tải lại ảnh của hạng phòng." error actionLabel="Tải lại" onAction={() => void media.refetch()} /> : null}
    {roomId && media.data ? <HotelGallery images={media.data} onExpired={() => void media.refetch()} /> : null}
    {roomId && media.data?.map((item) => <View key={item.id} style={styles.imageRow}>
      <Image source={{ uri: absoluteMediaUrl(item.url) }} style={styles.imageThumb} resizeMode="cover" />
      {mediaEditable ? <View style={styles.imageAction}><OwnerButton label="Xóa ảnh" secondary disabled={uploading} onPress={() => void removeImage(item.id)} /></View> : null}
    </View>)}
    {roomId && mediaEditable ? <OwnerButton label={uploading ? 'Đang tải ảnh...' : 'Thêm ảnh phòng'} secondary disabled={uploading} onPress={() => void chooseImage()} /> : null}
    {uploadProgress !== null ? <Text style={styles.muted}>Đang tải ảnh phòng: {uploadProgress}%</Text> : null}
    {failedAsset ? <WizardNotice title="Ảnh tải lỗi" body="Ảnh chưa được lưu. Thử tải lại hoặc bỏ ảnh lỗi." actionLabel="Thử tải lại" onAction={() => void upload(failedAsset)} /> : null}
    {failedAsset ? <OwnerButton label="Bỏ ảnh lỗi" secondary onPress={() => { setFailedAsset(null); setUploadProgress(null); }} /> : null}
    {pendingMedia ? <WizardNotice title="Ảnh chưa xác nhận" body="Ảnh đã tải lên nhưng cần xác nhận để xuất hiện trong hạng phòng." actionLabel="Xác nhận lại ảnh" onAction={() => void finalizeAgain()} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Options title={sheet?.kind === 'class' ? 'Chọn hạng phòng' : sheet?.kind === 'view' ? 'Chọn hướng nhìn' : 'Chọn loại giường'} items={options} visible={Boolean(sheet)} close={() => setSheet(null)} select={choose} />
    <Modal transparent visible={confirmLeave} animationType="fade" onRequestClose={() => setConfirmLeave(false)}><View style={styles.backdrop}><InfoCard style={styles.confirm}><Text style={styles.title}>Bỏ thay đổi chưa lưu?</Text><Text style={styles.muted}>Các thay đổi trong form chưa được lưu lên server.</Text><OwnerButton label="Tiếp tục chỉnh sửa" secondary onPress={() => setConfirmLeave(false)} /><OwnerButton label="Bỏ thay đổi" danger onPress={() => { setConfirmLeave(false); router.replace(destination()); }} /></InfoCard></View></Modal>
  </OwnerScaffold>;
}

const styles = StyleSheet.create({
  title: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  label: { color: ownerColors.text, fontSize: 14, fontWeight: '600' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  text: { color: ownerColors.text, fontSize: 15 },
  error: { color: ownerColors.danger, fontSize: 13 },
  preview: { gap: 8, borderWidth: 1, borderColor: ownerColors.border, borderRadius: 16 },
  previewTitle: { color: ownerColors.text, fontSize: 18, fontWeight: '700' },
  price: { color: ownerColors.primaryDark, fontSize: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bedPresets: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: ownerColors.surface, borderWidth: 1, borderColor: ownerColors.border, borderRadius: 12 },
  chipActive: { backgroundColor: ownerColors.primarySoft, borderColor: ownerColors.primary },
  chipText: { color: ownerColors.text, fontSize: 13 },
  chipTextActive: { color: ownerColors.primaryDark, fontWeight: '700' },
  bedRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bedChoice: { flex: 1, minWidth: 0 },
  bedCount: { width: 54, height: 44, borderWidth: 1, borderColor: ownerColors.border, borderRadius: 10, backgroundColor: ownerColors.surface, textAlign: 'center' },
  remove: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: ownerColors.danger, fontSize: 26 },
  imageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  imageThumb: { width: 90, height: 70, borderRadius: 8, backgroundColor: ownerColors.primarySoft },
  imageAction: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#11182799' },
  sheet: { maxHeight: '86%', gap: 12, backgroundColor: ownerColors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  input: { minHeight: 48, borderWidth: 1, borderColor: ownerColors.border, borderRadius: 12, paddingHorizontal: 12, color: ownerColors.text },
  group: { color: ownerColors.muted, fontWeight: '700', marginTop: 12 },
  option: { minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: ownerColors.border },
  confirm: { margin: 16, gap: 12 },
});

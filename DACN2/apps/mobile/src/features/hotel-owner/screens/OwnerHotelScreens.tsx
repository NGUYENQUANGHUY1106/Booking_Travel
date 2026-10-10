import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldCard, HotelCard, InfoCard, OwnerButton, OwnerScaffold, SectionTitle, StatusPanel } from '../components';
import { hotel, ownerProfile } from '../mocks';
import { ownerScreenHref, ownerTabHref } from '../navigation';
import { ownerColors } from '../styles/tokens';
import type { HotelStatus, OwnerScreenId } from '../types';

export function OwnerHotelsScreen() {
  return (
    <OwnerScaffold overline="" title="Khách sạn của tôi">
      <View style={styles.toolbar}>
        <Text style={styles.toolbarText}>1 chỗ ở</Text>
        <Pressable onPress={() => router.push(ownerScreenHref('hotel-basic'))}>
          <Text style={styles.addLink}>＋ Thêm chỗ ở</Text>
        </Pressable>
      </View>
      <HotelCard />
      <InfoCard>
        <Text style={styles.cardTitle}>● Đã xuất bản</Text>
        <Text style={styles.muted}>Khách sạn đang hiển thị và sẵn sàng nhận booking.</Text>
      </InfoCard>
    </OwnerScaffold>
  );
}

const statusContent: Record<HotelStatus, { title: string; heading: string; body: string; tone: 'blue' | 'yellow' | 'red'; action: string }> = {
  draft: { title: 'Khách sạn bản nháp', heading: 'Bản nháp', body: 'Thông tin đang được lưu tự động. Chưa hiển thị cho khách.', tone: 'blue', action: 'Tiếp tục chỉnh sửa' },
  pending: { title: 'Khách sạn chờ duyệt', heading: 'Chờ Admin duyệt', body: `${hotel.name} đã gửi. Chưa thể xuất bản trước khi phê duyệt.`, tone: 'yellow', action: 'Xem hồ sơ đã gửi' },
  approved: { title: 'Khách sạn đã duyệt', heading: 'Đã xuất bản', body: 'Khách sạn hiển thị trên kết quả tìm kiếm khi có phòng và giá hợp lệ.', tone: 'blue', action: 'Quản lý phòng' },
  rejected: { title: 'Khách sạn cần chỉnh sửa', heading: 'Bị từ chối', body: 'Lý do: ảnh bìa và giấy tờ sở hữu chưa đủ rõ. Chỉnh sửa rồi gửi duyệt lại.', tone: 'red', action: 'Chỉnh sửa hồ sơ' },
  suspended: { title: 'Khách sạn tạm đình chỉ', heading: 'Đình chỉ', body: 'Quyết định và lý do từ Admin được hiển thị. Không thể nhận booking mới.', tone: 'red', action: 'Xem thông báo' },
};

export function HotelStatusScreen({ status }: { status: HotelStatus }) {
  const item = statusContent[status];
  return (
    <OwnerScaffold
      footer={<OwnerButton label={item.action} onPress={() => router.push(ownerScreenHref('hotel-basic'))} />}
      title={item.title}
    >
      <StatusPanel body={item.body} title={item.heading} tone={item.tone} />
      <HotelCard pressable={false} />
      <InfoCard>
        <Text style={styles.muted}>Chỉ khách sạn thuộc quyền sở hữu của {ownerProfile.name}.</Text>
      </InfoCard>
    </OwnerScaffold>
  );
}

export function OwnerEmptyScreen() {
  return (
    <OwnerScaffold
      footer={<OwnerButton label="Tạo khách sạn" onPress={() => router.push(ownerScreenHref('hotel-basic'))} />}
      overline=""
      title=""
    >
      <View style={styles.empty}>
        <View style={styles.emptyIcon}><Text style={styles.emptyIconText}>⌕</Text></View>
        <Text style={styles.emptyTitle}>Bạn chưa có khách sạn nào</Text>
        <Text style={styles.emptyBody}>Hoàn tất xác minh trước khi đăng khách sạn đầu tiên.</Text>
      </View>
    </OwnerScaffold>
  );
}

export function HotelDetailScreen() {
  return (
    <OwnerScaffold
      footer={<OwnerButton label="Quản lý phòng" onPress={() => router.push(ownerScreenHref('rooms'))} />}
      title="Chi tiết chỗ ở"
    >
      <HotelCard pressable={false} />
      <InfoCard>
        <SectionTitle>Vận hành khách sạn</SectionTitle>
        <View style={styles.detailRow}><Text style={styles.muted}>Trạng thái</Text><Text style={styles.success}>● Đã xuất bản</Text></View>
        <View style={styles.detailRow}><Text style={styles.muted}>Hạng phòng</Text><Text style={styles.value}>1</Text></View>
        <View style={styles.detailRow}><Text style={styles.muted}>Phòng đang bán</Text><Text style={styles.value}>26</Text></View>
      </InfoCard>
      <Pressable onPress={() => router.push(ownerScreenHref('hotel-basic'))} style={styles.linkCard}>
        <Text style={styles.linkTitle}>Chỉnh sửa thông tin</Text><Text style={styles.chevron}>›</Text>
      </Pressable>
      <Pressable onPress={() => router.push(ownerTabHref('availability'))} style={styles.linkCard}>
        <Text style={styles.linkTitle}>Lịch phòng trống</Text><Text style={styles.chevron}>›</Text>
      </Pressable>
    </OwnerScaffold>
  );
}

const hotelTypes = [
  ['▥', 'Khách sạn'], ['♨', 'Resort'], ['▦', 'Căn hộ'], ['⌂', 'Villa'], ['⌾', 'Homestay'], ['▤', 'Hostel'],
] as const;

const wizard: Partial<Record<OwnerScreenId, { step: number; title: string; subtitle: string; next?: OwnerScreenId }>> = {
  'hotel-location': { step: 2, title: 'Tạo khách sạn · vị trí', subtitle: 'Địa chỉ', next: 'hotel-media' },
  'hotel-media': { step: 3, title: 'Tạo khách sạn · hình ảnh', subtitle: 'Hình ảnh', next: 'hotel-amenities' },
  'hotel-amenities': { step: 4, title: 'Tạo khách sạn · tiện ích', subtitle: 'Tiện ích và chính sách', next: 'hotel-review' },
  'hotel-review': { step: 5, title: 'Kiểm tra và gửi duyệt', subtitle: 'Kiểm tra thông tin' },
};

export function HotelBasicScreen() {
  const [selectedType, setSelectedType] = useState('Khách sạn');
  const [showError, setShowError] = useState(false);
  const submit = () => {
    if (!selectedType) return setShowError(true);
    router.push(ownerScreenHref('hotel-location'));
  };
  return (
    <OwnerScaffold footer={<OwnerButton disabled={!selectedType} label="Lưu & tiếp tục" onPress={submit} />} title="Tạo chỗ ở · cơ bản">
      <InfoCard><Text style={styles.step}>Bước 1 / 5</Text><Text style={styles.muted}>Tên chỗ ở</Text></InfoCard>
      <FieldCard label="Tên chỗ ở" value={hotel.name} />
      <View style={[styles.typeGroup, showError && styles.typeGroupError]}>
        <Text style={styles.label}>Loại chỗ ở *</Text>
        <Text style={styles.muted}>Chọn loại hình phù hợp nhất với cơ sở của bạn.</Text>
        <View style={styles.typeGrid}>
          {hotelTypes.map(([icon, label]) => {
            const active = selectedType === label;
            return (
              <Pressable key={label} onPress={() => { setSelectedType(label); setShowError(false); }} style={[styles.typeItem, active && styles.typeItemActive]}>
                <Text style={[styles.typeIcon, active && styles.typeActiveText]}>{icon}</Text>
                <Text style={[styles.typeLabel, active && styles.typeActiveText]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {showError ? <Text style={styles.error}>Vui lòng chọn loại chỗ ở.</Text> : null}
      </View>
      <FieldCard label="Mô tả" value={hotel.description} />
      <InfoCard><Text style={styles.cardTitle}>Lưu tự động</Text><Text style={styles.muted}>Bản nháp được lưu trước khi gửi duyệt.</Text></InfoCard>
    </OwnerScaffold>
  );
}

export function HotelWizardScreen({ id }: { id: OwnerScreenId }) {
  const config = wizard[id];
  if (!config) return null;
  const review = id === 'hotel-review';
  const body = id === 'hotel-location'
    ? <><FieldCard label="Địa chỉ" value="38 Võ Nguyên Giáp, Sơn Trà, Đà Nẵng" /><FieldCard label="Mô tả" value="Khách sạn gần biển Mỹ Khê, phù hợp cặp đôi" /></>
    : id === 'hotel-media'
      ? <><FieldCard label="Hình ảnh" value="Ảnh bìa · sảnh · phòng · tiện ích" /><FieldCard label="Mô tả" value="Khách sạn gần biển Mỹ Khê, phù hợp cặp đôi" /></>
      : id === 'hotel-amenities'
        ? <FieldCard label="Tiện ích và chính sách" value="Hồ bơi · Bữa sáng · Wi-Fi · Hủy miễn phí" />
        : <><FieldCard label="Kiểm tra thông tin" hint="Chờ Admin duyệt trước khi xuất bản." value={hotel.name} /><View><Text style={styles.label}>Loại chỗ ở</Text><View style={styles.chip}><Text style={styles.chipText}>Khách sạn</Text></View></View><FieldCard label="Mô tả" value={hotel.description} /></>;
  return (
    <OwnerScaffold
      footer={<OwnerButton label={review ? 'Gửi duyệt' : 'Lưu & tiếp tục'} onPress={() => router.push(ownerScreenHref(review ? 'hotel-pending' : config.next ?? 'hotel-review'))} />}
      title={config.title}
    >
      <InfoCard><Text style={styles.step}>Bước {config.step} / 5</Text><Text style={styles.muted}>{config.subtitle}</Text></InfoCard>
      {body}
      <InfoCard><Text style={styles.cardTitle}>Lưu tự động</Text><Text style={styles.muted}>Bản nháp được lưu trước khi gửi duyệt.</Text></InfoCard>
    </OwnerScaffold>
  );
}

function RoomSummary() {
  return (
    <InfoCard style={styles.roomCard}>
      <Text style={styles.roomName}>Deluxe Sea View</Text>
      <Text style={styles.muted}>32 m² · 1 giường đôi · 2 khách · Hướng biển</Text>
      <Text style={styles.roomMeta}>✓ Bữa sáng · Hủy miễn phí trước 18:00, 10/10</Text>
      <Text style={styles.roomPrice}>1.450.000 ₫ / đêm</Text>
      <Text style={styles.warning}>Còn 3 phòng</Text>
    </InfoCard>
  );
}

export function RoomScreen({ edit = false }: { edit?: boolean }) {
  return (
    <OwnerScaffold footer={<OwnerButton label="Lưu phòng" />} title={edit ? 'Tạo hoặc sửa phòng' : 'Hạng phòng'}>
      <RoomSummary />
      <FieldCard label="Tên hạng phòng" value="Deluxe Sea View" />
      <FieldCard label="Giá cơ bản" value="1.450.000 ₫ / đêm" />
    </OwnerScaffold>
  );
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toolbarText: { color: ownerColors.muted, fontSize: 14 },
  addLink: { color: ownerColors.primary, fontSize: 14, fontWeight: '700' },
  cardTitle: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  success: { color: ownerColors.success, fontSize: 14, fontWeight: '700' },
  value: { color: ownerColors.text, fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, minHeight: 520, justifyContent: 'center', gap: 14 },
  emptyIcon: { width: 96, height: 96, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderRadius: 48, backgroundColor: '#DBEAFE' },
  emptyIconText: { color: ownerColors.primaryDark, fontSize: 36 },
  emptyTitle: { color: ownerColors.text, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  emptyBody: { color: ownerColors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  linkCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 14 },
  linkTitle: { color: ownerColors.text, fontSize: 15, fontWeight: '600' },
  chevron: { color: ownerColors.muted, fontSize: 24 },
  step: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  typeGroup: { gap: 6 },
  typeGroupError: { borderWidth: 1, borderColor: ownerColors.danger, borderRadius: 12, padding: 8 },
  label: { color: ownerColors.muted, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeItem: { minWidth: 0, flexBasis: '47%', flexGrow: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, backgroundColor: '#FFFFFF', gap: 4 },
  typeItemActive: { borderColor: ownerColors.primary, backgroundColor: ownerColors.primarySoft },
  typeIcon: { color: '#5B708D', fontSize: 25 },
  typeLabel: { color: ownerColors.text, fontSize: 14, fontWeight: '700' },
  typeActiveText: { color: ownerColors.primary },
  error: { color: ownerColors.danger, fontSize: 12 },
  chip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 20, backgroundColor: ownerColors.primarySoft, paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { color: ownerColors.primary, fontSize: 12, fontWeight: '700' },
  roomCard: { borderWidth: 1, borderColor: '#D1D5DB', padding: 16, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  roomName: { color: ownerColors.text, fontSize: 18, fontWeight: '700' },
  roomMeta: { color: ownerColors.success, fontSize: 12, lineHeight: 18 },
  roomPrice: { color: ownerColors.primaryDark, fontSize: 19, fontWeight: '700' },
  warning: { color: ownerColors.warning, fontSize: 12 },
});

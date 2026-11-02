import { Asset } from 'expo-asset';
import { router } from 'expo-router';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SvgUri } from 'react-native-svg';
import { useQueryClient } from '@tanstack/react-query';

import { FieldCard, InfoCard, OwnerButton, OwnerScaffold, StatusPanel } from '../components/owner-ui';
import { ownerScreenHref } from '../navigation/routes';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';
import { absoluteMediaUrl, ownerHotelApi, ownerHotelKey, ownerHotelListKey, useOwnerHotel, useOwnerHotels, type AccommodationType, type OwnerHotelProfile } from './api';
import { useHotelBasicDraft } from './use-hotel-basic-draft';
import { HotelGallery } from './HotelGallery';

const hotelTypes: { value: AccommodationType; label: string; icon: number; activeIcon: number }[] = [
  { value: 'HOTEL', label: 'Khách sạn', icon: require('../assets/accommodation/74d8e.svg'), activeIcon: require('../assets/accommodation/e5e2d.svg') },
  { value: 'RESORT', label: 'Resort', icon: require('../assets/accommodation/0e966.svg'), activeIcon: require('../assets/accommodation/e8b0c.svg') },
  { value: 'APARTMENT', label: 'Căn hộ', icon: require('../assets/accommodation/cf9b6.svg'), activeIcon: require('../assets/accommodation/7eded.svg') },
  { value: 'VILLA', label: 'Villa', icon: require('../assets/accommodation/e55c6.svg'), activeIcon: require('../assets/accommodation/9212b.svg') },
  { value: 'HOMESTAY', label: 'Homestay', icon: require('../assets/accommodation/845f2.svg'), activeIcon: require('../assets/accommodation/be45c.svg') },
  { value: 'HOSTEL', label: 'Hostel', icon: require('../assets/accommodation/b1b25.svg'), activeIcon: require('../assets/accommodation/abced.svg') },
];

const statusText: Record<OwnerHotelProfile['status'], string> = {
  DRAFT: 'Bản nháp', PENDING: 'Đang chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Cần chỉnh sửa', SUSPENDED: 'Tạm đình chỉ',
};

function useOwnerSession() {
  const session = useTravelerStore((state) => state.session);
  return session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session : undefined;
}

function ErrorPanel({ message, retry }: { message: string; retry?: () => void }) {
  return <InfoCard><Text style={styles.errorTitle}>{message}</Text>{retry ? <OwnerButton label="Thử lại" secondary onPress={retry} /> : null}</InfoCard>;
}

function HotelPreview({ hotel, onPress, onImageError }: { hotel: OwnerHotelProfile; onPress?: () => void; onImageError?: () => void }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [retried, setRetried] = useState(false);
  const location = [hotel.addressLine, hotel.ward, hotel.district, hotel.province].filter(Boolean).join(', ');
  const content = <>
      {hotel.coverImageUrl && failedUrl !== hotel.coverImageUrl ? <Image source={{ uri: absoluteMediaUrl(hotel.coverImageUrl) }} style={styles.cover} resizeMode="cover" onError={() => { setFailedUrl(hotel.coverImageUrl); if (!retried) { setRetried(true); onImageError?.(); } }} /> :
        <View style={styles.coverEmpty}><Text style={styles.coverEmptyText}>{hotel.coverImageUrl ? 'Không tải được ảnh bìa' : 'Chưa có ảnh bìa'}</Text></View>}
      <View style={styles.hotelBody}>
        <Text style={styles.hotelName} numberOfLines={2}>{hotel.name}</Text>
        <Text style={styles.muted}>{location || 'Chưa có địa chỉ'}</Text>
        {hotel.status === 'DRAFT' || hotel.status === 'REJECTED' ? <Text style={styles.progress}>{Object.values(hotel.completion).filter(Boolean).length}/6 mục hồ sơ đã có thông tin</Text> : <Text style={styles.muted}>{hotel.roomCount} hạng phòng</Text>}
        {onPress ? <Text style={styles.link}>Xem chi tiết  ›</Text> : null}
      </View>
    </>;
  if (!onPress) return <View style={styles.hotelCard}>{content}</View>;
  return <Pressable accessibilityLabel={`Xem ${hotel.name}`} accessibilityRole="button" onPress={onPress} style={styles.hotelCard}>{content}</Pressable>;
}

export function OwnerHotelsScreen() {
  const session = useOwnerSession();
  const hotels = useOwnerHotels(session?.userId);
  return (
    <OwnerScaffold title="Chỗ ở của tôi" testID="OWN-UI-06" onRefresh={session ? () => void hotels.refetch() : undefined} refreshing={hotels.isRefetching}>
      {!session ? <ErrorPanel message="Đăng nhập bằng tài khoản Chủ khách sạn đã xác minh để xem chỗ ở." /> : <>
        {hotels.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
        {hotels.isError ? <ErrorPanel message="Không tải được danh sách chỗ ở." retry={() => void hotels.refetch()} /> : null}
        {hotels.data?.length === 0 ? <InfoCard><Text style={styles.title}>Bạn chưa có chỗ ở nào</Text><Text style={styles.muted}>Tạo hồ sơ bản nháp để bắt đầu.</Text></InfoCard> : null}
        {hotels.data?.map((hotel) => <View key={hotel.id} style={styles.hotelGroup}>
          <HotelPreview hotel={hotel} onPress={() => router.push(ownerScreenHref('hotel-detail', hotel.id))} onImageError={() => void hotels.refetch()} />
          {hotel.status === 'DRAFT' || hotel.status === 'REJECTED' ? <OwnerButton label="Tiếp tục chỉnh sửa" secondary onPress={() => router.push(ownerScreenHref('hotel-basic', hotel.id))} /> : null}
          <View style={styles.visibilityRow}><Text style={hotel.status === 'APPROVED' ? styles.visibleStatus : styles.pending}>{statusText[hotel.status]}</Text><Text style={styles.typeChip}>{hotelTypes.find((item) => item.value === hotel.accommodationType)?.label ?? 'Chưa xác định'}</Text></View>
          <InfoCard><Text style={styles.title}>Tình trạng hiển thị</Text><Text style={styles.muted}>{hotel.status === 'APPROVED' ? 'Chỗ ở đã được duyệt. Khả năng xuất hiện trong tìm kiếm phụ thuộc phòng và điều kiện khách chọn.' : hotel.status === 'DRAFT' ? 'Bản nháp chỉ bạn quản lý, chưa hiển thị cho khách.' : hotel.status === 'PENDING' ? 'Đang chờ xét duyệt, chưa hiển thị cho khách.' : hotel.status === 'REJECTED' ? 'Cần chỉnh sửa hồ sơ trước khi gửi duyệt lại.' : 'Chỗ ở đang tạm đình chỉ và không hiển thị cho khách.'}</Text></InfoCard>
        </View>)}
        {hotels.data ? <OwnerButton label="Tạo chỗ ở" onPress={() => router.push(ownerScreenHref('hotel-basic'))} /> : null}
      </>}
    </OwnerScaffold>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.back}><Text style={styles.backText}>‹  Quay lại</Text></Pressable>;
}

export function HotelDetailScreen({ hotelId }: { hotelId?: string }) {
  const session = useOwnerSession();
  const queryClient = useQueryClient();
  const profile = useOwnerHotel(session?.userId, hotelId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const hotel = profile.data;
  const editable = hotel?.status === 'DRAFT' || hotel?.status === 'REJECTED';
  const remove = async () => {
    if (!hotel || !session) return;
    setDeleting(true);
    setDeleteError(undefined);
    try {
      await ownerHotelApi.removeDraft(hotel.id);
      await queryClient.invalidateQueries({ queryKey: ownerHotelListKey(session.userId) });
      queryClient.removeQueries({ queryKey: ownerHotelKey(session.userId, hotel.id) });
      setConfirmDelete(false);
      router.replace('/hotel-owner/hotels');
    } catch (error) {
      setDeleteError(isAxiosError(error) && error.response?.status === 409 ? 'Bản nháp đã có booking hoặc trạng thái đã thay đổi.' : 'Không xóa được bản nháp. Vui lòng thử lại.');
    } finally { setDeleting(false); }
  };

  return (
    <OwnerScaffold title="Chi tiết chỗ ở" testID="OWN-UI-07" footer={<OwnerButton label="Quay lại màn hình chính" secondary onPress={() => router.replace('/hotel-owner')} />}>
      {!session || !hotelId ? <ErrorPanel message="Chọn chỗ ở từ danh sách của bạn để xem hồ sơ." /> : null}
      {profile.isPending && hotelId ? <ActivityIndicator color={ownerColors.primary} /> : null}
      {profile.isError ? <ErrorPanel message="Không thể tải hồ sơ chỗ ở này." retry={() => void profile.refetch()} /> : null}
      {hotel ? <>
        <HotelPreview hotel={hotel} onImageError={() => void profile.refetch()} />
        <HotelGallery images={hotel.gallery} onExpired={() => void profile.refetch()} />
        <View style={styles.visibilityRow}><Text style={hotel.status === 'APPROVED' ? styles.visibleStatus : hotel.status === 'REJECTED' || hotel.status === 'SUSPENDED' ? styles.blockedStatus : styles.pending}>● {statusText[hotel.status]}</Text><Text style={styles.typeChip}>{hotelTypes.find((item) => item.value === hotel.accommodationType)?.label ?? 'Chưa xác định'}</Text></View>
        <InfoCard><Text style={styles.title}>Vận hành khách sạn</Text><Text style={styles.muted}>{hotel.status === 'APPROVED' ? `Đã duyệt · ${hotel.roomCount} hạng phòng. Khả năng nhận booking phụ thuộc phòng và giá đang mở bán.` : hotel.status === 'DRAFT' ? 'Bản nháp chưa hiển thị cho khách. Hoàn thiện hồ sơ trước khi gửi duyệt.' : hotel.status === 'REJECTED' ? 'Hồ sơ cần chỉnh sửa trước khi gửi duyệt lại.' : hotel.status === 'PENDING' ? 'Hồ sơ đang chờ duyệt và chưa hiển thị cho khách.' : 'Chỗ ở đang tạm đình chỉ; quyền chỉnh sửa bị giới hạn.'}</Text></InfoCard>
        <OwnerButton label="Xem và quản lý hạng phòng" secondary onPress={() => router.push(ownerScreenHref('rooms', hotel.id))} />
        <InfoCard><Text style={styles.title}>Tiến độ hồ sơ</Text>
          {([
            ['Cơ bản', hotel.completion.basic], ['Liên hệ và giờ nhận/trả', hotel.completion.contact],
            ['Vị trí', hotel.completion.location], ['Ảnh bìa', hotel.completion.media],
            ['Chính sách', hotel.completion.policy], ['Hạng phòng', hotel.completion.rooms],
          ] as [string, boolean][]).map(([label, done]) => <View key={label} style={styles.checkRow}><Text style={styles.muted}>{label}</Text><Text style={done ? styles.done : styles.pending}>{done ? 'Đã có' : 'Còn thiếu'}</Text></View>)}
        </InfoCard>
        {editable ? <>
          <OwnerButton label="Tiếp tục hoàn thiện hồ sơ" onPress={() => router.push(ownerScreenHref('hotel-basic', hotel.id))} />
          <Pressable accessibilityRole="button" onPress={() => router.push(ownerScreenHref('hotel-basic', hotel.id))} style={styles.linkCard}><Text style={styles.linkCardText}>Chỉnh sửa thông tin cơ bản</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push(ownerScreenHref('hotel-location', hotel.id))} style={styles.linkCard}><Text style={styles.linkCardText}>Vị trí chỗ ở</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push(ownerScreenHref('hotel-media', hotel.id))} style={styles.linkCard}><Text style={styles.linkCardText}>Hình ảnh</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push(ownerScreenHref('hotel-amenities', hotel.id))} style={styles.linkCard}><Text style={styles.linkCardText}>Liên hệ, giờ nhận/trả & chính sách</Text><Text style={styles.chevron}>›</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push(ownerScreenHref('hotel-review', hotel.id))} style={styles.linkCard}><Text style={styles.linkCardText}>Kiểm tra và gửi duyệt</Text><Text style={styles.chevron}>›</Text></Pressable>
          {hotel.status === 'DRAFT' && hotel.bookingCount === 0 ? <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={styles.deleteLink}><Text style={styles.deleteText}>Xóa bản nháp</Text></Pressable> : null}
        </> : null}
        {!hotel.readyForReview ? <InfoCard><Text style={styles.muted}>Còn thiếu mục hồ sơ. Mở Kiểm tra và gửi duyệt để xem mục cần bổ sung.</Text></InfoCard> : null}
      </> : null}
      <Modal animationType="fade" transparent visible={confirmDelete} onRequestClose={() => setConfirmDelete(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <Text style={styles.title}>Xóa bản nháp?</Text><Text style={styles.muted}>Hồ sơ này sẽ không còn trong danh sách của bạn.</Text>
          {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
          <OwnerButton disabled={deleting} danger label={deleting ? 'Đang xóa...' : 'Xóa bản nháp'} onPress={() => void remove()} />
          <OwnerButton disabled={deleting} secondary label="Giữ lại" onPress={() => setConfirmDelete(false)} />
        </View></View>
      </Modal>
    </OwnerScaffold>
  );
}

export function HotelBasicScreen({ hotelId }: { hotelId?: string }) {
  const session = useOwnerSession();
  const draft = useHotelBasicDraft(session?.userId, session?.sessionId, hotelId);
  const [showErrors, setShowErrors] = useState(false);
  const nameValid = draft.fields.name.trim().length >= 2 && draft.fields.name.trim().length <= 160;
  const descriptionValid = draft.fields.description.length <= 3000;
  const editable = draft.status !== 'forbidden' && (!draft.hotelStatus || draft.hotelStatus === 'DRAFT' || draft.hotelStatus === 'REJECTED');
  const continueToDetail = async () => {
    setShowErrors(true);
    if (!nameValid || !draft.fields.accommodationType || !descriptionValid) return;
    const saved = await draft.flush();
    if (saved) router.replace(ownerScreenHref('hotel-location', saved.id));
  };
  const leaveBasic = async () => {
    if (nameValid && draft.fields.accommodationType && descriptionValid && draft.status !== 'saved') {
      const saved = await draft.flush();
      if (!saved) return;
    }
    router.replace('/hotel-owner/hotels');
  };
  return (
    <OwnerScaffold title={hotelId ? 'Chỉnh sửa chỗ ở · cơ bản' : 'Tạo chỗ ở · cơ bản'} testID="OWN-UI-08" footer={session && editable ? <OwnerButton label={draft.status === 'saving' ? 'Đang lưu...' : 'Lưu & tiếp tục'} disabled={!draft.ready || draft.status === 'saving' || !nameValid || !descriptionValid || draft.status === 'conflict' || draft.status === 'forbidden' || (showErrors && !draft.fields.accommodationType)} onPress={() => void continueToDetail()} /> : undefined}>
      <BackLink onPress={() => void leaveBasic()} />
      {!session ? <ErrorPanel message="Đăng nhập bằng tài khoản Chủ khách sạn đã xác minh để tạo chỗ ở." /> : null}
      {session && !draft.ready ? <ActivityIndicator color={ownerColors.primary} /> : null}
      {session && draft.ready ? <>
        <InfoCard style={styles.stepCard}><Text style={styles.step}>Bước 1 / 5</Text><Text style={styles.muted}>Tên chỗ ở</Text></InfoCard>
        {!editable ? <StatusPanel title={draft.status === 'forbidden' ? 'Không có quyền truy cập' : statusText[draft.hotelStatus!]} body={draft.status === 'forbidden' ? 'Hồ sơ đã bị xóa hoặc quyền sở hữu đã thay đổi.' : 'Trạng thái này hiện chưa cho phép chỉnh sửa hồ sơ.'} tone="yellow" /> : null}
        <FieldCard compact label="Tên chỗ ở *" value={draft.fields.name} placeholder="Nhập tên chỗ ở" hint="Chạm để chỉnh sửa" onChangeText={editable ? (value) => draft.updateField('name', value) : undefined} onBlur={() => setShowErrors(true)} />
        {showErrors && !nameValid ? <Text style={styles.error}>Tên chỗ ở cần từ 2 đến 160 ký tự.</Text> : null}
        <View style={[styles.typeGroup, showErrors && !draft.fields.accommodationType && styles.typeGroupError]}>
          <Text style={styles.fieldLabel}>Loại chỗ ở *</Text><Text style={styles.muted}>Chọn loại hình phù hợp nhất với cơ sở của bạn.</Text>
          <View style={styles.typeGrid}>{hotelTypes.map((item) => {
            const selected = draft.fields.accommodationType === item.value;
            return <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ selected, disabled: !editable }} accessibilityLabel={item.label} disabled={!editable} onPress={() => draft.updateField('accommodationType', item.value)} style={[styles.typeTile, selected && styles.typeTileSelected]}>
              <SvgUri width={28} height={28} uri={Asset.fromModule(selected ? item.activeIcon : item.icon).uri} />
              <Text style={[styles.typeLabel, selected && styles.typeLabelSelected]}>{item.label}</Text>
            </Pressable>;
          })}</View>
          {showErrors && !draft.fields.accommodationType ? <Text style={styles.error}>Vui lòng chọn loại chỗ ở.</Text> : null}
        </View>
        <FieldCard compact label="Mô tả" value={draft.fields.description} placeholder="Mô tả điểm nổi bật của chỗ ở" multiline hint="Chạm để chỉnh sửa" onChangeText={editable ? (value) => draft.updateField('description', value) : undefined} />
        {!descriptionValid ? <Text style={styles.error}>Mô tả tối đa 3000 ký tự.</Text> : null}
        <View style={styles.saveCard}><Text style={styles.saveTitle}>Lưu tự động</Text><Text style={styles.muted}>{draft.status === 'saved' ? 'Đã lưu bản nháp.' : draft.status === 'saving' ? 'Đang lưu bản nháp...' : draft.status === 'error' || draft.status === 'conflict' || draft.status === 'forbidden' ? draft.errorText : 'Thay đổi chưa được lưu lên máy chủ.'}</Text>
          {draft.status === 'error' ? <OwnerButton secondary label="Thử lưu lại" onPress={() => void draft.flush()} /> : null}
          {draft.status === 'conflict' ? <OwnerButton secondary label="Tải lại hồ sơ" onPress={() => void draft.reload()} /> : null}
        </View>
      </> : null}
    </OwnerScaffold>
  );
}

type ContactPolicyFields = { contactEmail: string; contactPhone: string; checkInTime: string; checkOutTime: string; cancellationPolicy: string; houseRules: string };

export function HotelContactPolicyScreen({ hotelId }: { hotelId?: string }) {
  const session = useOwnerSession();
  const profile = useOwnerHotel(session?.userId, hotelId);
  if (!profile.data || !session) {
    return <OwnerScaffold title="Liên hệ & chính sách"><BackLink onPress={() => router.back()} />
      {!hotelId || !session ? <ErrorPanel message="Chọn chỗ ở từ danh sách để chỉnh sửa." /> : null}
      {profile.isPending && session ? <ActivityIndicator color={ownerColors.primary} /> : null}
      {profile.isError ? <ErrorPanel message="Không tải được hồ sơ." retry={() => void profile.refetch()} /> : null}
    </OwnerScaffold>;
  }
  return <ContactPolicyForm key={`${profile.data.id}:${profile.data.profileVersion}`} profile={profile.data} userId={session.userId} onReload={() => void profile.refetch()} />;
}

function ContactPolicyForm({ profile, userId, onReload }: { profile: OwnerHotelProfile; userId: string; onReload: () => void }) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<ContactPolicyFields>(() => ({ contactEmail: profile.contactEmail ?? '', contactPhone: profile.contactPhone ?? '', checkInTime: profile.checkInTime ?? '', checkOutTime: profile.checkOutTime ?? '', cancellationPolicy: profile.policy?.cancellationPolicy ?? '', houseRules: profile.policy?.houseRules ?? '' }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [conflict, setConflict] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const set = (key: keyof ContactPolicyFields, value: string) => { setFields((previous) => ({ ...previous, [key]: value })); setMessage('Thay đổi chưa được lưu lên máy chủ.'); };
  const validTime = (value: string) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const save = async () => {
    if (saving || forbidden) return;
    if (fields.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.contactEmail.trim())) return setMessage('Email liên hệ không hợp lệ.');
    if (fields.contactPhone && !/^\+?[0-9 .()-]{7,25}$/.test(fields.contactPhone.trim())) return setMessage('Số điện thoại liên hệ không hợp lệ.');
    if (!validTime(fields.checkInTime) || !validTime(fields.checkOutTime)) return setMessage('Giờ nhận/trả phòng cần theo định dạng HH:mm.');
    if (fields.cancellationPolicy.length > 3000 || fields.houseRules.length > 3000) return setMessage('Mỗi chính sách tối đa 3000 ký tự.');
    setSaving(true); setMessage(undefined);
    try {
      const saved = await ownerHotelApi.updateProfile(profile.id, profile.profileVersion, {
        contactEmail: fields.contactEmail.trim() || null, contactPhone: fields.contactPhone.trim() || null,
        checkInTime: fields.checkInTime || null, checkOutTime: fields.checkOutTime || null,
        policy: { cancellationPolicy: fields.cancellationPolicy.trim() || null, houseRules: fields.houseRules.trim() || null },
      });
      queryClient.setQueryData(ownerHotelKey(userId, saved.id), saved);
      await queryClient.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
      router.replace(ownerScreenHref('hotel-detail', saved.id));
    } catch (error) {
      const stale = isAxiosError(error) && error.response?.status === 409;
      const revoked = isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0);
      setConflict(stale);
      setForbidden(revoked);
      if (revoked) setFields({ contactEmail: '', contactPhone: '', checkInTime: '', checkOutTime: '', cancellationPolicy: '', houseRules: '' });
      setMessage(revoked ? 'Không còn quyền truy cập hồ sơ này.' : stale ? 'Hồ sơ đã thay đổi ở nơi khác. Tải lại trước khi sửa tiếp.' : 'Chưa lưu được. Kiểm tra mạng rồi thử lại.');
    } finally { setSaving(false); }
  };
  const editable = profile.status === 'DRAFT' || profile.status === 'REJECTED';
  return (
    <OwnerScaffold title="Liên hệ & chính sách" footer={editable ? <OwnerButton disabled={saving || conflict || forbidden} label={saving ? 'Đang lưu...' : 'Lưu thông tin'} onPress={() => void save()} /> : undefined}>
      <BackLink onPress={() => router.back()} />
      {!editable ? <StatusPanel title={statusText[profile.status]} body="Trạng thái này hiện chưa cho phép chỉnh sửa hồ sơ." tone="yellow" /> : null}
      {editable && !forbidden ? <>
        <InfoCard><Text style={styles.step}>Thông tin liên hệ</Text><Text style={styles.muted}>Cung cấp ít nhất một kênh liên hệ và giờ nhận/trả phòng.</Text></InfoCard>
        <EditField disabled={forbidden} label="Email liên hệ" value={fields.contactEmail} onChange={(value) => set('contactEmail', value)} placeholder="name@example.com" />
        <EditField disabled={forbidden} label="Số điện thoại" value={fields.contactPhone} onChange={(value) => set('contactPhone', value)} placeholder="+84..." />
        <EditField disabled={forbidden} label="Giờ nhận phòng (HH:mm)" value={fields.checkInTime} onChange={(value) => set('checkInTime', value)} placeholder="14:00" />
        <EditField disabled={forbidden} label="Giờ trả phòng (HH:mm)" value={fields.checkOutTime} onChange={(value) => set('checkOutTime', value)} placeholder="12:00" />
        <InfoCard><Text style={styles.step}>Chính sách chỗ ở</Text><Text style={styles.muted}>Thông tin này cần chính xác trước khi gửi duyệt.</Text></InfoCard>
        <EditField disabled={forbidden} label="Chính sách hủy" value={fields.cancellationPolicy} onChange={(value) => set('cancellationPolicy', value)} multiline placeholder="Nhập điều kiện hủy" />
        <EditField disabled={forbidden} label="Nội quy" value={fields.houseRules} onChange={(value) => set('houseRules', value)} multiline placeholder="Nhập nội quy chỗ ở" />
        {message ? <InfoCard><Text style={conflict ? styles.error : styles.muted}>{message}</Text>{conflict ? <OwnerButton secondary label="Tải lại hồ sơ" onPress={onReload} /> : null}</InfoCard> : null}
      </> : forbidden ? <ErrorPanel message="Không còn quyền truy cập hồ sơ này." /> : null}
    </OwnerScaffold>
  );
}

function EditField({ label, value, onChange, placeholder, multiline = false, disabled = false }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean; disabled?: boolean }) {
  return <View style={styles.editField}><Text style={styles.fieldLabel}>{label}</Text><TextInput accessibilityLabel={label} editable={!disabled} onChangeText={onChange} value={value} placeholder={placeholder} placeholderTextColor={ownerColors.muted} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

export function HotelUnavailableStep({ hotelId }: { hotelId?: string }) {
  return <OwnerScaffold title="Hoàn thiện hồ sơ"><BackLink onPress={() => router.back()} /><InfoCard><Text style={styles.title}>Mục này chưa khả dụng</Text><Text style={styles.muted}>Vị trí, ảnh và gửi duyệt cần được triển khai cùng quy trình riêng. Hồ sơ hiện tại vẫn là bản nháp.</Text><OwnerButton label="Xem hồ sơ" onPress={() => router.replace(hotelId ? ownerScreenHref('hotel-detail', hotelId) : '/hotel-owner/hotels')} /></InfoCard></OwnerScaffold>;
}

const styles = StyleSheet.create({
  hotelGroup: { gap: 12 },
  visibilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 8, minHeight: 40 },
  visibleStatus: { color: ownerColors.success, fontSize: 13, fontWeight: '700' },
  blockedStatus: { color: ownerColors.danger, fontSize: 13, fontWeight: '700' },
  typeChip: { borderRadius: 16, borderWidth: 1, borderColor: '#BFDBFE', color: ownerColors.primaryDark, backgroundColor: ownerColors.primarySoft, fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 5 },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  title: { color: ownerColors.text, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  step: { color: ownerColors.text, fontSize: 16, fontWeight: '600', lineHeight: 24 },
  stepCard: { paddingVertical: 10, gap: 4 },
  hotelCard: { borderRadius: 14, backgroundColor: ownerColors.surface, overflow: 'hidden', borderWidth: 1, borderColor: ownerColors.border },
  cover: { width: '100%', aspectRatio: 340 / 228 },
  coverEmpty: { width: '100%', aspectRatio: 340 / 228, alignItems: 'center', justifyContent: 'center', backgroundColor: ownerColors.primarySoft },
  coverEmptyText: { color: ownerColors.primaryDark, fontWeight: '600' },
  hotelBody: { padding: 14, gap: 7 },
  hotelName: { flex: 1, color: ownerColors.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  progress: { color: ownerColors.warning, fontSize: 12, fontWeight: '600' },
  link: { color: ownerColors.primary, fontSize: 14, fontWeight: '700' },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: ownerColors.primaryDark, fontSize: 14, fontWeight: '600' },
  checkRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  done: { color: ownerColors.success, fontSize: 14, fontWeight: '600' },
  pending: { color: ownerColors.warning, fontSize: 14, fontWeight: '600' },
  linkCard: { minHeight: 56, borderRadius: 12, backgroundColor: ownerColors.surface, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkCardText: { color: ownerColors.text, fontSize: 15, fontWeight: '600', flex: 1 },
  chevron: { color: ownerColors.muted, fontSize: 26 },
  deleteLink: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  deleteText: { color: ownerColors.danger, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: 'rgba(17,24,39,0.5)' },
  modalCard: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: ownerColors.surface, borderRadius: 16, padding: 20, gap: 14 },
  errorTitle: { color: ownerColors.danger, fontSize: 15, lineHeight: 21 },
  error: { color: ownerColors.danger, fontSize: 13, lineHeight: 18 },
  typeGroup: { gap: 8 },
  typeGroupError: { borderWidth: 1, borderColor: ownerColors.danger, borderRadius: 12, padding: 8 },
  fieldLabel: { color: ownerColors.text, fontSize: 14, fontWeight: '600' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 4 },
  typeTile: { flexBasis: '47%', flexGrow: 1, minHeight: 70, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: ownerColors.border, backgroundColor: ownerColors.surface },
  typeTileSelected: { borderColor: ownerColors.primary, backgroundColor: ownerColors.primarySoft },
  typeLabel: { color: ownerColors.text, fontSize: 13, fontWeight: '600' },
  typeLabelSelected: { color: ownerColors.primaryDark },
  saveCard: { backgroundColor: ownerColors.surface, borderRadius: 12, padding: 14, gap: 6 },
  saveTitle: { color: ownerColors.primaryDark, fontSize: 14, fontWeight: '700' },
  editField: { gap: 8 },
  input: { minHeight: 50, borderRadius: 12, backgroundColor: ownerColors.surface, paddingHorizontal: 14, paddingVertical: 10, color: ownerColors.text, fontSize: 15 },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
});

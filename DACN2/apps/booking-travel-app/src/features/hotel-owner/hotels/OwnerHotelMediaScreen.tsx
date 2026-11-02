import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { InfoCard, OwnerButton, OwnerScaffold } from '../components/owner-ui';
import { ownerScreenHref } from '../navigation/routes';
import { ownerColors } from '../styles/tokens';
import { useTravelerStore } from '@/features/traveler/store';
import { absoluteMediaUrl, ownerHotelApi, ownerHotelKey, ownerHotelListKey, useOwnerHotel, type OwnerHotelProfile } from './api';
import { HotelGallery } from './HotelGallery';
import { leaveWizard, WizardNotice, WizardStep } from './wizard-ui';

export function OwnerHotelMediaScreen({ hotelId }: { hotelId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session.userId : undefined;
  const profile = useOwnerHotel(userId, hotelId);
  if (!hotelId || !userId) return <OwnerScaffold title="Tạo chỗ ở · hình ảnh" testID="OWN-UI-10"><WizardNotice title="Chưa chọn chỗ ở" body="Mở bản nháp từ Chỗ ở của tôi." actionLabel="Chỗ ở của tôi" onAction={leaveWizard} /></OwnerScaffold>;
  if (profile.isPending) return <OwnerScaffold title="Tạo chỗ ở · hình ảnh" testID="OWN-UI-10"><ActivityIndicator color={ownerColors.primary} /></OwnerScaffold>;
  if (!profile.data) return <OwnerScaffold title="Tạo chỗ ở · hình ảnh" testID="OWN-UI-10"><WizardNotice title="Không tải được hồ sơ" body="Kiểm tra mạng hoặc quyền truy cập rồi thử lại." error actionLabel="Thử lại" onAction={() => void profile.refetch()} /></OwnerScaffold>;
  return <MediaForm hotel={profile.data} userId={userId} refresh={() => void profile.refetch()} />;
}

function MediaForm({ hotel, userId, refresh }: { hotel: OwnerHotelProfile; userId: string; refresh: () => void }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [failedAsset, setFailedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pendingFinalize, setPendingFinalize] = useState<string | null>(null);
  const editable = hotel.status === 'DRAFT' || hotel.status === 'REJECTED';
  const ordered = [...hotel.gallery].sort((a, b) => a.sortOrder - b.sortOrder);
  const sync = async (saved: OwnerHotelProfile) => {
    client.setQueryData(ownerHotelKey(userId, hotel.id), saved);
    await client.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
  };
  const message = (cause: unknown) => isAxiosError(cause) && cause.response?.status === 409 ? 'Hồ sơ đã đổi. Tải lại trước khi sửa ảnh.' : isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0) ? 'Bạn không còn quyền sửa ảnh của chỗ ở này.' : cause instanceof Error ? cause.message : 'Không lưu được ảnh. Kiểm tra mạng rồi thử lại.';

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    if (busy || !editable) return;
    setBusy(true); setProgress(0); setError(''); setFailedAsset(null); setPendingFinalize(null);
    let mediaId: string | null = null;
    let uploaded = false;
    try {
      const saved = await ownerHotelApi.uploadImage(hotel.id, asset, setProgress, (id) => { mediaId = id; }, () => { uploaded = true; });
      await sync(saved);
      setProgress(null);
    } catch (cause) {
      setError(message(cause));
      if (uploaded && mediaId) setPendingFinalize(mediaId);
      else setFailedAsset(asset);
    } finally { setBusy(false); }
  };
  const choose = async () => {
    const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: false, quality: 1 });
    if (!selected.canceled && selected.assets[0]) await upload(selected.assets[0]);
  };
  const finalizeAgain = async () => {
    if (!pendingFinalize || busy) return;
    setBusy(true); setError('');
    try { await sync(await ownerHotelApi.finalizeImage(hotel.id, pendingFinalize)); setPendingFinalize(null); setProgress(null); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  };
  const change = async (action: () => Promise<OwnerHotelProfile>) => {
    if (busy || !editable) return;
    setBusy(true); setError('');
    try { await sync(await action()); }
    catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  };
  const move = (index: number, direction: -1 | 1) => {
    const next = [...ordered];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    void change(() => ownerHotelApi.reorderImages(hotel.id, hotel.profileVersion, next.map((item) => item.id)));
  };
  const next = () => {
    if (busy || failedAsset || pendingFinalize) return setError('Hãy tải lại hoặc bỏ ảnh lỗi trước khi tiếp tục.');
    router.replace(ownerScreenHref('hotel-amenities', hotel.id));
  };
  const leave = (target: 'back' | 'exit') => {
    if (busy || pendingFinalize || failedAsset) return setError('Hãy xử lý ảnh đang tải hoặc ảnh lỗi trước khi rời bước này.');
    if (target === 'exit') leaveWizard();
    else router.replace(ownerScreenHref('hotel-location', hotel.id));
  };

  return <WizardStep title="Tạo chỗ ở · hình ảnh" number={3} subtitle="Hình ảnh" testID="OWN-UI-10" onBack={() => leave('back')} onExit={() => leave('exit')} onNext={next} busy={busy} disabled={!editable}>
    {!editable ? <WizardNotice title="Chỉ xem" body="Trạng thái này chưa cho sửa ảnh." /> : null}
    <InfoCard><Text style={styles.title}>Ảnh chỗ ở</Text><Text style={styles.muted}>Chọn ảnh JPG, PNG hoặc WebP tối đa 10 MB. Ảnh đầu tiên được chọn làm bìa; bạn có thể đổi bên dưới.</Text></InfoCard>
    {editable ? <OwnerButton label="Thêm ảnh từ thư viện" secondary disabled={busy} onPress={() => void choose()} /> : null}
    {progress !== null ? <Text style={styles.muted}>Đang tải ảnh: {progress}%</Text> : null}
    {pendingFinalize ? <WizardNotice title="Ảnh đã tải, chưa xác nhận" body="Kết nối bị ngắt sau khi tải ảnh. Xác nhận lại để ảnh xuất hiện trong hồ sơ." actionLabel="Xác nhận lại ảnh" onAction={() => void finalizeAgain()} /> : null}
    {pendingFinalize ? <OwnerButton label="Bỏ ảnh chưa xác nhận" secondary onPress={() => { setPendingFinalize(null); setProgress(null); setError(''); }} /> : null}
    {failedAsset ? <WizardNotice title="Ảnh tải lỗi" body="Ảnh này chưa có trong hồ sơ. Bạn có thể tải lại hoặc bỏ qua." actionLabel="Thử tải lại" onAction={() => void upload(failedAsset)} /> : null}
    {failedAsset ? <OwnerButton label="Bỏ ảnh lỗi" secondary onPress={() => { setFailedAsset(null); setProgress(null); setError(''); }} /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <HotelGallery images={ordered} onExpired={refresh} />
    {editable ? ordered.map((image, index) => <View key={image.id} style={styles.row}>
      <Image source={{ uri: absoluteMediaUrl(image.url) }} style={styles.thumb} resizeMode="cover" onError={refresh} />
      <View style={styles.rowActions}>
        <Text style={styles.muted}>Ảnh {index + 1}{image.isCover ? ' · Ảnh bìa' : ''}</Text>
        <View style={styles.buttons}>
          {!image.isCover ? <Pressable accessibilityRole="button" onPress={() => void change(() => ownerHotelApi.coverImage(hotel.id, hotel.profileVersion, image.id))}><Text style={styles.link}>Đặt bìa</Text></Pressable> : null}
          {index > 0 ? <Pressable accessibilityRole="button" onPress={() => move(index, -1)}><Text style={styles.link}>↑</Text></Pressable> : null}
          {index < ordered.length - 1 ? <Pressable accessibilityRole="button" onPress={() => move(index, 1)}><Text style={styles.link}>↓</Text></Pressable> : null}
          <Pressable accessibilityRole="button" onPress={() => void change(() => ownerHotelApi.removeImage(hotel.id, hotel.profileVersion, image.id))}><Text style={styles.delete}>Xóa</Text></Pressable>
        </View>
      </View>
    </View>) : null}
    {!hotel.completion.media ? <WizardNotice title="Còn thiếu ảnh bìa" body="Bạn có thể lưu nháp và tiếp tục, nhưng cần ảnh bìa trước khi gửi duyệt." /> : null}
  </WizardStep>;
}

const styles = StyleSheet.create({
  title: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: ownerColors.danger, fontSize: 13 },
  row: { flexDirection: 'row', gap: 10, padding: 10, backgroundColor: ownerColors.surface, borderRadius: 12 },
  thumb: { width: 78, height: 78, borderRadius: 8 },
  rowActions: { flex: 1, justifyContent: 'space-between' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  link: { color: ownerColors.primaryDark, fontWeight: '700', minHeight: 30 },
  delete: { color: ownerColors.danger, fontWeight: '700', minHeight: 30 },
});

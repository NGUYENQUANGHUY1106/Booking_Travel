import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

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
  return <MediaForm key={`${userId}:${profile.data.id}`} hotel={profile.data} userId={userId} refresh={() => void profile.refetch()} />;
}

function MediaForm({ hotel, userId, refresh }: { hotel: OwnerHotelProfile; userId: string; refresh: () => void }) {
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [failedAssets, setFailedAssets] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [pendingFinalizations, setPendingFinalizations] = useState<string[]>([]);
  const [batchLabel, setBatchLabel] = useState('');
  const editable = hotel.status === 'DRAFT' || hotel.status === 'REJECTED';
  const ordered = [...hotel.gallery].sort((a, b) => a.sortOrder - b.sortOrder);
  const sync = async (saved: OwnerHotelProfile) => {
    client.setQueryData(ownerHotelKey(userId, hotel.id), saved);
    await client.invalidateQueries({ queryKey: ownerHotelListKey(userId) });
  };
  const message = (cause: unknown) => isAxiosError(cause) && cause.response?.status === 409 ? 'Hồ sơ đã đổi. Tải lại trước khi sửa ảnh.' : isAxiosError(cause) && [401, 403, 404].includes(cause.response?.status ?? 0) ? 'Bạn không còn quyền sửa ảnh của chỗ ở này.' : cause instanceof Error ? cause.message : 'Không lưu được ảnh. Kiểm tra mạng rồi thử lại.';

  const upload = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!editable) return;
    setBusy(true); setProgress(0); setError('');
    let mediaId: string | null = null;
    let uploaded = false;
    try {
      const saved = await ownerHotelApi.uploadImage(hotel.id, asset, setProgress, (id) => { mediaId = id; }, () => { uploaded = true; });
      await sync(saved);
      setFailedAssets((items) => items.filter((item) => item.uri !== asset.uri));
      setProgress(null);
    } catch (cause) {
      setError(message(cause));
      if (uploaded && mediaId) setPendingFinalizations((items) => items.includes(mediaId!) ? items : [...items, mediaId!]);
      else setFailedAssets((items) => items.some((item) => item.uri === asset.uri) ? items : [...items, asset]);
    } finally { setBusy(false); }
  };
  const choose = async () => {
    if (busy) return;
    const selected = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 1 });
    if (selected.canceled) return;
    for (const [index, asset] of selected.assets.entries()) {
      setBatchLabel(`Ảnh ${index + 1}/${selected.assets.length}`);
      await upload(asset);
    }
    setBatchLabel('');
  };
  const camera = async () => {
    if (busy) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Chưa được cấp quyền camera. Bạn có thể chọn ảnh từ thư viện.'); return; }
    const selected = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 });
    if (!selected.canceled && selected.assets[0]) await upload(selected.assets[0]);
  };
  const finalizeAgain = async (mediaId: string) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await sync(await ownerHotelApi.finalizeImage(hotel.id, mediaId)); setPendingFinalizations((items) => items.filter((id) => id !== mediaId)); setProgress(null); }
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
    if (busy || failedAssets.length || pendingFinalizations.length) return setError('Hãy tải lại hoặc bỏ ảnh lỗi trước khi tiếp tục.');
    router.replace(ownerScreenHref('hotel-amenities', hotel.id));
  };
  const leave = (target: 'back' | 'exit') => {
    if (busy || pendingFinalizations.length || failedAssets.length) return setError('Hãy xử lý ảnh đang tải hoặc ảnh lỗi trước khi rời bước này.');
    if (target === 'exit') leaveWizard();
    else router.replace(ownerScreenHref('hotel-location', hotel.id));
  };

  return <WizardStep title="Tạo chỗ ở · hình ảnh" number={3} subtitle="Hình ảnh" testID="OWN-UI-10" onBack={() => leave('back')} onExit={() => leave('exit')} onNext={next} busy={busy} disabled={!editable}>
    {!editable ? <WizardNotice title="Chỉ xem" body="Trạng thái này chưa cho sửa ảnh." /> : null}
    <InfoCard><Text style={styles.title}>Ảnh chỗ ở</Text><Text style={styles.muted}>Chọn ảnh JPG, PNG hoặc WebP tối đa 10 MB. Ảnh đầu tiên được chọn làm bìa; bạn có thể đổi bên dưới.</Text></InfoCard>
    {editable ? <OwnerButton label="Thêm ảnh từ thư viện" secondary disabled={busy} onPress={() => void choose()} /> : null}
    {editable && Platform.OS !== 'web' ? <OwnerButton label="Chụp ảnh bằng camera" secondary disabled={busy} onPress={() => void camera()} /> : null}
    {progress !== null ? <Text style={styles.muted}>Đang tải {batchLabel || 'ảnh'}: {progress}%</Text> : null}
    {pendingFinalizations.map((id) => <View key={id} style={styles.retryGroup}><WizardNotice title="Ảnh đã tải, chưa xác nhận" body="Kết nối bị ngắt sau khi tải ảnh. Xác nhận lại để ảnh xuất hiện trong hồ sơ." actionLabel="Xác nhận lại ảnh" onAction={() => void finalizeAgain(id)} /><OwnerButton label="Bỏ ảnh chưa xác nhận" secondary onPress={() => { setPendingFinalizations((items) => items.filter((item) => item !== id)); setProgress(null); setError(''); }} /></View>)}
    {failedAssets.map((asset, index) => <View key={asset.uri} style={styles.retryGroup}><WizardNotice title={`Ảnh ${index + 1} tải lỗi`} body="Ảnh này chưa có trong hồ sơ. Bạn có thể tải lại hoặc bỏ qua." actionLabel="Thử tải lại" onAction={() => void upload(asset)} /><OwnerButton label="Bỏ ảnh lỗi" secondary onPress={() => { setFailedAssets((items) => items.filter((item) => item.uri !== asset.uri)); setProgress(null); setError(''); }} /></View>)}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {ordered.length === 0 && hotel.coverImageUrl ? <InfoCard><Text style={styles.title}>Ảnh bìa đã được Admin duyệt</Text><Image source={{ uri: hotel.coverImageUrl }} accessibilityLabel="Ảnh bìa khách sạn đã duyệt" style={{ width: '100%', height: 180, borderRadius: 10 }} resizeMode="cover" /><Text style={styles.muted}>Bạn có thể bổ sung thêm ảnh khách sạn trước khi đăng tin.</Text></InfoCard> : null}
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
  retryGroup: { gap: 8 },
  thumb: { width: 78, height: 78, borderRadius: 8 },
  rowActions: { flex: 1, justifyContent: 'space-between' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  link: { color: ownerColors.primaryDark, fontWeight: '700', minHeight: 30 },
  delete: { color: ownerColors.danger, fontWeight: '700', minHeight: 30 },
});

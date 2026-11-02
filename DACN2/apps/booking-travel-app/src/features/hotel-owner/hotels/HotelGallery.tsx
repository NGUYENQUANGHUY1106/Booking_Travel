import { useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { OwnerButton } from '../components/owner-ui';
import { ownerColors } from '../styles/tokens';
import { absoluteMediaUrl, type HotelImage } from './api';

export function HotelGallery({ images, onExpired }: { images: HotelImage[]; onExpired: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const retried = useRef(false);
  const refreshOnce = () => { if (!retried.current) { retried.current = true; onExpired(); } };
  const ordered = [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  const active = selected === null ? null : ordered[selected];

  return <>
    {ordered.length === 0 ? <View style={styles.empty}><Text style={styles.muted}>Chưa có ảnh đã lưu.</Text></View> : <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {ordered.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Xem ảnh ${index + 1}/${ordered.length}${item.isCover ? ', ảnh bìa' : ''}`} onPress={() => setSelected(index)} style={styles.thumbWrap}>
          <Image source={{ uri: absoluteMediaUrl(item.url) }} style={styles.thumb} resizeMode="cover" onError={refreshOnce} />
          {item.isCover ? <Text style={styles.coverBadge}>Ảnh bìa</Text> : null}
        </Pressable>)}
      </ScrollView>
      <OwnerButton label={`Xem tất cả ${ordered.length} ảnh`} secondary onPress={() => setSelected(0)} />
    </>}
    <Modal visible={active !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      <View style={styles.viewer}>
        <Text style={styles.counter}>{active ? `Ảnh ${(selected ?? 0) + 1}/${ordered.length}${active.isCover ? ' · Ảnh bìa' : ''}` : ''}</Text>
        {active ? <Image source={{ uri: absoluteMediaUrl(active.url) }} style={styles.full} resizeMode="contain" onError={refreshOnce} /> : null}
        <View style={styles.viewerActions}>
          <View style={styles.viewerAction}><OwnerButton label="‹ Trước" secondary disabled={selected === 0} onPress={() => setSelected(Math.max(0, (selected ?? 0) - 1))} /></View>
          <View style={styles.viewerAction}><OwnerButton label="Sau ›" secondary disabled={selected === ordered.length - 1} onPress={() => setSelected(Math.min(ordered.length - 1, (selected ?? 0) + 1))} /></View>
        </View>
        <OwnerButton label="Đóng" onPress={() => setSelected(null)} />
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  empty: { minHeight: 96, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: ownerColors.surface },
  muted: { color: ownerColors.muted, fontSize: 14 },
  rail: { gap: 10, paddingVertical: 4 },
  thumbWrap: { width: 112, gap: 4 },
  thumb: { width: 112, height: 84, borderRadius: 10, backgroundColor: ownerColors.primarySoft },
  coverBadge: { color: ownerColors.primaryDark, fontSize: 12, fontWeight: '700' },
  viewer: { flex: 1, backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 36, justifyContent: 'center', gap: 16 },
  full: { width: '100%', height: '65%' },
  counter: { color: '#FFFFFF', textAlign: 'center', fontSize: 16, fontWeight: '700' },
  viewerActions: { flexDirection: 'row', gap: 12 },
  viewerAction: { flex: 1, minWidth: 0 },
});

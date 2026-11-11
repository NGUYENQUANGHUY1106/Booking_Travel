import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { InfoCard, OwnerButton, OwnerScaffold, SectionTitle, StatusPanel } from '../components';
import { ownerColors } from '../styles/tokens';
import type { OwnerScreenId } from '../types';
import { ownerScreenHref, ownerTabHref } from '../navigation';
import { OwnerInventoryScreen } from './OwnerInventoryScreen';
import { OwnerPricingScreen } from './OwnerPricingScreen';

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function OwnerCalendarScreen({ pricing = false }: { pricing?: boolean }) {
  return pricing ? <OwnerPricingScreen /> : <OwnerInventoryScreen />;
}

export function AvailabilityStateScreen({ blocked = false }: { blocked?: boolean }) {
  return (
    <OwnerScaffold
      footer={<OwnerButton label={blocked ? 'Cập nhật lý do' : 'Xem booking'} onPress={() => router.push(ownerScreenHref(blocked ? 'block-room' : 'booking-detail'))} />}
      title={blocked ? 'Lịch phòng bị chặn' : 'Lịch phòng đã đặt'}
    >
      <StatusPanel
        body={blocked ? 'Phòng 304 · 17–18/10 · bảo trì. Chỉ chủ khách sạn có quyền bỏ chặn.' : 'Deluxe Sea View · 12–15/10 · booking BT-2027-DN-00128. Không mở bán trùng tồn phòng.'}
        title={blocked ? 'Đã chặn' : 'Đã đặt'}
        tone={blocked ? 'yellow' : 'blue'}
      />
      <InfoCard><View style={styles.weekRow}>{weekdays.map((item) => <Text key={item} style={styles.weekday}>{item}</Text>)}</View></InfoCard>
      <View style={styles.stateDay}><Text style={styles.dayNumber}>12</Text><Text style={blocked ? styles.blocked : styles.booked}>{blocked ? 'Bị chặn · bảo trì' : 'Đã đặt · 12–15/10'}</Text></View>
    </OwnerScaffold>
  );
}

export function BlockRoomScreen() {
  return (
    <OwnerScaffold footer={<OwnerButton label="Chặn phòng" onPress={() => router.replace(ownerScreenHref('availability-blocked'))} />} title="Chặn phòng">
      <InfoCard><SectionTitle>Tháng 10 / 2026</SectionTitle><Text style={styles.muted}>T2　 T3　 T4　 T5　 T6　 T7　 CN</Text></InfoCard>
      <View style={styles.dateRow}><InfoCard style={styles.dateCard}><Text style={styles.dayNumber}>12</Text></InfoCard><InfoCard style={styles.dateCard}><Text style={styles.dayNumber}>15</Text></InfoCard></View>
      <InfoCard><SectionTitle>12–15/10</SectionTitle><Text style={styles.muted}>Deluxe Sea View · 3 phòng còn trống · 1.450.000 ₫</Text></InfoCard>
    </OwnerScaffold>
  );
}

export function PricingAiScreen() {
  return <OwnerScaffold title="Gợi ý giá AI"><StatusPanel title="Chưa khả dụng" body="Chưa có dịch vụ gợi ý giá AI từ dữ liệu thực. Bạn có thể cập nhật giá thủ công trên Lịch giá phòng." tone="blue" /><OwnerButton label="Về lịch giá phòng" onPress={() => router.replace(ownerTabHref('pricing'))} /></OwnerScaffold>;
}

export function PromotionScreen() {
  return <OwnerScaffold title="Ưu đãi"><StatusPanel title="Chưa khả dụng" body="Quản lý ưu đãi sẽ được triển khai ở OWN-10." tone="blue" /><OwnerButton label="Về lịch giá phòng" onPress={() => router.replace(ownerTabHref('pricing'))} /></OwnerScaffold>;
}
export function CalendarRouter({ id }: { id: OwnerScreenId }) {
  if (id === 'availability') return <OwnerInventoryScreen />;
  if (id === 'availability-booked') return <OwnerInventoryScreen variant="booked" />;
  if (id === 'availability-blocked') return <OwnerInventoryScreen variant="blocked" />;
  if (id === 'block-room') return <OwnerInventoryScreen variant="block" />;
  if (id === 'pricing') return <OwnerCalendarScreen pricing />;
  if (id === 'pricing-ai') return <PricingAiScreen />;
  if (id === 'pricing-ai-confirm') return <PricingAiScreen />;
  if (id === 'promotions') return <PromotionScreen />;
  if (id === 'promotion-edit') return <PromotionScreen />;
  return null;
}

const styles = StyleSheet.create({
  monthRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { color: ownerColors.modernPrimary, fontSize: 30 },
  month: { color: ownerColors.textModern, fontSize: 20, fontWeight: '700' },
  selector: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D5E1EF', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12 },
  selectorText: { color: ownerColors.textModern, fontSize: 14 },
  muted: { color: ownerColors.mutedModern, fontSize: 14, lineHeight: 20 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  weekday: { width: '13.2%', color: ownerColors.mutedModern, fontSize: 12, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dayCell: { width: '13.2%', aspectRatio: 0.98, justifyContent: 'space-between', borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 8, backgroundColor: '#FFFFFF', padding: 7 },
  blankCell: { borderColor: 'transparent', backgroundColor: 'transparent' },
  peakCell: { backgroundColor: '#EBF5FF' },
  dayCellActive: { borderWidth: 2, borderColor: ownerColors.modernPrimary, backgroundColor: '#E3F0FF' },
  dayNumber: { color: ownerColors.textModern, fontSize: 16, fontWeight: '700' },
  dayActiveText: { color: ownerColors.modernPrimary },
  dayMark: { width: 16, height: 3, borderRadius: 2, backgroundColor: '#147A4F' },
  dayMarkBlue: { backgroundColor: ownerColors.modernPrimary },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: ownerColors.mutedModern, fontSize: 11 },
  summary: { backgroundColor: '#F2F7FF', borderRadius: 16, padding: 16 },
  twoButtons: { flexDirection: 'row', gap: 8 },
  buttonGrow: { flex: 1 },
  stateDay: { width: 128, minHeight: 80, borderWidth: 1, borderColor: '#D7E2EF', borderRadius: 12, backgroundColor: '#FFFFFF', padding: 14, gap: 10 },
  booked: { color: '#0879B9', fontSize: 12 },
  blocked: { color: ownerColors.warning, fontSize: 12 },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateCard: { flex: 1, borderWidth: 1, borderColor: '#D7E2EF' },
  priceCard: { flex: 1, backgroundColor: '#F2F7FF' },
  aiPriceCard: { backgroundColor: '#F0F0FF' },
  kicker: { color: ownerColors.mutedModern, fontSize: 11, fontWeight: '700' },
  price: { color: ownerColors.textModern, fontSize: 20, fontWeight: '800' },
  aiPrice: { color: '#6138B2', fontSize: 20, fontWeight: '800', lineHeight: 28 },
  aiReason: { borderRadius: 14, backgroundColor: '#F0F0FF', padding: 16, gap: 8 },
  metric: { flexDirection: 'row', justifyContent: 'space-between' },
  metricValue: { color: ownerColors.textModern, fontSize: 14, fontWeight: '700' },
  success: { color: '#147A4F' },
  decision: { color: ownerColors.textModern, fontSize: 14, fontWeight: '700', marginTop: 8 },
  small: { color: ownerColors.mutedModern, fontSize: 12, lineHeight: 17 },
});

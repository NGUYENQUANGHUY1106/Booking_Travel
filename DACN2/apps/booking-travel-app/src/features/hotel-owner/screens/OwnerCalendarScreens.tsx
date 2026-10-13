import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldCard, InfoCard, OwnerButton, OwnerScaffold, SectionTitle, StatusPanel } from '../components';
import { ownerColors } from '../styles/tokens';
import type { OwnerScreenId } from '../types';
import { ownerScreenHref, ownerTabHref } from '../navigation';

const days = Array.from({ length: 31 }, (_, index) => index + 1);
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function OwnerCalendarScreen({ pricing = false }: { pricing?: boolean }) {
  const [selected, setSelected] = useState<number[]>([12, 13, 14, 15]);
  const cells = useMemo(() => [null, null, null, ...days], []);
  const toggle = (day: number) => setSelected((current) => current.includes(day) ? current.filter((item) => item !== day) : [...current, day]);

  return (
    <OwnerScaffold overline="" title={pricing ? 'Lịch giá phòng' : 'Lịch phòng trống'}>
      <View style={styles.monthRow}><Text style={styles.arrow}>‹</Text><Text style={styles.month}>Tháng 10, 2026</Text><Text style={styles.arrow}>›</Text></View>
      <Pressable style={styles.selector}><Text style={styles.selectorText}>Deluxe Sea View · 26 phòng</Text><Text style={styles.muted}>⌄</Text></Pressable>
      <View style={styles.weekRow}>{weekdays.map((item) => <Text key={item} style={styles.weekday}>{item}</Text>)}</View>
      <View style={styles.grid}>
        {cells.map((day, index) => {
          const active = day ? selected.includes(day) : false;
          const peak = day ? [4, 5, 10, 11, 17, 18, 24, 25].includes(day) : false;
          return (
            <Pressable
              key={`${day ?? 'blank'}-${index}`}
              disabled={!day}
              onPress={() => day && toggle(day)}
              style={[styles.dayCell, !day && styles.blankCell, peak && styles.peakCell, active && styles.dayCellActive]}
            >
              {day ? <><Text style={[styles.dayNumber, active && styles.dayActiveText]}>{day}</Text><View style={[styles.dayMark, (pricing ? peak : day % 5 === 0) && styles.dayMarkBlue]} /></> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <Legend color="#147A4F" label={pricing ? 'Giá chuẩn' : 'Còn trống'} />
        <Legend color="#175ED6" label={pricing ? 'Cao điểm' : 'Đã đặt'} />
        <Legend color="#64748B" label={pricing ? 'Khóa bán' : 'Đã chặn'} />
      </View>
      <InfoCard style={styles.summary}>
        <SectionTitle>12–15 tháng 10 · Deluxe Sea View</SectionTitle>
        <Text style={styles.muted}>{pricing ? 'Giá hiện tại 1.450.000 ₫ / đêm' : '3 phòng còn trống · Giá 1.450.000 ₫ / đêm'}</Text>
        <View style={styles.twoButtons}>
          <View style={styles.buttonGrow}><OwnerButton label={pricing ? 'Xem gợi ý giá AI' : 'Cập nhật giá'} onPress={() => router.push(pricing ? ownerScreenHref('pricing-ai') : ownerTabHref('pricing'))} /></View>
          <View style={styles.buttonGrow}><OwnerButton label={pricing ? 'Ưu đãi' : 'Chặn ngày'} onPress={() => router.push(ownerScreenHref(pricing ? 'promotions' : 'block-room'))} secondary /></View>
        </View>
      </InfoCard>
    </OwnerScaffold>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <View style={styles.legendItem}><View style={[styles.dot, { backgroundColor: color }]} /><Text style={styles.legendText}>{label}</Text></View>;
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

export function PricingAiScreen({ confirm = false }: { confirm?: boolean }) {
  if (confirm) {
    return (
      <OwnerScaffold footer={<OwnerButton label="Xác nhận áp dụng giá" onPress={() => router.replace(ownerTabHref('pricing'))} />} title="Xác nhận giá AI đề xuất">
        <StatusPanel body="Giá hiện tại 1.450.000 ₫ → đề xuất 1.590.000 ₫. AI chỉ gợi ý; thay đổi chỉ áp dụng sau khi bạn xác nhận." title="Chờ quyết định của bạn" tone="purple" />
        <InfoCard><Text style={styles.muted}>Giá hiện tại 1.450.000 ₫ / đêm</Text><Text style={styles.aiPrice}>Giá đề xuất 1.590.000 ₫ / đêm</Text><Text style={styles.muted}>Lý do: nhu cầu cuối tuần tăng · tác động dự kiến +8% doanh thu</Text></InfoCard>
      </OwnerScaffold>
    );
  }
  return (
    <OwnerScaffold title="Gợi ý giá từ AI">
      <View><SectionTitle>Deluxe Sea View</SectionTitle><Text style={styles.muted}>Blue Horizon My Khe Hotel · 12–15 tháng 10</Text></View>
      <View style={styles.twoButtons}>
        <InfoCard style={styles.priceCard}><Text style={styles.kicker}>GIÁ HIỆN TẠI</Text><Text style={styles.price}>1.450.000 ₫</Text><Text style={styles.muted}>mỗi đêm</Text></InfoCard>
        <InfoCard style={[styles.priceCard, styles.aiPriceCard]}><Text style={styles.kicker}>AI ĐỀ XUẤT</Text><Text style={styles.aiPrice}>1.590.000 ₫</Text><Text style={styles.muted}>mỗi đêm</Text></InfoCard>
      </View>
      <View style={styles.aiReason}><SectionTitle>Vì sao AI gợi ý mức giá này?</SectionTitle><Text style={styles.muted}>Cuối tuần có nhu cầu tăng; tỷ lệ lấp đầy dự kiến 87%. Giá hiện tại thấp hơn các phòng tương tự trong khu vực.</Text></View>
      <SectionTitle>Tác động dự kiến</SectionTitle>
      <Metric label="Doanh thu phòng" value="+8%" success />
      <Metric label="Tỷ lệ lấp đầy dự kiến" value="87%" />
      <Metric label="Độ tin cậy gợi ý" value="Cao" />
      <Text style={styles.decision}>Bạn quyết định giá cuối cùng</Text>
      <Text style={styles.small}>AI chỉ đưa ra gợi ý. Kiểm tra tồn phòng và điều kiện kinh doanh trước khi xác nhận.</Text>
      <OwnerButton label="Xem & xác nhận giá" onPress={() => router.push(ownerScreenHref('pricing-ai-confirm'))} />
      <OwnerButton label="Bỏ qua" onPress={() => router.back()} secondary />
    </OwnerScaffold>
  );
}

function Metric({ label, value, success = false }: { label: string; value: string; success?: boolean }) {
  return <View style={styles.metric}><Text style={styles.muted}>{label}</Text><Text style={[styles.metricValue, success && styles.success]}>{value}</Text></View>;
}

export function PromotionScreen({ edit = false }: { edit?: boolean }) {
  return (
    <OwnerScaffold footer={<OwnerButton label="Lưu ưu đãi" />} title={edit ? 'Tạo ưu đãi' : 'Ưu đãi'}>
      <InfoCard><SectionTitle>Ưu đãi cuối tuần</SectionTitle><Text style={styles.muted}>Giảm 12% cho kỳ nghỉ từ 2 đêm · có điều kiện áp dụng</Text></InfoCard>
      <FieldCard label="Tên chương trình" value="Khám phá Đà Nẵng" />
      <FieldCard label="Thời gian" value="12–31/10/2026" />
    </OwnerScaffold>
  );
}

export function CalendarRouter({ id }: { id: OwnerScreenId }) {
  if (id === 'availability') return <OwnerCalendarScreen />;
  if (id === 'availability-booked') return <AvailabilityStateScreen />;
  if (id === 'availability-blocked') return <AvailabilityStateScreen blocked />;
  if (id === 'block-room') return <BlockRoomScreen />;
  if (id === 'pricing') return <OwnerCalendarScreen pricing />;
  if (id === 'pricing-ai') return <PricingAiScreen />;
  if (id === 'pricing-ai-confirm') return <PricingAiScreen confirm />;
  if (id === 'promotions') return <PromotionScreen />;
  if (id === 'promotion-edit') return <PromotionScreen edit />;
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

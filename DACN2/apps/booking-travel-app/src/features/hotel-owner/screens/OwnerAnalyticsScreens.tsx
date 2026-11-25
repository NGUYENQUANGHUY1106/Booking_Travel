import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTravelerStore } from '@/features/traveler/store';
import { DashboardSheet, HotelPicker } from '../dashboard/DashboardFilters';
import { calendarDate, validDateRange } from '../dashboard/model';
import { responseStatus, useDashboardHotels } from '../dashboard/queries';
import { analyticsPeriod, money, percent, useOwnerAnalytics, type AnalyticsFilter, type AnalyticsGranularity, type OwnerAnalytics } from '../dashboard/analytics';
import { InfoCard, OwnerButton, OwnerScaffold, SectionTitle } from '../components';
import { ownerColors } from '../styles/tokens';

const PERIODS: { value: AnalyticsGranularity; label: string }[] = [
  { value: 'DAY', label: 'Ngày' }, { value: 'WEEK', label: 'Tuần' },
  { value: 'MONTH', label: 'Tháng' }, { value: 'YEAR', label: 'Năm' },
];

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <View style={styles.metric} accessible accessibilityLabel={`${label}: ${value}. ${note ?? ''}`}>
    <Text style={styles.muted}>{label}</Text><Text style={styles.value}>{value}</Text>
    {note ? <Text style={styles.note}>{note}</Text> : null}
  </View>;
}

function Series({ data }: { data: OwnerAnalytics }) {
  const max = Math.max(1, ...data.points.map((point) => Math.abs(point.netCollected)));
  return <InfoCard><SectionTitle>Thực thu online theo kỳ</SectionTitle>
    <Text style={styles.note}>Tiền vào trừ tiền hoàn theo ngày giao dịch · VND</Text>
    {data.points.map((point) => <View key={point.label} style={styles.seriesRow} accessible accessibilityLabel={`${point.label}: ${money(point.netCollected)}`}>
      <Text style={styles.seriesDate}>{point.label}</Text>
      <View style={styles.track}><View style={[styles.bar, point.netCollected < 0 && styles.negative, { width: `${Math.max(2, Math.abs(point.netCollected) / max * 100)}%` }]} /></View>
      <Text style={styles.seriesValue}>{money(point.netCollected)}</Text>
    </View>)}
    {data.points.every((point) => point.netCollected === 0) ? <Text style={styles.note}>Chưa có giao dịch online trong kỳ.</Text> : null}
  </InfoCard>;
}

function RevenueContent({ data }: { data: OwnerAnalytics }) {
  return <>
    <InfoCard style={styles.feature}><SectionTitle>Thực thu online</SectionTitle><Text style={styles.heroValue}>{money(data.summary.netCollected)}</Text><Text style={styles.note}>Đã thu {money(data.summary.collected)} · Đã hoàn {money(data.summary.refunded)}</Text></InfoCard>
    <View style={styles.grid}>
      <Metric label="Giá trị đặt phòng" value={money(data.summary.bookedValue)} note="Không phải tiền đã thu" />
      <Metric label="Công suất phòng" value={percent(data.summary.occupancyPercent)} note="Đêm đã bán / đêm có thể bán" />
      <Metric label="Giá phòng bình quân" value={money(data.summary.adr)} note="Giá trị đặt / đêm phòng đã bán" />
      <Metric label="Đánh giá" value="Chưa có dữ liệu" note="Chưa có hệ thống đánh giá" />
    </View>
    <Series data={data} />
    <OwnerButton secondary label="Xem phân tích khách sạn" onPress={() => router.push({ pathname: '/hotel-owner/screen/[id]', params: { id: 'analytics', ...(data.scope.hotelId ? { hotelId: data.scope.hotelId } : {}), ...(data.scope.roomId ? { roomId: data.scope.roomId } : {}), dateFrom: data.scope.dateFrom, dateTo: data.scope.dateTo, granularity: data.scope.granularity } })} />
  </>;
}

function AnalyticsContent({ data }: { data: OwnerAnalytics }) {
  return <>
    <View style={styles.grid}>
      <Metric label="Công suất phòng" value={percent(data.summary.occupancyPercent)} note={`${data.summary.soldRoomNights} / ${data.summary.sellableRoomNights} đêm phòng`} />
      <Metric label="Giá phòng bình quân/đêm" value={money(data.summary.adr)} />
      <Metric label="Tỷ lệ hủy" value={percent(data.summary.cancellationPercent)} note={`${data.summary.cancelledCount} / ${data.summary.bookingCount} lượt đặt`} />
      <Metric label="Điểm đánh giá" value="Chưa có dữ liệu" />
    </View>
    <Series data={data} />
    <InfoCard><SectionTitle>Hiệu quả theo hạng phòng</SectionTitle>
      {data.rooms.length ? data.rooms.map((room) => <View key={room.id} style={styles.roomRow}>
        <Text style={styles.value}>{room.name}</Text>
        <Text style={styles.muted}>Thực thu online: {money(room.netCollected)}</Text>
        <Text style={styles.muted}>Công suất: {percent(room.occupancyPercent)} · Giá bình quân: {money(room.adr)}</Text>
      </View>) : <Text style={styles.muted}>Khách sạn chưa có hạng phòng.</Text>}
    </InfoCard>
    <Text style={styles.note}>Công suất của các kỳ cũ dựa trên tồn phòng hiện tại. Chưa có nguồn xác nhận tiền thu tại khách sạn.</Text>
  </>;
}

export function OwnerAnalyticsScreen({ mode, initialHotelId, initialRoomId, initialRange, initialGranularity }: { mode: 'revenue' | 'analytics'; initialHotelId?: string; initialRoomId?: string; initialRange?: { dateFrom: string; dateTo: string }; initialGranularity?: string }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' ? session.userId : '';
  const sessionId = session?.mode === 'api' ? session.sessionId : '';
  const enabled = session?.mode === 'api' && session.role === 'HOTEL_OWNER';
  const [filter, setFilter] = useState<AnalyticsFilter>(() => ({
    ...analyticsPeriod('MONTH'),
    ...(initialRange && validDateRange(initialRange.dateFrom, initialRange.dateTo) ? { ...initialRange, granularity: PERIODS.find((period) => period.value === initialGranularity)?.value ?? 'DAY' as const } : {}),
    hotelId: initialHotelId, roomId: initialRoomId,
  }));
  const [sheet, setSheet] = useState<'hotels' | 'dates' | 'rooms' | null>(null);
  const [from, setFrom] = useState(filter.dateFrom);
  const [to, setTo] = useState(filter.dateTo);
  const [dateError, setDateError] = useState('');
  const query = useOwnerAnalytics(userId, sessionId, filter, enabled);
  const hotels = useDashboardHotels(userId, sessionId, enabled && sheet === 'hotels');
  const refresh = query.refetch;
  useFocusEffect(useCallback(() => { if (enabled) void refresh(); }, [enabled, refresh]));
  const hotelName = query.data?.scope.hotelName ?? hotels.data?.pages.flatMap((page) => page.items).find((item) => item.id === filter.hotelId)?.name;
  const applyDates = () => {
    if (!validDateRange(from, to) || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 >= 366) {
      setDateError('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.'); return;
    }
    setFilter((old) => ({ ...old, dateFrom: from, dateTo: to })); setDateError(''); setSheet(null);
  };
  const authStatus = responseStatus(query.error);
  if (authStatus === 401 || authStatus === 403)
    return <Redirect href={(authStatus === 401 ? '/auth/login' : '/owner-application/status') as Href} />;
  if (!enabled) return <OwnerScaffold title="Phân tích khách sạn"><Text style={styles.muted}>Đăng nhập bằng tài khoản Chủ khách sạn để xem dữ liệu.</Text><OwnerButton label="Đăng nhập" onPress={() => router.replace('/auth/login')} /></OwnerScaffold>;
  return <OwnerScaffold title={mode === 'revenue' ? 'Doanh thu' : 'Phân tích khách sạn'} onRefresh={() => void refresh()} refreshing={query.isFetching && Boolean(query.data)}>
    <OwnerButton secondary label="‹ Quay lại" onPress={() => router.back()} />
    <Pressable accessibilityRole="button" onPress={() => setSheet('hotels')} style={styles.filter}><Text style={styles.value}>{hotelName ?? (filter.hotelId ? 'Khách sạn đã chọn' : 'Tất cả khách sạn')} ⌄</Text></Pressable>
    {query.data?.roomOptions.length ? <Pressable accessibilityRole="button" onPress={() => setSheet('rooms')} style={styles.filter}><Text style={styles.value}>{filter.roomId ? query.data.roomOptions.find((room) => room.id === filter.roomId)?.name ?? 'Hạng phòng đã chọn' : 'Tất cả hạng phòng'} ⌄</Text></Pressable> : null}
    <InfoCard><SectionTitle>Kỳ thống kê</SectionTitle><View style={styles.periods}>{PERIODS.map((period) => <Pressable key={period.value} accessibilityRole="button" accessibilityState={{ selected: filter.granularity === period.value }} onPress={() => setFilter((old) => ({ ...analyticsPeriod(period.value), hotelId: old.hotelId, roomId: old.roomId }))} style={[styles.period, filter.granularity === period.value && styles.periodActive]}><Text style={[styles.periodText, filter.granularity === period.value && styles.periodTextActive]}>{period.label}</Text></Pressable>)}</View>
      <Pressable accessibilityRole="button" accessibilityLabel="Chọn khoảng ngày" onPress={() => { setFrom(filter.dateFrom); setTo(filter.dateTo); setSheet('dates'); }}><Text style={styles.link}>{filter.dateFrom} – {filter.dateTo} · Chọn ngày</Text></Pressable>
    </InfoCard>
    {query.isPending ? <ActivityIndicator accessibilityLabel="Đang tải thống kê" size="large" color={ownerColors.primary} /> : null}
    {query.isError ? <InfoCard><Text accessibilityRole="alert" style={styles.error}>{responseStatus(query.error) === 400 ? 'Khoảng ngày hoặc tiền tệ không được hỗ trợ. Báo cáo hiện chỉ hỗ trợ VND.' : responseStatus(query.error) === 404 ? 'Khách sạn hoặc phòng không còn thuộc tài khoản này.' : 'Không thể tải thống kê. Kiểm tra kết nối và thử lại.'}</Text><OwnerButton label="Thử lại" onPress={() => void refresh()} /></InfoCard> : null}
    {query.data && !query.isError ? <>
      {!query.data.rooms.length ? <InfoCard><Text style={styles.muted}>Chưa có khách sạn hoặc hạng phòng để thống kê.</Text><OwnerButton secondary label="Quản lý chỗ ở" onPress={() => router.push('/hotel-owner/hotels')} /></InfoCard> : null}
      {mode === 'revenue' ? <RevenueContent data={query.data} /> : <AnalyticsContent data={query.data} />}
      <Text style={styles.note}>Cập nhật {new Date(query.data.asOf).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} · VND</Text>
    </> : null}
    {sheet === 'hotels' ? <HotelPicker items={hotels.data?.pages.flatMap((page) => page.items) ?? []} selected={filter.hotelId} loading={hotels.isFetching} error={hotels.isError} more={Boolean(hotels.hasNextPage)} choose={(hotelId) => { setFilter((old) => ({ ...old, hotelId, roomId: undefined })); setSheet(null); }} retry={() => void hotels.refetch()} loadMore={() => void hotels.fetchNextPage()} close={() => setSheet(null)} /> : null}
    {sheet === 'rooms' ? <DashboardSheet title="Chọn hạng phòng" close={() => setSheet(null)}><OwnerButton secondary label="Tất cả hạng phòng" onPress={() => { setFilter((old) => ({ ...old, roomId: undefined })); setSheet(null); }} />{query.data?.roomOptions.map((room) => <OwnerButton key={room.id} secondary label={room.name} onPress={() => { setFilter((old) => ({ ...old, roomId: room.id })); setSheet(null); }} />)}</DashboardSheet> : null}
    {sheet === 'dates' ? <DashboardSheet title="Chọn khoảng ngày" close={() => setSheet(null)}><Text style={styles.muted}>Giờ Việt Nam · YYYY-MM-DD</Text><TextInput accessibilityLabel="Từ ngày" value={from} onChangeText={setFrom} style={styles.input} /><TextInput accessibilityLabel="Đến ngày" value={to} onChangeText={setTo} style={styles.input} />{dateError ? <Text accessibilityRole="alert" style={styles.error}>{dateError}</Text> : null}<OwnerButton label="Áp dụng" onPress={applyDates} /><OwnerButton secondary label="Hôm nay" onPress={() => { const today = calendarDate(new Date()); setFilter((old) => ({ ...old, dateFrom: today, dateTo: today })); setSheet(null); }} /></DashboardSheet> : null}
  </OwnerScaffold>;
}

const styles = StyleSheet.create({
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  note: { color: ownerColors.muted, fontSize: 12, lineHeight: 18 },
  value: { color: ownerColors.text, fontSize: 16, fontWeight: '700' },
  heroValue: { color: ownerColors.primary, fontSize: 26, fontWeight: '800', marginTop: 8 },
  filter: { backgroundColor: ownerColors.surface, borderRadius: 12, padding: 14, minHeight: 48 },
  feature: { borderColor: ownerColors.border, borderWidth: 1 },
  grid: { gap: 10 },
  metric: { backgroundColor: ownerColors.surface, borderRadius: 12, padding: 14, gap: 4 },
  periods: { flexDirection: 'row', gap: 6, marginVertical: 12 },
  period: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, borderRadius: 8, backgroundColor: ownerColors.primarySoft },
  periodActive: { backgroundColor: ownerColors.primary },
  periodText: { color: ownerColors.primary, fontWeight: '700' },
  periodTextActive: { color: 'white' },
  link: { color: ownerColors.primary, paddingVertical: 8, fontSize: 14, fontWeight: '600' },
  seriesRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  seriesDate: { color: ownerColors.muted, fontSize: 11, width: 73 },
  track: { flex: 1, height: 8, backgroundColor: ownerColors.primarySoft, borderRadius: 4 },
  bar: { height: 8, backgroundColor: ownerColors.primary, borderRadius: 4 },
  negative: { backgroundColor: ownerColors.danger },
  seriesValue: { color: ownerColors.text, fontSize: 11, width: 92, textAlign: 'right' },
  roomRow: { paddingVertical: 10, borderBottomColor: ownerColors.border, borderBottomWidth: 1, gap: 3 },
  error: { color: ownerColors.danger, marginBottom: 10 },
  input: { backgroundColor: ownerColors.surface, borderColor: ownerColors.border, borderWidth: 1, borderRadius: 8, padding: 12, minHeight: 48, marginVertical: 6 },
});

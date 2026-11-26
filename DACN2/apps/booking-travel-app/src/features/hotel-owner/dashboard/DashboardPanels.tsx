import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { OwnerButton } from '../components';
import { ownerColors } from '../styles/tokens';
import { formatDashboardDate, type OwnerDashboard } from './model';
import { dashboardStyles as s } from './styles';
import { useTravelerStore } from '@/features/traveler/store';
import { analyticsPeriod, money, percent, useOwnerAnalytics } from './analytics';

function Kpi({
  label,
  value,
  note,
  onPress,
}: {
  label: string;
  value: string;
  note: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      style={s.kpi}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessible
      accessibilityLabel={`${label}: ${value === '—' ? 'Chưa khả dụng' : value}. ${note}`}
    >
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiNote}>{note}</Text>
    </Pressable>
  );
}

export function DashboardMetrics({ data, onRevenue }: { data: OwnerDashboard; onRevenue: () => void }) {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' ? session.userId : '';
  const sessionId = session?.mode === 'api' ? session.sessionId : '';
  const today =
    data.scope.dateFrom === data.scope.today &&
    data.scope.dateTo === data.scope.today;
  const filter = today
    ? { ...analyticsPeriod('MONTH'), hotelId: data.scope.hotel?.id }
    : { hotelId: data.scope.hotel?.id, dateFrom: data.scope.dateFrom, dateTo: data.scope.dateTo, granularity: 'DAY' as const, timeZone: 'Asia/Ho_Chi_Minh' as const };
  const analytics = useOwnerAnalytics(userId, sessionId, filter, session?.mode === 'api' && session.role === 'HOTEL_OWNER');
  const diff = data.bookings.difference;
  const number = new Intl.NumberFormat('vi-VN');
  return (
    <View style={s.grid}>
      <Kpi
        label={today ? 'Đặt phòng hôm nay' : 'Đặt phòng trong kỳ'}
        value={number.format(data.bookings.count)}
        note={`${diff > 0 ? '+' : ''}${number.format(diff)} so với ${today ? 'hôm qua' : 'kỳ trước'} · tạo mới`}
      />
      <Kpi label="Lấp đầy" value={analytics.data ? percent(analytics.data.summary.occupancyPercent) : '—'} note="Đêm đã bán / đêm có thể bán" />
      <Kpi
        label={today ? 'Đã thu tháng này' : 'Đã thu trong kỳ'}
        value={analytics.data ? money(analytics.data.summary.collected) : '—'}
        note="Tổng tiền booking đã thu, gồm tại quầy và online"
        onPress={onRevenue}
      />
      <Kpi label="Đánh giá" value="—" note="Chưa có dữ liệu đánh giá" />
    </View>
  );
}

export function DashboardSections({
  data,
  onManageHotels,
  onAddRoom,
  onPricing,
  onRevenue,
  addRoomDisabledReason,
  addRoomHelp,
}: {
  data: OwnerDashboard;
  onManageHotels: () => void;
  onAddRoom: () => void;
  onPricing: () => void;
  onRevenue: () => void;
  addRoomDisabledReason?: string;
  addRoomHelp: string;
}) {
  const session = useTravelerStore((state) => state.session);
  const end = new Date(`${data.scope.today}T00:00:00Z`);
  const start = new Date(end.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
  const series = useOwnerAnalytics(
    session?.mode === 'api' ? session.userId : '',
    session?.mode === 'api' ? session.sessionId : '',
    { hotelId: data.scope.hotel?.id, dateFrom: start, dateTo: data.scope.today, granularity: 'DAY', timeZone: 'Asia/Ho_Chi_Minh' },
    session?.mode === 'api' && session.role === 'HOTEL_OWNER',
  );
  return (
    <>
      <View style={s.section}>
        <View style={s.row}>
          <Text style={s.heading}>Dòng tiền ròng 7 ngày</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRevenue}
            style={s.linkTouch}
          >
            <Text style={s.link}>Xem chi tiết</Text>
          </Pressable>
        </View>
        {series.data ? <View style={[s.chartUnavailable, { alignItems: 'stretch' }]}>
          {series.data.points.map((point) => <View key={point.label} style={s.row} accessible accessibilityLabel={`${point.label}: ${money(point.netCollected)}`}>
            <Text style={s.rowLabel}>{point.label.slice(5)}</Text><Text style={s.rowValue}>{money(point.netCollected)}</Text>
          </View>)}
          {series.data.points.every((point) => point.netCollected === 0) ? <Text style={s.caption}>Chưa có giao dịch đã thu hoặc hoàn trong 7 ngày.</Text> : null}
        </View> : <View style={s.chartUnavailable}><Text style={s.body}>{series.isError ? 'Không thể tải doanh thu.' : 'Đang tải doanh thu…'}</Text></View>}
      </View>
      <View style={s.section}>
        <Text style={s.heading}>Cần xử lý hôm nay</Text>
        <Text style={s.caption}>
          {formatDashboardDate(data.actions.date)} · Giờ Việt Nam
        </Text>
        <View style={s.row}>
          <Text style={s.rowLabel}>Khách nhận phòng</Text>
          <Text style={s.rowValue}>
            {data.actions.arrivals.toLocaleString('vi-VN')} đặt phòng
          </Text>
        </View>
        <View style={s.row}>
          <Text style={s.rowLabel}>Khách trả phòng</Text>
          <Text style={s.rowValue}>
            {data.actions.departures.toLocaleString('vi-VN')} đặt phòng
          </Text>
        </View>
        <View style={s.row}>
          <Text style={s.rowLabel}>Yêu cầu hỗ trợ</Text>
          <Text style={s.rowValue}>Chưa khả dụng</Text>
        </View>
        <Text style={s.caption}>
          Chi tiết nhận/trả phòng và hộp thư chưa khả dụng.
        </Text>
      </View>
      <View style={s.section}>
        <Text style={s.heading}>Thao tác nhanh</Text>
        <OwnerButton label="Quản lý chỗ ở" secondary onPress={onManageHotels} />
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: Boolean(addRoomDisabledReason) }}
            accessibilityLabel={`Thêm phòng. ${addRoomDisabledReason ?? addRoomHelp}`}
            disabled={Boolean(addRoomDisabledReason)}
            onPress={onAddRoom}
            style={[s.action, addRoomDisabledReason && s.disabled]}
          >
            <Text style={[s.link, s.centered]}>Thêm phòng</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onPricing} style={s.action}>
            <Text style={[s.link, s.centered]}>Cập nhật giá</Text>
          </Pressable>
        </View>
        <Text style={s.caption}>{addRoomDisabledReason ?? addRoomHelp}</Text>
        <Text style={s.caption}>Chọn hạng phòng và ngày trên lịch giá để thay đổi giá bán.</Text>
      </View>
      <View testID="owner-dashboard-ai" style={s.ai}>
        <Text style={s.aiTitle}>Gợi ý AI</Text>
        <Text style={s.body}>Chưa có gợi ý cho khách sạn của bạn.</Text>
      </View>
      <Text style={s.caption}>
        {data.summary.hotelCount} khách sạn · {data.summary.roomCount} phòng ·{' '}
        {data.summary.upcomingBookings} đặt phòng sắp đến ·{' '}
        {data.summary.currentGuests} khách đang lưu trú
      </Text>
      <Text style={s.caption}>
        Cập nhật:{' '}
        {new Date(data.updatedAt).toLocaleString('vi-VN', {
          timeZone: data.scope.timeZone,
        })}
      </Text>
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <View
      testID="owner-dashboard-loading"
      accessibilityLabel="Đang tải tổng quan"
      style={s.section}
    >
      <View style={s.loading} />
      <View style={s.grid}>
        {[1, 2, 3, 4].map((n) => (
          <View key={n} style={s.kpi} />
        ))}
      </View>
      <View style={[s.loading, { height: 148 }]} />
      <ActivityIndicator color={ownerColors.modernPrimary} />
    </View>
  );
}

export function DashboardNoHotel({ onCreateHotel }: { onCreateHotel: () => void }) {
  return (
    <View testID="owner-dashboard-empty" style={s.empty}>
      <View style={s.emptyIcon}>
        <Text style={s.emptySymbol}>⌕</Text>
      </View>
      <View style={s.emptyContent}>
        <Text style={s.emptyTitle}>Bạn chưa có khách sạn nào</Text>
        <Text style={s.body}>
          Khách sạn của bạn sẽ xuất hiện tại đây sau khi được tạo.
        </Text>
        <OwnerButton label="Tạo khách sạn" onPress={onCreateHotel} />
      </View>
    </View>
  );
}

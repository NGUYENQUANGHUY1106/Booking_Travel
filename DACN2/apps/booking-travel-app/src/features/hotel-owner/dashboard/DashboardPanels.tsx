import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { OwnerButton } from '../components';
import { ownerColors } from '../styles/tokens';
import { formatDashboardDate, type OwnerDashboard } from './model';
import { dashboardStyles as s } from './styles';

function Kpi({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <View
      style={s.kpi}
      accessible
      accessibilityLabel={`${label}: ${value === '—' ? 'Chưa khả dụng' : value}. ${note}`}
    >
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiNote}>{note}</Text>
    </View>
  );
}

export function DashboardMetrics({ data }: { data: OwnerDashboard }) {
  const today =
    data.scope.dateFrom === data.scope.today &&
    data.scope.dateTo === data.scope.today;
  const diff = data.bookings.difference;
  const number = new Intl.NumberFormat('vi-VN');
  return (
    <View style={s.grid}>
      <Kpi
        label={today ? 'Đặt phòng hôm nay' : 'Đặt phòng trong kỳ'}
        value={number.format(data.bookings.count)}
        note={`${diff > 0 ? '+' : ''}${number.format(diff)} so với ${today ? 'hôm qua' : 'kỳ trước'} · tạo mới`}
      />
      <Kpi label="Lấp đầy" value="—" note="Chưa có dữ liệu tồn phòng" />
      <Kpi
        label={today ? 'Doanh thu tháng' : 'Doanh thu trong kỳ'}
        value="—"
        note="Chưa có dữ liệu thanh toán"
      />
      <Kpi label="Đánh giá" value="—" note="Chưa có dữ liệu đánh giá" />
    </View>
  );
}

export function DashboardSections({ data }: { data: OwnerDashboard }) {
  return (
    <>
      <View style={s.section}>
        <View style={s.row}>
          <Text style={s.heading}>Doanh thu 7 ngày</Text>
          <Pressable
            disabled
            accessibilityRole="button"
            accessibilityState={{ disabled: true }}
            style={[s.linkTouch, s.disabled]}
          >
            <Text style={s.link}>Xem chi tiết</Text>
          </Pressable>
        </View>
        <View
          style={s.chartUnavailable}
          accessibilityLabel="Biểu đồ doanh thu chưa khả dụng"
        >
          <Text style={s.body}>Chưa có dữ liệu doanh thu</Text>
          <Text style={[s.caption, s.centered]}>
            Biểu đồ sẽ hiển thị khi có dữ liệu thanh toán và hoàn tiền đã xác
            nhận.
          </Text>
        </View>
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
        <View style={s.actions}>
          {['Thêm phòng', 'Chặn phòng', 'Cập nhật giá'].map((label) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ disabled: true }}
              accessibilityLabel={`${label}: chưa khả dụng`}
              disabled
              style={[s.action, s.disabled]}
            >
              <Text style={[s.link, s.centered]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={s.caption}>
          Các công cụ quản lý phòng và giá chưa khả dụng.
        </Text>
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

export function DashboardNoHotel() {
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
        <OwnerButton label="Tạo khách sạn" disabled />
        <Text style={s.caption}>Tính năng tạo khách sạn chưa khả dụng.</Text>
      </View>
    </View>
  );
}

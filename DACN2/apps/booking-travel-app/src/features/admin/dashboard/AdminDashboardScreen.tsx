import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTravelerStore } from '@/features/traveler/store';
import { useHotelReviewQueue } from '../hotel-moderation/queries';
import { useOwnerReviewQueue } from '../owner-verification/queries';
import { ADMIN_COLORS } from '../theme';
import { useAdminDashboardSummary } from './api';
import {
  AdminText, DashboardKpiCard, DashboardSkeleton, PendingTasksPanel,
  RecentActivityPanel, RevenueBarChart, dashboardStyles, openAdminDestination,
} from './components';
import { ADMIN_DASHBOARD_DEMO } from './mock';
import { parseDashboardScenario } from './service';
import type { DashboardKpi, PendingTask, RecentActivity } from './types';
import { useAdminDashboard } from './useAdminDashboard';

const DATE_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: 'numeric', month: 'long', year: 'numeric',
});
const ACTIVITY_TIME_FORMAT = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function AdminDashboardScreen() {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ demoState?: string }>();
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const session = useTravelerStore((state) => state.session);
  const adminName = useTravelerStore((state) => state.profile.name);
  const apiMode = session?.mode === 'api';
  const demo = useAdminDashboard(parseDashboardScenario(params.demoState), !apiMode);
  const ownerQueue = useOwnerReviewQueue({ status: 'PENDING', page: 1, limit: 1, sortBy: 'submittedAt', sortOrder: 'desc' }, apiMode);
  const hotelQueue = useHotelReviewQueue({ page: 1, limit: 1, sort: 'newest' });
  const summary = useAdminDashboardSummary();
  const mobile = width < 768;
  const desktop = width >= 1024;
  const stacked = width < 900;
  const contentWidth = Math.min(1040, width - (desktop ? 236 : 0) - (mobile ? 32 : 48));
  const chartWidth = (contentWidth - 14) * 444 / 726;
  const headerData = demo.data ?? ADMIN_DASHBOARD_DEMO;
  const hotelCount = hotelQueue.data?.total;
  const ownerCount = ownerQueue.data?.summary.pending;
  const bookingsCount = summary.data?.bookings.count;

  const apiKpis: DashboardKpi[] = [
    { id: 'revenue', label: 'Doanh thu tháng', displayValue: '—', supportingText: 'Chưa có dữ liệu doanh thu', tone: 'neutral' },
    { id: 'bookings', label: 'Đặt phòng mới', displayValue: bookingsCount === undefined ? '—' : String(bookingsCount), supportingText: summary.isError ? 'Không tải được dữ liệu' : bookingsCount === undefined ? 'Đang tải...' : 'Trong 7 ngày qua', tone: 'primary' },
    { id: 'hotels', label: 'KS chờ duyệt', displayValue: hotelCount === undefined ? '—' : String(hotelCount), supportingText: hotelQueue.isError ? 'Không tải được hàng chờ' : hotelCount === undefined ? 'Đang tải...' : hotelCount === 0 ? 'Không có hồ sơ chờ' : 'Cần quyết định', tone: 'warning' },
    { id: 'ai', label: 'Cảnh báo AI', displayValue: '—', supportingText: 'Chưa có dữ liệu cảnh báo', tone: 'neutral' },
  ];
  const pendingTasks: PendingTask[] = apiMode ? [
    { id: 'verify-owner', count: ownerCount ?? null, label: 'Xác minh chủ khách sạn', destination: 'ownerVerification', state: ownerQueue.isError ? 'error' : ownerCount === undefined ? 'loading' : undefined, onRetry: ownerQueue.isError ? () => void ownerQueue.refetch() : undefined },
    { id: 'approve-hotel', count: hotelCount ?? null, label: 'Khách sạn chờ duyệt', destination: 'hotelModeration', state: hotelQueue.isError ? 'error' : hotelCount === undefined ? 'loading' : undefined, onRetry: hotelQueue.isError ? () => void hotelQueue.refetch() : undefined },
    { id: 'review-flag', count: null, label: 'Cảnh báo cần xem', state: 'unavailable' },
  ] : demo.data?.pendingTasks ?? [];
  const apiActivities: RecentActivity[] = summary.data?.activities.map((activity) => ({
    id: activity.id,
    time: ACTIVITY_TIME_FORMAT.format(new Date(activity.occurredAt)),
    description: activity.action === 'SUBMITTED' ? `${activity.hotelName} gửi hồ sơ duyệt` : activity.action === 'APPROVED' ? `${activity.hotelName} đã được duyệt` : `${activity.hotelName} bị từ chối`,
    status: activity.action === 'SUBMITTED' ? 'Chờ duyệt' : activity.action === 'APPROVED' ? 'Đã duyệt' : 'Đã từ chối',
    tone: activity.action === 'REJECTED' ? 'warning' : 'primary',
  })) ?? [];
  const refreshAll = () => { void Promise.all([summary.refetch(), ownerQueue.refetch(), hotelQueue.refetch()]); };

  return <View style={styles.screen}>
    <ScrollView style={styles.main} contentContainerStyle={[styles.mainScroll, mobile && styles.mainScrollMobile]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <View style={[styles.topBar, mobile && styles.topBarMobile]}>
          <AdminText weight="semibold" style={styles.breadcrumb}>QUẢN TRỊ HỆ THỐNG  /  TỔNG QUAN</AdminText>
          <View style={[styles.topBarIdentity, mobile && styles.identityMobile]}>
            <AdminText weight="medium" style={styles.identityText}>{apiMode ? DATE_FORMAT.format(new Date()) : headerData.displayDate}</AdminText>
            <AdminText weight="medium" style={styles.identityText} numberOfLines={1}>{apiMode ? adminName || session?.email : headerData.adminDisplayName}</AdminText>
          </View>
        </View>
        <View style={styles.heading}>
          <AdminText accessibilityRole="header" weight="bold" style={styles.title}>Tổng quan hệ thống</AdminText>
          <AdminText style={styles.subtitle}>Theo dõi vận hành, phê duyệt và rủi ro trong một nơi.</AdminText>
          {apiMode ? <Pressable accessibilityRole="button" onPress={refreshAll} style={styles.refresh}><AdminText weight="semibold" style={styles.refreshText}>Làm mới dữ liệu</AdminText></Pressable> : null}
        </View>
        {unavailable ? <View accessibilityRole="alert" style={styles.notice}>
          <AdminText style={styles.noticeText}>{unavailable} chưa khả dụng với dữ liệu thật.</AdminText>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng thông báo" onPress={() => setUnavailable(null)}><AdminText weight="semibold" style={styles.noticeClose}>Đóng</AdminText></Pressable>
        </View> : null}
        {!apiMode && demo.isPending ? <DashboardSkeleton stacked={stacked} /> : !apiMode && demo.isError ? <View accessibilityRole="alert" style={styles.errorCard}>
          <AdminText>Không thể tải dữ liệu tổng quan. Vui lòng thử lại.</AdminText>
          <Pressable accessibilityRole="button" onPress={() => void demo.refetch()} style={styles.retryButton}><AdminText weight="semibold" style={styles.retryText}>Thử lại</AdminText></Pressable>
        </View> : <>
          <View style={dashboardStyles.kpiGrid}>
            {(apiMode ? apiKpis : demo.data?.kpis ?? []).map((kpi) => {
              const loading = apiMode && (kpi.id === 'hotels' ? hotelQueue.isPending : kpi.id === 'bookings' ? summary.isPending : false);
              const onRetry = apiMode && kpi.id === 'hotels' && hotelQueue.isError ? () => void hotelQueue.refetch() : apiMode && kpi.id === 'bookings' && summary.isError ? () => void summary.refetch() : undefined;
              const content = <DashboardKpiCard kpi={kpi} loading={loading} onRetry={onRetry} />;
              return <View key={kpi.id} style={[styles.kpiSlot, stacked && styles.kpiSlotStacked]}>{kpi.id === 'hotels' && !loading && !hotelQueue.isError ? <Pressable accessibilityRole="button" accessibilityLabel="Mở hàng chờ duyệt khách sạn" onPress={() => openAdminDestination('hotelModeration', setUnavailable, apiMode)}>{content}</Pressable> : content}</View>;
            })}
          </View>
          <View style={[dashboardStyles.middleRow, stacked && styles.middleStacked]}>
            <View style={[dashboardStyles.chartCard, stacked ? styles.panelStacked : { flexGrow: 0, flexShrink: 0, flexBasis: chartWidth, width: chartWidth }]}>
              <AdminText weight="semibold" style={dashboardStyles.cardTitle}>Doanh thu theo ngày</AdminText>
              {apiMode ? <View style={styles.chartEmpty}><AdminText style={styles.chartEmptyText}>Chưa có dữ liệu doanh thu theo ngày</AdminText></View> : <RevenueBarChart data={demo.data?.revenueByDay ?? []} />}
            </View>
            <View style={[styles.pendingSlot, stacked && styles.panelStacked]}><PendingTasksPanel tasks={pendingTasks} onUnavailable={setUnavailable} apiMode={apiMode} /></View>
          </View>
          <RecentActivityPanel activities={apiMode ? apiActivities : demo.data?.recentActivities ?? []} onUnavailable={setUnavailable} loading={apiMode && summary.isPending} error={apiMode && summary.isError} onRetry={() => void summary.refetch()} logAvailable={!apiMode} />
        </>}
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ADMIN_COLORS.background },
  main: { flex: 1 },
  mainScroll: { padding: 24, alignItems: 'center', minHeight: '100%' },
  mainScrollMobile: { padding: 16 },
  content: { width: '100%', maxWidth: 1040, gap: 18 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, minHeight: 15 },
  topBarMobile: { flexDirection: 'column' },
  breadcrumb: { fontSize: 11, lineHeight: 15, color: ADMIN_COLORS.primary },
  topBarIdentity: { flexDirection: 'row', gap: 18, flexWrap: 'wrap' },
  identityMobile: { gap: 8 },
  identityText: { fontSize: 12, lineHeight: 17, color: ADMIN_COLORS.secondaryText },
  heading: { gap: 3 },
  title: { fontSize: 26, lineHeight: 36 },
  subtitle: { fontSize: 13, lineHeight: 18, color: ADMIN_COLORS.secondaryText },
  refresh: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', marginTop: 5 },
  refreshText: { fontSize: 12, color: ADMIN_COLORS.primary },
  kpiSlot: { flex: 1, minWidth: 0 },
  kpiSlotStacked: { flexBasis: '47%' },
  middleStacked: { flexDirection: 'column' },
  panelStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  pendingSlot: { flex: 1, minWidth: 0 },
  chartEmpty: { flex: 1, minHeight: 176, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: ADMIN_COLORS.background },
  chartEmptyText: { color: ADMIN_COLORS.secondaryText, fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
  notice: { borderWidth: 1, borderColor: ADMIN_COLORS.border, borderRadius: 9, backgroundColor: '#EFF6FF', padding: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  noticeText: { flex: 1, color: ADMIN_COLORS.secondaryText, fontSize: 12, lineHeight: 18 },
  noticeClose: { color: ADMIN_COLORS.primary, fontSize: 12 },
  errorCard: { padding: 16, borderRadius: 12, backgroundColor: ADMIN_COLORS.surface, gap: 12 },
  retryButton: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: ADMIN_COLORS.primary, paddingHorizontal: 14, paddingVertical: 9 },
  retryText: { color: ADMIN_COLORS.surface, fontSize: 12 },
});

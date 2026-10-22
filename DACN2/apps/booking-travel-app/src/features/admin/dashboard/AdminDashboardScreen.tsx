import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ADMIN_COLORS } from '../theme';
import { useOwnerReviewQueue } from '../owner-verification/queries';
import { useTravelerStore } from '@/features/traveler/store';
import { AdminText, DashboardKpiCard, DashboardSkeleton, PendingTasksPanel, RecentActivityPanel, RevenueBarChart, dashboardStyles } from './components';
import { ADMIN_DASHBOARD_DEMO } from './mock';
import { parseDashboardScenario } from './service';
import { useAdminDashboard } from './useAdminDashboard';

export function AdminDashboardScreen() {
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ demoState?: string }>();
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const { data, isPending, isError, refetch } = useAdminDashboard(parseDashboardScenario(params.demoState));
  const apiMode = useTravelerStore((state) => state.session?.mode === 'api');
  const ownerQueue = useOwnerReviewQueue({ status: 'PENDING', page: 1, limit: 1, sortBy: 'submittedAt', sortOrder: 'desc' }, apiMode);
  const mobile = width < 768;
  const desktop = width >= 1024;
  const stacked = width < 900;
  const contentWidth = Math.min(1040, width - (desktop ? 236 : 0) - (mobile ? 32 : 48));
  const chartWidth = (contentWidth - 14) * 444 / 726;
  const headerData = data ?? ADMIN_DASHBOARD_DEMO;

  return <View style={styles.screen}>
    <ScrollView style={styles.main} contentContainerStyle={[styles.mainScroll, mobile && styles.mainScrollMobile]} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {desktop ? <View style={[styles.topBar, stacked && styles.topBarStacked]}>
          <AdminText weight="semibold" style={styles.breadcrumb}>QUẢN TRỊ HỆ THỐNG  /  TỔNG QUAN</AdminText>
          <View style={styles.topBarIdentity}>
            <AdminText weight="medium" style={styles.identityText}>{headerData.displayDate}</AdminText>
            <AdminText weight="medium" style={styles.identityText}>{headerData.adminDisplayName}</AdminText>
          </View>
        </View> : null}
        <View style={styles.heading}>
          <AdminText accessibilityRole="header" weight="bold" style={styles.title}>Tổng quan hệ thống</AdminText>
          <AdminText style={styles.subtitle}>Theo dõi vận hành, phê duyệt và rủi ro trong một nơi.</AdminText>
        </View>
        {unavailable && <View accessibilityRole="alert" style={styles.notice}>
          <AdminText style={styles.noticeText}>{unavailable} chưa được triển khai.</AdminText>
          <Pressable accessibilityRole="button" accessibilityLabel="Đóng thông báo" onPress={() => setUnavailable(null)}><AdminText weight="semibold" style={styles.noticeClose}>Đóng</AdminText></Pressable>
        </View>}
        {isPending ? <DashboardSkeleton stacked={stacked} /> : isError ? <View accessibilityRole="alert" style={styles.errorCard}>
          <AdminText>Không thể tải dữ liệu tổng quan. Vui lòng thử lại.</AdminText>
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.retryButton}><AdminText weight="semibold" style={styles.retryText}>Thử lại</AdminText></Pressable>
        </View> : data && <>
          <View style={dashboardStyles.kpiGrid}>
            {data.kpis.map((kpi) => <View key={kpi.id} style={[styles.kpiSlot, stacked && styles.kpiSlotStacked]}><DashboardKpiCard kpi={kpi} /></View>)}
          </View>
          <View style={[dashboardStyles.middleRow, stacked && styles.middleStacked]}>
            <View style={[dashboardStyles.chartCard, stacked ? styles.panelStacked : { flexGrow: 0, flexShrink: 0, flexBasis: chartWidth, width: chartWidth }]}>
              <AdminText weight="semibold" style={dashboardStyles.cardTitle}>Doanh thu theo ngày</AdminText>
              <RevenueBarChart data={data.revenueByDay} />
            </View>
            <View style={[styles.pendingSlot, stacked && styles.panelStacked]}>
              <PendingTasksPanel tasks={apiMode ? data.pendingTasks.filter((task) => task.id !== 'verify-owner').concat(ownerQueue.data ? [{ id: 'verify-owner', count: ownerQueue.data.summary.pending, label: 'Xác minh chủ khách sạn', destination: 'ownerVerification' as const }] : []) : data.pendingTasks} onUnavailable={setUnavailable} />
              {apiMode && ownerQueue.isError ? <AdminText style={styles.subtitle}>Không thể tải số hồ sơ Chủ khách sạn đang chờ.</AdminText> : null}
            </View>
          </View>
          <RecentActivityPanel activities={data.recentActivities} onUnavailable={setUnavailable} />
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
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 15 },
  topBarStacked: { flexWrap: 'wrap', gap: 8 },
  breadcrumb: { fontSize: 11, lineHeight: 15, color: ADMIN_COLORS.primary },
  topBarIdentity: { flexDirection: 'row', gap: 18 },
  identityText: { fontSize: 12, lineHeight: 17, color: ADMIN_COLORS.secondaryText },
  heading: { gap: 3 },
  title: { fontSize: 26, lineHeight: 36 },
  subtitle: { fontSize: 13, lineHeight: 18, color: ADMIN_COLORS.secondaryText },
  kpiSlot: { flex: 1, minWidth: 0 },
  kpiSlotStacked: { flexBasis: '47%' },
  middleStacked: { flexDirection: 'column' },
  panelStacked: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  pendingSlot: { flex: 1, minWidth: 0 },
  notice: { borderWidth: 1, borderColor: ADMIN_COLORS.border, borderRadius: 9, backgroundColor: '#EFF6FF', padding: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  noticeText: { flex: 1, color: ADMIN_COLORS.secondaryText, fontSize: 12, lineHeight: 18 },
  noticeClose: { color: ADMIN_COLORS.primary, fontSize: 12 },
  errorCard: { padding: 16, borderRadius: 12, backgroundColor: ADMIN_COLORS.surface, gap: 12 },
  retryButton: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: ADMIN_COLORS.primary, paddingHorizontal: 14, paddingVertical: 9 },
  retryText: { color: ADMIN_COLORS.surface, fontSize: 12 },
});

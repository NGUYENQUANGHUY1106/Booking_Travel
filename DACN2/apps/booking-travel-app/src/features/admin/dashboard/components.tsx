import { Asset } from 'expo-asset';
import type { Href } from 'expo-router';
import { router, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { ADMIN_COLORS, ADMIN_FONT } from '../theme';
import type { AdminDestination, DailyRevenue, DashboardKpi, PendingTask, RecentActivity } from './types';

const ADMIN_NAVIGATION: { id: 'overview' | AdminDestination; label: string; icon: number; href: Href | null }[] = [
  { id: 'overview', label: 'Tổng quan', icon: require('../assets/overview.svg'), href: '/admin' as Href },
  { id: 'users', label: 'Người dùng', icon: require('../assets/users.svg'), href: { pathname: '/admin/[section]', params: { section: 'users' } } },
  { id: 'ownerVerification', label: 'Xác minh chủ KS', icon: require('../assets/owner-verification.svg'), href: { pathname: '/admin/[section]', params: { section: 'owner-verification' } } },
  { id: 'hotelModeration', label: 'Duyệt khách sạn', icon: require('../assets/hotel-moderation.svg'), href: { pathname: '/admin/[section]', params: { section: 'hotel-moderation' } } },
  { id: 'bookings', label: 'Đặt phòng', icon: require('../assets/bookings.svg'), href: { pathname: '/admin/[section]', params: { section: 'bookings' } } },
  { id: 'payments', label: 'Thanh toán', icon: require('../assets/payments.svg'), href: { pathname: '/admin/[section]', params: { section: 'payments' } } },
  { id: 'reviews', label: 'Đánh giá & báo cáo', icon: require('../assets/reviews.svg'), href: { pathname: '/admin/[section]', params: { section: 'reviews' } } },
  { id: 'promotions', label: 'Ưu đãi', icon: require('../assets/promotions.svg'), href: { pathname: '/admin/[section]', params: { section: 'promotions' } } },
  { id: 'analytics', label: 'Phân tích', icon: require('../assets/analytics.svg'), href: { pathname: '/admin/[section]', params: { section: 'analytics' } } },
  { id: 'fraud', label: 'Cảnh báo AI', icon: require('../assets/fraud.svg'), href: { pathname: '/admin/[section]', params: { section: 'fraud' } } },
  { id: 'audit', label: 'Nhật ký', icon: require('../assets/audit.svg'), href: { pathname: '/admin/[section]', params: { section: 'audit' } } },
];

export function openAdminDestination(destination: AdminDestination | 'overview', onUnavailable: (label: string) => void) {
  const item = ADMIN_NAVIGATION.find((entry) => entry.id === destination);
  if (!item) return;
  if (item.href) router.push(item.href);
  else onUnavailable(item.label);
}

function AdminText({ children, style, weight = 'regular', ...props }: PropsWithChildren<{ style?: object; weight?: keyof typeof ADMIN_FONT; accessibilityRole?: 'header' | 'text'; numberOfLines?: number }>) {
  return <Text {...props} style={[{ color: ADMIN_COLORS.heading, fontFamily: ADMIN_FONT[weight] }, style]}>{children}</Text>;
}

export function AdminSidebar({ compact, onUnavailable }: { compact: boolean; onUnavailable: (label: string) => void }) {
  const pathname = usePathname();
  const activeSection = pathname === '/admin' ? 'overview' : pathname.includes('owner-verification') ? 'ownerVerification' : pathname.includes('hotel-moderation') || pathname.includes('/hotels') ? 'hotelModeration' : pathname.includes('/users') ? 'users' : pathname.includes('/bookings') ? 'bookings' : pathname.includes('/payments') ? 'payments' : pathname.includes('/reviews') || pathname.includes('/reports') ? 'reviews' : pathname.includes('/promotions') || pathname.includes('/voucher') ? 'promotions' : pathname.includes('/analytics') ? 'analytics' : pathname.includes('/fraud') ? 'fraud' : pathname.includes('/audit') ? 'audit' : 'overview';
  return <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarScroll}>
      <View style={[styles.brand, compact && styles.brandCompact]}>
        {compact ? <AdminText weight="bold" style={styles.brandShort}>BT</AdminText> : <>
          <AdminText weight="bold" style={styles.brandTitle}>BOOKING TRAVEL</AdminText>
          <AdminText weight="semibold" style={styles.brandSubtitle}>ADMIN CONSOLE</AdminText>
        </>}
      </View>
      {ADMIN_NAVIGATION.map((item) => {
        const active = item.id === activeSection;
        return <Pressable
          key={item.id}
          accessibilityLabel={item.label}
          accessibilityRole="button"
          accessibilityState={{ selected: active }}
          onPress={() => openAdminDestination(item.id, onUnavailable)}
          style={({ pressed }) => [styles.navItem, active && styles.navActive, pressed && { opacity: 0.75 }]}
        >
          <SvgUri height={18} uri={Asset.fromModule(item.icon).uri} width={18} />
          {!compact && <AdminText weight={active ? 'semibold' : 'medium'} style={[styles.navLabel, !active && styles.navLabelInactive]}>{item.label}</AdminText>}
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

export function DashboardKpiCard({ kpi }: { kpi: DashboardKpi }) {
  const supportingColor = kpi.tone === 'positive' ? ADMIN_COLORS.positive : kpi.tone === 'warning' ? ADMIN_COLORS.warning : ADMIN_COLORS.primary;
  return <View style={styles.kpiCard}>
    <AdminText weight="medium" style={styles.kpiLabel}>{kpi.label}</AdminText>
    <AdminText weight="bold" style={styles.kpiValue}>{kpi.displayValue}</AdminText>
    <AdminText weight="medium" style={[styles.kpiSupport, { color: supportingColor }]}>{kpi.supportingText}</AdminText>
  </View>;
}

export function RevenueBarChart({ data }: { data: DailyRevenue[] }) {
  const highest = Math.max(1, ...data.map((item) => item.amount));
  return <View accessibilityLabel="Biểu đồ doanh thu theo ngày" style={styles.chart}>
    <View style={styles.chartBars}>
      {data.map((item) => <View key={item.day} style={styles.barCell}>
        <View accessibilityLabel={`${item.day}: ${item.amount}`} style={[styles.bar, { height: Math.round(item.amount / highest * 118), backgroundColor: item.highlighted ? ADMIN_COLORS.primary : ADMIN_COLORS.chartLight }]} />
      </View>)}
    </View>
    <View style={styles.chartLabels}>
      {data.map((item) => <AdminText key={item.day} weight="medium" style={styles.chartLabel}>{item.day}</AdminText>)}
    </View>
  </View>;
}

function PendingTaskRow({ task, onUnavailable }: { task: PendingTask; onUnavailable: (label: string) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${task.count} ${task.label}`} onPress={() => openAdminDestination(task.destination, onUnavailable)} style={({ pressed }) => [styles.pendingRow, pressed && { opacity: 0.65 }]}>
    <AdminText weight="bold" style={styles.pendingCount}>{String(task.count).padStart(2, '0')}</AdminText>
    <AdminText weight="medium" style={styles.pendingLabel} numberOfLines={2}>{task.label}</AdminText>
  </Pressable>;
}

export function PendingTasksPanel({ tasks, onUnavailable }: { tasks: PendingTask[]; onUnavailable: (label: string) => void }) {
  return <View style={styles.pendingCard}>
    <AdminText weight="semibold" style={styles.cardTitle}>Cần xử lý</AdminText>
    {tasks.length ? tasks.map((task) => <PendingTaskRow key={task.id} task={task} onUnavailable={onUnavailable} />) : <AdminText style={styles.empty}>Không có mục nào cần xử lý</AdminText>}
  </View>;
}

function RecentActivityRow({ activity, onUnavailable }: { activity: RecentActivity; onUnavailable: (label: string) => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${activity.time}, ${activity.description}, ${activity.status}`} onPress={() => openAdminDestination(activity.destination, onUnavailable)} style={({ pressed }) => [styles.activityRow, pressed && { opacity: 0.65 }]}>
    <AdminText style={styles.activityTime}>{activity.time}</AdminText>
    <AdminText weight="medium" style={styles.activityDescription} numberOfLines={2}>{activity.description}</AdminText>
    <AdminText weight="semibold" style={[styles.activityStatus, activity.tone === 'warning' && { color: ADMIN_COLORS.warning }]}>{activity.status}</AdminText>
  </Pressable>;
}

export function RecentActivityPanel({ activities, onUnavailable }: { activities: RecentActivity[]; onUnavailable: (label: string) => void }) {
  return <View style={styles.recentCard}>
    <View style={styles.recentHeader}>
      <AdminText weight="semibold" style={styles.cardTitle}>Hoạt động gần đây</AdminText>
      <Pressable accessibilityRole="button" onPress={() => openAdminDestination('audit', onUnavailable)}><AdminText weight="semibold" style={styles.recentLink}>Xem nhật ký</AdminText></Pressable>
    </View>
    {activities.length ? activities.map((activity) => <RecentActivityRow key={activity.id} activity={activity} onUnavailable={onUnavailable} />) : <AdminText style={styles.empty}>Chưa có hoạt động gần đây</AdminText>}
  </View>;
}

export function DashboardSkeleton() {
  return <View style={styles.skeletonSections}>
    <View style={styles.kpiGrid}>{[0, 1, 2, 3].map((key) => <View key={key} style={[styles.kpiCard, styles.skeletonSurface]} />)}</View>
    <View style={styles.middleRow}><View style={[styles.chartCard, styles.skeletonSurface]} /><View style={[styles.pendingCard, { flex: 282 }, styles.skeletonSurface]} /></View>
    <View style={[styles.recentCard, styles.skeletonSurface]} />
  </View>;
}

export { AdminText };

const styles = StyleSheet.create({
  sidebar: { width: 236, backgroundColor: ADMIN_COLORS.sidebar },
  sidebarCompact: { width: 64 },
  sidebarScroll: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 20, gap: 3 },
  brand: { paddingBottom: 16, gap: 3 },
  brandCompact: { alignItems: 'center', height: 57 },
  brandTitle: { color: '#FFFFFF', fontSize: 17, lineHeight: 24 },
  brandShort: { color: '#FFFFFF', fontSize: 17, lineHeight: 24 },
  brandSubtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 10, lineHeight: 14 },
  navItem: { height: 38, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 12, borderRadius: 9 },
  navActive: { backgroundColor: ADMIN_COLORS.sidebarActive },
  navLabel: { fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  navLabelInactive: { color: 'rgba(255,255,255,0.82)' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 110, padding: 14, gap: 8, backgroundColor: ADMIN_COLORS.surface, borderColor: ADMIN_COLORS.border, borderWidth: 1, borderRadius: 12 },
  kpiLabel: { fontSize: 12, lineHeight: 17, color: ADMIN_COLORS.secondaryText },
  kpiValue: { fontSize: 23, lineHeight: 32 },
  kpiSupport: { fontSize: 11, lineHeight: 15 },
  middleRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  chartCard: { flex: 444, minWidth: 0, height: 240, backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, lineHeight: 22 },
  chart: { height: 176, width: '100%' },
  chartBars: { height: 137, width: '93.5%', marginLeft: '1%', flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 28, borderRadius: 5 },
  chartLabels: { width: '93.5%', marginLeft: '1%', flexDirection: 'row', marginTop: 8 },
  chartLabel: { flex: 1, textAlign: 'center', color: ADMIN_COLORS.secondaryText, fontSize: 11, lineHeight: 15 },
  pendingCard: { width: '100%', minWidth: 0, minHeight: 195, backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 16, gap: 11 },
  pendingRow: { height: 36, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingCount: { fontSize: 17, lineHeight: 24, color: ADMIN_COLORS.primary },
  pendingLabel: { flex: 1, fontSize: 12, lineHeight: 17 },
  recentCard: { minHeight: 166, backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 16, gap: 10 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentLink: { fontSize: 12, lineHeight: 17, color: ADMIN_COLORS.primary },
  activityRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', padding: 5, gap: 6 },
  activityTime: { width: 65, color: ADMIN_COLORS.secondaryText, fontSize: 12, lineHeight: 17 },
  activityDescription: { flex: 1, textAlign: 'center', fontSize: 12, lineHeight: 17 },
  activityStatus: { width: 92, textAlign: 'right', fontSize: 11, lineHeight: 15, color: ADMIN_COLORS.primary },
  empty: { fontSize: 12, lineHeight: 18, color: ADMIN_COLORS.secondaryText, paddingVertical: 10 },
  skeletonSections: { gap: 18 },
  skeletonSurface: { backgroundColor: '#E9EEF5', borderColor: '#E9EEF5' },
});

export const dashboardStyles = styles;

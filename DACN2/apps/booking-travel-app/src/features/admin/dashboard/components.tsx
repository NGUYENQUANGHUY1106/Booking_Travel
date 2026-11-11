import { Asset } from 'expo-asset';
import type { Href } from 'expo-router';
import { router, usePathname } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { ADMIN_COLORS, ADMIN_FONT } from '../theme';
import type { AdminDestination, DailyRevenue, DashboardKpi, PendingTask, RecentActivity } from './types';

const adminSectionHref = (section: string): Href =>
  ({ pathname: '/admin/[section]', params: { section } }) as unknown as Href;

export const ADMIN_NAVIGATION: { id: 'overview' | AdminDestination; label: string; mobileLabel?: string; icon: number; href: Href }[] = [
  { id: 'overview', label: 'Tổng quan', icon: require('../assets/overview.svg'), href: '/admin' as Href },
  { id: 'users', label: 'Người dùng', icon: require('../assets/users.svg'), href: adminSectionHref('users') },
  { id: 'ownerVerification', label: 'Xác minh chủ KS', icon: require('../assets/owner-verification.svg'), href: adminSectionHref('owner-verification') },
  { id: 'hotelModeration', label: 'Duyệt khách sạn', mobileLabel: 'Duyệt chỗ ở', icon: require('../assets/hotel-moderation.svg'), href: adminSectionHref('hotel-moderation') },
  { id: 'hotels', label: 'Quản lý khách sạn', mobileLabel: 'Khách sạn', icon: require('../assets/hotel-moderation.svg'), href: adminSectionHref('hotels') },
  { id: 'bookings', label: 'Đặt phòng', icon: require('../assets/bookings.svg'), href: adminSectionHref('bookings') },
  { id: 'payments', label: 'Thanh toán', icon: require('../assets/payments.svg'), href: adminSectionHref('payments') },
  { id: 'reviews', label: 'Đánh giá & báo cáo', icon: require('../assets/reviews.svg'), href: adminSectionHref('reviews') },
  { id: 'promotions', label: 'Ưu đãi', icon: require('../assets/promotions.svg'), href: adminSectionHref('promotions') },
  { id: 'analytics', label: 'Phân tích', icon: require('../assets/analytics.svg'), href: adminSectionHref('analytics') },
  { id: 'fraud', label: 'Cảnh báo AI', icon: require('../assets/fraud.svg'), href: adminSectionHref('fraud') },
  { id: 'audit', label: 'Nhật ký', icon: require('../assets/audit.svg'), href: adminSectionHref('audit') },
];

const API_NAVIGATION = new Set(['overview', 'users', 'ownerVerification', 'hotelModeration', 'hotels']);

export function isAdminDestinationAvailable(destination: AdminDestination | 'overview', apiMode: boolean) {
  return !apiMode || API_NAVIGATION.has(destination);
}

export function adminSectionFromPath(pathname: string): 'overview' | AdminDestination {
  const segments = pathname.split('/').filter(Boolean);
  const section = segments[1] === 'detail' ? segments[2] : segments[1];
  switch (section) {
    case 'users': return 'users';
    case 'owner-verification': return 'ownerVerification';
    case 'hotel-moderation': return 'hotelModeration';
    case 'hotels': return 'hotels';
    case 'bookings': return 'bookings';
    case 'payments': return 'payments';
    case 'reviews':
    case 'reports': return 'reviews';
    case 'promotions':
    case 'voucher': return 'promotions';
    case 'analytics': return 'analytics';
    case 'fraud': return 'fraud';
    case 'audit': return 'audit';
    default: return 'overview';
  }
}

export function adminTitleFromPath(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const section = segments[1] === 'detail' ? segments[2] : segments[1];
  if (segments[1] === 'detail') {
    const detailTitles: Record<string, string> = {
      users: 'Chi tiết người dùng', 'owner-verification': 'Hồ sơ chủ KS', 'hotel-moderation': 'Chi tiết chỗ ở',
      hotels: 'Chi tiết khách sạn', bookings: 'Chi tiết đặt phòng', payments: 'Chi tiết thanh toán',
      reports: 'Chi tiết báo cáo', fraud: 'Chi tiết cảnh báo',
    };
    return detailTitles[section] ?? 'Chi tiết';
  }
  if (section === 'hotels') return 'Quản lý chỗ ở';
  if (section === 'voucher') return 'Ưu đãi';
  const active = ADMIN_NAVIGATION.find((item) => item.id === adminSectionFromPath(pathname));
  return active?.mobileLabel ?? active?.label ?? 'Tổng quan';
}

export function openAdminDestination(destination: AdminDestination | 'overview', onUnavailable: (label: string) => void, apiMode = false) {
  const item = ADMIN_NAVIGATION.find((entry) => entry.id === destination);
  if (!item) return;
  if (!isAdminDestinationAvailable(destination, apiMode)) onUnavailable(item.label);
  else if (item.href) router.push(item.href);
  else onUnavailable(item.label);
}

function AdminText({ children, style, weight = 'regular', ...props }: PropsWithChildren<{ style?: object; weight?: keyof typeof ADMIN_FONT; accessibilityRole?: 'header' | 'text'; numberOfLines?: number }>) {
  return <Text {...props} style={[{ color: ADMIN_COLORS.heading, fontFamily: ADMIN_FONT[weight] }, style]}>{children}</Text>;
}

export function AdminSidebar({ compact, onUnavailable, onLogout, apiMode = false }: { compact: boolean; onUnavailable: (label: string) => void; onLogout?: () => void; apiMode?: boolean }) {
  const pathname = usePathname();
  const activeSection = adminSectionFromPath(pathname);
  return <View style={[styles.sidebar, compact && styles.sidebarCompact]}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarScroll} style={{ flex: 1 }}>
      <View style={[styles.brand, compact && styles.brandCompact]}>
        {compact ? <AdminText weight="bold" style={styles.brandShort}>BT</AdminText> : <>
          <AdminText weight="bold" style={styles.brandTitle}>BOOKING TRAVEL</AdminText>
          <AdminText weight="semibold" style={styles.brandSubtitle}>ADMIN CONSOLE</AdminText>
        </>}
      </View>
      {ADMIN_NAVIGATION.map((item) => {
        const active = item.id === activeSection;
        const available = isAdminDestinationAvailable(item.id, apiMode);
        return <Pressable
          key={item.id}
          accessibilityLabel={item.label}
          accessibilityRole="button"
          accessibilityState={{ selected: active, disabled: !available }}
          accessibilityHint={!available ? 'Chức năng chưa có dữ liệu thật' : undefined}
          disabled={!available}
          onPress={() => openAdminDestination(item.id, onUnavailable, apiMode)}
          style={({ pressed }) => [styles.navItem, active && styles.navActive, !available && styles.navUnavailable, pressed && { opacity: 0.75 }]}
        >
          <SvgUri height={18} uri={Asset.fromModule(item.icon).uri} width={18} />
          {!compact && <AdminText weight={active ? 'semibold' : 'medium'} numberOfLines={1} style={[styles.navLabel, !active && styles.navLabelInactive]}>{item.label}</AdminText>}
        </Pressable>;
      })}
    </ScrollView>
    {onLogout ? <Pressable accessibilityLabel="Đăng xuất Admin" accessibilityRole="button" onPress={onLogout} style={styles.logoutButton}><AdminText weight="semibold" style={styles.logoutLabel}>Đăng xuất</AdminText></Pressable> : null}
  </View>;
}

export function DashboardKpiCard({ kpi, loading = false, onRetry }: { kpi: DashboardKpi; loading?: boolean; onRetry?: () => void }) {
  const supportingColor = kpi.tone === 'positive' ? ADMIN_COLORS.positive : kpi.tone === 'warning' ? ADMIN_COLORS.warning : ADMIN_COLORS.primary;
  return <View style={styles.kpiCard}>
    <AdminText weight="medium" style={styles.kpiLabel}>{kpi.label}</AdminText>
    {loading ? <ActivityIndicator accessibilityLabel={`Đang tải ${kpi.label}`} color={ADMIN_COLORS.primary} style={styles.kpiLoading} /> : <AdminText weight="bold" style={styles.kpiValue}>{kpi.displayValue}</AdminText>}
    <AdminText weight="medium" style={[styles.kpiSupport, { color: supportingColor }]}>{kpi.supportingText}</AdminText>
    {onRetry ? <Pressable accessibilityRole="button" onPress={onRetry}><AdminText weight="semibold" style={styles.retryLink}>Thử lại</AdminText></Pressable> : null}
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

function PendingTaskRow({ task, onUnavailable, apiMode }: { task: PendingTask; onUnavailable: (label: string) => void; apiMode: boolean }) {
  const mobile = useWindowDimensions().width < 768;
  const available = task.state === undefined && Boolean(task.destination);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${task.label}: ${task.state === 'loading' ? 'đang tải' : task.state === 'error' ? 'lỗi tải dữ liệu' : task.state === 'unavailable' ? 'chưa khả dụng' : task.count}`} accessibilityState={{ disabled: !available && !task.onRetry }} disabled={!available && !task.onRetry} onPress={() => { if (task.onRetry && task.state === 'error') task.onRetry(); else if (task.destination && available) openAdminDestination(task.destination, onUnavailable, apiMode); }} style={({ pressed }) => [styles.pendingRow, mobile && styles.pendingRowMobile, pressed && { opacity: 0.65 }]}>
    <AdminText weight="bold" style={styles.pendingCount}>{task.count === null ? '—' : String(task.count).padStart(2, '0')}</AdminText>
    <View style={styles.pendingCopy}><AdminText weight="medium" style={styles.pendingLabel} numberOfLines={mobile ? undefined : 2}>{task.label}</AdminText>{task.state ? <AdminText style={styles.pendingNote}>{task.state === 'loading' ? 'Đang tải...' : task.state === 'error' ? 'Không tải được · Thử lại' : 'Chưa khả dụng'}</AdminText> : null}</View>
  </Pressable>;
}

export function PendingTasksPanel({ tasks, onUnavailable, apiMode = false }: { tasks: PendingTask[]; onUnavailable: (label: string) => void; apiMode?: boolean }) {
  return <View style={styles.pendingCard}>
    <AdminText weight="semibold" style={styles.cardTitle}>Cần xử lý</AdminText>
    {tasks.length ? tasks.map((task) => <PendingTaskRow key={task.id} task={task} onUnavailable={onUnavailable} apiMode={apiMode} />) : <AdminText style={styles.empty}>Không có mục nào cần xử lý</AdminText>}
  </View>;
}

function RecentActivityRow({ activity, onUnavailable }: { activity: RecentActivity; onUnavailable: (label: string) => void }) {
  const mobile = useWindowDimensions().width < 768;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${activity.time}, ${activity.description}, ${activity.status}`} accessibilityState={{ disabled: !activity.destination }} disabled={!activity.destination} onPress={() => { if (activity.destination) openAdminDestination(activity.destination, onUnavailable); }} style={({ pressed }) => [styles.activityRow, mobile && styles.activityRowMobile, pressed && { opacity: 0.65 }]}>
    <AdminText style={[styles.activityTime, mobile && styles.activityTimeMobile]}>{activity.time}</AdminText>
    <AdminText weight="medium" style={[styles.activityDescription, mobile && styles.activityDescriptionMobile]} numberOfLines={mobile ? undefined : 2}>{activity.description}</AdminText>
    <AdminText weight="semibold" style={[styles.activityStatus, activity.tone === 'warning' && { color: ADMIN_COLORS.warning }, mobile && styles.activityStatusMobile]}>{activity.status}</AdminText>
  </Pressable>;
}

export function RecentActivityPanel({ activities, onUnavailable, loading = false, error = false, onRetry, logAvailable = true }: { activities: RecentActivity[]; onUnavailable: (label: string) => void; loading?: boolean; error?: boolean; onRetry?: () => void; logAvailable?: boolean }) {
  return <View style={styles.recentCard}>
    <View style={styles.recentHeader}>
      <AdminText weight="semibold" style={styles.cardTitle}>Hoạt động gần đây</AdminText>
      {logAvailable ? <Pressable accessibilityRole="button" onPress={() => openAdminDestination('audit', onUnavailable)}><AdminText weight="semibold" style={styles.recentLink}>Xem nhật ký</AdminText></Pressable> : <AdminText style={styles.pendingNote}>Nhật ký chưa khả dụng</AdminText>}
    </View>
    {loading ? <ActivityIndicator accessibilityLabel="Đang tải hoạt động gần đây" color={ADMIN_COLORS.primary} /> : error ? <View><AdminText style={styles.empty}>Không tải được hoạt động gần đây.</AdminText>{onRetry ? <Pressable accessibilityRole="button" onPress={onRetry}><AdminText weight="semibold" style={styles.retryLink}>Thử lại</AdminText></Pressable> : null}</View> : activities.length ? activities.map((activity) => <RecentActivityRow key={activity.id} activity={activity} onUnavailable={onUnavailable} />) : <AdminText style={styles.empty}>Chưa có hoạt động gần đây</AdminText>}
  </View>;
}

export function DashboardSkeleton({ stacked = false }: { stacked?: boolean }) {
  return <View style={styles.skeletonSections}>
    <View style={styles.kpiGrid}>{[0, 1, 2, 3].map((key) => <View key={key} style={[styles.kpiCard, stacked && styles.skeletonKpiStacked, styles.skeletonSurface]} />)}</View>
    <View style={[styles.middleRow, stacked && styles.skeletonMiddleStacked]}><View style={[styles.chartCard, stacked && styles.skeletonFullWidth, styles.skeletonSurface]} /><View style={[styles.pendingCard, stacked ? styles.skeletonFullWidth : { flex: 282 }, styles.skeletonSurface]} /></View>
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
  navUnavailable: { opacity: 0.55 },
  navLabel: { fontSize: 13, lineHeight: 18, color: '#FFFFFF' },
  navLabelInactive: { color: 'rgba(255,255,255,0.82)' },
  logoutButton: { minHeight: 48, marginHorizontal: 16, marginBottom: 16, paddingHorizontal: 12, justifyContent: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  logoutLabel: { color: '#FFFFFF', fontSize: 13 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard: { flexGrow: 1, flexBasis: 0, minWidth: 0, minHeight: 110, padding: 14, gap: 8, backgroundColor: ADMIN_COLORS.surface, borderColor: ADMIN_COLORS.border, borderWidth: 1, borderRadius: 12 },
  kpiLabel: { fontSize: 12, lineHeight: 17, color: ADMIN_COLORS.secondaryText },
  kpiValue: { fontSize: 23, lineHeight: 32 },
  kpiSupport: { fontSize: 11, lineHeight: 15 },
  kpiLoading: { alignSelf: 'flex-start', height: 32 },
  retryLink: { color: ADMIN_COLORS.primary, fontSize: 11, lineHeight: 16 },
  middleRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  chartCard: { flex: 444, minWidth: 0, height: 240, backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 16, gap: 10 },
  cardTitle: { fontSize: 16, lineHeight: 22 },
  chart: { height: 176, width: '100%' },
  chartBars: { height: 137, width: '93.5%', marginLeft: '1%', flexDirection: 'row', alignItems: 'flex-end' },
  barCell: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', maxWidth: 28, borderRadius: 5 },
  chartLabels: { width: '93.5%', marginLeft: '1%', flexDirection: 'row', marginTop: 8 },
  chartLabel: { flex: 1, textAlign: 'center', color: ADMIN_COLORS.secondaryText, fontSize: 11, lineHeight: 15 },
  pendingCard: { width: '100%', minWidth: 0, minHeight: 195, backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 16, gap: 11 },
  pendingRow: { height: 36, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pendingRowMobile: { height: undefined, minHeight: 48 },
  pendingCount: { fontSize: 17, lineHeight: 24, color: ADMIN_COLORS.primary },
  pendingLabel: { flex: 1, fontSize: 12, lineHeight: 17 },
  pendingCopy: { flex: 1, gap: 2 },
  pendingNote: { color: ADMIN_COLORS.secondaryText, fontSize: 10, lineHeight: 14 },
  recentCard: { minHeight: 166, backgroundColor: ADMIN_COLORS.surface, borderRadius: 12, padding: 16, gap: 10 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentLink: { fontSize: 12, lineHeight: 17, color: ADMIN_COLORS.primary },
  activityRow: { minHeight: 27, flexDirection: 'row', alignItems: 'center', padding: 5, gap: 6 },
  activityRowMobile: { flexDirection: 'column', alignItems: 'flex-start', minHeight: 48, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: ADMIN_COLORS.border },
  activityTime: { width: 65, color: ADMIN_COLORS.secondaryText, fontSize: 12, lineHeight: 17 },
  activityTimeMobile: { width: '100%' },
  activityDescription: { flex: 1, textAlign: 'center', fontSize: 12, lineHeight: 17 },
  activityDescriptionMobile: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', textAlign: 'left', width: '100%' },
  activityStatus: { width: 92, textAlign: 'right', fontSize: 11, lineHeight: 15, color: ADMIN_COLORS.primary },
  activityStatusMobile: { width: '100%', textAlign: 'left' },
  empty: { fontSize: 12, lineHeight: 18, color: ADMIN_COLORS.secondaryText, paddingVertical: 10 },
  skeletonSections: { gap: 18 },
  skeletonKpiStacked: { flexBasis: '47%' },
  skeletonMiddleStacked: { flexDirection: 'column' },
  skeletonFullWidth: { flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: '100%' },
  skeletonSurface: { backgroundColor: '#E9EEF5', borderColor: '#E9EEF5' },
});

export const dashboardStyles = styles;

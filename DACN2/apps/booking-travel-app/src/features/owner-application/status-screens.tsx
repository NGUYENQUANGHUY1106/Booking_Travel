import { router, type Href, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { OwnerButton, OwnerScaffold } from '@/features/hotel-owner/components';
import { ownerColors } from '@/features/hotel-owner/styles/tokens';
import { refreshApiSession, useTravelerStore } from '@/features/traveler/store';

import { useOwnerCurrent, useOwnerNotifications, type ApplicationStatus, type OwnerApplication, type OwnerCurrent } from './api';

const STATUS_COPY: Record<ApplicationStatus, { symbol: string; title: string; description: string; background: string; accent: string }> = {
  DRAFT: { symbol: '✎', title: 'Hồ sơ chưa hoàn thành', description: 'Bạn cần hoàn thiện thông tin và giấy tờ xác minh trước khi gửi hồ sơ đến quản trị viên.', background: '#DBEAFE', accent: ownerColors.primaryDark },
  PENDING: { symbol: '◷', title: 'Đang chờ xác minh', description: 'Hồ sơ của bạn đã được gửi thành công và đang chờ quản trị viên xét duyệt.', background: ownerColors.yellowSoft, accent: ownerColors.warning },
  VERIFIED: { symbol: '✓', title: 'Xác minh thành công', description: 'Hồ sơ Chủ khách sạn của bạn đã được xác minh thành công.', background: '#DCFCE7', accent: ownerColors.success },
  REJECTED: { symbol: '!', title: 'Hồ sơ chưa được chấp thuận', description: 'Vui lòng xem lý do từ chối, chỉnh sửa thông tin cần thiết và gửi lại hồ sơ.', background: '#FEE2E2', accent: '#B91C1C' },
  SUSPENDED: { symbol: '⦸', title: 'Quyền Chủ khách sạn đang bị đình chỉ', description: 'Quyền sử dụng chức năng Chủ khách sạn của bạn hiện không hoạt động.', background: '#F3F4F6', accent: '#B91C1C' },
};

function dateLabel(value?: string | null) {
  if (!value) return 'Chưa có';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa có' : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function DetailCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <View style={styles.detailGroup}><Text style={styles.label}>{label}</Text><View style={styles.card}><Text style={styles.cardTitle}>{value}</Text>{hint ? <Text style={styles.body}>{hint}</Text> : null}</View></View>;
}

function StatusCard({ application }: { application: OwnerApplication }) {
  const copy = STATUS_COPY[application.status];
  return <View accessibilityLabel={`Trạng thái xác minh: ${copy.title}`} style={[styles.statusCard, { backgroundColor: copy.background }]}>
    <View style={styles.statusHeading}><Text style={[styles.statusSymbol, { color: copy.accent }]}>{copy.symbol}</Text><Text style={[styles.cardTitle, styles.statusTitle]}>{copy.title}</Text></View>
    <Text style={styles.body}>{copy.description}</Text>
    <Text style={styles.caption}>Cập nhật: {dateLabel(application.updatedAt)}</Text>
  </View>;
}

function BackLink() {
  return <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹  Quay lại</Text></Pressable>;
}

function LoadingCards() {
  return <View accessibilityLabel="Đang tải trạng thái xác minh" style={styles.group}>
    <View style={[styles.card, styles.skeleton]} /><View style={[styles.card, styles.skeleton]} />
    <ActivityIndicator color={ownerColors.primary} />
  </View>;
}

function ApplicationSummary({ current }: { current: OwnerCurrent }) {
  return <>
    <View style={styles.card}><Text style={styles.cardTitle}>Trở thành chủ khách sạn</Text><Text style={styles.body}>Quản lý khách sạn của bạn sau khi xác minh hồ sơ.</Text></View>
    <DetailCard label="Tên pháp lý" value={current.applicant.fullName} hint="Thông tin từ tài khoản đã xác minh" />
    <DetailCard label="Thông tin liên hệ" value={current.applicant.phone || current.applicant.email || 'Chưa có'} hint={current.applicant.emailVerified || current.applicant.phoneVerified ? 'Đã xác minh' : 'Chưa xác minh'} />
  </>;
}

function ApplicationDetails({ application }: { application: OwnerApplication }) {
  return <>
    {application.businessName ? <DetailCard label="Cơ sở kinh doanh" value={application.businessName} hint={application.businessAddress || undefined} /> : null}
    <View style={styles.card}><Text style={styles.cardTitle}>Thông tin hồ sơ</Text><Text style={styles.body}>Mã hồ sơ: {application.id}</Text><Text style={styles.body}>Phiên bản: {application.version}</Text><Text style={styles.body}>Ngày gửi: {dateLabel(application.submittedAt)}</Text><Text style={styles.body}>Cập nhật: {dateLabel(application.updatedAt)}</Text>{application.reviewedAt ? <Text style={styles.body}>Xét duyệt: {dateLabel(application.reviewedAt)}</Text> : null}</View>
  </>;
}

function useStatusRefresh(userId?: string) {
  const current = useOwnerCurrent(userId);
  const notifications = useOwnerNotifications(userId);
  const refetchCurrent = current.refetch;
  const refetchNotifications = notifications.refetch;
  const firstFocus = useRef(true);
  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try { await Promise.all([refetchCurrent(), refetchNotifications()]); }
    finally { setRefreshing(false); }
  }, [userId, refetchCurrent, refetchNotifications]);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    if (firstFocus.current) firstFocus.current = false;
    else void refresh();
  }, [userId, refresh]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => subscription.remove();
  }, [refresh]);
  return { current, notifications, refreshing, refresh };
}

function useOwnerMode(current: ReturnType<typeof useOwnerCurrent>) {
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState('');
  const enter = async () => {
    if (switching) return;
    setSwitching(true);
    setSwitchError('');
    try {
      const checked = await current.refetch();
      if (checked.error || !checked.data?.ownerEntitlementActive) throw new Error('Quyền Chủ khách sạn chưa hoạt động. Vui lòng kiểm tra lại trạng thái.');
      if (checked.data.application && checked.data.application.status !== 'VERIFIED') throw new Error('Hồ sơ chưa được xác minh.');
      if (!await refreshApiSession()) throw new Error('Không thể đồng bộ quyền. Vui lòng kiểm tra mạng hoặc đăng nhập lại.');
      const session = useTravelerStore.getState().session;
      if (session?.mode !== 'api' || session.role !== 'HOTEL_OWNER') throw new Error('Quyền chưa được cập nhật. Vui lòng thử lại.');
      const latest = await current.refetch();
      if (latest.error || !latest.data?.ownerEntitlementActive) throw new Error('Quyền Chủ khách sạn chưa hoạt động.');
      router.replace('/hotel-owner' as Href);
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : 'Không thể chuyển vai trò.');
    } finally { setSwitching(false); }
  };
  return { switching, switchError, enter };
}

function StatusBody({ current, refresh, refreshing }: { current: ReturnType<typeof useOwnerCurrent>; refresh: () => Promise<void>; refreshing: boolean }) {
  const mode = useOwnerMode(current);
  const session = useTravelerStore((state) => state.session);
  if (current.isPending && !current.data) return <LoadingCards />;
  if (current.isError && !current.data) return <View style={styles.group}><View style={styles.card}><Text style={styles.cardTitle}>Không thể tải trạng thái xác minh</Text><Text style={styles.body}>Vui lòng kiểm tra kết nối và thử lại.</Text></View><OwnerButton label="Thử lại" onPress={() => void refresh()} /></View>;
  const data = current.data;
  if (!data) return null;
  const application = data.application;
  if (!application) return <View style={styles.group}><View style={styles.card}><Text style={styles.cardTitle}>Bạn chưa có hồ sơ đăng ký Chủ khách sạn.</Text><Text style={styles.body}>{session?.role === 'HOTEL_OWNER' ? 'Tài khoản Chủ khách sạn chưa liên kết hồ sơ xác minh. Vui lòng liên hệ quản trị viên.' : 'Bạn có thể bắt đầu đăng ký và theo dõi kết quả tại đây.'}</Text></View>{session?.role === 'USER' ? <OwnerButton label="Đăng ký trở thành Chủ khách sạn" onPress={() => router.push('/owner-application' as Href)} /> : null}</View>;
  return <View style={styles.group}>
    {current.isError ? <View style={styles.notice}><Text style={styles.noticeText}>Đang hiển thị dữ liệu đã lưu. Không thể xác nhận trạng thái mới khi mất kết nối.</Text></View> : null}
    <ApplicationSummary current={data} />
    <StatusCard application={application} />
    {application.status === 'REJECTED' ? <View style={styles.feedback}><Text style={styles.cardTitle}>Lý do từ chối</Text><Text style={styles.body}>{application.rejectionReason?.trim() || 'Chưa có phản hồi chi tiết. Vui lòng liên hệ bộ phận hỗ trợ.'}</Text>{application.reviewedAt ? <Text style={styles.caption}>Xét duyệt: {dateLabel(application.reviewedAt)}</Text> : null}</View> : null}
    {application.status === 'DRAFT' || application.status === 'REJECTED' ? <OwnerButton label={application.status === 'DRAFT' ? 'Tiếp tục hoàn thiện hồ sơ' : 'Chỉnh sửa hồ sơ'} onPress={() => router.push('/owner-application/form' as Href)} /> : null}
    {application.status === 'VERIFIED' ? <OwnerButton label={mode.switching ? 'Đang kiểm tra quyền…' : 'Chuyển sang chế độ Chủ khách sạn'} disabled={mode.switching || refreshing || current.isError} onPress={() => void mode.enter()} /> : null}
    {application.status === 'PENDING' ? <OwnerButton label={refreshing ? 'Đang kiểm tra…' : 'Kiểm tra trạng thái'} disabled={refreshing} onPress={() => void refresh()} /> : null}
    {mode.switchError ? <Text style={styles.error}>{mode.switchError}</Text> : null}
    <ApplicationDetails application={application} />
    {application.status !== 'PENDING' ? <OwnerButton label={refreshing ? 'Đang tải…' : 'Tải lại trạng thái'} secondary disabled={refreshing} onPress={() => void refresh()} /> : null}
  </View>;
}

export function OwnerVerificationStatusScreen() {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' ? session.userId : undefined;
  const { current, notifications, refreshing, refresh } = useStatusRefresh(userId);
  const currentNotification = notifications.data?.find((item) => item.version === current.data?.application?.version);
  if (!userId) return <OwnerScaffold title="Trạng thái xác minh"><View style={styles.group}><View style={styles.card}><Text style={styles.cardTitle}>Đăng nhập để xem hồ sơ</Text><Text style={styles.body}>Trạng thái xác minh được lưu theo tài khoản của bạn.</Text></View><OwnerButton label="Đăng nhập" onPress={() => router.push('/auth/login' as Href)} /></View></OwnerScaffold>;
  return <OwnerScaffold title="Trạng thái xác minh"><View testID="OWN-UI-03" style={styles.group}>
    <BackLink /><Text style={styles.body}>Theo dõi quá trình xét duyệt hồ sơ đăng ký Chủ khách sạn của bạn.</Text>
    <StatusBody current={current} refresh={refresh} refreshing={refreshing} />
    {currentNotification && current.data?.application?.status !== 'PENDING' ? <View style={styles.card}><Text style={styles.cardTitle}>{currentNotification.title}</Text><Text style={styles.body}>{currentNotification.body}</Text></View> : null}
    <OwnerButton label="Về tài khoản du khách" secondary onPress={() => router.replace('/user/profile' as Href)} />
  </View></OwnerScaffold>;
}

export function OwnerRoleSwitcherScreen() {
  const session = useTravelerStore((state) => state.session);
  const userId = session?.mode === 'api' ? session.userId : undefined;
  const { current, refreshing, refresh } = useStatusRefresh(userId);
  const mode = useOwnerMode(current);
  const status = current.data?.application?.status;
  const active = Boolean(current.data?.ownerEntitlementActive && (status === 'VERIFIED' || !current.data?.application));
  return <OwnerScaffold title="Chuyển vai trò"><View testID="OWN-UI-04" style={styles.group}>
    <BackLink /><View style={styles.card}><Text style={styles.cardTitle}>Trở thành chủ khách sạn</Text><Text style={styles.body}>Quản lý khách sạn của bạn sau khi xác minh hồ sơ.</Text></View>
    {!userId ? <View style={styles.card}><Text style={styles.body}>Đăng nhập để kiểm tra quyền chuyển vai trò.</Text></View> : current.isPending && !current.data ? <LoadingCards /> : current.isError ? <View style={styles.notice}><Text style={styles.noticeText}>Không thể kiểm tra quyền hiện tại. Vui lòng kết nối mạng rồi thử lại.</Text><OwnerButton label="Thử lại" secondary onPress={() => void refresh()} /></View> : <>
      {current.data ? <><DetailCard label="Tên pháp lý" value={current.data.applicant.fullName} /><DetailCard label="Thông tin liên hệ" value={current.data.applicant.phone || current.data.applicant.email || 'Chưa có'} />{current.data.application ? <StatusCard application={current.data.application} /> : null}</> : null}
      <View style={styles.card}><Text style={styles.cardTitle}>Chế độ Du khách</Text><Text style={styles.body}>Tìm kiếm và đặt phòng bằng tài khoản hiện tại.</Text><OwnerButton label="Tiếp tục ở chế độ Du khách" secondary onPress={() => router.replace('/user/profile' as Href)} /></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Chế độ Chủ khách sạn</Text><Text style={styles.body}>{active ? 'Quản lý khách sạn, phòng và đơn đặt phòng.' : 'Chỉ khả dụng khi hồ sơ được xác minh và quyền đang hoạt động.'}</Text>{active ? <OwnerButton label={mode.switching ? 'Đang kiểm tra quyền…' : 'Chuyển sang Chủ khách sạn'} disabled={mode.switching || refreshing} onPress={() => void mode.enter()} /> : <OwnerButton label="Theo dõi xác minh" secondary onPress={() => router.push('/owner-application/status' as Href)} />}</View>
      {mode.switchError ? <Text style={styles.error}>{mode.switchError}</Text> : null}
    </>}
  </View></OwnerScaffold>;
}

const styles = StyleSheet.create({
  group: { gap: 16 },
  card: { backgroundColor: ownerColors.surface, borderRadius: 12, padding: 14, gap: 10 },
  cardTitle: { color: ownerColors.text, fontSize: 16, fontWeight: '700', lineHeight: 24 },
  body: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  label: { color: '#374151', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  detailGroup: { gap: 12 },
  statusCard: { borderRadius: 12, padding: 14, gap: 10 },
  statusHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusSymbol: { width: 22, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  statusTitle: { flex: 1 },
  caption: { color: ownerColors.muted, fontSize: 12, lineHeight: 16 },
  feedback: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 14, gap: 10 },
  notice: { backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, gap: 10 },
  noticeText: { color: '#92400E', fontSize: 14, lineHeight: 20 },
  error: { color: '#B91C1C', fontSize: 14, lineHeight: 20 },
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { color: ownerColors.primary, fontSize: 15, fontWeight: '700' },
  skeleton: { height: 92, backgroundColor: '#E5E7EB' },
});

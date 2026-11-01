import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useOwnerCurrent } from '@/features/owner-application/api';
import { useTravelerStore } from '@/features/traveler/store';
import { OwnerButton } from '../components';
import {
  DashboardDatePicker,
  HotelPicker,
} from '../dashboard/DashboardFilters';
import {
  DashboardMetrics,
  DashboardNoHotel,
  DashboardSections,
  DashboardSkeleton,
} from '../dashboard/DashboardPanels';
import {
  calendarDate,
  dashboardKey,
  DASHBOARD_TIME_ZONE,
  formatDashboardDate,
  HOTEL_STATUS_LABEL,
  type DashboardFilter,
} from '../dashboard/model';
import {
  responseStatus,
  useDashboardHotels,
  useOwnerDashboard,
} from '../dashboard/queries';
import { clearOwnerDashboardCache } from '../dashboard/model';
import { dashboardStyles as s } from '../dashboard/styles';

export function OwnerDashboardScreen() {
  const session = useTravelerStore((state) => state.session);
  if (session?.mode !== 'api')
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.content}>
          <Text style={s.heading}>Đăng nhập để xem tổng quan</Text>
          <Text style={s.body}>
            Dashboard sử dụng dữ liệu khách sạn của tài khoản đã xác minh.
          </Text>
          <OwnerButton
            label="Đăng nhập"
            onPress={() => router.replace('/auth/login')}
          />
        </View>
      </SafeAreaView>
    );
  return (
    <DashboardContent
      key={`${session.userId}:${session.sessionId}:${session.role}`}
      userId={session.userId}
      sessionId={session.sessionId}
      owner={session.role === 'HOTEL_OWNER'}
    />
  );
}

function DashboardContent({
  userId,
  sessionId,
  owner,
}: {
  userId: string;
  sessionId: string;
  owner: boolean;
}) {
  const client = useQueryClient();
  const verification = useOwnerCurrent(owner ? userId : undefined);
  const [filter, setFilter] = useState<DashboardFilter>(() => {
    const today = calendarDate(new Date());
    return { dateFrom: today, dateTo: today, timeZone: DASHBOARD_TIME_ZONE };
  });
  const [sheet, setSheet] = useState<'hotels' | 'dates' | null>(null);
  const [notice, setNotice] = useState('');
  const enabled = owner && Boolean(verification.data?.ownerEntitlementActive);
  const query = useOwnerDashboard(userId, sessionId, filter, enabled);
  const hotels = useDashboardHotels(
    userId,
    sessionId,
    enabled && sheet === 'hotels',
  );
  const firstFocus = useRef(true);
  const refetch = query.refetch;
  const refresh = useCallback(() => {
    if (enabled) void refetch();
  }, [enabled, refetch]);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else refresh();
    }, [refresh]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  const statuses = [responseStatus(query.error), responseStatus(hotels.error)];
  const status =
    statuses.find((value) => value === 401 || value === 403) ??
    responseStatus(query.error);
  useEffect(() => {
    if (status === 401 || status === 403) clearOwnerDashboardCache(client);
  }, [status, client]);
  if (!owner || status === 401 || status === 403)
    return (
      <Redirect
        href={
          (status === 401 ? '/auth/login' : '/owner-application/status') as Href
        }
      />
    );
  const data =
    status === 401 || status === 403 || status === 404 ? undefined : query.data;
  const unavailable =
    query.isError || query.fetchStatus === 'paused' || verification.isError;
  const hotelName =
    data?.scope.hotel?.name ??
    (filter.hotelId ? 'Khách sạn đã chọn' : 'Tất cả khách sạn');
  const retry = () => {
    void query.refetch();
  };
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[s.safe, data?.scope.hotelCount === 0 && s.emptySafe]}
    >
      <ScrollView
        testID="owner-dashboard-scroll"
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isFetching && Boolean(data)}
            onRefresh={retry}
          />
        }
      >
        {notice ? (
          <View style={s.notice}>
            <Text style={s.body}>{notice}</Text>
          </View>
        ) : null}
        {status === 404 ? (
          <View style={s.notice}>
            <Text style={s.body}>
              Khách sạn đã chọn không còn trong phạm vi quản lý.
            </Text>
            <OwnerButton
              label="Xem tất cả khách sạn"
              onPress={() => {
                client.removeQueries({
                  queryKey: dashboardKey(userId, sessionId, filter),
                  exact: true,
                });
                setFilter((old) => ({ ...old, hotelId: undefined }));
                setNotice('Đã chuyển về tất cả khách sạn.');
              }}
            />
          </View>
        ) : null}
        {unavailable && status !== 404 ? (
          <View style={s.notice}>
            <Text accessibilityRole="alert" style={s.body}>
              {data
                ? 'Đang xem dữ liệu đã lưu. Chưa thể cập nhật; hãy kiểm tra kết nối mạng.'
                : 'Không thể tải tổng quan. Vui lòng kiểm tra kết nối và thử lại.'}
            </Text>
            <OwnerButton secondary label="Thử lại" onPress={retry} />
          </View>
        ) : null}
        {data?.scope.hotelCount !== 0 ? (
          <View style={s.hero}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chọn khách sạn. ${hotelName}`}
              onPress={() => setSheet('hotels')}
              style={s.selector}
            >
              <Text numberOfLines={2} style={s.eyebrow}>
                {hotelName.toLocaleUpperCase('vi-VN')} ⌄
              </Text>
            </Pressable>
            <Text accessibilityRole="header" style={s.title}>
              Hôm nay cần làm gì?
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Chọn khoảng ngày thống kê"
              onPress={() => setSheet('dates')}
              style={s.dateTrigger}
            >
              <Text style={s.body}>
                {formatDashboardDate(filter.dateFrom)}
                {filter.dateFrom !== filter.dateTo
                  ? ` – ${formatDashboardDate(filter.dateTo)}`
                  : ''}{' '}
                · Giờ Việt Nam ⌄
              </Text>
              {data?.scope.hotel ? (
                <Text style={s.caption}>
                  {HOTEL_STATUS_LABEL[data.scope.hotel.status]}
                </Text>
              ) : null}
            </Pressable>
          </View>
        ) : null}
        {!data && !unavailable ? <DashboardSkeleton /> : null}
        {data && data.scope.hotelCount === 0 ? (
          <DashboardNoHotel />
        ) : data ? (
          <>
            <DashboardMetrics data={data} />
            <Text style={s.caption}>
              So sánh: {formatDashboardDate(data.scope.previousFrom)} –{' '}
              {formatDashboardDate(data.scope.previousTo)}. Bộ lọc đếm đặt phòng
              tạo mới trong kỳ.
            </Text>
            <DashboardSections data={data} />
          </>
        ) : null}
        {data ? (
          <OwnerButton
            secondary
            label={query.isFetching ? 'Đang cập nhật…' : 'Làm mới tổng quan'}
            disabled={query.isFetching}
            onPress={retry}
          />
        ) : null}
      </ScrollView>
      {sheet === 'hotels' ? (
        <HotelPicker
          items={
            hotels.isError
              ? []
              : (hotels.data?.pages.flatMap((p) => p.items) ?? [])
          }
          selected={filter.hotelId}
          loading={hotels.isFetching}
          error={hotels.isError}
          more={hotels.hasNextPage}
          choose={(hotelId) => {
            setFilter((old) => ({ ...old, hotelId }));
            setSheet(null);
            setNotice('');
          }}
          retry={() => {
            void hotels.refetch();
          }}
          loadMore={() => {
            void hotels.fetchNextPage();
          }}
          close={() => setSheet(null)}
        />
      ) : null}
      {sheet === 'dates' ? (
        <DashboardDatePicker
          value={filter}
          apply={(dateFrom, dateTo) => {
            setFilter((old) => ({ ...old, dateFrom, dateTo }));
            setSheet(null);
          }}
          close={() => setSheet(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

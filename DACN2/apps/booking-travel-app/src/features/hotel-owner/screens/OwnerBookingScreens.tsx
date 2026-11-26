import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '@/services/api-client';
import { useTravelerStore } from '@/features/traveler/store';
import { InfoCard, OwnerButton, OwnerScaffold, SectionTitle } from '../components';
import { useOwnerHotels } from '../hotels/api';
import { ownerColors } from '../styles/tokens';

type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'EXPIRED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'REFUND_PENDING' | 'REFUNDED';
type BookingTab = 'all' | 'new' | 'upcoming' | 'checked-in' | 'completed' | 'cancelled';
type PaymentState = 'PENDING' | 'PAID' | 'PAY_AT_HOTEL' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
type OwnerBooking = {
  id: string; code: string; hotel: { id: string; name: string }; room: { id: string; name: string; type: string };
  checkIn: string; checkOut: string; adults: number; children: number; roomCount: number; nights: number;
  totalAmount: string; currency: string; status: BookingStatus; payment: { state: PaymentState };
  allowedActions: { canEditNote: boolean; canCheckIn: boolean; canCheckOut: boolean; canConfirmPropertyCollection: boolean };
};
export type OwnerBookingDetail = OwnerBooking & {
  guest: { name: string; email: string | null; phone: string | null };
  pricePerNight: string; nightlyRatesSnapshot: unknown; specialRequest: string | null; cancellationPolicy: string | null;
  paymentMethod: string; paymentDeadline: string | null; internalNote: string | null; internalNoteUpdatedAt: string | null;
  createdAt: string; updatedAt: string; cancelledAt: string | null;
  actualCheckInAt: string | null; actualCheckOutAt: string | null;
  completedAt: string | null; completionMethod: 'MANUAL_CHECKOUT' | 'AUTO_AFTER_GRACE_PERIOD' | null;
  handoverNeedsConfirmation: boolean;
};
type BookingPage = { items: OwnerBooking[]; total: number; limit: number; nextCursor: string | null };

const TABS: { id: BookingTab; label: string }[] = [
  { id: 'all', label: 'Tất cả' }, { id: 'new', label: 'Mới hôm nay' }, { id: 'upcoming', label: 'Sắp đến' },
  { id: 'checked-in', label: 'Đã nhận phòng' }, { id: 'completed', label: 'Hoàn tất' }, { id: 'cancelled', label: 'Hủy / hết hạn' },
];
const STATUS_FILTERS: BookingStatus[] = [
  'PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'REFUND_PENDING', 'REFUNDED',
];
export const STATUS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', EXPIRED: 'Hết hạn', CHECKED_IN: 'Đã nhận phòng',
  COMPLETED: 'Hoàn tất', CANCELLED: 'Đã hủy', REFUND_PENDING: 'Chờ hoàn tiền', REFUNDED: 'Đã hoàn tiền',
};
export const PAYMENT: Record<PaymentState, string> = {
  PENDING: 'Chưa xác nhận thanh toán', PAID: 'Đã thanh toán', PAY_AT_HOTEL: 'Chờ xác nhận thu tại khách sạn',
  SUCCESS: 'Đã thanh toán', FAILED: 'Thanh toán thất bại', CANCELLED: 'Thanh toán đã hủy',
  REFUND_PENDING: 'Chờ hoàn tiền', PARTIALLY_REFUNDED: 'Đã hoàn một phần', REFUNDED: 'Đã hoàn tiền',
};
export const dateLabel = (value: string) => {
  const day = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}` : 'Chưa rõ ngày';
};
const isDateInput = (value: string) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
export const amountLabel = (value: string, currency: string) => {
  const number = Number(value);
  return Number.isFinite(number) ? `${new Intl.NumberFormat('vi-VN').format(number)} ${currency === 'VND' ? '₫' : currency}` : 'Chưa có giá';
};
const isNightlyRate = (value: unknown): value is { date: string; price: string } => {
  if (!value || typeof value !== 'object') return false;
  const rate = value as Record<string, unknown>;
  return typeof rate.date === 'string' && typeof rate.price === 'string';
};
const errorLabel = (error: unknown) => isAxiosError(error) && [401, 403, 404].includes(error.response?.status ?? 0)
  ? 'Bạn không có quyền xem booking này hoặc phiên đăng nhập đã hết hạn.'
  : 'Không thể tải booking. Kiểm tra kết nối và thử lại.';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>;
}

function BookingCard({ booking }: { booking: OwnerBooking }) {
  return <InfoCard style={styles.bookingCard}>
    <Text style={styles.hotelName}>{booking.hotel.name}</Text>
    <Text style={styles.muted}>Mã {booking.code} · {booking.room.name}</Text>
    <Text style={styles.muted}>{dateLabel(booking.checkIn)} – {dateLabel(booking.checkOut)} · {booking.nights} đêm</Text>
    <Text style={styles.muted}>{booking.roomCount} phòng · {booking.adults + booking.children} khách</Text>
    <Text style={[styles.status, booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN' ? styles.good : styles.warning]}>● {STATUS[booking.status]}</Text>
    <Text style={styles.muted}>{PAYMENT[booking.payment.state] ?? booking.payment.state}</Text>
    <Text style={styles.total}>Tổng cộng {amountLabel(booking.totalAmount, booking.currency)}</Text>
    <OwnerButton secondary label="Xem chi tiết" onPress={() => router.push({ pathname: '/hotel-owner/screen/[id]', params: { id: 'booking-detail', bookingId: booking.id } } as never)} />
  </InfoCard>;
}

export function OwnerBookingsScreen() {
  const { hotelId: requestedHotelId } = useLocalSearchParams<{ hotelId?: string }>();
  const session = useTravelerStore((state) => state.session);
  const owner = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session : undefined;
  const hotels = useOwnerHotels(owner?.userId);
  const [selectedHotel, setSelectedHotel] = useState<{ source?: string; value: string }>();
  const hotelId = selectedHotel && selectedHotel.source === requestedHotelId ? selectedHotel.value : (requestedHotelId ?? '');
  const chooseHotel = (value: string) => setSelectedHotel({ source: requestedHotelId, value });
  const [tab, setTab] = useState<BookingTab>('all');
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showDates, setShowDates] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showHotelPicker, setShowHotelPicker] = useState(false);
  const client = useQueryClient();
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350); return () => clearTimeout(timer); }, [search]);
  const ownerId = owner?.userId;
  useFocusEffect(useCallback(() => { if (ownerId) void client.invalidateQueries({ queryKey: ['owner-bookings', ownerId] }); }, [client, ownerId]));
  const validDates = isDateInput(from) && isDateInput(to) && (!from || !to || from <= to);
  const query = useInfiniteQuery({
    queryKey: ['owner-bookings', owner?.userId, owner?.sessionId, hotelId, tab, status, debouncedSearch, from, to],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => (await apiClient.get<BookingPage>('/owner/bookings', {
      params: { hotelId: hotelId || undefined, tab, status: status || undefined, search: debouncedSearch || undefined,
        checkInFrom: from || undefined, checkInTo: to || undefined, after: pageParam, limit: 20 }, signal,
    })).data,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(owner && validDates), staleTime: 10_000, refetchOnReconnect: true,
  });
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  const filtered = Boolean(hotelId || tab !== 'all' || status || debouncedSearch || from || to);
  return <OwnerScaffold title="Đặt phòng của khách" testID="OWN-UI-21" onRefresh={owner ? () => { void query.refetch(); void hotels.refetch(); } : undefined} refreshing={query.isRefetching}>
    {!owner ? <InfoCard><Text style={styles.muted}>Đăng nhập bằng tài khoản Chủ khách sạn để xem booking.</Text><OwnerButton label="Đăng nhập" onPress={() => router.replace('/auth/login')} /></InfoCard> : <>
      <OwnerButton label="Quét QR / nhập mã nhận phòng" onPress={() => router.push({ pathname: '/hotel-owner/screen/[id]', params: { id: 'qr-checkin' } } as never)} />
      <SectionTitle>Khách sạn</SectionTitle>
      <Pressable accessibilityRole="button" onPress={() => setShowHotelPicker((value) => !value)} style={styles.input}><Text style={styles.filterLink}>{hotelId ? (hotels.data?.find((hotel) => hotel.id === hotelId)?.name ?? 'Chỗ ở đã chọn') : 'Tất cả chỗ ở'} {showHotelPicker ? '⌃' : '⌄'}</Text></Pressable>
      {showHotelPicker ? <View style={styles.wrap}><Chip label="Tất cả chỗ ở" active={!hotelId} onPress={() => { chooseHotel(''); setShowHotelPicker(false); }} />{hotels.data?.map((hotel) => <Chip key={hotel.id} label={hotel.name} active={hotelId === hotel.id} onPress={() => { chooseHotel(hotel.id); setShowHotelPicker(false); }} />)}</View> : null}
      {hotels.isError ? <Text style={styles.error}>Không tải được danh sách chỗ ở. Kéo xuống để thử lại.</Text> : null}
      <SectionTitle>Trạng thái</SectionTitle>
      <View style={styles.wrap}>{TABS.map((item) => <Chip key={item.id} label={item.label} active={tab === item.id && !status} onPress={() => { setTab(item.id); setStatus(''); }} />)}</View>
      <Pressable accessibilityRole="button" onPress={() => setShowStatuses((value) => !value)}><Text style={styles.filterLink}>Lọc trạng thái chi tiết {showStatuses ? '⌃' : '⌄'}</Text></Pressable>
      {showStatuses ? <View style={styles.wrap}><Chip label="Bỏ lọc" active={!status} onPress={() => setStatus('')} />{STATUS_FILTERS.map((value) => <Chip key={value} label={STATUS[value]} active={status === value} onPress={() => { setStatus(value); setTab('all'); }} />)}</View> : null}
      <TextInput accessibilityLabel="Tìm mã booking hoặc tên khách" placeholder="Tìm mã booking hoặc tên khách" placeholderTextColor={ownerColors.muted} value={search} onChangeText={setSearch} style={styles.input} />
      <Pressable accessibilityRole="button" onPress={() => setShowDates((value) => !value)}><Text style={styles.filterLink}>Lọc ngày nhận phòng {showDates ? '⌃' : '⌄'}</Text></Pressable>
      {showDates ? <View style={styles.dateRow}><TextInput accessibilityLabel="Từ ngày nhận phòng" placeholder="Từ YYYY-MM-DD" value={from} onChangeText={setFrom} style={[styles.input, styles.dateInput]} /><TextInput accessibilityLabel="Đến ngày nhận phòng" placeholder="Đến YYYY-MM-DD" value={to} onChangeText={setTo} style={[styles.input, styles.dateInput]} /></View> : null}
      {!validDates ? <Text style={styles.error}>Ngày lọc không hợp lệ. Dùng YYYY-MM-DD và chọn ngày bắt đầu trước ngày kết thúc.</Text> : null}
      {query.isPending && validDates ? <ActivityIndicator color={ownerColors.primary} /> : null}
      {query.isError ? <InfoCard><Text style={styles.error}>{errorLabel(query.error)}</Text><OwnerButton secondary label="Thử lại" onPress={() => void query.refetch()} /></InfoCard> : null}
      {query.data ? <Text style={styles.count}>{total} booking</Text> : null}
      {query.data && total === 0 ? <InfoCard><Text style={styles.hotelName}>{filtered ? 'Không có kết quả lọc' : 'Chưa có booking'}</Text><Text style={styles.muted}>{filtered ? 'Thử thay đổi khách sạn, trạng thái hoặc khoảng ngày.' : 'Booking mới của các chỗ ở bạn sở hữu sẽ hiển thị tại đây.'}</Text></InfoCard> : null}
      {items.map((booking) => <BookingCard key={booking.id} booking={booking} />)}
      {query.hasNextPage ? <OwnerButton secondary label={query.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'} disabled={query.isFetchingNextPage} onPress={() => void query.fetchNextPage()} /> : null}
    </>}
  </OwnerScaffold>;
}

export function BookingDetailScreen({ bookingId }: { bookingId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const owner = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session : undefined;
  const client = useQueryClient();
  const [noteDraft, setNoteDraft] = useState<{ bookingId: string; ownerId: string; text: string }>();
  const [saveError, setSaveError] = useState('');
  const [confirmedCollection, setConfirmedCollection] = useState(false);
  const [collectionMethod, setCollectionMethod] = useState<'CASH' | 'BANK_TRANSFER'>('CASH');
  const [collectionKey] = useState(() => `collect_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`);
  const [handoverKey] = useState(() => `handover_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`);
  const query = useQuery({
    queryKey: ['owner-booking-detail', owner?.userId, owner?.sessionId, bookingId],
    queryFn: async () => (await apiClient.get<OwnerBookingDetail>(`/owner/bookings/${bookingId}`)).data,
    enabled: Boolean(owner && bookingId), staleTime: 10_000, refetchOnReconnect: true,
  });
  const note = noteDraft && noteDraft.bookingId === bookingId && noteDraft.ownerId === owner?.userId ? noteDraft.text : (query.data?.internalNote ?? '');
  const ownerId = owner?.userId;
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { if (ownerId && bookingId) void refetch(); }, [ownerId, bookingId, refetch]));
  const save = useMutation({
    mutationFn: async () => (await apiClient.patch<OwnerBookingDetail>(`/owner/bookings/${bookingId}/internal-note`, { note })).data,
    onSuccess: (value) => { setSaveError(''); setNoteDraft(undefined); client.setQueryData(['owner-booking-detail', owner?.userId, owner?.sessionId, bookingId], value); void client.invalidateQueries({ queryKey: ['owner-bookings', owner?.userId] }); },
    onError: (error) => setSaveError(errorLabel(error)),
  });
  const collect = useMutation({
    mutationFn: async () => (await apiClient.post(`/owner/bookings/${bookingId}/confirm-property-collection`, {
      confirmedCollection: true, collectedAmount: query.data?.totalAmount, collectionMethod, idempotencyKey: collectionKey,
    })).data,
    onSuccess: () => { setConfirmedCollection(false); void query.refetch(); void client.invalidateQueries({ queryKey: ['owner-bookings', owner?.userId] }); },
  });
  const handover = useMutation({
    mutationFn: async () => (await apiClient.post(`/owner/bookings/${bookingId}/confirm-handover`, { confirmed: true, idempotencyKey: handoverKey })).data,
    onSuccess: () => void query.refetch(),
  });
  const booking = query.data;
  const nightlyRates = booking && Array.isArray(booking.nightlyRatesSnapshot)
    ? booking.nightlyRatesSnapshot.filter(isNightlyRate) : [];
  return <OwnerScaffold title="Chi tiết đặt phòng" testID="OWN-UI-22" onRefresh={owner && bookingId ? () => void query.refetch() : undefined} refreshing={query.isRefetching}>
    <OwnerButton secondary label="‹ Quay lại danh sách" onPress={() => router.canGoBack() ? router.back() : router.replace('/hotel-owner/bookings')} />
    {!owner || !bookingId ? <InfoCard><Text style={styles.error}>Chọn booking từ danh sách của Chủ khách sạn.</Text></InfoCard> : null}
    {query.isPending && bookingId ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {query.isError ? <InfoCard><Text style={styles.error}>{errorLabel(query.error)}</Text><OwnerButton secondary label="Thử lại" onPress={() => void query.refetch()} /></InfoCard> : null}
    {booking ? <>
      <InfoCard style={styles.bookingCard}><Text style={styles.hotelName}>{booking.hotel.name}</Text><Text style={styles.muted}>Mã {booking.code} · {booking.room.name}</Text><Text style={[styles.status, booking.status === 'CONFIRMED' || booking.status === 'CHECKED_IN' ? styles.good : styles.warning]}>● {STATUS[booking.status]}</Text><Text style={styles.total}>Tổng cộng {amountLabel(booking.totalAmount, booking.currency)}</Text></InfoCard>
      <InfoCard><SectionTitle>Kỳ lưu trú</SectionTitle><Text style={styles.muted}>Nhận {dateLabel(booking.checkIn)} · Trả {dateLabel(booking.checkOut)}</Text><Text style={styles.muted}>{booking.nights} đêm · {booking.roomCount} phòng · {booking.adults} người lớn · {booking.children} trẻ em</Text><Text style={styles.muted}>Hạng phòng: {booking.room.name} · {booking.room.type}</Text><Text style={styles.muted}>Giá tại lúc đặt: {amountLabel(booking.pricePerNight, booking.currency)} / đêm / phòng</Text></InfoCard>
      {nightlyRates.length > 0 ? <InfoCard><SectionTitle>Giá từng đêm lúc đặt</SectionTitle>{nightlyRates.map((rate) => <Text key={rate.date} style={styles.muted}>{dateLabel(rate.date)} · {amountLabel(rate.price, booking.currency)} / phòng</Text>)}</InfoCard> : null}
      <InfoCard><SectionTitle>Thông tin khách</SectionTitle><Text style={styles.muted}>Người đặt / khách lưu trú: {booking.guest.name}</Text>{booking.guest.phone ? <Text style={styles.muted}>Điện thoại: {booking.guest.phone}</Text> : null}{booking.guest.email ? <Text style={styles.muted}>Email: {booking.guest.email}</Text> : null}</InfoCard>
      <InfoCard><SectionTitle>Thanh toán</SectionTitle><Text style={styles.muted}>{PAYMENT[booking.payment.state] ?? booking.payment.state}</Text><Text style={styles.muted}>Phương thức: {booking.paymentMethod === 'PAY_AT_HOTEL' ? 'Thanh toán tại khách sạn' : 'Thanh toán trực tuyến'}</Text>{booking.paymentDeadline && booking.status === 'PENDING_PAYMENT' ? <Text style={styles.muted}>Hạn thanh toán: {new Date(booking.paymentDeadline).toLocaleString('vi-VN')}</Text> : null}</InfoCard>
      {booking.allowedActions.canConfirmPropertyCollection ? <InfoCard>
        <SectionTitle>Xác nhận khoản thu tại chỗ</SectionTitle>
        <Text style={styles.muted}>Booking này đã nhận phòng trước khi có bước xác nhận tiền. Chỉ ghi nhận nếu bạn thực sự đã thu đủ {amountLabel(booking.totalAmount, booking.currency)}.</Text>
        <View style={styles.wrap}><Pressable onPress={() => setCollectionMethod('CASH')}><Text style={styles.muted}>{collectionMethod === 'CASH' ? '● ' : '○ '}Tiền mặt</Text></Pressable><Pressable onPress={() => setCollectionMethod('BANK_TRANSFER')}><Text style={styles.muted}>{collectionMethod === 'BANK_TRANSFER' ? '● ' : '○ '}Chuyển khoản tại quầy</Text></Pressable></View>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmedCollection }} onPress={() => setConfirmedCollection((value) => !value)}><Text style={styles.muted}>{confirmedCollection ? '☑' : '☐'} Tôi xác nhận đã thu đủ số tiền trên.</Text></Pressable>
        {collect.isError ? <Text style={styles.error}>{errorLabel(collect.error)}</Text> : null}
        <OwnerButton label={collect.isPending ? 'Đang ghi nhận…' : 'Ghi nhận đã thu'} disabled={!confirmedCollection || collect.isPending} onPress={() => collect.mutate()} />
      </InfoCard> : null}
      <InfoCard><SectionTitle>Tiến trình booking</SectionTitle><Text style={styles.muted}>Tạo lúc {new Date(booking.createdAt).toLocaleString('vi-VN')}</Text><Text style={styles.muted}>Cập nhật {new Date(booking.updatedAt).toLocaleString('vi-VN')}</Text>{booking.cancelledAt ? <Text style={styles.muted}>Hủy lúc {new Date(booking.cancelledAt).toLocaleString('vi-VN')}</Text> : null}</InfoCard>
      {booking.actualCheckInAt || booking.actualCheckOutAt ? <InfoCard><SectionTitle>Thời gian lưu trú thực tế</SectionTitle>{booking.actualCheckInAt ? <Text style={styles.muted}>Nhận phòng: {new Date(booking.actualCheckInAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</Text> : null}{booking.actualCheckOutAt ? <Text style={styles.muted}>Trả phòng: {new Date(booking.actualCheckOutAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</Text> : null}</InfoCard> : null}
      {booking.completedAt ? <InfoCard><SectionTitle>Hoàn tất lưu trú</SectionTitle><Text style={styles.muted}>{booking.completionMethod === 'AUTO_AFTER_GRACE_PERIOD' ? 'Hệ thống tự hoàn tất sau hạn trả phòng; chưa xác nhận khách đã thực tế rời đi.' : 'Chủ khách sạn đã xác nhận trả phòng.'}</Text><Text style={styles.muted}>Lúc {new Date(booking.completedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</Text></InfoCard> : null}
      {booking.handoverNeedsConfirmation ? <InfoCard><SectionTitle>Cần kiểm tra bàn giao phòng</SectionTitle><Text style={styles.muted}>Booking tự hoàn tất theo thời gian. Hãy kiểm tra khách đã rời đi và tình trạng phòng trước khi tiếp tục vận hành.</Text><OwnerButton label={handover.isPending ? 'Đang xác nhận…' : 'Đã kiểm tra bàn giao'} disabled={handover.isPending} onPress={() => handover.mutate()} />{handover.isError ? <Text style={styles.error}>{errorLabel(handover.error)}</Text> : null}</InfoCard> : null}
      {booking.specialRequest ? <InfoCard><SectionTitle>Yêu cầu của khách</SectionTitle><Text style={styles.muted}>{booking.specialRequest}</Text></InfoCard> : null}
      {booking.cancellationPolicy ? <InfoCard><SectionTitle>Chính sách khi đặt</SectionTitle><Text style={styles.muted}>{booking.cancellationPolicy}</Text></InfoCard> : null}
      <InfoCard><SectionTitle>Ghi chú nội bộ</SectionTitle><Text style={styles.muted}>Chỉ Chủ khách sạn sở hữu booking nhìn thấy. Không gửi cho khách.</Text><TextInput accessibilityLabel="Ghi chú nội bộ" multiline maxLength={1000} placeholder="Ghi chú phục vụ lưu trú" placeholderTextColor={ownerColors.muted} value={note} onChangeText={(text) => setNoteDraft({ bookingId: bookingId ?? '', ownerId: owner?.userId ?? '', text })} style={[styles.input, styles.note]} />{booking.internalNoteUpdatedAt ? <Text style={styles.muted}>Cập nhật {new Date(booking.internalNoteUpdatedAt).toLocaleString('vi-VN')}</Text> : null}{saveError ? <Text style={styles.error}>{saveError}</Text> : null}<OwnerButton label={save.isPending ? 'Đang lưu…' : 'Lưu ghi chú'} disabled={!booking.allowedActions.canEditNote || save.isPending || note === (booking.internalNote ?? '')} onPress={() => save.mutate()} /></InfoCard>
      {booking.allowedActions.canCheckIn ? <OwnerButton label="Quét mã / nhận phòng" onPress={() => router.push({ pathname: '/hotel-owner/screen/[id]', params: { id: 'qr-checkin', bookingId: booking.id } } as never)} /> : null}
      {booking.allowedActions.canCheckOut ? <OwnerButton label="Xác nhận trả phòng" onPress={() => router.push({ pathname: '/hotel-owner/screen/[id]', params: { id: 'checkout', bookingId: booking.id } } as never)} /> : null}
    </> : null}
  </OwnerScaffold>;
}

export function GuestsScreen() { return <OwnerScaffold title="Khách lưu trú"><InfoCard><Text style={styles.muted}>Xem khách lưu trú trong chi tiết từng booking.</Text><OwnerButton label="Xem booking" onPress={() => router.replace('/hotel-owner/bookings')} /></InfoCard></OwnerScaffold>; }

const styles = StyleSheet.create({
  bookingCard: { borderWidth: 1, borderColor: ownerColors.border, gap: 9 },
  hotelName: { color: ownerColors.text, fontSize: 18, fontWeight: '700' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 21 },
  status: { fontSize: 14, fontWeight: '700' }, good: { color: ownerColors.success }, warning: { color: ownerColors.warning },
  total: { color: ownerColors.text, fontSize: 18, fontWeight: '700' }, count: { color: ownerColors.text, fontWeight: '700', fontSize: 15 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: ownerColors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: ownerColors.surface },
  chipActive: { backgroundColor: ownerColors.primary, borderColor: ownerColors.primary },
  chipText: { color: ownerColors.text, fontWeight: '600', fontSize: 13 }, chipTextActive: { color: '#FFFFFF' },
  input: { borderWidth: 1, borderColor: ownerColors.border, borderRadius: 12, backgroundColor: ownerColors.surface, color: ownerColors.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14 },
  dateRow: { flexDirection: 'row', gap: 8 }, dateInput: { flex: 1, minWidth: 0 }, note: { minHeight: 100, textAlignVertical: 'top' },
  filterLink: { color: ownerColors.primaryDark, fontWeight: '700', fontSize: 14 }, error: { color: ownerColors.danger, fontSize: 14, lineHeight: 20 },
});

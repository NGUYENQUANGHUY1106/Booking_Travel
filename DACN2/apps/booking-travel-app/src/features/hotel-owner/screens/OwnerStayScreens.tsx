import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { apiClient } from '@/services/api-client';
import { useTravelerStore } from '@/features/traveler/store';
import { InfoCard, OwnerButton, OwnerScaffold, SectionTitle, StatusPanel } from '../components';
import { ownerColors } from '../styles/tokens';
import { amountLabel, dateLabel, PAYMENT, STATUS, type OwnerBookingDetail } from './OwnerBookingScreens';

type Verification = {
  booking: OwnerBookingDetail;
  eligibility: { eligible: boolean; code: string | null; message: string | null; timeZone?: string; scheduledTime?: string | null };
  verificationRef: string | null;
  verificationExpiresInSeconds: number | null;
  verificationMethod: 'QR' | 'CODE';
};
type StayResult = { booking: OwnerBookingDetail; happenedAt: string; replayed: boolean; status: string };
type CheckoutPreview = { booking: OwnerBookingDetail; eligibility: Verification['eligibility'] };

const newRequestKey = () => `stay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
const stayTime = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có';
const requestError = (error: unknown) => {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    const data = error.response?.data as { message?: string | string[] } | undefined;
    if (typeof data?.message === 'string') return data.message;
    if (Array.isArray(data?.message)) return data.message.join(' ');
    if (!error.response) return 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.';
  }
  return 'Không thực hiện được. Vui lòng tải lại booking và thử lại.';
};
const bookingHref = (bookingId: string) => ({ pathname: '/hotel-owner/screen/[id]', params: { id: 'booking-detail', bookingId } }) as never;
const checkoutHref = (bookingId: string) => ({ pathname: '/hotel-owner/screen/[id]', params: { id: 'checkout', bookingId } }) as never;

function StaySummary({ booking }: { booking: OwnerBookingDetail }) {
  return <>
    <InfoCard style={styles.bookingCard}>
      <Text style={styles.hotel}>{booking.hotel.name}</Text>
      <Text style={styles.muted}>{dateLabel(booking.checkIn)} – {dateLabel(booking.checkOut)} · {booking.nights} đêm · {booking.adults + booking.children} khách</Text>
      <Text style={styles.good}>● {STATUS[booking.status]}</Text>
      <Text style={styles.total}>Tổng cộng {amountLabel(booking.totalAmount, booking.currency)}</Text>
    </InfoCard>
    <InfoCard><SectionTitle>Mã đặt phòng</SectionTitle><Text style={styles.muted}>{booking.code} · {booking.guest.name}</Text></InfoCard>
    <InfoCard>
      <SectionTitle>Thông tin đối chiếu</SectionTitle>
      <Text style={styles.muted}>Hạng phòng: {booking.room.name} · {booking.room.type}</Text>
      <Text style={styles.muted}>Số phòng: {booking.roomCount} · Số khách: {booking.adults + booking.children}</Text>
      <Text style={styles.muted}>Ngày nhận: {dateLabel(booking.checkIn)} · Ngày trả: {dateLabel(booking.checkOut)}</Text>
      <Text style={styles.muted}>Thanh toán: {PAYMENT[booking.payment.state]}</Text>
      <Text style={styles.muted}>Phương thức: {booking.paymentMethod === 'PAY_AT_HOTEL' ? 'Thanh toán tại khách sạn' : 'Trực tuyến'}</Text>
    </InfoCard>
  </>;
}

function Confirmation({ checked, onPress, label }: { checked: boolean; onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={onPress} style={styles.confirmRow}>
    <View style={[styles.checkbox, checked && styles.checkboxChecked]}><Text style={styles.checkmark}>{checked ? '✓' : ''}</Text></View>
    <Text style={styles.confirmText}>{label}</Text>
  </Pressable>;
}

export function QrCheckinScreen({ bookingId }: { bookingId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const owner = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session : undefined;
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState<string | null>(null);
  const [qrToken, setQrToken] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [requestKey, setRequestKey] = useState(newRequestKey);
  const [verified, setVerified] = useState<Verification | null>(null);
  const [success, setSuccess] = useState<StayResult | null>(null);
  const scanLock = useRef(false);

  useFocusEffect(useCallback(() => () => setScannerOpen(false), []));
  const detail = useQuery({
    queryKey: ['owner-booking-detail', owner?.userId, owner?.sessionId, bookingId],
    queryFn: async () => (await apiClient.get<OwnerBookingDetail>(`/owner/bookings/${bookingId}`)).data,
    enabled: Boolean(owner && bookingId), staleTime: 0,
  });
  const codeValue = code ?? detail.data?.code ?? '';

  const verification = useMutation({
    mutationFn: async () => (await apiClient.post<Verification>('/owner/bookings/verify', qrToken ? { qrToken } : { bookingCode: codeValue.trim().toUpperCase() })).data,
    onSuccess: (value) => {
      setScannerOpen(false);
      setConfirmed(false);
      setRequestKey(newRequestKey());
      if (bookingId && value.booking.id !== bookingId) {
        setScanError('Mã này thuộc booking khác. Vui lòng mở đúng booking.');
        setVerified(null);
      } else {
        setScanError('');
        setVerified(value);
      }
    },
  });
  const checkIn = useMutation({
    mutationFn: async () => {
      if (!verified?.verificationRef) throw new Error('verification missing');
      return (await apiClient.post<StayResult>(`/owner/bookings/${verified.booking.id}/check-in`, {
        ...(qrToken ? { qrToken } : { bookingCode: codeValue.trim().toUpperCase() }),
        verificationRef: verified.verificationRef, idempotencyKey: requestKey, confirmed: true,
      })).data;
    },
    onSuccess: (value) => {
      setSuccess(value);
      setQrToken('');
      setCode('');
      void queryClient.invalidateQueries({ queryKey: ['owner-bookings', owner?.userId] });
      void queryClient.invalidateQueries({ queryKey: ['owner-booking-detail', owner?.userId] });
    },
  });

  const openCamera = async () => {
    setScanError('');
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) {
      setScanError('Chưa được cấp quyền camera. Bạn vẫn có thể nhập mã booking bên dưới.');
      return;
    }
    scanLock.current = false;
    setScannerOpen(true);
  };
  const scanned = ({ data }: { data: string }) => {
    if (scanLock.current) return;
    scanLock.current = true;
    setScannerOpen(false);
    setVerified(null);
    setConfirmed(false);
    if (data.startsWith('BTQR1.')) { setQrToken(data); setCode(''); setScanError('Đã quét mã QR. Chọn Xem booking để xác minh.'); }
    else if (/^BT-[0-9a-fA-F]{8}$/.test(data.trim())) { setCode(data.trim().toUpperCase()); setQrToken(''); setScanError('Đã quét mã booking. Chọn Xem booking để xác minh.'); }
    else setScanError('QR không phải mã nhận phòng Booking Travel. Hãy quét lại hoặc nhập mã.');
  };
  const editCode = (value: string) => { setCode(value); setQrToken(''); setVerified(null); setConfirmed(false); setScanError(''); };
  const show = verified?.booking ?? detail.data;

  return <OwnerScaffold title={success ? 'Nhận phòng thành công' : verified ? 'Xác minh nhận phòng' : 'Quét QR hoặc nhập mã'} testID="OWN-UI-23-24"
    footer={success ? <OwnerButton label="Tiếp tục trả phòng" onPress={() => router.replace(checkoutHref(success.booking.id))} />
      : verified?.eligibility.eligible ? <OwnerButton label={checkIn.isPending ? 'Đang xác nhận…' : 'Xác nhận nhận phòng'} disabled={!confirmed || checkIn.isPending || !verified.verificationRef} onPress={() => checkIn.mutate()} />
      : <OwnerButton label={verification.isPending ? 'Đang xác minh…' : 'Xem booking'} disabled={verification.isPending || (!codeValue.trim() && !qrToken)} onPress={() => verification.mutate()} />}>
    {!owner ? <InfoCard><Text style={styles.error}>Đăng nhập với tài khoản Chủ khách sạn để tiếp tục.</Text></InfoCard> : null}
    {detail.isPending && bookingId ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {detail.isError ? <InfoCard><Text style={styles.error}>{requestError(detail.error)}</Text><OwnerButton secondary label="Thử lại" onPress={() => void detail.refetch()} /></InfoCard> : null}
    {success ? <>
      <StatusPanel title="Đã nhận phòng" body={`Booking ${success.booking.code} nhận phòng lúc ${stayTime(success.happenedAt)} (giờ Việt Nam).`} />
      <StaySummary booking={success.booking} />
      <OwnerButton secondary label="Xem chi tiết booking" onPress={() => router.replace(bookingHref(success.booking.id))} />
    </> : verified ? <>
      <StatusPanel title={verified.eligibility.eligible ? 'Booking hợp lệ' : 'Chưa thể nhận phòng'} body={verified.eligibility.eligible ? `Đã xác minh mã ${verified.booking.code} tại khách sạn của bạn. Đối chiếu khách và giấy tờ trước khi nhận phòng.` : verified.eligibility.message ?? 'Booking chưa đủ điều kiện.'} tone={verified.eligibility.eligible ? 'blue' : 'yellow'} />
      <StaySummary booking={verified.booking} />
      {verified.eligibility.scheduledTime ? <InfoCard><SectionTitle>Giờ nhận phòng</SectionTitle><Text style={styles.muted}>Từ {verified.eligibility.scheduledTime} ngày {dateLabel(verified.booking.checkIn)} · Asia/Ho_Chi_Minh</Text></InfoCard> : null}
      {verified.eligibility.eligible ? <Confirmation checked={confirmed} onPress={() => setConfirmed((value) => !value)} label="Tôi đã đối chiếu khách và giấy tờ trực tiếp, xác nhận khách đã đến nhận phòng." /> : null}
      {checkIn.isError ? <Text style={styles.error}>{requestError(checkIn.error)}</Text> : null}
      <OwnerButton secondary label="Quét / nhập mã khác" onPress={() => { setVerified(null); setQrToken(''); setCode(''); setConfirmed(false); }} />
    </> : <>
      {show ? <StaySummary booking={show} /> : null}
      <SectionTitle>Quét QR / nhập mã</SectionTitle>
      {scannerOpen && isFocused && permission?.granted ? <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={scanned} /> : null}
      <OwnerButton secondary label={scannerOpen ? 'Đóng camera' : 'Quét QR nhận phòng'} onPress={() => scannerOpen ? setScannerOpen(false) : void openCamera()} />
      <InfoCard><SectionTitle>Mã đặt phòng</SectionTitle><TextInput accessibilityLabel="Nhập mã đặt phòng" autoCapitalize="characters" autoCorrect={false} returnKeyType="done" onSubmitEditing={() => { if (codeValue.trim()) verification.mutate(); }} maxLength={32} placeholder="BT-XXXXXXXX" placeholderTextColor={ownerColors.muted} value={codeValue} onChangeText={editCode} style={styles.input} /><Text style={styles.muted}>{qrToken ? 'Đã quét QR, không hiển thị token.' : 'Nhập mã trên xác nhận đặt phòng của khách.'}</Text></InfoCard>
      {scanError ? <Text style={scanError.startsWith('Đã quét') ? styles.good : styles.error}>{scanError}</Text> : null}
      {verification.isError ? <Text style={styles.error}>{requestError(verification.error)}</Text> : null}
    </>}
  </OwnerScaffold>;
}

export function CheckoutScreen({ bookingId }: { bookingId?: string }) {
  const session = useTravelerStore((state) => state.session);
  const owner = session?.mode === 'api' && session.role === 'HOTEL_OWNER' ? session : undefined;
  const queryClient = useQueryClient();
  const [confirmed, setConfirmed] = useState(false);
  const [requestKey] = useState(newRequestKey);
  const [success, setSuccess] = useState<StayResult | null>(null);
  const query = useQuery({
    queryKey: ['owner-checkout-preview', owner?.userId, owner?.sessionId, bookingId],
    queryFn: async () => (await apiClient.get<CheckoutPreview>(`/owner/bookings/${bookingId}/check-out-preview`)).data,
    enabled: Boolean(owner && bookingId), staleTime: 0,
  });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { if (owner && bookingId && !success) void refetch(); }, [owner, bookingId, success, refetch]));
  const mutation = useMutation({
    mutationFn: async () => (await apiClient.post<StayResult>(`/owner/bookings/${bookingId}/check-out`, { idempotencyKey: requestKey, confirmed: true })).data,
    onSuccess: (value) => {
      setSuccess(value);
      void queryClient.invalidateQueries({ queryKey: ['owner-bookings', owner?.userId] });
      void queryClient.invalidateQueries({ queryKey: ['owner-booking-detail', owner?.userId] });
    },
  });
  const booking = success?.booking ?? query.data?.booking;
  return <OwnerScaffold title={success ? 'Trả phòng hoàn tất' : 'Xác nhận trả phòng'} testID="OWN-UI-25"
    footer={success ? <OwnerButton label="Xem booking" onPress={() => router.replace(bookingHref(success.booking.id))} />
      : <OwnerButton label={mutation.isPending ? 'Đang xác nhận…' : 'Xác nhận trả phòng'} disabled={!confirmed || !query.data?.eligibility.eligible || mutation.isPending} onPress={() => mutation.mutate()} />}>
    {!owner || !bookingId ? <InfoCard><Text style={styles.error}>Chọn booking từ danh sách của Chủ khách sạn.</Text><OwnerButton secondary label="Xem booking" onPress={() => router.replace('/hotel-owner/bookings')} /></InfoCard> : null}
    {query.isPending ? <ActivityIndicator color={ownerColors.primary} /> : null}
    {query.isError ? <InfoCard><Text style={styles.error}>{requestError(query.error)}</Text><OwnerButton secondary label="Thử lại" onPress={() => void query.refetch()} /></InfoCard> : null}
    {success ? <StatusPanel title="Đã hoàn tất" body={`Booking ${success.booking.code} trả phòng lúc ${stayTime(success.happenedAt)} (giờ Việt Nam). Khách có thể đánh giá khi tính năng đánh giá được mở.`} /> : null}
    {booking ? <>
      <StaySummary booking={booking} />
      <InfoCard><SectionTitle>Thời gian lưu trú</SectionTitle><Text style={styles.muted}>Đã nhận phòng: {stayTime(booking.actualCheckInAt)}</Text><Text style={styles.muted}>Ngày trả dự kiến: {dateLabel(booking.checkOut)}</Text>{booking.actualCheckOutAt ? <Text style={styles.muted}>Đã trả phòng: {stayTime(booking.actualCheckOutAt)}</Text> : null}</InfoCard>
      {!success && query.data?.eligibility.scheduledTime ? <InfoCard><SectionTitle>Giờ trả phòng</SectionTitle><Text style={styles.muted}>Trước hoặc đúng {query.data.eligibility.scheduledTime} ngày {dateLabel(booking.checkOut)} · Asia/Ho_Chi_Minh</Text></InfoCard> : null}
      {!success && query.data?.eligibility.eligible ? <Confirmation checked={confirmed} onPress={() => setConfirmed((value) => !value)} label="Tôi xác nhận khách đã rời đi và đã đối chiếu tình trạng lưu trú." /> : null}
      {!success && query.data && !query.data.eligibility.eligible ? <StatusPanel title="Chưa thể trả phòng" body={query.data.eligibility.message ?? 'Booking chưa đủ điều kiện.'} tone="yellow" /> : null}
      {mutation.isError ? <Text style={styles.error}>{requestError(mutation.error)}</Text> : null}
    </> : null}
  </OwnerScaffold>;
}

export function CheckinScreen({ bookingId }: { bookingId?: string }) { return <QrCheckinScreen bookingId={bookingId} />; }

const styles = StyleSheet.create({
  bookingCard: { borderWidth: 1, borderColor: ownerColors.border, borderRadius: 16, padding: 16, gap: 10 },
  hotel: { color: ownerColors.text, fontSize: 18, lineHeight: 26, fontWeight: '700' },
  muted: { color: ownerColors.muted, fontSize: 14, lineHeight: 20 },
  good: { color: ownerColors.success, fontSize: 14, fontWeight: '700' },
  total: { color: ownerColors.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  error: { color: ownerColors.danger, fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: ownerColors.border, borderRadius: 12, backgroundColor: ownerColors.surface, color: ownerColors.text, paddingHorizontal: 14, paddingVertical: 11, fontSize: 16 },
  camera: { height: 260, width: '100%', borderRadius: 12, overflow: 'hidden' },
  confirmRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, backgroundColor: ownerColors.surface, padding: 14 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderRadius: 5, borderColor: ownerColors.primary, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: ownerColors.primary },
  checkmark: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  confirmText: { flex: 1, color: ownerColors.text, fontSize: 14, lineHeight: 20 },
});

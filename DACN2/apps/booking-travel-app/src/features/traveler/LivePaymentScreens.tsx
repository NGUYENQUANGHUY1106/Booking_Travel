import { useEffect, useRef, useState } from 'react';
import { AppState, Image, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { bookingApiError } from './booking-quote-api';
import { initServerPayment, paymentStatus, type PaymentStatusResponse } from './payment-api';
import { paymentDestination } from './payment-state';
import { dateLabel } from './data';
import { publicMediaUrl } from './public-hotels';
import { colors } from './theme';
import { Button, Card, FigmaIcon, T, TravelerScaffold, go } from './ui';

const POLL_LIMIT_MS = 120_000;

function replacePaymentScreen(id: 'payment-processing' | 'payment-success' | 'payment-failed', paymentId: string) {
  router.replace({ pathname: '/user/screen/[id]', params: { id, paymentId } } as Href);
}

function amount(value: string, currency: string) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(Number(value));
}

function failureMessage(reason: string | null) {
  if (reason === 'TEST_DECLINED') return 'Giao dịch mô phỏng bị từ chối.';
  if (reason === 'USER_CANCELLED') return 'Bạn đã hủy giao dịch tại cổng thanh toán.';
  return 'Cổng thanh toán từ chối giao dịch.';
}

function usePaymentStatus(paymentId: string, polling = false) {
  const [timedOut, setTimedOut] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  useEffect(() => {
    if (!polling || !paymentId) return;
    const timer = setTimeout(() => setTimedOut(true), POLL_LIMIT_MS);
    return () => clearTimeout(timer);
  }, [paymentId, polling]);
  const query = useQuery({
    queryKey: ['payment-status', paymentId],
    enabled: Boolean(paymentId),
    queryFn: async ({ signal }) => {
      const result = await paymentStatus(paymentId, signal);
      setPollCount((count) => count + 1);
      return result;
    },
    retry: false,
    refetchInterval: (state) => {
      if (!polling || timedOut) return false;
      if (state.state.data?.paymentStatus !== 'PENDING' || state.state.data?.bookingStatus !== 'PENDING_PAYMENT') return false;
      return Math.min(12_000, 2_000 * Math.max(1, pollCount)) + Math.round(Math.random() * 500);
    },
  });
  const { refetch } = query;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && paymentId) void refetch();
    });
    return () => subscription.remove();
  }, [paymentId, refetch]);
  return { ...query, timedOut };
}

function PaymentSummary({ payment }: { payment: PaymentStatusResponse }) {
  return <Card style={{ backgroundColor: '#F2F7FF', borderRadius: 14, padding: 16 }}>
    <T weight="semibold" style={{ color: colors.muted, fontSize: 11 }}>MÃ ĐẶT PHÒNG</T>
    <T weight="bold" style={{ color: colors.primaryDark, fontSize: 21 }}>{payment.bookingCode}</T>
    <T style={{ color: colors.muted, fontSize: 12 }}>Giao dịch · {payment.merchantReference}</T>
  </Card>;
}

export function PaymentProcessing() {
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const navigated = useRef(false);
  const status = usePaymentStatus(paymentId ?? '', true);
  const data = status.data;
  useEffect(() => {
    if (!paymentId || navigated.current || !data) return;
    const destination = paymentDestination(data);
    if (destination === 'success') {
      navigated.current = true;
      replacePaymentScreen('payment-success', paymentId);
    } else if (destination === 'failed') {
      navigated.current = true;
      replacePaymentScreen('payment-failed', paymentId);
    }
  }, [paymentId, data]);
  return <TravelerScaffold title="Đang thanh toán" back>
    {!paymentId ? <Card><T accessibilityRole="alert">Thiếu mã giao dịch. Mở Đặt phòng của tôi để kiểm tra lại.</T><Button label="Đặt phòng của tôi" onPress={() => go('my-bookings')} /></Card> : null}
    <Card><T weight="semibold" style={{ fontSize: 16 }}>Đang kiểm tra trạng thái</T><T style={{ color: colors.muted, lineHeight: 20 }}>Vui lòng chờ xác nhận từ cổng thanh toán. Không tạo đơn đặt phòng mới.</T></Card>
    {data ? <PaymentSummary payment={data} /> : null}
    {status.error ? <Card><T accessibilityRole="alert" style={{ color: colors.error }}>Chưa xác nhận được. {bookingApiError(status.error)}</T></Card> : null}
    {status.timedOut ? <Card><T accessibilityRole="alert">Chưa xác nhận được thanh toán. Bạn có thể kiểm tra lại trong Đặt phòng của tôi.</T></Card> : null}
    {paymentId ? <Button label={status.isFetching ? 'Đang kiểm tra...' : 'Kiểm tra trạng thái'} disabled={status.isFetching} onPress={() => void status.refetch()} /> : null}
    <Card style={{ backgroundColor: colors.primaryLight }}><T style={{ color: colors.muted, lineHeight: 20 }}>Đang chờ phản hồi của cổng thanh toán. Chỉ chuyển sang thành công khi API xác nhận.</T></Card>
    <Button label="Đặt phòng của tôi" secondary onPress={() => go('my-bookings')} />
  </TravelerScaffold>;
}

export function PaymentSuccess() {
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const status = usePaymentStatus(paymentId ?? '');
  const payment = status.data;
  const verified = payment?.paymentStatus === 'SUCCESS' && payment.bookingStatus === 'CONFIRMED';
  return <TravelerScaffold background={colors.white}>
    {status.isLoading ? <Card><T>Đang xác minh thanh toán...</T></Card> : null}
    {status.error || !paymentId ? <Card><T accessibilityRole="alert">Không thể xác minh giao dịch này.</T><Button label="Kiểm tra lại" onPress={() => void status.refetch()} /></Card> : null}
    {payment && !verified ? <Card><T accessibilityRole="alert">Thanh toán chưa được xác nhận cùng đặt phòng.</T><Button label="Kiểm tra trạng thái" onPress={() => replacePaymentScreen('payment-processing', paymentId!)} /></Card> : null}
    {payment && verified ? <View style={{ gap: 22, paddingTop: 30 }}>
      <View style={{ alignItems: 'center', gap: 12 }}><View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#E0F7EB', alignItems: 'center', justifyContent: 'center' }}><FigmaIcon source={require('./assets/payment-success.svg')} size={36} /></View><T weight="bold" style={{ fontSize: 25, color: '#122138', textAlign: 'center' }}>Đặt phòng thành công</T><T style={{ color: '#57697D', textAlign: 'center' }}>Thanh toán đã được xác nhận.</T></View>
      <PaymentSummary payment={payment} />
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>{payment.hotelCoverImageUrl ? <Image accessibilityLabel={`Ảnh ${payment.hotelName}`} source={{ uri: publicMediaUrl(payment.hotelCoverImageUrl) }} style={{ width: 88, height: 80, borderRadius: 12 }} /> : <View style={{ width: 88, height: 80, borderRadius: 12, backgroundColor: colors.primaryLight }} />}<View style={{ flex: 1, gap: 5 }}><T weight="semibold" style={{ fontSize: 15 }}>{payment.hotelName}</T><T style={{ color: colors.muted, fontSize: 12 }}>{dateLabel(payment.checkIn.slice(0, 10))} – {dateLabel(payment.checkOut.slice(0, 10))} · {payment.nights} đêm · {payment.adults + payment.children} khách</T><T style={{ color: colors.primaryDark, fontSize: 12 }}>{payment.roomName}</T></View></Card>
      <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><T style={{ color: colors.muted }}>Tổng đã thanh toán</T><T weight="semibold" style={{ flexShrink: 1, textAlign: 'right' }}>{amount(payment.amount, payment.currency)}</T></View></Card>
      <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><T style={{ color: colors.muted }}>Nhận phòng</T><T weight="semibold" style={{ flexShrink: 1, textAlign: 'right' }}>{dateLabel(payment.checkIn.slice(0, 10))}{payment.hotelCheckInTime ? ` · từ ${payment.hotelCheckInTime}` : ''}</T></View></Card>
      <Button label="Xem đặt phòng" onPress={() => go('booking-detail')} />
      <Card><T style={{ color: colors.muted }}>Mã QR nhận phòng đang chờ chức năng BKG-06. Đặt phòng của bạn đã được xác nhận.</T></Card>
      <Button label="Xem mã QR (chưa sẵn sàng)" disabled onPress={() => undefined} />
      <Button label="Về trang chủ" secondary onPress={() => router.replace('/user' as Href)} />
    </View> : null}
  </TravelerScaffold>;
}

export function PaymentFailed() {
  const { paymentId } = useLocalSearchParams<{ paymentId?: string }>();
  const status = usePaymentStatus(paymentId ?? '');
  const payment = status.data;
  const trulyFailed = payment?.bookingStatus !== 'CONFIRMED' && (payment?.paymentStatus === 'FAILED' || payment?.bookingStatus === 'EXPIRED' || payment?.bookingStatus === 'CANCELLED');
  const canRetry = payment?.canRetry ?? false;
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  return <TravelerScaffold title={payment?.reconciliationRequired ? 'Cần đối soát thanh toán' : payment?.bookingStatus === 'EXPIRED' && payment.paymentStatus === 'PENDING' ? 'Hết hạn giữ phòng' : 'Thanh toán thất bại'} back footer={canRetry ? <Button label={retrying ? 'Đang thử lại...' : 'Thử thanh toán lại'} disabled={retrying} onPress={() => {
    if (!payment) return;
    setRetrying(true); setRetryError('');
    void initServerPayment(payment.bookingId).then((next) => replacePaymentScreen('payment-processing', next.paymentId)).catch((error: unknown) => setRetryError(bookingApiError(error))).finally(() => setRetrying(false));
  }} /> : undefined}>
    {status.isLoading ? <Card><T>Đang xác minh trạng thái...</T></Card> : null}
    {status.error || !paymentId ? <Card><T accessibilityRole="alert">Chưa xác minh được trạng thái thanh toán.</T><Button label="Kiểm tra lại" onPress={() => void status.refetch()} /></Card> : null}
    {payment && !trulyFailed ? <Card><T accessibilityRole="alert">{payment.bookingStatus === 'CONFIRMED' ? 'Đặt phòng đã được xác nhận qua giao dịch khác.' : 'Giao dịch chưa thất bại. Vui lòng tiếp tục kiểm tra trạng thái.'}</T><Button label={payment.bookingStatus === 'CONFIRMED' ? 'Xem đặt phòng' : 'Kiểm tra trạng thái'} onPress={() => payment.bookingStatus === 'CONFIRMED' ? go('booking-detail') : replacePaymentScreen('payment-processing', paymentId!)} /></Card> : null}
    {payment && trulyFailed ? <Card><T weight="semibold" style={{ fontSize: 16 }}>{payment.reconciliationRequired ? 'Giao dịch cần đối soát' : payment.bookingStatus === 'EXPIRED' && payment.paymentStatus === 'PENDING' ? 'Chưa xác nhận được thanh toán' : 'Thanh toán chưa thành công'}</T><T style={{ color: colors.muted, lineHeight: 20 }}>{payment.reconciliationRequired ? 'Cổng đã báo thanh toán sau khi đơn hết hiệu lực. Giao dịch cần được đối soát; vui lòng liên hệ hỗ trợ, không đặt lại ngay.' : payment.bookingStatus === 'EXPIRED' ? 'Thời hạn giữ phòng đã hết. Vui lòng kiểm tra lại trạng thái giao dịch trước khi đặt phòng mới.' : payment.paymentStatus === 'FAILED' ? failureMessage(payment.failureReason) : 'Giao dịch chưa được xác nhận. Bạn có thể thử lại nếu thời hạn giữ phòng còn hiệu lực.'}</T></Card> : null}
    {retryError ? <T accessibilityRole="alert" style={{ color: colors.error }}>{retryError}</T> : null}
    {payment?.bookingStatus === 'EXPIRED' && payment.paymentStatus === 'FAILED' && !payment.reconciliationRequired ? <Button label="Tìm phòng mới" onPress={() => go('rooms')} /> : null}
    <Button label="Đặt phòng của tôi" secondary onPress={() => go('my-bookings')} />
  </TravelerScaffold>;
}

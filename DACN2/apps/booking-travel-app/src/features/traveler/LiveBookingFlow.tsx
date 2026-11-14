import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';
import { router, type Href, useLocalSearchParams } from 'expo-router';
import { apiClient } from '@/services/api-client';
import { bookingApiError, createServerBooking, useBookingQuote, type ServerBookingQuote, type ServerBooking } from './booking-quote-api';
import { availablePaymentMethods, initServerPayment, latestBookingPayment } from './payment-api';
import { PaymentFailed, PaymentProcessing, PaymentSuccess } from './LivePaymentScreens';
import { dateLabel } from './data';
import { publicMediaUrl } from './public-hotels';
import { useTravelerStore } from './store';
import { confirmedStayForHotel, guestContextKey } from './stay-context';
import { colors } from './theme';
import { Button, Card, Field, SectionTitle, T, TravelerScaffold, go } from './ui';

type LiveScreen = 'booking-review' | 'guest-info' | 'special-requests' | 'voucher' | 'price-breakdown' | 'payment-method' | 'payment-confirm' | 'payment-processing' | 'payment-success' | 'payment-failed' | 'booking-confirmation' | 'my-bookings' | 'booking-detail';

function money(amount: string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency }).format(value);
}

function PriceRow({ label, amount, currency, bold = false }: { label: string; amount: string; currency: string; bold?: boolean }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'center', paddingVertical: 5 }}>
    <T weight={bold ? 'semibold' : 'regular'} style={{ flex: 1, color: bold ? colors.ink : colors.muted }}>{label}</T>
    <T weight={bold ? 'bold' : 'medium'} style={{ color: bold ? colors.primaryDark : colors.ink, fontSize: bold ? 20 : 14 }}>{money(amount, currency)}</T>
  </View>;
}

function QuotePrice({ quote, details = false }: { quote: ServerBookingQuote; details?: boolean }) {
  return <View style={{ gap: 5 }}>
    {details ? quote.nightlyRates.map((night) => <PriceRow key={night.date} label={`${dateLabel(night.date)} · ${night.quantity} phòng`} amount={night.amount} currency={quote.currency} />) : null}
    <PriceRow label={`Giá phòng · ${quote.nights} đêm · ${quote.roomCount} phòng`} amount={quote.roomSubtotal} currency={quote.currency} />
    {quote.taxes.map((line, index) => <PriceRow key={`tax-${index}`} label={line.label} amount={line.amount} currency={quote.currency} />)}
    {quote.fees.map((line, index) => <PriceRow key={`fee-${index}`} label={line.label} amount={line.amount} currency={quote.currency} />)}
    {quote.discounts.map((line, index) => <PriceRow key={`discount-${index}`} label={line.label} amount={`-${line.amount}`} currency={quote.currency} />)}
    <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 5 }} />
    <PriceRow label="Tổng tiền" amount={quote.finalAmount} currency={quote.currency} bold />
  </View>;
}

function QuoteHotel({ quote }: { quote: ServerBookingQuote }) {
  return <Card style={{ borderWidth: 1, borderColor: colors.line }}>
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
      {quote.hotel.coverImageUrl ? <Image accessibilityLabel={`Ảnh ${quote.hotel.name}`} source={{ uri: publicMediaUrl(quote.hotel.coverImageUrl) }} style={{ width: 82, height: 78, borderRadius: 12 }} /> : <View style={{ width: 82, height: 78, borderRadius: 12, backgroundColor: colors.primaryLight }} />}
      <View style={{ flex: 1, gap: 4 }}><T weight="semibold" style={{ fontSize: 16 }}>{quote.hotel.name}</T><T style={{ color: colors.muted, fontSize: 12 }}>{dateLabel(quote.checkIn)} – {dateLabel(quote.checkOut)} · {quote.nights} đêm</T><T style={{ color: colors.primaryDark, fontSize: 12 }}>{quote.room.name} · {quote.roomCount} phòng</T></View>
    </View>
  </Card>;
}

function useActiveQuote() {
  const result = useBookingQuote();
  const state = useTravelerStore();
  const [now, setNow] = useState(0);
  const [acceptedQuoteId, setAcceptedQuoteId] = useState<string | null>(null);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const valid = Boolean(now > 0 && result.data && !result.isFetching && !result.isError
    && confirmedStayForHotel(state.staySelection, state.checkIn, state.checkOut, state.selectedHotelId, result.data.hotel.id)
    && result.data.roomId === state.selectedRoomId && result.data.checkIn === state.checkIn && result.data.checkOut === state.checkOut
    && result.data.roomCount === state.rooms && result.data.adults === state.adults && result.data.children === state.children
    && new Date(result.data.expiresAt).getTime() > now);
  const canContinue = valid && (!result.data?.priceChanged || acceptedQuoteId === result.data.quoteId);
  return { ...result, valid, canContinue, acceptedQuoteId, acceptPriceChange: () => setAcceptedQuoteId(result.data?.quoteId ?? null), secondsLeft: result.data ? Math.max(0, Math.ceil((new Date(result.data.expiresAt).getTime() - now) / 1000)) : 0 };
}

function PriceChangeNotice({ quote, accepted, onAccept }: { quote?: ServerBookingQuote; accepted: boolean; onAccept: () => void }) {
  if (!quote?.priceChanged || accepted) return null;
  return <Card style={{ backgroundColor: '#FFF3CD' }}><T accessibilityRole="alert" style={{ color: colors.orange }}>Giá phòng đã thay đổi so với báo giá trước. Vui lòng xem tổng tiền mới và xác nhận.</T><Button label="Tôi đồng ý với giá mới" onPress={onAccept} /></Card>;
}

function QuoteState({ quote, valid, loading, error, retry, secondsLeft }: { quote?: ServerBookingQuote; valid: boolean; loading: boolean; error: unknown; retry: () => void; secondsLeft: number }) {
  const session = useTravelerStore((state) => state.session);
  const selectedHotelId = useTravelerStore((state) => state.selectedHotelId);
  const selectedRoomId = useTravelerStore((state) => state.selectedRoomId);
  const staySelection = useTravelerStore((state) => state.staySelection);
  const checkIn = useTravelerStore((state) => state.checkIn);
  const checkOut = useTravelerStore((state) => state.checkOut);
  if (session?.mode !== 'api') return <Card><T>Đăng nhập để xem báo giá và đặt phòng.</T><Button label="Đăng nhập" onPress={() => router.push('/auth/login' as Href)} /></Card>;
  if (loading) return <Card><T accessibilityRole="alert">Đang kiểm tra giá và phòng trống...</T></Card>;
  if (!confirmedStayForHotel(staySelection, checkIn, checkOut, selectedHotelId, selectedHotelId)) return <Card><T>Chọn ngày nhận và trả phòng trước khi lấy báo giá.</T><Button label="Chọn ngày lưu trú" onPress={() => go('dates', { hotelId: selectedHotelId, ...(selectedRoomId ? { roomId: selectedRoomId } : {}) })} /></Card>;
  if (error) return <Card><T accessibilityRole="alert" style={{ color: colors.error }}>{bookingApiError(error)}</T><Button label="Thử lại" onPress={retry} /><Button label="Đổi ngày hoặc phòng" secondary onPress={() => go('rooms')} /></Card>;
  if (!quote) return <Card><T>Chọn một hạng phòng và đăng nhập để xem báo giá.</T><Button label="Chọn phòng" onPress={() => go('rooms')} /></Card>;
  if (!valid) return <Card><T accessibilityRole="alert" style={{ color: colors.error }}>Báo giá đã hết hạn.</T><Button label="Lấy báo giá mới" onPress={retry} /></Card>;
  return <T style={{ color: secondsLeft <= 60 ? colors.orange : colors.muted, fontSize: 12 }}>Báo giá còn hiệu lực {Math.floor(secondsLeft / 60)} phút {secondsLeft % 60} giây. Phòng chỉ được giữ khi đặt thành công.</T>;
}

function Review() {
  const { data, valid, canContinue, acceptedQuoteId, acceptPriceChange, isFetching, error, refetch, secondsLeft } = useActiveQuote();
  const specialRequest = useTravelerStore((state) => state.specialRequest);
  return <TravelerScaffold title="Xem lại đặt phòng" back background={colors.white} footer={<Button disabled={!canContinue} label="Tiếp tục · thông tin khách" onPress={() => go('guest-info')} />}>
    <View style={{ flexDirection: 'row', gap: 6 }}>{['1 Thông tin', '2 Thanh toán', '3 Xác nhận'].map((label, index) => <View key={label} style={{ flex: 1, padding: 9, borderRadius: 10, backgroundColor: index === 0 ? colors.primaryLight : '#F3F5F7' }}><T weight="semibold" style={{ color: index === 0 ? colors.primaryDark : colors.muted, fontSize: 11 }}>{label}</T></View>)}</View>
    <QuoteState quote={data} valid={valid} loading={isFetching} error={error} retry={() => void refetch()} secondsLeft={secondsLeft} />
    <PriceChangeNotice quote={data} accepted={acceptedQuoteId === data?.quoteId} onAccept={acceptPriceChange} />
    {data && valid ? <><QuoteHotel quote={data} /><Button label="Sửa ngày lưu trú" secondary onPress={() => go('dates', { hotelId: data.hotel.id, roomId: data.roomId })} />
      <SectionTitle title="Thông tin lưu trú" />
      <Card><T>Nhận phòng: {dateLabel(data.checkIn)}{data.hotel.checkInTime ? ` · từ ${data.hotel.checkInTime}` : ''}</T><T>Trả phòng: {dateLabel(data.checkOut)}{data.hotel.checkOutTime ? ` · trước ${data.hotel.checkOutTime}` : ''}</T><T>{data.adults} người lớn{data.children ? ` · ${data.children} trẻ em` : ''} · {data.roomCount} phòng</T></Card>
      {specialRequest ? <Card><T weight="semibold">Yêu cầu đặc biệt</T><T>{specialRequest}</T></Card> : null}
      <SectionTitle title="Chi tiết giá" action="Xem từng đêm ›" onPress={() => go('price-breakdown')} />
      <Card><QuotePrice quote={data} /></Card>
      {data.cancellationPolicy ? <Card><T weight="semibold">Chính sách hủy</T><T>{data.cancellationPolicy}</T></Card> : null}
      <T style={{ color: colors.muted, fontSize: 12 }}>Bạn sẽ chọn phương thức thanh toán ở bước tiếp theo.</T>
    </> : null}
  </TravelerScaffold>;
}

function Guest({ special = false }: { special?: boolean }) {
  const state = useTravelerStore();
  const [name, setName] = useState(state.guestName || state.profile.name || '');
  const [email, setEmail] = useState(state.guestEmail || state.profile.email || '');
  const [phone, setPhone] = useState(state.guestPhone || state.profile.phone || '');
  const [note, setNote] = useState(state.specialRequest);
  const [error, setError] = useState('');
  return <TravelerScaffold title={special ? 'Yêu cầu đặc biệt' : 'Thông tin khách lưu trú'} back>
    {!special ? <><Field label="Họ tên khách" value={name} onChangeText={setName} /><Field label="Email xác nhận" value={email} keyboardType="email-address" onChangeText={setEmail} /><Field label="Số điện thoại" value={phone} keyboardType="phone-pad" onChangeText={setPhone} /></> : null}
    <Field label="Yêu cầu đặc biệt (nếu có)" value={note} onChangeText={setNote} multiline />
    {error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}
    <Button label="Tiếp tục" onPress={() => {
      if (!special && (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) { setError('Vui lòng nhập tên và email hợp lệ.'); return; }
      if (special) state.setBookingDraft({ specialRequest: note.trim() });
      else state.confirmGuestDetails({ guestName: name.trim(), guestEmail: email.trim(), guestPhone: phone.trim(), specialRequest: note.trim() });
      go(special ? 'booking-review' : 'price-breakdown');
    }} />
  </TravelerScaffold>;
}

function Breakdown() {
  const { data, valid, canContinue, acceptedQuoteId, acceptPriceChange, isFetching, error, refetch, secondsLeft } = useActiveQuote();
  const state = useTravelerStore();
  const guestReady = Boolean(state.guestConfirmedKey && state.guestConfirmedKey === guestContextKey(state.selectedRoomId, state.checkIn, state.checkOut, state.adults, state.children, state.rooms, state.staySelection));
  return <TravelerScaffold title="Chi tiết thanh toán" back footer={<Button disabled={!canContinue} label={guestReady ? 'Tiếp tục xác nhận' : 'Tiếp tục · thông tin khách'} onPress={() => go(guestReady ? 'payment-method' : 'guest-info')} />}>
    <QuoteState quote={data} valid={valid} loading={isFetching} error={error} retry={() => void refetch()} secondsLeft={secondsLeft} />
    <PriceChangeNotice quote={data} accepted={acceptedQuoteId === data?.quoteId} onAccept={acceptPriceChange} />
    {data && valid ? <><QuoteHotel quote={data} /><Card><T weight="semibold" style={{ fontSize: 18 }}>Chi tiết giá</T><QuotePrice quote={data} details /></Card>{data.cancellationPolicy ? <Card><T weight="semibold">Chính sách hủy</T><T>{data.cancellationPolicy}</T></Card> : null}<Card><T weight="semibold">Phương thức thanh toán</T><T style={{ color: colors.muted }}>Bạn sẽ chọn thanh toán tại khách sạn hoặc cổng mô phỏng ở bước tiếp theo.</T></Card></> : null}
  </TravelerScaffold>;
}

function PaymentMethod() {
  const { data, valid, canContinue, acceptedQuoteId, acceptPriceChange, isFetching, error, refetch, secondsLeft } = useActiveQuote();
  const state = useTravelerStore();
  const guestReady = Boolean(state.guestConfirmedKey && state.guestConfirmedKey === guestContextKey(state.selectedRoomId, state.checkIn, state.checkOut, state.adults, state.children, state.rooms, state.staySelection));
  const methods = useQuery({ queryKey: ['payment-methods'], queryFn: availablePaymentMethods });
  const [choice, setChoice] = useState<'PAY_AT_HOTEL' | 'SIMULATOR'>('PAY_AT_HOTEL');
  return <TravelerScaffold title="Phương thức thanh toán" back footer={<Button disabled={!canContinue || !guestReady} label="Tiếp tục" onPress={() => go('payment-confirm', { method: choice })} />}>
    {!guestReady ? <Card><T>Vui lòng xác nhận thông tin khách trước khi chọn thanh toán.</T><Button label="Thông tin khách" onPress={() => go('guest-info')} /></Card> : null}
    <QuoteState quote={data} valid={valid} loading={isFetching} error={error} retry={() => void refetch()} secondsLeft={secondsLeft} />
    <PriceChangeNotice quote={data} accepted={acceptedQuoteId === data?.quoteId} onAccept={acceptPriceChange} />
    {data && valid ? <><QuoteHotel quote={data} />
      <Card onPress={() => setChoice('PAY_AT_HOTEL')} style={{ borderWidth: 1, borderColor: choice === 'PAY_AT_HOTEL' ? colors.primary : colors.line }}><T weight="semibold">Thanh toán tại khách sạn {choice === 'PAY_AT_HOTEL' ? '✓' : ''}</T><T style={{ color: colors.muted, fontSize: 12 }}>Chưa thu tiền trước. Thanh toán khi nhận phòng.</T></Card>
      {methods.data?.simulator ? <Card onPress={() => setChoice('SIMULATOR')} style={{ borderWidth: 1, borderColor: choice === 'SIMULATOR' ? colors.primary : colors.line }}><T weight="semibold">Cổng thanh toán mô phỏng {choice === 'SIMULATOR' ? '✓' : ''}</T><T style={{ color: colors.muted, fontSize: 12 }}>Dùng để thử webhook có chữ ký; không thu tiền thật.</T></Card> : null}
      <Card><QuotePrice quote={data} /><T style={{ color: colors.muted }}>Số tiền được xác nhận trên máy chủ trước khi thanh toán.</T></Card></> : null}
  </TravelerScaffold>;
}

function Confirm() {
  const params = useLocalSearchParams<{ method?: string }>();
  const method = params.method === 'SIMULATOR' ? 'SIMULATOR' : 'PAY_AT_HOTEL';
  const state = useTravelerStore();
  const guestReady = Boolean(state.guestConfirmedKey && state.guestConfirmedKey === guestContextKey(state.selectedRoomId, state.checkIn, state.checkOut, state.adults, state.children, state.rooms, state.staySelection));
  const { data, valid, canContinue, acceptedQuoteId, acceptPriceChange, isFetching, error: quoteError, refetch, secondsLeft } = useActiveQuote();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async () => {
    if (!data || !canContinue || !guestReady || busy) return;
    setBusy(true); setError('');
    try {
      const booking = await createServerBooking({ quoteId: data.quoteId, roomId: data.roomId, checkIn: data.checkIn, checkOut: data.checkOut, adults: data.adults, children: data.children, roomCount: data.roomCount, guestName: state.guestName, guestEmail: state.guestEmail || state.profile.email, guestPhone: state.guestPhone || undefined, note: state.specialRequest || undefined, paymentMethod: method });
      state.setServerBooking({ id: booking.id, code: booking.code, hotelName: data.hotel.name, roomName: data.room.name, checkIn: data.checkIn, checkOut: data.checkOut, totalAmount: booking.totalAmount, currency: booking.currency, status: booking.status });
      if (method === 'SIMULATOR') {
        const payment = await initServerPayment(booking.id);
        go('payment-processing', { paymentId: payment.paymentId });
      } else {
        go('booking-confirmation');
      }
    } catch (caught) {
      setError(bookingApiError(caught));
      if (isAxiosError(caught) && ['QUOTE_EXPIRED', 'PRICE_CHANGED', 'POLICY_CHANGED', 'ROOM_UNAVAILABLE'].includes((caught.response?.data as { code?: string })?.code ?? '')) void refetch();
    } finally { setBusy(false); }
  };
  return <TravelerScaffold title="Xác nhận đặt phòng" back>
    {!guestReady ? <Card><T>Chưa xác nhận thông tin khách cho kỳ lưu trú này.</T><Button label="Thông tin khách" onPress={() => go('guest-info')} /></Card> : null}
    <QuoteState quote={data} valid={valid} loading={isFetching} error={quoteError} retry={() => void refetch()} secondsLeft={secondsLeft} />
    <PriceChangeNotice quote={data} accepted={acceptedQuoteId === data?.quoteId} onAccept={acceptPriceChange} />
      {data && valid ? <><QuoteHotel quote={data} /><Card><QuotePrice quote={data} /><T>{method === 'SIMULATOR' ? 'Sau khi tạo đơn, ứng dụng chờ webhook có chữ ký từ cổng mô phỏng. Không thu tiền thật.' : 'Thanh toán khi nhận phòng. Chưa thu tiền trên ứng dụng.'}</T></Card><Button disabled={busy || !canContinue || !guestReady} label={busy ? 'Đang tạo đơn...' : 'Xác nhận đặt phòng'} onPress={() => void submit()} /></> : null}
    {error ? <Card><T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T><Button label="Xem lại báo giá" secondary onPress={() => go('booking-review')} /></Card> : null}
  </TravelerScaffold>;
}

function Success() {
  const booking = useTravelerStore((state) => state.serverBooking);
  return <TravelerScaffold title="Đặt phòng đã được tạo" back>
    {booking ? <><Card><T weight="semibold" style={{ fontSize: 18 }}>{booking.hotelName}</T><T>Mã đặt phòng: {booking.code}</T><T>{dateLabel(booking.checkIn)} – {dateLabel(booking.checkOut)}</T><T>{booking.roomName}</T><T weight="bold" style={{ color: colors.primaryDark }}>{money(booking.totalAmount, booking.currency)}</T><T style={{ color: colors.muted }}>Đơn đã lưu trên máy chủ. Thanh toán thủ công tại khách sạn khi nhận phòng.</T></Card><Button label="Xem đơn đặt phòng" onPress={() => go('booking-detail')} /></> : <Card><T>Chưa có đơn đặt phòng vừa tạo.</T></Card>}
  </TravelerScaffold>;
}

function PaymentResume({ bookingId }: { bookingId: string }) {
  const payment = useQuery({ queryKey: ['latest-payment', bookingId], queryFn: () => latestBookingPayment(bookingId), retry: false });
  if (payment.isLoading) return <Card><T>Đang tải giao dịch...</T></Card>;
  if (payment.error || !payment.data) return <Card><T style={{ color: colors.muted }}>Chưa có giao dịch để kiểm tra.</T><Button label="Tải lại" secondary onPress={() => void payment.refetch()} /></Card>;
  const status = payment.data;
  return <Card>
    <T weight="semibold">Thanh toán · {status.paymentStatus === 'SUCCESS' ? 'Đã xác nhận' : status.paymentStatus === 'FAILED' ? 'Thất bại' : 'Đang xử lý'}</T>
    {status.reconciliationRequired ? <T accessibilityRole="alert" style={{ color: colors.orange }}>Giao dịch cần đối soát. Vui lòng liên hệ hỗ trợ.</T> : null}
    <Button label="Kiểm tra trạng thái" secondary onPress={() => go('payment-processing', { paymentId: status.id })} />
  </Card>;
}

function LiveBookings({ detail = false }: { detail?: boolean }) {
  const session = useTravelerStore((state) => state.session);
  const local = useTravelerStore((state) => state.serverBooking);
  const setServerBooking = useTravelerStore((state) => state.setServerBooking);
  const bookings = useQuery({
    queryKey: ['my-server-bookings', session?.mode === 'api' ? session.userId : ''],
    queryFn: async () => (await apiClient.get<ServerBooking[]>('/bookings')).data,
    enabled: session?.mode === 'api',
  });
  const selected = bookings.data?.find((item) => item.id === local?.id) ?? bookings.data?.[0];
  if (detail) return <TravelerScaffold title="Chi tiết đặt phòng" back>
    {bookings.isLoading ? <T>Đang tải...</T> : bookings.error ? <Card><T>{bookingApiError(bookings.error)}</T><Button label="Thử lại" onPress={() => void bookings.refetch()} /></Card> : selected ? <>
      <Card>
        <T weight="semibold">{selected.hotel?.name ?? local?.hotelName ?? 'Khách sạn'}</T>
        <T>Mã {selected.code}</T>
        <T>{selected.roomNameSnapshot}</T>
        <T>{dateLabel(selected.checkIn.slice(0, 10))} – {dateLabel(selected.checkOut.slice(0, 10))}</T>
        <T weight="bold">{money(selected.totalAmount, selected.currency)}</T>
        <T>Trạng thái: {selected.status}</T>
        <T style={{ color: colors.muted }}>{selected.paymentDeadline ? 'Giao dịch đang được xác minh trên máy chủ.' : 'Thanh toán tại khách sạn khi nhận phòng.'}</T>
      </Card>
      {selected.paymentDeadline ? <PaymentResume bookingId={selected.id} /> : null}
    </> : <Card><T>Không tìm thấy đơn đặt phòng.</T></Card>}
  </TravelerScaffold>;
  return <TravelerScaffold title="Đặt phòng của tôi">
    {bookings.isLoading ? <T>Đang tải...</T> : bookings.error ? <Card><T>{bookingApiError(bookings.error)}</T><Button label="Thử lại" onPress={() => void bookings.refetch()} /></Card> : bookings.data?.length ? bookings.data.map((item) => <Card key={item.id} onPress={() => {
      setServerBooking({ id: item.id, code: item.code, hotelName: item.hotel?.name ?? 'Khách sạn', roomName: item.roomNameSnapshot, checkIn: item.checkIn.slice(0, 10), checkOut: item.checkOut.slice(0, 10), totalAmount: item.totalAmount, currency: item.currency, status: item.status });
      go('booking-detail');
    }}>
      <T weight="semibold">{item.hotel?.name ?? 'Khách sạn'} · {item.code}</T>
      <T>{item.roomNameSnapshot} · {dateLabel(item.checkIn.slice(0, 10))} – {dateLabel(item.checkOut.slice(0, 10))}</T>
      <T>{money(item.totalAmount, item.currency)} · {item.status}</T>
    </Card>) : <Card><T>Chưa có đơn đặt phòng.</T></Card>}
  </TravelerScaffold>;
}
export function LiveBookingFlow({ id }: { id: LiveScreen }) {
  if (id === 'booking-review') return <Review />;
  if (id === 'guest-info') return <Guest />;
  if (id === 'special-requests') return <Guest special />;
  if (id === 'voucher') return <TravelerScaffold title="Mã ưu đãi" back><Card><T>Mã ưu đãi chưa được hỗ trợ cho đặt phòng này.</T></Card><Button label="Tiếp tục" onPress={() => go('price-breakdown')} /></TravelerScaffold>;
  if (id === 'price-breakdown') return <Breakdown />;
  if (id === 'payment-method') return <PaymentMethod />;
  if (id === 'payment-confirm') return <Confirm />;
  if (id === 'payment-processing') return <PaymentProcessing />;
  if (id === 'payment-success') return <PaymentSuccess />;
  if (id === 'payment-failed') return <PaymentFailed />;
  if (id === 'booking-confirmation') return <Success />;
  if (id === 'my-bookings') return <LiveBookings />;
  return <LiveBookings detail />;
}

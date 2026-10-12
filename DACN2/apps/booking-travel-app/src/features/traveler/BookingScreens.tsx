import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { HOTELS, currency, dateLabel } from './data';
import { calculateBookingQuote, roomRate, type BookingQuote } from './pricing';
import { useTravelerStore, type BookingStatus, type MockBooking } from './store';
import { colors } from './theme';
import { Button, Card, Chip, EmptyState, Field, SectionTitle, T, TravelerScaffold, go } from './ui';

export type BookingScreenId = 'booking-review' | 'guest-info' | 'special-requests' | 'voucher' | 'price-breakdown' | 'payment-method' | 'payment-processing' | 'payment-success' | 'payment-failed' | 'booking-confirmation' | 'my-bookings' | 'booking-detail' | 'qr-ticket' | 'cancel-booking' | 'refund-request' | 'invoice' | 'bookings-empty';

const STATUS: Record<BookingStatus, string> = { PENDING_PAYMENT: 'Chờ thanh toán', CONFIRMED: 'Đã xác nhận', CHECKED_IN: 'Đã nhận phòng', COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy', REFUND_PENDING: 'Đang hoàn tiền', REFUNDED: 'Đã hoàn tiền' };

function useBooking() {
  const { bookings, selectedBookingId } = useTravelerStore();
  return bookings.find((booking) => booking.id === selectedBookingId) ?? bookings[0];
}

function BookingRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  const content = <><T style={{ color: colors.muted, fontSize: 14 }}>{label}</T><T weight="medium" style={{ flexShrink: 1, textAlign: 'right', fontSize: 14 }}>{value}</T></>;
  const style = { minHeight: 28, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 8 };
  return onPress ? <Pressable onPress={onPress} style={style}>{content}</Pressable> : <View style={style}>{content}</View>;
}

function PriceLines({ quote }: { quote: BookingQuote }) {
  return <View style={{ gap: 8 }}><BookingRow label={`Giá phòng · ${quote.nights} đêm${quote.rooms > 1 ? ` · ${quote.rooms} phòng` : ''}`} value={currency(quote.roomSubtotal)} /><BookingRow label="Thuế và phí" value={currency(quote.taxesAndFees)} /><BookingRow label="Ưu đãi" value={`− ${currency(quote.discount)}`} /><View style={{ height: 1, backgroundColor: colors.line }} /><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 34 }}><T weight="semibold">Tổng thanh toán</T><T weight="bold" style={{ color: colors.primaryDark, fontSize: 20 }}>{currency(quote.total)}</T></View></View>;
}

function BookingReviewScreen() {
  const { selectedHotelId, selectedRoom, checkIn, checkOut, adults, rooms, guestName, specialRequest, voucher, profile } = useTravelerStore();
  const hotel = HOTELS.find((item) => item.id === selectedHotelId) ?? HOTELS[0];
  const quote = calculateBookingQuote(roomRate(hotel.price, selectedRoom), checkIn, checkOut, rooms, voucher);
  return <TravelerScaffold title="Xem lại đặt phòng" back background={colors.white} footer={<Button disabled={quote.nights < 1} label={`Thanh toán ${currency(quote.total)}`} onPress={() => go('guest-info')} />}>
    <View style={{ flexDirection: 'row', gap: 8 }}>{['1 Thông tin', '2 Thanh toán', '3 Xác nhận'].map((label, index) => <View key={label} style={{ flex: 1, backgroundColor: index === 0 ? '#E7F0FF' : '#F3F5F7', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 7 }}><T weight="semibold" style={{ color: index === 0 ? colors.primaryDark : colors.muted, fontSize: 11 }}>{label}</T></View>)}</View>
    <Pressable onPress={() => go('hotel-detail')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Image source={hotel.image} style={{ width: 84, height: 76, borderRadius: 10 }} /><View style={{ flex: 1 }}><T weight="semibold">{hotel.name}</T><T style={{ color: colors.muted, fontSize: 12 }}>{dateLabel(checkIn)}–{dateLabel(checkOut)} · {quote.nights} đêm · {adults} khách</T><T style={{ color: colors.primaryDark, fontSize: 12 }}>{selectedRoom}</T></View></Pressable>
    <SectionTitle title="Thông tin lưu trú" /><View style={{ gap: 8 }}><BookingRow label="Nhận phòng" value={`${dateLabel(checkIn)} · từ 14:00`} /><BookingRow label="Trả phòng" value={`${dateLabel(checkOut)} · trước 12:00`} /><BookingRow label="Khách lưu trú" value={`${guestName} · ${adults} khách`} onPress={() => go('guest-info')} /></View>
    <Pressable onPress={() => go('special-requests')}><T weight="semibold">Yêu cầu đặc biệt  ›</T><T style={{ color: colors.muted, marginTop: 6 }}>{specialRequest || 'Phòng tầng cao, yên tĩnh nếu có thể'}</T></Pressable>
    <Pressable onPress={() => go('voucher')} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T weight="semibold" style={{ color: colors.green }}>Ưu đãi {voucher || 'TRAVEL12'}</T><T style={{ color: colors.green, fontSize: 12 }}>{quote.voucherApplied ? 'Đã áp dụng' : 'Nhập mã'}</T></Pressable>
    <SectionTitle title="Chi tiết giá" action={profile.currency} onPress={() => go('price-breakdown')} /><PriceLines quote={quote} />
    <T weight="semibold" style={{ color: colors.green, fontSize: 13 }}>Hủy miễn phí trước 18:00, 10/10</T><T style={{ color: colors.muted, fontSize: 12 }}>Sau thời điểm này, phí hủy áp dụng theo chính sách của phòng.</T>
    <T style={{ color: colors.orange, fontSize: 12 }}>Bản demo: chưa tạo giao dịch hoặc giữ phòng thật.</T>
  </TravelerScaffold>;
}

function GuestInfoScreen({ special = false }: { special?: boolean }) {
  const { guestName, guestPhone, specialRequest, setBookingDraft } = useTravelerStore();
  const [name, setName] = useState(guestName);
  const [phone, setPhone] = useState(guestPhone);
  const [request, setRequest] = useState(specialRequest);
  const [error, setError] = useState('');
  return <TravelerScaffold title={special ? 'Yêu cầu đặc biệt' : 'Thông tin khách lưu trú'} back>
    {!special ? <><Field label="Họ tên khách" onChangeText={setName} placeholder="Nguyễn Minh Quang" value={name} /><Field keyboardType="phone-pad" label="Số điện thoại" onChangeText={setPhone} placeholder="0968 380 641" value={phone} /></> : null}
    <Field label="Yêu cầu đặc biệt" onChangeText={setRequest} placeholder="Nhận phòng muộn nếu có thể" value={request} />
    {error ? <T style={{ color: colors.error }}>{error}</T> : null}
    <Button label="Tiếp tục" onPress={() => { if (!special && (name.trim().length < 2 || !/^\+?[0-9 ]{9,15}$/.test(phone))) return setError('Vui lòng nhập họ tên và số điện thoại hợp lệ.'); setBookingDraft({ guestName: name, guestPhone: phone, specialRequest: request }); go(special ? 'booking-review' : 'voucher'); }} />
  </TravelerScaffold>;
}

function VoucherScreen() {
  const current = useTravelerStore((state) => state.voucher);
  const setBookingDraft = useTravelerStore((state) => state.setBookingDraft);
  const [code, setCode] = useState(current || 'TRAVEL12');
  const [error, setError] = useState('');
  return <TravelerScaffold title="Mã ưu đãi" back><Field label="Mã ưu đãi" onChangeText={setCode} placeholder="TRAVEL12" value={code} /><Card><T weight="semibold">Ưu đãi đủ điều kiện</T><T style={{ color: colors.muted, lineHeight: 20 }}>Giảm 12% tối đa 522.000 ₫ · điều kiện áp dụng theo chương trình.</T></Card>{error ? <T style={{ color: colors.error }}>{error}</T> : null}<Button label="Tiếp tục" onPress={() => { if (code.trim() && !['TRAVEL12', 'MYKHE12'].includes(code.trim().toUpperCase())) return setError('Mã demo không hợp lệ. Hãy dùng TRAVEL12, MYKHE12 hoặc để trống.'); setBookingDraft({ voucher: code.trim().toUpperCase() }); go('price-breakdown'); }} /></TravelerScaffold>;
}

function PriceBreakdownScreen() {
  const { selectedHotelId, selectedRoom, checkIn, checkOut, adults, rooms, voucher } = useTravelerStore();
  const hotel = HOTELS.find((item) => item.id === selectedHotelId) ?? HOTELS[0];
  const quote = calculateBookingQuote(roomRate(hotel.price, selectedRoom), checkIn, checkOut, rooms, voucher);
  return <TravelerScaffold title="Chi tiết thanh toán" back><Card style={{ borderWidth: 1, borderColor: colors.line }}><T weight="semibold" style={{ fontSize: 18 }}>{hotel.name}</T><T style={{ color: colors.muted }}>{dateLabel(checkIn)}–{dateLabel(checkOut)} · {quote.nights} đêm · {adults} khách</T><T style={{ color: colors.orange }}>● Chờ thanh toán demo</T><T weight="semibold" style={{ fontSize: 18 }}>Tạm tính {currency(quote.total)}</T></Card><Card><T weight="semibold">Chi tiết giá</T><PriceLines quote={quote} /><T style={{ color: colors.muted, fontSize: 12 }}>Hủy miễn phí trước 18:00, 10/10/2026. Điều kiện có thể thay đổi theo phòng.</T></Card><Button disabled={quote.nights < 1} label={`Thanh toán ${currency(quote.total)}`} onPress={() => go('payment-method')} /></TravelerScaffold>;
}

function PaymentMethodScreen() {
  const { paymentMethod, setBookingDraft } = useTravelerStore();
  const methods = [{ id: 'card', label: 'Thẻ ngân hàng', detail: 'Visa ·•••• 4242 · Bảo mật thanh toán' }, { id: 'bank', label: 'Chuyển khoản ngân hàng', detail: 'Mô phỏng chuyển khoản' }, { id: 'wallet', label: 'Ví điện tử', detail: 'Mô phỏng thanh toán ví' }] as const;
  return <TravelerScaffold title="Phương thức thanh toán" back footer={<Button label="Tiếp tục" onPress={() => go('payment-processing')} />}>
    {methods.map((method) => <Pressable key={method.id} onPress={() => setBookingDraft({ paymentMethod: method.id })} style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: paymentMethod === method.id ? colors.primary : colors.line, padding: 14, borderRadius: 12, minHeight: 64 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T weight="semibold">{method.label}</T><T style={{ color: colors.primary }}>{paymentMethod === method.id ? '●' : '○'}</T></View><T style={{ color: colors.muted, fontSize: 12 }}>{method.detail}</T></Pressable>)}
    <Card><T weight="semibold">Thanh toán an toàn</T><T style={{ color: colors.muted }}>Bản demo không thu tiền. Giao dịch chỉ được mô phỏng trên thiết bị này.</T></Card>
  </TravelerScaffold>;
}

function PaymentProcessingScreen() {
  const createBooking = useTravelerStore((state) => state.createBooking);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <TravelerScaffold title="Đang thanh toán" back><Card><T weight="semibold">Đang kiểm tra trạng thái</T><T style={{ color: colors.muted }}>Vui lòng chờ xác nhận của bước thanh toán mô phỏng. Không tạo đơn đặt phòng mới nhiều lần.</T></Card>{error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}<Button disabled={busy} label={busy ? 'Đang xác nhận...' : 'Xác nhận thanh toán demo'} onPress={() => { setBusy(true); if (!createBooking()) { setBusy(false); setError('Ngày lưu trú không hợp lệ. Vui lòng chọn lại ngày.'); return; } go('payment-success'); }} /><Button label="Mô phỏng thanh toán thất bại" secondary onPress={() => go('payment-failed')} /><Card style={{ backgroundColor: '#DCEAFF' }}><T style={{ color: colors.gray }}>Đây là luồng demo. Không có API thanh toán hoặc giao dịch thật.</T></Card></TravelerScaffold>;
}

function PaymentResultScreen({ failed }: { failed: boolean }) {
  return <TravelerScaffold title={failed ? 'Thanh toán thất bại' : 'Thanh toán thành công'} back={failed} footer={failed ? <Button label="Thử thanh toán lại" onPress={() => go('payment-method')} /> : undefined}>
    <Card><T weight="semibold">{failed ? 'Thanh toán chưa thành công' : 'Đã xác nhận thanh toán mô phỏng'}</T><T style={{ color: colors.muted }}>{failed ? 'Giao dịch chưa được xác nhận. Bạn có thể thử lại hoặc chọn phương thức khác.' : 'Đặt phòng demo đã được lưu trên thiết bị. Không phát sinh thanh toán thật.'}</T></Card>
    {!failed ? <Button label="Xem xác nhận đặt phòng" onPress={() => go('booking-confirmation')} /> : null}
  </TravelerScaffold>;
}

function BookingCard({ booking }: { booking: MockBooking }) {
  const select = useTravelerStore((state) => state.setBookingDraft);
  const hotel = HOTELS.find((item) => item.id === booking.hotelId) ?? HOTELS[0];
  const open = (id: string) => { select({ selectedBookingId: booking.id }); go(id); };
  return <Card style={{ borderWidth: 1, borderColor: colors.line }}><Pressable onPress={() => open('booking-detail')} style={{ gap: 7 }}><T weight="semibold" style={{ fontSize: 16 }}>{hotel.name}</T><T style={{ color: colors.muted }}>{dateLabel(booking.checkIn)}–{dateLabel(booking.checkOut)} · {booking.guests} khách</T><T weight="semibold" style={{ color: booking.status === 'CANCELLED' ? colors.error : colors.primary }}>{STATUS[booking.status]}</T><T weight="bold" style={{ color: colors.primaryDark }}>{currency(booking.amount)}</T></Pressable><Button compact label={booking.status === 'CONFIRMED' ? 'Xem mã QR' : booking.status === 'COMPLETED' ? 'Viết đánh giá' : booking.status === 'PENDING_PAYMENT' ? 'Thanh toán' : 'Xem chi tiết'} secondary onPress={() => open(booking.status === 'CONFIRMED' ? 'qr-ticket' : booking.status === 'COMPLETED' ? 'write-review' : booking.status === 'PENDING_PAYMENT' ? 'payment-method' : 'booking-detail')} /></Card>;
}

function MyBookingsScreen() {
  const bookings = useTravelerStore((state) => state.bookings);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('all');
  const visible = bookings.filter((booking) => filter === 'all' || (filter === 'upcoming' ? ['PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status) : ['COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED'].includes(booking.status)));
  return <TravelerScaffold title="Đặt phòng của tôi"><View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Tất cả" selected={filter === 'all'} onPress={() => setFilter('all')} /><Chip label="Sắp tới" selected={filter === 'upcoming'} onPress={() => setFilter('upcoming')} /><Chip label="Lịch sử" selected={filter === 'past'} onPress={() => setFilter('past')} /></View>{visible.length ? visible.map((booking) => <BookingCard booking={booking} key={booking.id} />) : <EmptyState action="Tìm khách sạn" detail="Các đặt phòng demo của bạn sẽ xuất hiện ở đây." onPress={() => go('search-entry')} title="Chưa có đặt phòng" />}</TravelerScaffold>;
}

function BookingDetailScreen() {
  const booking = useBooking();
  const updateBooking = useTravelerStore((state) => state.updateBooking);
  if (!booking) return <TravelerScaffold title="Chi tiết đặt phòng" back><EmptyState detail="Chưa có đặt phòng để xem." title="Chưa có dữ liệu" /></TravelerScaffold>;
  const hotel = HOTELS.find((item) => item.id === booking.hotelId) ?? HOTELS[0];
  return <TravelerScaffold title="Chi tiết đặt phòng" back><Card><T weight="semibold" style={{ fontSize: 18 }}>{hotel.name}</T><T style={{ color: colors.muted }}>Mã {booking.id} · {STATUS[booking.status]}</T><T style={{ color: colors.muted }}>{dateLabel(booking.checkIn)}–{dateLabel(booking.checkOut)} · {booking.room}</T><T weight="bold" style={{ color: colors.primaryDark }}>{currency(booking.amount)}</T></Card>
    {booking.status === 'PENDING_PAYMENT' ? <Button label="Thanh toán đơn demo" onPress={() => go('payment-method')} /> : null}
    {['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(booking.status) ? <Button label="Xem mã QR nhận phòng" onPress={() => go('qr-ticket')} /> : null}
    {booking.status === 'CONFIRMED' ? <><Button label="Liên hệ khách sạn" secondary onPress={() => go('chat-detail')} /><Button label="Mô phỏng nhận phòng" secondary onPress={() => updateBooking(booking.id, 'CHECKED_IN')} />{booking.checkIn > new Date().toISOString().slice(0, 10) ? <Button label="Hủy đặt phòng" secondary onPress={() => go('cancel-booking')} /> : null}</> : null}
    {booking.status === 'CHECKED_IN' ? <Button label="Mô phỏng hoàn thành lưu trú" onPress={() => updateBooking(booking.id, 'COMPLETED')} /> : null}
    {booking.status === 'COMPLETED' ? <Button label="Viết đánh giá" onPress={() => go('write-review')} /> : null}
    {booking.status === 'CANCELLED' ? <Button label="Yêu cầu hoàn tiền" onPress={() => go('refund-request')} /> : null}
    {booking.status === 'REFUND_PENDING' ? <Button label="Mô phỏng hoàn tiền thành công" onPress={() => updateBooking(booking.id, 'REFUNDED')} /> : null}
    <Button label="Xem hóa đơn" secondary onPress={() => go('invoice')} />
  </TravelerScaffold>;
}

function ConfirmationScreen() {
  const booking = useBooking();
  return <TravelerScaffold title="Xác nhận đặt phòng" back><Card><T weight="semibold">✓ Đặt phòng demo đã xác nhận</T><T style={{ color: colors.muted }}>Mã {booking?.id ?? 'BT-DEMO-001'}</T></Card><Card onPress={() => go('qr-ticket')} style={{ alignItems: 'center' }}><T weight="semibold">Mã QR nhận phòng</T><QRCode value={booking?.id ?? 'BT-DEMO-001'} size={96} quietZone={8} /></Card><Button label="Xem đặt phòng" onPress={() => go('booking-detail')} /><T style={{ color: colors.orange, fontSize: 12 }}>Mã này chỉ dùng để demo, không xác nhận lưu trú thật.</T></TravelerScaffold>;
}

function QrTicketScreen() {
  const booking = useBooking();
  const hotel = HOTELS.find((item) => item.id === booking?.hotelId) ?? HOTELS[0];
  const guest = useTravelerStore((state) => state.guestName);
  return <TravelerScaffold title="Mã QR nhận phòng" back><Card style={{ alignItems: 'center', padding: 24 }}><T weight="semibold" style={{ fontSize: 18 }}>Vé nhận phòng demo</T><QRCode value={booking?.id ?? 'BT-DEMO-001'} size={200} quietZone={10} /><T weight="semibold">{booking?.id}</T><T style={{ color: colors.muted, textAlign: 'center' }}>Trình mã demo tại quầy. Không dùng được tại khách sạn thật.</T></Card><Card><BookingRow label="Khách sạn" value={hotel.name} /><BookingRow label="Khách lưu trú" value={guest} /><BookingRow label="Ngày ở" value={booking ? `${dateLabel(booking.checkIn)}–${dateLabel(booking.checkOut)}` : '—'} /><BookingRow label="Trạng thái" value={booking ? STATUS[booking.status] : '—'} /></Card></TravelerScaffold>;
}

function CancelOrRefundScreen({ refund }: { refund: boolean }) {
  const booking = useBooking();
  const updateBooking = useTravelerStore((state) => state.updateBooking);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  return <TravelerScaffold title={refund ? 'Yêu cầu hoàn tiền' : 'Hủy đặt phòng'} back><Card><T weight="semibold">{booking?.id}</T><T style={{ color: colors.muted }}>{refund ? 'Yêu cầu hoàn tiền sẽ được mô phỏng trên thiết bị.' : 'Kiểm tra chính sách hủy trước khi xác nhận.'}</T></Card><Field label="Lý do" onChangeText={(value) => { setReason(value); setError(''); }} placeholder="Nhập lý do" value={reason} />{error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}<Button label={refund ? 'Gửi yêu cầu demo' : 'Xác nhận hủy demo'} onPress={() => { if (!booking || !reason.trim()) return setError('Vui lòng nhập lý do.'); if (!refund && booking.checkIn <= new Date().toISOString().slice(0, 10)) return setError('Đơn này đã đến ngày nhận phòng và không thể hủy trong bản demo.'); updateBooking(booking.id, refund ? 'REFUND_PENDING' : 'CANCELLED'); go('booking-detail'); }} /></TravelerScaffold>;
}

function InvoiceScreen() {
  const booking = useBooking();
  const hotel = HOTELS.find((item) => item.id === booking?.hotelId) ?? HOTELS[0];
  return <TravelerScaffold title="Hóa đơn / Biên nhận" back><Card><T weight="semibold" style={{ fontSize: 18 }}>BOOKING TRAVEL · DEMO</T><T>Mã đặt phòng: {booking?.id}</T><T>{hotel.name}</T><T>Giá trị: {currency(booking?.amount ?? 0)}</T><T style={{ color: colors.muted }}>Biên nhận mô phỏng, không phải chứng từ thanh toán thật.</T></Card></TravelerScaffold>;
}

export function BookingScreen({ id }: { id: BookingScreenId }) {
  if (id === 'booking-review') return <BookingReviewScreen />;
  if (id === 'guest-info') return <GuestInfoScreen />;
  if (id === 'special-requests') return <GuestInfoScreen special />;
  if (id === 'voucher') return <VoucherScreen />;
  if (id === 'price-breakdown') return <PriceBreakdownScreen />;
  if (id === 'payment-method') return <PaymentMethodScreen />;
  if (id === 'payment-processing') return <PaymentProcessingScreen />;
  if (id === 'payment-success') return <PaymentResultScreen failed={false} />;
  if (id === 'payment-failed') return <PaymentResultScreen failed />;
  if (id === 'booking-confirmation') return <ConfirmationScreen />;
  if (id === 'my-bookings' || id === 'bookings-empty') return <MyBookingsScreen />;
  if (id === 'booking-detail') return <BookingDetailScreen />;
  if (id === 'qr-ticket') return <QrTicketScreen />;
  if (id === 'cancel-booking') return <CancelOrRefundScreen refund={false} />;
  if (id === 'refund-request') return <CancelOrRefundScreen refund />;
  return <InvoiceScreen />;
}

export { MyBookingsScreen };

import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { useOwnerNotifications } from '@/features/owner-application/api';

import { HOTELS, currency } from './data';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, EmptyState, Field, HotelCard, T, TravelerScaffold, go } from './ui';

export type SocialScreenId = 'favorites' | 'wishlist' | 'compare' | 'chat-list' | 'chat-detail' | 'chat-attachments' | 'notifications' | 'notification-preferences' | 'write-review' | 'review-submitted' | 'edit-review' | 'my-reviews' | 'report-review';

function FavoritesScreen({ wishlist = false }: { wishlist?: boolean }) {
  const { favorites, selectHotel } = useTravelerStore();
  const hotels = HOTELS.filter((hotel) => favorites.includes(hotel.id));
  return <TravelerScaffold title={wishlist ? 'Wishlist' : 'Khách sạn yêu thích'} back={wishlist}>
    <Card><T weight="semibold">Danh sách đã lưu</T><T style={{ color: colors.muted }}>Những nơi ở bạn quan tâm cho chuyến đi tiếp theo.</T></Card>
    {hotels.length ? hotels.map((hotel) => <View key={hotel.id} style={{ gap: 12 }}><HotelCard hotel={hotel} showActions /><Button label="Xem chi tiết" onPress={() => { selectHotel(hotel.id); go('hotel-detail'); }} /></View>) : <EmptyState action="Tìm khách sạn" detail="Chạm biểu tượng trái tim ở khách sạn để lưu lại." onPress={() => go('results')} title="Chưa có khách sạn yêu thích" />}
  </TravelerScaffold>;
}

function CompareScreen() {
  const { compare, selectHotel, toggleCompare } = useTravelerStore();
  const hotels = HOTELS.filter((hotel) => compare.includes(hotel.id));
  return <TravelerScaffold title="So sánh khách sạn" back>
    {hotels.length < 2 ? <EmptyState action="Chọn khách sạn" detail="Chọn từ 2 đến 4 khách sạn trong kết quả tìm kiếm." onPress={() => go('results')} title="Chưa đủ khách sạn để so sánh" /> : <>
      <Card><T weight="semibold">So sánh {hotels.length} khách sạn</T><T style={{ color: colors.muted }}>{hotels.map((hotel) => hotel.name).join('  ↔  ')}</T></Card>
      <Card><T>Điểm đánh giá</T><T weight="semibold">{hotels.map((hotel) => hotel.rating).join(' / ')}</T></Card>
      <Card><T>Giá từ</T><T weight="semibold">{hotels.map((hotel) => currency(hotel.price)).join(' / ')}</T></Card>
      <Card><T>Vị trí</T><T weight="semibold">{hotels.map((hotel) => hotel.area).join(' / ')}</T></Card>
      {hotels.map((hotel) => <View key={hotel.id} style={{ gap: 8 }}><HotelCard hotel={hotel} /><Button label={`Xem ${hotel.name}`} onPress={() => { selectHotel(hotel.id); go('hotel-detail'); }} /><Button label="Bỏ khỏi so sánh" secondary onPress={() => toggleCompare(hotel.id)} /></View>)}
    </>}
  </TravelerScaffold>;
}

function ChatScreen({ detail = false }: { detail?: boolean }) {
  const messages = useTravelerStore((state) => state.messages);
  const addMessage = useTravelerStore((state) => state.addMessage);
  const [text, setText] = useState('');
  const send = () => { if (!text.trim()) return; addMessage(text.trim()); setText(''); };
  return <TravelerScaffold title={detail ? 'Trò chuyện với khách sạn' : 'Tin nhắn'} back={detail}>
    <Card onPress={detail ? undefined : () => go('chat-detail')}><T weight="semibold">Blue Horizon My Khe Hotel</T><T style={{ color: colors.muted }}>Hỗ trợ đặt phòng · Thường phản hồi trong vài phút</T></Card>
    <Card><T weight="semibold">Khách sạn</T><T style={{ color: colors.muted }}>Chào bạn! Chúng tôi có thể hỗ trợ gì cho kỳ nghỉ?</T></Card>
    <Card><T weight="semibold">Bạn</T><T style={{ color: colors.muted }}>Tôi có thể nhận phòng lúc 20:00 không?</T></Card>
    {messages.map((message) => <Card key={message.id} style={{ backgroundColor: message.mine ? colors.primaryLight : colors.white }}><T weight="semibold">{message.mine ? 'Bạn' : 'Khách sạn'}</T><T style={{ color: colors.muted }}>{message.text}</T></Card>)}
    <Field label="Tin nhắn" onChangeText={setText} placeholder="Nhập tin nhắn..." value={text} />
    <Button label="Gửi tin nhắn" onPress={send} />
    <T style={{ color: colors.orange, fontSize: 12 }}>Tin nhắn chỉ lưu trong bản demo, chưa gửi đến khách sạn.</T>
  </TravelerScaffold>;
}

function NotificationScreen({ preferences = false }: { preferences?: boolean }) {
  const enabled = useTravelerStore((state) => state.notificationSettings);
  const update = useTravelerStore((state) => state.setNotificationSettings);
  const session = useTravelerStore((state) => state.session);
  const ownerNotifications = useOwnerNotifications(session?.mode === 'api' ? session.userId : undefined);
  if (preferences) return <TravelerScaffold title="Tùy chọn thông báo" back>{([{ key: 'booking', label: 'Đặt phòng' }, { key: 'deal', label: 'Ưu đãi' }, { key: 'chat', label: 'Tin nhắn' }] as const).map((item) => <Card key={item.key} onPress={() => update({ [item.key]: !enabled[item.key] })}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T>{item.label}</T><T style={{ color: enabled[item.key] ? colors.primary : colors.muted }}>{enabled[item.key] ? 'Bật' : 'Tắt'}</T></View></Card>)}</TravelerScaffold>;
  if (session?.mode === 'api') return <TravelerScaffold title="Thông báo" back>
    {ownerNotifications.isPending ? <Card><T>Đang tải thông báo...</T></Card> : null}
    {ownerNotifications.isError ? <Card><T>Không thể tải thông báo xác minh.</T><Button label="Thử lại" secondary onPress={() => void ownerNotifications.refetch()} /></Card> : null}
    {ownerNotifications.data?.map((item) => <Card key={item.id} onPress={() => router.push('/owner-application/status' as Href)}><T weight="semibold">{item.title}</T><T style={{ color: colors.muted }}>{item.body}</T><T style={{ color: colors.primary }}>Xem trạng thái hồ sơ</T></Card>)}
    {ownerNotifications.isSuccess && !ownerNotifications.data.length ? <EmptyState title="Chưa có thông báo xác minh" detail="Kết quả xét duyệt hồ sơ sẽ xuất hiện tại đây." /> : null}
  </TravelerScaffold>;
  return <TravelerScaffold title="Thông báo" back><Card onPress={() => go('my-bookings')}><T weight="semibold">Đặt phòng đã xác nhận</T><T style={{ color: colors.muted }}>BT-DEMO-001 · 12–15/09/2026</T></Card><Card onPress={() => go('results')}><T weight="semibold">Ưu đãi cho chuyến đi Đà Nẵng</T><T style={{ color: colors.muted }}>Thông báo mới · 2 giờ trước</T></Card><Card onPress={() => go('chat-list')}><T weight="semibold">Khách sạn đã trả lời tin nhắn</T><T style={{ color: colors.muted }}>Thông báo mới · 2 giờ trước</T></Card><Button label="Cập nhật tùy chọn" onPress={() => go('notification-preferences')} /></TravelerScaffold>;
}

function ReviewScreen({ edit = false }: { edit?: boolean }) {
  const bookingId = useTravelerStore((state) => state.selectedBookingId) ?? 'BT-DEMO-001';
  const booking = useTravelerStore((state) => state.bookings.find((item) => item.id === bookingId));
  const reviews = useTravelerStore((state) => state.reviews);
  const addReview = useTravelerStore((state) => state.addReview);
  const existing = reviews.find((item) => item.bookingId === bookingId);
  const [ratingText, setRatingText] = useState(String(existing?.rating ?? 9));
  const [text, setText] = useState(existing?.text ?? 'Phòng sạch, vị trí thuận tiện, nhân viên thân thiện.');
  const [criteria, setCriteria] = useState(existing?.criteria ?? { 'Sạch sẽ': 9, 'Vị trí': 10, 'Dịch vụ': 9, 'Tiện nghi': 8, 'Thoải mái': 9, 'Giá trị': 9 });
  const [imageUri, setImageUri] = useState(existing?.imageUri);
  const [error, setError] = useState('');
  const hotel = HOTELS.find((item) => item.id === booking?.hotelId) ?? HOTELS[0];
  const pickPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.8 });
      if (!result.canceled) setImageUri(result.assets[0].uri);
    } catch { setError('Không thể mở thư viện ảnh lúc này.'); }
  };
  return <TravelerScaffold title={edit ? 'Chỉnh sửa đánh giá' : 'Viết đánh giá'} back>
    <Card><T weight="semibold">{hotel.name}</T><T style={{ color: colors.muted }}>Chỉ đặt phòng đã hoàn tất mới được đánh giá.</T></Card>
    <View style={{ width: 110 }}><Field keyboardType="number-pad" label="Điểm tổng thể (1–10)" onChangeText={setRatingText} value={ratingText} /></View>
    <Field label="Trải nghiệm của bạn" multiline onChangeText={setText} placeholder="Chia sẻ trải nghiệm lưu trú" value={text} />
    <Card><T weight="semibold">Điểm từng tiêu chí (1–10)</T>{Object.entries(criteria).map(([name, score]) => <Pressable accessibilityLabel={`${name}: ${score} trên 10. Chạm để tăng điểm.`} key={name} onPress={() => setCriteria({ ...criteria, [name]: score >= 10 ? 1 : score + 1 })} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 28 }}><T style={{ color: colors.muted }}>{name}</T><T weight="semibold" style={{ color: colors.primary }}>{score}/10</T></Pressable>)}</Card>
    <Card><T weight="semibold">Ảnh trải nghiệm (không bắt buộc)</T>{imageUri ? <Image source={{ uri: imageUri }} style={{ height: 130, width: 160, borderRadius: 10 }} /> : null}<Pressable onPress={pickPhoto}><T style={{ color: colors.primary }}>{imageUri ? 'Thay ảnh' : '+ Thêm ảnh phòng hoặc tiện ích'}</T></Pressable>{imageUri ? <Pressable onPress={() => setImageUri(undefined)}><T style={{ color: colors.error }}>Xóa ảnh</T></Pressable> : null}</Card>
    {error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}
    <Button label={edit ? 'Lưu đánh giá' : 'Gửi đánh giá'} onPress={() => { const rating = Number(ratingText); if (booking?.status !== 'COMPLETED') return setError('Chỉ có thể đánh giá sau khi hoàn thành lưu trú.'); if (!Number.isInteger(rating) || rating < 1 || rating > 10) return setError('Điểm tổng thể phải là số từ 1 đến 10.'); if (text.trim().length < 10) return setError('Vui lòng nhập ít nhất 10 ký tự.'); addReview({ bookingId, rating, text: text.trim(), criteria, imageUri }); go('review-submitted'); }} />
  </TravelerScaffold>;
}

function MyReviewsScreen() {
  const reviews = useTravelerStore((state) => state.reviews);
  const bookings = useTravelerStore((state) => state.bookings);
  const select = useTravelerStore((state) => state.setBookingDraft);
  const remove = useTravelerStore((state) => state.removeReview);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  return <TravelerScaffold title="Đánh giá của tôi" back>{reviews.length ? reviews.map((review) => {
    const booking = bookings.find((item) => item.id === review.bookingId);
    const hotel = HOTELS.find((item) => item.id === booking?.hotelId) ?? HOTELS[0];
    return <Card key={review.bookingId}><T weight="semibold">{hotel.name} · {review.rating}/10</T><T style={{ color: colors.muted }}>{review.text}</T>{review.imageUri ? <Image source={{ uri: review.imageUri }} style={{ height: 120, width: 150, borderRadius: 10 }} /> : null}<Button compact label="Chỉnh sửa" secondary onPress={() => { select({ selectedBookingId: review.bookingId }); go('edit-review'); }} /><Button compact label={deleteId === review.bookingId ? 'Xác nhận xóa đánh giá' : 'Xóa đánh giá'} secondary onPress={() => deleteId === review.bookingId ? remove(review.bookingId) : setDeleteId(review.bookingId)} /></Card>;
  }) : <EmptyState action="Xem lịch sử đặt phòng" detail="Sau khi hoàn tất lưu trú, bạn có thể viết đánh giá cho khách sạn." onPress={() => go('my-bookings')} title="Chưa có đánh giá" />}</TravelerScaffold>;
}

function ReportReviewScreen() {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  return <TravelerScaffold title="Báo cáo đánh giá" back><Card><T weight="semibold">Nội dung không phù hợp</T><T style={{ color: colors.muted }}>Vui lòng mô tả lý do báo cáo.</T></Card><Field label="Lý do" onChangeText={setReason} value={reason} />{error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}{sent ? <T style={{ color: colors.green }}>Đã lưu báo cáo demo trên thiết bị.</T> : null}<Button label="Gửi báo cáo demo" onPress={() => reason.trim() ? setSent(true) : setError('Vui lòng nhập lý do báo cáo.')} /></TravelerScaffold>;
}

function ReviewSubmittedScreen() {
  return <TravelerScaffold title="Đã gửi đánh giá" back><Card><T weight="semibold">Cảm ơn bạn đã chia sẻ!</T><T style={{ color: colors.muted }}>Đánh giá demo đã được lưu trên thiết bị.</T></Card><Button label="Xem đánh giá của tôi" onPress={() => go('my-reviews')} /></TravelerScaffold>;
}

export function SocialScreen({ id }: { id: SocialScreenId }) {
  if (id === 'favorites') return <FavoritesScreen />;
  if (id === 'wishlist') return <FavoritesScreen wishlist />;
  if (id === 'compare') return <CompareScreen />;
  if (id === 'chat-list' || id === 'chat-detail') return <ChatScreen detail={id === 'chat-detail'} />;
  if (id === 'chat-attachments') return <TravelerScaffold title="Đính kèm" back><Card><T weight="semibold">Đính kèm trong bản demo</T><T style={{ color: colors.muted }}>Bạn có thể mô tả yêu cầu trong tin nhắn.</T></Card><Button label="Trở lại trò chuyện" onPress={() => go('chat-detail')} /></TravelerScaffold>;
  if (id === 'notifications' || id === 'notification-preferences') return <NotificationScreen preferences={id === 'notification-preferences'} />;
  if (id === 'write-review' || id === 'edit-review') return <ReviewScreen edit={id === 'edit-review'} />;
  if (id === 'review-submitted') return <ReviewSubmittedScreen />;
  if (id === 'my-reviews') return <MyReviewsScreen />;
  return <ReportReviewScreen />;
}

export { ChatScreen, FavoritesScreen };

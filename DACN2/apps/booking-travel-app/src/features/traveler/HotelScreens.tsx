import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HOTELS, ROOM_IMAGE, currency, dateLabel, nights } from './data';
import { roomRate } from './pricing';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, Chip, Field, FigmaIcon, Row, SectionTitle, T, TravelerScaffold, go } from './ui';

export type HotelScreenId = 'hotel-detail' | 'gallery' | 'hotel-amenities' | 'policies' | 'nearby-places' | 'rooms' | 'room-detail' | 'sold-out' | 'report-hotel';

const backIcon = require('./assets/167d6.svg');
const shareIcon = require('./assets/30417.svg');
const favoriteIcon = require('./assets/a78b2.svg');
const addressIcon = require('./assets/5f3ce.svg');
const starIcon = require('./assets/c2594.svg');
const aiIcon = require('./assets/62312.svg');

function useSelectedHotel() {
  const selected = useTravelerStore((state) => state.selectedHotelId);
  return HOTELS.find((hotel) => hotel.id === selected) ?? HOTELS[0];
}

function HotelDetailScreen() {
  const hotel = useSelectedHotel();
  const { favorites, toggleFavorite } = useTravelerStore();
  return <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.white }}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ height: 280 }}><Pressable onPress={() => go('gallery')}><Image source={hotel.image} style={{ width: '100%', height: 280 }} /></Pressable>
        <View style={{ position: 'absolute', left: 16, right: 16, top: 16, flexDirection: 'row', justifyContent: 'space-between' }}><Pressable accessibilityLabel="Quay lại" onPress={() => router.back()} style={{ backgroundColor: colors.white, borderRadius: 99, padding: 10 }}><FigmaIcon source={backIcon} /></Pressable><View style={{ flexDirection: 'row', gap: 12 }}><Pressable accessibilityLabel="Chia sẻ" onPress={() => Share.share({ message: `${hotel.name} · ${hotel.address}, ${hotel.destination}` })} style={{ backgroundColor: colors.white, borderRadius: 99, padding: 10 }}><FigmaIcon source={shareIcon} /></Pressable><Pressable accessibilityLabel="Yêu thích" onPress={() => toggleFavorite(hotel.id)} style={{ backgroundColor: colors.white, borderRadius: 99, padding: 10 }}><FigmaIcon source={favoriteIcon} /></Pressable></View></View>
        <Pressable onPress={() => go('gallery')} style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: '#123149CC', borderRadius: 24, paddingHorizontal: 12, paddingVertical: 6 }}><T style={{ color: colors.white, fontSize: 12 }}>1 / 12</T></Pressable>
      </View>
      <View style={{ padding: 16, gap: 16 }}>
        <T weight="bold" style={{ fontSize: 24, color: colors.navy, lineHeight: 32 }}>{hotel.name}</T>
        <Pressable onPress={() => go('nearby-places')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><FigmaIcon source={addressIcon} size={16} /><T style={{ color: colors.muted, fontSize: 13 }}>{hotel.address} · {hotel.distance}</T></Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><FigmaIcon source={starIcon} size={16} /><T weight="semibold">{hotel.rating}</T><T style={{ color: colors.muted, fontSize: 13 }}>Tuyệt vời · {new Intl.NumberFormat('vi-VN').format(hotel.reviews)} đánh giá</T></View>
        <Card onPress={() => go('ai-review-summary')} style={{ backgroundColor: '#EFEDFF', flexDirection: 'row', alignItems: 'center', gap: 12 }}><FigmaIcon source={aiIcon} size={24} /><View style={{ flex: 1 }}><T weight="semibold">94% phù hợp với bạn</T><T style={{ color: colors.muted, fontSize: 12 }}>Gần biển · Có hồ bơi · Trong ngân sách</T></View></Card>
        <SectionTitle title="Tiện nghi nổi bật" action="Xem tất cả" onPress={() => go('hotel-amenities')} /><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{hotel.amenities.slice(0, 3).map((amenity) => <Chip key={amenity} label={amenity} onPress={() => go('hotel-amenities')} small />)}</View>
        <SectionTitle title="Một kỳ nghỉ bên biển đáng nhớ" /><T style={{ color: colors.muted, lineHeight: 20 }}>{hotel.description}</T>
        <Row label="Hình ảnh khách sạn" onPress={() => go('gallery')} /><Row label="Chính sách lưu trú" onPress={() => go('policies')} /><Row label="Địa điểm gần đây" onPress={() => go('nearby-places')} /><Row label="Liên hệ khách sạn" onPress={() => go('chat-detail')} /><Row label="Báo cáo khách sạn" onPress={() => go('report-hotel')} />
        <T style={{ color: favorites.includes(hotel.id) ? colors.primary : colors.muted, fontSize: 12 }}>{favorites.includes(hotel.id) ? 'Đã lưu vào khách sạn yêu thích' : 'Lưu khách sạn để xem lại sau'}</T>
      </View>
    </ScrollView>
    <View style={{ borderTopWidth: 1, borderTopColor: colors.line, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 }}><View style={{ flex: 1 }}><T style={{ color: colors.muted, fontSize: 11 }}>Giá từ / 1 đêm</T><T weight="bold" style={{ color: colors.primaryDark, fontSize: 18 }}>{currency(hotel.price)}</T></View><View style={{ flex: 1 }}><Button label="Chọn phòng" onPress={() => go('rooms')} /></View></View>
  </SafeAreaView>;
}

function RoomsScreen() {
  const hotel = useSelectedHotel();
  const { checkIn, checkOut, adults, selectedRoom, selectRoom } = useTravelerStore();
  const rooms = [
    { name: 'Deluxe Sea View', area: '32 m²', bed: '1 giường King', view: 'Hướng biển', price: hotel.price, image: ROOM_IMAGE },
    { name: 'Superior City View', area: '28 m²', bed: '1 giường đôi', view: 'Hướng phố', price: roomRate(hotel.price, 'Superior City View'), image: ROOM_IMAGE },
  ];
  return <TravelerScaffold title="Chọn phòng" back footer={<Button label="Tiếp tục đặt phòng" onPress={() => go('booking-review')} />} background={colors.white}>
    <Pressable onPress={() => go('dates')}><T weight="semibold">{hotel.name} <T style={{ color: colors.primary }}>Sửa</T></T><T style={{ color: colors.muted, fontSize: 12 }}>{dateLabel(checkIn)}–{dateLabel(checkOut)} · {nights(checkIn, checkOut)} đêm · {adults} khách</T></Pressable>
    <SectionTitle title="Chọn phòng phù hợp" />
    {rooms.map((room) => <Pressable key={room.name} onPress={() => selectRoom(room.name)} style={{ borderWidth: selectedRoom === room.name ? 2 : 1, borderColor: selectedRoom === room.name ? colors.primary : colors.line, borderRadius: 16, overflow: 'hidden', marginBottom: 4 }}>
      {room.name === 'Deluxe Sea View' ? <Image source={room.image} style={{ width: '100%', height: 203 }} /> : null}
      <View style={{ padding: 16, gap: 8 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T weight="semibold" style={{ fontSize: 18 }}>{room.name}</T>{selectedRoom === room.name ? <T weight="semibold" style={{ color: colors.primary, fontSize: 12 }}>Đã chọn</T> : null}</View><T style={{ color: colors.muted, fontSize: 12 }}>{room.area} · {room.bed} · {adults} khách · {room.view}</T><T style={{ color: colors.green, fontSize: 12 }}>Bữa sáng bao gồm · Wi-Fi miễn phí</T><T style={{ color: colors.green, fontSize: 12 }}>Hủy miễn phí trước 18:00, 10/10</T><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T weight="bold" style={{ color: colors.primaryDark, fontSize: 18 }}>{currency(room.price)} / đêm</T><T style={{ color: colors.orange, fontSize: 12 }}>Chỉ còn 3 phòng</T></View></View>
    </Pressable>)}
    <Button label="Xem chi tiết phòng" secondary onPress={() => go('room-detail')} />
  </TravelerScaffold>;
}

function RoomDetailScreen() {
  const hotel = useSelectedHotel();
  const room = useTravelerStore((state) => state.selectedRoom);
  const { checkIn, checkOut, adults } = useTravelerStore();
  return <TravelerScaffold title="Chi tiết phòng" back>
    <Card><T weight="semibold">{hotel.name}</T><T style={{ color: colors.muted }}>{dateLabel(checkIn)}–{dateLabel(checkOut)} · {nights(checkIn, checkOut)} đêm · {adults} khách</T></Card>
    <Card style={{ borderWidth: 1, borderColor: colors.line, elevation: 2 }}><T weight="semibold" style={{ fontSize: 18 }}>{room}</T><T style={{ color: colors.muted }}>{room === 'Superior City View' ? '28 m² · 1 giường đôi · 2 khách · Hướng phố' : '32 m² · 1 giường King · 2 khách · Hướng biển'}</T><T style={{ color: colors.green, fontSize: 12 }}>✓ Bữa sáng · Hủy miễn phí trước 18:00, 10/10</T><T weight="bold" style={{ color: colors.primaryDark, fontSize: 18 }}>{currency(roomRate(hotel.price, room))} / đêm</T><T style={{ color: colors.orange, fontSize: 12 }}>Còn 3 phòng</T></Card>
    <Card><T weight="semibold">Chính sách</T><T style={{ color: colors.muted }}>Hủy miễn phí trước 18:00 ngày 10/10. Giá cuối được xác nhận ở bước đặt phòng.</T></Card>
    <Button label="Chọn phòng này" onPress={() => go('booking-review')} />
  </TravelerScaffold>;
}

function HotelInfoScreen({ id }: { id: Exclude<HotelScreenId, 'hotel-detail' | 'rooms' | 'room-detail' | 'sold-out' | 'report-hotel'> }) {
  const hotel = useSelectedHotel();
  const title = { gallery: 'Hình ảnh khách sạn', 'hotel-amenities': 'Tất cả tiện ích', policies: 'Chính sách lưu trú', 'nearby-places': 'Địa điểm gần đây' }[id];
  return <TravelerScaffold title={title} back>
    {id === 'gallery' ? <Image source={hotel.image} style={{ width: '100%', height: 228, borderRadius: 14 }} /> : null}
    <Card><T weight="semibold">{id === 'gallery' ? hotel.name : id === 'hotel-amenities' ? 'Thông tin khách sạn' : title}</T><T style={{ color: colors.muted, lineHeight: 20 }}>{id === 'policies' ? 'Nhận phòng từ 14:00, trả phòng trước 12:00. Hủy miễn phí theo điều kiện hiển thị khi đặt phòng.' : id === 'nearby-places' ? 'Biển Mỹ Khê · Sơn Trà · Trung tâm Đà Nẵng' : `${hotel.name} · ${hotel.address}, ${hotel.destination}`}</T></Card>
    <Card><T weight="semibold">Tiện ích nổi bật</T><T style={{ color: colors.muted }}>Hồ bơi ngoài trời · Bữa sáng · Wi-Fi miễn phí · Lễ tân 24/7</T></Card>
    <Card><T weight="semibold">Thông tin đặt phòng</T><T style={{ color: colors.muted }}>12–15/10 · 2 khách · Giá từ {currency(hotel.price)}/đêm</T></Card>
    <Button label="Chọn phòng" onPress={() => go('rooms')} />
  </TravelerScaffold>;
}

function ReportHotelScreen() {
  const hotel = useSelectedHotel();
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  return <TravelerScaffold title="Báo cáo khách sạn" back><Card><T weight="semibold">{hotel.name}</T><T style={{ color: colors.muted }}>Theo dõi giá và tình trạng phòng; báo cáo nội dung không phù hợp.</T></Card><Field label="Lý do hoặc ngưỡng giá" onChangeText={(value) => { setReason(value); setError(''); }} placeholder="Nhập thông tin" value={reason} />{error ? <T accessibilityRole="alert" style={{ color: colors.error }}>{error}</T> : null}{saved ? <T style={{ color: colors.green }}>Đã lưu yêu cầu trong bản demo.</T> : null}<Button label="Lưu yêu cầu" onPress={() => reason.trim() ? setSaved(true) : setError('Vui lòng nhập lý do hoặc ngưỡng giá.')} /></TravelerScaffold>;
}

export function HotelScreen({ id }: { id: HotelScreenId }) {
  if (id === 'hotel-detail') return <HotelDetailScreen />;
  if (id === 'rooms') return <RoomsScreen />;
  if (id === 'room-detail') return <RoomDetailScreen />;
  if (id === 'sold-out') return <TravelerScaffold title="Phòng đã hết" back><Card><T weight="semibold">Không còn phòng cho ngày đã chọn</T><T style={{ color: colors.muted }}>Hãy đổi ngày lưu trú hoặc xem khách sạn khác.</T></Card><Button label="Chọn ngày khác" onPress={() => go('dates')} /></TravelerScaffold>;
  if (id === 'report-hotel') return <ReportHotelScreen />;
  return <HotelInfoScreen id={id} />;
}

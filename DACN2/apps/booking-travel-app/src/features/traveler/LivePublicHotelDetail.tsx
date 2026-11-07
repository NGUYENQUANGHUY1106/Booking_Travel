import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';

import { publicMediaUrl, usePublicHotel, usePublicRoomAvailability, type PublicRoom } from './public-hotels';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, T, TravelerScaffold, go } from './ui';

function PublicRoomCard({ room, checkIn, checkOut }: { room: PublicRoom; checkIn: string; checkOut: string }) {
  const [expanded, setExpanded] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const availability = usePublicRoomAvailability(room.id, checkIn, checkOut);
  const images = [...room.images].sort((a, b) => a.sortOrder - b.sortOrder);
  const cover = images.find((item) => item.isCover) ?? images[0];
  const selectedImage = expanded ? images[imageIndex] ?? cover : cover;
  return <Card>
    {selectedImage ? <Image source={{ uri: publicMediaUrl(selectedImage.url) }} accessibilityLabel={`Ảnh hạng phòng ${room.name}`} resizeMode="cover" style={{ width: '100%', height: 190, borderRadius: 12 }} /> : null}
    <T weight="semibold" style={{ fontSize: 18 }}>{room.name}</T>
    <T style={{ color: colors.muted }}>{[room.areaM2 ? `${room.areaM2} m²` : null, room.bedInfo, `${room.capacityAdults} người lớn`, room.capacityChildren ? `${room.capacityChildren} trẻ em` : null].filter(Boolean).join(' · ')}</T>
    <T style={{ color: colors.primaryDark, fontSize: 18 }}>{Number(room.basePrice).toLocaleString('vi-VN')} {room.currency === 'VND' ? '₫' : room.currency} / đêm</T>
    <T style={{ color: colors.muted, fontSize: 12 }}>Giá cơ bản · Tổng {room.quantity} phòng cùng hạng</T>
    {availability.isPending && availability.fetchStatus !== 'idle' ? <T>Đang kiểm tra phòng trống...</T> : null}
    {availability.data ? <T style={{ color: availability.data.availableRooms ? colors.green : colors.orange }}>Còn {availability.data.availableRooms} phòng cho {checkIn} – {checkOut}</T> : null}
    {availability.isError ? <Pressable onPress={() => void availability.refetch()}><T style={{ color: colors.error }}>Không tải được phòng trống. Chạm để thử lại.</T></Pressable> : null}
    {!availability.data && availability.fetchStatus === 'idle' ? <T style={{ color: colors.muted }}>Chọn ngày lưu trú tương lai để xem số phòng còn bán.</T> : null}
    <Button secondary label={expanded ? 'Thu gọn' : 'Xem ảnh và chi tiết phòng'} onPress={() => setExpanded((value) => !value)} />
    {expanded ? <>
      {images.length > 1 ? <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Button secondary label="‹ Trước" onPress={() => setImageIndex((value) => (value - 1 + images.length) % images.length)} /></View><View style={{ flex: 1 }}><Button secondary label="Sau ›" onPress={() => setImageIndex((value) => (value + 1) % images.length)} /></View></View> : null}
      {images.length ? <T style={{ color: colors.muted }}>Ảnh {imageIndex + 1}/{images.length}</T> : null}
      {room.description ? <T style={{ color: colors.muted }}>{room.description}</T> : null}
      {room.amenities.length ? <T style={{ color: colors.muted }}>Tiện nghi phòng: {(room.amenityLabels ?? room.amenities).join(' · ')}</T> : null}
    </> : null}
  </Card>;
}

export function LivePublicHotelDetail({ hotelId }: { hotelId: string }) {
  const query = usePublicHotel(hotelId);
  const [index, setIndex] = useState(0);
  const hotel = query.data;
  const checkIn = useTravelerStore((state) => state.checkIn);
  const checkOut = useTravelerStore((state) => state.checkOut);
  const images = [...(hotel?.gallery ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const image = images[index] ?? images[0];
  return <TravelerScaffold title="Chi tiết chỗ ở" back background={colors.white}>
    {query.isPending ? <Card><T>Đang tải thông tin chỗ ở...</T></Card> : null}
    {query.isError ? <Card onPress={() => void query.refetch()}><T>Chỗ ở không còn công khai hoặc không tải được. Chạm để thử lại.</T></Card> : null}
    {hotel ? <>
      {image ? <Image source={{ uri: publicMediaUrl(image.url) }} onError={() => void query.refetch()} style={{ width: '100%', height: 240, borderRadius: 12 }} resizeMode="cover" /> : <Card><T>Chưa có ảnh công khai.</T></Card>}
      {images.length > 1 ? <View style={{ flexDirection: 'row', gap: 12 }}><View style={{ flex: 1 }}><Button secondary label="‹ Trước" onPress={() => setIndex((value) => (value - 1 + images.length) % images.length)} /></View><View style={{ flex: 1 }}><Button secondary label="Sau ›" onPress={() => setIndex((value) => (value + 1) % images.length)} /></View></View> : null}
      {images.length ? <T style={{ color: colors.muted }}>Ảnh {Math.min(index + 1, images.length)}/{images.length}</T> : null}
      <Card><T weight="bold" style={{ fontSize: 22 }}>{hotel.name}</T><T style={{ color: colors.muted }}>{[hotel.addressLine, hotel.city, hotel.province].filter(Boolean).join(', ')}</T>{hotel.latitude && hotel.longitude ? <T style={{ color: colors.muted }}>Vị trí: {hotel.latitude}, {hotel.longitude}</T> : null}</Card>
      {hotel.description ? <Card><T weight="semibold">Giới thiệu</T><T style={{ color: colors.muted }}>{hotel.description}</T></Card> : null}
      <Card><T weight="semibold">Tiện ích</T><T style={{ color: colors.muted }}>{hotel.amenities.length ? hotel.amenities.map((amenity) => amenity.name).join(' · ') : 'Chưa có thông tin tiện ích.'}</T></Card>
      <Button secondary label="Chọn ngày lưu trú" onPress={() => go('dates')} />
      <T weight="semibold" style={{ fontSize: 20 }}>Hạng phòng đang mở bán</T>
      {hotel.rooms?.length ? hotel.rooms.map((room) => <PublicRoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} />) : <Card><T>Chưa có hạng phòng đang mở bán.</T></Card>}
    </> : null}
  </TravelerScaffold>;
}

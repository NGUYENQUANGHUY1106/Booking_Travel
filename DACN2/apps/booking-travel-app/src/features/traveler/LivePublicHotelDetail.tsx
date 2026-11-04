import { useState } from 'react';
import { Image, View } from 'react-native';

import { publicMediaUrl, usePublicHotel } from './public-hotels';
import { colors } from './theme';
import { Button, Card, T, TravelerScaffold } from './ui';

export function LivePublicHotelDetail({ hotelId }: { hotelId: string }) {
  const query = usePublicHotel(hotelId);
  const [index, setIndex] = useState(0);
  const hotel = query.data;
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
    </> : null}
  </TravelerScaffold>;
}

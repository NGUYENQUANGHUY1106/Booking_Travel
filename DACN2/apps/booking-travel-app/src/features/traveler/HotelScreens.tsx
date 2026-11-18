import { LivePublicHotelDetail } from './LivePublicHotelDetail';
import { NearbyPlacesScreen } from './hotel-detail/NearbyPlacesScreen';
import { RoomDetailScreen } from './rooms/RoomDetailScreen';
import { RoomListScreen } from './rooms/RoomListScreen';
import { useTravelerStore } from './store';
import { Button, Card, EmptyState, T, TravelerScaffold, go } from './ui';

export type HotelScreenId =
  | 'hotel-detail'
  | 'gallery'
  | 'hotel-amenities'
  | 'policies'
  | 'nearby-places'
  | 'rooms'
  | 'room-detail'
  | 'sold-out'
  | 'report-hotel';

export function HotelScreen({
  id,
  hotelId,
  roomId,
}: {
  id: HotelScreenId;
  hotelId?: string;
  roomId?: string;
}) {
  const selectedHotelId = useTravelerStore((state) => state.selectedHotelId);
  const resolvedHotelId = hotelId || selectedHotelId;

  if (id === 'sold-out') {
    return (
      <TravelerScaffold title="Phòng đã hết" back>
        <Card>
          <T weight="semibold">Không còn phòng cho ngày đã chọn</T>
          <T>Hãy đổi ngày lưu trú hoặc xem khách sạn khác trong hệ thống.</T>
        </Card>
        <Button label="Chọn ngày khác" onPress={() => go('dates', { hotelId: resolvedHotelId })} />
      </TravelerScaffold>
    );
  }

  if (!resolvedHotelId) {
    return (
      <TravelerScaffold title="Khách sạn" back>
        <EmptyState
          title="Chưa chọn khách sạn"
          detail="Hãy chọn một khách sạn đang có trong hệ thống."
          action="Xem khách sạn"
          onPress={() => go('results')}
        />
      </TravelerScaffold>
    );
  }

  if (id === 'rooms') return <RoomListScreen hotelId={resolvedHotelId} />;
  if (id === 'nearby-places') {
    return <NearbyPlacesScreen hotelId={resolvedHotelId} />;
  }
  if (id === 'room-detail') {
    return <RoomDetailScreen hotelId={resolvedHotelId} roomId={roomId} />;
  }

  // The live detail already contains gallery, amenities, policies and location.
  // Legacy sub-routes resolve here so fixture hotels can never be rendered.
  return <LivePublicHotelDetail hotelId={resolvedHotelId} />;
}

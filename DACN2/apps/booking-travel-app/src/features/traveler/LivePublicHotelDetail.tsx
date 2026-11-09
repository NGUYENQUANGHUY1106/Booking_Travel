import { HotelDetailScreen } from "./hotel-detail/HotelDetailScreen";

export function LivePublicHotelDetail({ hotelId }: { hotelId: string }) {
  return <HotelDetailScreen hotelId={hotelId} />;
}

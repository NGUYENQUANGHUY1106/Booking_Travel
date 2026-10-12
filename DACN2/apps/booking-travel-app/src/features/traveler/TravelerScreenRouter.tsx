import { Image } from 'react-native';

import { AccountScreen, type AccountScreenId } from './AccountScreens';
import { AiScreen, type AiScreenId } from './AiScreens';
import { BookingScreen, type BookingScreenId } from './BookingScreens';
import { DESTINATIONS, HOTELS } from './data';
import { HotelScreen, type HotelScreenId } from './HotelScreens';
import { SearchScreen, type SearchScreenId } from './SearchScreens';
import { SocialScreen, type SocialScreenId } from './SocialScreens';
import { useTravelerStore } from './store';
import { colors } from './theme';
import { Button, Card, EmptyState, HotelCard, T, TravelerScaffold, go } from './ui';

const SEARCH: SearchScreenId[] = ['search-entry', 'destination', 'dates', 'guests', 'results', 'filters', 'sort', 'map', 'map-preview', 'accommodation', 'amenities', 'no-results'];
const HOTEL: HotelScreenId[] = ['hotel-detail', 'gallery', 'hotel-amenities', 'policies', 'nearby-places', 'rooms', 'room-detail', 'sold-out', 'report-hotel'];
const BOOKING: BookingScreenId[] = ['booking-review', 'guest-info', 'special-requests', 'voucher', 'price-breakdown', 'payment-method', 'payment-processing', 'payment-success', 'payment-failed', 'booking-confirmation', 'my-bookings', 'booking-detail', 'qr-ticket', 'cancel-booking', 'refund-request', 'invoice', 'bookings-empty'];
const SOCIAL: SocialScreenId[] = ['favorites', 'wishlist', 'compare', 'chat-list', 'chat-detail', 'chat-attachments', 'notifications', 'notification-preferences', 'write-review', 'review-submitted', 'edit-review', 'my-reviews', 'report-review'];
const AI: AiScreenId[] = ['ai-home', 'ai-search', 'ai-compare', 'ai-review-summary', 'travel-planner', 'travel-plan-result', 'budget-planner', 'smart-packing', 'price-insight', 'ai-history', 'ai-unavailable'];
const ACCOUNT: AccountScreenId[] = ['profile', 'edit-profile', 'travel-preferences', 'language-currency', 'loyalty', 'settings', 'logout-confirm'];

function DiscoveryScreen({ id }: { id: string }) {
  if (id === 'home-loading' || id === 'global-loading') return <TravelerScaffold title="Đang tải"><Card><T weight="semibold">Đang chuẩn bị chuyến đi cho bạn</T></Card></TravelerScaffold>;
  if (id === 'home-offline' || id === 'network-offline') return <TravelerScaffold title="Ngoại tuyến"><EmptyState action="Thử lại" detail="Kiểm tra kết nối rồi thử lại." onPress={() => go('results')} title="Không có kết nối mạng" /></TravelerScaffold>;
  if (id === 'home-no-location') return <TravelerScaffold title="Khách sạn gần bạn"><EmptyState action="Chọn điểm đến" detail="Bạn vẫn có thể tìm chỗ nghỉ bằng cách nhập địa điểm." onPress={() => go('destination')} title="Chưa có quyền vị trí" /></TravelerScaffold>;
  if (id === 'price-alerts') return <TravelerScaffold title="Theo dõi giá và tình trạng phòng" back><Card><T weight="semibold">Blue Horizon My Khe Hotel</T><T style={{ color: colors.muted }}>Theo dõi mức giá mong muốn cho chuyến đi.</T></Card><Button label="Xem khách sạn" onPress={() => go('hotel-detail')} /></TravelerScaffold>;
  if (id === 'popular-destinations') return <TravelerScaffold title="Điểm đến nổi bật" back>{DESTINATIONS.map((destination) => <Card key={destination.name} onPress={() => { useTravelerStore.getState().setSearch({ destination: destination.name }); go('results'); }}><Image source={destination.image} style={{ height: 180, width: '100%', borderRadius: 12 }} /><T weight="semibold">{destination.name}</T><T style={{ color: colors.muted }}>{destination.detail}</T></Card>)}</TravelerScaffold>;
  return <TravelerScaffold title={id === 'nearby' ? 'Khách sạn gần bạn' : 'Đã xem gần đây'} back>{HOTELS.slice(0, 2).map((hotel) => <HotelCard hotel={hotel} key={hotel.id} />)}</TravelerScaffold>;
}

export function TravelerScreenRouter({ id }: { id: string }) {
  if (SEARCH.includes(id as SearchScreenId)) return <SearchScreen id={id as SearchScreenId} />;
  if (HOTEL.includes(id as HotelScreenId)) return <HotelScreen id={id as HotelScreenId} />;
  if (BOOKING.includes(id as BookingScreenId)) return <BookingScreen id={id as BookingScreenId} />;
  if (SOCIAL.includes(id as SocialScreenId)) return <SocialScreen id={id as SocialScreenId} />;
  if (AI.includes(id as AiScreenId)) return <AiScreen id={id as AiScreenId} />;
  if (ACCOUNT.includes(id as AccountScreenId)) return <AccountScreen id={id as AccountScreenId} />;
  if (['popular-destinations', 'nearby', 'recent', 'price-alerts', 'home-loading', 'home-offline', 'home-no-location', 'global-loading', 'network-offline'].includes(id)) return <DiscoveryScreen id={id} />;
  return <TravelerScaffold title="Không tìm thấy màn hình" back><EmptyState action="Về trang chủ" detail="Màn hình này không thuộc bản demo hiện tại." onPress={() => go('search-entry')} title="Đường dẫn không hợp lệ" /></TravelerScaffold>;
}

import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import type { OwnerScreenId } from '../types';
import { BookingDetailScreen, CheckinScreen, CheckoutScreen, GuestsScreen, QrCheckinScreen } from './OwnerBookingScreens';
import { CalendarRouter } from './OwnerCalendarScreens';
import {
  OwnerEmptyScreen,
  RoomScreen,
} from './OwnerHotelScreens';
import { HotelBasicScreen, HotelDetailScreen } from '../hotels/OwnerHotelProfileScreens';
import { OwnerHotelLocationScreen } from '../hotels/OwnerHotelLocationScreen';
import { OwnerHotelMediaScreen } from '../hotels/OwnerHotelMediaScreen';
import { OwnerHotelAmenitiesScreen } from '../hotels/OwnerHotelAmenitiesScreen';
import { OwnerHotelReviewScreen } from '../hotels/OwnerHotelReviewScreen';
import { OwnerHotelRoomCreateScreen } from '../hotels/OwnerHotelRoomCreateScreen';
import { AiSupportScreen, OwnerReviewsScreen, RevenueScreen, SparseDesignScreen } from './OwnerInsightsScreens';
import { BecomeOwnerScreen, VerificationFormScreen, VerificationStatusScreen } from './OwnerOnboardingScreens';

const validIds = new Set<OwnerScreenId>([
  'become-owner', 'verification-form', 'verification-status', 'role-switcher', 'owner-empty',
  'hotel-detail', 'hotel-draft', 'hotel-pending', 'hotel-approved', 'hotel-rejected', 'hotel-suspended',
  'hotel-basic', 'hotel-location', 'hotel-media', 'hotel-amenities', 'hotel-review', 'rooms', 'room-edit',
  'availability', 'availability-booked', 'availability-blocked', 'block-room', 'pricing', 'pricing-ai',
  'pricing-ai-confirm', 'promotions', 'promotion-edit', 'booking-detail', 'guests', 'qr-checkin', 'checkin',
  'checkout', 'reviews', 'revenue', 'analytics', 'forecast', 'review-insights', 'ai-support',
]);

export function isOwnerScreenId(value: string): value is OwnerScreenId {
  return validIds.has(value as OwnerScreenId);
}

export function OwnerScreenRouter({ id }: { id: OwnerScreenId }) {
  const { hotelId } = useLocalSearchParams<{ hotelId?: string }>();
  if (id === 'become-owner') return <BecomeOwnerScreen />;
  if (id === 'verification-form') return <VerificationFormScreen />;
  if (id === 'verification-status') return <VerificationStatusScreen />;
  if (id === 'role-switcher') return <VerificationFormScreen roleSwitcher />;
  if (id === 'owner-empty') return <OwnerEmptyScreen />;
  if (id === 'hotel-detail') return <HotelDetailScreen hotelId={hotelId} />;
  if (id.startsWith('hotel-') && ['hotel-draft', 'hotel-pending', 'hotel-approved', 'hotel-rejected', 'hotel-suspended'].includes(id)) {
    return <HotelDetailScreen hotelId={hotelId} />;
  }
  if (id === 'hotel-basic') return <HotelBasicScreen hotelId={hotelId} />;
  if (id === 'hotel-location') return <OwnerHotelLocationScreen hotelId={hotelId} />;
  if (id === 'hotel-media') return <OwnerHotelMediaScreen hotelId={hotelId} />;
  if (id === 'hotel-amenities') return <OwnerHotelAmenitiesScreen hotelId={hotelId} />;
  if (id === 'hotel-review') return <OwnerHotelReviewScreen hotelId={hotelId} />;
  if (id === 'rooms') return <RoomScreen />;
  if (id === 'room-edit' && hotelId) return <OwnerHotelRoomCreateScreen hotelId={hotelId} />;
  if (id === 'room-edit') return <RoomScreen edit />;
  if (['availability', 'availability-booked', 'availability-blocked', 'block-room', 'pricing', 'pricing-ai', 'pricing-ai-confirm', 'promotions', 'promotion-edit'].includes(id)) return <CalendarRouter id={id} />;
  if (id === 'booking-detail') return <BookingDetailScreen />;
  if (id === 'guests') return <GuestsScreen />;
  if (id === 'qr-checkin') return <QrCheckinScreen />;
  if (id === 'checkin') return <CheckinScreen />;
  if (id === 'checkout') return <CheckoutScreen />;
  if (id === 'reviews') return <OwnerReviewsScreen />;
  if (id === 'revenue') return <RevenueScreen />;
  if (id === 'analytics') return <SparseDesignScreen title="Phân tích khách sạn" />;
  if (id === 'forecast') return <RevenueScreen forecast />;
  if (id === 'review-insights') return <SparseDesignScreen title="Phân tích đánh giá từ AI" />;
  if (id === 'ai-support') return <AiSupportScreen />;
  return <Text>Không tìm thấy màn hình.</Text>;
}


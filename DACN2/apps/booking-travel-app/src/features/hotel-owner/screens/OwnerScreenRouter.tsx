import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { ConversationScreen } from '@/features/chat';
import type { OwnerScreenId } from '../types';
import { BookingDetailScreen } from './OwnerBookingScreens';
import { GuestDetailScreen, GuestsScreen } from './OwnerGuestScreens';
import { CheckinScreen, CheckoutScreen, QrCheckinScreen } from './OwnerStayScreens';
import { CalendarRouter } from './OwnerCalendarScreens';
import {
  OwnerEmptyScreen,
} from './OwnerHotelScreens';
import { HotelBasicScreen, HotelDetailScreen } from '../hotels/OwnerHotelProfileScreens';
import { OwnerHotelLocationScreen } from '../hotels/OwnerHotelLocationScreen';
import { OwnerHotelMediaScreen } from '../hotels/OwnerHotelMediaScreen';
import { OwnerHotelAmenitiesScreen } from '../hotels/OwnerHotelAmenitiesScreen';
import { OwnerHotelReviewScreen } from '../hotels/OwnerHotelReviewScreen';
import { OwnerHotelRoomCreateScreen } from '../hotels/OwnerHotelRoomCreateScreen';
import { OwnerHotelRoomsScreen } from '../hotels/OwnerHotelRoomsScreen';
import { AiSupportScreen, OwnerReviewsScreen, SparseDesignScreen } from './OwnerInsightsScreens';
import { OwnerAnalyticsScreen } from './OwnerAnalyticsScreens';
import { BecomeOwnerScreen, VerificationFormScreen, VerificationStatusScreen } from './OwnerOnboardingScreens';

const validIds = new Set<OwnerScreenId>([
  'become-owner', 'verification-form', 'verification-status', 'role-switcher', 'owner-empty',
  'hotel-detail', 'hotel-draft', 'hotel-pending', 'hotel-approved', 'hotel-rejected', 'hotel-suspended',
  'hotel-basic', 'hotel-location', 'hotel-media', 'hotel-amenities', 'hotel-review', 'rooms', 'room-edit',
  'availability', 'availability-booked', 'availability-blocked', 'block-room', 'pricing', 'pricing-ai',
  'pricing-ai-confirm', 'promotions', 'promotion-edit', 'booking-detail', 'guests', 'guest-detail', 'qr-checkin', 'checkin',
  'checkout', 'chat-detail', 'reviews', 'revenue', 'analytics', 'forecast', 'review-insights', 'ai-support',
]);

export function isOwnerScreenId(value: string): value is OwnerScreenId {
  return validIds.has(value as OwnerScreenId);
}

export function OwnerScreenRouter({ id }: { id: OwnerScreenId }) {
  const { conversationId, hotelId, userId, roomId, returnTo, bookingId, dateFrom, dateTo, granularity } = useLocalSearchParams<{
    conversationId?: string;
    hotelId?: string;
    userId?: string;
    roomId?: string;
    returnTo?: string;
    bookingId?: string;
    dateFrom?: string;
    dateTo?: string;
    granularity?: string;
  }>();
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
  if (id === 'rooms') return <OwnerHotelRoomsScreen hotelId={hotelId} returnTo={returnTo === 'hotel-review' ? 'hotel-review' : undefined} />;
  if (id === 'room-edit') return <OwnerHotelRoomCreateScreen hotelId={hotelId} roomId={roomId} returnTo={returnTo === 'rooms' ? 'rooms' : 'hotel-review'} />;
  if (['availability', 'availability-booked', 'availability-blocked', 'block-room', 'pricing', 'pricing-ai', 'pricing-ai-confirm', 'promotions', 'promotion-edit'].includes(id)) return <CalendarRouter id={id} />;
  if (id === 'booking-detail') return <BookingDetailScreen bookingId={bookingId} />;
  if (id === 'guests') return <GuestsScreen key={hotelId ?? 'all'} initialHotelId={hotelId} />;
  if (id === 'guest-detail') return <GuestDetailScreen hotelId={hotelId} userId={userId} />;
  if (id === 'qr-checkin') return <QrCheckinScreen bookingId={bookingId} />;
  if (id === 'checkin') return <CheckinScreen bookingId={bookingId} />;
  if (id === 'checkout') return <CheckoutScreen bookingId={bookingId} />;
  if (id === 'chat-detail') return <ConversationScreen conversationId={conversationId} />;
  if (id === 'reviews') return <OwnerReviewsScreen initialHotelId={hotelId} />;
  if (id === 'revenue') return <OwnerAnalyticsScreen mode="revenue" initialHotelId={hotelId} initialRoomId={roomId} initialRange={dateFrom && dateTo ? { dateFrom, dateTo } : undefined} initialGranularity={granularity} />;
  if (id === 'analytics') return <OwnerAnalyticsScreen mode="analytics" initialHotelId={hotelId} initialRoomId={roomId} initialRange={dateFrom && dateTo ? { dateFrom, dateTo } : undefined} initialGranularity={granularity} />;
  if (id === 'forecast') return <SparseDesignScreen title="Dự báo AI chưa khả dụng" />;
  if (id === 'review-insights') return <SparseDesignScreen title="Phân tích đánh giá từ AI" />;
  if (id === 'ai-support') return <AiSupportScreen />;
  return <Text>Không tìm thấy màn hình.</Text>;
}


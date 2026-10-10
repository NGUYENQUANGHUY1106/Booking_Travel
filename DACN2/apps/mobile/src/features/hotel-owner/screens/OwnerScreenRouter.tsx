import { Text } from 'react-native';

import type { OwnerScreenId } from '../types';
import { BookingDetailScreen, CheckinScreen, CheckoutScreen, GuestsScreen, QrCheckinScreen } from './OwnerBookingScreens';
import { CalendarRouter } from './OwnerCalendarScreens';
import {
  HotelBasicScreen,
  HotelDetailScreen,
  HotelStatusScreen,
  HotelWizardScreen,
  OwnerEmptyScreen,
  RoomScreen,
} from './OwnerHotelScreens';
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
  if (id === 'become-owner') return <BecomeOwnerScreen />;
  if (id === 'verification-form') return <VerificationFormScreen />;
  if (id === 'verification-status') return <VerificationStatusScreen />;
  if (id === 'role-switcher') return <VerificationFormScreen roleSwitcher />;
  if (id === 'owner-empty') return <OwnerEmptyScreen />;
  if (id === 'hotel-detail') return <HotelDetailScreen />;
  if (id.startsWith('hotel-') && ['hotel-draft', 'hotel-pending', 'hotel-approved', 'hotel-rejected', 'hotel-suspended'].includes(id)) {
    return <HotelStatusScreen status={id.replace('hotel-', '') as 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended'} />;
  }
  if (id === 'hotel-basic') return <HotelBasicScreen />;
  if (['hotel-location', 'hotel-media', 'hotel-amenities', 'hotel-review'].includes(id)) return <HotelWizardScreen id={id} />;
  if (id === 'rooms') return <RoomScreen />;
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


export type OwnerScreenId =
  | 'become-owner'
  | 'verification-form'
  | 'verification-status'
  | 'role-switcher'
  | 'owner-empty'
  | 'hotel-detail'
  | 'hotel-draft'
  | 'hotel-pending'
  | 'hotel-approved'
  | 'hotel-rejected'
  | 'hotel-suspended'
  | 'hotel-basic'
  | 'hotel-location'
  | 'hotel-media'
  | 'hotel-amenities'
  | 'hotel-review'
  | 'rooms'
  | 'room-edit'
  | 'availability'
  | 'availability-booked'
  | 'availability-blocked'
  | 'block-room'
  | 'pricing'
  | 'pricing-ai'
  | 'pricing-ai-confirm'
  | 'promotions'
  | 'promotion-edit'
  | 'booking-detail'
  | 'guests'
  | 'qr-checkin'
  | 'checkin'
  | 'checkout'
  | 'reviews'
  | 'revenue'
  | 'analytics'
  | 'forecast'
  | 'review-insights'
  | 'ai-support';

export type HotelStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'suspended';

export interface OwnerBooking {
  id: string;
  guest: string;
  hotel: string;
  stay: string;
  summary: string;
  total: string;
  status: string;
}


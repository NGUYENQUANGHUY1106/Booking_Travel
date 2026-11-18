import { apiClient } from '@/services/api-client';

export type BookingConfirmation = {
  booking: {
    id: string;
    code: string;
    status: 'CONFIRMED' | 'CHECKED_IN';
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    roomCount: number;
    roomName: string;
    roomType: string;
    totalAmount: string;
    currency: string;
  };
  hotel: {
    id: string;
    name: string;
    address: string;
    checkInTime: string | null;
    checkOutTime: string | null;
  };
  guest: { name: string };
  qr: {
    value: string;
    format: 'BOOKING_TRAVEL_CHECK_IN_V1';
    generatedAt: string;
    expiresAt: string;
  };
};

export async function getBookingConfirmation(bookingId: string) {
  return (
    await apiClient.get<BookingConfirmation>(
      `/bookings/${bookingId}/confirmation`,
    )
  ).data;
}

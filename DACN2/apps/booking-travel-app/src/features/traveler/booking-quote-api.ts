import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@/services/api-client';
import { useTravelerStore } from './store';

export type ServerBookingQuote = {
  quoteId: string;
  expiresAt: string;
  checkedAt: string;
  priceChanged: boolean;
  roomId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  roomCount: number;
  adults: number;
  children: number;
  currency: string;
  hotel: { id: string; name: string; coverImageUrl: string | null; checkInTime: string | null; checkOutTime: string | null };
  room: { id: string; name: string; type: string };
  nightlyRates: { date: string; rate: string; quantity: number; amount: string; source: string }[];
  roomSubtotal: string;
  taxes: { label: string; amount: string }[];
  fees: { label: string; amount: string }[];
  discounts: { label: string; amount: string }[];
  finalAmount: string;
  cancellationPolicy: string | null;
  paymentMethod: 'PAY_AT_HOTEL';
};

const previousTotals = new Map<string, string>();

export function bookingApiError(error: unknown): string {
  if (isAxiosError(error)) {
    if (!error.response) return 'Không kết nối được máy chủ. Hãy kiểm tra mạng và thử lại.';
    const body = error.response.data as { message?: string | string[]; code?: string; availableQty?: number };
    if (body.code === 'ROOM_UNAVAILABLE') return `Không đủ phòng trống trong toàn bộ kỳ lưu trú. Còn tối đa ${body.availableQty ?? 0} phòng; hãy đổi ngày hoặc hạng phòng.`;
    if (body.code === 'QUOTE_EXPIRED') return 'Báo giá đã hết hạn. Vui lòng tải lại báo giá.';
    if (body.code === 'PRICE_CHANGED') return 'Giá đã thay đổi. Vui lòng xem và xác nhận báo giá mới.';
    if (Array.isArray(body.message)) return body.message.join('. ');
    if (typeof body.message === 'string') return body.message;
  }
  return 'Không thể lấy báo giá. Vui lòng thử lại.';
}

export function useBookingQuote() {
  const { session, selectedRoomId, selectedHotelId, checkIn, checkOut, rooms, adults, children } = useTravelerStore();
  const valid = Boolean(session?.mode === 'api' && selectedRoomId && checkOut > checkIn && rooms > 0 && adults > 0);
  const contextKey = [session?.mode === 'api' ? session.userId : '', session?.mode === 'api' ? session.sessionId : '', selectedRoomId, checkIn, checkOut, rooms, adults, children].join(':');
  return useQuery({
    queryKey: ['booking-quote', session?.mode === 'api' ? session.userId : '', session?.mode === 'api' ? session.sessionId : '', selectedRoomId, selectedHotelId, checkIn, checkOut, rooms, adults, children],
    enabled: valid,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async ({ signal }) => {
      const quote = (await apiClient.post<ServerBookingQuote>('/bookings/quote', {
        roomId: selectedRoomId, checkIn, checkOut, roomCount: rooms, adults, children,
        expectedTotalAmount: previousTotals.get(contextKey),
      }, { signal })).data;
      if (!signal.aborted) {
        previousTotals.set(contextKey, quote.finalAmount);
        if (previousTotals.size > 100) previousTotals.delete(previousTotals.keys().next().value!);
      }
      return quote;
    },
  });
}

export type ServerBooking = { id: string; code: string; status: string; totalAmount: string; currency: string; hotelId: string; roomNameSnapshot: string; checkIn: string; checkOut: string; adults: number; children: number; hotel?: { name: string } };

export async function createServerBooking(input: {
  quoteId: string; roomId: string; checkIn: string; checkOut: string;
  adults: number; children: number; roomCount: number;
  guestName: string; guestEmail: string; guestPhone?: string; note?: string;
}) {
  return (await apiClient.post<ServerBooking>('/bookings', input)).data;
}

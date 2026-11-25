import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { apiClient } from '@/services/api-client';
import { useTravelerStore } from './store';
import { confirmedStayForHotel } from './stay-context';
import { voucherErrorMessage } from './voucher-error';

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
  promotionReasonCode?: string | null;
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
    const voucherError = voucherErrorMessage(body.code);
    if (voucherError) return voucherError;
    if (Array.isArray(body.message)) return body.message.join('. ');
    if (typeof body.message === 'string') return body.message;
  }
  return 'Không thể lấy báo giá. Vui lòng thử lại.';
}

export function useBookingQuote() {
  const { session, selectedRoomId, selectedHotelId, checkIn, checkOut, staySelection, rooms, adults, children, voucher } = useTravelerStore();
  const valid = Boolean(session?.mode === 'api' && selectedRoomId && confirmedStayForHotel(staySelection, checkIn, checkOut, selectedHotelId, selectedHotelId) && rooms > 0 && adults > 0);
  const contextKey = [session?.mode === 'api' ? session.userId : '', session?.mode === 'api' ? session.sessionId : '', selectedRoomId, checkIn, checkOut, rooms, adults, children, voucher.trim().toUpperCase()].join(':');
  return useQuery({
    queryKey: ['booking-quote', session?.mode === 'api' ? session.userId : '', session?.mode === 'api' ? session.sessionId : '', selectedRoomId, selectedHotelId, checkIn, checkOut, rooms, adults, children, voucher.trim().toUpperCase()],
    enabled: valid,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async ({ signal }) => {
      const quote = (await apiClient.post<ServerBookingQuote>('/bookings/quote', {
        hotelId: selectedHotelId, roomId: selectedRoomId, checkIn, checkOut, roomCount: rooms, adults, children,
        expectedTotalAmount: previousTotals.get(contextKey),
        voucherCode: voucher.trim() || undefined,
      }, { signal })).data;
      if (!signal.aborted) {
        previousTotals.set(contextKey, quote.finalAmount);
        if (previousTotals.size > 100) previousTotals.delete(previousTotals.keys().next().value!);
      }
      return quote;
    },
  });
}

export type ServerBooking = {
  id: string;
  code: string;
  status: string;
  totalAmount: string;
  currency: string;
  hotelId: string;
  hotelNameSnapshot: string;
  hotelAddressSnapshot: string;
  roomNameSnapshot: string;
  roomTypeSnapshot: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomCount: number;
  nights: number;
  pricePerNight: string;
  cancellationPolicySnapshot?: string | null;
  cancellationReason?: string | null;
  cancellationFee?: string | null;
  refundEstimate?: string | null;
  cancelledAt?: string | null;
  cancellation?: {
    allowed: boolean;
    deadlineDate: string;
    rule: 'BEFORE_CHECK_IN_DATE';
  };
  paymentMethod: 'PAY_AT_HOTEL' | 'SIMULATOR';
  paymentDeadline?: string | null;
  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;
  note?: string | null;
  hotel?: { id?: string; name: string; address?: string };
  latestPayment?: {
    id: string;
    reference?: string | null;
    provider?: string | null;
    method?: string | null;
    status: string;
    amount: string;
    currency: string;
    paidAt?: string | null;
    succeededAt?: string | null;
    createdAt: string;
  } | null;
  qrAvailable?: boolean;
};

export type BookingCancellationResult = {
  bookingId: string;
  code: string;
  status: 'CANCELLED';
  reason: string | null;
  cancelledAt: string | null;
  cancellationFee: string;
  refundEstimate: string;
  refundRequired: boolean;
  currency: string;
  inventoryReleased: boolean;
  cancellationPolicy: string | null;
  alreadyCancelled: boolean;
};

export async function getServerBooking(bookingId: string) {
  return (await apiClient.get<ServerBooking>(`/bookings/${bookingId}`)).data;
}

export async function cancelServerBooking(bookingId: string, reason: string) {
  return (
    await apiClient.patch<BookingCancellationResult>(
      `/bookings/${bookingId}/cancel`,
      { reason },
    )
  ).data;
}

export async function createServerBooking(input: {
  quoteId: string; roomId: string; checkIn: string; checkOut: string;
  adults: number; children: number; roomCount: number;
  guestName: string; guestEmail: string; guestPhone?: string; note?: string;
  paymentMethod?: 'PAY_AT_HOTEL' | 'SIMULATOR';
}) {
  return (await apiClient.post<ServerBooking>('/bookings', input)).data;
}

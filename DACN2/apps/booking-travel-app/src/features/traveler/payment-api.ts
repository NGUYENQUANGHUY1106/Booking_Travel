import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { apiClient } from '@/services/api-client';

import type { ApiPayment } from './payment-model';

export type PaymentStatusResponse = {
  id: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: 'PENDING_PAYMENT' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | string;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  provider: string;
  merchantReference: string;
  amount: string;
  currency: string;
  paymentDeadline: string | null;
  holdExpiresAt: string | null;
  serverNow: string;
  canRetry: boolean;
  canRetryPayment: boolean;
  updatedAt: string;
  reconciliationRequired: boolean;
  failureReason: string | null;
  hotelId: string;
  hotelName: string;
  hotelCoverImageUrl: string | null;
  hotelCheckInTime: string | null;
  roomName: string;
  nights: number;
  adults: number;
  children: number;
  checkIn: string;
  checkOut: string;
};

export type PaymentInitResponse = {
  paymentId: string;
  bookingId: string;
  provider: string;
  merchantReference: string;
  amount: string;
  currency: string;
  status: 'PENDING';
  paymentDeadline: string;
  paymentUrl: string | null;
};

export async function availablePaymentMethods() {
  return (await apiClient.get<{ payAtHotel: boolean; simulator: boolean }>('/payments/methods')).data;
}

export async function initServerPayment(bookingId: string) {
  return (await apiClient.post<PaymentInitResponse>(`/payments/bookings/${encodeURIComponent(bookingId)}/init`)).data;
}

export async function paymentStatus(paymentId: string, signal?: AbortSignal) {
  return (await apiClient.get<PaymentStatusResponse>(`/payments/${encodeURIComponent(paymentId)}`, { signal })).data;
}

export async function latestBookingPayment(bookingId: string) {
  return (await apiClient.get<PaymentStatusResponse>(`/payments/bookings/${encodeURIComponent(bookingId)}/latest`)).data;
}

export async function initializePayAtHotel(bookingId: string, idempotencyKey: string) {
  return (
    await apiClient.post<ApiPayment>(
      '/payments/initialize',
      { bookingId, method: 'PAY_AT_HOTEL' },
      { headers: { 'Idempotency-Key': idempotencyKey } },
    )
  ).data;
}

export function useBookingPayment(bookingId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['booking-payment', bookingId],
    queryFn: async () =>
      (await apiClient.get<ApiPayment>(`/payments/booking/${bookingId}`)).data,
    enabled: enabled && Boolean(bookingId),
    retry: false,
    staleTime: 10_000,
  });
}

export function paymentErrorMessage(error: unknown) {
  if (!isAxiosError(error)) return 'Không thể khởi tạo thanh toán lúc này.';
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  if (!error.response) return 'Không kết nối được máy chủ. Hãy kiểm tra backend và mạng.';
  return 'Không thể khởi tạo thanh toán lúc này.';
}

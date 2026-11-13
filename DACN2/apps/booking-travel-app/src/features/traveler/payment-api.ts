import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/services/api-client';

import type { ApiPayment } from './payment-model';

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

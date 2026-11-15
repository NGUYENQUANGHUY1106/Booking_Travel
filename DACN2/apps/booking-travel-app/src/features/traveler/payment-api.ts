import { apiClient } from '@/services/api-client';

export type PaymentStatusResponse = {
  id: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: 'PENDING_PAYMENT' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED' | string;
  paymentStatus: 'PENDING' | 'SUCCESS' | 'FAILED';
  provider: string;
  merchantReference: string;
  amount: string;
  currency: string;
  paymentDeadline: string | null;
  canRetry: boolean;
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

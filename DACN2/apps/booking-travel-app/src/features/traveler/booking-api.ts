import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/services/api-client';

import { toTravelerBooking, type ApiBooking } from './booking-model';

export type CreateBookingInput = {
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomCount: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  note?: string;
};

export async function createBooking(input: CreateBookingInput) {
  return (await apiClient.post<ApiBooking>('/bookings', input)).data;
}

export type StayReminder = {
  id: string;
  kind: 'CHECK_IN_24H' | 'CHECK_IN_2H' | 'CHECK_OUT_24H' | 'CHECK_OUT_2H';
  scheduledAt: string;
  sentAt: string | null;
  createdAt: string;
};

export function useStayReminders(bookingId?: string) {
  return useQuery({
    queryKey: ['booking-reminders', bookingId ?? ''],
    queryFn: async () =>
      (await apiClient.get<StayReminder[]>(`/bookings/${bookingId}/reminders`)).data,
    enabled: Boolean(bookingId),
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}

export function useMyBookings(enabled: boolean, userId?: string) {
  return useQuery({
    queryKey: ['traveler-bookings', userId ?? ''],
    queryFn: async () =>
      (await apiClient.get<ApiBooking[]>('/bookings', { params: { userId } })).data.map(toTravelerBooking),
    enabled,
    staleTime: 10_000,
    refetchOnMount: 'always',
  });
}

export function bookingErrorMessage(error: unknown) {
  if (!isAxiosError(error)) return 'Không thể tạo booking lúc này.';
  const message = error.response?.data?.message;
  if (Array.isArray(message)) return message.join(' ');
  if (typeof message === 'string') return message;
  if (!error.response) return 'Không kết nối được máy chủ. Hãy kiểm tra backend và mạng.';
  return 'Không thể tạo booking lúc này.';
}

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

export function useMyBookings(enabled: boolean) {
  return useQuery({
    queryKey: ['traveler-bookings'],
    queryFn: async () =>
      (await apiClient.get<ApiBooking[]>('/bookings')).data.map(toTravelerBooking),
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

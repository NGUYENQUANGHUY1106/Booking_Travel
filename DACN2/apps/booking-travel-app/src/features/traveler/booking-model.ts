import type { BookingStatus, MockBooking } from './store.ts';

export type ApiBooking = {
  id: string;
  code: string;
  hotelId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  roomCount: number;
  totalAmount: string;
  currency: string;
  status: BookingStatus;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  note: string | null;
  hotel: { id: string; name: string };
  room: { id: string; name: string; type: string };
};

export function toTravelerBooking(booking: ApiBooking): MockBooking {
  return {
    id: booking.id,
    code: booking.code,
    hotelId: booking.hotelId,
    hotelName: booking.hotel.name,
    checkIn: booking.checkIn.slice(0, 10),
    checkOut: booking.checkOut.slice(0, 10),
    guests: booking.adults + booking.children,
    guestName: booking.guestName,
    room: booking.room.name,
    amount: Number(booking.totalAmount),
    status: booking.status,
    live: true,
  };
}

import { useState } from 'react';

import { AdminText } from '../dashboard/components';
import { formatVnd, mockAccommodationService, mockBookingMonitorService, mockUserService } from '../shared/mock';
import { AdminCard, AdminInput, AdminPage, AdminRow, openAdminDetail } from '../shared/ui';

export function BookingsScreen() {
  const bookings = mockBookingMonitorService.useItems();
  const hotels = mockAccommodationService.useItems();
  const [query, setQuery] = useState('');
  return <AdminPage title="Giám sát đặt phòng"><AdminInput value={query} onChangeText={setQuery} placeholder="Tìm mã đặt phòng hoặc khách sạn" /><AdminCard>{bookings.filter((booking) => `${booking.id} ${hotels.find((hotel) => hotel.id === booking.hotelId)?.name}`.toLowerCase().includes(query.toLowerCase())).map((booking) => <AdminRow key={booking.id} title={hotels.find((hotel) => hotel.id === booking.hotelId)?.name ?? 'Chỗ ở'} subtitle={`${booking.stay} · ${booking.nights} đêm · ${booking.guests} khách · ${booking.id}`} status={formatVnd(booking.displayAmount)} onPress={() => openAdminDetail("bookings", booking.id)} />)}</AdminCard><AdminCard title="Trạng thái và thanh toán"><AdminText>Admin giám sát, không tùy ý sửa booking hoặc xác nhận thanh toán.</AdminText></AdminCard></AdminPage>;
}

export function BookingDetailScreen({ id }: { id: string }) {
  const booking = mockBookingMonitorService.useItems().find((item) => item.id === id);
  const hotel = mockAccommodationService.useItems().find((item) => item.id === booking?.hotelId);
  const guest = mockUserService.useItems().find((item) => item.id === booking?.guestId);
  if (!booking) return <AdminPage title="Chi tiết đặt phòng"><AdminCard><AdminText>Không tìm thấy đặt phòng.</AdminText></AdminCard></AdminPage>;
  return <AdminPage title="Chi tiết đặt phòng"><AdminCard title={hotel?.name}><AdminText>{booking.stay} · {booking.nights} đêm · {booking.guests} khách</AdminText><AdminText>Trạng thái: {booking.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đã hủy'} · Tổng tiền theo frame đặt phòng: {formatVnd(booking.displayAmount)}</AdminText></AdminCard><AdminCard title={`Booking ${booking.id}`}><AdminText>Khách: {guest?.name} · Phòng: {booking.room}</AdminText><AdminText>Trạng thái và thanh toán từ hệ thống; Admin giám sát, không tùy ý sửa booking.</AdminText></AdminCard><AdminRow title="Khách sạn" subtitle={hotel?.name} status={booking.status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đã hủy'} /></AdminPage>;
}

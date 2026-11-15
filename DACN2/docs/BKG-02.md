# ST-BKG-02 - Tạo booking và thông tin khách lưu trú

## Luồng đã triển khai

1. User đăng nhập bằng tài khoản API và chọn khách sạn, hạng phòng cùng ngày lưu trú từ dữ liệu PostgreSQL.
2. Ứng dụng nhập họ tên, email, số điện thoại và yêu cầu đặc biệt của người đại diện lưu trú.
3. `POST /api/bookings` kiểm tra lại khách sạn, phòng, sức chứa, tồn phòng và lịch giá trong transaction.
4. Backend tự tính tổng tiền, tạo mã booking và lưu snapshot giá từng đêm. Client không được gửi giá hoặc trạng thái.
5. Booking dùng phương thức thanh toán thủ công khi nhận phòng và được tạo ở trạng thái `CONFIRMED`.
6. Màn hình Đặt phòng tải lại `GET /api/bookings`, vì vậy dữ liệu vẫn còn sau khi mở lại ứng dụng.

Schema hiện tại lưu một người đại diện trong các trường `guestName`, `guestEmail`, `guestPhone` và `note`. Dự án chưa có model `BookingGuest`, nên task này không tự thêm danh sách nhiều khách.

## Request

```http
POST /api/bookings
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "roomId": "seed-room-deluxe-sea-view",
  "checkIn": "2026-12-10",
  "checkOut": "2026-12-12",
  "adults": 2,
  "children": 0,
  "roomCount": 1,
  "guestName": "Nguyễn Văn A",
  "guestEmail": "guest@example.com",
  "guestPhone": "0901234567",
  "note": "Nhận phòng muộn"
}
```

## Cách test trên ứng dụng

1. Chạy backend bằng `npm.cmd run dev:api`.
2. Chạy Expo bằng `npm.cmd run dev:mobile`.
3. Đăng nhập `traveler@bookingtravel.vn / traveler123`.
4. Tìm khách sạn, chọn ngày tương lai và một hạng phòng còn trống.
5. Nhập đủ thông tin khách rồi xác nhận đặt phòng.
6. Mở tab **Đặt phòng** và kiểm tra mã booking vừa tạo.

## Kiểm tra bằng pgAdmin

```sql
SELECT
  b.code,
  b.status,
  b."guestName",
  b."guestEmail",
  b."guestPhone",
  b."checkIn",
  b."checkOut",
  b."roomCount",
  b."totalAmount",
  h.name AS hotel,
  r.name AS room
FROM "Booking" b
JOIN "Hotel" h ON h.id = b."hotelId"
JOIN "Room" r ON r.id = b."roomId"
ORDER BY b."createdAt" DESC;
```

## Kiểm tra tự động

```powershell
npm.cmd run build --workspace @booking-travel/api
npm.cmd run lint --workspace @booking-travel/api
npm.cmd run test --workspace @booking-travel/api -- --runInBand
npm.cmd run typecheck --workspace @booking-travel/mobile
npm.cmd run lint --workspace @booking-travel/mobile
npm.cmd run test:traveler --workspace @booking-travel/mobile
```

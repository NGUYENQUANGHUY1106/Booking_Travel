# Core Booking API (Hotel, Room, Booking, Admin)

Phạm vi hiện tại cung cấp model, migration, seed và CRUD API để hai thành viên phát triển trên cùng một cấu trúc dữ liệu. ST-AUTH-08 đã gắn xác thực, RBAC và kiểm tra sở hữu cho các endpoint Hotel, Room, Booking, Admin và Saved Address hiện có. Chi tiết quyền và phần phụ thuộc còn thiếu nằm trong [AUTH-08.md](./AUTH-08.md).

## Model và quan hệ

- `User`: tài khoản gốc với role `USER`, `HOTEL_OWNER`, `ADMIN`.
- `AdminProfile`: hồ sơ quản trị, quan hệ 1-1 với `User`.
- `Hotel`: thuộc một `User` có vai trò chủ khách sạn qua `ownerId`.
- `Room`: thuộc một `Hotel`; `quantity` là tổng số phòng cùng loại.
- `Booking`: liên kết `User`, `Hotel`, `Room`; lưu snapshot giá và tổng tiền tại thời điểm đặt.

Booking dùng khoảng ngày `[checkIn, checkOut)`. Khi tạo booking, backend lấy `basePrice` từ phòng, tự tính `nights`, `pricePerNight`, `totalAmount` và kiểm tra tổng `roomCount` đã giữ trong các booking còn hiệu lực. Client không gửi giá hoặc tổng tiền.

## Endpoint

Tất cả đường dẫn dưới đây có prefix `/api`.

| Method | Endpoint | Mục đích |
| --- | --- | --- |
| GET | `/hotels` | Công khai khách sạn đã duyệt; owner chỉ lọc `ownerId` của mình |
| GET | `/hotels/:id` | Chi tiết khách sạn và phòng |
| POST | `/hotels` | Tạo khách sạn |
| PATCH | `/hotels/:id` | Cập nhật khách sạn |
| DELETE | `/hotels/:id` | Xóa mềm khách sạn |
| GET | `/hotels/:hotelId/rooms` | Danh sách phòng của khách sạn |
| GET | `/rooms/:id` | Chi tiết phòng |
| POST | `/hotels/:hotelId/rooms` | Tạo phòng |
| PATCH | `/rooms/:id` | Cập nhật phòng |
| DELETE | `/rooms/:id` | Xóa mềm phòng |
| GET | `/bookings` | Danh sách giới hạn theo khách/owner/admin có quyền |
| GET | `/bookings/:id` | Chi tiết booking |
| POST | `/bookings` | Tạo booking và kiểm tra tồn phòng |
| PATCH | `/bookings/:id/status` | Cập nhật trạng thái booking |
| GET | `/admins` | Danh sách admin |
| GET | `/admins/:id` | Chi tiết admin |
| POST | `/admins` | Nâng một user thành admin và tạo profile |
| PATCH | `/admins/:id` | Cập nhật chức danh/quyền mô tả |
| DELETE | `/admins/:id` | Xóa profile admin và trả role về `USER` |

Swagger: `http://localhost:3000/docs`.

## Dữ liệu seed dùng chung

Seed sử dụng `upsert`, vì vậy có thể chạy lại mà không tạo bản ghi trùng.

| Loại | Giá trị |
| --- | --- |
| Admin | `admin@bookingtravel.vn` |
| Admin giới hạn | `admin-limited@bookingtravel.vn`, không có quyền quản trị bổ sung |
| Chủ khách sạn A | `owner@bookingtravel.vn` |
| Chủ khách sạn B | `owner-b@bookingtravel.vn` |
| Khách du lịch A | `traveler@bookingtravel.vn` |
| Khách du lịch B | `traveler-b@bookingtravel.vn` |
| Hotel A | `seed-hotel-blue-horizon`, thuộc Owner A |
| Hotel B | `seed-hotel-riverside-hoi-an`, thuộc Owner B |
| Hotel B nháp | `seed-hotel-owner-b-draft`, thuộc Owner B, chưa công khai |
| Rooms A | `seed-room-deluxe-sea-view`, `seed-room-superior-city-view` |
| Room B | `seed-room-riverside-garden-view`, thuộc Hotel B |
| Room B nháp | `seed-room-owner-b-draft`, thuộc Hotel B nháp |
| Booking A | mã `BT-DEMO-001`, của khách A tại Hotel A |
| Booking B | mã `BT-DEMO-002`, của khách B tại Hotel B |

Bộ seed có 6 users (2 admin, 2 owner, 2 traveler), 3 hotels, 4 rooms và 2 bookings. Có thể dùng Owner A/B để kiểm tra quyền sửa hotel/room và quyền xem booking theo khách sạn; Hotel B nháp và Room B nháp dùng để kiểm tra quyền đọc chéo. Dùng khách A/B để kiểm tra quyền xem booking cá nhân, Admin giới hạn để kiểm tra thiếu quyền override. Thông tin hotel/room đã duyệt vẫn có thể xem công khai.

Các tài khoản seed dùng bcrypt hash thật. Thông tin đăng nhập local: `admin@bookingtravel.vn / admin123`, `owner@bookingtravel.vn / owner123`, và `traveler@bookingtravel.vn / traveler123`.

## Sau khi pull code

Tại thư mục `DACN2`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm.cmd ci
npm.cmd run infra:up
npm.cmd run db:setup
npm.cmd run dev:api
```

`db:setup` thực hiện tuần tự:

1. Generate Prisma Client.
2. Chạy toàn bộ migration chưa áp dụng.
3. Seed dữ liệu mẫu dùng chung.

Nếu dùng PostgreSQL/pgAdmin cài trực tiếp thay vì Docker, chỉ cần tạo database rỗng theo `DATABASE_URL`; Prisma sẽ tự tạo bảng khi chạy `npm.cmd run db:setup`.

## Xác thực và việc còn lại

Client gửi Bearer access token cho endpoint được bảo vệ. Backend lấy user ID và role từ tài khoản trong database; `ownerId` khi tạo Hotel và `userId` khi tạo Booking không còn nhận từ body. Các API `/admins` yêu cầu quyền `USER_MANAGEMENT` trong `AdminProfile`. Booking admin yêu cầu `BOOKING_SUPPORT`.

AUTH-03 cung cấp `POST /auth/login`, access token và refresh token; dữ liệu seed đã có bcrypt hash cho các tài khoản demo để kiểm tra endpoint bảo vệ. Luồng refresh/rotate/logout và thu hồi session chưa có endpoint trong phạm vi hiện tại. Hotel moderation và state transition đầy đủ cho Booking/Payment là các task nghiệp vụ riêng, chưa có endpoint tương ứng trong phạm vi này.

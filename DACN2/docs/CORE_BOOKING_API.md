# Core Booking API (Hotel, Room, Booking, Admin)

Phạm vi hiện tại cung cấp model, migration, seed và CRUD API để hai thành viên phát triển trên cùng một cấu trúc dữ liệu. Các endpoint ghi dữ liệu **chưa gắn authentication, RBAC hoặc ownership guard** theo yêu cầu của ST-AUTH-08. Không triển khai cấu hình này lên production.

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
| GET | `/hotels` | Danh sách; lọc bằng `ownerId`, `status`, `city`, `search` |
| GET | `/hotels/:id` | Chi tiết khách sạn và phòng |
| POST | `/hotels` | Tạo khách sạn |
| PATCH | `/hotels/:id` | Cập nhật khách sạn |
| DELETE | `/hotels/:id` | Xóa mềm khách sạn |
| GET | `/hotels/:hotelId/rooms` | Danh sách phòng của khách sạn |
| GET | `/rooms/:id` | Chi tiết phòng |
| POST | `/hotels/:hotelId/rooms` | Tạo phòng |
| PATCH | `/rooms/:id` | Cập nhật phòng |
| DELETE | `/rooms/:id` | Xóa mềm phòng |
| GET | `/bookings` | Danh sách; lọc bằng `userId`, `hotelId`, `status` |
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
| Chủ khách sạn | `owner@bookingtravel.vn` |
| Khách du lịch | `traveler@bookingtravel.vn` |
| Hotel | `seed-hotel-blue-horizon` |
| Rooms | `seed-room-deluxe-sea-view`, `seed-room-superior-city-view` |
| Booking | mã `BT-DEMO-001` |

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

## Việc còn lại của ST-AUTH-08

- Lấy `userId`, `ownerId`, role từ access token thay vì body/query.
- Gắn authentication guard cho endpoint ghi dữ liệu.
- Kiểm tra `HOTEL_OWNER` chỉ sửa hotel/room/booking thuộc khách sạn của mình.
- Chỉ `ADMIN` được thao tác `/admins` và duyệt/trạng thái khách sạn.
- Bổ sung state transition đầy đủ cho booking và payment.

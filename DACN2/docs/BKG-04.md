# ST-BKG-04 - Khởi tạo thanh toán

## Phạm vi đã triển khai

- Chỉ hỗ trợ `PAY_AT_HOTEL`: khách thanh toán thủ công tại khách sạn khi check-in.
- Sau khi booking được tạo, ứng dụng gọi API khởi tạo payment thật và lưu vào PostgreSQL.
- Backend lấy `userId`, số tiền, tiền tệ và trạng thái booking từ database; client không được tự gửi các giá trị này.
- Payment mới có trạng thái `PENDING`; booking vẫn giữ trạng thái `CONFIRMED`.
- Mỗi booking chỉ có một payment `PAY_AT_HOTEL`. `Idempotency-Key` và khóa transaction ngăn tạo trùng khi bấm lại hoặc gửi đồng thời.
- Chưa tích hợp thẻ, ví điện tử, chuyển khoản, cổng thanh toán hoặc webhook.

## API

```http
POST /api/payments/initialize
Authorization: Bearer <access-token>
Idempotency-Key: <uuid-v4>
Content-Type: application/json
```

```json
{
  "bookingId": "<booking-id>",
  "method": "PAY_AT_HOTEL"
}
```

Tra cứu payment của booking hoặc theo ID:

```http
GET /api/payments/booking/:bookingId
GET /api/payments/:id
```

Các endpoint chấp nhận tài khoản `USER` và `HOTEL_OWNER` khi họ đặt phòng với tư cách khách, nhưng chỉ trả payment/booking thuộc chính tài khoản đang đăng nhập. Booking không thuộc tài khoản được trả về `404` để không làm lộ dữ liệu.

## Cài đặt sau khi pull code

Tại thư mục gốc `DACN2`:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run prisma:seed
```

`prisma:migrate` tạo enum `PaymentMethod`, `PaymentStatus` và bảng `Payment`. Seed thêm payment demo `PAY-DEMO-001` nhưng có thể chạy lại an toàn.

## Cách test trên ứng dụng

1. Chạy `npm.cmd run dev:api` và `npm.cmd run dev:mobile`.
2. Đăng nhập `traveler@bookingtravel.vn / traveler123`.
3. Chọn khách sạn, hạng phòng và ngày còn phòng, sau đó nhập thông tin khách lưu trú.
4. Chọn **Thanh toán tại khách sạn** và xác nhận.
5. Kiểm tra booking được tạo, màn hình báo thành công và payment có trạng thái `PENDING` trong database.
6. Bấm lại khi request trước đã thành công: hệ thống phải trả payment cũ, không tạo payment thứ hai.

## Kiểm tra bằng pgAdmin

```sql
SELECT
  p.reference,
  p.status,
  p.method,
  p.amount,
  p.currency,
  b.code AS booking_code,
  u.email,
  p."createdAt"
FROM "Payment" p
JOIN "Booking" b ON b.id = p."bookingId"
JOIN "User" u ON u.id = p."userId"
ORDER BY p."createdAt" DESC;
```

Kiểm tra không có payment trùng:

```sql
SELECT "bookingId", method, COUNT(*)
FROM "Payment"
GROUP BY "bookingId", method
HAVING COUNT(*) > 1;
```

## Kiểm thử tự động

```powershell
npm.cmd run prisma:seed:test
$env:RUN_DB_PAYMENT_E2E='1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand payments-db.e2e-spec.ts
npm.cmd run test --workspace @booking-travel/api -- --runInBand
npm.cmd run test:traveler --workspace @booking-travel/mobile
```

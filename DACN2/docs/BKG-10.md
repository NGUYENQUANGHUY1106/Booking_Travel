# ST-BKG-10 – Hóa đơn / biên nhận booking

## Prompt triển khai chuẩn đã sử dụng

```text
Bạn là Senior Full-stack Developer chuyên NestJS, Prisma, PostgreSQL,
React Native, TypeScript và Expo. Hãy triển khai trực tiếp ST-BKG-10 trong
repository Booking_Travel hiện tại.

Mục tiêu: người dùng đã đăng nhập xem và tải chứng từ của booking thuộc chính
họ. Dữ liệu phải lấy từ PostgreSQL, không dùng dữ liệu giả và không nhận số
tiền/trạng thái thanh toán từ client.

Backend:
- Đọc AGENT.md, SRS, Prisma schema, Booking và Payment hiện tại trước khi sửa.
- Tạo endpoint GET /api/bookings/:bookingId/invoice và response tải file.
- Kiểm tra access token và quyền sở hữu; booking người khác trả 404.
- Snapshot phải gồm booking, khách sạn, hạng phòng, kỳ lưu trú, khách đại diện,
  tổng tiền, tiền tệ và trạng thái.
- Chỉ tạo PAYMENT_RECEIPT khi có Payment PAID/SUCCESS và amount/currency khớp
  Booking. Nếu chưa thanh toán, chỉ tạo BOOKING_SUMMARY.
- Sinh số chứng từ duy nhất, lưu metadata + snapshot bất biến và gọi lại cùng
  snapshot không được tạo bản ghi trùng.
- Tuyệt đối không lưu/hiển thị dữ liệu thẻ. Đây không phải hóa đơn thuế điện tử.
- Chỉ thêm migration mới, không sửa migration đã chạy.

Frontend Expo:
- Tích hợp vào chi tiết booking thật; hiển thị loading/error/retry.
- Hiển thị loại chứng từ, số chứng từ, booking, khách sạn, kỳ lưu trú, khách,
  tổng tiền và trạng thái thanh toán.
- Web tải file; Android/iOS mở preview file bằng API tương thích Expo SDK 58.
- Không làm ảnh hưởng luồng booking/payment hiện tại.

Kiểm thử:
- Unit test booking chưa thanh toán, đã thanh toán, amount/currency sai,
  idempotency và truy cập booking người khác.
- Chạy Prisma validate/generate, backend test/build, mobile lint/typecheck/test.
- Báo rõ phần chưa kiểm chứng; không tự commit/push nếu chưa được yêu cầu.
```

## Phạm vi đã triển khai

- `GET /api/bookings/:id/invoice`: lấy hoặc tạo metadata chứng từ và HTML.
- `GET /api/bookings/:id/invoice/document`: tải trực tiếp file HTML.
- `GET /api/bookings/:id/invoice/pdf`: tải file PDF có nhúng font Inter để hiển
  thị đúng tiếng Việt.
- `BOOKING_SUMMARY`: booking chưa có giao dịch `PAID`/`SUCCESS`.
- `PAYMENT_RECEIPT`: payment thành công, số tiền và tiền tệ khớp booking.
- Bảng `Invoice` lưu số chứng từ, snapshot, hash, booking, payment và người dùng.
- Màn hình **Hóa đơn / Biên nhận** trong chi tiết booking hỗ trợ tải PDF/HTML
  trên web và mở file trên Android/iOS.

PDF là định dạng chính; HTML được giữ làm phương án dự phòng. Chứng từ là bản
tóm tắt booking/biên nhận hệ thống, không phải hóa đơn thuế điện tử.

## Cài đặt sau khi pull

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

## Test thủ công

1. Chạy API và Expo, đăng nhập tài khoản traveler.
2. Mở **Đặt phòng của tôi** → chọn booking → **Xem hóa đơn / biên nhận**.
3. Với `PAY_AT_HOTEL` đang `PENDING`, màn hình phải ghi **Tóm tắt booking** và
   **Chưa có thanh toán thành công**.
4. Với payment mô phỏng đã thành công, màn hình phải ghi **Biên nhận thanh
   toán**, có mã giao dịch và tổng tiền đúng.
5. Bấm **Tải chứng từ PDF** trên web hoặc **Mở file PDF** trên điện thoại. Có
   thể dùng bản HTML dự phòng nếu thiết bị không có trình đọc PDF.
6. Tải lại nhiều lần và xác nhận database chỉ có một bản ghi cho cùng snapshot.

Kiểm tra bằng pgAdmin:

```sql
SELECT
  i."invoiceNumber",
  i."documentType",
  b.code AS booking_code,
  p.status AS payment_status,
  i."issuedAt"
FROM "Invoice" i
JOIN "Booking" b ON b.id = i."bookingId"
LEFT JOIN "Payment" p ON p.id = i."paymentId"
ORDER BY i."issuedAt" DESC;
```

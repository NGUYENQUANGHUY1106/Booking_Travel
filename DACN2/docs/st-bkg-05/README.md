# ST-BKG-05 — Xác thực callback/webhook thanh toán

## Phạm vi đã triển khai

`develop` chưa có BKG-04, Payment transaction, provider sandbox, BKG-06 QR hoặc dịch vụ thông báo booking. Nhánh này chứa BKG-01 (cherry-pick commit `a10341c`) để có booking/quote thật. BKG-05 cung cấp một adapter **SIMULATOR chỉ dùng local/test** với chữ ký HMAC, Payment PENDING, webhook, status API và giao diện theo PAY-UI-01/02/03/04. Không có charge thật, không có payment URL của cổng production. Không được cấu hình `PAYMENT_SIMULATOR_ENABLED=true` trên production.

## Contract

- `GET /api/payments/methods` trả `{ payAtHotel, simulator }`. Simulator chỉ khả dụng khi bật cờ, có merchant ID và secret tối thiểu 32 ký tự.
- `POST /api/bookings` nhận thêm `paymentMethod: "PAY_AT_HOTEL" | "SIMULATOR"`. Chỉ booking SIMULATOR có hạn giữ phòng 15 phút. Booking tạo từ quote vẫn dùng snapshot giá server.
- `POST /api/payments/bookings/:bookingId/init` yêu cầu JWT của chính User đặt phòng, chỉ dùng cho booking SIMULATOR còn `PENDING_PAYMENT` và chưa hết hạn. Trả `paymentId`, `merchantReference`, amount/currency snapshot, deadline, `paymentUrl: null`. Gọi lặp trả giao dịch PENDING cũ; sau FAILED có thể tạo attempt mới đến khi hết hạn.
- `POST /api/payments/SIMULATOR/webhook` không dùng JWT. Yêu cầu JSON tối đa 16 KiB và hai header `x-bt-simulator-timestamp` (Unix giây trong ±300 giây), `x-bt-simulator-signature` (hex HMAC-SHA256 của `timestamp + "." + rawBody`). Body có `eventId`, `merchantId`, `merchantReference`, `providerTxnId`, `amount` (chuỗi thập phân), `currency`, `status` (`PENDING|SUCCESS|FAILED`), `failureReason?`. Secret chỉ ở server/CLI test.
- `GET /api/payments/:id` và `GET /api/payments/bookings/:bookingId/latest` yêu cầu JWT của người đặt phòng; trả Payment/Booking status, reference, amount/currency, deadline, `canRetry`, `reconciliationRequired`, hotel/room/date. Người khác nhận 404. URL trả về hay query `status=success` của browser không được dùng để cập nhật DB.

Chữ ký sai/timestamp sai/merchant sai: HTTP 401, không cập nhật DB. Event có chữ ký đúng nhưng sai reference/amount/currency/provider transaction: HTTP 409, lưu receipt không chứa payload và ghi log cảnh báo. Event hợp lệ đã commit: HTTP 201 ACK; gửi lại cùng event ID và payload: ACK nhưng không tạo side effect mới. Lỗi DB: HTTP 5xx để simulator/provider retry, không ACK trước khi commit.

## Quy tắc chuyển trạng thái

| Payment hiện tại | Booking hiện tại | Webhook | Kết quả |
| --- | --- | --- | --- |
| PENDING hoặc FAILED | PENDING_PAYMENT, deadline còn hạn | SUCCESS | Payment SUCCESS, Booking CONFIRMED, một outbox event |
| PENDING | PENDING_PAYMENT, deadline còn hạn | FAILED | Payment FAILED, Booking giữ đến deadline để có thể thử lại |
| SUCCESS | CONFIRMED | FAILED/PENDING | Không hạ trạng thái |
| PENDING/FAILED | EXPIRED/CANCELLED hoặc đã hết deadline | SUCCESS | Payment SUCCESS, Booking không CONFIRMED, mở case đối soát |
| PENDING | PENDING_PAYMENT, deadline hết | timeout worker | Booking EXPIRED; inventory được giải phóng |
| Bất kỳ | Bất kỳ | event ID trùng | Chỉ ACK nếu payload khớp; không lặp side effect |

Giao dịch khóa hotel → room → booking trước khi xác nhận để đồng bộ với khóa tạo booking. Timeout worker khóa booking; truy vấn availability loại booking PENDING_PAYMENT đã hết deadline ngay cả trước lượt worker kế tiếp. DB có unique `(provider,eventId)`, `merchantReference`, `providerTxnId`, và `(paymentId,eventType)` cho outbox. `PaymentOutboxEvent` là điểm nối bền vững cho BKG-06/notification sau này; **chưa có worker gửi notification/QR**, không báo đã phát thông báo hoặc tạo QR.

## Chạy thử local

Từ `DACN2`, cấu hình `.env` riêng (không commit secret):

```dotenv
PAYMENT_SIMULATOR_ENABLED=true
PAYMENT_SIMULATOR_MERCHANT_ID=booking-travel-local
PAYMENT_SIMULATOR_SECRET=<chuoi-ngau-nhien-rieng-it-nhat-32-ky-tu>
```

Chạy `npm.cmd install`, `npm.cmd run prisma:generate`, `npm.cmd run prisma:migrate`, `npm.cmd run dev:api`, `npm.cmd run dev:mobile`. Đăng nhập User, chọn phòng đang bán, lấy quote, ở Phương thức thanh toán chọn **Cổng thanh toán mô phỏng** và xác nhận. Màn hình PAY-UI-02 sẽ chờ. Lấy mã booking `BT-...` trên màn hình rồi chạy terminal khác:

```powershell
npm.cmd run payment:simulate --workspace @booking-travel/api -- BT-XXXXXXXX SUCCESS
```

Thay `SUCCESS` bằng `FAILED` để kiểm tra thất bại. CLI đọc Payment từ DB, tạo webhook đúng chữ ký và gửi về `http://localhost:3000/api/payments/SIMULATOR/webhook`. Có thể đặt `PAYMENT_SIMULATOR_WEBHOOK_URL` cho API local ở cổng khác. Không dùng CLI với dữ liệu/secret production.

Giao diện dựa trên Figma PAY-UI-02 `4:1151`, PAY-UI-03 `4:1164`, PAY-UI-04 `4:1191`: header, card trạng thái, nút kiểm tra lại, khối mã đặt phòng và tổng tiền. Tên khách sạn, mã, ngày và số tiền lấy từ API; ảnh mẫu và mã mẫu trong Figma không dùng làm dữ liệu thật. Màn hình success tải lại API và chỉ render khi `Payment SUCCESS` **và** `Booking CONFIRMED`. Nếu chưa có QR, app ghi rõ QR đang chờ BKG-06.

## Kiểm thử

- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`
- `npm.cmd run test --workspace @booking-travel/api -- --runInBand`
- `$env:RUN_DB_PAYMENT_E2E='1'; npm.cmd run test:e2e --workspace @booking-travel/api -- payment-webhook-db.e2e-spec.ts`
- `npm.cmd run test:traveler --workspace @booking-travel/mobile`

Đã chạy: typecheck, lint, build API; backend unit 40 suites/168 tests; PostgreSQL payment E2E 5 tests; inventory E2E 7 tests; pricing E2E 1 test; mobile traveler 18 tests. E2E tạo dữ liệu riêng và dọn sau test: chữ ký/merchant sai, amount/currency/reference sai, tám webhook đồng thời, event ID bị dùng lại với payload khác, fail sau success, fail trước success, hai attempt, success sau expiry và truy cập chéo User. Màn hình web đã được smoke bằng API + PostgreSQL thật và chụp ở 390×844/360×800: [processing](./payment-processing-390.png), [success](./payment-success-390.png), [failed](./payment-failed-360.png). Chưa chạy kiểm thử trên thiết bị iOS/Android thật. Chưa kiểm chứng provider production vì repo không có provider/credentials và chưa triển khai BKG-04 production. Bốn tài liệu DOCX tham chiếu trong prompt không có trong checkout; đã đối chiếu `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx`, `PROJECT OVERVIEW.docx` và Figma.

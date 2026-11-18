# ST-BKG-09 — Hủy booking và xử lý hoàn tiền

Nhánh `feat/ST-BKG-09-yeu-cau-va-xu-ly-hoan-tien` được tạo từ `develop` tại `499a79d`. Provider hiện có của dự án là **SIMULATOR**. Chưa có tích hợp hoàn tiền production; giao diện không ghi nhận tiền đã hoàn cho đến khi callback có chữ ký xác nhận `SUCCESS`.

## Quy tắc và dữ liệu

- Chủ khách sạn cấu hình các mốc `minimumHoursBeforeCheckIn` và `refundPercent` tại phần chính sách. Mốc 0 giờ là bắt buộc, giờ không trùng và tỷ lệ hoàn không giảm khi hủy sớm hơn. Không áp đặt mốc 24/48 giờ hoặc tỷ lệ mặc định.
- Khi tạo booking, backend lưu văn bản chính sách, quy tắc cấu trúc và giờ nhận phòng. Thay đổi sau này chỉ ảnh hưởng booking mới. Thời điểm hủy được so với giờ nhận phòng theo `Asia/Ho_Chi_Minh` (UTC+07). Mức hoàn theo chính sách = `floor(đã thu × tỷ lệ / 100)` với VND không có phần lẻ; yêu cầu mới tối đa bằng mức này trừ khoản đã hoàn/đang giữ. Phí hủy = đã thu − mức hoàn theo chính sách.
- Booking cũ không có quy tắc cấu trúc tạo yêu cầu với `amount = NULL`, chờ đối soát thủ công. Admin không thể tự nhập hoặc duyệt một số tiền không có căn cứ từ snapshot. Đây là quyết định nghiệp vụ đã được người dùng xác nhận.
- Với mỗi Payment, số tiền đang giữ (`PENDING_REVIEW`, `APPROVED`, `PROCESSING`) cộng số đã hoàn (`COMPLETED`) và yêu cầu mới không được vượt số tiền đã thu. Booking và Payment được khóa trong transaction theo thứ tự cố định. Chỉ một `CANCEL:<paymentId>` được tạo cho một sự kiện hủy; khóa duy nhất ở DB bảo vệ khi bấm lặp.
- `RefundRequest`, `RefundEvent` và `RefundWebhookReceipt` giữ cơ sở tính, người thao tác, lý do, tham chiếu, kết quả và event ID. Không lưu thông tin thẻ. Callback sai chữ ký, merchant, giao dịch gốc, tham chiếu hoàn, amount hoặc currency bị từ chối. Event ID và terminal state chống xử lý lặp. Event `REFUND_COMPLETED:<requestId>` có khóa duy nhất để người tiêu thụ outbox xử lý đúng một lần.

## Trạng thái

| Hành động | RefundRequest | Payment | Booking |
| --- | --- | --- | --- |
| Hủy, chưa thu tiền | Không tạo | Payment đang chờ → `CANCELLED` | `CANCELLED` |
| Hủy, có tiền và số hoàn > 0 | `PENDING_REVIEW` | `SUCCESS` | `REFUND_PENDING` |
| Admin duyệt / gửi cổng mô phỏng | `APPROVED` → `PROCESSING` | Giữ nguyên | `REFUND_PENDING` |
| Callback cuối `SUCCESS` | `COMPLETED` | `PARTIALLY_REFUNDED` hoặc `REFUNDED` | `CANCELLED` nếu hoàn một phần, `REFUNDED` nếu hoàn hết |
| Callback cuối `FAILED` | `FAILED` | Giữ nguyên | `CANCELLED` |
| Admin thử lại sau thất bại đã xác nhận | `PENDING_REVIEW` (tối đa 3 lần) | Giữ nguyên | `REFUND_PENDING` |
| Admin từ chối | `REJECTED` | Giữ nguyên | `CANCELLED` |

Không thử lại khi `PROCESSING` hoặc khi kết quả cổng chưa rõ. Dùng lại `providerRefundRef` cố định cho mỗi yêu cầu.

## API

- User: `GET /api/bookings/:id/cancellation-preview`, `POST /api/bookings/:id/cancel` (body chỉ có `reason`), `GET /api/refunds`, `GET /api/refunds/:id`.
- Admin có `BOOKING_SUPPORT`: `GET /api/admin/refunds`, `GET /api/admin/refunds/payments`, `GET /api/admin/refunds/:id`, `POST /api/admin/refunds/:id/decision`, `POST /api/admin/refunds/:id/dispatch`, `POST /api/admin/refunds/:id/reopen`.
- Simulator: `POST /api/refunds/simulator/webhook`, yêu cầu raw body, `x-bt-simulator-timestamp`, `x-bt-refund-signature` (HMAC SHA-256 với namespace `refund:`). API Admin chỉ chuyển sang `PROCESSING` để đợi mô phỏng; callback đã xác thực mới chuyển sang `COMPLETED`. Không có giao dịch chuyển tiền thật.

## Kiểm thử cục bộ

Trong `DACN2`:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run typecheck --workspace @booking-travel/api
npm.cmd run typecheck --workspace @booking-travel/mobile
npm.cmd run lint --workspace @booking-travel/api
npm.cmd run lint --workspace @booking-travel/mobile
npm.cmd test --workspace @booking-travel/api -- --runInBand
```

Kiểm thử với PostgreSQL cùng engine production (trong `apps/booking-travel-be`):

```powershell
node --env-file=../../.env ../../node_modules/jest/bin/jest.js --runInBand src/modules/bookings/refunds.integration.spec.ts
```

Kiểm tra luồng trên giao diện: đăng nhập User, mở booking `CONFIRMED` trong **Đặt phòng của tôi**, vào **Hủy đặt phòng**, xem snapshot và số tiền dự kiến, nhập lý do, xác nhận. Admin mở **Thanh toán và hoàn tiền**, duyệt yêu cầu rồi **Chờ callback mô phỏng**. Lấy ID yêu cầu ở màn User hoặc Admin. Trong `apps/booking-travel-be` chạy:

```powershell
npm.cmd run refund:simulate -- <refundId> SUCCESS
```

Có thể dùng `FAILED` để kiểm tra thất bại; Admin chỉ được mở lại sau khi đã xác nhận kết quả cuối. `PAYMENT_SIMULATOR_ENABLED`, merchant ID và secret trong `.env` phải được cấu hình như ST-BKG-05. Script chỉ dùng cho phát triển, không chứng minh hoàn tiền thật.

## Giới hạn tích hợp

Repo chưa có adapter hoàn tiền của cổng thanh toán thật, sandbox refund hoặc dịch vụ thông báo khách tổng quát. Do đó chưa thể xác nhận thời gian tiền về tài khoản, gọi production provider, hoặc gửi notification ngoài ứng dụng. Outbox `REFUND_COMPLETED` đã lưu sự kiện để nối worker sau này. Booking cũ chỉ có chính sách văn bản tiếp tục chờ xử lý thủ công; không tự suy diễn tỷ lệ hoặc để Admin nhập amount tùy ý.

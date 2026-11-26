# Vòng đời lưu trú và thu tiền tại khách sạn

## Quy tắc hiện hành

- `Booking.status` dùng `CHECKED_IN` và `COMPLETED` hiện có. Giờ trả là `checkOutTimeSnapshot` đã chốt của booking theo `Asia/Ho_Chi_Minh`. Tự hoàn tất sau giờ trả cộng 2 giờ; thiếu snapshot hợp lệ thì job báo `needsReview`, không đoán bằng giờ khách sạn hiện tại.
- Chủ xác nhận trả phòng từ đầu ngày checkout đến hết 2 giờ trễ. `actualCheckOutAt` chỉ được ghi khi Chủ xác nhận khách thực tế rời đi. Job tự hoàn tất ghi `completedAt` và `completionMethod=AUTO_AFTER_GRACE_PERIOD`, không ghi `actualCheckOutAt`.
- Job `StayCompletionService` chạy lúc khởi động và mỗi 60 giây. PostgreSQL là nguồn trạng thái chuẩn. Mỗi booking được khóa `FOR UPDATE` và cập nhật với điều kiện `CHECKED_IN`; `BookingStayTransition` có unique `(bookingId, action)`. Khi tự hoàn tất, job tạo cảnh báo bàn giao và chặn lượng phòng tương ứng cho đến khi Chủ kiểm tra, xác nhận bàn giao. Tác vụ xác nhận giải phóng block trong cùng transaction, không thay đổi room-night gốc.
- Với `PAY_AT_HOTEL`, màn Chủ hiển thị tổng tiền đã chốt và yêu cầu xác nhận đã thu đủ cùng cách thu (`CASH` hoặc `BANK_TRANSFER`). API so sánh số tiền bằng `Prisma.Decimal` với `Booking.totalAmount`, khóa booking, ghi `Payment.PAID` và `CHECKED_IN` trong cùng transaction. QR chỉ xác thực nhận phòng.
- Booking cũ đã `CHECKED_IN` hoặc `COMPLETED` còn payment `PENDING` có nút xác nhận khoản thu riêng. Job tự hoàn tất tuyệt đối không đổi payment. Sau xác nhận, Payment lưu `paidAt`, `collectedById`, `propertyCollectionMethod`; `BookingStayTransition` thêm sự kiện `PROPERTY_PAYMENT_COLLECTED`. Unique `(bookingId,method)` và khóa booking ngăn ghi thu hai lần.
- `PATCH /bookings/:id/status` không còn cho Admin bỏ qua quy trình nhận/trả phòng. QR User chỉ còn hiện khi booking `CONFIRMED`.

## API và đối soát

| API | Mục đích |
| --- | --- |
| `POST /api/owner/bookings/:id/check-in` | Với `PAY_AT_HOTEL`, thêm `confirmedCollection: true`, `collectedAmount` bằng tổng booking và `collectionMethod`. |
| `POST /api/owner/bookings/:id/confirm-property-collection` | Chủ xác nhận khoản thu cũ sau khi booking đã nhận phòng; yêu cầu `idempotencyKey` và ba trường thu tiền ở trên. |
| `POST /api/owner/bookings/:id/confirm-handover` | Chủ xác nhận đã kiểm tra bàn giao sau khi job tự hoàn tất; yêu cầu `confirmed: true`, `idempotencyKey`. |
| `GET /api/admin/payments/summary` | Tách giá trị booking xác nhận, thu tại khách sạn, thu online, hoàn tiền và giá trị giao dịch ròng theo tiền tệ. |

Admin > Thanh toán lọc `PAID` sẽ thấy khoản thu tại khách sạn. Admin > Đặt phòng lọc `PAID` hiển thị “Đã thu tại chỗ”. Tiền khách trả trực tiếp khách sạn không phải doanh thu hoặc lợi nhuận nền tảng. Dashboard Admin chỉ gọi KPI online là “Đã thu online tháng”. Giá trị ròng dùng tổng payment đã thu trừ refund hoàn tất; không cộng thêm Booking.totalAmount.

Chạy từ `DACN2`:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run stay:reconcile --workspace @booking-travel/api
npm.cmd run stay:reconcile --workspace @booking-travel/api -- --inspect BT-09DD0B21
```

`stay:reconcile` dùng cùng quy tắc với job định kỳ, an toàn khi chạy lại và in `scanned`, `completed`, `needsReview`. Không chạy seed để xử lý booking cũ. Nếu `needsReview > 0`, rà soát giờ trả đã chốt trước khi xử lý thủ công.

## Kiểm chứng local 26/11/2026

- Migration `20261126000100_stay_completion_property_collection` áp dụng thành công lên PostgreSQL local.
- Trước đối soát, `BT-09DD0B21` có `CHECKED_IN`, checkout 21/11/2026 22:00 VN, payment `PENDING` 2.900.000đ. Sau một lần chạy: `scanned=3`, `completed=1`, `needsReview=0`; booking thành `COMPLETED`, `completionMethod=AUTO_AFTER_GRACE_PERIOD`, `actualCheckOutAt=null`, payment vẫn `PENDING`, cảnh báo bàn giao mở. Chủ phải xác nhận thu tiền cũ khi có chứng cứ thực thu.
- Typecheck hai workspace, lint backend và unit tests booking/stay/payment đã chạy. E2E HTTP với PostgreSQL local kiểm tra quyền Owner, check-in và khoản thu duy nhất khi retry, hai bộ lọc Admin, KPI đã thu, trạng thái User, trả phòng và xác nhận khoản thu booking cũ. Chưa kiểm tra thao tác giao diện trên điện thoại thật hoặc qua staging; không xem đây là bằng chứng E2E trên thiết bị.

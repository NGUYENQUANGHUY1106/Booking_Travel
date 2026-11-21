# ST-OWN-12 — Check-in và check-out khách

## Phạm vi và nguồn dữ liệu

Luồng Owner dùng booking thật từ OWN-11 (`GET /api/owner/bookings`, `GET /api/owner/bookings/:id`) và QR của BKG-06 (`GET /api/bookings/:id/confirmation`). Booking, payment và lịch sử trạng thái chỉ có một nguồn dữ liệu trong PostgreSQL. Không ghi nhận thanh toán hoặc sửa ngày ở, giá, số phòng khi nhận/trả phòng.

Các màn hình OWN-UI-21/22 mở bước OWN-UI-23/24 để quét QR hoặc nhập mã `BT-XXXXXXXX`, xác minh ở server rồi Owner đối chiếu khách và xác nhận thủ công. Từ booking `CHECKED_IN`, Owner mở OWN-UI-25 để xác nhận trả phòng. Kết quả dùng timestamp do backend trả về. User đọc trạng thái `COMPLETED` từ API booking hiện có.

## API

Tất cả endpoint yêu cầu access token của `HOTEL_OWNER` đang hoạt động; chi tiết, xác minh và thao tác đều lọc `Booking.hotel.ownerId`. Tài nguyên khách sạn khác trả 404. Endpoint xác minh có giới hạn 10 yêu cầu/phút theo throttler hiện tại.

| Endpoint | Body | Kết quả |
| --- | --- | --- |
| `POST /api/owner/bookings/verify` | Chính xác một trong `qrToken` hoặc `bookingCode` | Booking summary của Owner, `eligibility`, và `verificationRef` ký, sống 5 phút nếu hợp lệ. Chỉ đọc. |
| `POST /api/owner/bookings/:id/check-in` | Cùng QR/mã, `verificationRef`, `idempotencyKey`, `confirmed: true` | Chỉ `CONFIRMED → CHECKED_IN`; trả booking canonical và `happenedAt`. |
| `GET /api/owner/bookings/:id/check-out-preview` | Không có | Summary và điều kiện trả phòng hiện tại; chỉ đọc. |
| `POST /api/owner/bookings/:id/check-out` | `idempotencyKey`, `confirmed: true` | Chỉ `CHECKED_IN → COMPLETED`; trả booking canonical và `happenedAt`. |

QR ký theo contract BKG-06, kiểm tra purpose, hạn, chữ ký và binding booking/code/hotel/ngày. Khi booking đổi trạng thái hoặc ngày ở giữa lúc xác minh và ghi, server chặn. Mã booking được chuẩn hóa chữ hoa, hỗ trợ cả mã demo cũ `BT-DEMO-001`, và chỉ là phương án dự phòng; mã không thay thế xác thực Owner. Token QR và contact khách không được ghi vào audit/event.

Mọi mutation khóa hàng booking trong transaction, kiểm tra lại quyền, trạng thái, payment/refund, giờ khách sạn và mã/QR. `BookingStayTransition` lưu một audit cho mỗi action của booking, kèm actor, hotel, trạng thái trước/sau, phương thức, thời điểm, correlation/idempotency key và event type. `pg_notify('booking_stay_changed', ...)` phát sau commit; audit row là bản ghi bền cho consumer tương lai. Retry cùng key trả kết quả cũ, key khác sau khi chuyển trạng thái bị từ chối. Không gọi mạng khi transaction còn mở.

## Chính sách giờ

Repo hiện chưa có timezone riêng theo khách sạn. Theo quy tắc dự án, dùng `Asia/Ho_Chi_Minh`, không dùng ngày từ thiết bị. Giờ nhận/trả phòng được snapshot khi tạo booking; migration backfill giờ trả phòng cho booking cũ từ cấu hình khách sạn hiện tại. Nếu booking cũ không có snapshot, server đọc giờ khách sạn hiện tại; nếu vẫn thiếu hoặc sai định dạng thì chặn thao tác.

Chưa có policy và quyền riêng cho ngoại lệ sớm/trễ. Vì thế check-in chỉ hợp lệ từ giờ nhận phòng đến hết **đúng ngày nhận**, check-out chỉ hợp lệ trong **đúng ngày trả** và không sau giờ trả. Không có nút bypass phía client. Thời gian thực tế lưu ở `actualCheckInAt` và `actualCheckOutAt`, khác ngày dự kiến.

## Migration và kiểm tra

Chạy từ `DACN2`:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
npm.cmd run dev:mobile
```

Migration `20261118120000_st_own_12_stay_transitions` thêm snapshot checkout, actual timestamps, actor ID và bảng audit/event. Test DB cần seed hiện có và cờ `RUN_DB_STAY_E2E=1`:

```powershell
$env:RUN_DB_STAY_E2E='1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand owner-stay-db.e2e-spec.ts
```

Kiểm thử thủ công: đăng nhập Owner có booking `CONFIRMED` nhận **hôm nay**, mở Đặt phòng → Chi tiết → Quét mã / nhận phòng → quét QR hoặc nhập mã → Xem booking → đối chiếu và đánh dấu xác nhận → Xác nhận nhận phòng. Booking phải chuyển sang `CHECKED_IN`, hiển thị giờ thực tế. Với booking đã nhận có ngày trả **hôm nay**, mở Xác nhận trả phòng; sau khi hoàn tất, User thấy `COMPLETED` ở booking tương ứng.

## Phụ thuộc còn thiếu

`ReviewsModule` hiện là module rỗng; trạng thái `COMPLETED` đã sẵn cho REV-01 nhưng chưa có API tạo verified-stay review. Dự án cũng chưa có consumer notification/loyalty cho sự kiện `BOOKING_COMPLETED`; ST-OWN-12 ghi audit bền và phát tín hiệu PostgreSQL để tích hợp sau, không tự cộng điểm hay gửi thông báo giả.

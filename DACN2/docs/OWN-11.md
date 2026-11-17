# ST-OWN-11 · Quản lý booking của khách sạn

## Chạy và kiểm tra

Chạy từ `DACN2` sau khi cấu hình PostgreSQL và `.env`:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run owner-bookings:verify --workspace @booking-travel/api
npm.cmd run dev:api
```

Mở terminal khác tại `DACN2` và chạy `npm.cmd run dev:mobile`. Đăng nhập bằng tài khoản **Chủ khách sạn** đã xác minh, chọn chế độ Owner, mở tab **Đặt phòng**. Có thể đi từ Dashboard qua **Quản lý booking**, hoặc từ **Chỗ ở của tôi** vào đúng khách sạn rồi chọn **Quản lý booking**. Chạm card để xem chi tiết, chỉnh ghi chú nội bộ rồi kéo xuống để làm mới.

## API

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET | `/api/owner/bookings` | Danh sách nhiều khách sạn, tìm kiếm, lọc, phân trang |
| GET | `/api/owner/bookings/:id` | Chi tiết, snapshot giá/phòng, khách lưu trú và thanh toán |
| PATCH | `/api/owner/bookings/:id/internal-note` | Lưu `{ "note": "..." }`, tối đa 1000 ký tự; chuỗi rỗng xóa ghi chú |

Tất cả route yêu cầu token `HOTEL_OWNER` đang hoạt động. Truy vấn luôn giới hạn theo `Booking.hotel.ownerId = user.id`; `hotelId` và `bookingId` của Owner khác trả 404. List chỉ có dữ liệu card; contact, yêu cầu đặc biệt và ghi chú nội bộ chỉ nằm ở detail. API booking chung không trả ghi chú nội bộ cho khách. Chỉ trường `note` được nhận ở mutation; field khác bị global `ValidationPipe` từ chối. Lần sửa ghi `ownerNoteUpdatedAt`, `ownerNoteUpdatedBy` và audit metadata, không ghi nội dung note vào audit.

`tab=new` đếm booking tạo **trong ngày hiện tại theo giờ Việt Nam**, gồm mọi trạng thái; badge vẫn phân biệt booking chờ thanh toán. `upcoming` chỉ gồm `CONFIRMED` có ngày nhận phòng từ hôm nay; `checked-in` là `CHECKED_IN`, `completed` là `COMPLETED`, `cancelled` gồm hủy, hết hạn và hoàn tiền. `status` lọc enum cụ thể. `checkInFrom`/`checkInTo` lọc **ngày nhận phòng** bao gồm hai đầu, định dạng `YYYY-MM-DD`; ngày trả phòng không nằm trong bộ lọc này. `search` tìm mã, tên hoặc email khách trong phạm vi Owner. `limit` tối đa 50; phân trang bằng `nextCursor` trả từ trang trước và gửi lại dưới tên `after`. Sắp xếp theo `createdAt DESC, id DESC`, tránh lặp/bỏ sót khi có booking mới trong lúc xem thêm.

Trạng thái booking lấy từ PostgreSQL. Thanh toán online chỉ hiển thị đã trả khi có Payment `SUCCESS`/`PAID` từ backend; giao dịch lỗi cũ không lấn át giao dịch thành công. `PAY_AT_HOTEL` hiển thị phải thu tại khách sạn nếu chưa có Payment thành công. Hoàn tiền chờ và đã hoàn hiển thị theo trạng thái booking riêng. `allowedActions.canCheckIn/canCheckOut` hiện là `false`: quy trình xác minh QR/mã của OWN-12 chưa có, nên UI không chuyển trạng thái giả. Endpoint tổng quát `PATCH /api/bookings/:id/status` chỉ còn cho Admin có quyền `BOOKING_SUPPORT`.

Kiểm tra tự động:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test --workspace @booking-travel/api -- --runInBand
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand authorization.e2e-spec.ts app.e2e-spec.ts
```

Lệnh `owner-bookings:verify` đọc dữ liệu PostgreSQL thật, yêu cầu ít nhất hai Owner có booking và một Owner có từ hai khách sạn. Lệnh kiểm tra tổng số booking, từng bộ lọc khách sạn, detail hợp lệ và từ chối ID Owner khác; không thay đổi dữ liệu. Test unit kiểm tra cả note cross-owner, body ngoài whitelist, status/payment và ngày lọc.

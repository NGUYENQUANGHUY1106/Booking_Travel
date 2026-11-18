# ST-ADM-06 — Giám sát booking

Trang Admin **Đặt phòng** (`/admin/bookings`) và **Chi tiết đặt phòng** (`/admin/detail/bookings?id=<bookingId>`) đọc dữ liệu thật. Đăng nhập Admin có quyền `BOOKING_SUPPORT`, chạy API và Expo, rồi mở mục **Đặt phòng**. Không có thao tác đổi trạng thái hoặc sửa tiền từ màn hình này.

## API

- `GET /api/admin/bookings`: yêu cầu JWT Admin + `BOOKING_SUPPORT`. Hỗ trợ `search` (booking code hoặc ID), `status`, `hotelId`, `userId`, `dateField` (`createdAt`, `checkIn`, `checkOut`), `from`, `to` (`YYYY-MM-DD`), `paymentStatus`, `refundStatus`, `sort` (`newest`, `oldest`), `page` và `limit` tối đa 50. Kết quả `{ items, total, page, limit }`, sắp xếp ổn định theo `createdAt` và `id`. Ngày tạo được lọc theo ngày Việt Nam; ngày nhận/trả dùng cột `DATE`. Email khách được che trên danh sách.
- `GET /api/admin/bookings/:id`: yêu cầu cùng quyền; booking không tồn tại trả 404. Trả snapshot khách sạn, phòng, giá và chính sách tại lúc đặt; liên kết hotel/owner/user hiện tại; các payment attempts, refund requests, tổng tiền thu trực tuyến và đã hoàn tính riêng; timeline theo bằng chứng có sẵn. Email và số điện thoại khách được che. Ghi audit `ADMIN_BOOKING_DETAIL_VIEW` với Admin ID và booking ID, không ghi response.

`PaymentStatus.PAID` là thu tại khách sạn, không được cộng vào `capturedOnlineAmount`. Giao dịch và hoàn tiền được truy vấn độc lập để tránh nhân đôi số dòng hoặc số tiền khi một booking có nhiều attempts/refunds. Danh sách không lọc theo owner/hotel đang được duyệt, nên booking lịch sử của khách sạn ẩn hoặc đình chỉ vẫn xuất hiện.

## Giới hạn dữ liệu lịch sử

Nhánh `develop` hiện không lưu riêng thời điểm tạo quote/hold, mốc xác nhận booking và thời điểm check-in/check-out thực tế. Trang chi tiết hiển thị `dataGaps` thay cho mốc tự suy đoán. Deadline được đánh dấu **dự kiến**, còn các mốc khác là **thực tế**. Timeline lấy từ booking, payment timestamps/callback receipts, refund events và reconciliation cases, giới hạn 100 payment attempts hoặc refund requests mỗi booking; `paymentCount` và `refundCount` vẫn là tổng thật. Khi ST-OWN-12 được hợp nhất vào `develop`, cần nối các trường actual check-in/out vào projection này.

## Kiểm tra

Tại `DACN2`:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run typecheck --workspace @booking-travel/api
npm.cmd run typecheck --workspace @booking-travel/mobile
npm.cmd run lint --workspace @booking-travel/api
npm.cmd run lint --workspace @booking-travel/mobile
npm.cmd run test --workspace @booking-travel/api -- --runInBand admin-bookings.service.spec.ts
```

Migration chỉ thêm chỉ mục cho bộ lọc và phân trang booking; không thay đổi dữ liệu hiện có.

# ST-BKG-12 — Inventory hold và hết hạn thanh toán

## Nhánh và mô hình

- Nhánh `feat/ST-BKG-12-inventory-hold-tu-giai-phong-khi-het-han`, base `develop` tại `6576032`.
- Hold dùng booking `PENDING_PAYMENT` có `paymentDeadline`, không có bảng hold trùng lặp. Mỗi đêm trong `[checkIn, checkOut)` tính một lần `roomCount`; `CONFIRMED` và `CHECKED_IN` tiếp tục chiếm phòng. Giá/quote không giữ phòng.
- Booking online được tạo sau khóa hotel rồi room, kiểm tra tồn mọi đêm trong transaction. TTL mặc định 900 giây, cấu hình `BOOKING_HOLD_TTL_SECONDS` (60–3600), hạn lấy từ DB clock. Payment Init không tạo/gia hạn deadline.
- `EXPIRED` không chiếm inventory; `SUCCESS` hợp lệ trước deadline chuyển `CONFIRMED`, không trả phòng. `SUCCESS` muộn đi vào đối soát đã có của ST-BKG-05, không xác nhận lại booking đã hết hạn.

## Worker và API/UI

- Worker quét khi khởi động và mỗi 30 giây, tối đa 100 booking/lượt, `FOR UPDATE SKIP LOCKED`, so sánh `statement_timestamp()` trong DB, đọc Payment SUCCESS trước khi đổi trạng thái. `statement_timestamp()` được đọc sau khi chờ khóa nên không dùng giờ transaction đã cũ. Lỗi batch được log và lần quét sau thử lại. Index `(status, paymentDeadline, id)` hỗ trợ truy vấn.
- Payment status trả `holdExpiresAt`, `serverNow`, `canRetryPayment`; app hiển thị đếm ngược trên màn xử lý dựa trên giờ server. Khi hết hạn, app tiếp tục hỏi API; màn chi tiết booking có nút tải lại và thông báo hết hạn.
- Nếu Payment Init lỗi sau khi booking đã tạo, màn xác nhận cho thử lại trên cùng booking; khi mở lại app, chi tiết booking có thể khởi tạo thanh toán nếu chưa có attempt. API quyết định hold còn hiệu lực, retry không tạo booking hoặc deadline mới.
- Figma PAY-UI-02 (`4:1151`) được đối chiếu cho cấu trúc card/trạng thái; Figma không cung cấp deadline thật.

## Kiểm chứng

- `npm.cmd run prisma:migrate`: áp dụng `20261116000000_booking_hold_expiry_index` trên PostgreSQL local.
- API/mobile `typecheck`, API/mobile `lint`: qua; mobile `test:traveler` 25/25 qua.
- Unit booking/inventory/payment: 24/24 qua.
- PostgreSQL e2e inventory, webhook, payment: 19/19 qua. Có ca hai booking tranh phòng, hai worker cùng expire, webhook SUCCESS muộn và SUCCESS hợp lệ trước deadline.

## Phần cần kiểm tra tiếp

- Chưa đo độ trễ worker nhiều instance dưới tải lớn hoặc kiểm thử E2E qua cổng thanh toán thật; simulator chỉ kiểm tra webhook có chữ ký. Chưa có visual QA native của countdown.
- Booking `PENDING_PAYMENT` cũ không có `paymentDeadline` vẫn được tính như hold để tránh tự giải phóng dữ liệu cũ. Cần rà soát và xử lý thủ công các booking cũ đó theo policy, không tự gán hạn quá khứ.
- Hiện dùng booking-derived hold; hủy booking đã xác nhận thuộc BKG-08 và cần được kiểm tra riêng khi triển khai hoàn chỉnh chính sách hoàn tiền.

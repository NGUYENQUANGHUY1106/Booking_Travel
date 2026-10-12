# Mobile business logic

Áp dụng [quy tắc chung](../../AGENT.md), đặc biệt mục 7 và 11; đối chiếu SRS cùng frame Figma trước khi thay đổi màn hình.

- Tách luồng Auth, User và Hotel Owner theo quyền hợp lệ; không cho UI tự cấp quyền Owner/Admin.
- Giữ ngữ cảnh tìm kiếm (điểm đến, ngày, khách, phòng, bộ lọc) khi đi qua Search → Hotel → Room → Booking.
- Dùng server state cho dữ liệu API; local state chỉ giữ lựa chọn và bản nháp giao diện phù hợp.
- Nếu task chỉ làm frontend, dữ liệu mẫu phải có trạng thái loading/empty/error và được ghi rõ là mock.
- Giá, availability, trạng thái booking/payment từ giao diện chỉ là bản xem trước cho đến khi server xác nhận.
- UI mặc định tiếng Việt; tôn trọng thiết lập ngôn ngữ và tiền tệ khi được triển khai.

Giao diện Chủ khách sạn hiện có trong `src/app/hotel-owner/` và `src/features/hotel-owner/`; kiểm tra mức kết nối API thực tế trước khi báo một chức năng hoàn thành.

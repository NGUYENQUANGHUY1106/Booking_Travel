# Backend business logic

Nguồn nghiệp vụ: SRS và đặc tả chức năng trong thư mục gốc dự án; xem thêm [hướng dẫn chung](../../AGENT.md). Tài liệu này chỉ ghi các bất biến cần đối chiếu khi triển khai.

- Booking Travel phục vụ đặt phòng/chỗ ở với ba role: `USER`, `HOTEL_OWNER`, `ADMIN`.
- Server quyết định role, ownership, availability, giá cuối cùng và trạng thái booking/payment/refund.
- Một booking cần kiểm tra khả dụng cho mọi đêm trong khoảng `[checkIn, checkOut)` và xử lý giao dịch/khóa tồn kho phù hợp.
- Payment webhook cần xác thực chữ ký, số tiền, tiền tệ và mã tham chiếu; xử lý lặp phải an toàn.
- Dữ liệu xác minh chủ khách sạn là riêng tư. Kết quả tìm kiếm và AI chỉ sử dụng khách sạn/phòng có trạng thái hiển thị hợp lệ.

Không coi các gạch đầu dòng này là API contract; xác nhận endpoint và trạng thái cụ thể trong SRS, schema và code trước khi sửa.

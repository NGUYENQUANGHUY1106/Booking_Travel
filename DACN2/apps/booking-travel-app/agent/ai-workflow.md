# Mobile AI workflow

Áp dụng [mục AI/RAG của hướng dẫn chung](../../AGENT.md) khi task liên quan tới AI.

1. Xác định frame Figma, dữ liệu đầu vào và trạng thái loading/empty/error của luồng AI.
2. Gửi yêu cầu qua service có kiểu dữ liệu rõ ràng; phân biệt mock response với response từ backend.
3. Hiển thị nguồn và giới hạn của gợi ý khi có; không trình bày giá hoặc phòng còn trống do AI suy luận như dữ liệu đã xác nhận.
4. Giá do AI đề xuất cần thao tác xác nhận của Owner trước khi áp dụng; cờ rủi ro không tự tạo hành động Admin.
5. Cung cấp trạng thái lỗi và đường thao tác thường khi AI không khả dụng.

Không đưa dữ liệu riêng tư của Owner/Admin vào ngữ cảnh AI trên client nếu task và quyền truy cập không cho phép.

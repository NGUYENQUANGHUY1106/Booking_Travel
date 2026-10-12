# Backend AI workflow

Áp dụng [mục AI/RAG của hướng dẫn chung](../../AGENT.md) và chỉ triển khai khi task yêu cầu.

1. Xác định use case, quyền truy cập dữ liệu và tiêu chí chấp nhận trong SRS/task.
2. Kiểm tra dữ liệu nguồn có thật, trạng thái hiển thị và phiên bản trước khi index hoặc trả kết quả.
3. Chuẩn hóa intent qua schema/allow-list; không chạy raw SQL hoặc thao tác ghi trực tiếp từ văn bản người dùng.
4. AI về giá chỉ đề xuất để Owner xác nhận; AI fraud chỉ gắn cờ để Admin xử lý theo workflow.
5. Có đường xử lý khi dịch vụ AI không khả dụng; booking và payment vẫn dùng logic xác định của server.

Không index secret, giấy tờ xác minh Owner hoặc dữ liệu cá nhân không cần thiết.

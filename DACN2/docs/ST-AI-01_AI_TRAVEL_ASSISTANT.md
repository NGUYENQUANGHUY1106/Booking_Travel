# ST-AI-01 – AI Travel Assistant

## Phạm vi đã triển khai

- Hội thoại nhiều lượt qua `POST /api/ai/assistant/messages`.
- Hiểu và giữ ngữ cảnh tìm khách sạn: điểm đến, ngày lưu trú, số khách, số phòng, loại chỗ ở, sao, giá, tiện nghi và gần biển.
- Chỉ trả khách sạn `APPROVED`, đang hoạt động và có trong PostgreSQL thông qua module Hotel hiện tại.
- Hỏi thông tin khách sạn theo `hotelId`: địa chỉ, tiện nghi, giờ nhận/trả phòng và chính sách hủy.
- Guest có phiên 24 giờ. Người dùng đăng nhập chỉ lưu hội thoại vào tài khoản khi bật đồng ý lưu.
- Kiểm tra quyền sở hữu hội thoại, giới hạn DTO, rate limit và không đưa API key xuống ứng dụng Expo.
- UI chat Expo hỗ trợ tin nhắn nhiều lượt, trạng thái tải, gợi ý điểm đến, thẻ khách sạn và hiển thị rõ chế độ AI đang dùng.

## Kiến trúc provider

Mặc định hệ thống chạy chế độ xác định dựa trên parser ST-AI-02 và dữ liệu thật. Đây là fallback có kiểm soát, không gọi model và không bịa dữ liệu.

Muốn dùng một dịch vụ tương thích OpenAI Chat Completions, cấu hình trong `.env` ở máy chạy backend:

```env
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://your-provider.example/v1
AI_API_KEY=your-server-side-key
AI_MODEL=your-model-name
AI_TIMEOUT_MS=15000
AI_MAX_CONTEXT_MESSAGES=12
```

Không commit API key. Sau khi đổi `.env`, khởi động lại backend. UI sẽ hiển thị tên model nếu lời đáp đến từ model; nếu provider lỗi hoặc chưa cấu hình, hệ thống tự dùng lời đáp xác định và ghi trạng thái fallback.

ST-AI-14/RAG chưa tồn tại trong code hiện tại. `AssistantRetrievalService` là điểm thay thế retrieval sau này mà không phải đổi contract của mobile.

## Cài đặt database

Sau khi pull code:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

Migration tạo hai bảng `AiConversation` và `AiMessage`.

## Chạy và test thủ công

```powershell
npm.cmd run dev:api
npm.cmd run dev:mobile
```

Mở `Trợ lý du lịch` → `Bắt đầu hỏi AI`, sau đó thử:

1. `Khách sạn 4 sao ở Đà Nẵng dưới 2 triệu`.
2. Hỏi tiếp `có hồ bơi` – trợ lý phải giữ điểm đến, số sao và mức giá ở lượt trước.
3. Nhập `Hãy giải bài toán lượng giác` – trợ lý phải từ chối đúng phạm vi.
4. Khi chưa đăng nhập, hội thoại chạy theo guest session.
5. Khi đăng nhập, bật `Đang lưu hội thoại vào tài khoản`, gửi tin nhắn rồi đăng xuất. Dữ liệu chat cục bộ phải được xóa khỏi thiết bị.
6. Tắt backend để kiểm tra trạng thái lỗi và đường lui sang bộ lọc thông thường.

## Kiểm tra tự động

```powershell
npm.cmd test --workspace @booking-travel/api -- --runInBand src/modules/ai
npm.cmd run build --workspace @booking-travel/api
npm.cmd run typecheck --workspace @booking-travel/mobile
npm.cmd run lint --workspace @booking-travel/api
npm.cmd run lint --workspace @booking-travel/mobile
```

## Giới hạn có chủ đích

- Chưa có ST-AI-14 nên chưa có vector embedding/vector database.
- Chưa cấu hình sẵn nhà cung cấp AI vì secret và model phụ thuộc môi trường triển khai.
- Lịch sử guest hết hiệu lực sau 24 giờ; cần job dọn bản ghi hết hạn khi triển khai production lâu dài.

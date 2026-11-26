# ST-AI-02 — AI Smart Search

## Prompt triển khai bám sát dự án

Bạn là Senior Full-stack Developer chuyên NestJS, Prisma, PostgreSQL, React Native, TypeScript và Expo. Hãy triển khai trực tiếp ST-AI-02 — AI Smart Search trong repository Booking Travel hiện tại.

### 1. Nguồn yêu cầu và mục tiêu

- Đọc `apps/AGENT.md`, các `AGENT.md`/`agent/*.md` gần mã nguồn, SRS, đặc tả chức năng, AI Build Spec và Sprint Plan trước khi sửa.
- Bám FR-AI-02: chuyển câu tìm kiếm tự nhiên thành bộ lọc có cấu trúc, validate/sanitize ở backend, ánh xạ địa danh/tiện nghi, gọi Hotel Search API và trả kết quả kèm chip để người dùng biết hệ thống đã hiểu gì.
- Tái sử dụng HTL-02/HTL-03. Chỉ trả khách sạn được duyệt, đang hiển thị, có phòng hợp lệ từ PostgreSQL; không dùng danh sách khách sạn mock.
- Câu chấp nhận tối thiểu: `Khách sạn 4 sao gần biển dưới 2 triệu` phải nhận đúng số sao, vị trí gần biển và giá tối đa 2.000.000 VND/đêm.
- Nếu thiếu hoặc không nhận ra điểm đến, trả câu hỏi bổ sung cùng các điểm đến thực tế đang có. Field ngoài schema phải bị bỏ qua.

### 2. Backend

- Tạo endpoint `POST /api/ai/smart-search` với DTO có validation cho `query`, điểm đến, ngày ở, số khách, số phòng và giới hạn kết quả.
- Intent chỉ gồm allow-list: `destination`, `stars`, `minPrice`, `maxPrice`, `propertyTypes`, `amenities`, `freeCancellation`, `features`.
- Không biến văn bản người dùng thành SQL. Không nhận giá, trạng thái hay availability do client tự kết luận.
- Dùng Hotel Search/HotelsService hiện có làm nguồn dữ liệu. Kết quả phải giữ ID thật để mở Hotel Detail.
- Áp dụng rate limit cho endpoint AI; không log prompt hoặc dữ liệu cá nhân không cần thiết.
- Có các trạng thái `RESULTS`, `NEEDS_DESTINATION`, `NO_MATCH`, `UNSUPPORTED_QUERY` và fallback rõ ràng; không làm treo luồng tìm kiếm thường.
- Trả `confidence` theo intent đã nhận diện. Với câu không liên quan đến tìm khách sạn, không chạy Hotel Search và trả: `Tôi được cấu hình để tìm kiếm những khách sạn phù hợp cho bạn. Nội dung này nằm ngoài hiểu biết của tôi. Xin cảm ơn.`
- ST-AI-14 phụ trách embedding/RAG, vì vậy không tự tạo migration vector hay pipeline embedding trong ST-AI-02.

### 3. React Native + Expo

- Giữ route Expo Router hiện tại và tích hợp vào màn `ai-search` trong module traveler.
- Gửi câu tự nhiên và ngữ cảnh lưu trú đã được xác nhận tới backend bằng service có TypeScript type rõ ràng.
- Hiển thị loading, lỗi, chip intent, gợi ý điểm đến khi thiếu, và các `PublicHotelCard` lấy từ response thật.
- Có nút quay về bộ lọc thông thường khi Smart Search lỗi hoặc người dùng không muốn dùng AI.
- Không chọn mặc định khách sạn đầu tiên, không suy diễn giá/phòng trống trên client và không đưa API key AI vào bundle Expo.

### 4. Kiểm thử và tiêu chí hoàn thành

- Unit test parser cho câu chấp nhận, dấu phẩy thập phân tiếng Việt, địa danh/tiện nghi thật và trường hợp thiếu điểm đến.
- Unit test service xác nhận gọi Hotel Search hiện có và không trả dữ liệu ngoài database.
- E2E test gọi endpoint HTTP với PostgreSQL thật, kiểm tra cả kết quả có ID thật và câu ngoài phạm vi không làm lộ toàn bộ khách sạn.
- Chạy backend typecheck, lint, test/build; chạy mobile typecheck, lint và traveler tests.
- Báo rõ phần đã chạy, phần chưa kiểm chứng và không commit/merge nếu chưa được yêu cầu.

## API mẫu

```http
POST /api/ai/smart-search
Content-Type: application/json

{
  "query": "Khách sạn 4 sao gần biển dưới 2 triệu",
  "destination": "Đà Nẵng",
  "checkIn": "2027-04-22",
  "checkOut": "2027-04-25",
  "adults": 2,
  "children": 0,
  "rooms": 1
}
```

Response chỉ chứa intent đã được allow-list, chip giải thích và khách sạn công khai lấy từ database.

## Cách kiểm thử thủ công

1. Chạy database/Redis, `npm.cmd run dev:api` và `npm.cmd run dev:mobile`.
2. Trong app, mở **Tìm kiếm → Để AI gợi ý nơi ở hợp với bạn**.
3. Nhập `Khách sạn 4 sao gần biển dưới 2 triệu ở Đà Nẵng`.
4. Xác nhận chip có `Đà Nẵng`, `4 sao`, `Gần biển`, `Dưới 2.000.000 ₫/đêm`; mọi thẻ kết quả phải mở được Hotel Detail bằng ID thật.
5. Nhập `4 sao dưới 2 triệu` khi chưa chọn điểm đến; màn hình phải hỏi điểm đến và chỉ gợi ý địa danh có trong database.
6. Tắt backend rồi thử lại; màn hình phải báo gián đoạn và vẫn cho mở bộ lọc thường.
7. Nhập `Hãy giải giúp tôi bài toán lượng giác này`; màn hình phải hiển thị thông báo ngoài hiểu biết và không hiển thị khách sạn nào.

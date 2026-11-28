# Kiểm thử SCRUM-99 · Tóm tắt và phân tích cảm xúc đánh giá

## Chuẩn bị

Dùng Node.js 22+, PostgreSQL đã có các extension theo dự án và một project Google AI Studio có quota cho Gemini. Chạy các lệnh từ thư mục `DACN2`. Giữ khóa trong `.env` riêng của mỗi máy.

```dotenv
GEMINI_REVIEW_ENABLED=true
GEMINI_API_KEY=<khóa của Google AI Studio>
GEMINI_REVIEW_MODEL=gemini-3.1-flash-lite
```

Chỉ bật `GEMINI_REVIEW_ENABLED` trên môi trường có quyền gửi nội dung đánh giá công khai sang Gemini. Khi kiểm thử, dùng cơ sở dữ liệu và đánh giá tổng hợp. Backend ẩn những mẫu email, số điện thoại và liên kết thường gặp. Nội dung chữ tự do vẫn có thể chứa thông tin nhận dạng cá nhân.

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
```

Mở terminal riêng và chạy `npm.cmd run dev:mobile`. Nhấn `w` để mở web hoặc quét mã QR bằng Expo Go trên điện thoại.

## Dữ liệu và kiểm thử giao diện

1. Dùng khách sạn công khai trên DB dev và ba booking ở trạng thái **Hoàn thành**. Đăng nhập bằng tài khoản khách tạo từng booking. Mỗi booking cho phép một đánh giá.
2. Gửi ba nhận xét mẫu, có thể chọn cùng điểm sao để kiểm tra AI phân tích nội dung.
   - `Phòng rất sạch, nhân viên thân thiện! 😍`
   - `The room was dirty and the staff were rude.`
   - `Khách sạn cách ga khoảng 200 mét.`
3. Vào chi tiết khách sạn → **Đánh giá** → **Xem tóm tắt**. Màn hình tải xong hiển thị ba nhóm cảm xúc, số lượng, tỷ lệ và các chủ đề được khen hoặc cần cải thiện. Ba nhóm mỗi nhóm một bài sẽ hiển thị 33,3% do làm tròn.
4. Bấm **Cập nhật tóm tắt**. Khi tập nhận xét chưa đổi, API trả lại cùng phiên bản và thời gian tạo.
5. Chủ khách sạn mở **Đánh giá và phản hồi**, chọn khách sạn tương ứng. Admin có quyền kiểm duyệt mở **Đánh giá & báo cáo**, bấm **Mở tóm tắt khách sạn** ở một mục đánh giá.
6. Admin ẩn một trong ba đánh giá, rồi yêu cầu cập nhật. Kết quả cho biết cần ít nhất ba nhận xét. Khách sạn ẩn hoặc chưa duyệt trả 404 cho người truy cập không có quyền.
7. Với khách sạn mới có đủ nhận xét và chưa có bản lưu, tắt `GEMINI_REVIEW_ENABLED` rồi khởi động lại API. Tóm tắt báo tạm thời chưa tải được, màn hình vẫn giữ phần đánh giá gốc.

## API

```powershell
Invoke-RestMethod 'http://localhost:3000/api/ai/hotels/<hotelId>/review-summary'
```

Thay cổng theo `API_PORT`. Endpoint công khai cho khách sạn đã duyệt đang hiển thị. Với khách sạn chưa công khai, gửi header `Authorization: Bearer <access-token>` của chủ khách sạn đủ quyền hoặc admin có quyền `HOTEL_REVIEW`.

```json
{
  "status": "INSUFFICIENT",
  "stats": { "count": 2, "average": 8, "sampleCount": 2 }
}
```

`READY` trả thêm `summary.sentiment`, `summary.topics`, `version`, `generatedAt` và `model`. `UNAVAILABLE` trả thống kê điểm sao khi nhà cung cấp lỗi, quá thời gian hoặc tạm thời không nhận thêm yêu cầu. Bảng PostgreSQL `AIReviewSummary` lưu kết quả theo khách sạn và phiên bản tập nhận xét. Mỗi lần phân tích lấy tối đa 16 nhận xét công khai gần nhất có nội dung.

## Kiểm thử tự động

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test --workspace @booking-travel/api -- --runInBand
npm.cmd run build
```

Để chạy bài kiểm thử gọi Gemini thật, trỏ `DATABASE_URL` đến DB kiểm thử đã migrate, thiết lập khóa và chạy:

```powershell
$env:GEMINI_REVIEW_ENABLED = 'true'
$env:RUN_GEMINI_REVIEW_E2E = '1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand review-summary.e2e-spec.ts
```

Test tạo và xóa dữ liệu riêng. Chỉ các nhận xét tổng hợp trong bài test được gửi qua Gemini.

## Kết quả kiểm tra

- Gemini thật phân loại đúng sáu mẫu tiếng Việt, tiếng Anh, emoji và câu có cảm xúc trái chiều trong lượt chạy đã kiểm tra.
- E2E HTTP và PostgreSQL đạt một kịch bản, gồm lưu tóm tắt, đọc lại, lọc nhận xét rỗng, ẩn hoặc đã xóa, và kiểm tra quyền truy cập.
- Bài E2E dùng PostgreSQL riêng trên Windows. Bản Postgres này thiếu `pgvector`; migration embedding đã được đánh dấu riêng trong DB thử nghiệm để chạy các migration liên quan tới review. DB làm việc không bị chỉnh sửa bởi bài test.
- Export Expo cho web, iOS và Android thành công. Đã dùng Edge với phản hồi API mô phỏng để kiểm tra tải, thành công, thiếu nhận xét, lỗi ở 1280×800 và 375×667. Chưa kiểm tra trên điện thoại thật.
- Lint, TypeScript và build API đạt. Suite backend chạy 353 test đạt, 10 test được bỏ qua theo cấu hình mặc định.

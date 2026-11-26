# ST-AI-02 — kiểm tra và sửa luồng Smart Search

Branch: `fix/ST-AI-02-ai-smart-search`, tạo từ `develop` sau merge PR #68. Giữ nguyên thay đổi sẵn có ở `DACN2/README.md` và thư mục chưa theo dõi.

| Vấn đề kiểm tra | Nguyên nhân | Sửa | Bằng chứng |
| --- | --- | --- | --- |
| Người dùng không thấy lối vào AI từ Home | Home chỉ có tìm kiếm thường; AI nằm trong tab Tìm kiếm | Thêm thẻ AI, nút và prompt gợi ý ở Home, mở màn `ai-search` với văn bản đã nhập | Mobile typecheck |
| Ngân sách cả kỳ ở dễ bị nhầm với giá mỗi đêm | Intent chỉ có `maxPrice` theo đêm | Thêm `maxTotalBudget`, yêu cầu ngày ở và lọc bằng `stayPriceFrom` của Hotel Search | Unit test + HTTP local |
| “3 ngày” bị hiểu là 3 đêm hoặc tự tính phòng trống | Không có trường riêng cho thời lượng chuyến đi | Giữ `tripDays` riêng, chỉ so số đêm khi người dùng nói rõ “đêm”; yêu cầu chọn ngày | Unit test |
| Câu “2 người, 2 phòng” không cập nhật tìm kiếm | Bộ lọc chỉ đọc giá trị mặc định từ app | Parser nhận số khách/phòng trong giới hạn DTO, gửi vào Hotel Search và đồng bộ về trạng thái User | Unit test + typecheck |
| Người dùng khó quay về AI sau khi chọn ngày | Date picker luôn đi tới bước số khách | Date picker nhận `returnTo=ai-search` và khôi phục câu hỏi | Mobile typecheck |
| Màn AI có thể chờ API quá lâu | Client timeout chung 15 giây | Giới hạn request trợ lý 8 giây và giữ nút dùng bộ lọc thường | Mobile typecheck |

Luồng hiện tại: Home/Tab Tìm kiếm → `ai-search` → `POST /api/ai/assistant/messages` → parser ST-AI-02 → `HotelsService.list/search` → thẻ khách sạn với ID thật → Hotel Detail. Câu hỏi tổng ngân sách hoặc thời lượng mà chưa có ngày dẫn tới chọn ngày. Giá cả kỳ ở chỉ lấy từ `stayPriceFrom` của Hotel Search theo ngày và số phòng; giá chưa có ngày chỉ là giá tham khảo. Booking Quote vẫn kiểm tra lại giá và phòng.

Kiểm chứng local: `npm.cmd run test --workspace @booking-travel/api -- --runInBand smart-search assistant.service` PASS 16 test; API và mobile typecheck PASS; API lint PASS. HTTP local `POST /api/ai/smart-search` với câu “Khách sạn 4 sao ở Đà Nẵng gần biển dưới 2 triệu một đêm” trả `RESULTS`, 1 hotel từ PostgreSQL; câu “Đà Nẵng 2 triệu tổng cộng cho 3 đêm” trả `NEEDS_DATES`, `maxTotalBudget=2000000`. Kiểm tra này không ghi dữ liệu vào DB.

Chưa xác minh: chất lượng model/provider thật và RAG vì local chưa có `AI_*` và embedding; đo p95 trên dataset lớn; luồng Expo trên thiết bị thật và E2E đặt phòng. Không đánh dấu các mục đó PASS. `db:setup` không tạo embedding.

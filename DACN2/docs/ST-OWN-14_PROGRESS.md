# ST-OWN-14 · Doanh thu và phân tích khách sạn

Nhánh: `feat/ST-OWN-14-doanh-thu-va-phan-tich-khach-san`, tạo từ `develop` ngày 25/11/2026. Không merge. Quy tắc tính và OPEN-QUESTION ở [analytics-metrics.md](./analytics-metrics.md).

## API và dữ liệu

`GET /api/owner/analytics?dateFrom=2026-11-01&dateTo=2026-11-03&timeZone=Asia/Ho_Chi_Minh&granularity=DAY&hotelId=<id>&roomId=<id>`; `hotelId` và `roomId` tùy chọn. JWT phải là `HOTEL_OWNER` đang hoạt động; service xác minh khách sạn và phòng trước khi đọc giao dịch. Không chấp nhận khoảng hơn 366 ngày hoặc tiền tệ khác VND. Response gồm `version`, `scope`, `asOf`, `sourceFreshness`, `summary`, `points`, `rooms`, `roomOptions`, `rating`, `limitations`. Bucket kết thúc loại trừ (`bucketEndExclusive`). Cache-Control `private, no-store`.

Data flow: Booking snapshot/status + Payment.SUCCESS/PARTIALLY_REFUNDED/REFUNDED (`succeededAt`) + RefundRequest.COMPLETED (`completedAt`) + room/inventory hiện tại → truy vấn PostgreSQL theo Owner → API → React Query → Owner dashboard/Doanh thu/Phân tích. Không dùng booking chưa thanh toán để gọi là tiền đã thu. Không có bảng review nên điểm đánh giá trả `null`.

## Kiểm chứng local

Kết quả ngày 25/11/2026: backend/mobile typecheck **PASS (exit 0)**; backend/mobile lint **PASS (exit 0)**; backend build **PASS (exit 0)**; 4 unit + 1 PostgreSQL integration **PASS (exit 0)**; 6 bài test dashboard Owner hiện hữu **PASS (exit 0)**; Expo web export và iOS JS bundle export **PASS (exit 0)**. PostgreSQL thử nghiệm chạy trong container tách biệt `booking-travel-own14-test`, đã áp dụng 57 migration gồm index ST-OWN-14; fixture đã được xóa và container đã dừng. Các kết quả này không thay thế kiểm tra tương tác trên điện thoại thật hoặc bản cài EAS.

- `npm.cmd run typecheck -w @booking-travel/api` và `npm.cmd run typecheck -w @booking-travel/mobile`.
- `npm.cmd run lint -w @booking-travel/api` và `npm.cmd run lint -w @booking-travel/mobile`.
- `npm.cmd run test -w @booking-travel/api -- --runInBand owner-analytics.service.spec.ts`.
- Chỉ chạy integration trên DB thử nghiệm riêng đã migrate: đặt `ST_OWN14_TEST_DATABASE_URL` trỏ đến `127.0.0.1/<tên>_test`, rồi chạy `npm.cmd run test -w @booking-travel/api -- --runInBand owner-analytics.integration.spec.ts`. Test tự tạo và xóa fixture có tiền tố `own14_`.

Fixture đối chiếu ba ngày 01–03/11/2026: Owner A có khách sạn A1/A2, Owner B có B. A1 có 2 phòng, bị chặn 1 phòng ngày 02/11; A2 có 1 phòng. A có 2 booking online thanh toán thành công (2.000.000 ₫ + 1.500.000 ₫), 1 booking đang chờ thanh toán, 1 booking hủy, 1 booking trả tại khách sạn chưa có xác nhận thu, và 1 hoàn tiền hoàn tất 400.000 ₫ ngày 03/11. Kỳ vọng A: đã thu online 3.500.000 ₫, đã hoàn 400.000 ₫, thực thu 3.100.000 ₫, 4/8 đêm phòng = 50%, ADR 1.050.000 ₫, hủy 1/5 = 20%. Chart thực thu theo ngày: 2.000.000 ₫, 1.500.000 ₫, −400.000 ₫. B có 5.000.000 ₫ riêng; A yêu cầu hotelId của B hoặc roomId B với hotel A đều nhận 404.

## Nghiệm thu và giới hạn

| Hạng mục | Trạng thái |
| --- | --- |
| Công thức tiền/tồn/phòng, chống cộng lẫn pay-at-hotel và refund chưa hoàn tất | Đã triển khai; unit + PostgreSQL fixture kiểm tra |
| Owner RBAC/ownership hotel + room | Đã triển khai; integration kiểm tra 404 chéo Owner |
| Owner dashboard → Doanh thu → Phân tích; bộ lọc kỳ, khách sạn, phòng; loading/error/empty/retry | Đã nối API, typecheck/lint; cần kiểm tra thao tác thực tế trên Expo |
| Đánh giá/xu hướng rating | Chưa có nguồn review trong schema; API trả `null`, UI báo chưa có dữ liệu |
| Tồn phòng và tên phòng lịch sử bất biến | Chưa có snapshot lịch sử; tồn dùng trạng thái hiện tại. Xem OPEN-QUESTION |
| P95 ≤500 ms/100 concurrent, giao diện trên máy thật | Chưa đo với dữ liệu tải lớn hoặc thiết bị thật; không đánh dấu PASS |

Để test UI: chạy API và Expo, đăng nhập Chủ khách sạn, vào **Tổng quan → Doanh thu 7 ngày → Xem chi tiết**, chọn khách sạn/kỳ/ngày/hạng phòng, mở **Phân tích khách sạn**, so sánh số với Payment/RefundRequest đã xác nhận. Không dùng ảnh hoặc số liệu Figma làm dữ liệu thật.

React Query dùng key có userId/sessionId/hotelId/roomId/ngày/kỳ; các mutation đang gọi `invalidateOwnerDashboard` sẽ làm mới cả analytics cùng Owner. Truy vấn có `no-store` ở HTTP, DB là nguồn tiền duy nhất. Rollback code có thể revert commit ST-OWN-14; hai index mới không đổi dữ liệu, có thể giữ lại hoặc xóa bằng migration kế tiếp nếu cần. Không sửa migration đã phát hành và không xóa volume hay booking lịch sử.

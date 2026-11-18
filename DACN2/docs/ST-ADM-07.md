# ST-ADM-07 — Giám sát thanh toán và hoàn tiền

## Phạm vi đã nối

- Màn Admin **Thanh toán** (`/admin/payments`) có ba chế độ: giao dịch, yêu cầu hoàn, giao dịch cần tra soát. Danh sách lấy từ PostgreSQL, lọc theo từ khóa, cổng, trạng thái, ngày và phân trang 20 bản ghi. Ngày nhập theo giờ Việt Nam.
- Chọn giao dịch để xem booking, các payment attempts cùng booking, mã tham chiếu cổng, số đã hoàn/đang giữ/còn lại, biên nhận webhook thanh toán, yêu cầu hoàn, biên nhận hoàn liên kết, hồ sơ đối soát và lịch sử quyết định. Email khách được che bớt; không trả `payloadHash`, chữ ký hay raw webhook.
- Chọn yêu cầu hoàn để xem chính sách tại thời điểm đặt, giá trị thu và bằng chứng. Duyệt/từ chối cần lý do và xác nhận. Các lệnh gọi lại service ST-BKG-09, có khóa booking, kiểm tra lại trạng thái/số dư/chính sách và ghi `RefundEvent` trong cùng transaction. Trạng thái hoàn thành chỉ do callback mô phỏng có chữ ký hợp lệ cập nhật.
- Booking cũ thiếu quy tắc hoàn có cấu trúc giữ chờ xử lý chính sách thủ công; Admin không thể duyệt số tiền không xác minh. Không có lệnh sửa trực tiếp `Payment.status` hoặc đánh dấu `REFUNDED` từ UI.

## API

Tất cả route `/admin/payments` và `/admin/refunds` yêu cầu JWT với vai trò `ADMIN` và quyền `BOOKING_SUPPORT`.

| Route | Ý nghĩa |
| --- | --- |
| `GET /api/admin/payments` | `search`, `provider`, `status`, `scope=all\|reconciliation`, `from`, `to` (ISO 8601), `page`, `limit` (tối đa 100), `sort=newest\|oldest`; trả `{items,total,page,limit}`. |
| `GET /api/admin/payments/:id` | Chi tiết payment, attempts, biên nhận, hoàn tiền, đối soát và audit đã biên tập. |
| `GET /api/admin/refunds` | Cùng bộ lọc, thêm `type=all\|manual`; trả `{items,total,page,limit}`. |
| `GET /api/admin/refunds/:id` | Chi tiết yêu cầu hoàn và số dư. |
| `POST /api/admin/refunds/:id/decision` | `{decision:"APPROVE"\|"REJECT",reason}`; chỉ từ `PENDING_REVIEW`. |
| `POST /api/admin/refunds/:id/dispatch` | Chỉ từ `APPROVED`; đưa vào chờ callback mô phỏng, không ghi nhận thành công. |
| `POST /api/admin/refunds/:id/reopen` | `{reason}`; chỉ sau callback báo `FAILED`, giữ tham chiếu cũ. |

Trạng thái tài chính đọc từ enum hiện tại. `PaymentReconciliationCase` là ngoại lệ cần tra soát; hệ thống hiện chưa có entity và adapter xử lý dispute/chargeback. Webhook không gắn với payment do mã tham chiếu không xác định không thể hiển thị trong chi tiết của payment cụ thể; chúng vẫn được ghi ở bảng receipt để vận hành tra cứu DB.

## Cấu hình và chạy thử

Tại `DACN2`:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
npm.cmd run dev:mobile
```

Đăng nhập Admin có quyền `BOOKING_SUPPORT`, mở mục **Thanh toán**. Tạo booking và giao dịch mô phỏng theo `docs/ST-BKG-09.md`, rồi thử lọc, mở giao dịch, mở yêu cầu hoàn, duyệt hoặc từ chối có lý do, làm mới và kiểm tra nhật ký. Chỉ dùng `PAYMENT_SIMULATOR_ENABLED=true` với khóa mô phỏng ở môi trường phát triển. Chưa có adapter hoàn tiền production; thao tác `dispatch` không chuyển tiền thật.

Migration `20261118090000_st_adm_07_monitoring_indexes` chỉ thêm ba index cho payment, refund và hồ sơ tra soát; không đổi dữ liệu cũ. Không cần backfill. Rollback thủ công là `DROP INDEX` cho ba index đúng tên trong migration nếu thực sự cần.

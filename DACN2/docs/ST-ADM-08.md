# ST-ADM-08 — Báo cáo và kiểm duyệt đánh giá

## Luồng hiện có và phần đã nối

Trước task, `HotelReport` chỉ đọc được ở Admin, `ReviewReplyReport` lưu lý do tự do, còn các nút ẩn/hiện review gọi API đổi cờ trực tiếp. Admin không có queue chung, claim, quyết định kèm lý do hay audit của một report. Trang báo cáo review demo không gửi API.

Nay báo cáo khách sạn, review và phản hồi Owner xuất hiện trong một queue. Admin nhận xử lý rồi chọn biện pháp. Biện pháp ẩn/đình chỉ khách sạn gọi chính `AdminHotelManagementService`, gồm kiểm tra phiên bản, audit và tác vụ booking đang hoạt động. Đánh giá bị ẩn không còn ở API công khai và không còn trong phép tính rating; ẩn riêng phản hồi giữ nguyên rating. Khôi phục review/phản hồi cần lý do và ghi audit.

| Trước | Hành động | Sau | Tác động |
| --- | --- | --- | --- |
| OPEN | Nhận xử lý | IN_REVIEW | Ghi Admin, thời gian, audit; Admin khác không ghi đè. |
| IN_REVIEW | HIDE | RESOLVED | Ẩn review hoặc reply và ghi audit cùng transaction. |
| IN_REVIEW | HIDE_HOTEL / SUSPEND_HOTEL | RESOLVED | Gọi workflow ST-ADM-05 cùng transaction với việc đóng report. |
| IN_REVIEW | ALREADY_HANDLED | RESOLVED | Chỉ khi target thực sự đã ẩn; không ẩn lần hai. |
| IN_REVIEW | DISMISS | REJECTED | Không đổi target; lưu lý do và audit. |
| Review/reply đã ẩn | RESTORE | Giữ report cũ | Đưa nội dung công khai trở lại và ghi audit mới. |

API mới: `GET /api/admin/hotel-reports/queue`, `GET /queue/:kind/:id`, `POST /queue/:kind/:id/claim`, `POST /queue/:kind/:id/decision`, `POST /restore/:kind/:id` (cùng prefix `/api/admin/hotel-reports`). `kind` là `HOTEL`, `REVIEW`, `REPLY`. User gửi báo cáo review qua `POST /api/content-reports` với `targetType=REVIEW` và `targetId`; báo cáo khách sạn dùng `POST /api/hotel-reports` với `hotelId` và `bookingId` của kỳ lưu trú đã hoàn thành.

Admin queue hỗ trợ `status`, `targetType`, `reason`, `assigneeId`, `search`, `dateFrom`, `dateTo`, `page`, `limit`. Người gửi report không xem được queue/detail/decision. API cũ đổi visibility review trực tiếp đã được đóng, tránh bỏ qua lý do và audit.

Ảnh/tệp bằng chứng chưa có luồng upload riêng cho User. Backend từ chối URL bằng chứng tự nhập; người gửi mô tả bằng chứng bằng văn bản. Dữ liệu `evidenceUrls` cũ được giữ nguyên để đối soát, không xóa. Không nên coi URL cũ là tệp đã được xác minh.

## Kết quả kiểm chứng local

- Migration `20261127000400_report_review_moderation`, `20261127000500_report_resolution_time` và `20261127000600_hotel_report_reasons` đã áp trên PostgreSQL local.
- Kiểm thử trong transaction PostgreSQL thật, rồi rollback: review 8 điểm: count/average `1/8` → ẩn `0/null` → khôi phục `1/8`; hai action audit.
- Phản hồi Owner bị ẩn: review vẫn công khai và count/average giữ `1/7`; phản hồi không công khai. Transaction được rollback.
- Báo cáo khách sạn: HIDE làm report `RESOLVED`, khách sạn `isVisible=false`, ghi đúng một `HotelRestrictionAudit`; transaction được rollback.
- HTTP local: Admin queue trả 200; User gọi queue trả 403; hotelId không tồn tại trả 404.

## Kiểm tra thủ công

1. Trong `DACN2`, chạy `npm.cmd run prisma:generate`, `npm.cmd run prisma:migrate`, `npm.cmd run dev:api`, rồi terminal khác chạy `npm.cmd run dev:mobile`.
2. Đăng nhập User, mở một đặt phòng đã hoàn thành và chọn **Báo cáo khách sạn**. Gửi lý do và mô tả. Với review công khai, chọn **Báo cáo đánh giá** hoặc **Báo cáo phản hồi**.
3. Đăng nhập Admin, vào **Đánh giá & báo cáo** → **Quản lý báo cáo**. Lọc `Mới`, mở báo cáo, bấm **Nhận xử lý**, nhập lý do ít nhất 10 ký tự và chọn biện pháp.
4. Mở lại trang khách sạn trên User để kiểm tra visibility/rating; lọc queue `Đã xử lý` và mở chi tiết để xem audit. Với review hoặc reply đã ẩn, dùng **Khôi phục nội dung đã ẩn** nếu cần.

Chưa kiểm chứng bằng bản cài Android/iOS hoặc upload tệp bằng chứng. Kiểm thử đồng thời hai Admin ở mức transaction và kiểm tra trạng thái, chưa chạy tải song song qua HTTP trên staging.

# ST-OWN-06: Gửi khách sạn để Admin kiểm duyệt

## Quy tắc gửi duyệt

`GET /api/owner/hotels/:id/submission-readiness` trả hồ sơ thuộc Chủ đã xác minh, `profileVersion`, `completion`, `checklist`, `readyForReview`, `canSubmit` và `latestSubmission`. Cùng một hàm backend tính sáu nhóm bắt buộc cho preview và `POST /api/owner/hotels/:id/submit`: tên và loại chỗ ở; liên hệ và giờ nhận/trả; địa chỉ hành chính và tọa độ; ảnh bìa đã hoàn tất hoặc ảnh bìa kế thừa từ hồ sơ đăng ký Chủ; chính sách hủy hoặc nội quy; ít nhất một hạng phòng ACTIVE có số lượng dương. Tiện nghi và ảnh phòng là dữ liệu khuyến nghị trong contract hiện tại, không phải cổng chặn gửi duyệt. Ảnh đang RESERVED không được tính.

`POST /api/owner/hotels/:id/submit` nhận `{ "expectedVersion": number }`. Thiếu dữ liệu trả 400 với `code: HOTEL_SUBMISSION_INCOMPLETE`, `missing` và `checklist` gồm `code`, `label`, `targetStep`, `complete`, `reason`, `required`. Phiên bản/trạng thái sai trả 409. Gửi lặp cùng phiên bản khi đang PENDING trả lại hồ sơ hiện tại; không tạo request thứ hai. Transaction khóa hotel, kiểm tra lại dữ liệu đã lưu, chuyển sang PENDING, lưu `HotelSubmission` snapshot bất biến, audit và thông báo trong database. PENDING chỉ xem được ở kênh riêng của Chủ và Admin; API công khai vẫn yêu cầu APPROVED và `isVisible`.

## Admin

`GET /api/hotels/review/submissions` chỉ trả yêu cầu PENDING khớp phiên bản Hotel; `GET /api/hotels/review/submissions/:submissionId` trả snapshot kèm metadata ảnh. Cả hai và `POST /api/hotels/review/submissions/:submissionId/decision` yêu cầu ADMIN + `HOTEL_REVIEW`. Body quyết định: `{ "decision": "APPROVE" | "REJECT", "expectedVersion": number, "reason"?: string }`; REJECT cần lý do từ 3 đến 1000 ký tự. Version hoặc trạng thái không khớp trả 409, không có chuyển trạng thái. Quyết định lưu trạng thái submission, Hotel, audit và thông báo cho Chủ trong một transaction. REJECTED được sửa và gửi lại bằng submission mới; lịch sử cũ được giữ.

Thông báo hiện là bản ghi bền trong `HotelSubmissionNotification`; ứng dụng dùng trạng thái và `latestSubmission.reason` để hiển thị kết quả. Chưa có kênh email/SMS cho luồng này. Ảnh khách sạn ở màn duyệt dùng đường đọc ảnh hiện có và chỉ trả metadata, không tải binary vào queue.

## Migration và kiểm chứng

Migration `20261108000100_hotel_submission_moderation` thêm trạng thái/decision cho submission, bảng audit/notification và unique index một PENDING mỗi hotel. Migration `20261108000200_hotel_submission_audit_transition` ghi trạng thái trước/sau cho audit mới. Dữ liệu cũ được phân loại theo trạng thái Hotel và submission mới nhất. Không xóa hồ sơ cũ.

Chạy từ `DACN2`:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run lint
npm.cmd run typecheck
$env:RUN_DB_HOTEL_E2E='1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand owner-hotel-wizard-db.e2e-spec.ts
```

E2E cần PostgreSQL đã áp dụng migration, dữ liệu seed và danh mục hành chính Việt Nam (`npm.cmd run data:import:vn`). Test tạo và dọn dữ liệu của chính nó. Nếu database cục bộ có migration từ nhánh chưa gộp, dùng database kiểm thử riêng theo schema nhánh này để tránh lệch schema.

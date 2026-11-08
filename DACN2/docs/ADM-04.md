# ST-ADM-04 — Kiểm duyệt khách sạn

## Luồng dữ liệu

Chủ khách sạn đã xác minh hoàn thiện hồ sơ và gửi duyệt qua ST-OWN-06. Lần gửi tạo `HotelSubmission` có `version` và `snapshot` cố định, đưa Hotel về `PENDING`. Admin mở hàng chờ, kiểm tra snapshot và ảnh của bản nộp, rồi xác nhận duyệt hoặc từ chối. Quyết định ghi Hotel, Submission, Audit và Notification trong cùng transaction. Từ chối giữ lý do để Chủ sửa và gửi lại phiên bản mới.

PR này dùng nhánh ST-OWN-06 làm dependency vì phần tạo bản nộp chưa nằm trong `develop` tại thời điểm triển khai. PR #26 cần được merge trước PR ST-ADM-04 để tránh trùng diff; không merge tự động PR nào.

## API Admin

Các route dưới `/api/hotels/review/submissions` yêu cầu JWT/session và role `ADMIN` ở backend:

| Route | Ý nghĩa |
| --- | --- |
| `GET /` | Hàng chờ PENDING thực, lọc `search`, `types` (CSV HOTEL/RESORT/APARTMENT/VILLA/HOMESTAY/HOSTEL), `page`, `limit` (tối đa 50), `sort` (`newest`/`oldest`). Trả `{ items, total, page, limit }`. |
| `GET /:submissionId` | Snapshot/version, Owner summary, ảnh ký tạm thời và checklist của bản nộp đang PENDING. Trả 409 nếu đã xử lý hoặc version không còn hiện hành. |
| `POST /:submissionId/decision` | `{ decision: "APPROVE" | "REJECT", expectedVersion, reason?, requestId? }`. Reject bắt buộc reason; `requestId` cho phép retry cùng quyết định mà không sinh thêm Audit/Notification. Version/state xung đột trả 409. |

Ảnh Admin dùng URL ký hạn ngắn với quyền `moderation-read`; URL hết hiệu lực khi khách sạn rời trạng thái `PENDING`. API public và đặt phòng mới chỉ chấp nhận Hotel `APPROVED` và `isVisible=true`. Các booking hiện hữu không bị viết lại khi xét duyệt.

Migration `20261108000300_hotel_moderation_idempotency` thêm `HotelSubmissionAudit.requestId` nullable/unique. Chạy `npm.cmd run prisma:migrate` tại `DACN2` trước khi khởi động API mới. `npm.cmd run db:setup` cũng chạy migration nhưng đồng thời nạp seed; chỉ dùng khi muốn nạp seed.

## Kiểm tra

- `npm.cmd run typecheck`: qua cả Mobile và API.
- `npm.cmd run lint`: qua cả Mobile và API.
- `npm.cmd run build`: API build thành công.
- `npm.cmd exec --workspace @booking-travel/mobile -- expo export --platform web`: bundle web thành công.
- `npm.cmd run test --workspace @booking-travel/api -- --runInBand`: 28 suite, 120 test qua.
- DB E2E `owner-hotel-wizard-db.e2e-spec.ts`: 1 suite/1 test qua trên DB kiểm thử cô lập đã migrate. Kịch bản gồm gửi Resort, lọc/tìm queue, snapshot/ảnh, non-admin 403, reject/retry idempotent, Owner xem feedback/gửi lại, stale decision 409, hai Admin quyết định đồng thời chỉ một thắng, một Audit/Notification, public chỉ thấy Hotel được duyệt.

DB mặc định của máy phát triển có schema riêng đang lệch migration của branch, nên kiểm thử DB dùng `booking_travel_stown06_test`; không thay đổi dữ liệu DB mặc định. Chưa thực hiện kiểm tra trực quan trên điện thoại hoặc so sánh pixel tại viewport Figma; Expo web đã bundle nhưng chưa có ảnh chụp UI sau khi chạy browser.

## Dữ liệu thiết kế và tài liệu

Đã đối chiếu Figma node `5:1653` (hàng chờ) và `5:1686` (chi tiết). Queue/table, sidebar và phần quyết định dùng theme Admin hiện có; nội dung snapshot/room/ảnh bổ sung theo nghiệp vụ. Đã đọc `PROJECT OVERVIEW.docx`, `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx` cùng AGENT guides. Bốn tài liệu khác được prompt liệt kê không có trong workspace tại thời điểm triển khai.

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

## ADM-UI-02 — Tổng quan Admin

Đã đối chiếu design context và screenshot Figma node `5:1498` (1024 × 768). Nguyên nhân màn trước thiếu bố cục: `AdminDashboardScreen.tsx` trong API mode chỉ dựng KPI khách sạn và hai dòng chờ xử lý; chart và hoạt động gần đây bị thay bằng một câu thông báo chung. Màn mới dùng lại các component dashboard và `AdminShell` hiện có, hiển thị bốn KPI, card biểu đồ, ba dòng cần xử lý và card hoạt động gần đây ở cả desktop/mobile. Điều hướng tới phần chỉ có fixture bị vô hiệu hóa trong API mode.

| Ô giao diện | Nguồn và định nghĩa | Khi tải/lỗi/trống | Điều hướng |
| --- | --- | --- | --- |
| Doanh thu tháng và biểu đồ ngày | Chưa có giao dịch thanh toán đã xác nhận trong model/API | `—` và thông báo thiếu dữ liệu ngay trong từng card; không dựng cột mẫu | Không có |
| Đặt phòng mới | `GET /api/admin/dashboard/summary`, đếm `Booking.createdAt` trong 7 × 24 giờ gần nhất; response có `from`, `to`, `period: ROLLING_7_DAYS` | Spinner, lỗi kèm Thử lại, hoặc số 0 thật | Chưa có trang quản lý booking thật |
| KS chờ duyệt | Cùng `total` với `GET /api/hotels/review/submissions` trạng thái PENDING | Spinner, lỗi kèm Thử lại, hoặc 0 thật | Hàng chờ ST-ADM-04 |
| Cảnh báo AI | Chưa có queue cảnh báo thật | `—` và thông báo thiếu dữ liệu | Không có |
| Xác minh chủ khách sạn | `summary.pending` từ API owner verification | Đang tải, lỗi kèm Thử lại, hoặc `00` thật | Hàng chờ owner verification |
| Khách sạn chờ duyệt | Cùng query và số với KPI KS chờ duyệt | Đang tải, lỗi kèm Thử lại, hoặc `00` thật | Hàng chờ ST-ADM-04 |
| Cảnh báo cần xem | Chưa có queue cảnh báo thật | `—` và “Chưa khả dụng” trong dòng | Vô hiệu hóa |
| Hoạt động gần đây | Cùng `summary`, tối đa 5 `HotelSubmissionAudit` thuộc loại SUBMITTED/APPROVED/REJECTED, sắp mới nhất trước | Spinner, lỗi kèm Thử lại, hoặc thông báo trống trong card | Nhật ký Admin chưa có trang thật, link vô hiệu hóa |

Endpoint summary chỉ cho JWT có role `ADMIN`; Owner/User nhận 403. Query khóa theo user/session, lấy lại khi mở màn và khi hàng chờ bị invalidate sau quyết định duyệt/từ chối. Màn không hiển thị tên khách sạn, số liệu hoặc cột biểu đồ mẫu Figma trong API mode. Bản demo UI cũ vẫn dùng fixture khi đăng nhập chế độ demo.

Ảnh kiểm tra runtime sau thay đổi nằm tại `docs/evidence/ADM-04/dashboard-desktop-1024.png`, `dashboard-mobile-360.png`, `dashboard-mobile-390.png`, `dashboard-mobile-430.png` và `dashboard-mobile-drawer.png`. Ảnh chụp bằng Expo Web, Admin seed và database kiểm thử cô lập; chưa kiểm tra trên máy iOS/Android thật. Không có ảnh chụp “trước” từ cùng runtime trong repo; đối chiếu nguyên nhân với mã màn cũ và ảnh hiện trạng trong yêu cầu. Hai tài liệu thiết kế sẵn có trong workspace là `PROJECT OVERVIEW.docx` và `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx`; bốn tài liệu còn lại trong prompt chưa có để đối chiếu trực tiếp.

Kiểm tra cuối: `npm.cmd run typecheck` và `npm.cmd run lint` qua hai workspace; `npm.cmd run build` qua API; `npm.cmd run test --workspace @booking-travel/api -- --runInBand` qua 28 suite/120 test; Expo web export thành công; DB E2E `owner-hotel-wizard-db.e2e-spec.ts` qua 1 suite/1 test trên `booking_travel_stown06_test`. Runtime Expo Web đã kiểm tra màn 1024/360/390/430 px, drawer và bấm KPI khách sạn mở đúng `/admin/hotel-moderation`. Chưa có bộ dữ liệu bảy hồ sơ PENDING trong database kiểm thử nên chưa chụp được diễn tiến 7 → 6 → 5 ở runtime; E2E kiểm tra queue/count sau các quyết định bằng fixture cô lập.

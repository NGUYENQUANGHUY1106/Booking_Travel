# ST-ADM-05 — Ẩn, đình chỉ và khôi phục khách sạn

## Luồng dữ liệu

`Hotel` là nguồn trạng thái duy nhất. Admin đọc toàn bộ khách sạn qua `GET /api/admin/hotels`, mở `GET /api/admin/hotels/:id`, rồi gửi quyết định bằng `POST /api/admin/hotels/:id/decision`. API chỉ cho tài khoản Admin có quyền `HOTEL_REVIEW`. Chủ khách sạn đọc lý do gần nhất trong hồ sơ và lịch sử qua `GET /api/owner/hotels/:id/restrictions`; tài khoản khác không được truy cập đường dẫn này.

| Trước | Quyết định | Sau | Tìm kiếm / booking mới |
| --- | --- | --- | --- |
| `APPROVED`, `isVisible=true` | `HIDE` | `APPROVED`, `isVisible=false` | Không |
| `APPROVED`, `isVisible=true` | `SUSPEND` | `SUSPENDED`, `isVisible=false` | Không |
| Hai trạng thái hạn chế trên | `RESTORE` | `APPROVED`, `isVisible=true` | Có, khi đủ điều kiện hồ sơ và Owner |
| `DRAFT`, `PENDING`, `REJECTED` | Mọi quyết định ADM-05 | Từ chối | Không thay đổi |

Mutation yêu cầu `reason`, `expectedProfileVersion`, `expectedRestrictionVersion` và `requestId`. `evidenceReference` là ghi chú nguồn bằng chứng thủ công; chưa có module Report để liên kết báo cáo tự động. Transaction khóa theo Hotel ID, kiểm tra version và trạng thái, rồi cập nhật Hotel, ghi `HotelRestrictionAudit`, `HotelRestrictionNotification` và các `HotelBookingOperationalTask` tương ứng booking chưa kết thúc. Thử lại cùng `requestId` trả quyết định trước đó; request khác với version cũ nhận 409. Khôi phục kiểm tra Owner còn hoạt động và được xác minh, hồ sơ đủ thông tin, phòng còn hoạt động và phiên bản hồ sơ gần nhất đã duyệt. Tác vụ vận hành được đánh dấu hoàn tất khi khôi phục, lịch sử vẫn giữ nguyên.

Booking đã có không bị hủy hoặc hoàn tiền tự động. Booking mới khóa theo Hotel trước khi khóa phòng, sau đó kiểm tra `APPROVED && isVisible` trong transaction. Public Hotel, Room, Availability và media đều dùng điều kiện này. Chưa có search index/cache server riêng; màn danh sách trên app cần refresh để nhận trạng thái mới, còn API chặn truy cập và booking ngay sau khi transaction commit.

## Kiểm tra

Từ `DACN2`:

```powershell
npm.cmd run prisma:migrate
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd test --workspace @booking-travel/api -- --runInBand bookings-restriction.spec.ts admin-hotel-management.service.spec.ts
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand admin-hotel-management.e2e-spec.ts
npm.cmd run test:admin --workspace @booking-travel/mobile
npm.cmd run lint
```

Đăng nhập Admin, mở **Quản lý khách sạn** ở sidebar, tìm khách sạn đã duyệt, mở chi tiết và thử Ẩn/Đình chỉ/Khôi phục. Mỗi lần quyết định cần lý do từ 10 ký tự; kiểm tra trạng thái, nhật ký, thông báo trong chi tiết của chủ và booking hiện có. Không thử sanction trên dữ liệu thật nếu chưa muốn thay đổi trạng thái khách sạn.

Figma ADM-UI-09/10 dùng vài dữ liệu và trạng thái minh họa, gồm nút duyệt hồ sơ và sidebar Đặt phòng trong frame đình chỉ. Màn này dùng layout, màu và card của Admin, nhưng nút và điều hướng theo ADM-05; duyệt hồ sơ chờ xử lý vẫn ở màn ADM-04.

Đã chạy `prisma:migrate` trên PostgreSQL cục bộ, `typecheck`, `build`, `lint`, toàn bộ 128 unit tests backend, 2 e2e tests mới về phân quyền/DTO và 6 test Admin app. Expo web export cũng build thành công. Lệnh đọc dữ liệu thật trả 13 Hotel chưa xóa thuộc 4 Owner; chi tiết một khách sạn APPROVED có 2 hạng phòng và 1 booking chưa kết thúc. Không chạy mutation sanction trên dữ liệu người dùng để tránh đổi trạng thái khách sạn đang dùng. Chưa có ảnh chụp giao diện sau thay đổi; kiểm thử trực quan trên thiết bị/desktop vẫn cần thực hiện bằng tài khoản Admin.

## Giới hạn tích hợp

- Chưa có Report module, nên không tự xác nhận bằng chứng hoặc liên kết Report ID; Admin nhập tham chiếu nguồn thủ công.
- Chưa có worker xử lý operational task; Admin xem các booking cần theo dõi trong chi tiết, còn quyết định liên hệ khách/hoàn tiền phải thực hiện ở workflow booking riêng.
- Chưa có notification push/email; thông báo được lưu trong DB và lý do hiện ở hồ sơ Owner.

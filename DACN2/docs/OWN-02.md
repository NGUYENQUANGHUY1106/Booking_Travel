# ST-OWN-02 — Theo dõi kết quả xác minh Chủ khách sạn

Nhánh `feat/st-own-02-owner-verification-status` dựa trên ST-ADM-03, vốn dựa trên ST-OWN-01. Hai PR phụ thuộc hiện là #14 và #13; tích hợp ST-OWN-01 rồi ST-ADM-03 trước ST-OWN-02.

## Chạy thử

Từ `DACN2`, dùng hai terminal:

```powershell
npm.cmd run dev:api
npm.cmd run dev:mobile
```

Đăng nhập tài khoản User đã có hồ sơ và mở **Tài khoản → Trở thành chủ khách sạn → Xem trạng thái hồ sơ**. Hồ sơ `DRAFT` tiếp tục form cũ; `PENDING` chỉ đọc và kiểm tra lại; `REJECTED` hiện lý do, cho sửa/nộp lại cùng application; `VERIFIED` có thể đồng bộ phiên và chuyển sang Owner Mode; `SUSPENDED` không thể vào Owner Mode hoặc tạo khách sạn. Mục **Chuyển vai trò** của tài khoản Owner luôn kiểm tra quyền qua API và refresh session trước khi mở Owner Dashboard.

Thông báo kết quả xét duyệt trong màn **Thông báo** của tài khoản API mở thẳng màn trạng thái; màn trạng thái luôn đọc lại kết quả từ Backend. Các thông báo đặt phòng/ưu đãi trong chế độ demo vẫn là dữ liệu demo hiện có.

Hai tài khoản Owner demo do seed tạo trước quy trình xác minh mới cần application/profile demo. Nếu chỉ cần cập nhật dữ liệu demo trong database đã migrate, chạy `npm.cmd run prisma:seed` từ `DACN2`. Lệnh seed cập nhật các tài khoản và khách sạn demo; không dùng cho dữ liệu thật. Bản local triển khai task này đã bổ sung riêng hai entitlement demo mà không chạy lại toàn bộ seed.

## Contract và an toàn

`GET /api/owner-applications/me` trả thông tin applicant, application hiện tại, `revision`, `version`, `updatedAt`, `reviewedAt` và `ownerEntitlementActive`; không trả review history, ghi chú nội bộ hoặc object key của tài liệu. GET không thay đổi quyền. `PATCH /api/owner-applications/:id` chấp nhận `expectedRevision`; `POST /api/owner-applications/:id/submit` chấp nhận `expectedVersion` và `expectedRevision`. Dữ liệu cũ trả 409. Các trường này là tùy chọn cho client cũ; form ST-OWN-02 luôn gửi chúng. Backend vẫn kiểm tra owner, trạng thái, tài liệu và revision khi ghi.

`AccessTokenGuard` lấy role, application và profile từ PostgreSQL ở mỗi request. `RolesGuard` chặn các API Owner khi hồ sơ không `VERIFIED` hoặc profile không hoạt động, kể cả khi client giữ token/role cũ. Các API đọc trạng thái cá nhân vẫn truy cập được khi hồ sơ bị đình chỉ. Admin Approval là nơi duy nhất cấp quyền.

## Kiểm thử

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test -- --runInBand
$env:RUN_DB_OWNER_E2E='1'; npm.cmd run test:e2e -- --runInBand owner-verification-db.e2e-spec.ts owner-application-db.e2e-spec.ts authorization.e2e-spec.ts
```

Đã kiểm tra giao diện web ở viewport 390 × 844 cho `PENDING`, `REJECTED`, `VERIFIED`, `SUSPENDED` và Role Switcher. Kiểm thử xác nhận chuyển sang Owner Dashboard khi entitlement hợp lệ, deep link bị chuyển về màn trạng thái khi đình chỉ, và API tạo khách sạn trả 403. Dữ liệu QA tạm đã được xóa. Android/iOS trên thiết bị thật và tải giấy tờ qua R2 thật cần kiểm tra thêm; môi trường local không có R2 credentials. Luồng Admin đình chỉ/khôi phục hồ sơ chưa có trong ADM-03, nên kiểm thử `SUSPENDED` dùng trạng thái database kiểm soát trong fixture.

Traceability: `ST-OWN-02 → OWN-02 → FR-OWN-02 → BUILD-OWN-02 → TSK-SP1-07/08 → OWN-UI-03/04`.

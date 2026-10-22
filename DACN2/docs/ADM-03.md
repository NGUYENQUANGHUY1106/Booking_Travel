# ST-ADM-03 — Xét duyệt hồ sơ Chủ khách sạn

Nhánh triển khai: `feat/st-adm-03-owner-verification`, tạo từ `feat/st-own-01-owner-registration` vì ST-OWN-01 chưa được merge vào `develop`. Sau khi ST-OWN-01 được tích hợp, đặt lại nhánh ST-ADM-03 lên `develop` trước khi mở PR độc lập.

## Chạy và kiểm tra

Từ `DACN2`:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
```

Ở terminal khác:

```powershell
npm.cmd run dev:mobile
```

Đăng nhập tài khoản Admin có quyền `HOTEL_REVIEW`, mở **Xác minh chủ KS**. Hồ sơ `PENDING` từ ST-OWN-01 xuất hiện trong danh sách. Chọn **Xem chi tiết**, mở và đối chiếu hai tài liệu, đánh dấu đã kiểm tra rồi xác nhận phê duyệt; hoặc nhập lý do để từ chối. Sau quyết định, xem lại trạng thái, audit và thông báo ở tài khoản người đăng ký.

Không chạy `db:setup` nếu chỉ cần migration: lệnh đó chạy lại seed và cập nhật dữ liệu tài khoản demo. `prisma:migrate` chỉ áp dụng migration còn thiếu.

## API

| Route | Quyền | Tác dụng |
| --- | --- | --- |
| `GET /api/admin/owner-applications` | ADMIN + HOTEL_REVIEW | Tìm kiếm, lọc, sắp xếp, phân trang và thống kê |
| `GET /api/admin/owner-applications/:id` | ADMIN + HOTEL_REVIEW | Chi tiết, metadata giấy tờ, lịch sử audit |
| `GET /api/admin/owner-applications/:id/documents/:purpose/access` | ADMIN + HOTEL_REVIEW | URL đọc R2 private ngắn hạn; ghi audit truy cập |
| `POST /api/admin/owner-applications/:id/decision` | ADMIN + HOTEL_REVIEW | `APPROVE`/`REJECT`, `expectedVersion`, lý do khi từ chối |
| `GET /api/owner-applications/me/notifications` | USER/HOTEL_OWNER | Thông báo trong ứng dụng của chính tài khoản |

Approve và Reject chỉ nhận `PENDING`; một transaction ghi trạng thái, profile/quyền khi approve, audit và thông báo. Version/status/revision ngăn quyết định đồng thời. Reject giữ tài khoản `USER` và lý do để sửa, gửi lại. Thông báo hiện lưu trong PostgreSQL và hiển thị tại màn trạng thái Owner; project chưa có provider push/email. Không dùng URL tài liệu lâu dài hay public bucket.

Để phê duyệt với tài liệu thật, cấu hình `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` trong `.env` và dùng bucket private. Backend kiểm tra R2 HEAD, MIME, dung lượng và chữ ký tệp trước khi approve hoặc cấp URL xem. Nếu thiếu R2, có thể xem hàng chờ, từ chối và kiểm tra API; approve sẽ không được thực hiện.

## Test

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --runInBand
$env:RUN_DB_OWNER_E2E='1'; npm.cmd run test:e2e -- --runInBand owner-verification-db.e2e-spec.ts owner-application-db.e2e-spec.ts
npm.cmd run build
```

Test tích hợp dùng PostgreSQL local, tạo dữ liệu riêng rồi dọn dẹp sau test. Media được giả lập trong test để kiểm tra transaction/API khi môi trường không có R2. Việc mở URL R2 trên Android/iOS cần kiểm tra thêm với bucket thật và thiết bị thật.

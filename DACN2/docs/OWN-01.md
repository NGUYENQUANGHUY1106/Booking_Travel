# ST-OWN-01 — Đăng ký trở thành Chủ khách sạn

Luồng: `USER` đã xác minh → tạo/sửa `DRAFT` → tải tài liệu riêng tư → kiểm tra hồ sơ → nộp `PENDING`. Việc duyệt/từ chối và cấp quyền `HOTEL_OWNER` thuộc ADM-03; API nộp hồ sơ không đổi role.

## Chuẩn bị

Từ thư mục `DACN2`:

```powershell
npm.cmd install
npm.cmd run db:setup
npm.cmd run dev:api
```

Chạy Expo ở terminal khác:

```powershell
npm.cmd run dev:mobile
```

Nếu database đã có dữ liệu và chỉ cần migration mới, dùng `npm.cmd run prisma:migrate -w @booking-travel/api`. `db:setup` chạy lại seed demo và cập nhật mật khẩu/trạng thái các tài khoản demo.

Điền `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` trong `.env`. Bucket xác minh phải **private**; không dùng `R2_PUBLIC_BASE_URL` cho giấy tờ này. Presigned PUT hết hạn sau 5 phút. Nếu chạy web, cấu hình CORS trên bucket cho origin ứng dụng và phương thức `PUT`, header `Content-Type`. Thiếu cấu hình R2, API upload trả `503`; phần form và bản nháp vẫn có thể kiểm tra.

## Cách thử trên Expo

1. Đăng nhập tài khoản `USER` đã xác minh.
2. Mở **Tài khoản → Trở thành chủ khách sạn**. Người chưa đăng nhập được đưa đến Auth và quay lại sau khi đăng nhập.
3. Chọn **Bắt đầu đăng ký**, nhập cơ sở kinh doanh, tải giấy tờ định danh và giấy phép kinh doanh (JPG/PNG/PDF, tối đa 10 MB mỗi tệp).
4. Lưu bản nháp, rời màn hình rồi mở lại để kiểm tra khôi phục.
5. Xác nhận và nộp. Màn hình trạng thái phải hiển thị `PENDING`; tài khoản vẫn là `USER`.

## API

| Route | Quyền | Tác dụng |
| --- | --- | --- |
| `GET /api/owner-applications/me` | USER | Hồ sơ hiện tại và thông tin tài khoản đã xác minh |
| `POST /api/owner-applications` | USER | Tạo hoặc trả lại bản nháp hiện có |
| `PATCH /api/owner-applications/:id` | USER sở hữu | Sửa bản nháp, gắn tài liệu đã finalize |
| `POST /api/owner-applications/:id/submit` | USER sở hữu | Chuyển sang PENDING khi đủ dữ liệu và tài liệu |
| `POST /api/media/presign` | USER có bản nháp | Cấp URL PUT private với purpose `IDENTITY` hoặc `BUSINESS_LICENSE` |
| `POST /api/media/:id/finalize` | USER sở hữu | Kiểm tra object R2, kích thước, MIME và chữ ký tệp |
| `GET /api/admin/owner-applications` | ADMIN + `HOTEL_REVIEW` | Hàng chờ PENDING cho ADM-03 |
| `GET /api/admin/owner-applications/:id` | ADMIN + `HOTEL_REVIEW` | Chi tiết hồ sơ, không có object key |
| `GET /api/admin/owner-applications/:id/documents/:purpose/access` | ADMIN + `HOTEL_REVIEW` | URL đọc tài liệu tạm thời, hết hạn sau 2 phút |

Không gửi `userId`, `role`, `status` hoặc URL tài liệu trong payload sửa hồ sơ. Backend lấy user từ access token và từ chối field ngoài DTO.

## Kiểm tra

```powershell
npm.cmd run typecheck -w @booking-travel/api
npm.cmd run lint -w @booking-travel/api
npm.cmd test -w @booking-travel/api -- --runInBand
$env:RUN_DB_OWNER_E2E='1'; npm.cmd run test:e2e -w @booking-travel/api -- --runInBand owner-application-db.e2e-spec.ts
npm.cmd run typecheck -w @booking-travel/mobile
npm.cmd run lint -w @booking-travel/mobile
```

ADM-03 hiện chưa nối UI xét duyệt thật với queue này. Phần ST-OWN-01 cung cấp dữ liệu và API đọc riêng tư để task đó sử dụng.

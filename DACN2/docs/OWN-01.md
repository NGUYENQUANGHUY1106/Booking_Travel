# ST-OWN-01 — Đăng ký trở thành Chủ khách sạn

Luồng: tạo tài khoản → chọn **Đăng ký trở thành Chủ khách sạn** → xác minh email hoặc số điện thoại → nhập tên, loại, địa chỉ, mô tả, số điện thoại và ảnh bìa khách sạn → xác nhận thông tin → nộp `PENDING`. Admin duyệt hồ sơ ở ADM-03, cấp quyền `HOTEL_OWNER` và tạo sẵn khách sạn `DRAFT` từ thông tin đã duyệt. Chủ tiếp tục thêm phòng, vị trí chi tiết, tiện nghi, chính sách và gửi duyệt đăng tin. Không cần giấy tờ định danh hoặc giấy phép kinh doanh để nộp và duyệt hồ sơ.

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

Trong môi trường development, ảnh bìa được lưu tại `.local-media/owner-covers` nếu chưa cấu hình bucket ảnh công khai. Thư mục này đã nằm trong `.gitignore`. Khi triển khai với R2, điền `R2_ENDPOINT`, `R2_PUBLIC_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL` trong `.env`. Presigned PUT hết hạn sau 5 phút. Nếu chạy web, cấu hình CORS trên bucket ảnh cho origin ứng dụng và phương thức `PUT`, header `Content-Type`. Luồng đăng ký hiện tại không cần kho tài liệu riêng tư.

## Cách thử trên Expo

1. Đăng nhập tài khoản `USER` đã xác minh.
2. Mở **Tài khoản → Trở thành chủ khách sạn**. Người chưa đăng nhập được đưa đến Auth và quay lại sau khi đăng nhập.
3. Chọn **Bắt đầu đăng ký**, nhập thông tin khách sạn và ảnh bìa (JPG/PNG/WebP, tối đa 10 MB).
4. Lưu bản nháp, rời màn hình rồi mở lại để kiểm tra khôi phục.
5. Xác nhận và nộp. Màn hình trạng thái phải hiển thị `PENDING`; tài khoản vẫn là `USER`.

## API

| Route | Quyền | Tác dụng |
| --- | --- | --- |
| `GET /api/owner-applications/me` | USER | Hồ sơ hiện tại và thông tin tài khoản đã xác minh |
| `POST /api/owner-applications` | USER | Tạo hoặc trả lại bản nháp hiện có |
| `POST /api/owner-applications/:id/cover-upload` | USER sở hữu | Cấp URL PUT cho ảnh bìa khách sạn |
| `PATCH /api/owner-applications/:id` | USER sở hữu | Sửa bản nháp và thông tin khách sạn |
| `POST /api/owner-applications/:id/submit` | USER sở hữu | Chuyển sang PENDING khi đủ thông tin khách sạn |
| `GET /api/admin/owner-applications` | ADMIN + `HOTEL_REVIEW` | Hàng chờ PENDING cho ADM-03 |
| `GET /api/admin/owner-applications/:id` | ADMIN + `HOTEL_REVIEW` | Chi tiết hồ sơ để xét duyệt |

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

ADM-03 có UI xét duyệt thật cho hồ sơ Chủ khách sạn. Ảnh bìa đã duyệt được lưu vào bản nháp khách sạn; ảnh và thông tin phòng bổ sung trong luồng hoàn thiện khách sạn sau khi duyệt quyền Chủ.

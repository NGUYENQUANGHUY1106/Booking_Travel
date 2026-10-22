# Booking Travel

Monorepo gồm NestJS API, ứng dụng React Native/Expo và PostgreSQL. Dự án hiện có module địa chỉ Việt Nam hỗ trợ cả danh mục hành chính hiện hành hai cấp và danh mục lịch sử ba cấp.

## Thành phần chính

- `apps/booking-travel-be`: NestJS, Prisma, PostgreSQL, Swagger.
- `apps/booking-travel-app`: Expo SDK 57, Expo Router, TanStack Query.
- `apps/booking-travel-be/prisma`: schema và migration cơ sở dữ liệu.
- `apps/booking-travel-be/data/vietnam-address`: snapshot dữ liệu chính thức và bảng chuyển đổi cũ–mới.
- `apps/booking-travel-be/scripts`: tải, kiểm tra và import dữ liệu địa chỉ.
- `docs/VIETNAM_ADDRESS_DATA.md`: nguồn, phiên bản và giới hạn dữ liệu.
- `infra/postgres`: PostgreSQL 16 với PostGIS và pgvector.

## Chạy lần đầu

Yêu cầu Node.js 22+, npm 10+ và PostgreSQL 16. Nếu dùng Docker, cần mở Docker Desktop trước.

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run infra:up
npm.cmd run db:setup
npm.cmd run data:validate:vn
npm.cmd run data:import:vn
```

Nếu máy không có Docker, tạo trước database `booking_travel` trong pgAdmin 4, sau đó sửa `DATABASE_URL` trong `.env` theo tài khoản PostgreSQL của bạn. Lệnh `db:setup` sẽ tự tạo bảng và dữ liệu mẫu; bạn không cần tạo bảng thủ công.

Sau mỗi lần pull code có migration mới, chạy `npm.cmd run db:setup`. Seed dùng `upsert`, nên hai thành viên có thể chạy lại an toàn và có cùng bộ dữ liệu Hotel/Room/Booking/Admin. Chi tiết model và endpoint xem tại [`docs/CORE_BOOKING_API.md`](./docs/CORE_BOOKING_API.md).

## Nạp dữ liệu mẫu để kiểm tra phân quyền

Sau khi pull nhánh có seed ST-AUTH-08, mỗi thành viên cấu hình `DATABASE_URL` trong `DACN2/.env` cho PostgreSQL trên máy mình, rồi chạy từ thư mục gốc của repository:

```powershell
cd DACN2
npm.cmd run db:setup
```

Lệnh này áp dụng migration và nạp 2 admin (một tài khoản bị giới hạn quyền), 2 chủ khách sạn (Owner B có thêm khách sạn/phòng nháp để kiểm tra quyền đọc), 2 khách du lịch (mỗi người có một booking). Seed dùng `upsert`, nên chạy lại không tạo thêm bản ghi trùng. Nếu đã có database trong pgAdmin 4, không cần tạo lại database trước khi chạy lệnh.

## Chạy ứng dụng

Terminal 1 – API:

```powershell
npm.cmd run dev:api
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- Kiểm tra database: `http://localhost:3000/api/health/database`

Terminal 2 – Expo:

```powershell
npm.cmd run dev:mobile
```

Mở route `/address-demo` để thử component địa chỉ. Khi chạy Expo ở chế độ LAN trên điện thoại thật, app tự thay `localhost` bằng host của Expo; điện thoại và máy tính cần cùng mạng. Nếu dùng tunnel hoặc mạng đặc biệt, đặt `EXPO_PUBLIC_API_BASE_URL` thành IP/URL mà điện thoại truy cập được.

## Cập nhật dữ liệu hành chính

Snapshot đã được lưu trong repository nên cài đặt bình thường chỉ cần validate và import:

```powershell
npm.cmd run data:validate:vn
npm.cmd run data:import:vn
```

Khi muốn lấy snapshot mới từ dịch vụ chính thức của Cục Thống kê:

```powershell
npm.cmd run data:fetch:vn
npm.cmd run data:validate:vn
npm.cmd run data:import:vn
```

Importer dùng `upsert`, chạy lại an toàn và có nhật ký trong bảng `ImportRun`. Không sửa trực tiếp file JSON đã tải; hãy chạy lại pipeline và kiểm tra thay đổi/version trước khi phát hành.

## API địa chỉ

- `GET /api/addresses/catalog/provinces?mode=CURRENT|LEGACY`
- `GET /api/addresses/catalog/provinces/:provinceId/communes`
- `GET /api/addresses/catalog/legacy/provinces/:provinceId/districts`
- `GET /api/addresses/catalog/legacy/districts/:districtId/communes`
- `GET /api/addresses/catalog/search?q=...`
- `GET /api/addresses/catalog/streets?communeId=...&q=...`
- `GET /api/addresses/catalog/transitions/:unitId`
- `POST /api/addresses/catalog/validate`
- CRUD `/api/addresses` yêu cầu Bearer access token; `ownerId` luôn lấy từ JWT, không nhận từ request body.

## ST-AUTH-01 - Đăng ký tài khoản

Endpoint công khai: `POST /api/auth/register`.

```json
{
  "fullName": "Nguyễn Văn An",
  "email": "an@example.com",
  "phone": "0901234567",
  "password": "Demo1234",
  "confirmPassword": "Demo1234",
  "acceptedTerms": true
}
```

Chỉ cần gửi ít nhất một trong hai trường `email` hoặc `phone`. Backend luôn gán role `USER`, tạo tài khoản ở trạng thái `PENDING_VERIFICATION` và tạo mã OTP có thời hạn trong bảng `VerificationCode`. Client không được gửi trường `role`.

Khi chưa kết nối nhà cung cấp email/SMS, có thể đặt `AUTH_EXPOSE_DEVELOPMENT_OTP=true` trong file `.env` để API trả thêm `developmentOtp` và in OTP trên terminal backend khi chạy local. Không bật tùy chọn này trên production.

## ST-AUTH-02 - Xác minh và gửi lại OTP

Xác minh OTP bằng phiên nhận được từ API đăng ký:

```json
POST /api/auth/verify

{
  "verificationSessionId": "UUID nhận từ API đăng ký",
  "otp": "123456"
}
```

OTP đúng sẽ được đánh dấu đã sử dụng, cập nhật thời điểm xác minh email hoặc số điện thoại, đồng thời chuyển tài khoản đăng ký sang `ACTIVE`. OTP sai làm tăng `attemptCount`; phiên bị khóa sau số lần thử cấu hình bởi `OTP_MAX_ATTEMPTS`.

Gửi lại OTP sau thời gian cooldown:

```json
POST /api/auth/resend-verification

{
  "verificationSessionId": "UUID của phiên xác minh hiện tại"
}
```

API gửi lại sẽ vô hiệu hóa OTP cũ và trả một `verificationSessionId` mới. Tổng số lần gửi bị giới hạn bởi `OTP_MAX_SENDS`.

## ST-AUTH-03 - Đăng nhập

Endpoint công khai: `POST /api/auth/login`.

```json
{
  "identifier": "traveler@bookingtravel.vn",
  "password": "traveler123"
}
```

Backend so khớp bcrypt hash, kiểm tra trạng thái tài khoản, lấy role từ database và trả access token ngắn hạn cùng refresh token dài hạn. Refresh token chỉ được lưu dưới dạng SHA-256 hash trong bảng `AuthSession`; client không được gửi role. Tài khoản chưa xác minh, bị tạm khóa hoặc vô hiệu hóa sẽ bị từ chối.

Tài khoản seed local: `traveler@bookingtravel.vn / traveler123`, `owner@bookingtravel.vn / owner123`, và `admin@bookingtravel.vn / admin123`.

## ST-AUTH-04 - Làm mới access token

Endpoint công khai: `POST /api/auth/refresh`.

```json
{
  "refreshToken": "refresh token nhận từ lần đăng nhập hoặc refresh gần nhất"
}
```

Backend xác minh JWT và hash của token trong `AuthSession`, kiểm tra phiên cùng trạng thái tài khoản, rồi trả cặp access/refresh token mới. Refresh token được rotate ở mỗi lần dùng; token cũ, token hết hạn hoặc phiên đã thu hồi đều trả `401` và yêu cầu đăng nhập lại. Role trong token mới luôn lấy lại từ database. Client phải lưu đè cả access token và refresh token sau response thành công.

## ST-AUTH-05 - Quên mật khẩu và đặt lại mật khẩu

Yêu cầu OTP bằng `POST /api/auth/forgot-password`:

```json
{
  "identifier": "traveler@bookingtravel.vn"
}
```

API trả thông báo trung tính dù tài khoản có tồn tại hay không. Dùng `resetSessionId` nhận được cùng OTP để đặt mật khẩu mới qua `POST /api/auth/reset-password`:

```json
{
  "resetSessionId": "UUID của phiên đặt lại mật khẩu",
  "otp": "123456",
  "newPassword": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```

OTP chỉ dùng một lần. Mật khẩu mới phải khác mật khẩu hiện tại; reset thành công sẽ thu hồi toàn bộ phiên đăng nhập cũ và yêu cầu đăng nhập lại. Chạy `npm.cmd run db:setup` sau khi pull để áp dụng enum `PASSWORD_RESET` mới.

Sau khi pull phiên bản có chức năng này, chạy:

```powershell
npm.cmd ci
npm.cmd run db:setup
npm.cmd run dev:api
```

## Kiểm tra chất lượng

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:e2e
cd apps/booking-travel-app
npx.cmd expo-doctor
```

Không chạy `npm audit fix --force`, vì có thể hạ phiên bản/bẻ gãy dependency tương thích với Expo.

<!-- khi vừa pull code về chạy npm i  -->

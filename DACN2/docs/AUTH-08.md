# ST-AUTH-08 — RBAC và Resource Ownership

Đối chiếu: `AUTH-08` → `FR-AUTH-08` (SRS) → `BUILD-AUTH-08` → `TSK-SP1-02`. Repository hiện có SRS ở `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx`; chưa có tài liệu AI BUILD SPEC hoặc Sprint Plan riêng trong repository để đối chiếu chi tiết hơn.

## Luồng xác thực

`AccessTokenGuard` xác minh chữ ký và hạn JWT do AUTH-03 phát hành, lấy `sub`, rồi tải `User.role`, `User.isActive` và `AdminProfile.permissions` từ database. Claim `roles` hoặc trường `role` trong body không quyết định quyền. Nếu thiếu/sai/hết hạn token hoặc tài khoản bị vô hiệu hóa, API trả 401. AUTH-03 đã lưu `AuthSession` và hash refresh token; việc thu hồi/luân chuyển refresh token chưa có endpoint nên guard hiện vẫn dựa trên access-token TTL và trạng thái tài khoản.

Guard chạy theo thứ tự: xác thực → role/quyền Admin → ownership. Tài nguyên không tồn tại trả 404; đúng role nhưng không sở hữu trả 403. Endpoint Hotel/Room công khai vẫn cho phép không có token; nếu có token sai, trả 401.

## Quyền trên endpoint hiện có

| Endpoint | Quyền |
| --- | --- |
| `GET /hotels`, `GET /hotels/:id`, `GET /hotels/:hotelId/rooms`, `GET /rooms/:id` | Không đăng nhập chỉ thấy Hotel `APPROVED` và Room `ACTIVE`; owner đăng nhập xem được tài nguyên của mình; Admin có `HOTEL_REVIEW` xem được Hotel chưa công khai qua API Hotel. |
| `POST/PATCH/DELETE /hotels` | Chỉ `HOTEL_OWNER`; tạo gán `ownerId` từ principal, status ban đầu `DRAFT`; sửa/xóa ràng buộc `ownerId` ở truy vấn ghi. |
| `POST /hotels/:hotelId/rooms`, `PATCH/DELETE /rooms/:id` | Chỉ owner của Hotel mà Room thuộc về; truy vấn ghi ràng buộc quan hệ Room → Hotel → owner. |
| `GET /bookings` | `USER` chỉ booking của mình; `HOTEL_OWNER` mặc định chỉ booking tại Hotel của mình, hoặc đặt `userId` bằng ID của chính mình để xem booking cá nhân ở mọi Hotel; `ADMIN` cần `BOOKING_SUPPORT`. Query `userId`/`hotelId` chỉ lọc trong phạm vi đã cấp. |
| `GET /bookings/:id` | Khách đặt có role `USER`/`HOTEL_OWNER`, owner của Hotel hoặc Admin có `BOOKING_SUPPORT`. Admin không có quyền này không được xem booking dù là người đặt. |
| `POST /bookings` | `USER`/`HOTEL_OWNER` đặt cho chính mình; `userId` lấy từ principal. Room phải `ACTIVE` và Hotel phải `APPROVED`; không thể đặt phòng nháp bằng cách biết `roomId`. |
| `PATCH /bookings/:id/status` | Owner của Hotel hoặc Admin có `BOOKING_SUPPORT`; chỉ cho phép `CONFIRMED → CHECKED_IN → COMPLETED`. Truy vấn ghi ràng buộc owner và trạng thái hiện tại. Endpoint này không cho đặt trạng thái hoàn tiền; nghiệp vụ refund cần workflow riêng. |
| `/admins` | Chỉ `ADMIN` có `USER_MANAGEMENT`. Người quản trị không được cấp quyền ngoài các quyền mình đang có. |
| `/addresses` | `USER`/`HOTEL_OWNER` chỉ địa chỉ của chính mình. |

Mọi body ghi dữ liệu đi qua `ValidationPipe` với allow-list và `forbidNonWhitelisted`; `ownerId`, `userId`, `status` nội bộ trên Hotel create/update không được nhận từ client. Admin override chỉ có ở các endpoint đọc Hotel và Booking được mô tả rõ phía trên.

Thông tin email của chủ khách sạn không được trả ở Hotel list/detail công khai; owner của chính mình và Admin có `HOTEL_REVIEW` vẫn xem được trường này. Đây là thay đổi response cần thiết để tránh lộ dữ liệu riêng qua API công khai.

## Audit và phần phụ thuộc

Mutation `/admins` và cập nhật trạng thái Booking do Admin thực hiện được ghi bằng logger cấu trúc sau khi database mutation thành công. Record chỉ chứa actor ID/role, action, resource type/ID, outcome và timestamp; không ghi body, token hoặc secret. Repository chưa có model/bảng `AuditLog` hoặc storage tập trung; lưu bền vững, truy vấn audit và correlation ID cần task audit riêng. Các endpoint Inventory, Pricing, Payment, Chat, Review và moderation chưa có controller thực thi, nên chưa có request-pipeline test cho các module đó. Trường `quantity` và `basePrice` hiện nằm trên Room, vì vậy mutation của chúng được bảo vệ bởi quyền sở hữu Room. Chưa có `HotelOwnerProfile`/trạng thái xác minh để cưỡng chế owner phải `VERIFIED` trước mutation; điểm này chờ task Owner Verification. Policy ownership hiện có cho Hotel, Room và Booking là điểm tích hợp cho các task tiếp theo.

Lệnh kiểm tra: `npm run lint --workspace @booking-travel/api`, `npm run typecheck --workspace @booking-travel/api`, `npm run test --workspace @booking-travel/api -- --runInBand`, `npm run test:e2e --workspace @booking-travel/api -- --runInBand`, `npm run build --workspace @booking-travel/api` từ thư mục `DACN2`.

Test request pipeline với PostgreSQL thật dùng seed Owner A/B, khách A/B và Admin giới hạn. Chạy từ `DACN2` sau `npm.cmd run db:setup`:

```powershell
cd apps/booking-travel-be
$env:RUN_DB_AUTH_E2E = '1'
node --env-file=../../.env ../../node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand test/authorization-db.e2e-spec.ts
Remove-Item Env:RUN_DB_AUTH_E2E
```

Test này chỉ đọc dữ liệu hoặc gửi request ghi bị từ chối. Mặc định Jest bỏ qua test database khi không đặt `RUN_DB_AUTH_E2E=1`.

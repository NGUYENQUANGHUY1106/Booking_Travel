# ST-OWN-04 — Tạo và cập nhật hồ sơ khách sạn

## Chạy và kiểm tra

Từ `DACN2`, chạy migration một lần trên cơ sở dữ liệu đã cấu hình trong `.env`, sau đó mở API và Expo ở hai terminal:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
```

```powershell
npm.cmd run dev:mobile
```

Đăng nhập bằng tài khoản Chủ khách sạn đã được xác minh, vào tab **Khách sạn** → **Tạo chỗ ở**. Nhập tên, chọn một trong sáu loại chỗ ở, chỉnh mô tả; bản nháp lưu tự động. **Lưu & tiếp tục** chờ API lưu xong rồi mở chi tiết. Tại chi tiết có mục **Liên hệ, giờ nhận/trả & chính sách** để lưu email/điện thoại, giờ theo `HH:mm`, chính sách hủy và nội quy. Kéo xuống ở danh sách để tải lại.

Nếu Expo chạy trên điện thoại và không kết nối được API, kiểm tra `EXPO_PUBLIC_API_BASE_URL` trong `DACN2/.env`; điện thoại và máy chạy API phải truy cập được nhau qua mạng LAN. Không sửa `.env.example` để đặt IP riêng.

## API

Các route sau yêu cầu Bearer token của Chủ khách sạn có hồ sơ xác minh `VERIFIED`:

| Route | Ý nghĩa |
| --- | --- |
| `GET /api/owner/hotels` | Danh sách khách sạn của chủ hiện tại, bỏ bản ghi đã xóa mềm; có `completion`, `readyForReview`, `roomCount`, `bookingCount`. |
| `GET /api/owner/hotels/:id` | Chi tiết hồ sơ thuộc chủ hiện tại. |
| `POST /api/owner/hotels` | Tạo DRAFT với `name`, `accommodationType`, `clientDraftId` và `description` tùy chọn. Cùng `clientDraftId` của cùng chủ trả lại cùng bản nháp. |
| `PATCH /api/owner/hotels/:id` | Sửa các trường hồ sơ bằng `expectedVersion`; phiên bản cũ trả 409. Có thể gửi `policy: { cancellationPolicy, houseRules }`. |
| `DELETE /api/owner/hotels/:id` | Xóa mềm chỉ khi `DRAFT` và chưa có booking, trả 204. |

`ownerId`, trạng thái và mã định danh khách sạn do backend quản lý. Loại chỗ ở dùng enum `AccommodationPreferenceType` sẵn có: `HOTEL`, `RESORT`, `APARTMENT`, `VILLA`, `HOMESTAY`, `HOSTEL`. Migration `20261101000100_hotel_owner_profile` để `addressLine`, `city`, `province` rỗng cho bản nháp chưa tới bước vị trí; không điền địa chỉ mẫu. Khách sạn legacy chưa xác định loại giữ `accommodationType = null`, không được ngầm đổi thành `HOTEL`. `HotelPolicy` lưu chính sách riêng theo hotel.

Các API `/api/hotels` cũ vẫn hoạt động. Đường sửa cũ cũng bị giới hạn ở `DRAFT`/`REJECTED` và tăng `profileVersion`; đường xóa cũ áp dụng cùng điều kiện bản nháp/chưa có booking. DRAFT không xuất hiện trong danh sách công khai. Chỉnh tên/loại/mô tả/chính sách không sửa snapshot giá hoặc booking đã có.

## Trạng thái và phần việc nối tiếp

`DRAFT` và `REJECTED` cho phép sửa hồ sơ; `PENDING`, `APPROVED`, `SUSPENDED` hiện chỉ xem. Màn chi tiết hiển thị tiến độ thực tế của cơ bản, liên hệ, vị trí, ảnh, chính sách, phòng. Lưu ở bước cơ bản **không** gửi duyệt hay đổi trạng thái. Các bước vị trí/ảnh/gửi duyệt trong nhánh `develop` hiện chỉ là mock, nên route cũ được chặn thao tác giả; chức năng riêng của OWN-05/OWN-06 cần nối tiếp trước khi mở gửi duyệt.

**OPEN-QUESTION:** SRS nói sửa trường nhạy cảm của khách sạn `APPROVED` *có thể* cần duyệt lại, nhưng repo hiện chưa có policy xác định field nào được sửa trực tiếp, snapshot moderation hoặc endpoint xét duyệt khách sạn. Cần chốt danh sách field, tác động lên hiển thị công khai và quy trình duyệt lại trước khi mở PATCH cho `APPROVED`. Hiện backend từ chối để tránh công khai thay đổi chưa được duyệt.

## Kiểm thử

Từ `DACN2/apps/booking-travel-be` với PostgreSQL seed đã có:

```powershell
$env:RUN_DB_HOTEL_E2E='1'
npm.cmd run test:e2e -- --runInBand test/owner-hotel-profile-db.e2e-spec.ts
```

Suite tạo dữ liệu riêng, kiểm tra Owner A/B, idempotency, DRAFT không công khai, validation, phiên bản cũ, quyền theo trạng thái, xóa mềm và lịch sử booking; sau đó dọn các bản ghi test. Các lệnh `npm.cmd run typecheck`, `npm.cmd run lint` ở hai workspace và Expo web export cũng là cổng kiểm tra.

Để kiểm tra giao diện web ở các độ rộng 320–768px với API đang chạy, export web ra thư mục tạm rồi dùng tài khoản Owner seed cho smoke test:

```powershell
cd apps/booking-travel-app
npx.cmd expo export --platform web --output-dir "$env:TEMP\booking-travel-own04-web"
$env:OWN_QA_EXPORT_DIR="$env:TEMP\booking-travel-own04-web"
$env:OWN_QA_EMAIL='owner@bookingtravel.vn'
$env:OWN_QA_PASSWORD='owner123'
python test/owner-hotel-visual-qa.py
```

Script chụp các màn trong thư mục tạm, tạo một bản nháp qua giao diện rồi xóa mềm bản nháp đó khi kết thúc. Trên Expo Go, kiểm tra thêm bàn phím và safe area của thiết bị thật.

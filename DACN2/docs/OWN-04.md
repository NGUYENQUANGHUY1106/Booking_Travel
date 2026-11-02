# ST-OWN-04 — Tạo và cập nhật hồ sơ khách sạn

## Chạy và kiểm tra

Từ `DACN2`, chạy migration một lần trên cơ sở dữ liệu đã cấu hình trong `.env`, sau đó mở API và Expo ở hai terminal:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run data:validate:vn
npm.cmd run data:import:vn
npm.cmd run dev:api
```

```powershell
npm.cmd run dev:mobile
```

Đăng nhập bằng tài khoản Chủ khách sạn đã được xác minh, vào tab **Khách sạn** → **Tạo chỗ ở**. Wizard gồm 5 bước: **Cơ bản → Vị trí → Hình ảnh → Tiện ích và chính sách → Kiểm tra và gửi duyệt**. Mỗi bước dùng cùng hotel ID; Back và Lưu nháp & thoát giữ dữ liệu đã lưu. Màn **Chỗ ở của tôi** hiển thị cả DRAFT và nút **Tiếp tục chỉnh sửa**. Basic tự lưu sau khi hợp lệ; các bước sau lưu khi bấm **Lưu & tiếp tục**.

Nếu Expo đang mở thẳng Dashboard Admin do phiên đăng nhập cũ, mở menu Admin → **Đăng xuất**, rồi đăng nhập tài khoản Chủ khách sạn. Tab **Khách sạn** là đường vào **Chỗ ở của tôi**; không cần gõ deep link.

Vị trí chọn tỉnh/phường xã từ danh mục đã nạp. Địa chỉ cũ có thể dùng catalog 3 cấp. Expo iOS/Android có bản đồ chạm/kéo ghim; trên web hoặc khi không cấp GPS có thể nhập tọa độ Việt Nam bằng tay. Ảnh JPG/PNG/WebP tối đa 10 MB tải lên từng ảnh, xác nhận xong mới hiện trong gallery; có thể chọn bìa, đổi thứ tự, xóa và xem tất cả ảnh. Nếu tải xong nhưng xác nhận đứt mạng, bấm **Xác nhận lại ảnh**. Bước 4 lấy tiện ích từ catalog, nhập liên hệ, giờ `HH:mm`, chính sách hủy và nội quy. Bước 5 đọc checklist từ server; thiếu hạng phòng có nút **Thêm hạng phòng**.

**Gửi duyệt** là thao tác riêng. Chỉ DRAFT/REJECTED đủ sáu mục mới chuyển sang PENDING; PENDING chưa xuất hiện trong tìm kiếm công khai. Không có bước Owner tự duyệt hoặc xuất bản.

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
| `PATCH /api/owner/hotels/:id/location` | Lưu địa chỉ danh mục và tọa độ, dùng `expectedVersion`. |
| `GET /api/owner/hotels/catalog/amenities` | Danh mục tiện ích có thể chọn. |
| `PUT /api/owner/hotels/:id/amenities` | Lưu quan hệ tiện ích riêng, dùng `expectedVersion`. |
| `POST /api/owner/hotels/:id/media/presign` | Đặt chỗ tải ảnh, trả `mediaId`, URL PUT 15 phút. |
| `POST /api/owner/hotels/:id/media/finalize` | Kiểm tra nội dung/dung lượng và đưa ảnh vào gallery; gọi lại cùng `mediaId` là an toàn. |
| `PATCH /api/owner/hotels/:id/media/cover` | Chọn duy nhất một ảnh bìa, dùng `expectedVersion`. |
| `PUT /api/owner/hotels/:id/media/order` | Lưu thứ tự toàn bộ gallery, dùng `expectedVersion`. |
| `DELETE /api/owner/hotels/:id/media/:mediaId` | Xóa mềm ảnh; nếu xóa bìa, server chọn ảnh còn lại đầu tiên. |
| `POST /api/owner/hotels/:id/submit` | Kiểm tra lại checklist trong transaction, tạo bản ghi xét duyệt và chuyển PENDING. |
| `GET /api/hotels/review/submissions` | Hàng đợi hồ sơ PENDING cho Admin có quyền `HOTEL_REVIEW`. |

`ownerId`, trạng thái và mã định danh khách sạn do backend quản lý. Loại chỗ ở dùng enum `AccommodationPreferenceType` sẵn có: `HOTEL`, `RESORT`, `APARTMENT`, `VILLA`, `HOMESTAY`, `HOSTEL`. Migration `20261101000100_hotel_owner_profile` để `addressLine`, `city`, `province` rỗng cho bản nháp chưa tới bước vị trí; migration `20261102000100_hotel_wizard_media` thêm `HotelMedia`, `HotelAmenity`, `AmenityCatalog`, `HotelSubmission` và mã địa chỉ danh mục. Khách sạn legacy chưa xác định loại giữ `accommodationType = null`, không được ngầm đổi thành `HOTEL`. `HotelPolicy` lưu chính sách riêng theo hotel.

`GET /api/owner/hotels` và `GET /api/owner/hotels/:id` trả `gallery` gồm ID, thứ tự, cờ bìa và URL đọc ký ngắn hạn; chỉ ảnh đã finalize xuất hiện. Tải lại hồ sơ để cấp URL đọc mới khi hết hạn. URL PUT chỉ dùng để upload, không dùng làm URL hiển thị. Dữ liệu media mới không xuất hiện trong API public khi hotel chưa APPROVED. URL đọc đã ký là quyền truy cập tạm thời: chỉ cấp qua Owner API, hết hạn sau 15 phút; không chia sẻ URL này.

Nếu có đủ `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, ảnh được lưu trên R2 qua presigned PUT và backend proxy đọc. Khi chưa cấu hình R2, môi trường phát triển lưu vào `DACN2/.local-media/` (ignored bởi Git); production từ chối upload khi thiếu R2. Dữ liệu ảnh cục bộ không tự đồng bộ giữa các máy chủ. Reservation chưa finalize quá 30 phút được dọn khi có yêu cầu upload mới. Khi dùng R2 trên web, cấu hình CORS của bucket cho PUT từ origin của app.

Các API `/api/hotels` cũ vẫn hoạt động. Với khách sạn APPROVED, list trả ảnh bìa mới đã finalize và detail trả gallery; DRAFT/PENDING không xuất hiện trong public API. Đường sửa cũ cũng bị giới hạn ở `DRAFT`/`REJECTED` và tăng `profileVersion`; đường xóa cũ áp dụng cùng điều kiện bản nháp/chưa có booking. Chỉnh tên/loại/mô tả/chính sách không sửa snapshot giá hoặc booking đã có.

## Trạng thái và phần việc nối tiếp

`DRAFT` và `REJECTED` cho phép sửa hồ sơ; `PENDING`, `APPROVED`, `SUSPENDED` chỉ xem. Màn chi tiết và Review hiển thị checklist thực tế của cơ bản, liên hệ, vị trí, ảnh, chính sách, phòng. Chỉ ảnh đã xác nhận và có bìa mới hoàn thành mục ảnh. Lưu ở các bước 1–4 **không** gửi duyệt hay đổi trạng thái. Submit ghi một snapshot version vào `HotelSubmission`; Admin có thể đọc hàng đợi qua API. Repo chưa có dịch vụ thông báo Admin cho xét duyệt khách sạn, nên chưa có push notification riêng; hàng đợi API là kênh nhận hồ sơ hiện có.

**OPEN-QUESTION:** SRS nói sửa trường nhạy cảm của khách sạn `APPROVED` *có thể* cần duyệt lại, nhưng repo hiện chưa có policy xác định field nào được sửa trực tiếp, snapshot moderation hoặc endpoint xét duyệt khách sạn. Cần chốt danh sách field, tác động lên hiển thị công khai và quy trình duyệt lại trước khi mở PATCH cho `APPROVED`. Hiện backend từ chối để tránh công khai thay đổi chưa được duyệt.

## Kiểm thử

Từ `DACN2/apps/booking-travel-be` với PostgreSQL seed đã có:

```powershell
$env:RUN_DB_HOTEL_E2E='1'
npm.cmd run test:e2e -- --runInBand test/owner-hotel-profile-db.e2e-spec.ts
npm.cmd run test:e2e -- --runInBand test/owner-hotel-wizard-db.e2e-spec.ts
```

Hai suite tạo dữ liệu riêng rồi dọn bản ghi test. Suite wizard kiểm tra địa chỉ, ba ảnh thật, finalize, ảnh bìa thứ hai, thứ tự, gallery sau reload, tiện ích/chính sách, chặn gửi duyệt khi thiếu phòng, tạo phòng, submit PENDING, hàng đợi Admin và Owner B bị chặn. Chạy thêm `npm.cmd run typecheck`, `npm.cmd run lint` ở hai workspace, backend build và Expo web export.

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

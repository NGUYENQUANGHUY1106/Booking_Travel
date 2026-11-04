# ST-OWN-05 — Vị trí, tiện nghi và ảnh khách sạn

## Phụ thuộc và phạm vi

Nhánh `feat/ST-OWN-05-quan-ly-vi-tri-tien-nghi-va-media-khach-san` được tạo từ `develop` tại `9edcf5b`. ST-OWN-04 chưa có trên `develop` khi bắt đầu; nhánh này merge nhánh `feat/st-own-04-full-owner-hotel-profile` làm dependency được thể hiện trong lịch sử Git. PR ST-OWN-05 vì thế gồm cả phần ST-OWN-04 cho tới khi PR #21 được merge vào `develop`. Không merge nhánh này trực tiếp nếu muốn review ST-OWN-04 riêng trước.

FR-OWN-05 (SRS 3.8.5) được nối vào wizard của ST-OWN-04: Bước 2 vị trí, Bước 3 ảnh, Bước 4 tiện ích và chính sách, Bước 5 kiểm tra. Figma Owner page `1:7`, nodes `5:917`, `5:940`, `5:963` là các card tóm tắt; editor thực dùng component Owner có sẵn. Node `5:815`, `5:860`, `5:986` là các màn danh sách, chi tiết, review. Địa chỉ, ảnh và tiện ích mẫu trong Figma không được lưu mặc định.

## Chạy

Từ `DACN2`, với PostgreSQL/PostGIS và `.env` đã cấu hình:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
```

Ở terminal thứ hai, từ `DACN2`:

```powershell
npm.cmd run dev:mobile
```

Migration `20261102000300_hotel_public_geospatial` thêm cột geography `location` SRID 4326 được tạo từ `longitude`/`latitude`, cờ `isVisible`, index GiST cho hotel `APPROVED` đang hiển thị và index quan hệ tiện ích. Không suy đoán tọa độ cho dữ liệu cũ. Migration `20261102000400_backfill_known_hotel_amenities` chỉ nối các chuỗi tiện ích legacy có mã catalog tương ứng; các chuỗi không khớp được giữ nguyên để xử lý thủ công.

Khi thiếu cấu hình R2, môi trường phát triển dùng `.local-media` của máy hiện tại. Production yêu cầu R2. Upload chưa finalize quá 30 phút được dọn lúc ứng dụng khởi động, mỗi 10 phút và lúc xin reservation mới. Mỗi tiến trình chạy cleanup an toàn trên các reservation còn ở trạng thái chờ; ảnh đã finalize không nằm trong tập xóa.

## Hợp đồng API đang dùng

| Endpoint | Ý nghĩa |
| --- | --- |
| `GET /api/owner/hotels`, `GET /api/owner/hotels/:id` | Hồ sơ, structured address, tọa độ, amenities, gallery theo Owner; URL ảnh riêng có chữ ký và TTL 15 phút. |
| `PATCH /api/owner/hotels/:id/location` | Lưu nháp một phần hoặc đủ địa chỉ/pin; `expectedVersion`, kiểm tra quan hệ địa giới và cặp tọa độ. |
| `GET /api/owner/hotels/catalog/amenities` | Catalog gồm ID, tên và `active`; mã đã ngừng hoạt động vẫn hiện nếu hotel đã chọn. |
| `PUT /api/owner/hotels/:id/amenities` | Thay toàn bộ tập ID theo `expectedVersion`; không chấp nhận ID tự tạo. Bước 4 hiện lưu cùng contact/policy qua `PATCH /api/owner/hotels/:id` để cập nhật nguyên tử. |
| `POST /api/owner/hotels/:id/media/presign`, `/media/finalize` | Đặt reservation, upload trực tiếp và xác nhận object. Finalize lặp cùng ID là idempotent. |
| `PATCH /api/owner/hotels/:id/media/cover`, `PUT .../media/order`, `DELETE .../media/:mediaId` | Chọn một bìa, đổi thứ tự, xóa; kiểm tra version và quyền sở hữu. |
| `GET /api/hotels?latitude=...&longitude=...&radiusKm=...&amenityIds=...` | Tìm trong bán kính km bằng PostGIS geography, lọc đồng thời các ID tiện ích. Chỉ `APPROVED` + `isVisible` + chưa xóa mới ra public. |
| `GET /api/hotels/:id` | Chi tiết công khai cùng gallery/amenities; DRAFT/PENDING/REJECTED/SUSPENDED/ẩn bị từ chối. |

Owner VERIFIED và ownership được backend kiểm tra cho mọi mutation. `DRAFT`/`REJECTED` được sửa, `PENDING`/`APPROVED`/`SUSPENDED` không được sửa trường nhạy cảm cho tới khi có policy duyệt lại. Lưu bước không tự submit hoặc công khai. Booking snapshot không bị cập nhật bởi các thay đổi hồ sơ.

## Kiểm thử và giới hạn

```powershell
cd apps/booking-travel-be
$env:RUN_DB_HOTEL_E2E='1'
npm.cmd run test:e2e -- --runInBand owner-hotel-wizard-db.e2e-spec.ts
```

Suite dùng ảnh PNG thật trên local storage, kiểm tra owner khác bị chặn, địa chỉ một phần rồi hoàn chỉnh, SRID/thứ tự kinh-vĩ độ, bán kính/tiện ích, ba ảnh và bìa thứ hai, đổi thứ tự, xóa, submit PENDING, public chỉ sau APPROVED, ẩn hotel thì cả detail/room/ảnh công khai đều bị chặn. `npm.cmd run typecheck` và `npm.cmd run lint` chạy từ `DACN2`.

Màn **Tìm trên bản đồ** của Traveler đọc API public, đặt marker từ tọa độ đã lưu và mở chi tiết/gallery thật. Trên web có danh sách và chi tiết, còn bản đồ tương tác dùng `react-native-maps` trên Expo iOS/Android. Các màn **Kết quả tìm kiếm**, bộ lọc giá và đặt phòng của Traveler vẫn là prototype dùng `HOTELS` tĩnh; phần này cần tích hợp API riêng trước khi xem là luồng tìm và đặt phòng end-to-end. Không có benchmark P95 hoặc kiểm thử thiết bị iOS/Android trong môi trường này. SRS chưa chốt policy sửa hồ sơ APPROVED; backend giữ trạng thái chỉ xem để không làm lộ bản chưa được duyệt.

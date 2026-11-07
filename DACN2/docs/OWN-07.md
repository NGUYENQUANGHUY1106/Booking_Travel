# ST-OWN-07 — Quản lý hạng phòng và ảnh phòng

## Nguồn và phạm vi

Nhánh `feat/ST-OWN-07-quan-ly-loai-phong-va-hinh-anh-phong` được tạo từ `develop` tại `32f13dd`. Đối chiếu FR-OWN-07 trong `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx`, `PROJECT OVERVIEW.docx`, code hiện tại và Figma Owner `5:1009` (Room Types), `5:1032` (Create/Edit Room). Bốn DOCX khác được nêu trong yêu cầu không có trong workspace, nên các quyết định kỹ thuật còn thiếu dựa vào schema/API của repo. Hai frame Figma là card mẫu 390 × 844; dữ liệu Deluxe, giá và tồn kho trong frame chỉ là minh họa.

Một bản ghi `Room` là một hạng phòng với `quantity` phòng vật lý cùng hạng. Owner có thể tạo/sửa hạng, mã riêng trong khách sạn, hướng nhìn, cấu hình nhiều loại giường, sức chứa, diện tích, tiện ích, số lượng và giá cơ bản. Trình chỉnh sửa dùng catalog/picker có tìm kiếm, cho nhập tên/mã tùy chỉnh và giữ dữ liệu legacy. Có thể chọn nhiều ảnh trước khi lưu; form tạo bản ghi phòng rồi tải ảnh tuần tự. Nếu ảnh lỗi, bản ghi vừa tạo được giữ để thử tải lại, không POST một bản ghi phòng thứ hai trong cùng phiên form. Ảnh phòng có gallery riêng, chọn ảnh đại diện, đổi thứ tự và xóa. Ảnh phòng không thay ảnh bìa khách sạn.

## API, dữ liệu và quyền

| Endpoint | Hành vi |
| --- | --- |
| `GET /api/rooms/catalog` | Danh mục hạng, hướng nhìn, loại giường. |
| `GET /api/hotels/:hotelId/rooms`, `GET /api/rooms/:id` | Owner xem cả hạng inactive; public chỉ xem hạng active của khách sạn approved và visible. Trả kèm metadata ảnh đúng scope. |
| `POST /api/hotels/:hotelId/rooms` | Tạo một hạng phòng; `areaM2` bắt buộc, mã unique trong khách sạn, kiểm tra tiện ích hợp lệ. |
| `PATCH /api/rooms/:id` | Sửa có `expectedRevision`; 409 nếu phiên bản cũ. Khi giảm `quantity`, kiểm tra đỉnh booking committed trên từng đêm tương lai. |
| `GET /api/rooms/:id/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD` | Số phòng còn trong toàn khoảng lưu trú, checkout exclusive; chỉ cho hạng active công khai. Giá trả về là `basePrice`, không phải báo giá cuối cùng. |
| `GET/POST /api/owner/hotels/:id/rooms/:roomId/media...` | Xem ảnh riêng, presign, upload, finalize; xác minh owner/hotel/room. |
| `PATCH .../media/cover`, `PUT .../media/order`, `DELETE .../media/:mediaId` | Quản lý bìa/thứ tự/xóa theo `expectedVersion` của hồ sơ khách sạn. |

Migration `20261107000100_room_media_cover_scope` tách unique index ảnh bìa khách sạn và ảnh bìa từng hạng phòng. Migration `20261107000200_room_revision_booking_snapshot` thêm `Room.revision` và snapshot tên/mã hạng trong Booking, backfill booking cũ trước khi đặt `NOT NULL`. Booking mới ghi snapshot; API booking list/detail hiển thị tên/mã đã đặt dù Owner đổi tên hạng sau đó. Booking tạo mới kiểm tra sức chứa và tồn kho theo đỉnh booking từng đêm, thay vì cộng các lượt đặt không trùng đêm. Room inactive bị loại khỏi tìm kiếm/đặt mới; booking đã tạo vẫn giữ nguyên. Không hard-delete khi còn booking tương lai.

Quyền ghi hạng phòng theo policy hiện hữu: Owner đã xác minh, sở hữu khách sạn, khách sạn không ở `PENDING`/`SUSPENDED`. Ảnh chỉ sửa khi khách sạn `DRAFT`/`REJECTED`, theo moderation của hồ sơ hiện hữu. Việc đổi tên, giá hoặc trạng thái hạng phòng của khách sạn `APPROVED` hiện được backend cho phép và áp dụng ngay; repo chưa có luồng tái duyệt riêng cho room. Đây là giới hạn cần chốt khi triển khai re-moderation cho hotel/room.

## Chạy và kiểm thử

Từ `DACN2`, sau khi cấu hình `.env` và PostgreSQL:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test --workspace @booking-travel/api -- --runInBand bookings.service.spec.ts
$env:RUN_DB_HOTEL_E2E='1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand owner-hotel-wizard-db.e2e-spec.ts
$env:RUN_DB_AUTH_E2E='1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand authorization-db.e2e-spec.ts
```

E2E dùng ảnh PNG thật ở local storage: ba ảnh phòng, đổi ảnh đại diện sang ảnh thứ hai, sắp xếp lại, tải lại metadata, từ chối ảnh của owner/room khác, ngăn ảnh public khi room inactive. Test kiểm tra 10 phòng, booking committed 6, giảm xuống 5 bị 409, giảm đến 6 được; checkout exclusive và booking snapshot sau đổi tên. Nếu có R2, cần kiểm tra thêm luồng upload trên thiết bị thật với cấu hình bucket. Không có phép đo P95 hoặc kiểm thử iOS/Android thật trong môi trường này.

Luồng Review dùng chính module hạng phòng và checklist backend, không tự submit. Hạng inactive không tính đủ điều kiện gửi duyệt. Trang public hiển thị ảnh/thông số/giá cơ bản và số phòng còn theo ngày đã chọn. Hiện repo chưa có mô hình block, daily inventory override hoặc pricing rule theo ngày; các chức năng này thuộc OWN-08/09, nên số phòng/giá nêu ở đây chỉ dựa trên booking và `basePrice` hiện hữu. Ảnh chờ tải mới được giữ trong bộ nhớ của form; nếu đóng ứng dụng giữa chừng, có thể mở lại hạng phòng đã tạo để chọn ảnh lại. Chưa kiểm chứng giao diện trực tiếp trên thiết bị thật.

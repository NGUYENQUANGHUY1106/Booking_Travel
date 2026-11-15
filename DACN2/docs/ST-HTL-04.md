# ST-HTL-04 – Tìm kiếm trên bản đồ / Search this area

## Phạm vi

Màn hình `Tìm trên bản đồ` dùng dữ liệu khách sạn thật từ PostgreSQL. Khi người dùng kéo hoặc thu phóng bản đồ, ứng dụng chỉ ghi nhận vùng đang nhìn; truy vấn mới được gửi khi bấm **Tìm ở khu vực này**.

Endpoint công khai:

```http
GET /api/hotels/map/search
```

Ngoài điều kiện lưu trú và bộ lọc của `GET /api/hotels/search`, endpoint nhận bounding box:

- `northEastLatitude`, `northEastLongitude`
- `southWestLatitude`, `southWestLongitude`

Ví dụ:

```http
GET /api/hotels/map/search?destination=Đà%20Nẵng&checkIn=2026-12-10&checkOut=2026-12-13&adults=2&children=0&rooms=1&northEastLatitude=16.2&northEastLongitude=108.3&southWestLatitude=15.9&southWestLongitude=108.0&stars=4,5&sort=priceAsc&limit=50
```

## Quy tắc

- PostgreSQL/PostGIS lọc `Hotel.location` bằng bounding box; chỉ khách sạn `APPROVED`, đang hiển thị và chưa bị xóa được xét.
- Ngày lưu trú, số khách, số phòng, giá, sao, loại chỗ ở, tiện nghi, hủy miễn phí và sắp xếp được giữ nguyên khi tìm vùng mới.
- Marker chỉ trả id, tên, tọa độ, hạng sao, loại chỗ ở và giá bắt đầu. Chi tiết khách sạn chỉ được tải khi chọn marker.
- Tối đa 50 marker được trả mặc định. `truncated: true` cho biết còn kết quả bị giới hạn trong vùng lớn.
- Bounding box đảo chiều hoặc tọa độ ngoài giới hạn bị từ chối với HTTP 400.
- Bản đồ kéo/thu phóng dùng `react-native-maps` trên Expo Android/iOS. Web hiển thị danh sách marker có thể chọn vì thư viện này không hỗ trợ web.

Không có migration mới: cột `Hotel.location geography(Point,4326)` và GiST index đã tồn tại, được sinh tự động từ `latitude`/`longitude`.

## Cách kiểm tra trên ứng dụng

1. Chạy backend và Expo, đăng nhập User.
2. Chọn điểm đến, ngày nhận/trả phòng trong tương lai, số khách và số phòng rồi tìm kiếm.
3. Chọn bộ lọc bất kỳ (ví dụ 4–5 sao), sau đó bấm **Bản đồ**.
4. Kéo/thu phóng sang vùng khác và bấm **Tìm ở khu vực này**.
5. Xác nhận marker thay đổi theo vùng nhưng bộ lọc vẫn còn; chọn marker để xem thẻ tóm tắt, rồi mở chi tiết khách sạn.
6. Kéo đến vùng không có dữ liệu và xác nhận trạng thái rỗng được hiển thị.

## Kiểm tra tự động

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd test --workspace @booking-travel/api -- --runInBand
npm.cmd run test:traveler --workspace @booking-travel/mobile
```

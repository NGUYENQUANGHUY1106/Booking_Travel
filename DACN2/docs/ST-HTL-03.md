# ST-HTL-03 – Bộ lọc nâng cao và sắp xếp

## Phạm vi

`GET /api/hotels/search` hỗ trợ kết hợp các điều kiện sau trước khi phân trang:

- `minPrice`, `maxPrice`: giá thấp nhất mỗi đêm của hạng phòng còn bán trong kỳ tìm kiếm.
- `stars`: danh sách hạng sao, phân cách bằng dấu phẩy.
- `minReviewScore`: điểm đánh giá tối thiểu từ 0–10.
- `propertyTypes`: `HOTEL`, `RESORT`, `VILLA`, `APARTMENT`, `HOMESTAY`, `HOSTEL`.
- `amenities`: danh sách tên tiện nghi; khách sạn phải có đầy đủ các tiện nghi đã chọn.
- `freeCancellation`: chỉ nhận `true` hoặc `false`.
- `sort`: `recommended`, `priceAsc`, `priceDesc`, `rating` (hạng sao).

Ví dụ:

```http
GET /api/hotels/search?destination=Đà%20Nẵng&checkIn=2026-12-10&checkOut=2026-12-13&adults=2&children=0&rooms=1&maxPrice=2000000&stars=4,5&propertyTypes=HOTEL&amenities=Hồ%20bơi,Wi-Fi%20miễn%20phí&freeCancellation=true&sort=priceAsc&page=1&limit=20
```

Phản hồi có `items`, `pagination`, điều kiện đã chuẩn hóa trong `criteria` và `facets` cho giá, hạng sao, loại chỗ ở, tiện nghi, chính sách hủy và tình trạng dữ liệu review.

## Quy tắc

- Nhiều nhóm filter được kết hợp bằng `AND`; nhiều sao/loại chỗ ở trong cùng nhóm dùng `OR`.
- Kết quả được filter và sort ở backend trước khi phân trang.
- Mọi kiểu sort có khóa phụ là `hotel.id`, tránh lặp hoặc đổi thứ tự bất thường giữa các trang.
- Giá hiển thị là giá tham khảo từ hạng phòng phù hợp và còn bán; tìm kiếm không giữ tồn phòng.
- Sort khoảng cách không được cung cấp khi chưa có tọa độ neo, đúng quy tắc FR-HTL-03.
- Schema hiện chưa có `ReviewAggregate`. Backend trả `reviewScore: null`; chọn điểm review sẽ không tạo điểm giả và trả 0 kết quả cho đến khi module Review cung cấp aggregate thật.

## Dữ liệu demo

Chạy lại seed để có dữ liệu tái lập cho bộ lọc:

```powershell
npm.cmd run db:setup
```

- Blue Horizon: `HOTEL`, 4 sao, hồ bơi, Wi-Fi miễn phí, bữa sáng, hủy miễn phí.
- Riverside: `HOMESTAY`, 3 sao, Wi-Fi miễn phí, bữa sáng, không hoàn tiền.

## Kiểm tra

```powershell
npm.cmd run test --workspace @booking-travel/api -- --runInBand
npm.cmd run build --workspace @booking-travel/api
npm.cmd run typecheck --workspace @booking-travel/mobile
npm.cmd run test:traveler --workspace @booking-travel/mobile
```

Kiểm thử PostgreSQL:

```powershell
$env:RUN_DB_INVENTORY_E2E='1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand room-inventory-db.e2e-spec.ts
```

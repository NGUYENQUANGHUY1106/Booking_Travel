# ST-HTL-05 — Tìm khách sạn gần tôi / gần điểm mốc

## Phạm vi đã triển khai

- `GET /api/hotels/nearby` nhận một trong hai nguồn tìm kiếm:
  - `latitude` + `longitude` của thiết bị.
  - `landmark` là tên điểm mốc đã seed trong PostgreSQL.
- PostGIS tính `distanceMeters` và giới hạn kết quả theo `radiusKm` (0,5–50 km).
- Kết quả tiếp tục áp dụng ngày lưu trú, số khách, số phòng, phòng trống, giá và bộ lọc khách sạn.
- Ứng dụng chỉ xin quyền vị trí khi người dùng bấm **Vị trí hiện tại**. Chế độ **Điểm mốc** không gọi API quyền GPS.
- Tọa độ thiết bị không được ghi vào Zustand, AsyncStorage hoặc PostgreSQL.

## Dữ liệu điểm mốc có thể tái lập

Sau khi pull code trên máy khác:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run prisma:seed
npm.cmd run prisma:seed:verify
```

Seed tạo ba điểm mốc: Cầu Rồng Đà Nẵng, Bãi biển Mỹ Khê và Phố cổ Hội An.

## Cách test trên ứng dụng

1. Chạy API: `npm.cmd run dev:api`.
2. Chạy Expo: `npm.cmd run dev:mobile`.
3. Đăng nhập User và vào **Tìm kiếm**.
4. Chọn ngày nhận/trả phòng hợp lệ và số khách.
5. Bấm **Tìm khách sạn gần tôi / gần điểm mốc**.
6. Kiểm tra hai luồng:
   - Chọn **Vị trí hiện tại**, cấp quyền GPS và bấm tìm.
   - Chọn **Điểm mốc**, chọn một điểm seed rồi bấm tìm. Luồng này không được hiện hộp thoại xin quyền GPS.
7. Đổi bán kính 2/5/10/25 km và cách sắp xếp **Gần nhất/Đề xuất**.
8. Mỗi thẻ kết quả phải hiện khoảng cách do server trả về và chỉ gồm khách sạn còn phòng.

## Test API nhanh

```http
GET /api/hotels/nearby?latitude=16.0611&longitude=108.2277&radiusKm=5&checkIn=2026-12-14&checkOut=2026-12-16&adults=2&children=0&rooms=1
GET /api/hotels/nearby?landmark=Ph%E1%BB%91%20c%E1%BB%95%20H%E1%BB%99i%20An&radiusKm=5&checkIn=2026-12-14&checkOut=2026-12-16&adults=2&children=0&rooms=1
```

Response có `anchor`, `items[].distanceMeters`, `pagination`, `criteria` và `facets`.

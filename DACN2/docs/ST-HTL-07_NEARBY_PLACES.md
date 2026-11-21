# ST-HTL-07 — Địa điểm lân cận của khách sạn

## Phạm vi

- API công khai `GET /api/hotels/:hotelId/nearby-places`.
- Chỉ trả dữ liệu cho khách sạn `APPROVED`, đang hiển thị và chưa bị xóa.
- Nguồn tên, địa chỉ và tọa độ địa điểm là OpenStreetMap qua Photon, không sinh dữ liệu giả.
- Khoảng cách đường chim bay được backend tính từ tọa độ khách sạn.
- Kết quả được cache trong bảng `NearbyPlaceCache` trong 24 giờ.
- Nếu OpenStreetMap tạm lỗi, API dùng cache cũ; nếu chưa có cache thì trả danh sách trống và không làm lỗi trang chi tiết khách sạn.

## Tham số

```http
GET /api/hotels/:hotelId/nearby-places?category=ATTRACTION&limit=20
```

`category` không bắt buộc, nhận một trong: `ATTRACTION`, `BEACH`, `FOOD`, `SHOPPING`, `TRANSPORT`, `HEALTHCARE`, `EDUCATION`. `limit` từ 1 đến 30.

## Cách kiểm thử

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
```

Lấy `id` của một khách sạn đã duyệt có `latitude` và `longitude`, sau đó mở:

```text
http://localhost:3000/api/hotels/<HOTEL_ID>/nearby-places
```

Trong ứng dụng, mở chi tiết khách sạn. Section **Địa điểm lân cận** sẽ xuất hiện khi nguồn có dữ liệu; bấm **Xem tất cả** để lọc theo loại và mở tên, địa chỉ địa điểm trên Google Maps.

Kiểm tra cache trong pgAdmin:

```sql
SELECT "hotelId", name, address, category, "distanceMeters", "fetchedAt", "expiresAt"
FROM "NearbyPlaceCache"
ORDER BY "hotelId", "distanceMeters";
```

Khách sạn không có tọa độ phải trả `hasLocation: false`. Khách sạn chưa duyệt hoặc bị ẩn phải trả `404`.

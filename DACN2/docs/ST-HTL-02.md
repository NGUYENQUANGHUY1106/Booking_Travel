# ST-HTL-02 – Tìm kiếm khách sạn theo điều kiện lưu trú

## Phạm vi đã triển khai

- Luồng tìm kiếm: điểm đến → ngày lưu trú → số người/phòng → kết quả.
- Chỉ trả về khách sạn `APPROVED`, đang hiển thị và có ít nhất một hạng phòng `ACTIVE` phù hợp.
- Kiểm tra sức chứa người lớn, trẻ em, số phòng và tồn phòng cho toàn bộ khoảng `[check-in, check-out)`.
- Kết quả có phân trang và giá tham khảo cho toàn bộ kỳ lưu trú.
- Tìm điểm đến theo tên khách sạn, địa chỉ, phường/xã, quận/huyện, thành phố hoặc tỉnh.
- Tìm kiếm không giữ phòng; tồn phòng chỉ được giữ ở bước đặt phòng.

## API

```http
GET /api/hotels/search?destination=Đà%20Nẵng&checkIn=2026-12-10&checkOut=2026-12-13&adults=2&children=1&rooms=1&page=1&limit=20
```

Phản hồi gồm `items`, `pagination` và `criteria`. Mỗi khách sạn có thêm:

- `stayNights`: số đêm.
- `stayPriceFrom`: giá tham khảo thấp nhất cho số phòng và toàn bộ kỳ lưu trú.

## Cách kiểm tra

1. Chạy PostgreSQL và thiết lập `.env`.
2. Nạp dữ liệu bằng `npm.cmd run db:setup` ở thư mục gốc.
3. Chạy API: `npm.cmd run dev:api`.
4. Chạy ứng dụng: `npm.cmd run dev:mobile`.
5. Mở **Tìm kiếm**, lần lượt chọn điểm đến, ngày tương lai, số khách và số phòng.
6. Xác nhận khách sạn hết phòng hoặc không đủ sức chứa không xuất hiện; thay đổi điều kiện để kiểm tra lại.

Kiểm thử tự động:

```powershell
npm.cmd run test --workspace @booking-travel/api -- --runInBand
npm.cmd run test:traveler --workspace @booking-travel/mobile
```

Kiểm thử PostgreSQL chuyên biệt (cần database test đã cấu hình):

```powershell
$env:RUN_DB_INVENTORY_E2E='1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand room-inventory-db.e2e-spec.ts
```

## Ngoài phạm vi task

- Bộ lọc/facet nâng cao thuộc ST-HTL-03.
- Lưu và hiển thị lịch sử tìm kiếm thuộc ST-USR-04.

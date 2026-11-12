# ST-OWN-09 — Quản lý giá phòng theo ngày và mùa

## Nguồn và phạm vi

- SRS `FR-OWN-09`, Figma Owner `OWN-UI-17` (lịch giá phòng), màn User dùng giá công khai theo ngày.
- Dữ liệu thật của `Room` (hạng phòng OWN-07) và lịch tồn phòng OWN-08. `Room.basePrice` cũ vẫn là giá chuẩn.
- `PricingModule` trước task này rỗng; màn lịch giá là dữ liệu Figma cố định, còn tạo booking nhân giá chuẩn cho mọi đêm.
- Các tài liệu đặc tả khác nêu trong prompt ngoài SRS và Project Overview chưa có trong repo này. Thứ tự ưu tiên dưới đây theo đề xuất của prompt vì SRS chưa khóa thứ tự cụ thể.

## Quy tắc giá

Mỗi đêm lưu trú thuộc `[checkIn, checkOut)` theo ngày lịch Việt Nam. `RoomPricingRule` có giá tuyệt đối VND, khoảng ngày với `endDateExclusive`, loại rule và trạng thái hiệu lực. Số tiền dùng `Decimal(14,2)`; tổng tiền được cộng bằng `Prisma.Decimal` trên server.

Thứ tự ưu tiên: **DATE > HOLIDAY > SEASON > WEEKDAY/WEEKEND > basePrice**. Quy tắc cùng cấp chồng lên cùng một đêm bị từ chối với mã rule và ngày xung đột. `WEEKDAY` chỉ áp dụng thứ Hai–Sáu, `WEEKEND` chỉ áp dụng thứ Bảy–Chủ nhật. `HOLIDAY` do Chủ cấu hình bằng tên và ngày. Xóa rule chuyển `active=false`, giá đêm đó trở về cấp ưu tiên thấp hơn. Tồn phòng/khóa bán hiển thị riêng và không xóa giá.

Tất cả mutation khóa theo `roomId`, kiểm tra `Room.pricingVersion`, tăng version sau khi lưu và ghi `RoomPricingAudit` gồm người thao tác, thời điểm, dữ liệu trước/sau. Sửa `basePrice` ở màn hạng phòng cũ cũng tăng version và tạo audit. Giá quá khứ và giá không dương bị từ chối. Khoảng giá tối đa 366 đêm.

## Quyền và trạng thái

| Trạng thái khách sạn | Chủ xem lịch | Chủ sửa giá | Khách xem giá/đặt mới |
| --- | --- | --- | --- |
| DRAFT, REJECTED | Có | Có | Không |
| PENDING | Có | Không | Không |
| APPROVED, hiển thị | Có | Có | Có nếu phòng ACTIVE |
| APPROVED, đang ẩn | Có | Có | Không |
| SUSPENDED | Có | Không | Không |

Mọi API Owner yêu cầu `HOTEL_OWNER`, xác minh `hotelId + roomId + ownerId`. Giá công khai chỉ trả về phòng ACTIVE thuộc khách sạn APPROVED và hiển thị. Booking dùng cùng `PricingService.loadRates` bên trong giao dịch giữ khóa phòng; `totalAmount` và `nightlyRatesSnapshot` lưu cố định khi tạo. `pricePerNight` cũ giữ giá đêm đầu để tương thích; khi giá thay đổi theo đêm, dùng `nightlyRatesSnapshot` để hiện chi tiết.

## API

- `GET /owner/hotels/:hotelId/rooms/:roomId/pricing?month=YYYY-MM`: lịch tháng, giá từng ngày, nguồn rule, tồn phòng, version, danh sách rule.
- `PUT .../pricing/base`: `{ price, expectedVersion }`.
- `POST .../pricing/preview`: `{ kind, label?, startDate, endDateExclusive, price, expectedVersion, ruleId? }`; trả giá trước/sau theo ngày. `ruleId` dùng khi xem trước sửa rule.
- `POST .../pricing/rules`: tạo rule; một `DATE` với khoảng ngày là thao tác cập nhật nhiều ngày.
- `PATCH .../pricing/rules/:ruleId`: sửa rule, yêu cầu version.
- `DELETE .../pricing/rules/:ruleId`: body `{ expectedVersion }`, ngừng hiệu lực.
- `GET /rooms/:roomId/pricing?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&roomCount=1`: giá công khai và tổng tiền phòng theo ngày, chưa gồm thuế/phí/voucher.
- `POST /bookings/quote`: kiểm tra sức chứa và tồn phòng, trả giá từng đêm và tổng theo số phòng.
- `POST /bookings`: kiểm tra lại và lưu snapshot trong cùng giao dịch, không tin giá từ client.

## Giao diện và thử thủ công

Từ Dashboard Chủ bấm **Cập nhật giá**, hoặc từ chi tiết chỗ ở/hạng phòng bấm **Lịch giá phòng**. Chọn khách sạn, hạng phòng, tháng, một ngày hoặc khoảng ngày; bấm **Cập nhật giá**. Chọn loại rule, nhập giá, bấm **Xem trước thay đổi**, rồi **Xác nhận lưu**. Danh sách rule bên dưới lịch cho phép sửa/xóa. Thử hai thiết bị cùng mở lịch: thiết bị lưu sau nhận HTTP 409 và phải tải lại. Ngày bị khóa bán vẫn có giá nhưng không thể đặt.

Frame Owner giữ bố cục header, tháng, hạng phòng, lưới 7 ngày, chú giải, thẻ ngày chọn; bổ sung CTA cập nhật giá và trình sửa. Nút AI và Ưu đãi chưa nối dịch vụ thực nên hiện trạng thái chưa khả dụng, không hiển thị số liệu giả. Màn Khách hiển thị giá theo ngày từ server khi đã có khoảng lưu trú; giá chuẩn được ghi là tham khảo khi chưa tải giá theo ngày. Luồng thanh toán trên mobile còn là demo của BKG-01, đã chặn tiếp tục thanh toán cho phòng thật để không hiển thị tổng giả. `HTL-09`, `AI-10`, `OWN-10` chưa được nhận là hoàn tất trong task này.

## Cài đặt và kiểm tra

Từ `DACN2` trên Windows:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test --workspace @booking-travel/api -- --runInBand
```

Migration: `20261111100000_st_own_09_room_pricing`. Để chạy bài kiểm thử tích hợp PostgreSQL sau khi cấu hình `.env` và migrate:

```powershell
$env:RUN_DB_PRICING_E2E='1'
npm.cmd run test:e2e -- --runInBand room-pricing-db.e2e-spec.ts
```

Sau đó mở hai terminal ở `DACN2`: `npm.cmd run dev:api` và `npm.cmd run dev:mobile`.

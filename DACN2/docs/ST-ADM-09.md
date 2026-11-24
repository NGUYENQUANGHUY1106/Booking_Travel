# ST-ADM-09 — Voucher toàn nền tảng

## Phạm vi và quyền

Voucher trong bảng `PlatformVoucher` có `source=PLATFORM`, do Booking Travel tài trợ. Chỉ tài khoản `ADMIN` có quyền `PROMOTION_MANAGEMENT` được xem, tạo, sửa, kích hoạt, tạm dừng hoặc kết thúc. Chủ khách sạn không có endpoint sửa voucher nền tảng. Tài khoản admin demo đã được cấp quyền bằng migration; `prisma:seed` cũng cấp quyền cho lần nạp mới.

ST-OWN-10 bổ sung ưu đãi của Chủ khách sạn trên nhánh tính năng riêng. Checkout chỉ áp **một** ưu đãi Chủ hoặc **một** voucher nền tảng; khi khách nhập mã nền tảng, mã đó được ưu tiên và không cộng dồn. Xem [ST-OWN-10](./ST-OWN-10.md) để biết quy tắc và cách kiểm tra sau khi nhánh được nhập vào `develop`.

## Cài đặt

Từ `DACN2`, dùng cùng `DATABASE_URL` của API:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
```

Hai migration `20261119100000_platform_vouchers` và `20261119101000_platform_voucher_demo_admin_permission` tạo schema/index/constraints, bổ sung snapshot booking và cấp quyền admin seed hiện có. Không cần chạy lại seed để giữ nguyên dữ liệu đang dùng. Khi tạo dữ liệu mẫu mới có thể chạy `npm.cmd run prisma:seed`.

## Quản trị và API

Vào **Admin → Ưu đãi**, dùng dữ liệu API thật. Các endpoint đều có tiền tố `/api`, yêu cầu Bearer token Admin:

| Phương thức | Đường dẫn | Chức năng |
| --- | --- | --- |
| GET | `/admin/campaigns` | Tìm kiếm, lọc, sắp xếp, phân trang; `status`, `scope`, `discountType`, `search`, `sort`, `page`, `limit` |
| GET | `/admin/campaigns/:id` | Chi tiết, số dư, nhật ký 50 sự kiện gần nhất |
| POST | `/admin/campaigns` | Tạo bản nháp |
| PATCH | `/admin/campaigns/:id` | Sửa bản nháp/chương trình tạm dừng chưa từng được dùng; cần `version`, `reason` |
| POST | `/admin/campaigns/:id/activate`, `/pause`, `/end` | Đổi trạng thái; cần `version`, `reason` |
| GET | `/admin/campaigns/:id/redemptions` | Lượt dùng và trạng thái, phân trang; không trả danh sách khách đủ điều kiện |
| POST | `/admin/campaigns/:id/preview` | Tính thử bằng ID phòng, ID khách, `checkIn`, `checkOut`, `roomCount`; không giữ quota |

Ví dụ tạo mã giảm 10%:

```json
{
  "code": "TRAVEL10",
  "title": "Ưu đãi tháng 11",
  "discountType": "PERCENT",
  "discountValue": "10",
  "maxDiscount": "300000",
  "minSpend": "500000",
  "minNights": 1,
  "currency": "VND",
  "startsAt": "2026-11-20T00:00:00+07:00",
  "endsAt": "2026-12-01T00:00:00+07:00",
  "hotelIds": [],
  "eligibleUserIds": [],
  "globalLimit": 100,
  "perUserLimit": 1,
  "budget": "30000000"
}
```

`hotelIds=[]` áp mọi khách sạn đang mở bán; `eligibleUserIds=[]` áp mọi tài khoản đủ điều kiện. Danh sách có ID cụ thể chỉ giới hạn phạm vi, được kiểm tra trên server. Mã được cắt khoảng trắng và viết hoa; DB có unique trên mã chuẩn hóa. Mọi thao tác ghi lưu Admin, lý do, dữ liệu trước/sau và thời điểm trong `PlatformVoucherAudit`. `version` ngăn hai Admin ghi đè nhau; giao diện yêu cầu tải lại khi có xung đột.

## Quy tắc tính giá và giữ lượt

- Quote `POST /api/bookings/quote` nhận `voucherCode` tùy chọn. Backend lấy phòng, ngày, giá từng đêm, khách đăng nhập và khách sạn từ DB; client không quyết định số tiền giảm. Quote trả `roomSubtotal`, `discounts[]`, `finalAmount` và mã quote ký. Lỗi điều kiện trả `code` cụ thể như `VOUCHER_EXPIRED`, `VOUCHER_EXHAUSTED`, `VOUCHER_USER_LIMIT`.
- Thời gian hiệu lực là `startsAt <= thời gian server < endsAt`. Ngày nhập phải kèm múi giờ. Tính tiền VND bằng Prisma Decimal; phần trăm làm tròn HALF_UP tới đồng, áp trần giảm và không cho tổng phải trả bằng 0 hoặc âm. Hiện không có thuế/phí trong pricing này; nhánh ST-OWN-10 bổ sung ưu đãi Chủ theo quy tắc không cộng dồn.
- Quote chỉ xem trước. Lúc tạo booking, server kiểm tra lại giá, phiên bản voucher, phạm vi, quota và ngân sách, khóa hàng voucher bằng PostgreSQL `FOR UPDATE` trong cùng transaction tạo booking. DB cấm tổng lượt/tiền giữ và đã dùng vượt giới hạn; mỗi booking có một redemption duy nhất.
- `PAY_AT_HOTEL` tiêu thụ lượt ngay khi booking được tạo. `SIMULATOR` giữ lượt đến hạn thanh toán; webhook thành công chuyển `RESERVED → CONSUMED`, hết hạn hoặc hủy trước thanh toán chuyển `RESERVED → RELEASED`. Worker hết hạn và callback lặp chạy an toàn theo trạng thái. Thanh toán lấy `Booking.totalAmount` đã chốt; `Booking.voucherSnapshot` giữ mã, nguồn tài trợ, quy tắc và số tiền giảm của thời điểm đặt phòng.
- Khi đã `CONSUMED`, hủy/hoàn tiền không tự trả lại quota hoặc ngân sách. Callback thành công sau khi booking hết hạn đi theo quy trình đối soát thanh toán hiện hành và không trừ voucher lần hai. `DRAFT/PAUSED/ENDED`, chưa tới hạn, hết hạn, hết quota/ngân sách không nhận lượt mới.

## Kiểm thử

Từ `DACN2`, sau khi migration và seed được nạp vào PostgreSQL local:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test -- --runInBand platform-vouchers.service.spec bookings.quote.spec
node --env-file=.env .\node_modules\jest\bin\jest.js --config apps/booking-travel-be/test/jest-e2e.json --runInBand platform-vouchers-api.e2e-spec platform-vouchers.e2e-spec
$env:RUN_DB_PAYMENT_E2E = '1'
node --env-file=.env .\node_modules\jest\bin\jest.js --config apps/booking-travel-be/test/jest-e2e.json --runInBand payments-db.e2e-spec payment-webhook-db.e2e-spec
```

Kiểm thử API xác nhận 401/403 và Admin có quyền. Kiểm thử DB tạo hai checkout đồng thời khi chỉ còn một lượt và 100.000 ₫ ngân sách, kiểm số tiền booking/snapshot/ledger/counter, rồi dọn dữ liệu thử. Với Expo, đăng nhập Admin vào **Ưu đãi** để tạo/kích hoạt mã; đăng nhập User, chọn phòng/ngày, vào **Nhập mã ưu đãi**, xem breakdown và hoàn tất booking. Kiểm tra lại trong Admin ở chi tiết voucher → **Lượt sử dụng**.

## Giới hạn tích hợp

`Booking.voucherSnapshot.source` và `VoucherRedemption.amount` tách phần nền tảng; ST-OWN-10 lưu snapshot và usage riêng cho phần Chủ tài trợ. Báo cáo tài chính cần đọc đúng nguồn; không suy ra doanh thu khách sạn bằng cách trừ voucher nền tảng khỏi doanh thu Chủ.

# ST-OWN-10 — Ưu đãi của khách sạn

## Cài đặt và dùng thử

Từ `DACN2`, dùng cùng `DATABASE_URL` với API:

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
```

Mở terminal thứ hai tại `DACN2`: `npm.cmd run dev:mobile`. Đăng nhập tài khoản Chủ khách sạn đã xác minh, vào **Ưu đãi** từ dashboard hoặc màn giá phòng, chọn khách sạn, tạo bản nháp, xem giá minh họa rồi kích hoạt. Đăng nhập User, chọn khách sạn/phòng/ngày thuộc chương trình để xem dòng **Khách sạn tài trợ** trong báo giá, sau đó tạo booking. Quay lại màn Ưu đãi để xem lượt đã dùng/đang giữ/còn lại. Cần khách sạn và phòng đang được phép mở bán để User đặt phòng.

## Quy tắc nghiệp vụ

- Chỉ `HOTEL_OWNER` đã `VERIFIED` được quản lý chương trình của khách sạn mình; danh sách phòng phải thuộc khách sạn đó. API dùng token và kiểm tra quyền trên server. Chương trình không làm khách sạn bị ẩn/đình chỉ trở nên đặt được.
- `startsAt <= thời điểm server < endsAt` là thời gian **đặt phòng** được giảm. `[stayStart, stayEnd)` là khoảng **đêm lưu trú** được giảm; ngày trả phòng không tính là một đêm. Form hiển thị ngày cuối cùng theo giờ Việt Nam, API lưu thời điểm hiệu lực có offset `+07:00` và ngày lưu trú dạng `YYYY-MM-DD`. `minNights` xét toàn bộ kỳ ở. Nếu kỳ ở chỉ giao một phần khoảng lưu trú của chương trình, chỉ những đêm giao nhau được giảm.
- Giá từng đêm lấy từ ST-OWN-09, sau đó nhân số phòng và tính giảm bằng `Prisma.Decimal`. Giảm phần trăm làm tròn `HALF_UP` đến một đồng; giảm cố định áp **một lần cho cả booking**, không nhân theo đêm hoặc số phòng. Giảm không vượt giá các đêm đủ điều kiện, trần tiền giảm, và không tạo booking có tổng thanh toán bằng 0. Tiền tệ hiện hỗ trợ `VND`.
- Nếu nhiều ưu đãi Chủ hợp lệ cùng lúc, chọn **một ưu đãi có số tiền giảm lớn nhất**, cùng số tiền thì chọn ID nhỏ hơn. Khi khách nhập mã voucher nền tảng, voucher đó được ưu tiên; không cộng dồn ưu đãi Chủ. Báo giá trả `promotionReasonCode=OWNER_PROMOTION_NOT_STACKABLE_WITH_PLATFORM_VOUCHER` khi có ưu đãi Chủ hợp lệ bị loại bởi voucher nền tảng.
- Báo giá không giữ lượt. Tạo booking kiểm tra lại ID/phiên bản, giá, trạng thái, phạm vi và quota trong transaction; khóa hàng ưu đãi bằng `FOR UPDATE`. `PAY_AT_HOTEL` tiêu thụ lượt ngay, `SIMULATOR` giữ lượt đến hạn thanh toán. Callback thành công chuyển lượt giữ thành đã dùng; hết hạn/thất bại/hủy trước thanh toán giải phóng. Lặp callback không trừ lượt lần hai. Booking đã tạo giữ `ownerPromotionSnapshot` và `totalAmount` ngay cả khi Chủ tạm dừng/kết thúc chương trình. Hoàn tiền không tự trả lại lượt đã dùng.
- Chỉ sửa bản nháp hoặc chương trình tạm dừng **chưa có lượt sử dụng**. Kích hoạt, tạm dừng, kết thúc là lệnh riêng, kiểm phiên bản, có audit; tạm dừng/kết thúc cần lý do. `ENDED` không thể bật lại. Chương trình ACTIVE quá hạn hiện là `EXPIRED` trên danh sách.

## API

Các đường dẫn có tiền tố `/api`:

| Phương thức | Đường dẫn | Ý nghĩa |
| --- | --- | --- |
| GET | `/owner/hotels/:hotelId/promotions?status=&page=&limit=` | Danh sách, trạng thái và số lượt thật |
| GET | `/owner/hotels/:hotelId/promotions/:id` | Chi tiết |
| POST | `/owner/hotels/:hotelId/promotions` | Tạo bản nháp |
| PATCH | `/owner/hotels/:hotelId/promotions/:id` | Sửa với `version` |
| POST | `/owner/hotels/:hotelId/promotions/:id/activate`, `/pause`, `/end` | Chuyển trạng thái với `version`; pause/end có `reason` |
| POST | `/owner/hotels/:hotelId/promotions/preview` | Giá minh họa từ lịch giá thật, không tiêu quota |
| POST | `/bookings/quote` | Tự chọn ưu đãi hợp lệ, trả `discounts[]`, `finalAmount` và quote ký |

Hai migration `20261121120000_owner_promotions` và `20261121121000_owner_promotion_source` tạo dữ liệu, khóa duy nhất mỗi booking, ràng buộc quota/counter, index và snapshot. Không chạy `db:setup` để thử nếu cần giữ dữ liệu hiện có.

## Kiểm tra

```powershell
node --env-file=.env .\node_modules\prisma\build\index.js validate --schema apps/booking-travel-be/prisma/schema.prisma
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test --workspace @booking-travel/api -- --runInBand
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand test/owner-promotions.e2e-spec.ts
```

E2E cần database đã migrate và `prisma:seed`; bài test tạo chương trình riêng rồi dọn fixture của mình. Kiểm tra hai booking đồng thời khi quota bằng 1: chỉ một booking được hưởng, booking và usage có snapshot/counter đúng. Test đơn vị kiểm giá theo đêm, scope, version, vòng đời và settle lặp.

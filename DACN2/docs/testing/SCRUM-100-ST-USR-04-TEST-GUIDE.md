# Kiểm thử SCRUM-100 · Lịch sử tìm kiếm và khách sạn đã xem

## Chuẩn bị

Chạy các lệnh tại thư mục `DACN2` bằng DB dev PostgreSQL đã cấu hình.

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
```

Mở terminal riêng, chạy `npm.cmd run dev:mobile`. Mở web bằng `w` hoặc quét QR Expo Go. Dùng một khách sạn công khai có dữ liệu phòng để tìm kiếm và hai tài khoản khách khác nhau.

## Kiểm thử giao diện

1. Vào **Tài khoản → Lịch sử hoạt động**, hoặc **Tìm kiếm → Lịch sử hoạt động**. Kiểm tra lịch sử trống và mặc định tắt với tài khoản mới.
2. Bấm **Bật lưu lịch sử**, tìm khách sạn theo điểm đến, ngày, số khách và phòng. Chọn thêm khoảng giá hoặc loại lưu trú. Khi xem kết quả trang đầu, điều kiện được ghi vào lịch sử.
3. Mở chi tiết một khách sạn công khai, quay lại rồi mở lại chính khách sạn đó. Kiểm tra danh sách chỉ có một dòng và thời gian xem được cập nhật.
4. Mở lịch sử, bấm **Tìm lại** và đối chiếu ngày, khách, phòng, bộ lọc và sắp xếp. Nếu ngày đã qua, app yêu cầu chọn ngày mới.
5. Làm mới trình duyệt, đăng xuất rồi đăng nhập lại. Lịch sử của cùng tài khoản được giữ. Đổi sang tài khoản khác và kiểm tra dữ liệu tách riêng.
6. Thử **Xóa tìm kiếm**, **Xóa lượt xem** và **Xóa toàn bộ lịch sử**. Thử giữ lịch sử ở hộp xác nhận và kiểm tra chỉ xác nhận xóa mới có hiệu lực. **Tắt lưu lịch sử** xóa dữ liệu hiện tại sau khi xác nhận.
7. Admin ẩn hoặc đình chỉ một khách sạn đã xem. Lịch sử tài khoản không còn trả khách sạn đó. Với khách vãng lai, **Xem lại** bỏ mục không còn truy cập được và hiện thông báo.
8. Khi đăng xuất, bật lưu trên thiết bị rồi thực hiện lại một tìm kiếm và một lượt xem. Lịch sử cục bộ còn sau khi tải lại, tách với lịch sử của tài khoản đăng nhập.

## API và dữ liệu

Đường dẫn gốc `/api/users/me/travel-history` sử dụng access token của tài khoản. Các endpoint thao tác theo token.

| Phương thức và đường dẫn | Nội dung |
| --- | --- |
| GET | Thiết lập đồng ý, tối đa 50 tìm kiếm và 50 khách sạn gần nhất |
| PUT /consent | Body `{"enabled": true}` để bật. `false` xóa lịch sử và dừng lưu |
| POST /searches | Body theo điều kiện tìm kiếm lưu trú hiện tại |
| POST /hotels | Body `{"hotelId": "<id>"}` |
| DELETE /searches/:id | Xóa một tìm kiếm của mình |
| DELETE /hotels/:hotelId | Xóa một khách sạn khỏi lịch sử của mình |
| DELETE | Xóa toàn bộ, giữ thiết lập đồng ý |

Ví dụ body tìm kiếm:

```json
{
  "destination": "Đà Nẵng",
  "checkIn": "2090-11-30",
  "checkOut": "2090-12-02",
  "adults": 2,
  "children": 1,
  "rooms": 2,
  "minPrice": 100000,
  "maxPrice": 2000000,
  "sort": "priceAsc"
}
```

Thành công trả `{"recorded": true}`. Khi người dùng chưa bật lưu hoặc khách sạn không còn công khai, trả `{"recorded": false}`. Yêu cầu thiếu token trả 401. Xóa ID của tài khoản khác trả `{"removed": 0}`.

## Kiểm thử tự động

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test --workspace @booking-travel/api -- --runInBand
npm.cmd run build
$env:RUN_DB_HISTORY_E2E = '1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand travel-history.e2e-spec.ts
```

Chạy E2E với DB kiểm thử đã migrate. Test tạo hai tài khoản và khách sạn riêng, rồi dọn dữ liệu. Trên Windows đã xác minh migration lịch sử trong DB riêng. Bản PostgreSQL cục bộ thiếu `pgvector`, nên migration embedding không liên quan được đánh dấu riêng trong DB thử nghiệm.

- E2E PostgreSQL đạt kiểm tra đăng nhập lại, cách ly tài khoản, bỏ dòng trùng, ẩn khách sạn ngừng hoạt động và xóa lịch sử.
- Export web, iOS và Android thành công. Chưa kiểm tra trên điện thoại thật.
- Kiểm tra Edge ở 1280×800 và 375×667 bằng API mô phỏng. Lịch sử cục bộ ghi nhận từ tìm kiếm và chi tiết, giữ qua tải lại, tìm lại đúng bộ lọc, bỏ khách sạn không còn công khai và xóa theo thao tác đã chọn.
- Lint, TypeScript và build Nest đạt. 343 backend test đạt, 10 test được bỏ qua mặc định theo cấu hình.

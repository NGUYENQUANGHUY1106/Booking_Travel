# Kiểm thử SCRUM-101 · Gợi ý khách sạn cá nhân hóa

## Cách xếp hạng

Trang chủ lấy khách sạn đang mở bán từ PostgreSQL. Với tài khoản đăng nhập, API dùng sở thích do chính tài khoản khai báo trong **Tài khoản → Sở thích du lịch**. Các tín hiệu xếp hạng là ngân sách, loại chỗ ở, tiện nghi, khu vực được xác nhận trong dữ liệu và tiện nghi phù hợp loại chuyến đi. Tính năng chạy trong NestJS và PostgreSQL, không cần model, API key hay phí gọi dịch vụ AI.

| Tín hiệu | Điểm |
| --- | --- |
| Giá phòng từ nằm trong ngân sách, hoặc giá trung bình mỗi phòng mỗi đêm của kỳ lưu trú nằm trong ngân sách | 5 |
| Loại chỗ ở đã chọn | 4 |
| Mỗi tiện nghi khớp | 2, tối đa 6 |
| Mỗi đặc điểm khu vực khớp | 2, tối đa 4 |
| Tiện nghi phù hợp loại chuyến đi, chưa được tính ở nhóm tiện nghi | 1 |
| Điểm đánh giá, có điều chỉnh theo số lượt đánh giá | Tối đa 2,5 |

Điểm đánh giá điều chỉnh là `(điểm trung bình × số lượt + 7 × 5) / (số lượt + 5)`. Khách sạn chưa có đánh giá nhận 0 điểm chất lượng. Nếu bằng điểm, ưu tiên số lượt đánh giá rồi ID để thứ tự ổn định. Khách vãng lai, tài khoản mới và trường hợp chưa khớp sở thích nhận danh sách khám phá. API dùng ngày, số khách và số phòng đang chọn để kiểm tra phòng bán được. Hệ thống chỉ giải thích các thuộc tính có dữ liệu trong khách sạn.

Lịch sử tìm kiếm, xem hoặc đặt phòng không tham gia xếp hạng theo lựa chọn phạm vi đã xác nhận. Khi dữ liệu khách sạn thiếu tiện nghi hoặc đặc điểm khu vực đã chuẩn hóa, mục tương ứng không góp điểm. Hiện API xếp hạng từ tập khách sạn phù hợp trong luồng truy vấn công khai hiện có, lấy tối đa 12 kết quả và không truy vấn theo từng khách sạn.

## Chuẩn bị và thử trên ứng dụng

Chạy từ `DACN2` với PostgreSQL đã áp dụng migration của `develop`.

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run dev:api
```

Mở terminal thứ hai và chạy `npm.cmd run dev:mobile`. Nhấn `w` để mở web hoặc quét QR trong Expo Go.

1. Tạo hoặc chọn ít nhất hai khách sạn đã duyệt và đang mở bán, trong cùng điểm đến. Ví dụ homestay `500.000 ₫/đêm` và resort `2.500.000 ₫/đêm`. Dùng ảnh và loại chỗ ở đúng dữ liệu của khách sạn.
2. Với tài khoản A, lưu ngân sách đến `600.000 ₫` và chọn Homestay. Mở **Trang chủ → Gợi ý theo sở thích**. Homestay phù hợp phải đứng trước resort, cùng lý do khớp.
3. Đăng xuất, đăng nhập tài khoản B. Lưu ngân sách từ `2.000.000 ₫` và chọn Resort. Thứ tự phải đổi. Tài khoản mới chưa có hồ sơ thấy **Khách sạn gợi ý**.
4. Quay lại hồ sơ sở thích và đặt lại. Sau khi quay về trang chủ, kiểm tra tiêu đề và thứ tự cập nhật.
5. Tìm phòng với ngày và số phòng khiến một khách sạn hết chỗ, rồi về trang chủ. Khách sạn hết chỗ không xuất hiện trong gợi ý theo kỳ lưu trú. Bấm thẻ để mở đúng chi tiết khách sạn.
6. Tạm dừng API rồi tải lại ứng dụng. Mục gợi ý hiện lỗi và nút **Thử lại**. Sau khi khởi động lại API, bấm thử lại.

## API

`GET /api/ai/hotel-recommendations?limit=6` hỗ trợ khách vãng lai và đăng nhập. Gửi `Authorization: Bearer <access-token>` để áp dụng sở thích đã lưu. Tham số tùy chọn là `search`, `checkIn`, `checkOut`, `rooms`, `adults`, `children` và `limit` từ 1 đến 12. Ngày lưu trú phải có cả hai đầu.

```powershell
Invoke-RestMethod 'http://localhost:3000/api/ai/hotel-recommendations?limit=3'
```

Thay cổng theo `API_PORT`. API trả `mode: PERSONALIZED` nếu có kết quả khớp sở thích, hoặc `mode: DISCOVERY` khi dùng điểm công khai. Mỗi phần tử `items` có `hotel` và mảng `reasons`. Khi không có khách sạn đủ điều kiện, kết quả là:

```json
{ "mode": "DISCOVERY", "items": [] }
```

## Kiểm thử tự động

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test --workspace @booking-travel/api -- --runInBand
npm.cmd run build
$env:RUN_DB_RECOMMENDATIONS_E2E = '1'
npm.cmd run test:e2e --workspace @booking-travel/api -- --runInBand hotel-recommendations.e2e-spec.ts
```

E2E dùng cơ sở dữ liệu thử đã migrate. Test tạo và xóa ba tài khoản cùng khách sạn thử. Kịch bản đã đạt trên PostgreSQL riêng, xác nhận thứ hạng theo hồ sơ, khách mới, quyền truy cập, giới hạn kết quả, khách sạn ẩn và tồn phòng. PostgreSQL Windows thiếu `pgvector`, nên migration embedding được đánh dấu riêng trong DB thử nghiệm để chạy bài test này.

- Lint, TypeScript và build Nest đạt. Backend có 345 test đạt và 10 test điều kiện bỏ qua mặc định.
- Export Expo web, iOS và Android thành công. Edge 1280×800 và 375×667 với API mô phỏng đã kiểm tra trạng thái lỗi, thử lại, danh sách rỗng, lý do gợi ý, loại mục trùng và mở chi tiết khách sạn. Chưa chạy trên điện thoại thật.

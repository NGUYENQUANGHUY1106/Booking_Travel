# ST-BKG-08 – Hủy booking

## Quy tắc nghiệp vụ

- Tài khoản `USER` hoặc `HOTEL_OWNER` chỉ được hủy booking do chính tài khoản đó đặt.
- Chỉ booking `PENDING_PAYMENT` hoặc `CONFIRMED` được hủy.
- Người dùng được hủy đến hết ngày liền trước ngày check-in (múi giờ Việt Nam).
- Từ `00:00` ngày check-in trở đi, API trả lỗi `CANCELLATION_CUTOFF_PASSED`.
- Gọi lại yêu cầu hủy cho booking đã `CANCELLED` trả cùng kết quả, không giải phóng tồn phòng lần thứ hai.
- Booking `CANCELLED` tự động không còn được tính vào lượng phòng đã giữ.

## API

```http
PATCH /api/bookings/:id/cancel
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "reason": "Thay đổi kế hoạch chuyến đi"
}
```

Kết quả gồm trạng thái hủy, phí hủy, số tiền hoàn dự kiến và xác nhận tồn phòng đã được giải phóng. Việc tạo và xử lý yêu cầu hoàn tiền thực tế thuộc ST-BKG-09.

## Kiểm thử thủ công

1. Chạy `npm.cmd run prisma:migrate` và `npm.cmd run prisma:seed`.
2. Chạy backend bằng `npm.cmd run dev:api` và Expo bằng `npm.cmd run dev:mobile`.
3. Đăng nhập tài khoản User, vào **Đặt phòng của tôi**, mở booking có ngày check-in trong tương lai.
4. Chọn **Hủy đặt phòng**, nhập lý do ít nhất 3 ký tự và xác nhận.
5. Kiểm tra booking chuyển sang **Đã hủy**, lý do được hiển thị và phòng trở lại số lượng có thể đặt.
6. Booking có ngày check-in là hôm nay, đã check-in hoặc hoàn tất phải không có nút hủy và API phải từ chối nếu gọi trực tiếp.

Các cột dữ liệu nằm trong bảng `Booking`: `cancellationReason`, `cancellationFee`, `refundEstimate`, `cancelledAt`.

# Booking Travel Mobile

Ứng dụng Expo có hai khu vực độc lập: Traveler (`/user`) và Chủ khách sạn (`/hotel-owner`). Phần Traveler được dựng theo trang **User** của [Figma Booking Travel v1.1](https://www.figma.com/design/TaRFo9CWYKQNORVPnpmHRP/Booking-Travel-%E2%80%94-UI-UX-Design-v1.1?node-id=1-5). Các thao tác Traveler hiện dùng dữ liệu mẫu lưu trên thiết bị, chưa gọi API đặt phòng hoặc thanh toán thật.

## Chạy thử

Từ thư mục gốc `DACN2`:

```powershell
npm.cmd ci
npm.cmd run dev:mobile
```

Màn đầu là Splash. Chọn **Bắt đầu khám phá** để xem onboarding, hoặc mở `/auth/welcome` và chọn tài khoản demo. Màn đăng nhập chấp nhận email đúng định dạng và mật khẩu demo `demo123`. Mã OTP demo là `182460`. Mã ưu đãi thử: `TRAVEL12` hoặc `MYKHE12`.

Các tuyến `/user` và `/hotel-owner` có thể mở trực tiếp khi cần kiểm tra từng giao diện. Trên web, chạy `npm.cmd run web --workspace @booking-travel/mobile`; trên thiết bị, dùng Expo Go hoặc bản development build theo cấu hình Expo.

## Phạm vi demo Traveler

- Đăng nhập, đăng ký, OTP, thiết lập hồ sơ, sở thích và quyền vị trí.
- Home, tìm kiếm, lọc, sắp xếp, bản đồ minh họa, khách sạn và phòng.
- Yêu thích, so sánh tối đa bốn khách sạn, đặt phòng, thanh toán giả lập và mã QR demo.
- Lịch sử đặt phòng, trạng thái nhận/hủy/hoàn tiền, đánh giá, chat, thông báo, trợ lý du lịch mô phỏng và tài khoản.

Giá gốc tính bằng VND. Nếu chọn USD, ứng dụng hiển thị giá quy đổi tham khảo với tỷ giá cố định của bản demo. Mã QR chứa mã đặt phòng mẫu và không có giá trị xác nhận tại khách sạn thật.

## Kiểm tra

```powershell
npm.cmd run typecheck --workspace @booking-travel/mobile
npm.cmd run lint --workspace @booking-travel/mobile
npm.cmd run test:traveler --workspace @booking-travel/mobile
```

Các màn hình Traveler nằm trong `src/features/traveler`; hệ thống route nằm trong `src/app/user` và `src/app/auth`. Module Chủ khách sạn ở `src/features/hotel-owner` và `src/app/hotel-owner`.

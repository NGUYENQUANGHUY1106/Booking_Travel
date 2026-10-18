# Booking Travel Mobile

Ứng dụng Expo có ba khu vực: Traveler (`/user`), Chủ khách sạn (`/hotel-owner`) và Admin Console (`/admin`). Phần Traveler được dựng theo trang **User** của [Figma Booking Travel v1.1](https://www.figma.com/design/TaRFo9CWYKQNORVPnpmHRP/Booking-Travel-%E2%80%94-UI-UX-Design-v1.1?node-id=1-5). Các thao tác Traveler hiện dùng dữ liệu mẫu lưu trên thiết bị, chưa gọi API đặt phòng hoặc thanh toán thật.

## Chạy thử

Từ thư mục gốc `DACN2`:

```powershell
npm.cmd ci
npm.cmd run dev:mobile
```

Màn đầu là Splash. Chọn **Bắt đầu khám phá** để xem onboarding, hoặc mở `/auth/welcome` và chọn tài khoản demo. Màn đăng nhập chấp nhận email đúng định dạng và mật khẩu demo `demo123`. Mã OTP demo là `182460`. Mã ưu đãi thử: `TRAVEL12` hoặc `MYKHE12`.

Các tuyến `/user` và `/hotel-owner` có thể mở trực tiếp khi cần kiểm tra từng giao diện. Trên web, chạy `npm.cmd run web --workspace @booking-travel/mobile`; trên thiết bị, dùng Expo Go hoặc bản development build theo cấu hình Expo.

## Admin Console demo

Admin Console dùng 23 màn hình theo [trang Admin trên Figma](https://www.figma.com/design/TaRFo9CWYKQNORVPnpmHRP/Booking-Travel-%E2%80%94-UI-UX-Design-v1.1?node-id=1-8), gồm đăng nhập, dashboard, người dùng, xác minh chủ khách sạn, duyệt và quản lý chỗ ở, đặt phòng, thanh toán, báo cáo, ưu đãi, phân tích, cảnh báo AI và nhật ký. Bật phiên demo riêng trước khi chạy Expo Web:

```powershell
$env:EXPO_PUBLIC_ENABLE_ADMIN_DEMO='true'
npm.cmd run web --workspace @booking-travel/mobile
```

Mở `/auth/admin-demo`, đăng nhập bằng `admin@bookingtravel.vn` / `admin123`, rồi vào `/admin`. Cờ demo mặc định tắt; USER và HOTEL_OWNER không thể mở Admin Console. Đây là phiên và mật khẩu **minh họa ở frontend**, không phải xác thực production. Sidebar và hàng chờ Dashboard dẫn đến các màn hình tương ứng.

Các route chính: `/admin/users`, `/admin/owner-verification`, `/admin/hotel-moderation`, `/admin/hotels`, `/admin/bookings`, `/admin/payments`, `/admin/reviews`, `/admin/reports`, `/admin/promotions`, `/admin/voucher`, `/admin/analytics`, `/admin/fraud`, `/admin/audit`. Màn hình chi tiết dùng `/admin/detail/<nhóm>?id=<mã>`. Màn hình chỗ ở có 24 hồ sơ mẫu đúng 6 loại và bộ lọc nhiều loại; Resort có 4 hồ sơ, Khách sạn + Resort có 14 hồ sơ.

Các quyết định đình chỉ, phê duyệt, từ chối, tra soát hoàn tiền, xử lý báo cáo và đánh dấu cảnh báo đã xem đều xác nhận qua dialog, cập nhật dữ liệu trong phiên demo và thêm sự kiện audit **mẫu**. Reload ứng dụng sẽ khôi phục dữ liệu mẫu. Admin không tự thay đổi trạng thái booking/payment từ màn hình giám sát. Figma hiển thị booking `BT-2027-DN-00128` là `4.350.000 ₫` tại màn đặt phòng nhưng giao dịch của booking đó là `4.188.000 ₫` tại màn thanh toán; hai số được giữ riêng theo từng frame, chưa đối soát.

Để xem trạng thái giao diện demo, dùng `?demoState=loading`, `?demoState=empty` hoặc `?demoState=error` ở các route Admin. Bước tích hợp tiếp theo cần Admin authentication từ ST-AUTH-08 và các API theo FR-ADM-01 đến FR-ADM-10; frontend guard không thay thế kiểm tra quyền ở backend.

Kiểm tra ảnh Figma ở 1024×768, 1280×800 và 1440×900: từ thư mục `apps/booking-travel-app`, xuất bản web với cờ demo rồi mở server tĩnh ở terminal riêng. `--clear` bảo đảm cờ demo được biên dịch nhất quán vào tất cả route.

```powershell
$env:EXPO_PUBLIC_ENABLE_ADMIN_DEMO='true'
npx.cmd expo export --clear --platform web --output-dir .admin-export-check
python test/admin-static-server.py
```

Trong terminal khác chạy `python test/admin-visual-qa.py`, sau đó lặp với `--width 1280 --height 800` và `--width 1440 --height 900`. Ảnh được lưu ở `test/artifacts`. Công cụ này cần Chrome cài tại đường dẫn mặc định của Windows.

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
npm.cmd run test:admin --workspace @booking-travel/mobile
```

Các màn hình Traveler nằm trong `src/features/traveler`; hệ thống route nằm trong `src/app/user` và `src/app/auth`. Module Chủ khách sạn ở `src/features/hotel-owner` và `src/app/hotel-owner`.

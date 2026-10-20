# Booking Travel Mobile

Ứng dụng Expo có ba khu vực: Traveler (`/user`), Chủ khách sạn (`/hotel-owner`) và Admin Console (`/admin`). Phần Traveler được dựng theo trang **User** của [Figma Booking Travel v1.1](https://www.figma.com/design/TaRFo9CWYKQNORVPnpmHRP/Booking-Travel-%E2%80%94-UI-UX-Design-v1.1?node-id=1-5). Các thao tác Traveler hiện dùng dữ liệu mẫu lưu trên thiết bị, chưa gọi API đặt phòng hoặc thanh toán thật.

## Chạy thử

Từ thư mục gốc `DACN2`:

```powershell
npm.cmd ci
npm.cmd run dev:mobile
```

Màn đầu là Splash. Chọn **Bắt đầu khám phá** để xem onboarding, hoặc mở `/auth/welcome`. Người dùng có thể tạo tài khoản mới; dữ liệu được lưu qua API và sau khi xác minh OTP có thể đăng nhập bằng chính email/SĐT cùng mật khẩu đã đăng ký. Role luôn do backend trả về. OTP đăng ký local được xem ở terminal backend khi `AUTH_EXPOSE_DEVELOPMENT_OTP=true`. Mã ưu đãi thử: `TRAVEL12` hoặc `MYKHE12`.

Các tuyến `/user` và `/hotel-owner` có thể mở trực tiếp khi cần kiểm tra từng giao diện. Trên web, chạy `npm.cmd run web --workspace @booking-travel/mobile`; trên thiết bị, dùng Expo Go hoặc bản development build theo cấu hình Expo.

## Admin Console demo

Admin Console dùng 23 màn hình theo [trang Admin trên Figma](https://www.figma.com/design/TaRFo9CWYKQNORVPnpmHRP/Booking-Travel-%E2%80%94-UI-UX-Design-v1.1?node-id=1-8), gồm đăng nhập, dashboard, người dùng, xác minh chủ khách sạn, duyệt và quản lý chỗ ở, đặt phòng, thanh toán, báo cáo, ưu đãi, phân tích, cảnh báo AI và nhật ký. Bật phiên demo riêng trước khi chạy Expo trên điện thoại:

```powershell
$env:EXPO_PUBLIC_ENABLE_ADMIN_DEMO='true'
npm.cmd run dev:mobile
```

Quét QR bằng Expo Go. Ở màn Splash, chọn **Đăng nhập Admin (demo)**; nút này cũng xuất hiện ở màn chọn vai trò và màn đăng nhập. Nếu ứng dụng đang lưu phiên USER hoặc HOTEL_OWNER, đăng xuất trước để quay lại luồng đăng nhập. Để xem trên trình duyệt, chạy:

```powershell
$env:EXPO_PUBLIC_ENABLE_ADMIN_DEMO='true'
npm.cmd run web --workspace @booking-travel/mobile
```

Đăng nhập bằng `admin@bookingtravel.vn` / `admin123`, rồi vào `/admin`. Cờ demo mặc định tắt; USER và HOTEL_OWNER không thể mở Admin Console. Đây là phiên và mật khẩu **minh họa ở frontend**, không phải xác thực production. Từ 1024px, Admin giữ sidebar desktop; trên điện thoại và tablet, nút ☰ trong header mở menu có tên từng chức năng. Chạm nền tối hoặc chọn mục sẽ đóng menu. Hàng chờ Dashboard dẫn đến các màn hình tương ứng.

Các route chính: `/admin/users`, `/admin/owner-verification`, `/admin/hotel-moderation`, `/admin/hotels`, `/admin/bookings`, `/admin/payments`, `/admin/reviews`, `/admin/reports`, `/admin/promotions`, `/admin/voucher`, `/admin/analytics`, `/admin/fraud`, `/admin/audit`. Màn hình chi tiết dùng `/admin/detail/<nhóm>?id=<mã>`. Màn hình chỗ ở có 24 hồ sơ mẫu đúng 6 loại và bộ lọc nhiều loại; Resort có 4 hồ sơ, Khách sạn + Resort có 14 hồ sơ.

Các quyết định đình chỉ, phê duyệt, từ chối, tra soát hoàn tiền, xử lý báo cáo và đánh dấu cảnh báo đã xem đều xác nhận qua dialog, cập nhật dữ liệu trong phiên demo và thêm sự kiện audit **mẫu**. Reload ứng dụng sẽ khôi phục dữ liệu mẫu. Admin không tự thay đổi trạng thái booking/payment từ màn hình giám sát. Figma hiển thị booking `BT-2027-DN-00128` là `4.350.000 ₫` tại màn đặt phòng nhưng giao dịch của booking đó là `4.188.000 ₫` tại màn thanh toán; hai số được giữ riêng theo từng frame, chưa đối soát.

Để xem trạng thái giao diện demo, dùng `?demoState=loading`, `?demoState=empty` hoặc `?demoState=error` ở các route Admin. Backend ST-AUTH-08 đã có xác thực, RBAC và ownership; bước tiếp theo là thay session/dữ liệu admin demo bằng login production và các API theo FR-ADM-01 đến FR-ADM-10. Frontend guard không thay thế kiểm tra quyền ở backend.

Kiểm tra ảnh Figma ở 1024×768, 1280×800 và 1440×900: từ thư mục `apps/booking-travel-app`, xuất bản web với cờ demo rồi mở server tĩnh ở terminal riêng. `--clear` bảo đảm cờ demo được biên dịch nhất quán vào tất cả route.

```powershell
$env:EXPO_PUBLIC_ENABLE_ADMIN_DEMO='true'
npx.cmd expo export --clear --platform web --output-dir .admin-export-check
python test/admin-static-server.py
```

Trong terminal khác chạy `python test/admin-visual-qa.py`, sau đó lặp với `--width 1280 --height 800` và `--width 1440 --height 900`. Chạy thêm `python test/admin-visual-qa.py --responsive` để kiểm tra 320, 360, 375, 390, 412, 430, 768, 1024 và 1440px cùng thao tác drawer, danh sách, chi tiết và hộp thoại. Ảnh được lưu ở `test/artifacts`. Công cụ này cần Chrome cài tại đường dẫn mặc định của Windows.

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

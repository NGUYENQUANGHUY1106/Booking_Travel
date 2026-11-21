# ST-NTF-01 - Thông báo in-app và push notification

## Trạng thái

- Đã thêm persistence `UserNotification` và `PushDeviceToken`.
- Đã thêm API xác thực danh sách, unread count, đánh dấu đã đọc và quản lý Expo device token.
- Đã tích hợp notification chung sau quyết định xét duyệt hồ sơ Chủ khách sạn.
- Mobile đã có TanStack Query API, Expo push registration và hiển thị notification chung.
- Push Expo gửi best-effort; notification in-app là dữ liệu nguồn khi push provider không khả dụng.

## Kiểm thử

- Unit test service notifications.
- Prisma migration đã áp dụng vào PostgreSQL local.
- Backend typecheck, lint và build đạt.
- Mobile typecheck, lint và bộ test traveler đạt.

# ST-OWN-13 — Khách, chat và phản hồi review

Nhánh: `feat/st-own-13-guest-chat-review` (tạo từ `develop`; chứa ST-REV-03 chưa merge để dùng chung API phản hồi).

## Đã nối

- `GET /owner/guests`: tổng hợp theo cặp `hotelId + userId` từ Booking và Conversation, phân trang, tìm kiếm và đếm cùng phạm vi Owner. Khách chỉ nhắn tin được gắn `CHAT_ONLY` và không tính lượt lưu trú.
- `GET /owner/guests/:hotelId/:userId`: booking history chỉ tại khách sạn được quyền, mỗi trang 20 booking. Người đặt được phân biệt với tên khách lưu trú ghi trên booking.
- `POST /owner/guests/:hotelId/:userId/conversation`: mở lại thread duy nhất của khách sạn và người đặt; chỉ tạo thread khi có booking hợp lệ. Chủ hiện tại lấy từ Hotel.
- Chat HTTP và WebSocket kiểm tra chủ sở hữu hiện tại của Hotel. Broadcast kiểm tra lại thành viên trước khi gửi tới socket còn trong room. Hội thoại phân trang 20 mục/trang; kết nối lại tải lại lịch sử từ server.
- Dashboard Owner → Khách lưu trú / Đánh giá; booking detail → khách / chat; danh sách khách → chi tiết / chat; tab Tin nhắn → cùng thread. Review dùng lại ST-REV-03, không tạo nguồn dữ liệu thứ hai.
- Migration thêm index tra cứu `Booking(hotelId,userId,createdAt,id)` và `Conversation(hotelId,userId)`.

## Kiểm tra

- `npm.cmd run prisma:generate`, `npm.cmd run prisma:migrate`: thành công trên PostgreSQL local.
- Truy vấn danh sách, tìm kiếm và chi tiết bằng service build thật trên PostgreSQL local: thành công; một khách sạn mẫu trả 1 ngữ cảnh khách và 7 booking.
- Thử Owner khác truy cập list/detail/mở chat của khách sạn mẫu: cả 3 bị từ chối.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`: thành công.
- `npm.cmd run test`: 330 test qua, 10 test đã skip từ trước.

## Cần kiểm tra trên thiết bị

Đăng nhập Owner A và Owner B có khách sạn khác nhau, User X có booking ở hai khách sạn, User Y chỉ có hội thoại. Trên Owner A mở Khách lưu trú → chi tiết User X → booking/chat; Owner B chỉ thấy booking của mình. Mở tab Tin nhắn từ Owner và User để gửi/nhận hai chiều, thử ngắt mạng rồi kết nối lại. Từ Owner phản hồi review và tải lại trang khách sạn phía User. Chưa kiểm chứng thao tác trực tiếp trên thiết bị/emulator trong phiên này.

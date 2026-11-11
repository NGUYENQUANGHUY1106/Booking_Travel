# ST-COM-04 - Trạng thái đã đọc và danh sách hội thoại

## Phạm vi

- User và Hotel Owner xem danh sách hội thoại từ PostgreSQL.
- Danh sách hiển thị người đối thoại, khách sạn, tin cuối và số tin chưa đọc.
- Hội thoại được sắp xếp theo hoạt động mới nhất.
- Khi mở hội thoại, các tin đã nhìn thấy được đánh dấu `readAt`.
- Người gửi nhận sự kiện realtime và thấy trạng thái `Đã đọc`.

## REST API

```text
GET   /api/conversations
GET   /api/conversations/:id/messages
PATCH /api/conversations/:id/read
Authorization: Bearer <access-token>
```

Backend chỉ trả hội thoại mà tài khoản hiện tại là User hoặc Hotel Owner tham gia. `PATCH /read` chỉ cập nhật tin do phía còn lại gửi và có `createdAt` không lớn hơn thời điểm đọc.

## Socket.IO

Namespace: `/chat`

- Client gửi `conversation:read`: `{ conversationId }`.
- Server phát `conversation:read`: `{ conversationId, readerId, readAt, count }`.

## Cập nhật database

Sau khi pull code:

```powershell
npm.cmd install
npm.cmd run prisma:generate --workspace @booking-travel/api
npm.cmd run prisma:migrate --workspace @booking-travel/api
```

Migration `20261111000300_message_read_status` thêm `Message.readAt` và index phục vụ đếm tin chưa đọc.

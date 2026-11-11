# ST-COM-02 - Nhắn tin realtime

## Phạm vi

- Tin nhắn văn bản giữa User và Hotel Owner được lưu trong PostgreSQL.
- Socket.IO xác thực bằng access token và phiên đăng nhập còn hiệu lực.
- Chỉ hai thành viên của cuộc trò chuyện được tham gia phòng và gửi tin.
- Màn hình tải tối đa 100 tin gần nhất rồi nhận tin mới theo thời gian thực.
- Ảnh, file, vị trí và Booking Card thuộc ST-COM-03.
- Danh sách hội thoại và trạng thái đã đọc thuộc ST-COM-04.

## REST API

```text
GET /api/conversations/:id/messages
Authorization: Bearer <access-token>
```

## Socket.IO

Namespace: `/chat`

Kết nối:

```ts
io(`${EXPO_PUBLIC_SOCKET_URL}/chat`, {
  auth: { token: accessToken },
  transports: ['websocket'],
});
```

Sự kiện client gửi:

- `conversation:join`: `{ conversationId }`
- `message:send`: `{ conversationId, content }`

Sự kiện server phát:

- `message:new`: message vừa được lưu thành công.

## Cập nhật database

Sau khi pull code:

```powershell
npm.cmd install
npm.cmd run prisma:generate --workspace @booking-travel/api
npm.cmd run prisma:migrate --workspace @booking-travel/api
```

Chạy backend và mobile ở hai terminal riêng:

```powershell
npm.cmd run dev:api
npm.cmd run dev:mobile
```

`EXPO_PUBLIC_SOCKET_URL` phải trỏ tới backend mà thiết bị truy cập được. Khi chạy điện thoại thật, không dùng `localhost` nếu Expo không thể tự suy ra IP máy phát triển.

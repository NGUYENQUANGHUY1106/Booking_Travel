# ST-COM-01 — Tạo cuộc trò chuyện User ↔ Hotel Owner

## Phạm vi

- User đã đăng nhập mở một cuộc trò chuyện từ trang chi tiết khách sạn.
- Mỗi cặp User–Hotel chỉ có một cuộc trò chuyện; gọi lại endpoint trả về bản ghi cũ.
- Backend tự xác định Hotel Owner từ khách sạn đã được duyệt và đang công khai.
- User và Hotel Owner không thuộc cuộc trò chuyện không thể đọc dữ liệu.

Nhắn tin realtime, danh sách hội thoại và trạng thái đã đọc thuộc ST-COM-02/ST-COM-04.

## API

### Tạo hoặc lấy lại cuộc trò chuyện

`POST /api/conversations`

```json
{ "hotelId": "<hotel-id>" }
```

Yêu cầu access token role `USER`.

### Xem một cuộc trò chuyện

`GET /api/conversations/:id`

Chỉ User hoặc Hotel Owner của cuộc trò chuyện được truy cập.

## Database và chạy thử

Máy mới sau khi pull code chạy:

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run db:setup
```

Máy đã có database chỉ cần:

```powershell
npm.cmd run prisma:migrate
```

Migration tạo bảng `Conversation`, unique `(userId, hotelId)` và index hộp thư Owner.

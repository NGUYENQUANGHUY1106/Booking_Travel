# ST-AUTH-06 — Đăng xuất và quản lý phiên

Đối chiếu: `AUTH-06` → `FR-AUTH-06` (SRS) → `ST-AUTH-06` (Sprint 03). Chức năng sử dụng `AuthSession` và claim `sessionId` do AUTH-03/AUTH-04 phát hành.

## API

Endpoint được bảo vệ `POST /api/auth/logout` yêu cầu Bearer access token. Mặc định API chỉ thu hồi phiên chứa trong access token:

```json
{}
```

Để đăng xuất khỏi toàn bộ thiết bị, gửi:

```json
{
  "allSessions": true
}
```

Response thành công cho biết phạm vi `CURRENT` hoặc `ALL` và số phiên vừa được thu hồi. Client phải xóa access token và refresh token đang lưu sau response thành công.

## Quy tắc bảo mật

- `userId` và `sessionId` được lấy từ access token đã xác thực, không nhận từ request body.
- Logout phiên hiện tại chỉ cập nhật `AuthSession` đồng thời khớp `id` và `userId`, nên không thể thu hồi phiên của tài khoản khác.
- Logout tất cả chỉ cập nhật các phiên chưa bị thu hồi thuộc user hiện tại.
- Thao tác idempotent: phiên đã hết hạn, đã thu hồi hoặc không còn tồn tại vẫn trả thành công; `revokedSessionCount = 0` nếu không còn phiên nào cần cập nhật.
- Sau khi thu hồi, refresh token tương ứng bị AUTH-04 từ chối với `401 AUTH_REFRESH_TOKEN_INVALID`.
- Access token là JWT ngắn hạn; client phải xóa token local ngay khi logout.

Không cần migration mới vì model `AuthSession` đã có `revokedAt`, `lastUsedAt` và index theo user/trạng thái phiên.

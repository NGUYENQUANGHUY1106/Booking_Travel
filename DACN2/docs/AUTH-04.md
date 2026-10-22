# ST-AUTH-04 — Làm mới access token

Đối chiếu: `AUTH-04` → `FR-AUTH-04` (SRS) → `ST-AUTH-04` (Sprint 03). Chức năng phụ thuộc phiên đăng nhập và refresh token do `ST-AUTH-03` phát hành.

## API

Endpoint công khai `POST /api/auth/refresh` nhận body:

```json
{
  "refreshToken": "JWT được cấp khi đăng nhập hoặc refresh gần nhất"
}
```

Khi thành công, API trả access token mới, refresh token mới, hạn sử dụng, `sessionId` và thông tin user hiện tại. Client phải thay thế đồng thời cả hai token; refresh token cũ không thể dùng lại.

## Quy tắc bảo mật

- Backend xác minh chữ ký và hạn JWT bằng `JWT_REFRESH_SECRET`, đồng thời yêu cầu claim `type=refresh`, `sub` và `sessionId` hợp lệ.
- Token phải khớp SHA-256 hash đang lưu trong `AuthSession`; raw refresh token không được lưu vào database hoặc log.
- Phiên đã thu hồi, hết hạn, không tồn tại hoặc không thuộc user trong token đều trả `401 AUTH_REFRESH_TOKEN_INVALID` và yêu cầu đăng nhập lại.
- Rotation dùng cập nhật có điều kiện trên `sessionId`, user, token hash, hạn và trạng thái thu hồi. Chỉ một request đồng thời được phép đổi hash; request phát lại token cũ bị từ chối.
- Role và trạng thái tài khoản được tải lại từ database trước khi phát token. Tài khoản bị khóa hoặc vô hiệu hóa khiến phiên hiện tại bị thu hồi và refresh bị từ chối.
- Mỗi lần refresh thành công cập nhật `lastUsedAt`, IP, user agent và gia hạn thời điểm hết hạn của refresh token theo cấu hình.

Không cần migration mới vì model `AuthSession` của `ST-AUTH-03` đã có đủ `refreshTokenHash`, `expiresAt`, `lastUsedAt` và `revokedAt`.

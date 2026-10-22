# ST-AUTH-05 — Quên mật khẩu và đặt lại mật khẩu

Đối chiếu: `AUTH-05` → `FR-AUTH-05` (SRS) → `ST-AUTH-05` (Sprint 03). Chức năng tái sử dụng cơ chế OTP của AUTH-02 với purpose riêng `PASSWORD_RESET`.

## API

Yêu cầu mã đặt lại mật khẩu:

```json
POST /api/auth/forgot-password

{
  "identifier": "traveler@bookingtravel.vn"
}
```

API luôn trả cùng một thông báo và cấu trúc response, kể cả khi tài khoản không tồn tại hoặc kênh chưa được xác minh. Với tài khoản hợp lệ, backend vô hiệu hóa reset session cũ, tạo OTP mới và chỉ lưu HMAC-SHA-256 của OTP.

Xác nhận mật khẩu mới:

```json
POST /api/auth/reset-password

{
  "resetSessionId": "UUID nhận từ API forgot-password",
  "otp": "123456",
  "newPassword": "NewPassword123",
  "confirmPassword": "NewPassword123"
}
```

OTP phải còn hạn, chưa bị dùng, đúng purpose và chưa vượt quá số lần thử. Mật khẩu mới phải đạt cùng giới hạn với đăng ký, khớp trường xác nhận và khác mật khẩu hiện tại. Khi thành công, backend cập nhật bcrypt hash, dùng OTP đúng một lần, vô hiệu hóa các reset session còn lại và thu hồi toàn bộ `AuthSession` đang hoạt động. Người dùng phải đăng nhập lại bằng mật khẩu mới.

## Phát triển local

Khi `AUTH_EXPOSE_DEVELOPMENT_OTP=true` và không chạy production, response yêu cầu reset có thêm `developmentOtp`; tài khoản không tồn tại cũng nhận OTP giả để giữ cấu trúc response trung tính. Production không trả OTP. Tích hợp email/SMS provider thực tế là phần hạ tầng riêng; trạng thái hiện tại được ghi là `QUEUED` như luồng xác minh đăng ký.

Migration `20261022000100_password_reset` bổ sung giá trị `PASSWORD_RESET` cho enum `VerificationPurpose`.

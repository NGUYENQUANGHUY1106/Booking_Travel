# ST-BKG-11 - Nhắc check-in/check-out

## Trạng thái

- Đã thêm model `StayReminder` và migration để ghi lịch đã gửi, chống gửi trùng.
- Đã thêm sweep interval kiểm tra 24 giờ và 2 giờ trước check-in/check-out.
- Sweep dùng thời gian và múi giờ `Asia/Ho_Chi_Minh`, không dùng giờ của thiết bị.
- Reminder được lưu làm `UserNotification` và hỗ trợ Expo push best-effort.
- API `/api/bookings/:id/reminders` chỉ trả reminder của User sở hữu booking.
- Mobile chi tiết booking hiển thị trạng thái nhắc nhận/trả phòng.

## Kiểm thử

- Unit test cho lịch Asia/Ho_Chi_Minh, quyền scope và sweep 24 giờ.
- Prisma generate/migrate đã chạy.

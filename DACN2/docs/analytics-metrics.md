# ST-OWN-14 · Hợp đồng chỉ số chủ khách sạn (v1)

Phạm vi luôn là khách sạn chưa xóa thuộc `ownerId` lấy từ JWT; bộ lọc phòng phải thuộc khách sạn đã chọn. Khoảng ngày `[dateFrom, dateTo]` tính theo lịch Việt Nam (`Asia/Ho_Chi_Minh`), tối đa 366 ngày. Tiền chỉ hỗ trợ VND; các tiền tệ khác không được cộng vào VND. `asOf` là lúc đọc cơ sở dữ liệu.

| Chỉ số | Công thức và thời điểm ghi nhận | Không có dữ liệu |
| --- | --- | --- |
| Giá trị đặt phòng | Tổng `Booking.totalAmount` của booking tạo trong kỳ, trạng thái `CONFIRMED`, `CHECKED_IN`, `COMPLETED`; đây là giá trị đặt, **không phải tiền đã thu**. | 0 ₫ |
| Đã thu online | Tổng `Payment.amount` có `succeededAt` trong kỳ, trạng thái `SUCCESS`, `PARTIALLY_REFUNDED` hoặc `REFUNDED`, `booking.paymentMethod = SIMULATOR`. Thanh toán tại khách sạn không có biên nhận thu tiền nên không cộng. Webhook replay không tạo thêm payment. | 0 ₫ |
| Đã hoàn | Tổng `RefundRequest.amount` trạng thái `COMPLETED`, `completedAt` trong kỳ. PENDING/FAILED/REJECTED không trừ. | 0 ₫ |
| Thực thu online | Đã thu online − đã hoàn trong cùng kỳ; theo **ngày giao dịch**, có thể âm khi hoàn sau kỳ đã thu. Tổng các bucket bằng KPI. | 0 ₫ |
| Đêm phòng đã bán | Tổng `Booking.roomCount` cho từng đêm thuộc `[checkIn, checkOut)`, chỉ trạng thái `CONFIRMED`, `CHECKED_IN`, `COMPLETED`; `PENDING_PAYMENT`/`REFUND_PENDING`/hủy/đã hoàn không góp. | 0 |
| Đêm phòng có thể bán | Tổng `min(Room.quantity, RoomInventoryOverride.sellableQty)` từng ngày của phòng ACTIVE chưa xóa thuộc khách sạn APPROVED đang hiển thị; trừ block ACTIVE, chặn dưới tại 0. Dữ liệu hotel/room/inventory hiện tại có thể làm thay đổi báo cáo quá khứ. | 0 |
| Công suất | `100 × đêm phòng đã bán / đêm phòng có thể bán`; nếu mẫu số 0 trả `null` và hiển thị “Chưa đủ dữ liệu”. Có thể vượt 100% nếu tồn phòng lịch sử đã bị sửa, cần đọc cùng cảnh báo. | null |
| Giá phòng bình quân (ADR) | Tổng `Booking.totalAmount / Booking.nights × số đêm giao kỳ` của booking được tính là đã bán, chia cho đêm phòng đã bán. Đây là giá trị đặt phòng phân bổ, **không phải tiền đã thu**. | null |
| Tỷ lệ hủy | Booking tạo trong kỳ có trạng thái `CANCELLED`, `REFUND_PENDING` hoặc `REFUNDED` / tổng booking tạo trong kỳ, tính cả đơn đang chờ thanh toán. Đây là tỷ lệ theo trạng thái hiện tại. | null |
| Đánh giá | Chưa có model review/visibility chính thức trong schema, API trả `null` và lý do `REVIEWS_NOT_IMPLEMENTED`. | null |

Ví dụ: thanh toán online 2.000.000 ₫ ngày 1, hoàn 400.000 ₫ ngày 3: thực thu ngày 1 là 2.000.000 ₫, ngày 3 là −400.000 ₫, tổng kỳ là 1.600.000 ₫. Booking trả tại khách sạn chưa xác nhận thu sẽ không tăng “đã thu”. Ngày checkout không tạo thêm đêm phòng.

**OPEN-QUESTION:** Có cần ghi nhận tiền thu tại khách sạn, phí hủy thực thu, hoặc cố định lịch sử tồn phòng sau khi Owner sửa/xóa phòng? Chưa có ledger/ảnh chụp tồn lịch sử đủ tin cậy để xác nhận những khoản này. Báo cáo hiện chỉ công bố “thực thu online” và công suất theo tồn hiện tại; không gọi đó là doanh thu kế toán hay số liệu lịch sử bất biến.

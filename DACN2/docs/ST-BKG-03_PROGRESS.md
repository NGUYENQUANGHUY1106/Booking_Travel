# ST-BKG-03 - Áp dụng voucher/khuyến mãi

## Trạng thái

- Booking quote nhận mã voucher tùy chọn và tính giảm giá trên backend.
- Quote ký chứa snapshot voucher, số tiền gốc và mức giảm để tạo booking recheck.
- Tạo booking khóa voucher và reservation theo PostgreSQL, chống quota/ngân sách vượt limit.
- `PAY_AT_HOTEL` tiêu thụ lượt ngay; `SIMULATOR` giữ lượt và settlement được worker/callback xử lý.
- Mobile nhập mã, hiển thị breakdown, bỏ mã và tải lại quote.
- Mobile ánh xạ các mã lỗi voucher sang thông báo tiếng Việt rõ ràng.

## Giới hạn đúng phạm vi

- Voucher Chủ khách sạn thuộc ST-OWN-10 chưa có module nghiệp vụ.
- ST-BKG-03 hiện chỉ áp dụng voucher nền tảng `source=PLATFORM`.
- Không cộng dồn voucher nền tảng với voucher Chủ khách sạn.

## Kiểm thử

- Unit backend: quote, discount cap, voucher invalid, expired, exhausted, hotel scope.
- Unit mobile: mapper thông báo lỗi voucher và quote logic traveler.
- E2E/DB voucher: existing `platform-vouchers*.e2e-spec.ts`.

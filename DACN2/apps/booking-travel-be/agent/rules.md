# Backend rules

Áp dụng [quy tắc chung](../../AGENT.md), đặc biệt các mục 3, 6, 10 và 13.

- Giữ controller tập trung vào route, xác thực và DTO; nghiệp vụ đặt phòng, giá và quyền sở hữu nằm trong service/domain.
- Kiểm tra đầu vào với DTO và validation; không tin `ownerId`, role, status hoặc amount do client gửi.
- Với API được bảo vệ, xác minh authentication, role và quyền trên tài nguyên; kiểm tra cả trường hợp truy cập chéo chủ khách sạn.
- Giữ migration Prisma, schema và dữ liệu import nhất quán. Không sửa trực tiếp snapshot địa chỉ đã tải.
- Trước khi báo hoàn thành một thay đổi backend, chạy các lệnh kiểm tra phù hợp từ `package.json` và báo đúng kết quả.

Mã nguồn hiện nằm trong `src/`, schema/migration trong `prisma/`, script dữ liệu trong `scripts/`.

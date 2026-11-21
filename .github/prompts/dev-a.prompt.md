---
description: 'Chỉ triển khai các task của Developer A theo Sprint Plan'
---
Hãy đọc [JIRA_SPRINT_PLAN.md](../../DACN2/docs/JIRA_SPRINT_PLAN.md) và đối chiếu CHÍNH XÁC tiêu đề `Sprint XX` (kiểm tra khớp cả số Sprint lẫn khoảng ngày bắt đầu–kết thúc của Sprint đó, tuyệt đối không lấy nhầm bảng của Sprint liền kề).

Quy trình bắt buộc:
1. **Kiểm tra quyền sở hữu:** Xác nhận Issue được yêu cầu có `Assignee = A`. Nếu Issue đó thuộc về `B`, hãy **DỪNG LẠI NGAY**, cảnh báo rằng đây là task của Developer B và liệt kê các task của `A` trong đúng Sprint đó để tôi chọn lại.
2. **Kiểm tra Dependencies:** Đối chiếu danh sách dependencies của Issue đó trong codebase (`DACN2/apps/`, `DACN2/docs/`). Báo rõ phần nào đã có, phần nào đang chờ Developer B.
3. **Kế hoạch thay đổi:** Liệt kê danh sách file sẽ tạo/sửa (chỉ giới hạn trong module của A: User, Auth user-flow, Hotel Search/Detail, Booking flow của User, Payment init, Chat, AI User, Mobile/UI) và chờ tôi xác nhận trước khi ghi file.
4. **Thực thi & Kiểm thử:** Viết code hoàn chỉnh theo AC/DoD (tuân thủ kiến trúc NestJS/Prisma/Expo trong `copilot-instructions.md`) và hướng dẫn lệnh test kiểm tra.
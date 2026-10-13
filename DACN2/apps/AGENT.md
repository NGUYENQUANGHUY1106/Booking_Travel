# Booking Travel Project - Master AI Developer Assistant Guide

> **DÀNH CHO AI & THÀNH VIÊN DỰ ÁN**: Khi mở root workspace và tag `@AGENT.md`, AI **BẮT BUỘC** đọc file này, kiểm tra cấu trúc project và điều hướng đến đúng ứng dụng trước khi làm việc.

---

## 1. CẤU TRÚC ỨNG DỤNG TRONG REPOSITORY

Hệ thống **Booking Travel** gồm 2 ứng dụng trong cùng một Git repository:

1. **Backend (`booking-travel-be/`)**:
   - NestJS, TypeScript, PostgreSQL + PostGIS + pgvector, Cloudflare R2, Redis + BullMQ, REST API, JWT + Refresh Token, RBAC.
   - Hướng dẫn Backend: [`booking-travel-be/AGENT.md`](./booking-travel-be/AGENT.md).
   - Chi tiết: [`rules.md`](./booking-travel-be/agent/rules.md) | [`business-logic.md`](./booking-travel-be/agent/business-logic.md) | [`ai-workflow.md`](./booking-travel-be/agent/ai-workflow.md).

2. **Mobile App (`booking-travel-app/`)**:
   - React Native (Expo), TypeScript, React Navigation, TanStack Query, state management theo codebase (Zustand hoặc Redux Toolkit).
   - Hướng dẫn Frontend: [`booking-travel-app/AGENT.md`](./booking-travel-app/AGENT.md).
   - Chi tiết: [`rules.md`](./booking-travel-app/agent/rules.md) | [`business-logic.md`](./booking-travel-app/agent/business-logic.md) | [`ai-workflow.md`](./booking-travel-app/agent/ai-workflow.md).

---

## 2. NGUYÊN TẮC BẤT DI BẤT DỊCH TOÀN DỰ ÁN

- **TIẾNG VIỆT MẶC ĐỊNH**: UI, validation và thông báo cho người dùng dùng tiếng Việt; không tự xóa khả năng hỗ trợ ngôn ngữ/tiền tệ khác đã có trong SRS.
- **ĐÚNG NGHIỆP VỤ BOOKING TRAVEL**: Chỉ có 3 vai trò `USER`, `HOTEL_OWNER`, `ADMIN`; AI là dịch vụ hỗ trợ, **không phải role**. Không tự thêm Tour/Travel Agency.
- **PHÂN NHÁNH THEO TRÁCH NHIỆM**: Xác định đúng ứng dụng, Sprint/Task và Git branch trước khi code. Không commit chéo nhánh; không tự merge vào nhánh mặc định.
- **TUÂN THỦ TÀI LIỆU**: Trước khi làm task, đối chiếu **SRS → Đặc tả chức năng → AI BUILD SPEC → Figma (đối với UI) → Sprint Plan**. Giữ liên kết `Function ID → FR → BUILD → UI → Task`.
- **BACKEND LÀ SOURCE OF TRUTH**: Không tin `role`, `ownerId`, giá booking, availability hoặc trạng thái booking/payment từ client. Backend bắt buộc kiểm tra RBAC và ownership.
- **KHÔNG COMMENT BỪA BÃI**: Không giải thích những dòng code hiển nhiên; chỉ comment các quy tắc nghiệp vụ hoặc logic khó hiểu.
- **KHOẢNG CÁCH DÒNG LOGIC**: Có dòng trống hợp lý giữa các nhóm khai báo biến, điều kiện, xử lý và `return`.
- **HẰNG SỐ VIẾT HOA TOÀN BỘ**: Dùng `UPPER_SNAKE_CASE` cho hằng số cố định ở cấp module; không đổi tên biến/props hay enum nếu trái convention hiện có.

---

> **LƯU Ý**: Nếu ứng dụng/thư mục hoặc các file hướng dẫn con chưa tồn tại, AI phải báo rõ và dùng quy tắc của file root này; **không tự tạo cấu trúc repository mới** chỉ để khớp đường dẫn ví dụ.

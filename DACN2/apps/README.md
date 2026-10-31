# Booking Travel apps

Thư mục này chứa hai ứng dụng trong cùng một npm workspace và một Git repository:

| Thư mục | Vai trò | npm workspace |
| --- | --- | --- |
| `booking-travel-be/` | NestJS API, Prisma, PostgreSQL | `@booking-travel/api` |
| `booking-travel-app/` | React Native/Expo | `@booking-travel/mobile` |

Đọc [AGENT.md](./AGENT.md) trước khi làm task và đọc hướng dẫn riêng trong thư mục ứng dụng tương ứng. Lệnh cài đặt, chạy và kiểm tra nằm ở [README gốc](../README.md). Tên npm workspace được giữ nguyên để các lệnh hiện có tiếp tục hoạt động.

```text
apps/
├── AGENT.md
├── README.md
├── booking-travel-be/
│   ├── AGENT.md
│   └── agent/
│       ├── rules.md
│       ├── business-logic.md
│       └── ai-workflow.md
└── booking-travel-app/
    ├── AGENT.md
    └── agent/
        ├── rules.md
        ├── business-logic.md
        └── ai-workflow.md
```
<!-- chạy dự án -->

npm.cmd install
npm.cmd run db:setup

terminal1:
npm.cmd run dev:api

terminal2:
npm.cmd run dev:mobile

Luồng đăng ký Chủ khách sạn ST-OWN-01: [hướng dẫn và API](../docs/OWN-01.md).
Luồng xét duyệt hồ sơ Chủ khách sạn ST-ADM-03: [hướng dẫn và API](../docs/ADM-03.md).
Luồng theo dõi xác minh và chuyển vai trò ST-OWN-02: [hướng dẫn và API](../docs/OWN-02.md).

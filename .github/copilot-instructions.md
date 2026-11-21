# Booking Travel Agent Guide

## Quy tắc dự án Booking Travel (Vai trò: Developer A)

### 1. Giới hạn phạm vi & Chống xung đột với Developer B
- Tôi là **Developer A**. Chỉ được phép triển khai các Story/Task có cột **Assignee là `A`** trong `#file:DACN2/docs/JIRA_SPRINT_PLAN.md`.
- **TUYỆT ĐỐI KHÔNG** tự ý tạo, sửa, hoặc xóa code thuộc phạm vi của **Developer B** (các module Owner, Admin, Inventory lock/hold, Pricing động, Quote, Webhook thanh toán, Refund, RBAC core, RAG pipeline, CI/Migration gốc) trừ khi tôi chỉ định rõ tên file.
- Nếu task của A cần gọi API/hàm từ module của B mà chưa có, chỉ được phép gọi qua interface/contract hoặc hỏi xác nhận của tôi, **không tự ý viết lại logic của B**.

### 2. Quy chuẩn kỹ thuật & Git (Từ JIRA_SPRINT_PLAN.md)
- Tech stack: NestJS, PostgreSQL, Redis BullMQ, Cloudflare R2, Mobile/Frontend.
- Luôn kiểm tra dependencies của task trước khi code. Nếu thiếu contract/API của B, dừng lại báo cho tôi biết.
- Tuân thủ Definition of Done (DoD): Không để `TODO` hoặc mock data ở core path, viết đầy đủ unit test & negative test, cập nhật file `*_PROGRESS.md` tương ứng sau khi xong.

## Language & Communication Rules
- Luôn giao tiếp, giải thích, lập kế hoạch (Plan) và viết comment trong code bằng tiếng Việt tự nhiên, rõ ràng, dễ hiểu.

## Architecture
- This is an npm workspace monorepo rooted at `DACN2/`; the API is `@booking-travel/api` and Expo app is `@booking-travel/mobile` (see `DACN2/package.json` and `DACN2/apps/README.md`).
- Backend: NestJS 11, TypeScript, Prisma 6/PostgreSQL 16, Redis/BullMQ, REST, JWT/RBAC, Swagger, Cloudflare R2, Socket.IO. `DACN2/apps/booking-travel-be/src/app.module.ts` registers all feature modules.
- Frontend: Expo SDK 57/React Native, Expo Router, TanStack Query, Zustand, and Axios. Routes are under `DACN2/apps/booking-travel-app/src/app/`; reusable domain code belongs under `features/`, `components/`, `services/`, or `stores/`.
- The backend is the source of truth. Never trust client-supplied role, `ownerId`, booking price/availability/status, or payment state; enforce resource ownership in services.
- The repository models only `USER`, `HOTEL_OWNER`, and `ADMIN` roles. UI is Vietnamese by default. Do not add new business roles or tour/travel-agency concepts.

## Start And Setup
- Use Node 22+ and npm 10+. From `DACN2/`, copy `.env.example` to `.env`, then run `npm.cmd ci` on Windows.
- Start infrastructure with `npm.cmd run infra:up`; initialize after first setup or a seed change with `npm.cmd run db:setup`.
- After pulling migrations, use `npm.cmd run prisma:migrate`; use `db:setup` for first setup or deliberate reseeding, not as an every-pull routine.
- Run API and Expo in separate terminals: `npm.cmd run dev:api` and `npm.cmd run dev:mobile`. API routes use `/api`, Swagger at `/docs`, and database health at `/api/health/database`.
- Docker app profile is `npm.cmd run docker:api`; infrastructure services are Postgres and Redis. R2 variables are optional in local development.

## Backend Conventions
- Keep routes and request binding in controllers, validation in DTOs, and business logic/RBAC/Prisma operations in services. Feature modules live in `DACN2/apps/booking-travel-be/src/modules/<feature>/`.
- Import Prisma enums and models from `@prisma/client`; keep DB changes in `DACN2/apps/booking-travel-be/prisma/schema.prisma` plus a migration under `prisma/migrations/`.
- Protected controllers use `AccessTokenGuard`/`@Roles(...)`; inspect `bookings.controller.ts`, `hotels.controller.ts`, and `common/guards/` for established ownership and permission patterns.
- Global validation is transform + whitelist + forbid non-whitelisted (`src/main.ts`). Public routes use the project `@Public()` decorator instead of bypassing guards ad hoc.
- Preserve existing VN address behavior: validate/import data through `scripts/` and never edit downloaded JSON snapshots directly. Key docs and contracts are in `DACN2/docs/VIETNAM_ADDRESS_DATA.md` and `DACN2/docs/CORE_BOOKING_API.md`.

## Frontend Conventions
- Add screens only in `src/app/`; use Expo Router layouts/navigation and keep feature logic outside route files.
- Use TanStack Query for API-derived server state and Zustand for app/session state. Inspect `src/features/traveler/store.ts` and `src/features/hotel-owner/dashboard/model.ts` for cache/session invalidation patterns.
- API calls go through `src/services/api-client.ts`. It adds LAN host replacement and refreshes access tokens on non-auth `401` responses; set `EXPO_PUBLIC_API_BASE_URL` and `EXPO_PUBLIC_SOCKET_URL` in `.env` for devices or tunnels.
- Preserve existing role and route groups: `(auth)`, `(user)`, `(owner)`, `(hotel-owner)`, and `(admin)`. Do not duplicate API state into mock-only UI if a real endpoint exists.
- When changing Expo/native dependencies, use SDK-compatible Expo commands and consult the Expo SDK 57 docs; native `ios/` and `android/` folders are not generated here.

## Tests And Checks
- Workspace checks: `npm.cmd run build`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, and `npm.cmd run test:e2e` from `DACN2/`.
- Backend Jest specs are colocated in `src/**/*.spec.ts`; the unit suite is rooted at `src`, and e2e configuration is `DACN2/apps/booking-travel-be/test/jest-e2e.json`.
- Mobile test scripts are Node `.mjs` tests in `DACN2/apps/booking-travel-app/test/` (run groups via `test:traveler`, `test:owner-dashboard`, or `test:admin`). Use `npx.cmd expo-doctor` for Expo dependency diagnosis.
- Seed data can be tested idempotently with `npm.cmd run prisma:seed:test`; payment/refund/webhook and R2/room-media helpers have dedicated scripts under the backend package.
- Before declaring a feature complete, inspect the matching task doc in `DACN2/docs/` and run the narrowest backend/mobile test plus workspace lint/typecheck for touched code.
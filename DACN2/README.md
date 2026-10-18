# Booking Travel

Monorepo gồm NestJS API, ứng dụng React Native/Expo và PostgreSQL. Dự án hiện có module địa chỉ Việt Nam hỗ trợ cả danh mục hành chính hiện hành hai cấp và danh mục lịch sử ba cấp.

## Thành phần chính

- `apps/booking-travel-be`: NestJS, Prisma, PostgreSQL, Swagger.
- `apps/booking-travel-app`: Expo SDK 57, Expo Router, TanStack Query.
- `apps/booking-travel-be/prisma`: schema và migration cơ sở dữ liệu.
- `apps/booking-travel-be/data/vietnam-address`: snapshot dữ liệu chính thức và bảng chuyển đổi cũ–mới.
- `apps/booking-travel-be/scripts`: tải, kiểm tra và import dữ liệu địa chỉ.
- `docs/VIETNAM_ADDRESS_DATA.md`: nguồn, phiên bản và giới hạn dữ liệu.
- `infra/postgres`: PostgreSQL 16 với PostGIS và pgvector.

## Chạy lần đầu

Yêu cầu Node.js 22+, npm 10+ và PostgreSQL 16. Nếu dùng Docker, cần mở Docker Desktop trước.

```powershell
Copy-Item .env.example .env
npm.cmd ci
npm.cmd run infra:up
npm.cmd run db:setup
npm.cmd run data:validate:vn
npm.cmd run data:import:vn
```

Nếu máy không có Docker, tạo trước database `booking_travel` trong pgAdmin 4, sau đó sửa `DATABASE_URL` trong `.env` theo tài khoản PostgreSQL của bạn. Lệnh `db:setup` sẽ tự tạo bảng và dữ liệu mẫu; bạn không cần tạo bảng thủ công.

Sau mỗi lần pull code có migration mới, chạy `npm.cmd run db:setup`. Seed dùng `upsert`, nên hai thành viên có thể chạy lại an toàn và có cùng bộ dữ liệu Hotel/Room/Booking/Admin. Chi tiết model và endpoint xem tại [`docs/CORE_BOOKING_API.md`](./docs/CORE_BOOKING_API.md).

## Nạp dữ liệu mẫu để kiểm tra phân quyền

Sau khi pull nhánh có seed ST-AUTH-08, mỗi thành viên cấu hình `DATABASE_URL` trong `DACN2/.env` cho PostgreSQL trên máy mình, rồi chạy từ thư mục gốc của repository:

```powershell
cd DACN2
npm.cmd run db:setup
```

Lệnh này áp dụng migration và nạp 2 admin (một tài khoản bị giới hạn quyền), 2 chủ khách sạn (Owner B có thêm khách sạn/phòng nháp để kiểm tra quyền đọc), 2 khách du lịch (mỗi người có một booking). Seed dùng `upsert`, nên chạy lại không tạo thêm bản ghi trùng. Nếu đã có database trong pgAdmin 4, không cần tạo lại database trước khi chạy lệnh.

## Chạy ứng dụng

Terminal 1 – API:

```powershell
npm.cmd run dev:api
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- Kiểm tra database: `http://localhost:3000/api/health/database`

Terminal 2 – Expo:

```powershell
npm.cmd run dev:mobile
```

Mở route `/address-demo` để thử component địa chỉ. Khi chạy trên điện thoại thật, đổi `EXPO_PUBLIC_API_BASE_URL` trong `.env` từ `localhost` sang IP LAN của máy tính.

## Cập nhật dữ liệu hành chính

Snapshot đã được lưu trong repository nên cài đặt bình thường chỉ cần validate và import:

```powershell
npm.cmd run data:validate:vn
npm.cmd run data:import:vn
```

Khi muốn lấy snapshot mới từ dịch vụ chính thức của Cục Thống kê:

```powershell
npm.cmd run data:fetch:vn
npm.cmd run data:validate:vn
npm.cmd run data:import:vn
```

Importer dùng `upsert`, chạy lại an toàn và có nhật ký trong bảng `ImportRun`. Không sửa trực tiếp file JSON đã tải; hãy chạy lại pipeline và kiểm tra thay đổi/version trước khi phát hành.

## API địa chỉ

- `GET /api/addresses/catalog/provinces?mode=CURRENT|LEGACY`
- `GET /api/addresses/catalog/provinces/:provinceId/communes`
- `GET /api/addresses/catalog/legacy/provinces/:provinceId/districts`
- `GET /api/addresses/catalog/legacy/districts/:districtId/communes`
- `GET /api/addresses/catalog/search?q=...`
- `GET /api/addresses/catalog/streets?communeId=...&q=...`
- `GET /api/addresses/catalog/transitions/:unitId`
- `POST /api/addresses/catalog/validate`
- CRUD `/api/addresses` yêu cầu Bearer access token; `ownerId` luôn lấy từ JWT, không nhận từ request body.

## Kiểm tra chất lượng

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run test:e2e
cd apps/booking-travel-app
npx.cmd expo-doctor
```

Không chạy `npm audit fix --force`, vì có thể hạ phiên bản/bẻ gãy dependency tương thích với Expo.

<!-- khi vừa pull code về chạy npm i  -->

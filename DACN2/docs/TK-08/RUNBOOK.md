# TK-08 — Runbook kiểm chứng và phát hành có điều kiện

Trạng thái: **NO-GO**, chưa deploy staging hoặc production, chưa có EAS internal build. Áp dụng cho Booking Travel `DACN2` với PostgreSQL/Prisma 6, NestJS, Expo SDK 58, payment simulator và phương thức trả tại khách sạn. Không xử lý simulator như provider thanh toán thật.

## Chuẩn bị và chạy lại gate

1. Checkout nhánh TK-08, kiểm tra `git status`, `git rev-parse HEAD`, `git log origin/develop..HEAD`. Không dùng database nghiệp vụ để chạy E2E. Đặt `.env` từ `.env.example` theo môi trường thử nghiệm, giữ secret ở máy/secret store; `DATABASE_URL` cần quyền tạo/xóa database trong **PostgreSQL test instance**. Script sẽ tự tạo database ngẫu nhiên, migration, seed, chạy test và xóa. Không chạy nếu URL trỏ production.
2. Tại `DACN2`: `npm ci`, `npm run prisma:generate`, `npm run lint`, `npm run typecheck`, `npm run test --workspace @booking-travel/api -- --runInBand`, `npm run test:traveler --workspace @booking-travel/mobile`, `npm run test:owner-dashboard --workspace @booking-travel/mobile`, `npm run test:admin --workspace @booking-travel/mobile`, `node --env-file=.env scripts/tk08-db-gates.cjs`, `npm run build`.
3. Export web smoke: tại `DACN2/apps/booking-travel-app`, chạy `node --env-file=../../.env ../../node_modules/expo/bin/cli export --platform web --output-dir <temp-path>`. Đây không phải Android/iOS internal build.
4. Chạy `npm audit --omit=dev --audit-level=high`; ghi tên advisory, phiên bản, đường phụ thuộc và quyết định sửa/miễn trừ có người chịu trách nhiệm. Cho đến khi cổng này đạt hoặc có triage được duyệt, giữ NO-GO.
5. Workflow `.github/workflows/tk08-booking-gates.yml` chạy cùng gate trên [PR #66](https://github.com/NGUYENQUANGHUY1106/Booking_Travel/pull/66). [Run `45434804154`](https://github.com/NGUYENQUANGHUY1106/Booking_Travel/actions/runs/45434804154) trên `c09fe28` qua quét secret delta, Docker services, test và image smoke nhưng fail audit Prisma.
6. Trên máy có `pg_dump` và `pg_restore` cùng phiên bản hoặc mới hơn PostgreSQL server, chạy `node --env-file=.env scripts/tk08-restore-rehearsal.cjs`. Nếu hai lệnh không nằm trên `PATH`, đặt `TK08_PG_BIN_DIR` tới thư mục chứa binary. Script chỉ chấp nhận PostgreSQL tại `localhost`, tạo 2 database có tên ngẫu nhiên, backup/restore, so row count/index/constraint/extension/migration rồi xóa database và file dump trong `finally`. Không dùng làm bằng chứng RPO/RTO trên staging.

## Staging và smoke cần thực hiện

Tạo môi trường riêng: PostgreSQL + PostGIS + Redis + API + worker/sweep, HTTPS, endpoint payment sandbox, storage public/private nếu cần media. Sao lưu database staging trước migration; rehearsal `prisma migrate deploy` trên bản sao dữ liệu thực tế; đối chiếu số dòng/constraint/index sau nâng cấp. Không dùng `.env` local trong build công khai. Ghi commit SHA, migration version, image digest, URL staging, EXPO_PUBLIC_API_BASE_URL, provider reference (ẩn bớt), build ID và thiết bị.

Docker Desktop đã được người dùng sửa trước lần kiểm tra ngày 25/11/2026. `docker info` hoạt động; Compose PostgreSQL, Redis và API chạy local. PostgreSQL host vẫn chiếm `5432`, nên trong PowerShell tại `DACN2` đặt `$env:POSTGRES_PORT='5433'` rồi chạy `docker compose --profile app up -d --build`; Docker PostgreSQL sẽ ở `localhost:5433`. Ứng dụng API ở `http://localhost:3000/api/health` và `/api/health/database`, cả hai trả `200` trong lần chạy này. Đã áp dụng 54 migration lên volume Docker vốn chưa có bảng nghiệp vụ, không seed và không chạm database PostgreSQL host ở `5432`. Dockerfile được sửa để khởi động từ `dist/src/main.js` và đóng gói workspace `node_modules`; workflow CI được mở rộng để gọi health endpoint thật. Bản sao data disk từ lần lỗi trước vẫn ở `D:\Temp\tk08-docker-backup-20261125\docker_data.vhdx` và đã kiểm SHA-256.

Image `postgis/postgis:16-3.5` vẫn là Bullseye. Dockerfile dùng [PGDG archive cho Bullseye](https://www.postgresql.org/message-id/apWm8-epjef2xpkM%40msg.df7cb.de) để CI có thể cài pgvector mà giữ base/volume. Đây là nguồn package đã hết cập nhật; nâng cấp PostGIS/OS cần kế hoạch backup/restore và kiểm tra index trước khi vận hành lâu dài.

Khi có EAS credentials, tạo profile internal distribution phù hợp SDK/app config rồi build Android/iOS. Không tạo hoặc gửi bản công khai. Cài trực tiếp trên một Android và một iPhone hoặc emulator đại diện, xác nhận kết nối staging và deep link. Chạy theo thứ tự, lưu mã booking/test IDs đã che PII:

Hiện `apps/booking-travel-app/app.json` có scheme `bookingtravel`, iOS bundle ID và Android package, nhưng repo **không có `eas.json` hoặc EAS project ID**. Chưa xác minh tài khoản/quyền EAS, signing credentials, thiết bị cài thử hoặc URL staging. `EXPO_PUBLIC_API_BASE_URL` trong `.env.example` là `localhost`, không phải URL dùng được từ bản cài trên điện thoại. Các mục này cần được cấu hình trên môi trường thử nghiệm trước khi build và smoke; không đưa secret vào Git.

1. User đăng nhập → tìm approved hotel → mở phòng từ Home, Search và Hotel Detail → xác nhận ngày tương lai và số khách/phòng → quay lại/foreground → dữ liệu giữ nguyên; không chọn ngày thì bị chặn.
2. Chọn phòng còn bán, so giá từng đêm và quote; áp Owner code đúng hotel rồi mã sai/expired; đổi ngày/phòng phải requote. Tạo booking/hold; so DB inventory và quote snapshot.
3. Chọn simulator: success, fail, timeout, mất mạng, đóng app/mở lại, callback trùng/giả. Xác minh qua `Payment` + `PaymentWebhookReceipt` + `Booking`, không qua redirect UI. Thử trả tại khách sạn riêng: hiển thị chưa thu trực tuyến.
4. User mở mã booking, QR, lịch sử, hủy và yêu cầu hoàn phù hợp policy. Owner A xem booking/check-in/out; Owner B không truy cập được. Admin xem booking, payment, refund và Owner promo ở màn giám sát chỉ đọc.
5. Chạy N=2+ request tranh phòng cuối và 8 callback replay; ghi số hold/confirmed trước sau, error rate, event IDs (mask), queue lag. Lặp sau restart worker/API.

## Quan sát và xử lý sự cố

- Health: API liveness/readiness, kết nối PostgreSQL/Redis, pending/failed BullMQ, payment expiry sweep, webhook receipt và reconciliation case. Cần dashboard/log có correlation ID cho request → booking → payment → event; che email, điện thoại, token, signature.
- Nếu API/DB/worker không thể xác định tồn hoặc trạng thái payment, **ngừng nhận booking mới** ở gateway/feature flag vận hành trước khi thử lại. Không đánh dấu payment SUCCESS bằng tay qua UI. Giữ endpoint webhook nhận/ghi sự kiện có chữ ký hợp lệ hoặc trả retry theo provider contract.
- Đối với callback muộn/duplicate: tra `PaymentWebhookReceipt` và `PaymentReconciliationCase`, booking/hold hiện tại, tồn từng đêm và provider reference. Dùng luồng reconcile/refund có idempotency; không tự xác nhận phòng đã bán cho người khác.
- Với refund: kiểm tra booking snapshot, policy có cấu trúc, số tiền đã thu/đã hoàn, audit actor. Booking cũ thiếu rule để xử lý thủ công như quyết định nghiệp vụ đã chốt. Không gửi lại refund vì HTTP timeout khi chưa tra provider reference.

## Rollback và dữ liệu

Ứng dụng: giữ image/build SHA trước deploy, ngừng nhận booking mới, cho request đang bay dở kết thúc, chuyển về image cũ nếu schema còn backward-compatible, rồi kiểm tra lại health, quote, webhook/reconciliation và một booking sandbox. **Không rollback schema bằng cách xóa cột/bảng có dữ liệu**, dùng forward-fix migration đã rehearsal. Backup PostgreSQL trước deploy; restore vào database cô lập, đo RPO/RTO thực tế, đối chiếu booking/payment/receipt và inventory. Không thay database live bằng bản restore khi chưa xử lý giao dịch phát sinh sau backup.

## Gate phát hành và biên bản cần điền

Chỉ xét GO khi: mọi P0 trong [ma trận](./README.md) có bằng chứng API/DB/UI thích hợp; không còn lỗi Critical/Blocker auth, search, booking, payment, inventory, Owner, RBAC; test Android/iOS, provider sandbox, concurrency/replay, staging migration + restore, tải và audit dependency đều đạt hoặc có miễn trừ rủi ro được duyệt. Đo P95 với ≥5.000 approved hotels và 100 concurrent, lưu dataset/máy/mạng/số mẫu/p50/p95/error rate. Đo uptime, backup/restore và usability riêng; không suy từ unit test.

| Trường phát hành | Hiện tại |
|---|---|
| Base / branch | `bb26670` / `test/TK-08-kiem-thu-va-phat-hanh-mvp-dat-phong` |
| RC tag / GitHub CI run | Chưa tạo / [45434804154](https://github.com/NGUYENQUANGHUY1106/Booking_Travel/actions/runs/45434804154), secret/image/test PASS, audit FAIL |
| Staging URL / image digest | Chưa có |
| Android/iOS internal build ID | Chưa có |
| Device/sandbox smoke | Chưa chạy |
| Backup/restore và rollback rehearsal | Restore DB cô lập cục bộ PASS (61 bảng, 54 migration, 2,37 s); backup định kỳ, bản sao staging và rollback ứng dụng chưa chạy |
| Release notes | Nhánh tích hợp ST-OWN-10 với xác nhận ngày, mã Owner và Admin visibility; thêm gate PostgreSQL/HTTP, CI và hồ sơ TK-08. Chưa có bản phát hành. |
| Quyết định | **NO-GO** |

Nếu sau này cần merge protected branch, phát hành production hoặc phân phối công khai, trình gói bằng chứng và xin phê duyệt ở bước cuối; hiện không có action nào trong ba loại này được thực hiện.

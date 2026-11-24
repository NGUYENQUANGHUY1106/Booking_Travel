# TK-08 — Kiểm thử ứng viên MVP đặt phòng

Ngày kiểm tra: 24/11/2026 (Asia/Bangkok). Base `origin/develop`: `bb26670`; nhánh `test/TK-08-kiem-thu-va-phat-hanh-mvp-dat-phong`. Mã ST-OWN-10 còn chờ merge được đưa vào nhánh bằng merge commit `0258558` từ `fix/ST-OWN-10-owner-promo-code-user-admin-integration` (bao gồm sửa mã Owner dùng ở User và màn Admin). Không merge vào `develop`.

**Quyết định hiện tại: NO-GO cho phát hành MVP.** Test mã và PostgreSQL đạt ở máy phát triển, nhưng chưa có staging, build cài trên iOS/Android, smoke payment sandbox từ thiết bị, kiểm tra tải/backup/restore. `npm audit --omit=dev --audit-level=high` trả exit 1 với 8 cảnh báo high chưa được triage/xử lý. Đây là hồ sơ ứng viên, không phải biên bản đã phát hành.

## Phạm vi MVP đã chọn

Phạm vi 14 nhóm: (1) tìm khách sạn công khai; (2) chọn ngày/khách/phòng rõ ràng; (3) availability và sức chứa; (4) giá theo ngày; (5) quote do server tính; (6) voucher nền tảng/ưu đãi Owner; (7) tạo booking và giữ tồn; (8) khởi tạo/trạng thái thanh toán mô phỏng và trả tại khách sạn; (9) webhook/hold expiry; (10) xác nhận, QR, lịch sử; (11) hủy/hoàn theo policy; (12) Owner xem booking/check-in/out; (13) Admin giám sát booking/payment/promo; (14) RBAC và sở hữu. Đây là danh mục kiểm thử, **không phải tuyên bố 14/14 đạt nghiệm thu**. AI, tour và các màn ngoài hành trình đặt phòng không thuộc gate này.

Repository có `PROJECT OVERVIEW.docx`, `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx`, hướng dẫn AGENT và tài liệu task trong `docs/`. Các mã `FR-*` viết tắt trong ma trận đều có trong SRS. Chưa tìm thấy file Đặc tả chức năng, AI BUILD SPEC, Figma UI/UX Spec hoặc Sprint Plan riêng trong checkout; vì thế cột BUILD chính thức và RTM toàn bộ FR chưa thể xác minh. Figma: các node cấp trang `1:5` và `1:8` không trả context; đã mở một số frame con `5:1149`, `5:1169`, `5:1992`, còn `10:784` là đường vào Owner. Chưa có đối chiếu pixel hoặc thao tác trên thiết bị. UI mapping dưới đây dựa trên mã màn và ID nêu trong prompt, không coi screenshot Figma là bằng chứng runtime.

## Inventory xuyên lớp

| Luồng | API / model hiện có | Màn / bằng chứng tự động |
|---|---|
| Tìm/chi tiết/phòng | `GET /api/hotels/search`, `/api/hotels/:id`, `/api/hotels/:hotelId/rooms`, `/api/rooms/:id/availability`; `Hotel`, `Room`, `RoomInventoryOverride/Block` | `SearchScreens`, `LivePublicHotelDetail`, `RoomListScreen`, `RoomDetailScreen`; `hotel-availability-db`, `room-inventory-db` |
| Giá/quote | `POST /api/bookings/quote`; `RoomPricingRule`, `Booking` snapshot | `LiveBookingFlow`; `room-pricing-db`, `bookings.quote.spec.ts` |
| Ưu đãi | `OwnerPromotion`, `PlatformVoucher`, `OwnerPromotionUsage`; Owner CRUD và `GET /api/admin/owner-promotions` | `owner-promotions.e2e-spec.ts`, `platform-vouchers-api.e2e-spec.ts`; UI User/Admin cần smoke trên build |
| Booking/hold | `POST /api/bookings`, `GET /api/bookings`, `GET /api/bookings/:id/confirmation`; `Booking`, inventory, quote token | `LiveBookingFlow`, `LiveBookingConfirmationScreen`; `authorization-db`, `room-inventory-db` |
| Thanh toán/hoàn | `/api/payments/bookings/:bookingId/init`, `/api/payments/:provider/webhook`; `Payment`, `PaymentWebhookReceipt`, `RefundRequest`, outbox | `payment-webhook-db`, `payments-db`, refund unit/integration; chỉ simulator trong test này |
| Owner/Admin/quyền | Owner booking/stay API, `/api/admin/bookings`, Admin payment/promo routes; JWT guard + ownership | `owner-stay-db`, `admin-bookings.e2e-spec.ts`, `authorization-db` |

## Ma trận kiểm thử P0

`PASS` nghĩa là test tự động được chạy ở database cô lập hoặc unit suite. `BLOCKED` là thao tác thiết bị/staging chưa chạy. Mọi BUILD ID chưa có tài liệu đối chiếu được ghi `?`; không suy diễn coverage SRS.

| ID / FR–BUILD / UI | Fixture và bước chính | Expected API, DB, UI | Loại / kết quả / evidence |
|---|---|---|---|
| TK08-01 / HTL-09–? / HTL-UI-01 | User tìm ngày tương lai; hotel approved, hidden, suspended | Chỉ hotel bán được, không rò hotel ẩn | DB **PASS** `hotel-availability-db`, `room-inventory-db`; UI **BLOCKED** |
| TK08-02 / BKG-01–? / ROOM-UI-01/02 | Vào phòng từ Home/Search/Detail khi chưa xác nhận ngày | CTA mở chọn ngày, không nhảy thanh toán | logic **PASS** `stay-context.test.mjs`; thiết bị **BLOCKED** |
| TK08-03 / BKG-01–? / BKG-UI-01 | Chọn ngày qua tháng, back/refresh/foreground, đổi khách/phòng | `[in,out)`, context không tự lấy hôm nay, quote invalidated | unit **PASS** `stay-context.test.mjs`; lifecycle UI **BLOCKED** |
| TK08-04 / OWN-08–? / OWN-UI-15 | 0 phòng, một đêm hết, block, race booking/block | Không overbook, tồn không âm; thông báo sold-out | DB **PASS** `room-inventory-db`; UI **BLOCKED** |
| TK08-05 / OWN-09–? / OWN-UI-17 | Nhiều đêm, rule theo ngày/mùa | Breakdown theo từng đêm từ server | DB **PASS** `room-pricing-db`; UI **BLOCKED** |
| TK08-06 / BKG-01–? / BKG-UI-05 | Quote, đổi ngày/phòng, token hết hạn/client amount sai | Backend tính tổng và từ chối quote sai/hết hạn | unit **PASS** `bookings.quote.spec.ts`; API E2E riêng **BLOCKED** |
| TK08-07 / OWN-10–? / OWN-UI-19/20 | Owner A tạo mã, User cùng hotel áp dụng; 2 booking tranh quota 1 | Một booking dùng mã; không áp sai phòng/hotel | DB **PASS** `owner-promotions.e2e-spec.ts`; UI **BLOCKED** |
| TK08-08 / ADM-09–? / ADM-UI-18/19 | Admin xem Owner promo, không sửa qua platform form | Read-only Owner, quyền voucher tách biệt | `adminList` DB **PASS**; route/UI **BLOCKED** |
| TK08-09 / BKG-12–? / BKG-UI-01/02 | 2 request cùng phòng cuối, hold timeout, worker lặp | Chỉ 1 hold hợp lệ và release một lần | DB **PASS** `room-inventory-db`, `payment-webhook-db` |
| TK08-10 / BKG-05–? / PAY-UI-01..04 | Signature giả, amount sai, 8 callback trùng, success/fail muộn | Chỉ event hợp lệ đổi trạng thái đúng một lần | DB/HTTP **PASS** `payment-webhook-db`; provider thật **BLOCKED** |
| TK08-11 / BKG-04–? / PAY-UI-01 | Trả tại khách sạn và simulator | Không báo đã thu online khi trả tại KS | DB **PASS** `authorization-db`, `payments-db`; thiết bị **BLOCKED** |
| TK08-12 / BKG-09–? / BKG-UI-10 | Hủy/hoàn theo policy, replay, booking cũ không có rule | Không hoàn tự động nếu thiếu rule | unit **PASS** refund specs; sandbox thực **BLOCKED** |
| TK08-13 / BKG-06..12–? / BKG-UI-06..12 | Booking detail/QR/list sau app restart | User thấy đúng booking, QR chỉ khi hợp lệ | unit/API **PASS**; device restart **BLOCKED** |
| TK08-14 / OWN-11/12–? / OWN-UI-21..25 | Owner A/B xem booking, check-in/out | Chỉ Owner đúng hotel được thao tác | DB/HTTP **PASS** `authorization-db`, `owner-stay-db`; thiết bị **BLOCKED** |
| TK08-15 / ADM-06/07–? / ADM-UI-11..14 | Admin giám sát booking/payment/refund | Scope admin, dữ liệu khớp DB | API suite **PASS**; staging UI **BLOCKED** |
| TK08-16 / AUTH-08–? / mọi màn riêng tư | User A/B, Owner A/B, admin thiếu quyền, mass assignment | 401/403, không IDOR/PII | DB/HTTP **PASS** `authorization-db` |
| TK08-17 / NFR-PERF–? | 5.000 hotel, 100 concurrent, mạng 4G | P95 theo prompt, error rate đo được | **NOT_MEASURED**: chưa có dataset/staging |
| TK08-18 / NFR-OPS–? | Backup/restore, queue/Redis lỗi, AI lỗi | RPO/RTO, core booking sống, reconciliation | **NOT_MEASURED**: chưa có staging/backup harness |

Fixture DB: script `scripts/tk08-db-gates.cjs` tạo database tên ngẫu nhiên, áp 54 migration, nạp seed 6 tài khoản/3 role/3 hotel/4 phòng/3 booking/1 block, thêm tỉnh/phường giả để kiểm thử wizard, chạy toàn bộ 22 suite HTTP/DB và xóa database bằng `DROP DATABASE ... WITH (FORCE)`. Không dùng database nghiệp vụ hiện tại. Ngày test được tính tương đối trong các integration case. Script không in URL/credential.

## Gate và bằng chứng trên máy phát triển

| Gate | Lệnh / exit | Kết quả |
|---|---|---|
| Install | `npm.cmd ci --no-audit --no-fund` / 0 | 1554 packages, Node 24.19.0, npm 11.17.0 |
| Prisma client | `npm.cmd run prisma:generate` / 0 | Prisma 6.19.3 |
| Lint + type | `npm.cmd run lint`, `npm.cmd run typecheck` / 0 | Cả 2 workspace đạt |
| Unit API | `npm.cmd test -- --runInBand` / 0 | 60 suite pass, 270 test pass, 1 suite/5 test skip; npm không forward `--runInBand`, xem lệnh chuẩn trong CI |
| Logic mobile | `test:traveler`, `test:owner-dashboard`, `test:admin` / 0 | 37 + 6 + 6 pass; vài test admin dùng mock UI, không chứng minh API |
| PostgreSQL/HTTP | `node --env-file=.env scripts/tk08-db-gates.cjs` / 0 | 54 migration, seed verify, 22 suite/90 test pass; DB tạm đã xóa |
| Build | `npm.cmd run build`, Expo `export --platform web` / 0 | API build và web bundle; web artifact chỉ ở `D:/Temp/booking-travel-tk08-web` |
| Security | `npm.cmd audit --omit=dev --audit-level=high` / 1 | 17 advisory: 8 high, 8 moderate, 1 low; high gồm `multer`, `body-parser`, `follow-redirects`, Prisma config dependencies. Cần đánh giá tác động và nâng cấp có kiểm thử |
| CI GitHub | `.github/workflows/tk08-booking-gates.yml` | Chưa có run ID; workflow mới chưa được GitHub thực thi. Security step dự kiến đỏ cho đến khi xử lý audit |
| Thiết bị/staging/EAS | Không có lệnh thành công | **BLOCKED**: Docker daemon cục bộ chưa chạy, repo không có `eas.json`, chưa có credentials/device/staging URL |
| Hiệu năng/backup/restore | Chưa chạy | **NOT_MEASURED**; không công bố đạt SLO |

PostgreSQL cục bộ có sẵn ở `localhost:5432`; Docker Desktop daemon tại thời điểm kiểm tra không kết nối được. Test cô lập đã chứng minh migration từ schema sạch; **chưa thử nâng cấp từ bản sao dữ liệu đang vận hành**. Bộ audit có cảnh báo high ảnh hưởng dependency web/upload; chưa có quyết định miễn trừ có chủ sở hữu. Không lưu secret, OTP hay dữ liệu cá nhân trong hồ sơ này.

## Defect và phụ thuộc còn mở

| ID / mức | Tái hiện, nguyên nhân, trạng thái | Chủ xử lý |
|---|---|---|
| TK08-D01 / P1 test gate | Trước sửa, bật DB test `payment-webhook-db`: Nest test module thiếu `OwnerPromotionsService`, rồi `PricingService` sau khi ST-OWN-10 được tích hợp. Đã thêm provider vào test; 7 case webhook chạy lại pass. | Backend / đã sửa trên nhánh này |
| TK08-D02 / P1 fixture | Full E2E trên schema sạch: wizard test cần catalog địa chỉ nhưng seed không tạo. Test harness đã thêm tỉnh/phường giả trong DB tạm; 22 suite chạy lại pass. | QA / đã sửa trên nhánh này |
| TK08-R01 / release blocker | Audit 8 high; chưa có kiểm tra bản vá và đánh giá khai thác tương ứng. | Backend + dependency owner / OPEN |
| TK08-R02 / release blocker | Chưa có staging, internal build/thiết bị, payment sandbox end-to-end hoặc kiểm chứng User→Owner→Admin trên cùng booking. | DevOps/QA / BLOCKED |
| TK08-R03 / release blocker | Chưa đo tải 5k hotel/100 user, uptime, queue lag, backup/restore, rollback. | DevOps/QA / NOT_MEASURED |

Chi tiết chạy lại và phát hành có điều kiện: [RUNBOOK.md](./RUNBOOK.md). Pull request/CI run ID và build ID chỉ điền sau khi tạo/thực thi thật.

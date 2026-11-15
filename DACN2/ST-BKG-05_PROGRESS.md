# ST-BKG-05 checkpoint

- Branch: `feat/ST-BKG-05-xac-thuc-callback-webhook-thanh-toan` từ `origin/develop` `6b06d98`; BKG-01 commit `a10341c` được cherry-pick thành `fd21225` vì chưa merge vào develop.
- Worktree: `D:\App\Booking_Travel_ST_BKG_05`. Workspace chính và hai thư mục untracked trước đó được giữ nguyên.
- Đã thêm schema/migration Payment, receipt, reconciliation, outbox, booking method/deadline/EXPIRED; raw-body webhook simulator, status/init API, expiry worker, màn hình payment xử lý/thành công/thất bại, CLI mô phỏng và test.
- Migration `20261113010000_payment_webhook_simulator` đã áp dụng vào PostgreSQL local. Prisma generate thành công.
- Backend unit: 40 suites, 168 tests đạt; PostgreSQL payment E2E: 5 tests đạt; inventory E2E: 7 tests đạt; pricing E2E: 1 test đạt; mobile traveler: 18 tests đạt. Typecheck, lint, API build đạt. Đã smoke 3 màn payment bằng API/DB thật trên Expo web 390×844 và 360×800; ảnh nằm ở `docs/st-bkg-05/`.
- Đã commit `686f70c`, push nhánh và mở [PR #44](https://github.com/NGUYENQUANGHUY1106/Booking_Travel/pull/44) vào `develop`; PR không draft và chưa merge. Màn native và provider production chưa kiểm thử.
- Provider production, BKG-04 production, QR BKG-06 và notification worker chưa tồn tại trong repo; chỉ xác thực SIMULATOR local/test, không báo đã thanh toán thật.

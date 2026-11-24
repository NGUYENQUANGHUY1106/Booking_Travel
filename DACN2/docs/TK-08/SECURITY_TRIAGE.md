# TK-08 — Rà soát dependency của ứng viên phát hành

Ngày kiểm tra: 24/11/2026. Lệnh trên lockfile của nhánh TK-08: `npm ci --no-audit --no-fund` rồi `npm audit --omit=dev --audit-level=high`. Audit trả **exit 1**, gồm 4 mục high và 3 mục moderate. Bốn mục high là một chuỗi phụ thuộc `prisma -> @prisma/config -> deepmerge-ts, effect`, không phải bốn lỗ hổng độc lập.

| Gốc cảnh báo | Phiên bản đang khóa | Bản vá được công bố | Phạm vi đã xác minh |
|---|---|---|---|
| [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), `deepmerge-ts` | 7.1.5 | 8.0.0 | Prisma CLI 6.19.3 khóa chính xác 7.1.5; có trong công cụ generate/migrate/build |
| [GHSA-7589-6fvf-x4pw](https://github.com/Effect-TS/effect/security/advisories/GHSA-7589-6fvf-x4pw), `effect` | 3.21.0 | 3.22.1 | Prisma CLI 6.19.3 khóa chính xác 3.21.0; có trong công cụ generate/migrate/build |

Đã thử override hai thư viện lên bản vá trong bản sao manifest ngoài repo. `prisma generate`, `prisma migrate deploy` và audit đều chạy, nhưng `npm ls` báo **invalid** vì trái với phiên bản chính xác mà `@prisma/config` khai báo. Không giữ override này trong nhánh phát hành. Nâng Prisma 7 là thay đổi ORM lớn, cần kiểm tra tương thích schema, client, migration, driver và toàn bộ E2E trước khi áp dụng.

Dockerfile API trước đây sao chép toàn bộ `node_modules` từ bước build vào runtime. Nhánh TK-08 bổ sung `npm prune --omit=dev --omit=peer` **sau** generate/build. Run CI `45431267788` chứng minh `prune` một mình **không loại được** package Prisma CLI vì quan hệ peer optional với `@prisma/client`; phép kiểm tra cũ bằng `require.resolve('prisma')` đã bỏ sót điều này. Dockerfile hiện xóa rõ bốn package CLI/config có cảnh báo sau bước build. Trong bản sao dependency ngoài repo, đã tách bốn thư mục package này khỏi `node_modules`; Prisma Client vẫn thực hiện `SELECT 1` trên PostgreSQL cục bộ thành công. Image CI cần chạy lại để xác nhận cách đóng gói cuối cùng. Cảnh báo của audit trên lockfile vẫn phải được xử lý/duyệt rủi ro cho build/migration.

Ba mục moderate còn lại thuộc chuỗi `expo -> @expo/fingerprint -> minimatch` trong báo cáo audit; không hạ Expo SDK xuống bản cũ chỉ để làm sạch số liệu. Cần triage riêng nếu đưa ra public release.

**Quyết định:** chưa miễn trừ. Chủ xử lý: Backend + DevOps. Giữ gate audit **FAIL** và release **NO-GO** cho tới khi có bản vá tương thích được kiểm thử hoặc quyết định chấp nhận rủi ro được ghi nhận. Không đưa secret hay dữ liệu cá nhân vào báo cáo.

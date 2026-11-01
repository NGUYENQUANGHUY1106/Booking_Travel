# ST-OWN-03 — Dashboard Chủ khách sạn

## Trạng thái và nguồn

**Triển khai một phần, chưa đủ điều kiện nghiệm thu toàn bộ ST-OWN-03.** Đã có Dashboard/API thật cho phạm vi Hotel/Room/Booking. Các miền Payment/Refund, tồn phòng theo ngày/block, Review, Inbox và AI chưa có dữ liệu/contract thực thi trong repo; các metric tương ứng trả `unavailable`, không thay bằng số mẫu hoặc số 0.

- Traceability: `ST-OWN-03 → OWN-03 → FR-OWN-03 → BUILD-OWN-03 → OWN-UI-05`.
- Nhánh: `feat/ST-OWN-03-dashboard-chu-khach-san`, tạo từ `develop` đã fetch/pull fast-forward, base `9edcf5b`.
- Đã đối chiếu `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx` (FR-OWN-03/14 và yêu cầu ownership/data), `PROJECT OVERVIEW.docx`, tài liệu Jira nhóm 2 người, `CORE_BOOKING_API.md`, OWN-01/02, ADM-03, Prisma schema và hướng dẫn AGENT của hai app.
- Prompt đính kèm là nguồn yêu cầu triển khai. Không tìm thấy các file đặc tả chức năng/AI BUILD/UI spec/Sprint Plan độc lập mà prompt tham chiếu; không coi đó là tài liệu đã đọc. Tài liệu Jira hiện có xếp ST-OWN-03 vào Sprint 5; không dùng ví dụ sprint cũ để thay base Git hoặc phạm vi task.
- Đã lấy design context **và screenshot** Figma `5:777` (content `50:213`) và `6:860`, page `1:7`, section `131:2707`. [Màn chính](https://www.figma.com/design/TaRFo9CWYKQNORVPnpmHRP?node-id=5-777), [chưa có khách sạn](https://www.figma.com/design/TaRFo9CWYKQNORVPnpmHRP?node-id=6-860).
- Dùng Inter, nền card `#F2F7FF`, primary `#175ED6`, AI `#F0F0FF`, khoảng cách/card radius theo context. Đã tải và kiểm tra lại 5 SVG navigation; tái sử dụng asset local, viewport và callsite `20 × 20`. Không dùng URL asset Figma lúc chạy app. Không có Code Connect mapping riêng được trả về.

## Quyết định nghiệp vụ đã xác nhận

Người dùng đã chốt: **“Đặt phòng hôm nay” là booking tạo mới trong ngày theo `Asia/Ho_Chi_Minh`; nhận/trả phòng là mục riêng.**

| Trường | Định nghĩa |
| --- | --- |
| `bookings.count` | Số booking có `createdAt` trong `[00:00 dateFrom, 00:00 (dateTo + 1))` giờ Việt Nam. Đếm sự kiện tạo, bao gồm booking sau đó hủy/hoàn tiền; không coi đây là số booking đang có hiệu lực. |
| `previousCount`, `difference` | Kỳ liền trước có cùng số ngày lịch; chênh lệch tuyệt đối. Kỳ trước = 0 không chia phần trăm. |
| `actions.arrivals` | Booking `CONFIRMED`, `checkIn` = hôm nay giờ Việt Nam. Là số đặt phòng, không phải số người/phòng vật lý. |
| `actions.departures` | Booking `CHECKED_IN`, `checkOut` = hôm nay. |
| `summary.upcomingBookings` | Booking `CONFIRMED`, `checkIn` > hôm nay. Không bị lọc theo ngày tạo booking. |
| `summary.currentGuests` | Tổng `adults + children` của booking `CHECKED_IN` với `checkIn <= today < checkOut`. |
| `summary.roomCount` | Tổng `Room.quantity` chưa soft-delete của các hotel thuộc scope. Không được dùng thay tồn phòng có thể bán theo ngày. |
| `summary.hotelCount` | Hotel chưa soft-delete, đúng owner; bao gồm draft/pending/rejected/suspended. |

Ngày booking lưu `@db.Date`; `createdAt` lưu timestamp UTC. Query chuyển mốc ngày theo Vietnam time; không phụ thuộc timezone của máy chạy Node/PostgreSQL. Bộ lọc ngày chỉ áp dụng cho số booking tạo mới và kỳ so sánh; các việc vận hành vẫn tính hôm nay. UI ghi rõ điều này. Chọn một khoảng khác hôm nay đổi nhãn thành “Đặt phòng trong kỳ”.

## API và quyền

Hai endpoint chỉ đọc, có JWT/session hiện hành, role `HOTEL_OWNER`, Owner application `VERIFIED` và Owner profile đang hoạt động:

```http
GET /api/owner/dashboard?dateFrom=2026-11-01&dateTo=2026-11-01&timeZone=Asia%2FHo_Chi_Minh
GET /api/owner/dashboard?hotelId=<owned-id>&dateFrom=2026-11-01&dateTo=2026-11-07&timeZone=Asia%2FHo_Chi_Minh
GET /api/owner/dashboard/hotels?limit=30&after=<cursor>
```

- `hotelId` tùy chọn: bỏ trống lấy all-owned. `ownerId` không được nhận từ client; nguồn duy nhất là user đã xác thực. Hotel người khác, đã xóa hoặc không tồn tại đều trả 404.
- `dateFrom`, `dateTo`: YYYY-MM-DD thực, inclusive, từ <= đến, kỳ trước không vượt phạm vi năm hỗ trợ. `timeZone` bắt buộc đúng `Asia/Ho_Chi_Minh` theo quyết định đã chốt.
- Selector phân trang theo ID, mặc định 30, tối đa 100, trả `{items: [{id,name,status}], nextCursor}`. Cursor không mở rộng ownership.
- Response dashboard: `scope`, `updatedAt`, `summary`, `bookings`, `occupancy`, `revenue`, `revenueSeries`, `rating`, `actions`, `ai`. OpenAPI khai báo schema response, query và các lỗi 400/401/403/404.
- 401: thiếu/hết phiên, session bị thu hồi, tài khoản không hoạt động. 403: sai role hoặc quyền Owner chưa đủ/bị đình chỉ.
- `Cache-Control: private, no-store`. Không trả danh sách booking, tên/email khách hoặc thông tin Owner khác. Aggregate phía PostgreSQL trong transaction `RepeatableRead`; không tải toàn bộ booking về mobile để tính.
- Không thay Prisma schema, không cần migration/seed mới và không sửa `.env`.

### Hợp đồng partial data

| Miền | `reason` | Giá trị |
| --- | --- | --- |
| Lấp đầy | `INVENTORY_NOT_IMPLEMENTED` | `percentage`, `soldRoomNights`, `sellableRoomNights`: null |
| Doanh thu | `PAYMENT_REFUND_NOT_IMPLEMENTED` | `amount`, `currency`, `comparison`: null |
| Biểu đồ doanh thu | `REVENUE_POLICY_NOT_BASELINED` | `points`: null |
| Đánh giá | `REVIEWS_NOT_IMPLEMENTED` | `score`, `count`: null |
| Hỗ trợ | `INBOX_NOT_IMPLEMENTED` | unavailable |
| Gợi ý AI | `AI_NOT_IMPLEMENTED` | unavailable |

Mỗi miền trên có `availability: "unavailable"`. Chưa thể kiểm tra payment attempt/refund, room-night/block, review hidden/deleted hoặc zero bucket khi các model và chính sách ghi nhận chưa tồn tại. Không suy doanh thu từ `Booking.totalAmount`, rating từ `Hotel.starRating`, hoặc occupancy từ số booking/tồn phòng hiện tại.

## Mobile và điều hướng

- Route thực `/hotel-owner`, trong Expo Router hiện hữu. UI tách presentation, filter sheet, query/model và screen điều phối; không thêm thư viện.
- Bố cục giữ 4 KPI/2 cột, vùng biểu đồ, việc hôm nay, 3 thao tác nhanh, AI, navigation. Chart có unavailable state thay các cột mẫu. Những số summary còn lại nằm ở dòng phụ, không thêm KPI/chart ngoài Figma.
- Query key phân biệt user, session, role, hotel/all, ngày và timezone; không chứa token. Không dùng previous-data giữa các scope. Request nhận AbortSignal; logout/đổi account/session/role hủy request, xóa owner cache. Selection chỉ sống trong instance keyed theo session.
- Refresh khi trở lại tab/foreground, kéo xuống hoặc nút Làm mới; retry tối đa một lần, không retry 400/401/403/404. Refresh-token dùng interceptor sẵn có.
- Cache chỉ nằm trong bộ nhớ. Mất mạng cùng phiên/scope hiển thị dữ liệu cũ và thời điểm cập nhật; query paused cũng có thông báo. Mở app offline chưa có dữ liệu hiển thị trạng thái kết nối/thử lại. Không dùng mock fallback.
- Mất quyền 401/403 xóa cache và về auth/status. Hotel đã chọn bị xóa/mất ownership: ẩn metric cũ, có nút “Xem tất cả khách sạn” xóa cache scope cũ và reset selection.
- No Hotel khác hotel có 0 booking. CTA “Tạo khách sạn” hiện disabled kèm giải thích vì create-hotel UI hiện tại là mock. Thêm phòng/chặn phòng/giá, doanh thu chi tiết, inbox, chi tiết nhận/trả phòng chưa có luồng dữ liệu thật nên không dẫn vào màn mock từ Dashboard.
- Với phiên API, nhấn tab Khách sạn/Đặt phòng/Tin nhắn thông báo chưa khả dụng; phiên demo vẫn giữ các route demo cũ. Tab Tài khoản giữ luồng hiện hữu. Không viết lại các module đích.
- Safe-area bottom tính vào tab bar; nội dung cuộn được đến AI và nút cuối. Hotel name tối đa 2 dòng với accessibility label đầy đủ; vùng chọn hotel/date và quick action tối thiểu 44.

## Chạy và kiểm thử

Trong `DACN2`, chạy hai terminal:

```powershell
npm.cmd run dev:api
```

```powershell
npm.cmd run dev:mobile
```

Đăng nhập tài khoản Owner đã xác minh, chuyển sang chế độ Chủ khách sạn. Dữ liệu seed hiện hữu có `owner@bookingtravel.vn / owner123`, `owner-b@bookingtravel.vn / owner123` (chỉ môi trường phát triển; xem seed nếu đã đổi mật khẩu). Dashboard không dùng chế độ mock. Điện thoại Expo Go cần truy cập được API LAN của máy; giữ cấu hình IP hiện hữu trong `.env`, không cần đổi route.

Các kiểm tra đã chạy:

| Kiểm tra | Kết quả/phạm vi |
| --- | --- |
| Backend unit `owner-dashboard.service.spec.ts` | 9 ca: biên 00:00 Vietnam/ngày/tháng, tháng 2 nhuận, kỳ trước, ngày/múi giờ sai. |
| PostgreSQL + HTTP/JWT dashboard | 5 ca: A nhiều hotel/B riêng, scope/cursor, zero/no-hotel, dữ liệu chưa khả dụng, guest không bị lộ, 401/403/404, account/session/verification bị thu hồi. Clock nghiệp vụ cố định; fixture UUID riêng và cleanup. |
| Hồi quy `owner-verification-db.e2e-spec.ts` | 6 ca pass cùng 5 ca dashboard. |
| Mobile `test:owner-dashboard` | 4 ca: calendar Vietnam, cache scope/session, logout hủy request/response đến muộn, response hotel cũ không ghi đè hotel mới. |
| Lint/typecheck API và mobile | Pass. |
| Nest build, Expo web export | Pass. |
| Chrome chạy chính Expo web + API thật | Width 390×844 trước, rồi 360/375/412/430; 2 cột không tràn, cuộn AI qua navigation, hotel/date filter, ngày sai, đổi kỳ, offline có/không cache, retry/reconnect, session bị thu hồi về login và tab unavailable. |

Lệnh tái chạy từ `DACN2`:

```powershell
npm.cmd run lint --workspace @booking-travel/api
npm.cmd run typecheck --workspace @booking-travel/api
npm.cmd run build --workspace @booking-travel/api
npm.cmd run lint --workspace @booking-travel/mobile
npm.cmd run typecheck --workspace @booking-travel/mobile
npm.cmd run test:owner-dashboard --workspace @booking-travel/mobile
npm.cmd test --workspace @booking-travel/api -- --runInBand --testPathPatterns=owner-dashboard.service
```

Test database (dùng DB local đã migrate, fixture tự dọn; không chạy với DB production):

```powershell
cd apps/booking-travel-be
$env:RUN_DB_OWNER_E2E='1'
node ../../node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand --runTestsByPath test/owner-dashboard-db.e2e-spec.ts test/owner-verification-db.e2e-spec.ts
```

Script visual: `apps/booking-travel-app/test/owner-dashboard-visual-qa.py`; cần Chrome và `websocket-client`, API localhost:3000, Expo web export phục vụ ở localhost:19006 với SPA fallback. Đặt `OWN_QA_EMAIL`, `OWN_QA_PASSWORD`; script tự login/logout, ảnh vào thư mục temp. Xem ảnh đã kiểm tra: [đầu trang](./evidence/OWN-03/dashboard-top-390.png), [cuối trang](./evidence/OWN-03/dashboard-bottom-390.png), [offline](./evidence/OWN-03/dashboard-offline-390.png).

## Phần chưa thể nghiệm thu và PR đề xuất

1. Cần Payment/Refund và quyết định timestamp/status ghi nhận doanh thu, hoàn tiền, so sánh tháng và cửa sổ 7 ngày.
2. Cần inventory/block theo ngày, lịch sử thay đổi số phòng và các trạng thái tính sold/sellable room-nights; mẫu số 0 phải xử lý khi triển khai miền này.
3. Cần Review aggregate có moderation/soft delete và trọng số nhiều hotel; Inbox, các workflow quản lý Owner thực và AI nếu cung cấp insight.
4. Chưa chạy native iOS/Android hoặc kiểm tra font scaling/safe-area bằng thiết bị thật. Visual evidence là Expo web thật, không phải mockup, nhưng không chứng minh native pixel parity. Chưa đo P95 với 100 người dùng đồng thời; query server-side local không phải bằng chứng đạt NFR-PERF-03.

Tiêu đề PR: **ST-OWN-03 Dashboard Chủ khách sạn**. Target **develop**. Nội dung PR cần ghi rõ traceability, API/ownership/timezone đã triển khai, các kiểm tra trên và các dependency chưa có; không đánh dấu toàn bộ task Done. Không merge hoặc force-push.

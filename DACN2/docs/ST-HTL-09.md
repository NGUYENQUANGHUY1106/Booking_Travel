# ST-HTL-09 — Kiểm tra phòng trống theo ngày

## Nhánh và nguồn

- Nhánh: `feat/ST-HTL-09-kiem-tra-phong-trong-theo-ngay` trong worktree riêng `D:\App\Booking_Travel_ST_HTL_09`.
- Base `origin/develop`: `298e9c0`. Nhánh đã nhận commit `d83f974` từ ST-OWN-09 để dùng giá theo ngày; PR ST-OWN-09 cần được merge trước hoặc cùng với ST-HTL-09.
- Đã đọc `PROJECT OVERVIEW.docx`, `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx`, `apps/AGENT.md` và các AGENT/rules có liên quan. Bốn tài liệu `DAC_TA_CHUC_NANG_HE_THONG_BOOKING_TRAVEL.docx`, `AI_BUILD_SPEC_BOOKING_TRAVEL_HOAN_CHINH.docx`, `BOOKING_TRAVEL_FIGMA_UI_UX_SPEC_FULL.docx`, `BOOKING_TRAVEL_PROJECT_SPRINT_PLAN.docx` không có trong checkout này, kể cả biến thể `(1)`; vì vậy không thể xác nhận mã BUILD-HTL-09 hay TSK-SP2-03/04 trong các tài liệu đó. Đã đối chiếu các frame Figma 4:495, 4:523, 4:542, 4:680, 4:801, 4:823 qua Figma.

## Hợp đồng API

- `GET /api/rooms/:id/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&quantity=2&adults=2&children=0`: trả `roomTypeId`, `nights`, `requestedQty`, `availableQty`, `canBook`, `capacityFits`, `availabilityByDate`, `checkedAt`, `rateSummary`. Ngày checkout không tính tồn. Ví dụ hạng 5 phòng, đêm thứ hai khóa 3: `availableQty=2`, yêu cầu 3 thì `canBook=false` và HTTP 200. Ngày nhận quá khứ hoặc khoảng ngày sai trả 400; room không public trả 404, danh sách phòng thuộc hotel không public trả 403.
- `GET /api/hotels/:hotelId/rooms` dùng cùng ngày, số phòng và số khách, trả availability và giá theo từng hạng phòng. `GET /api/hotels` dùng cùng phép tính để loại hotel không có hạng phòng phù hợp suốt kỳ. Search chỉ đọc, không giữ phòng.
- Tồn mỗi đêm = `min(RoomType.quantity, sellableQty override nếu có) - booking chiếm tồn - room block đang active`; clamp về 0 khi dữ liệu âm, gắn `oversold` và ghi cảnh báo. `availableQty` kỳ lưu trú là giá trị nhỏ nhất trong các đêm. Override là trần số phòng có thể bán **trước** khi trừ booking/block.
- Trạng thái booking bị trừ tồn hiện có: `PENDING_PAYMENT`, `CONFIRMED`, `CHECKED_IN`. `CANCELLED`, `COMPLETED`, `REFUND_PENDING`, `REFUNDED` không bị trừ. Repo chưa có `holdExpiresAt`/job hết hạn của BKG-12, nên booking `PENDING_PAYMENT` chưa được tự giải phóng theo TTL; đây là phần phụ thuộc của BKG-12, không phải đã hoàn thành trong HTL-09.
- Giá `rateSummary` được tính từng đêm trên server từ ST-OWN-09. `minPricePerNight` là “giá từ/đêm” trong kỳ; `totalRoomAmount` chỉ là tạm tính tiền phòng cho số phòng yêu cầu, chưa gồm thuế/phí/voucher của BKG-01. Booking tạo mới đã có recheck và lock trong transaction; search/room list có thể cùng thấy phòng cuối.

## App User

- Search theo ngày/khách/phòng, ngày mặc định hiện tại theo giờ Việt Nam. Chọn ngày từ Room List/Hotel Detail giữ `hotelId` và quay lại danh sách phòng tương ứng. Phòng hết hoặc không đủ sức chứa không chọn được. Room List, Room Detail và Hotel Detail đều dùng số phòng còn và giá theo kỳ thật.
- Trước khi chuyển sang màn booking review, app refetch và báo khi giá/tồn thay đổi. Màn booking review/checkout live hiện là phần phụ thuộc của BKG-01/02; task này không tạo checkout giả.
- Theo frame 4:801, card chọn phòng rồi CTA toàn màn “Tiếp tục đặt phòng”; các giá, tên, ảnh minh họa trong Figma không được hardcode vào luồng live.

## Kiểm tra đã chạy

- `npm.cmd ci`, `npm.cmd run prisma:generate`, `npm.cmd run prisma:migrate`: thành công, không có migration mới.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`: qua; 35 suite, 150 unit tests.
- `RUN_DB_INVENTORY_E2E=1 npm.cmd run test:e2e -- room-inventory-db.e2e-spec.ts`: 7 test qua, bao gồm race booking/block và rollback.
- `RUN_DB_HTL09_E2E=1 npm.cmd run test:e2e -- hotel-availability-db.e2e-spec.ts`: 2 test qua; hai Owner, tồn 2 đêm, yêu cầu quá tồn, giá quy tắc, capacity, hotel suspended, room inactive.
- Smoke HTTP trên PostgreSQL local với 5 hotel public: search theo ngày trả nhiều Owner; phòng 5 còn, yêu cầu 6 trả `availableQty=5`, `canBook=false`; ngày cũ trả 400. API khởi động thành công sau khi thêm `AuthModule` vào `PricingModule` của commit ST-OWN-09.
- Expo web tại viewport thật 390×844 và 360×844: `documentElement.scrollWidth` bằng viewport, CTA không bị clip; date picker có `hotelId` chuyển về `/user/screen/rooms?hotelId=...`, chọn phòng hiển thị “Đã chọn”. Chưa kiểm thử trên điện thoại vật lý.

## Giới hạn còn lại

- Các API search hiện trả mảng không phân trang; batch truy vấn inventory đã loại N+1 theo phòng nhưng pagination lớn và cache invalidation chủ động chưa có trong contract hiện tại.
- BKG-12 chưa có TTL/worker giải phóng hold; BKG-01 chưa có quote cuối cùng gồm thuế/phí/voucher. Những phần này không được giả định hoàn thành bởi màn kiểm tra phòng trống.
- Ảnh phòng trong smoke seed Blue Horizon trống nên UI hiển thị trạng thái “Phòng chưa có ảnh đã xác minh”. Media thật do Owner cung cấp sẽ hiển thị qua metadata public hiện có.

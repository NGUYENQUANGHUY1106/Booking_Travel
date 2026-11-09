# ST-OWN-08 — Lịch phòng trống và khóa phòng

## Quy tắc tồn phòng

`Room.quantity` là tổng số phòng của hạng. Mỗi ngày là một đêm theo lịch địa phương Việt Nam; khoảng lưu trú và block dùng `[startDate, endDateExclusive)`. `PENDING_PAYMENT`, `CONFIRMED`, `CHECKED_IN` chiếm phòng; các trạng thái còn lại không chiếm. Mỗi đêm:

```text
sức chứa bán = min(Room.quantity, sellableOverride nếu có)
còn trống = sức chứa bán - tổng booking đang giữ - tổng block đang hoạt động
còn trống cho kỳ lưu trú = min(còn trống của từng đêm)
```

Booking tạo mới, API `/rooms/:id/availability`, tìm khách sạn theo ngày và thao tác Owner dùng cùng phép tính. Booking và thao tác Owner khóa cùng `roomId` bằng advisory transaction lock. Một mutation thất bại sẽ rollback cả khoảng ngày. `revision` phòng ngăn thao tác Owner ghi lên lịch cũ; `idempotencyKey` giữ kết quả của yêu cầu đã thực hiện. Audit và thông báo PostgreSQL `availability_changed` / `room_blocked` được ghi/phát trong giao dịch; thông báo chỉ đến subscriber sau commit.

## API Owner

Tất cả dưới `/api/owner/hotels/:hotelId/rooms/:roomId/inventory`, yêu cầu JWT `HOTEL_OWNER` và kiểm tra room thuộc đúng hotel/owner.

| Method | Path | Công dụng |
| --- | --- | --- |
| GET | `?month=YYYY-MM` | Ngày, sức chứa, đã đặt, đã chặn, còn trống, override, block và booking summary của tháng. |
| POST | `/blocks` | Chặn `quantity` phòng trong `[startDate,endDateExclusive)`, có `reason`, `expectedRevision`, `idempotencyKey` UUID. |
| PATCH | `/blocks/:blockId` | Sửa ngày/số lượng/lý do, thêm `expectedVersion` của block. |
| DELETE | `/blocks/:blockId` | Bỏ chặn mềm, body gồm `expectedVersion`, `expectedRevision`, `idempotencyKey`. |
| PUT | `/override` | Đặt `sellableQty` từ 0 đến tổng phòng cho mỗi đêm; gửi `null` để về tổng phòng. |

`GET /api/rooms/:id/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD` trả tồn thấp nhất trong kỳ. `GET /api/hotels?checkIn=...&checkOut=...&rooms=2` chỉ trả khách sạn có hạng phòng đủ số lượng yêu cầu; giá thấp nhất lấy từ hạng phòng còn bán được.

## Kiểm thử và chạy

Từ `DACN2`:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test -- --runInBand
```

Kiểm thử PostgreSQL với fixture UUID riêng (tự dọn sau khi chạy):

```powershell
cd apps/booking-travel-be
$env:RUN_DB_INVENTORY_E2E='1'
node --env-file=../../.env ../../node_modules/jest/bin/jest.js --config ./test/jest-e2e.json --runInBand room-inventory-db.e2e-spec.ts
```

Trên Expo: đăng nhập Chủ khách sạn → Chỗ ở của tôi → chi tiết → Hạng phòng → **Lịch phòng trống**. Tab Lịch phòng trống cũng cho chọn khách sạn/hạng phòng. Chọn một đêm hoặc hai mốc để tạo khoảng đêm; ngày kết thúc API không được tính. Chọn ngày có booking/block để xem chi tiết, chỉnh hoặc bỏ chặn. Giao diện đối chiếu Figma `5:1055`, `16:348`, `16:363`, `5:1088`; số liệu mẫu trên Figma không được dùng làm dữ liệu chạy.

## Phụ thuộc còn lại

- Schema hiện chưa có hạn thanh toán hay worker hết hạn `PENDING_PAYMENT`; booking loại này tiếp tục chiếm tồn cho đến khi trạng thái đổi. Không tự giải phóng bằng đồng hồ UI vì payment callback hiện chưa có cơ chế xác nhận an toàn sau khi hết hạn.
- Hotel chưa có trường timezone riêng, nên quy tắc ngày quá khứ của Owner dùng `Asia/Ho_Chi_Minh`. API date-only lưu PostgreSQL `DATE`.
- OWN-09 giá theo đêm chưa có trong backend. Lịch tồn phòng không hiện nút cập nhật giá và không bịa giá hiệu lực.
- Không có subscriber/cache phân tán cho PostgreSQL `NOTIFY`. API đọc trực tiếp DB; client hiện tại invalidate query khi thao tác thành công, các client khác làm mới theo vòng đời query.
- Trong repository chỉ có `PROJECT OVERVIEW.docx` và `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx` trong sáu tài liệu được nhắc ở prompt. Bốn tài liệu chức năng/build/Figma spec/sprint plan chưa có file để đối chiếu.

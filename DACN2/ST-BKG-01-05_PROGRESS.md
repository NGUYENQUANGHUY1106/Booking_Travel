# ST-BKG-01/05 — Kỳ lưu trú phải do khách xác nhận

## Git và nguyên nhân

- Nhánh: `fix/ST-BKG-01-05-chon-ngay-truoc-thanh-toan`; base `develop`/`origin/develop` tại `6b06d98`.
- Các commit ST-BKG-01/05 chưa ở `develop` đã được cherry-pick trên nhánh fix (không thay đổi các nhánh gốc).
- `src/features/traveler/store.ts` từng khởi tạo `checkIn/checkOut` bằng hôm nay và ngày mai rồi persist. `rooms/RoomListScreen.tsx`, `rooms/RoomDetailScreen.tsx`, `hotel-detail/HotelDetailScreen.tsx` và `booking-quote-api.ts` chỉ kiểm tra chuỗi ngày hợp lệ, nên ngày mặc định đủ để gọi availability và tạo quote. Điều hướng sang Review sau chọn phòng dùng cùng state đó.

## Luồng hiện tại

- Store bắt đầu với hai ngày rỗng. `staySelection` ghi nguồn Search/Hotel và thời điểm xác nhận khi khách bấm CTA trên lịch. Dữ liệu persist cũ chỉ có ngày mà không có xác nhận không được khôi phục thành kỳ đặt phòng.
- Home/yêu thích/deep link tới Hotel/Room vẫn xem được thông tin và giá tham khảo; nút chọn phòng đưa tới lịch. Search chỉ kế thừa ngày đã xác nhận cho khách sạn được mở từ kết quả. Đổi khách sạn ở đường khác xóa kỳ cũ.
- Thay ngày, phòng hoặc số khách/phòng làm quote/query dùng key mới và vô hiệu xác nhận thông tin khách. Review chỉ dùng quote server trùng room/hotel/ngày/số khách/số phòng và còn hạn. Review đi tới thông tin khách, rồi xác nhận booking trước khi gọi Payment Init.
- Ba điểm chọn phòng kiểm tra kết quả `refetch` mới; khi lỗi mạng, không đi tiếp bằng dữ liệu tồn phòng đã cache.
- API quote/booking/payment từ ST-BKG-01/05 được giữ nguyên: quote kiểm tra tồn cả kỳ, giá từng đêm và ký context; booking kiểm tra lại quote/giá/tồn; webhook có chữ ký, chống lặp và chỉ xác nhận theo trạng thái server. Không có migration mới cho sửa luồng chọn ngày.

## Kiểm chứng đã chạy

- `npm.cmd run prisma:generate`: qua; `npm.cmd run prisma:migrate --workspace @booking-travel/api`: không có migration chờ áp dụng.
- Mobile: `test:traveler` 22/22, `typecheck` và `lint` qua.
- API: `typecheck`, `lint`; unit booking/inventory 22/22, quote token 2/2, chữ ký simulator 3/3; DB e2e webhook 5/5, inventory 7/7, pricing 1/1.
- API trực tiếp: quote thiếu ngày 400, tạo booking thiếu quoteId 400. Payment Init khi simulator tắt trả 503 trước khi xét booking.
- Expo web + Chrome headless 390×844: hai khách sạn không có ngày vẫn mở Hotel/Room và yêu cầu chọn lịch; 20–23/12/2026, 2 phòng, 3 khách giữ qua Search → Hotel → Room → Review; đổi từ Deluxe sang Superior tạo quote đúng phòng mới; Review → thông tin khách; deep link Review không ngày không có quote. Room Detail ở 360px có `scrollWidth=360`.
- Expo export bundle Android: qua; xuất vào `D:\Temp\booking-travel-stay-android-export`, ngoài repository.
- Đã đối chiếu Figma User: SEARCH-UI-03, HTL-UI-01, ROOM-UI-01/02, BKG-UI-01/02/05 và PAY-UI-01/02/03/04. Giữ card kỳ lưu trú, giá từng đêm và CTA chính theo hệ giao diện hiện có.

## Giới hạn kiểm chứng

- Android emulator `Pixel_8_Pro_API_35` với Expo Go: mở trực tiếp danh sách phòng khi chưa chọn ngày, app yêu cầu chọn ngày và chỉ hiện giá tham khảo; chọn 20–22/11/2026 rồi xác nhận, app hiện giá và số phòng còn trống cho cả kỳ; chọn phòng và sang Review. Review yêu cầu đăng nhập nên chưa kiểm tra quote/Guest/Payment bằng tài khoản thật trên native. Phiên emulator dùng `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000/api` để kết nối API trên máy host; không thay đổi `.env`. Chưa kiểm tra font tăng cỡ.
- Bốn tài liệu `DAC_TA_CHUC_NANG_HE_THONG_BOOKING_TRAVEL.docx`, `AI_BUILD_SPEC_BOOKING_TRAVEL_HOAN_CHINH.docx`, `BOOKING_TRAVEL_FIGMA_UI_UX_SPEC_FULL.docx`, `BOOKING_TRAVEL_PROJECT_SPRINT_PLAN.docx` không có trong workspace. `PROJECT OVERVIEW.docx` và `SRS_BOOKING_TRAVEL_HOAN_CHINH.docx` đã được đối chiếu.

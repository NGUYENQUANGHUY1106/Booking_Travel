# Tiến độ SCRUM-99, SCRUM-100 và SCRUM-101

| Task | Nhánh | Kiểm thử và build | Commit chức năng | PR | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| SCRUM-99 · ST-AI-06 | `SCRUM-99-st-ai-06-tom-tắt-va-phan-tich-cảm-xuc-review` | Backend, Expo, Edge và PostgreSQL với Gemini thật đạt | `5425a47` | [#80](https://github.com/NGUYENQUANGHUY1106/Booking_Travel/pull/80) | Chờ review vào develop |
| SCRUM-100 · ST-USR-04 | `SCRUM-100-st-usr-04-lịch-sử-tim-kiếm-va-khach-sạn-da-xem` | Backend, Expo, Edge, PostgreSQL và GitHub Actions đạt | `a2abce6` | [#81](https://github.com/NGUYENQUANGHUY1106/Booking_Travel/pull/81) | Đã merge vào develop tại `b1f8033` |
| SCRUM-101 · ST-AI-03 | `SCRUM-101-st-ai-03-gợi-y-khach-sạn-ca-nhan-hoa` | Backend, Expo, Edge và PostgreSQL đạt cục bộ | `89bcae5` | [#82](https://github.com/NGUYENQUANGHUY1106/Booking_Travel/pull/82) | Chờ CI và review vào develop |

- SCRUM-99 chứa migration `AIReviewSummary`, API và giao diện tóm tắt. [Hướng dẫn kiểm thử](../testing/SCRUM-99-ST-AI-06-TEST-GUIDE.md).
- SCRUM-100 lưu tìm kiếm và khách sạn đã xem theo tùy chọn đồng ý. [Hướng dẫn kiểm thử](../testing/SCRUM-100-ST-USR-04-TEST-GUIDE.md).
- SCRUM-101 xếp hạng khách sạn theo sở thích đã khai báo và điểm đánh giá, đồng thời kiểm tra phòng còn bán theo kỳ lưu trú. [Hướng dẫn trên nhánh SCRUM-101](https://github.com/NGUYENQUANGHUY1106/Booking_Travel/blob/89bcae5cc33eda7ca82802e2092c1f6db938dc9b/DACN2/docs/testing/SCRUM-101-ST-AI-03-TEST-GUIDE.md).
- Git ghép được ba thay đổi trên cùng lịch sử. SCRUM-101 có thể tiếp tục review từ PR #82.

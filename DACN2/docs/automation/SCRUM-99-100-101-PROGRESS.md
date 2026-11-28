# Tiến độ SCRUM-99, SCRUM-100 và SCRUM-101

| Task | Implementation | Test | Commit / Push / PR | Status |
| --- | --- | --- | --- | --- |
| SCRUM-99 · ST-AI-06 | Gemini Review Summary cho khách, chủ khách sạn và admin | Unit, HTTP + PostgreSQL + Gemini, web rộng và hẹp, Expo export | Đang xuất bản PR vào develop | Đã xác minh triển khai |
| SCRUM-100 · ST-USR-04 | Đối chiếu FR-USR-04 | Chờ triển khai | Chờ PR SCRUM-99 | Pending |
| SCRUM-101 · ST-AI-03 | Đối chiếu FR-AI-03 | Chờ triển khai | Cần ST-USR-04 trên develop | Pending |

## SCRUM-99

- Nhánh `SCRUM-99-st-ai-06-tom-tắt-va-phan-tich-cảm-xuc-review` xuất phát từ `origin/develop` tại `ed0dd52`.
- Dùng Gemini `gemini-3.1-flash-lite` phân loại văn bản đánh giá công khai. PostgreSQL lưu kết quả và phiên bản theo tập nhận xét.
- Đã dùng riêng dữ liệu tổng hợp cho kiểm thử Gemini. Hướng dẫn tại [SCRUM-99-ST-AI-06-TEST-GUIDE.md](../testing/SCRUM-99-ST-AI-06-TEST-GUIDE.md).
- FR-USR-04 yêu cầu lịch sử cục bộ cho khách vãng lai, ghi nhận có đồng ý và có thao tác xóa. FR-AI-03 phụ thuộc FR-USR-02 và FR-USR-04.

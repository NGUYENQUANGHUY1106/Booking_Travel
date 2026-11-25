# TK-08: đo tìm kiếm ở máy local

Ngày: 25/11/2026. Đây là phép thử khám phá trên máy phát triển, **không phải** phép đo nghiệm thu ở staging hoặc mạng 4G.

## Cấu hình và cách chạy

- Máy Windows, Intel Core i7-12700H (20 luồng), RAM 15,7 GiB; Node 24.19.0.
- PostgreSQL/PostGIS trong Docker Desktop, publish `127.0.0.1:5433`; Redis cùng Compose. Nest API chạy bằng Node trên host, kết nối tới database PostgreSQL trong Docker.
- `scripts/tk08-local-search-load.cjs` chỉ chấp nhận `DATABASE_URL` trên loopback; nó tạo database ngẫu nhiên, áp dụng 54 migration, nạp 5.000 khách sạn đã duyệt và 5.000 phòng đang hoạt động, rồi xóa database trong `finally`. Không dùng dữ liệu nghiệp vụ hay seed tài khoản thật.
- Một truy vấn `GET /api/hotels/search` với điểm đến `Da Nang`, ngày nhận/trả tương lai cách nhau một đêm, 2 người lớn, 1 phòng, giới hạn 20 kết quả. Một warmup, sau đó hai đợt 100 yêu cầu HTTP đồng thời (200 mẫu), timeout client 30 giây. HTTP 500, timeout và sai tổng kết quả đều tính là lỗi.
- Chạy từ `DACN2` với `DATABASE_URL` trỏ tới PostgreSQL local phù hợp. Với Compose đang publish PostgreSQL ở cổng `5433`, PowerShell có thể lấy cấu hình trực tiếp mà không in mật khẩu:

```powershell
$cfg = docker compose -f docker-compose.yml config --format json | ConvertFrom-Json
$pg = $cfg.services.postgres.environment
$dbUser = [uri]::EscapeDataString([string]$pg.POSTGRES_USER)
$dbPassword = [uri]::EscapeDataString([string]$pg.POSTGRES_PASSWORD)
$dbName = [uri]::EscapeDataString([string]$pg.POSTGRES_DB)
$env:DATABASE_URL = 'postgresql://{0}:{1}@127.0.0.1:5433/{2}?schema=public' -f $dbUser,$dbPassword,$dbName
try {
  node --env-file=.env scripts/tk08-local-search-load.cjs
} finally {
  Remove-Item Env:DATABASE_URL
}
```

Script in thống kê, không in mật khẩu; mã thoát 1 nếu có yêu cầu lỗi.

## Kết quả

| Lần | Warmup | Thành công / tổng | Loại lỗi | P50 / P95 của yêu cầu thành công | Tổng thời gian |
|---|---:|---:|---|---:|---:|
| 1 | Không ghi | 109 / 200 | 91 yêu cầu thất bại; chưa phân loại | 18.599 / 21.390 ms | 41,46 s |
| 2 | 2.957 ms | 156 / 200 | 44 HTTP 500; chưa thu mã backend | 14.090 / 19.762 ms | 35,01 s |
| 3 | 2.918 ms | 148 / 200 | 52 HTTP 500, đều là Prisma `P2024` | 13.630 / 18.397 ms | 33,46 s |

Prisma báo hết thời gian chờ lấy connection từ pool (timeout 10 giây, giới hạn 29 connection). `HotelsService.search()` đang gọi `list()` để tải toàn bộ khách sạn phù hợp và dữ liệu phòng trước khi lọc, tạo facet và phân trang. Với 5.000 khách sạn, ngay cả warmup một yêu cầu cũng mất gần 3 giây; 100 yêu cầu đồng thời gây nghẽn pool. P95 chỉ tính trên phản hồi thành công nên còn đánh giá thấp trải nghiệm tổng thể. Database tạm của cả ba lần đã được xóa.

**Kết luận: FAIL ở local, chưa đo nghiệm thu staging.** Mục tiêu trong prompt là P95 tìm kiếm ≤1,5 giây với ít nhất 5.000 khách sạn và 100 người dùng đồng thời. Cần thiết kế lại truy vấn tìm kiếm/facet, giảm dữ liệu và số truy vấn trước phân trang, rồi chạy lại trên staging có cấu hình và mạng đo được. Không cache availability hay trạng thái thanh toán làm nguồn sự thật. Đây là release blocker `TK08-R05`; giữ **NO-GO**.

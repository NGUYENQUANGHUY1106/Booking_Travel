# Dữ liệu địa chỉ Việt Nam

## Nguồn và phiên bản

| Dataset                        | Nguồn                                                                      | Snapshot                | Phạm vi                                                   |
| ------------------------------ | -------------------------------------------------------------------------- | ----------------------- | --------------------------------------------------------- |
| `current.json`                 | Dịch vụ Danh mục hành chính của Cục Thống kê (NSO)                         | snapshot tại 10/10/2026 | 34 tỉnh/thành và 3.321 đơn vị cấp xã                      |
| `legacy.json`                  | Dịch vụ Danh mục hành chính của Cục Thống kê và bảng chuyển đổi chính thức | tại 30/06/2025          | 63 tỉnh/thành, 696 đơn vị cấp huyện, 10.035 đơn vị cấp xã |
| `official-transition-map.xlsx` | Bảng chuyển đổi đơn vị hành chính mới–cũ của Cục Thống kê                  | áp dụng từ 01/07/2025   | 10.565 dòng ánh xạ nguồn; hỗ trợ quan hệ nhiều–nhiều      |

Nguồn chính thức:

- Quyết định 19/2025/QĐ-TTg: `https://vanban.chinhphu.vn/?classid=1&docid=214409&orggroupid=3&pageid=27160`
- Danh mục hành chính NSO: `https://danhmuchanhchinh.nso.gov.vn/`
- Dịch vụ SOAP NSO: `https://danhmuchanhchinh.nso.gov.vn/DMDVHC.asmx?WSDL`
- Trang đối chiếu cũ–mới: `https://danhmuchanhchinh.nso.gov.vn/Doi_Chieu_Moi.aspx`
- Nghị quyết 30/2026/QH16 (thành phố Đồng Nai): `https://vanban.chinhphu.vn/?classid=1&docid=218009&orggroupid=1&pageid=27160`
- Nghị quyết 36/2026/QH16 (thành phố Quảng Ninh): `https://vanban.chinhphu.vn/?classid=1&docid=219325&orggroupid=1&pageid=27160`
- Nghị quyết 39/2026/QH16 (thành phố Bắc Ninh): `https://vanban.chinhphu.vn/?docid=219328&orggroupid=1&pageid=27160`

Snapshot hiện hành lấy trực tiếp cả tên, loại và mã từ NSO để không bỏ sót các thay đổi hợp pháp sau Quyết định 19/2025/QĐ-TTg (ví dụ các thay đổi loại hình cấp tỉnh trong năm 2026). Quyết định 19 là mốc tạo catalog hai cấp ngày 01/07/2025, không được dùng để ghi đè snapshot mới hơn.

Dịch vụ SOAP hiện không trả các cấp huyện cũ của Bắc Giang khi lọc tại 30/06/2025. Pipeline thử snapshot 31/12/2024 và bổ sung chính xác 10 cấp huyện, 192 cấp xã còn thiếu từ chính bảng chuyển đổi NSO. Validator bắt buộc toàn bộ 10.565 dòng chuyển đổi phải tham chiếu được đến cả đơn vị nguồn và đích; vì vậy fallback này không âm thầm bỏ dữ liệu.

## Tính toàn vẹn

`data:validate:vn` kiểm tra mã trùng, mã sai định dạng, đơn vị mồ côi, đủ đúng 34 tỉnh/thành và 3.321 đơn vị cấp xã hiện hành, đồng thời kiểm tra bảng chuyển đổi có trên 10.000 dòng. Importer ghi nguồn, version, checksum và từng lần chạy vào database. Địa chỉ đã lưu giữ cả khóa ngoại lẫn snapshot tên/mã/version để lịch sử hiển thị không bị thay đổi khi cập nhật catalog.

## Phạm vi chưa có dữ liệu đầy đủ

- Chưa có nguồn mở chính thức, toàn quốc và ổn định cho đường/phố, thôn/ấp/tổ dân phố, mã bưu chính và tọa độ. Vì vậy các trường này là tùy chọn; người dùng có thể nhập đường/phố thủ công.
- Bảng `Street` và quan hệ theo cấp xã đã sẵn sàng để nhập một dataset đã được thẩm định sau này. Không tự động thu thập hàng loạt từ Google Maps hoặc nguồn có điều khoản không cho phép.
- Hệ thống không gọi geocoding trong luồng lưu địa chỉ hiện tại, nên không cần API key và không phát sinh chi phí bên thứ ba.
- Cổng dữ liệu hành chính công bố dữ liệu để tra cứu nhưng không nêu giấy phép tái phân phối máy đọc một cách rõ ràng trên trang dịch vụ. Cần xác minh điều khoản với cơ quan phát hành trước khi phân phối dataset ra ngoài sản phẩm.

## Quy trình cập nhật an toàn

1. Chạy `npm.cmd run data:fetch:vn` trên nhánh riêng.
2. Chạy `npm.cmd run data:validate:vn` và xem lại số lượng/diff.
3. Cập nhật version/effective date trong script nếu văn bản pháp lý thay đổi.
4. Sao lưu database, chạy migration rồi `npm.cmd run data:import:vn`.
5. Kiểm tra `ImportRun`, API catalog và một mẫu ánh xạ cũ–mới trước khi phát hành.

Không tự suy diễn quan hệ lịch sử khi nguồn chính thức không có dòng ánh xạ. Dòng “nhập một phần” được lưu là `PARTIALLY_TRANSFERRED_TO`; một đơn vị cũ xuất hiện ở nhiều đích được lưu là `SPLIT_INTO`; đổi tên/loại hình và sáp nhập được giữ riêng.

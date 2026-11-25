Quản lý Booking Travel trên Jira cho nhóm 2 người

Kế hoạch triển khai và hướng dẫn sử dụng Jira  
Ngày lập 13 tháng 10 năm 2026

# 1 Tổng quan và tính khả thi

Booking Travel quản lý tìm kiếm và đặt phòng khách sạn cho USER HOTEL\_OWNER ADMIN\. Kế hoạch chia 90 chức năng thành 90 Story, 12 Task kỹ thuật, 270 Sub\-task và 19 Epic\. Nhóm chỉ gồm Developer A và Developer B\. AI là dịch vụ hỗ trợ\. Phạm vi không có kinh doanh tour\.

Giả định mỗi người dành 20 giờ mỗi tuần\. Một Sprint 2 tuần có 40 giờ mỗi người; dành 12 giờ cho review, họp, tích hợp và phát sinh, còn 28 giờ để tự ước lượng công việc\. Ngân sách thử nghiệm 16 SP mỗi người mỗi Sprint là giả thuyết planning độc lập với giờ, không phải velocity\. Ước lượng hiện tại 544 SP, A 298 SP và B 246 SP\. Lịch phụ thuộc thận trọng gồm 22 Sprint, khoảng 44 tuần; MVP ở Sprint 13, core cộng AI cơ bản ở Sprint 17\. Đây là lịch định hướng, không phải cam kết hoàn thành\.

Kế hoạch cũ 5 Sprint 11 tuần cho 5 người không phù hợp để chuyển nguyên sang nhóm 2 người\. 55 người tuần giảm còn 22 người tuần trong cùng 11 tuần, chưa tính kinh nghiệm và review\. Không dùng tỷ lệ này để suy ra ngày hoàn thành\. Mốc 11 tuần chỉ khả thi cho phạm vi demo nhỏ được thống nhất và ghi rõ phần hoãn; toàn bộ 90 chức năng vẫn ở backlog\.

Ngày bắt đầu giả định 19/10/2026; ngày kết thúc Sprint là thứ Sáu tuần thứ hai, cuối tuần không lập lịch\. Lịch chưa trừ ngày lễ, kỳ thi hoặc nghỉ học\. Các Sprint tương lai là forecast; chỉ chốt Sprint kế tiếp sau Planning\. Sau 2 Sprint dùng SP thực sự Done, cycle time, giờ khả dụng và blocker để điều chỉnh lịch, không đổi SP của Story Done để làm đẹp velocity\.

Nguồn hoặc điểm cần chốt

Cách xử lý

SRS cao nhất nhưng chưa có tệp

OPEN\-QUESTION Q01; FR/NFR/BR trong BUILD là tham chiếu, chưa xác thực với SRS gốc\.

Thứ tự nguồn AI BUILD SPEC

SRS > Đặc tả chức năng > Project Overview > API DB UI specs baseline > AI BUILD SPEC > codebase\. Sprint Plan chỉ phân rã\.

90 Function và 133 screen

Truy vết mọi function và screen trong hai CSV riêng; không gán màn hình từ tên module\.

Owner onboarding P0 trong chức năng nhưng UI P1

Ưu tiên nghiệp vụ P0; UI ưu tiên thấp hơn không được chặn MVP\.

BKG03 P0 phụ thuộc OWN10 ADM09 P1

Làm hai chức năng tạo promotion/voucher như prerequisite MVP; giữ nguyên priority nguồn trong trace\.

BKG03 và ADM09 phụ thuộc vòng

Thiết lập voucher/config ADM09 trước redemption BKG03; test quota/budget khi tích hợp\. Ghi quyết định contract, không sửa rule nghiệp vụ\.

ADM10 P1/P2 và AI06 P1/P2

ADM10 full scope xếp P2 do cần AI13; AI06 xếp P1\. Có thể tách audit/analytics P1 riêng khi xác nhận, không đánh dấu cả function Done sớm\.

Invoice và AI tự đặt phòng

BKG10 chỉ theo đặc tả hóa đơn/biên nhận; không suy ra xuất hóa đơn thuế hợp pháp hay AI tự charge\. Xác minh tax/provider/legal fields và approval workflow trước mở rộng\.

UI đã làm và PR đã merge

Chỉ là thông tin hiện trạng do nhóm cung cấp; chưa đọc repo nên tất cả issue To Do\. TK01 kiểm kê bằng code PR và demo\.

Q02 Q03 Q04 Q05

Chốt API/DB Design và ORM; provider payment/refund, policy hold/cancel, LLM ngân sách và dữ liệu lịch sử; account ID và Jira plan trước import\.

# 2 Thiết lập Jira Scrum từ đầu

Chọn Jira Cloud Scrum software project theo mô hình company\-managed nếu có quyền quản trị; thuận tiện Components và workflow chung\. Giao diện mới có thể gọi Project là Space và Issue là Work item\. Nếu chỉ có team\-managed, vẫn dùng backlog và Sprint nhưng kiểm tra lại Components, field estimation và import hierarchy; không sao chép cấu hình company\-managed một cách máy móc\.

1\. Đăng nhập Jira; chọn Projects hoặc Spaces rồi Create project hoặc Create space; chọn Software development và mẫu Scrum\.

2\. Chọn company\-managed; tên Booking Travel; key BKT; nếu BKT đã dùng thì chọn key khả dụng và thay toàn bộ JQL branch mẫu\.

3\. Thêm đúng hai tài khoản thực của A và B vào project\. Một người giữ quyền project admin, người còn lại developer; đây là quyền Jira, không phải role nghiệp vụ của app\.

4\. Mở Project settings hoặc Space settings; cấu hình Issue types Epic Story Task Bug Sub\-task\. Bật Sub\-task nếu site chưa bật\. Epic là mục tiêu lớn; Story là giá trị người dùng; Task là việc kỹ thuật; Sub\-task là một phần triển khai; Bug là lỗi có bước tái hiện\.

5\. Cấu hình các field Description, Parent, Assignee, Priority, Story Points, Labels, Due date, Fix version và Components\. Thêm Functional ID, UI IDs, Planned Sprint, Estimate Reason nếu quyền/gói cho phép; nếu không giữ các giá trị trong Description\.

6\. Tạo Components Frontend Backend Database AI QA DevOps Realtime Media\. Tạo labels p0 p1 p2 user owner admin open\-question ui\-existing needs\-verification\. Components mô tả lớp kỹ thuật, labels mô tả scope/role; không dùng AI như role\.

7\. Tạo versions v0\.1\-mvp, v0\.2\-core\-ai, v1\.0\-full\. Ngày release là forecast cho đến review đạt gate\. Không gán Epic vào Sprint để đo velocity\.

8\. Cấu hình workflow và Board columns; To Do, In Progress, Code Review, Testing, Done\. Blocked dùng flag là mặc định khuyến nghị; nếu cần status riêng, thuộc In Progress category và có transition quay lại trạng thái trước\.

9\. Mở Board settings Estimation chọn Story Points cho Story và Task nếu scheme hỗ trợ; không nhập SP cho Sub\-task\. Chỉ cột Done ngoài cùng bên phải được dùng làm hoàn thành trên board\.

10\. Import mẫu thử Epic Story Sub\-task; xác nhận hierarchy rồi nhập toàn bộ theo Phần 10\. Sau import gán Assignee thật, Sprint và Fix version bằng bulk edit theo mapping\.

11\. Trong Backlog tạo BKT Sprint 01; kéo issue đã Ready và không bị block vào Sprint; kiểm tra SP theo từng người; chọn Start sprint, thời lượng 2 tuần, nhập goal ngày giờ\. Chỉ start một Sprint cho nhóm 2 người\.

Chuyển trạng thái

Điều kiện

To Do sang In Progress

Ready, người nhận rõ, prerequisite có contract, chốt scope và AC\.

In Progress sang Code Review

Có PR, tự kiểm thử, cập nhật trace và migration nếu có\.

Code Review sang Testing

Người còn lại review; CI đạt; merge vào master theo quy trình; deploy build test\.

Testing sang Done

AC và DoD đạt trên bản đã merge; test evidence liên kết; Sub\-task Done; không còn lỗi nghiêm trọng\.

Testing sang In Progress

Tạo hoặc link Bug, nêu bước tái hiện; Resolution chưa được set\.

Blocked và unblocked

Ghi nguyên nhân issue phụ thuộc owner và bước gỡ; giữ trong Sprint report; không coi bị block là Done\.

Reopen

Xóa Resolution và đưa về To Do/In Progress theo workflow\.

# 3 Danh sách Epic

Epic mô tả mục tiêu và phạm vi\. Owner là đầu mối; mọi issue chỉ có một Assignee\. Acceptance chung của Epic là tất cả issue con đạt AC và release gate\. Phụ thuộc giữa Epic có thể hai chiều vì nhiều chức năng, chỉ issue dependencies mới dùng để lập lịch\. Khi MVP đang chờ nguồn cung Owner/Admin, A có thể làm P1 hồ sơ hoặc discovery đã Ready để giảm thời gian chờ; AI vẫn sau gate MVP và P2 sau core\. Không rút scope P0 để đưa P1 vào\.

## EP\-01 Nền tảng và kiến trúc

Summary và mục tiêu kinh doanh: Nền tảng và kiến trúc\. Phạm vi: Các Task kỹ thuật trong backlog\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 1, 8\. Dependencies: EP\-13, EP\-14\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-02 Xác thực và phân quyền

Summary và mục tiêu kinh doanh: Xác thực và phân quyền\. Phạm vi: AUTH\-01, AUTH\-02, AUTH\-03, AUTH\-04, AUTH\-05, AUTH\-06, AUTH\-07, AUTH\-08\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 2, 3, 4\. Dependencies: EP\-01\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-03 Hồ sơ và cá nhân hóa

Summary và mục tiêu kinh doanh: Hồ sơ và cá nhân hóa\. Phạm vi: USR\-01, USR\-02, USR\-03, USR\-04, USR\-05\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 4, 16, 20, 21\. Dependencies: EP\-01, EP\-02, EP\-04, EP\-05, EP\-06, EP\-07, EP\-19\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-04 Tìm kiếm và khám phá

Summary và mục tiêu kinh doanh: Tìm kiếm và khám phá\. Phạm vi: HTL\-01, HTL\-02, HTL\-03, HTL\-04, HTL\-05, HTL\-07\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 6, 8, 11, 12\. Dependencies: EP\-01, EP\-05, EP\-13, EP\-14\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-05 Chi tiết và phòng trống

Summary và mục tiêu kinh doanh: Chi tiết và phòng trống\. Phạm vi: HTL\-06, HTL\-08, HTL\-09\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 6, 8\. Dependencies: EP\-01, EP\-13, EP\-14\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-06 Đặt phòng và vòng đời lưu trú

Summary và mục tiêu kinh doanh: Đặt phòng và vòng đời lưu trú\. Phạm vi: BKG\-01, BKG\-02, BKG\-06, BKG\-07, BKG\-08, BKG\-12\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 9, 10, 11\. Dependencies: EP\-01, EP\-02, EP\-05, EP\-07, EP\-14\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-07 Thanh toán hoàn tiền và chứng từ

Summary và mục tiêu kinh doanh: Thanh toán hoàn tiền và chứng từ\. Phạm vi: BKG\-04, BKG\-05, BKG\-09, BKG\-10\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 9, 10, 11\. Dependencies: EP\-01, EP\-02, EP\-06\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-08 Yêu thích so sánh và cảnh báo

Summary và mục tiêu kinh doanh: Yêu thích so sánh và cảnh báo\. Phạm vi: HTL\-10, HTL\-11, HTL\-12, HTL\-13\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 12, 18, 19\. Dependencies: EP\-01, EP\-02, EP\-05, EP\-10, EP\-19\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-09 Chat và dịch vụ khách hàng

Summary và mục tiêu kinh doanh: Chat và dịch vụ khách hàng\. Phạm vi: COM\-01, COM\-02, COM\-03, COM\-04, OWN\-13\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 7, 15, 18\. Dependencies: EP\-01, EP\-02, EP\-05, EP\-11, EP\-15, EP\-19\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-10 Thông báo và nhắc lịch

Summary và mục tiêu kinh doanh: Thông báo và nhắc lịch\. Phạm vi: BKG\-11, NTF\-01, NTF\-02\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 13, 19\. Dependencies: EP\-01, EP\-02, EP\-06, EP\-19\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-11 Đánh giá và xử lý báo cáo

Summary và mục tiêu kinh doanh: Đánh giá và xử lý báo cáo\. Phạm vi: HTL\-14, REV\-01, REV\-02, REV\-03, REV\-04, REV\-05, ADM\-08\. Owner Developer B\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 12, 15, 19\. Dependencies: EP\-01, EP\-02, EP\-05, EP\-15, EP\-19\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-12 Xác minh Chủ khách sạn

Summary và mục tiêu kinh doanh: Xác minh Chủ khách sạn\. Phạm vi: OWN\-01, OWN\-02, ADM\-03\. Owner Developer B\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 4\. Dependencies: EP\-01, EP\-02, EP\-03\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-13 Khách sạn và loại phòng

Summary và mục tiêu kinh doanh: Khách sạn và loại phòng\. Phạm vi: OWN\-04, OWN\-05, OWN\-06, OWN\-07, ADM\-04, ADM\-05\. Owner Developer B\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 5, 6, 7\. Dependencies: EP\-01, EP\-02, EP\-12\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-14 Tồn phòng giá và khuyến mãi

Summary và mục tiêu kinh doanh: Tồn phòng giá và khuyến mãi\. Phạm vi: BKG\-03, OWN\-08, OWN\-09, OWN\-10, ADM\-09\. Owner Developer B\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 7, 8, 12, 13\. Dependencies: EP\-01, EP\-02, EP\-06, EP\-13\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-15 Vận hành Owner và phân tích

Summary và mục tiêu kinh doanh: Vận hành Owner và phân tích\. Phạm vi: OWN\-03, OWN\-11, OWN\-12, OWN\-14\. Owner Developer B\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 5, 11, 12, 14\. Dependencies: EP\-01, EP\-02, EP\-06, EP\-07, EP\-12\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-16 Quản trị người dùng và tài chính

Summary và mục tiêu kinh doanh: Quản trị người dùng và tài chính\. Phạm vi: ADM\-01, ADM\-02, ADM\-06, ADM\-07, ADM\-10\. Owner Developer B\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 2, 3, 10, 12, 19\. Dependencies: EP\-01, EP\-02, EP\-06, EP\-07, EP\-15, EP\-18, EP\-19\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-17 AI cho khách hàng và RAG

Summary và mục tiêu kinh doanh: AI cho khách hàng và RAG\. Phạm vi: AI\-01, AI\-02, AI\-03, AI\-04, AI\-05, AI\-06, AI\-14\. Owner Developer A\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 14, 16, 17, 18\. Dependencies: EP\-01, EP\-02, EP\-03, EP\-04, EP\-08, EP\-11, EP\-13, EP\-19\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-18 AI Owner Admin và tiện ích chuyến đi

Summary và mục tiêu kinh doanh: AI Owner Admin và tiện ích chuyến đi\. Phạm vi: AI\-07, AI\-08, AI\-09, AI\-10, AI\-11, AI\-12, AI\-13, TRV\-01, TRV\-02\. Owner Developer B\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 17, 18, 20, 21\. Dependencies: EP\-01, EP\-02, EP\-04, EP\-06, EP\-07, EP\-09, EP\-11, EP\-14, EP\-15, EP\-19\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

## EP\-19 Kiểm thử bảo mật và triển khai

Summary và mục tiêu kinh doanh: Kiểm thử bảo mật và triển khai\. Phạm vi: Các Task kỹ thuật trong backlog\. Owner Developer B\. Priority cao nhất của issue con quyết định ưu tiên Epic\. Sprint 13, 17, 21, 22\. Dependencies: EP\-01, EP\-02, EP\-03, EP\-04, EP\-05, EP\-06, EP\-07, EP\-08, EP\-09, EP\-10, EP\-11, EP\-12, EP\-13, EP\-14, EP\-15, EP\-16, EP\-17, EP\-18\. Đầu ra: các API dữ liệu UI hoặc job theo phạm vi, có test và tài liệu; acceptance toàn bộ AC con đạt\. Chi tiết description từng issue trong BKT\_BACKLOG\_CHI\_TIET\.md\.

# 4 Product Backlog và đối chiếu chức năng

BKT\_BACKLOG\_CHI\_TIET\.md chứa từng Story/Task với user story tiếng Việt, description, nguồn, UI IDs, priority, SP và lý do, Assignee, Sprint, dependency, AC, DoD và các Sub\-task\. BKT\_PRODUCT\_BACKLOG\.csv là bảng làm việc đủ trường; BKT\_FUNCTION\_TRACE\.csv chứa đối chiếu 90/90 và BKT\_SCREEN\_TRACE\.csv chứa 133 screen\. Không phải mỗi Function luôn chỉ cần một PR; Story có thể có nhiều PR theo Sub\-task\.

Story 8 SP đã chia ba Sub\-task kỹ thuật để có đầu ra nhỏ; nếu một Sub\-task không làm xong trong vài ngày thì tách thêm sau khi kiểm tra codebase\. Story không đạt Ready hoặc trên 13 SP sau refinement phải tách Story theo hành vi nghiệm thu, không chia chỉ để giảm con số\. Dùng Fibonacci 1 2 3 5 8 13; 13 là cảnh báo cần chia\. SP là effort/risk/complexity tương đối, không đổi trực tiếp sang giờ\.

Nhóm

Function

Story

Đầu mối

AUTH

8

8

A hoặc B theo backlog

USR

5

5

A hoặc B theo backlog

HTL

14

14

A hoặc B theo backlog

BKG

12

12

A hoặc B theo backlog

COM

4

4

A hoặc B theo backlog

NTF

2

2

A hoặc B theo backlog

REV

5

5

A hoặc B theo backlog

OWN

14

14

B

ADM

10

10

B

AI

14

14

A hoặc B theo backlog

TRV

2

2

A hoặc B theo backlog

## Ví dụ Story hoàn chỉnh

ST\-BKG\-05 Xác thực callback/webhook thanh toán

Là System, tôi muốn xác thực callback/webhook thanh toán để cập nhật Payment/Booking từ thông báo đáng tin cậy của cổng thanh toán\.  
Nguồn: BKG\-05; FR tham chiếu: FR\-BKG\-05 \(cần đối chiếu SRS gốc\); BUILD\-BKG\-05\.  
Mục tiêu: Cập nhật Payment/Booking từ thông báo đáng tin cậy của cổng thanh toán\.  
Tiền điều kiện: Có payment transaction\.  
Dữ liệu vào: Provider webhook/callback  
Dữ liệu liên quan: Payment; Booking; AuditLog  
UI: PAY\-UI\-02, PAY\-UI\-03, PAY\-UI\-04  
Phụ thuộc nguồn: BKG\-04  
Luồng: 1\. Xác minh signature\. 2\. Đối chiếu transactionRef, amount, currency\. 3\. Xử lý idempotent\. 4\. Nếu success: Payment SUCCESS, Booking CONFIRMED\. 5\. Nếu fail: Payment FAILED; booking giữ/expire theo rule\. 6\. Phát event notification\.  
Quy tắc: Webhook server\-to\-server là nguồn quyết định\. | Không confirm booking chỉ dựa query param client\.  
Ngoại lệ: Webhook lặp → không cộng/trừ lại\. | Amount mismatch/signature sai → reject \+ security log\. | Client return success nhưng webhook chưa đến → hiển thị processing và poll server\.  
Acceptance Criteria:  
\- Webhook giả không đổi trạng thái\.  
\- Webhook lặp không gây side effect lặp\.  
DoD: đạt AC, tích hợp dữ liệu thật, test chức năng và negative/security liên quan, PR được người còn lại review, CI đạt, tài liệu contract/migration cập nhật, không lỗi nghiêm trọng\.  
API trong nguồn là gợi ý, không khóa endpoint thay cho API Spec\.  
Build contract: Backend: triển khai trong Bookings/Payments/Inventory/Promotions logical modules; Transaction/lock/idempotency bắt buộc; quote TTL; immutable snapshot; webhook authority; inventory hold timeout\. | Mobile: Booking steps, price breakdown, guest info, payment status polling/reconcile, cancellation/refund UX, QR\. | Dependency gate: không đánh dấu hoàn tất nếu dependency chưa có contract tương thích \(BKG\-04\)\. | Mutation gate: validate current state \+ authorization/ownership \+ transaction/audit/idempotency theo risk trước khi ghi dữ liệu\.  
Required tests: Concurrency/overbooking, quote expiry, webhook replay, amount mismatch, cancellation/refund state transition\. | Pass lint \+ type\-check \+ test liên quan; không còn TODO/mock ở core path; cập nhật contract/document nếu behavior public thay đổi\.

Epic EP\-07; Developer B; 8 SP; Sprint 9; Dependencies ST\-BKG\-04, ST\-AUTH\-08, TK\-02, TK\-03; 8 SP: transaction/concurrency hoặc AI có nhiều phụ thuộc và ngoại lệ\.

# 5 Kế hoạch Sprint và thời gian

Bảng dưới liệt kê tất cả issue cấp Story/Task của từng Sprint\. Sub\-task cùng Sprint với Story cha; chi tiết Assignee, dependencies và SP từng issue có trong CSV và backlog\. Một số dependency và dependent cùng Sprint để tránh kéo dài lịch bằng các bước nhỏ\. Các issue trong từng bảng đã sắp theo thứ tự triển khai\. Chỉ nhận dependent khi contract Ready, prerequisite dự kiến đạt trước thời điểm tích hợp; nếu prerequisite chậm phải giảm scope hoặc chuyển dependent, không giả định đã Done khi start Sprint\.

## Sprint 01

19/10/2026 đến 30/10/2026\. Goal và đầu ra: Đối chiếu SRS và kiểm tra UI đã merge ; Môi trường NestJS PostgreSQL và migration ; Navigation và thành phần UI dùng chung ; CI lint typecheck và kiểm thử nền tảng ; Media R2 presigned URL và finalize ; Redis BullMQ và event idempotency ; Spike payment push Google và LLM provider\. Tổng A 13 SP; B 16 SP; Sprint 29 SP\.

Issue và chức năng

Assignee

SP

TK\-01 Đối chiếu SRS và kiểm tra UI đã merge

A

3

TK\-02 Môi trường NestJS PostgreSQL và migration

B

5

TK\-03 Navigation và thành phần UI dùng chung

A

5

TK\-04 CI lint typecheck và kiểm thử nền tảng

B

3

TK\-05 Media R2 presigned URL và finalize

A

5

TK\-06 Redis BullMQ và event idempotency

B

5

TK\-12 Spike payment push Google và LLM provider

B

3

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): TK\-01, TK\-02, TK\-03\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 02

02/11/2026 đến 13/11/2026\. Goal và đầu ra: Đăng ký tài khoản người dùng ; Xác minh OTP / email ; Đăng nhập ; Phân quyền RBAC và kiểm tra sở hữu tài nguyên ; Admin Dashboard\. Tổng A 15 SP; B 13 SP; Sprint 28 SP\.

Issue và chức năng

Assignee

SP

ST\-AUTH\-01 Đăng ký tài khoản người dùng

A

5

ST\-AUTH\-02 Xác minh OTP / email

A

5

ST\-AUTH\-03 Đăng nhập

A

5

ST\-AUTH\-08 Phân quyền RBAC và kiểm tra sở hữu tài nguyên

B

8

ST\-ADM\-01 Admin Dashboard

B

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-01, ST\-AUTH\-02, ST\-AUTH\-03, ST\-AUTH\-08, TK\-02, TK\-03\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 03

16/11/2026 đến 27/11/2026\. Goal và đầu ra: Quản lý người dùng và trạng thái tài khoản ; Làm mới access token ; Quên mật khẩu / đặt lại mật khẩu ; Đăng xuất và quản lý phiên\. Tổng A 13 SP; B 5 SP; Sprint 18 SP\.

Issue và chức năng

Assignee

SP

ST\-ADM\-02 Quản lý người dùng và trạng thái tài khoản

B

5

ST\-AUTH\-04 Làm mới access token

A

5

ST\-AUTH\-05 Quên mật khẩu / đặt lại mật khẩu

A

5

ST\-AUTH\-06 Đăng xuất và quản lý phiên

A

3

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-02, ST\-AUTH\-03, ST\-AUTH\-08, TK\-02, TK\-03\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 04

30/11/2026 đến 11/12/2026\. Goal và đầu ra: Xem và cập nhật hồ sơ cá nhân ; Đăng ký trở thành Chủ khách sạn ; Xét duyệt hồ sơ Chủ khách sạn ; Theo dõi kết quả xác minh Owner ; Đăng nhập Google ; Thiết lập Travel Preference Profile\. Tổng A 15 SP; B 13 SP; Sprint 28 SP\.

Issue và chức năng

Assignee

SP

ST\-USR\-01 Xem và cập nhật hồ sơ cá nhân

A

5

ST\-OWN\-01 Đăng ký trở thành Chủ khách sạn

B

5

ST\-ADM\-03 Xét duyệt hồ sơ Chủ khách sạn

B

5

ST\-OWN\-02 Theo dõi kết quả xác minh Owner

B

3

ST\-AUTH\-07 Đăng nhập Google

A

5

ST\-USR\-02 Thiết lập Travel Preference Profile

A

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-03, ST\-AUTH\-03, ST\-AUTH\-08, ST\-OWN\-01, ST\-USR\-01, TK\-02, TK\-03, TK\-05, TK\-12\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 05

14/12/2026 đến 25/12/2026\. Goal và đầu ra: Dashboard Chủ khách sạn ; Tạo và cập nhật hồ sơ khách sạn ; Quản lý vị trí, tiện nghi và media khách sạn\. Tổng A 0 SP; B 15 SP; Sprint 15 SP\.

Issue và chức năng

Assignee

SP

ST\-OWN\-03 Dashboard Chủ khách sạn

B

5

ST\-OWN\-04 Tạo và cập nhật hồ sơ khách sạn

B

5

ST\-OWN\-05 Quản lý vị trí, tiện nghi và media khách sạn

B

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-08, ST\-OWN\-02, ST\-OWN\-04, TK\-02, TK\-03, TK\-05\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 06

28/12/2026 đến 08/01/2027\. Goal và đầu ra: Quản lý loại phòng và hình ảnh phòng ; Gửi khách sạn để Admin kiểm duyệt ; Kiểm duyệt khách sạn ; Trang chủ khám phá khách sạn ; Xem chi tiết khách sạn ; Xem danh sách loại phòng và chi tiết phòng\. Tổng A 15 SP; B 15 SP; Sprint 30 SP\.

Issue và chức năng

Assignee

SP

ST\-OWN\-07 Quản lý loại phòng và hình ảnh phòng

B

5

ST\-OWN\-06 Gửi khách sạn để Admin kiểm duyệt

B

5

ST\-ADM\-04 Kiểm duyệt khách sạn

B

5

ST\-HTL\-01 Trang chủ khám phá khách sạn

A

5

ST\-HTL\-06 Xem chi tiết khách sạn

A

5

ST\-HTL\-08 Xem danh sách loại phòng và chi tiết phòng

A

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-04, ST\-AUTH\-08, ST\-HTL\-06, ST\-OWN\-04, ST\-OWN\-05, ST\-OWN\-06, ST\-OWN\-07, TK\-02, TK\-03, TK\-05\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 07

11/01/2027 đến 22/01/2027\. Goal và đầu ra: Ẩn, đình chỉ và khôi phục khách sạn ; Lịch phòng trống và khóa phòng ; Tạo cuộc trò chuyện User ↔ Hotel Owner ; Nhắn tin realtime ; Trạng thái đã đọc và danh sách hội thoại\. Tổng A 13 SP; B 13 SP; Sprint 26 SP\.

Issue và chức năng

Assignee

SP

ST\-ADM\-05 Ẩn, đình chỉ và khôi phục khách sạn

B

5

ST\-OWN\-08 Lịch phòng trống và khóa phòng

B

8

ST\-COM\-01 Tạo cuộc trò chuyện User ↔ Hotel Owner

A

5

ST\-COM\-02 Nhắn tin realtime

A

5

ST\-COM\-04 Trạng thái đã đọc và danh sách hội thoại

A

3

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-04, ST\-AUTH\-08, ST\-COM\-01, ST\-COM\-02, ST\-HTL\-06, ST\-OWN\-07, TK\-02, TK\-03\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 08

25/01/2027 đến 05/02/2027\. Goal và đầu ra: Quản lý giá phòng theo ngày/mùa ; Seed ba role và dữ liệu demo có thể tái lập ; Kiểm tra phòng trống theo ngày ; Tìm kiếm khách sạn theo điều kiện lưu trú ; Bộ lọc nâng cao và sắp xếp\. Tổng A 16 SP; B 16 SP; Sprint 32 SP\.

Issue và chức năng

Assignee

SP

ST\-OWN\-09 Quản lý giá phòng theo ngày/mùa

B

8

TK\-07 Seed ba role và dữ liệu demo có thể tái lập

A

3

ST\-HTL\-09 Kiểm tra phòng trống theo ngày

B

8

ST\-HTL\-02 Tìm kiếm khách sạn theo điều kiện lưu trú

A

8

ST\-HTL\-03 Bộ lọc nâng cao và sắp xếp

A

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-04, ST\-AUTH\-08, ST\-HTL\-02, ST\-HTL\-09, ST\-OWN\-07, ST\-OWN\-08, ST\-OWN\-09, TK\-02, TK\-03\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 09

08/02/2027 đến 19/02/2027\. Goal và đầu ra: Tạo báo giá booking \(Booking Quote\) ; Tạo booking và thông tin khách lưu trú ; Khởi tạo thanh toán ; Xác thực callback/webhook thanh toán\. Tổng A 13 SP; B 16 SP; Sprint 29 SP\.

Issue và chức năng

Assignee

SP

ST\-BKG\-01 Tạo báo giá booking \(Booking Quote\)

B

8

ST\-BKG\-02 Tạo booking và thông tin khách lưu trú

A

8

ST\-BKG\-04 Khởi tạo thanh toán

A

5

ST\-BKG\-05 Xác thực callback/webhook thanh toán

B

8

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-08, ST\-BKG\-01, ST\-BKG\-02, ST\-BKG\-04, ST\-HTL\-09, ST\-OWN\-09, TK\-02, TK\-03, TK\-12\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 10

22/02/2027 đến 05/03/2027\. Goal và đầu ra: Xác nhận booking và tạo QR ; Xem danh sách và chi tiết booking ; Hủy booking ; Yêu cầu và xử lý hoàn tiền ; Giám sát thanh toán và hoàn tiền\. Tổng A 15 SP; B 13 SP; Sprint 28 SP\.

Issue và chức năng

Assignee

SP

ST\-BKG\-06 Xác nhận booking và tạo QR

A

5

ST\-BKG\-07 Xem danh sách và chi tiết booking

A

5

ST\-BKG\-08 Hủy booking

A

5

ST\-BKG\-09 Yêu cầu và xử lý hoàn tiền

B

8

ST\-ADM\-07 Giám sát thanh toán và hoàn tiền

B

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-08, ST\-BKG\-02, ST\-BKG\-05, ST\-BKG\-07, ST\-BKG\-08, ST\-BKG\-09, TK\-02, TK\-03\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 11

08/03/2027 đến 19/03/2027\. Goal và đầu ra: Inventory hold và tự giải phóng khi hết hạn thanh toán ; Quản lý booking của khách sạn ; Hóa đơn / biên nhận booking ; Tìm kiếm trên bản đồ / Search this area ; Tìm khách sạn gần tôi / gần điểm mốc\. Tổng A 15 SP; B 13 SP; Sprint 28 SP\.

Issue và chức năng

Assignee

SP

ST\-BKG\-12 Inventory hold và tự giải phóng khi hết hạn thanh toán

B

8

ST\-OWN\-11 Quản lý booking của khách sạn

B

5

ST\-BKG\-10 Hóa đơn / biên nhận booking

A

5

ST\-HTL\-04 Tìm kiếm trên bản đồ / Search this area

A

5

ST\-HTL\-05 Tìm khách sạn gần tôi / gần điểm mốc

A

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-08, ST\-BKG\-02, ST\-BKG\-05, ST\-BKG\-06, ST\-HTL\-02, TK\-02, TK\-03, TK\-06\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 12

22/03/2027 đến 02/04/2027\. Goal và đầu ra: Check\-in và Check\-out khách ; Giám sát booking ; Khuyến mãi/Voucher toàn nền tảng ; Địa điểm lân cận của khách sạn ; Yêu thích và Wishlist ; Báo cáo khách sạn\. Tổng A 15 SP; B 15 SP; Sprint 30 SP\.

Issue và chức năng

Assignee

SP

ST\-OWN\-12 Check\-in và Check\-out khách

B

5

ST\-ADM\-06 Giám sát booking

B

5

ST\-ADM\-09 Khuyến mãi/Voucher toàn nền tảng

B

5

ST\-HTL\-07 Địa điểm lân cận của khách sạn

A

5

ST\-HTL\-10 Yêu thích và Wishlist

A

5

ST\-HTL\-14 Báo cáo khách sạn

A

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-03, ST\-AUTH\-08, ST\-BKG\-06, ST\-BKG\-07, ST\-HTL\-06, ST\-OWN\-09, ST\-OWN\-11, ST\-OWN\-12, TK\-02, TK\-03\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 13

05/04/2027 đến 16/04/2027\. Goal và đầu ra: Thông báo in\-app và push notification ; Nhắc check\-in / check\-out ; Tạo khuyến mãi của khách sạn ; Áp dụng voucher/khuyến mãi ; Kiểm thử và phát hành MVP đặt phòng\. Tổng A 15 SP; B 13 SP; Sprint 28 SP\.

Issue và chức năng

Assignee

SP

ST\-NTF\-01 Thông báo in\-app và push notification

A

5

ST\-BKG\-11 Nhắc check\-in / check\-out

A

5

ST\-OWN\-10 Tạo khuyến mãi của khách sạn

B

5

ST\-BKG\-03 Áp dụng voucher/khuyến mãi

A

5

TK\-08 Kiểm thử và phát hành MVP đặt phòng

B

8

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-01, ST\-ADM\-02, ST\-ADM\-03, ST\-ADM\-04, ST\-ADM\-05, ST\-ADM\-06, ST\-ADM\-07, ST\-ADM\-09, ST\-AUTH\-01, ST\-AUTH\-02, ST\-AUTH\-03, ST\-AUTH\-04, ST\-AUTH\-05, ST\-AUTH\-06, ST\-AUTH\-08, ST\-BKG\-01, ST\-BKG\-02, ST\-BKG\-03, ST\-BKG\-04, ST\-BKG\-05, ST\-BKG\-06, ST\-BKG\-07, ST\-BKG\-08, ST\-BKG\-09, ST\-BKG\-12, ST\-HTL\-01, ST\-HTL\-02, ST\-HTL\-03, ST\-HTL\-06, ST\-HTL\-08, ST\-HTL\-09, ST\-NTF\-01, ST\-OWN\-01, ST\-OWN\-02, ST\-OWN\-03, ST\-OWN\-04, ST\-OWN\-05, ST\-OWN\-06, ST\-OWN\-07, ST\-OWN\-08, ST\-OWN\-09, ST\-OWN\-10, ST\-OWN\-11, ST\-OWN\-12, ST\-USR\-01, TK\-02, TK\-03, TK\-04, TK\-06, TK\-07, TK\-12\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 14

19/04/2027 đến 30/04/2027\. Goal và đầu ra: AI Smart Search ; RAG/Embedding pipeline cho dữ liệu khách sạn ; AI Travel Assistant ; Doanh thu và phân tích khách sạn\. Tổng A 13 SP; B 13 SP; Sprint 26 SP\.

Issue và chức năng

Assignee

SP

ST\-AI\-02 AI Smart Search

A

5

ST\-AI\-14 RAG/Embedding pipeline cho dữ liệu khách sạn

B

8

ST\-AI\-01 AI Travel Assistant

A

8

ST\-OWN\-14 Doanh thu và phân tích khách sạn

B

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-04, ST\-ADM\-05, ST\-AI\-14, ST\-AUTH\-08, ST\-BKG\-05, ST\-HTL\-02, ST\-HTL\-03, ST\-OWN\-12, TK\-02, TK\-03, TK\-06, TK\-08, TK\-12\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 15

03/05/2027 đến 14/05/2027\. Goal và đầu ra: Tạo đánh giá sau lưu trú ; Sửa hoặc xóa đánh giá của chính mình ; Chủ khách sạn phản hồi review ; Quản lý khách, chat và phản hồi review ; Báo cáo review hoặc nội dung chat công khai ; Quản lý Report và kiểm duyệt Review\. Tổng A 15 SP; B 15 SP; Sprint 30 SP\.

Issue và chức năng

Assignee

SP

ST\-REV\-01 Tạo đánh giá sau lưu trú

A

5

ST\-REV\-02 Sửa hoặc xóa đánh giá của chính mình

A

5

ST\-REV\-03 Chủ khách sạn phản hồi review

B

5

ST\-OWN\-13 Quản lý khách, chat và phản hồi review

B

5

ST\-REV\-05 Báo cáo review hoặc nội dung chat công khai

A

5

ST\-ADM\-08 Quản lý Report và kiểm duyệt Review

B

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-08, ST\-COM\-01, ST\-HTL\-14, ST\-OWN\-11, ST\-OWN\-12, ST\-REV\-01, ST\-REV\-03, ST\-REV\-05, TK\-02, TK\-03\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 16

17/05/2027 đến 28/05/2027\. Goal và đầu ra: Tóm tắt và phân tích cảm xúc Review ; Lịch sử tìm kiếm và khách sạn đã xem ; Gợi ý khách sạn cá nhân hóa\. Tổng A 15 SP; B 0 SP; Sprint 15 SP\.

Issue và chức năng

Assignee

SP

ST\-AI\-06 Tóm tắt và phân tích cảm xúc Review

A

5

ST\-USR\-04 Lịch sử tìm kiếm và khách sạn đã xem

A

5

ST\-AI\-03 Gợi ý khách sạn cá nhân hóa

A

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-08, ST\-AUTH\-08, ST\-HTL\-02, ST\-HTL\-06, ST\-REV\-01, ST\-USR\-02, ST\-USR\-04, TK\-02, TK\-03, TK\-08\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 17

31/05/2027 đến 11/06/2027\. Goal và đầu ra: Kiểm thử và phát hành core cộng AI cơ bản ; AI Hotel Match Score và giải thích ; AI Price Insight cho người đặt phòng ; AI Dynamic Pricing Assistant cho Owner ; Dự báo Occupancy và Revenue cho Owner\. Tổng A 15 SP; B 16 SP; Sprint 31 SP\.

Issue và chức năng

Assignee

SP

TK\-09 Kiểm thử và phát hành core cộng AI cơ bản

A

5

ST\-AI\-04 AI Hotel Match Score và giải thích

A

5

ST\-AI\-09 AI Price Insight cho người đặt phòng

A

5

ST\-AI\-10 AI Dynamic Pricing Assistant cho Owner

B

8

ST\-AI\-11 Dự báo Occupancy và Revenue cho Owner

B

8

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-08, ST\-ADM\-09, ST\-AI\-01, ST\-AI\-02, ST\-AI\-03, ST\-AI\-06, ST\-AI\-14, ST\-AUTH\-07, ST\-AUTH\-08, ST\-BKG\-10, ST\-BKG\-11, ST\-COM\-01, ST\-COM\-02, ST\-COM\-04, ST\-HTL\-04, ST\-HTL\-05, ST\-HTL\-07, ST\-HTL\-10, ST\-HTL\-14, ST\-NTF\-01, ST\-OWN\-09, ST\-OWN\-10, ST\-OWN\-13, ST\-OWN\-14, ST\-REV\-01, ST\-REV\-02, ST\-REV\-03, ST\-REV\-05, ST\-USR\-02, ST\-USR\-04, TK\-02, TK\-03, TK\-08, TK\-09\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 18

14/06/2027 đến 25/06/2027\. Goal và đầu ra: AI Customer Support Assistant cho khách sạn ; Phát hiện bất thường/gian lận ; Gửi ảnh, file, vị trí và Booking Card ; So sánh khách sạn ; AI so sánh khách sạn\. Tổng A 15 SP; B 13 SP; Sprint 28 SP\.

Issue và chức năng

Assignee

SP

ST\-AI\-12 AI Customer Support Assistant cho khách sạn

B

5

ST\-AI\-13 Phát hiện bất thường/gian lận

B

8

ST\-COM\-03 Gửi ảnh, file, vị trí và Booking Card

A

5

ST\-HTL\-11 So sánh khách sạn

A

5

ST\-AI\-05 AI so sánh khách sạn

A

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-08, ST\-BKG\-05, ST\-BKG\-09, ST\-COM\-02, ST\-HTL\-06, ST\-HTL\-09, ST\-HTL\-11, ST\-REV\-01, TK\-02, TK\-03, TK\-05, TK\-09\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 19

28/06/2027 đến 09/07/2027\. Goal và đầu ra: System Analytics, Audit Log và AI Fraud Flags ; Theo dõi giảm giá phòng ; Thông báo khi phòng có lại ; Cài đặt thông báo ; Đánh dấu review hữu ích\. Tổng A 16 SP; B 5 SP; Sprint 21 SP\.

Issue và chức năng

Assignee

SP

ST\-ADM\-10 System Analytics, Audit Log và AI Fraud Flags

B

5

ST\-HTL\-12 Theo dõi giảm giá phòng

A

5

ST\-HTL\-13 Thông báo khi phòng có lại

A

5

ST\-NTF\-02 Cài đặt thông báo

A

3

ST\-REV\-04 Đánh dấu review hữu ích

A

3

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-01, ST\-AI\-13, ST\-AUTH\-03, ST\-AUTH\-08, ST\-HTL\-09, ST\-NTF\-01, ST\-REV\-01, TK\-02, TK\-03, TK\-06, TK\-09\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 20

12/07/2027 đến 23/07/2027\. Goal và đầu ra: Thông tin thời tiết theo chuyến đi ; AI Travel Planner sau booking ; Ngôn ngữ và đơn vị tiền tệ\. Tổng A 16 SP; B 0 SP; Sprint 16 SP\.

Issue và chức năng

Assignee

SP

ST\-TRV\-01 Thông tin thời tiết theo chuyến đi

A

5

ST\-AI\-07 AI Travel Planner sau booking

A

8

ST\-USR\-03 Ngôn ngữ và đơn vị tiền tệ

A

3

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-AUTH\-08, ST\-BKG\-06, ST\-HTL\-07, ST\-TRV\-01, ST\-USR\-01, TK\-02, TK\-03, TK\-09\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 21

26/07/2027 đến 06/08/2027\. Goal và đầu ra: Travel Checklist ; AI Budget Planner và Smart Packing ; Loyalty và Referral ; Bảo mật tải hiệu năng backup và khôi phục\. Tổng A 15 SP; B 8 SP; Sprint 23 SP\.

Issue và chức năng

Assignee

SP

ST\-TRV\-02 Travel Checklist

A

5

ST\-AI\-08 AI Budget Planner và Smart Packing

A

5

ST\-USR\-05 Loyalty và Referral

A

5

TK\-10 Bảo mật tải hiệu năng backup và khôi phục

B

8

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): ST\-ADM\-10, ST\-AI\-04, ST\-AI\-05, ST\-AI\-07, ST\-AI\-08, ST\-AI\-09, ST\-AI\-10, ST\-AI\-11, ST\-AI\-12, ST\-AI\-13, ST\-AUTH\-08, ST\-BKG\-06, ST\-BKG\-09, ST\-COM\-03, ST\-HTL\-11, ST\-HTL\-12, ST\-HTL\-13, ST\-NTF\-02, ST\-REV\-04, ST\-TRV\-01, ST\-TRV\-02, ST\-USR\-03, ST\-USR\-05, TK\-02, TK\-03, TK\-09\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

## Sprint 22

09/08/2027 đến 20/08/2027\. Goal và đầu ra: Bàn giao full scope và build mobile\. Tổng A 5 SP; B 0 SP; Sprint 5 SP\.

Issue và chức năng

Assignee

SP

TK\-11 Bàn giao full scope và build mobile

A

5

Dependencies phải đạt trước lúc tích hợp từng issue \(có thể cùng Sprint\): TK\-10\. Review: demo từng issue với dữ liệu thật, đối chiếu AC, kiểm tra lỗi và CI, ghi issue Done hoặc carry\-over\. Retro: so workload A/B, thời gian chờ review và blocker; chọn một hành động cải tiến, giao một owner và hạn Sprint tiếp theo\.

Nếu A hoặc B còn dư SP nhưng chưa có dependency, không ép nhận chức năng chưa Ready\. Dùng thời gian cho review, test fixture hoặc việc đã Ready theo ưu tiên\. Tổng SP theo Assignee là trách nhiệm Story, không đo chính xác thời gian lao động: 270 Sub\-task QA/review do người còn lại phụ trách đã dành giờ dự phòng\. Nếu reviewer quá tải, giảm intake của người viết trước khi start Sprint\.

# 6 Phân công hai thành viên

Thành viên

Phụ trách chính

Phối hợp và giới hạn

Developer A

USER, booking payment chat, AI user và nền tảng mobile\. 298 SP cấp Story/Task\.

Backend module mình phụ trách; B phụ trách backend quote/webhook/refund/hold/availability/RAG để cân bằng; A review công việc B, không tự approve PR mình\.

Developer B

OWNER ADMIN inventory pricing RBAC và AI owner/admin\. 246 SP cấp Story/Task\.

Nhận thêm quote/webhook/refund/hold/availability/RAG; A phối hợp UX, từng Story có một Assignee\. B review công việc A và chủ trì migration/CI/queue\.

Không tạo người thứ ba cho Scrum Master Product Owner QA hoặc DevOps\. Hai người luân phiên điều phối Planning/Review; một người tổng hợp backlog và yêu cầu của giảng viên, người còn lại kiểm tra ưu tiên\. Các trách nhiệm Scrum được kiêm nhiệm, người có thẩm quyền bên ngoài chỉ cung cấp phản hồi\. Database, auth, AI và integration được chia Task/Sub\-task một Assignee; không gán Assignee là cả nhóm\.

# 7 Acceptance Criteria Ready và Done

Definition of Ready: user story và AC rõ; nguồn Function/BUILD và UI ID đã đối chiếu; các OPEN\-QUESTION tác động business rule đã chốt; contract API/DB tương thích; dependency có kế hoạch; đủ fixture để test; đã ước lượng và có một Assignee\. Phần SRS thiếu phải được xác minh trước khi khóa schema hoặc policy nhạy cảm\.

Definition of Done: triển khai đủ scope; frontend/backend tích hợp, server kiểm soát quyền và business truth; AC source và negative tests đạt; lint/typecheck và test phù hợp đạt; code được người còn lại review và merge; migration/rollback/documentation cập nhật khi liên quan; build đã merge chạy trên staging hoặc thiết bị phù hợp; không có lỗi critical/high; Sub\-task hoàn thành; liên kết PR test evidence và release\. UI mock đẹp hoặc merge PR đơn lẻ chưa đủ Done\.

Luồng bắt buộc

Nghiệm thu bổ sung theo BUILD

Inventory booking

Test phòng cuối đồng thời, hold expiry và double release, check\-in/out interval; không overbook và inventory không âm\.

Payment refund

Không tin redirect UI; verify provider signature amount currency và idempotency; late callback/cancel race; refund không vượt paid amount; provider fail không báo thành công\.

Auth Owner Admin

USER không gọi API admin; Owner A không đọc sửa Hotel B; OTP token hết hạn bị từ chối; suspend vô hiệu phiên và có audit\.

Review notification chat

Review chỉ sau COMPLETED; notification event phát lại không trùng; reconnect tải message đã persist; chỉ participant đọc conversation\.

RAG và AI

Chỉ retrieve hotel approved visible, loại dữ liệu giấy tờ/secret; prompt injection không bypass quyền; số liệu dựa DB; timeout/fallback; owner Apply mới đổi giá; fraud flag không tự khóa\.

Media và DevOps

Presigned key MIME size TTL owner validation; env\.example không có secret; migration trên DB sạch; backup restore thực sự; SDK chạy đúng Expo Go hoặc development build\.

# 8 GitHub Pull Request và Merge

Repo Booking\_Travel, nhánh master theo hiện trạng nhóm\. Với mỗi mã BKT do Jira cấp: tạo branch từ master mới nhất, triển khai và commit chứa key, mở PR, người còn lại review, CI đạt, merge, kiểm thử bản đã merge rồi Done\. Không code trực tiếp master\. Ví dụ feature/BKT\-25\-user\-login, commit BKT\-25 feat implement user login, PR BKT\-25 Implement user login\. EP/ST/TK chưa phải Jira key, không dùng mã giả như BKT chính thức\.

PR description gồm vấn đề và hành vi sau sửa, Function/BUILD/UI, migration/contract nếu có, test đã chạy, rủi ro và Jira link\. Người sửa chung navigation/API/schema báo cho người kia trước khi chỉnh\. Giữ thay đổi trong scope; nếu conflict thì đọc cả hai phía, chạy lại kiểm tra liên quan, không chọn toàn bộ ours/theirs để mất code\. Khi người review sửa code đáng kể, người tạo PR kiểm tra lại phần đó\.

Thông tin thực tế

Cách ghi Jira

UI có trong working tree

ui\-existing needs\-verification; TK01 kiểm tra màn hình, mock và lỗi\.

Đang viết hoặc có PR mở

In Progress hoặc Code Review theo evidence\.

PR đã merge nhưng chưa test

Testing, chưa Done\.

Chức năng E2E đạt AC DoD

Done có PR và test evidence\.

Chưa có evidence từ repo

To Do; không đoán trạng thái từ tài liệu\.

# 9 Scrum rủi ro và Dashboard

Planning 60 phút mỗi 2 tuần: xét priority, dependencies và Ready; ước lượng cùng nhau; chốt hours availability và SP hypothesis; phân công; chốt Goal\. Daily 5 đến 10 phút: việc đã đạt đầu ra hôm qua, việc hôm nay, blocker và người gỡ\. Refinement 30 phút giữa tuần: chia Story và chốt open question\. Review 45 phút: demo dữ liệu thật và phản hồi\. Retro 20 phút: chọn một cải tiến có owner\. Các thời lượng là đề xuất cho 2 người\.

Risk scale 1 đến 5; Score = Probability × Impact\. 1 đến 5 thấp, 6 đến 12 trung bình, 15 đến 25 cao\. Đây là đánh giá ban đầu của kế hoạch, rà soát mỗi Sprint; không phải xác suất thống kê\.

Rủi ro và điểm

Owner

Mitigation

Contingency

Nhóm 2 người gián đoạn  
P4 I5 Score20

A

Ghi runbook và review chéo

Thu hẹp intake, ưu tiên MVP

Quá tải B owner admin  
P4 I4 Score16

B

Đọc totals và reviewer hours trước Planning

Chuyển task backend nhỏ cho A, lập lại lịch

Trễ tiến độ  
P4 I4 Score16

A

Forecast bằng dữ liệu Done sau 2 Sprint

Hoãn P2 có quyết định phạm vi

Merge conflict  
P3 I3 Score9

B

PR nhỏ, thông báo file chung, cập nhật master

Pair resolve và regression

FE BE lệch contract  
P3 I4 Score12

A

Contract typed Swagger fixture

Khóa contract sửa tích hợp trước UI mới

Thay đổi DB  
P3 I4 Score12

B

Migration review rollback và backup

Restore thử, forward fix có log

Auth RBAC sai  
P3 I5 Score15

B

Negative tests role ownership session

Chặn release vá lỗi kiểm thử lại

Sai booking payment state  
P4 I5 Score20

A

Transaction lock idempotency race tests

Đối soát provider, manual review có audit

AI phức tạp  
P4 I4 Score16

A

Spike RAG trước UI AI, benchmark grounding

Fallback search thường, hoãn advanced

Provider gián đoạn  
P3 I4 Score12

B

Timeout retry safe healthcheck

Sandbox/demo fallback ghi rõ hạn chế

Thiếu QA  
P4 I5 Score20

B

Test mỗi Story và giờ review dự phòng

Dừng feature mới, fix critical

Scope creep  
P4 I4 Score16

A

Change log impact priority capacity

Đưa Backlog tương lai, giữ Goal

Thiếu SRS hoặc dữ liệu lịch sử  
P4 I4 Score16

A

TK01 và Q01, data sufficiency gate

Không khóa policy mới; AI thiếu dữ liệu báo unavailable

## Dashboard và báo cáo

Tạo Dashboards Create dashboard, tên BKT Team 2; share cho hai thành viên, Edit Add gadget; lưu các filter trước rồi chọn filter trong từng gadget\. Vào project Reports hoặc Reports More reports cho báo cáo Scrum\. Không giả định mọi report là dashboard gadget mặc định\.

Nhu cầu

Cách cấu hình

Phụ thuộc

Burndown Sprint

Reports Burndown, chọn Sprint và SP; liên kết report trên dashboard

Scrum/Sprints enabled, chỉ Done cuối board được tính

Sprint Progress

Sprint report hoặc active Sprint insights, theo Done scope

Dữ liệu board, không đo UI mock

Velocity

Reports Velocity sau ít nhất 2 Sprint có dữ liệu Done

Sprints enabled; không dùng forecast 16 SP như velocity

Cumulative Flow

Reports Cumulative Flow Diagram; đọc độ rộng Review/Testing

Column/status mapping đúng; không mặc định là gadget

Theo Assignee Status Priority

Issue Statistics và Two Dimensional Filter Statistics, filter BKT

Gadget có trên site; nếu thiếu dùng saved filter list

Blocked và Overdue

Filter Results với JQL dưới

Flagged tùy field scheme; fallback labels blocked

Epic Progress

Reports Epic Report hoặc Epic Burndown; link report

Project type/board; không cộng SP Sub\-task

Workload A B

Filter Results hiển thị Assignee SP Sprint; so tổng Story/Task

Issue count không phải SP; dùng CSV subtotal nếu gadget không sum

Roadmap nâng cao

Plans capacity cross project nếu tổ chức thực sự cần

Tùy gói/quyền; không yêu cầu mua app cho nhóm 2 người

Automation và custom chart

Chỉ cấu hình rule khi có quota/quyền; chart SP nâng cao có thể cần app

Free/Standard/Premium và marketplace khác nhau; kiểm tra site trước dùng

JQL: project = BKT AND statusCategory \!= Done ORDER BY priority DESC

JQL: project = BKT AND sprint in openSprints\(\) AND issuetype in \(Story, Task\)

JQL: project = BKT AND statusCategory \!= Done AND labels = blocked

JQL: project = BKT AND statusCategory \!= Done AND duedate < startOfDay\(\)

JQL: project = BKT AND status = "Code Review" ORDER BY updated ASC

Filter blocked dùng label blocked để độc lập cấu hình Flagged\. Nếu có Flagged thay bằng Flagged = Impediment\. JQL workload từng người dùng assignee = accountId thật\. Tên status phải khớp site; không mặc định issue type Task hay field tên giống mọi template\. Reports native được đối chiếu tài liệu Atlassian ngày 13/10/2026; khả năng hiện trên site phụ thuộc project type feature và quyền, không chỉ plan\.

# 10 Dữ liệu import và hướng dẫn nhập

Tệp trong gói

Mục đích

BKT\_JIRA\_IMPORT\.csv

391 dòng issue; numeric Work item ID và Parent; không có key BKT tự tạo\.

BKT\_PRODUCT\_BACKLOG\.csv

Bảng đủ 19 cột để planning; Developer A/B là placeholder, không import như account thật\.

BKT\_FUNCTION\_TRACE\.csv

90 Function liên kết Story Epic BUILD UI và dependencies nguồn/triển khai\.

BKT\_SCREEN\_TRACE\.csv

133 screen với FR link navigation state nguyên nguồn và Story mapping\.

BKT\_SPRINT\_PLAN\.csv

22 Sprint, start/end goal issue list A/B/total SP\.

BKT\_BACKLOG\_CHI\_TIET\.md

Mọi description AC DoD Sub\-task và estimate reason\.

README\_IMPORT\.md

Quy tắc mapping, dry run, giới hạn dữ liệu và hướng xử lý lỗi\.

Jira Cloud hỗ trợ hierarchy qua Work item ID Work type Parent trên luồng import quản trị\. Parent numeric tham chiếu dòng có trước trong cùng CSV; file sắp Epic trước Story/Task và Sub\-task sau\. Bulk Create từ tìm kiếm issue không hỗ trợ đầy đủ hierarchy nhiều cấp; không dùng luồng đó cho file này\. Nếu site chỉ cho import phẳng thì nhập Epic, lấy key thật, nhập Story với Parent key thật rồi Sub\-task theo key Story\.

1\. Mở CSV bằng editor giữ UTF\-8; dùng UTF\-8 BOM khi mở Excel\. Không sửa numeric ID hoặc Parent tùy tiện\. Không đổi key dự án đang có trong URL/JQL mà quên mapping\.

2\. Tạo project workflow và issue types theo Phần 2\. Đăng nhập bằng account có quyền import quản trị; mở Settings System External system import CSV hoặc Settings Import data theo giao diện site\.

3\. Dry run trên project thử với 1 Epic 1 Story 1 Sub\-task; chọn đủ cả ba dòng từ CSV và giữ original IDs/Parent\. Validate không lỗi rồi import test, kiểm tra parent và tiếng Việt\.

4\. Mapping Work item ID vào Work item ID hoặc Issue ID; Work type vào Issue Type; Parent vào Parent; Summary Description Priority Status Due Date vào field tương ứng\. Chọn date format yyyy\-MM\-dd\.

5\. Mapping Story Points vào field estimation đúng của site, chỉ Story/Task\. Nếu Task không hỗ trợ SP trong scheme, thêm field/scheme phù hợp hoặc chỉ theo dõi Task bằng time estimate, tính lại planning trước start Sprint\.

6\. Labels chứa một nhãn bkt\_mã\_tạm mỗi dòng để tìm và chống nhập lại\. Không import Assignee ở bản safe vì chưa có account ID; gán thật sau import\.

7\. Import toàn bộ sau test; giữ import log và tải danh sách key Jira đã cấp\. Lập bảng EP/ST/TK tạm sang BKT thật bằng label/description; không đoán thứ tự Jira cấp key\.

8\. Trong Backlog tạo Sprint 01 đến số Sprint forecast cần dùng; dùng bulk edit/filter theo mapping để gán Planned Sprint sang Sprint thật\. Đừng map chuỗi tên Sprint tùy ý vào native Sprint nếu importer đòi internal ID\.

9\. Gán account ID A/B thật, Fix version, Components và priority value\. Custom AC/Functional ID/UI có thể map từ bảng planning nếu đã tạo; nếu không AC đã nằm trong Description\.

10\. Tạo issue links is blocked by theo Dependencies tạm sau khi map sang key Jira\. Cột Dependencies không tự biến thành link nếu không cấu hình importer tương ứng\. Parent là hierarchy, không phải dependency\.

11\. Kiểm tra counts 19 Epic 90 Story 12 Task 270 Sub\-task; 90 trace Function; subtotal SP khớp; status toàn bộ To Do; rồi refinement TK01 và start Sprint đầu\. Không nhập lại nguyên file vì sẽ trùng issue\. Nếu lỗi giữa chừng, so labels/import log rồi chỉ import phần thiếu\.

BKT\_PRODUCT\_BACKLOG\.csv chứa placeholders và field planning; không phải bản một\-click import mọi field\. BKT\_JIRA\_IMPORT\.csv là bản hierarchy tối thiểu có Description chứa thông tin còn lại\. Các trường Assignee Sprint Components Versions Dependencies cần ánh xạ theo site\. Chưa có quyền kết nối hay account Jira cụ thể trong yêu cầu này; tài liệu và CSV đã sẵn để review, chưa tạo dữ liệu Jira thực tế\.

## Nguồn đối chiếu

BOOKING\_TRAVEL\_PROJECT\_SPRINT\_PLAN\.docx

AI\_BUILD\_SPEC\_BOOKING\_TRAVEL\_HOAN\_CHINH\.docx

BOOKING\_TRAVEL\_FIGMA\_UI\_UX\_SPEC\_FULL\.docx

DAC\_TA\_CHUC\_NANG\_HE\_THONG\_BOOKING\_TRAVEL\.docx

https://support\.atlassian\.com/jira\-software\-cloud/docs/prepare\-a\-csv\-file\-for\-import/

https://support\.atlassian\.com/jira\-cloud\-administration/docs/import\-data\-from\-a\-csv\-file/

https://support\.atlassian\.com/jira\-software\-cloud/docs/mapping\-csv\-data\-to\-jira\-fields/

https://support\.atlassian\.com/jira\-software\-cloud/docs/enable\-reports/

https://support\.atlassian\.com/jira\-software\-cloud/docs/generate\-a\-report/


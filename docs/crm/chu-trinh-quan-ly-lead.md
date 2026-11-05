# Chu trình quản lý lead

**Mốc đối chiếu:** 14/10/2026, hệ thống đang chạy tại https://rs.pttads.vn.  
**Đối tượng:** người phụ trách lead, trưởng nhóm, giám đốc kinh doanh.  
Tài liệu này mô tả cách hệ thống đang giữ lead, không phải quy trình mong muốn về sau.

Hai lớp chạy song song:

- **Trạng thái trên bảng** (`/crm/leads`): Mới, Đã liên hệ, Đang tư vấn, Báo giá, và các cột rẽ.
- **Bước B2 (Liên hệ lần đầu):** chỉ xong khi có báo cáo **Liên hệ OK** và hoàn thành bước. Xong B2 mới mở tư vấn trước bán.

Lead có thể đứng ở Báo giá mà B2 vẫn chưa xong. Ngược lại, có cuộc gọi rồi vẫn chưa tính là Liên hệ OK.

## 1. Lead vào hệ thống

Lead vào từ quảng cáo (Facebook, Zalo), form web, API, hoặc nhập tay. Bản ghi nằm ở `crm_leads`. Lead trùng (`is_duplicate`) không đi vào hàng tra soát.

Khi tạo, nếu bật chia tự động, hệ thống gán một người phụ trách:

1. Ưu tiên người được chỉ định, nếu người đó đang hoạt động, đang bật **Nhận lead**, và chưa bấm **Tạm dừng** trên sổ đội.
2. Không có người chỉ định thì chia vòng những nhân viên đang hoạt động, đang bật **Nhận lead**, đúng phạm vi ngành/dịch vụ, và chưa tạm dừng nhận.

Công tắc **Nhận lead** trên hồ sơ nhân viên (`can_receive_leads`) là điều kiện của vòng chia tự động, gán tay, thả khỏi hàng tra soát, và worker quá hạn phản hồi đầu. Công tắc **Tạm dừng** trên sổ đội (`crm_ae_intake.accepting`) loại người khỏi các đường đó. Không có dòng tạm dừng thì hệ thống coi là đang nhận. Hết người thỏa điều kiện thì lead vào Phải tra soát, người phụ trách để trống.

Gán tay từ màn chăm sóc và khi thả lead khỏi hàng tra soát ghi lý do vào nhật ký phân công. Cả hai đường từ chối người đã tắt Nhận lead hoặc đang Tạm dừng.

## 2. Hai luồng

| Luồng | Khi nào | Cột trên bảng |
|---|---|---|
| Bán hàng | Lead không gắn khách vận hành, hoặc đã có tư vấn trước bán / trạng thái Chốt, Proposal | Mới, Đã liên hệ, Đang tư vấn, Báo giá, Đàm phán, Proposal, Chốt, Thất bại, Chăm sóc lại |
| Chăm sóc vận hành | Lead gắn khách đang chạy dịch vụ | Mới, Đã liên hệ, Đang tư vấn, Hẹn gặp, Chốt, Thất bại, Chờ dọn |

Cổng trạng thái đang bật. Luồng bán hàng được kéo giữa các cột trên bảng. Cột **Chốt** và **Won** vẫn bị khóa cho đến khi B2 xong và đã có hoạt động liên hệ (gọi, tin nhắn, thư hoặc họp).

## 3. Trạng thái trên bảng khi chưa xong B2

| Trạng thái | Điều kiện để vào | Việc người phụ trách làm |
|---|---|---|
| Mới | Lead vừa vào | Gọi hoặc ghi chú liên hệ trước khi rời cột này |
| Đã liên hệ | Đã có cuộc gọi hoặc ghi chú | Tiếp tục chăm, ghi kết quả gọi |
| Đang tư vấn | Đã nói chuyện, đang làm rõ nhu cầu | Giữ liên lạc, chuẩn bị giá nếu khách cần |
| Báo giá, Đàm phán, Proposal | Đã đính báo giá và có giá trị | Theo giá, vẫn chưa được Chốt khi B2 chưa xong |
| Thất bại | Chọn lý do: Không nhu cầu, Giá, Đối thủ, Sai số, Không liên lạc được, hoặc Khác kèm ghi chú | Lead ra khỏi vòng chăm |
| Chăm sóc lại | Bắt buộc ngày hẹn gọi lại | Gọi đúng ngày hẹn |
| Chờ dọn | Thiếu tên hoặc số | Chỉ được sang Chờ dọn hoặc Thất bại cho đến khi bổ sung dữ liệu |

Thiếu dữ liệu thì mọi cột khác bị chặn.

## 4. Bước B2

B2 là một bước duy nhất: **Liên hệ lần đầu**. Câu trên màn hình viết “liên hệ trong 48 giờ”. Đồng hồ tự động thu lead lại chạy **24 giờ đồng hồ** kể từ lần gán cho người phụ trách hiện tại (`b2_contact_deadline_hours = 24`, hàng tra soát đang bật).

B2 xong khi đủ cả ba:

1. Có báo cáo chăm sóc với kết quả **Liên hệ OK** (`da_lien_he_thanh_cong`).
2. Có ghi chú hoàn thành bước, ít nhất 3 ký tự.
3. Lead không đang nằm trong hàng **Phải tra soát**. Báo cáo vẫn ghi được khi lead đang ở hàng đó. Nút hoàn thành B2 thì không.

Hoàn thành B2 đổi trạng thái lưu thành liên hệ lần đầu và, với luồng bán hàng, tạo hồ sơ tư vấn trước bán nếu chưa có. Dịch vụ mặc định khi người dùng không chọn là SEO tổng thể. Cờ tư vấn trước bán trên lead đang bật.

Trước bán đi tiếp Lead, rồi Tư vấn, rồi Báo giá, trên trang lead. Hợp đồng và bàn giao triển khai nằm sau bước đó.

## 5. Đã gọi nhưng chưa nói chuyện được

Ghi trên khối phản hồi đầu của lead. Ba kết quả này tính là đã có cuộc gọi. Chúng không phải Liên hệ OK, nên B2 vẫn mở.

Ngày làm việc của chuỗi giữ lead: thứ Hai–thứ Sáu, 09:00–18:00. Mỗi lần gọi cách nhau ít nhất 2 giờ làm việc.

| Kết quả ghi | Hệ thống hiểu | Hạn giữ được tính | Hết hạn, vẫn chưa Liên hệ OK |
|---|---|---|---|
| Đổ chuông, khách không bắt máy | Đang gọi | 3 ngày làm việc từ lúc gán. Lead nóng: 2 ngày. Đủ 5 lần, lead nóng 4 lần | Đủ lần: chuyển một người đang bật Nhận lead và chưa Tạm dừng. Chưa đủ lần: nhắc người đang giữ, không chuyển |
| Không liên lạc được (máy bận lâu, thuê bao, không kết nối) | Đang gọi | 2 ngày làm việc, đủ 3 lần, tối đa 1 vòng chuyển | Đủ lần: chuyển một vòng. Hết vòng: Thất bại, lý do Không liên lạc được |
| Khách hẹn gọi lại | Đã hẹn gọi lại. Phải có giờ hẹn. Thẻ sang Chăm sóc lại | Mốc muộn hơn giữa 3 ngày làm việc từ lúc gán và 1 ngày làm việc sau giờ hẹn | Quá mốc mà không có cuộc gọi mới: gỡ người phụ trách, đưa vào Phải tra soát |
| Đã nói chuyện | Đủ thông tin, chờ gặp, hoặc kết quả khác | Hết hạn giữ | Dừng worker quá hạn phản hồi đầu |

Trong hạn giữ, đồng hồ 24 giờ Liên hệ OK và worker quá hạn phản hồi đầu bỏ qua lead. Quét Phải tra soát xử lý lead đã hết hạn. Cờ `lead_sla_reassign_enabled` vẫn tắt. Đường tự chuyển cũ theo ngày làm việc không được bật lại.

## 6. Bốn đồng hồ đang chạy cùng lúc

Một lead chưa xong B2 có thể bị bốn đồng hồ nhìn cùng lúc. Chúng không thay nhau.

| Đồng hồ | Mốc | Việc hệ thống làm khi quá hạn |
|---|---|---|
| Phản hồi đầu trên thẻ bảng | 15 phút trong khung 08:00–21:00, cả tuần. Số 15 là mức gốc vì cấu hình bảng không ghi đè | Thẻ nổi trễ. Sổ đội đếm lead trễ hạn phản hồi |
| Phản hồi đầu bằng cuộc gọi | 2 giờ, chỉ tính cuộc gọi điện, trong giờ hành chính thứ Hai–thứ Sáu | Ghi đã trễ nếu cuộc gọi đầu sau hạn. Cuộc gọi không nghe máy vẫn làm xong đồng hồ này |
| B2, Liên hệ OK | 24 giờ đồng hồ từ lần gán cho người đang giữ | Gỡ người phụ trách, đưa lead vào **Phải tra soát**. Bỏ qua lead còn trong hạn giữ của mục 5. Lead Thất bại, lead đã Liên hệ OK, và lead đã ghi Đã nói chuyện không bị thu |
| Quá hạn sự cố phản hồi đầu | Sự cố đã quá hạn thêm 10 phút, và chưa có Liên hệ OK, và kết quả gọi chưa phải đã nói chuyện, và lead không còn trong hạn giữ | Worker chuyển lead cho một nhân viên đang hoạt động, đang bật Nhận lead, chưa Tạm dừng. Hết người thì đưa vào Phải tra soát, người phụ trách để trống |

Worker ở dòng cuối đang chạy vì có quy tắc định tuyến đã xuất bản. Worker không lấy người đứng đầu danh sách theo tên. Lead không nghe máy, máy bận, hoặc hẹn gọi lại được bỏ qua suốt hạn giữ.

Nhắc “lead đứng yên” trên bảng: Mới sau 1 ngày, Đã liên hệ sau 2 ngày, Đang tư vấn sau 3 ngày, Báo giá sau 7 ngày, Chăm sóc lại sau 2 ngày. Nhắc gửi cho người phụ trách. Thêm một ngày nữa thì nhắc trưởng nhóm. Đây là ghi chú trên lịch sử, không đổi người giữ lead.

## 7. Hàng Phải tra soát

Lead vào hàng này khi hết 24 giờ kể từ lúc được gán cho người hiện tại mà chưa có Liên hệ OK, chưa ghi Đã nói chuyện, và lead không còn trong hạn giữ. Hết hạn hẹn gọi lại mà không có cuộc gọi mới cũng đưa lead vào hàng này. Người phụ trách bị gỡ. Giám đốc kinh doanh gán lại cho người đang bật **Nhận lead** và chưa Tạm dừng. Người cũ chỉ nhận lại khi vẫn đủ hai điều kiện đó.

Khi lead còn trong hàng, không hoàn thành được B2. Vẫn ghi được báo cáo chăm sóc và cuộc gọi vào lịch sử.

## 8. Lịch sử trao đổi

Mọi cuộc gọi ghi kết quả, mọi phiên gọi từ điện thoại trên lead, mọi ghi chú và mọi báo cáo chăm sóc đều vào lịch sử của lead. Trạng thái lead tại lúc đó không chặn việc ghi.

Trên thẻ lead và trên trang lead, mỗi dòng có ba phần:

1. Tên người chăm sóc. Nhắc tự động ghi **Hệ thống**.
2. Việc vừa cập nhật, bằng tiếng Việt.
3. Thời điểm theo giờ Việt Nam.

## 9. Sổ đội

Màn **Đội AE** (`/crm/b2b/team`) dành cho trưởng nhóm của đội có nhân viên kinh doanh, và cho tài khoản có quyền xem toàn bộ đội. Trưởng nhóm thấy thành viên cùng đội đang ở vị trí kinh doanh. Quyền xem toàn bộ thấy mọi nhân viên kinh doanh đang hoạt động, kể cả người chưa được gắn đội.

Sổ đội đọc cùng các đồng hồ ở trên: đang giữ, trễ phản hồi, sắp trễ, và các nhịp chuyển trạng thái. **Tạm dừng** trên sổ đội tắt chia tự động cho người đó. Lead đã nằm ở người đó không tự rút đi chỉ vì bấm Tạm dừng.

## 10. Tóm tắt một lead từ lúc vào đến lúc xong B2

1. Lead vào, có một người phụ trách.
2. Trong 15 phút, thẻ bảng bắt đầu tính trễ phản hồi. Trong 2 giờ, cần một cuộc gọi điện để xong phản hồi đầu.
3. Người phụ trách ghi kết quả: không nghe, máy bận, hẹn lại, hoặc đã nói chuyện.
4. Lịch sử lưu tên, việc, và giờ.
5. Trạng thái bảng đi theo mục 3. Chốt vẫn khóa.
6. Hết 24 giờ mà chưa Liên hệ OK, và không còn trong hạn giữ: lead sang Phải tra soát.
7. Song song, nếu sự cố phản hồi đầu đã quá hạn, cuộc gọi chưa phải đã nói chuyện, và lead không còn trong hạn giữ, worker chuyển lead cho một người đang bật Nhận lead và chưa Tạm dừng. Hết người thì lead vào Phải tra soát.
8. Có Liên hệ OK và hoàn thành B2: mở tư vấn trước bán trên luồng bán hàng.

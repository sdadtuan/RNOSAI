# Hướng dẫn quản lý Lead trên CRM PTT

**Phiên bản:** 1.0 · **Ngày:** 2026-11-02  
**Hệ thống:** https://rs.pttads.vn  
**Đối tượng:** người giữ lead (AE / CSKH), trưởng nhóm, giám đốc kinh doanh  
**Phạm vi:** nhận lead, gọi, ghi kết quả, hoàn thành liên hệ lần đầu (B2), giữ lead trên bảng, và xử lý hàng Phải tra soát

Tài liệu này là thao tác trên màn hình đang chạy. Cách hệ thống giữ lead, đồng hồ và điều kiện thu lead nằm ở [Chu trình quản lý lead](../crm/chu-trinh-quan-ly-lead.md).

---

## 1. Hai loại lead

CRM giữ hai loại lead. Mỗi loại có menu, cột bảng và đích thắng riêng.

| | Lead B2B (bán mới) | Lead vận hành (CSKH) |
|---|---|---|
| Mục đích | Prospect chưa ký → tư vấn → báo giá → hợp đồng agency | Lead quảng cáo của khách **đã ký**, đang chạy dịch vụ |
| Menu | **Bán hàng → Lead B2B** | **CRM → Lead vận hành** |
| Tạo tay | **Bán hàng → Tạo lead B2B** | **CRM → Tạo lead vận hành** |
| Gắn với | Dự án PTT | Khách hàng agency |
| Cột riêng | Báo giá, Chăm sóc lại | Hẹn gặp, Chờ dọn |
| Thắng | Chốt (`won`) | Chốt (`chot`) |

Mở sai menu thì lead không hiện, hoặc hiện nhưng không đi đúng bước tiếp theo. Trên chi tiết lead, nhãn luồng nằm trên đầu trang: bán hàng hoặc CSKH vận hành.

Danh sách gộp mọi lead: **CRM → Tất cả leads** (`/crm/leads`).

---

## 2. Vào màn hình

Đăng nhập tại https://rs.pttads.vn/login bằng email nhân viên. Menu chỉ hiện mục tài khoản có quyền. Không thấy mục cần dùng thì nhờ Admin gán quyền, không phải lỗi trang.

| Việc | Menu | Đường dẫn |
|---|---|---|
| Lead mình đang bán | Bán hàng → Lead B2B | `/crm/b2b/leads` |
| Mọi lead | CRM → Tất cả leads | `/crm/leads` |
| Lead của khách đang chạy dịch vụ | CRM → Lead vận hành | `/crm/operational/leads` |
| Lead quá hạn chưa Liên hệ OK | CRM → Phải tra soát (B2) | `/crm/leads/review-queue` |
| Sổ người đang nhận lead | Bán hàng → Đội AE | `/crm/b2b/team` |
| Tạo lead bán mới | Bán hàng → Tạo lead B2B | `/crm/b2b/leads/new` |
| Tạo lead vận hành | CRM → Tạo lead vận hành | `/crm/operational/leads/new` |
| Hội thoại | Bán hàng → Inbox B2B | `/crm/b2b-inbox` |
| Thu thập BANT | Bán hàng → Lead Intake | `/crm/intake` |

Trên danh sách, bộ lọc người giữ:

- **Của tôi** — lead đang giao cho tài khoản đang đăng nhập.
- **Chưa phân** — chưa có người giữ.
- **Tất cả** — trong phạm vi tài khoản được xem.

Bộ lọc hàng tra soát trên danh sách: **Pipeline AM**, **Phải tra soát**, **Tất cả (có tag)**.

Click tên lead mở chi tiết `/crm/leads/{id}`.

---

## 3. Lead vào và được giao

Lead vào từ quảng cáo (Facebook, Zalo), form web, API, hoặc nhập tay. Lead trùng không vào hàng tra soát.

Khi bật chia tự động, hệ thống gán một người giữ theo thứ tự:

1. Người được chỉ định, nếu tài khoản đang hoạt động, đang bật **Nhận lead**, và chưa **Tạm dừng** trên sổ đội.
2. Không có người chỉ định thì chia vòng những người đang hoạt động, đang bật **Nhận lead**, đúng ngành hoặc dịch vụ, và chưa tạm dừng.

Hết người thỏa điều kiện thì lead vào **Phải tra soát**, người giữ để trống.

**Nhận lead** trên hồ sơ nhân viên là điều kiện để được chia tự động, được gán tay, được nhận lead thả khỏi hàng tra soát, và được worker chuyển khi quá hạn phản hồi đầu. **Tạm dừng** trên sổ đội (`/crm/b2b/team`) loại người khỏi các đường đó. Lead đã nằm ở người đó không tự rút đi chỉ vì bấm Tạm dừng.

Gán tay và thả lead khỏi hàng tra soát đều ghi lý do vào nhật ký phân công. Cả hai đường từ chối người đã tắt Nhận lead hoặc đang Tạm dừng.

---

## 4. Việc của người đang giữ lead

Mở **Của tôi**, ưu tiên cột **Mới** và thẻ đang đếm giờ Liên hệ OK.

1. Mở lead. Đọc tên, số, nguồn, chiến dịch (nếu có) và người đang giữ.
2. Gọi điện từ nút gọi trên đầu trang, hoặc gọi máy rồi ghi lại trên khối phản hồi đầu.
3. Chọn đúng kết quả cuộc gọi (mục 5). Kênh **Điện thoại** mới tính phản hồi đầu. Zalo, SMS và email vẫn ghi được, và không xong đồng hồ cuộc gọi đầu.
4. Kéo trạng thái trên bảng cho khớp việc vừa làm (mục 6). Cột **Chốt** vẫn khóa khi chưa xong B2.
5. Khi đã nói chuyện và đủ nhu cầu, sang tab **Kết quả B2** và bấm **Xong B2 → sang Pre-sales** (mục 7).

Thiếu tên hoặc số: lead chỉ được sang **Chờ dọn** hoặc **Thất bại** cho đến khi bổ sung dữ liệu.

---

## 5. Ghi kết quả cuộc gọi

Trên chi tiết lead, khối phản hồi đầu có các kết quả sau. Ba kết quả đầu tính là đã gọi. Chúng không phải Liên hệ OK, nên B2 vẫn mở.

Ngày làm việc của chuỗi giữ lead: thứ Hai–thứ Sáu, 09:00–18:00. Mỗi lần gọi cách nhau ít nhất 2 giờ làm việc.

| Kết quả trên màn hình | Hệ thống hiểu | Hạn giữ | Hết hạn mà vẫn chưa Liên hệ OK |
|---|---|---|---|
| Không nghe máy | Đang gọi | 3 ngày làm việc từ lúc gán. Lead nóng: 2 ngày. Đủ 5 lần, lead nóng 4 lần | Đủ lần: chuyển một người đang bật Nhận lead và chưa Tạm dừng. Chưa đủ lần: nhắc người đang giữ |
| Máy bận | Đang gọi (thuê bao, máy bận lâu, không kết nối) | 2 ngày làm việc, đủ 3 lần, tối đa 1 vòng chuyển | Đủ lần: chuyển một vòng. Hết vòng: Thất bại, lý do Không liên lạc được |
| Sai số | Contact không hợp lệ | Cần xác nhận đã kiểm tra | Đóng liên lạc sau khi ghi nhận |
| Hẹn gọi lại | Đã hẹn. Bắt buộc có giờ hẹn. Thẻ sang Chăm sóc lại | Mốc muộn hơn giữa 3 ngày làm việc từ lúc gán và 1 ngày làm việc sau giờ hẹn | Quá mốc mà không có cuộc gọi mới: gỡ người giữ, đưa vào Phải tra soát |
| Đã nói chuyện — chờ gặp mặt | Đã kết nối, chờ gặp | Hết hạn giữ của chuỗi gọi nhỡ | Dừng worker quá hạn phản hồi đầu. Sang Kết quả B2 khi sẵn sàng hoàn thành B2 |
| Đã nói chuyện — đủ thông tin | Đủ nhu cầu để đi tiếp | Hết hạn giữ | Dừng worker. Hoàn thành B2 |
| Đã nói chuyện — kết quả khác | Đã nói chuyện, không thuộc hai trường hợp trên | Hết hạn giữ | Dừng worker. Hoàn thành B2 nếu đủ điều kiện mục 7 |

Trong hạn giữ, đồng hồ 24 giờ Liên hệ OK và worker quá hạn phản hồi đầu bỏ qua lead.

---

## 6. Trạng thái trên bảng

Luồng bán hàng kéo được giữa các cột. Cột **Chốt** khóa cho đến khi B2 xong và đã có hoạt động liên hệ (gọi, tin nhắn, thư hoặc họp).

| Cột | Khi nào đứng ở đây | Người giữ làm gì |
|---|---|---|
| Mới | Lead vừa vào | Gọi hoặc ghi chú liên hệ trước khi rời cột |
| Đã liên hệ | Đã có cuộc gọi hoặc ghi chú | Ghi kết quả gọi, tiếp tục chăm |
| Đang tư vấn | Đã nói chuyện, đang làm rõ nhu cầu | Giữ liên lạc, chuẩn bị giá nếu khách cần |
| Báo giá | Đã đính báo giá và có giá trị. Cột này gộp cả đàm phán | Theo giá. Vẫn chưa Chốt khi B2 chưa xong |
| Chốt | B2 đã xong và đã có hoạt động liên hệ | Bàn giao hợp đồng / khách hàng |
| Thất bại | Chọn lý do: Không nhu cầu, Giá, Đối thủ, Sai số, Không liên lạc được, hoặc Khác kèm ghi chú | Lead ra khỏi vòng chăm |
| Chăm sóc lại | Bắt buộc ngày hẹn gọi lại | Gọi đúng ngày hẹn |

Luồng vận hành dùng cột: Mới, Đã liên hệ, Đang tư vấn, Hẹn gặp, Chốt, Thất bại, Chờ dọn. Banner trên chi tiết ghi **Luồng CSKH vận hành 24h**. Luồng này không đi Pre-sales và không tạo hợp đồng agency.

Bộ lọc danh sách còn các tình huống gọi: Không nghe máy, Máy bận, Hẹn gọi lại, Sai số, Đã nói chuyện, Đã chuyển Solution.

Lead có thể đứng ở Báo giá trong khi B2 vẫn chưa xong. Ngược lại, đã gọi rồi vẫn chưa tính là Liên hệ OK.

---

## 7. Hoàn thành B2 — Liên hệ lần đầu

B2 là một bước: **Liên hệ lần đầu**. Câu trên màn hình viết liên hệ trong 48 giờ. Đồng hồ thu lead chạy **24 giờ đồng hồ** kể từ lần gán cho người đang giữ.

Trên chi tiết lead bán hàng, tab **Pipeline bán hàng** mở khối **Liên hệ lần đầu (B2)**:

- Tab phản hồi đầu: ghi cuộc gọi khi chưa nói chuyện được.
- Tab **Kết quả B2**: dùng khi đã nói chuyện. Ghi chú rồi bấm **Xong B2 → sang Pre-sales**.

B2 xong khi đủ cả ba:

1. Có báo cáo chăm sóc với kết quả **Liên hệ OK**.
2. Có ghi chú hoàn thành bước, ít nhất 3 ký tự. Ghi chú ngắn hơn bị chặn với câu *Ghi chú cần ≥ 3 ký tự.* Gợi ý sẵn: `Đã liên hệ KH — xác nhận nhu cầu`.
3. Lead không đang nằm trong **Phải tra soát**. Báo cáo vẫn ghi được khi lead ở hàng đó. Nút hoàn thành B2 thì không.

Xong B2, luồng bán hàng tạo hồ sơ tư vấn trước bán nếu chưa có. Dịch vụ mặc định khi người dùng không chọn là SEO tổng thể. Trên màn hình hiện *B2 đã xong — đã sang Pre-sales Lead.*

Không nghe máy và sai số ghi ở phản hồi đầu. Không dùng cổng Kết quả B2 cho hai trường hợp đó.

---

## 8. Bốn đồng hồ chạy cùng lúc

Một lead chưa xong B2 có thể bị bốn đồng hồ nhìn cùng lúc. Chúng không thay nhau.

| Đồng hồ | Mốc | Quá hạn thì sao |
|---|---|---|
| Phản hồi đầu trên thẻ bảng | 15 phút, khung 08:00–21:00, cả tuần | Thẻ nổi trễ. Sổ đội đếm lead trễ hạn phản hồi |
| Phản hồi đầu bằng cuộc gọi | 2 giờ, chỉ tính cuộc gọi điện, trong giờ hành chính thứ Hai–thứ Sáu | Ghi đã trễ nếu cuộc gọi đầu sau hạn. Cuộc gọi không nghe máy vẫn làm xong đồng hồ này |
| B2, Liên hệ OK | 24 giờ đồng hồ từ lần gán cho người đang giữ | Gỡ người giữ, đưa lead vào Phải tra soát. Bỏ qua lead còn trong hạn giữ mục 5. Lead Thất bại, đã Liên hệ OK, hoặc đã ghi Đã nói chuyện không bị thu |
| Quá hạn sự cố phản hồi đầu | Sự cố đã quá hạn thêm 10 phút, chưa Liên hệ OK, kết quả gọi chưa phải đã nói chuyện, và lead không còn trong hạn giữ | Worker chuyển lead cho một nhân viên đang hoạt động, đang bật Nhận lead, chưa Tạm dừng. Hết người thì vào Phải tra soát, người giữ để trống |

Nhắc lead đứng yên trên bảng: Mới sau 1 ngày, Đã liên hệ sau 2 ngày, Đang tư vấn sau 3 ngày, Báo giá sau 7 ngày, Chăm sóc lại sau 2 ngày. Nhắc gửi người giữ. Thêm một ngày nữa thì nhắc trưởng nhóm. Đây là ghi chú trên lịch sử, không đổi người giữ lead.

Trên thẻ, câu dạng *Còn N giờ để Liên hệ OK* là đồng hồ B2. Sau khi đã Liên hệ OK, các nhãn chăm sóc này ẩn đi.

---

## 9. Phải tra soát

Lead vào hàng này khi hết 24 giờ kể từ lúc được gán cho người hiện tại mà chưa có Liên hệ OK, chưa ghi Đã nói chuyện, và lead không còn trong hạn giữ. Hết hạn hẹn gọi lại mà không có cuộc gọi mới cũng đưa lead vào hàng này. Người giữ bị gỡ.

Giám đốc kinh doanh mở **CRM → Phải tra soát (B2)** hoặc tab **Phải tra soát** trên danh sách lead.

1. Đọc tên, số, trạng thái, số giờ chờ, lý do, và gợi ý người nhận.
2. Bấm **Release…**.
3. **Auto** gán lại người giữ trước. **Manual** chọn người nhận.
4. Người nhận phải đang bật **Nhận lead** và chưa **Tạm dừng**. Người cũ chỉ nhận lại khi vẫn đủ hai điều kiện đó.
5. Xác nhận. Lead rời hàng và hiện trên danh sách của người được gán. Nhật ký ghi lý do phân công.

Khi lead còn trong hàng, không hoàn thành được B2. Vẫn ghi được báo cáo chăm sóc và cuộc gọi vào lịch sử.

---

## 10. Sau khi xong B2 (lead bán hàng)

Pre-sales đi trên chính trang lead, tab **Pipeline bán hàng**, rồi **Tư vấn**, rồi **Hợp đồng & Chốt**.

| Bước | Ở đâu | Việc làm |
|---|---|---|
| Thu thập nhu cầu | Bán hàng → Lead Intake, hoặc bước intake trên pipeline | Điền BANT: ngân sách, người quyết, nhu cầu, thời điểm |
| Tư vấn | Tab Tư vấn trên lead | Biên bản tư vấn, làm rõ phạm vi |
| Chuẩn bị buổi gặp | Tab Sales Cockpit, nếu tài khoản thấy tab | Thu thập, xác minh, chiến lược, vũ trang tài liệu gặp |
| Báo giá | Bán hàng → Báo giá (`/crm/proposals`), hoặc cột Báo giá | Tạo báo giá, gửi khách |
| Hợp đồng | Tab Hợp đồng & Chốt, hoặc Bán hàng → Hub hợp đồng | Dự thảo hợp đồng. Ký xong mới thành khách hàng và mở triển khai |
| Bàn giao Solution | Bán hàng → Hàng đợi Solution | Khi deal cần Solution tiếp nhận |

Chốt trên bảng vẫn cần B2 đã xong. Ký hợp đồng và bàn giao triển khai nằm sau tư vấn và báo giá, không nằm ở bước ghi cuộc gọi.

---

## 11. Sổ đội

**Bán hàng → Đội AE** dành cho trưởng nhóm của đội có nhân viên kinh doanh, và cho tài khoản được xem toàn bộ đội.

Sổ đọc cùng các đồng hồ ở mục 8: đang giữ, trễ phản hồi, sắp trễ, và nhịp chuyển trạng thái.

**Tạm dừng** tắt chia lead mới cho người đó. Dùng khi người đó nghỉ, hết ca, hoặc không nhận thêm lead. Lead đã giao không tự chuyển đi. Muốn rút lead đang giữ thì gán tay hoặc để lead vào Phải tra soát theo đồng hồ.

---

## 12. Lịch sử

Mọi cuộc gọi có kết quả, mọi phiên gọi từ điện thoại trên lead, mọi ghi chú và mọi báo cáo chăm sóc đều vào lịch sử. Trạng thái lead tại lúc đó không chặn việc ghi.

Mỗi dòng có ba phần:

1. Tên người chăm sóc. Nhắc tự động ghi **Hệ thống**.
2. Việc vừa cập nhật, bằng tiếng Việt.
3. Thời điểm theo giờ Việt Nam.

Trên điện thoại, tab **Nhật ký** là lịch sử này. Tab **Việc** là phần xử lý lead.

---

## 13. Một buổi làm việc

### Người giữ lead

1. Mở Lead B2B hoặc Lead vận hành, lọc **Của tôi**.
2. Xử lý thẻ trễ 15 phút và thẻ *Còn N giờ để Liên hệ OK* trước.
3. Gọi. Ghi kết quả đúng mục 5. Hẹn gọi lại thì nhập giờ hẹn.
4. Đã nói chuyện: ghi chú ≥ 3 ký tự, bấm **Xong B2 → sang Pre-sales** nếu là lead bán hàng.
5. Kéo cột cho khớp. Thất bại thì chọn lý do.
6. Cuối buổi xem Chăm sóc lại đúng ngày hẹn.

### Trưởng nhóm

1. Mở Đội AE. Xem ai trễ phản hồi, ai đang Tạm dừng.
2. Nhắc người giữ lead đứng yên quá mốc mục 8.
3. Không gán lead cho người đã tắt Nhận lead hoặc đang Tạm dừng.

### Giám đốc kinh doanh

1. Mở Phải tra soát. Release lead quá 24 giờ chưa Liên hệ OK.
2. Chọn người đang bật Nhận lead và chưa Tạm dừng.
3. Lead thiếu map kênh nằm ở **Bán hàng → Ingress chưa map**, không nằm trong hàng tra soát B2.

---

## 14. Việc hay bị hiểu nhầm

| Việc nhìn thấy | Cách hiểu đúng |
|---|---|
| Đã gọi nhưng B2 vẫn mở | Chưa có Liên hệ OK. Không nghe máy, máy bận và hẹn gọi lại không hoàn thành B2 |
| Lead ở Báo giá mà không Chốt được | B2 chưa xong, hoặc chưa có hoạt động liên hệ |
| Không bấm được Xong B2 | Lead đang trong Phải tra soát, hoặc ghi chú dưới 3 ký tự, hoặc chưa ghi Liên hệ OK |
| Zalo xong mà thẻ vẫn trễ cuộc gọi đầu | Chỉ cuộc gọi điện tính phản hồi đầu trong 2 giờ |
| Tạm dừng mà lead cũ vẫn ở mình | Tạm dừng chỉ chặn lead mới. Lead đang giữ ở lại |
| Không thấy lead của người khác | Tài khoản chỉ thấy lead trong phạm vi. Lead ngoài phạm vi trả trang không tìm thấy, không hiện tên và số |
| Menu Phải tra soát không có | Tài khoản chưa có quyền gán lead hoặc quyền hàng tra soát |

---

## 15. Tài liệu đi tiếp

| Việc cần đọc thêm | File |
|---|---|
| Đồng hồ, cổng trạng thái, worker thu lead | [Chu trình quản lý lead](../crm/chu-trinh-quan-ly-lead.md) |
| Nguồn Facebook, Zalo, webform và cách map | [Nguồn lead và setup](../crm/huong-dan-nguon-lead-va-setup.md) |
| Từ lead đến khách, marketing, triển khai, KPI | [Quy trình Lead → KPI](./41-quy-trinh-lead-den-kpi.md) |
| Từng màn B2B: dự án, inbox, hợp đồng | [B2B E2E](./24-b2b-e2e-handover-ui-guide.md) |
| Sales Cockpit trước buổi gặp | [Lead Meeting Prep](./25-lead-meeting-prep-ui-guide.md) |

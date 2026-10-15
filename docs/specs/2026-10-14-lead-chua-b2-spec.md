# Spec: Quản lý lead chưa sang B2

**Ngày:** 14/10/2026  
**Trạng thái:** Chờ làm  
**Đối chiếu hiện trạng:** [Chu trình quản lý lead](../crm/chu-trinh-quan-ly-lead.md)

## 1. Vấn đề

Lead chưa hoàn thành B2 vẫn đi trên bảng trạng thái, nhưng bốn đồng hồ không cùng một quy tắc:

- Hết 24 giờ chưa Liên hệ OK thì lead bị đưa vào Phải tra soát, kể cả khi vừa ghi không nghe máy hoặc khách hẹn gọi lại.
- Worker quá hạn phản hồi đầu chuyển lead cho nhân viên đang hoạt động đứng đầu danh sách theo tên, không đọc công tắc Nhận lead.
- Chuỗi giữ lead sau cuộc gọi không nghe, máy bận, hoặc hẹn gọi lại được tính hạn nhưng đang tắt, nên hạn đó không chặn hai đường trên.

## 2. Mục tiêu

1. Lead chưa xong B2 có một người phụ trách đang bật Nhận lead và chưa Tạm dừng.
2. Đã gọi nhưng chưa nói chuyện được thì lead ở lại người đó đến hết hạn giữ.
3. Hết hạn giữ mà vẫn chưa Liên hệ OK thì xử lý đúng nhánh: chuyển người, đóng thất bại, hoặc vào Phải tra soát.
4. Chốt và tư vấn trước bán vẫn chỉ mở sau Liên hệ OK.

## 3. Ngoài phạm vi

- Không thêm cột trên bảng kanban.
- Không đổi nút Gọi ngay và Chăm sóc.
- Không đổi lịch sử trao đổi đã có trên ngăn kéo (tên, việc, giờ).
- Không bật lại chuỗi tự chuyển của phản hồi đầu theo ngày làm việc như một worker riêng. Spec này dùng hạn giữ đó làm điều kiện chặn, rồi xử lý hết hạn bằng quy tắc mục 6.

## 4. Màn hình kanban

**Cột không đổi.** B2 không phải một cột. Các cột giữ nguyên: Mới, Đã liên hệ, Đang tư vấn, Báo giá, Chốt, Thất bại, Chăm sóc lại. Kéo thẻ vẫn đi qua cổng trạng thái hiện có. Chốt vẫn bị khóa khi chưa xong B2.

**Thẻ thêm một nhãn**, cạnh nhãn trễ hạn phản hồi đang có. Nhãn mới nói tình trạng chăm trước B2, không lặp chữ “SLA trễ” hay “Đứng yên”.

Chỉ hiện khi B2 chưa xong. Một thẻ một nhãn, theo thứ tự:

| Điều kiện | Nhãn |
|---|---|
| Kết quả gọi gần nhất là khách hẹn gọi lại, còn trong hạn giữ | Hẹn gọi lại |
| Kết quả gần nhất là máy bận hoặc không kết nối, còn trong hạn giữ | Máy bận |
| Kết quả gần nhất là không nghe máy, còn trong hạn giữ | Không nghe máy |
| Không thuộc ba dòng trên, còn dưới 4 giờ nữa là hết 24 giờ Liên hệ OK | Sắp hết hạn liên hệ |

Hết hạn giữ thì nhãn đó tắt. Thẻ sang trạng thái của mục 6, hoặc vào Phải tra soát.

Ngăn kéo chăm sóc không thêm khối mới. Dòng lịch sử đã đủ. Phía trên lịch sử thêm một câu hạn, ví dụ “Giữ đến 16/10/2026 18:00” hoặc “Còn 3 giờ để Liên hệ OK”. Không có hạn thì không hiện câu đó.

## 5. Ai được giữ lead

Người nhận phải đang hoạt động, đang bật Nhận lead, và chưa Tạm dừng trên sổ đội.

Áp dụng cho chia tự động, gán tay, thả khỏi Phải tra soát, và worker quá hạn phản hồi đầu. Hết người thỏa điều kiện thì lead vào Phải tra soát, không gán cho người đứng đầu danh sách.

## 6. Đã gọi nhưng chưa đạt

Ngày làm việc: thứ Hai–thứ Sáu, 09:00–18:00. Mỗi lần gọi cách nhau ít nhất 2 giờ làm việc. Đồng hồ 24 giờ Liên hệ OK và worker quá hạn phản hồi đầu dừng trong suốt hạn giữ.

| Kết quả | Hạn giữ | Hết hạn, vẫn chưa Liên hệ OK |
|---|---|---|
| Không nghe máy | 3 ngày làm việc từ lúc gán. Lead nóng: 2 ngày. Cần đủ 5 lần, lead nóng 4 lần | Đủ lần: chuyển một người thỏa mục 5. Chưa đủ lần: nhắc người đang giữ, không chuyển |
| Máy bận hoặc không kết nối | 2 ngày làm việc, đủ 3 lần | Đủ lần: chuyển một vòng sang người thỏa mục 5. Hết vòng: chuyển Thất bại, lý do Không liên lạc được |
| Khách hẹn gọi lại | Mốc muộn hơn giữa 3 ngày làm việc từ lúc gán và 1 ngày làm việc sau giờ hẹn. Bắt buộc có giờ hẹn. Trạng thái bảng để Chăm sóc lại | Quá mốc mà không có cuộc gọi mới: gỡ người phụ trách, đưa vào Phải tra soát |

Có Liên hệ OK và hoàn thành B2 thì lead rời spec này. Tư vấn trước bán mở như hiện tại.

## 7. Việc cần làm

1. Worker quá hạn phản hồi đầu chọn người theo mục 5. Trong hạn giữ của mục 6 thì bỏ qua lead đó.
2. Quét Phải tra soát bỏ qua lead còn trong hạn giữ. Hết hạn hẹn gọi lại mà không có cuộc gọi mới thì mới thu lead.
3. Gán tay và thả khỏi hàng tra soát từ chối người đã tắt Nhận lead hoặc đang Tạm dừng.
4. Thẻ kanban thêm nhãn mục 4. Ngăn kéo thêm một câu hạn. Cột và nút giữ nguyên.

## 8. Nghiệm thu

- Lead vừa ghi không nghe máy không vào Phải tra soát trong hạn 3 ngày làm việc, và không bị worker chuyển người.
- Người tắt Nhận lead không nhận lead từ worker, từ gán tay, hay từ hàng tra soát.
- Hết người nhận được thì lead vào Phải tra soát với người phụ trách trống.
- Bảng kanban vẫn đúng các cột cũ. Thẻ không nghe máy hiện nhãn “Không nghe máy”. Thẻ đã Liên hệ OK không hiện nhãn này.
- Kéo sang Chốt khi chưa xong B2 vẫn bị từ chối.

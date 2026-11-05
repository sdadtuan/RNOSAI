# SRS — PTT native (App Store và Google Play)

**Sản phẩm:** PTT  
**Document ID:** CSD-CHAT-NATIVE-001  
**Phiên bản:** 1.1  
**Ngày:** 2026-09-25  
**Trạng thái:** Chờ duyệt trước khi xây  
**Ngôn ngữ UI:** Tiếng Việt  
**Prod:** `https://rs.pttads.vn`  
**Đối tượng:** Người đã được admin cấp tài khoản chat

**Changelog 1.1:** Tên app trên store là **PTT**. App chỉ đăng nhập bằng username và mật khẩu chat. Không có màn email/mật khẩu CRM.

**Thay quyết định phân phối điện thoại** trong `docs/superpowers/specs/2026-09-24-csd-chat-app-desktop-design.md` mục A2 (PWA, không store). Web CRM và Desktop Electron giữ nguyên. PWA “Thêm vào Màn hình chính” không còn là bản điện thoại chính thức.

**Nguồn chức năng đang chạy:**

- UI: `/crm/csd/chat`, `CsdChatWorkspace`
- API: `services/ptt-crm-api/src/csd/csd-chat*.controller.ts`
- Quyền: `docs/superpowers/specs/2026-09-16-csd-chat-permission-matrix.md`

---

## 1. Mục tiêu

Người dùng tải **PTT** từ App Store (iOS) và Google Play (Android), đăng nhập bằng tài khoản chat, nhắn tin như trên web, nhận thông báo khi app không mở.

Người dùng không cài bằng nút Chia sẻ của Safari hay Chrome.

## 2. Vấn đề

| Việc hiện tại | Hệ quả |
|---|---|
| Chat nằm trong CRM trên trình duyệt | Phải nhớ URL, thấy menu Lead / KPI |
| PWA “Thêm vào Màn hình chính” | Không có trên App Store / Google Play; người dùng không tìm thấy nút Chia sẻ |
| Không có đẩy tin nền | Máy ngủ thì tin đến chậm |

## 3. Quyết định khóa

| # | Quyết định |
|---|---|
| N1 | Hai app store: iOS và Android. Tên hiển thị **PTT**. Cùng hội thoại với web. |
| N2 | Không viết lại màn chat bằng Swift/Kotlin ở bản 1. App native là vỏ Capacitor bọc `https://rs.pttads.vn/crm/csd/chat?shell=native`. |
| N3 | Mã app `vn.pttads.ptt`. Khác app **PTT Portal** (`vn.pttads.portal`). |
| N4 | App chỉ có một màn đăng nhập: username chat + mật khẩu chat. Không hỏi email hay mật khẩu CRM. Web CRM vẫn đăng nhập nhân viên rồi mới tới chat. |
| N5 | Quyền, nhóm, gọi DM, ticket, AI giữ đúng web. SRS này không nới quyền. |
| N6 | Admin tài khoản chat và quản lý nhóm toàn hệ thống chỉ trên web CRM. |
| N7 | Không tự đăng ký. Admin cấp tài khoản. |
| N8 | Đẩy tin nền (APNs + FCM) thuộc bản store 1. Không hứa realtime khi máy ngủ nếu chưa có đẩy tin. |

## 4. Người dùng

| Vai | Làm trên app |
|---|---|
| Tài khoản chat đã bật, người chỉ được xem | Xem hội thoại |
| Tài khoản chat đã bật và có quyền gửi | Gửi tin, tạo hội thoại, thao tác nhóm đúng vai trò |
| `csd.manage` hoặc `csd.admin` | Bypass vai trò nhóm như web (ghim, khóa gửi, chuyển Chủ) |
| Người chưa có tài khoản | Không vào được. Không có nút đăng ký |
| Khách hàng bên ngoài | Không dùng app này |

## 5. Ngoài phạm vi

- Không Zalo OA, Messenger, Slack, email khách.
- Không gọi nhóm. Gọi thoại / video chỉ hội thoại `kind = direct`.
- Không link mời công khai, không QR, không ghim nhiều tin.
- Không WebSocket ở bản 1. Danh sách và thread vẫn poll như web khi app đang mở.
- Không đưa Lead, KPI, báo cáo, trang admin vào app.
- Không bịa nội dung tin, ticket, số KPI.
- Desktop Electron không nằm trong SRS này.

## 6. Yêu cầu chức năng

### 6.1 Cài và mở app

| ID | Yêu cầu |
|---|---|
| FR-01 | Tìm thấy **PTT** trên App Store và Google Play, tải bằng tài khoản cửa hàng của người dùng. |
| FR-02 | Icon và tên trên màn hình chính là **PTT**. |
| FR-03 | Mở app vào thẳng chat. Không hiện menu CRM, dock, Lead, KPI. |
| FR-04 | Mất mạng: báo không tải được. Không hiện trang trắng không chữ. |

### 6.2 Đăng nhập

| ID | Yêu cầu |
|---|---|
| FR-10 | Một form: username chat và mật khẩu chat. Không có ô email CRM, không có mật khẩu CRM. |
| FR-11 | Đăng nhập thành công khi username khớp tài khoản chat đã bật và mật khẩu đúng. API hiện `POST /api/crm/csd/chat/login` chỉ chạy sau phiên CRM và chỉ đối chiếu mật khẩu của đúng nhân viên đang đăng nhập. App cần lối đăng nhập mới: tìm tài khoản theo username, kiểm tra mật khẩu, trả phiên chỉ dùng cho chat. |
| FR-12 | Sai username, sai mật khẩu, hoặc tài khoản chat tắt: một câu tiếng Việt “Sai tên đăng nhập hoặc mật khẩu chat”. Không nói tài khoản có tồn tại hay không. Không lộ stack. |
| FR-13 | Đóng app rồi mở lại vẫn còn phiên, đến khi hết hạn hoặc người dùng đăng xuất. |
| FR-14 | Đăng xuất xóa phiên trên máy. Lần mở sau về form username/mật khẩu chat. |
| FR-15 | Phiên chat gọi được các API hội thoại, tin, file, gọi. Không mở được trang CRM và không gọi API ngoài chat. |

### 6.3 Chat — ngang web

App làm được các việc web đã có. Cùng nhãn, cùng mã lỗi.

| ID | Yêu cầu |
|---|---|
| FR-20 | Tab Tin nhắn, Danh bạ, Lời mời. Lọc Tất cả, Chưa đọc, Khách, Dự án, Nội bộ. Ô tìm. |
| FR-21 | Tạo hội thoại: Khách, Nội bộ nhóm, DM, Dự án. Không thêm nút tạo cho `campaign`, `ticket`, `announcement`, `ai_assist`. Hội thoại các loại đó vẫn mở được nếu đã có. |
| FR-22 | Gửi chữ, link, ảnh, file. Sửa tin của mình trong 15 phút. Xóa tin của mình. |
| FR-23 | Cảm xúc: Thích, Yêu, Haha, Wow, Buồn, Giận. Nút gửi nhanh Thích. |
| FR-24 | Tìm trong hội thoại, chuyển tiếp, tên gợi nhớ, @ thành viên. |
| FR-25 | Bạn bè: mời, chấp nhận, từ chối, chặn, hủy. DM chỉ sau khi đã là bạn. |
| FR-26 | Nhóm tối đa 100 người. Vai Chủ, Phó, thành viên, viewer. Duyệt vào nhóm, khóa gửi, ghim một tin, chuyển Chủ, rời nhóm — đúng ma trận 2026-09-16. |
| FR-27 | Khóa gửi: người không phải Chủ/Phó thấy ô nhập khóa; API `403` `members_cannot_send`. |
| FR-28 | Gọi thoại và video chỉ bật trên DM chưa đóng. Nhóm và hội thoại khách: nút tắt, chữ “Chỉ hỗ trợ hội thoại DM”. |
| FR-29 | Panel thông tin: thành viên, ticket liên quan, ảnh, file, link. Tóm tắt AI 24 giờ / 7 ngày / tất cả. Từ action trong tóm tắt tạo ticket. Không bịa summary khi API không trả. |
| FR-30 | Ticket liên quan mở trang CRM bằng trình duyệt của máy, không nhét CRM vào app. |
| FR-31 | Đóng, lưu trữ, mở lại hội thoại. `closed` hoặc `archived` khóa ô gửi. |
| FR-32 | Một cột: danh sách → hội thoại → thông tin. Nút quay lại không mất hội thoại đang chọn. Bàn phím không che ô nhập. |

### 6.4 File và cuộc gọi trên máy

| ID | Yêu cầu |
|---|---|
| FR-40 | Ảnh xem trong hội thoại. |
| FR-41 | File khác mở bằng ứng dụng mặc định của iOS/Android (PDF, Word, Excel). |
| FR-42 | Xin quyền micro trước cuộc gọi thoại, quyền camera trước cuộc gọi video. Từ chối quyền thì báo tiếng Việt, không crash. |

### 6.5 Thông báo

| ID | Yêu cầu |
|---|---|
| FR-50 | Lần đầu sau khi chat đã bật, xin quyền thông báo. |
| FR-51 | App không mở hoặc máy khóa: tin mới hiện thông báo hệ điều hành (APNs trên iOS, FCM trên Android). |
| FR-52 | Bấm thông báo mở đúng hội thoại. |
| FR-53 | Icon app có badge số hội thoại chưa đọc (`GET /api/crm/csd/chat/unread-count`). |
| FR-54 | Người dùng tắt thông báo trong hệ điều hành: app vẫn dùng được; tin thấy khi mở app. |

## 7. Yêu cầu cửa hàng

| ID | Yêu cầu |
|---|---|
| ST-01 | iOS: tài khoản Apple Developer, app App Store Connect, bản TestFlight trước khi public. |
| ST-02 | Android: tài khoản Play Console, thử kênh internal trước production. |
| ST-03 | Tên hiển thị **PTT**. Mô tả nói rõ app chat nội bộ, không phải mạng xã hội công cộng, và không phải app PTT Portal. |
| ST-04 | Ảnh chụp màn danh sách và một hội thoại, lấy từ tài khoản thật đã cấp. Không dùng số liệu bịa. |
| ST-05 | Chính sách quyền riêng tư có URL công khai. App không bán dữ liệu chat. |
| ST-06 | Cung cấp tài khoản demo cho người duyệt App Store (nhân viên + chat đã bật). |
| ST-07 | Chuỗi quyền iOS: micro, camera, thông báo — mỗi chuỗi một câu tiếng Việt nói vì sao chat cần. |
| ST-08 | Bản vá lỗi chat trên web có hiệu lực trên app ngay, vì UI tải từ `rs.pttads.vn`. Bản vá vỏ (icon, đẩy tin, quyền) mới cần nộp store. |

## 8. Yêu cầu phi chức năng

| ID | Yêu cầu |
|---|---|
| NF-01 | iOS 16 trở lên. Android 8 trở lên. |
| NF-02 | Chỉ HTTPS tới `rs.pttads.vn`. |
| NF-03 | Token không ghi vào log, không gửi sang domain khác. |
| NF-04 | App đang mở: tin mới trong vòng một chu kỳ poll hiện có của web (thông báo đến 8 giây khi app hiện, 5 giây khi app ẩn nhưng process còn). |
| NF-05 | Khi có đẩy tin (FR-51), thông báo tới máy trong vòng 30 giây sau khi tin được lưu, trong điều kiện APNs/FCM nhận bình thường. |
| NF-06 | Xoay ngang không bắt buộc. Bản 1 khóa dọc. |

## 9. Pha

| Pha | Xong khi |
|---|---|
| N1 Vỏ store | TestFlight và Play internal cài được. Chỉ đăng nhập tài khoản chat (FR-10 đến FR-15). Chat đủ FR-20 đến FR-32. Không menu CRM, không form CRM. |
| N2 Đẩy tin | FR-50 đến FR-54 trên máy thật iOS và Android. Bấm thông báo vào đúng hội thoại. |
| N3 File và gọi | FR-40 đến FR-42. |
| N4 Public | ST-01 đến ST-07. App tìm được trên cả hai cửa hàng. |

N1 chưa được ghi là đã có thông báo khi máy ngủ.

## 10. Nghiệm thu

Dùng nhân viên đã có chat bật. Không tạo tin, ticket, số giả.

1. Cài từ TestFlight và từ Play internal, không qua Safari Chia sẻ.
2. Mở app chỉ thấy username chat và mật khẩu chat. Không thấy email CRM.
3. Tài khoản chat chỉ được xem: vào được hội thoại, không gửi.
4. Lời mời bạn chưa chấp nhận thì không có DM.
5. Nhóm khóa gửi: member không gửi được.
6. Ghim tin mới thay tin ghim cũ.
7. Nút gọi tắt trên nhóm và hội thoại khách.
8. Đăng xuất rồi mở lại thì về form tài khoản chat.
9. Bấm thông báo khi app đã vuốt tắt: mở đúng hội thoại.
10. `/admin/crm/csd/chat-accounts` không có trong app.

## 11. Phụ thuộc trước khi nộp store

- Apple Developer Program và Play Console đang hoạt động, đúng pháp nhân PTT.
- Ảnh icon 1024 (iOS) và 512 (Play), tên **PTT**.
- URL chính sách quyền riêng tư.
- Một tài khoản demo không phải SUPER-ADMIN production nếu chính sách nội bộ không cho đưa tài khoản thật cho người duyệt Apple.
- Phía API: đăng nhập chỉ bằng username/mật khẩu chat và phát phiên chat (FR-11). Thuộc pha N1.
- Phía API: đăng ký device token và gửi APNs/FCM khi có tin mới. Chưa có ở bản web hiện tại. Thuộc pha N2.

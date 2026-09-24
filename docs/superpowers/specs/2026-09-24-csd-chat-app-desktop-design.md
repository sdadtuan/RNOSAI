# Spec — CSD Chat App (điện thoại / PWA) và Desktop

**Ngày:** 2026-09-24  
**Trạng thái:** Spec để review  
**Thay thế:** phần “Electron bọc trang chat” trong `docs/design/rnosai-csd-desktop-app-mockup.html`  
**Nguồn chức năng (code đang chạy):**

- UI: `services/ops-web/src/app/crm/csd/chat/page.tsx`, `CsdChatWorkspace`, `CsdChatDock`
- API: `services/ptt-crm-api/src/csd/csd-chat*.controller.ts`
- Quyền: `docs/superpowers/specs/2026-09-16-csd-chat-permission-matrix.md`
- Nhóm: Wave A/B `2026-09-16-csd-chat-group-admin-wave-a-design.md`, `…-wave-b-design.md`
- Dock: `docs/superpowers/specs/2026-09-02-csd-chat-dock-zalo-design.md`

App và Desktop **không thêm nghiệp vụ chat mới**. Cùng API, cùng quyền, cùng tài khoản. Khác nhau ở vỏ: một cửa sổ trên điện thoại, một cửa sổ trên máy tính.

---

## 1. Mục tiêu

1. Nhân viên mở Chat SD mà không phải vào cả CRM (menu Lead, ticket, KPI).
2. Điện thoại: PWA cài từ `https://rs.pttads.vn`, một cột (danh sách → hội thoại → thông tin).
3. Desktop: cửa sổ riêng (Electron), cùng workspace chat, cộng cầu file trên máy.
4. Web CRM giữ nguyên trang `/crm/csd/chat` và dock nổi trên các trang staff.

## 2. Ngoài phạm vi

- Không viết lại `ptt-crm-api`. Không WebSocket. Poll như web hiện tại.
- Không Zalo OA, Messenger, Slack, email khách.
- Không tự đăng ký. Admin cấp tài khoản chat.
- Console admin (`/admin/crm/csd/chat-accounts`: tài khoản, quản lý nhóm toàn hệ thống) **ở lại web CRM**. App và Desktop không có màn này.
- Không gọi nhóm. Gọi thoại / video chỉ hội thoại `kind = direct`.
- Không link mời công khai, không QR, không ghim nhiều tin.
- Không bịa số KPI, ngân sách, hay nội dung tin.

## 3. Ba bề mặt

| | Web CRM (giữ) | App điện thoại / PWA | Desktop |
|--|----------------|----------------------|---------|
| Vào | Menu **Chat nội bộ** `/crm/csd/chat` + dock mọi trang `StaffPageShell` | Icon màn hình chính, mở thẳng chat | Cửa sổ + khay hệ thống, mở thẳng chat |
| Bố cục | 3 cột trên màn rộng; dock là một thread | Một cột. Danh sách, thread, panel thông tin là các màn chồng | 3 cột như web rộng. Không dock, không menu CRM |
| Auth | JWT staff + đăng nhập chat | Cùng hai bước, token lưu trên máy | Cùng hai bước, token trong phiên app |
| File | Mở tab / IndexedDB | Tải hoặc mở bằng app của hệ điều hành | Cache `~/RNOSAI/CSD-Chat/`, mở file, mở thư mục, Lưu thành |
| Thông báo | Toast + Notification API + tiếng | Thông báo hệ điều hành khi PWA được cấp quyền | Khay + badge chưa đọc + tiếng |
| Admin nhóm toàn hệ thống | Có, nếu `csd.admin` | Không | Không |

## 4. Đăng nhập

Giữ đúng web:

1. Đăng nhập staff (email + mật khẩu) → JWT. Cần cap `csd.view`.
2. `GET /api/crm/csd/chat/me`. `enabled !== true` → màn “chưa được cấp chat”, không composer.
3. `POST /api/crm/csd/chat/login` bằng username chat do admin cấp. Nhớ phiên theo `staff_id` (web dùng `readCsdChatLogin`).
4. Gửi tin, tạo hội thoại, sửa nhóm cần thêm `csd.write`. `csd.manage` hoặc `csd.admin` = bypass vai trò nhóm (Chủ/Phó), giống web.

App và Desktop không có form đăng ký, không đổi mật khẩu staff.

## 5. Chức năng dùng chung

Mọi mục dưới đây đã có API hoặc UI web. App và Desktop phải làm được cùng thao tác, cùng mã lỗi, cùng nhãn tiếng Việt.

### 5.1 Danh sách hội thoại

- Tab: Tin nhắn, Danh bạ, Lời mời.
- Lọc: Tất cả, Chưa đọc, Khách, Dự án, Nội bộ. Ô tìm.
- Loại tạo mới (modal web): Khách, Nội bộ nhóm, DM, Dự án.
- Loại hệ thống còn đọc được nếu đã có: `campaign`, `ticket`, `announcement`, `ai_assist`. Không thêm nút tạo cho bốn loại này.
- Badge chưa đọc: `GET /api/crm/csd/chat/unread-count`.
- Đóng, lưu trữ, mở lại. Hội thoại `closed` hoặc `archived` khóa composer.

### 5.2 Tin nhắn

- Gửi chữ. Link trong tin được nhận diện (linkify web).
- Ảnh và file đính kèm.
- Sửa tin của mình trong 15 phút. Xóa tin của mình.
- Cảm xúc: Thích, Yêu, Haha, Wow, Buồn, Giận. Nút gửi nhanh Thích.
- Tìm trong hội thoại.
- Chuyển tiếp (`forward`).
- Tên gợi nhớ (`alias`) trên hội thoại.
- @ thành viên trong nhóm.
- Từ một tin: tạo ticket CSD (`POST …/messages/:id/create-ticket`).
- Ticket liên quan của hội thoại: `GET …/conversations/:id/related-tickets`.

### 5.3 Bạn bè

- Danh bạ: bạn bè, lời mời, khám phá (`/chat/people`, `/chat/friends`).
- Gửi lời mời, chấp nhận, từ chối, chặn, hủy kết bạn.
- DM chỉ sau khi đã là bạn (luật web hiện tại).

### 5.4 Nhóm

Tối đa 100 thành viên khi tạo. Vai trò: Chủ, Phó, thành viên, viewer.

| Thao tác | Ai được |
|----------|---------|
| Sửa tên, mô tả, ảnh nhóm | Chủ, Phó, hoặc platform manage/admin |
| Mời (bạn hoặc danh bạ) | Chủ, Phó, hoặc platform |
| Bật “Cần duyệt khi mời” | Chủ, Phó, hoặc platform |
| Duyệt / từ chối yêu cầu vào nhóm | Chủ, Phó, hoặc platform |
| Bật “Chỉ Chủ/Phó được gửi” | Chủ, Phó, hoặc platform |
| Ghim đúng một tin / bỏ ghim | Chủ, Phó, hoặc platform. Banner trên thread |
| Đặt Phó / gỡ Phó, chuyển Chủ | Chủ, hoặc platform. Phó không chuyển Chủ |
| Xóa thành viên / viewer | Chủ, Phó (không xóa Chủ/Phó), hoặc platform |
| Rời nhóm | Phó, thành viên, viewer. Chủ không rời cho đến khi chuyển Chủ |

Khi khóa gửi: composer khóa và API `403` `members_cannot_send` với member/viewer.

### 5.5 Gọi

- Nút gọi thoại và video chỉ bật khi `kind === direct'` và hội thoại chưa đóng.
- Nhóm, khách, dự án: nút tắt, title “Chỉ hỗ trợ hội thoại DM”.
- Thanh cuộc gọi (đang gọi, đổ chuông, nhận, cúp) giống `CsdChatCallBar`.
- Token: `POST /api/crm/csd/calls/presence-token`, `POST …/conversations/:id/calls/token`.

### 5.6 Kho và panel thông tin

- Panel thông tin: thành viên, ticket liên quan, ảnh, file, link (`CsdChatStorageVault`: media / files / links).
- Tóm tắt AI theo 24 giờ, 7 ngày, hoặc tất cả. Từ action trong tóm tắt tạo ticket. Không bịa nội dung khi API không trả summary.

### 5.7 Nhịp cập nhật

Giữ poll, không thêm socket trong spec này.

- Thông báo đến: 8 giây khi tab hiện, 5 giây khi ẩn (`CsdChatNotifyHost`).
- Có tin mới: tiếng + toast. Bấm toast mở đúng `?c={conversationId}`.
- Danh sách và thread đang mở poll theo chu kỳ dock/workspace hiện có.

## 6. App điện thoại / PWA

### 6.1 Vì sao PWA trước

`CsdChatWorkspace` đã có `isMobile` và `mobilePane` (danh sách / thread / context). PWA dùng lại UI đó, thêm manifest và service worker. App native (store) chỉ làm sau khi PWA đủ dùng.

### 6.2 Màn hình

1. **Đăng nhập staff** rồi **đăng nhập chat** (mục 4).
2. **Danh sách** full màn. Tab dưới hoặc rail: Tin nhắn, Danh bạ, Lời mời. Nút tạo hội thoại.
3. **Thread** full màn. Nút back về danh sách. Header: tên, gọi (DM), tìm, thông tin.
4. **Thông tin / quản lý nhóm** là sheet full màn, có back về thread. Không cột thứ ba cố định.
5. **Cuộc gọi** phủ trên thread. Nhận cuộc gọi khi app đang mở hoặc được hệ điều hành đánh thức (mục 6.4).

Không hiện `OpsNav`, dock CRM, hay link sang Lead / KPI. Link ticket trong panel thông tin mở URL CRM trên trình duyệt (tab mới), không nhét cả CRM vào PWA.

### 6.3 Cài đặt

- `manifest`: tên “Chat SD”, `start_url` `/crm/csd/chat`, `display: standalone`, icon.
- Scope chỉ đường chat và API cùng origin `rs.pttads.vn`.
- Safe area, bàn phím không che composer, danh sách không nhảy khi badge cập nhật.

### 6.4 Thông báo

- Xin quyền Notification sau khi chat đã bật, cùng prompt web.
- Service worker hiện thông báo khi app không focus. Bấm thông báo mở PWA đúng hội thoại.
- Chưa có push server trong spec này: khi app bị hệ điều hành ngủ, tin mới có thể chậm đến lần mở lại. Ghi rõ trên màn cài đặt của app. Không hứa realtime nền.

### 6.5 File trên điện thoại

- Ảnh: xem trong thread.
- File: tải hoặc mở bằng trình xem của máy. Không `shell.openPath`, không “mở thư mục Finder”.
- Không cache bắt buộc vào một thư mục cố định.

## 7. Desktop

### 7.1 Vỏ

- Repo dự kiến: `services/ops-desktop/` (main, preload, renderer).
- Cửa sổ tải `https://rs.pttads.vn/crm/csd/chat` với query `?shell=desktop` để ops-web ẩn menu CRM và dock.
- Thanh tiêu đề app: Chat SD. Không thanh địa chỉ cho người dùng sửa.
- Đóng cửa sổ = thu vào khay. Thoát hẳn từ menu khay.
- Tự cập nhật bản vỏ. Nội dung chat vẫn là web đã deploy.

### 7.2 Cầu file (khác web)

Web hôm nay: bấm file mở tab hoặc bản IndexedDB. Desktop thêm `window.rnosDesktop`:

| Hành vi | Cách làm |
|---------|----------|
| Bấm file đã có trên máy | `openPath` — Word, Excel, PDF bằng app mặc định |
| Ảnh / PDF khi chưa muốn app ngoài | Xem trong khung chat |
| Icon thư mục | `showItemInFolder` |
| Icon lưu | Hộp thoại Lưu thành |
| “Đã có trên máy” | File thật dưới `~/RNOSAI/CSD-Chat/` |
| Web không có bridge | Giữ hành vi web (tab / IndexedDB). Không giả là đã mở Finder |

ops-web chỉ gọi bridge khi `window.rnosDesktop` tồn tại.

### 7.3 Khay và cuộc gọi

- Icon khay hiện số chưa đọc từ cùng API unread-count.
- Thông báo hệ điều hành khi cửa sổ không focus. Bấm vào thì focus đúng hội thoại.
- Gọi DM dùng cùng UI web trong cửa sổ. Chưa thêm cửa sổ cuộc gọi riêng.

### 7.4 Những gì desktop không làm ở pha này

- Không đồng bộ offline toàn bộ lịch sử.
- Không cửa sổ chat nổi thứ hai (dock CRM đã có trên web; app desktop là cửa sổ chat đầy đủ).
- Không màn admin tài khoản.

## 8. Pha

| Pha | Việc | Xong khi |
|-----|------|----------|
| P1 | PWA: manifest, standalone, một cột, đăng nhập 2 bước, đủ mục 5 trên điện thoại | Tạo nhóm, gửi file, ghim, duyệt vào nhóm, gọi DM, tạo ticket từ tin — trên máy thật, cùng Plan/tài khoản đang dùng web |
| P2 | Desktop D1: cửa sổ + khay + `?shell=desktop` ẩn nav | Mở app thấy đúng chat, không menu CRM |
| P3 | Desktop D2: cầu file mục 7.2 | File PDF/Office mở bằng app máy; web không có bridge vẫn mở tab |
| P4 | Thông báo PWA + badge khay desktop | Bấm thông báo vào đúng hội thoại. App ngủ không được ghi là đã nhận realtime |

## 9. Kiểm tra

Dùng tài khoản staff đã có chat bật. Không tạo dữ liệu giả (không bịa tin, ticket, số).

1. User chỉ `csd.view`: xem được, không gửi, không mời.
2. Member khi nhóm khóa gửi: composer khóa; API 403.
3. Chủ ghim một tin: tin ghim cũ bị thay; banner một tin.
4. Dry path bạn bè: lời mời chưa chấp nhận thì không có DM.
5. Nút gọi tắt trên nhóm và hội thoại khách.
6. PWA: back từ thread về danh sách không mất hội thoại đang chọn sau khi vào lại.
7. Desktop không bridge: hành vi file = web. Có bridge: mở được file local.
8. Admin vẫn chỉ quản lý tài khoản trên web CRM.

## 10. Quyết định

| # | Chốt |
|---|------|
| A1 | Một backend. App và Desktop là vỏ. |
| A2 | Điện thoại = PWA trước, không app store trong spec này. |
| A3 | Desktop = Electron bọc trang chat, cộng cầu file. |
| A4 | Admin tài khoản và quản lý nhóm toàn hệ thống ở lại web. |
| A5 | Quyền và luật nhóm = ma trận 2026-09-16. Spec này không nới quyền. |

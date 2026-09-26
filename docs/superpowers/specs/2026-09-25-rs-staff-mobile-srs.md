# SRS — PTT CRM, bản mobile của rs.pttads.vn

**Sản phẩm:** PTT CRM  
**Document ID:** RS-STAFF-MOBILE-001  
**Phiên bản:** 1.2  
**Ngày:** 2026-09-26  
**Trạng thái:** 1.1 đã lên `https://rs.pttads.vn` (commit `2288e456`). 1.2 chờ triển khai.  
**Mockup:** `docs/superpowers/mockups/2026-09-26-rs-lead-phone.html`  
**Ngôn ngữ UI:** Tiếng Việt  
**Prod:** `https://rs.pttads.vn`  
**Đối tượng:** Nhân viên đã có tài khoản CRM (email + mật khẩu nhân viên)

**Changelog 1.2:** Điện thoại có hàng trên (nút Menu và ảnh tài khoản) và thanh dưới có icon. Trang Lead trên điện thoại nhường màn hình cho Kanban hoặc thẻ. Không gắn chấm số giả của mockup.

**Changelog 1.1:** PTT CRM là giao diện điện thoại của site. Không tạo app Capacitor, không nộp App Store, không nộp Google Play.

Bản đưa lên cửa hàng là app chat **PTT** (`vn.pttads.ptt`), spec `docs/superpowers/specs/2026-09-25-csd-chat-native-store-srs.md`. Spec này không sửa spec đó. App **PTT Portal** (`vn.pttads.portal`) giữ nguyên.

Nguồn đã có trên web:

- PWA lead care: `services/ops-web/src/app/manifest.ts`, `short_name` PTT CRM, `start_url` `/crm/leads`
- Chrome điện thoại: `showRsMobileChrome`, `RS_MOBILE_TABS`, `RsMobileTabBar`, class `html.rs-mobile-chrome`
- Danh sách lead dạng thẻ trên màn hẹp, chi tiết lead có tab Việc / Nhật ký / AI, bảng CSKH có kiểm thử mobile
- Chat CRM: `/crm/csd/chat` sau khi đã đăng nhập nhân viên, rồi mật khẩu chat
- Ảnh nhân viên: `GET /api/v1/staff/auth/account/avatar` qua `fetchStaffAvatarBlob` và `useStaffAvatarBlob`

---

## 1. Mục tiêu

Nhân viên mở `https://rs.pttads.vn` trên điện thoại, đăng nhập bằng email và mật khẩu CRM, rồi làm việc hàng ngày: lead, bảng CSKH, chat, ticket. Cùng tài khoản và cùng dữ liệu với bản desktop. Trên điện thoại, hàng trên cho menu và tài khoản, thanh dưới có icon, và trang Lead mở ra thấy Kanban hoặc thẻ. Không có app thứ hai để tải.

## 2. Vấn đề

| Việc hiện tại | Hệ quả |
|---|---|
| Thanh dưới chỉ là chữ | Khó quét bằng mắt |
| Trang Lead trên điện thoại xếp Cột, Excel, Import, Export và bốn ô KPI trước danh sách | Kanban bị đẩy khỏi màn đầu |
| Menu desktop bị ẩn, ảnh nhân viên chỉ nằm trong `OpsNav` | Điện thoại không có lối Tài khoản ngoài chữ Đăng xuất |
| App PTT trên cửa hàng | Chỉ chat, không phải cả site |
| Hàng trăm trang CRM | Không làm mobile hết ở bản này |

## 3. Quyết định khóa

| # | Quyết định |
|---|---|
| M1 | PTT CRM là site trên màn hình hẹp. Không có bundle id. Không có project Capacitor mới. |
| M2 | Không nộp bản này lên App Store hay Google Play. Cửa hàng chỉ dành cho app chat PTT. |
| M3 | Dưới 768px thì dùng chrome điện thoại. Từ 768px trở lên giữ menu desktop, cùng URL. |
| M4 | Không thêm query `shell=mobile`. `shell=native` và `shell=desktop` giữ hành vi chat hiện tại và không hiện thanh CRM hay hàng trên. |
| M5 | Đăng nhập là form nhân viên hiện có. Chat trên site vẫn hỏi mật khẩu chat sau khi đã vào CRM. Form chỉ mật khẩu chat chỉ khi `shell=native`. |
| M6 | Bốn việc trên thanh dưới: Lead, CSKH, Chat, Ticket. Thêm Đăng xuất. |
| M7 | Quyền staff JWT giữ nguyên. Không phát token `scope=chat` cho bản này. |
| M8 | Không bịa lead, ticket, số KPI trong ảnh chụp hay test. |
| M9 | Không thêm đẩy tin lead hay ticket. Manifest PWA giữ `start_url` `/crm/leads`. Không sửa `services/ops-web/src/app/manifest.ts`, `services/ptt-app/`, `services/mobile-shell/`. |
| M10 | Không banner cài app. Không đổi màu site sang tím. Giữ xanh `#17692f`. |
| M11 | Không hiện chấm số nếu không có số thật. Mockup có chấm `1` chỉ để xem bố cục. Bản 1.2 không gắn số đó, không trên Chat và không trên nút Menu. |
| M12 | Desktop từ 768px không đổi toolbar Lead, dải KPI, nút Excel, menu `OpsNav`. |

## 4. Người dùng

| Vai | Làm trên điện thoại |
|---|---|
| Nhân viên có quyền xem lead | Xem danh sách và chi tiết lead của mình |
| Nhân viên có quyền ghi lead | Ghi chú, đổi trạng thái đúng như web |
| Nhân viên CSD có quyền xem | Xem bảng CSKH, ticket, vào chat |
| Nhân viên chưa được cấp chat | Vào CRM được. Màn chat báo tài khoản chat chưa được cấp, đúng câu trên web |
| Người chỉ có mật khẩu chat | Dùng app PTT trên cửa hàng, không dùng bản này để bỏ qua đăng nhập CRM |

## 5. Ngoài phạm vi

- App Store, Google Play, TestFlight, Play Console cho PTT CRM.
- Meta, SEO, Email studio, KPI hub, lương, admin, kế hoạch AI.
- Portal khách duyệt creative.
- Gộp site nhân viên vào app chat PTT.
- WebSocket và ghi dữ liệu khi mất mạng.
- Sửa `POST /api/crm/csd/chat/login` và `POST /api/crm/csd/chat/session`.
- Chấm số chat chưa đọc và chấm trên nút Menu.
- Làm lại CSKH, chi tiết lead, ticket, chat theo mật độ trang Lead.
- Đổi stage Kanban, thêm giao dịch nhanh, hay số tiền trên cột.
- Sửa API, quyền, hoặc logic `loadLeads`.

## 6. Yêu cầu chức năng

### 6.1 Mở site

Đã có từ 1.1. Bản 1.2 giữ nguyên.

| ID | Yêu cầu |
|---|---|
| FR-01 | Nhân viên vào `https://rs.pttads.vn` bằng Safari hoặc Chrome. Không cần cài app từ cửa hàng. |
| FR-02 | Chưa đăng nhập thì vào `/login`. Form là email và mật khẩu nhân viên. |
| FR-03 | Sau đăng nhập, vào đúng trang `next` nếu có, không thì `/crm/leads`. |
| FR-04 | Cùng URL trên màn rộng vẫn là site desktop. |

### 6.2 Thanh dưới

`showRsMobileChrome({ width, search })` bật khi `width` dưới 768 và `shell` không phải `native` hay `desktop`. `StaffPageShell` gắn class `rs-mobile-chrome` lên `documentElement` và chỉ mount thanh khi cờ đó đúng.

| ID | Yêu cầu |
|---|---|
| FR-10 | Dưới 768px: ẩn `OpsNav`, toast SLA, chuông B2B nóng, dock chat. Thanh dưới có Lead, CSKH, Chat, Ticket, Đăng xuất. |
| FR-11 | Bốn mục việc trỏ `/crm/leads`, `/crm/cskh-board`, `/crm/csd/chat`, `/crm/csd/tickets`. Chi tiết lead và chi tiết ticket vẫn chọn đúng mục cha. |
| FR-12 | Đăng xuất trên thanh dưới gọi đúng `onLogout` của shell nhân viên. |
| FR-13 | Vùng an toàn đáy máy không che nút gửi chat, nút lưu lead, tấm lọc, hay menu tài khoản. `main` có `padding-bottom` bằng chiều cao thanh cộng `safe-area-inset-bottom`. |
| FR-14 | `shell=native` và `shell=desktop` không hiện thanh dưới và không hiện hàng trên. `shell=pwa` trên điện thoại vẫn hiện cả hai. |
| FR-15 | Mỗi mục thanh dưới có icon phía trên nhãn. Mục trùng đường dẫn hiện tại có `aria-current="page"`, chữ và icon màu `#17692f`, gạch xanh 3px ở mép trên của mục đó. |
| FR-16 | Icon là SVG trong component, `currentColor`, không tải font icon. Lead là nhóm người. CSKH là tai nghe. Chat là bong bóng. Ticket là phiếu. Đăng xuất là mũi tên rời khung. |
| FR-17 | Không có phần tử chấm số trên Chat hay trên nút Menu. |

### 6.3 Hàng trên

Hiện khi `html.rs-mobile-chrome` và `chrome` của shell là `crm`. Cố định trên cùng, phía trên nội dung trang. `main` chừa `padding-top` cho hàng này.

| ID | Yêu cầu |
|---|---|
| FR-18 | Trái là nút **Menu**, `aria-label="Menu"`, `aria-expanded`. Ba gạch ngang. Bấm mở ngăn trái. Bấm lần nữa, bấm ra ngoài, hoặc phím Escape thì đóng. |
| FR-19 | Ngăn trái liệt kê đúng `RS_MOBILE_TABS`, cùng `href` và cùng icon. Mục `rsMobileTabId` đang khớp được đánh dấu. Không thêm mục desktop khác. |
| FR-20 | Phải là nút tròn, `aria-label="Tài khoản"`. Token lấy bằng `getAccessToken()`. Có `user.has_avatar` thì ảnh từ `useStaffAvatarBlob(token, true, user.avatar_updated_at)`. Không có ảnh hoặc lỗi tải thì hiện chữ cái: hai từ trở lên lấy chữ đầu từ đầu và từ cuối của `display_name`, một từ lấy hai ký tự đầu, không có tên thì lấy từ email. |
| FR-21 | Bấm ảnh mở menu: dòng `display_name`, dòng email, mục **Tài khoản** tới `/account`, mục **Đăng xuất** gọi cùng `onLogout`. Đóng như FR-18. |
| FR-22 | Hàng trên không hiện khi `chrome="chat"`. |

### 6.4 Trang Lead trên điện thoại

Chỉ khi `html.rs-mobile-chrome` và trang là `/crm/leads`. Desktop không nhận các class ẩn này.

| ID | Yêu cầu |
|---|---|
| FR-23 | Hàng tiêu đề là một dòng: tiêu đề trang (`leadsListTitle`), nút **+** nếu `canCreate`, **Lọc**, **Thêm**. Dòng phụ “N leads…” một dòng, cắt bằng ellipsis. |
| FR-24 | **+** có `aria-label="Tạo lead"` và trỏ cùng `leadsNewHref(flowScope)` của nút “+ Tạo lead”. |
| FR-25 | **Thêm** mở menu: Cột (`LeadsColumnPicker`), Mẫu Excel, Import wizard, Import nhanh, Export Excel (filter), Export đã chọn. Thiếu `canImport` thì không có Import wizard và Import nhanh. Export đã chọn disabled khi `selectedIds.length === 0`. Handler giữ nguyên `CrmLeadsImportExport`. Wizard và input file ẩn vẫn được mount. |
| FR-26 | **Lọc** mở tấm `role="dialog"` phía trên thanh dưới, `z-index` cao hơn `.rs-mobile-tabbar`. Trong tấm: ô tìm, Tất cả / Của tôi / Chưa phân, loại lead khi trang đang có control đó, trạng thái, nguồn, kênh, nút áp dụng. Áp dụng gọi cùng setter và `onSearch` đang dùng, rồi đóng tấm. Không thêm query param mới. |
| FR-27 | `WinFilterChips` ở lại trên danh sách, phía trên Kanban. Gỡ chip và “Xóa tất cả” gọi đúng `clearLeadsFilterField` / `clearAllLeadsFilters`. |
| FR-28 | `data-testid="lead-signal-kpis"` không chiếm chỗ. Cách tính `signalKpis` không đổi. Desktop vẫn hiện dải này. |
| FR-29 | Kanban giữ cuộn ngang. `.crm-kanban` đã `overflow-x: auto` và cột `flex: 0 0 260px` dưới 960px. Bản này không thêm cột stage và không bóp cột bằng chiều màn. |
| FR-30 | Rộng 390px, danh sách là thẻ, không bảng tràn cả trang. |
| FR-31 | Kéo để tải lại danh sách vẫn gọi `loadLeads`. Kanban vẫn tắt kéo tải lại như hiện tại (`PullToRefresh` disabled khi `viewMode === 'kanban'`). |

### 6.5 Việc khác

Giữ hành vi 1.1. Bản 1.2 không đổi bố cục các trang này, ngoài việc chúng dùng chung hàng trên và thanh dưới khi đủ điều kiện chrome.

| ID | Yêu cầu |
|---|---|
| FR-32 | `/crm/leads/[id]` trên điện thoại giữ tab **Việc** và **Nhật ký**. Tab **AI** chỉ khi copilot đang bật. |
| FR-33 | `/crm/cskh-board` đọc được trên 390px. Không thêm số KPI mới. |
| FR-34 | `/crm/csd/chat` trên trình duyệt là chat CRM: đăng nhập nhân viên trước, mật khẩu chat sau. Form chỉ mật khẩu chat chỉ khi `shell=native`. |
| FR-35 | `/crm/csd/tickets` mở được danh sách và một ticket. Nhãn thẻ ticket (`data-label`) giữ như 1.1. |
| FR-36 | Gọi thoại và video trong chat vẫn chỉ hội thoại riêng, đúng web. |

### 6.6 Phiên

| ID | Yêu cầu |
|---|---|
| FR-37 | Sai email hoặc sai mật khẩu dùng đúng thông báo form `/login` hiện tại. |
| FR-38 | Hết hạn access token thì refresh như web. Không lưu mật khẩu trong URL. |
| FR-39 | Đăng xuất xóa session và về `/login`. Nút trên thanh dưới và mục trong menu ảnh cùng một `onLogout`. |

## 7. Kiểm thử

Dùng một nhân viên thật. Không tạo lead giả để chụp ảnh. Không bấm export nếu không cần file.

1. Rộng 390px sau đăng nhập: hàng trên có Menu và ảnh hoặc chữ cái. Thanh dưới có năm mục có icon. Không có `.ops-sidebar`. Không có chấm số.
2. Menu mở ra bốn mục cùng href. Ảnh mở ra tên, email, Tài khoản, Đăng xuất. Tài khoản có ảnh thì ảnh trong menu cùng blob với nút tròn.
3. `/crm/leads` 390px: không thấy “Mẫu Excel” trên mặt trang. Thêm thì thấy. Lọc thì thấy ô tìm. Dải KPI không hiện. Kanban hoặc thẻ nằm dưới hàng Kanban/Danh sách.
4. Đặt `q` có lead thật, áp dụng, mở một lead, back. `q` còn trên URL.
5. Rộng 1280px: có `.ops-sidebar`, không hàng trên điện thoại, không thanh dưới, vẫn thấy nút Excel và dải KPI.
6. `/crm/csd/chat?shell=native` 390px: không thanh dưới, không hàng trên, vẫn form chỉ mật khẩu chat.
7. `cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/rs-mobile-shell.spec.ts` pass.

## 8. Màn hình điện thoại sau 1.2

```
[≡]                                    (ảnh)
Quản lý Lead                    [+] [Lọc] [Thêm]
N leads · trang 1 / …
[Kanban] [Danh sách]
[chip lọc nếu đang bật]
-------- Kanban cuộn ngang hoặc thẻ lead --------
Lead   CSKH   Chat   Ticket   Đăng xuất
```

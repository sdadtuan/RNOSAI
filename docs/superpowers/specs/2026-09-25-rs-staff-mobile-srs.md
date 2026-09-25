# SRS — PTT CRM, bản mobile của rs.pttads.vn

**Sản phẩm:** PTT CRM  
**Document ID:** RS-STAFF-MOBILE-001  
**Phiên bản:** 1.1  
**Ngày:** 2026-09-25  
**Trạng thái:** Chờ duyệt trước khi xây  
**Ngôn ngữ UI:** Tiếng Việt  
**Prod:** `https://rs.pttads.vn`  
**Đối tượng:** Nhân viên đã có tài khoản CRM (email + mật khẩu nhân viên)

**Changelog 1.1:** PTT CRM là giao diện điện thoại của site. Không tạo app Capacitor, không nộp App Store, không nộp Google Play.

Bản đưa lên cửa hàng là app chat **PTT** (`vn.pttads.ptt`), spec `docs/superpowers/specs/2026-09-25-csd-chat-native-store-srs.md`. Spec này không sửa spec đó. App **PTT Portal** (`vn.pttads.portal`) giữ nguyên.

Nguồn đã có trên web:

- PWA lead care: `services/ops-web/src/app/manifest.ts`, `short_name` PTT CRM, `start_url` `/crm/leads`
- Danh sách lead dạng thẻ trên màn hẹp, chi tiết lead có tab, bảng CSKH có kiểm thử mobile
- Chat CRM: `/crm/csd/chat` sau khi đã đăng nhập nhân viên, rồi mật khẩu chat

---

## 1. Mục tiêu

Nhân viên mở `https://rs.pttads.vn` trên điện thoại, đăng nhập bằng email và mật khẩu CRM, rồi làm việc hàng ngày: lead, bảng CSKH, chat, ticket. Cùng tài khoản và cùng dữ liệu với bản desktop. Không có app thứ hai để tải.

## 2. Vấn đề

| Việc hiện tại | Hệ quả |
|---|---|
| Màn hẹp vẫn hiện menu desktop | Lead, chat và ticket bị menu che |
| App PTT trên cửa hàng | Chỉ chat, không phải cả site |
| Hàng trăm trang CRM | Không làm mobile hết ở bản 1 |

## 3. Quyết định khóa

| # | Quyết định |
|---|---|
| M1 | PTT CRM là site trên màn hình hẹp. Không có bundle id. Không có project Capacitor mới. |
| M2 | Không nộp bản này lên App Store hay Google Play. Cửa hàng chỉ dành cho app chat PTT. |
| M3 | Dưới 768px thì dùng chrome điện thoại. Từ 768px trở lên giữ menu desktop, cùng URL. |
| M4 | Không thêm query `shell=mobile`. `shell=native` và `shell=desktop` giữ hành vi chat hiện tại và không hiện thanh CRM. |
| M5 | Đăng nhập là form nhân viên hiện có. Chat trên site vẫn hỏi mật khẩu chat sau khi đã vào CRM. |
| M6 | Bản 1 chỉ bốn việc trên thanh dưới: Lead, CSKH, Chat, Ticket. |
| M7 | Quyền staff JWT giữ nguyên. Không phát token `scope=chat` cho bản này. |
| M8 | Không bịa lead, ticket, số KPI trong ảnh chụp hay test. |
| M9 | Không thêm đẩy tin lead hay ticket. Manifest PWA giữ `start_url` `/crm/leads`. |

## 4. Người dùng

| Vai | Làm trên điện thoại |
|---|---|
| Nhân viên có quyền xem lead | Xem danh sách và chi tiết lead của mình |
| Nhân viên có quyền ghi lead | Ghi chú, đổi trạng thái đúng như web |
| Nhân viên CSD có quyền xem | Xem bảng CSKH, ticket, vào chat |
| Nhân viên chưa được cấp chat | Vào CRM được. Màn chat báo tài khoản chat chưa được cấp, đúng câu trên web |
| Người chỉ có mật khẩu chat | Dùng app PTT trên cửa hàng, không dùng bản này để bỏ qua đăng nhập CRM |

## 5. Ngoài phạm vi bản 1

- App Store, Google Play, TestFlight, Play Console cho PTT CRM.
- Meta, SEO, Email studio, KPI hub, lương, admin, kế hoạch AI.
- Portal khách duyệt creative.
- Gộp site nhân viên vào app chat PTT.
- WebSocket và ghi dữ liệu khi mất mạng.
- Sửa `POST /api/crm/csd/chat/login` và `POST /api/crm/csd/chat/session`.

## 6. Yêu cầu chức năng

### 6.1 Mở site

| ID | Yêu cầu |
|---|---|
| FR-01 | Nhân viên vào `https://rs.pttads.vn` bằng Safari hoặc Chrome. Không cần cài app từ cửa hàng. |
| FR-02 | Chưa đăng nhập thì vào `/login`. Form là email và mật khẩu nhân viên. |
| FR-03 | Sau đăng nhập, vào đúng trang `next` nếu có, không thì `/crm/leads`. |
| FR-04 | Cùng URL trên màn rộng vẫn là site desktop. |

### 6.2 Chrome điện thoại

| ID | Yêu cầu |
|---|---|
| FR-10 | Dưới 768px: ẩn menu desktop. Thanh dưới có Lead, CSKH, Chat, Ticket. |
| FR-11 | Mỗi mục trỏ `/crm/leads`, `/crm/cskh-board`, `/crm/csd/chat`, `/crm/csd/tickets`. |
| FR-12 | Đăng xuất dùng nút đăng xuất sẵn có của shell nhân viên. |
| FR-13 | Vùng an toàn đáy máy không che nút gửi chat hay nút lưu lead. |
| FR-14 | `shell=native` và `shell=desktop` không hiện thanh bốn mục. |

### 6.3 Việc hàng ngày

| ID | Yêu cầu |
|---|---|
| FR-20 | `/crm/leads` trên rộng 390px hiện thẻ, không bảng tràn ngang. Kéo để tải lại danh sách vẫn hoạt động. |
| FR-21 | `/crm/leads/[id]` dùng tab Chi tiết, Hoạt động, AI đã có. Một tab một lúc. |
| FR-22 | `/crm/cskh-board` đọc được trên 390px. Không thêm số KPI mới. |
| FR-23 | `/crm/csd/chat` trên trình duyệt là chat CRM: đăng nhập nhân viên trước, mật khẩu chat sau. Form chỉ mật khẩu chat chỉ khi `shell=native`. |
| FR-24 | `/crm/csd/tickets` mở được danh sách và một ticket. Bảng tràn thì cuộn trong khối đó, không vỡ cả trang. |
| FR-25 | Gọi thoại và video trong chat vẫn chỉ hội thoại riêng, đúng web. |

### 6.4 Phiên

| ID | Yêu cầu |
|---|---|
| FR-30 | Sai email hoặc sai mật khẩu dùng đúng thông báo form `/login` hiện tại. |
| FR-31 | Hết hạn access token thì refresh như web. Không lưu mật khẩu trong URL. |
| FR-32 | Đăng xuất xóa session và về `/login`. |

## 7. Kiểm thử bản 1

Dùng một nhân viên thật. Không tạo lead giả để chụp ảnh.

1. Điện thoại mở `https://rs.pttads.vn/login` thấy email, không thấy ô “Tên đăng nhập chat”.
2. Sau đăng nhập, rộng 390px có thanh bốn mục và không có menu desktop.
3. Rộng từ 768px, cùng trang có menu desktop và không có thanh bốn mục.
4. Lead, CSKH, Chat, Ticket mở được và không bị đẩy về `/login` khi còn phiên.
5. Chat trên trình duyệt hỏi mật khẩu chat. App PTT (`shell=native`) vẫn không hỏi email.
6. Không có gói `vn.pttads.crm` trong repo.

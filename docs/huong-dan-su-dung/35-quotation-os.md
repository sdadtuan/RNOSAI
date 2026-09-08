# Quotation OS — Hướng dẫn sử dụng

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-09-09  
> **Đối tượng:** AM, Sales, Finance, GDKD, Admin  
> **URL:** https://rs.pttads.vn/crm/proposals  
> **Menu:** Bán hàng → **Báo giá**  
> **Quyền tối thiểu:** `crm_quote.view` / `crm_quote.view_all` (hoặc tương thích `crm_board.view`)

Quotation OS quản lý vòng đời **tạo báo giá → soạn dòng / phương án → phê duyệt → gửi khách → OTP xác nhận → convert**. Module nằm **trong CRM** (`/crm/proposals*`), không phải app tách.

**Tài liệu liên quan**

| Chủ đề | File |
|--------|------|
| CRM Core | [02-crm-core.md](./02-crm-core.md) |
| SOP chốt deal | [16-sales-solution-chot-deal-sop.md](./16-sales-solution-chot-deal-sop.md) |
| Sales Cockpit | [26-sales-cockpit-huong-dan-day-du.md](./26-sales-cockpit-huong-dan-day-du.md) |

---

## Mục lục

1. [Mở module và 7 mục sidebar](#1-mở-module-và-7-mục-sidebar)
2. [Tổng quan](#2-tổng-quan)
3. [Báo giá (danh sách)](#3-báo-giá-danh-sách)
4. [Tạo báo giá](#4-tạo-báo-giá)
5. [Service Catalog](#5-service-catalog)
6. [Phê duyệt — GM dưới 25%](#6-phê-duyệt--gm-dưới-25)
7. [Báo cáo](#7-báo-cáo)
8. [Cấu hình — OTP và chia sẻ](#8-cấu-hình--otp-và-chia-sẻ)
9. [Khách xác nhận: **Xác nhận đề xuất** + OTP](#9-khách-xác-nhận-xác-nhận-đề-xuất--otp)
10. [Ô trống hiện `—`](#10-ô-trống-hiện--)
11. [Sự cố thường gặp](#11-sự-cố-thường-gặp)

---

## 1. Mở module và 7 mục sidebar

1. Đăng nhập https://rs.pttads.vn/login
2. Sidebar **Bán hàng** → **Báo giá**
3. Hoặc mở trực tiếp `/crm/proposals`

Không thấy menu → liên hệ Admin cấp `crm_quote.view` (hoặc `view_all`), rồi **đăng xuất / đăng nhập lại**. Menu ẩn vì thiếu quyền — **không phải lỗi hệ thống**. Không tự GRANT quyền bằng SQL.

Bên trong module có **đúng 7 mục** (sidebar trái). Không có mục Studio trên nav.

| # | Mục | Route |
|---|-----|-------|
| 1 | Tổng quan | `/crm/proposals` |
| 2 | Báo giá | `/crm/proposals/list` |
| 3 | Tạo báo giá | `/crm/proposals/new` |
| 4 | Service Catalog | `/crm/proposals/catalog` |
| 5 | Phê duyệt | `/crm/proposals/approvals` |
| 6 | Báo cáo | `/crm/proposals/reports` |
| 7 | Cấu hình | `/crm/proposals/settings` |

Phạm vi danh sách: **Của tôi** / **Team** / **Toàn bộ**. Mặc định **Của tôi**. Không thấy quote vừa tạo → đổi phạm vi rồi tìm lại.

---

## 2. Tổng quan

Bốn thẻ KPI:

| Thẻ | Ý nghĩa |
|-----|---------|
| Giá trị quote đang mở | Tổng payable các quote draft…negotiation |
| Chờ phê duyệt | Số version đang submitted |
| Tỷ lệ chốt | Công thức win rate nội bộ |
| GM dự kiến | Chỉ hiện nếu có `crm_quote.finance`; thiếu quyền → `—` hoặc ẩn |

Alert / Action Center: `/crm/proposals?panel=actions`.  
Nhật ký hoạt động: `/crm/proposals/activity` — **không** hiện OTP hay token thô.

---

## 3. Báo giá (danh sách)

Chip: **Tất cả** · **Của tôi** · **Chờ tôi phê duyệt** · **Sắp hết hạn** · **Đã gửi chưa phản hồi**.

Cột: mã `QT-PTT-…` · version · khách / lead · phương án · tổng · phí DV · GM (finance) · status · hiệu lực · owner.

Từ chối quote bắt buộc chọn **lý do mất deal** (`lost_reason`): ngân sách, đối thủ, đổi ưu tiên, scope/timeline, khác. Không xóa hàng `crm_proposals` trên database.

---

## 4. Tạo báo giá

Ba nguồn:

| Nguồn | Khi nào |
|-------|---------|
| Từ Lead / Deal Room | Khuyến nghị. Deep-link `?lead_id=` từ Consult. |
| Từ AM 360 | Chọn khách đang active. |
| Trống | Phải chọn khách trước khi lưu. Không invent client. |

Sau khi tạo: mã `QT-PTT-{năm}-{số 6 chữ số}`, status **Nháp**, version làm việc v1. Soạn dòng từ catalog (phí / media / VAT). CTA khách luôn là **Xác nhận đề xuất** — không dùng wording “ký hợp đồng”.

Soạn thảo AI **không** điền copy vào đề xuất. Nhân viên tự viết mục tiêu, phạm vi, điều khoản.

---

## 5. Service Catalog

Duyệt nhóm dịch vụ, gói, rate card. Import CSV/JSON tạo revision + rate card — **không** sửa snapshot quote đã xuất bản.

Thiếu rate hoặc catalog inactive → không soạn được dòng đó. Liên hệ người quản trị catalog, không bypass bằng dòng ảo.

---

## 6. Phê duyệt — GM dưới 25%

Inbox: **Chờ tôi** · **Đã xử lý** · **SLA vỡ**.

Khi **GM < 25%** (dưới floor mặc định), hệ thống route **Finance + GDKD**. Không xuất bản / gửi khách trước khi các bước bắt buộc đã duyệt.

Policy mặc định (Cấu hình → Guardrail):

| Điều kiện | Approver |
|-----------|----------|
| Discount ≤ 5% và GM ≥ 25% | Auto / Sales Manager |
| Discount 5–10% | AM Lead / AD |
| Discount > 10% | AD + Finance |
| **GM < 25%** | **Finance + GDKD** |
| Tổng > 200.000.000 ₫ | GDKD |
| Payment term > 60 ngày | Finance |

Return / reject bắt buộc ghi chú. Reject từ list cũng cần `lost_reason`.

---

## 7. Báo cáo

Tab: **Điều hành** · **Funnel** · **Margin** · **Lý do thua** · **Tương tác**.  
Tab Margin cần `crm_quote.finance`. Thiếu số liệu → `—`.

---

## 8. Cấu hình — OTP và chia sẻ

Tab **Chia sẻ**: hạn link, cho phép tải PDF, **OTP email khi xác nhận**, ghi first/last view.

Luồng khách:

1. Staff xuất bản version đã duyệt (điều khoản + xác nhận phải bật).
2. Gửi link / email kèm token.
3. Khách mở trang đề xuất trên portal.
4. Bấm **Xác nhận đề xuất** → nhập họ tên, email nhận OTP, tick điều khoản, nhập OTP.
5. Status → **Đã xác nhận**, version khóa. Sau đó mới convert sang lifecycle.

OTP gửi qua email. Không đọc OTP từ nhật ký hoạt động (hệ thống không lưu OTP thô). Link hết hạn / thu hồi → khách không xem được nội dung; liên hệ AM gửi lại.

---

## 9. Khách xác nhận: **Xác nhận đề xuất** + OTP

Trang khách: mục tiêu · phạm vi · KPI có nhãn · đầu tư (phí / media / VAT) · thanh toán · nút **Xác nhận đề xuất** và **Yêu cầu điều chỉnh**.

Đây **không** phải chữ ký số pháp lý. Wording bắt buộc: **Xác nhận đề xuất**.

Convert chỉ khi status `accepted`. Convert lặp lại cùng key là idempotent — không nhân bản lifecycle.

---

## 10. Ô trống hiện `—`

Khi chưa có số liệu thật, KPI / cột / ô trống hiện **`—`**. Đây là trạng thái đúng, không phải lỗi. Hệ thống **không điền số mẫu**.

---

## 11. Sự cố thường gặp

| Hiện tượng | Cách xử lý |
|------------|------------|
| Không thấy menu Báo giá | Thiếu cap. Xin Admin cấp quyền, đăng nhập lại. Không GRANT SQL. |
| GM / Margin hiện `—` | Thiếu `crm_quote.finance` hoặc chưa có số. Không phải lỗi. |
| Không gửi được khách | Version chưa duyệt đủ bước (kể cả Finance + GDKD khi GM < 25%). |
| Khách không nhận OTP | Kiểm tra email, hạn link, tab Chia sẻ (OTP đang bật). Không đọc OTP từ log. |
| Không xóa được đề xuất cũ | Đúng: không xóa `crm_proposals`. Dùng từ chối + lý do, hoặc lưu trữ. |
| Nút / API tạo AI draft lỗi | Soạn thảo AI không dùng cho báo giá. Viết tay các mục đề xuất. |

Quotation OS **không** thay Deal Room, Video SOP hay Creative Production. Timeline sản xuất video không nằm trong QT.

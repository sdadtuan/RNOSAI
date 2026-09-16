# Ma trận phân quyền RNOSAI — Bàn giao khách hàng

**Phiên bản:** 1.0 · **Ngày:** 2026-09-16  
**Hệ thống:** RNOSAI (ops-web nội bộ + portal-web khách hàng)  
**Mục đích:** Tài liệu bàn giao cho khách hàng thực tế — gán quyền theo vai trò vận hành  
**Đối tượng:** Ban lãnh đạo, PO, Admin hệ thống, AM, đội sản xuất nội dung & media

---

## 0. Cách đọc bảng

| Ký hiệu | Nghĩa |
|---------|--------|
| **✓** | Được thao tác (xem + tạo/sửa/gửi theo phạm vi vai trò) |
| **◐** | Chỉ xem / theo dõi |
| **✦** | Có quyền duyệt / phê duyệt |
| **—** | Không truy cập (menu ẩn hoặc API từ chối) |
| **※** | Chỉ trong phạm vi khách hàng / dự án được gán |

**Hai lớp người dùng**

| Lớp | App | Đăng nhập | Phân quyền |
|-----|-----|-----------|------------|
| **Nội bộ (Staff)** | ops-web | Tài khoản nhân viên | Chức vụ CRM + job function + permission set |
| **Khách hàng (Portal)** | portal-web | Tài khoản portal theo `client_id` | `viewer` hoặc `approver` — **không** dùng ma trận staff |

---

## 1. Vai trò bàn giao ↔ mã chức vụ đề xuất

| # | Vai trò bàn giao (khách) | Mã chức vụ đề xuất | Job function gợi ý | Ghi chú |
|---|--------------------------|--------------------|--------------------|---------|
| 1 | **Quản trị hệ thống** | `SUPER-ADMIN` | — | Toàn quyền ops-web + Admin |
| 2 | **CEO** | `CEO` | `leader` | Tower điều hành, dashboard, bypass nhóm chat (`csd.manage`/`admin`) |
| 3 | **Account Executive** | `AE` | `sales` | Đầu phễu B2B, hỗ trợ AM |
| 4 | **Account Manager** | `KD-01` hoặc `ACM` | `sales` (+ `leader` nếu trưởng nhóm) | Chủ sở hữu khách / dự án agency |
| 5 | **Content Editor** | `MKT-02` (hoặc chức vụ Content riêng) | `content` | SEO/Email/Content OS — viết & xuất bản theo quy trình |
| 6 | **Media Creator** | `MKT-02` / Delivery | `content` (+ production) | Media OS, Video, bằng chứng chạy ads |
| 7 | **Graphic Designer** | `MKT-02` / Creative | `design` | Creative OS, ảnh, creatives Meta |
| 8 | **Marketing Leader** | `MKT-01` | `leader` | Solution / Hub MKT / duyệt nội dung |
| 9 | **Planning Director** | `PD` | `leader` | Kế hoạch, research, giám sát PM/delivery |
| 10 | **Portal Client** | *Không phải chức vụ staff* | — | Portal `viewer` / `approver` theo từng khách |

> **Lưu ý triển khai:** Một số mã (`CEO`, `AE`, `ACM`, `PD`) có trong seed CSD / staging. Trên DB khách hàng cần **tạo chức vụ + gán cap** trước go-live. Có thể map tên hiển thị tiếng Việt tùy org chart khách mà giữ nguyên mã kỹ thuật.

**Viết tắt cột bảng dưới:** QT · CEO · AE · AM · CE · MC · DS · ML · PD · PC

---

## 2. Tổng quan module × vai trò

### 2.1. Bán hàng & CRM

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Tổng quan CRM | `/crm` | ✓ | ✓ | ✓ | ✓ | ◐ | — | — | ✓ | ✓ | — |
| Lead B2B / Inbox | `/crm/b2b/leads`, `/crm/b2b-inbox` | ✓ | ◐ | ✓ | ✓ | — | — | — | ◐ | ◐ | — |
| Phễu / Kanban CSKH | `/crm/operational/leads`, `/crm/cskh-board` | ✓ | ◐ | ◐ | ✓ | — | — | — | — | — | — |
| Solution queue | `/crm/solution/queue` | ✓ | ◐ | ◐ | ◐ | — | — | — | ✓ | ✓ | — |
| Intake / dự án B2B | `/crm/intake`, `/crm/b2b-projects` | ✓ | ◐ | ✓ | ✓ | — | — | — | ◐ | ✓ | — |
| Delivery projects | `/crm/delivery-projects` | ✓ | ◐ | ◐ | ✓ | — | — | — | ◐ | ✓ | — |
| Báo giá / Proposal | `/crm/proposals` | ✓ | ◐ | ✓ | ✓ | — | — | — | ◐ | ◐ | ※✦ |
| Catalog / dịch vụ | `/crm/catalog`, `/crm/sales/services` | ✓ | ◐ | ✓ | ✓ | — | — | — | ✓ | ✓ | — |
| Khách hàng CRM | `/crm/customers` | ✓ | ◐ | ✓ | ✓ | — | — | — | — | — | — |
| Ticket CS (legacy board) | `/crm/tickets` | ✓ | ◐ | ◐ | ✓ | — | — | — | — | — | — |

### 2.2. Service Desk & Chat nội bộ (CSD)

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Dashboard CSD | `/crm/csd` | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | — |
| Ticket agency | `/crm/csd/tickets` | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | — | ✓ | ✓ | — |
| Chat nội bộ (DM/nhóm) | `/crm/csd/chat` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Quản lý nhóm (Chủ/Phó trong chat) | Panel nhóm | ✓ | ✓ | ※ | ※ | ※ | ※ | ※ | ※ | ※ | — |
| Admin tài khoản Chat | `/admin/crm/csd/chat-accounts` | ✓ | ✓ | — | — | — | — | — | — | — | — |
| Email CSD / báo cáo | `/crm/csd/email`, `/crm/csd/reports` | ✓ | ✓ | ◐ | ✓ | — | — | — | ✓ | ✓ | — |

※ Trong nhóm chat: chỉ **Chủ** đặt Phó/Chuyển chủ/Xóa; **Phó** mời & chỉnh thông tin; **TV** có thể rời nhóm. Chi tiết: `docs/exports/ma-tran-phan-quyen-csd-chat-2026-09-16.md`.

### 2.3. Account Management & Agency

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Account Management | `/crm/account-management` | ✓ | ✓ | ◐ | ✓ | — | — | — | ◐ | ✓ | — |
| Agency hub / clients | `/agency`, `/agency/clients` | ✓ | ✓ | ✓ | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | — |
| Cấp tài khoản Portal | Agency client → tab Portal | ✓ | — | — | ✓ | — | — | — | — | — | — |
| Thông báo agency | `/agency/notifications` | ✓ | ◐ | ✓ | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | — |

### 2.4. Quảng cáo (Meta / Google / Zalo)

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Meta Ads / Ops | `/meta/*` | ✓ | ◐ | ◐ | ✓ | — | ✓ | ✓ | ✓ | ◐ | ※◐ |
| Google Ads | `/google/google-ads` | ✓ | ◐ | ◐ | ✓ | — | ◐ | — | ✓ | ◐ | ※◐ |
| Zalo Ads / Leads | `/zalo/*` | ✓ | ◐ | ◐ | ✓ | — | ◐ | — | ✓ | ◐ | ※◐ |
| Campaign write / governance | Meta campaign write | ✓ | — | — | ✓ | — | ✓ | ✓ | ✓ | ◐ | — |

### 2.5. SEO / AEO

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| SEO Hub | `/seo/hub` | ✓ | ◐ | ◐ | ✓ | ✓ | — | — | ✓ | ✓ | ※◐ |
| Nghiên cứu / Content | `/seo/research`, `/seo/content` | ✓ | — | — | ◐ | ✓ | — | — | ✓✦ | ✓ | ※◐✦ |
| Technical / ranks | `/seo/technical`, `/seo/ranks` | ✓ | — | — | ◐ | ◐ | — | — | ✓ | ✓ | ※◐ |
| Báo cáo SEO | `/seo/reports` | ✓ | ◐ | — | ✓ | ◐ | — | — | ✓ | ✓ | ※◐ |
| Governance / Gate-A | `/seo/governance`, `/seo/gate-a` | ✓ | — | — | — | — | — | — | ✓ | ✓ | — |

### 2.6. Email Marketing

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Email Hub | `/email/hub` | ✓ | ◐ | — | ✓ | ✓ | — | — | ✓ | ◐ | ※◐ |
| Campaigns / journeys | `/email/campaigns`, `/email/journeys` | ✓ | — | — | ◐ | ✓ | — | — | ✓✦ | ◐ | ※◐✦ |
| Contacts / consent | `/email/contacts`, `/email/consent` | ✓ | — | — | ◐ | ✓ | — | — | ✓ | — | — |
| Deliverability / compliance | `/email/deliverability` | ✓ | — | — | — | ◐ | — | — | ✓ | — | — |
| Báo cáo email | `/email/reports` | ✓ | ◐ | — | ✓ | ◐ | — | — | ✓ | ◐ | ※◐ |

### 2.7. Sản xuất nội dung & creative

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Content OS | `/crm/content-os` | ✓ | — | — | ◐ | ✓ | ✓ | ◐ | ✓✦ | ◐ | ※◐✦ |
| Creative OS / CP | `/crm/creative-os` | ✓ | — | — | ◐ | ◐ | ✓ | ✓ | ✓✦ | ◐ | ※◐✦ |
| Image studio | `/crm/creative-os/image` | ✓ | — | — | — | — | ◐ | ✓ | ✓ | — | — |
| Media OS | `/crm/media-os` | ✓ | — | — | ◐ | — | ✓ | ◐ | ✓ | ◐ | ※◐ |
| Video | `/crm/video` | ✓ | — | — | ◐ | — | ✓ | ◐ | ✓✦ | — | ※◐✦ |
| Creatives thư viện | `/crm/creatives` | ✓ | — | — | ✓ | ◐ | ✓ | ✓ | ✓ | ◐ | ※◐ |
| SOP / Launch QA | `/crm/sop`, `/crm/launch-qa` | ✓ | — | — | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | — |
| Service delivery board | `/crm/service-delivery` | ✓ | ◐ | — | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | ※◐ |

### 2.8. Nghiên cứu, kế hoạch, GTM

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Market research | `/crm/research` | ✓ | ◐ | — | ✓ | ◐ | — | — | ✓ | ✓ | ※◐ |
| Marketing plan | `/crm/marketing-plan` | ✓ | ◐ | — | ◐ | ◐ | — | — | ✓ | ✓ | — |
| GTM demos / CMS | `/crm/gtm/*` | ✓ | — | — | ◐ | ✓ | — | — | ✓ | ✓ | — |

### 2.9. KPI, nhân sự, điều hành

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| KPI Hub | `/crm/kpi-hub` | ✓ | ✓ | ◐ | ✓ | ◐ | ◐ | ◐ | ✓ | ✓ | — |
| KPI cá nhân / chấm công | `/crm/kpi*`, `/crm/payroll` | ✓ | ◐ | ◐ | ◐ | ◐ | ◐ | ◐ | ✓ | ✓ | — |
| Nhân sự / roster | `/crm/hr`, `/crm/staff` | ✓ | ◐ | — | — | — | — | — | — | ◐ | — |
| Báo cáo nội bộ IWR | `/crm/internal-reports` | ✓ | ✓ | — | ◐ | — | — | — | ✓ | ✓ | — |
| CEO Command Tower | `/crm/ceo` | ✓ | ✓ | — | — | — | — | — | — | ◐ | — |
| Business dashboard / forecast | `/crm/business-dashboard`, `/crm/forecast` | ✓ | ✓ | — | ◐ | — | — | — | ✓ | ✓ | — |
| Tài chính / hóa đơn | `/crm/financials`, `/crm/invoices` | ✓ | ✓ | — | ◐ | — | — | — | — | ◐ | — |
| Revenue Ops | `/crm/revenue-ops` | ✓ | ✓ | ◐ | ✓ | — | — | — | ◐ | ✓ | — |

### 2.10. Tự động hóa & AI

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Automation workflows | `/crm/automation` | ✓ | ◐ | — | ◐ | — | — | — | ✓ | ✓ | — |
| Playbooks | `/crm/playbooks` | ✓ | ◐ | ◐ | ✓ | ◐ | — | — | ✓ | ✓ | — |
| MKT AI / assistants | `/crm/admin/mkt-ai`, `/crm/ai/*` | ✓ | ◐ | — | ◐ | ✓ | ◐ | ◐ | ✓✦ | ◐ | — |

### 2.11. Quản trị hệ thống (Admin)

| Module / tính năng | Đường dẫn | QT | CEO | AE | AM | CE | MC | DS | ML | PD | PC |
|--------------------|-----------|:--:|:---:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Admin hub | `/admin` | ✓ | ◐ | — | — | — | — | — | — | — | — |
| Tổ chức / phòng ban / chức vụ | `/admin/crm/org/*` | ✓ | — | — | — | — | — | — | — | — | — |
| Phân quyền (RBAC) | `/admin/crm/permissions/*` | ✓ | — | — | — | — | — | — | — | — | — |
| Catalog dữ liệu / dictionary | `/admin` data & KPI | ✓ | — | — | — | — | — | — | — | — | — |
| AI admin / SPC | Admin AI & services | ✓ | — | — | — | — | — | — | — | — | — |
| Tài khoản Chat CSD | `/admin/crm/csd/chat-accounts` | ✓ | ✓ | — | — | — | — | — | — | — | — |

---

## 3. Portal Client — chi tiết

Portal **không** dùng cột QT–PD ở trên. Mỗi user portal gắn **một khách hàng** (`client_id`).

| Tính năng portal | Viewer | Approver |
|------------------|:------:|:--------:|
| Dashboard tổng quan | ✓ | ✓ |
| Meta / Google / Zalo (theo gói client) | ◐ | ◐ |
| SEO / báo cáo / content chờ duyệt | ◐ | ◐ + ✦ |
| Email / campaigns chờ duyệt | ◐ | ◐ + ✦ |
| Creatives / video review | ◐ | ◐ + ✦ |
| Service delivery (nếu bật) | ◐ | ◐ |
| Research (nếu bật) | ◐ | ◐ |
| Thông báo / settings | ✓ | ✓ |
| Link công khai proposal / deal / video-review | Theo token | Theo token |
| API staff / Admin / Chat nội bộ | — | — |

**Cấp phát:** AM hoặc QT tạo user tại Agency → Client → tab Portal.

---

## 4. Gói quyền đề xuất khi onboard (checklist)

| Vai trò | Caps / module tối thiểu (ý tưởng cấu hình) |
|---------|---------------------------------------------|
| **QT** | Toàn bộ section trong catalog RBAC; `csd.admin`; Admin org + permissions |
| **CEO** | `ceo_command`, dashboards, `csd` view…admin, agency view, KPI hub view |
| **AE** | `crm_leads` write, B2B inbox/projects view, `csd` view+write, agency view |
| **AM** | Như AE + `crm_agency` configure, Meta/SEO/Email view (+ settings client), `crm_am`, CSD write, cấp Portal |
| **CE** | `crm_content`, SEO write, Email write, CSD write; không Admin |
| **MC** | `crm_media*`, `crm_vd*`, content production, Meta creatives view/edit |
| **DS** | `crm_cp*`, `crm_img*`, design/job function, Meta creative edit |
| **ML** | Hub MKT, Solution release/claim, SEO/Email approve, Content/Creative approve, CSD manage (nếu leader) |
| **PD** | Research, marketing plan, delivery/KPI supervise, B2B projects, CSD manage |
| **PC** | Portal user only — chọn viewer hoặc approver theo khách |

Seed tham chiếu kỹ thuật:
- Chức vụ mặc định CSKH/KD/MKT: `admin_page_permissions.py` → `_POSITION_DEFAULT`
- CSD theo chức vụ: `scripts/seed_csd_rbac.sh`
- Job function: `staff-job-functions.catalog.ts`
- Catalog section đầy đủ (~164): `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`

---

## 5. Ma trận Chat nhóm (tóm tắt cho bàn giao)

| Thao tác trong nhóm | Chủ nhóm | Phó nhóm | Thành viên | QT / CEO (`csd.admin`/`manage`) |
|---------------------|:--------:|:--------:|:----------:|:-------------------------------:|
| Mời thành viên | ✓ | ✓ | — | ✓ (Admin console hoặc bypass) |
| Đặt Phó / Chuyển Chủ / Xóa TV | ✓ | — | — | ✓ qua Admin → Tài khoản Chat |
| Sửa tên/ảnh/moderation | ✓ | ✓ | — | ✓ |
| Rời nhóm | — | ✓ | ✓ | — |
| Ghim tin / gửi khi khóa | ✓ | ✓ | — | ✓ |

---

## 6. Ràng buộc vận hành khi bàn giao

1. **Một người một chức vụ chính** + tối đa vài job function (union quyền).  
2. **Tài khoản Chat** phải được QT/CEO bật riêng — có quyền CRM chưa đủ để mở hộp thoại.  
3. **Portal Client** tách biệt staff — không cấp `SUPER-ADMIN` cho khách.  
4. Sau khi đổi chức vụ: yêu cầu **đăng xuất / đăng nhập** để menu cập nhật.  
5. Mọi thay đổi ma trận trên production ghi nhận qua Admin → Phân quyền (audit).  
6. Bản này là **baseline bàn giao**; khách có thể siết/nới theo hợp đồng — cập nhật bảng §2 và checklist §4 trước go-live.

---

## 7. Liên kết tài liệu liên quan

| Tài liệu | Mục đích |
|----------|----------|
| [`docs/handover/05-PHAN-QUYEN-BAO-MAT-SLA.md`](../handover/05-PHAN-QUYEN-BAO-MAT-SLA.md) | Bảo mật, JWT, SLA |
| [`docs/handover/03-HUONG-DAN-PORTAL-KHACH-HANG.md`](../handover/03-HUONG-DAN-PORTAL-KHACH-HANG.md) | Hướng dẫn portal |
| [`docs/exports/ma-tran-phan-quyen-csd-chat-2026-09-16.md`](ma-tran-phan-quyen-csd-chat-2026-09-16.md) | Chi tiết CSD Chat theo chức vụ |
| [`docs/exports/ma-tran-phan-quyen-CSKH-KD-MKT-2026-08-06.md`](ma-tran-phan-quyen-CSKH-KD-MKT-2026-08-06.md) | Ma trận CSKH/KD/MKT theo trang nút |
| [`docs/PHAN_QUYEN_HUONG_DAN.md`](../PHAN_QUYEN_HUONG_DAN.md) | Hướng dẫn Admin cấu hình RBAC |
| [`docs/superpowers/specs/2026-09-16-csd-chat-permission-matrix.md`](../superpowers/specs/2026-09-16-csd-chat-permission-matrix.md) | SoT kỹ thuật CSD |

---

## 8. Chữ ký bàn giao (mẫu)

| Bên | Họ tên | Chức danh | Ngày | Ký |
|-----|--------|-----------|------|-----|
| Bên giao (PTT / triển khai) | | | | |
| Bên nhận (Khách hàng) | | | | |
| Xác nhận Admin hệ thống đã cấu hình theo §1–§4 | | | | |

**Phiên bản ma trận đã thống nhất:** 1.0 — 2026-09-16

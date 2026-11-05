# Bộ Test Case — Theo từng màn hình RNOSAI (ops-web)

> **Document ID:** RNOSAI-TC-SCR-20260917  
> **Version:** 1.0 · **Date:** 2026-09-17  
> **Phạm vi:** toàn bộ route `services/ops-web/src/app/**/page.tsx` (~364 màn)  
> **Related:** [TC chức vụ](./2026-09-17-rnosai-tc-theo-chuc-vu-va-luong.md) · [TC tổng thể](./2026-09-17-rnosai-tc-tong-the-he-thong.md)

---

## 0. Quy ước

| Mục | Nội dung |
|-----|----------|
| Role mặc định smoke | `SUPER-ADMIN` (P0 load) · role nghiệp vụ cho CRUD |
| Cột TC | ID · P · Màn hình (URL) · Tiền ĐK · Bước · Kết quả mong muốn |
| Checklist chung | Áp dụng **mọi** màn (mục 0.1) trước khi chạy TC chi tiết |
| Kết quả | Pass / Fail / Blocked / Skip / Not Run |
| Evidence | Screenshot + URL + role + console (nếu Fail) |

### 0.1 Checklist chung mọi màn hình (TC-SCR-COMMON)

| TC-ID | P | Kiểm tra | Pass khi |
|-------|---|----------|----------|
| TC-SCR-COMMON-01 | P0 | HTTP load | Status 200 (hoặc redirect login hợp lệ) |
| TC-SCR-COMMON-02 | P0 | Auth gate | Chưa login → `/login` rồi quay lại URL |
| TC-SCR-COMMON-03 | P0 | RBAC | Không cap → 403 / empty hub / menu ẩn |
| TC-SCR-COMMON-04 | P0 | Shell | Sidebar + topbar; title/PageHeader không vỡ |
| TC-SCR-COMMON-05 | P0 | Console | Không error JS đỏ blocking |
| TC-SCR-COMMON-06 | P1 | Empty state | Không data → empty/CTA, không crash |
| TC-SCR-COMMON-07 | P1 | Loading | Có skeleton/spinner; không flash lỗi |
| TC-SCR-COMMON-08 | P2 | Mobile ~960px | Layout usable / mobile nav |

---

## 1. Auth & Account

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-AUTH-01 | P0 | `/login` | Logged out | Nhập đúng credentials → Submit | Vào app; session set |
| TC-SCR-AUTH-02 | P0 | `/login` | — | Password sai | Báo lỗi; không session |
| TC-SCR-AUTH-03 | P0 | `/login/callback` | OAuth redirect | Hoàn tất SSO | Đưa về deep-link hoặc `/` |
| TC-SCR-AUTH-04 | P1 | `/login/mfa` | User MFA | Nhập OTP | Vào app; sai OTP → lỗi |
| TC-SCR-AUTH-05 | P0 | `/account` | Logged in | Đổi avatar/profile fields | Lưu OK; refresh còn |
| TC-SCR-AUTH-06 | P1 | `/403` | User thiếu quyền | Mở URL bị chặn hoặc `/403` | Trang 403 thân thiện |
| TC-SCR-AUTH-07 | P2 | `/iwr/share/[token]` | Token share hợp lệ | Mở public share | Nội dung theo token; hết hạn → lỗi |

---

## 2. Tổng quan & Shell

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-HOME-01 | P0 | `/` | SUPER-ADMIN | Mở tổng quan | Widgets/cards; sidebar accordion |
| TC-SCR-HOME-02 | P0 | Sidebar CRM | Ở `/crm/csd/*` | Quan sát accordion | Service Desk mở; **CRM không** auto-open |
| TC-SCR-HOME-03 | P1 | Topbar search | — | Gõ keyword | Kết quả hoặc empty |
| TC-SCR-HOME-04 | P1 | Notifications | — | Mở bell | Panel thông báo |

---

## 3. CRM Hub & CSKH

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-CRM-01 | P0 | `/crm` | Cap board | Mở bảng CSKH | Kanban/list; filter; badge SLA |
| TC-SCR-CRM-02 | P0 | `/crm` | Có case | Kéo/đổi stage (nếu hỗ trợ) | Persist sau refresh |
| TC-SCR-CRM-03 | P0 | `/crm/cskh-board` | Cap | Mở board CSKH alt | Load tương đương board |
| TC-SCR-CRM-04 | P0 | `/crm/customers` | Cap | List + search | Kết quả đúng |
| TC-SCR-CRM-05 | P0 | `/crm/customers/[id]` | Có KH | Mở 360 | Timeline/tab; không lộ tenant khác |
| TC-SCR-CRM-06 | P0 | `/crm/tickets` | Cap CS ticket | List + mở ticket | Khác hệ CSD; CRUD theo cap |
| TC-SCR-CRM-07 | P0 | `/crm/operational/leads` | Cap | List + `/new` | Tạo lead vận hành |
| TC-SCR-CRM-08 | P1 | `/crm/health` | Cap | Mở CS Health | Metric/health cards |
| TC-SCR-CRM-09 | P1 | `/crm/hub` | Cap | Hub HĐ/commercial | Cards module |
| TC-SCR-CRM-10 | P1 | `/crm/orders` | Cap | List orders | Filter/sort |
| TC-SCR-CRM-11 | P1 | `/crm/catalog` | Cap | Catalog DV | List items |
| TC-SCR-CRM-12 | P1 | `/crm/sales` · `/crm/sales/services` | Cap | Mở sales | Không 500 |

---

## 4. Lead B2B & Pipeline bán

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-B2B-01 | P0 | `/crm/b2b/leads` | AE+ | Filter + mở lead | List/kanban OK |
| TC-SCR-B2B-02 | P0 | `/crm/b2b/leads/new` | Write | Điền bắt buộc → Submit | Tạo + redirect detail |
| TC-SCR-B2B-03 | P0 | `/crm/b2b-inbox` | Cap | Mở inbox | Threads list |
| TC-SCR-B2B-04 | P0 | `/crm/b2b-inbox/thread/[leadId]` | Có thread | Đọc + reply | Message gửi/persist |
| TC-SCR-B2B-05 | P1 | `/crm/b2b-speed` | Cap | Mở speed-to-lead | SLA/metrics |
| TC-SCR-B2B-06 | P1 | `/crm/b2b-unmatched` | Cap | Map unmatched → lead | Mapping OK |
| TC-SCR-B2B-07 | P1 | `/crm/b2b-gdkd` | GDKD | Mở GDKD B2B | Dashboard theo quyền |
| TC-SCR-B2B-08 | P1 | `/crm/b2b-projects` · `/[id]` | Cap | List + detail | Project load |
| TC-SCR-B2B-09 | P0 | `/crm/leads` | Cap | List leads (legacy/SPA) | Load |
| TC-SCR-B2B-10 | P0 | `/crm/leads/new` | Write | Tạo lead | Success |
| TC-SCR-B2B-11 | P0 | `/crm/leads/[id]` | Có lead | Sửa field + activity | Persist |
| TC-SCR-B2B-12 | P1 | `/crm/leads/[id]/deal-room` | Cap | Mở deal room | Workspace OK |
| TC-SCR-B2B-13 | P1 | `/crm/leads/review-queue` | Cap review | Duyệt/reject | Status đổi |
| TC-SCR-B2B-14 | P1 | `/crm/leads/handover` | Cap | Handover | Chuyển owner/team |
| TC-SCR-B2B-15 | P1 | `/crm/spa/leads` · `/new` | Cap | SPA leads | CRUD tối thiểu |
| TC-SCR-B2B-16 | P1 | `/crm/solution/queue` | Cap | Queue solution | Assign/action |
| TC-SCR-B2B-17 | P1 | `/crm/intake` | Cap | Intake stepper | Không crash; save draft |
| TC-SCR-B2B-18 | P1 | `/crm/intake/sales-kit` · `/learn` | Cap | Kho Sales Kit | Browse + learn |

---

## 5. Báo giá (Proposals / QT)

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-QT-01 | P0 | `/crm/proposals` | Cap | Overview | Cards/nav QT |
| TC-SCR-QT-02 | P0 | `/crm/proposals/list` | Cap | List báo giá | Filter |
| TC-SCR-QT-03 | P0 | `/crm/proposals/new` | Write | Tạo báo giá | Draft tạo |
| TC-SCR-QT-04 | P0 | `/crm/proposals/[id]` | Có QT | Xem/sửa line | Persist |
| TC-SCR-QT-05 | P1 | `/crm/proposals/[id]/studio` | Cap | Studio | Editor load |
| TC-SCR-QT-06 | P1 | `/crm/proposals/[id]/convert` | Cap | Convert | HĐ/order theo flow |
| TC-SCR-QT-07 | P1 | `/crm/proposals/catalog` | Cap | Service catalog | List |
| TC-SCR-QT-08 | P1 | `/crm/proposals/approvals` | Approver | Approve/reject | Status |
| TC-SCR-QT-09 | P2 | `/crm/proposals/reports` · `/settings` · `/activity` | Cap | Mở 3 màn | Load OK |

---

## 6. Service Desk (CSD)

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-CSD-01 | P0 | `/crm/csd` | Cap csd | Tổng quan | KPI/tiles CSD; Canopy toolbar |
| TC-SCR-CSD-02 | P0 | `/crm/csd/tickets` | Write | Lọc + **Tạo ticket** | List + modal/form; ticket mới |
| TC-SCR-CSD-03 | P0 | `/crm/csd/tickets/[id]` | Có ticket | Assign / đổi status / comment | Persist; SLA update |
| TC-SCR-CSD-04 | P0 | `/crm/csd/chat` | Chat enabled | Gửi DM | Message realtime/refresh |
| TC-SCR-CSD-05 | P1 | `/crm/csd/chat` | Group | Tạo/join group | Members/requests theo Wave |
| TC-SCR-CSD-06 | P1 | `/crm/csd/email` | Cap email | Shared mailbox | Threads; compose |
| TC-SCR-CSD-07 | P1 | `/crm/csd/email/unmatched` | Có unmatched | Map email→ticket/KH | Mapping OK |
| TC-SCR-CSD-08 | P1 | `/crm/csd/reports` | Cap | List reports | Generate/view |
| TC-SCR-CSD-09 | P1 | `/crm/csd/reports/[id]` | Có report | Chi tiết | Nội dung + send log |
| TC-SCR-CSD-10 | P1 | `/crm/csd/reports/templates` | Manage | CRUD template | Lưu template |
| TC-SCR-CSD-11 | P0 | `/admin/crm/csd/chat-accounts` | Admin | Bật chat cho staff | Gate chat hoạt động |

---

## 7. Account Management (AM)

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-AM-01 | P0 | `/crm/account-management` | ACM+ | Dashboard | KPI tiles; sidebar AM Canopy |
| TC-SCR-AM-02 | P0 | `/crm/account-management/clients` | Cap | List + sort | Đúng owner scope |
| TC-SCR-AM-03 | P0 | `/crm/account-management/clients/new` | Write | Tạo KH AM | Redirect detail |
| TC-SCR-AM-04 | P0 | `/crm/account-management/clients/[id]` | Có KH | 360 + tabs | Health/MRR/notes |
| TC-SCR-AM-05 | P1 | `.../clients/[id]/edit` | Write | Sửa thông tin | Persist |
| TC-SCR-AM-06 | P1 | `/crm/account-management/onboarding` · `/[id]` | Cap | Queue + detail | Checklist cập nhật |
| TC-SCR-AM-07 | P1 | `/crm/account-management/work` · `/[id]` | Cap | Work queue | Task done |
| TC-SCR-AM-08 | P1 | `/crm/account-management/renewals` · `/[id]` | Cap | Gia hạn | Status/pipeline |
| TC-SCR-AM-09 | P1 | `/crm/account-management/contracts/[id]` | Cap | Hợp đồng | Xem/file |
| TC-SCR-AM-10 | P1 | `/crm/account-management/opportunities` | Cap | Upsell list | Load |
| TC-SCR-AM-11 | P1 | `/crm/account-management/feedback` | Cap | Feedback | Submit/view |
| TC-SCR-AM-12 | P1 | `/crm/account-management/health` · `/[id]` | Cap | Health & risk | Score/alerts |
| TC-SCR-AM-13 | P1 | `/crm/account-management/reports` | Cap | Báo cáo AM | Charts/export |
| TC-SCR-AM-14 | P1 | `/crm/account-management/settings` | Configure | Cấu hình | Save settings |

---

## 8. Agency Portal (staff side)

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-AGY-01 | P0 | `/agency` | Cap agency | Hub | Cards + nav |
| TC-SCR-AGY-02 | P0 | `/agency/ingest` | Cap | Chạy/xem ingest | Job status |
| TC-SCR-AGY-03 | P1 | `/agency/jobs` | Cap | List jobs | Filter |
| TC-SCR-AGY-04 | P1 | `/agency/notifications` | Cap | Đọc notif | Unread → read |
| TC-SCR-AGY-05 | P1 | `/agency/kpi-definitions` | Cap | KPI defs | CRUD theo quyền |
| TC-SCR-AGY-06 | P1 | `/agency/clients/new` · `/[id]` | Cap | Tạo/xem client agency | Persist |

---

## 9. Content Marketing OS

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-CMKTE-01 | P0 | `/crm/content-os` | CE+ | Command Center | **Sidebar trắng**; accent xanh |
| TC-SCR-CMKTE-02 | P0 | `/crm/content-os/requests` | Write | Tạo request | Hiện list |
| TC-SCR-CMKTE-03 | P0 | `/crm/content-os/w/[itemId]` | Có item | Edit/publish | Workspace OK |
| TC-SCR-CMKTE-04 | P0 | `/crm/content-os/approvals` | Approver/CE | Submit/approve | Status đổi |
| TC-SCR-CMKTE-05 | P1 | `/crm/content-os/calendar` | Cap | Lịch xuất bản | Drag/schedule nếu có |
| TC-SCR-CMKTE-06 | P1 | `/crm/content-os/library` | Cap | Asset library | Upload/browse |
| TC-SCR-CMKTE-07 | P1 | `/crm/content-os/intelligence` | Cap | Insights | Cards/insights |
| TC-SCR-CMKTE-08 | P1 | `/crm/content-os/settings` | Governance | Settings | Save; CE write không admin sâu |

---

## 10. Media OS

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-MSOS-01 | P0 | `/crm/media-os` | Cap media | Command | Load + nav 8 screen |
| TC-SCR-MSOS-02 | P1 | `/crm/media-os/inventory` | Cap | Inventory & rate | CRUD tối thiểu |
| TC-SCR-MSOS-03 | P1 | `/crm/media-os/packages` | Cap | Packages | List/create |
| TC-SCR-MSOS-04 | P1 | `/crm/media-os/campaigns` | Cap | Campaigns | Status |
| TC-SCR-MSOS-05 | P1 | `/crm/media-os/evidence` | Cap | Evidence | Upload/view |
| TC-SCR-MSOS-06 | P1 | `/crm/media-os/outcomes` | Cap | Outcomes | Metrics |
| TC-SCR-MSOS-07 | P1 | `/crm/media-os/margin` | Cap | Margin & deal | Numbers |
| TC-SCR-MSOS-08 | P2 | `/crm/media-os/settings` | Manage | Governance | Save |

---

## 11. Creative OS & Image SOP & Video

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-CP-01 | P0 | `/crm/creative-os` | Cap | Tổng quan | Nav CP |
| TC-SCR-CP-02 | P0 | `/crm/creative-os/projects` · `/new` · `/[id]` | Write | Tạo/mở dự án | Persist |
| TC-SCR-CP-03 | P1 | `/crm/creative-os/video` · `/[id]` · batch/ops/templates | Cap | Video AI flows | Không crash |
| TC-SCR-CP-04 | P0 | `/crm/creative-os/image` | Cap image | Tổng quan Image SOP | Nav IMG-01…11 |
| TC-SCR-CP-05 | P0 | `/crm/creative-os/image/jobs` | Write | Tạo job ảnh | Job queue |
| TC-SCR-CP-06 | P1 | `/crm/creative-os/image/operations` | Cap | Vận hành | Tasks |
| TC-SCR-CP-07 | P1 | `/crm/creative-os/image/assets` | Cap | Asset intelligence | Browse |
| TC-SCR-CP-08 | P1 | `/crm/creative-os/image/review` · `/[assetId]` | Cap | Review | Approve/reject |
| TC-SCR-CP-09 | P1 | `/crm/creative-os/image/sops` · `/new` | Cap | SOP registry/composer | Save SOP |
| TC-SCR-CP-10 | P1 | `/crm/creative-os/image/brand` · `/[kitId]` | Cap | Brand graph | Kit load |
| TC-SCR-CP-11 | P1 | `/crm/creative-os/image/providers` | Cap | Provider router | Config |
| TC-SCR-CP-12 | P2 | `/crm/creative-os/image/finops` · `/governance` | Cap | FinOps/Gov | Load |
| TC-SCR-CP-13 | P1 | `/crm/creative-os/media` · `/brand-kits` · `/calendar` · `/reports` · `/settings` | Cap | Smoke 5 màn | 200 |
| TC-SCR-CP-14 | P1 | `/crm/creative-os/actions` · `/activity` · `/ops` | Cap | Ops side | Load |
| TC-SCR-VD-01 | P0 | `/crm/video` · `/dashboard` | Cap video | List + dashboard | Load |
| TC-SCR-VD-02 | P0 | `/crm/video/[id]` | Có job | Mở workspace | Tabs bible/brief/… |
| TC-SCR-VD-03 | P1 | `/crm/video/[id]/brief` · `script` · `keyframes` · `takes` · `post` · `render` · `delivery` · `cost` · `bible` · `gates/[n]` | Cap | Đi từng bước SOP | Persist theo bước |
| TC-SCR-VD-04 | P2 | `/admin/video/providers` | Admin | Providers | Save |

---

## 12. Delivery / Marketing plan / Creatives / Ops

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-DEL-01 | P0 | `/crm/marketing-plan` · `/[id]` | Cap | List + detail | Load |
| TC-SCR-DEL-02 | P0 | `/crm/service-delivery` · `/[id]` | Cap | Triển khai DV | Status |
| TC-SCR-DEL-03 | P1 | `/crm/sop` | Cap | SOP hub | Browse |
| TC-SCR-DEL-04 | P1 | `/crm/launch-qa` | Cap | Launch QA | Checklist |
| TC-SCR-DEL-05 | P1 | `/crm/creatives` | Cap | Creative Hub | Upload/list |
| TC-SCR-DEL-06 | P1 | `/crm/campaign-writes` | Cap | Campaign write | Draft |
| TC-SCR-DEL-07 | P0 | `/crm/delivery-projects` · `/new` · `/[id]` | Cap | CRUD dự án giao | Persist |
| TC-SCR-DEL-08 | P1 | `.../capacity` · `/quality` · `/risks` · `/[id]/kpis/add` | Cap | Smoke phụ | Load |
| TC-SCR-OPS-01 | P1 | `/crm/ops/dashboard` · `/my-tasks` · `/alerts` · `/catalog` | Cap | Ops 4 màn | Load |

---

## 13. Research / RE projects / Revenue Ops

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-RES-01 | P0 | `/crm/research` · `/new` · `/[id]` | Cap | CRUD research | Persist |
| TC-SCR-RES-02 | P1 | `/crm/research/analytics` · `/taxonomy` | Cap | Analytics/taxonomy | Load |
| TC-SCR-RE-01 | P1 | `/crm/re-projects` · `/[id]` | Cap | RE projects | Load |
| TC-SCR-REV-01 | P0 | `/crm/revenue-ops` | Cap | Hub RevOps | Nav |
| TC-SCR-REV-02 | P1 | `/crm/revenue-ops/leads` · `/pipeline` · `/kpi` · `/sla` · `/territory` · `/reports` · `/settings` | Cap | Smoke 7 màn | 200 |

---

## 14. CEO / Forecast / Finance / AI CRM

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-CEO-01 | P0 | `/crm/ceo` | Cap ceo | Command | Widgets |
| TC-SCR-CEO-02 | P1 | `/crm/ceo/board-pack` · `/learn` | Cap | Board pack / learn | Load |
| TC-SCR-FIN-01 | P0 | `/crm/forecast` | Cap | Forecast | Charts/table |
| TC-SCR-FIN-02 | P0 | `/crm/business-dashboard` | Cap | Dashboard KD | KPI |
| TC-SCR-FIN-03 | P1 | `/crm/financials` | Cap | Tài chính | Numbers |
| TC-SCR-FIN-04 | P1 | `/crm/invoices` | Cap | Invoices | List |
| TC-SCR-FIN-05 | P1 | `/crm/gdkd-enterprise` | GDKD | KPI GDKD | Load |
| TC-SCR-FIN-06 | P2 | `/crm/owner-weekly` | Cap | BC tuần | Load |
| TC-SCR-AI-01 | P1 | `/crm/ai/query` | Cap | NL Analytics | Query trả kết quả/empty |
| TC-SCR-AI-02 | P1 | `/crm/ai/insights` · `/coach` · `/cpl-digest` | Cap | Smoke AI | Load |
| TC-SCR-AUTO-01 | P1 | `/crm/automation` · `/playbooks` | Cap | Workflows/playbooks | List/run |
| TC-SCR-AUTO-02 | P2 | `/crm/admin/mkt-ai/playbooks` | Cap | MKT AI playbooks | Load |

---

## 15. KPI Hub & KPI tổ chức

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-KPIH-01 | P0 | `/crm/kpi-hub` | Cap | Hub landing | Groups nav |
| TC-SCR-KPIH-02 | P0 | `/crm/kpi-hub/executive` · `/marketing` · `/sales` | Cap | 3 command centers | Embed không phá chrome |
| TC-SCR-KPIH-03 | P1 | `/crm/kpi-hub/dictionary` · `/new` · `/[id]/edit` | Cap | Dictionary CRUD | Persist |
| TC-SCR-KPIH-04 | P1 | `/crm/kpi-hub/targets` · `/sources` · `/quality` · `/approvals` | Cap | Governance data | Load |
| TC-SCR-KPIH-05 | P1 | `/crm/kpi-hub/service-kpi` · `/overview` · `/service-templates` · `/instances` · `/measurement` · `/tracking` · `/kpi-contracts` · `/reconcile` · `/policy-packs` | Cap | Service KPI suite | Load từng màn |
| TC-SCR-KPIH-06 | P1 | `/crm/kpi-hub/performance` (+ assignments/scorecards/check-ins/campaigns/crm-source/reports/settings/marketing) | Cap | Performance OS | Load |
| TC-SCR-KPIH-07 | P1 | `/crm/kpi-hub/reports` · `/new` · `/audit` · `/settings` · `/commission` · `/lineage` | Cap | Reports/admin | Load |
| TC-SCR-KPI-01 | P1 | `/crm/kpi` · `/crm/kpi/groups` · `/new` · `/[id]` | Cap | Nhóm KPI | CRUD |
| TC-SCR-KPI-02 | P1 | `/crm/kpi/types` · `/new` · `/[id]` | Cap | KPI types | CRUD |
| TC-SCR-KPI-03 | P2 | `/crm/kpi/solution` | Cap | KPI solution | Load |

---

## 16. Internal Reports (IWR)

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-IWR-01 | P0 | `/crm/internal-reports` | Cap | Hub | Nav |
| TC-SCR-IWR-02 | P0 | `/crm/internal-reports/inbox` | Cap | Inbox | Items |
| TC-SCR-IWR-03 | P0 | `/crm/internal-reports/builder` | Write | Tạo draft | Save |
| TC-SCR-IWR-04 | P1 | `/crm/internal-reports/[id]` | Có report | Xem/sửa | Persist |
| TC-SCR-IWR-05 | P1 | `/dashboards` · `/lists` · `/team` · `/templates` · `/schedules` · `/risks` (prefix IWR) | Cap | Smoke phụ | 200 |

---

## 17. HR / Staff / Payroll

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-HR-01 | P0 | `/crm/hr` | Cap HR | HR Hub | Cards |
| TC-SCR-HR-02 | P1 | `/crm/hr/attendance` · `/leave` · `/my-wallet` | Cap | Attendance/leave | Load |
| TC-SCR-HR-03 | P0 | `/crm/staff` · `/crm/staff/[id]` | Cap | Roster + hồ sơ | Load |
| TC-SCR-HR-04 | P1 | `/crm/staff-kpi` | Cap | KPI AM/SP | Load |
| TC-SCR-HR-05 | P1 | `/crm/payroll` · `/me` | Cap | Payroll | Scope đúng user |

---

## 18. SEO Module

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-SEO-01 | P0 | `/seo/hub` | Cap SEO | Hub | Cards + module nav |
| TC-SCR-SEO-02 | P0 | `/seo/clients` · `/[id]` | Cap | Clients | List/detail |
| TC-SCR-SEO-03 | P1 | `/seo/research` · `/content` · `/content/[id]` · `/technical` | Cap | Core SEO | Load + edit content |
| TC-SCR-SEO-04 | P1 | `/seo/reports` · `/strategy` · `/governance` | Cap | Strategy suite | Load |
| TC-SCR-SEO-05 | P1 | `/seo/aeo` · `/authority` · `/ranks` · `/automations` · `/freshness` · `/experiments` · `/bi` · `/cms` · `/gate-a` | Cap | Extended suite | Smoke 200 từng URL |

---

## 19. Email Marketing Module

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-EM-01 | P0 | `/email` · `/email/hub` | Cap email | Hub | Cards |
| TC-SCR-EM-02 | P0 | `/email/clients` · `/[id]` · `/contacts` · `/consent` · `/suppression` | Cap | Audience | CRUD tối thiểu |
| TC-SCR-EM-03 | P0 | `/email/campaigns` · `/[id]` · `/[id]/review` | Write | Tạo/xem/review | Status flow |
| TC-SCR-EM-04 | P1 | `/email/templates` · `/[id]` · `/segments` · `/journeys` · `/[id]` | Cap | Assets | Load |
| TC-SCR-EM-05 | P1 | `/email/deliverability` · `/reports` · `/governance` · `/gate-a` | Cap | Ops | Load |
| TC-SCR-EM-06 | P1 | `/email/public/unsubscribe/[token]` · `/confirm/[token]` · `/preferences/[token]` | Token | Public prefs | Đúng token; hết hạn lỗi |

---

## 20. Meta / Google / Zalo Ads

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-META-01 | P0 | `/meta/facebook-ads` | Cap Meta | List campaigns | Token OK hoặc reconnect CTA |
| TC-SCR-META-02 | P1 | `/meta/ads-ops` · `/ads-combined` · `/intelligence` · `/tracking` · `/migration` | Cap | Smoke Meta suite | 200 |
| TC-SCR-GADS-01 | P1 | `/google/google-ads` | Cap | Google Ads | Load/empty |
| TC-SCR-ZALO-01 | P1 | `/zalo/zalo-ads` · `/zalo/leads` | Cap | Zalo | Load |

---

## 21. Admin — Org, RBAC, CRM config

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-ADM-01 | P0 | `/admin` | SUPER-ADMIN | Hub quản trị | Workspace cards |
| TC-SCR-ADM-02 | P0 | `/admin/crm/org/users` · `/new` | Admin | List + onboard | User tạo |
| TC-SCR-ADM-03 | P0 | `/admin/crm/org/departments` · `/teams` · `/positions` · `/chart` · `/org` | Admin | Org structure | CRUD nhẹ |
| TC-SCR-ADM-04 | P0 | `/admin/crm/permissions` | Admin | Ma trận chức vụ | Xem/sửa grant; re-login user thấy đổi |
| TC-SCR-ADM-05 | P1 | `/admin/crm/permissions/functions` · `/catalog` · `/users` · `/fields` · `/simulator` | Admin | Job function suite | Load + sim |
| TC-SCR-ADM-06 | P1 | `/admin/crm/permission-sets` · `/[code]` | Admin | Permission sets | Edit |
| TC-SCR-ADM-07 | P1 | `/admin/crm/sso/groups` | Admin | SSO groups | Map groups |
| TC-SCR-ADM-08 | P1 | `/admin/crm/pipeline` · `/lead-lookups` · `/lead-classification` · `/custom-fields` · `/vn-geo` · `/research-ai-providers` | Admin | CRM config | Save 1 field mỗi màn |
| TC-SCR-ADM-09 | P1 | `/admin/brand` | Admin | Logo/brand | Upload preview |
| TC-SCR-ADM-10 | P0 | Negative | AE | Mở `/admin/crm/permissions` | 403 |

---

## 22. Admin — Audit, Integrations, Policies, Services, AI

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-ADMA-01 | P0 | `/admin/audit` | Admin | Audit Center | Search logs |
| TC-SCR-ADMA-02 | P1 | `/admin/audit/access-reviews` · `/new` · `/[id]` · `/inbox` | Admin | Access review | Campaign flow |
| TC-SCR-ADMA-03 | P1 | `/admin/audit/stale-accounts` · `/break-glass` | Admin | Stale / break-glass | Load + action gated |
| TC-SCR-ADMA-04 | P1 | `/admin/integrations` | Admin | Registry | Secrets masked |
| TC-SCR-ADMA-05 | P1 | `/admin/environments` | Admin | So sánh env | Diff view |
| TC-SCR-ADMA-06 | P1 | `/admin/policies` · `/approvals` | Admin | OPA/compliance | Load |
| TC-SCR-ADMA-07 | P1 | `/admin/services` · `/portfolio` · `/process` · `/publish` · `/families/[dvCode]` | Admin | SPC catalog | Load |
| TC-SCR-ADMA-08 | P1 | `/admin/ai/agents` · `/tools` · `/runs` · `/policies` | Admin AI | AI admin | List runs |
| TC-SCR-ADMA-09 | P2 | `/admin/video/providers` | Admin | Video providers | Config |

---

## 23. Sandbox & misc

| TC-ID | P | Màn hình | Tiền ĐK | Bước | Kết quả mong muốn |
|-------|---|----------|---------|------|-------------------|
| TC-SCR-SBX-01 | P2 | `/sandbox/leads` · `/sandbox/board/[industry]` | Dev | Sandbox | Isolated data |
| TC-SCR-SBX-02 | P2 | `/sandbox/not-in-sandbox` | — | Mở | Báo không sandbox |
| TC-SCR-GTM-01 | P2 | `/crm/gtm/cms` · `/crm/gtm/demos` | Cap | GTM | Load |

---

## 24. Ma trận smoke P0 theo nhóm màn (checklist nhanh)

Đánh dấu Pass khi **COMMON-01..05** đạt trên từng URL:

| Nhóm | URL bắt buộc P0 |
|------|-----------------|
| Auth | `/login`, `/account` |
| Shell | `/`, `/crm` |
| B2B | `/crm/b2b/leads`, `/crm/b2b/leads/new`, `/crm/b2b-inbox` |
| CSKH | `/crm/customers`, `/crm/tickets` |
| CSD | `/crm/csd`, `/crm/csd/tickets`, `/crm/csd/chat` |
| AM | `/crm/account-management`, `.../clients` |
| Content | `/crm/content-os`, `.../requests` |
| Creative | `/crm/creative-os`, `.../image`, `/crm/video` |
| Media | `/crm/media-os` |
| KPI | `/crm/kpi-hub/executive` |
| CEO/Fin | `/crm/ceo`, `/crm/forecast` |
| SEO/Email/Meta | `/seo/hub`, `/email/hub`, `/meta/facebook-ads` |
| Admin | `/admin`, `/admin/crm/org/users`, `/admin/crm/permissions` |

---

## 25. Phụ lục — Inventory đầy đủ route ops-web (~364)

> Dùng spreadsheet: copy cột URL → cột Result (Pass/Fail) + Tester + Date.  
> Mỗi dòng = tối thiểu chạy **TC-SCR-COMMON-01…05**.  
> TC chi tiết (mục 1–23) chạy thêm cho màn P0/P1 của sprint.

### A. Core

`/`, `/login`, `/login/callback`, `/login/mfa`, `/account`, `/403`

### B. Admin

`/admin`, `/admin/ai/agents`, `/admin/ai/policies`, `/admin/ai/runs`, `/admin/ai/tools`, `/admin/audit`, `/admin/audit/access-reviews`, `/admin/audit/access-reviews/[id]`, `/admin/audit/access-reviews/inbox`, `/admin/audit/access-reviews/new`, `/admin/audit/break-glass`, `/admin/audit/stale-accounts`, `/admin/brand`, `/admin/crm/csd/chat-accounts`, `/admin/crm/custom-fields`, `/admin/crm/lead-classification`, `/admin/crm/lead-lookups`, `/admin/crm/org`, `/admin/crm/org/chart`, `/admin/crm/org/departments`, `/admin/crm/org/positions`, `/admin/crm/org/teams`, `/admin/crm/org/users`, `/admin/crm/org/users/new`, `/admin/crm/permission-sets`, `/admin/crm/permission-sets/[code]`, `/admin/crm/permissions`, `/admin/crm/permissions/fields`, `/admin/crm/permissions/functions`, `/admin/crm/permissions/functions/catalog`, `/admin/crm/permissions/simulator`, `/admin/crm/permissions/users`, `/admin/crm/pipeline`, `/admin/crm/research-ai-providers`, `/admin/crm/sso/groups`, `/admin/crm/vn-geo`, `/admin/environments`, `/admin/integrations`, `/admin/policies`, `/admin/policies/approvals`, `/admin/services`, `/admin/services/families/[dvCode]`, `/admin/services/portfolio`, `/admin/services/process`, `/admin/services/publish`, `/admin/video/providers`

### C. Agency

`/agency`, `/agency/clients/[id]`, `/agency/clients/new`, `/agency/ingest`, `/agency/jobs`, `/agency/kpi-definitions`, `/agency/notifications`

### D. CRM (bán hàng / CSKH / delivery / KPI / IWR / HR / AI …)

Toàn bộ route dưới `/crm/**` trong inventory build (leads, b2b-*, customers, tickets, csd/*, account-management/*, content-os/*, creative-os/*, media-os/*, video/*, kpi-hub/*, internal-reports/*, proposals/*, delivery-projects/*, revenue-ops/*, research/*, ceo/*, forecast, financials, invoices, automation, playbooks, hr/*, staff/*, payroll/*, ops/*, …).  
**Nguồn SoT:** `find services/ops-web/src/app -name page.tsx` (364 files tại thời điểm 2026-09-17).

### E. Channels

`/seo/**`, `/email/**`, `/meta/**`, `/google/google-ads`, `/zalo/**`

### F. Sandbox / share

`/sandbox/**`, `/iwr/share/[token]`

---

## 26. Thống kê TC chi tiết (mục 1–23)

| Module | Số TC (ước lượng) |
|--------|------------------:|
| COMMON checklist | 8 |
| Auth/Account | 7 |
| Shell/Home | 4 |
| CRM/CSKH | 12 |
| B2B/Leads | 18 |
| Proposals | 9 |
| CSD | 11 |
| AM | 14 |
| Agency | 6 |
| Content OS | 8 |
| Media OS | 8 |
| Creative/Image/Video | 18 |
| Delivery/Ops | 9 |
| Research/RevOps | 6 |
| CEO/Fin/AI | 12 |
| KPI Hub/KPI | 10 |
| IWR | 5 |
| HR/Staff | 5 |
| SEO | 5 |
| Email | 6 |
| Meta/Google/Zalo | 4 |
| Admin org/RBAC | 10 |
| Admin audit/AI/SPC | 9 |
| Sandbox/GTM | 3 |
| **Tổng TC chi tiết** | **~207** |
| **+ Smoke COMMON × ~364 routes** | Inventory phụ lục |

---

## 27. Hướng dẫn tester

1. Sprint regression: mục **24** (P0 matrix) + COMMON trên các URL đổi trong PR.  
2. Full UAT module: chọn mục 3–23 tương ứng + role từ file chức vụ.  
3. Full system gate: file [TC tổng thể](./2026-09-17-rnosai-tc-tong-the-he-thong.md) trước; rồi sample 1 màn/nhóm từ file này.  
4. Export Excel: giữ cột `TC-ID | P | URL | Role | Result | Note | Evidence`.

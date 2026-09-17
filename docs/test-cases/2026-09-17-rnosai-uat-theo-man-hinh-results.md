# UAT kết quả — 2026-09-17-rnosai-tc-theo-man-hinh.md

> **Môi trường:** https://rs.pttads.vn  
> **Role:** SUPER-ADMIN (Quản trị hệ thống) — session user đã login  
> **Tester:** Agent (browser MCP)  
> **Cập nhật:** 2026-09-17

## Tóm tắt

| Trạng thái | Số (ước lượng) |
|------------|---------------:|
| Pass | ~72 |
| Fail | 0 (+1 UI note) |
| Blocked / partial | ~10 |
| Not Run (còn lại ~207 − đã chạy) | ~125+ |

**HTTP smoke:** 55 route P0 chính → **200** tất cả.

---

## FAIL — đã fix / còn lại

### FAIL-1 · TC-SCR-CSD-02 (P0) — Tạo ticket CSD → **FIXED 2026-09-17**

| Mục | Chi tiết |
|-----|----------|
| Root cause | PG `could not determine data type of parameter $12` khi `assignee_staff_id` = null trong `CASE WHEN $12 IS NOT NULL` |
| Fix | Cast `$12::integer` trong `csd-tickets.repository.ts` insert SQL |
| Verify | Tạo ticket OK → `/crm/csd/tickets/b6e0c303-cf8b-4a09-a20d-9f90db1a2284` · title `UAT fix verify CSD create 2026-09-17` |
| Deploy | Commit `bba5462b` · VPS `ptt-crm-api` rebuilt + restarted |

### FAIL-2 · TC-SCR-B2B-01 (P0, phần Kanban) → **FIXED 2026-09-17**

| Mục | Chi tiết |
|-----|----------|
| Root cause | Status funnel `first_contact` không map vào cột CRM (`moi`…); Kanban bucket miss → mọi cột **Trống** |
| Fix | `normalizeLeadStatus` alias `first_contact`→`moi` + `bucketLeadsByKanbanStage` / `__other__` · commit `c1ce1667` |
| Verify | `/crm/b2b/leads` tab Kanban · cột **Mới** = **4** (UAT Browser Lead 0917, A Hưng 360, Chi UYÊN BĐS, Tuan Truong) |
| Deploy | VPS ops-web release `ops-web-c1ce1667-*` |

### NOTE-UI · Topbar overlap → **FIXED (local, chờ deploy)**

| Mục | Chi tiết |
|-----|----------|
| Root cause | Filter pills global-search luôn in-flow dưới input → topbar cao/co hẹp, pills chồng avatar/bell |
| Fix | Chips chuyển vào overlay panel khi focus; `flex-shrink:0` cho app/user; search `min-width: 12rem` |
| Files | `GlobalSearchBar.tsx`, `globals.css` |

---

## Pass đã xác nhận (interactive + load)

### Auth / Shell

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-AUTH-02 | Pass | Invalid credentials (trước login) |
| TC-SCR-AUTH-06 | Pass partial | `/403` render OK |
| TC-SCR-COMMON-02 | Pass | Deep-link → `/login?next=` |
| TC-SCR-HOME-01 | Pass | `/` widgets + chào Quản trị hệ thống |
| TC-SCR-HOME-02 | Pass | `/crm/csd`: Service Desk `aria-expanded=true`, CRM `false` |
| TC-SCR-HOME-03 | Pass partial | Search nhận input; panel kết quả chưa thấy rõ |
| TC-SCR-HOME-04 | Pass | Bell → panel «Không có thông báo» + Đóng |

### CRM / CSKH / B2B

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-CRM-01 | Pass | `/crm` hub cards (Leads badge 1, CSKH SLA 4…) |
| TC-SCR-CRM-03 | Pass | `/crm/cskh-board` SLA dashboard + Lọc/Bulk UI |
| TC-SCR-B2B-01 | **Pass** (list + kanban) | Retest sau `c1ce1667`: Mới · 4 |
| TC-SCR-B2B-02 | Pass | Tạo lead → `/crm/leads/900000004` |
| TC-SCR-B2B-09/11 | Pass | List + detail `#900000003` pipeline/tabs |

### CSD

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-CSD-01 | Pass | `/crm/csd` tiles + Ticket ưu tiên |
| TC-SCR-CSD-02 | **Pass** (retest) | FIXED — tạo ticket OK |
| TC-SCR-CSD-04 | Blocked | Chat yêu cầu mật khẩu chat riêng («Đăng nhập Chat») |

### AM / Content / Admin

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-AM-01 | Pass | KPI tiles, queue, «Nhận xử lý», sidebar AM |
| TC-SCR-CMKTE-01 | Pass | `cmkte-sidebar` bg `rgb(255,255,255)` |
| TC-SCR-ADM-01 | Pass | Admin hub đầy đủ workspace cards |

### HTTP 200 smoke (không interactive sâu)

`/crm/customers`, `/crm/tickets`, `/crm/operational/leads`, `/crm/health`, `/crm/hub`, `/crm/orders`, `/crm/catalog`, `/crm/sales`, `/crm/b2b-inbox`, `/crm/b2b-speed`, `/crm/b2b-unmatched`, `/crm/proposals*`, `/crm/csd/email|reports`, `/crm/content-os`, `/crm/media-os`, `/crm/creative-os`, `/crm/video`, `/crm/ceo`, `/crm/forecast`, `/crm/kpi-hub*`, `/admin/crm/org/users`, `/admin/crm/permissions`, `/seo/hub`, `/email/hub`, `/meta/facebook-ads`, `/agency`, `/account`, …

---

## Blocked / chưa chạy hết

- MFA, IWR share token, RBAC negative (cần user khác role)
- Chat DM/group (cần mật khẩu chat)
- CRUD sâu: proposals convert, CSD assign/resolve, AM create client, Content request approve, Video SOP steps, SEO/Email/Meta write
- Inventory COMMON × ~364 routes đầy đủ

---

## Next

1. **Xác nhận fix FAIL-1 / FAIL-2 / NOTE-UI?** (có/không từng mục)  
2. Nếu có mật khẩu **Chat CSD** → tiếp TC-SCR-CSD-04/05  
3. Tiếp tục interactive còn lại theo thứ tự mục 3→23 trong file TC

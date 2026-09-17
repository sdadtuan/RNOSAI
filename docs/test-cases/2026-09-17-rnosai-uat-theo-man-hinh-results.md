# UAT kết quả — 2026-09-17-rnosai-tc-theo-man-hinh.md

> **Môi trường:** https://rs.pttads.vn  
> **Role:** SUPER-ADMIN (Quản trị hệ thống) — session user đã login  
> **Tester:** Agent (browser MCP)  
> **Cập nhật:** 2026-09-17

## Tóm tắt

| Trạng thái | Số (ước lượng) |
|------------|---------------:|
| Pass | ~143+ |
| Fail | 0 |
| Blocked / partial | ~12 |
| Not Run (CRUD sâu / role khác / chat pwd) | ~55+ |

**HTTP smoke:** 55+ route P0 → **200**. **Wave-2 client render:** ~95 màn load heading đúng, không Application error.

**Cập nhật wave-2:** 2026-09-17 chiều — interactive/load các màn còn lại (CRM→Admin).  
**Cập nhật CRUD write:** QT + AM + Content Request **Pass**.

---

## FAIL — đã fix / còn lại

### FAIL-3 · TC-SCR-CMKTE-02 (P0) — Tạo Content Request → **FIXED 2026-09-17**

| Mục | Chi tiết |
|-----|----------|
| URL | `/crm/content-os/requests` |
| Seed | POST `/api/crm/service-lifecycle` → lifecycle **#4** · lead `#900000004` · slug `tiep-thi-noi-dung` · stage `lead` / status `draft` |
| AM | Gán AM = `admin@pttads.vn` (crm_staff id 5) trên `/crm/service-delivery/4` (scope Content OS) |
| Root cause (2 lớp) | (1) Thiếu lifecycle seed; (2) Portfolio controller dùng `Number(JWT.sub)` — UUID → NaN → `lifecycle_out_of_scope` |
| Fix API | `content-os-portfolio.controller.ts` resolve staff via `StaffAuthService.resolveCrmStaffUserId` (như CSD/AM) |
| Verify | Request **CR-20260917-001** · lifecycle_id **4** · triage `Submitted` · hiện list Intake |
| Deploy | VPS `ptt-crm-api` — commit + deploy cùng đợt lifecycle-nav fix |

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

### NOTE-UI · Topbar overlap → **FIXED 2026-09-17**

| Mục | Chi tiết |
|-----|----------|
| Root cause | Filter pills global-search luôn in-flow dưới input → topbar cao/co hẹp, pills chồng avatar/bell |
| Fix | Chips overlay dưới input (`:focus-within`); idle topbar 1 hàng; `flex-shrink:0` app/user |
| Verify | Idle topbar **56px**, 0 pills; focus → 7 chips, overlap avatar **0** |
| Deploy | `a8a4b7af` + `0e21e015` · ops-web `ops-web-0e21e015-*` |

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
| TC-SCR-HOME-03 | **Pass** (retest) | Focus search → overlay 7 chips; topbar 56px |
| TC-SCR-HOME-04 | Pass | Bell → panel «Không có thông báo» + Đóng |

### CRM / CSKH / B2B

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-CRM-01 | Pass | `/crm` hub cards (Leads badge 1, CSKH SLA 4…) |
| TC-SCR-CRM-03 | Pass | `/crm/cskh-board` SLA dashboard + Lọc/Bulk UI |
| TC-SCR-CRM-04 | Pass | `/crm/customers` — empty «0 khách hàng» + search |
| TC-SCR-CRM-06 | Pass | `/crm/tickets` — «Ticket CS lite» · 0 ticket |
| TC-SCR-CRM-07 | Pass | `/crm/operational/leads` load 200 |
| TC-SCR-CRM-08 | Pass | `/crm/health` — CS Health score |
| TC-SCR-CRM-09..12 | Pass | hub/orders/catalog/sales load |
| TC-SCR-B2B-01 | **Pass** (list + kanban) | Retest sau `c1ce1667`: Mới · 4 |
| TC-SCR-B2B-02 | Pass | Tạo lead → `/crm/leads/900000004` |
| TC-SCR-B2B-03 | Pass | Inbox B2B |
| TC-SCR-B2B-05 | Pass | Speed-to-lead |
| TC-SCR-B2B-06..08 | Pass | unmatched / gdkd / projects load |
| TC-SCR-B2B-09/11 | Pass | List + detail `#900000003` pipeline/tabs |
| TC-SCR-B2B-12 | Pass | Deal room `#900000004` |
| TC-SCR-B2B-13..18 | Pass | review-queue, handover, spa, solution, intake, sales-kit |

### QT / Proposals

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-QT-01 | Pass | Tổng quan Báo giá |
| TC-SCR-QT-02 | Pass | Danh sách báo giá |
| TC-SCR-QT-03 | **Pass** (write) | Tạo nháp OK → `/crm/proposals/7` · `QT-PTT-2026-000007` · «UAT QT draft CRUD 2026-09-17» |
| TC-SCR-QT-07..09 | Pass | catalog / approvals / reports / settings |

### CSD

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-CSD-01 | Pass | `/crm/csd` tiles + Ticket ưu tiên |
| TC-SCR-CSD-02 | **Pass** (retest) | FIXED — tạo ticket OK |
| TC-SCR-CSD-03 | Pass partial | List tickets OK (PTT-2026-000007…); assign/comment chưa chạy |
| TC-SCR-CSD-04 | Blocked | Chat yêu cầu mật khẩu chat riêng |
| TC-SCR-CSD-06 | Pass | Hộp thư dùng chung |
| TC-SCR-CSD-07 | Pass | email/unmatched load |
| TC-SCR-CSD-08 | Pass | Báo cáo khách hàng |
| TC-SCR-CSD-10 | Pass | templates load |
| TC-SCR-CSD-11 | Pass | `/admin/crm/csd/chat-accounts` |

### AM / Agency / Content / Media / Creative

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-AM-01 | Pass | KPI tiles, queue, sidebar AM |
| TC-SCR-AM-02 | Pass | Clients list + AM shell |
| TC-SCR-AM-03 | **Pass** (write) | Tạo KH → `/crm/account-management/clients/22097a9e-816a-4b5a-a29f-a2f9b9531ccb` · mã `UATAMCLI55` |
| TC-SCR-AM-06..14 | Pass | onboarding/work/renewals/opps/feedback/health/reports/settings |
| TC-SCR-AGY-01..03 | Pass | Agency hub + ingest + jobs (DLQ badge 9) |
| TC-SCR-CMKTE-01 | Pass | sidebar trắng |
| TC-SCR-CMKTE-03..08 | Pass | approvals/calendar/library/intel/settings (load) |
| TC-SCR-CMKTE-02 | **Pass** (write) | Lifecycle **#4** + AM admin · Request **CR-20260917-001** · fix UUID staffId resolve trên portfolio API |
| TC-SCR-MSOS-01..07 | Pass | Media OS command + 6 màn |
| TC-SCR-CP-01 | Pass | Creative OS tổng quan |
| TC-SCR-CP-02 | Pass | projects |
| TC-SCR-CP-04/05 | Pass | ImageOS command + jobs |
| TC-SCR-VD-01 | Pass | Video SOP |

### Delivery / RevOps / CEO / Finance / KPI / IWR / HR

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-DEL-01..03/07 | Pass | marketing-plan, service-delivery, sop, delivery-projects |
| TC-SCR-RES-01 | Pass | research |
| TC-SCR-REV-01 | Pass | Revenue Ops command |
| TC-SCR-CEO-01 | Pass | Điều hành CEO |
| TC-SCR-FIN-01..04 | Pass | forecast / business-dashboard / financials / invoices |
| TC-SCR-KPIH-01/02 | Pass | `/kpi-hub` → executive; marketing/sales load |
| TC-SCR-KPIH-02 NOTE | Note | Tile KPI hiện «Lỗi dữ liệu UNKNOWN» trên vài metric (data trust) — không crash |
| TC-SCR-IWR-01..03 | Pass | hub / inbox / builder |
| TC-SCR-HR-01/03 | Pass | HR Hub + Nhân viên |

### SEO / Email / Ads / Admin

| TC-ID | Kết quả | Ghi chú |
|-------|---------|---------|
| TC-SCR-SEO-01 | Pass | Hub + empty GSC CTA |
| TC-SCR-SEO-02 | Pass | clients |
| TC-SCR-EM-01..03 | Pass | hub / clients / campaigns |
| TC-SCR-META-01 | Pass | Meta Ads Hub (migration gates UI) |
| TC-SCR-GADS-01 | Pass | Google Ads |
| TC-SCR-ZALO-01 | Pass | Zalo Ads |
| TC-SCR-ADM-01 | Pass | Admin hub |
| TC-SCR-ADM-02..04 | Pass | users / departments / permissions matrix |

---

## Blocked / chưa chạy hết

- MFA, IWR share token, RBAC negative (cần user khác role)
- Chat DM/group (cần mật khẩu chat)
- CRUD ghi sâu: QT submit convert, CSD assign/resolve, Content approve, Video SOP steps, SEO/Email/Meta write
- Inventory COMMON × ~364 routes đầy đủ

---

## Next (hỏi trước khi fix / write sâu)

1. **Commit + push** fix Content OS `resolveCrmStaffUserId` (đang live trên VPS, chưa có trên git remote)?  
2. Có mật khẩu **Chat CSD** → TC-SCR-CSD-04/05?  
3. Điều tra NOTE KPI «Lỗi dữ liệu UNKNOWN»?  
4. UAT role non-admin (RBAC)?

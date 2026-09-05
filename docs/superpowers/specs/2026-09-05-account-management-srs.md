# SRS — Account Management OS trên RNOSAI

**Sản phẩm:** RNOSAI / ops-web + ptt-crm-api  
**Tên module:** Account Management OS (AM OS)  
**Tên tiếng Việt:** Quản lý tài khoản khách hàng sau hợp đồng  
**Document ID:** AM-20260905  
**Phiên bản:** 2.0  
**Ngày:** 2026-09-05  
**Trạng thái:** SoT — viết lại từ mockup HTML vận hành + quyết định RNOSAI đã khóa  
**Ngôn ngữ UI:** Tiếng Việt  
**Prod:** `https://rs.pttads.vn` · tenant `PTT`

**Changelog v2.0:** Viết lại toàn bộ. SoT UI = mockup HTML vừa vẽ (enterprise). Bỏ mâu thuẫn v1.0–1.3 (4 KPI / 5-band / nav 7 phẳng). Khóa role + phạm vi + mật độ + parent/child + coverage Director.  
**Changelog v1.3:** (lịch sử) 6 KPI, nav nhóm, 4-band.  
**v1.0–1.2:** Command Center screenshot cũ — **không còn hiệu lực**.

**SoT UI (thứ tự thắng):**

1. [Mockup HTML vận hành](../../design/rnosai-am-os-srs-mockup.html) — layout, copy, control, sample data  
2. Tài liệu này — quy tắc, SoR, API, FR/BR, wave  
3. [Mockup chữ UI-AM-00…32](./sources/Mockup_Account_Management_CRM_da_nganh.md) — bổ sung hành vi từng màn  
4. [PRD đa ngành](./sources/PRD_SRS_Account_Management_CRM_da_nganh.md) — tầm năng; **map vào RNOSAI**, không dựng SaaS thứ hai  

**Plan triển khai đầy đủ (Wave 1–5):** [2026-09-05-account-management-os.md](../plans/2026-09-05-account-management-os.md)  
**Plan Wave 1 (cũ, đã gộp vào plan master):** [2026-09-05-account-management-w1.md](../plans/2026-09-05-account-management-w1.md)

**Tài liệu liên quan (không thay thế):**

| Tài liệu | Vai trò |
|---|---|
| KPI Hub Enterprise SRS | AM **không** là view Hub. Hub có thể deep-link sau. |
| CSD design | Ticket + SLA khách — AM **đọc / link**, không Resolve. |
| IWRS | Báo cáo nội bộ. Không gộp vào AM Reports. |
| Delivery spine / WS2 promote | Nguồn `agency_client` sau Won. AM không thay TMMT/Launch QA. |
| `/crm/health` (AI-UC-017) | Đọc snapshot AM sau Wave 1. Một thang điểm. |
| Consult AM SOP | Pre-sales. Module này **chỉ post-contract**. |

---

## 1. Mục tiêu sản phẩm

AM OS là lớp **giữ · gia hạn · mở rộng · sức khỏe** sau khi khách đã là `agency_client`. AM mở buổi sáng biết: việc nào làm trước, khách nào sắp mất, HĐ nào phải gia hạn, doanh thu nào đang rủi ro.

**Không** giải: soạn/ký HĐ pháp lý, trả ticket thay CSD, giao hàng thay Delivery, timesheet, bidding Ads, CRM lead pre-sales, portal khách (Wave gần).

### 1.1. Vấn đề PTT

| Vấn đề | Hệ quả | Giải trên AM |
|---|---|---|
| Portfolio rải `/agency/clients`, HĐ, CSD, Delivery, `/crm/health` | AM không biết hôm nay làm gì | Dashboard + hàng đợi 2 giờ + watchlist |
| Gia hạn Excel / nhớ | Trễ QBR, mất retainer | Renewal Case + pipeline + forecast |
| Health nhiều nơi, band khác | “Khỏe” bên này, “rủi” bên kia | Một score 4 band + snapshot |
| SLA chỉ trong CSD | AM không ưu tiên khách vỡ cam kết | Thẻ SLA + clock trên việc |
| Upsell nằm chat | Mất expansion | Growth + xác nhận người |
| Director không thấy tải đội | AM quá tải / account mồ côi | Phạm vi Team / Toàn PTT + coverage |
| Tập đoàn nhiều pháp nhân | Sổ phẳng, mất ngữ cảnh | Parent / child account |

---

## 2. Quyết định khóa

| # | Quyết định | Chọn |
|---|---|---|
| Q1 | App tách? | **Không.** `/crm/account-management*`. Cùng login, RBAC, OpsNav. |
| Q2 | View KPI Hub? | **Không.** `AmShell` riêng. Cấm `<main>` lồng (bug cream-gap). |
| Q3 | SoR khách | **`agency_client`**. Ext `crm_am_account_ext`. Không master thứ hai. |
| Q4 | SoR HĐ | **`crm_contracts`**. AM không xóa / không sửa amount / terms. |
| Q5 | SoR ticket/SLA | **CSD**. AM link, không clone, không Resolve từ AM. |
| Q6 | Health | **Một công thức**, 4 band. Snapshot. `/crm/health` đọc cùng nguồn. |
| Q7 | Việc AM vs CSD vs IWRS | AM = chăm sóc / QBR / gia hạn / mở rộng. CSD = yêu cầu khách. IWRS = nội bộ. |
| Q8 | Tạo khách | Drawer/form AM → `createAgencyClient` + ext. Tab **Gắn đã có**. Không khách ma. |
| Q9 | Tạo kế hoạch | `crm_am_plans` + việc seed. Không tạo Delivery project / HĐ. |
| Q10 | Token UI | Navy `#0F2747` · Accent `#2563EB` · Success `#16A34A` · Warning `#D97706` · Danger `#DC2626` · Info `#0891B2` · bg `#F7F8FA` · radius 10–12 · desktop 1440. Class `am-*`. Font Be Vietnam Pro / system. |
| Q11 | AI | **Tắt mặc định.** Khi bật: draft + evidence + người xác nhận. Không ghi ngầm. |
| Q12 | Tenant / portal | Một `PTT`. Portal khách không Wave 1–4. |
| Q13 | Search | ⌘K thật trong module. Bell = notify in-app. Không badge PRODUCTION giả. |
| Q14 | Sidebar | **Nhóm** TỔNG QUAN / KHÁCH HÀNG / CÔNG VIỆC / HỢP ĐỒNG / PHÂN TÍCH / CẤU HÌNH. Product **không** badge đếm trên nav (mockup demo có — bỏ khi code). |
| Q15 | Dashboard KPI | **Đúng 6 thẻ:** Khách active · MRR · Gia hạn 90 ngày (giá trị + số case) · Revenue at risk · SLA quá hạn (số) · CSAT. |
| Q16 | Health band | Healthy 80–100 · Watch 60–79 · At Risk 40–59 · Critical 0–39. |
| Q17 | Công thức | 30 KPI Delivery · 20 Engagement · 20 Financial · 15 Satisfaction · 15 Contract & Support. Tổng 100. |
| Q18 | Account 360 | 10 tab. SoR vẫn `agency_client`. Parent/child. Đa HĐ. |
| Q19 | Renewal Case | `crm_am_renewal_cases`. Job 90/60/30/14/7/1. Một HĐ Active một case mở. Lost/Churned bắt buộc lý do. |
| Q20 | Work item | Task / Client Request / Issue / Escalation / Approval / Milestone. Request **link** CSD. |
| Q21 | Timeline | `crm_am_interactions` + event hệ (HĐ, health, invoice, CSD). Không thay CSD chat. |
| Q22 | Onboarding | Handover Sales→AM + workspace checklist. Tái dùng agency onboard. |
| Q23 | Finance | Snapshot đọc. ERP SoR nếu có. AM không sửa trạng thái thanh toán. |
| Q24 | Feedback | Wave 4. Thẻ CSAT = `—` nếu chưa có survey. |
| Q25 | Đa ngành | Custom field + scorecard theo `industry`. Không form-builder tự do Wave 1. |
| Q26 | Role vận hành | **AM / Director / Admin** (đúng toolbar mockup). Role = cap + job function, không dropdown giả trên prod — UI hiện role thật. |
| Q27 | Phạm vi dữ liệu | **Của tôi / Team / Toàn PTT**. `view` = của tôi; Lead team = team; `view_all` = toàn PTT. |
| Q28 | Mật độ bảng | Thoáng / Gọn. Lưu preference user. |
| Q29 | Hierarchy | Account **parent / child** (Tập đoàn → pháp nhân). Rollup MRR/health tùy Settings (mặc định: child có score riêng; parent hiện dải). |
| Q30 | Coverage Director | Widget: tải AM (account/quota), chưa gán owner, ủy quyền khi nghỉ, QBR tuần. |
| Q31 | CTA header | `+ Tạo mới ▾`: Khách · Việc · Renewal/Plan · Cơ hội · Log tương tác. |
| Q32 | Số mockup | Sample only. Runtime `—` nếu thiếu. Cấm hard-code 48 / 1,28 tỷ / 1.248. |
| Q33 | Media spend | **Không** vào MRR / ARR / doanh thu quản lý PTT. |

---

## 3. Phạm vi

### 3.1. Trong scope

Mọi màn UI-AM-00…32 + M01 trên mockup HTML, chia wave §16. Chrome: topbar, sidebar nhóm, phạm vi, mật độ, palette, notify, drawer/modal.

### 3.2. Ngoài scope

App AM tách · KPI Hub CRUD · soạn/ký HĐ · Resolve CSD · IWRS · Delivery TMMT · Ads/Portal tab · multi-tenant · multi-currency (Wave 5) · AI auto-write · client portal (Wave 5).

### 3.3. Bản đồ hệ thống

```text
ops-web
├── /agency/clients*           SoR khách          → AM đọc/ghi mỏng (create wrap)
├── crm_contracts              SoR HĐ             → catalog + renewal
├── /crm/csd/tickets           SoR ticket/SLA     → đọc + link
├── /crm/delivery-projects     Giao hàng          → đếm / deep-link
├── /crm/health                Vỏ cũ              → đọc snapshot AM
├── /crm/kpi-hub/*             Command tổ chức    → tile deep-link (sau)
└── /crm/account-management*   ★ Module này
```

---

## 4. Người dùng, quyền, phạm vi

### 4.1. Persona → cap

| Persona mockup | Cap | Phạm vi mặc định |
|---|---|---|
| AM — Nguyễn Minh | `crm_am.view` + `edit` | Của tôi (owner hoặc assignee việc) |
| Team Lead HCM | `view` + `assign` trên team | Team |
| Director — Phạm Quang | `view_all` + `assign` + escalate | Toàn PTT; chọn Team |
| Admin CRM | `manage` + settings/field/SLA/scorecard | Toàn PTT |
| Finance/AR | `crm_am.finance` | Snapshot tài chính |
| Delivery | `view` khách chung dự án | Không đổi owner / không Lost |
| Board | `view_all` đọc dashboard/report | Toàn PTT |

**Caps:** `crm_am`: `view` · `view_all` · `edit` · `assign` · `manage`. `crm_am.finance`: `view`.

Thiếu `view`/`view_all` → **403** trên `/crm/account-management*`.  
`view` không thấy account/task ngoài scope.  
Đổi owner cần `assign` + lý do + audit.  
Override health / publish scorecard / custom field / SLA policy cần `manage`.

### 4.2. Phạm vi (Q27)

| Giá trị | Ai chọn được | Filter |
|---|---|---|
| `me` | Mọi user | `account_owner_staff_id = me` **hoặc** task assignee = me |
| `team` | Lead / Director / Admin | Team org (HCM / HN / Đà Nẵng…) |
| `all` | `view_all` | Tenant PTT |

Đổi phạm vi **tải lại** KPI, watchlist, sổ, queue. Việc “hôm nay” theo phạm vi (AM thấy việc của mình; Director thấy inbox đội nếu chọn team/all).

### 4.3. Tải & ủy quyền

- Quota mặc định 40 account / AM (Settings). Quá quota → badge “quá tải” trên sổ / coverage.  
- Ủy quyền: AM nghỉ → backup nhận việc mở + dashboard `me` của người nhận, có nhãn “ủy quyền đến {ngày}”.  
- Account `owner = null` chỉ Director/Admin thấy trong view **Chưa gán**.

---

## 5. Chrome & thông tin kiến trúc

### 5.1. Topbar (mọi màn)

| Control | Hành vi |
|---|---|
| ☰ | Thu gọn sidebar còn icon + tooltip |
| `RNOSAI PTT · AM` | Không giả logo. Click → Dashboard |
| Search | Mở palette UI-AM-00. Placeholder: `Tìm account, HĐ, contact, task, renewal…` |
| Freshness | `Đồng bộ {HH:mm}` · `Giờ LV còn {XhYm}` theo lịch VN 08:30–17:30 T2–T6. Stale > ngưỡng → banner vàng |
| 🔔 | UI-AM-31. Dot nếu có chưa đọc. **Không** hard-code 5 |
| ❔ | Help / SOP (link docs). Wave 1 có thể ẩn |
| Avatar | Tên + role thật |

**Không** vẽ thanh “Nhảy màn / Toàn catalog” trên prod — đó là control **demo HTML**.

### 5.2. Sidebar nhóm (Q14)

```text
TỔNG QUAN     Dashboard
KHÁCH HÀNG    Danh sách · Onboarding
CÔNG VIỆC     Work Queue
HỢP ĐỒNG      Gia hạn
PHÂN TÍCH     Báo cáo · Health & Risk
CẤU HÌNH      Cấu hình
```

Footer sidebar: tên user · role · `tải {n}/{quota}` nếu quá.

Route (prefix `/crm/account-management`):

| Nav | Path | Wave mở thật |
|---|---|---|
| Dashboard | `/` | 1 |
| Danh sách | `/clients` · `/clients/[id]` | 2 (W1 placeholder) |
| Onboarding | `/onboarding` · `/onboarding/[id]` | 2 |
| Work Queue | `/work` · `/work/[id]` | 3 (W1: nhận việc trên Dashboard) |
| Gia hạn | `/renewals` · `/renewals/[id]` | 2 |
| HĐ chi tiết | `/contracts/[id]` | 2 |
| Báo cáo | `/reports` | 4 |
| Health & Risk | `/health` · `/health/[id]` | 3 |
| Cấu hình | `/settings` | 2 policy + 4 field/SLA |
| Feedback | `/feedback` | 4 |
| Opportunities | `/opportunities` | 4 |

Wave chưa tới: **không 404** — title đúng + “Mở ở Wave n”.

### 5.3. Badge chuẩn

| Domain | UI | Màu |
|---|---|---|
| Healthy / Watch / At Risk / Critical | Khỏe mạnh / Cần theo dõi / Có rủi ro / Nghiêm trọng | xanh / vàng / cam / đỏ |
| SLA | Trong SLA / Sắp quá hạn / Vi phạm SLA | xanh / vàng / đỏ |
| Renewal | Đúng kế hoạch / Cần xử lý / Rủi ro mất HĐ | xanh / vàng / đỏ |
| Task | Mới / Đang xử lý / Chờ khách / Chờ nội bộ / Đã xử lý / Đã hủy / Quá hạn | xám / xanh dương / tím / xám xanh / xanh / xám / đỏ |

Pill **có chữ**, không chỉ màu (NFR a11y).

### 5.4. Empty / lỗi / dirty

- Widget lỗi: giữ chiều cao + Retry. Không sập trang.  
- Empty dashboard: CTA Tạo khách / Import (nếu `edit`).  
- Empty việc hôm nay: “Bạn đã xử lý xong các việc ưu tiên hôm nay.”  
- Form dirty rời trang → confirm.  
- Action nguy hiểm (Lost, Archive, Từ chối handover) → modal + lý do.

---

## 6. Mô hình nghiệp vụ

### 6.1. Thực thể

| Thực thể | Lưu | Ghi chú |
|---|---|---|
| Account | `agency_client` + `crm_am_account_ext` | `parent_agency_client_id` trên ext |
| Contact | Contact agency; bổ sung `crm_am_contacts` nếu thiếu role/sentiment | ≥1 contact chính khi Active |
| Contract | `crm_contracts` | Chỉ đọc pháp lý |
| AM Plan | `crm_am_plans` | care / qbr / renewal / expand |
| Work item | `crm_am_tasks` (W3 nâng work_items) | `source` + `source_ref` unique khi mở |
| Renewal Case | `crm_am_renewal_cases` | 1 mở / HĐ Active |
| Opportunity | `crm_am_opportunities` | Chỉ khách đã convert |
| Health snapshot | `crm_am_health_snapshots` | as_of + components + scorecard version |
| Interaction | `crm_am_interactions` | meeting/call/note/email |
| Risk | `crm_am_risks` | |
| Recovery plan | `crm_am_recovery_plans` | Bắt buộc Critical |
| Onboarding case | `crm_am_onboarding_cases` | Snapshot template |
| Saved view | `crm_am_saved_views` | ≤10 / user; shared cần manage/lead |
| Settings | `crm_am_settings` | 1 hàng / tenant |
| Audit | `crm_am_audit` | owner, override, churn, plan, accept |

```text
agency_client 1──1 crm_am_account_ext
agency_client 1──* agency_client (children)
agency_client 1──* crm_contracts 1──0..1 crm_am_renewal_cases (open)
agency_client 1──* crm_am_plans 1──* crm_am_tasks
agency_client 1──* crm_am_tasks 0..1── CSD ticket (link)
agency_client 1──* crm_am_opportunities
agency_client 1──* crm_am_health_snapshots
agency_client 1──* crm_am_risks 0..1── crm_am_recovery_plans
```

### 6.2. Vòng đời account

```text
Pending Handover → Onboarding → Active → At Risk → Renewing → Churned
                         ↘ Paused
```

**Active book** (KPI Khách active): Onboarding + Active + At Risk + Renewing + Paused. **Không** Churned.

`At Risk` (lifecycle) ≠ band At Risk — lifecycle có thể Active trong khi band Watch.

### 6.3. Doanh thu

| Metric | Định nghĩa | Cấm |
|---|---|---|
| **MRR** | Σ recurring / tháng của HĐ Active (+ Renewing) trong phạm vi. Project không nhân 12; badge `project` | Media spend, lead pipeline |
| **Giá trị HĐ active** | Σ `amount_vnd` HĐ Active | Bịa tỷ |
| **Gia hạn 90 ngày** | Σ recurring còn lại (hoặc giá trị HĐ) của HĐ Active `ends_on ∈ [as_of, as_of+90d]` + **số case** | Đếm khách (1 khách nhiều HĐ = nhiều) |
| **Revenue at risk** | Σ recurring của account band **At Risk ∪ Critical** trong phạm vi | Cộng Watch |
| **Δ** | Cùng công thức kỳ liền trước cùng độ dài. Thiếu → ẩn Δ | Hiện 0% giả |

Đơn vị: ≥ 1e9 → `tỷ`; ≥ 1e6 → `tr`; else VND.

### 6.4. Health

```
score = 0.30×KPI Delivery + 0.20×Engagement + 0.20×Financial
      + 0.15×Satisfaction + 0.15×Contract & Support
```

Settings đổi weight (tổng 100) + ngưỡng band (không chồng). Publish = version mới; snapshot cũ giữ version.

| Score | Band | Copy |
|---|---|---|
| 80–100 | healthy | Khỏe mạnh |
| 60–79 | watch | Cần theo dõi |
| 40–59 | at_risk | Có rủi ro |
| 0–39 | critical | Nghiêm trọng |

Thiếu nguồn thành phần → điểm trung tính 70 + badge “dữ liệu mỏng” (khách < 30 ngày Active luôn có badge).  
Override: `manage` + lý do + hết hạn ≤ 30 ngày + banner.  
**Critical** bắt buộc Recovery Plan mở (trừ Director override có lý do).  
Job: đêm 02:00 ICT + debounce khi HĐ/ticket/owner đổi. `POST /health/recompute` = `manage`.

### 6.5. Watchlist / “Account cần chú ý”

Vào list nếu **một** điều kiện:

1. Band At Risk hoặc Critical  
2. `ends_on` ≤ cửa sổ watch (mặc định 30 ngày) chưa Renewed  
3. SLA CSD at_risk / breached trên ticket In Scope mở  
4. Score giảm ≥ `health_drop_alert` (mặc định 10) so với snapshot trước  

Sort: Critical → At Risk → SLA breach → `ends_on` tăng → MRR giảm.

### 6.6. Việc hôm nay / 2 giờ tới

Hợp nhất, **không trùng** `source+source_ref`:

1. Work item due hôm nay (ICT) hoặc quá hạn chưa đóng / chưa dismiss  
2. Gợi ý chưa thành task: HĐ ≤ 14 ngày; CSD at-risk chưa có việc AM  

**Nhận xử lý / Nhận việc:** gán current user, `in_progress`, audit, toast.  
Chip: Quá hạn / Hôm nay / Sắp hạn / Chưa nhận.

### 6.7. AM Plan

| Kind | Bắt buộc | Xong khi |
|---|---|---|
| `qbr` | Tier A / strategic: 1 / quý | Biên bản + ngày QBR kế |
| `renewal` | HĐ vào cửa sổ 90 ngày | HĐ mới/amendment **hoặc** Lost + lý do |
| `care` | Band At Risk / Critical | Score ≥ 60 hoặc escalate Director |
| `expand` | Từ opportunity | Opportunity Won/Lost |

`renewal` bắt buộc `contract_id`. Unique `(client, kind, period_key)` → 409.

### 6.8. Renewal Case

Tạo auto tại 90/60/30/14/7/1 ngày trước `ends_on` nếu chưa có case mở.  
Forecast: Committed / Likely / Risk / Unlikely + %.  
Kéo kanban: bắt buộc cập nhật forecast + next action.  
Không kéo **Renewed** nếu chưa link HĐ/phụ lục (trừ override).  
Không kéo **Lost/Churned** nếu thiếu reason + ngày + lessons.  
Paused = tạm dừng case, HĐ vẫn Active.

### 6.9. Work item & SLA AM

**Loại:** Task · Client Request · Issue · Escalation · Approval · Milestone.  
**Status:** New · In Progress · Waiting Client · Waiting Internal · Resolved · Closed · Cancelled.  
SLA: First response + Resolution; **pause** Waiting Client (nếu policy); escalate 70% Team Lead · 90% Director · 100% Executive.  
Waiting Client: lý do + evidence đã gửi khách.  
Resolved: summary; complaint thêm resolution category.  
Escalate: cấp + người nhận + tóm tắt — **không** Resolve CSD.

### 6.10. Retention (báo cáo)

```
Logo Retention = còn lại cuối kỳ / đầu kỳ  (không tính khách mới vào mẫu số)
GRR = (Start − Churn − Contraction) / Start
NRR = (Start − Churn − Contraction + Expansion) / Start
```

Thiếu phân loại expansion → ẩn NRR, hiện Logo + chú thích.

### 6.11. SLA% CSD (thẻ / báo cáo)

```
mẫu = ticket CSD In Scope, created trong kỳ, có due
đúng hạn = response_on_time AND resolve_on_time
```

Thẻ Dashboard Wave 1 = **số quá hạn** (count), không bắt buộc %. Mẫu < 5 → badge “mẫu nhỏ”.

---

## 7. Catalog màn hình (SoT = mockup HTML)

Mỗi mục: mục tiêu · thành phần · hành vi · nghiệm thu. Sample data trên HTML (An Phú, Bloom Spa, EduNext, Green Home…) chỉ để đọc mockup.

### UI-AM-00 — Command palette

**Mục tiêu:** Mở Account / Contact / Contract / Renewal / Task từ mọi màn.  
**Hành vi:** ⌘/Ctrl+K < 200ms; debounce 250–350ms; ≥ 2 ký tự; exact code trước full-text; scope + field permission; empty + CTA tạo nếu `edit`.  
**AC:** Không trả record ngoài quyền. Enter mở. Esc đóng.

### UI-AM-01 — Bàn làm việc hôm nay (Dashboard)

**Route:** `/crm/account-management`  
**Header:** title `Bàn làm việc hôm nay` · subtitle ngày + phạm vi + `tải n/quota` + saved view · `[Kỳ ▾] [Bộ lọc] [Lưu view] [+ Tạo mới ▾]`.

**6 KPI** (click → list đã filter):

| Thẻ | Click |
|---|---|
| Khách hàng active | `/clients` scope hiện tại |
| MRR hiện tại | `/clients?sort=mrr` hoặc báo cáo |
| Gia hạn 90 ngày | `/renewals?window=90` |
| Revenue at risk | `/health?band=at_risk,critical` |
| SLA quá hạn | `/work?sla=breached` |
| CSAT | `/feedback` (W4; W1 `—`) |

**Director-only** (phạm vi team/all): coverage — tải TB, chưa gán, ủy quyền, QBR tuần.

**Hàng 2:** Hàng đợi 2 giờ tới (Nhận việc / Xử lý ngay / Soạn agenda) | Account cần chú ý + sort Health/Doanh thu/Gia hạn.

**Hàng 3:** Forecast stacked Committed/Likely/Risk/Unlikely (click đoạn → pipeline) | Phân bố 4 band + TB + Δ.

**Hàng 4:** Sổ khách đang giữ — parent/child, logo, health, MRR, GH, next action. Sort Critical → Risk → SLA → ngày GH. Lưu view / Export (async nếu >10k).

**AC:** Không hard-code số. Widget lỗi độc lập. `from/to` đổi KPI + forecast + health + sổ; **không** đổi hàng đợi hôm nay.

### UI-AM-02 — Danh sách khách

**Saved views chip:** Tất cả · Của tôi · Cần chú ý · Gia hạn 90 ngày · Chưa gán owner · Parent group.  
**Filter:** tên/mã/MST/SĐT/email, owner, team, health, lifecycle, ngành, + bộ lọc. Sort server. 50/trang. Sticky header. Cột theo quyền.  
**Bulk:** Đổi Owner (lý do *, giữ secondary, chuyển task) · Tag · Tạo task · Export · Bỏ chọn.  
**Hàng:** checkbox, identity + parent/child, owner (kể cả “ủy quyền”, “chưa gán”), team, lifecycle, health, MRR, GH, SLA.  
**AC:** Churned ẩn mặc định. Import không đè khách Won chưa handover. URL giữ filter.

### UI-AM-03 — Account 360 Overview

**Header:** tên · Active · Health badge (click → UI-AM-20) · mã · ngành · tier · team · Owner ▾ · Delivery · Media.  
**Quick action:** Log tương tác · Tạo việc · Tạo rủi ro · Bắt đầu gia hạn · Tạo cơ hội · Hỏi AI (flag) · `⋮` (sửa, contact, đổi owner, lifecycle, archive, merge Admin, audit).  
**10 tab:** Tổng quan · Timeline · Dự án & dịch vụ · Công việc · Hợp đồng & Tài chính · Health & Risk · Cơ hội · Phản hồi · Tài liệu · Audit.  
**Overview:** định danh + MST + vùng; Success Plan + meter KPI; đa HĐ; hành động cần làm; contact chính; tóm tắt tài chính.  
**AC:** Không tab Ads/Portal. Deep-link `/agency/clients/[id]`. Parent hiện danh sách con.

### UI-AM-04 — Timeline

Filter loại / user / khoảng. Composer: ghi chú, log gọi, log họp, tạo task, đính kèm. Event System không sửa nguồn. Meeting → có thể tick action item thành task.

### UI-AM-05 — Tạo / sửa khách

Full page. Khối: định danh * · sở hữu/vận hành · contact (≥1, flag chính) · custom field theo ngành (BĐS: dự án, lead/tháng) · tags.  
CTA: Hủy · Lưu nháp · Lưu và tạo onboarding · Lưu.  
Mã khách tự sinh. `create` wrap agency API. `attach` không tạo client mới.

### UI-AM-06 — Contact drawer

Họ tên, role buying committee, sentiment, kênh (Gọi / Email / Zalo), renewal attitude, lịch sử tương tác.

### UI-AM-07 — Handover Sales→AM

4 bước: Thương mại → Scope & KPI → Stakeholder → Xác nhận.  
Checklist AM * trước “Xác nhận nhận bàn giao”. Từ chối / bổ sung bắt buộc lý do.  
Accepted → Onboarding case + lifecycle Onboarding.

### UI-AM-08 — Onboarding workspace

% · Go-live · owner AM/Delivery · On Track. Nav: Tổng quan / Checklist / Milestones / Stakeholders / Tài liệu / Activity.  
Go-live modal: required xong hoặc override; cảnh báo nếu dashboard chưa có data 24h.

### UI-AM-09 — Onboarding template

Admin. Version published. Item: giai đoạn, owner mặc định, hạn T+n, required. Không sửa published — clone draft.

### UI-AM-10 — Hợp đồng

Tab: Tổng quan · Dịch vụ & giá · Lịch TT · Gia hạn · Phụ lục · Tài liệu · Audit.  
Line items + nghĩa vụ (có thể sinh recurring work). Amendment nếu HĐ đã Active. Finance read-only nếu không `crm_am.finance` write (AM không có write finance).

### UI-AM-11 — Renewal pipeline

Kanban 4 cột: Chưa bắt đầu · Đang đánh giá · Đàm phán · Đã quyết định. Header: renewable · weighted · at risk. Card: MRR, ngày còn, health, owner, next. List + Export.

### UI-AM-12 — Renewal Case

Forecast, giá trị, kỳ, next action *, stakeholder, health snapshot, timeline.  
CTA: Renewed (cần HĐ) · Lost/Churned modal (reason *, ngày *, lost MRR, phục hồi?, lessons *).

### UI-AM-13 — Financial snapshot

Nguồn + last sync. KPI: MRR, tổng active, công nợ, quá hạn, invoice sắp hạn. Bảng invoice + aging. CTA ERP. Banner stale. **Không** nút sửa Paid/Issued.

### UI-AM-14 — Work Queue

Inbox: của tôi / team / chưa gán. List + Board + Calendar tuần. SLA clock. Bulk nhận. Unique `source_ref`.

### UI-AM-15 — Work item detail

Banner đỏ nếu breached. Nội dung, comment, action items | status, assignee, SLA, link HĐ/risk/renewal/CSD.  
Chờ khách / Resolved / Escalate.

### UI-AM-16 — Tạo việc (modal)

Loại, account *, title *, priority, assignee *, due, SLA policy, link, watchers, file.

### UI-AM-17 — Log họp / tương tác

Loại, thời gian, người tham gia *, sentiment, visibility, tóm tắt *, action items (AI chỉ draft), đính kèm. Lưu → tạo task đã tick.

### UI-AM-18 — Escalate

Cấp * · lý do * · tóm tắt * · đề xuất · người nhận. Không đổi status CSD.

### UI-AM-19 — Health & Risk Center

6 thẻ band + revenue at risk + open risks. Line 6 tháng. Tín hiệu phổ biến. Bảng account rủi ro + % recovery. Export. Cấu hình scorecard (`manage`).

### UI-AM-20 — Health detail

Thành phần + trọng số + đóng góp + trend. Signals +/−. Khuyến nghị + Tạo draft (AI flag). Tính lại / Override.

### UI-AM-21 — Tạo risk

Danh mục, severity, P×I, mô tả evidence *, owner, hạn, mitigation, link.

### UI-AM-22 — Recovery plan

Mục tiêu, RCA, action  + tiến độ, exit criteria. Không đóng nếu thiếu outcome + lesson.

### UI-AM-23 — Scorecard config

Weight 100%, ngưỡng không chồng, versioning. Validate trước publish.

### UI-AM-24 — Growth

Pipeline / weighted / won tháng. AI suggestion **Xem evidence + Tạo draft** (không tự tạo).

### UI-AM-25 — Tạo opportunity

Account *, loại, gói, giá trị, xác suất, next step *. Nguồn AI phải lưu evidence.

### UI-AM-26 — Feedback

CSAT / NPS / response / complaints. Follow-up → tạo task. Link complaint → work/CSD.

### UI-AM-27 — Tạo survey campaign

Template, kênh, đối tượng, lịch, no-recontact, rule CSAT ≤ 3 → task 24h.

### UI-AM-28 — Reports Retention & Renewal

Logo / GRR / NRR / Churned MRR / Expansion. Cohort heatmap. Forecast stacked. Churn reasons. Retention theo owner/team. Mọi chart drill-down. Tooltip công thức. Watermark freshness.

### UI-AM-29 — Custom fields

List + drawer: label, api key, type, điều kiện ngành, required, filter/report, min/max, field-level access.

### UI-AM-30 — SLA policy

First response / resolution business time, pause, escalate 70/90/100, lịch VN + holiday.

### UI-AM-31 — Notification center

4 loại mẫu mockup: SLA breach, renewal sắp hết, health drop, invoice paid. Đánh dấu đã đọc. Click → record.

### UI-AM-32 — AI drawer

Tóm tắt / giải thích health / QBR / follow-up. Evidence. 👍👎. Prompt. **Mọi Tạo task/draft mở form prefilled.** Label “AI đề xuất” đến khi xác nhận.

### UI-AM-M01 — Mobile quick view

MRR · ngày GH · task mở · cần xử lý · contact (Gọi/Email/Zalo) · activity · Log / Tạo task. Không cấu hình / bulk / report phức tạp.

---

## 8. Hành động (product)

| ID | Control | Cap | Wave |
|---|---|---|---|
| ACT-001 | ⌘K | view | 1 |
| ACT-002 | Đổi kỳ / phạm vi / mật độ | view | 1 |
| ACT-003 | + Tạo mới ▾ | edit | 1 (cơ hội/log = 3–4 disable + tooltip) |
| ACT-004 | Tạo khách / gắn đã có | edit + agency write | 1 |
| ACT-005 | Tạo plan / renewal | edit | 1 |
| ACT-006 | Tạo việc | edit | 1 |
| ACT-007 | Nhận xử lý / nhận hàng loạt | edit | 1 |
| ACT-008 | Dismiss gợi ý `source_ref` | edit | 1 |
| ACT-009 | Lưu view | view; shared = lead/manage | 2 |
| ACT-010 | Export | view; finance cột cần finance | 2 |
| ACT-011 | Import CSV | edit | 2 |
| ACT-012 | Bulk đổi owner | assign | 2 |
| ACT-013 | Sửa 360 / contact | edit | 2 |
| ACT-014 | Handover xác nhận / từ chối | edit | 2 |
| ACT-015 | Go-live | edit / director | 2 |
| ACT-016 | Bắt đầu gia hạn | edit | 2 |
| ACT-017 | Forecast / Renewed / Lost | edit | 2 |
| ACT-018 | Log tương tác | edit | 3 |
| ACT-019 | Escalate | edit | 3 |
| ACT-020 | Tạo risk / recovery | edit | 3 |
| ACT-021 | Override health | manage | 2 |
| ACT-022 | Recompute health | manage | 1 |
| ACT-023 | Tạo opportunity | edit | 4 |
| ACT-024 | Survey | edit | 4 |
| ACT-025 | Publish scorecard / field / SLA | manage | 2–4 |
| ACT-026 | Hỏi AI | flag + view | 5 |
| ACT-027 | Archive / merge | manage | 2 |

Mọi ghi → `crm_am_audit`.

---

## 9. API

Prefix: `/api/crm/am`. JWT staff + `StaffAmGuard`.

| Method | Path | Việc | Cap |
|---|---|---|---|
| GET | `/command-center?from&to&scope=` | Dashboard | view |
| GET | `/search?q=` | Palette | view |
| GET | `/accounts` | List | view |
| POST | `/accounts` | create \| attach | edit |
| GET/PATCH | `/accounts/:agencyClientId` | Ext + overview | view / edit |
| POST | `/accounts/transfer` | Bulk owner | assign |
| GET | `/contracts` | Catalog HĐ | view |
| GET | `/contracts/:id` | Chi tiết đọc | view |
| POST | `/plans` | Tạo plan | edit |
| GET/POST | `/tasks` | List / tạo | view / edit |
| POST | `/tasks/:id/accept` | Nhận | edit |
| POST | `/tasks/dismiss` | Bỏ gợi ý | edit |
| GET | `/renewals` | Pipeline | view |
| GET/POST/PATCH | `/renewals/:id` | Case | view / edit |
| GET | `/finance/:agencyClientId` | Snapshot | finance hoặc view (ẩn số) |
| GET | `/health` | Risk center | view |
| POST | `/health/recompute` | Job | manage |
| GET/PUT | `/settings` | GET mọi view; PUT manage | |
| GET/POST | `/opportunities` | Wave 4 | |
| GET | `/reports/:id` | Wave 4 | |
| GET | `/notifications` | Bell | view |

Mọi list: `scope`, cursor/page, sort. PII theo field-level.  
**NFR:** command-center p95 < 800ms khi Active book ≤ 500 (1 query tổng hợp + cache 60s).

---

## 10. Yêu cầu chức năng

| ID | Yêu cầu | Wave | P |
|---|---|---|---|
| FR-001 | Thiếu cap → 403 | 1 | P0 |
| FR-002 | Dashboard đủ khối §7 UI-AM-01; null → `—` | 1 | P0 |
| FR-003 | Kỳ đổi KPI + forecast + health + sổ; không đổi hàng đợi hôm nay | 1 | P0 |
| FR-004 | Phạm vi me/team/all đúng filter | 1 | P0 |
| FR-005 | ⌘K scope-safe | 1 | P1 |
| FR-006 | Tạo khách wrap agency; không master mới | 1 | P0 |
| FR-007 | Tạo plan + seed; renewal cần HĐ; 409 trùng kỳ | 1 | P0 |
| FR-008 | Nhận việc gán me + audit; unique source_ref | 1 | P0 |
| FR-009 | Health 4 band + weights 30/20/20/15/15 | 1 | P0 |
| FR-010 | OpsNav “Account Management” khi có cap | 1 | P0 |
| FR-011 | Sidebar nhóm §5.2; không badge đếm product | 1 | P0 |
| FR-012 | Route con không 404 | 1 | P0 |
| FR-013 | CTA + Tạo mới; thiếu edit → disable + tooltip | 1 | P0 |
| FR-014 | Collapse sidebar icon + tooltip | 1 | P1 |
| FR-015 | List cột/filter/saved view/bulk owner | 2 | P0 |
| FR-016 | 360 10 tab + parent/child + đa HĐ | 2 | P0 |
| FR-017 | Handover + onboard + Go-live | 2 | P0 |
| FR-018 | Catalog HĐ đọc; không sửa amount | 2 | P0 |
| FR-019 | Renewal pipeline + case + Lost reason | 2 | P0 |
| FR-020 | Settings weight = 100; không manage = đọc | 2 | P0 |
| FR-021 | Work queue + SLA clock + CSD link | 3 | P0 |
| FR-022 | Timeline + log họp | 3 | P0 |
| FR-023 | Risk + recovery Critical bắt buộc | 3 | P0 |
| FR-024 | Escalate không Resolve CSD | 3 | P0 |
| FR-025 | SLA% AM vs CSD lệch > 0.1pp cùng filter = bug | 3 | P0 |
| FR-026 | Opportunity 5 stage; Won không insert HĐ | 4 | P0 |
| FR-027 | Reports Logo/GRR/NRR + drill-down | 4 | P1 |
| FR-028 | Finance snapshot + stale banner | 4 | P0 |
| FR-029 | Feedback + survey rule | 4 | P1 |
| FR-030 | Industry fields | 4 | P1 |
| FR-031 | AI draft + evidence + confirm | 5 | P2 |
| FR-032 | Mobile M01 | 5 | P2 |

---

## 11. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-001 | SoR khách = `agency_client` |
| BR-002 | SoR HĐ = `crm_contracts`; cấm xóa/sửa pháp lý từ AM |
| BR-003 | SoR ticket = CSD; không Resolve / không clone |
| BR-004 | Media không vào MRR/ARR PTT |
| BR-005 | Một owner AM tại một thời điểm (secondary tùy chọn khi transfer) |
| BR-006 | HĐ vào cửa sổ 90 ngày → Plan renewal hoặc case |
| BR-007 | Một công thức health; không 2 thang |
| BR-008 | 4 band §6.4; donut không 5 lát |
| BR-009 | Empty → `—`, không `0` giả, không số mockup |
| BR-010 | Mọi API list/detail áp scope |
| BR-011 | Consult/pre-sales không tạo việc AM OS |
| BR-012 | AI tắt mặc định; không panel ghi dữ liệu |
| BR-013 | Churned không vào Active book / donut |
| BR-014 | Δ thiếu kỳ trước → ẩn |
| BR-015 | Opportunity chỉ khách đã convert |
| BR-016 | Product nav không badge đếm |
| BR-017 | Health chỉ khách đã convert; <30 ngày + “dữ liệu mỏng” |
| BR-018 | Một HĐ Active một Renewal Case mở |
| BR-019 | Lost/Churned bắt buộc reason + ngày |
| BR-020 | Critical bắt buộc recovery (trừ override Director) |
| BR-021 | Waiting Client pause SLA nếu policy |
| BR-022 | Parent/child: child có owner/score riêng trừ Settings rollup |
| BR-023 | Export >10k async + notify |
| BR-024 | Unsaved leave confirm |

---

## 12. Phi chức năng

| ID | Yêu cầu |
|---|---|
| NFR-001 | Command-center p95 < 800ms ≤ 500 account (cache 60s) |
| NFR-002 | Health job 500 account < 2 phút |
| NFR-003 | Desktop ≥ 1280; mobile = M01 + stack; không native app |
| NFR-004 | Mọi ghi → audit |
| NFR-005 | ⌘K focus; pill có chữ |
| NFR-006 | CSS `am-*`; không phá `kpi-hub-*` / `csd-*`; không `<main>` kép |
| NFR-007 | E2E: nav nhóm đúng copy; dashboard 6 thẻ; 403 |
| NFR-008 | List server filter/sort/page; sticky header |
| NFR-009 | Timezone ICT; tooltip ISO |
| NFR-010 | Tenant PTT; staff id INTEGER |

---

## 13. Tích hợp

| Hệ | Hướng | Ghi chú |
|---|---|---|
| `createAgencyClient` | Ghi | Field khớp `/agency/clients/new` |
| `crm_contracts` | Đọc | `ends_on`, amount, line |
| CSD | Đọc | SLA count, link ticket |
| Delivery | Đọc | Milestone / deep-link |
| Finance ERP | Đọc | Invoice; stale banner |
| Notify in-app | Ghi | SLA / GH 14 ngày / health drop |
| KPI Hub | Sau | Tile deep-link, fact `AM_*` |
| IWRS | Không | |

---

## 14. Wave

| Wave | Phạm vi | UAT tối thiểu |
|---|---|---|
| **1** | Caps, DDL, AmShell, Dashboard, freshness, phạm vi, Nhận việc, Tạo khách / việc / plan, palette ⌘K, health tối thiểu, placeholder routes | 403, 6 KPI hiện `—` hoặc số thật, nhận việc, tạo khách ra agency, ⌘K không lộ ngoài scope |
| **2** | List + saved view + bulk owner + 360 overview/HĐ + handover/onboard + renewal pipeline/case + settings scorecard | Parent/child, Lost reason, Go-live gate |
| **3** | Work queue đầy đủ + timeline + risk + recovery + escalate + CSD link | Breach banner, không Resolve CSD |
| **4** | Growth +  reports + finance invoice + feedback + industry fields | GRR/NRR tooltip + drill-down |
| **5** | AI drawer, M01, portal, bubble, FX | Flag AI off mặc định |

Plan chi tiết Wave 1–5: `docs/superpowers/plans/2026-09-05-account-management-os.md`.

---

## 15. Sample data (chỉ mockup)

Dùng để đọc HTML, **cấm** seed prod.

| Phạm vi | Active | MRR | GH 90n | At risk | SLA overdue |
|---|---|---|---|---|---|
| Của tôi (AM) | 48 | 1,28 tỷ | 420tr / 12 | 185tr / 5 | 7 |
| Team HCM | 186 | 4,86 tỷ | 1,64 tỷ / 41 | 720tr / 18 | 19 |
| Toàn PTT | 1.248 | 18,64 tỷ | 4,82 tỷ / 164 | 2,14 tỷ / 67 | 41 |

Khách mẫu: Tập đoàn An Phú (parent) · Bloom Spa · EduNext · Green Home · CityLand · NovaMart · Phúc Hưng · VinaFoods.

---

## 16. Tự rà soát v2.0

| Kiểm | Kết quả |
|---|---|
| 6 KPI | Khóa Q15 / UI-AM-01 |
| 4 band | Khóa Q16 — không 5-band |
| Nav nhóm | Khóa Q14 — không 7 phẳng |
| Role + phạm vi + mật độ | Q26–Q28 từ mockup enterprise |
| Parent/child + coverage | Q29–Q30 |
| CSD SoR | BR-003 |
| Số mockup | Q32 |
| Mọi UI-AM-00…32 + M01 | §7 |
| Wave 1 plan | Khớp §14 |

**Hết SRS v2.0.**

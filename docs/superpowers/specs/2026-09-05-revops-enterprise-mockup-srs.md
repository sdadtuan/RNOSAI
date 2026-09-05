# SRS — Revenue Operations Enterprise (AE & Sales Doanh nghiệp)

**Sản phẩm:** RNOSAI / ops-web + ptt-crm-api  
**Tên module:** RevOps Shell — Revenue Operations  
**Tên tiếng Việt:** Điều hành doanh thu — Account Executive & Sales  
**Document ID:** REVOPS-ENT-001  
**Phiên bản:** 2.0  
**Ngày:** 2026-09-05  
**Trạng thái:** SoT — viết lại từ mockup HTML vận hành  
**Ngôn ngữ UI:** Tiếng Việt  
**Prod:** `https://rs.pttads.vn` · tenant `PTT`

**Changelog v2.0:** Viết lại toàn bộ theo [`rnosai-revops-enterprise-mockup.html`](../../design/rnosai-revops-enterprise-mockup.html) — 12 view, 17 modal, route map, sub-mockup links, token RNOSAI.  
**Changelog v1.0:** Phác thảo index + map module (đã thay bằng v2.0).

**SoT UI (thứ tự thắng):**

1. [Mockup HTML vận hành](../../design/rnosai-revops-enterprise-mockup.html) — layout, copy, control, sample data, modal, navigation  
2. Tài liệu này — quy tắc, FR/BR, route map, reuse, wave, AC  
3. SRS con (L2) — chi tiết API/DB từng module khi triển khai  
4. Code hiện có — reuse trước, fork sau

**Sub-mockup (L3 — không thay SoT suite):**

| Sub-mockup | Phạm vi | Route |
|---|---|---|
| [Lead Pipeline Tab](../../design/rnosai-lead-pipeline-tab-mockup.html) | **Chỉ** màn hình chăm Lead — tab Pipeline bán hàng | `/crm/leads/[id]` · SRS `LEAD-PIPELINE-UI-001` |
| [AM OS mockup](../../design/rnosai-am-os-srs-mockup.html) | Post-contract — retention, QBR, renewal | `/crm/account-management/*` · SRS `AM-20260905` |

**Mockup:** [`docs/design/rnosai-revops-enterprise-mockup.html`](../../design/rnosai-revops-enterprise-mockup.html)

---

## 1. Mục tiêu sản phẩm

RevOps Shell là lớp **điều hành doanh thu end-to-end** trên RNOSAI — bọc quanh module hiện có (Leads, Deal Room, KPI Hub, AM OS), **không** tạo CRM SaaS song song. Sales Director mở buổi sáng thấy: doanh thu, pipeline, lead SLA, hoa hồng, deal rủi ro, việc cần xử lý — và điều hướng một click sang module con.

### 1.1. Vấn đề PTT

| Vấn đề | Hệ quả | Giải trên RevOps |
|---|---|---|
| Module rải `/crm/leads`, Deal Room, KPI Hub, AM OS | Director không có một command center | View **Command Center** aggregate |
| Lead inbox vs chăm lead vs presales tách rời | User lạc luồng | Inbox ở RevOps; drill-down → sub-mockup Pipeline tab |
| Routing / territory / SLA nằm rời | Lead thất thoát, breach im lặng | View Leads + SLA + Territory liên kết |
| Commission tính Excel | Thiếu minh bạch, chậm payout | View KPI & Hoa hồng + Approval Center |
| Handover Sales→AM thiếu gate | Delivery nhận thiếu scope | View Handover & Onboarding + checklist |
| Post-won renewal rải AM / HĐ | Mất retention | View Renewal & Growth → deep-link AM OS |

### 1.2. Không giải (RevOps shell)

- Thay thế logic nghiệp vụ trong Leads API, Deal Room, KPI Hub, AM OS.  
- Gộp entity DB giữa lead / deal / account (chỉ orchestration UI).  
- Portal khách, multi-tenant, multi-currency.  
- AI auto-write commission / routing (chỉ gợi ý + người xác nhận khi bật sau).

---

## 2. Quyết định khóa

| # | Quyết định | Chọn |
|---|---|---|
| Q1 | App tách? | **Không.** Namespace `/crm/revenue-ops/*` + `RevOpsShell`. Cùng login, RBAC, OpsNav. |
| Q2 | SoT UI | Mockup enterprise HTML — 12 view + 17 modal interactive. |
| Q3 | Pre-won vs post-won | Pre-won: Leads, Pipeline, Handover queue. Post-won: Account 360, Renewal → AM OS deep-link. |
| Q4 | Lead detail | **Không** embed pipeline funnel trong RevOps. Drill-down → `/crm/leads/[id]` (sub-mockup L3). |
| Q5 | Backend Wave 1 | Shell + aggregate read APIs; không fork business logic module con. |
| Q6 | Sidebar | 4 nhóm nav như mockup: TỔNG QUAN / DOANH THU / HIỆU SUẤT / QUẢN TRỊ. |
| Q7 | Route map bar | Hiển thị View + Path + Shell trên mọi view (dev/PO catalog — ẩn prod nếu cần). |
| Q8 | Token UI | Primary `#17692f` · Navy `#0f172a` · class prefix `revops-*` · font Inter / Be Vietnam Pro. |
| Q9 | Quick create | Modal `quickModal` — entry point chéo module từ Command Center. |
| Q10 | Commission | Module **mới** (plan builder, payout, clawback) — gap lớn nhất vs RNOSAI hiện tại. |
| Q11 | Feature flag | `NEXT_PUBLIC_REVOPS_SHELL=1` cho rollout shell. |
| Q12 | Mobile | Bottom nav 5 tab (Home, Leads, Pipeline, Account, KPI) như mockup `@media 760px`. |

---

## 3. Chrome shell (RevOpsShell)

### 3.1. Layout

| Vùng | Mô tả mockup | FR |
|---|---|---|
| Sidebar trái | Brand RNOSAI CRM · 12 nav item · userbox bottom | FR-SHELL-01 |
| Topbar | Breadcrumb `RNOSAI CRM / Revenue Operations / {view}` · search · icon · avatar | FR-SHELL-02 |
| Route map | Chip: View, Path (`viewRoutes`), Shell, SoT file | FR-SHELL-03 |
| Content | `.page` max-width 1800px · view switch SPA (mockup) / route (prod) | FR-SHELL-04 |
| Mobile nav | 5 shortcut bottom fixed | FR-SHELL-05 |

### 3.2. Navigation map (`data-view` → route)

| View ID | Label sidebar | Route prod |
|---|---|---|
| `dashboard` | Command Center | `/crm/revenue-ops` |
| `leads` | Leads & Routing | `/crm/leads` |
| `pipeline` | Pipeline & Deal | `/crm/deal-room` |
| `accounts` | Account 360 | `/crm/account-management` |
| `handover` | Handover & Onboarding | `/crm/leads/handover` |
| `renewal` | Renewal & Growth | `/crm/account-management/renewal` |
| `kpi` | KPI & Hoa hồng | `/crm/kpi-hub` |
| `sla` | SLA & Escalation | `/crm/revenue-ops/sla` |
| `reports` | Báo cáo & Forecast | `/crm/revenue-ops/reports` |
| `territory` | Territory & Capacity | `/crm/b2b-projects` |
| `approvals` | Phê duyệt | `/crm/approvals` |
| `settings` | Cấu hình & Audit | `/crm/revenue-ops/settings` |

**FR-SHELL-06:** Click nav item → active state primary green; cập nhật breadcrumb + route chip.

**FR-SHELL-07:** Cross-nav: nút trong view (vd. Command Center → KPI, Deal → Approvals) deep-link đúng route.

---

## 4. Module spec theo mockup

### 4.1. NBV-01 — Command Center (`#dashboard`)

**Tiêu đề:** Sales & Account Command Center  
**Route:** `/crm/revenue-ops`

**Header actions:** Filter kỳ (Tháng) · Filter BU · **＋ Tạo nhanh** → `quickModal`

**KPI row (4 thẻ):**

| Thẻ | Metric mockup | Nguồn RNOSAI |
|---|---|---|
| Doanh thu thực đạt | 1,245 tỷ / target 1,500 tỷ (83%) | KPI Hub actual revenue |
| Pipeline có trọng số | 3,850 tỷ · coverage 3.02x | Deal Room weighted pipeline |
| Lead SLA compliance | 92.4% · 18 at risk · 7 breach | Leads SLA engine |
| Hoa hồng tạm tính | 84.65tr · 57.25tr approved | Commission module (gap) |

**Widgets:**

| Widget | Nội dung | FR |
|---|---|---|
| Pipeline theo giai đoạn | Funnel 5 cột: Lead → Discovery → Qualified → Proposal → Won | FR-CC-01 |
| Doanh thu theo team | Bar Actual vs Target · 4 team | FR-CC-02 |
| Hiệu suất Team Account–Sales | Bảng: Nhân sự, Vai trò, Target, Actual, Attainment, Pipeline, Lead active, SLA, Trạng thái | FR-CC-03 |
| Việc cần xử lý hôm nay | 29 việc — lead chưa phản hồi, deal stale, HĐ sắp hết hạn | FR-CC-04 |
| Khách hàng / deal có rủi ro | At-risk list — health, renewal, proposal expiry | FR-CC-05 |

**FR-CC-06:** Attainment status tags: `On track` · `Accelerator` · `Need attention` · `At risk`.  
**FR-CC-07:** Row action deep-link view tương ứng (accounts, kpi, renewal, pipeline).

---

### 4.2. NBV-02 — Leads & Routing (`#leads`)

**Tiêu đề:** Leads & Routing Center  
**Route:** `/crm/leads`  
**Sub-mockup:** [Lead Pipeline Tab](../../design/rnosai-lead-pipeline-tab-mockup.html) — **chỉ** drill-down `/crm/leads/[id]`

**Scope note (mockup):** View này = inbox + routing + SLA cấp danh sách. Pipeline B2 + Pre-sales = sub-mockup L3.

**Header actions:** Import · **Routing rules** → `routingModal` · **＋ Tạo lead** → `leadModal`

**Filters:** Nguồn lead · Ưu tiên · SLA · Owner · Thời gian

**KPI row (4 thẻ):** Lead mới hôm nay · Chờ phân bổ · SLA có nguy cơ · Tỷ lệ qualify

**Lead Inbox table — cột:**

| Cột | FR |
|---|---|
| Checkbox (bulk) | FR-LEAD-01 |
| Lead (tên, email, phone) | FR-LEAD-02 |
| Nguồn / Campaign | FR-LEAD-03 |
| ICP / Score (Hot/Warm/Fit tag) | FR-LEAD-04 |
| Quan tâm (sản phẩm) | FR-LEAD-05 |
| Owner (Unassigned tag) | FR-LEAD-06 |
| First response SLA (countdown tag) | FR-LEAD-07 |
| Trạng thái | FR-LEAD-08 |
| Action: Phân bổ / Chăm lead / Mở / So sánh | FR-LEAD-09 |

**FR-LEAD-10:** Trạng thái `Review duplicate` → `duplicateModal`.  
**FR-LEAD-11:** Assigned lead → link **Chăm lead** mở sub-mockup (prod: `/crm/leads/[id]?tab=pipeline`).  
**FR-LEAD-12:** Bulk assign · Saved view (Lead P1).

**Routing waterfall (timeline 4 bước):**

1. Existing Account Match  
2. Named Account / Territory  
3. Capacity & Skill  
4. Fallback Queue (weighted round-robin)

**SLA escalation timeline:** T+0 Assigned → T+3 Reminder → T+5 Breach → T+10 Reassign

**Reuse RNOSAI:** Leads inbox ~75% · routing partial · SLA partial.

---

### 4.3. NBV-03 — Pipeline & Deal (`#pipeline`)

**Tiêu đề:** Pipeline & Deal Management  
**Route:** `/crm/deal-room`

**KPI row:** Pipeline tổng · Weighted pipeline · Commit tháng · Stale deals

**Tabs:** Kanban · List · Forecast · Win/Loss

**Kanban 5 cột:** Discovery · Qualified · Proposal · Negotiation · Contract Review  
Mỗi cột: count + value · deal cards (tên, sản phẩm, amount, close date, owner, risk tag)

**Deal Detail panel (ABC Holdings sample):**

| Thành phần | FR |
|---|---|
| Stepper 6 bước: Discovery → Won | FR-PIPE-01 |
| Widgets: value, close date, win %, owners | FR-PIPE-02 |
| Notice discount approval gate | FR-PIPE-03 |
| CTA → Approval Center | FR-PIPE-04 |
| Deal hygiene checklist (stakeholder, next action, legal, discount) | FR-PIPE-05 |

**Header actions:** Forecast tuần · **Tạo báo giá** → `quoteModal` · **＋ Tạo deal** → `dealModal`

**Reuse RNOSAI:** Deal Room ~70%

---

### 4.4. NBV-04 — Account 360 (`#accounts`)

**Tiêu đề:** Account 360  
**Route:** `/crm/account-management/[id]` (orchestration) → AM OS deep-link post-won  
**Sub-mockup:** [AM OS](../../design/rnosai-am-os-srs-mockup.html)

**Scope note:** RevOps = orchestration layer; retention/QBR/renewal workspace = AM OS.

**Filters:** Tier · Health · Renewal window · Owner

**Detail layout (2 cột):**

**Main — ABC Holdings:**

| Block | FR |
|---|---|
| Header: ACC code, tier, industry, Health 82/100 | FR-ACC-01 |
| 4 widget: LTV, Active pipeline, Active contracts, Next renewal | FR-ACC-02 |
| Tabs: Overview · Stakeholders · Deals · Contracts · Account Plan · Risks · Timeline | FR-ACC-03 |
| Overview: Primary/Sales owner, Territory, Parent, Consent | FR-ACC-04 |
| Health score drivers (4 KPI row + progress) | FR-ACC-05 |
| Stakeholder map table (Contact, Role, Influence, Relationship, Sentiment, Last touch, Owner) | FR-ACC-06 |

**Aside:** Account team · Risks & actions · Next touchpoints

**Header actions:** Import · **Account Plan** → `accountPlanModal` · **＋ Tạo account** → `accountModal`

**Reuse RNOSAI:** AM OS ~80%

---

### 4.5. NBV-05 — Handover & Onboarding (`#handover`)

**Tiêu đề:** Sales Handover & Onboarding  
**Route:** `/crm/leads/handover`

**KPI row:** Chờ Sales hoàn tất · Chờ AE nhận · Onboarding active · Onboarding completed

**Handover Queue table — cột:** Handover ID · Account/Deal · Sales owner · Receiving AE/Delivery · Completeness % · Acceptance SLA · Status

**Trạng thái mockup:** Pending Acceptance · Incomplete · Onboarding Active

**Handover package checklist (11 items sample):** Contract, billing, stakeholder, scope exclusions, success metrics…

**Onboarding workflow (4 bước):** AE accept → Kickoff prep → Kickoff completed → Onboarding acceptance

**Header actions:** Templates · **＋ Tạo handover** → `handoverModal`

**Reuse RNOSAI:** [Leads handover flow](../../huong-dan-su-dung/23-leads-handover-flow-and-guides.md) ~65%

---

### 4.6. NBV-06 — Renewal & Growth (`#renewal`)

**Tiêu đề:** Renewal & Growth Workspace  
**Route:** `/crm/account-management/renewal`  
**Sub-mockup:** AM OS Renewal module

**KPI row:** Renewal pipeline · Gross retention · Expansion pipeline · At-risk revenue

**Renewal Portfolio table — cột:** Account · Tier/Health · Contract value · Expiry · Renewal owner · Renewal stage · Growth signal · Risk

**Account risk register:** Churn, stakeholder change, collection — CTA Mitigate/Assign/Review

**Growth playbook:** AI suggestions — cross-sell, seat expansion, retainer add-on

**Header actions:** Renewal window filter · **＋ Growth opportunity** → `growthModal`

**Reuse RNOSAI:** AM renewal ~70%

---

### 4.7. NBV-07 — KPI & Hoa hồng (`#kpi`)

**Tiêu đề:** KPI & Hoa hồng  
**Route:** `/crm/kpi-hub`

**KPI row:** Doanh thu thực đạt · Pacing KPI (0.92x) · Commission estimated · Payout batch

**Tiến độ KPI toàn team (weighted):**

| Chỉ số | Weight mockup |
|---|---|
| New Business | 45% |
| Renewal Revenue | 25% |
| Upsell / Cross-sell | 15% |
| SLA Compliance | 15% |

**Dự phóng hoa hồng:** Estimated · Projected 100% · Upside Accelerator Tier 2 · notice bonus milestone

**Bảng nhân sự — cột:** Nhân sự · Target · Actual · % KPI · Pipeline · Base HH · Accelerator · Bonus · Chờ duyệt · Trạng thái

**Commission transaction detail:** Deal · Eligible revenue · Rate · Split · Commission · Status

**Approval & payout flow (4 bước):** Manager → Finance reconciliation → Lock batch → Payment execution

**Header actions:** Kỳ filter · **Commission plan** → `commissionPlanModal` · **＋ Giao KPI** → `kpiModal` · Payout review → `payoutModal`

**Gap:** Commission plan builder, payout batch, clawback — **module mới**.

**Reuse RNOSAI:** KPI Hub ~85% (KPI); commission ~15%

---

### 4.8. NBV-08 — SLA & Escalation (`#sla`)

**Tiêu đề:** SLA & Escalation Center  
**Route:** `/crm/revenue-ops/sla`

**KPI row:** SLA compliance (target 95%) · Open warnings · Breaches · Auto reassignments

**SLA Incident Queue — cột:** Incident · Entity · Owner · Policy · Due/Breach · Escalation ladder · Status

**Entity types:** Lead · Handover · Renewal (mockup samples)

**SLA policy catalog:** Lead P1 First response · Proposal turnaround · Enterprise handover · Strategic renewal prep

**Breach trend chart (7 ngày) + root cause notice**

**Header actions:** **SLA policies** → `slaPolicyModal` · **＋ Tạo escalation**

**Reuse RNOSAI:** SLA rules partial ~40%

---

### 4.9. NBV-09 — Reports & Forecast (`#reports`)

**Tiêu đề:** Reports & Forecast  
**Route:** `/crm/revenue-ops/reports`

**Filters:** Kỳ · BU · Territory · Currency

**Dashboard row (3 card):** Revenue actual vs forecast · Revenue mix (New/Renewal/Upsell) · Commission liability

**Report library (18 reports) — cột:** Báo cáo · Nhóm · Owner · Schedule · Last updated

**Reports mockup:** Executive Revenue Forecast · Lead SLA & Leakage · Key Account Health & Renewal Risk · Commission Payout Reconciliation

**Header actions:** Lưu dashboard · Export · **＋ Custom report**

**Reuse RNOSAI:** Reports partial ~50%

---

### 4.10. NBV-10 — Territory & Capacity (`#territory`)

**Tiêu đề:** Territory & Capacity Management  
**Route:** `/crm/b2b-projects` + routing config

**KPI row:** Active territories (24) · Coverage gaps (3) · Capacity utilization (78%)

**Territory hierarchy timeline:** Vietnam Enterprise → HCM segments → Named Accounts Strategic

**Capacity by team member:** Progress bar + tag High/Available/Normal

**Assignment rules table — cột:** Priority · Rule · Condition · Assign to · Fallback · Status

**4 rules mockup:** Existing account match · Named account · Territory+Industry · Capacity balancing

**Header actions:** Simulate routing · **＋ Tạo territory** → `territoryModal` · Quản lý rules → `routingModal`

**Reuse RNOSAI:** B2B Project OS ~55%; territory mostly new

---

### 4.11. NBV-11 — Approval Center (`#approvals`)

**Tiêu đề:** Approval Center  
**Route:** `/crm/approvals`

**KPI row:** Waiting for me · Pending all · Approved today · Overdue approvals

**Approval Queue — cột:** Request · Type · Related record · Requested by · Amount/Impact · Current step · Due · Action

**Types mockup:** Discount · Commission · Clawback · Account reassignment

**Approval matrix — Discount:** ≤5% · 5–15% · 15–25% · >25% (steps 1–3)

**Approval controls:** Delegation · Segregation of duties · Escalation

**Review modal:** `approvalModal` — approve / reject / request changes

**Reuse RNOSAI:** Approval flow ~60%

---

### 4.12. NBV-12 — Cấu hình & Audit (`#settings`)

**Tiêu đề:** Cấu hình & Audit  
**Route:** `/crm/revenue-ops/settings`

**3 card row:**

| Card | Nội dung |
|---|---|
| Organization & users | BU, Teams, User lifecycle |
| Data quality center | Deals without next action, accounts without owner, strategic without plan |
| Integration health | ERP, Facebook Lead Ads, HR/Payroll |

**Role permission matrix — module × role:** Sales · AE/AM · Team Lead · Finance · Admin  
Modules: Lead & Routing · Account 360 · Deal & Pipeline · KPI & Commission · Payout · Audit logs

**Recent audit log timeline**

**Header actions:** Audit export · **＋ Tạo workflow**

**Reuse RNOSAI:** Admin audit ~70%

---

## 5. Modal catalog (17)

| Modal ID | Tiêu đề | Trigger | Trường chính | Wave |
|---|---|---|---|---|
| `quickModal` | Tạo nhanh | Command Center | 6 shortcut: Lead, Deal, Account, Handover, KPI, Assign | W1 |
| `leadModal` | Tạo Lead | Leads header | Họ tên*, Công ty, Email, Phone*, Nguồn*, Sản phẩm, Industry, Priority, Ghi chú | W1 |
| `assignmentModal` | Phân bổ Lead | Inbox / SLA | Routing suggestions (3), override reason | W1 |
| `duplicateModal` | Kiểm tra trùng lặp | Inbox duplicate row | So sánh 2 cột, action select | W1 |
| `dealModal` | Tạo Opportunity | Pipeline header | Tên*, Account*, Stage*, Close*, Amount*, Owner, Forecast, Next step* | W1 |
| `quoteModal` | Tạo báo giá | Pipeline header | Opportunity*, Template, Price book, Expiry*, Commercial note | W1 |
| `accountModal` | Tạo Account | Account 360 header | Tên pháp lý*, MST, Domain, Industry, Tier, Parent, Owner* | W2 |
| `accountPlanModal` | Account Plan | Account 360 | Tabs Strategy/Stakeholders/Growth/Risks/QBR; objectives, renewal, upsell strategy | W2 |
| `handoverModal` | Sales Handover Package | Handover header | Deal Won*, Receiving AE*, PM, Kickoff date*, Goals*, Scope exclusions* | W2 |
| `growthModal` | Growth Opportunity | Renewal header | Account*, Type*, Product, Amount, Signal/Evidence | W2 |
| `kpiModal` | Giao KPI | KPI header | Kỳ*, Áp dụng*, Targets (revenue, renewal, upsell, SLA), Ghi chú | W2 |
| `commissionPlanModal` | Commission Plan Builder | KPI header | Plan name*, Version, Effective dates, Revenue basis*, Role, Tier table | W3 |
| `payoutModal` | Payout Batch Review | KPI table | Liability summary, reconciliation list, send Finance | W3 |
| `slaPolicyModal` | Cấu hình SLA Policy | SLA header | Name*, Entity*, Calendar, Duration*, Warning, Escalation schedule | W3 |
| `territoryModal` | Tạo Sales Territory | Territory header | Name*, Type*, Parent, Team, Capacity, Rule definition | W3 |
| `routingModal` | Routing Rule Builder | Leads/Territory | Name*, Priority, Conditions, Method, Fallback; Simulate + Publish | W3 |
| `approvalModal` | Review Approval | Approval queue | Request summary, amounts, comment*, Approve/Reject/Changes | W2 |

**FR-MODAL-01:** Mọi modal có head/body/foot; đóng bằng ×, Hủy, hoặc click overlay.  
**FR-MODAL-02:** Primary action hiển thị toast confirmation (mockup demo).  
**FR-MODAL-03:** Required fields đánh dấu `*`; validation trước submit (prod).

---

## 6. Persona & phân quyền (tóm tắt mockup)

| Persona | Vai trò mockup | Views chính |
|---|---|---|
| Sales Director | PTT Tuan — sidebar user | Command Center, Approvals, Reports, Settings |
| Team Lead | Nguyễn Minh Anh | KPI, SLA, Leads assign, Pipeline |
| Sales Executive | Trần Quốc Bảo, Phạm Gia Huy | Leads, Pipeline, Deal create |
| Account Executive | Lê Hoàng Lan | Account 360, Renewal, Handover accept |
| Finance | (Approval matrix) | Commission, Payout, Discount parallel approve |
| Sales Ops / RevOps | Routing, Territory, SLA config | Territory, Settings audit |

Matrix chi tiết: xem tab **Role permission matrix** trong view Settings (mockup).

---

## 7. Kiến trúc triển khai

```text
ops-web
├── /crm/revenue-ops              ★ RevOpsShell (sidebar 12 module)
│   ├── (dashboard)               aggregate APIs — Command Center
│   ├── /sla                      native SLA center
│   ├── /reports                  native reports
│   └── /settings                 config + audit
├── /crm/leads/*                  embed / deep-link — NBV-02
│   └── /[id]                     sub-mockup Pipeline tab (L3)
├── /crm/deal-room/*              embed — NBV-03
├── /crm/kpi-hub/*                embed — NBV-07 (+ commission gap)
├── /crm/account-management/*     deep-link — NBV-04, 06
├── /crm/leads/handover           embed — NBV-05
├── /crm/b2b-projects             territory — NBV-10
└── /crm/approvals                embed — NBV-11
```

**Nguyên tắc:** Shell = navigation + aggregate + quick actions. Business logic giữ trong module con.

---

## 8. Reuse & gap summary

| Module | Reuse % | Gap chính |
|---|---|---|
| Command Center | ~40% | Aggregate dashboard API mới |
| Leads & Routing | ~75% | Routing UI, saved views |
| Pipeline & Deal | ~70% | Forecast tab, hygiene panel |
| Account 360 | ~80% | Orchestration shell vs AM OS |
| Handover | ~65% | Checklist gate, SLA accept |
| Renewal & Growth | ~70% | Growth playbook AI |
| KPI & Hoa hồng | ~85% KPI / ~15% HH | **Commission module mới** |
| SLA & Escalation | ~40% | Policy engine, incident queue |
| Reports & Forecast | ~50% | Report library, scheduler |
| Territory & Capacity | ~55% | Hierarchy builder, simulate |
| Approval Center | ~60% | Matrix config, parallel steps |
| Settings & Audit | ~70% | Data quality center |

---

## 9. Wave triển khai

| Wave | Phạm vi | Deliverable |
|---|---|---|
| W0 | Mockup + SRS v2.0 | HTML SoT + tài liệu này |
| W0b | **Implementation plan** | [2026-09-05-revops-enterprise-os.md](../plans/2026-09-05-revops-enterprise-os.md) |
| W1 | RevOpsShell + Command Center + embed Leads/Deal/KPI | Route namespace, sidebar, 6 modal cơ bản |
| W2 | Handover, Approvals, Account orchestration | Native handover queue, approval review |
| W3 | SLA, Commission, Territory | Policy catalog, plan builder, payout, routing UI |
| W4 | Reports, Settings, mobile polish | Report library, audit, data quality |

---

## 10. Acceptance criteria

### 10.1. Mockup phase (W0) — done

- [x] 12 view interactive trong mockup HTML
- [x] 17 modal mở/đóng + toast
- [x] Branding RNOSAI `#17692f`
- [x] Route map bar cập nhật theo view
- [x] Leads → sub-mockup Pipeline tab
- [x] Account/Renewal → sub-mockup AM OS
- [x] Không còn branding Gomira

### 10.2. Shell W1

- [ ] `RevOpsShell` render sidebar 4 nhóm + topbar + breadcrumb
- [ ] 12 route map đúng bảng §3.2
- [ ] Command Center 4 KPI + 5 widget load từ API aggregate
- [ ] Quick create modal mở 6 shortcut
- [ ] Deep-link Leads / Deal Room / KPI Hub không break layout
- [ ] Feature flag `NEXT_PUBLIC_REVOPS_SHELL=1`

### 10.3. Per-module (W2+)

- [ ] Mỗi NBV-01…12 có FR pass QA theo mockup copy + layout
- [ ] Modal required fields validate
- [ ] Cross-nav (Deal → Approval, KPI → Payout) hoạt động
- [ ] Mobile bottom nav 5 tab

---

## 11. Tài liệu liên quan

| Tài liệu | ID / vai trò |
|---|---|
| [Lead Pipeline Tab SRS](./2026-09-05-lead-pipeline-tab-srs.md) | `LEAD-PIPELINE-UI-001` — sub-mockup L3 |
| [Account Management SRS](./2026-09-05-account-management-srs.md) | `AM-20260905` — post-contract |
| [KPI Hub Enterprise SRS](./2026-09-04-kpi-hub-enterprise-rnosai-srs.md) | `KPI-HUB-ENT-001` |
| [Leads handover flow](../../huong-dan-su-dung/23-leads-handover-flow-and-guides.md) | E2E B2B |
| [Sales Cockpit guide](../../huong-dan-su-dung/26-sales-cockpit-huong-dan-day-du.md) | LMP / Deal Room |
| Gomira reference (archive) | `Mockup_UI_Quan_ly_Account_Executive_Sales_Doanh_nghiep.html` |

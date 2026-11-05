# SRS tích hợp — KPI Hub Enterprise trên RNOSAI

**Sản phẩm:** RNOSAI / ops-web + ptt-crm-api  
**Nguồn gốc:** `SRS_KPI_Hub_Enterprise_Project_Delivery.md` v2.0 (04/09/2026) + 10 màn mockup KPI Hub Enterprise  
**Phiên bản:** 1.2  
**Ngày:** 2026-09-04  
**Trạng thái:** Baseline tích hợp — chờ PO duyệt trước plan triển khai  
**Ngôn ngữ UI:** Tiếng Việt  

**Changelog v1.2:** Gộp **Dự án PTT** + **Delivery** thành **một dự án quản lý** (một list, một wizard, một detail). Ingest lead vẫn `crm_b2b_projects` 1:1 — không đổi `b2b_project_id` trên lead.  
**Changelog v1.1:** Bổ sung đặc tả UI 10 màn bắt buộc giống mockup.

**Tài liệu liên quan (không thay thế):**

| Tài liệu | Vai trò |
|---|---|
| [KPI Hub SRS v1.1](./2026-09-04-kpi-hub-srs.md) | Semantic layer: Dictionary, Formula, Mapping, Target, DQ, Báo cáo |
| [KPI Management Cockpit](./2026-09-03-kpi-management-cockpit-design.md) | Sổ điểm NV `/crm/kpi` (RAG tháng) |
| [Nhóm KPI](./2026-09-03-kpi-group-setup-srs.md) / [KPI Type](./2026-09-03-kpi-type-setup-srs.md) | Phân loại catalog |
| [B2B Lead Project OS](./2026-08-18-b2b-lead-project-os-design.md) | Dự án PTT *nhận lead* — khác Delivery |
| [Delivery spine WS3](./2026-08-29-lifecycle-ws3-delivery-spine-design.md) | `/crm/service-delivery` sau won |

---

## 0. Quyết định khóa

SRS gốc mô tả **sản phẩm SaaS độc lập** (workspace riêng, connector riêng, Power BI, white-label). RNOSAI **đã có** lớp vận hành và một phần KPI Hub. Tài liệu này viết lại nghiệp vụ để **cắm vào hệ thống hiện có**, không dựng tenant/engine thứ hai.

| # | Quyết định | Chọn |
|---|---|---|
| Q1 | Có tạo app KPI Hub Enterprise tách khỏi ops-web? | **Không.** Embed trong `/crm/kpi-hub*` + module Delivery mới. Cùng login staff, RBAC, sidebar OpsNav. |
| Q2 | Command Center (Executive / MKT / Sales / Delivery) là gì? | **Bốn view persona** đọc `crm_kpi_facts` + dữ liệu CRM đã có. Không hard-code số. |
| Q3 | Dự án PTT + Delivery? | **Một dự án quản lý** (PO 2026-09-04): một catalog, một wizard, một detail. Hai *năng lực* độc lập: `lead_ingest` (PTT nhận lead) và `delivery` (giao hàng). **Không** gộp bảng: `crm_b2b_projects` giữ 1:1 cho webhook/SLA/lead. **Không** gộp `crm_re_projects` (BĐS). |
| Q4 | Quan hệ với Service Delivery? | Delivery Project **có thể** gắn 0..1 `crm_service_lifecycle.id` + `agency_client` / lead won. UI Delivery ≠ workflow TMMT/Launch QA. |
| Q5 | Dictionary / Target / DQ / Báo cáo? | **Tái sử dụng KPI Hub v1.1.** Mockup “Add KPI từ Dictionary” = gán `crm_kpi_dictionary` Active vào dự án. |
| Q6 | Sổ điểm NV `/crm/kpi`? | Giữ nguyên. Hub tính metric tổ chức; cockpit giao actual/target nhân viên. Gắn tùy chọn `kpi_type_id` / dictionary code — không bắt buộc Wave 1 Delivery. |
| Q7 | Multi-workspace / Client switcher / RLS An Gia Land? | Wave 1: **một workspace Hub** (`tenant_id=PTT`). “Client” = khách CRM / agency client đã có. RLS = cap hiện tại + filter `client_id`. Không làm SaaS đa tenant mới. |
| Q8 | UI 10 màn mockup? | **Layout / thứ tự khối / copy / widget / cột / rail phải giống 10 ảnh** (§11). Token CRM (`#17692f`), class `kpi-hub-*` / `delivery-*`, không Tailwind. Sidebar Hub 3 nhóm (Tổng quan / Governance / Phân tích) **nằm trong `KpiHubShell`**, không app thứ hai, không badge PRODUCTION giả. |
| Q9 | LLM / AI Insight / forecast nâng cao? | **Tắt.** Không `PTT_IWR_LLM` / `PTT_CSD_LLM`. Forecast Wave 3+. |
| Q10 | Approval Center động, Change Request, Capacity phút, Power BI embed? | **Wave sau.** Wave 1–2 chỉ approval tuyến tính + warning capacity. |
| Q11 | `/crm/b2b-projects` sau gộp? | Redirect 308 → `/crm/delivery-projects` (query `capability=lead_ingest` nếu vào từ OpsNav “Dự án PTT”). API `/api/v1/b2b-projects` giữ nguyên. |

---

## 1. Vấn đề nghiệp vụ (sau khi lọc khỏi SRS gốc)

| Vấn đề PTT đang gặp | Hệ quả | Cách giải trên RNOSAI |
|---|---|---|
| Cùng CPL / Valid Lead / Win Rate định nghĩa khác nhau | Báo cáo MKT–Sales–Finance lệch | Dictionary Hub đã có — Command Center **chỉ đọc** KPI Active |
| Target Excel, không theo dự án/khách | Không giải thích được “Đạt / Thiếu” | Target Hub + target scope `Project` (mới) |
| Dashboard persona trộn một trang | Giám đốc / MKT / Sales nhìn cùng widget | 3 Command Center + 1 portfolio Delivery |
| Dự án agency thiếu portfolio / margin / milestone | Trễ, lỗ, quá tải — không thấy ở một chỗ | Cùng catalog với Dự án PTT; mặt `delivery` trên cùng record quản lý |
| Gắn KPI vào dự án bằng tay / song song | Formula lệch version | Picker Dictionary + kế thừa version Active |
| DQ/freshness không hiện trên dashboard điều hành | Quyết định trên số trễ | Footer + badge trust đã spec Hub — bắt buộc trên Command Center |

**Không** giải bằng Hub Enterprise: thay CRM, Ads Manager, kế toán, timesheet phút, bidding tự động.

---

## 2. Bản đồ hệ thống hiện có → mockup

```text
ops-web (một app)
├── /crm/kpi                  Sổ điểm NV (Wave 1 cockpit)     ≠ Command Center
├── /crm/kpi-hub              Hub Dashboard (gộp MKT+Sales)   → tách 3 Command Center
├── /crm/kpi-hub/dictionary   Từ điển                         → nguồn picker “Thêm KPI”
├── /crm/kpi-hub/targets      Target + alert Hub
├── /crm/kpi-hub/sources      Connector catalog
├── /crm/kpi-hub/quality      DQ + issue
├── /crm/kpi-hub/reports      Thư viện báo cáo
├── /crm/sales + leads        Pipeline / SLA vận hành         → fact Sales Command
├── /crm/b2b-projects         308 → /crm/delivery-projects    (API B2B giữ)
├── /crm/re-projects          Dự án BĐS                       KHÔNG gộp
├── /crm/service-delivery     Lifecycle sau won (TMMT/QA)     Liên kết tùy chọn
└── /crm/delivery-projects    ★ Catalog thống nhất PTT + Delivery
```

### 2.1. Ánh xạ 10 màn UI

| # | Mockup | Route RNOSAI | Tái sử dụng | Phải làm mới | Wave |
|---|---|---|---|---|---|
| 1 | Executive Command Center | `/crm/kpi-hub/executive` (mặc định nếu role Executive) | Fact Hub, freshness, alert, approval queue Hub | **Toàn bộ khối §11.1** (6 thẻ, forecast, at-risk, funnel, trust, approval, exceptions) | A |
| 2 | Marketing Performance | `/crm/kpi-hub/marketing` | Fact MKT_*, Meta/GA mapping Hub, campaign table nếu fact đủ | 6 thẻ MKT, donut kênh, funnel Impr→MQL, creative (nếu có asset) | A |
| 3 | Sales Command Center | `/crm/kpi-hub/sales` | Lead/deal CRM, SLA first-touch, `/crm/sales` | 6 thẻ SAL_*, pipeline stacked, deal-at-risk, bảng team | A |
| 4 | Project Delivery portfolio | `/crm/delivery-projects` | Staff, khách, `crm_b2b_projects` list/API | §11.4 + cột Năng lực (Lead / Giao hàng) + chip filter PTT | B |
| 5 | Wizard B2 Phạm vi & Dịch vụ | `/crm/delivery-projects/new?step=2` | Catalog dịch vụ ops (nếu có slug); không thì seed catalog Delivery | Service cards, deliverable table, out-of-scope, conflict | B |
| 6 | Wizard B3 Kế hoạch & Milestone | `...?step=3` | Staff picker | Milestone + dependency (chặn vòng), Gantt đơn giản, task từ template | B |
| 7 | Wizard B4 Ngân sách & NL | `...?step=4` | Staff + rate nếu có; **không** đọc sổ kế toán | Budget header, hạng mục, allocation %, capacity bar | C |
| 8 | Modal Thêm hạng mục ngân sách | Drawer trên B4 / detail | — | Form + impact margin realtime + checklist | C |
| 9 | Wizard B5 KPI & Xác nhận | `...?step=5` | Dictionary Active, target Hub | Bảng KPI dự án, alert cadence, checklist submit | D |
| 10 | Thêm KPI từ Dictionary | Drawer/full page từ B5 hoặc detail | List/filter Dictionary | Multi-select, inspector, inherit formula/mapping, draft target | D |

Wizard B1 (Thông tin cơ bản) **không có file ảnh** nhưng bắt buộc trong SRS gốc §10.2 — giữ trong Wave B.

---

## 3. Phạm vi theo wave (thay Phase 1–3 gốc)

Gốc Phase 1 ôm cả 4 dashboard + wizard + Dictionary + connector + report. Trên RNOSAI Dictionary/connector/report **đã có**. Wave dưới đây là phần *còn thiếu*.

### Wave A — Command Center (không schema dự án)

**Làm**

- Mở rộng nav Hub: `Tổng quan` gồm Executive / Marketing / Sales (Delivery portfolio vào Wave B).
- Mỗi view: filter kỳ + so sánh kỳ trước + Xuất (reuse export Hub) + chip freshness.
- Thẻ KPI **cấu hình mã Dictionary**, mặc định theo §5. Không bịa số; `—` khi no_data.
- Target At Risk / Marketing alerts / Sales alerts = đọc alert Hub + (Sales) rule deal risk từ CRM.
- Funnel tính lại numerator/denominator theo filter (BR-002 Hub: không average daily ratio).
- Data Trust widget = quality score + chip nguồn (đã có quality/sources).
- Approval Queue = KPI/report Pending Approval Hub (chưa có budget CR).

**Không làm Wave A**

- Approval policy động, AI Insight panel mặc định mở, Power BI embed, forecast model (đường Forecast **ẩn** nếu chưa có số — không bịa 91%).
- Đổi `/crm/kpi`, `/crm/sales` hành vi cũ (Sales Command *đọc*, không thay cockpit bán hàng).
- Cắt bớt widget so với §11.1–11.3.

### Wave B — Delivery Project: portfolio + wizard 1–3

**Làm**

- Bảng `crm_delivery_projects` (header quản lý) + `b2b_project_id` 1:1 khi bật nhận lead.
- Backfill: mỗi `crm_b2b_projects` hiện có → 1 header (`capability` chỉ `lead_ingest`); không bắt wizard 2–5.
- Portfolio một list: filter Năng lực Lead / Giao hàng / Cả hai. Thẻ: tổng / đúng hạn / rủi ro / quá hạn / ngân sách (`—` nếu chưa C) + đếm dự án đang nhận lead.
- Wizard B1: toggle **Nhận lead PTT** (kênh, SLA, pool — gọi API B2B) + toggle **Giao hàng** (mở bước 2–5). Có thể bật một hoặc cả hai.
- Wizard B2–B3 chỉ khi `delivery` bật.
- Health lịch + milestone khi có delivery; dự án chỉ lead → health từ SLA/ingest (ổn / tạm dừng / lưu trữ).

**Không làm Wave B**

- Drag Gantt đổi ngày trên portfolio (chỉ xem; sửa ngày ở wizard/detail).
- Nội dung Kanban / Capacity Planning / Risk Register **đầy đủ CRUD** (Wave E). **Tab và khung widget vẫn phải render** đúng mockup — empty state + CTA, không xóa khối.

### Wave C — Ngân sách, nguồn lực, chính sách margin

**Làm**

- Budget header: hợp đồng, chi phí nội bộ, media khách (tách), contingency, forecast, margin.
- Hạng mục + allocation (đều / milestone / tay) + modal impact.
- Resource: staff, role, % allocation, khoảng ngày, cảnh báo >100% trên *các dự án Active+Draft overlapping*.
- Policy: `min_gross_margin_pct` (mặc định 30), `forecast_over_budget_warn`, media không vào revenue.
- Submit: nếu margin < ngưỡng hoặc forecast > budget → `Pending Approval` (không Active).

**Không làm Wave C**

- Đọc actual từ ERP/timesheet (actual = 0 hoặc nhập tay có cap finance).
- Change Request sau Active; multi-currency FX.
- Override silent.

### Wave D — KPI dự án từ Dictionary

**Làm**

- `crm_delivery_project_kpis` + target scope `PROJECT`.
- Picker Dictionary (màn 10): filter group/dept/type/source/status; Deprecated disabled.
- Kế thừa formula/mapping/version Active; không cho sửa formula trên dự án.
- Toggle draft target từ template; toggle inherit alert rule.
- B5: bảng KPI dự án (baseline/target/warn/critical/cycle/owner), cadence review, checklist, tạo + gửi duyệt.

**Không làm Wave D**

- Override formula tại dự án; chọn historical version (trừ BI Admin — Wave E).
- Tab Team/Dự án/KH trên `/crm/kpi` (sổ NV). Chu kỳ tuần trên sổ NV.

### Wave E — Điều hành sau Active (gốc Phase 2 còn lại)

Risk register, CR scope/budget, Approval Center policy động, Capacity Planning trang riêng, Delivery Quality, schedule báo cáo khách, historical KPI version, lineage visual.

### Ngoài phạm vi mọi wave gần

- App shell thứ hai, white-label client portal, SCIM, multi-region.
- Native mobile CRUD.
- AI tự quyết định / anomaly.
- Thay CRM/ERP/Ads.
- Gộp `crm_re_projects` (BĐS). Gộp *bảng* B2B vào Delivery (chỉ gộp UI/header).
- Bật flag LLM.

---

## 4. Vai trò → RBAC RNOSAI

Không tạo 14 role SaaS. Map vào **staff + cap** hiện có; bổ sung cap mới tối thiểu.

| Persona mockup | Cap / điều kiện | Được làm |
|---|---|---|
| BI Admin | `crm_kpi_hub` publish + `crm_kpi_hub_settings` | Dictionary, mapping, approve formula |
| Marketing Manager | `crm_kpi_hub.view` + scope MKT | Marketing Command, target MKT |
| Sales Director | `crm_kpi_hub.view` + `crm_leads.view` | Sales Command, deal-at-risk (PII theo lead cap) |
| Executive | `crm_kpi_hub.view` (hoặc cap executive mới, mặc định SUPER-ADMIN / GDKD) | Executive Command read |
| Delivery Director | `crm_delivery_projects.view` + `manage` portfolio | Portfolio, approve theo policy |
| GDKD / B2B admin | `crm_b2b_projects.manage` | Bật/sửa mặt Nhận lead (kênh, pool, SLA) |
| Project Manager | `crm_delivery_projects.edit` trên dự án assigned | Wizard, milestone, draft budget |
| Account Manager | `edit` assigned hoặc `view` client | Xem/sửa dự án được gán |
| Finance Manager | `crm_delivery_budget.approve` | Duyệt budget/margin |
| Client Viewer | **Không Wave A–D** | Chia sẻ report Hub đã có nếu được share |
| Data Steward | `crm_kpi_hub_sources` / quality | DQ, không tạo dự án |

Quyền = `Resource + Action + Scope`. Backend enforce. Scope dự án: assigned PM/AM, hoặc `view_all` (Delivery Director / SUPER-ADMIN).

**Cap mới (seed RBAC):**

- `crm_delivery_projects`: `view`, `edit`, `manage`
- `crm_delivery_budget`: `view`, `edit`, `approve`

Không cấp `manage` Delivery cho mọi user có `crm_kpi_hub.view`.

---

## 5. Command Center — nghiệp vụ theo màn

Nguyên tắc chung (mọi Command Center):

1. Chỉ hiển thị KPI Dictionary **Active** (hoặc Need Review kèm badge).
2. Actual từ `crm_kpi_facts` theo `kpi_version_id` đã publish; không query Ads live.
3. Direction / unit / blank-if-zero theo Dictionary.
4. `DATA_ISSUE` / Delayed / Failed **ưu tiên hơn** kết luận Đạt (Hub FR Data Issue precedence).
5. Filter kỳ áp dụng mọi widget; empty → `—`, không `0`.
6. CSS `kpi-hub-*`. Footer freshness bắt buộc.

### 5.1. Executive (`/crm/kpi-hub/executive`)

**Mục tiêu:** Ban điều hành thấy doanh thu kỳ mới, pipeline trọng số, chất lượng lead, CPL, MQL, Win Rate, chỗ vỡ target, độ tin cậy dữ liệu, việc duyệt.

**6 thẻ mặc định** (mã Settings được đổi, không hard-code UI):

| Thẻ | Mã Dictionary (đã seed Hub) | Direction |
|---|---|---|
| Doanh thu kỳ mới | `SAL_008` | Higher — **không** = `FIN_001` hóa đơn / `FIN_002` thu tiền |
| Pipeline có trọng số | Dùng `SAL_005` (Pipeline Value) Wave A; weighted = `SUM(amount × probability)` khi fact có grain deal — **không** lấy `SAL_002` (đó là SQL Rate) |
| Valid Leads | `MKT_002` | Higher |
| CPL Valid Lead | `MKT_006` | Lower |
| MQL Rate | `MKT_008` | Higher |
| Win Rate | `SAL_007` | Higher |

Mỗi thẻ: actual, target/status, Δ kỳ trước, sparkline nếu ≥2 điểm, freshness.

**Khối khác**

- Biểu đồ Actual / Target (Forecast **ẩn** Wave A; placeholder chỉ khi Settings bật và có model).
- Target At Risk: severity → impact → SLA; CTA mở alert Hub.
- Funnel: Raw → Valid → MQL → SQL → Appt → Won; bottleneck = stage lệch target/benchmark **đã cấu hình**, không chỉ volume.
- Data Trust: score 0–100 + bảng nguồn.
- Approval Queue: KPI version / target / report pending.
- Bảng Exceptions: tab All / Critical / Warning / Pending; không close nếu thiếu note + cap.

### 5.2. Marketing (`/crm/kpi-hub/marketing`)

**6 thẻ (mã Hub):** `MKT_004` Spend, `MKT_001` Raw Leads, `MKT_002` Valid Leads, `MKT_006` CPL Valid, `MKT_008` MQL Rate, `MKT_009` ROAS.

**Công thức chuẩn (khớp Dictionary, không copy lệch):**

| KPI | Mã | Công thức | Nguồn SoR |
|---|---|---|---|
| Spend | `MKT_004` | `SUM(spend)` | Ads |
| Raw Leads | `MKT_001` | `DISTINCTCOUNT(lead_id)` | CRM |
| Valid Leads | `MKT_002` | Distinct valid / non-duplicate / non-test | CRM |
| CPL | `MKT_006` | `MKT_004 / MKT_002` | Ads + CRM |
| MQL Rate | `MKT_008` | `MKT_007 / MKT_002` | CRM |
| ROAS | `MKT_009` | `SAL_008 / MKT_004` Wave A (Last-touch CRM). **Không** mặc định invoice ERP | Ads + CRM |

Attribution Wave A: Last-touch (Hub). UI ghi model/window. Không trộn platform conversion với Valid Lead trên cùng thẻ.

**Bảng campaign:** Spend, Raw, Valid, CPL, MQL Rate, MQL, ROAS, Target status, DQ%. Tab Ad Set / Creative / Landing: **ẩn** nếu fact chưa có grain; không bịa hàng.

**Creative:** chỉ khi có thumbnail/policy storage; sample size thấp → warning.

### 5.3. Sales (`/crm/kpi-hub/sales`)

**6 thẻ (mã Hub):** `SAL_005` Open/Pipeline Value, Weighted (cùng `SAL_005` × probability khi có; thiếu probability → hiện `SAL_005` + badge “chưa trọng số”), `SAL_001` SQL, `SAL_003` Cuộc hẹn, `SAL_007` Win Rate, `SAL_008` Doanh thu kỳ mới.

**SLA:** first activity vs first successful contact theo định nghĩa Dictionary; calendar ICT + ngày nghỉ nếu workspace có. Quá SLA: lead, owner, source, overdue — mask PII theo `crm_leads`.

**Deal risk (rule, không ML):** không activity X ngày, close quá hạn, stage aging, thiếu báo giá, thiếu next step. Owner + deep-link `/crm/leads/{id}`.

**Bảng hiệu suất:** Team / NV / Nguồn / Sản phẩm. Không xếp hạng nếu sample/territory khác nhau mà không hiện filter.

Tái sử dụng dữ liệu lead/deal; **không** thay `/crm/leads` hay Sales Cockpit.

---

## 6. Dự án thống nhất (PTT + Delivery)

### 6.0. Một dự án, hai năng lực

Người dùng quản lý **một danh mục**. Mỗi record có 1–2 năng lực:

| Năng lực | Việc | Lưu ở đâu | Cap |
|---|---|---|---|
| `lead_ingest` | Page/OA/webhook, pool NV, SLA gọi, AI gọi, hoa hồng | `crm_b2b_projects` + kênh/staff (đã có) | `crm_b2b_projects.view/manage` |
| `delivery` | Khách, dịch vụ, milestone, ngân sách, KPI Dictionary | `crm_delivery_projects` + bảng con | `crm_delivery_projects.view/edit/manage` |

```text
crm_delivery_projects          ← header UI (id, name, pm, capabilities[])
        │ 1:0..1
        ▼
crm_b2b_projects               ← facet ingest (code slug, sla_json, …)
        │
        ▼
crm_leads.b2b_project_id       ← KHÔNG đổi cột / webhook / flag PTT_B2B_PROJECT_OS
```

**Cấm:** xóa `crm_b2b_projects`; ghi lead vào `delivery_projects.id`; gộp `crm_re_projects`.

**Backfill Wave B:** với mỗi B2B hiện có (kể cả `PTT-LEGACY`): tạo header `name/code` copy, `capabilities=['lead_ingest']`, `b2b_project_id` trỏ đúng hàng. PM = creator hoặc SUPER-ADMIN. Không tự bịa khách/milestone.

**Tạo mới:** một wizard. Bật `lead_ingest` → `POST /api/v1/b2b-projects` (hoặc wrap) rồi gắn FK. Bật `delivery` → bước 2–5. Chỉ lead → sau B1 có thể **Lưu & xong** (không bắt Pending Approval Delivery). Chỉ delivery → không tạo hàng B2B. Cả hai → một tên, hai hàng 1:1.

**Pause độc lập:** `ingest_status` (`active/paused/…`) ≠ `delivery_status` (`on_hold/…`). Tạm dừng nhận lead không đóng milestone.

**Mã hiển thị:** có delivery → `PRJ-xxx` (immutable sau Approved). Slug webhook = `crm_b2b_projects.code` (có thể khác PRJ). UI hiện cả hai khi có ingest: `PRJ-025 · slug an-gia-q4`.

### 6.1. Mặt giao hàng

Khi `delivery` bật: hợp đồng/chiến dịch cho **một khách**, dịch vụ, milestone, ngân sách, KPI Dictionary.

Vẫn khác:

| Module | Việc |
|---|---|
| Facet `crm_b2b_projects` | Nhận lead PTT (cùng dự án nếu bật ingest) |
| `crm_re_projects` | Dự án bán BĐS — ngoài catalog này |
| `crm_service_lifecycle` | Cổng onboard → deliver sau won — gắn tùy chọn |

Liên kết tùy chọn: `lifecycle_id`, `lead_id`, `contract_id`, `customer_id` / agency client. Dự án *chỉ ingest* không bắt khách.

### 6.2. Vòng đời

```text
Draft → Pending Approval → Approved → Active → On Hold → Completed → Closed
                                                      ↘ Cancelled
```

- KPI *chính thức* chỉ sau `Active` (draft có thể preview).
- Policy mặc định: submit wizard → `Pending Approval` (Delivery Director; Finance nếu Wave C vi phạm margin/budget).
- Không hard-delete nếu đã có budget/KPI/audit; archive/cancel.
- Code `PRJ-xxx` (sequence workspace). Immutable sau Approved. Slug B2B không đổi khi rename PRJ.

### 6.3. Health (giải thích được)

| Status | Ý nghĩa Wave B/C |
|---|---|
| Ổn định | Milestone on-time và (nếu có budget) forecast trong ngưỡng, margin ≥ policy |
| Cần chú ý | Buffer milestone < 3 ngày hoặc forecast vượt budget < 5% |
| Có rủi ro | Milestone trễ dự kiến hoặc margin < policy hoặc allocation > 100% |
| Quá hạn | Due date / milestone critical đã qua |
| Chưa có số | Thiếu lịch hoặc chưa Active |

Lưu `health_components_json` (schedule, milestone, budget, margin, capacity) để UI giải thích — không “At Risk” bí ẩn.

### 6.4. Wizard — quy tắc chung

- 5 bước; autosave 30s + sau field quan trọng; quay lại không mất draft hợp lệ.
- Không next nếu blocking error.
- Save Draft / Cancel / Resume.
- Submit: tạo project + baseline version `1.0` + approval + audit + notify.

#### B1 — Thông tin cơ bản

| Field | Bắt buộc | Rule |
|---|---|---|
| Tên | Có | 3–200; unique theo khách *khi có delivery*; unique theo workspace khi chỉ ingest |
| Code PRJ | Có nếu delivery | Auto `PRJ-xxx` |
| Slug nhận lead | Có nếu ingest | Unique webhook; copy từ form B2B hiện có |
| Năng lực | Có | ≥1 toggle: **Nhận lead PTT** / **Giao hàng** |
| Khách | Có nếu delivery | Lookup CRM / agency client. Chỉ ingest: không bắt buộc |
| Loại dự án | Có nếu delivery | Performance, CRM, SEO, Branding, Website, Consulting, Khác |
| Dịch vụ | Có nếu delivery | Multi-select catalog |
| PM | Có | Staff active + cap |
| AM | Không | Staff trong scope khách |
| Ưu tiên | Có nếu delivery | Low / Normal / High / Critical |
| Mô tả | Không | Text |
| Ngày BĐ / KT | Có nếu delivery | KT ≥ BĐ |
| Status bước này | Có | Draft only |

**Khối Nhận lead PTT** (hiện khi toggle on) — reuse field modal B2B: giờ làm việc, SLA, pool NV `assign_enabled`, kênh Page/Form/OA/Web/API, `ai_call_enabled`, `manual_ingest_enabled`. Validate unique kênh active như spec B2B.

Chọn khách (delivery) nạp template dịch vụ / policy finance.

Chỉ ingest: CTA **Lưu dự án** (không bắt bước 2–5). Có delivery: **Tiếp tục: Phạm vi**.

#### B2 — Phạm vi & Dịch vụ (màn 5)

- Card dịch vụ; chọn → đề xuất deliverable template.
- Bảng: Dịch vụ, Hạng mục bàn giao, SL, Tiêu chí nghiệm thu, PIC, (milestone — sau B3 có thể backfill).
- Out of scope + giả định / phụ thuộc khách. Copy: thay đổi sau baseline → CR (Wave E; Wave B chỉ ghi chú).
- Conflict tối thiểu: thiếu brand guideline (nếu chọn Creative), thiếu quyền CRM (nếu CRM Automation), thiếu PIC dịch vụ.

#### B3 — Kế hoạch & Milestone (màn 6)

- Method: theo milestone (mặc định). Calendar T2–T6 mặc định.
- Milestone: tên unique trong dự án, code M1…, start/due, owner, Planned, dependencies, acceptance (bắt buộc milestone bàn giao), weight tùy chọn.
- **Cấm circular dependency** (Jest). Predecessor trễ → cảnh báo (Wave B không auto-dời trừ toggle “tự tính” — mặc định **tắt** để tránh nhảy ngày bất ngờ).
- Task từ template: idempotent (không nhân đôi khi retry).
- Approval gate milestone: lưu reviewer; **gửi request** khi milestone đạt điều kiện — Wave B lưu cấu hình, gửi Wave E nếu chưa có Approval Center.

#### B4 — Ngân sách & Nguồn lực (màn 7 + 8)

**Header**

| Chỉ tiêu | Rule |
|---|---|
| Ngân sách hợp đồng | Revenue agency; decimal string |
| Chi phí nội bộ | Tổng hạng mục nội bộ |
| Media Spend khách | **Không** vào revenue / margin |
| Contingency | % hoặc số trên chi phí nội bộ |
| Forecast | Tổng forecast hạng mục |
| Margin gộp | `(contract − internal_forecast − contingency) / contract` |

**Hạng mục:** tên, nhóm dịch vụ ∈ dịch vụ đã chọn, loại (Nhân sự / Sản xuất / Phần mềm / Media / Khác), cost center, owner, milestone, kỳ phân bổ ∈ lịch dự án, approved budget ≥ 0, forecast ≥ 0, actual hệ thống (0 Wave C), allocation đều|milestone|tay.

**Media:** bắt buộc `agency_borne | client_borne`. Client-borne không cộng internal cost.

**Allocation**

- Đều: chia kỳ, phần dư vào kỳ cuối.
- Milestone: bắt buộc ≥1 milestone.
- Tay: tổng = forecast, sai → error.

**Impact drawer:** cost before/after, margin before/after, % phân bổ. Margin < `min_gross_margin_pct` → Critical + link policy. Forecast > budget → Warning. Nút thêm: nếu policy chặn → tạo pending, **không** ghi baseline.

**Nguồn lực:** member, role, team, %, khoảng ngày, cost ước tính (rate × % × ngày làm việc). Overlap Active+Draft: sum % > 100 → Quá tải, yêu cầu lý do nếu vẫn lưu.

#### B5 — KPI & Xác nhận (màn 9 + 10)

- Thêm từ Dictionary (chỉ Active; Deprecated disabled + tooltip).
- Cảnh báo source Failed / DQ Critical — block publish dự án Active nếu policy `block_on_dq_critical` (mặc định **warn**, không block draft).
- Không duplicate cùng `dictionary_id` trên một dự án.
- Target scope Project > Team > Dept > Workspace (resolver Hub đã có — thêm nhánh Project).
- Không sửa formula Active trên dự án.
- Cadence: weekly review, client report (lưu lịch; job gửi Wave E).
- `Tạo action khi KPI Critical`: tạo notification Hub / CSD ticket nếu cap — Wave D notification, ticket tùy chọn.
- Checklist xác nhận + pre-create: thiếu field / circular / margin block / KPI tối thiểu (mặc định ≥1 Active KPI hoặc lý do skip).
- CTA: **Tạo dự án & Gửi phê duyệt**.

---

## 7. Thêm KPI từ Dictionary — nghiệp vụ màn 10

Layout: filter trái · bảng/thẻ giữa · inspector phải · footer count.

**Filter:** q (tên/mã), group, department, metric type, status (default Active), data source.

**Cột:** checkbox, mã+tên, group, formula tóm tắt, nguồn, chu kỳ, data trust, status.

**Inspector mỗi KPI chọn:** formula chuẩn, mapping sẵn?, target dự án (chưa / đã), dependency.

**Áp dụng**

- Radio: kế thừa version Active (mặc định) | chọn version (ẩn Wave D).
- Toggle: tạo draft target từ template dự án.
- Toggle: kế thừa alert rule.

**Validate:** duplicate, source unavailable, scope mismatch (KPI department vs project services — warning), unit/direction vs template. Thiếu target → warning, không block (nhập ở B5).

Nút: `Thêm {n} KPI vào dự án` / Hủy. Persist trong wizard state.

---

## 8. Mô hình dữ liệu — chỉ phần mới

Không tạo lại `workspaces`, `kpi_definitions`, `alerts`, `dq_*`, `reports`. Dùng `crm_kpi_*` / `crm_kpi_hub_*`.

### 8.1. Bảng mới (Wave B–D)

```text
crm_delivery_projects
  id UUID PK
  tenant_id TEXT DEFAULT 'PTT'
  code TEXT UNIQUE          -- PRJ-025; NULL nếu chỉ lead_ingest
  name TEXT
  capabilities TEXT[]       -- {lead_ingest} | {delivery} | {lead_ingest,delivery}
  b2b_project_id UUID NULL UNIQUE REFERENCES crm_b2b_projects(id)
  status TEXT               -- draft|pending_approval|approved|active|on_hold|completed|closed|cancelled
  customer_id BIGINT NULL
  agency_client_id BIGINT NULL
  lead_id BIGINT NULL
  contract_id BIGINT NULL
  lifecycle_id BIGINT NULL  -- crm_service_lifecycle
  project_type TEXT
  priority TEXT
  pm_staff_id INT NOT NULL
  am_staff_id INT NULL
  start_date DATE NOT NULL
  end_date DATE NOT NULL
  description TEXT
  contract_budget NUMERIC
  internal_cost_budget NUMERIC
  client_media_budget NUMERIC
  contingency_amount NUMERIC
  forecast_cost NUMERIC
  gross_margin_pct NUMERIC
  health_status TEXT
  health_components_json JSONB
  current_version INT DEFAULT 0
  created_by_staff_id INT
  updated_at / created_at / deleted_at
  row_version INT

crm_delivery_project_services
  project_id, service_code, sort_order

crm_delivery_deliverables
  project_id, service_code, name, quantity, acceptance, owner_staff_id, milestone_id NULL

crm_delivery_milestones
  project_id, code, name, start_date, due_date, owner_staff_id, status, weight, acceptance
  -- dependencies: crm_delivery_milestone_deps (from_id, to_id) UNIQUE, CHECK from <> to

crm_delivery_tasks          -- Wave B template spawn
crm_delivery_budget_items   -- Wave C
crm_delivery_budget_allocs
crm_delivery_resources      -- Wave C
crm_delivery_project_kpis   -- Wave D: dictionary_id, kpi_version, target_id, cycle, owner_staff_id
crm_delivery_wizard_drafts  -- JSON state per user+draft_id
```

Tiền: `NUMERIC` / decimal string API — không float.

### 8.2. Mở rộng Hub

- `crm_kpi_targets.scope_type` thêm `PROJECT` + `scope_project_id`.
- Resolver target: Project > User > Team > Department > Client > Workspace.
- Fact: dimension `delivery_project_id` optional trên compute Wave D (nếu KPI có grain dự án). Wave A Command Center **không** cần grain này.

### 8.3. Cấm

- Cột `project_id` trên `crm_staff_kpi` Wave D (sổ NV khác grain).
- Duplicate Dictionary table.
- `workspaces` SaaS song song.
- Drop `crm_b2b_projects` hoặc đổi FK lead sang header UUID.

---

## 9. API

Base: `/api/crm/delivery-projects` (staff auth + cap). Convention Hub: JSON, ISO UTC, decimal string, `If-Match` row_version, error `{ code, message, field_errors, correlation_id }`.

| Method | Path | Wave |
|---|---|---|
| GET/POST | `/api/crm/delivery-projects` | B |
| GET/PATCH | `/api/crm/delivery-projects/:id` | B |
| PUT | `/api/crm/delivery-projects/:id/wizard` | B |
| POST | `/api/crm/delivery-projects/:id/submit` | B/C |
| GET/POST | `.../milestones` | B |
| POST | `.../milestones/validate-deps` | B |
| GET/POST | `.../budget-items` | C |
| POST | `.../budget-items/preview-impact` | C |
| GET/POST | `.../resources` | C |
| GET/POST | `.../kpis` | D |
| GET | `/api/crm/kpi-hub/dictionary?status=ACTIVE&...` | đã có — picker gọi lại |
| GET | `/api/crm/kpi-hub/dashboard/executive` | A — hoặc query param `persona=` trên dashboard hiện có |

Idempotency-Key cho POST create/submit/add-KPI.

---

## 10. Quy tắc nghiệp vụ (gốc §24, đã neo RNOSAI)

| ID | Rule |
|---|---|
| BR-E01 | Một Dictionary Active / một version hiệu lực trong kỳ (Hub BR-001). |
| BR-E02 | Ratio tính tổng tử / tổng mẫu trên tập filter, không average các tỷ lệ ngày. |
| BR-E03 | `SAL_008` ≠ `FIN_001` ≠ `FIN_002`. |
| BR-E04 | Client media spend tách khỏi revenue và internal cost. |
| BR-E05 | Không Active khi policy duyệt và chưa Approved. |
| BR-E06 | Source Failed / DQ Critical → badge trust trên mọi Command Center và KPI dự án. |
| BR-E07 | Deprecated không chọn mới vào dự án/report. |
| BR-E08 | Đổi formula/mapping/time/unit/direction → version mới Hub, không sửa tại dự án. |
| BR-E09 | Forecast > budget hoặc margin < policy → approval Finance, không bypass thiếu cap. |
| BR-E10 | Allocation chồng > 100% → warning + lý do (Active) hoặc chặn (nếu Settings `block_over_capacity`). Mặc định warn. |
| BR-E11 | Dependency milestone không vòng. |
| BR-E12 | Target Project thắng target rộng hơn. |
| BR-E13 | Alert dedupe theo rule + object + kỳ. |
| BR-E14 | PII lead/deal mask theo cap lead. |
| BR-E15 | Soft-delete / archive; không xóa vật lý bản ghi có audit/budget. |
| BR-E16 | Export nhạy cảm audit (Hub đã có). |
| BR-E17 | Lead B2B chỉ ghi `crm_leads.b2b_project_id` → `crm_b2b_projects.id`. Header không thay webhook/flag. Xóa header khi còn ingest → chặn (archive ingest trước). |
| BR-E18 | Service Delivery lifecycle không bị wizard xóa/ghi stage. |

---

## 11. Đặc tả UI — 10 màn (bắt buộc giống mockup)

Nguồn ảnh: bộ mockup KPI Hub Enterprise (04/09/2026). Implementer **không được** gộp/bỏ khối “cho gọn”. Thiếu dữ liệu → empty / `—` / skeleton đúng chỗ, vẫn giữ khung.

### 11.0. Chrome chung (mọi màn Hub + Delivery)

OpsNav ngoài cùng giữ nguyên. Bên trong trang: **`KpiHubShell`** theo mockup.

```text
┌ KpiHubShell ─────────────────────────────────────────────────────────┐
│ [sidebar 240px]     [header] breadcrumb · search · chuông · avatar   │
│  KPI Hub            [title + subtitle]  [actions kỳ / xuất / CTA]    │
│  TỔNG QUAN          [filter chips]                                   │
│   Executive         ┌──────────────────────────────────────────────┐ │
│   Marketing         │ nội dung màn                                 │ │
│   Sales             └──────────────────────────────────────────────┘ │
│   Project Delivery  [footer freshness · chip nguồn · Xem lineage]    │
│  GOVERNANCE                                                          │
│   KPI Dictionary · Target & Cảnh báo · Nguồn dữ liệu                 │
│   Data Quality · Approval Center                                     │
│  PHÂN TÍCH                                                           │
│   Báo cáo · Audit Log · Cài đặt                                      │
│  ──── role + phạm vi (đọc từ staff, không hardcode) ────             │
└──────────────────────────────────────────────────────────────────────┘
```

| Phần | Spec |
|---|---|
| Sidebar nhóm | 3 heading đúng chữ: `TỔNG QUAN` · `GOVERNANCE` · `PHÂN TÍCH` |
| Mục Tổng quan | Executive Command Center → `/crm/kpi-hub/executive` · Marketing Performance → `/crm/kpi-hub/marketing` · Sales Command Center → `/crm/kpi-hub/sales` · Project Delivery → `/crm/delivery-projects` |
| Governance | Giữ route Hub hiện có. **Approval Center** → `/crm/kpi-hub/approvals` (Wave A: list pending KPI/target/report; Wave E: đủ policy). |
| Phân tích | Báo cáo `/crm/kpi-hub/reports` · Audit Log `/crm/kpi-hub/audit` (filter `crm_kpi_*` + delivery) · Cài đặt `/crm/kpi-hub/settings` |
| Active | Nền xanh nhạt, chữ `#17692f`, vạch trái |
| Header phải | Ô tìm (placeholder theo màn) · Help · chuông badge số · avatar chữ |
| Footer | `Dữ liệu cập nhật: {ICT}` · chip Fresh/Delayed/Failed **kèm chữ** · link `Xem lineage` (Hub sources; 404-soft nếu chưa có visual) |
| Token | Canvas `#F7F8FA` · card trắng bo 10px · primary `#17692f` · info `#2563EB` · warning `#c58a00` · critical `--danger` · chữ `#0F172A` |
| Cấm | Tailwind · app window thứ hai · badge `PRODUCTION` giả · font mới ngoài stack ops-web |

Mọi card/bảng/chart: loading skeleton · empty + CTA · no-data `—` · 403 · delayed/failed note · không đổi null thành 0.

Wizard 5 bước (màn 5–9): stepper ngang đủ 5 nhãn; bước xong = check xanh; bước hiện tại đậm; góc `Bước n/5`. Cụm nút trên: **Lưu nháp** · **Hủy** · **Tạo dự án** (disabled đến B5). Footer: `Đã lưu tự động lúc HH:mm` · **Quay lại: {bước trước}** · **Tiếp tục: {bước sau}**.

---

### 11.1. Màn 1 — Executive Command Center

**Route:** `/crm/kpi-hub/executive`  
**Title:** `Executive Command Center`  
**Subtitle:** `Hiệu suất kinh doanh theo thời gian thực và độ tin cậy dữ liệu.`

**Hàng điều khiển:** date range · `So với tháng trước` · **Xuất báo cáo** · **+ Tạo báo cáo** (mở wizard Hub, prefill filter).  
**Chip ngữ cảnh:** Client · Business Unit · `RLS` (nếu cap) · kỳ đang chọn.

**Thứ tự khối (trên → dưới), không đảo:**

```text
[ 6 thẻ KPI ]
[ KPI Performance & Forecast | Target at Risk ]
[ Funnel & Bottleneck | Data Trust & Freshness | Approval Queue ]
[ Exceptions & Actions — full width ]
```

**6 thẻ** (trái → phải, đúng mockup): Doanh thu kỳ mới · Pipeline có trọng số · Valid Leads · CPL Valid Lead · MQL Rate · Win Rate. Mỗi thẻ: tên · actual format unit · Δ% vs kỳ trước · sparkline (≥2 điểm) · badge Đạt / Thiếu / Critical / NO_DATA / DATA_ISSUE · chip Fresh. Click → drill Dictionary/fact.

**KPI Performance & Forecast:** line/bar Actual (đậm) + Target (nét đứt). Forecast chỉ vẽ khi Settings + có model; không có thì không bịa “91%”. Chú thích dưới chart khi có forecast thật.

**Target at Risk:** list dọc. Mỗi hàng: icon severity · tên KPI · scope/team · actual vs target · avatar owner · `SLA {giờ}`. Sort: Critical → Warning → impact. CTA hàng → alert Hub.

**Funnel:** ngang Raw Leads → Valid → MQL → SQL → Appt → Won + % chuyển. Callout cam `Điểm nghẽn: {tên}` (mặc định MQL Rate nếu lệch target).

**Data Trust:** gauge 0–100 “Overall Score” + bảng nguồn: CRM / Meta Ads / SharePoint / ERP × Fresh|Delayed|Failed × thời gian.

**Approval Queue:** 3 nhóm đếm (KPI duyệt · Đổi target · Mapping) + 2–3 hàng gần nhất + **Review**.

**Exceptions & Actions:** tab `Tất cả ({n})` · `Critical` · `Warning` · `Chờ duyệt`. Cột: Ưu tiên · Đối tượng · Vấn đề · Tác động · Owner · SLA · Trạng thái · ⋯. Không resolve thiếu note + cap.

---

### 11.2. Màn 2 — Marketing Performance

**Route:** `/crm/kpi-hub/marketing`  
**Title:** `Marketing Performance`  
**Subtitle:** `Theo dõi hiệu quả đầu tư quảng cáo, chất lượng lead và chuyển đổi Marketing.`

**Hàng điều khiển:** kỳ `01–30 Tháng {mm}, {yyyy}` · `So với tháng trước` · Bộ lọc nâng cao · **Xuất báo cáo** · **+ Tạo báo cáo**.  
**Chip:** `Toàn bộ kênh` · `Tất cả campaign` · Sản phẩm · Khu vực (xóa được) · chip freshness Meta/CRM.

```text
[ 6 thẻ ]
[ Hiệu quả Media & Chuyển đổi     | Phân bổ ngân sách & Hiệu quả ]
[ Funnel Marketing                | Cảnh báo Marketing ]
[ Hiệu quả theo Campaign (wide)   | Top Creative | Data Trust ]
```

**6 thẻ:** Tổng chi tiêu (`MKT_004`) · Raw Leads · Valid Leads · CPL Valid (`Đạt ≤ {target}`) · MQL Rate (`Thiếu x% target`) · ROAS (`Vượt target {x}x`).

**Media chart:** cột Spend theo ngày + line Valid Leads + line đứt CPL target. Insight 1 dòng rule-based (không LLM), ẩn nếu không đủ 2 kỳ.

**Donut kênh:** Meta / Google / TikTok / Organic + bảng Channel · % · Spend · CPL. Grain thiếu → empty “Chưa có breakdown kênh”.

**Funnel MKT:** Impressions → Clicks → Raw → Valid → MQL. CTR, Landing CVR. Callout `Điểm nghẽn chính` tại tầng lệch target.

**Cảnh báo Marketing:** tối đa 4–8 hàng: Warning/Critical/Info · mô tả · Owner · SLA. Deep-link alert Hub.

**Bảng campaign:** tab `Campaign` · `Ad Set` · `Creative` · `Landing Page` (tab không có grain = empty, **không xóa tab**). Cột: Tên · Kênh (icon) · Spend · Raw · Valid · CPL (màu) · MQL Rate · MQL · ROAS · Target (pill) · DQ% · ⋯.

**Top Creative:** 2–3 thumbnail + CTR/CPL; thiếu asset → empty + “Chưa có creative”.  
**Data Trust:** gauge + CRM / Meta / GA4 / SharePoint.

---

### 11.3. Màn 3 — Sales Command Center

**Route:** `/crm/kpi-hub/sales`  
**Title:** `Sales Command Center`  
**Subtitle:** `Theo dõi pipeline, hiệu suất team, SLA xử lý lead và dự báo doanh thu.`

**Hàng điều khiển:** kỳ · so sánh · Bộ lọc nâng cao · **Xuất báo cáo** · **+ Tạo Deal** (cap `crm_leads.edit` → `/crm/leads/new`; không cap thì ẩn).  
**Chip:** Team · Nguồn lead · Pipeline/sản phẩm · Khu vực.

```text
[ 6 thẻ — mỗi thẻ sparkline + CRM Fresh ]
[ Pipeline & Dự báo doanh thu     | SLA & Lead Response ]
[ Funnel Sales & Điểm nghẽn       | Cảnh báo Sales ]
[ Hiệu suất theo Sales Team       | Deal cần chú ý | Data Trust ]
```

**6 thẻ:** Pipeline đang mở · Pipeline có trọng số (`82% mục tiêu` khi có target) · SQL · Cuộc hẹn hoàn thành · Win Rate (`Critical — Target ≥ …`) · Doanh thu kỳ mới (`Đạt x% target`).

**Pipeline & Forecast:** stacked ngang New / Qualified / Proposal / Negotiation / Won + line lũy kế vs target. Câu dự báo chỉ hiện khi có model; không thì ẩn.

**SLA:** gauge actual phút vs `≤ {target}`. Dòng: % < 15 phút · chưa liên hệ · quá SLA · Contact Rate. Bar phân bố ≤5 / 5–15 / 15–30 / >30. Link `Xem danh sách quá SLA` → leads filter.

**Funnel Sales:** MQL → SQL → Appt → Proposal → Negotiation → Won + % giữa tầng. Callout đỏ `Điểm nghẽn: Win Rate thấp` khi `SAL_007` Critical.

**Cảnh báo Sales:** icon severity · vấn đề · owner · team · SLA. Nút `Mở Alert Center`.

**Bảng:** tab `Theo Team` · `Theo nhân viên` · `Theo nguồn lead` · `Theo sản phẩm`. Cột: tên+avatar · SQL · Hẹn · Pipeline · Doanh thu · Win Rate · Response · Contact Rate · Target (pill) · DQ%.

**Deal cần chú ý:** card deal (mã, tên, giá, tag, hạn). Link `Mở Pipeline Board` → `/crm/leads`.  
**Data Trust:** gauge + CRM / Call Center / ERP / SharePoint.

---

### 11.4. Màn 4 — Project Delivery portfolio

**Route:** `/crm/delivery-projects`  
**Title:** `Project Delivery`  
**Subtitle:** `Danh mục dự án, tiến độ, ngân sách, nguồn lực và rủi ro bàn giao.`

**Hàng điều khiển:** kỳ tháng · Khách (Tất cả) · Bộ lọc nâng cao · **Xuất báo cáo** · **+ Tạo dự án** → `/crm/delivery-projects/new`.  
**Chip:** Status · Service · PM · Priority · **Năng lực:** Tất cả / Nhận lead / Giao hàng / Cả hai · `Xóa bộ lọc`.

OpsNav **Dự án PTT** → cùng trang, chip Năng lực = Nhận lead.

```text
[ 6 thẻ ]
[ Tiến độ danh mục & Milestone (Gantt)     | Sức khỏe danh mục ]
[ Ngân sách & lợi nhuận theo dự án         | Rủi ro & cần xử lý ]
[ Danh mục dự án (wide)                    | Nguồn lực & Capacity | Chất lượng bàn giao ]
```

**6 thẻ:** Tổng dự án (+Δ tháng) · Đúng tiến độ `{n}/{total}` + bar% · Dự án có rủi ro (`Cần can thiệp`) · Quá hạn (+Δ tuần) · Ngân sách đã dùng `{actual}/{budget}` + bar · Biên lợi nhuận dự kiến vs `≥ {policy}%`. Wave B: hai thẻ tiền = `—` nếu chưa Wave C.

**Gantt portfolio:** tab `Timeline` · `Workload` · `Theo PM`. Banner cam nếu có dự án trễ milestone ≤7 ngày. Cột dự án × tuần; bar xanh/xanh dương/cam/đỏ; vạch `Hôm nay`. **Chỉ xem** (không drag).

**Sức khỏe:** donut `% Ổn định` + legend Ổn định / Cần chú ý / Có rủi ro / Chưa bắt đầu. Bar “Tỷ lệ hoàn thành milestone”. Nút `Xem Risk Register` (Wave E trang; Wave B empty).

**Budget chart:** grouped bar Budget / Actual / Forecast theo dự án. Cảnh báo 1 dòng nếu forecast vượt. Wave B: empty “Chưa có ngân sách”.

**Rủi ro:** cột Mức độ · Dự án · Vấn đề · Owner · SLA. Nút `Xem Delivery Planning`.

**Bảng danh mục:** tab `Danh sách` · `Kanban` · `Timeline` · `Capacity` (List bắt buộc có dữ liệu; 3 tab kia khung + empty Wave B). Cột List: Mã (`PRJ-xxx` và/hoặc slug) · Tên · Khách (`—` nếu chỉ ingest) · **Năng lực** (pill `Lead` / `Giao hàng`) · Dịch vụ · PM (avatar) · Progress (ring; `—` nếu không delivery) · Milestone `a/b` · Budget · Forecast · Margin · Hạn · Health pill · Ingest (`Đang chạy` / `Tạm dừng`) · ⋯. Search + `Delivery tuần này`. Page 20.

**Detail thống nhất** (`/crm/delivery-projects/:id`): tab `Tổng quan` · `Nhận lead` (UI hiện có B2B: kênh, pool, SLA — embed, không trang cũ) · `Phạm vi` · `Milestone` · `Ngân sách` · `KPI` · `Rủi ro`. Tab ẩn nếu năng lực tắt. `PTT-LEGACY` chỉ hiện tab Nhận lead.

**Capacity:** bar team Performance / CRM / Content / Creative; >100% đỏ. Nút `Xem Capacity Planning`.  
**Delivery Quality:** điểm /100 + Milestone đúng hạn · Client approval SLA · Rework%. Nút `Xem Delivery Quality` · `Xem audit trail`.

**Footer nguồn:** Project data · Timesheet · Finance.

---

### 11.5. Màn 5 — Wizard B2 Phạm vi & Dịch vụ

**Route:** `/crm/delivery-projects/new?step=2`  
**Title:** `Tạo dự án mới`  
**Subtitle:** `Bước 2: Xác định dịch vụ, phạm vi bàn giao, giả định và tiêu chí nghiệm thu.`  
**Breadcrumb:** `Project Delivery / Danh mục dự án / Tạo dự án mới`.

```text
[ stepper 5 bước ]
[ Dịch vụ triển khai — grid card ]
[ Phạm vi bàn giao — bảng ]
[ Ngoài phạm vi | Giả định ]
                          [ rail: Tóm tắt phạm vi | Xung đột | Quản trị thay đổi ]
[ footer wizard ]
```

**Card dịch vụ (8, 2–4 cột):** Performance Marketing · Landing Page & CRO · CRM Automation · Creative Production · SEO & Content · Website Development · Branding · Training & Consulting. Mỗi card: icon · tên · mô tả 1 dòng · checkbox. Đã chọn: viền xanh + badge `Đã chọn`. Footer `0n dịch vụ đã chọn` + `Quản lý danh mục dịch vụ`.

Chọn card → sinh/đề xuất dòng deliverable (không xóa dòng user đã sửa).

**Bảng bàn giao:** Dịch vụ · Hạng mục · Số lượng · Tiêu chí nghiệm thu · Phụ trách (avatar) · sửa/xóa. Nút `+ Thêm hạng mục bàn giao`.

**Hai ô text** cạnh nhau: Ngoài phạm vi · Giả định / phụ thuộc khách. Banner xanh: thay đổi ngoài scope sau baseline → Change Request.

**Rail phải**

- Tóm tắt: tên + Draft · khách · donut nhóm dịch vụ · bar “Hoàn thiện phạm vi” · checklist (đã chọn dịch vụ / đã có deliverable / tiêu chí / nguồn lực).
- Phát hiện xung đột: list warning + `Xem chi tiết`.
- Quản trị thay đổi: Baseline → CR → Review → Approval → Plan. Toggle `Yêu cầu phê duyệt khi đổi scope` (mặc định bật, persist). Version `0.x Draft`.

**Footer:** `Quay lại: Thông tin cơ bản` · `Tiếp tục: Kế hoạch & Milestone`.

---

### 11.6. Màn 6 — Wizard B3 Kế hoạch & Milestone

**Subtitle:** `Bước 3: Thiết lập lịch, milestone, phụ thuộc và cổng phê duyệt.`

```text
[ Thiết lập kế hoạch ]
[ Milestone & kế hoạch bàn giao — bảng + Gantt ]
[ Công việc khởi tạo ]
                    [ rail: Tóm tắt timeline | Cảnh báo kế hoạch | Cổng phê duyệt ]
```

**Thiết lập:** Ngày BĐ · Ngày KT · Method `Theo Milestone` · Lịch `Thứ Hai – Thứ Sáu` · toggle `Tự động tính timeline theo phụ thuộc` (mặc định **tắt** — bật mới auto-dời). Banner: ngày sẽ chỉnh khi dependency đổi *nếu* toggle on.

**Milestone toolbar:** `+ Thêm milestone` · `Áp dụng template`.

**Bảng:** Tên · BĐ · Hạn · Status (`Planned`) · Phụ thuộc (M1, M2…) · Owner avatar.  
**Gantt phải:** bar xanh + kim cương milestone · tháng trên trục · vạch `Hôm nay`. Không drag Wave B.

**Công việc khởi tạo:** badge `n task` · `n milestone` · `n dependency` · `n owner`. Checklist (chỉ đọc): tạo task từ template · thư mục tài liệu · kênh · lịch weekly review — tick khi job chạy (idempotent).

**Rail**

- Tóm tắt: tên · Draft · khách · vòng `n milestone` / `n ngày` · path M1→… · badge `Khả thi` / `Căng`.
- Cảnh báo: buffer <3 ngày · cổng duyệt · hạn feedback khách.
- Cổng phê duyệt: toggle tự tạo request theo milestone. Timeline dọc M1 Scope · M4 Pre-launch · M6 Handover (cấu hình theo template).

**Footer:** `Quay lại: Phạm vi & Dịch vụ` · `Tiếp tục: Ngân sách & Nguồn lực`.

---

### 11.7. Màn 7 — Wizard B4 Ngân sách & Nguồn lực

**Subtitle:** `Bước 4: Ngân sách hợp đồng, chi phí nội bộ, phân bổ nguồn lực và ngưỡng phê duyệt.`

```text
[ Ngân sách dự án — method + 4 thẻ + bảng hạng mục ]
[ Phân bổ nguồn lực — bảng ]
[ Chi phí phát sinh & Contingency ]
                    [ rail: Tóm tắt tài chính | Cảnh báo NL | Phê duyệt tài chính ]
```

**Cấu hình:** method `Theo hạng mục dịch vụ` · currency VND · toggle `Yêu cầu Finance phê duyệt khi vượt ngưỡng`.

**4 thẻ:** Ngân sách hợp đồng · Chi phí nội bộ dự kiến · Media Spend khách (nhãn “không tính revenue”) · Biên lợi nhuận gộp dự kiến (xanh nếu ≥ policy).

**Bảng hạng mục:** Hạng mục · Loại chi phí · Budget · Forecast · Allocation (bar%) · Owner avatar · sửa/xóa. Nút `+ Thêm hạng mục` mở màn 8. Footer: Tổng nội bộ · Còn lại.

**Nguồn lực:** `Gán thành viên` · view `Theo tuần`. Cột: Member · Role · Team · % · Khoảng ngày · Capacity (bar xanh/cam/đỏ) · Chi phí ước tính · Status (`Sẵn sàng` / `Quá tải` / `Cần xác nhận`).

**Contingency:** % rủi ro + số tính sẵn · toggle cho phép phát sinh · toggle CR khi vượt budget · ngưỡng `> số` hoặc `> %`.

**Rail**

- Donut margin · Revenue / Internal / Contingency · bar “Kế hoạch sử dụng budget” · badge `Trong ngưỡng lợi nhuận` hoặc Critical.
- Cảnh báo NL (103%…) · `Mở Capacity Planning`.
- Luồng PM → Delivery Director → Finance · toggle duyệt trước Active · `Ngưỡng: margin tối thiểu 30%`.

**Footer:** `Quay lại: Kế hoạch & Milestone` · `Tiếp tục: KPI & Xác nhận`.

---

### 11.8. Màn 8 — Modal Thêm hạng mục ngân sách

**Pattern:** modal lớn (không full-route) trên nền B4. Overlay + Esc / Hủy. Title `Thêm hạng mục ngân sách`. Subtitle `Thiết lập ngân sách, phương pháp phân bổ, owner và quy tắc kiểm soát chi phí.`

**Banner context:** `PRJ-xxx • {tên}` · khách · pill `Draft`.

```text
[ Trái: thông tin + ngân sách & phân bổ ]
[ Phải: tác động · kiểm soát · checklist ]
[ Hủy | Lưu nháp | Thêm hạng mục ngân sách ]
```

**Trái — thông tin:** Tên · Nhóm dịch vụ · segmented Loại (Nhân sự / **Sản xuất** / Phần mềm / Media / Khác) · Cost center · Mô tả · Owner picker · Milestone multi-tag · Date range phân bổ.

**Trái — tiền:** 3 mini-card Ngân sách phê duyệt · Forecast ban đầu (warning `% trên budget`) · Actual (`0` Wave C, không sửa). Radio phân bổ: Đều theo tháng (mặc định) · Theo milestone · Thủ công. Bảng kỳ + số + %. Banner: forecast vượt → CR khi Active.

**Phải — tác động:** donut `% đã phân bổ` · Internal trước → sau · Contract · Margin trước → sau (đỏ nếu <30%) · banner Critical policy · bar breakdown nhóm.

**Phải — kiểm soát:** 3 toggle (Finance duyệt · alert Forecast>Budget · CR nếu vượt 5%). Timeline PM → Director → Finance + badge `Cần phê duyệt`.

**Checklist:** Owner · Milestone · Kỳ · Margin dưới 30% (X đỏ) · Forecast vượt (cam). Link `Xem chính sách tài chính`.

**Footer:** Hủy · Lưu nháp · **Thêm hạng mục ngân sách**. Ghi chú `Sẽ gửi Finance phê duyệt` khi checklist fail policy. Recalc impact khi đổi số (≤1s).

---

### 11.9. Màn 9 — Wizard B5 KPI & Xác nhận

**Subtitle:** `Bước 5: Gắn KPI dự án, target, nhịp cảnh báo và xác nhận khởi tạo.`

```text
[ KPI dự án & Target — toolbar + bảng ]
[ Cảnh báo & nhịp điều hành — 2 cột ]
[ Xác nhận khởi tạo — checklist ]
                    [ rail: Tóm tắt dự án | KPI Health Preview | Luồng phê duyệt | Pre-check ]
```

**Toolbar bảng KPI:** `+ Thêm KPI từ Dictionary` (màn 10) · `Sao chép từ Template` · filter Nhóm.

**Cột bảng:** KPI (mã+tên) · Định nghĩa/công thức · Baseline · Target · Warning · Critical · Chu kỳ (Tuần/Tháng) · Owner thực (avatar + `Đã cấu hình` / `Cần xác nhận`).

**Cảnh báo (trái):** toggle `Cảnh báo tự động` · checkbox KPI Warning · KPI Critical · Freshness > SLA · Milestone trễ. Dropdown tần suất (`Mỗi 4 giờ`) · kênh `In-app + Email` · recipients avatar (Director, PM, AM, Finance).

**Nhịp (phải):** Weekly meeting (thứ + giờ) · Customer report (thứ + giờ). Toggle `Tự tạo báo cáo tuần` · `Tạo action khi KPI Critical`.

**Xác nhận:** 3 checkbox bắt buộc (đã rà scope/KPI · budget khớp policy · đồng ý luồng duyệt). Banner: sau tạo → `Pending Approval`; baseline versioned.

**Rail**

- Tóm tắt: mã · tên · khách · Pending Approval · số dịch vụ/milestone/task · budget · margin · số KPI · bar setup %.
- KPI Health Preview: 5 hàng bar Đạt / Cần cải thiện / Theo dõi (preview, không actual production).
- Luồng: PM (xong) → Director (chờ) → Finance (chờ nếu C) → Kích hoạt.
- Pre-check: xanh/đỏ từng điều kiện; warning `n KPI cần Director xác nhận` không chặn nếu không policy-block.

**Footer chính:** `Quay lại: Ngân sách & Nguồn lực` · **Tạo dự án & Gửi phê duyệt**.

---

### 11.10. Màn 10 — Thêm KPI từ Dictionary

**Route:** `/crm/delivery-projects/:id/kpis/add` hoặc overlay full-height từ B5.  
**Title:** `Thêm KPI từ Dictionary`  
**Breadcrumb:** `Project Delivery / {PRJ} / KPI & Xác nhận / Thêm KPI từ Dictionary`.

**Hàng trên:** dropdown dự án + pill Draft · **Hủy** · **Thêm {n} KPI đã chọn**. Banner xanh: kế thừa formula/mapping/DQ; target cấu hình theo dự án.

```text
[ Filter trái ] [ Bảng Dictionary ] [ Rail KPI đã chọn ]
[ footer: dictionary updated · chip Fresh · Xem Data Lineage ]
```

**Filter:** search `Tên, mã KPI…` · checkbox Nhóm (Acquisition, Media Efficiency, Funnel, Sales Outcome, Revenue, Delivery, Finance) · Phòng ban · Loại metric (Count, Currency, %, Duration) · Status (Active mặc định; Pending; Deprecated) · Data Source (CRM, Meta, Google, ERP, GA4, SharePoint).

**Toolbar bảng:** `{n} KPI khả dụng` · toggle `Danh sách` | `Thẻ` · sort `Phổ biến nhất`.

**Cột:** ☑ · KPI (mã + tên) · Nhóm · Công thức tóm tắt · Nguồn (logo) · Chu kỳ · Data Trust `/100` · Status. Deprecated: disabled + tooltip `Không thể chọn KPI đã Deprecated`. Page 10.

**Rail `KPI ĐÃ CHỌN ({n})`:** card mỗi KPI: tên · `Formula chuẩn` · `Data source đã mapping` · warning `Chưa cấu hình target dự án`.

**Tác động & kiểm tra:** Active count · nguồn khả dụng · không conflict · warning thiếu target (không block).

**Áp dụng:** radio kế thừa version Active | chọn version (ẩn Wave D) · toggle Target Draft từ template · toggle kế thừa alert.

**Footer rail:** `{n} KPI · {k} nguồn` · Hủy · **Thêm {n} KPI vào dự án**. Persist selection trong wizard.

---

### 11.11. Wizard B1 — Thông tin cơ bản (không có ảnh, vẫn bắt buộc)

Cùng chrome + stepper bước 1. **Hai toggle năng lực** trên cùng (mặc định: cả hai bật khi user có đủ 2 cap; thiếu cap ingest → chỉ delivery).

Form 2 cột: Tên · Code PRJ (readonly, ẩn nếu không delivery) · Slug lead (nếu ingest) · Khách (required nếu delivery) · Loại · Dịch vụ · PM · AM · Ưu tiên · Ngày BĐ/KT · Mô tả.

Khối **Nhận lead PTT** (collapse): field modal B2B hiện có.

Rail: tóm tắt năng lực + duration (nếu delivery) + “Webhook: /api/v1/webhooks/…/{slug}” nếu ingest.

Footer: chỉ ingest → **Lưu dự án**. Có delivery → `Tiếp tục: Phạm vi & Dịch vụ`.

---

### 11.12. Responsive & e2e UI

| Viewport | Hành vi |
|---|---|
| ≥1440 | 12 cột như mockup; rail 320px |
| 1024–1439 | rail xếp dưới khối chính, **không mất khối** |
| <800 | 1 cột; 6 thẻ 2 cột; sidebar Hub collapse rail |

E2E mỗi màn (cùng PR wave): heading đúng · đủ khối `data-testid` (`exec-kpi-tiles`, `mkt-funnel`, `sales-sla-gauge`, `delivery-gantt`, `wiz-stepper`, `budget-item-modal`, `dict-picker-rail`, …) · không regress `/crm/kpi`.

---

## 12. NFR (cắt theo thực tế)

| Use case | Mục tiêu |
|---|---|
| Command Center khi fact sẵn | p95 ≤ 3s (nội bộ cố gắng 800ms) |
| Portfolio list 1.000 dự án | p95 ≤ 2s, server page |
| Wizard save draft | p95 ≤ 1.5s |
| Preview impact budget | đồng bộ ≤ 1s (thuần số, không ETL) |
| Export | async nếu lớn |

Bảo mật: TLS, cap backend, không secret trên UI. Không RLS warehouse mới Wave A–D.

---

## 13. UAT tối thiểu

### Command Center (A)

- [ ] Đổi kỳ/filter → mọi thẻ/funnel/bảng cùng context; null không thành 0.
- [ ] CPL / Win Rate đúng direction; SAL_008 không hiện số hóa đơn.
- [ ] Source Delayed → badge, không kết luận Đạt giả.
- [ ] User thiếu cap không gọi được API dashboard (403).
- [ ] Executive / Marketing / Sales: đủ khối §11.1–11.3 (6 thẻ, chart, funnel, trust, alert, bảng); không thiếu rail/widget.
- [ ] Sidebar Hub 3 nhóm + 4 mục Tổng quan; active đúng route.

### Wizard 1–3 (B)

- [ ] Draft autosave, resume, cancel.
- [ ] Thiếu required không next.
- [ ] Circular milestone bị 400.
- [ ] Retry spawn task không nhân bản.
- [ ] Code PRJ tăng; hàng B2B 1:1 khi bật ingest; lead vẫn `b2b_project_id`.
- [ ] Backfill PTT-LEGACY hiện trên list, chỉ tab Nhận lead.
- [ ] `/crm/b2b-projects` 308; webhook slug cũ vẫn ingest.

### Budget (C)

- [ ] Media client-borne không giảm margin.
- [ ] Margin < 30% → Critical + Pending Approval.
- [ ] Allocation tay lệch forecast → error.
- [ ] Overlap 103% → Quá tải.

### KPI dự án (D)

- [ ] Deprecated không chọn.
- [ ] Thêm 3 KPI kế thừa đúng version Active.
- [ ] Duplicate dictionary_id bị chặn.
- [ ] Target Project thắng workspace trên thẻ dự án.
- [ ] Submit tạo approval + audit.

### Hồi quy

- [ ] `/crm/kpi` cockpit không đổi heading/formula RAG.
- [ ] `/crm/b2b-projects` ingest/SLA nguyên.
- [ ] `/crm/service-delivery` gate nguyên.
- [ ] Không bật LLM flags.

---

## 14. Việc cố ý bỏ so với SRS gốc

| Gốc | Lý do bỏ / hoãn |
|---|---|
| Multi-workspace switcher + environment badge | Một tenant PTT; môi trường = deploy thật |
| Governance sidebar (Dictionary, Approval…) trong *mọi* màn Delivery | Đã có `/crm/kpi-hub/*`; OpsNav đủ |
| Approval Center policy engine | Wave E; Wave C tuyến PM → Director → Finance cố định |
| Data lineage visual, Data-Driven attribution | Hub Phase 3 |
| Forecast/AI Insight default mở | Tắt |
| Power BI embed, semantic contract đầy đủ | Hub v1.1 mục 29 — không chặn Delivery |
| Capacity Planning / Risk Register / Quality 91 | Wave E |
| Client Viewer portal | Share report hiện có |
| Native mobile CRUD | PWA đọc alert/dashboard nếu có |

---

## 15. Tiêu chí xong từng wave

**A:** Ba route Command Center = layout §11.1–11.3 + số fact thật; sidebar 3 nhóm; e2e khối + freshness. `/crm/kpi-hub` redirect Executive hoặc tab Tổng hợp.  
**B:** Một catalog; backfill B2B → header; `/crm/b2b-projects` 308; wizard B1 toggle năng lực; B2–B3 khi có delivery; portfolio §11.4 + cột Năng lực. Ingest/SLA lead không regress.  
**C:** B4 + modal hạng mục = §11.7–11.8; margin/media đúng.  
**D:** B5 + picker Dictionary = §11.9–11.10 (inspector, inherit, count nút).

---

## 16. Handoff sau khi PO duyệt

1. Plan triển khai Wave A (file `docs/superpowers/plans/2026-09-04-kpi-hub-command-centers.md`).  
2. Plan Wave B Delivery (file riêng — subsystem khác).  
3. DDL `docs/specs/2026-09-04-postgresql-ddl-delivery-projects.sql` khi làm B.  
4. Seed cap `crm_delivery_projects` / `crm_delivery_budget`.

Không implement trong cùng PR với tài liệu này.

---

*Hết SRS tích hợp v1.2. Một dự án quản lý (PTT + Delivery); ingest lead không đổi FK.*

# SRS — Tab Pipeline bán hàng (gộp Chăm Lead + Pre-sales, Mức 1)

**Sản phẩm:** RNOSAI / ops-web + ptt-crm-api  
**Tên module:** Lead Sales Pipeline Tab (UI merge)  
**Tên tiếng Việt:** Tab Pipeline bán hàng trên chi tiết Lead  
**Document ID:** LEAD-PIPELINE-UI-001  
**Phiên bản:** 1.1  
**Ngày:** 2026-09-05  
**Trạng thái:** Sub-mockup (L3) — chờ PO duyệt trước triển khai  
**Ngôn ngữ UI:** Tiếng Việt  
**Prod:** `https://rs.pttads.vn` · tenant `PTT`

**Changelog v1.1:** Xác định rõ đây là **sub-mockup L3** — chỉ màn hình chăm Lead trên `/crm/leads/[id]`, không phải SoT suite RevOps. SoT suite: [RevOps Enterprise mockup](../../design/rnosai-revops-enterprise-mockup.html) + [SRS REVOPS-ENT-001](./2026-09-05-revops-enterprise-mockup-srs.md).

**Changelog v1.0:** Phác thảo Mức 1 — gộp giao diện B2 Chăm Lead và Pre-sales trên `/crm/leads/[id]`; không đổi API/DB; không đưa vào AM OS.

**SoT UI (thứ tự thắng):**

1. [RevOps Enterprise mockup (L0)](../../design/rnosai-revops-enterprise-mockup.html) — **SoT toàn bộ suite** 12 module
2. [Mockup Pipeline tab (L3 — tài liệu này)](../../design/rnosai-lead-pipeline-tab-mockup.html) — layout drill-down lead detail
3. Tài liệu này — quy tắc, FR/BR, API reuse, wave, AC
4. Code hiện có — `LeadFunnelPanel`, `CrmFunnelStepper`, `funnel-stepper.util.ts`

**Tài liệu liên quan (không thay thế):**

| Tài liệu | Vai trò |
|---|---|
| [Lead presales design](./2026-07-02-lead-presales-then-lifecycle-design.md) | Ranh giới Lead vs Lifecycle vs KH |
| [Leads handover flow](../../huong-dan-su-dung/23-leads-handover-flow-and-guides.md) | E2E B2B từ ingest → Won |
| [Sales Cockpit guide](../../huong-dan-su-dung/26-sales-cockpit-huong-dan-day-du.md) | LMP / Deal Room — tab/drawer riêng |
| [Account Management SRS](./2026-09-05-account-management-srs.md) | **Post-contract only** — không host pipeline pre-won |
| [RevOps Enterprise SRS](./2026-09-05-revops-enterprise-mockup-srs.md) | **SoT suite L0** — mockup 12 module; tab này là sub-mockup L3 |
| [KPI Hub Enterprise SRS](./2026-09-04-kpi-hub-enterprise-rnosai-srs.md) | Metric tổ chức — không thay pipeline tab |

**Mockup:** [`docs/design/rnosai-lead-pipeline-tab-mockup.html`](../../design/rnosai-lead-pipeline-tab-mockup.html)

---

## 1. Mục tiêu sản phẩm

Sales và AM pre-sales hiện phải scroll giữa **B2 Chăm Lead** (`#funnel-b2`) và **Pre-sales** (`#funnel-presales`) trên cùng trang lead — trong khi stepper đã thể hiện **một funnel 5 bước**. Tab **Pipeline bán hàng** gom trải nghiệm thành **một workspace**: một stepper, một panel theo bước, một primary action — **không thay đổi backend**.

### 1.1. Vấn đề PTT

| Vấn đề | Hệ quả | Giải trên tab Pipeline |
|---|---|---|
| B2 và Pre-sales là 2 card xếp dọc | User bỏ qua B2 hoặc mở presales sớm | Single pane — chỉ hiện bước `current` |
| SLA panel + funnel trùng M1/call | UI dài, khó scan | SLA rút thành strip 1 dòng trong tab |
| Intake redirect `#funnel-presales` | Mất ngữ cảnh bước BANT | Hash → tab Pipeline + bước BANT |
| Consult workspace tab riêng | OK giữ — nhưng cần liên kết từ stepper Tư vấn | Deep-link + optional full tab |
| AM OS không có lead CRM | Nhầm với “Lead Gen” dịch vụ khách | **Không** đưa pipeline vào AM |

### 1.2. Không giải (Mức 1)

- Gộp entity `care_pipeline` vào `crm_lead_presales` (Mức 2+).
- Territory routing, commission, RevOps shell.
- Thay thế Deal Room / Sales Cockpit / Contract panel.
- Lead CSKH spa (`spa_operational`) — luồng 24h riêng.

---

## 2. Quyết định khóa

| # | Quyết định | Chọn |
|---|---|---|
| Q1 | App tách? | **Không.** Tab mới trên `/crm/leads/[id]`, cùng `StaffPageShell`. |
| Q2 | Backend thay đổi? | **Không** Wave 1. Reuse API `care-pipeline`, `presales`, `intake`, `funnel`. |
| Q3 | Gate B2 trước presales? | **Giữ** `assertPresalesCareGate` — UI chỉ ẩn panel, không bypass. |
| Q4 | Stepper logic? | **Giữ** `resolveFunnelStepper()` + `PRESALES_FUNNEL_STEPS` — không fork. |
| Q5 | Deal Room / HĐ? | Tab **Hợp đồng & Chốt** riêng; không nhét vào Pipeline. |
| Q6 | Consult full workspace? | Giữ tab **Tư vấn**; Pipeline bước Tư vấn = summary + CTA “Mở tab Tư vấn”. |
| Q7 | Sales Cockpit (LMP)? | Giữ drawer/tab LMP; Pipeline không embed toàn bộ cockpit. |
| Q8 | AM OS? | **Không** host tab này. Post-won → `/crm/account-management`. |
| Q9 | Feature flag? | `PTT_LEAD_PIPELINE_TAB=1` (ops-web env) cho rollout. |
| Q10 | Token UI | CRM green `#17692f` primary · Navy `#0F2747` text · class `lead-pipeline-*` · reuse `lead-*` where possible. |
| Q11 | Hash legacy | `#funnel-b2`, `#funnel-presales`, `#funnel-presales-r5` → mở tab Pipeline + focus bước. |
| Q12 | Default tab B2B | **Pipeline bán hàng** khi `showPresalesForFlow` && `showB2bFlow`. |

---

## 3. Phạm vi & persona

### 3.1. In scope

| Hạng mục | Mô tả |
|---|---|
| Tab Pipeline bán hàng | Stepper + gate + primary action + single panel |
| Tab Hợp đồng & Chốt | Di chuyển `LeadContractPanel` + Deal Room banner |
| SLA strip | Rút gọn từ `LeadSlaCarePanel` |
| Collapsed done steps | Summary 1 dòng, expand xem lại |
| Mobile tabs | Pipeline / Nhật ký / AI |
| Hash & Intake redirect | Backward compatible |

### 3.2. Out of scope (Wave 1)

- Backend merge care → presales task.
- Unified approval center.
- Commission / KPI embed trong tab.
- Thay đổi presales stage config per BU.

### 3.3. Persona

| Vai trò | Hành vi trên tab |
|---|---|
| Sales Executive | Làm B2 → presales → intake → consult → proposal |
| AM (pre-won) | Cùng tab trên lead được assign |
| GDKD | Xem + release review queue |
| Solution | Read-only sau handoff; claim/release theo cap |
| CSKH spa | **Không** thấy tab Pipeline |

---

## 4. Bản đồ màn hình

### 4.1. Cấu trúc trang lead (sau Wave 1)

```text
/crm/leads/[id]
├── LeadDetailHero
├── (optional) LeadNextActionCard + LeadJourneyStepper — có thể ẩn khi Pipeline tab bật
├── Desktop tab bar
│   ├── Pipeline bán hàng  ← default B2B
│   ├── Hợp đồng & Chốt
│   ├── Tư vấn             ← khi user mở consult workspace
│   └── Sales Cockpit      ← khi LMP enabled
├── Main + Sidebar
│   ├── [Tab content]
│   └── Timeline + Thêm hoạt động
└── SalesCockpitDrawer (overlay)
```

### 4.2. Tab Pipeline — 5 bước stepper

| # | Key | Label UI | Anchor legacy | Panel nội dung |
|---|---|---|---|---|
| 1 | `b2` | Liên hệ | `#funnel-b2` | `LeadB2OutcomeCard`, care report, M1 card (nếu chưa gộp SLA) |
| 2 | `presales_lead` | Lead PS | `#funnel-presales` | Chọn dịch vụ, `ensure_presales`, task stage `lead` |
| 3 | `intake_bant` | Khảo sát BANT | — | Intake summary + link `/crm/intake?lead_id=` |
| 4 | `consult` | Tư vấn | `#funnel-presales` | Tasks consult, R5, L2 docs, handoff banner |
| 5 | `proposal` | Báo giá | `#funnel-presales-r5` | Proposal tasks, proposal gate, link Deal Room |

State: `done | current | pending | blocked | warn` — từ `resolveFunnelStepper()`.

---

## 5. Yêu cầu chức năng

### 5.1. Tab & điều hướng

#### FR-TAB-001 — Tab Pipeline bán hàng

- Thêm tab **Pipeline bán hàng** trên lead detail (desktop ≥1280px).
- Tab là **default** khi:
  - `lead_flow_kind` ∈ `{ b2b_prospect, … }` với `showPresalesForFlow(flow) === true`
  - User có `crm_leads.view`
- Tab **ẩn** khi `lead_flow_kind === spa_operational`.

#### FR-TAB-002 — Tab Hợp đồng & Chốt

- Chứa: Deal Room entry banner, `LeadContractPanel`, readiness checklist.
- Readiness link thiếu B2/presales → deep-link tab Pipeline bước tương ứng (`readinessCheckHref`).

#### FR-TAB-003 — Tab Tư vấn & Sales Cockpit

- Giữ hành vi hiện tại (`b2bPane === 'consult'`, LMP drawer).
- Từ Pipeline bước Tư vấn: nút **Mở tab Tư vấn đầy đủ** gọi `openConsultTab()`.

#### FR-TAB-004 — Mobile

- Tab **Pipeline** thay phần funnel dài trong tab “Việc”.
- Stepper horizontal scroll; primary action full width.

### 5.2. Stepper & panel

#### FR-PIPE-001 — Sticky stepper header

- Trong tab Pipeline: `CrmFunnelStepper` + `CrmFunnelStepGateStrip` sticky dưới tab bar (offset `--ops-chrome-h`).
- `showTitle={false}` trên lead detail (tab đã có title).

#### FR-PIPE-002 — Single active panel

- Chỉ render **một** `LeadPipelineStepPanel` theo `activeStepKey`.
- `activeStepKey` mặc định = bước `current` từ view model; user click stepper → đổi key (kể cả `done` để xem lại).
- Bước `pending` xa phía trước: panel placeholder + “Hoàn thành các bước trước”.

#### FR-PIPE-003 — Primary action

- `CrmFunnelStepPrimaryAction` ngay dưới gate strip.
- Handler reuse từ lead detail page (`onFunnelPrimaryAction`).

#### FR-PIPE-004 — Collapsed completed steps

- Dưới panel: `<details>` hoặc accordion **Các bước đã xong** — mỗi bước 1 dòng: label + completed_at + [Xem lại].
- Xem lại → set `activeStepKey` (read-only nếu `done`).

#### FR-PIPE-005 — Review queue block

- Khi `review_queue.active`: stepper `blocked`; panel hiện banner review + nút Release (giữ logic `LeadFunnelPanel`).

### 5.3. Nội dung từng panel (reuse)

#### FR-PANEL-B2 — Liên hệ

| Thành phần | Nguồn |
|---|---|
| Outcome card | `LeadB2OutcomeCard` |
| Submit care | `POST /api/v1/leads/:id/care-pipeline/report`, `.../complete` |
| Done state | `funnel.care_pipeline.all_complete` |

#### FR-PANEL-PS — Lead PS

| Thành phần | Nguồn |
|---|---|
| Service select | `LeadFunnelPanel` presales ensure block |
| Start presales | `POST ensure presales` |
| Tasks | `PresalesTaskFormCard` stage `lead` |

#### FR-PANEL-BANT — Khảo sát BANT

| Thành phần | Nguồn |
|---|---|
| Summary | Intake session API / `intakeSummary` trên stepper input |
| CTA | Link `/crm/intake?lead_id=&service_slug=` |
| Draft badge | `intakeSummary.has_draft` |

#### FR-PANEL-CON — Tư vấn

| Thành phần | Nguồn |
|---|---|
| Handoff banners | `PresalesSolutionHandoffBanner`, `PresalesPolicyBanner` |
| Tasks / R5 / L2 | `LeadFunnelPanel` presales block stage consult |
| SLA 48h | `consultProposalSla` trên gate strip |
| Full workspace | Tab Tư vấn |

#### FR-PANEL-PRP — Báo giá

| Thành phần | Nguồn |
|---|---|
| Proposal tasks | presales stage `proposal` |
| Proposal gate | `proposalGate` |
| Deal Room CTA | Link `/crm/leads/:id/deal-room` |

### 5.4. SLA strip

#### FR-SLA-001 — Compact SLA

- Ẩn `LeadSlaCarePanel` full-width khi Pipeline tab enabled.
- Hiện strip: worst tier label + countdown + pill state (`ok|warning|breach`).
- Click **Chi tiết SLA** → expand inline hoặc drawer nhỏ (SCI drafts, call script) — không duplicate M1 card nếu `hideM1Card`.

### 5.5. Hash & deep link

#### FR-LINK-001 — Legacy hash

| Hash | Tab | activeStepKey |
|---|---|---|
| `#funnel-b2` | pipeline | `b2` |
| `#funnel-presales` | pipeline | `presales_lead` hoặc stage presales hiện tại |
| `#funnel-presales-r5` | pipeline | `consult` hoặc `proposal` theo stage |

- Intake complete redirect: `/crm/leads/:id#funnel-presales` → map sang bước Tư vấn nếu intake done.

---

## 6. Quy tắc nghiệp vụ

| ID | Quy tắc |
|---|---|
| BR-01 | `presales_care_gate.complete === false` → panel Lead PS hiện gate message; không gọi `ensureLeadPresales`. |
| BR-02 | `review_queue.active` → toàn tab blocked trừ Release (cap GDKD/assign). |
| BR-03 | Advance presales stage — validation server-side giữ nguyên (consult gate, L2 docs, proposal gate). |
| BR-04 | `spa_operational` — không render tab Pipeline; Closed Loop panel giữ vị trí cũ. |
| BR-05 | Won + contract active — tab Pipeline read-only hoặc ẩn; ưu tiên tab Hợp đồng & link AM handover. |
| BR-06 | Activity timeline ghi mọi care/presales event — không phụ thuộc layout tab. |

---

## 7. API & dữ liệu (reuse — không thêm endpoint Wave 1)

| API | Dùng cho |
|---|---|
| `GET /api/v1/leads/:id/funnel` | Snapshot stepper |
| `POST .../care-pipeline/report`, `.../complete` | B2 |
| `POST .../presales/ensure`, `PATCH task`, advance | Pre-sales |
| `GET /api/crm/intake/sessions?lead_id=` | BANT summary |
| Consult/proposal gates | Stepper input |
| `GET /api/v1/leads/:id/sla-care-context` hoặc copilot context | SLA strip |

**Entities (không đổi):**

```text
crm_leads.care_stage_current, care_stages_done_json
crm_lead_presales + crm_lead_presales_tasks
crm_lead_intake_sessions
```

---

## 8. Phân quyền

| Hành động | Cap |
|---|---|
| Xem tab Pipeline | `crm_leads.view` |
| B2 report / complete | `crm_leads.edit` |
| Ensure / advance presales | `crm_leads.edit` + presales rules |
| Handoff solution | `crm_presales_solution` (theo `presales-solution-rbac`) |
| Release review queue | GDKD / assign caps hiện tại |
| Tab Hợp đồng | contract caps hiện tại |

Field-level: không đổi.

---

## 9. Yêu cầu phi chức năng

| Hạng mục | Mục tiêu |
|---|---|
| Tải tab Pipeline (funnel đã cache) | ≤ 2s p95 |
| Chuyển bước stepper (client) | ≤ 100ms |
| Không thêm request vs layout cũ | ≤ +0 API call mount (dùng syncFunnel) |
| a11y | Stepper `role="tablist"`; panel `role="tabpanel"`; keyboard ←/→ |
| Responsive | 1280 desktop tabs; 1024 tablet; 760 mobile stack |

---

## 10. Acceptance criteria

### AC-TAB-001 — Default tab B2B

**Given** lead B2B prospect assign cho user  
**When** mở `/crm/leads/:id`  
**Then** tab **Pipeline bán hàng** active  
**And** không hiển thị 2 card B2 + Pre-sales xếp dọc (feature flag on).

### AC-TAB-002 — Gate B2

**Given** B2 chưa complete  
**When** click step **Lead PS**  
**Then** panel hiện `presales_care_gate.message`  
**And** primary action **Bắt đầu pre-sales** disabled.

### AC-TAB-003 — Intake redirect

**Given** user complete intake session  
**When** redirect `/crm/leads/:id#funnel-presales`  
**Then** tab Pipeline active, bước **Khảo sát BANT** = done, **Tư vấn** = current.

### AC-TAB-004 — Hash b2

**Given** URL `#funnel-b2`  
**Then** tab Pipeline, panel **Liên hệ**, scroll không bắt buộc.

### AC-TAB-005 — Spa hidden

**Given** lead `spa_operational`  
**Then** tab Pipeline không render  
**And** banner CSKH 24h vẫn hiện.

### AC-TAB-006 — Contract tab

**Given** user click **Hợp đồng & Chốt**  
**Then** `LeadContractPanel` visible  
**And** Deal Room banner visible when stage allows.

---

## 11. Triển khai kỹ thuật

### 11.1. Component tree (mới / sửa)

```text
LeadDetailPage
├── LeadSalesPipelineTab          NEW
│   ├── LeadPipelineSlaStrip      NEW (extract from LeadSlaCarePanel)
│   ├── CrmFunnelStepper          reuse
│   ├── CrmFunnelStepPrimaryAction
│   ├── LeadPipelineStepPanel     NEW router
│   │   ├── LeadPipelineB2Panel       extract #funnel-b2
│   │   ├── LeadPipelinePresalesPanel   extract #funnel-presales
│   │   ├── LeadPipelineIntakePanel
│   │   └── ...
│   └── LeadPipelineDoneAccordion NEW
├── LeadContractTab               NEW wrapper
└── LeadFunnelPanel               deprecate layout; logic → panels
```

### 11.2. Files

| File | Thay đổi |
|---|---|
| `services/ops-web/src/app/crm/leads/[id]/page.tsx` | Tab state, default tab, hash effect |
| `services/ops-web/src/components/crm/LeadSalesPipelineTab.tsx` | NEW |
| `services/ops-web/src/components/crm/LeadPipelineStepPanel.tsx` | NEW |
| `services/ops-web/src/components/LeadFunnelPanel.tsx` | Extract panels; thin wrapper legacy flag off |
| `services/ops-web/src/app/globals.css` | `.lead-pipeline-tab*` |
| `services/ops-web/e2e/lead-pipeline-tab.spec.ts` | NEW |

### 11.3. Feature flag

```bash
# ops-web .env
NEXT_PUBLIC_LEAD_PIPELINE_TAB=1
```

Khi `0`: layout cũ (2 card xếp dọc).

### 11.4. Wave

| Wave | Nội dung | Effort |
|---|---|---|
| W1a | Tab shell + stepper + panel router + flag | 2–3d |
| W1b | Extract panels từ LeadFunnelPanel; ẩn layout cũ | 2d |
| W1c | SLA strip, hash, mobile, e2e | 1–2d |

---

## 12. Rủi ro

| Rủi ro | Kiểm soát |
|---|---|
| Regression funnel advance | e2e funnel-stepper + manual B2→proposal |
| Hash bookmark break | FR-LINK-001 test matrix |
| Duplicate M1/SLA | `hideM1Card` + SLA strip spec |
| Consult tab drift | Pipeline bước Tư vấn chỉ summary; full edit ở tab Tư vấn |

---

## 13. Câu hỏi chốt PO

1. Won lead có **ẩn hẳn** tab Pipeline hay read-only archive?
2. Default tab khi lead **Lost** — Pipeline hay chỉ Nhật ký?
3. Có **bắt buộc** ẩn `LeadJourneyStepper` khi Pipeline tab bật không?
4. Bước BANT — **embed** intake form inline hay chỉ link full page (Wave 1 đề xuất: link)?

---

## 14. Tài liệu đầu ra

- [x] SRS này
- [x] Mockup HTML [`rnosai-lead-pipeline-tab-mockup.html`](../../design/rnosai-lead-pipeline-tab-mockup.html)
- [ ] Plan triển khai: [2026-09-05-revops-enterprise-os.md](../plans/2026-09-05-revops-enterprise-os.md) Track A — khi PO duyệt
- [ ] e2e spec — cùng Wave W1c

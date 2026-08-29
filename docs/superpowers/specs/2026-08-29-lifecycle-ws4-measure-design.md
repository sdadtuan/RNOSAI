# Lifecycle WS4 — Measure (owner-weekly K1–K4 + debrief won + cleanup)

> **Document ID:** LIFE-WS4-20260829  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-29  
> **Trạng thái:** Design — chờ PO/Eng duyệt trước implementation plan  
> **Phạm vi:** `ptt-crm-api` (milestones + owner-weekly metrics) + `ops-web` (block lifecycle + debrief won)  
> **Parent:** [LIFE-WIN-20260828](./2026-08-28-lifecycle-absolute-win-design.md) §6 WS4 · §1.2 K1–K4  
> **WS3 đã ship:** [2026-08-29-lifecycle-ws3-delivery-spine-design.md](./2026-08-29-lifecycle-ws3-delivery-spine-design.md) (`2a06affa`)  
> **SOP:** [sales-b2b-lead-client-onboard-sop.md](../../runbooks/sales-b2b-lead-client-onboard-sop.md) · SYS-UC-001

---

## 0. Tóm tắt

S0–WS3 đã khép spine AM tới delivery. **Lỗ còn lại:** GDKD không có 4 số vận hành trên `/crm/owner-weekly`; milestone B2→Client không được ghi có hệ thống; lead B2B `won` sau promote **không** kích hoạt debrief (rule 9 chỉ `chot`/`lost`); dead stepper vẫn trong repo.

WS4 đo **K1–K4** (LIFE-WIN §1.2) trong một block compact trên owner-weekly, ghi milestone `stage_entered`, mở debrief cho `won`, xóa TSX chết.

Ba việc, một PR (backend + frontend):

1. **`crm_lifecycle_milestones`** + write hooks + aggregate K1–K3.  
2. **Block `lifecycle`** trên owner-weekly (+ K4 từ CSKH SLA).  
3. **Debrief `won`** + dọn dead code (move type → xóa bar).

---

## 1. Mục tiêu & thắng

| ID | Mục tiêu | Không phải mục tiêu |
|----|----------|---------------------|
| G4 | GDKD xem **4 số** mỗi tuần — không Excel | Dashboard CRM mới |
| G5 | Pilot đo được median B2→Intake→HĐ→Client | BI warehouse / Metabase |
| G6 | AM B2B `won` có debrief win loop | Redesign LMP / M4 UI |
| Eng | Milestone idempotent; backfill một lần | Event bus / Kafka |

**Persona chính:** GDKD / owner — `/crm/owner-weekly`; AM pilot — debrief sau HĐ thắng.

---

## 2. Phạm vi

### 2.1. In scope

- Bảng PG **`crm_lifecycle_milestones`** (bootstrap idempotent trong owner-weekly hoặc module riêng).  
- Ghi milestone **`b2_done | intake_go | contract_active | client_active`** tại điểm sự thật (mục 6).  
- **`OwnerWeeklyPgRepository.dashboard`**: block mới **`lifecycle`** — 4 metric K1–K4.  
- Target config mới trong `OWNER_WEEKLY_TARGET_DEFAULTS` + patch config.  
- **`OwnerWeeklyBlockGrid`**: render block `lifecycle` (5 block tổng — 4 cũ + lifecycle).  
- Pure util **`lifecycle-kpi.util.ts`** — median / pct + unit test.  
- **Debrief won:** `terminal()` + LMP `debrief_pending` + `buildWinOutcomeFromDebrief` cho `won`.  
- **Cleanup:** move `LeadContractFlowSummary` → `lib/crm/lead-contract-flow.ts`; xóa `LeadB2bSalesFlowBar.tsx`; xóa `LeadPresalesFunnelStepper.tsx` + export dead.  
- Backfill SQL/script một lần (Task 0 plan) từ bảng hiện có.  
- Jest/Vitest + cập nhật e2e owner-weekly (5 blocks).

### 2.2. Out of scope

- Redesign 4 block cash/sales/efficiency/risk hiện có.  
- WS5+ NBA post-won, journey mới, promote logic.  
- K4 ngưỡng PO cuối cùng — spec khóa default 85% (trùng `CSKH_SLA_COMPLIANCE_TARGETS.first_call_15m`).  
- Portal-web, SQLite dual-write.  
- Playwright bắt buộc mới (chỉ sửa spec e2e có sẵn).  
- Gộp WS4 với task không liên quan.

---

## 3. Quyết định khóa (LIFE-WIN §1.2 · §11 → PO tick)

| # | Câu hỏi | Khóa WS4 (đề xuất) |
|---|---------|-------------------|
| Q1 | Cửa sổ đo K1–K3? | **90 ngày lùi** tính tới `week.end` owner-weekly (rolling, không chỉ tuần ISO). Sample: lead Factory A (`lead_flow_kind=b2b_prospect` hoặc có presales row). |
| Q2 | K1 định nghĩa? | Median **phút làm việc** từ `crm_leads.created_at` → milestone `b2_done.occurred_at`. Target default: **480 phút** (1 ngày làm việc; SOP 2 ngày — nội bộ siết). |
| Q3 | K2 định nghĩa? | Median **ngày calendar** `b2_done` → `intake_go`. Target default: **5 ngày**. |
| Q4 | K3 định nghĩa? | Median **ngày calendar** `contract_active` → `client_active` (agency `clients.status=active`). Target default: **14 ngày** (SYS-UC-001). |
| Q5 | K4 định nghĩa? | **% compliance** tier `first_call_15m` trên lead Factory B (có `client_id` / spa operational) — reuse logic `aggregateSlaCompliancePct` / board query. Target default: **85%**. Cửa sổ: cùng 90 ngày. |
| Q6 | Bảng milestone bắt buộc? | **Có** — `crm_lifecycle_milestones`. Ghi forward + backfill; dashboard đọc milestone trước, fallback derive từ bảng nguồn nếu thiếu 1 key (backfill path). |
| Q7 | Uniqueness milestone? | `UNIQUE (lead_id, milestone_key)` — insert `ON CONFLICT DO NOTHING` (first timestamp wins). |
| Q8 | Block UI vị trí? | **`blocks.lifecycle`** — section thứ 5, **trên** grid 4 block cũ (full width, 4 metric ngang). Không dashboard route mới. |
| Q9 | Debrief `won` copy? | Giữ title rule 9; body: «Lead đã Won/Lost — gửi debrief…»; outcome LMP: `won` khi status `won`, `won` khi `chot` (giữ mapping cũ spa). |
| Q10 | Xóa dead TSX? | Xóa **`LeadB2bSalesFlowBar.tsx`**, **`LeadPresalesFunnelStepper.tsx`**. **Giữ** `CrmFunnelStepper` (Intake dùng). Move type trước khi xóa. |

---

## 4. As-is (code đã rà 2026-08-29)

| Hạng mục | Hiện tại |
|----------|----------|
| Owner-weekly | 4 block cash/sales/efficiency/risk — nhiều metric MVP/stub (`win_rate: 0`, note «MVP — simplified») |
| K1–K4 | **Không** hiển thị; LIFE-WIN §1.2 chỉ trên giấy |
| Milestone | **Không** bảng `crm_lifecycle_milestones`; timestamp rải rác |
| B2 done time | `care_stages_done_json` — `parseB2CompletedAt` (`cskh-board-sla.util.ts`) |
| Intake Go | `crm_lead_intake_sessions.completed_at` + `decision='go'` |
| HĐ active | `crm_contracts.status='active'`, `crm_contract_events.event_type='activated'` |
| Client active | `clients.status='active'`, `updated_at` |
| Debrief | Rule 9: `terminal()` = **`chot \| lost` only** — **`won` bypass** |
| LMP debrief | `lead-meeting-prep.service`: `terminal = ['chot','lost']` — **`won` không debrief_pending** |
| Dead UI | `LeadB2bSalesFlowBar` — **không mount**; type `LeadContractFlowSummary` vẫn import 3 file |
| `LeadPresalesFunnelStepper` | Export trong index; **Intake dùng `CrmFunnelStepper` trực tiếp** |

File neo:

| Concern | Path |
|---------|------|
| Owner-weekly BE | `services/ptt-crm-api/src/owner-weekly/owner-weekly-pg.repository.ts` |
| Owner-weekly FE | `services/ops-web/src/app/crm/owner-weekly/page.tsx` |
| KPI UI | `services/ops-web/src/components/kpi/KpiDashboardUi.tsx` |
| NBA rule 9 | `services/ops-web/src/lib/crm/lead-next-action.ts` |
| LMP debrief | `services/ptt-crm-api/src/lead-meeting-prep/lead-meeting-prep.service.ts` |
| Win outcome | `services/ptt-crm-api/src/lead-meeting-prep/lmp-win-outcome.util.ts` |
| B2 complete | `services/ptt-crm-api/src/leads-funnel/leads-funnel-pg.repository.ts` (care pipeline) |
| Intake complete | `services/ptt-crm-api/src/intake/intake-pg.repository.ts` |
| Promote | `services/ptt-crm-api/src/leads-contract/contract-promote-pg.util.ts` |
| Client active | `services/ptt-crm-api/src/agency/agency.service.ts` (`updateClient` → active) |
| CSKH K4 | `services/ptt-crm-api/src/cskh-board/cskh-board.service.ts` + `cskh-board-sla.util.ts` |
| Dead bar | `services/ops-web/src/components/LeadB2bSalesFlowBar.tsx` |

---

## 5. Block lifecycle trên owner-weekly

### 5.1. API shape (mở rộng dashboard)

```ts
blocks.lifecycle = {
  key: 'lifecycle',
  label: 'Lifecycle (Factory A/B)',
  metrics: [
    { key: 'k1_b2_minutes', label: 'K1 · B2 complete (median phút)', value, fmt: 'minutes', target, status, note, sample_n },
    { key: 'k2_intake_days', label: 'K2 · B2 → Intake Go (median ngày)', value, fmt: 'days', ... },
    { key: 'k3_client_days', label: 'K3 · HĐ active → Client active (median ngày)', value, fmt: 'days', ... },
    { key: 'k4_first_call_pct', label: 'K4 · First call 15m (Factory B)', value, fmt: 'pct', ... },
  ],
};
```

- `sample_n`: số cặp milestone hợp lệ trong cửa sổ (hiển thị muted nếu `n < 3` — «Chưa đủ mẫu»).  
- RAG: K1/K2/K3 **lower is better**; K4 **higher is better** — reuse `ragLowerBetter` / `ragHigherBetter`.  
- `note` khi `sample_n < 3`: «Cần ≥3 lead hoàn chỉnh trong 90 ngày».

### 5.2. Target config keys mới

```ts
k1_b2_median_max_minutes: 480,
k2_intake_median_max_days: 5,
k3_client_active_max_days: 14,
k4_first_call_min_pct: 85,
```

Thêm vào `OWNER_WEEKLY_TARGET_LABELS`, group **`lifecycle`**.

### 5.3. FE

- `OwnerWeeklyBlockGrid`: render `blocks.lifecycle` **trước** `.owner-weekly-grid` (full width).  
- CSS: tái dùng `.owner-weekly-metric`; thêm modifier `.owner-weekly-lifecycle` trong `globals.css` (không file CSS mới — LIFE-WIN §3 cho phép globals owner-weekly section có sẵn).  
- E2E `kpi-rnos42.spec.ts`: expect lifecycle block + 4 metrics; grid 4 block cũ giữ.

---

## 6. Milestones (`crm_lifecycle_milestones`)

### 6.1. DDL (idempotent)

```sql
CREATE TABLE IF NOT EXISTS crm_lifecycle_milestones (
  id BIGSERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL,
  milestone_key VARCHAR(32) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  source VARCHAR(40) NOT NULL,
  ref_id TEXT NOT NULL DEFAULT '',
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lead_id, milestone_key)
);
CREATE INDEX IF NOT EXISTS idx_lifecycle_milestones_key_at
  ON crm_lifecycle_milestones (milestone_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_lifecycle_milestones_lead
  ON crm_lifecycle_milestones (lead_id);
```

### 6.2. Keys & write hooks

| Key | Khi ghi | Nguồn `occurred_at` | Hook file |
|-----|---------|---------------------|-----------|
| `b2_done` | POST care-pipeline complete (stage first_contact done) | `care_stages_done_json.first_contact` hoặc `NOW()` | `leads-funnel-pg.repository.ts` |
| `intake_go` | Intake session `decision=go` complete | `completed_at` | `intake-pg.repository.ts` |
| `contract_active` | HĐ chuyển `active` (promote approve) | event `activated` / contract `updated_at` | `leads-contract-pg.repository.ts` / promote util |
| `client_active` | Agency client → `status=active` | `clients.updated_at` | `agency.service.ts` |

Helper PG: **`LifecycleMilestonePgUtil.record(client, { leadId, key, occurredAt, source, refId?, payload? })`** — `ON CONFLICT DO NOTHING`.

`client_active`: `lead_id` lấy từ client notes/link hoặc `crm_leads.agency_client_id` reverse lookup; nếu không resolve lead → skip (K3 sample không tính).

### 6.3. Aggregate queries (90 ngày)

Pure **`lifecycle-kpi.util.ts`** (Nest + test):

```ts
computeK1(rows: { created_at: string; b2_at: string }[]): { median_minutes: number | null; n: number }
computeK2(rows: { b2_at: string; intake_at: string }[]): { median_days: number | null; n: number }
computeK3(rows: { contract_at: string; client_at: string }[]): { median_days: number | null; n: number }
```

SQL pattern (PG): JOIN milestones self-join trên `lead_id` + filter `occurred_at` trong window + lead Factory A filter.

K4: delegate tới query board — % `first_call_15m` tier `sla_state=ok` / evaluated (copy từ `home-summary.util` / board list filter 90d).

### 6.4. Backfill (Task 0 plan — một lần)

Script `scripts/backfill_lifecycle_milestones.sql` hoặc Nest one-shot:

1. `b2_done` ← `parseB2CompletedAt(care_stages_done_json)`  
2. `intake_go` ← latest intake session go  
3. `contract_active` ← contract active + events  
4. `client_active` ← clients active + lead link via `agency_client_id`

Idempotent (`ON CONFLICT DO NOTHING`).

---

## 7. Debrief B2B `won`

### 7.1. ops-web `lead-next-action.ts`

```ts
function terminal(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'chot' || s === 'lost' || s === 'won';
}
```

Rule 9 body (optional tweak): «Lead đã Won/Chốt/Lost — gửi debrief…»

### 7.2. ptt-crm-api LMP

`lead-meeting-prep.service.ts`:

```ts
const terminal = ['chot', 'lost', 'won'].includes(status);
```

`lmp-win-outcome.util.ts`:

```ts
const outcome: WinOutcomeJson['outcome'] =
  status === 'chot' || status === 'won' ? 'won' : 'lost';
```

### 7.3. Hành vi UI

- Lead `won` + `debrief_pending` → NBA rule 9 (đã có handler `submit_debrief` trên `page.tsx`).  
- Không auto-open modal — giữ NBA primary (AM chủ động).  
- **`spa_operational` + `chot`:** không đổi (ClosedLoopPanel riêng).

---

## 8. Dead code cleanup

### 8.1. Move type

Tạo `services/ops-web/src/lib/crm/lead-contract-flow.ts`:

```ts
export interface LeadContractFlowSummary { ... } // move từ LeadB2bSalesFlowBar
```

Cập nhật import trong:

- `leads/[id]/page.tsx`  
- `LeadJourneyStepper.tsx`  
- `LeadContractPanel.tsx`

### 8.2. Xóa file

| File | Lý do |
|------|-------|
| `LeadB2bSalesFlowBar.tsx` | Thay bằng `LeadJourneyStepper` (WS3) |
| `LeadPresalesFunnelStepper.tsx` | Không mount; Intake dùng `CrmFunnelStepper` |
| `funnel-stepper/index.ts` | Bỏ export `LeadPresalesFunnelStepper` |

**Không** xóa `LeadPresalesFunnelStepper` nếu grep phát hiện import runtime — hiện **không có**.

---

## 9. File map (implementation)

| File | Thay đổi |
|------|----------|
| `lifecycle-milestone.pg.util.ts` | NEW — record + types |
| `lifecycle-kpi.util.ts` | NEW — median/pct pure |
| `lifecycle-kpi.util.spec.ts` | NEW |
| `owner-weekly-pg.repository.ts` | lifecycle block + targets + schema |
| `owner-weekly-pg.repository.spec.ts` | lifecycle metrics fixture |
| `leads-funnel-pg.repository.ts` | hook b2_done |
| `intake-pg.repository.ts` | hook intake_go |
| `leads-contract-pg.repository.ts` / promote | hook contract_active |
| `agency.service.ts` | hook client_active |
| `lead-next-action.ts` | terminal + won |
| `lead-next-action.spec.ts` | rule 9 won |
| `lead-meeting-prep.service.ts` | terminal won |
| `lmp-win-outcome.util.ts` | outcome won |
| `lead-contract-flow.ts` | NEW — shared type |
| `KpiDashboardUi.tsx` | lifecycle section |
| `owner-weekly/page.tsx` | pass-through (minimal) |
| `globals.css` | `.owner-weekly-lifecycle` |
| `kpi-rnos42.spec.ts` | 5-block / lifecycle metrics |
| DELETE `LeadB2bSalesFlowBar.tsx` | |
| DELETE `LeadPresalesFunnelStepper.tsx` | |
| `scripts/backfill_lifecycle_milestones.sql` | NEW optional |

---

## 10. Acceptance

| ID | Given | Then |
|----|-------|------|
| WS4-01 | Owner-weekly tuần hiện tại, DB có ≥3 lead A đủ milestone | Block **Lifecycle** hiện K1–K3 số + RAG |
| WS4-02 | Không đủ mẫu (<3) | Metric note «Chưa đủ mẫu»; không crash |
| WS4-03 | CSKH board có lead B 90 ngày | K4 % first_call_15m hiển thị |
| WS4-04 | AM complete B2 lead #5 | Row `b2_done` inserted (idempotent re-complete) |
| WS4-05 | Intake Go lead | `intake_go` milestone |
| WS4-06 | GDKD approve HĐ (WS2) | `contract_active` milestone |
| WS4-07 | AM bấm Client active | `client_active` milestone |
| WS4-08 | Lead B2B `won` + debrief_pending | NBA rule 9 primary Gửi debrief |
| WS4-09 | Lead `won` + debrief submitted | rule 9 tắt |
| WS4-10 | `chot` spa | rule 9 vẫn hoạt động; không regress |
| WS4-11 | Grep ops-web | Không import `LeadB2bSalesFlowBar` component |
| WS4-12 | Config patch `k3_client_active_max_days` | Dashboard target cập nhật |
| WS4-R | WS3 journey + S1 NBA | Không regress |

---

## 11. Kiểm thử & deploy

- Jest: `lifecycle-kpi.util.spec.ts`, `owner-weekly-pg.repository.spec.ts` (mock PG).  
- Vitest: `lead-next-action.spec.ts` — `won + debrief_pending`.  
- E2E: `kpi-rnos42.spec.ts` — lifecycle block.  
- Manual: `/crm/owner-weekly` hard refresh; lead pilot won → NBA debrief; backfill rồi K3 có số sau client active.  
- Deploy: `APPLY=1 ./scripts/deploy_lmp_s2_vps.sh` (DDL idempotent + Nest + ops-web).  
- Chạy backfill **một lần** trên VPS sau deploy (Task 0 plan).

---

## 12. Rủi ro

| Rủi ro | Chặn |
|--------|------|
| K3 trống pre-WS2 | Backfill + WS2 promote mới có contract→client |
| Client active không map lead | Reverse `agency_client_id`; skip nếu orphan |
| Median lệch outlier | 90d window; hiện sample_n |
| Xóa bar gãy build | Move type trước; CI grep |
| Duplicate milestone timestamp | ON CONFLICT DO NOTHING — first wins |

---

## 13. Sign-off

| Vai trò | Duyệt | OK |
|---------|-------|-----|
| PO / GDKD | §3 Q1–Q5 targets K1–K4 | ☐ |
| AM pilot | Debrief won sau promote | ☐ |
| Eng | Milestone hooks + no new dashboard route | ☐ |
| Ops | Backfill script + VPS runbook | ☐ |

---

## 14. Spec self-review

| Check | Kết quả |
|-------|---------|
| TBD / TODO | Không — K4 default 85%; PO có thể đổi §3 Q5 |
| Mâu thuẫn LIFE-WIN §6 WS4 | Khớp: 4 số, milestone, debrief won, xóa dead TSX |
| Mâu thuẫn WS3 | Không đụng journey/delivery CTA |
| Dashboard mới | Không — block trên route có sẵn |
| Bitrix phình | 1 strip lifecycle; không card lead mới |
| SQLite | PG only |

---

## 15. Next step

1. PO tick §13 (đặc biệt K1 phút vs ngày, K4 ngưỡng).  
2. Plan WS4: [2026-08-29-lifecycle-ws4-measure.md](../plans/2026-08-29-lifecycle-ws4-measure.md) — **ready for implementation**.  
3. Chạy **backfill** sau deploy Task 0.  
4. Không gộp WS4 PR với feature CRM khác.

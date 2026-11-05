# Lifecycle WS3 — Delivery spine (journey sau won + CTA delivery)

> **Document ID:** LIFE-WS3-20260829  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-29  
> **Trạng thái:** Design — chờ PO/Eng duyệt trước implementation plan  
> **Phạm vi:** `ops-web` (journey lead + hero CTA service-delivery) · mở rộng payload readiness tối thiểu  
> **Parent:** [LIFE-WIN-20260828](./2026-08-28-lifecycle-absolute-win-design.md) §6 WS3 · §14 traceability  
> **WS2 đã ship:** [2026-08-29-lifecycle-ws2-promote-agency-client-design.md](./2026-08-29-lifecycle-ws2-promote-agency-client-design.md) (`9c60e9fc`)  
> **SOP:** [sales-b2b-lead-client-onboard-sop.md](../../runbooks/sales-b2b-lead-client-onboard-sop.md) §F6–F7

---

## 0. Tóm tắt

S0/S1/WS2 đã khép sales spine tới HĐ active + Agency Client draft. **Lỗ còn lại:** AM thắng HĐ nhưng lead detail vẫn dừng ở 6 bước sales; service-delivery có gate TMMT / Launch QA / finance nhưng việc kế tiếp nằm sâu trong tab Workflow.

WS3 nối **4 bước delivery** lên lead journey (chỉ sau won) và đặt **một CTA** trên `/crm/service-delivery/{id}` = task cổng `getStageAdvanceInfo` hiện có.

Hai việc, một PR (frontend-heavy):

1. **`resolveLeadJourney`** — append `onboard | deliver | agency | retain` khi post-won.  
2. **`LifecycleDeliveryNextActionCard`** — hero card trên service-delivery detail; không route REST mới.

---

## 1. Mục tiêu & thắng

| ID | Mục tiêu | Không phải mục tiêu |
|----|----------|---------------------|
| G4 | AM thấy đường **OB → Giao → CL → Ret** trên lead đã won | Stepper 10 bước trên lead chưa won |
| G5 | AM mở service-delivery biết **một việc** kế tiếp (HubSpot pattern) | Redesign toàn bộ workflow tabs |
| AM | Từ lead journey bấm OB/Giao → delivery; CL → Agency Client | NBA kind mới post-won trên lead |
| Ops | Gate TMMT / Launch QA / finance vẫn dùng logic `validateStageAdvance` cũ | Sửa backend gate rules |

**Persona chính:** AM B2B sau GDKD approve HĐ (lead pilot #5 class), làm onboard → deliver trên lifecycle.

---

## 2. Phạm vi

### 2.1. In scope

- Mở rộng `LeadJourneyStep['key']`: `onboard | deliver | agency | retain`.  
- Nhãn ngắn: **OB / Giao / CL / Ret** (LIFE-WIN §6 WS3).  
- `LeadJourneyStepper`: desc + track 10 bước khi post-won; **6 bước** khi pre-won.  
- Pure helper `resolveLifecycleDeliverySteps` (hoặc inline trong `resolveLeadJourney`) + unit test.  
- Mở rộng **GET** `/api/v1/leads/:id/contract/readiness`: thêm `lifecycle_stage` (nullable) — JOIN `crm_service_lifecycle` khi có `lifecycle_id`.  
- `LeadContractFlowSummary` + wiring `page.tsx`: truyền `lifecycleStage`, `agencyClientId` vào stepper.  
- Component **`LifecycleDeliveryNextActionCard`** trên `service-delivery/[id]/page.tsx` (trên tab bar).  
- Pure helper **`resolveLifecycleNextAction(advanceInfo)`** — map `block_reason` / gate → primary CTA.  
- CSS responsive 10-step (chỉ `bitrix-theme.css` dưới `html.ops-shell-bitrix`).  
- Vitest: `lead-journey.spec.ts` cases post-won; helper next-action spec mới.

### 2.2. Out of scope

- WS4 owner-weekly, debrief `won` (rule 9), `LeadB2bSalesFlowBar` xóa dead TSX.  
- API REST **mới** (chỉ field optional trên readiness hiện có).  
- Redesign Deal Room, Intake, Agency checklist, `/crm/hub`.  
- NBA post-won kinds trên lead (`open_agency_client` — WS4+ nếu cần).  
- Sửa `validateStageAdvance`, `getStageAdvanceInfo`, onboard orchestrator backend.  
- `spa_operational`: không journey extension.  
- File CSS mới; `next build` ad-hoc trên VPS.  
- Gộp WS3 + WS4 trong một PR.

---

## 3. Quyết định khóa (LIFE-WIN §6 → PO tick)

| # | Câu hỏi | Khóa WS3 (đề xuất) |
|---|---------|-------------------|
| Q1 | Khi nào append 4 bước delivery? | **`contractActive && lifecycleId != null`** (post-won). LIFE-WIN ghi `contractActive \|\| lifecycleId`; khóa **AND** vì lifecycle chỉ meaningful sau promote active — tránh edge draft. |
| Q2 | Lead pre-won có draft HĐ? | Giữ **đúng 6 bước**; HĐ `current`/`pending` như S0 — **cấm** hiện OB/Giao/CL/Ret. |
| Q3 | Map lifecycle stage → journey step? | `onboard→OB`, `deliver→Giao`, `handover→CL`, `retain→Ret`. Stage sales (`lead/consult/proposal`) trên lifecycle đã promote **không** xảy ra — fallback `onboard` nếu stage lạ. |
| Q4 | State 4 bước delivery? | Index stage trong `[onboard, deliver, handover, retain]`: bước `< idx` = `done`, `= idx` = `current`, `> idx` = `pending`. **Không** `blocked` trên delivery spine (review queue chỉ block 6 bước sales). |
| Q5 | Href từng bước? | OB/Giao/Ret → `/crm/service-delivery/{lifecycleId}`. CL → `/agency/clients/{agency_client_id}` khi có id (WS2); không id → span muted (pre-WS2 promote — hiếm sau WS2 ship). |
| Q6 | CTA service-delivery — một việc? | Primary duy nhất từ `advance-info`: advance stage **hoặc** deep-link tab gate (TMMT / Launch QA / Finance) **hoặc** scroll workflow tasks — theo mục 7. |
| Q7 | Fetch advance-info? | **Một lần** trên page load; truyền prop xuống hero card (workflow panel giữ fetch riêng trong tab — acceptable; dedupe optional follow-up). |
| Q8 | Desc stepper post-won? | `B2 → … → HĐ → OB → Giao → CL → Ret` (cập nhật `lead-journey__desc`). |

---

## 4. As-is (code đã rà 2026-08-29)

| Bước | Hiện tại |
|------|----------|
| Journey lead | `resolveLeadJourney` — 6 keys sales; HĐ `done` + href service-delivery khi active |
| Stepper UI | `LeadJourneyStepper.tsx` — desc cố định 6 bước; không post-won |
| Dead duplicate | `LeadB2bSalesFlowBar.tsx` — 6 step incl. delivery/agency; **không mount** (WS4 xóa) |
| Readiness API | Trả `lifecycle_id`; **không** trả `lifecycle_stage` |
| Contract panel | Có `agency_client_id` trên `LeadContractRow`; journey chưa đọc |
| Service-delivery | `ServiceDeliveryWorkflowPanel` — gate TMMT/Launch QA/finance + nút advance **trong tab Workflow** |
| Advance API | `GET /api/crm/service-lifecycle/:id/advance-info` → `getStageAdvanceInfo` (đủ gate) |
| Lifecycle stages | `VALID_STAGES`: lead…proposal, **onboard, deliver, handover, retain** |

File neo:

| Concern | Path |
|---------|------|
| Journey pure | `services/ops-web/src/lib/crm/lead-journey.ts` |
| Journey test | `services/ops-web/src/lib/crm/lead-journey.spec.ts` |
| Stepper | `services/ops-web/src/components/crm/LeadJourneyStepper.tsx` |
| Lead page | `services/ops-web/src/app/crm/leads/[id]/page.tsx` |
| Readiness BE | `services/ptt-crm-api/src/leads-contract/leads-contract-pg.repository.ts` (`getReadiness`) |
| Advance util | `services/ptt-crm-api/src/service-lifecycle/lifecycle-stage.util.ts` |
| Delivery page | `services/ops-web/src/app/crm/service-delivery/[id]/page.tsx` |
| Workflow panel | `services/ops-web/src/components/ServiceDeliveryWorkflowPanel.tsx` |

---

## 5. Journey extension (lead-journey.ts)

### 5.1. Input mới

```ts
export type LeadJourneyInput = {
  // ... existing S0 fields ...
  lifecycleStage?: string | null;   // onboard | deliver | handover | retain
  agencyClientId?: string | null;   // UUID from contract / readiness
};
```

Nguồn UI: `fetchLeadContractReadiness` → `lifecycle_stage` (mới) + `contract.agency_client_id`.

### 5.2. Trigger post-won

```ts
const showDeliverySpine =
  Boolean(input.contractActive && input.lifecycleId != null) && !input.reviewActive;
```

- `reviewActive`: trả 6 bước sales `blocked` như hiện tại — **không** append delivery.  
- Pre-won (`!contractActive || !lifecycleId`): return 6 steps only — **WS3-02**.

### 5.3. Sales spine (6 bước) — không đổi logic S0

Khi post-won: force sales keys `b2…contract` = **`done`** (kể cả presales stage cũ); `contract.href` giữ `/crm/service-delivery/{id}`.

### 5.4. Delivery spine (4 bước)

| key | label_vi | short_vi | current khi `lifecycleStage` |
|-----|----------|----------|------------------------------|
| onboard | Onboard | OB | `onboard` |
| deliver | Triển khai | Giao | `deliver` |
| agency | Agency Client | CL | `handover` |
| retain | Giữ chân | Ret | `retain` |

```ts
const DELIVERY_ORDER = ['onboard', 'deliver', 'handover', 'retain'] as const;
const DELIVERY_KEYS = ['onboard', 'deliver', 'agency', 'retain'] as const;

function deliveryStepIndex(stage: string): number {
  const s = stage.trim().toLowerCase();
  const idx = DELIVERY_ORDER.indexOf(s as (typeof DELIVERY_ORDER)[number]);
  return idx >= 0 ? idx : 0; // unknown → OB
}
```

State: `done | current | pending` theo index (mục 3 Q4).

Href:

```ts
onboard / deliver / retain:
  `/crm/service-delivery/${lifecycleId}`
agency:
  agencyClientId?.trim()
    ? `/agency/clients/${encodeURIComponent(trimmed)}`
    : undefined  // render non-link
```

### 5.5. Return shape

Post-won: `[...salesSteps (6), ...deliverySteps (4)]` — tổng **10** bước.  
Pre-won: `[...salesSteps (6)]` only.

---

## 6. LeadJourneyStepper UI

### 6.1. Props

Thêm optional `lifecycleStage`, `agencyClientId` (hoặc mở rộng `LeadContractFlowSummary`):

```ts
export interface LeadContractFlowSummary {
  hasContract: boolean;
  contractStatus: string | null;
  pendingApproval: boolean;
  lifecycleId: number | null;
  lifecycleStage?: string | null;      // WS3
  agencyClientId?: string | null;      // WS3
}
```

### 6.2. Desc động

| Mode | `lead-journey__desc` |
|------|---------------------|
| Pre-won (6) | `B2 → Pre-sales → Intake → Tư vấn → Báo giá → HĐ` (giữ) |
| Post-won (10) | `B2 → … → HĐ → OB → Giao → CL → Ret` |

### 6.3. Layout 10 bước

- Desktop: track flex-wrap hoặc horizontal scroll — class modifier `lead-journey__track--extended` (10 items).  
- Mobile: giữ pattern scroll ngang hiện có; `short_vi` OB/Giao/CL/Ret.  
- **Không** mount `LeadB2bSalesFlowBar`; **không** xóa file (WS4).

### 6.4. `spa_operational`

`showB2bFlow === false` → stepper không render (giữ page guard).

---

## 7. Service-delivery CTA (LifecycleDeliveryNextActionCard)

### 7.1. Vị trí

Trên `CrmServiceDeliveryDetailPage`, **dưới** header/context staff picker, **trên** tab bar (Workflow / TMMT / …).

`data-testid="lifecycle-delivery-next-action"`.

### 7.2. Data

Page gọi `fetchServiceLifecycleAdvanceInfo(token, lifecycleId)` khi mount (song song detail load).

Type FE (mirror `getStageAdvanceInfo` return):

```ts
type LifecycleAdvanceInfo = {
  current_stage: string;
  next_stage: string | null;
  can_advance_forward: boolean;
  block_reason: string;
  current_complete: boolean;
  current_done: number;
  current_total: number;
  onboard_gate?: { ok: boolean; messages: string[]; orchestrator_percent?: number; checklist_percent?: number };
  launch_qa_gate?: { ok: boolean; requires_confirm?: boolean; messages: string[]; progress_completed?: number; progress_total?: number };
  payment_gate?: { ok: boolean; requires_confirm?: boolean; messages: string[]; outstanding_vnd?: number };
};
```

### 7.3. Pure resolver `resolveLifecycleNextAction`

Thứ tự ưu tiên (một primary):

| # | Điều kiện | Title card | Primary button | Handler |
|---|-----------|------------|----------------|---------|
| 1 | `!current_complete` | Hoàn thành task giai đoạn | `Làm tiếp ({done}/{total})` | `onOpenWorkflow()` — switch tab workflow |
| 2 | `onboard_gate` present && !ok && next=deliver | Gate Onboard | `Mở checklist Onboard` | scroll workflow / onboard panel |
| 3 | TMMT block (onboard→deliver, no onboard_gate ok) | Gate TMMT | `Mở TMMT chính thức` | `onOpenTmmtTab()` |
| 4 | `launch_qa_gate?.requires_confirm` | Launch QA chưa ready | `Mở Launch QA` | `onOpenLaunchQaTab()` |
| 5 | `payment_gate?.requires_confirm` | Công nợ HĐ | `Mở Tài chính` | `onOpenFinanceTab()` |
| 6 | `can_advance_forward && next_stage` | Sẵn sàng chuyển bước | `Chuyển → {STAGE_LABELS[next]}` | reuse advance handler từ workflow panel |
| 7 | `!next_stage` (retain terminal) | Đã ở giai đoạn cuối | (no primary / muted) | — |
| 8 | fallback | `block_reason` | Secondary link tab workflow | — |

**Subtitle:** 1 dòng từ `block_reason` hoặc message đầu gate (max 120 ký tự).

**Không** thêm card thứ hai; **không** duplicate nút advance trong hero khi user đang tab Workflow (hero luôn visible — OK, HubSpot cũng sticky next action).

### 7.4. Permissions

- Advance stage: `hasCap(user, 'crm_board', 'edit')` — giống workflow panel.  
- Finance confirm tab: `crm_business_dashboard` view — giống panel.  
- Disabled primary khi !canEdit.

### 7.5. Styling

Card compact trong `bitrix-theme.css`:

```css
html.ops-shell-bitrix .lifecycle-delivery-nba { /* hero card */ }
```

Không file CSS mới.

---

## 8. Backend — mở rộng readiness (tối thiểu)

### 8.1. Response

```ts
// ContractReadiness + GET readiness JSON
{
  ok, checks, contract, approval,
  lifecycle_id?: number | null,
  lifecycle_stage?: string | null,  // NEW
}
```

### 8.2. Query

Khi `lifecycle_id` có giá trị:

```sql
SELECT stage FROM crm_service_lifecycle WHERE id = $1 LIMIT 1
```

Null-safe: không lifecycle → `lifecycle_stage: null`.

### 8.3. Không đổi

- Promote, approve, agency client logic (WS2).  
- `advance-info` endpoint (đã đủ).

---

## 9. File map (implementation)

| File | Thay đổi |
|------|----------|
| `lead-journey.ts` | Keys delivery, input, append logic |
| `lead-journey.spec.ts` | WS3-01…05 cases |
| `lifecycle-delivery-next-action.ts` | Pure resolver + spec (mới) |
| `LeadJourneyStepper.tsx` | Desc động, props mới |
| `LeadB2bSalesFlowBar.tsx` | Type `LeadContractFlowSummary` extend only |
| `leads/[id]/page.tsx` | Map readiness → contractSummary |
| `leads-contract-pg.repository.ts` | `lifecycle_stage` in getReadiness |
| `contract.types.ts` | `ContractReadiness.lifecycle_stage?` |
| `lib/api.ts` | Type readiness response |
| `LifecycleDeliveryNextActionCard.tsx` | Hero card (mới) |
| `service-delivery/[id]/page.tsx` | Mount hero, fetch advance-info |
| `bitrix-theme.css` | `.lead-journey__track--extended`, `.lifecycle-delivery-nba` |

---

## 10. Acceptance

| ID | Given | Then |
|----|-------|------|
| WS3-01 | Lead B2B pre-won (`contractActive=false`, no lifecycle) | Journey **6** bước; không OB/Giao/CL/Ret |
| WS3-02 | Lead có draft HĐ, chưa active | Journey **6** bước; HĐ `current` — không delivery spine |
| WS3-03 | HĐ active + lifecycle 88, stage `onboard` | Journey **10** bước; sales all `done`; OB `current`; href `/crm/service-delivery/88` |
| WS3-04 | Cùng lead, stage `handover`, `agency_client_id` set | CL `current`; href `/agency/clients/{uuid}` |
| WS3-05 | stage `retain` | Ret `current`; OB/Giao/CL `done` |
| WS3-06 | Review queue active | 6 bước sales `blocked`; **không** append delivery |
| WS3-07 | Service-delivery onboard, tasks chưa xong | Hero: primary «Làm tiếp»; subtitle task count |
| WS3-08 | Onboard complete, TMMT fail | Hero: «Mở TMMT chính thức»; bấm → tab TMMT |
| WS3-09 | Deliver, Launch QA requires_confirm | Hero: «Mở Launch QA» |
| WS3-10 | Handover, payment requires_confirm | Hero: «Mở Tài chính» |
| WS3-11 | All gates pass, can_advance_forward | Hero: «Chuyển → {next}»; advance thành công |
| WS3-12 | `spa_operational` lead | Không journey extension (guard) |
| WS3-R | S0 VIS + S1 NBA fixture | Không regress visibility / NBA kinds |

---

## 11. Kiểm thử & deploy

- Vitest `lead-journey.spec.ts` + `lifecycle-delivery-next-action.spec.ts` trước merge.  
- Manual UAT (lead pilot post-WS2): approve HĐ → lead journey 10 bước → OB link delivery → hero CTA TMMT khi gate.  
- Deploy: `APPLY=1 ./scripts/deploy_lmp_s2_vps.sh` (Nest nếu readiness đổi + ops-web).  
- **Không** DDL.

---

## 12. Rủi ro

| Rủi ro | Chặn |
|--------|------|
| Stepper 10 bước chật mobile | `short_vi` + scroll ngang CSS |
| Double advance button | Hero + workflow — chấp nhận; copy block_reason ngắn |
| Readiness thiếu stage | Fallback index 0 (OB current) |
| Pre-WS2 lead thiếu client | CL step muted — WS2 backfill |
| Bitrix phình | Một hero card; không thêm tab lead |

---

## 13. Sign-off

| Vai trò | Duyệt | OK |
|---------|-------|-----|
| PO | §3 Q1–Q8 (AND trigger, stage map) | ☐ |
| AM pilot | 10 bước chỉ post-won; CTA một việc | ☐ |
| Eng | Readiness field only; no new routes | ☐ |
| Ops | Gate logic unchanged | ☐ |

---

## 14. Spec self-review

| Check | Kết quả |
|-------|---------|
| TBD / TODO | Không — Q1–Q8 khóa §3 |
| Mâu thuẫn LIFE-WIN §6 WS3 | Khớp: 4 keys, nhãn OB/Giao/CL/Ret, CTA advance-info, cấm 9-step pre-won |
| Mâu thuẫn WS2 | Dùng `agency_client_id` cho CL href; readiness không duplicate client create |
| Mâu thuẫn S0/S1 | Sales 6 bước logic giữ; NBA không đổi |
| Phạm vi 1 plan | Frontend + 1 field readiness; không WS4 |
| Ambiguity «9 bước» | LIFE-WIN = cấm pre-won; post-won 10 OK |
| Bitrix phình | 1 card delivery; journey desc 1 dòng |

---

## 15. Next step

1. PO/Eng tick §13.  
2. Plan WS3: `docs/superpowers/plans/2026-08-29-lifecycle-ws3-delivery-spine.md`.  
3. Không gộp WS4 metrics / debrief won trong PR WS3.  
4. UAT gợi ý sau ship: lead #5 post-approve → journey 10 → service-delivery hero TMMT.

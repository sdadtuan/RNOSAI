# Intake Win-score Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Win-score `/30` + bắt Win intel trước Consult (flag) + LLM gợi ý chấm có quote (flag) — BANT/Tư vấn Phase 1 không đổi.

**Architecture:** Win checklist copy mechanic BANT (`toggle` exclusive 1–5) trong `answers_json` — không DDL. Consult-gate đọc `answers_json` phiên completed; `PTT_INTAKE_WIN_GATE=0` giữ Phase 1. LLM `suggest-scores` validate quote ∈ form rồi AM confirm mới ghi điểm. Flag LLM mặc định tắt.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · Vitest · Jest · `AiLlmClient` · không package mới · không DDL.

**Spec:** [2026-08-31-intake-win-score-phase2-design.md](../specs/2026-08-31-intake-win-score-phase2-design.md) v1.0

## Global Constraints

- Không đổi `GO_THRESHOLDS` `{ go: 24, nurture_min: 18 }` hay schema 6 key `bant_json`.
- Copy Deal Bar BANT vẫn **Đủ Tư vấn** / **Còn N để Tư vấn**. Chip Sales Kit `Còn thiếu để Go` giữ.
- `PTT_INTAKE_WIN_GATE` default **false** — gate Phase 1 khi tắt.
- `PTT_INTAKE_LLM_SCORE` default **false** — không gọi LLM / ẩn nút khi tắt.
- LLM không ghi `bant_json` / Win nếu AM chưa **Áp dụng gợi ý**.
- Quote suggestion phải là substring form (normalize); fail-closed nếu không.
- Không invent money. Không MEDDPICC. Không ép L2 / Proposal.
- Complete: Win mỏng = **warn**, không error.
- JWT / RBAC: `crm_leads.edit` tick + apply; `crm_leads.view` đọc gate.

---

## File map

| File | Việc |
|------|------|
| `services/ops-web/src/lib/crm/intake-win-score.ts` | keys, thresholds, `computeWinTotal` |
| `services/ops-web/src/lib/crm/intake-win-checklist.ts` | `WIN_CHECKLIST`, toggle/parse/score |
| `services/ops-web/src/lib/crm/intake-win-coverage.ts` | `winKeyFilled`, `missingRequiredWinKeys` |
| `services/ptt-crm-api/src/intake/intake-win-score.util.ts` | cùng logic (Jest) để gate + LLM dùng |
| `presales-consult-gate.util.ts` | nhánh Win khi flag ON |
| `leads-funnel-pg.repository.ts` | SELECT `answers_json` |
| `IntakeWinChecklistPanel.tsx` + `IntakeDealBar.tsx` + `IntakeContent.tsx` | drawer WIN |
| `intake-validation.ts` | warn `win_thin` |
| `intake-score-suggest.util.ts` + service + controller | LLM |
| `e2e/intake-win-score-phase2.spec.ts` | U1–U3 |

Mirror util API **cùng signature** trên ops-web và ptt-crm-api (copy nhỏ, không monorepo package). Khi sửa một bên phải sửa bên kia trong cùng task.

---

### Task 1: Win-score + checklist helpers (ops-web)

**Files:**
- Create: `services/ops-web/src/lib/crm/intake-win-score.ts`
- Create: `services/ops-web/src/lib/crm/intake-win-score.spec.ts`
- Create: `services/ops-web/src/lib/crm/intake-win-checklist.ts`
- Create: `services/ops-web/src/lib/crm/intake-win-checklist.spec.ts`

**Interfaces:**
- Consumes: pattern `intake-bant.ts` / `intake-bant-checklist.ts`
- Produces:

```ts
export const WIN_SCORE_KEYS = [
  'incumbent', 'competitor', 'selection_criteria', 'switch_risk', 'champion', 'next_step',
] as const;
export type WinScoreKey = (typeof WIN_SCORE_KEYS)[number];
export const WIN_THRESHOLDS = { consult: 18, proposal_hint: 24 } as const;
export function computeWinTotal(win: Record<string, number>): number

export type WinChecklistState = Partial<Record<WinScoreKey, number>>;
export const WIN_CHECKLIST: Record<WinScoreKey, { hint: string; items: Array<{ score: 1|2|3|4|5; label: string }> }>;
export function parseWinChecklist(answers: Record<string, unknown> | undefined): WinChecklistState
export function scoreWinFromChecklist(checklist: WinChecklistState): Record<string, number>
export function toggleWinChecklistScore(checklist: WinChecklistState, key: WinScoreKey, score: number): WinChecklistState
export function mergeWinChecklistPatch(existing: Record<string, unknown>, checklist: WinChecklistState): Record<string, unknown>
export function winChecklistTotal(checklist: WinChecklistState): number
```

`parseWinChecklist` đọc `answers.win_checklist`. `mergeWinChecklistPatch` ghi `{ ...existing, win_checklist: scoreWinFromChecklist(checklist), win_score_json: scoreWinFromChecklist(checklist) }`.

`WIN_CHECKLIST` labels (dùng verbatim):

```ts
incumbent: hint 'Agency / freelancer / in-house đang làm?', items: [
  { score: 1, label: 'Không biết ai đang làm / “chưa dùng agency” mơ hồ' },
  { score: 2, label: 'Biết có người làm nhưng không tên, không kết quả' },
  { score: 3, label: 'Biết tên loại (freelancer/agency) + 1 phàn nàn chung' },
  { score: 4, label: 'Tên + lỗ hổng cụ thể (KPI/SLA/báo cáo)' },
  { score: 5, label: 'Tên + số liệu thất bại + lý do đang tìm chỗ mới' },
],
competitor: hint 'Ai đang pitch cùng lúc?', items: [
  { score: 1, label: 'Không biết / không hỏi' },
  { score: 2, label: '“Có vài bên” — không tên' },
  { score: 3, label: 'Biết 1 tên, chưa biết họ hứa gì' },
  { score: 4, label: 'Tên + điểm họ đang thắng (giá / case)' },
  { score: 5, label: 'Tên + so sánh được gói PTT vs họ trên tiêu chí KH' },
],
selection_criteria: hint 'KH chọn agency theo gì?', items: [
  { score: 1, label: 'Không nêu tiêu chí' },
  { score: 2, label: '“Giá” hoặc “uy tín” chung chung' },
  { score: 3, label: '1 tiêu chí rõ (giá / case / SLA) chưa trọng số' },
  { score: 4, label: '2+ tiêu chí + ai chấm' },
  { score: 5, label: 'Tiêu chí + trọng số + ngày chấm / họp board' },
],
switch_risk: hint 'Rủi ro nếu đổi sang PTT?', items: [
  { score: 1, label: 'Không nói / “không sao”' },
  { score: 2, label: 'Sợ giá hoặc sợ mất data, chưa cụ thể' },
  { score: 3, label: '1 rủi ro rõ (lock-in, mùa, sếp quen agency cũ)' },
  { score: 4, label: 'Rủi ro + cách KH muốn giảm (trial, bàn giao)' },
  { score: 5, label: 'KH nêu điều kiện đổi + mốc hết HĐ cũ' },
],
champion: hint 'Ai trong nội bộ đứng về phía mình?', items: [
  { score: 1, label: 'Chỉ gặp cổng (trợ lý / form)' },
  { score: 2, label: 'Có 1 người thân thiện, không quyền' },
  { score: 3, label: 'Người dùng dịch vụ ủng hộ, chưa kéo DM' },
  { score: 4, label: 'Có champion + sẵn sàng giới thiệu DM' },
  { score: 5, label: 'Champion + DM cùng cuộc hoặc đã hẹn 3 bên' },
],
next_step: hint 'Cam kết bước tiếp là gì?', items: [
  { score: 1, label: '“Để em xem lại” — không ngày' },
  { score: 2, label: 'Hẹn mơ hồ tuần sau' },
  { score: 3, label: 'Có việc (gửi proposal / họp) chưa khóa lịch' },
  { score: 4, label: 'Lịch cụ thể hoặc deadline gửi L2' },
  { score: 5, label: 'Lịch + chủ đề + người tham dự đã xác nhận' },
],
```

- [ ] **Step 1: Write failing tests**

`intake-win-score.spec.ts`: `computeWinTotal({ incumbent: 4, competitor: 4, selection_criteria: 4, switch_risk: 3, champion: 2, next_step: 1 }) === 18`. Ignore keys ngoài list. Clamp không — điểm ngoài 1–5 tính 0.

`intake-win-checklist.spec.ts`: parse `{ win_checklist: { incumbent: 4 } }` → `{ incumbent: 4 }`; toggle 4 rồi 4 → xóa; `winChecklistTotal` 6×3 = 18; merge ghi cả `win_score_json`.

- [ ] **Step 2: Run to fail**

Run: `cd services/ops-web && npm run test:unit -- src/lib/crm/intake-win-score.spec.ts src/lib/crm/intake-win-checklist.spec.ts`

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement** (copy mechanic `intake-bant-checklist.ts`)

- [ ] **Step 4: Tests PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-win-score.ts \
  services/ops-web/src/lib/crm/intake-win-score.spec.ts \
  services/ops-web/src/lib/crm/intake-win-checklist.ts \
  services/ops-web/src/lib/crm/intake-win-checklist.spec.ts
git commit -m "feat(crm): add Intake Win-score checklist helpers"
```

---

### Task 2: Coverage helper + API mirror utils

**Files:**
- Create: `services/ops-web/src/lib/crm/intake-win-coverage.ts`
- Create: `services/ops-web/src/lib/crm/intake-win-coverage.spec.ts`
- Create: `services/ptt-crm-api/src/intake/intake-win-score.util.ts`
- Create: `services/ptt-crm-api/src/intake/intake-win-score.util.spec.ts`

**Interfaces:**
- Consumes: `WinIntelState`, `WIN_INTEL_KEYS`, `WinScoreKey`
- Produces:

```ts
export const WIN_REQUIRED_KEYS = ['incumbent', 'selection_criteria', 'switch_risk'] as const;
export function winKeyFilled(input: {
  key: WinScoreKey;
  winIntel: Pick<WinIntelState, 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk'>;
  winChecklist: WinChecklistState;
}): boolean
export function missingRequiredWinKeys(...): WinScoreKey[]
export function winGapToConsult(total: number): number // max(0, 18 - total)
export function winConsultLabel(total: number): string
  // total >= 18 → 'Đủ đạn Tư vấn' else `Còn ${winGapToConsult(total)} để thắng`
```

`winKeyFilled`:
- `incumbent|competitor|selection_criteria|switch_risk`: `answer.trim().length >= 8` **và** confidence `heard|confirmed`.
- `champion|next_step`: `winChecklist[key]` ∈ 1–5 **hoặc** (nếu sau này có text — không bắt text Phase 2).

API file export **cùng** `WIN_SCORE_KEYS`, `WIN_THRESHOLDS`, `computeWinTotal`, `parseWinChecklist`, `scoreWinFromChecklist`, `missingRequiredWinKeys`. Copy `WIN_CHECKLIST` không bắt buộc trên API (gate chỉ cần số).

- [ ] **Step 1: Failing tests**

Coverage: incumbent answer `"Agency A đã làm SEO"` + `confirmed` → true; `"abc"` + confirmed → false; `"Agency A đã làm SEO"` + `guess` → false; `champion` checklist 3 → true; missing required khi chỉ có competitor.

API: `computeWinTotal` 18; `parseWinChecklist` từ `{ win_checklist: { incumbent: 5 } }`.

- [ ] **Step 2: Run to fail**

`npm run test:unit -- src/lib/crm/intake-win-coverage.spec.ts`  
`cd services/ptt-crm-api && npm test -- --testPathPattern=intake-win-score.util.spec --coverage=false`

- [ ] **Step 3–4: Implement + PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-win-coverage.ts \
  services/ops-web/src/lib/crm/intake-win-coverage.spec.ts \
  services/ptt-crm-api/src/intake/intake-win-score.util.ts \
  services/ptt-crm-api/src/intake/intake-win-score.util.spec.ts
git commit -m "feat(crm): add Win intel coverage and API win-score util"
```

---

### Task 3: Persist + Deal Bar WIN drawer

**Files:**
- Modify: `services/ops-web/src/lib/crm/intake-session-form.ts` — parse `winChecklist`
- Modify: `services/ops-web/src/lib/crm/intake-answers.ts` — merge `mergeWinChecklistPatch`
- Modify: `services/ops-web/src/components/crm/intake/IntakeDealBar.tsx`
- Create: `services/ops-web/src/components/crm/intake/IntakeWinChecklistPanel.tsx` (clone layout `IntakeBantChecklistPanel`, không copy next-step BANT)
- Modify: `services/ops-web/src/app/crm/intake/IntakeContent.tsx`
- Modify: `services/ops-web/src/app/globals.css` — reuse class `intake-bant-drawer__*` hoặc `intake-win-drawer`

**Interfaces:**
- Consumes: `toggleWinChecklistScore`, `winConsultLabel`, `winChecklistTotal`
- Produces: Deal Bar button **WIN** (`exact: true`); drawer `testId=intake-win-drawer` `kicker=WIN+` `title=Chấm Win`

`IntakeWinChecklistPanel` props:

```ts
{
  checklist: WinChecklistState;
  canEdit: boolean;
  onToggle: (key: WinScoreKey, score: number) => void;
}
```

Mỗi block: 5 checkbox exclusive như BANT (`id={`win-check-${key}-${score}`}`). Footer: `Win {total}/30 · {winConsultLabel(total)}`.

Deal Bar: cạnh nút BANT thêm WIN; dòng phụ hoặc cùng score line: `Win {n}/30 · {winConsultLabel(n)}` — **không** thay dòng BANT Tư vấn.

`formSnapshot` / autosave: thêm `winChecklist`. PATCH qua `answers_json` (đã merge).

- [ ] **Step 1:** Wire parse/merge (không UI test bắt buộc). Thêm unit session-form nếu file spec đã có parse win_intel — extend 1 case `win_checklist`.

- [ ] **Step 2:** Panel + Deal Bar + `winOpen` state + `SalesCockpitDrawer`.

- [ ] **Step 3:** `npm run test:unit -- src/lib/crm/intake-win-checklist.spec.ts src/lib/crm/intake-session-form.spec.ts` (nếu có)

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-session-form.ts \
  services/ops-web/src/lib/crm/intake-answers.ts \
  services/ops-web/src/components/crm/intake/IntakeWinChecklistPanel.tsx \
  services/ops-web/src/components/crm/intake/IntakeDealBar.tsx \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx \
  services/ops-web/src/app/globals.css
git commit -m "feat(crm): add Intake WIN checklist drawer on Deal Bar"
```

---

### Task 4: Consult-gate Win (flag)

**Files:**
- Modify: `services/ptt-crm-api/src/leads-funnel/presales-consult-gate.util.ts`
- Modify: `services/ptt-crm-api/src/leads-funnel/presales-consult-gate.util.spec.ts`
- Modify: `services/ptt-crm-api/src/leads-funnel/leads-funnel-pg.repository.ts` (~776–814)
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts` **hoặc** đọc env trực tiếp trong util: `export function intakeWinGateEnabled(): boolean` trong `intake-win-score.util.ts` qua `process.env.PTT_INTAKE_WIN_GATE === '1'`.

**Interfaces:**
- Consumes: `validatePresalesConsultAdvance` hiện tại
- Produces: `ConsultAdvanceGateInput.sessions[]` thêm `answers_json?: Record<string, unknown>`

Thuật toán **sau** các return Phase 1, **chỉ khi** `intakeWinGateEnabled()` và `decision === 'go'` (kể cả khi BANT đang warn — vẫn chạy; nếu thiếu Win → **block**, ghi đè warn BANT):

```ts
const answers = latestCompleted?.answers_json ?? {};
const checklist = parseWinChecklist(answers);
const winTotal = computeWinTotal(scoreWinFromChecklist(checklist));
const missing = missingRequiredWinKeys({ winIntel: parseWinIntel(answers), winChecklist: checklist });
if (missing.length) {
  return block([`Thiếu Win intel: ${missing.join(', ')}. Ghi tab Win intel rồi mở WIN.`], decision, bantTotal);
}
if (winTotal < WIN_THRESHOLDS.consult) {
  return block([`Win ${winTotal}/30 dưới ngưỡng Tư vấn (${WIN_THRESHOLDS.consult}).`], decision, bantTotal);
}
// else fall through — giữ result BANT đã tính (ok / warn)
```

Cần refactor nhẹ: tính `base` Phase 1 trước, rồi nếu flag+go+win fail → return block; else return `base`.

`parseWinIntel` trên API: implement tối thiểu trong `intake-win-score.util.ts` (4 key answer/confidence) — đừng import ops-web.

SQL:

```sql
SELECT status, mode, decision, bant_total, answers_json
FROM crm_lead_intake_sessions
WHERE lead_id = $1
ORDER BY updated_at DESC, id DESC
LIMIT 20
```

- [ ] **Step 1: Tests**

Giữ 4 test cũ (flag OFF — default). Thêm:

- flag ON, go, bant 26, answers rỗng → `ok===false`, message `/Win intel|Win /`.
- flag ON, go, 3 field filled (8+ char + confirmed) + checklist tổng 18 → `ok===true` nếu Lead task + completed (cùng fixture test `allows go with strong BANT`).
- flag OFF, go, answers rỗng, bant 26 → `ok===true` (Phase 1).

Set `process.env.PTT_INTAKE_WIN_GATE` trong test, restore sau.

- [ ] **Step 2: Run jest** `presales-consult-gate.util.spec` — RED rồi GREEN.

- [ ] **Step 3: SELECT answers_json + pass vào validate**

- [ ] **Step 4: Commit**

```bash
git add services/ptt-crm-api/src/leads-funnel/presales-consult-gate.util.ts \
  services/ptt-crm-api/src/leads-funnel/presales-consult-gate.util.spec.ts \
  services/ptt-crm-api/src/leads-funnel/leads-funnel-pg.repository.ts \
  services/ptt-crm-api/src/intake/intake-win-score.util.ts
git commit -m "feat(crm): block Consult when Win intel thin if flag on"
```

---

### Task 5: Complete warn `win_thin`

**Files:**
- Modify: `services/ops-web/src/lib/crm/intake-validation.ts`
- Modify: `services/ops-web/src/lib/crm/intake-validation.spec.ts` (tạo nếu chưa có)
- Modify: `IntakeContent.tsx` — truyền `winIntel` + `winChecklist` vào `validateIntakeComplete`

**Interfaces:**
- Extends `IntakeCompleteValidationInput` với `winIntel: WinIntelState` và `winChecklist: WinChecklistState`

Khi `decision === 'go'` và (`missingRequiredWinKeys.length` hoặc `winChecklistTotal < 18`):

```ts
issues.push({
  level: 'warn',
  code: 'win_thin',
  message: 'Go nhưng Win intel / Win-score chưa đủ để chuyển Tư vấn (cần 3 mục bắt buộc + Win ≥18).',
});
```

Không thêm error. Test: go + empty win → 1 warn `win_thin`; nurture + empty → không `win_thin`.

- [ ] **Step 1–4: TDD + commit**

```bash
git add services/ops-web/src/lib/crm/intake-validation.ts \
  services/ops-web/src/lib/crm/intake-validation.spec.ts \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx
git commit -m "feat(crm): warn on Complete when Go but Win intel is thin"
```

---

### Task 6: Suggest-score validate (thuần)

**Files:**
- Create: `services/ptt-crm-api/src/intake/intake-score-suggest.util.ts`
- Create: `services/ptt-crm-api/src/intake/intake-score-suggest.util.spec.ts`

**Interfaces:**

```ts
export function normalizeScoreQuote(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function formCorpus(input: {
  discoveryAnswers: string[];
  winAnswers: string[];
  commitmentTexts: string[];
}): string

export type ScoreSuggestion = { score: 1|2|3|4|5; quote: string };
export function filterScoreSuggestions(input: {
  corpus: string;
  bant?: Partial<Record<string, ScoreSuggestion>>;
  win?: Partial<Record<string, ScoreSuggestion>>;
}): {
  suggestions: { bant?: ...; win?: ... };
  rejected: Array<{ layer: 'bant'|'win'; key: string; reason: 'empty_quote'|'quote_not_in_form'|'bad_score' }>;
}
```

`quote_not_in_form` khi `!normalizeScoreQuote(corpus).includes(normalizeScoreQuote(quote))`.  
`bad_score` khi không ∈ 1..5.  
Key lạ (không thuộc BANT_KEYS / WIN_SCORE_KEYS) → reject `bad_score` hoặc bỏ qua — **bỏ qua key lạ**, không crash.

- [ ] **Step 1: Tests**

Corpus `"agency cũ không đạt KPI tháng 3 ngân sách 30 triệu"`. Quote `"không đạt KPI"` → keep. Quote `"top 1 google"` → reject. Quote `"   "` → empty_quote. Score 9 → bad_score.

- [ ] **Step 2–4: RED/GREEN + commit**

```bash
git add services/ptt-crm-api/src/intake/intake-score-suggest.util.ts \
  services/ptt-crm-api/src/intake/intake-score-suggest.util.spec.ts
git commit -m "feat(crm): validate LLM score suggestions against form quotes"
```

---

### Task 7: LLM endpoint + UI confirm

**Files:**
- Modify: `ai-audit.constants.ts` — `INTAKE_SCORE_SUGGEST: 'intake_score_suggest'`
- Modify: `ai-intelligence.config.ts` — `intakeLlmScoreEnabled = envFlag('PTT_INTAKE_LLM_SCORE', false)`
- Create: `services/ptt-crm-api/src/intake/intake-score-suggest.service.ts`
- Modify: `intake.controller.ts` + `intake.module.ts`
- Modify: `IntakeBantChecklistPanel.tsx` + `IntakeWinChecklistPanel.tsx` + `IntakeContent.tsx`
- Modify: `services/ops-web/src/lib/api.ts` — `suggestIntakeScores(token, sessionId)`

**Interfaces:**

`POST /api/crm/intake/sessions/:id/suggest-scores`  
Guards: cùng PATCH session (`crm_leads.edit`).  
Nếu `!intakeLlmScoreEnabled` → `503 { error: 'llm_score_disabled' }`.

Service:
1. Load session `answers_json`, `bant_json`.
2. Build corpus từ discovery responses + win intel + commitments.
3. Nếu corpus `normalize` length &lt; 20 → return `{ stub_mode: true, suggestions: {}, rejected: [] }` không gọi LLM.
4. `completeJson` schema: `{ bant: Record<string, {score, quote}>, win: Record<string, {score, quote}> }`.
5. `filterScoreSuggestions`.
6. Audit run `INTAKE_SCORE_SUGGEST`. Timeout = kit timeout hoặc 8000.
7. LLM throw → stub rỗng, không 500 (catch → stub_mode).

UI: nút **Gợi ý chấm** chỉ hiện khi `process.env.NEXT_PUBLIC_PTT_INTAKE_LLM_SCORE === '1'` (ops-web) **và** session draft. Kết quả: list checkbox theo suggestion + quote; **Áp dụng gợi ý** gọi `onToggle` từng key đã chọn. Không apply key đã có điểm trừ khi AM tick “ghi đè”.

Jest service: mock `completeJson` trả quote trong corpus → suggestions giữ; quote ngoài → rejected.

- [ ] **Step 1–4: TDD service + wire + commit**

```bash
git add services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts \
  services/ptt-crm-api/src/intake/intake-score-suggest.service.ts \
  services/ptt-crm-api/src/intake/intake-score-suggest.service.spec.ts \
  services/ptt-crm-api/src/intake/intake.controller.ts \
  services/ptt-crm-api/src/intake/intake.module.ts \
  services/ops-web/src/lib/api.ts \
  services/ops-web/src/components/crm/intake/IntakeBantChecklistPanel.tsx \
  services/ops-web/src/components/crm/intake/IntakeWinChecklistPanel.tsx \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx
git commit -m "feat(crm): suggest BANT/Win scores from form quotes via LLM"
```

---

### Task 8: E2e U1–U3 + hướng dẫn + spec status

**Files:**
- Create: `services/ops-web/e2e/intake-win-score-phase2.spec.ts`
- Modify: `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` — Deal Bar thêm WIN; Consult cần Win khi flag
- Modify: spec header → `Plan sẵn sàng implement` hoặc `Implemented` sau khi unit xanh (không tick U4–U7 nếu LLM/flag prod tắt)

**Interfaces:**
- Consumes: helpers `openIntakeForLead`, `createPhoneSession`, `scoreBant` (drawer BANT đã sửa Phase 1)

```ts
test('U1 Deal Bar has WIN and BANT Tư vấn copy', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'WIN', exact: true })).toBeVisible();
  await expect(page.getByText(/Đủ Tư vấn|để Tư vấn/)).toBeVisible();
});

test('U2 ticking incumbent 4 updates Win score', async ({ page }) => {
  await page.getByRole('button', { name: 'WIN', exact: true }).click();
  await page.getByLabel(/Tên \+ lỗ hổng cụ thể/i).check();
  await expect(page.getByText(/Win [4-9]/)).toBeVisible();
});
```

U3 live Consult-gate cần flag ON trên API — **skip** nếu `PTT_INTAKE_WIN_GATE` không phải `1` (đọc từ health/env không có thì skip). Unit Task 4 đã cover U1/U2 gate.

Không bật flag trên prod trong task này.

- [ ] **Step 1:** e2e + docs

- [ ] **Step 2: Unit all Phase 2**

```bash
cd services/ops-web && npm run test:unit -- \
  src/lib/crm/intake-win-score.spec.ts \
  src/lib/crm/intake-win-checklist.spec.ts \
  src/lib/crm/intake-win-coverage.spec.ts \
  src/lib/crm/intake-validation.spec.ts
cd ../ptt-crm-api && npm test -- --testPathPattern='intake-win-score.util.spec|intake-score-suggest|presales-consult-gate.util.spec' --coverage=false
```

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/e2e/intake-win-score-phase2.spec.ts \
  docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md \
  docs/superpowers/specs/2026-08-31-intake-win-score-phase2-design.md
git commit -m "test(crm): cover Win-score Phase 2 and update AM guide"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| G1 Win `/30` + drawer | 1, 3 |
| G2 bắt Win intel Consult | 2, 4 |
| G3 LLM quote + confirm | 6, 7 |
| G4 flag rollback | 4, 7 |
| G5 Phase 1 không phá | Global + Deal Bar Task 3 |
| Complete warn | 5 |
| U1–U3 | 8 (+ 4) |
| L2 / MEDDPICC / DDL | không làm |

## Placeholder scan

Không TBD. Flag tên cố định. Signature cố định.

## Type consistency

- `WinScoreKey` / `WIN_SCORE_KEYS` / `WIN_THRESHOLDS.consult === 18` đồng bộ ops-web ↔ API.
- `missingRequiredWinKeys` cùng 3 key.
- Drawer ids `win-check-${key}-${score}`.
- Env: `PTT_INTAKE_WIN_GATE` · `PTT_INTAKE_LLM_SCORE` · `NEXT_PUBLIC_PTT_INTAKE_LLM_SCORE`.

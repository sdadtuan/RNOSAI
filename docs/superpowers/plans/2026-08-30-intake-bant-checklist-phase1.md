# Intake BANT Checklist Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Qualify không còn radio 1–5; AM chấm BANT chỉ qua drawer Deal Bar; Discovery gắn nhóm; drawer gợi ý bước tiếp và cảnh báo thiếu bằng chứng; copy Deal Bar nói **Đủ Tư vấn**.

**Architecture:** Giữ `bant_json` 6 key + `GO_THRESHOLDS` 24/18. Điểm chỉ từ `toggleBantChecklistScore` (đã ship) hoặc Sales Kit apply confirm. API `getUiDefinition` gắn `bant_key` trên `question_items`. Helpers thuần `gapToConsultLabel`, `hasBantDiscoveryEvidence`, `nextBantStep` trên ops-web; Qualify chỉ đọc tổng + mở drawer.

**Tech Stack:** NestJS `ptt-crm-api` · Next.js ops-web · Vitest · Playwright (`e2e/intake-deal-bar-sales-kit.spec.ts` helpers) · không package mới · không DDL.

**Spec:** [2026-08-30-intake-bant-checklist-phase1-design.md](../specs/2026-08-30-intake-bant-checklist-phase1-design.md) v1.0 · **Đã ship:** drawer + `bant_checklist` (`9fd4c376`)

## Global Constraints

- Không đổi `GO_THRESHOLDS` `{ go: 24, nurture_min: 18 }` hay schema 6 key `bant_json`.
- Không tự chấm từ LLM / text Discovery.
- Không đổi consult-gate, Complete error/warn INT-P1, Sales Kit 8 chip label (`Còn thiếu để Go` giữ).
- `decision` value vẫn `go` | `nurture` | `no_go`.
- Copy AM trên Deal Bar / drawer / Qualify: **Tư vấn**, không “Đủ Go”.
- Warn thiếu Discovery: không disable tick, không block Complete.
- Chỉ warn nhóm BANT khi definition hiện tại **có ≥1** `question_item` cùng `bant_key`.
- JWT / RBAC Intake không đổi (`crm_leads.edit` để tick).

---

## File map

| File | Việc |
|------|------|
| `services/ops-web/src/lib/crm/intake-service-resolve.ts` | `gapToConsultLabel(gap)` |
| `services/ops-web/src/lib/crm/intake-bant-evidence.ts` | `hasBantDiscoveryEvidence` |
| `services/ops-web/src/lib/crm/intake-bant-next-step.ts` | `nextBantStep` |
| `services/ptt-crm-api/src/intake/intake-definitions.util.ts` | `BANT_KEY_BY_QUESTION_KEY` + `bant_key` trên items |
| `services/ops-web/src/lib/crm/intake-questions.ts` | `bant_key?: BantKey` |
| `IntakeDiscoveryChecklist.tsx` | Chip nhóm |
| `IntakeBantSection.tsx` / `IntakeQualifyTab.tsx` | Bỏ radio; CTA mở BANT |
| `IntakeDealBar.tsx` | Copy Tư vấn |
| `IntakeBantChecklistPanel.tsx` | Warn + bước tiếp + CTA tab |
| `IntakeContent.tsx` | Wire evidence + `onOpenBant` + `onFocusTab` |
| `e2e/intake-bant-checklist-phase1.spec.ts` | U1–U4 |
| `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` | Bước 3 copy |

---

### Task 1: Copy Deal Bar — `gapToConsultLabel`

**Files:**
- Modify: `services/ops-web/src/lib/crm/intake-service-resolve.ts`
- Modify: `services/ops-web/src/lib/crm/intake-service-resolve.spec.ts`
- Modify: `services/ops-web/src/components/crm/intake/IntakeDealBar.tsx`

**Interfaces:**
- Consumes: `gapToGo(bantTotal, goThreshold = 24): number` (không đổi)
- Produces: `gapToConsultLabel(gap: number): string`

- [ ] **Step 1: Write the failing test**

Thêm vào `intake-service-resolve.spec.ts`:

```ts
import { gapToConsultLabel, gapToGo } from './intake-service-resolve';

describe('gapToConsultLabel', () => {
  it('uses Tư vấn not Go', () => {
    expect(gapToConsultLabel(0)).toBe('Đủ Tư vấn');
    expect(gapToConsultLabel(16)).toBe('Còn 16 để Tư vấn');
    expect(gapToConsultLabel(gapToGo(8))).toBe('Còn 16 để Tư vấn');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-service-resolve.spec.ts`

Expected: FAIL — `gapToConsultLabel` is not exported.

- [ ] **Step 3: Write minimal implementation**

Trong `intake-service-resolve.ts` sau `gapToGo`:

```ts
export function gapToConsultLabel(gap: number): string {
  const n = Number(gap) || 0;
  return n <= 0 ? 'Đủ Tư vấn' : `Còn ${n} để Tư vấn`;
}
```

`IntakeDealBar.tsx`: thay

```ts
const gapLabel = gap <= 0 ? 'Đủ Go' : `Còn ${gap} để Go`;
```

bằng

```ts
import { CATALOG_SERVICE_SLUGS, gapToConsultLabel, intakeServiceLabel } from '@/lib/crm/intake-service-resolve';
// ...
const gapLabel = gapToConsultLabel(gap);
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/lib/crm/intake-service-resolve.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-service-resolve.ts \
  services/ops-web/src/lib/crm/intake-service-resolve.spec.ts \
  services/ops-web/src/components/crm/intake/IntakeDealBar.tsx
git commit -m "feat(crm): say Đủ Tư vấn on Intake Deal Bar"
```

---

### Task 2: Evidence + `nextBantStep`

**Files:**
- Create: `services/ops-web/src/lib/crm/intake-bant-evidence.ts`
- Create: `services/ops-web/src/lib/crm/intake-bant-evidence.spec.ts`
- Create: `services/ops-web/src/lib/crm/intake-bant-next-step.ts`
- Create: `services/ops-web/src/lib/crm/intake-bant-next-step.spec.ts`

**Interfaces:**
- Consumes: `BANT_KEYS`, `BANT_CHECKLIST`, `computeBantTotal`, `scoreBantFromChecklist`, `GO_THRESHOLDS`, `IntakeQuestionItem`, `DiscoveryResponseEntry`
- Produces:

```ts
export function hasBantDiscoveryEvidence(input: {
  bantKey: BantKey;
  questionItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
}): boolean

export type BantNextStepCta = 'discovery' | 'qualify' | null;
export type BantNextStepCode = 'incomplete' | 'no_go' | 'nurture' | 'consult';
export type BantNextStep = {
  code: BantNextStepCode;
  title_vi: string;
  body_vi: string;
  cta: BantNextStepCta;
};

export function nextBantStep(input: {
  checklist: BantChecklistState;
  questionItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
}): BantNextStep

export function groupHasMappedQuestions(
  bantKey: BantKey,
  questionItems: IntakeQuestionItem[],
): boolean
```

`hasBantDiscoveryEvidence`: nếu `!groupHasMappedQuestions` → **return true** (không warn). Ngược lại true khi **một** item cùng `bant_key` có `checked[key]`, hoặc `responses[key].answer.trim()`, hoặc confidence `confirmed` | `partial`.

`nextBantStep` — ưu tiên:

1. Số key có điểm 1–5 &lt; 6 → `incomplete`, title `Còn mục chưa chấm`, body liệt kê key còn 0 (dùng label `BANT_FIELD_LABELS`). `cta`: `discovery` nếu **một** key còn 0 mà `groupHasMappedQuestions && !hasBantDiscoveryEvidence`; else `null`.
2. `computeBantTotal` &lt; 18 → `no_go`, title `Gợi ý: Từ chối / dừng Tư vấn`, body gồm `BANT ${total}/30` và `Nurture`, `cta: 'qualify'`.
3. total &lt; 24 → `nurture`, title `Gợi ý: Nuôi dưỡng`, body `Còn ${24-total} điểm để Tư vấn` + `BANT_CHECKLIST[lowest].hint` (lowest = min score, tie `BANT_KEYS` order), `cta: 'discovery'`.
4. else `consult`, title `Gợi ý: Đủ Tư vấn`, body **phải** chứa `chưa phải đủ báo giá` và `Chuyển → Tư vấn`, `cta: 'qualify'`.

- [ ] **Step 1: Write failing tests**

`intake-bant-evidence.spec.ts`:

```ts
import { hasBantDiscoveryEvidence } from './intake-bant-evidence';

const items = [{ key: 'phone_budget', text: 'NS', bant_key: 'budget' as const }];

describe('hasBantDiscoveryEvidence', () => {
  it('does not warn when group has no mapped questions', () => {
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'fit',
        questionItems: items,
        checked: {},
        responses: {},
      }),
    ).toBe(true);
  });

  it('true when checked, answer, or partial confidence', () => {
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'budget',
        questionItems: items,
        checked: { phone_budget: true },
        responses: {},
      }),
    ).toBe(true);
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'budget',
        questionItems: items,
        checked: {},
        responses: { phone_budget: { asked: false, answer: '30tr', confidence: '' } },
      }),
    ).toBe(true);
    expect(
      hasBantDiscoveryEvidence({
        bantKey: 'budget',
        questionItems: items,
        checked: {},
        responses: { phone_budget: { asked: false, answer: '', confidence: 'partial' } },
      }),
    ).toBe(false); // wait — spec says confidence confirmed|partial IS evidence
  });
});
```

Sửa test cuối: `partial` **không** cần answer → `toBe(true)`. Thêm case `checked: {}, responses: {}` → `toBe(false)` cho budget.

`intake-bant-next-step.spec.ts`:

```ts
import { nextBantStep } from './intake-bant-next-step';

const emptyItems: [] = [];

describe('nextBantStep', () => {
  it('incomplete when fewer than 6 scored', () => {
    const out = nextBantStep({
      checklist: { budget: 4 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('incomplete');
    expect(out.cta).toBeNull();
  });

  it('no_go under 18 when all scored', () => {
    const out = nextBantStep({
      checklist: { budget: 2, authority: 2, need: 2, timeline: 2, fit: 2, history: 2 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('no_go');
    expect(out.cta).toBe('qualify');
    expect(out.body_vi).toMatch(/12\/30/);
  });

  it('nurture at 20 with gap 4', () => {
    const out = nextBantStep({
      checklist: { budget: 2, authority: 4, need: 4, timeline: 4, fit: 3, history: 3 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('nurture');
    expect(out.body_vi).toMatch(/Còn 4 điểm để Tư vấn/);
    expect(out.cta).toBe('discovery');
  });

  it('consult at 24 mentions not a signed contract', () => {
    const out = nextBantStep({
      checklist: { budget: 4, authority: 4, need: 4, timeline: 4, fit: 4, history: 4 },
      questionItems: emptyItems,
      checked: {},
      responses: {},
    });
    expect(out.code).toBe('consult');
    expect(out.title_vi).toMatch(/Đủ Tư vấn/);
    expect(out.body_vi).toMatch(/chưa phải đủ báo giá/);
    expect(out.cta).toBe('qualify');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/ops-web && npx vitest run src/lib/crm/intake-bant-evidence.spec.ts src/lib/crm/intake-bant-next-step.spec.ts`

Expected: FAIL — modules missing.

- [ ] **Step 3: Implement helpers**

`intake-bant-evidence.ts` — đúng signature §Interfaces.

`intake-bant-next-step.ts` — import `BANT_FIELD_LABELS` từ `intake-labels.ts` cho tên mục chưa chấm.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-bant-evidence.ts \
  services/ops-web/src/lib/crm/intake-bant-evidence.spec.ts \
  services/ops-web/src/lib/crm/intake-bant-next-step.ts \
  services/ops-web/src/lib/crm/intake-bant-next-step.spec.ts
git commit -m "feat(crm): add BANT next-step and discovery evidence helpers"
```

---

### Task 3: API `bant_key` trên definition items

**Files:**
- Modify: `services/ptt-crm-api/src/intake/intake-definitions.util.ts`
- Modify: `services/ptt-crm-api/src/intake/intake-definitions.util.spec.ts`

**Interfaces:**
- Consumes: `IntakeQuestionItem` (thêm `bant_key?: (typeof BANT_KEYS)[number]`)
- Produces: `BANT_KEY_BY_QUESTION_KEY: Record<string, (typeof BANT_KEYS)[number]>` — export để test. `getUiDefinition` items có `bant_key` khi key nằm trong map.

Map **đủ** (spec §4 + pilot):

```ts
export const BANT_KEY_BY_QUESTION_KEY: Record<string, (typeof BANT_KEYS)[number]> = {
  phone_pain_point: 'need',
  phone_budget: 'budget',
  phone_timeline: 'timeline',
  phone_deadline: 'timeline',
  phone_decision_maker: 'authority',
  phone_prior_attempts: 'history',
  phone_industry: 'fit',
  phone_expectation: 'fit',
  phone_priority_service: 'fit',
  phone_service_interest: 'fit',
  phone_kpi: 'need',
  ip_pain_solutions: 'need',
  ip_budget_approved: 'budget',
  ip_timeline: 'timeline',
  ip_approval_process: 'authority',
  ip_icp: 'fit',
  ip_agency_criteria: 'fit',
  ip_partner_risk: 'fit',
  ip_competitors: 'history',
  ip_business_goals: 'need',
  seo_history: 'history',
  seo_competitors: 'history',
  gads_history: 'history',
  web_deadline: 'timeline',
};
```

**Không** map: `phone_domain`, `ip_marketing_team`, `seo_domain`, `seo_gsc`, `gads_account`, `ip_kw`, `ip_tracking`.

`buildQuestionItems`: sau `critical`, `...(BANT_KEY_BY_QUESTION_KEY[key] ? { bant_key: BANT_KEY_BY_QUESTION_KEY[key] } : {})`.

Bump `schema_version` từ `3` → `4`.

- [ ] **Step 1: Write failing tests**

Trong `intake-definitions.util.spec.ts`:

```ts
import { BANT_KEY_BY_QUESTION_KEY, getUiDefinition } from './intake-definitions.util';

it('maps common phone BANT keys and skips domain', () => {
  const common = getUiDefinition('_common') as {
    phone_question_items: Array<{ key: string; bant_key?: string }>;
    inperson_question_items: Array<{ key: string; bant_key?: string }>;
    schema_version: number;
  };
  expect(common.schema_version).toBe(4);
  const byKey = Object.fromEntries(common.phone_question_items.map((q) => [q.key, q.bant_key]));
  expect(byKey.phone_budget).toBe('budget');
  expect(byKey.phone_decision_maker).toBe('authority');
  expect(byKey.phone_domain).toBeUndefined();
  const ip = Object.fromEntries(common.inperson_question_items.map((q) => [q.key, q.bant_key]));
  expect(ip.ip_marketing_team).toBeUndefined();
  expect(ip.ip_budget_approved).toBe('budget');
});

it('maps seo_history on SEO pilot', () => {
  const seo = getUiDefinition('dich-vu-seo-tong-the') as {
    phone_question_items: Array<{ key: string; bant_key?: string }>;
  };
  expect(seo.phone_question_items.find((q) => q.key === 'seo_history')?.bant_key).toBe('history');
  expect(seo.phone_question_items.find((q) => q.key === 'seo_domain')?.bant_key).toBeUndefined();
});

it('exports full spec map', () => {
  expect(BANT_KEY_BY_QUESTION_KEY.phone_kpi).toBe('need');
  expect(BANT_KEY_BY_QUESTION_KEY.web_deadline).toBe('timeline');
});
```

- [ ] **Step 2: Run to fail**

Run: `cd services/ptt-crm-api && npx jest --testPathPattern=intake-definitions.util.spec --no-coverage`

Expected: FAIL — `bant_key` undefined.

- [ ] **Step 3: Implement map + `buildQuestionItems`**

- [ ] **Step 4: Run jest**

Expected: PASS (cả test `seo_domain` critical cũ).

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/intake/intake-definitions.util.ts \
  services/ptt-crm-api/src/intake/intake-definitions.util.spec.ts
git commit -m "feat(crm): tag Discovery questions with bant_key"
```

---

### Task 4: Ops-web type + chip Discovery

**Files:**
- Modify: `services/ops-web/src/lib/crm/intake-questions.ts`
- Modify: `services/ops-web/src/components/crm/intake/IntakeDiscoveryChecklist.tsx`
- Modify: `services/ops-web/src/app/globals.css` (chip nhỏ cạnh câu)

**Interfaces:**
- Consumes: `bant_key` từ API trên `phone_question_items`
- Produces: `IntakeQuestionItem.bant_key?: BantKey`

```ts
import type { BantKey } from '@/lib/crm/intake-bant';

export interface IntakeQuestionItem {
  key: string;
  text: string;
  critical?: boolean;
  bant_key?: BantKey;
}
```

UI: cạnh `item.critical`, nếu `item.bant_key` thì

```tsx
<span className="intake-discovery-checklist__bant">{BANT_FIELD_LABELS[item.bant_key].label}</span>
```

CSS (gần `.intake-discovery-checklist__critical`):

```css
.intake-discovery-checklist__bant {
  display: inline-block;
  margin-left: 0.35rem;
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #17692f;
  background: #dff3e5;
}
```

Không unit UI. Type-check: `questionItemsForMode` giữ nguyên.

- [ ] **Step 1: Add `bant_key` to interface** (không test fail bắt buộc — không có spec UI unit sẵn)

- [ ] **Step 2: Chip + CSS**

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/lib/crm/intake-questions.ts \
  services/ops-web/src/components/crm/intake/IntakeDiscoveryChecklist.tsx \
  services/ops-web/src/app/globals.css
git commit -m "feat(crm): show BANT group chips on Discovery questions"
```

---

### Task 5: Gỡ radio Qualify — chỉ đọc + mở drawer

**Files:**
- Modify: `services/ops-web/src/components/crm/intake/IntakeBantSection.tsx`
- Modify: `services/ops-web/src/components/crm/intake/IntakeQualifyTab.tsx`
- Modify: `services/ops-web/src/app/crm/intake/IntakeContent.tsx`
- Keep (không import): `IntakeBantScoreRow.tsx`

**Interfaces:**
- Consumes: `onOpenBant: () => void`
- Produces: Qualify không nhận `onBantChange`

`IntakeBantSection` props mới:

```ts
interface Props {
  bant: Record<string, number>;
  decision: string;
  onOpenBant: () => void;
}
```

Bỏ `bantRows`, `disabled` chấm điểm, `onBantChange`, toàn bộ `intake-bant-score-grid`. Giữ `IntakeBantTotalBar` + mismatch. Thêm:

```tsx
<button type="button" className="btn btn-secondary btn-sm" onClick={onOpenBant}>
  Mở checklist BANT
</button>
<p className="muted">Điểm từ checklist BANT trên Deal Bar.</p>
```

`IntakeQualifyTab`: tiêu đề **C. Quyết định**; bỏ `onBantChange`, `bantRows`; pass `onOpenBant`.

`IntakeContent` Qualify: xóa handler radio; `onOpenBant={() => setBantOpen(true)}`.

- [ ] **Step 1: Edit section + tab + content**

- [ ] **Step 2: `npx vitest run src/lib/crm/intake-bant-checklist.spec.ts`** — vẫn PASS

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/components/crm/intake/IntakeBantSection.tsx \
  services/ops-web/src/components/crm/intake/IntakeQualifyTab.tsx \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx
git commit -m "feat(crm): remove Qualify BANT radios in favor of drawer"
```

---

### Task 6: Drawer — warn + bước tiếp + CTA tab

**Files:**
- Modify: `services/ops-web/src/components/crm/intake/IntakeBantChecklistPanel.tsx`
- Modify: `services/ops-web/src/app/crm/intake/IntakeContent.tsx`
- Modify: `services/ops-web/src/app/globals.css`

**Interfaces:**
- Consumes: `nextBantStep`, `hasBantDiscoveryEvidence`, `groupHasMappedQuestions`, `gapToConsultLabel`
- Produces: panel props

```ts
export type IntakeBantChecklistPanelProps = {
  checklist: BantChecklistState;
  canEdit: boolean;
  questionItems: IntakeQuestionItem[];
  checked: Record<string, boolean>;
  responses: Record<string, DiscoveryResponseEntry>;
  onToggle: (key: BantKey, score: number) => void;
  onFocusTab?: (tab: 'discovery' | 'qualify' | 'win_intel') => void;
};
```

Mỗi block: nếu `selected >= 1 && groupHasMappedQuestions(key, questionItems) && !hasBantDiscoveryEvidence(...)` thì

```tsx
<p className="intake-bant-drawer__warn" role="status">
  Chưa có ghi chú Discovery cho mục này. Nên mở Discovery và ghi lời KH trước khi tin điểm.
</p>
```

Trên list (sau `IntakeBantTotalBar`):

```tsx
const step = nextBantStep({ checklist, questionItems, checked, responses });
// article.intake-bant-drawer__next
// h3 = step.title_vi · p = step.body_vi
// nếu step.cta === 'discovery' → button Mở Discovery → onFocusTab?.('discovery')
// nếu step.cta === 'qualify' → button Mở Qualify → onFocusTab?.('qualify')
```

Footer: `BANT {total}/30 · {gapToConsultLabel(gapToGo(total))}` — không “Đủ Go”.

`IntakeContent` truyền `discoveryQuestionItems`, `discovery.checked`, `discovery.responses`, `onFocusTab={(tab) => { setActiveTab(tab); setBantOpen(false); }}`.

- [ ] **Step 1: Update panel + wire**

- [ ] **Step 2: Commit**

```bash
git add services/ops-web/src/components/crm/intake/IntakeBantChecklistPanel.tsx \
  services/ops-web/src/app/crm/intake/IntakeContent.tsx \
  services/ops-web/src/app/globals.css
git commit -m "feat(crm): show BANT next step and discovery-evidence warnings"
```

---

### Task 7: E2e U1–U4 + hướng dẫn AM

**Files:**
- Create: `services/ops-web/e2e/intake-bant-checklist-phase1.spec.ts`
- Modify: `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` (Bước 3)
- Modify: spec header **Trạng thái** → `Plan sẵn sàng implement` (optional)

**Interfaces:**
- Consumes: `openIntakeForLead`, `createPhoneSession`, `setupPresalesLeadStage` như `e2e/intake-deal-bar-sales-kit.spec.ts`

```ts
test('U1 Qualify has no BANT radios and Deal Bar has BANT', async ({ page, request }) => {
  // skip nếu API down / setup fail — copy beforeEach deal-bar spec
  await openIntakeForLead(page, leadId);
  await createPhoneSession(page);
  await expect(page.getByRole('button', { name: 'BANT' })).toBeVisible();
  await page.getByRole('tab', { name: /Qualify/i }).click();
  await expect(page.locator('[name="intake-bant-budget"]')).toHaveCount(0);
});

test('U2 ticking Budget 4 updates score without radios', async ({ page, request }) => {
  await page.getByRole('button', { name: 'BANT' }).click();
  await page.getByLabel(/Có khung rõ/i).check();
  await expect(page.locator('.intake-deal-bar__score')).toContainText(/BANT [4-9]/);
  await expect(page.getByText(/Đủ Tư vấn|để Tư vấn/)).toBeVisible();
});
```

U3: tick Budget khi chưa tick Discovery → `getByText(/Chưa có ghi chú Discovery/)`.  
U4: không bắt buộc tick đủ 6×4 trên e2e live (lâu) — unit Task 2 đã cover `consult`. E2e U4: sau vài tick, `getByRole('heading', { name: /Còn mục chưa chấm|Gợi ý:/ })` visible.

Hướng dẫn § Bước 3:

| Ô BANT live | `BANT x/30 · Còn y để Tư vấn` (hoặc **Đủ Tư vấn** khi ≥24) |
| Qualify | Xem tổng (chỉ đọc), **Mở checklist BANT**, quyết định, RF |
| Discovery | Hỏi + chip nhóm BANT |
| CTA Deal Bar | thêm **BANT** · **Sales Kit** |

Thay câu “Tab Qualify: chấm BANT 1–5” → “Bấm **BANT** trên Deal Bar, tick câu KH vừa nói; Qualify chỉ chọn Quyết định.”

- [ ] **Step 1: E2e + docs**

- [ ] **Step 2: Run unit all related**

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/intake-service-resolve.spec.ts \
  src/lib/crm/intake-bant-evidence.spec.ts \
  src/lib/crm/intake-bant-next-step.spec.ts \
  src/lib/crm/intake-bant-checklist.spec.ts
cd ../ptt-crm-api && npx jest --testPathPattern=intake-definitions.util.spec --no-coverage
```

Expected: all PASS.

- [ ] **Step 3: Playwright** (skip nếu API local down)

```bash
cd services/ops-web && npx playwright test e2e/intake-bant-checklist-phase1.spec.ts
```

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/e2e/intake-bant-checklist-phase1.spec.ts \
  docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md \
  docs/superpowers/specs/2026-08-30-intake-bant-checklist-phase1-design.md
git commit -m "test(crm): cover BANT checklist Phase 1 and update AM guide"
```

---

## Spec coverage

| Spec | Task |
|------|------|
| G1 gỡ radio | 5 |
| G2 `bant_key` + chip | 3, 4 |
| G3 điểm drawer (đã ship) | — giữ; 5 không thêm radio |
| G4 bước tiếp | 2, 6 |
| G5 copy Tư vấn | 1, 6 footer, 7 docs |
| G6 warn evidence | 2, 6 |
| G7 ngưỡng/gate | Global — không đụng |
| §4 map + skip domain | 3 |
| §5.3 CTA tab | 6 |
| §8 U1–U4 | 7 (+ unit U4 consult) |
| Chip kit “Còn thiếu để Go” | không đổi |

## Placeholder scan

Không TBD. Mọi signature/helper đã đặt tên. Commit message từng task sẵn.

## Type consistency

- `BantKey` / `BANT_KEYS` không đổi.
- `bant_key` optional trên API + `IntakeQuestionItem`.
- `nextBantStep` `cta` null | discovery | qualify — panel không gọi `win_intel`.
- `gapToConsultLabel` không thay `gapToGo`.

# Canopy Vivid Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa tín hiệu việc nhiều màu của bản Canopy final lên ops-web (chip, cột kanban, 1 CTA/card, KPI strip) — không đụng lại sidebar sage đã ship.

**Architecture:** Overlay CSS trong `bitrix-theme.css` (`html.ops-shell-bitrix`) + helper thuần TypeScript. Không file CSS mới. Không viết lại markup shell. Markup mới chỉ ở KPI strip trên trang lead.

**Tech Stack:** Next.js ops-web, Vitest, CSS overlay.

**Spec / source of truth:** [`docs/design/rnosai-canopy-final-demo.html`](../../design/rnosai-canopy-final-demo.html) — tab Nguyên tắc + tab Workspace.

**Baseline đã ship trên `origin/main` (không làm lại):**
- Sidebar sage kính `#5c8a6c → #4a7c5c → #3a6850`, icon nét trắng, nhóm kính Chuẩn bị / Vận hành — `f4b0c187`
- Chrome gọn, `--ops-chrome-h`, next-action sibling sau `</header>` trong `.ops-chrome-head`
- P1 tokens / P2 login + job nav / P3 kanban 1 CTA / P4 lead rail

---

## Global Constraints

- Selector overlay giữ `html.ops-shell-bitrix`. Không tạo CSS file mới.
- CTA brand chỉ `#17692f` / hover `#114d24`. Một CTA PTT mỗi khung chrome. Ghost = phụ.
- Màu nóng / sky / iris / gold / won chỉ trên chip, band card, 1 nút việc, KPI top-border — không tô sidebar, không tô tường trang.
- Icon sidebar: nét trắng 1.65 — không fill nhiều màu trên menu.
- Không `next build` trên VPS (RAM ~3.3Gi). Build local, rsync `.next/standalone` + `.next/static`.
- Copy UI tiếng Việt. Commit chỉ khi user yêu cầu.
- Không regress breadcrumb: next-action không `position: fixed` dưới topbar.

---

## File map

```
Create:
  services/ops-web/src/lib/crm/work-signals.ts
  services/ops-web/src/lib/crm/work-signals.spec.ts
  services/ops-web/src/lib/crm/lead-signal-kpis.ts
  services/ops-web/src/lib/crm/lead-signal-kpis.spec.ts
  services/ops-web/src/components/crm/LeadSignalKpiStrip.tsx

Modify:
  services/ops-web/src/lib/crm/kanban-card-cta.ts
  services/ops-web/src/lib/crm/kanban-card-cta.spec.ts
  services/ops-web/src/components/crm/LeadKanbanBoard.tsx
  services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx
  services/ops-web/src/app/bitrix-theme.css
  services/ops-web/src/components/crm/LeadPropertyRail.tsx
  services/ops-web/src/lib/crm/lead-property-rows.ts
  services/ops-web/src/lib/crm/lead-property-rows.spec.ts
  services/ops-web/src/components/OpsNav.tsx
```

Không đụng: `layout.tsx` import, `nav-icons.tsx` stroke, login split (đã cream), chrome ResizeObserver.

---

### Task 1: Work-signal tokens (hợp đồng màu)

**Files:**
- Create: `services/ops-web/src/lib/crm/work-signals.ts`
- Create: `services/ops-web/src/lib/crm/work-signals.spec.ts`
- Modify: `services/ops-web/src/app/bitrix-theme.css` (khối `:root` / `html.ops-shell-bitrix` dòng ~13–40)

**Interfaces:**
- Consumes: hex từ demo final (`--hot` `#e11d48`, `--warm` `#ea580c`, `--gold` `#ca8a04`, `--sky` `#0284c7`, `--iris` `#7c3aed`, `--won` `#059669`)
- Produces: `WORK_SIGNALS` — object `as const` để Task 2–5 import, không tự bịa hex

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { WORK_SIGNALS } from './work-signals';

describe('WORK_SIGNALS', () => {
  it('locks Canopy final work-signal hex', () => {
    expect(WORK_SIGNALS).toEqual({
      ptt: '#17692f',
      pttDeep: '#114d24',
      hot: '#e11d48',
      warm: '#ea580c',
      gold: '#ca8a04',
      sky: '#0284c7',
      iris: '#7c3aed',
      won: '#059669',
      cold: '#94a3b8',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/work-signals.spec.ts`

Expected: FAIL — `Cannot find module './work-signals'`

- [ ] **Step 3: Write minimal implementation**

```ts
export const WORK_SIGNALS = {
  ptt: '#17692f',
  pttDeep: '#114d24',
  hot: '#e11d48',
  warm: '#ea580c',
  gold: '#ca8a04',
  sky: '#0284c7',
  iris: '#7c3aed',
  won: '#059669',
  cold: '#94a3b8',
} as const;

export type WorkSignalKey = keyof typeof WORK_SIGNALS;
```

Trong `html.ops-shell-bitrix` thêm / đổi đúng hex (giữ `--ptt` / `--ptt-deep` / `--cream` / `--paper` như đang có). Đổi `--gold` từ `#a67c1a` → `#ca8a04`. Thêm:

```css
html.ops-shell-bitrix {
  --hot: #e11d48;
  --warm: #ea580c;
  --gold: #ca8a04;
  --sky: #0284c7;
  --iris: #7c3aed;
  --won: #059669;
  --cold: #94a3b8;
}
```

`var(--gold)` hiện không được dùng ở ops-web — đổi an toàn.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/crm/work-signals.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/lib/crm/work-signals.ts \
  services/ops-web/src/lib/crm/work-signals.spec.ts \
  services/ops-web/src/app/bitrix-theme.css
git commit -m "$(cat <<'EOF'
feat(ops-web): lock Canopy work-signal color tokens

EOF
)"
```

---

### Task 2: Stage sets + CTA kind `quote` + accent helper

**Files:**
- Modify: `services/ops-web/src/lib/crm/kanban-card-cta.ts`
- Modify: `services/ops-web/src/lib/crm/kanban-card-cta.spec.ts`

**Interfaces:**
- Consumes: `WORK_SIGNALS` từ Task 1
- Produces:
  - `KANBAN_STAGE_SETS`: `{ early, consult, quote, won }` — mỗi value là `ReadonlySet<string>`
  - `KanbanCardCta.kind`: `'call' | 'intake' | 'quote' | 'lead' | 'hub'`
  - `kanbanStageAccent(status: string): string` — trả hex
  - `kanbanCardCta(...)` — stage quote trả `kind: 'quote'` (không còn `'lead'`)

- [ ] **Step 1: Write the failing tests** (thêm vào spec hiện có)

```ts
import { kanbanCardCta, kanbanStageAccent, KANBAN_STAGE_SETS } from './kanban-card-cta';
import { WORK_SIGNALS } from './work-signals';

it('marks quote-stage CTA as quote kind', () => {
  expect(kanbanCardCta({ id: 5, phone: '0900', status: 'bao_gia' })).toEqual({
    href: '/crm/leads/5',
    label: 'Đề xuất',
    kind: 'quote',
  });
});

it('maps stage accents to work signals', () => {
  expect(kanbanStageAccent('moi')).toBe(WORK_SIGNALS.ptt);
  expect(kanbanStageAccent('dang_tu_van')).toBe(WORK_SIGNALS.sky);
  expect(kanbanStageAccent('bao_gia')).toBe(WORK_SIGNALS.gold);
  expect(kanbanStageAccent('won')).toBe(WORK_SIGNALS.won);
  expect(kanbanStageAccent('lost')).toBe(WORK_SIGNALS.cold);
});

it('exposes shared stage sets', () => {
  expect(KANBAN_STAGE_SETS.consult.has('hen_gap')).toBe(true);
  expect(KANBAN_STAGE_SETS.quote.has('proposal')).toBe(true);
});
```

Sửa test cũ `sends quote-stage leads to the proposal record` — `kind` phải là `'quote'`, không assert `label` rồi thôi.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/kanban-card-cta.spec.ts`

Expected: FAIL — `kanbanStageAccent` / `KANBAN_STAGE_SETS` not exported; `kind` vẫn `'lead'`

- [ ] **Step 3: Write minimal implementation**

Export các `Set` hiện có (`EARLY`, `CONSULT`, `QUOTE`, `WON`) thành:

```ts
export const KANBAN_STAGE_SETS = {
  early: EARLY,
  consult: CONSULT,
  quote: QUOTE,
  won: WON,
} as const;
```

Đổi type:

```ts
export type KanbanCardCta = {
  href: string;
  label: string;
  kind: 'call' | 'intake' | 'quote' | 'lead' | 'hub';
};
```

Trong `kanbanCardCta`, nhánh QUOTE:

```ts
if (QUOTE.has(status)) {
  return { href: `/crm/leads/${lead.id}`, label: 'Đề xuất', kind: 'quote' };
}
```

Thêm:

```ts
import { WORK_SIGNALS } from './work-signals';

export function kanbanStageAccent(status: string): string {
  if (KANBAN_STAGE_SETS.consult.has(status)) return WORK_SIGNALS.sky;
  if (KANBAN_STAGE_SETS.quote.has(status)) return WORK_SIGNALS.gold;
  if (KANBAN_STAGE_SETS.won.has(status)) return WORK_SIGNALS.won;
  if (status === 'lost' || status === 'pending_cleanup') return WORK_SIGNALS.cold;
  return WORK_SIGNALS.ptt;
}
```

Xóa `STAGE_ACCENT` khỏi `LeadKanbanBoard.tsx` ở Task 3 — Task 2 chưa đụng TSX.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/crm/kanban-card-cta.spec.ts`

Expected: PASS (mọi case cũ + mới)

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/lib/crm/kanban-card-cta.ts \
  services/ops-web/src/lib/crm/kanban-card-cta.spec.ts
git commit -m "$(cat <<'EOF'
feat(ops-web): map kanban stage accents and quote CTA kind

EOF
)"
```

---

### Task 3: KPI helper (Nóng / Tư vấn / AI đề xuất / Won tuần)

**Files:**
- Create: `services/ops-web/src/lib/crm/lead-signal-kpis.ts`
- Create: `services/ops-web/src/lib/crm/lead-signal-kpis.spec.ts`

**Interfaces:**
- Consumes: `KANBAN_STAGE_SETS` từ Task 2; `LeadRow` pick `ai_band | status | received_at | created_at`
- Produces: `leadSignalKpis(rows, now?)` → `LeadSignalKpi[]` đúng 4 phần tử, thứ tự cố định

```ts
export type LeadSignalKpiKey = 'hot' | 'consult' | 'ai' | 'won';

export type LeadSignalKpi = {
  key: LeadSignalKpiKey;
  label: string;
  count: number;
};
```

Quy ước đếm (khóa với demo Workspace):
- `hot`: `ai_band === 'hot'`
- `consult`: `status` ∈ `KANBAN_STAGE_SETS.consult`
- `ai`: `status` ∈ `KANBAN_STAGE_SETS.quote` (nhãn **AI đề xuất**)
- `won`: `status` ∈ `KANBAN_STAGE_SETS.won` và ngày (`received_at` rồi fallback `created_at`) ≥ `now - 7 ngày`

Một lead có thể vào nhiều ô (hot + consult). Không exclusive — KPI là tín hiệu, không funnel.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { leadSignalKpis } from './lead-signal-kpis';

const now = new Date('2026-08-25T12:00:00.000Z');

describe('leadSignalKpis', () => {
  it('counts four work signals in demo order', () => {
    const kpis = leadSignalKpis(
      [
        { ai_band: 'hot', status: 'moi', received_at: '2026-08-24T00:00:00.000Z', created_at: '2026-08-24T00:00:00.000Z' },
        { ai_band: 'warm', status: 'dang_tu_van', received_at: '2026-08-20T00:00:00.000Z', created_at: '2026-08-20T00:00:00.000Z' },
        { ai_band: null, status: 'bao_gia', received_at: '2026-08-22T00:00:00.000Z', created_at: '2026-08-22T00:00:00.000Z' },
        { ai_band: null, status: 'won', received_at: '2026-08-24T00:00:00.000Z', created_at: '2026-08-01T00:00:00.000Z' },
        { ai_band: null, status: 'won', received_at: '2026-08-01T00:00:00.000Z', created_at: '2026-08-01T00:00:00.000Z' },
      ],
      now,
    );
    expect(kpis.map((k) => [k.key, k.label, k.count])).toEqual([
      ['hot', 'Nóng — gọi ngay', 1],
      ['consult', 'Chờ tư vấn', 1],
      ['ai', 'AI đề xuất', 1],
      ['won', 'Won tuần này', 1],
    ]);
  });

  it('returns zeros for empty rows', () => {
    expect(leadSignalKpis([], now).every((k) => k.count === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-signal-kpis.spec.ts`

Expected: FAIL — module missing

- [ ] **Step 3: Write minimal implementation**

```ts
import type { LeadRow } from '@/lib/api';
import { KANBAN_STAGE_SETS } from './kanban-card-cta';

export type LeadSignalKpiKey = 'hot' | 'consult' | 'ai' | 'won';

export type LeadSignalKpi = {
  key: LeadSignalKpiKey;
  label: string;
  count: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function leadWhen(row: Pick<LeadRow, 'received_at' | 'created_at'>): number {
  const raw = row.received_at || row.created_at;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

export function leadSignalKpis(
  rows: Array<Pick<LeadRow, 'ai_band' | 'status' | 'received_at' | 'created_at'>>,
  now: Date = new Date(),
): LeadSignalKpi[] {
  const weekStart = now.getTime() - WEEK_MS;
  let hot = 0;
  let consult = 0;
  let ai = 0;
  let won = 0;
  for (const row of rows) {
    const status = String(row.status ?? 'moi');
    if (row.ai_band === 'hot') hot += 1;
    if (KANBAN_STAGE_SETS.consult.has(status)) consult += 1;
    if (KANBAN_STAGE_SETS.quote.has(status)) ai += 1;
    if (KANBAN_STAGE_SETS.won.has(status) && leadWhen(row) >= weekStart) won += 1;
  }
  return [
    { key: 'hot', label: 'Nóng — gọi ngay', count: hot },
    { key: 'consult', label: 'Chờ tư vấn', count: consult },
    { key: 'ai', label: 'AI đề xuất', count: ai },
    { key: 'won', label: 'Won tuần này', count: won },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-signal-kpis.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/lib/crm/lead-signal-kpis.ts \
  services/ops-web/src/lib/crm/lead-signal-kpis.spec.ts
git commit -m "$(cat <<'EOF'
feat(ops-web): count lead work-signal KPIs

EOF
)"
```

---

### Task 4: Kanban board — accent + CTA kind class

**Files:**
- Modify: `services/ops-web/src/components/crm/LeadKanbanBoard.tsx`
- Modify: `services/ops-web/src/app/bitrix-theme.css` (khối `.crm-kanban-*` ~680–834)

**Interfaces:**
- Consumes: `kanbanStageAccent`, `kanbanCardCta` (`kind` gồm `quote`)
- Produces: cột `--kanban-accent` từ helper; CTA class `crm-kanban-card__cta crm-kanban-card__cta--${kind}`; band CSS dùng `--hot` / `--warm` / `--cold` (không còn xanh PTT cho hot)

- [ ] **Step 1: Write the failing visual contract** — không có RTL component test sẵn. Thêm 1 unit assert gián tiếp: `kanbanStageAccent` đã khóa ở Task 2. Task này đổi TSX + CSS. Verify bằng vitest helpers đã xanh + grep class.

- [ ] **Step 2: Confirm current board still uses local `STAGE_ACCENT`**

Run: `rg "STAGE_ACCENT" services/ops-web/src/components/crm/LeadKanbanBoard.tsx`

Expected: match (xóa ở bước 3)

- [ ] **Step 3: Write minimal implementation**

Xóa object `STAGE_ACCENT` (dòng ~9–21). Import:

```ts
import { kanbanCardCta, kanbanStageAccent } from '@/lib/crm/kanban-card-cta';
```

Cột:

```tsx
style={{ ['--kanban-accent' as string]: kanbanStageAccent(stage) }}
```

CTA (thay `const ctaClass = 'btn btn-sm crm-kanban-card__cta'`):

```tsx
const ctaClass = `btn btn-sm crm-kanban-card__cta crm-kanban-card__cta--${cta.kind}`;
```

Trong `bitrix-theme.css` thay band + chip + CTA (selector luôn kèm `html.ops-shell-bitrix` khi override):

```css
html.ops-shell-bitrix .crm-kanban-card--hot { border-left-color: var(--hot); }
html.ops-shell-bitrix .crm-kanban-card--warm { border-left-color: var(--warm); }
html.ops-shell-bitrix .crm-kanban-card--cold { border-left-color: var(--cold); }

html.ops-shell-bitrix .crm-kanban-card__chip--hot {
  background: #ffe4e6;
  color: #9f1239;
}
html.ops-shell-bitrix .crm-kanban-card__chip--warm {
  background: #ffedd5;
  color: #9a3412;
}
html.ops-shell-bitrix .crm-kanban-card__chip--cold {
  background: #f1f5f9;
  color: #475569;
}
html.ops-shell-bitrix .crm-kanban-card__chip--ai {
  background: #ede9fe;
  color: #5b21b6;
}
html.ops-shell-bitrix .crm-kanban-card__chip--sla {
  background: #ffe4e6;
  color: #9f1239;
}

html.ops-shell-bitrix .crm-kanban-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 22px rgba(28, 34, 29, 0.08);
}

html.ops-shell-bitrix .crm-kanban-card__cta--call {
  background: var(--hot);
  border-color: var(--hot);
  color: #fff;
}
html.ops-shell-bitrix .crm-kanban-card__cta--intake {
  background: var(--sky);
  border-color: var(--sky);
  color: #fff;
}
html.ops-shell-bitrix .crm-kanban-card__cta--quote {
  background: var(--gold);
  border-color: var(--gold);
  color: #fff;
}
html.ops-shell-bitrix .crm-kanban-card__cta--hub {
  background: var(--won);
  border-color: var(--won);
  color: #fff;
}
html.ops-shell-bitrix .crm-kanban-card__cta--lead {
  background: var(--ptt);
  border-color: var(--ptt);
  color: #fff;
}

html.ops-shell-bitrix .crm-kanban-column__head {
  background: color-mix(in srgb, var(--kanban-accent) 12%, #fffdf8);
}
```

Giữ 1 CTA/card. Không thêm nút thứ hai.

`SalesPipelineFunnelPanel` dùng cùng class chip/band — tự nhận màu mới, không sửa TSX trừ khi band vẫn xanh vì rule không có prefix. Rule mới `html.ops-shell-bitrix .crm-kanban-card--hot` phải thắng rule cũ không prefix (xóa hoặc đồng bộ rule không prefix cùng hex).

- [ ] **Step 4: Run helper tests**

Run: `cd services/ops-web && npx vitest run src/lib/crm/kanban-card-cta.spec.ts src/lib/crm/work-signals.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/components/crm/LeadKanbanBoard.tsx \
  services/ops-web/src/app/bitrix-theme.css
git commit -m "$(cat <<'EOF'
feat(ops-web): color kanban bands, chips, and one job CTA

EOF
)"
```

---

### Task 5: KPI strip trên trang lead

**Files:**
- Create: `services/ops-web/src/components/crm/LeadSignalKpiStrip.tsx`
- Modify: `services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx` (sau `PageToolbar`, trước `.bitrix-view-tabs`)
- Modify: `services/ops-web/src/app/bitrix-theme.css`

**Interfaces:**
- Consumes: `leadSignalKpis(rows)` từ Task 3 — `rows` là state list hiện tại (không gọi API mới)
- Produces: `LeadSignalKpiStrip` — 4 ô, `data-testid="lead-signal-kpis"`

Luật 1 CTA PTT: strip không có button. Click ô không filter (YAGNI). Chỉ đọc.

- [ ] **Step 1: Write the failing test** — helper đã cover count. Component thuần render:

```tsx
import type { LeadSignalKpi } from '@/lib/crm/lead-signal-kpis';

export function LeadSignalKpiStrip({ items }: { items: LeadSignalKpi[] }) {
  return (
    <div className="lead-signal-kpis" data-testid="lead-signal-kpis">
      {items.map((item) => (
        <div key={item.key} className={`lead-signal-kpi lead-signal-kpi--${item.key}`}>
          <b>{item.count}</b>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
```

Không cần test file riêng nếu không có RTL setup cho component này. Verify: `rg lead-signal-kpis services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx` sau khi wire.

- [ ] **Step 2: Confirm KPI strip is absent**

Run: `rg "lead-signal-kpis" services/ops-web/src`

Expected: no match

- [ ] **Step 3: Wire page + CSS**

Trong `CrmLeadsPageContent`:

```ts
import { leadSignalKpis } from '@/lib/crm/lead-signal-kpis';
import { LeadSignalKpiStrip } from '@/components/crm/LeadSignalKpiStrip';

const signalKpis = useMemo(() => leadSignalKpis(rows), [rows]);
```

Render ngay dưới `</PageToolbar>`:

```tsx
<LeadSignalKpiStrip items={signalKpis} />
```

CSS (khớp demo `.kpis`):

```css
html.ops-shell-bitrix .lead-signal-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin: 0 0 10px;
}
html.ops-shell-bitrix .lead-signal-kpi {
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 12px;
  border-top: 3px solid var(--ptt);
}
html.ops-shell-bitrix .lead-signal-kpi b {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-strong);
}
html.ops-shell-bitrix .lead-signal-kpi span {
  display: block;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--muted);
}
html.ops-shell-bitrix .lead-signal-kpi--hot { border-top-color: var(--hot); }
html.ops-shell-bitrix .lead-signal-kpi--consult { border-top-color: var(--sky); }
html.ops-shell-bitrix .lead-signal-kpi--ai { border-top-color: var(--iris); }
html.ops-shell-bitrix .lead-signal-kpi--won { border-top-color: var(--won); }

@media (max-width: 900px) {
  html.ops-shell-bitrix .lead-signal-kpis {
    grid-template-columns: 1fr 1fr;
  }
}
```

Không nhét strip vào `PageToolbar` (toolbar phải một hàng title + meta + nút).

- [ ] **Step 4: Run KPI + CTA tests**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-signal-kpis.spec.ts src/lib/crm/kanban-card-cta.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/components/crm/LeadSignalKpiStrip.tsx \
  services/ops-web/src/app/crm/leads/CrmLeadsPageContent.tsx \
  services/ops-web/src/app/bitrix-theme.css
git commit -m "$(cat <<'EOF'
feat(ops-web): show lead work-signal KPI strip

EOF
)"
```

---

### Task 6: Lead rail — Band là chip, không plain text

**Files:**
- Modify: `services/ops-web/src/lib/crm/lead-property-rows.ts`
- Modify: `services/ops-web/src/lib/crm/lead-property-rows.spec.ts`
- Modify: `services/ops-web/src/components/crm/LeadPropertyRail.tsx`

**Interfaces:**
- Consumes: `leadPropertyRows` hiện trả `{ key, label, value: string }`
- Produces: thêm optional `tone?: 'hot' | 'warm' | 'cold'` khi `key === 'band'`

- [ ] **Step 1: Write the failing test**

Trong `lead-property-rows.spec.ts` (case `ai_band: 'hot'` đã có):

```ts
expect(rows.find((r) => r.key === 'band')).toEqual({
  key: 'band',
  label: 'Band',
  value: 'Nóng',
  tone: 'hot',
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-property-rows.spec.ts`

Expected: FAIL — object thiếu `tone`

- [ ] **Step 3: Write minimal implementation**

Mở rộng type row:

```ts
export type LeadPropertyRow = {
  key: string;
  label: string;
  value: string;
  tone?: 'hot' | 'warm' | 'cold';
};
```

Khi push band:

```ts
...(band
  ? [{ key: 'band', label: 'Band', value: band, tone: lead.ai_band ?? undefined }]
  : []),
```

Trong rail, `dd` của row có `tone`:

```tsx
<dd>
  {row.tone ? (
    <span className={`crm-kanban-card__chip crm-kanban-card__chip--${row.tone}`}>
      {row.value}
    </span>
  ) : (
    row.value
  )}
</dd>
```

Reuse chip CSS Task 4 — không invent class mới.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ops-web && npx vitest run src/lib/crm/lead-property-rows.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/lib/crm/lead-property-rows.ts \
  services/ops-web/src/lib/crm/lead-property-rows.spec.ts \
  services/ops-web/src/components/crm/LeadPropertyRail.tsx
git commit -m "$(cat <<'EOF'
feat(ops-web): render lead band as a work-signal chip

EOF
)"
```

---

### Task 7: Footer sidebar — Cài đặt

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx` (`.ops-sidebar-footer` ~765–775)

**Interfaces:**
- Consumes: `NavIcon`, `iconForHref`, `navigateTo` / `Link` đã có trong file
- Produces: link **Cài đặt** → `/admin` (cùng footer với nút thu gọn). Chỉ hiện khi expanded. Collapsed: giữ toggle.

Luật demo: hamburger + PTT CRM · nhóm kính · Cài đặt đáy. Toggle thu gọn giữ nguyên — không thay bằng Cài đặt.

- [ ] **Step 1: Confirm footer has toggle only**

Run: `rg "Cài đặt" services/ops-web/src/components/OpsNav.tsx`

Expected: no match

- [ ] **Step 2: No unit test for nav chrome** — visual + grep

- [ ] **Step 3: Write minimal implementation**

Trong `.ops-sidebar-footer` khi `sidebarExpanded`, thêm trước toggle:

```tsx
<button
  type="button"
  className="ops-nav-link"
  onClick={() => navigateTo('/admin')}
>
  <span className="ops-nav-link-icon">
    <NavIcon name={iconForHref('/admin')} />
  </span>
  <span>Cài đặt</span>
</button>
```

Nếu `iconForHref('/admin')` không map, dùng icon settings đã có trong `nav-icons.tsx` (gear). Không tô màu icon — CSS sidebar đã `currentColor` trắng.

Không thêm Cài đặt vào nhóm kính. Không đổi hamburger brand.

- [ ] **Step 4: Typecheck the file**

Run: `cd services/ops-web && npx tsc --noEmit --pretty false 2>&1 | head -40`

Expected: không error mới từ `OpsNav.tsx`

- [ ] **Step 5: Commit** — chỉ khi user yêu cầu

```bash
git add services/ops-web/src/components/OpsNav.tsx
git commit -m "$(cat <<'EOF'
feat(ops-web): add Cài đặt to expanded sidebar footer

EOF
)"
```

---

### Task 8: Verify + QA cổng (không deploy trừ khi user bảo)

**Files:** không tạo file mới

- [ ] **Step 1: Run the full helper suite**

Run:

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/work-signals.spec.ts \
  src/lib/crm/kanban-card-cta.spec.ts \
  src/lib/crm/lead-signal-kpis.spec.ts \
  src/lib/crm/lead-property-rows.spec.ts
```

Expected: all PASS

- [ ] **Step 2: Overlay-only check**

Run: `rg "bitrix-theme" services/ops-web/src/app/layout.tsx`

Expected: vẫn import `./bitrix-theme.css` — không có file CSS Canopy thứ hai

- [ ] **Step 3: Browser / local checklist** (dev server nếu đang chạy)

1. `/crm/b2b/leads` kanban: cột Tư vấn sky, Đề xuất gold, Won emerald; card hot band rose; 1 CTA màu theo kind
2. KPI 4 ô trên toolbar, không đẩy title xuống 2 hàng
3. Breadcrumb + next-action không chồng
4. Lead detail: Band chip hồng/cam, không text thuần
5. Sidebar vẫn sage, icon trắng, **không** mint neon `#62b072`, **không** rừng đen `#0d3a22`
6. `/login` vẫn cream + form giấy — không regress P2
7. Một nút PTT trên toolbar lead (`+ Tạo lead`)

- [ ] **Step 4: Deploy** — chỉ khi user nói commit + deploy. Quy trình cũ: push → `npm run build` local với `NEXT_PUBLIC_PTT_API_URL=https://rs.pttads.vn` → rsync standalone/static → VPS `git pull --ff-only` + `ops_web_publish_release` + `systemctl restart ptt-ops-web` → `/login` 200

- [ ] **Step 5: Commit** — gộp hoặc từng task, chỉ khi user yêu cầu

---

## Ngoài phạm vi (cố ý)

- Search chips `GlobalSearchBar` làm topbar cao — chrome đã đo `--ops-chrome-h`; không redesign search trong plan này
- Clone Bitrix tím / sidebar neon vivid-demo cũ (`rnosai-canopy-vivid-demo.html`) — **không** dùng
- Viết lại markup lead detail / kanban card structure
- Filter khi click KPI
- Commit file demo HTML (untracked) trừ khi user bảo commit docs

---

## Self-review

| Luật demo | Task |
|---|---|
| PTT chỉ CTA / focus / logo | 1, 4 (`--lead` CTA), 5 (không nút trên KPI) |
| Sage sidebar, icon trắng | baseline — Task 7 không tô màu icon |
| Tín hiệu việc trên chip / band / 1 nút | 4, 6 |
| Header trang gọn, list/kanban chiếm màn | 5 strip dưới toolbar, không trong toolbar |
| Next-action mỏng, không đè breadcrumb | không đụng chrome |
| Overlay `bitrix-theme.css`, không rewrite shell | 1, 4, 5, 7 |

Không TBD. Tên `kind: 'quote'` / `LeadSignalKpiKey` / `WORK_SIGNALS` nhất quán giữa task.

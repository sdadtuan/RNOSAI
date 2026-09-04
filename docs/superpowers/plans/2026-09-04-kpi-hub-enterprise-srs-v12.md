# KPI Hub Enterprise SRS v1.2 — Implementation Plan (toàn bộ)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan **theo từng wave**, task-by-task. Steps dùng checkbox (`- [ ]`). **Không** implement nhiều wave trong một PR.

**Goal:** Cắm đủ SRS v1.2 vào ops-web: 3 Command Center (A) + catalog dự án PTT/Delivery (B) + ngân sách (C) + KPI Dictionary trên dự án (D) + điều hành sau Active (E). Một app, một login, không SaaS thứ hai.

**Architecture:** Command Center chỉ **đọc** `crm_kpi_facts` + alert/quality/approval Hub đã có. Delivery là header `crm_delivery_projects` 1:0..1 `crm_b2b_projects`; lead **không** đổi `b2b_project_id`. Budget/KPI/risk là bảng con. UI = `KpiHubShell` + class `kpi-hub-*` / `delivery-*`.

**Tech Stack:** Nest `ptt-crm-api` (Jest), Next.js 14 ops-web (Vitest + Playwright), PostgreSQL, CSS `globals.css` (không Tailwind).

**Spec:** [`docs/superpowers/specs/2026-09-04-kpi-hub-enterprise-rnosai-srs.md`](../specs/2026-09-04-kpi-hub-enterprise-rnosai-srs.md) v1.2.

**Plan con (chi tiết TDD Wave B — không copy lại):** [`2026-09-04-kpi-hub-delivery-wave-b.md`](./2026-09-04-kpi-hub-delivery-wave-b.md)

**Worktree lúc implement:** `superpowers:using-git-worktrees` từ `main` sạch, **một worktree / một wave**.

## Global Constraints

- Một app ops-web. Không Tailwind. Không badge `PRODUCTION` giả. Không font mới. Primary `#17692f`. Warning `#c58a00`. Canvas `#F7F8FA`.
- Copy UI đúng SRS §11 (Tiếng Việt). Không gộp/bỏ widget — thiếu số thì `—` / empty / skeleton, **giữ khung**.
- Không `PTT_IWR_LLM` / `PTT_CSD_LLM`. Không đổi `/crm/kpi` cockpit. Không gộp `crm_re_projects`. Không drop `crm_b2b_projects`. Không đổi FK lead / webhook / `PTT_B2B_PROJECT_OS`.
- Dictionary code: `SAL_008` ≠ `FIN_001` ≠ `FIN_002`. `SAL_002` = SQL Rate — **không** dùng cho pipeline. Pipeline = `SAL_005`. CPL = `MKT_006`. Spend = `MKT_004`.
- Ratio: tổng tử / tổng mẫu trên filter (BR-E02). `DATA_ISSUE` / Delayed / Failed thắng badge Đạt (BR-E06).
- Tiền API = decimal string / `NUMERIC`. Optimistic lock `If-Match: row_version`.
- Cap mới: `crm_delivery_projects` view/edit/manage; `crm_delivery_budget` view/edit/approve. Không cấp `manage` Delivery cho mọi user có `crm_kpi_hub.view`.
- Forecast / AI Insight **ẩn** nếu chưa có model. Không bịa 91%.
- Mỗi wave xong: unit test PASS + e2e smoke + không regress `/crm/kpi`. Deploy VPS chỉ khi user yêu cầu.

## Thứ tự triển khai (khóa)

```text
F0  Chrome sidebar 3 nhóm + stub Approval/Audit + 308 /crm/kpi-hub
 │
 ├─ Wave A  Command Centers (không schema dự án)     ← song song được với B sau F0
 │
 └─ Wave B  Catalog + wizard B1–B3                   ← plan con
      ├─ Wave C  Ngân sách & nguồn lực (B4 + modal)
      ├─ Wave D  KPI dự án từ Dictionary (B5 + picker)
      └─ Wave E  Risk / CR / Capacity CRUD / Approval policy / Quality / lineage
```

**A và B độc lập sau F0.** Cần B xong mới C/D. E cần B (tab rỗng) + C nếu đụng budget CR.

**Sửa plan Wave B Task 5:** nếu F0/A đã land, **không** giữ mục `Dashboard` trong TỔNG QUAN. Chỉ **thêm** `Project Delivery` vào nhóm overview đã có 3 Command Center. Approval Center + Audit Log đã có từ F0 — đừng xóa.

## File map (toàn SRS)

| File | Wave | Role |
|------|------|------|
| `services/ops-web/src/lib/kpi-hub-nav.ts` + `KpiHubShell.tsx` | F0, A, B | Sidebar 3 nhóm |
| `services/ptt-crm-api/src/kpi-hub/command-center/command-center.util.ts` | A | Tile codes, bottleneck, delta, deal-risk, insight |
| `services/ptt-crm-api/src/kpi-hub/dashboard/kpi-hub-dashboard.service.ts` | A | `persona=` executive/marketing/sales |
| `services/ptt-crm-api/src/kpi-hub/facts/kpi-hub-facts.service.ts` | A | Thêm `MKT_009`, `SAL_005` vào compute nếu thiếu |
| `services/ops-web/src/app/crm/kpi-hub/executive/page.tsx` (+ marketing, sales) | A | 3 màn §11.1–11.3 |
| `services/ops-web/src/components/kpi-hub/command-center/*` | A | Tiles, funnel, trust, queue, exceptions |
| `services/ops-web/src/app/crm/kpi-hub/page.tsx` | F0 | 308 → executive |
| `services/ops-web/src/app/crm/kpi-hub/approvals/page.tsx` | F0/A, E | Pending list → policy |
| `services/ops-web/src/app/crm/kpi-hub/audit/page.tsx` | F0, E | Filter `crm_kpi_*` + delivery |
| `docs/specs/2026-09-04-postgresql-ddl-delivery-projects.sql` | B | Header + services/milestones |
| `docs/specs/2026-09-04-postgresql-ddl-delivery-budget.sql` | C | Budget/resources |
| `docs/specs/2026-09-04-postgresql-ddl-delivery-kpis.sql` | D | Project KPIs + target PROJECT |
| `docs/specs/2026-09-04-postgresql-ddl-delivery-ops.sql` | E | Risk, CR, capacity snapshot, quality |
| `services/ptt-crm-api/src/delivery-projects/**` | B–E | Module Nest |
| `services/ops-web/src/app/crm/delivery-projects/**` | B–E | Portfolio, wizard, detail |
| `services/ops-web/src/lib/delivery-projects-api.ts` | B–E | Client |
| `services/ptt-crm-api/src/kpi-hub/targets/kpi-hub-target-resolver.ts` | D | Scope `PROJECT` thắng |

## Out of scope mọi wave (reject PR)

App shell thứ hai, white-label, SCIM, multi-region, native mobile CRUD, AI/anomaly, Power BI embed, gộp bảng B2B, gộp BĐS, bật LLM, đổi `/crm/kpi` RAG, rewrite Service Delivery lifecycle.

---

# F0 — Chrome sidebar (chặn A và B)

### Task F1: Nhóm nav + 308 Dashboard + stub Approval / Audit

**Files:**
- Modify: `services/ops-web/src/lib/kpi-hub-nav.ts`
- Modify: `services/ops-web/src/lib/kpi-hub-nav.spec.ts`
- Modify: `services/ops-web/src/components/kpi-hub/KpiHubShell.tsx`
- Modify: `services/ops-web/src/app/crm/kpi-hub/page.tsx`
- Create: `services/ops-web/src/app/crm/kpi-hub/approvals/page.tsx`
- Create: `services/ops-web/src/app/crm/kpi-hub/audit/page.tsx`

**Interfaces:**
- Consumes: `KpiHubNavItem` hiện có
- Produces:
  - `export type KpiHubNavGroup = { id: string; label: string; items: KpiHubNavItem[] }`
  - `export const KPI_HUB_NAV_GROUPS: KpiHubNavGroup[]`
  - `export const KPI_HUB_NAV = KPI_HUB_NAV_GROUPS.flatMap((g) => g.items)`
  - `isKpiHubPath` / `activeKpiHubHref` vẫn đúng

- [ ] **Step 1: Đổi spec nav — FAIL**

```typescript
import { KPI_HUB_NAV_GROUPS, isKpiHubPath, activeKpiHubHref } from './kpi-hub-nav';

it('groups three headings with command centers and governance extras', () => {
  expect(KPI_HUB_NAV_GROUPS.map((g) => g.label)).toEqual(['TỔNG QUAN', 'GOVERNANCE', 'PHÂN TÍCH']);
  expect(KPI_HUB_NAV_GROUPS[0].items.map((i) => i.href)).toEqual([
    '/crm/kpi-hub/executive',
    '/crm/kpi-hub/marketing',
    '/crm/kpi-hub/sales',
  ]);
  expect(KPI_HUB_NAV_GROUPS[1].items.map((i) => i.href)).toContain('/crm/kpi-hub/approvals');
  expect(KPI_HUB_NAV_GROUPS[2].items.map((i) => i.href)).toEqual([
    '/crm/kpi-hub/reports',
    '/crm/kpi-hub/audit',
    '/crm/kpi-hub/settings',
  ]);
  expect(isKpiHubPath('/crm/kpi-hub/executive')).toBe(true);
  expect(activeKpiHubHref('/crm/kpi-hub/executive')).toBe('/crm/kpi-hub/executive');
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd services/ops-web && npx vitest run src/lib/kpi-hub-nav.spec.ts`

Expected: `KPI_HUB_NAV_GROUPS` is not exported.

- [ ] **Step 3: Implement groups + shell + 308 + stub pages**

`kpi-hub-nav.ts`:

```typescript
export type KpiHubNavIcon =
  | 'dashboard'
  | 'book'
  | 'target'
  | 'database'
  | 'shield'
  | 'chart'
  | 'gear'
  | 'inbox'
  | 'list';

export type KpiHubNavItem = {
  href: string;
  label: string;
  icon: KpiHubNavIcon;
};

export type KpiHubNavGroup = { id: string; label: string; items: KpiHubNavItem[] };

export const KPI_HUB_NAV_GROUPS: KpiHubNavGroup[] = [
  {
    id: 'overview',
    label: 'TỔNG QUAN',
    items: [
      { href: '/crm/kpi-hub/executive', label: 'Executive Command Center', icon: 'dashboard' },
      { href: '/crm/kpi-hub/marketing', label: 'Marketing Performance', icon: 'chart' },
      { href: '/crm/kpi-hub/sales', label: 'Sales Command Center', icon: 'target' },
    ],
  },
  {
    id: 'governance',
    label: 'GOVERNANCE',
    items: [
      { href: '/crm/kpi-hub/dictionary', label: 'KPI Dictionary', icon: 'book' },
      { href: '/crm/kpi-hub/targets', label: 'Target & Cảnh báo', icon: 'target' },
      { href: '/crm/kpi-hub/sources', label: 'Nguồn dữ liệu', icon: 'database' },
      { href: '/crm/kpi-hub/quality', label: 'Data Quality', icon: 'shield' },
      { href: '/crm/kpi-hub/approvals', label: 'Approval Center', icon: 'inbox' },
    ],
  },
  {
    id: 'analysis',
    label: 'PHÂN TÍCH',
    items: [
      { href: '/crm/kpi-hub/reports', label: 'Báo cáo', icon: 'chart' },
      { href: '/crm/kpi-hub/audit', label: 'Audit Log', icon: 'list' },
      { href: '/crm/kpi-hub/settings', label: 'Cài đặt', icon: 'gear' },
    ],
  },
];

export const KPI_HUB_NAV = KPI_HUB_NAV_GROUPS.flatMap((g) => g.items);

export function isKpiHubPath(pathname: string): boolean {
  return pathname === '/crm/kpi-hub' || pathname.startsWith('/crm/kpi-hub/');
}

export function activeKpiHubHref(pathname: string): string {
  const match = [...KPI_HUB_NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  return match?.href ?? '/crm/kpi-hub/executive';
}
```

`KpiHubShell`: map `KPI_HUB_NAV_GROUPS` — `<p className="kpi-hub-sidebar__group">{g.label}</p>` rồi links. Active = nền xanh nhạt + chữ `#17692f` + vạch trái. Header phải: ô tìm (placeholder prop `searchPlaceholder` optional, default `Tìm trong Hub…`) · Help · chuông · avatar chữ — **không** badge PRODUCTION. Icon `inbox`/`list`: thêm case trong `NavIcon` (hộp / 3 dòng).

`app/crm/kpi-hub/page.tsx` — server redirect:

```typescript
import { redirect } from 'next/navigation';

export default function KpiHubIndexPage() {
  redirect('/crm/kpi-hub/executive');
}
```

`approvals/page.tsx` và `audit/page.tsx`: `KpiHubPageGate` + `KpiHubShell` title `Approval Center` / `Audit Log`, subtitle đúng chữ, body empty `Chưa có mục chờ duyệt` / `Chưa có sự kiện` + `data-testid="hub-approvals"` / `hub-audit`. Wave A/E sẽ đổ data.

- [ ] **Step 4: Vitest PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/kpi-hub-nav.ts services/ops-web/src/lib/kpi-hub-nav.spec.ts \
  services/ops-web/src/components/kpi-hub/KpiHubShell.tsx \
  services/ops-web/src/app/crm/kpi-hub/page.tsx \
  services/ops-web/src/app/crm/kpi-hub/approvals/page.tsx \
  services/ops-web/src/app/crm/kpi-hub/audit/page.tsx
git commit -m "$(cat <<'EOF'
feat(kpi-hub): group sidebar and redirect dashboard to executive.

EOF
)"
```

---

# Wave A — Command Centers

**Done khi:** 3 route = layout §11.1–11.3 + số fact thật (hoặc `—`); freshness footer; e2e khối; `/crm/kpi` không đổi.

### Task A1: Pure util Command Center

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/command-center/command-center.util.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/command-center/command-center.util.spec.ts`

**Interfaces:**
- Consumes: `HubPerfStatus`, `FreshnessLevel` từ `kpi-hub-status.ts`
- Produces:
  - `export type CommandPersona = 'executive' | 'marketing' | 'sales'`
  - `export const EXEC_TILE_CODES = ['SAL_008','SAL_005','MKT_002','MKT_006','MKT_008','SAL_007'] as const`
  - `export const MKT_TILE_CODES = ['MKT_004','MKT_001','MKT_002','MKT_006','MKT_008','MKT_009'] as const`
  - `export const SALES_TILE_CODES = ['SAL_005','SAL_005W','SAL_001','SAL_003','SAL_007','SAL_008'] as const`
  - `export function tileCodesFor(persona: CommandPersona): readonly string[]`
  - `export function deltaPct(current: number | null, previous: number | null): number | null`
  - `export function applyDataIssuePrecedence(status: string, freshness: string, dqCritical: boolean): string`
  - `export function pickBottleneck(stages: Array<{ code: string; name: string; conversion: number | null; targetConversion: number | null; kpiStatus?: string }>): { code: string; label: string }`
  - `export function weightedPipeline(amount: number | null, probability: number | null): { value: number | null; weighted: boolean }`
  - `export function classifyDealRisk(input: { lastActivityAt: string | null; closeDate: string | null; todayIso: string; hasQuote: boolean; hasNextStep: boolean; stageAgeDays: number; noActivityDaysThreshold: number }): Array<'no_activity' | 'overdue_close' | 'stage_aging' | 'missing_quote' | 'missing_next_step'>`
  - `export function ruleBasedInsight(input: { spendDeltaPct: number | null; validDeltaPct: number | null }): string | null`

- [ ] **Step 1: Write failing tests**

```typescript
import {
  applyDataIssuePrecedence,
  classifyDealRisk,
  deltaPct,
  pickBottleneck,
  ruleBasedInsight,
  tileCodesFor,
  weightedPipeline,
} from './command-center.util';

describe('tileCodesFor', () => {
  it('executive uses SAL_008 and SAL_005 not SAL_002 or FIN_001', () => {
    expect(tileCodesFor('executive')).toEqual([
      'SAL_008', 'SAL_005', 'MKT_002', 'MKT_006', 'MKT_008', 'SAL_007',
    ]);
    expect(tileCodesFor('executive')).not.toContain('SAL_002');
    expect(tileCodesFor('executive')).not.toContain('FIN_001');
  });
});

describe('deltaPct', () => {
  it('returns null when either side missing', () => {
    expect(deltaPct(10, null)).toBeNull();
    expect(deltaPct(null, 10)).toBeNull();
    expect(deltaPct(110, 100)).toBe(10);
  });
});

describe('applyDataIssuePrecedence', () => {
  it('Failed or DQ critical beats ACHIEVED', () => {
    expect(applyDataIssuePrecedence('ACHIEVED', 'FAILED', false)).toBe('DATA_ISSUE');
    expect(applyDataIssuePrecedence('ACHIEVED', 'FRESH', true)).toBe('DATA_ISSUE');
    expect(applyDataIssuePrecedence('ACHIEVED', 'FRESH', false)).toBe('ACHIEVED');
  });
});

describe('pickBottleneck', () => {
  it('picks stage whose conversion misses target, not merely lowest volume', () => {
    const hit = pickBottleneck([
      { code: 'MKT_002', name: 'Valid', conversion: 0.8, targetConversion: 0.7 },
      { code: 'MKT_008', name: 'MQL Rate', conversion: 0.2, targetConversion: 0.35, kpiStatus: 'CRITICAL' },
    ]);
    expect(hit.code).toBe('MKT_008');
    expect(hit.label).toMatch(/MQL/);
  });
});

describe('weightedPipeline', () => {
  it('returns unweighted when probability missing', () => {
    expect(weightedPipeline(100, null)).toEqual({ value: 100, weighted: false });
    expect(weightedPipeline(100, 0.5)).toEqual({ value: 50, weighted: true });
  });
});

describe('classifyDealRisk', () => {
  it('flags rule-based risks', () => {
    const flags = classifyDealRisk({
      lastActivityAt: '2026-08-01',
      closeDate: '2026-09-01',
      todayIso: '2026-09-04',
      hasQuote: false,
      hasNextStep: false,
      stageAgeDays: 40,
      noActivityDaysThreshold: 14,
    });
    expect(flags).toEqual(expect.arrayContaining([
      'no_activity', 'overdue_close', 'missing_quote', 'missing_next_step', 'stage_aging',
    ]));
  });
});

describe('ruleBasedInsight', () => {
  it('hides when fewer than two deltas', () => {
    expect(ruleBasedInsight({ spendDeltaPct: null, validDeltaPct: 10 })).toBeNull();
    expect(ruleBasedInsight({ spendDeltaPct: 5, validDeltaPct: -10 })).toMatch(/Valid/);
  });
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd services/ptt-crm-api && npx jest src/kpi-hub/command-center/command-center.util.spec.ts --no-coverage`

- [ ] **Step 3: Minimal implementation**

`tileCodesFor`: switch 3 mảng const.  
`deltaPct`: nếu `previous == null || current == null || previous === 0` → `null`; else `round(((current - previous) / abs(previous)) * 1000) / 10`.  
`applyDataIssuePrecedence`: `FAILED` hoặc `dqCritical` → `'DATA_ISSUE'`; `DELAYED` không đổi status (UI hiện chip Delayed).  
`pickBottleneck`: stage có `kpiStatus === 'CRITICAL'` trước; không thì stage `conversion < targetConversion` lệch lớn nhất; không thì stage cuối. Label `Điểm nghẽn: {name}`.  
`weightedPipeline`: `probability == null` → `{ value: amount, weighted: false }`; else `{ value: amount * probability, weighted: true }` (null amount → `{ value: null, weighted: false }`).  
`classifyDealRisk`: no_activity nếu lastActivity > threshold ngày; overdue_close nếu closeDate < today; stage_aging nếu `stageAgeDays > 21`; missing_quote / missing_next_step theo boolean.  
`ruleBasedInsight`: cả hai delta khác null → câu `Chi tiêu {↑/↓} {n}% trong khi Valid Leads {↑/↓} {n}%.`; thiếu một phía → `null`.

- [ ] **Step 4: Jest PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/command-center
git commit -m "$(cat <<'EOF'
feat(kpi-hub): add command-center tile and risk utilities.

EOF
)"
```

### Task A2: Mở rộng fact codes + builder persona (pure)

**Files:**
- Modify: `services/ptt-crm-api/src/kpi-hub/facts/kpi-hub-facts.service.ts`
- Modify: `services/ptt-crm-api/src/kpi-hub/facts/kpi-hub-facts.service.spec.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/command-center/command-center.builder.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/command-center/command-center.builder.spec.ts`

**Interfaces:**
- Consumes: `tileCodesFor`, `deltaPct`, `applyDataIssuePrecedence`, `pickBottleneck`, `weightedPipeline`
- Produces:
  - `export type CommandTile = { code: string; name: string; actual: number | null; formatted: string; target: number | null; status: string; delta_pct: number | null; sparkline: number[]; freshness: string }`
  - `export type CommandCenterPayload` (tiles, series, at_risk, funnel, trust, approvals, exceptions, marketing?, sales?)
  - `export function buildCommandTiles(input: { persona: CommandPersona; facts: Map<string, number | null>; prevFacts: Map<string, number | null>; targets: Map<string, { target: number | null; warning: number | null; critical: number | null; direction: string; name: string }>; freshnessByCode: Map<string, string>; dqCritical: boolean; sparklines: Map<string, number[]>; format: (code: string, v: number | null) => string }): CommandTile[]`
  - Facts: thêm `MKT_009` ratio `{ numerator: 'SAL_008', denominator: 'MKT_004', blank_if_zero: true }` vào `RATIO_DEFS`. Thêm `SAL_005` query Open pipeline SUM `expected_value` leads không Won/Lost nếu chưa có. Export `COMMAND_FACT_CODES` = unique các tile + funnel codes.

Funnel codes:

```typescript
export const EXEC_FUNNEL = ['MKT_001', 'MKT_002', 'MKT_007', 'SAL_001', 'SAL_003', 'SAL_WON'] as const;
export const MKT_FUNNEL = ['MKT_IMP', 'MKT_CLK', 'MKT_001', 'MKT_002', 'MKT_007'] as const;
export const SALES_FUNNEL = ['MKT_007', 'SAL_001', 'SAL_003', 'SAL_PROP', 'SAL_NEG', 'SAL_WON'] as const;
```

`MKT_IMP` / `MKT_CLK` / `SAL_PROP` / `SAL_NEG`: nếu chưa có fact → stage `actual: null` (tab/khối vẫn render). **Không** bịa impression.

- [ ] **Step 1: Test builder + ratio MKT_009**

```typescript
import { buildCommandTiles } from './command-center.builder';

it('emits six executive tiles and blank actual as null not zero', () => {
  const tiles = buildCommandTiles({
    persona: 'executive',
    facts: new Map([['SAL_008', 1_240_000_000], ['MKT_002', null]]),
    prevFacts: new Map([['SAL_008', 1_000_000_000]]),
    targets: new Map([
      ['SAL_008', { target: 1_200_000_000, warning: null, critical: null, direction: 'HIGHER_IS_BETTER', name: 'Doanh thu kỳ mới' }],
      ['MKT_002', { target: 100, warning: null, critical: null, direction: 'HIGHER_IS_BETTER', name: 'Valid Leads' }],
    ]),
    freshnessByCode: new Map(),
    dqCritical: false,
    sparklines: new Map(),
    format: (_c, v) => (v == null ? '—' : String(v)),
  });
  expect(tiles).toHaveLength(6);
  expect(tiles[0].code).toBe('SAL_008');
  expect(tiles[0].delta_pct).toBe(24);
  expect(tiles.find((t) => t.code === 'MKT_002')?.formatted).toBe('—');
  expect(tiles.find((t) => t.code === 'MKT_002')?.actual).toBeNull();
});
```

Facts spec: thêm case `MKT_009` = `SAL_008 / MKT_004` (không avg daily).

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement builder + RATIO_DEFS.MKT_009 + COMMAND_FACT_CODES trong `computePeriod`**

`buildCommandTiles`: lặp `tileCodesFor(persona)`; `SAL_005W` đọc fact `SAL_005` + `weightedPipeline` nếu `facts.get('SAL_005_P')` có xác suất trung bình, không thì `weighted: false` và name `Pipeline có trọng số` + caller gắn badge. Status qua `deriveHubStatus` rồi `applyDataIssuePrecedence`. Sparkline = mảng ≥2 điểm hoặc `[]`.

Tên thẻ mặc định (override bằng target.name nếu có):

| code | name |
|------|------|
| SAL_008 | Doanh thu kỳ mới |
| SAL_005 | Pipeline đang mở |
| SAL_005W | Pipeline có trọng số |
| MKT_002 | Valid Leads |
| MKT_006 | CPL Valid Lead |
| MKT_008 | MQL Rate |
| SAL_007 | Win Rate |
| MKT_004 | Tổng chi tiêu |
| MKT_001 | Raw Leads |
| MKT_009 | ROAS |
| SAL_001 | SQL |
| SAL_003 | Cuộc hẹn hoàn thành |

- [ ] **Step 4: Jest PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/command-center services/ptt-crm-api/src/kpi-hub/facts
git commit -m "$(cat <<'EOF'
feat(kpi-hub): build persona tiles from facts without invented zeros.

EOF
)"
```

### Task A3: API dashboard persona + trust + approval queue

**Files:**
- Modify: `services/ptt-crm-api/src/kpi-hub/kpi-hub.types.ts` — `HubDashboardQuery.persona?: CommandPersona`
- Modify: `services/ptt-crm-api/src/kpi-hub/dashboard/kpi-hub-dashboard.service.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/dashboard/kpi-hub-dashboard.service.spec.ts` (nếu chưa có)
- Modify: `services/ptt-crm-api/src/kpi-hub/kpi-hub.controller.ts` — giữ `GET dashboard`, đọc `persona`
- Create: `services/ptt-crm-api/src/kpi-hub/command-center/command-center.trust.ts` + spec

**Interfaces:**
- Consumes: `KpiHubFactsService.getFactsMap`, `KpiHubTargetsService.list`, `KpiHubQualityService.getOverview`, `KpiHubAlertsService.list`, dictionary `status=PENDING_APPROVAL`, reports pending
- Produces: `GET /api/crm/kpi-hub/dashboard?persona=executive&from=&to=&compare=1`  
  Body:

```typescript
export type CommandCenterResponse = {
  persona: CommandPersona;
  period: { from: string; to: string; timezone: 'Asia/Ho_Chi_Minh'; compare: boolean };
  tiles: CommandTile[];
  series: { actual: Array<{ date: string; value: number | null }>; target: Array<{ date: string; value: number | null }>; forecast: null };
  at_risk: Array<{ id: string; severity: string; kpi_code: string; name: string; scope: string; actual: number | null; target: number | null; owner: string | null; sla_hours: number | null }>;
  funnel: { stages: Array<{ code: string; name: string; value: number | null; conversion_from_prev: number | null }>; bottleneck: { code: string; label: string } };
  trust: { score: number | null; sources: Array<{ system: string; status: string; last_success_at: string | null }> };
  approvals: { kpi_count: number; target_count: number; mapping_count: number; recent: Array<{ id: string; kind: string; label: string }> };
  exceptions: Array<{ id: string; priority: string; object: string; issue: string; impact: string; owner: string | null; sla: string | null; status: string }>;
  marketing?: {
    spend_series: Array<{ date: string; spend: number | null; valid_leads: number | null; cpl_target: number | null }>;
    channels: Array<{ channel: string; pct: number | null; spend: number | null; cpl: number | null }>;
    campaigns: Array<Record<string, unknown>>;
    creatives: Array<Record<string, unknown>>;
    insight: string | null;
    grain: { adset: boolean; creative: boolean; landing: boolean };
  };
  sales?: {
    pipeline_stacks: Array<{ stage: string; amount: number | null }>;
    sla: { actual_minutes: number | null; target_minutes: number; buckets: Record<string, number>; overdue_count: number };
    team_rows: Array<Record<string, unknown>>;
    deals_at_risk: Array<{ id: string; name: string; amount: number | null; flags: string[]; href: string }>;
    weighted_badge: 'weighted' | 'unweighted';
  };
};
```

`buildDataTrust(overview)`: `score` từ quality; sources map `CRM` / `META_ADS` / `SHAREPOINT` / `ERP` (và `GA4` cho marketing). Thiếu nguồn → hàng vẫn hiện `status: 'UNKNOWN'`.

`buildApprovalQueue({ dictionary, targets, reports })`: đếm `PENDING_APPROVAL`; `mapping_count` = dictionary Need Review thiếu mapping. `recent` tối đa 3.

Không `persona` → giữ payload dashboard cũ (không phá client hiện tại cho đến khi FE chuyển hết).

- [ ] **Step 1: Service spec**

```typescript
it('persona executive returns six tiles and hidden forecast', async () => {
  const svc = makeDashboardService(/* facts map SAL_008, quality score 88 */);
  const out = await svc.getDashboard({ persona: 'executive', from: '2026-09-01', compare: '1' });
  expect(out.persona).toBe('executive');
  expect(out.tiles).toHaveLength(6);
  expect(out.series.forecast).toBeNull();
  expect(out.trust.score).toBe(88);
});

it('rejects unknown persona with KPI_HUB_CODE_INVALID', async () => {
  await expect(svc.getDashboard({ persona: 'finance' as never })).rejects.toMatchObject({
    response: { error: 'KPI_HUB_CODE_INVALID' },
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `getDashboard` branch `if (query.persona)`** — BadRequest `KPI_HUB_CODE_INVALID` nếu không thuộc 3 persona. Guard giữ `StaffKpiHubViewGuard`. Sales deals: query leads open có `expected_value`, `last_activity_at`, `close_date` (cột/meta đã có); mask tên nếu thiếu `crm_leads.view` — dùng cap trên actor; không cap lead → `deals_at_risk: []` và SLA rows không PII. **Không** query Ads live.

Campaign grain: nếu fact không có dimension campaign → `campaigns: []`, `grain.adset/creative/landing = false`.

- [ ] **Step 4: Jest PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi-hub
git commit -m "$(cat <<'EOF'
feat(kpi-hub): serve executive marketing and sales command payloads.

EOF
)"
```

### Task A4: ops-web types + fetch + copy util

**Files:**
- Create: `services/ops-web/src/lib/command-center-types.ts`
- Modify: `services/ops-web/src/lib/kpi-hub-api.ts` — `fetchKpiHubCommandCenter(token, persona, filters)`
- Create: `services/ops-web/src/lib/command-center.util.ts` + `command-center.util.spec.ts` (copy `deltaPct`, `applyDataIssuePrecedence`, `tileCodesFor` — cùng signature A1)

- [ ] **Step 1: Vitest copy util** (cùng case A1 — `tileCodesFor('marketing')` gồm `MKT_009`)

- [ ] **Step 2: FAIL → implement → PASS**

- [ ] **Step 3: `fetchKpiHubCommandCenter`**

```typescript
export async function fetchKpiHubCommandCenter(
  token: string,
  persona: 'executive' | 'marketing' | 'sales',
  query: { from?: string; to?: string; compare?: boolean; department_id?: string; channel?: string; product?: string; team_id?: string },
) {
  return kpiHubFetch<CommandCenterResponse>(
    token,
    `${BASE}/dashboard${buildQuery({ persona, ...query, compare: query.compare ? '1' : undefined })}`,
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/lib/command-center-types.ts services/ops-web/src/lib/command-center.util.ts \
  services/ops-web/src/lib/command-center.util.spec.ts services/ops-web/src/lib/kpi-hub-api.ts
git commit -m "$(cat <<'EOF'
feat(ops-web): add command-center client and shared tile helpers.

EOF
)"
```

### Task A5: UI Executive §11.1

**Files:**
- Create: `services/ops-web/src/app/crm/kpi-hub/executive/page.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/CcKpiTiles.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/CcForecastChart.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/CcAtRisk.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/CcFunnel.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/CcDataTrust.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/CcApprovalQueue.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/CcExceptions.tsx`
- Create: `services/ops-web/src/hooks/useKpiHubCommandCenter.ts`
- Modify: `services/ops-web/src/app/globals.css` — block `.cc-*` / tái sử dụng `.kpi-hub-*`

**Thứ tự DOM (không đảo):** tiles → (chart | at-risk) → (funnel | trust | approvals) → exceptions full.

`data-testid`: `exec-kpi-tiles`, `exec-forecast`, `exec-at-risk`, `exec-funnel`, `exec-trust`, `exec-approvals`, `exec-exceptions`.

Title: `Executive Command Center`. Subtitle: `Hiệu suất kinh doanh theo thời gian thực và độ tin cậy dữ liệu.`  
Actions: date range · `So với tháng trước` · `Xuất báo cáo` (reuse export Hub nếu có, không thì `window.open` reports) · `+ Tạo báo cáo` → `/crm/kpi-hub/reports/new`.  
Chips: Client · Business Unit · `RLS` nếu cap · kỳ.  
Forecast: **không vẽ** series forecast (null). Chú thích ẩn.  
Exceptions tabs: `Tất cả ({n})` · `Critical` · `Warning` · `Chờ duyệt`. Resolve: nếu chưa có API note — nút disabled + title `Cần ghi chú và quyền`.  
`showFreshness` trên shell.

- [ ] **Step 1: Page render test (Vitest) hoặc e2e ở A8** — ít nhất util format `—`.

- [ ] **Step 2: Implement pages/components.** Loading skeleton 6 thẻ. 403 từ API → message cap. Click tile → drill `GET dashboard/drilldown/:code` drawer hiện có (`KpiHubDrilldown`) nếu vẫn work; không thì Link Dictionary.

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/executive services/ops-web/src/components/kpi-hub/command-center \
  services/ops-web/src/hooks/useKpiHubCommandCenter.ts services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(kpi-hub): add Executive Command Center layout and widgets.

EOF
)"
```

### Task A6: UI Marketing §11.2

**Files:**
- Create: `services/ops-web/src/app/crm/kpi-hub/marketing/page.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/MktMediaChart.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/MktChannelDonut.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/MktCampaignTable.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/MktCreatives.tsx`

Title: `Marketing Performance`. Subtitle: `Theo dõi hiệu quả đầu tư quảng cáo, chất lượng lead và chuyển đổi Marketing.`  
`data-testid`: `mkt-kpi-tiles`, `mkt-media-chart`, `mkt-channel-donut`, `mkt-funnel`, `mkt-alerts`, `mkt-campaigns`, `mkt-creatives`, `mkt-trust`.

Thứ tự: 6 thẻ → (media | donut) → (funnel Impr→MQL | alerts) → (campaign wide | creative | trust).

Tab Campaign / Ad Set / Creative / Landing: **không xóa tab**. `grain.* === false` → empty `Chưa có breakdown kênh` / `Chưa có creative` — đúng chỗ.  
Attribution dòng nhỏ: `Mô hình: Last-touch · cửa sổ Hub`.  
Insight: `data.marketing.insight` hoặc ẩn.

- [ ] **Step 1–3: Implement + commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/marketing services/ops-web/src/components/kpi-hub/command-center
git commit -m "$(cat <<'EOF'
feat(kpi-hub): add Marketing Performance command center.

EOF
)"
```

### Task A7: UI Sales §11.3 + deal risk

**Files:**
- Create: `services/ops-web/src/app/crm/kpi-hub/sales/page.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/SalesPipelineChart.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/SalesSlaGauge.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/SalesTeamTable.tsx`
- Create: `services/ops-web/src/components/kpi-hub/command-center/SalesDealsAtRisk.tsx`

Title: `Sales Command Center`. Subtitle: `Theo dõi pipeline, hiệu suất team, SLA xử lý lead và dự báo doanh thu.`  
CTA `+ Tạo Deal` chỉ khi hook cap `crm_leads.edit` → `/crm/leads/new`.  
`data-testid`: `sales-kpi-tiles`, `sales-pipeline`, `sales-sla-gauge`, `sales-funnel`, `sales-alerts`, `sales-team-table`, `sales-deals-risk`, `sales-trust`.

Pipeline stacked: New / Qualified / Proposal / Negotiation / Won — null stage giữ cột `—`. Câu dự báo **ẩn**.  
SLA link `Xem danh sách quá SLA` → `/crm/leads?sla=overdue` (query mà list lead đã hiểu; nếu chưa → `/crm/leads`).  
Deal card → `/crm/leads/{id}`. `Mở Pipeline Board` → `/crm/leads`.  
Badge tile trọng số: `chưa trọng số` khi `weighted_badge === 'unweighted'`.  
Bảng tab Team / NV / Nguồn / Sản phẩm — thiếu grain → empty, **giữ tab**.

- [ ] **Implement + commit**

```bash
git add services/ops-web/src/app/crm/kpi-hub/sales services/ops-web/src/components/kpi-hub/command-center
git commit -m "$(cat <<'EOF'
feat(kpi-hub): add Sales Command Center with SLA and deal-risk.

EOF
)"
```

### Task A8: E2E Command Center + hồi quy cockpit

**Files:**
- Create: `services/ops-web/e2e/kpi-hub-command-centers.spec.ts`
- Modify: `services/ops-web/e2e/kpi-hub.spec.ts` nếu assert heading `Dashboard` trên `/crm/kpi-hub` — đổi expect URL `/executive` hoặc heading Executive.

```typescript
import { test, expect } from '@playwright/test';

test('executive chrome', async ({ page }) => {
  await page.goto('/crm/kpi-hub/executive');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: 'Executive Command Center' })).toBeVisible();
  for (const id of ['exec-kpi-tiles', 'exec-forecast', 'exec-at-risk', 'exec-funnel', 'exec-trust', 'exec-approvals', 'exec-exceptions']) {
    await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
  }
  await expect(page.getByText('TỔNG QUAN')).toBeVisible();
  await expect(page.getByText('GOVERNANCE')).toBeVisible();
});

test('kpi-hub index redirects to executive', async ({ page }) => {
  await page.goto('/crm/kpi-hub');
  if (page.url().includes('/login')) test.skip();
  await expect(page).toHaveURL(/\/crm\/kpi-hub\/executive/);
});

test('cockpit unchanged', async ({ page }) => {
  await page.goto('/crm/kpi');
  if (page.url().includes('/login')) test.skip();
  await expect(page).not.toHaveURL(/kpi-hub/);
});
```

Lặp 2 test tương tự marketing (`mkt-funnel`) và sales (`sales-sla-gauge`).

- [ ] **Run:** `cd services/ops-web && npx playwright test e2e/kpi-hub-command-centers.spec.ts --reporter=line`

- [ ] **Commit**

```bash
git add services/ops-web/e2e/kpi-hub-command-centers.spec.ts services/ops-web/e2e/kpi-hub.spec.ts
git commit -m "$(cat <<'EOF'
test(kpi-hub): smoke command-center widgets and cockpit isolation.

EOF
)"
```

**Cổng Wave A:** 3 màn đủ khối; null không thành 0; SAL_008 không lấy FIN; Delayed không Đạt giả; user thiếu `crm_kpi_hub.view` 403 API.

---

# Wave B — Catalog + wizard B1–B3

**Không viết lại 9 task.** Implementer mở [`2026-09-04-kpi-hub-delivery-wave-b.md`](./2026-09-04-kpi-hub-delivery-wave-b.md) và làm Task 1→9.

### Sửa bắt buộc so với plan B (F0/A đã land)

1. **Task 5 Step 3 — overview items.** Thay mảng Dashboard+Delivery bằng:

```typescript
items: [
  { href: '/crm/kpi-hub/executive', label: 'Executive Command Center', icon: 'dashboard' },
  { href: '/crm/kpi-hub/marketing', label: 'Marketing Performance', icon: 'chart' },
  { href: '/crm/kpi-hub/sales', label: 'Sales Command Center', icon: 'target' },
  { href: '/crm/delivery-projects', label: 'Project Delivery', icon: 'dashboard' },
],
```

Spec Task 5: `KPI_HUB_NAV_GROUPS[0].items.map((i) => i.href)` **phải** bằng 4 href trên (không còn `/crm/kpi-hub` phẳng).

2. **Giữ** Approval Center + Audit Log từ F0. Task 5 plan B cũ thiếu 2 mục này — **đừng** ghi đè `KPI_HUB_NAV_GROUPS` bằng bản 2-item overview.

3. `isKpiHubPath` thêm `/crm/delivery-projects` như plan B.

4. Wizard bước 4–5: nút vẫn hiện (stepper 5 bước). Click bước 4/5 Wave B → toast `Sẽ mở ở Wave C/D` — **đúng**. Wave C/D thay toast bằng trang thật.

5. Nếu implement B **trước** A: làm Task 5 plan B gốc (Dashboard + Delivery), rồi F0/A thay Dashboard → 3 CC. Không ship cả hai bản nav trong một commit.

**Cổng Wave B:** catalog một list; backfill mọi B2B kể `PTT-LEGACY`; `/crm/b2b-projects` 308; lead vẫn `b2b_project_id`; circular milestone 400; Kanban/Capacity/Risk = khung + empty; thẻ tiền `—`.

---

# Wave C — Ngân sách & nguồn lực

**Phụ thuộc:** Wave B API + wizard shell. **Done khi:** B4 + modal §11.7–11.8; media client-borne không vào margin; margin < policy → Pending Approval.

### Task C1: Pure util tiền / allocation / capacity

**Files:**
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-budget.util.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-budget.util.spec.ts`

**Interfaces:**
- Produces:
  - `export const DEFAULT_MIN_GROSS_MARGIN_PCT = 30`
  - `export function parseDecimal(raw: string | number | null | undefined): string | null` — reject NaN; output string không float-error (`'100.50'`)
  - `export function computeGrossMarginPct(input: { contract: string; internalForecast: string; contingency: string }): string | null` — `(contract − internal − contingency) / contract * 100`; contract `0`/`null` → `null`
  - `export function internalCostFromItems(items: Array<{ amount: string; media_borne?: 'agency_borne' | 'client_borne'; kind: string }>): string` — **bỏ** item `kind==='media' && media_borne==='client_borne'`
  - `export function allocateEven(forecast: string, periods: string[]): Array<{ period: string; amount: string }>` — dư vào kỳ cuối
  - `export function allocateByMilestone(forecast: string, weights: Array<{ milestone_id: string; weight: number }>): Array<{ milestone_id: string; amount: string }>`
  - `export function validateManualAlloc(forecast: string, rows: Array<{ amount: string }>): { ok: boolean; code?: 'ALLOC_SUM_MISMATCH' }`
  - `export function overlapAllocationPct(assignments: Array<{ staff_id: number; pct: number; start: string; end: string; project_status: string }>, staffId: number, range: { start: string; end: string }): number` — chỉ `active`+`draft`
  - `export function financeApprovalRequired(input: { marginPct: string | null; minMargin: number; forecast: string; budget: string }): { marginCritical: boolean; forecastWarn: boolean; requireFinance: boolean }`

- [ ] **Step 1: Tests**

```typescript
import {
  allocateEven,
  computeGrossMarginPct,
  financeApprovalRequired,
  internalCostFromItems,
  overlapAllocationPct,
  validateManualAlloc,
} from './delivery-budget.util';

it('excludes client-borne media from internal cost', () => {
  expect(
    internalCostFromItems([
      { amount: '100', kind: 'labor' },
      { amount: '50', kind: 'media', media_borne: 'client_borne' },
      { amount: '20', kind: 'media', media_borne: 'agency_borne' },
    ]),
  ).toBe('120');
});

it('margin uses contract minus internal minus contingency', () => {
  expect(computeGrossMarginPct({ contract: '1000', internalForecast: '600', contingency: '50' })).toBe('35');
});

it('even allocation dumps remainder on last period', () => {
  expect(allocateEven('100', ['2026-09', '2026-10', '2026-11']).map((r) => r.amount)).toEqual([
    '33.33', '33.33', '33.34',
  ]);
});

it('manual alloc must equal forecast', () => {
  expect(validateManualAlloc('100', [{ amount: '40' }, { amount: '59' }]).ok).toBe(false);
  expect(validateManualAlloc('100', [{ amount: '40' }, { amount: '60' }]).ok).toBe(true);
});

it('overlap sums active+draft only', () => {
  const pct = overlapAllocationPct(
    [
      { staff_id: 1, pct: 80, start: '2026-09-01', end: '2026-09-30', project_status: 'active' },
      { staff_id: 1, pct: 30, start: '2026-09-10', end: '2026-09-20', project_status: 'draft' },
      { staff_id: 1, pct: 50, start: '2026-09-01', end: '2026-09-30', project_status: 'cancelled' },
    ],
    1,
    { start: '2026-09-01', end: '2026-09-30' },
  );
  expect(pct).toBe(110);
});

it('margin below 30 requires finance', () => {
  const r = financeApprovalRequired({ marginPct: '25', minMargin: 30, forecast: '110', budget: '100' });
  expect(r.marginCritical).toBe(true);
  expect(r.forecastWarn).toBe(true);
  expect(r.requireFinance).toBe(true);
});
```

`allocateEven` dùng cents integer: `Math.floor(totalCents / n)` rồi `totalCents - sum(head)` vào last — so sánh string 2 decimal.

- [ ] **Step 2–4: FAIL → implement → PASS → commit**

```bash
git add services/ptt-crm-api/src/delivery-projects/delivery-budget.util.ts \
  services/ptt-crm-api/src/delivery-projects/delivery-budget.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(delivery): add budget margin allocation and capacity math.

EOF
)"
```

### Task C2: DDL budget + repository

**Files:**
- Create: `docs/specs/2026-09-04-postgresql-ddl-delivery-budget.sql`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-budget.repository.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-budget.repository.spec.ts`

**DDL (đúng tên cột — task sau dùng lại):**

```sql
ALTER TABLE crm_delivery_projects
  ADD COLUMN IF NOT EXISTS contract_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS internal_cost_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS client_media_budget NUMERIC,
  ADD COLUMN IF NOT EXISTS contingency_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS forecast_cost NUMERIC,
  ADD COLUMN IF NOT EXISTS gross_margin_pct NUMERIC,
  ADD COLUMN IF NOT EXISTS finance_policy_json JSONB NOT NULL DEFAULT '{
    "min_gross_margin_pct": 30,
    "forecast_over_budget_warn": true,
    "require_finance_on_threshold": true,
    "block_over_capacity": false
  }'::jsonb;

CREATE TABLE IF NOT EXISTS crm_delivery_budget_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects(id),
  name TEXT NOT NULL,
  service_code TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('labor','production','software','media','other')),
  media_borne TEXT CHECK (media_borne IN ('agency_borne','client_borne')),
  cost_center TEXT,
  owner_staff_id INT,
  approved_budget NUMERIC NOT NULL DEFAULT 0,
  forecast NUMERIC NOT NULL DEFAULT 0,
  actual NUMERIC NOT NULL DEFAULT 0,
  allocation_method TEXT NOT NULL DEFAULT 'even' CHECK (allocation_method IN ('even','milestone','manual')),
  description TEXT,
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS crm_delivery_budget_items_project_idx ON crm_delivery_budget_items (project_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_delivery_budget_allocs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES crm_delivery_budget_items(id),
  period TEXT,
  milestone_id UUID,
  amount NUMERIC NOT NULL,
  UNIQUE (item_id, period, milestone_id)
);

CREATE TABLE IF NOT EXISTS crm_delivery_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects(id),
  staff_id INT NOT NULL,
  role_name TEXT,
  team_name TEXT,
  allocation_pct NUMERIC NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  estimated_cost NUMERIC,
  overload_reason TEXT,
  row_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

CHECK: `kind='media'` ⇒ `media_borne IS NOT NULL`.

Repository methods: `listItems(projectId)`, `insertItem`, `previewImpact(projectId, draftItem)` (không ghi), `listResources`, `insertResource`, `sumStaffOverlap`. Tiền vào/ra **string**.

- [ ] **Step 1: Repo spec** `previewImpact` cộng draft vào internal (trừ client media) rồi `computeGrossMarginPct`.

- [ ] **Step 2–4: FAIL → implement → PASS → commit**

```bash
git add docs/specs/2026-09-04-postgresql-ddl-delivery-budget.sql \
  services/ptt-crm-api/src/delivery-projects/delivery-budget.repository.ts \
  services/ptt-crm-api/src/delivery-projects/delivery-budget.repository.spec.ts
git commit -m "$(cat <<'EOF'
feat(delivery): add budget and resource tables with impact preview.

EOF
)"
```

### Task C3: API budget / resources / submit policy + RBAC

**Files:**
- Modify: `services/ptt-crm-api/src/delivery-projects/delivery-projects.controller.ts`
- Modify: `services/ptt-crm-api/src/delivery-projects/delivery-projects.service.ts`
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` — thêm `crm_delivery_budget`: `view`, `edit`, `approve`
- Create: guards `StaffDeliveryBudgetViewGuard` / `Edit` / `Approve` (pattern Hub guards)

**Routes:**

| Method | Path | Cap |
|--------|------|-----|
| GET/POST | `/api/crm/delivery-projects/:id/budget-items` | view / edit budget |
| POST | `/api/crm/delivery-projects/:id/budget-items/preview-impact` | edit |
| GET/POST | `/api/crm/delivery-projects/:id/resources` | view / edit |
| POST | `/api/crm/delivery-projects/:id/submit` | edit project; nếu `requireFinance` → status `pending_approval` + flag `needs_finance` |

`preview-impact` body = draft item; response:

```typescript
{
  internal_before: string;
  internal_after: string;
  contract: string | null;
  margin_before: string | null;
  margin_after: string | null;
  allocated_pct: string;
  policy_critical: boolean;
  forecast_over_budget: boolean;
}
```

POST item: `actual` luôn `'0'` Wave C (ignore client). `validateManualAlloc` fail → 400 `{ code: 'ALLOC_SUM_MISMATCH', field_errors: { amount: 'Tổng phân bổ phải bằng forecast' } }`. Media thiếu `media_borne` → 400. Overlap > 100: mặc định **warn** + bắt `overload_reason` nếu vẫn lưu; Settings `block_over_capacity` (đọc `finance_policy_json.block_over_capacity`) → 400 `CAPACITY_BLOCKED`.

Submit: `financeApprovalRequired` true và thiếu cap `crm_delivery_budget.approve` trên actor → **không** Active; `pending_approval`. Có cap approve + không critical → có thể `approved`. Idempotency-Key trên POST create/submit.

- [ ] **Step 1: Service spec** — client media không giảm margin; margin 25% → submit `pending_approval`.

- [ ] **Step 2–4: implement + SUPER-ADMIN catalog list thêm `crm_delivery_budget` → commit**

```bash
git add services/ptt-crm-api/src/delivery-projects services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json
git commit -m "$(cat <<'EOF'
feat(delivery): expose budget APIs and finance approval gates.

EOF
)"
```

### Task C4: ops-web client + copy util

**Files:**
- Modify: `services/ops-web/src/lib/delivery-projects-api.ts`
- Create: `services/ops-web/src/lib/delivery-budget.util.ts` + spec (copy C1 signatures)

Functions API: `fetchBudgetItems`, `previewBudgetImpact`, `createBudgetItem`, `fetchResources`, `createResource`, `submitDeliveryProject`.

- [ ] **Vitest copy C1 cases → commit**

```bash
git add services/ops-web/src/lib/delivery-projects-api.ts services/ops-web/src/lib/delivery-budget.util.ts \
  services/ops-web/src/lib/delivery-budget.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(ops-web): add delivery budget client helpers.

EOF
)"
```

### Task C5: Wizard B4 UI §11.7

**Files:**
- Create: `services/ops-web/src/app/crm/delivery-projects/new/budget/page.tsx` **hoặc** step trong wizard hiện có `?step=4`
- Create: `services/ops-web/src/components/delivery/WizardBudgetStep.tsx`
- Modify: wizard stepper — bước 4 không còn toast Wave C

Layout §11.7: method `Theo hạng mục dịch vụ` · VND · toggle Finance duyệt khi vượt. 4 thẻ: Hợp đồng · Nội bộ · Media khách (nhãn `không tính revenue`) · Biên gộp (xanh nếu ≥ policy). Bảng hạng mục + `+ Thêm hạng mục`. Nguồn lực + `Gán thành viên`. Contingency %/số. Rail: donut margin · cảnh báo NL · luồng PM → Director → Finance · `Ngưỡng: margin tối thiểu 30%`.

`data-testid`: `wiz-stepper`, `budget-header-tiles`, `budget-items-table`, `budget-resources`, `budget-rail`.

Footer: `Quay lại: Kế hoạch & Milestone` · `Tiếp tục: KPI & Xác nhận` (bước 5 vẫn toast Wave D cho đến D).

- [ ] **Implement + commit**

```bash
git add services/ops-web/src/app/crm/delivery-projects services/ops-web/src/components/delivery
git commit -m "$(cat <<'EOF'
feat(delivery): add wizard budget and resource step.

EOF
)"
```

### Task C6: Modal thêm hạng mục §11.8

**Files:**
- Create: `services/ops-web/src/components/delivery/BudgetItemModal.tsx`

Pattern: modal lớn overlay B4, Esc/Hủy. `data-testid="budget-item-modal"`. Banner `PRJ-xxx • {tên}`. Trái: tên, nhóm dịch vụ ∈ dịch vụ đã chọn, segmented loại, cost center, owner, milestone tags, date range, 3 mini-card (approved / forecast / actual `0` disabled), radio even|milestone|manual + bảng kỳ. Phải: impact từ `preview-impact` (debounce ≤1s khi đổi số), 3 toggle, checklist, link `Xem chính sách tài chính` → `/crm/kpi-hub/settings`. Footer: Hủy · Lưu nháp · `Thêm hạng mục ngân sách`. Nếu `policy_critical` hiện `Sẽ gửi Finance phê duyệt` — **vẫn cho lưu draft**, không ghi Active.

- [ ] **Implement + commit**

```bash
git add services/ops-web/src/components/delivery/BudgetItemModal.tsx
git commit -m "$(cat <<'EOF'
feat(delivery): add budget item impact modal.

EOF
)"
```

### Task C7: Portfolio tiền sống + e2e C

**Files:**
- Modify: portfolio tiles — Ngân sách đã dùng / Margin đọc header (không `—` nếu có số)
- Modify: budget chart grouped bar; empty chỉ khi mọi project `contract_budget` null
- Create: `services/ops-web/e2e/delivery-projects-wave-c.spec.ts`

```typescript
test('budget step chrome', async ({ page }) => {
  await page.goto('/crm/delivery-projects/new?step=4');
  if (page.url().includes('/login')) test.skip();
  await expect(page.locator('[data-testid="budget-header-tiles"]')).toBeVisible();
  await expect(page.getByText(/không tính revenue/i)).toBeVisible();
});
```

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/delivery-projects services/ops-web/e2e/delivery-projects-wave-c.spec.ts
git commit -m "$(cat <<'EOF'
feat(delivery): wire portfolio money tiles and Wave C smoke.

EOF
)"
```

**Cổng Wave C:** media client-borne không giảm margin; margin < 30 → Critical + Pending; alloc tay lệch → 400; overlap 103% → Quá tải.

---

# Wave D — KPI dự án từ Dictionary

**Phụ thuộc:** B (project id) + Dictionary Hub. **Done khi:** B5 + picker §11.9–11.10.

### Task D1: Target resolver + scope PROJECT

**Files:**
- Modify: `services/ptt-crm-api/src/kpi-hub/targets/kpi-hub-target-resolver.ts`
- Modify: `services/ptt-crm-api/src/kpi-hub/targets/kpi-hub-target-resolver.spec.ts`
- Modify: `services/ptt-crm-api/src/kpi-hub/targets/kpi-hub-targets.service.ts` — nhận `scope_type: 'PROJECT'`, `scope_project_id`

**Interfaces (thay đúng — đừng để CAMPAIGN thắng PROJECT):**

```typescript
export type HubHierarchyLevel = 'PROJECT' | 'WORKSPACE' | 'DEPARTMENT' | 'TEAM' | 'CAMPAIGN' | 'USER';
export type HubScopeChain = {
  workspace?: string;
  department?: string;
  team?: string;
  campaign?: string;
  user?: string;
  project_id?: string;
};
const LEVEL_PRIORITY: HubHierarchyLevel[] = ['PROJECT', 'CAMPAIGN', 'USER', 'TEAM', 'DEPARTMENT', 'WORKSPACE'];
```

`targetMatchesScope` case `PROJECT`: `Boolean(scope.project_id && (target.scope_hash === `p:${scope.project_id}` || target.scope_label.includes(scope.project_id)))`.

`scopeHashFromChain`: nếu `scope.project_id` → prefix `p:{id}|` trước các phần khác.

- [ ] **Step 1: Test**

```typescript
it('PROJECT overrides TEAM and WORKSPACE', () => {
  const candidates = [
    { id: 'ws', hierarchy_level: 'WORKSPACE' as const, scope_hash: 'w:default', scope_label: 'WS', target_value: 10, warning_value: null, critical_value: null, direction: 'HIGHER_IS_BETTER' },
    { id: 'prj', hierarchy_level: 'PROJECT' as const, scope_hash: 'p:proj-1', scope_label: 'proj-1', target_value: 20, warning_value: null, critical_value: null, direction: 'HIGHER_IS_BETTER' },
  ];
  expect(resolveTarget(candidates, { project_id: 'proj-1', team: 'A' })?.id).toBe('prj');
});
```

- [ ] **Step 2–4: FAIL → implement → PASS → commit**

```bash
git add services/ptt-crm-api/src/kpi-hub/targets
git commit -m "$(cat <<'EOF'
feat(kpi-hub): resolve PROJECT targets ahead of workspace.

EOF
)"
```

### Task D2: DDL project KPIs + target column

**Files:**
- Create: `docs/specs/2026-09-04-postgresql-ddl-delivery-kpis.sql`

```sql
ALTER TABLE crm_kpi_targets
  ADD COLUMN IF NOT EXISTS scope_project_id UUID REFERENCES crm_delivery_projects(id);

CREATE TABLE IF NOT EXISTS crm_delivery_project_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects(id),
  dictionary_id UUID NOT NULL,
  kpi_version_id UUID,
  target_id UUID,
  cycle TEXT NOT NULL DEFAULT 'MONTH' CHECK (cycle IN ('WEEK','MONTH')),
  owner_staff_id INT,
  baseline NUMERIC,
  warning_value NUMERIC,
  critical_value NUMERIC,
  inherit_alert BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (project_id, dictionary_id) WHERE deleted_at IS NULL
);
```

Không thêm `project_id` lên `crm_staff_kpi`.

- [ ] **Commit DDL + repository `delivery-project-kpis.repository.ts`** (`list`, `addMany`, reject duplicate)

```bash
git add docs/specs/2026-09-04-postgresql-ddl-delivery-kpis.sql \
  services/ptt-crm-api/src/delivery-projects/delivery-project-kpis.repository.ts
git commit -m "$(cat <<'EOF'
feat(delivery): add project KPI table and target project scope column.

EOF
)"
```

### Task D3: API project KPIs + picker validate

**Files:**
- Modify: controller — `GET/POST /api/crm/delivery-projects/:id/kpis`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-project-kpis.util.ts` + spec

```typescript
export function assertKpisAttachable(rows: Array<{ dictionary_id: string; status: string }>): { ok: boolean; errors: string[] } {
  // DEPRECATED → error; duplicate dictionary_id → error; else ok
}
```

POST body: `{ dictionary_ids: string[]; create_draft_targets?: boolean; inherit_alerts?: boolean }`. Chỉ Dictionary `ACTIVE`. Deprecated → 400 `KPI_DEPRECATED`. Duplicate → 400 `KPI_DUPLICATE`. Kế thừa `kpi_version_id` = version Active hiện tại — **không** nhận historical Wave D. `create_draft_targets` true → upsert target `scope_type='PROJECT'`, `scope_project_id=id`. Idempotency-Key.

Submit B5: checklist; mặc định ≥1 KPI hoặc `skip_kpi_reason` string; `block_on_dq_critical` default **false** (warn). Tạo approval + audit như Wave B submit, cộng KPI count.

- [ ] **Jest util + service → commit**

```bash
git add services/ptt-crm-api/src/delivery-projects
git commit -m "$(cat <<'EOF'
feat(delivery): attach Active dictionary KPIs to a project.

EOF
)"
```

### Task D4: ops-web picker util

**Files:**
- Create: `services/ops-web/src/lib/delivery-kpi-picker.util.ts` + spec

```typescript
export function filterDictionaryRows(
  rows: Array<{ id: string; code: string; name: string; status: string; kpi_group: string; department?: string; metric_type?: string; source?: string }>,
  q: { q?: string; groups?: string[]; status?: string; source?: string },
): typeof rows;

export function isDeprecatedDisabled(status: string): boolean {
  return status === 'DEPRECATED';
}
```

Test: `q` match code/name; DEPRECATED vẫn trong list nhưng `isDeprecatedDisabled` true.

- [ ] **Commit**

```bash
git add services/ops-web/src/lib/delivery-kpi-picker.util.ts services/ops-web/src/lib/delivery-kpi-picker.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(ops-web): add dictionary picker filters for delivery KPIs.

EOF
)"
```

### Task D5: Wizard B5 UI §11.9

**Files:**
- Create: `services/ops-web/src/components/delivery/WizardKpiStep.tsx`

Toolbar: `+ Thêm KPI từ Dictionary` · `Sao chép từ Template` (Wave D: toast `Chưa có template` — **không** bịa copy). Bảng cột đúng §11.9. Cảnh báo 2 cột + cadence. Checklist 3 checkbox bắt buộc. Rail: tóm tắt · KPI Health Preview (bar giả lập từ target draft, **không** ghi fact production) · luồng duyệt · pre-check.

Footer: `Quay lại: Ngân sách & Nguồn lực` · `Tạo dự án & Gửi phê duyệt`.  
`data-testid`: `wiz-kpi-table`, `wiz-kpi-rail`, `wiz-submit`.

- [ ] **Commit**

```bash
git add services/ops-web/src/components/delivery/WizardKpiStep.tsx
git commit -m "$(cat <<'EOF'
feat(delivery): add wizard KPI confirmation step.

EOF
)"
```

### Task D6: Picker Dictionary §11.10

**Files:**
- Create: `services/ops-web/src/app/crm/delivery-projects/[id]/kpis/add/page.tsx` **và** overlay `DictPickerOverlay.tsx` dùng chung từ B5
- `data-testid`: `dict-picker-filter`, `dict-picker-table`, `dict-picker-rail`

Filter trái: q · nhóm Acquisition/Media Efficiency/Funnel/Sales Outcome/Revenue/Delivery/Finance · phòng ban · Count/Currency/%/Duration · status default Active · CRM/Meta/Google/ERP/GA4/SharePoint.  
Cột + inspector + radio kế thừa Active (radio historical **ẩn**) + toggle target draft + toggle inherit alert.  
Deprecated: checkbox disabled + tooltip `Không thể chọn KPI đã Deprecated`.  
Nút `Thêm {n} KPI vào dự án`. Gọi `GET /api/crm/kpi-hub/dictionary?status=ACTIVE&...` (đã có) — thêm query `status` khác khi user tick Pending (Pending chọn được nhưng warn). Persist selection trong wizard state (sessionStorage key `delivery-wizard:{draftId}:kpis`).

- [ ] **Commit**

```bash
git add services/ops-web/src/app/crm/delivery-projects services/ops-web/src/components/delivery/DictPickerOverlay.tsx
git commit -m "$(cat <<'EOF'
feat(delivery): add dictionary multi-select picker with inspector.

EOF
)"
```

### Task D7: E2E Wave D

**Files:**
- Create: `services/ops-web/e2e/delivery-projects-wave-d.spec.ts`

```typescript
test('dictionary picker chrome', async ({ page }) => {
  await page.goto('/crm/delivery-projects/new?step=5');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('button', { name: /Thêm KPI từ Dictionary/i })).toBeVisible();
});
```

- [ ] **Commit**

```bash
git add services/ops-web/e2e/delivery-projects-wave-d.spec.ts
git commit -m "$(cat <<'EOF'
test(delivery): smoke Wave D KPI step and picker entry.

EOF
)"
```

**Cổng Wave D:** Deprecated không chọn; 3 KPI inherit version Active; duplicate 400; target Project thắng workspace trên thẻ dự án; submit = approval + audit.

---

# Wave E — Điều hành sau Active

**Phụ thuộc:** B (và C nếu CR ngân sách). Wave B đã có **khung** Risk/Capacity — E đổ CRUD.

### Task E1: Risk register CRUD

**Files:**
- Create: `docs/specs/2026-09-04-postgresql-ddl-delivery-ops.sql` (bảng `crm_delivery_risks`: project_id, severity, title, owner_staff_id, sla_due, status, note)
- API `GET/POST/PATCH /api/crm/delivery-projects/:id/risks` — close bắt buộc `note` + cap `crm_delivery_projects.edit`
- UI: portfolio panel + detail tab `Rủi ro` + trang `/crm/delivery-projects/risks` (`Xem Risk Register`)
- Jest: không close thiếu note → 400 `RISK_NOTE_REQUIRED`

```bash
git commit -m "$(cat <<'EOF'
feat(delivery): add risk register CRUD and portfolio panel.

EOF
)"
```

### Task E2: Change Request scope / budget

**Files:**
- DDL `crm_delivery_change_requests` (project_id, kind `scope|budget`, payload_json, status `draft|pending|approved|rejected`, baseline_version)
- API POST create từ banner B2 / từ item Active vượt forecast
- Sau Approved: bump `current_version`; không silent override
- UI drawer CR trên detail. Wave C toggle “CR khi vượt 5%” **bật hành động thật**

```bash
git commit -m "$(cat <<'EOF'
feat(delivery): add change requests for scope and budget.

EOF
)"
```

### Task E3: Approval Center policy + delivery queue

**Files:**
- Modify: `/crm/kpi-hub/approvals` — 3 nhóm KPI / Target / Mapping (đã stub) **cộng** Delivery project / Budget / CR
- API `GET /api/crm/kpi-hub/approvals` gộp pending dictionary + targets + reports + `crm_delivery_projects.status='pending_approval'` + CR
- Policy Wave E: chuỗi cấu hình được (JSON workspace `approval_policy`) — mặc định PM → Delivery Director → Finance nếu `needs_finance`
- POST approve/reject + note + cap

```bash
git commit -m "$(cat <<'EOF'
feat(kpi-hub): fill Approval Center with Hub and delivery queues.

EOF
)"
```

### Task E4: Capacity Planning trang riêng

**Files:**
- Route `/crm/delivery-projects/capacity`
- Đọc mọi `crm_delivery_resources` Active+Draft overlapping tuần
- Bar team Performance / CRM / Content / Creative; >100% đỏ
- Nút portfolio `Xem Capacity Planning` trỏ route này (thay empty Wave B)
- Tab Capacity trên catalog: cùng data, không còn empty-only

```bash
git commit -m "$(cat <<'EOF'
feat(delivery): add capacity planning page from resource allocations.

EOF
)"
```

### Task E5: Delivery Quality

**Files:**
- DDL `crm_delivery_quality_snapshots` (project_id, period, ontime_milestone_pct, client_approval_sla, rework_pct, score)
- Compute rule-based: milestone `done` đúng hạn / tổng; rework = CR count / milestone; thiếu dữ liệu → score null UI `—`
- Panel portfolio + `/crm/delivery-projects/quality`
- Nút `Xem audit trail` → `/crm/kpi-hub/audit?entity=delivery&id=`

```bash
git commit -m "$(cat <<'EOF'
feat(delivery): add delivery quality scores from milestones and CRs.

EOF
)"
```

### Task E6: Historical KPI version + lineage page

**Files:**
- Picker Wave D: hiện radio `Chọn version` **chỉ** khi `crm_kpi_hub_settings` + publish (BI Admin)
- Trang `/crm/kpi-hub/lineage?code=` — soft visual: dictionary → sources → last fact time (không warehouse mới)
- Footer Command Center `Xem lineage` trỏ trang này (F0/A đang 404-soft)

```bash
git commit -m "$(cat <<'EOF'
feat(kpi-hub): allow admin historical KPI versions and lineage view.

EOF
)"
```

### Task E7: Lịch báo cáo khách + gửi request milestone

**Files:**
- Dùng `KpiHubReportsService.schedule` nếu đã có; lưu cadence B5 (`weekly_review`, `client_report`) vào `crm_delivery_projects.cadence_json`
- Job: tạo report draft Hub — **không** LLM
- Milestone approval gate Wave B (đã lưu reviewer): POST tạo approval request khi milestone `ready`

```bash
git commit -m "$(cat <<'EOF'
feat(delivery): schedule client reports and milestone approval requests.

EOF
)"
```

### Task E8: E2E Wave E + hồi quy A–D

**Files:**
- Create: `services/ops-web/e2e/delivery-projects-wave-e.spec.ts`
- Chạy lại e2e A–D

```typescript
test('risk register route', async ({ page }) => {
  await page.goto('/crm/delivery-projects/risks');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: /risk register/i })).toBeVisible();
});
```

```bash
git commit -m "$(cat <<'EOF'
test(delivery): smoke Wave E ops routes and keep prior waves green.

EOF
)"
```

**Cổng Wave E:** Risk/CR/Capacity/Quality có data path; Approval Center không chỉ stub; lineage không 404; `/crm/kpi` + ingest B2B + service-delivery không regress.

---

# Deploy / UAT (mỗi wave, khi user yêu cầu ship)

1. Apply đúng file DDL wave đó trên VPS (`delivery-projects` → `delivery-budget` → `delivery-kpis` → `delivery-ops`).
2. Build `ptt-crm-api` + `ops-web`. Restart API. HUP ops-web.
3. Không bật LLM flags.
4. Hard-refresh. Chạy checklist SRS §13 của wave.
5. Xác nhận HEAD + `/login` 200 trước khi tuyên bố xong.

## UAT map (SRS §13 → task)

| Mục | Task |
|-----|------|
| Đổi kỳ filter đồng bộ; null ≠ 0 | A3–A7 |
| CPL / Win Rate direction; SAL_008 ≠ hóa đơn | A1, A5 |
| Delayed không Đạt giả | A1 `applyDataIssuePrecedence` |
| 403 thiếu cap dashboard | A3 guard |
| Đủ khối §11.1–11.3; sidebar 3 nhóm | F1, A5–A8 |
| Draft autosave / circular / PRJ / backfill / 308 | Wave B plan 1–9 |
| Media / margin 30% / alloc / 103% | C1, C3, C7 |
| Deprecated / inherit / duplicate / Project target | D1, D3, D6 |
| Hồi quy cockpit / B2B ingest / service-delivery / no LLM | A8, B9, E8 |

## Self-review

| Spec | Task |
|------|------|
| Q1–Q11 khóa | Constraints |
| §5 / §11.1–11.3 Command Center | A1–A8 |
| §11.0 chrome + Approval/Audit | F1 |
| §6 + §11.4–11.6 + §11.11 | Wave B plan |
| §11.7–11.8 budget | C1–C7 |
| §7 + §11.9–11.10 KPI | D1–D7 |
| Wave E list §3 | E1–E8 |
| §8 DDL mới | B2, C2, D2, E1 |
| §9 API | A3, B3, C3, D3, E1–E3 |
| BR-E01–E18 | rải A (01–03,06,14,16), B (11,15,17,18), C (04,05,09,10), D (07,08,12,13) |
| NFR p95 | không task riêng — page server, preview thuần số |

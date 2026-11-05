# KPI Management Cockpit (hướng A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi `/crm/kpi` thành cockpit RAG theo mockup (5 thẻ, bar phòng, chú ý, danh sách, donut, insight rule) trên `crm_staff_kpi`, không schema mới.

**Architecture:** Công thức RAG/hạn/summary là pure function (Jest trên API + Vitest trên ops-web, cùng logic copy tay). List KPI thêm `staff_department` + query `team`. Trang ráp component `kpi-cockpit-*` trong `DashboardShell`; grid nhập actual và Excel giữ nguyên.

**Tech Stack:** Nest `ptt-crm-api` (Jest), Next.js 14 ops-web (Vitest + Playwright), CSS `globals.css` (không Tailwind).

**Spec:** [`docs/superpowers/specs/2026-09-03-kpi-management-cockpit-design.md`](../specs/2026-09-03-kpi-management-cockpit-design.md)

## Global Constraints

- Chỉ `/crm/kpi`. Không đụng `/crm/staff-kpi`, `/crm/kpi/solution`, `/crm/business-dashboard` trừ e2e heading trên `/crm/kpi`.
- Không bảng/cột DB mới. Không `project_id` / `customer_id` / chu kỳ tuần.
- Không tab Team / Dự án / Khách hàng. Không cột menu `⋯`. Không gán `target_value`.
- Không LLM. Không `PTT_IWR_LLM` / `PTT_CSD_LLM`. Không join IWR/CSD P1.
- Không Tailwind. Class mới prefix `.kpi-cockpit-*` cạnh block RNOS-42 trong `globals.css`. Token `--accent` / `--success` / `--danger` / `--border`. Vàng `#c58a00`.
- Copy UI tiếng Việt đúng spec. Title **Quản lý KPI**. Nút **Xuất báo cáo**, **+ Tạo KPI**.
- RAG cockpit **không** ghi cột `status`. Alert `missed`/`at_risk`/`warn_ratio` giữ cho `/api/crm/kpi/alerts`.
- Giữ `KpiTeamToggle`, heading `Nhập actual KPI`, `KpiEditableGrid`, export xlsx.
- Giữ `.kpi-tile-grid` và `.kpi-page__section--split`.
- Thêm class `dashboard-shell` trên wrapper body (e2e đang query `.dashboard-shell`).
- `StoredStaffUser.id` là string; tab Cá nhân dùng `staff_id === Number(user.id)`.

## File map

| File | Role | Task |
|------|------|------|
| Create `services/ptt-crm-api/src/kpi/kpi.types.spec.ts` | Jest RAG + hạn ngày 5 | 1 |
| Modify `services/ptt-crm-api/src/kpi/kpi.types.ts` | `deriveKpiRag`, `kpiUpdateDeadlineIso`, `kpiIsOnTime` | 1 |
| Modify `services/ptt-crm-api/src/kpi/kpi.types.ts` | `staff_department` trên `StaffKpiEntryRow` | 2 |
| Modify `services/ptt-crm-api/src/kpi/kpi-pg.repository.ts` | SELECT + map `staff_department` | 2 |
| Modify `services/ptt-crm-api/src/kpi/kpi.service.ts` | `listStaffKpi(..., team?)` | 2 |
| Modify `services/ptt-crm-api/src/crm-staff/crm-staff.service.ts` | Pass `team` | 2 |
| Modify `services/ptt-crm-api/src/crm-staff/crm-staff.controller.ts` | `@Query('team')` | 2 |
| Modify `services/ptt-crm-api/src/kpi/kpi.service.spec.ts` | Assert list + team | 2 |
| Create `services/ops-web/src/lib/kpi/rag.ts` + `.spec.ts` | Copy RAG/hạn | 3 |
| Create `services/ops-web/src/lib/kpi/cockpit-summary.ts` + `.spec.ts` | `buildCockpitSummary` | 3 |
| Modify `services/ops-web/src/lib/api.ts` | `staff_department`, `updated_at`, `team`, `createKpiMetric` | 3, 5 |
| Create `services/ops-web/src/components/kpi/KpiCockpitTiles.tsx` | 5 thẻ | 4 |
| Create `services/ops-web/src/components/kpi/KpiDeptStackChart.tsx` | Bar phòng | 4 |
| Create `services/ops-web/src/components/kpi/KpiAttentionTable.tsx` | Chú ý | 4 |
| Create `services/ops-web/src/components/kpi/KpiCockpitList.tsx` | Tab + bảng | 4 |
| Create `services/ops-web/src/components/kpi/KpiRagDonut.tsx` | Donut | 4 |
| Create `services/ops-web/src/components/kpi/KpiCockpitInsight.tsx` | Insight | 4 |
| Modify `services/ops-web/src/app/globals.css` | `.kpi-cockpit-*` | 4 |
| Create `services/ops-web/src/components/kpi/KpiCreateMetricDrawer.tsx` | POST metric | 5 |
| Modify `services/ops-web/src/app/crm/kpi/page.tsx` | Ráp cockpit | 6 |
| Modify `services/ops-web/src/components/kpi/DashboardShell.tsx` | class `dashboard-shell` | 6 |
| Modify `services/ops-web/e2e/kpi-rnos42.spec.ts` | Heading + dept stack | 7 |
| Modify `services/ops-web/e2e/kpi-dashboard-rnos43a.spec.ts` | Bỏ AI tile; Xuất báo cáo | 7 |
| Create `services/ops-web/e2e/kpi-cockpit-wave1.spec.ts` | Smoke 5 thẻ / tab / donut | 7 |

## Out of scope (reject nếu task thêm)

- Wave 2/3 (gán target, scope DA/KH, IWR/P1, LLM).
- Trang KPI mới. Tailwind. Clone pixel mockup.
- Đổi công thức `kpiAchievementPct` hiện tại (chỉ *gọi lại*).

---

### Task 1: RAG + hạn ngày 5 (API)

**Files:**
- Create: `services/ptt-crm-api/src/kpi/kpi.types.spec.ts`
- Modify: `services/ptt-crm-api/src/kpi/kpi.types.ts` (cuối file, sau `kpiAlertLabelVi`)

**Interfaces:**
- Consumes: `kpiAchievementPct(higherIsBetter, target, actual): number | null` (đã có)
- Produces:
  - `export type KpiRag = 'green' | 'yellow' | 'red' | 'no_data'`
  - `export function deriveKpiRag(higherIsBetter: number, target: unknown, actual: unknown): KpiRag`
  - `export function kpiUpdateDeadlineIso(year: number, month: number): string`
  - `export function kpiIsOnTime(actual: unknown, updatedAt: string | null | undefined, year: number, month: number, now: Date): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
import { deriveKpiRag, kpiIsOnTime, kpiUpdateDeadlineIso } from './kpi.types';

describe('deriveKpiRag', () => {
  it('returns no_data when target or actual missing', () => {
    expect(deriveKpiRag(1, null, 10)).toBe('no_data');
    expect(deriveKpiRag(1, 10, null)).toBe('no_data');
    expect(deriveKpiRag(1, 0, 5)).toBe('no_data');
  });

  it('uses 90 / 75 cutovers for higher-is-better', () => {
    expect(deriveKpiRag(1, 100, 90)).toBe('green');
    expect(deriveKpiRag(1, 100, 89.9)).toBe('yellow');
    expect(deriveKpiRag(1, 100, 75)).toBe('yellow');
    expect(deriveKpiRag(1, 100, 74.9)).toBe('red');
  });

  it('inverts via achievementPct for lower-is-better', () => {
    expect(deriveKpiRag(0, 4, 4)).toBe('green');
    expect(deriveKpiRag(0, 4, 5.2)).toBe('red');
  });
});

describe('kpiIsOnTime', () => {
  it('deadline is 16:59:59.999Z on the 5th of next month (ICT 23:59)', () => {
    expect(kpiUpdateDeadlineIso(2026, 9)).toBe('2026-10-05T16:59:59.999Z');
    expect(kpiUpdateDeadlineIso(2026, 12)).toBe('2027-01-05T16:59:59.999Z');
  });

  it('open period: actual set is on time even if updated_at is late', () => {
    const now = new Date('2026-09-20T00:00:00.000Z');
    expect(kpiIsOnTime(10, '2026-11-01T00:00:00.000Z', 2026, 9, now)).toBe(true);
    expect(kpiIsOnTime(null, '2026-09-01T00:00:00.000Z', 2026, 9, now)).toBe(false);
  });

  it('closed period: requires actual and updated_at <= deadline', () => {
    const now = new Date('2026-10-06T00:00:00.000Z');
    expect(kpiIsOnTime(10, '2026-10-05T16:59:59.999Z', 2026, 9, now)).toBe(true);
    expect(kpiIsOnTime(10, '2026-10-05T17:00:00.000Z', 2026, 9, now)).toBe(false);
    expect(kpiIsOnTime(10, null, 2026, 9, now)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/kpi/kpi.types.spec.ts --no-coverage`

Expected: FAIL — `deriveKpiRag` / `kpiIsOnTime` is not a function (hoặc cannot find export).

- [ ] **Step 3: Write minimal implementation**

Thêm vào cuối `kpi.types.ts`:

```typescript
export type KpiRag = 'green' | 'yellow' | 'red' | 'no_data';

export function deriveKpiRag(
  higherIsBetter: number,
  target: unknown,
  actual: unknown,
): KpiRag {
  const pct = kpiAchievementPct(higherIsBetter, target, actual);
  if (pct == null) return 'no_data';
  if (pct >= 90) return 'green';
  if (pct >= 75) return 'yellow';
  return 'red';
}

export function kpiUpdateDeadlineIso(year: number, month: number): string {
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-05T16:59:59.999Z`;
}

export function kpiIsOnTime(
  actual: unknown,
  updatedAt: string | null | undefined,
  year: number,
  month: number,
  now: Date,
): boolean {
  if (actual == null || actual === '') return false;
  const deadline = new Date(kpiUpdateDeadlineIso(year, month));
  if (now.getTime() < deadline.getTime()) return true;
  if (!updatedAt) return false;
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) return false;
  return updated.getTime() <= deadline.getTime();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/kpi/kpi.types.spec.ts --no-coverage`

Expected: PASS (cả file).

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi/kpi.types.ts services/ptt-crm-api/src/kpi/kpi.types.spec.ts
git commit -m "$(cat <<'EOF'
feat(kpi): add RAG and on-time deadline helpers.

Cockpit colors come from actual/target, not the manual status column.
EOF
)"
```

---

### Task 2: `staff_department` + `team` trên list staff KPI

**Files:**
- Modify: `services/ptt-crm-api/src/kpi/kpi.types.ts` — `StaffKpiEntryRow`
- Modify: `services/ptt-crm-api/src/kpi/kpi-pg.repository.ts` — SELECT + `mapStaffKpiRow`
- Modify: `services/ptt-crm-api/src/kpi/kpi.service.ts` — `listStaffKpi`
- Modify: `services/ptt-crm-api/src/crm-staff/crm-staff.service.ts`
- Modify: `services/ptt-crm-api/src/crm-staff/crm-staff.controller.ts`
- Modify: `services/ptt-crm-api/src/kpi/kpi.service.spec.ts`

**Interfaces:**
- Consumes: `normalizeKpiTeam`, `KpiPgRepository.staffIdsForTeam`, `listStaffKpi(year, month, staffId?)`
- Produces: `StaffKpiEntryRow.staff_department: string`; `KpiService.listStaffKpi(year?, month?, staffId?, team?): Promise<{ staff_kpi: StaffKpiEntryRow[] }>`

- [ ] **Step 1: Extend the existing Jest list assertion**

Trong `kpi.service.spec.ts`, thêm case team (sau test hiện tại):

```typescript
  it('filters staff KPI list by team when provided', async () => {
    const pg = {
      listStaffKpi: jest.fn().mockResolvedValue([
        { id: 1, staff_id: 10, staff_department: 'Sales' },
        { id: 2, staff_id: 11, staff_department: 'CSKH' },
      ]),
      staffIdsForTeam: jest.fn().mockResolvedValue([10]),
    } as unknown as KpiPgRepository;
    const service = new KpiService(pg, undefined as unknown as LeadsFunnelService);
    await expect(service.listStaffKpi('2026', '9', undefined, 'sales')).resolves.toEqual({
      staff_kpi: [{ id: 1, staff_id: 10, staff_department: 'Sales' }],
    });
    expect(pg.staffIdsForTeam).toHaveBeenCalledWith('sales');
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `cd services/ptt-crm-api && npx jest src/kpi/kpi.service.spec.ts --no-coverage`

Expected: FAIL — `listStaffKpi` không nhận `team` / không gọi `staffIdsForTeam`.

- [ ] **Step 3: Implement**

`StaffKpiEntryRow` thêm `staff_department: string`.

`listStaffKpi` SQL thêm `COALESCE(s.department, '') AS staff_department`.

`mapStaffKpiRow` thêm `staff_department: String(row.staff_department ?? '')`.

`KpiService.listStaffKpi`:

```typescript
  async listStaffKpi(year?: string, month?: string, staffId?: string, team?: string) {
    const parsed = this.parseYearMonth(year, month);
    let sid: number | undefined;
    if (staffId) {
      const n = Number(staffId);
      if (!Number.isFinite(n) || n <= 0) {
        throw new BadRequestException({ error: 'staff_id không hợp lệ' });
      }
      sid = n;
    }
    let staffKpi = await this.pg.listStaffKpi(parsed.year, parsed.month, sid);
    const teamIds = await this.resolveTeamStaffIds(normalizeKpiTeam(team));
    if (teamIds) {
      staffKpi = staffKpi.filter((row) => teamIds.has(row.staff_id));
    }
    return { staff_kpi: staffKpi };
  }
```

`crm-staff.service.ts`:

```typescript
  listStaffKpi(year?: string, month?: string, staffId?: string, team?: string) {
    return this.kpi.listStaffKpi(year, month, staffId, team);
  }
```

`crm-staff.controller.ts` `@Get('kpi')` thêm `@Query('team') team?: string` và truyền xuống.

Test cũ `listStaffKpi('2026', '8')` vẫn gọi `pg.listStaffKpi(2026, 8, undefined)` — không đổi 3 tham số repo.

- [ ] **Step 4: Run tests**

Run: `cd services/ptt-crm-api && npx jest src/kpi/kpi.service.spec.ts src/kpi/kpi.types.spec.ts --no-coverage`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/kpi/kpi.types.ts services/ptt-crm-api/src/kpi/kpi-pg.repository.ts services/ptt-crm-api/src/kpi/kpi.service.ts services/ptt-crm-api/src/kpi/kpi.service.spec.ts services/ptt-crm-api/src/crm-staff/crm-staff.service.ts services/ptt-crm-api/src/crm-staff/crm-staff.controller.ts
git commit -m "$(cat <<'EOF'
feat(kpi): expose staff department and team filter on list.

Cockpit rolls up by department using the same team scope as the board.
EOF
)"
```

---

### Task 3: ops-web rag + `buildCockpitSummary`

**Files:**
- Create: `services/ops-web/src/lib/kpi/rag.ts`
- Create: `services/ops-web/src/lib/kpi/rag.spec.ts`
- Create: `services/ops-web/src/lib/kpi/cockpit-summary.ts`
- Create: `services/ops-web/src/lib/kpi/cockpit-summary.spec.ts`
- Modify: `services/ops-web/src/lib/api.ts` — `StaffKpiGridEntry` + `fetchStaffKpi` `team`

**Interfaces:**
- Consumes: cùng công thức Task 1 (copy, không import API)
- Produces: xem block TypeScript dưới — Task 4+ chỉ dùng các export này

- [ ] **Step 1: Write failing Vitest**

`rag.spec.ts` — copy 3 nhóm assert giống `kpi.types.spec.ts` (biên 90/75, lower-is-better, hạn 2026-09).

`cockpit-summary.spec.ts`:

```typescript
import { buildCockpitSummary, deptLabel, prevYearMonth } from './cockpit-summary';
import type { StaffKpiGridEntry } from '@/lib/api';

function row(p: Partial<StaffKpiGridEntry> & Pick<StaffKpiGridEntry, 'id' | 'staff_id'>): StaffKpiGridEntry {
  return {
    staff_name: 'A',
    staff_code: 'A',
    staff_department: 'Sales',
    metric_id: 1,
    metric_name: 'Lead',
    metric_code: 'LEAD',
    metric_unit: '',
    metric_higher_is_better: 1,
    target_value: 100,
    actual_value: 90,
    status: 'on_track',
    updated_at: '2026-09-10T00:00:00.000Z',
    year: 2026,
    month: 9,
    ...p,
  };
}

describe('buildCockpitSummary', () => {
  const now = new Date('2026-09-20T00:00:00.000Z');

  it('counts RAG tiles, completion, on-time, and MoM delta', () => {
    const current = [
      row({ id: 1, staff_id: 1, actual_value: 90 }),
      row({ id: 2, staff_id: 2, actual_value: 80, staff_department: 'Tech' }),
      row({ id: 3, staff_id: 3, actual_value: 50, staff_department: 'Tech' }),
    ];
    const prev = [row({ id: 9, staff_id: 1, year: 2026, month: 8, actual_value: 100 })];
    const out = buildCockpitSummary(current, prev, now);
    expect(out.green).toBe(1);
    expect(out.yellow).toBe(1);
    expect(out.red).toBe(1);
    expect(out.total).toBe(3);
    expect(out.completion_pct).toBeCloseTo((90 + 80 + 50) / 3, 5);
    expect(out.ontime_pct).toBe(100);
    expect(out.delta.green).toBe(0);
    expect(out.by_department.map((d) => d.name)).toEqual(['Sales', 'Tech']);
    expect(out.attention[0].rag).toBe('red');
    expect(out.insight.headline).toMatch(/1 KPI không đạt/);
  });

  it('labels empty department and prevYearMonth', () => {
    expect(deptLabel('')).toBe('Chưa gắn phòng');
    expect(prevYearMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd services/ops-web && npx vitest run src/lib/kpi/rag.spec.ts src/lib/kpi/cockpit-summary.spec.ts`

Expected: FAIL — files/exports missing.

- [ ] **Step 3: Implement**

`rag.ts`: copy nguyên `kpiAchievementPct`, `deriveKpiRag`, `kpiUpdateDeadlineIso`, `kpiIsOnTime` từ Task 1 (cùng số). Export `KpiRag`.

`api.ts` — `StaffKpiGridEntry` thêm:

```typescript
  staff_department?: string;
  updated_at?: string;
```

`fetchStaffKpi` params thêm `team?: string` và `if (params?.team) qs.set('team', params.team)`.

`cockpit-summary.ts` (đủ export):

```typescript
import type { StaffKpiGridEntry } from '@/lib/api';
import { deriveKpiRag, kpiAchievementPct, kpiIsOnTime, type KpiRag } from '@/lib/kpi/rag';

export function deptLabel(raw: string | null | undefined): string {
  const v = String(raw ?? '').trim();
  return v || 'Chưa gắn phòng';
}

export function prevYearMonth(year: number, month: number): { year: number; month: number } {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

export function filterRowsByDepartment(
  rows: StaffKpiGridEntry[],
  department: string,
): StaffKpiGridEntry[] {
  if (!department || department === 'all') return rows;
  if (department === 'Chưa gắn phòng') {
    return rows.filter((r) => !String(r.staff_department ?? '').trim());
  }
  return rows.filter((r) => String(r.staff_department ?? '').trim() === department);
}

export function departmentOptions(rows: StaffKpiGridEntry[]): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const label = deptLabel(row.staff_department);
    if (label !== 'Chưa gắn phòng') set.add(label);
  }
  if (rows.some((r) => !String(r.staff_department ?? '').trim())) set.add('Chưa gắn phòng');
  return [...set].sort((a, b) => a.localeCompare(b, 'vi'));
}

export type DeptProgress = {
  name: string;
  green: number;
  yellow: number;
  red: number;
  no_data: number;
  progress_pct: number | null;
};

export type AttentionRow = {
  id: number;
  metric_name: string;
  staff_name: string;
  department: string;
  actual_value: number | null;
  target_value: number | null;
  unit: string;
  achievement_pct: number | null;
  rag: KpiRag;
};

export type CockpitInsight = { headline: string; actions: string[] };

export type CockpitDelta = {
  green: number;
  yellow: number;
  red: number;
  completion_pct: number | null;
  ontime_pct: number | null;
};

export type CockpitSummary = {
  total: number;
  green: number;
  yellow: number;
  red: number;
  no_data: number;
  scored: number;
  completion_pct: number | null;
  ontime_count: number;
  ontime_pct: number | null;
  delta: CockpitDelta;
  by_department: DeptProgress[];
  attention: AttentionRow[];
  insight: CockpitInsight;
};

function countsOf(rows: StaffKpiGridEntry[], now: Date) {
  let green = 0;
  let yellow = 0;
  let red = 0;
  let no_data = 0;
  let scoredSum = 0;
  let scored = 0;
  let ontime = 0;
  for (const row of rows) {
    const year = Number(row.year);
    const month = Number(row.month);
    const rag = deriveKpiRag(row.metric_higher_is_better, row.target_value, row.actual_value);
    if (rag === 'green') green += 1;
    else if (rag === 'yellow') yellow += 1;
    else if (rag === 'red') red += 1;
    else no_data += 1;
    const pct = kpiAchievementPct(row.metric_higher_is_better, row.target_value, row.actual_value);
    if (pct != null) {
      scored += 1;
      scoredSum += pct;
    }
    if (kpiIsOnTime(row.actual_value, row.updated_at, year, month, now)) ontime += 1;
  }
  const completion_pct = scored ? scoredSum / scored : null;
  const ontime_pct = rows.length ? Math.round((100 * ontime) / rows.length) : null;
  return { green, yellow, red, no_data, scored, completion_pct, ontime_count: ontime, ontime_pct };
}

function insightOf(red: number, yellow: number, ontime_pct: number | null, total: number): CockpitInsight {
  const actions: string[] = [];
  let headline = 'Không có KPI vàng/đỏ trong bộ lọc hiện tại.';
  if (red > 0) {
    headline = `Có ${red} KPI không đạt trong kỳ. Ưu tiên các hàng Đỏ.`;
    actions.push('Xử lý các KPI Đỏ trong danh sách cần chú ý.');
  } else if (yellow > 0) {
    headline = `Có ${yellow} KPI cần theo dõi.`;
    actions.push('Theo dõi các KPI Vàng trong danh sách cần chú ý.');
  }
  if (total > 0 && ontime_pct != null && ontime_pct < 80) {
    actions.push('Nhắc owner cập nhật actual trước hạn ngày 5.');
  }
  return { headline, actions: actions.slice(0, 2) };
}

const RAG_RANK: Record<KpiRag, number> = { red: 0, yellow: 1, no_data: 2, green: 3 };

export function buildCockpitSummary(
  rows: StaffKpiGridEntry[],
  prevRows: StaffKpiGridEntry[],
  now: Date,
): CockpitSummary {
  const cur = countsOf(rows, now);
  const prev = countsOf(prevRows, now);
  const byMap = new Map<string, StaffKpiGridEntry[]>();
  for (const row of rows) {
    const name = deptLabel(row.staff_department);
    const list = byMap.get(name) ?? [];
    list.push(row);
    byMap.set(name, list);
  }
  const by_department: DeptProgress[] = [...byMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'vi'))
    .map(([name, list]) => {
      const c = countsOf(list, now);
      return {
        name,
        green: c.green,
        yellow: c.yellow,
        red: c.red,
        no_data: c.no_data,
        progress_pct: c.completion_pct,
      };
    });

  const attention: AttentionRow[] = rows
    .map((row) => {
      const rag = deriveKpiRag(row.metric_higher_is_better, row.target_value, row.actual_value);
      return {
        id: row.id,
        metric_name: row.metric_name,
        staff_name: row.staff_name,
        department: deptLabel(row.staff_department),
        actual_value: row.actual_value,
        target_value: row.target_value,
        unit: row.metric_unit,
        achievement_pct: kpiAchievementPct(row.metric_higher_is_better, row.target_value, row.actual_value),
        rag,
      };
    })
    .filter((row) => row.rag === 'red' || row.rag === 'yellow' || (row.rag === 'no_data' && row.target_value != null))
    .sort((a, b) => RAG_RANK[a.rag] - RAG_RANK[b.rag])
    .slice(0, 8);

  return {
    total: rows.length,
    green: cur.green,
    yellow: cur.yellow,
    red: cur.red,
    no_data: cur.no_data,
    scored: cur.scored,
    completion_pct: cur.completion_pct,
    ontime_count: cur.ontime_count,
    ontime_pct: cur.ontime_pct,
    delta: {
      green: cur.green - prev.green,
      yellow: cur.yellow - prev.yellow,
      red: cur.red - prev.red,
      completion_pct:
        cur.completion_pct == null || prev.completion_pct == null
          ? null
          : cur.completion_pct - prev.completion_pct,
      ontime_pct:
        cur.ontime_pct == null || prev.ontime_pct == null ? null : cur.ontime_pct - prev.ontime_pct,
    },
    by_department,
    attention,
    insight: insightOf(cur.red, cur.yellow, cur.ontime_pct, rows.length),
  };
}

export function rowTrend(
  row: StaffKpiGridEntry,
  prevRows: StaffKpiGridEntry[],
): 'up' | 'down' | 'flat' | null {
  const cur = kpiAchievementPct(row.metric_higher_is_better, row.target_value, row.actual_value);
  const prev = prevRows.find((p) => p.staff_id === row.staff_id && p.metric_id === row.metric_id);
  const prevPct = prev
    ? kpiAchievementPct(prev.metric_higher_is_better, prev.target_value, prev.actual_value)
    : null;
  if (cur == null || prevPct == null) return null;
  if (cur > prevPct) return 'up';
  if (cur < prevPct) return 'down';
  return 'flat';
}
```

Sửa test delta: 1 green hiện vs 1 green trước → `delta.green === 0`. Completion current = (90+80+50)/3 = 73.333… — `toBeCloseTo` ổn.

- [ ] **Step 4: Run Vitest**

Run: `cd services/ops-web && npx vitest run src/lib/kpi/rag.spec.ts src/lib/kpi/cockpit-summary.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/kpi/rag.ts services/ops-web/src/lib/kpi/rag.spec.ts services/ops-web/src/lib/kpi/cockpit-summary.ts services/ops-web/src/lib/kpi/cockpit-summary.spec.ts services/ops-web/src/lib/api.ts
git commit -m "$(cat <<'EOF'
feat(kpi): compute cockpit summary from staff KPI rows.

Tiles, department bars, and attention lists share one RAG function.
EOF
)"
```

---

### Task 4: Component + CSS (chưa ráp page)

**Files:**
- Create 6 file dưới `services/ops-web/src/components/kpi/` (trừ drawer)
- Modify: `services/ops-web/src/app/globals.css` — chèn sau block `/* RNOS-42 — KPI dashboard UX */` (~dòng 5255)

**Interfaces:**
- Consumes: `CockpitSummary`, `DeptProgress`, `AttentionRow`, `StaffKpiGridEntry`, `rowTrend`, `deptLabel`, `formatNumber`, `formatPct` từ `@/lib/kpi/format`
- Produces: các component default-export named đúng bảng file map

- [ ] **Step 1: CSS tối thiểu**

Thêm (không gradient, không box-shadow):

```css
.kpi-cockpit { display: grid; gap: 1.25rem; }
.kpi-cockpit__split {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 1rem;
}
@media (max-width: 800px) {
  .kpi-cockpit__split { grid-template-columns: 1fr; }
  .kpi-tile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.kpi-dept-stack { display: grid; gap: 0.65rem; }
.kpi-dept-stack__row {
  display: grid;
  grid-template-columns: minmax(88px, 140px) 1fr 52px;
  gap: 0.5rem;
  align-items: center;
}
.kpi-dept-stack__track {
  display: flex;
  height: 16px;
  border-radius: 999px;
  overflow: hidden;
  background: color-mix(in srgb, var(--border) 70%, transparent);
}
.kpi-dept-stack__seg { height: 100%; }
.kpi-dept-stack__seg.is-green { background: var(--success, #2e7d4f); }
.kpi-dept-stack__seg.is-yellow { background: #c58a00; }
.kpi-dept-stack__seg.is-red { background: var(--danger, #b42318); }
.kpi-dept-stack__seg.is-none { background: var(--border); }
.kpi-rag { font-size: 0.78rem; font-weight: 600; }
.kpi-rag.is-green { color: var(--success, #2e7d4f); }
.kpi-rag.is-yellow { color: #c58a00; }
.kpi-rag.is-red { color: var(--danger, #b42318); }
.kpi-cockpit-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.kpi-cockpit-table th, .kpi-cockpit-table td {
  border-bottom: 1px solid var(--border);
  padding: 0.45rem 0.4rem;
  text-align: left;
}
.kpi-cockpit-tabs { display: flex; gap: 0.35rem; margin-bottom: 0.65rem; }
.kpi-donut { display: grid; justify-items: center; gap: 0.5rem; }
.kpi-insight { border: 1px solid var(--border); border-radius: 10px; padding: 0.85rem 1rem; }
.kpi-insight__actions { margin: 0.5rem 0 0; padding-left: 1.1rem; }
.kpi-progress-mini {
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--border) 70%, transparent);
  overflow: hidden;
}
.kpi-progress-mini > span { display: block; height: 100%; }
```

- [ ] **Step 2: Components — đúng props**

`KpiCockpitTiles.tsx`: nhận `summary: CockpitSummary`. Render `.kpi-tile-grid` với 5 `KpiTile` (reuse `KpiTile` từ `KpiDashboardUi`):

| label | value | hint |
|-------|-------|------|
| KPI đúng tiến độ | `${green}/${total}` | `deltaHint(delta.green, 'so với tháng trước')` |
| Cần theo dõi | `${yellow}` | delta yellow |
| Không đạt | `${red}` | delta red |
| Tỷ lệ hoàn thành | `completion_pct == null ? '—' : formatPct(completion_pct, 1)` | delta completion (điểm %) |
| Cập nhật đúng hạn | `ontime_pct == null ? '—' : `${ontime_pct}%`` | delta ontime |

Tone: đúng tiến độ `success`; cần theo dõi `warning`; không đạt `critical` nếu red>0.  
`deltaHint(n, suffix)`: `n == null` → không hint; `n > 0` → `+{n} {suffix}`; `n < 0` → `{n} {suffix}`; `0` → `0 {suffix}`.

`KpiDeptStackChart.tsx`: `rows: DeptProgress[]`. Wrapper `className="kpi-dept-stack"`. Mỗi phòng: tên, track 4 seg width `%` trên `green+yellow+red+no_data` (nếu 0 thì track rỗng), cột phải `progress_pct` `formatPct` hoặc `—`. Legend 4 màu phía trên. Heading `Tiến độ KPI theo phòng ban` (`h3.kpi-section-title`). Empty: `Chưa có bản ghi KPI trong kỳ này.`

`KpiAttentionTable.tsx`: `rows: AttentionRow[]`. Heading `KPI cần chú ý`. Table cột: KPI, Owner, Phạm vi, Thực tế/Mục tiêu (`formatNumber(actual) / formatNumber(target)` + unit), tiến độ mini, pill `Xanh|Vàng|Đỏ|Chưa có số`.

`KpiCockpitList.tsx`:

```typescript
type Tab = 'all' | 'mine' | 'dept';
export function KpiCockpitList({
  rows,
  prevRows,
  userStaffId,
}: {
  rows: StaffKpiGridEntry[];
  prevRows: StaffKpiGridEntry[];
  userStaffId: number | null;
})
```

Tabs `role="tablist"`: Tất cả / Cá nhân / Phòng ban. `role="tab"` + `aria-selected`. Cá nhân filter `row.staff_id === userStaffId`. Phòng ban: `useMemo` group `Map<deptLabel, rows>` rồi render nhiều `<tbody>` với hàng heading `colSpan={9}` tên phòng.  
Cột: Tên KPI, Owner, Phạm vi, Chu kỳ (**Tháng**), Mục tiêu, Thực tế, Tiến độ (mini + `formatPct`), Xu hướng (`↑` class green / `↓` red / `—`), Trạng thái (`kpi-rag`).  
Pagination 20/trang: state `page`, slice; nút Trước/Sau. Empty: `Chưa có bản ghi KPI trong kỳ này.`

`KpiRagDonut.tsx`: `green, yellow, red`. `data-testid="kpi-rag-donut"`. SVG donut `viewBox="0 0 120 120"`, bán kính 42, stroke 16, circumference `2*π*42`. Ba `circle` `stroke-dasharray` / `stroke-dashoffset` lần lượt green/yellow/red. Tâm text = `green+yellow+red`. Legend `Xanh n (p%)`. Nếu tổng 0: text `Chưa có số`.

`KpiCockpitInsight.tsx`: `insight: CockpitInsight`. Headline + `<ul class="kpi-insight__actions">` mỗi action một `<li><label><input type="checkbox" disabled /> {text}</label></li>`. Link `Xem AI Insights` → `/crm/ai/insights`.

Không viết test React (không RTL). CSS + compile là gate.

- [ ] **Step 3: Typecheck các file mới**

Run: `cd services/ops-web && npx tsc --noEmit --pretty false 2>&1 | head -40`

Expected: không error trên file `KpiCockpit*` / `rag` / `cockpit-summary`. (Lỗi sẵn `tsconfig.tsbuildinfo` khác thì bỏ qua nếu không do file mới.)

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/components/kpi/KpiCockpitTiles.tsx services/ops-web/src/components/kpi/KpiDeptStackChart.tsx services/ops-web/src/components/kpi/KpiAttentionTable.tsx services/ops-web/src/components/kpi/KpiCockpitList.tsx services/ops-web/src/components/kpi/KpiRagDonut.tsx services/ops-web/src/components/kpi/KpiCockpitInsight.tsx services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(kpi): add cockpit presentational blocks and CSS.

Layout matches the management mockup using existing kpi tokens.
EOF
)"
```

---

### Task 5: `createKpiMetric` + drawer

**Files:**
- Modify: `services/ops-web/src/lib/api.ts` (cạnh `fetchKpiMetrics`)
- Create: `services/ops-web/src/components/kpi/KpiCreateMetricDrawer.tsx`

**Interfaces:**
- Consumes: `POST /api/crm/kpi/metrics` body `CreateKpiMetricBody`; guard `crm_kpi_records.edit` (page quyết định mount)
- Produces: `createKpiMetric(token, body): Promise<KpiMetricRow>`

- [ ] **Step 1: Client**

```typescript
export async function createKpiMetric(
  token: string,
  body: {
    name: string;
    code?: string;
    unit?: string;
    higher_is_better?: boolean;
    warn_ratio?: number | null;
  },
): Promise<KpiMetricRow> {
  return crmFetch<KpiMetricRow>(token, '/api/crm/kpi/metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
```

Kiểm tra `crmFetch` có ném message từ `{ error: string }`. Drawer hiện `err.message`.

- [ ] **Step 2: Drawer**

Props: `{ open: boolean; token: string; onClose: () => void; onCreated: () => void }`. Nếu `!open` return null. Form: tên required, code, unit, checkbox “Cao hơn càng tốt” default checked, `warn_ratio` number optional. Submit: `createKpiMetric` rồi `onCreated()` + `onClose()`. Nút Đóng gọi `onClose`. Title `Tạo chỉ tiêu KPI`. Class `kpi-insight` cho panel (không portal bắt buộc; overlay `position: fixed` đơn giản bằng CSS `.kpi-cockpit-drawer`).

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/lib/api.ts services/ops-web/src/components/kpi/KpiCreateMetricDrawer.tsx services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(kpi): add create-metric drawer for the cockpit.

Editors can add a catalog metric without assigning staff targets.
EOF
)"
```

---

### Task 6: Ráp `/crm/kpi`

**Files:**
- Modify: `services/ops-web/src/app/crm/kpi/page.tsx`
- Modify: `services/ops-web/src/components/kpi/DashboardShell.tsx` — `className="page-card stack-gap dashboard-shell dashboard-shell__body"`

**Interfaces:**
- Consumes: mọi export Task 3–5; `fetchStaffKpi(..., { year, month, team })` hai lần (kỳ này + `prevYearMonth`)
- Produces: trang đúng thứ tự spec

- [ ] **Step 1: Bỏ tile AI trên đầu**

Xóa `fetchAiAcceptanceMetrics` / `aiAcceptance` / tile “Tỷ lệ chấp nhận AI” khỏi `page.tsx`. Insight đã có link.

- [ ] **Step 2: State + load**

```typescript
const [deptFilter, setDeptFilter] = useState('all');
const [createOpen, setCreateOpen] = useState(false);
const [prevRows, setPrevRows] = useState<StaffKpiGridEntry[]>([]);
```

Trong `loadPage`, song song:

```typescript
const prev = prevYearMonth(year, month);
const teamParam = team === 'all' ? undefined : team;
const [metricRows, boardOut, staffKpiRows, prevKpiRows] = await Promise.all([
  fetchKpiMetrics(access),
  fetchKpiBoard(access, { year, month, team: teamParam }),
  fetchStaffKpi(access, { year, month, team: teamParam }).catch(() => []),
  fetchStaffKpi(access, { year: prev.year, month: prev.month, team: teamParam }).catch(() => []),
]);
```

`board` vẫn fetch (không bắt buộc cho 5 thẻ; có thể giữ để không phá type). Không dùng `board.summary` cho tile.

```typescript
const filtered = useMemo(
  () => filterRowsByDepartment(gridRows, deptFilter),
  [gridRows, deptFilter],
);
const filteredPrev = useMemo(
  () => filterRowsByDepartment(prevRows, deptFilter),
  [prevRows, deptFilter],
);
const summary = useMemo(
  () => buildCockpitSummary(filtered, filteredPrev, new Date()),
  [filtered, filteredPrev],
);
```

Select phòng: `departmentOptions(gridRows)` (options từ data *sau team*, trước dept filter).

- [ ] **Step 3: JSX thứ tự**

`DashboardShell` `title="Quản lý KPI"`  
`periodHint={\`Theo dõi mục tiêu, kết quả và cảnh báo hiệu suất · Kỳ ${periodLabel(year, month)}\`}`

Filters: `KpiTeamToggle` · năm · tháng ·

```tsx
<select
  className="kpi-select"
  aria-label="Phòng ban"
  value={deptFilter}
  onChange={(e) => setDeptFilter(e.target.value)}
>
  <option value="all">Tất cả phòng ban</option>
  {departmentOptions(gridRows).map((d) => (
    <option key={d} value={d}>{d}</option>
  ))}
</select>
```

Button `Xuất báo cáo` (`className="btn btn-sm btn-secondary"`, same `onExportExcel`).  
Nếu `canEditKpi`: button `+ Tạo KPI` → `setCreateOpen(true)`.

Children:

```tsx
<div className="kpi-cockpit">
  <KpiCockpitTiles summary={summary} />
  <section className="kpi-page__section kpi-page__section--split">
    <KpiDeptStackChart rows={summary.by_department} />
    <KpiAttentionTable rows={summary.attention} />
  </section>
  <section className="kpi-page__section kpi-cockpit__split">
    <KpiCockpitList
      rows={filtered}
      prevRows={filteredPrev}
      userStaffId={Number.isFinite(Number(user.id)) ? Number(user.id) : null}
    />
    <div>
      <KpiCockpitInsight insight={summary.insight} />
      <KpiRagDonut green={summary.green} yellow={summary.yellow} red={summary.red} />
    </div>
  </section>
  <section className="kpi-page__section">
    <h3 className="kpi-section-title">Nhập actual KPI</h3>
    <KpiEditableGrid ... />
  </section>
  <details className="kpi-page__metrics-details">
    <summary>So sánh NV theo chỉ tiêu</summary>
    {/* KpiBarChart + KpiTrendPanel như cũ */}
  </details>
  <details className="kpi-page__metrics-details">
    <summary className="muted">Danh sách metric định nghĩa ({metrics.length})</summary>
    ...
  </details>
</div>
<KpiCreateMetricDrawer
  open={createOpen}
  token={token}
  onClose={() => setCreateOpen(false)}
  onCreated={() => void onGridSaved()}
/>
```

`token` = `getAccessToken() ?? ''`. `onCreated` gọi lại `loadPage`.

- [ ] **Step 4: Manual sanity**

Run: `cd services/ops-web && npx vitest run src/lib/kpi/`

Expected: PASS.

Mở `/crm/kpi` (dev) — 5 thẻ, bar phòng, tab Tất cả, donut, heading Nhập actual, không tile AI.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/app/crm/kpi/page.tsx services/ops-web/src/components/kpi/DashboardShell.tsx
git commit -m "$(cat <<'EOF'
feat(kpi): render the management cockpit on /crm/kpi.

Period filters drive tiles, department rollup, and the staff list together.
EOF
)"
```

---

### Task 7: E2E

**Files:**
- Modify: `services/ops-web/e2e/kpi-rnos42.spec.ts`
- Modify: `services/ops-web/e2e/kpi-dashboard-rnos43a.spec.ts`
- Create: `services/ops-web/e2e/kpi-cockpit-wave1.spec.ts`
- Không sửa `kpi-grid-rnos44.spec.ts` / `win-2-kpi-vux-07.spec.ts` trừ khi fail vì heading.

- [ ] **Step 1: Sửa spec cũ**

`kpi-rnos42.spec.ts` test `/crm/kpi`:

```typescript
    await expect(page.getByRole('heading', { name: /quản lý kpi/i })).toBeVisible();
    await expect(page.locator('.kpi-dept-stack')).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
```

Bỏ `.kpi-bar-chart` visible trên `/crm/kpi`. Các test business-dashboard / staff-kpi / owner-weekly / financials **không đổi**.

`kpi-dashboard-rnos43a.spec.ts`:

```typescript
    await expect(page.locator('.dashboard-shell')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.kpi-page__section--split')).toBeVisible();
    await expect(page.getByRole('button', { name: /xuất báo cáo/i })).toBeVisible();
    await expect(page.locator('pre')).toHaveCount(0);
```

Bỏ assert `Tỷ lệ chấp nhận AI`.

- [ ] **Step 2: Smoke mới**

`kpi-cockpit-wave1.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { apiReachable, loginAsStaff } from './helpers/ai-copilot-helpers';

test.describe('KPI cockpit Wave 1', () => {
  test.beforeEach(async ({ page, request }) => {
    test.skip(!(await apiReachable(request)), 'Nest API not reachable');
    await loginAsStaff(page);
  });

  test('/crm/kpi shows cockpit tiles, tabs, and donut', async ({ page }) => {
    await page.goto('/crm/kpi');
    await expect(page.getByRole('heading', { name: /quản lý kpi/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.kpi-tile-grid').getByText(/đúng tiến độ/i)).toBeVisible();
    await expect(page.locator('.kpi-tile-grid').getByText(/Cần theo dõi/i)).toBeVisible();
    await expect(page.locator('.kpi-tile-grid').getByText(/Không đạt/i)).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tất cả' })).toBeVisible();
    await expect(page.getByTestId('kpi-rag-donut')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nhập actual KPI/i })).toBeVisible();
  });
});
```

- [ ] **Step 3: Run e2e**

Run: `cd services/ops-web && npx playwright test e2e/kpi-rnos42.spec.ts e2e/kpi-dashboard-rnos43a.spec.ts e2e/kpi-grid-rnos44.spec.ts e2e/win-2-kpi-vux-07.spec.ts e2e/kpi-cockpit-wave1.spec.ts`

Expected: PASS (skip nếu API không reach — như spec cũ). Local có Nest thì không skip.

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/e2e/kpi-rnos42.spec.ts services/ops-web/e2e/kpi-dashboard-rnos43a.spec.ts services/ops-web/e2e/kpi-cockpit-wave1.spec.ts
git commit -m "$(cat <<'EOF'
test(kpi): align e2e with the management cockpit.

Old AI tile and staff bar are no longer the default /crm/kpi chrome.
EOF
)"
```

---

## Spec coverage (tự rà)

| Spec | Task |
|------|------|
| Title / subtitle / filters / Xuất báo cáo / + Tạo KPI | 5, 6 |
| 5 thẻ + Δ tháng trước | 3, 4, 6 |
| RAG 90/75 + lower-is-better | 1, 3 |
| Hạn ngày 5 ICT | 1, 3 |
| Bar phòng + Chưa gắn phòng | 3, 4 |
| Attention ≤8 red→yellow→no_data+target | 3, 4 |
| Tabs Tất cả / Cá nhân / Phòng · 20/trang · không ⋯ | 4, 6 |
| Donut 3 lát, tâm = green+yellow+red | 4 |
| Insight rule + link AI | 3, 4 |
| Grid actual + details chart | 6 |
| `staff_department` + team list | 2 |
| Không schema / LLM / IWR | — out of scope |
| E2E RNOS-42/43A/44 + smoke | 7 |
| `dashboard-shell` class | 6 |

Không còn TBD trong plan.

# KPI Hub Delivery Wave B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Một catalog `/crm/delivery-projects` gộp Dự án PTT + giao hàng: backfill B2B, wizard B1–B3, portfolio §11.4 — không đổi `crm_leads.b2b_project_id`.

**Architecture:** Header `crm_delivery_projects` 1:0..1 `crm_b2b_projects`. Ingest/SLA/webhook giữ module B2B. Pure util (capability, health, circular dep, `PRJ-xxx`) Jest + copy Vitest. ops-web: `KpiHubShell` + class `delivery-*`. Wizard bước 2–3 chỉ khi `capabilities` có `delivery`.

**Tech Stack:** Nest `ptt-crm-api` (Jest), Next.js 14 ops-web (Vitest + Playwright), PostgreSQL, CSS `globals.css` (không Tailwind).

**Spec:** [`docs/superpowers/specs/2026-09-04-kpi-hub-enterprise-rnosai-srs.md`](../specs/2026-09-04-kpi-hub-enterprise-rnosai-srs.md) v1.2 §3 Wave B, §6.0–6.4, §11.0 / 11.4–11.6 / 11.11.

**Worktree lúc implement:** `superpowers:using-git-worktrees` từ `main` sạch.

## Global Constraints

- Wave B only: không Command Center (A), không budget/resource (C), không KPI Dictionary picker (D), không Risk/CR/Capacity CRUD (E).
- Không drop `crm_b2b_projects`. Lead chỉ ghi `b2b_project_id`. Không đụng `crm_re_projects`, `/crm/kpi`, webhook slug cũ.
- Không Tailwind. Class `delivery-*` + tái sử dụng `kpi-hub-*`. Primary `#17692f`. Warning `#c58a00`.
- Copy: **Project Delivery**, **+ Tạo dự án**, **Nhận lead PTT**, **Giao hàng**, **Lưu dự án**, **Tiếp tục: Phạm vi & Dịch vụ**.
- Tab Kanban / Timeline / Capacity / Risk Register: **khung + empty**, không xóa. Gantt **chỉ xem**.
- Không LLM. Không `PTT_IWR_LLM` / `PTT_CSD_LLM`. Không đổi flag `PTT_B2B_PROJECT_OS`.
- `/crm/b2b-projects` → 308 `/crm/delivery-projects?capability=lead_ingest`. API `/api/v1/b2b-projects` giữ.
- Cap: xem catalog = `crm_delivery_projects.view` **hoặc** `crm_b2b_projects.view`. Sửa ingest = `crm_b2b_projects.manage`. Sửa delivery = `crm_delivery_projects.edit`.
- `PTT-LEGACY`: backfill chỉ `lead_ingest`; không bắt wizard 2–5.
- Tiền Wave B: thẻ ngân sách / margin = `—`.

## File map

| File | Role | Task |
|------|------|------|
| Create `services/ptt-crm-api/src/delivery-projects/delivery-projects.util.ts` + `.spec.ts` | capability, health, PRJ code, circular | 1 |
| Create `docs/specs/2026-09-04-postgresql-ddl-delivery-projects.sql` | DDL + backfill SQL | 2 |
| Create `delivery-projects.types.ts` / `repository.ts` / `service.ts` / `controller.ts` / `guards` | API `/api/crm/delivery-projects` | 2–3 |
| Modify `app.module.ts` | Import `DeliveryProjectsModule` | 3 |
| Modify `rbac-admin-catalog.json` | Cap `crm_delivery_projects` | 3 |
| Create `services/ops-web/src/lib/delivery-projects-api.ts` + `delivery-projects.util.ts` + specs | Client + copy health | 4 |
| Modify `kpi-hub-nav.ts` + `KpiHubShell.tsx` | Nhóm nav + Project Delivery | 5 |
| Create `app/crm/delivery-projects/**` + `components/delivery/**` + CSS | Portfolio, wizard, detail | 6–8 |
| Modify `app/crm/b2b-projects/page.tsx` | Redirect 308 | 7 |
| Modify `OpsNav.tsx` | Href Dự án PTT | 7 |
| Create `e2e/delivery-projects-wave-b.spec.ts` | Smoke | 9 |

## Out of scope (reject nếu task thêm)

- Wave A/C/D/E. Tailwind. App shell thứ hai. Badge PRODUCTION giả.
- Gộp bảng B2B. Đổi FK lead. Drag Gantt. Modal ngân sách. Picker Dictionary.

---

### Task 1: Pure util — capability, PRJ code, health, circular dep

**Files:**
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.util.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.util.spec.ts`

**Interfaces:**
- Consumes: không
- Produces:
  - `export type DeliveryCapability = 'lead_ingest' | 'delivery'`
  - `export type DeliveryProjectStatus = 'draft' | 'pending_approval' | 'approved' | 'active' | 'on_hold' | 'completed' | 'closed' | 'cancelled'`
  - `export type DeliveryHealth = 'stable' | 'needs_attention' | 'at_risk' | 'overdue' | 'no_data'`
  - `export type IngestStatus = 'draft' | 'active' | 'paused' | 'archived'`
  - `export function normalizeCapabilities(raw: unknown): DeliveryCapability[]`
  - `export function hasCapability(caps: DeliveryCapability[], cap: DeliveryCapability): boolean`
  - `export function nextPrjCode(existingCodes: string[]): string`
  - `export function hasCircularMilestoneDeps(edges: Array<{ from: string; to: string }>): boolean`
  - `export function deriveDeliveryHealth(input: { capabilities: DeliveryCapability[]; ingestStatus?: IngestStatus | null; todayIso: string; milestones: Array<{ due_date: string; status: string }> }): { health: DeliveryHealth; components: { schedule: string; milestone: string } }`

- [ ] **Step 1: Write the failing test**

```typescript
import {
  deriveDeliveryHealth,
  hasCircularMilestoneDeps,
  normalizeCapabilities,
  nextPrjCode,
} from './delivery-projects.util';

describe('normalizeCapabilities', () => {
  it('dedupes and drops unknown', () => {
    expect(normalizeCapabilities(['delivery', 'lead_ingest', 'delivery', 'x'])).toEqual([
      'lead_ingest',
      'delivery',
    ]);
    expect(normalizeCapabilities([])).toEqual([]);
  });
});

describe('nextPrjCode', () => {
  it('increments the max PRJ number', () => {
    expect(nextPrjCode([])).toBe('PRJ-001');
    expect(nextPrjCode(['PRJ-001', 'PTT-LEGACY', 'PRJ-025'])).toBe('PRJ-026');
  });
});

describe('hasCircularMilestoneDeps', () => {
  it('detects a cycle', () => {
    expect(hasCircularMilestoneDeps([{ from: 'M1', to: 'M2' }, { from: 'M2', to: 'M1' }])).toBe(true);
    expect(hasCircularMilestoneDeps([{ from: 'M1', to: 'M2' }, { from: 'M2', to: 'M3' }])).toBe(false);
  });
});

describe('deriveDeliveryHealth', () => {
  it('lead-only uses ingest status', () => {
    expect(
      deriveDeliveryHealth({
        capabilities: ['lead_ingest'],
        ingestStatus: 'active',
        todayIso: '2026-09-04',
        milestones: [],
      }).health,
    ).toBe('stable');
    expect(
      deriveDeliveryHealth({
        capabilities: ['lead_ingest'],
        ingestStatus: 'paused',
        todayIso: '2026-09-04',
        milestones: [],
      }).health,
    ).toBe('needs_attention');
  });

  it('delivery overdue when a planned milestone is past due', () => {
    const out = deriveDeliveryHealth({
      capabilities: ['delivery'],
      todayIso: '2026-09-04',
      milestones: [{ due_date: '2026-09-01', status: 'planned' }],
    });
    expect(out.health).toBe('overdue');
  });

  it('delivery no_data without milestones', () => {
    expect(
      deriveDeliveryHealth({
        capabilities: ['delivery'],
        todayIso: '2026-09-04',
        milestones: [],
      }).health,
    ).toBe('no_data');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/delivery-projects/delivery-projects.util.spec.ts --no-coverage`

Expected: FAIL — cannot find module.

- [ ] **Step 3: Write minimal implementation**

```typescript
export type DeliveryCapability = 'lead_ingest' | 'delivery';
export type DeliveryProjectStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'closed'
  | 'cancelled';
export type DeliveryHealth = 'stable' | 'needs_attention' | 'at_risk' | 'overdue' | 'no_data';
export type IngestStatus = 'draft' | 'active' | 'paused' | 'archived';

const CAPS: DeliveryCapability[] = ['lead_ingest', 'delivery'];

export function normalizeCapabilities(raw: unknown): DeliveryCapability[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: DeliveryCapability[] = [];
  for (const item of list) {
    if (CAPS.includes(item as DeliveryCapability) && !out.includes(item as DeliveryCapability)) {
      out.push(item as DeliveryCapability);
    }
  }
  return out;
}

export function hasCapability(caps: DeliveryCapability[], cap: DeliveryCapability): boolean {
  return caps.includes(cap);
}

export function nextPrjCode(existingCodes: string[]): string {
  let max = 0;
  for (const code of existingCodes) {
    const m = /^PRJ-(\d+)$/i.exec(code.trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PRJ-${String(max + 1).padStart(3, '0')}`;
}

export function hasCircularMilestoneDeps(edges: Array<{ from: string; to: string }>): boolean {
  const graph = new Map<string, string[]>();
  for (const e of edges) {
    if (e.from === e.to) return true;
    const list = graph.get(e.from) ?? [];
    list.push(e.to);
    graph.set(e.from, list);
  }
  const visiting = new Set<string>();
  const done = new Set<string>();
  const visit = (node: string): boolean => {
    if (done.has(node)) return false;
    if (visiting.has(node)) return true;
    visiting.add(node);
    for (const nxt of graph.get(node) ?? []) {
      if (visit(nxt)) return true;
    }
    visiting.delete(node);
    done.add(node);
    return false;
  };
  for (const key of graph.keys()) {
    if (visit(key)) return true;
  }
  return false;
}

export function deriveDeliveryHealth(input: {
  capabilities: DeliveryCapability[];
  ingestStatus?: IngestStatus | null;
  todayIso: string;
  milestones: Array<{ due_date: string; status: string }>;
}): { health: DeliveryHealth; components: { schedule: string; milestone: string } } {
  const caps = normalizeCapabilities(input.capabilities);
  const hasDelivery = caps.includes('delivery');
  if (!hasDelivery) {
    const ingest = input.ingestStatus ?? 'draft';
    if (ingest === 'active') return { health: 'stable', components: { schedule: 'ingest_active', milestone: 'n/a' } };
    if (ingest === 'paused') {
      return { health: 'needs_attention', components: { schedule: 'ingest_paused', milestone: 'n/a' } };
    }
    return { health: 'no_data', components: { schedule: `ingest_${ingest}`, milestone: 'n/a' } };
  }
  if (input.milestones.length === 0) {
    return { health: 'no_data', components: { schedule: 'no_milestones', milestone: 'none' } };
  }
  const today = input.todayIso.slice(0, 10);
  const open = input.milestones.filter((m) => m.status !== 'completed' && m.status !== 'cancelled');
  if (open.some((m) => m.due_date.slice(0, 10) < today)) {
    return { health: 'overdue', components: { schedule: 'past_due', milestone: 'overdue' } };
  }
  const plus3 = new Date(`${today}T00:00:00.000Z`);
  plus3.setUTCDate(plus3.getUTCDate() + 3);
  const limit = plus3.toISOString().slice(0, 10);
  if (open.some((m) => m.due_date.slice(0, 10) <= limit)) {
    return { health: 'needs_attention', components: { schedule: 'buffer_lt_3d', milestone: 'soon' } };
  }
  return { health: 'stable', components: { schedule: 'on_track', milestone: 'ok' } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/ptt-crm-api && npx jest src/delivery-projects/delivery-projects.util.spec.ts --no-coverage`

Expected: PASS (4 describe).

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/delivery-projects/delivery-projects.util.ts \
  services/ptt-crm-api/src/delivery-projects/delivery-projects.util.spec.ts
git commit -m "$(cat <<'EOF'
feat(delivery): add capability, health, and milestone-dep helpers.

EOF
)"
```

---

### Task 2: DDL + repository list / backfill / next code

**Files:**
- Create: `docs/specs/2026-09-04-postgresql-ddl-delivery-projects.sql`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.types.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.repository.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.repository.spec.ts`

**Interfaces:**
- Consumes: types + `nextPrjCode` / `normalizeCapabilities` / `deriveDeliveryHealth` (Task 1)
- Produces:
  - `DeliveryProjectRow` (header + optional ingest fields)
  - `DeliveryProjectsRepository.list(filters)` / `getById` / `insertHeader` / `backfillFromB2b` / `listPrjCodes` / `listMilestones` / `replaceServices` / `replaceDeliverables` / `replaceMilestones`

- [ ] **Step 1: Write the failing repository test** (mock `query`)

```typescript
import { DeliveryProjectsRepository } from './delivery-projects.repository';

describe('DeliveryProjectsRepository.backfillFromB2b', () => {
  it('inserts a header per missing b2b row and skips existing', async () => {
    const calls: string[] = [];
    const db = {
      query: jest.fn(async (sql: string) => {
        calls.push(sql);
        if (sql.includes('FROM crm_b2b_projects b')) {
          return {
            rows: [
              { id: 'bbbb0001-0000-4000-8000-000000000001', code: 'PTT-LEGACY', name: 'PTT Legacy (backfill)', status: 'paused' },
            ],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
    };
    const repo = new DeliveryProjectsRepository(db as never);
    const out = await repo.backfillFromB2b(1);
    expect(out.inserted).toBe(1);
    expect(calls.some((s) => s.includes('INSERT INTO crm_delivery_projects'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/delivery-projects/delivery-projects.repository.spec.ts --no-coverage`

Expected: FAIL — repository not found.

- [ ] **Step 3: Write DDL** (`docs/specs/2026-09-04-postgresql-ddl-delivery-projects.sql`)

```sql
BEGIN;

CREATE TABLE IF NOT EXISTS crm_delivery_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  code TEXT UNIQUE,
  name TEXT NOT NULL,
  capabilities TEXT[] NOT NULL DEFAULT ARRAY['delivery']::TEXT[],
  b2b_project_id UUID UNIQUE REFERENCES crm_b2b_projects (id),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','active','on_hold','completed','closed','cancelled')),
  customer_id BIGINT,
  agency_client_id BIGINT,
  lead_id BIGINT,
  contract_id BIGINT,
  lifecycle_id BIGINT,
  project_type TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'normal',
  pm_staff_id INT,
  am_staff_id INT,
  start_date DATE,
  end_date DATE,
  description TEXT NOT NULL DEFAULT '',
  health_status TEXT NOT NULL DEFAULT 'no_data',
  health_components_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_version INT NOT NULL DEFAULT 0,
  created_by_staff_id INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_delivery_project_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (project_id, service_code)
);

CREATE TABLE IF NOT EXISTS crm_delivery_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity TEXT NOT NULL DEFAULT '',
  acceptance TEXT NOT NULL DEFAULT '',
  owner_staff_id INT,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS crm_delivery_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  due_date DATE,
  owner_staff_id INT,
  status TEXT NOT NULL DEFAULT 'planned',
  acceptance TEXT NOT NULL DEFAULT '',
  weight NUMERIC,
  UNIQUE (project_id, code)
);

CREATE TABLE IF NOT EXISTS crm_delivery_milestone_deps (
  project_id UUID NOT NULL REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  from_code TEXT NOT NULL,
  to_code TEXT NOT NULL,
  PRIMARY KEY (project_id, from_code, to_code),
  CHECK (from_code <> to_code)
);

CREATE TABLE IF NOT EXISTS crm_delivery_wizard_drafts (
  project_id UUID PRIMARY KEY REFERENCES crm_delivery_projects (id) ON DELETE CASCADE,
  step INT NOT NULL DEFAULT 1,
  state_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO crm_delivery_projects (name, capabilities, b2b_project_id, status, health_status, pm_staff_id)
SELECT b.name,
       ARRAY['lead_ingest']::TEXT[],
       b.id,
       'draft',
       CASE WHEN b.status = 'active' THEN 'stable' WHEN b.status = 'paused' THEN 'needs_attention' ELSE 'no_data' END,
       NULL
FROM crm_b2b_projects b
WHERE b.id NOT IN (SELECT b2b_project_id FROM crm_delivery_projects WHERE b2b_project_id IS NOT NULL)
ON CONFLICT (b2b_project_id) DO NOTHING;

COMMIT;
```

- [ ] **Step 4: Types + repository**

`delivery-projects.types.ts`:

```typescript
import type { DeliveryCapability, DeliveryHealth, DeliveryProjectStatus, IngestStatus } from './delivery-projects.util';

export type { DeliveryCapability, DeliveryHealth, DeliveryProjectStatus, IngestStatus };

export type DeliveryProjectRow = {
  id: string;
  tenant_id: string;
  code: string | null;
  name: string;
  capabilities: DeliveryCapability[];
  b2b_project_id: string | null;
  status: DeliveryProjectStatus;
  customer_id: number | null;
  project_type: string;
  priority: string;
  pm_staff_id: number | null;
  am_staff_id: number | null;
  start_date: string | null;
  end_date: string | null;
  description: string;
  health_status: DeliveryHealth;
  health_components_json: Record<string, unknown>;
  row_version: number;
  ingest_status?: IngestStatus | null;
  ingest_code?: string | null;
};

export type DeliveryListFilters = {
  capability?: 'all' | 'lead_ingest' | 'delivery' | 'both';
  q?: string;
  status?: string;
};

export type CreateDeliveryBody = {
  name: string;
  capabilities: DeliveryCapability[];
  ingest_code?: string;
  customer_id?: number | null;
  project_type?: string;
  priority?: string;
  pm_staff_id?: number | null;
  am_staff_id?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  description?: string;
  b2b?: {
    code: string;
    name?: string;
    status?: IngestStatus;
    ai_call_enabled?: boolean;
    manual_ingest_enabled?: boolean;
  };
};

export const DELIVERY_SERVICE_CATALOG = [
  { code: 'performance_marketing', name: 'Performance Marketing' },
  { code: 'landing_cro', name: 'Landing Page & CRO' },
  { code: 'crm_automation', name: 'CRM Automation' },
  { code: 'creative_production', name: 'Creative Production' },
  { code: 'seo_content', name: 'SEO & Content' },
  { code: 'website', name: 'Website Development' },
  { code: 'branding', name: 'Branding' },
  { code: 'training', name: 'Training & Consulting' },
] as const;
```

Repository: inject cùng `PgPool` pattern như `b2b-projects.repository.ts` (đọc file đó, copy constructor). `list` LEFT JOIN `crm_b2b_projects` lấy `status AS ingest_status`, `code AS ingest_code`. Filter capability:

- `lead_ingest`: `'lead_ingest' = ANY(capabilities)`
- `delivery`: `'delivery' = ANY(capabilities)`
- `both`: cả hai
- `all`: không lọc

`backfillFromB2b(actorStaffId)`: SELECT B2B chưa có header → INSERT như DDL. Trả `{ inserted: number }`.

`listPrjCodes()`: `SELECT code FROM crm_delivery_projects WHERE code IS NOT NULL`.

- [ ] **Step 5: Run repository test**

Run: `cd services/ptt-crm-api && npx jest src/delivery-projects/delivery-projects.repository.spec.ts --no-coverage`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/specs/2026-09-04-postgresql-ddl-delivery-projects.sql \
  services/ptt-crm-api/src/delivery-projects/delivery-projects.types.ts \
  services/ptt-crm-api/src/delivery-projects/delivery-projects.repository.ts \
  services/ptt-crm-api/src/delivery-projects/delivery-projects.repository.spec.ts
git commit -m "$(cat <<'EOF'
feat(delivery): add header DDL and repository backfill.

EOF
)"
```

---

### Task 3: Service, guards, RBAC, HTTP

**Files:**
- Create: `services/ptt-crm-api/src/delivery-projects/guards/staff-delivery-projects.guard.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.service.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.service.spec.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.controller.ts`
- Create: `services/ptt-crm-api/src/delivery-projects/delivery-projects.module.ts`
- Modify: `services/ptt-crm-api/src/app.module.ts` (thêm `DeliveryProjectsModule` cạnh `B2bProjectsModule`)
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` — actions + module + SUPER-ADMIN list

**Interfaces:**
- Consumes: repository + `B2bProjectsService.create` khi `lead_ingest`
- Produces:
  - `GET/POST /api/crm/delivery-projects`
  - `GET/PATCH /api/crm/delivery-projects/:id`
  - `POST /api/crm/delivery-projects/backfill`
  - `PUT /api/crm/delivery-projects/:id/wizard` body `{ step, services?, deliverables?, milestones?, deps? }`
  - `POST /api/crm/delivery-projects/:id/milestones/validate-deps`

Guard: copy `staff-b2b-projects.guard.ts`. View: `hasCap(..., 'crm_delivery_projects', 'view') || hasCap(..., 'crm_b2b_projects', 'view')`. Edit: `crm_delivery_projects.edit`. Manage: `crm_delivery_projects.manage`. Backfill: manage.

- [ ] **Step 1: Write service failing tests**

```typescript
import { BadRequestException } from '@nestjs/common';
import { DeliveryProjectsService } from './delivery-projects.service';

describe('DeliveryProjectsService.create', () => {
  it('rejects empty capabilities', async () => {
    const svc = new DeliveryProjectsService(
      { insertHeader: jest.fn(), listPrjCodes: jest.fn().mockResolvedValue([]) } as never,
      { create: jest.fn() } as never,
    );
    await expect(svc.create({ name: 'X', capabilities: [] }, 1)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates b2b facet then header when lead_ingest is on', async () => {
    const b2b = { create: jest.fn().mockResolvedValue({ id: 'b2b-1', code: 'an-gia' }) };
    const repo = {
      listPrjCodes: jest.fn().mockResolvedValue([]),
      insertHeader: jest.fn().mockResolvedValue({ id: 'd1', code: null, capabilities: ['lead_ingest'] }),
    };
    const svc = new DeliveryProjectsService(repo as never, b2b as never);
    await svc.create({ name: 'An Gia', capabilities: ['lead_ingest'], b2b: { code: 'an-gia' } }, 9);
    expect(b2b.create).toHaveBeenCalled();
    expect(repo.insertHeader).toHaveBeenCalledWith(
      expect.objectContaining({ b2b_project_id: 'b2b-1', code: null, capabilities: ['lead_ingest'] }),
    );
  });

  it('assigns PRJ code when delivery is on', async () => {
    const repo = {
      listPrjCodes: jest.fn().mockResolvedValue(['PRJ-001']),
      insertHeader: jest.fn().mockResolvedValue({ id: 'd2', code: 'PRJ-002' }),
    };
    const svc = new DeliveryProjectsService(repo as never, { create: jest.fn() } as never);
    await svc.create({ name: 'Deliv', capabilities: ['delivery'], pm_staff_id: 1 }, 1);
    expect(repo.insertHeader).toHaveBeenCalledWith(expect.objectContaining({ code: 'PRJ-002' }));
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd services/ptt-crm-api && npx jest src/delivery-projects/delivery-projects.service.spec.ts --no-coverage`

- [ ] **Step 3: Implement service + HTTP**

`create`:
1. `caps = normalizeCapabilities(body.capabilities)`; nếu `caps.length === 0` → 400 `capabilities_required`.
2. Nếu `lead_ingest`: bắt buộc `body.b2b.code`; gọi `b2bProjects.create({ code, name: body.name, ... })`. Thiếu cap manage B2B → 403 (service kiểm `hasCap` nếu inject StaffAuth, hoặc để guard riêng trên nhánh — **chốt:** controller gọi B2B create chỉ khi user có `crm_b2b_projects.manage`; không thì 403 `missing_cap` section b2b).
3. Nếu `delivery`: `code = nextPrjCode(await repo.listPrjCodes())`; bắt buộc `name` ≥ 3 ký tự; `pm_staff_id` required.
4. `insertHeader` với `b2b_project_id` nếu có. Status `draft`. Health từ `deriveDeliveryHealth`.
5. Chỉ ingest: không set `code` PRJ.

`saveWizard(id, body)`:
- Load row. Nếu `step >= 2` và không có `delivery` → 400 `delivery_required`.
- `deps` → `hasCircularMilestoneDeps` true → 400 `circular_milestone_deps`.
- Recalc health sau milestone.

Controller:

```typescript
@Controller('api/crm/delivery-projects')
@UseGuards(StaffOrInternalKeyGuard)
export class DeliveryProjectsController {
  @Get() @UseGuards(StaffDeliveryProjectsViewGuard)
  list(@Query('capability') capability?: string, @Query('q') q?: string, @Query('status') status?: string) {
    return this.svc.list({ capability, q, status });
  }
  // POST create, GET :id, PATCH :id, POST backfill, PUT :id/wizard, POST :id/milestones/validate-deps
}
```

RBAC `rbac-admin-catalog.json`:
- `"crm_delivery_projects": ["view", "edit", "manage"]`
- Module entry `page: "/crm/delivery-projects"`
- Thêm `"crm_delivery_projects"` vào mảng SUPER-ADMIN (cạnh `crm_kpi_hub`).

`app.module.ts`: `imports: [..., DeliveryProjectsModule]`.

Module imports `B2bProjectsModule` (đã export service — nếu chưa export `B2bProjectsService`, thêm vào `exports` của `b2b-projects.module.ts`).

- [ ] **Step 4: Tests pass**

Run: `cd services/ptt-crm-api && npx jest src/delivery-projects --no-coverage`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/delivery-projects \
  services/ptt-crm-api/src/app.module.ts \
  services/ptt-crm-api/src/b2b-projects/b2b-projects.module.ts \
  services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json
git commit -m "$(cat <<'EOF'
feat(delivery): expose catalog API and RBAC caps.

EOF
)"
```

---

### Task 4: ops-web API + util (copy health)

**Files:**
- Create: `services/ops-web/src/lib/delivery-projects.util.ts`
- Create: `services/ops-web/src/lib/delivery-projects.util.spec.ts`
- Create: `services/ops-web/src/lib/delivery-projects-api.ts`

**Interfaces:**
- Consumes: cùng signature Task 1 (copy tay, không shared package)
- Produces: `fetchDeliveryProjects`, `createDeliveryProject`, `fetchDeliveryProject`, `patchDeliveryProject`, `saveDeliveryWizard`, `validateDeliveryDeps`, `backfillDeliveryProjects`

- [ ] **Step 1: Vitest copy `nextPrjCode` / `hasCircularMilestoneDeps` / `deriveDeliveryHealth`** (cùng case Task 1)

- [ ] **Step 2: Run**

Run: `cd services/ops-web && npx vitest run src/lib/delivery-projects.util.spec.ts`

Expected: FAIL rồi PASS sau implement.

- [ ] **Step 3: API client** — copy `b2bFetch` pattern, base `/api/crm/delivery-projects`.

```typescript
export async function fetchDeliveryProjects(
  token: string,
  query: { capability?: string; q?: string; status?: string } = {},
): Promise<{ items: DeliveryProjectRow[] }> { /* GET */ }

export async function createDeliveryProject(token: string, body: CreateDeliveryBody): Promise<DeliveryProjectRow> { /* POST */ }
```

Types: export lại field giống `DeliveryProjectRow` API (camel không đổi — API trả snake_case như B2B).

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/lib/delivery-projects.util.ts \
  services/ops-web/src/lib/delivery-projects.util.spec.ts \
  services/ops-web/src/lib/delivery-projects-api.ts
git commit -m "$(cat <<'EOF'
feat(delivery): add ops-web client and health helpers.

EOF
)"
```

---

### Task 5: Hub sidebar — nhóm + Project Delivery

**Files:**
- Modify: `services/ops-web/src/lib/kpi-hub-nav.ts`
- Modify: `services/ops-web/src/lib/kpi-hub-nav.spec.ts`
- Modify: `services/ops-web/src/components/kpi-hub/KpiHubShell.tsx`

**Interfaces:**
- Consumes: routes Hub hiện có
- Produces: `KPI_HUB_NAV_GROUPS`, `isKpiHubPath` gồm `/crm/delivery-projects`

**Không** thêm `/crm/kpi-hub/executive|marketing|sales` (Wave A). Tổng quan Wave B: `Dashboard` (`/crm/kpi-hub`) + `Project Delivery`.

- [ ] **Step 1: Update nav spec**

```typescript
import { KPI_HUB_NAV_GROUPS, isKpiHubPath } from './kpi-hub-nav';

it('groups overview + governance + analysis and includes Project Delivery', () => {
  expect(KPI_HUB_NAV_GROUPS.map((g) => g.label)).toEqual(['TỔNG QUAN', 'GOVERNANCE', 'PHÂN TÍCH']);
  expect(KPI_HUB_NAV_GROUPS[0].items.map((i) => i.href)).toEqual([
    '/crm/kpi-hub',
    '/crm/delivery-projects',
  ]);
  expect(isKpiHubPath('/crm/delivery-projects/new')).toBe(true);
});
```

- [ ] **Step 2: Run — FAIL**

Run: `cd services/ops-web && npx vitest run src/lib/kpi-hub-nav.spec.ts`

- [ ] **Step 3: Implement groups**

```typescript
export type KpiHubNavGroup = { id: string; label: string; items: KpiHubNavItem[] };

export const KPI_HUB_NAV_GROUPS: KpiHubNavGroup[] = [
  {
    id: 'overview',
    label: 'TỔNG QUAN',
    items: [
      { href: '/crm/kpi-hub', label: 'Dashboard', icon: 'dashboard' },
      { href: '/crm/delivery-projects', label: 'Project Delivery', icon: 'dashboard' },
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
    ],
  },
  {
    id: 'analysis',
    label: 'PHÂN TÍCH',
    items: [
      { href: '/crm/kpi-hub/reports', label: 'Báo cáo', icon: 'chart' },
      { href: '/crm/kpi-hub/settings', label: 'Cài đặt', icon: 'gear' },
    ],
  },
];

export const KPI_HUB_NAV = KPI_HUB_NAV_GROUPS.flatMap((g) => g.items);

export function isKpiHubPath(pathname: string): boolean {
  return (
    pathname === '/crm/kpi-hub' ||
    pathname.startsWith('/crm/kpi-hub/') ||
    pathname === '/crm/delivery-projects' ||
    pathname.startsWith('/crm/delivery-projects/')
  );
}
```

`KpiHubShell`: map `KPI_HUB_NAV_GROUPS` — heading nhóm + link. Active: `activeKpiHubHref` (ưu tiên path dài hơn — `/crm/delivery-projects` thắng `/crm/kpi-hub` khi so length).

- [ ] **Step 4: Vitest PASS**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/kpi-hub-nav.ts services/ops-web/src/lib/kpi-hub-nav.spec.ts \
  services/ops-web/src/components/kpi-hub/KpiHubShell.tsx
git commit -m "$(cat <<'EOF'
feat(kpi-hub): add Project Delivery to grouped Hub sidebar.

EOF
)"
```

---

### Task 6: Portfolio UI §11.4

**Files:**
- Create: `services/ops-web/src/app/crm/delivery-projects/page.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryPortfolioTiles.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryPortfolioGantt.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryPortfolioTable.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryEmptyPanel.tsx`
- Modify: `services/ops-web/src/app/globals.css` — block `.delivery-*`
- Create: `services/ops-web/src/lib/delivery-portfolio-summary.ts` + `.spec.ts`

**Interfaces:**
- Consumes: `fetchDeliveryProjects`, `deriveDeliveryHealth` labels
- Produces: `buildPortfolioSummary(rows) => { total, on_track, at_risk, overdue, ingest_active, budget_used: null, margin: null }`

- [ ] **Step 1: Vitest summary**

```typescript
import { buildPortfolioSummary } from './delivery-portfolio-summary';

it('counts health and ingest', () => {
  const s = buildPortfolioSummary([
    { health_status: 'stable', capabilities: ['lead_ingest'], ingest_status: 'active' },
    { health_status: 'overdue', capabilities: ['delivery'], ingest_status: null },
    { health_status: 'needs_attention', capabilities: ['delivery'], ingest_status: null },
  ]);
  expect(s.total).toBe(3);
  expect(s.on_track).toBe(1);
  expect(s.overdue).toBe(1);
  expect(s.at_risk).toBe(1);
  expect(s.ingest_active).toBe(1);
  expect(s.budget_used).toBeNull();
  expect(s.margin).toBeNull();
});
```

- [ ] **Step 2: FAIL then implement**

```typescript
export function buildPortfolioSummary(
  rows: Array<{ health_status: string; capabilities?: string[]; ingest_status?: string | null }>,
) {
  return {
    total: rows.length,
    on_track: rows.filter((r) => r.health_status === 'stable').length,
    at_risk: rows.filter((r) => r.health_status === 'at_risk' || r.health_status === 'needs_attention').length,
    overdue: rows.filter((r) => r.health_status === 'overdue').length,
    ingest_active: rows.filter((r) => r.ingest_status === 'active').length,
    budget_used: null as number | null,
    margin: null as number | null,
  };
}
```

- [ ] **Step 3: Page layout** (gate: `crm_delivery_projects.view` || `crm_b2b_projects.view`)

`KpiHubShell` title `Project Delivery` subtitle `Danh mục dự án, tiến độ, ngân sách, nguồn lực và rủi ro bàn giao.`

Actions: kỳ tháng (local state, Wave B không filter server theo tháng) · select khách (disabled “Tất cả”) · **Xuất báo cáo** (disabled title “Wave C”) · Link **+ Tạo dự án** → `/crm/delivery-projects/new`.

Chips: Status · **Năng lực** `all|lead_ingest|delivery|both` (query `?capability=`) · Xóa bộ lọc.

Khối bắt buộc (`data-testid`):
- `delivery-tiles` — 6 thẻ: Tổng dự án · Đúng tiến độ `{on_track}/{total}` · Có rủi ro · Quá hạn · Ngân sách đã dùng `—` · Biên lợi nhuận `—`. Thẻ phụ: `{ingest_active} đang nhận lead`.
- `delivery-gantt` — tab Timeline (bars từ `start_date`/`end_date` nếu có; không drag) · Workload / Theo PM = `DeliveryEmptyPanel` CTA Wave E.
- `delivery-health-donut` — đếm stable / needs_attention / at_risk+overdue / no_data. Nút `Xem Risk Register` → empty panel.
- `delivery-budget-chart` — empty `Chưa có ngân sách`.
- `delivery-risks` — empty + `Xem Delivery Planning`.
- `delivery-catalog` — tab Danh sách (bảng) · Kanban · Timeline · Capacity (3 tab empty). Cột: Mã (`code` hoặc `ingest_code`) · Tên · Khách `—` · Năng lực pills · Dịch vụ `—` Wave B list từ services nếu load detail omit — Wave B list API có thể trả `service_codes: string[]` optional, không bắt. · PM · Progress `—` · Milestone `—` · Budget `—` · Forecast `—` · Margin `—` · Hạn · Health · Ingest · link chi tiết.
- `delivery-capacity` / `delivery-quality` — empty khung.

CSS: `.delivery-tile-grid` 6 cột desktop, 2 cột &lt;800px; `.delivery-split`; pills Lead `#17692f` / Giao hàng `#2563EB`.

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/app/crm/delivery-projects \
  services/ops-web/src/components/delivery \
  services/ops-web/src/lib/delivery-portfolio-summary.ts \
  services/ops-web/src/lib/delivery-portfolio-summary.spec.ts \
  services/ops-web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat(delivery): render unified Project Delivery portfolio.

EOF
)"
```

---

### Task 7: Wizard B1 + redirect B2B + OpsNav

**Files:**
- Create: `services/ops-web/src/app/crm/delivery-projects/new/page.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryWizardStepper.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryWizardB1.tsx`
- Modify: `services/ops-web/src/app/crm/b2b-projects/page.tsx` — `redirect` đầu file
- Modify: `services/ops-web/src/app/crm/b2b-projects/[id]/page.tsx` — redirect `/crm/delivery-projects/{headerId}` **hoặc** `/crm/delivery-projects?capability=lead_ingest` nếu chưa resolve; Wave B: `redirect('/crm/delivery-projects?capability=lead_ingest')`
- Modify: `services/ops-web/src/components/OpsNav.tsx` — href `Dự án PTT` → `/crm/delivery-projects?capability=lead_ingest`

**Interfaces:**
- Consumes: `createDeliveryProject`, `CreateB2bProjectBody` fields
- Produces: stepper 5 bước; B1 toggles; chỉ ingest → list; có delivery → `?id=&step=2`

- [ ] **Step 1: Stepper presentational — không test bắt buộc; page logic: tối thiểu 1 vitest cho “footer CTA”**

Create `services/ops-web/src/lib/delivery-wizard.util.ts` + spec:

```typescript
export function wizardFooter(caps: Array<'lead_ingest' | 'delivery'>): {
  primary: 'save' | 'continue_scope';
  showSteps2to5: boolean;
} {
  const delivery = caps.includes('delivery');
  return { primary: delivery ? 'continue_scope' : 'save', showSteps2to5: delivery };
}
```

Test: `[]` → save false; `['lead_ingest']` → save false; `['delivery']` → continue true.

- [ ] **Step 2: FAIL / implement / PASS**

- [ ] **Step 3: UI B1**

Stepper labels đúng spec: Thông tin cơ bản · Phạm vi & Dịch vụ · Kế hoạch & Milestone · Ngân sách & Nguồn lực · KPI & Xác nhận. Bước 4–5 click → toast `Wave C/D`.

Hai toggle (mặc định: `lead_ingest` nếu có cap B2B manage; `delivery` nếu có `crm_delivery_projects.edit`). ≥1 bắt buộc.

Fields: Tên · Slug (nếu ingest) · Code PRJ `Tự cấp khi lưu` (readonly, ẩn nếu không delivery) · Khách (required nếu delivery — select `crm_customers` nếu đã có fetch; **không có API sẵn** → input number `customer_id` optional Wave B, label “ID khách (tùy chọn)”) · Loại · Dịch vụ multi (catalog const) · PM number · AM · Ưu tiên · ngày · mô tả.

Khối Nhận lead: `ai_call_enabled`, `manual_ingest_enabled` checkbox (kênh Page/OA = sau khi có `b2b_project_id` — link “Cấu hình kênh” → tab detail; Wave B không nhúng full modal kênh trên B1).

Nút: **Lưu nháp** / **Hủy** → list. Primary theo `wizardFooter`.

`b2b-projects/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
export default function B2bProjectsRedirectPage() {
  redirect('/crm/delivery-projects?capability=lead_ingest');
}
```

Xóa client list cũ khỏi page này (tránh double fetch). Detail `[id]/page.tsx` redirect cùng URL list (Wave B chưa map b2b id → header trên client không cần; user mở từ catalog).

OpsNav: `href: '/crm/delivery-projects?capability=lead_ingest'`.

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/app/crm/delivery-projects/new \
  services/ops-web/src/components/delivery/DeliveryWizardStepper.tsx \
  services/ops-web/src/components/delivery/DeliveryWizardB1.tsx \
  services/ops-web/src/lib/delivery-wizard.util.ts \
  services/ops-web/src/lib/delivery-wizard.util.spec.ts \
  services/ops-web/src/app/crm/b2b-projects \
  services/ops-web/src/components/OpsNav.tsx
git commit -m "$(cat <<'EOF'
feat(delivery): add B1 wizard and retire B2B list route.

EOF
)"
```

---

### Task 8: Wizard B2–B3 + detail tabs

**Files:**
- Create: `services/ops-web/src/app/crm/delivery-projects/[id]/page.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryWizardB2.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryWizardB3.tsx`
- Create: `services/ops-web/src/components/delivery/DeliveryDetailTabs.tsx`
- Create: `services/ops-web/src/lib/delivery-conflicts.ts` + `.spec.ts`

**Interfaces:**
- Consumes: `saveDeliveryWizard`, `validateDeliveryDeps`, `DELIVERY_SERVICE_CATALOG`
- Produces: B2/B3 UI; detail tabs; `detectScopeConflicts(serviceCodes: string[]): string[]`

- [ ] **Step 1: Conflict helper test**

```typescript
import { detectScopeConflicts } from './delivery-conflicts';

it('flags creative without brand note and crm without access note', () => {
  expect(detectScopeConflicts(['creative_production'])).toContain('creative_missing_brand_guideline');
  expect(detectScopeConflicts(['crm_automation'])).toContain('crm_access_unconfirmed');
  expect(detectScopeConflicts(['performance_marketing'])).toEqual([]);
});
```

```typescript
export function detectScopeConflicts(serviceCodes: string[]): string[] {
  const out: string[] = [];
  if (serviceCodes.includes('creative_production')) out.push('creative_missing_brand_guideline');
  if (serviceCodes.includes('crm_automation')) out.push('crm_access_unconfirmed');
  return out;
}
```

(Wave B: warning tĩnh khi chọn service — user tick “đã có guideline” trên checkbox B2 để dismiss trong `state_json.dismissed_conflicts`.)

- [ ] **Step 2: B2 UI** (`new?id=&step=2` hoặc `[id]?wizard=2`)

8 card catalog. Chọn → append deliverable mặc định `{ service_code, name: 'Hạng mục ' + catalog.name, quantity: '1', acceptance: '' }`. Bảng: dịch vụ · hạng mục · SL · nghiệm thu · PIC (number) · xóa. Hai textarea ngoài phạm vi / giả định (lưu `wizard_drafts.state_json`). Rail: đếm dịch vụ · checklist · conflicts. Footer `Quay lại: Thông tin cơ bản` · `Tiếp tục: Kế hoạch & Milestone`. PUT wizard `step:2`.

Nếu project không có `delivery` → redirect step 1.

- [ ] **Step 3: B3 UI**

Fields: start/end (prefill header) · method `Theo Milestone` · lịch `Thứ Hai – Thứ Sáu` · toggle auto-schedule **tắt**. Bảng milestone: code `M1`… · tên · start · due · Planned · deps (chuỗi `M1,M2`) · owner. Nút + milestone. Gantt xem: bar theo start/due, không drag. `validateDeliveryDeps` trước next — 400 hiện inline `Phụ thuộc vòng`. Rail: số ngày · path codes · badge Khả thi nếu không circular. Footer `Quay lại: Phạm vi` · `Tiếp tục: Ngân sách` → toast Wave C + lưu draft (không fake B4).

- [ ] **Step 4: Detail** `/crm/delivery-projects/[id]`

Tabs: `Tổng quan` · `Nhận lead` (nếu `lead_ingest`: embed link `/crm/b2b-projects` **cũ đã redirect** — **chốt:** iframe không dùng. Render form đọc `GET /api/v1/b2b-projects/:b2b_project_id` bằng client B2B hiện có: tên/status/SLA/AI — reuse `B2bProjectFormModal` ở mode edit nếu cap manage) · `Phạm vi` · `Milestone` · `Ngân sách` (empty Wave C) · `KPI` (empty Wave D) · `Rủi ro` (empty). `PTT-LEGACY`: ẩn Phạm vi/Milestone nếu không delivery.

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/app/crm/delivery-projects \
  services/ops-web/src/components/delivery \
  services/ops-web/src/lib/delivery-conflicts.ts \
  services/ops-web/src/lib/delivery-conflicts.spec.ts
git commit -m "$(cat <<'EOF'
feat(delivery): add scope/milestone wizard and unified detail tabs.

EOF
)"
```

---

### Task 9: E2E + hồi quy B2B list

**Files:**
- Create: `services/ops-web/e2e/delivery-projects-wave-b.spec.ts`
- Modify: e2e nào `goto('/crm/b2b-projects')` — grep và đổi expect URL catalog **hoặc** follow redirect.

- [ ] **Step 1: Grep**

Run: `rg -l "crm/b2b-projects" services/ops-web/e2e`

Sửa `goto` thành catalog nếu test list PTT; test ingest/API không đổi.

- [ ] **Step 2: Smoke spec** (skip nếu chưa login như pattern `kpi-cockpit-wave1.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test('delivery portfolio chrome', async ({ page }) => {
  await page.goto('/crm/delivery-projects');
  if (page.url().includes('/login')) test.skip();
  await expect(page.getByRole('heading', { name: /project delivery/i })).toBeVisible();
  await expect(page.locator('[data-testid="delivery-tiles"]')).toBeVisible();
  await expect(page.locator('[data-testid="delivery-gantt"]')).toBeVisible();
  await expect(page.locator('[data-testid="delivery-catalog"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /kanban/i })).toBeVisible();
});

test('b2b list redirects to catalog', async ({ page }) => {
  await page.goto('/crm/b2b-projects');
  if (page.url().includes('/login')) test.skip();
  await expect(page).toHaveURL(/delivery-projects/);
});
```

- [ ] **Step 3: Run**

Run: `cd services/ops-web && npx playwright test e2e/delivery-projects-wave-b.spec.ts --reporter=line`

Expected: pass hoặc skip login (không fail assert heading sai).

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/e2e/delivery-projects-wave-b.spec.ts services/ops-web/e2e
git commit -m "$(cat <<'EOF'
test(delivery): add Wave B portfolio and B2B redirect smoke.

EOF
)"
```

---

## Deploy note (không làm trong task trừ khi user yêu cầu)

VPS: apply `docs/specs/2026-09-04-postgresql-ddl-delivery-projects.sql` rồi build api + ops-web. Restart `ptt-crm-api` (Nest). HUP `ptt-ops-web`. Không bật LLM.

## Self-review

| Spec Wave B | Task |
|---|---|
| Header + `b2b_project_id` 1:1 | 2–3 |
| Backfill mọi B2B kể LEGACY | 2 |
| Portfolio 6 thẻ + Gantt + bảng + empty widgets | 6 |
| Filter năng lực | 6 |
| Wizard B1 toggles; chỉ ingest lưu xong | 7 |
| B2–B3 chỉ khi delivery; circular 400 | 8 + 1 |
| Health lịch / ingest | 1, 3 |
| 308 / OpsNav | 7 |
| Gantt không drag; Kanban empty | 6, 8 |
| Không đổi lead FK / RE / KPI cockpit | constraints |

Không có TBD. Tên hàm thống nhất: `normalizeCapabilities`, `deriveDeliveryHealth`, `hasCircularMilestoneDeps`, `nextPrjCode`.

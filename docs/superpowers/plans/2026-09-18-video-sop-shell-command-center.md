# Video SOP Shell + Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa `/crm/video` lên layout kiểu Content Operations Command Center: sidebar Video SOP + Command Center (SC-01) + wrap các màn SOP trong shell, không đổi API/stage.

**Architecture:** Next.js `layout.tsx` bọc `VideoSopShell` (một `StaffPageShell` + sidebar `vd-*`). Hub `page.tsx` thành Command Center (list projects + production report). Mỗi SOP page đổi `CrmDeliveryPageShell` → `VideoSopPageChrome` (chỉ title/banner/children, **không** nest StaffPageShell / ModuleSubNav). Query lifecycle giữ `lifecycle_id`.

**Tech Stack:** Next.js 14 `ops-web`, React client components, Vitest, existing `VIDEO_SOP_API` / `ensureStaffAccessToken` patterns, CSS `vd-shell` (không reuse class `cmkte-*`).

**Spec:** [`2026-09-18-video-sop-shell-command-center-design.md`](../specs/2026-09-18-video-sop-shell-command-center-design.md)  
**Parent Module 7:** [`2026-08-20-video-sop-module-7-design.md`](../specs/2026-08-20-video-sop-module-7-design.md)

## Global Constraints

- **Không** đổi Nest `/api/v1/vd/**` stage/gate/cost rules trong wave này.
- **Không** rename URL sang `/crm/video-os`.
- Query lifecycle = **`lifecycle_id`** (không dùng `lifecycle` như CMKT).
- CSS prefix **`vd-` / `vd-shell`** only — cấm import/reuse class `cmkte-*`.
- Flag: `NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1` vẫn bắt buộc; tắt → “Module tắt”.
- Cap: view qua `crm_vd.project` view **hoặc** `crm_content` view (giống hub hiện tại).
- Một `StaffPageShell` duy nhất từ `VideoSopShell` — SOP pages **không** gọi `CrmDeliveryPageShell` / `StaffPageShell`.
- SC-12 library = stub page only; SC-14 portal không redesign.
- Copy UI tiếng Việt; brand **Video SOP** / *Video Operations*.

---

## File map

```
Create:
  services/ops-web/src/lib/crm/video-sop-nav.ts
  services/ops-web/src/lib/crm/video-sop-nav.spec.ts
  services/ops-web/src/lib/crm/video-sop-routes.ts
  services/ops-web/src/lib/crm/video-sop-routes.spec.ts
  services/ops-web/src/components/video-sop/VideoSopShell.tsx
  services/ops-web/src/components/video-sop/VideoSopPageChrome.tsx
  services/ops-web/src/components/video-sop/VideoSopCommandCenter.tsx
  services/ops-web/src/styles/video-sop-shell.css
  services/ops-web/src/app/crm/video/layout.tsx
  services/ops-web/src/app/crm/video/[id]/library/page.tsx

Modify:
  services/ops-web/src/app/globals.css                    # @import video-sop-shell.css
  services/ops-web/src/app/crm/video/page.tsx             # Command Center host
  services/ops-web/src/app/crm/video/dashboard/page.tsx
  services/ops-web/src/app/crm/video/[id]/page.tsx
  services/ops-web/src/app/crm/video/[id]/brief/page.tsx
  services/ops-web/src/app/crm/video/[id]/script/page.tsx
  services/ops-web/src/app/crm/video/[id]/bible/page.tsx
  services/ops-web/src/app/crm/video/[id]/keyframes/page.tsx
  services/ops-web/src/app/crm/video/[id]/render/page.tsx
  services/ops-web/src/app/crm/video/[id]/takes/page.tsx
  services/ops-web/src/app/crm/video/[id]/post/page.tsx
  services/ops-web/src/app/crm/video/[id]/cost/page.tsx
  services/ops-web/src/app/crm/video/[id]/delivery/page.tsx
  services/ops-web/src/app/crm/video/[id]/gates/[n]/page.tsx
  docs/huong-dan-su-dung/19-video-sop.md                  # short shell note
```

---

### Task 1: Nav + route helpers (TDD)

**Files:**
- Create: `services/ops-web/src/lib/crm/video-sop-nav.ts`
- Create: `services/ops-web/src/lib/crm/video-sop-nav.spec.ts`
- Create: `services/ops-web/src/lib/crm/video-sop-routes.ts`
- Create: `services/ops-web/src/lib/crm/video-sop-routes.spec.ts`

**Interfaces:**
- Produces:
  - `VD_SOP_LAST_PROJECT_KEY = 'vd-sop-last-project'`
  - `VD_SOP_NAV: ReadonlyArray<{ screen: string; href: string; label: string; glyph: string; group: 'ops' | 'libs' }>`
  - `parseLifecycleIdQuery(raw: string | null): number | undefined`
  - `withVdLifecycleQuery(href: string, lifecycleId?: number): string` — appends `lifecycle_id`
  - `vdSopPath(screen, opts?: { lifecycleId?: number; projectId?: number }): string`
  - `resolveVdWorkspaceHref(stored: string | null | undefined): string`
  - `resolveVdGateHref(stored: string | null | undefined): string`
  - `resolveVdLibraryHref(stored: string | null | undefined): string`
  - `contentBoardHref(lifecycleId?: number): string` → `/crm/content-os` + `?lifecycle=` when id present (CMKT convention)

**Nav constant (exact labels):**

| screen | href | label | group |
|--------|------|-------|-------|
| command | `/crm/video` | Command Center | ops |
| projects | `/crm/video#projects` | Projects | ops |
| workspace | `/crm/video/0` (resolved) | Production Workspace | ops |
| gates | `/crm/video/0/gates/1` (resolved) | Gate Center | ops |
| dashboard | `/crm/video/dashboard` | Production Dashboard | ops |
| library | `/crm/video/0/library` (resolved) | Asset Library | libs |
| admin | `/admin/video/providers` | Admin providers | libs |

- [ ] **Step 1: Write failing tests for routes**

```ts
// video-sop-routes.spec.ts
import { describe, expect, it } from 'vitest';
import {
  parseLifecycleIdQuery,
  withVdLifecycleQuery,
  vdSopPath,
  contentBoardHref,
} from './video-sop-routes';

describe('video-sop-routes', () => {
  it('parseLifecycleIdQuery accepts positive ints only', () => {
    expect(parseLifecycleIdQuery('4')).toBe(4);
    expect(parseLifecycleIdQuery('0')).toBeUndefined();
    expect(parseLifecycleIdQuery('x')).toBeUndefined();
    expect(parseLifecycleIdQuery(null)).toBeUndefined();
  });

  it('withVdLifecycleQuery appends lifecycle_id and preserves hash', () => {
    expect(withVdLifecycleQuery('/crm/video', 4)).toBe('/crm/video?lifecycle_id=4');
    expect(withVdLifecycleQuery('/crm/video?foo=1', 4)).toBe('/crm/video?foo=1&lifecycle_id=4');
    expect(withVdLifecycleQuery('/crm/video#projects', 4)).toBe(
      '/crm/video?lifecycle_id=4#projects',
    );
    expect(withVdLifecycleQuery('/crm/video', undefined)).toBe('/crm/video');
  });

  it('vdSopPath builds command and dashboard', () => {
    expect(vdSopPath('command', { lifecycleId: 4 })).toBe('/crm/video?lifecycle_id=4');
    expect(vdSopPath('dashboard', { lifecycleId: 4 })).toBe(
      '/crm/video/dashboard?lifecycle_id=4',
    );
    expect(vdSopPath('admin')).toBe('/admin/video/providers');
  });

  it('contentBoardHref uses CMKT lifecycle query key', () => {
    expect(contentBoardHref(4)).toBe('/crm/content-os?lifecycle=4');
    expect(contentBoardHref()).toBe('/crm/content-os');
  });
});
```

```ts
// video-sop-nav.spec.ts
import { describe, expect, it } from 'vitest';
import {
  VD_SOP_NAV,
  resolveVdWorkspaceHref,
  resolveVdGateHref,
  resolveVdLibraryHref,
} from './video-sop-nav';

describe('video-sop-nav', () => {
  it('exposes seven nav items with required screens', () => {
    expect(VD_SOP_NAV.map((n) => n.screen)).toEqual([
      'command',
      'projects',
      'workspace',
      'gates',
      'dashboard',
      'library',
      'admin',
    ]);
  });

  it('resolves last project hrefs or falls back to command', () => {
    expect(resolveVdWorkspaceHref('3')).toBe('/crm/video/3');
    expect(resolveVdGateHref('3')).toBe('/crm/video/3/gates/1');
    expect(resolveVdLibraryHref('3')).toBe('/crm/video/3/library');
    expect(resolveVdWorkspaceHref(null)).toBe('/crm/video');
    expect(resolveVdGateHref('0')).toBe('/crm/video');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd services/ops-web && npx vitest run src/lib/crm/video-sop-routes.spec.ts src/lib/crm/video-sop-nav.spec.ts`  
Expected: FAIL module not found

- [ ] **Step 3: Implement helpers**

```ts
// video-sop-routes.ts (minimal)
export function parseLifecycleIdQuery(raw: string | null): number | undefined {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return undefined;
  return n;
}

export function withVdLifecycleQuery(href: string, lifecycleId?: number): string {
  if (!(lifecycleId && lifecycleId > 0)) return href;
  const hashIdx = href.indexOf('#');
  const withoutHash = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : '';
  const sep = withoutHash.includes('?') ? '&' : '?';
  return `${withoutHash}${sep}lifecycle_id=${lifecycleId}${hash}`;
}

export type VdSopScreen =
  | 'command'
  | 'projects'
  | 'workspace'
  | 'gates'
  | 'dashboard'
  | 'library'
  | 'admin';

export function vdSopPath(
  screen: VdSopScreen,
  opts?: { lifecycleId?: number; projectId?: number },
): string {
  const lifecycleId = opts?.lifecycleId;
  const projectId = opts?.projectId;
  if (screen === 'admin') return '/admin/video/providers';
  if (screen === 'command') return withVdLifecycleQuery('/crm/video', lifecycleId);
  if (screen === 'projects') return withVdLifecycleQuery('/crm/video#projects', lifecycleId);
  if (screen === 'dashboard') {
    return withVdLifecycleQuery('/crm/video/dashboard', lifecycleId);
  }
  if (screen === 'workspace') {
    const id = projectId && projectId > 0 ? projectId : 0;
    const base = id > 0 ? `/crm/video/${id}` : '/crm/video';
    return withVdLifecycleQuery(base, lifecycleId);
  }
  if (screen === 'gates') {
    const id = projectId && projectId > 0 ? projectId : 0;
    const base = id > 0 ? `/crm/video/${id}/gates/1` : '/crm/video';
    return withVdLifecycleQuery(base, lifecycleId);
  }
  if (screen === 'library') {
    const id = projectId && projectId > 0 ? projectId : 0;
    const base = id > 0 ? `/crm/video/${id}/library` : '/crm/video';
    return withVdLifecycleQuery(base, lifecycleId);
  }
  return withVdLifecycleQuery('/crm/video', lifecycleId);
}

export function contentBoardHref(lifecycleId?: number): string {
  if (lifecycleId && lifecycleId > 0) {
    return `/crm/content-os?lifecycle=${lifecycleId}`;
  }
  return '/crm/content-os';
}
```

```ts
// video-sop-nav.ts
export const VD_SOP_LAST_PROJECT_KEY = 'vd-sop-last-project';

export const VD_SOP_NAV = [
  { screen: 'command', href: '/crm/video', label: 'Command Center', glyph: '▦', group: 'ops' },
  { screen: 'projects', href: '/crm/video#projects', label: 'Projects', glyph: '☰', group: 'ops' },
  { screen: 'workspace', href: '/crm/video/0', label: 'Production Workspace', glyph: '✦', group: 'ops' },
  { screen: 'gates', href: '/crm/video/0/gates/1', label: 'Gate Center', glyph: '✓', group: 'ops' },
  { screen: 'dashboard', href: '/crm/video/dashboard', label: 'Production Dashboard', glyph: '▣', group: 'ops' },
  { screen: 'library', href: '/crm/video/0/library', label: 'Asset Library', glyph: '◻', group: 'libs' },
  { screen: 'admin', href: '/admin/video/providers', label: 'Admin providers', glyph: '⚙', group: 'libs' },
] as const;

function positiveId(stored: string | null | undefined): number | undefined {
  const n = Number(stored);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export function resolveVdWorkspaceHref(stored: string | null | undefined): string {
  const id = positiveId(stored);
  return id ? `/crm/video/${id}` : '/crm/video';
}

export function resolveVdGateHref(stored: string | null | undefined): string {
  const id = positiveId(stored);
  return id ? `/crm/video/${id}/gates/1` : '/crm/video';
}

export function resolveVdLibraryHref(stored: string | null | undefined): string {
  const id = positiveId(stored);
  return id ? `/crm/video/${id}/library` : '/crm/video';
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd services/ops-web && npx vitest run src/lib/crm/video-sop-routes.spec.ts src/lib/crm/video-sop-nav.spec.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/lib/crm/video-sop-nav.ts \
  services/ops-web/src/lib/crm/video-sop-nav.spec.ts \
  services/ops-web/src/lib/crm/video-sop-routes.ts \
  services/ops-web/src/lib/crm/video-sop-routes.spec.ts
git commit -m "feat(video-sop): add shell nav and lifecycle_id route helpers"
```

---

### Task 2: Shell CSS + VideoSopShell + layout

**Files:**
- Create: `services/ops-web/src/styles/video-sop-shell.css`
- Create: `services/ops-web/src/components/video-sop/VideoSopShell.tsx`
- Create: `services/ops-web/src/components/video-sop/VideoSopPageChrome.tsx`
- Create: `services/ops-web/src/app/crm/video/layout.tsx`
- Modify: `services/ops-web/src/app/globals.css` (add `@import '../styles/video-sop-shell.css';` near other module imports)

**Interfaces:**
- Consumes: Task 1 helpers, `StaffPageShell`, `ensureStaffAccessToken`, `canView` pattern from `page.tsx` (`crm_vd.project` view \| `crm_content` view), `NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC`
- Produces: `VideoSopShell({ children })`, `VideoSopPageChrome({ title, subtitle?, banner?, actions?, children })`

- [ ] **Step 1: Add CSS skeleton**

Create `video-sop-shell.css` mirroring structure of `.cmkte-shell` / `.cmkte-sidebar` / `.cmkte-column` / `.cmkte-nav` but renamed to:

- `.vd-shell`, `.vd-sidebar`, `.vd-brand`, `.vd-workspace`, `.vd-label`, `.vd-nav`, `.vd-nav__link--active`, `.vd-column`, `.vd-topbar`, `.vd-page`, `.vd-cmd`, `.vd-card`, `.vd-kpi`, `.vd-table`, `.vd-empty`, `.vd-btn`, `.vd-actions`

Use green accent consistent with ops (`#17692f` family) — cream/off-white surface like CMKT, **do not** copy `cmkte-` class names.

- [ ] **Step 2: Implement VideoSopPageChrome**

```tsx
export function VideoSopPageChrome({
  title,
  subtitle,
  banner,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  banner?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="vd-page">
      <div className="vd-page__head">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="vd-page__sub">{subtitle}</p> : null}
        </div>
        {actions ? <div className="vd-actions">{actions}</div> : null}
      </div>
      {banner ? <p className="vd-banner">{banner}</p> : null}
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Implement VideoSopShell**

Follow `CmktEShell` auth flow (`ensureStaffAccessToken`, login redirect, cap check → `/403`).

Behavior:

1. Read `lifecycle_id` via `useSearchParams` + `parseLifecycleIdQuery`.
2. Read `localStorage[VD_SOP_LAST_PROJECT_KEY]` for workspace/gate/library hrefs; when pathname matches `/crm/video/(\\d+)`, write that id to localStorage.
3. Render `StaffPageShell width="full"` → `.vd-shell` → aside + `.vd-column` (topbar crumb + children).
4. Nav: map `VD_SOP_NAV` ops/libs; resolve workspace/gates/library hrefs; wrap with `withVdLifecycleQuery` except `admin`.
5. Active state: command = exact `/crm/video`; workspace = `/crm/video/[id]` not library/gates; gates = path includes `/gates/`; dashboard; library; admin; projects = command + hash optional.
6. Flag off → children replaced by `<p className="vd-empty">Module tắt</p>`.

- [ ] **Step 4: Add layout.tsx**

```tsx
import { VideoSopShell } from '@/components/video-sop/VideoSopShell';

export default function VideoSopLayout({ children }: { children: React.ReactNode }) {
  return <VideoSopShell>{children}</VideoSopShell>;
}
```

- [ ] **Step 5: Import CSS in globals.css**

- [ ] **Step 6: Smoke typecheck (optional local)**

Run: `cd services/ops-web && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40`  
Expected: no errors in new files (ignore pre-existing if any)

- [ ] **Step 7: Commit**

```bash
git add services/ops-web/src/styles/video-sop-shell.css \
  services/ops-web/src/components/video-sop/VideoSopShell.tsx \
  services/ops-web/src/components/video-sop/VideoSopPageChrome.tsx \
  services/ops-web/src/app/crm/video/layout.tsx \
  services/ops-web/src/app/globals.css
git commit -m "feat(video-sop): add VideoSopShell layout and page chrome"
```

---

### Task 3: Command Center (SC-01)

**Files:**
- Create: `services/ops-web/src/components/video-sop/VideoSopCommandCenter.tsx`
- Create: `services/ops-web/src/components/video-sop/video-sop-command-center.util.ts`
- Create: `services/ops-web/src/components/video-sop/video-sop-command-center.util.spec.ts`
- Modify: `services/ops-web/src/app/crm/video/page.tsx`

**Interfaces:**
- Consumes: `VIDEO_SOP_API.listProjects`, `VIDEO_SOP_API.getProductionReport`, `contentBoardHref`, `withVdLifecycleQuery`, `VdProjectRow`, `VdProductionReport`
- Produces:
  - `summarizeVdCommandCenter(projects, report): { activeCount; stageBuckets; metricTiles }`
  - `VideoSopCommandCenter({ lifecycleId, projects, report, loading, error, search })`

- [ ] **Step 1: Failing util tests**

```ts
import { describe, expect, it } from 'vitest';
import { summarizeVdCommandCenter } from './video-sop-command-center.util';

describe('summarizeVdCommandCenter', () => {
  it('counts active projects and stage buckets', () => {
    const out = summarizeVdCommandCenter(
      [
        { id: 1, stage: 'brief_ready', status: 'active' },
        { id: 2, stage: 'scripting', status: 'active' },
        { id: 3, stage: 'archived', status: 'cancelled' },
      ] as never,
      { lifecycle_id: 4, project_count: 3, metrics: [] },
    );
    expect(out.activeCount).toBe(2);
    expect(out.stageBuckets.brief_ready).toBe(1);
    expect(out.stageBuckets.scripting).toBe(1);
  });

  it('maps production metrics to tiles with fallback dash', () => {
    const out = summarizeVdCommandCenter([], {
      lifecycle_id: 4,
      project_count: 0,
      metrics: [
        {
          metric: 'keyframe_pass_rate',
          value: 0,
          target: { label: '≥60%', direction: 'min', threshold: 60 },
          on_track: false,
        },
      ],
    });
    expect(out.metricTiles[0]?.label).toMatch(/keyframe/i);
    expect(out.metricTiles[0]?.valueLabel).toBe('0%');
  });
});
```

(`VdProductionMetricRow`: `metric`, `value`, `target`, `on_track` — no separate `id`/`label` fields.)

- [ ] **Step 2: Run util test — FAIL then implement util — PASS**

- [ ] **Step 3: Implement VideoSopCommandCenter UI**

Must include:

1. Head: title `Video Operations Command Center`, CTAs `Mở Dashboard` → `vdSopPath('dashboard')`, `＋ Từ Content Board` → `contentBoardHref(lifecycleId)`.
2. If `!lifecycleId`: `.vd-empty` copy: `Chọn Video chiến dịch từ Content Board` + Link Content Board (AC-VD-S3).
3. If lifecycle: card “Cần xử lý hôm nay” — list projects where `stage` in `brief_draft|brief_ready|scripting|shotlist_ready|keyframing` (attention heuristic; no N+1 gates in wave 1).
4. Three KPI tiles: Active projects · Project count (report) · first production metric or stage mix string.
5. `#projects` table: TITLE, STAGE, STATUS, ITEM, UPDATED — row Link to `/crm/video/{id}?lifecycle_id=`.
6. Search input filters table client-side by title/id.

- [ ] **Step 4: Rewrite `app/crm/video/page.tsx`**

- Remove `CrmDeliveryPageShell`.
- Auth + flag check keep (or rely on shell for auth — still safe to ensure token for API).
- Load `listProjects` + `getProductionReport` in parallel when lifecycle present.
- Render `<VideoSopCommandCenter ... />` only (shell provides chrome).

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/components/video-sop/VideoSopCommandCenter.tsx \
  services/ops-web/src/components/video-sop/video-sop-command-center.util.ts \
  services/ops-web/src/components/video-sop/video-sop-command-center.util.spec.ts \
  services/ops-web/src/app/crm/video/page.tsx
git commit -m "feat(video-sop): replace hub list with Command Center"
```

---

### Task 4: SC-12 library stub

**Files:**
- Create: `services/ops-web/src/app/crm/video/[id]/library/page.tsx`

- [ ] **Step 1: Stub page**

Client page:

- Parse `id` from params; if invalid show error.
- Persist last project id to `VD_SOP_LAST_PROJECT_KEY`.
- `VideoSopPageChrome` title `Asset Library (SC-12)`.
- Body: muted copy `SC-12 Asset Library chưa ship — dùng asset qua Keyframes / Delivery. Backlog FR-7.9.`
- Link back to `/crm/video/[id]`.

- [ ] **Step 2: Commit**

```bash
git add services/ops-web/src/app/crm/video/\[id\]/library/page.tsx
git commit -m "feat(video-sop): add SC-12 asset library stub page"
```

---

### Task 5: Wrap SOP pages (strip CrmDeliveryPageShell)

**Files:** all `app/crm/video/**/page.tsx` that import `CrmDeliveryPageShell` (list from File map) **except** hub already done in Task 3.

**Pattern (every file):**

1. Remove `CrmDeliveryPageShell` import; add `VideoSopPageChrome`.
2. Loading / flag-off / error early returns: wrap with `VideoSopPageChrome` (or plain `<p>` inside shell).
3. Main return: replace `<CrmDeliveryPageShell ...>` with:

```tsx
<VideoSopPageChrome title="Brief (SC-03)" banner={S3_BANNER /* existing */}>
  {/* keep existing form body; drop CRM breadcrumb props */}
</VideoSopPageChrome>
```

4. On overview `[id]/page.tsx`: when project loads, `localStorage.setItem(VD_SOP_LAST_PROJECT_KEY, String(projectId))`.
5. Keep all API / form logic unchanged.

- [ ] **Step 1: Wrap overview + brief + script** (highest traffic) — commit

```bash
git commit -m "refactor(video-sop): wrap overview brief script in VideoSopPageChrome"
```

- [ ] **Step 2: Wrap bible, keyframes, gates** — commit

```bash
git commit -m "refactor(video-sop): wrap bible keyframes gates in VideoSopPageChrome"
```

- [ ] **Step 3: Wrap render, takes, post, cost, delivery, dashboard** — commit

```bash
git commit -m "refactor(video-sop): wrap remaining SOP pages in VideoSopPageChrome"
```

- [ ] **Step 4: Grep guard**

Run: `rg "CrmDeliveryPageShell" services/ops-web/src/app/crm/video`  
Expected: **no matches**

---

### Task 6: Docs + acceptance checklist

**Files:**
- Modify: `docs/huong-dan-su-dung/19-video-sop.md` (section Hub: mention Command Center + sidebar + `lifecycle_id`)

- [ ] **Step 1: Update user guide §2 Hub** — note shell nav, Command Center, CTA Content Board, library stub.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(video-sop): document Command Center shell entry"
```

- [ ] **Step 3: Manual browser checklist (executor)**

| Check | URL | Expect |
|-------|-----|--------|
| AC-VD-S3 | `/crm/video` | Empty + CTA Content Board; sidebar visible |
| AC-VD-S2 | `/crm/video?lifecycle_id=4` | Table + KPI; no CRM delivery tabs |
| AC-VD-S4 | `/crm/video/3/brief?lifecycle_id=4` | Form works; Lưu brief toast |
| AC-VD-S5 | Nav Dashboard / Admin | Correct pages |
| AC-VD-S6 | `/crm/video/3/library` | Stub copy, not 404 |
| AC-VD-S1 | Any `/crm/video/**` | Single shell sidebar |

---

### Task 7: Deploy VPS (when user asks)

- [ ] Push commits to `origin/main`
- [ ] VPS: `git pull --ff-only`, `./scripts/deploy_ops_web.sh build`, activate release, `sudo -n /usr/bin/systemctl restart ptt-ops-web`
- [ ] No Nest rebuild required unless accidental API touch (should be none)

---

## Spec coverage self-review

| Spec ID | Task |
|---------|------|
| VD-SHELL-01/02 | Task 1–2 |
| VD-CC-01/02 | Task 3 |
| VD-WRAP-01 | Task 5 |
| VD-NAV-01 | Task 2 nav |
| VD-NAV-02 | Task 4 |
| AC-VD-S1…S8 | Task 6 checklist |
| Gap backlog SC-12 full / portal / service-delivery tab | Documented only (Task 4 stub + guide) — **not** implemented |

## Placeholder scan

No TBD/TODO steps left in tasks 1–6.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-18-video-sop-shell-command-center.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — same session with executing-plans checkpoints  

Which approach?

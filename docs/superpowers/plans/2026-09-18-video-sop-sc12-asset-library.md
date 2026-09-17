# Video SOP SC-12 Asset Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship FR-7.9 `GET /api/v1/vd/assets/search` (lifecycle-scoped) and replace the SC-12 stub UI with a real Asset Library.

**Architecture:** Nest search service loads projects for `lifecycle_id`, optionally narrows to one `project_id`, then queries `vd_assets` (PG or memory). Ops-web client calls search; `/crm/video/[id]/library` renders filters + table inside `VideoSopPageChrome` (shell already wraps layout).

**Tech Stack:** NestJS `ptt-crm-api` (Jest), Next.js `ops-web` (Vitest), existing `VdAssetRepository` / `VdProjectRepository`, `StaffVdProjectViewGuard`, `vd-*` CSS.

**Spec:** [`2026-09-18-video-sop-sc12-asset-library-design.md`](../specs/2026-09-18-video-sop-sc12-asset-library-design.md)

## Global Constraints

- Query lifecycle key = **`lifecycle_id`** (required on search).
- Cap: `crm_vd.project` view **or** `crm_content` view via `StaffVdProjectViewGuard`.
- Kinds only: `keyframe` | `take` | `master` | `proxy` | `package`.
- Default `limit` 50, max 100.
- No lineage graph, upload, delete, or signed CDN in this wave.
- CSS prefix **`vd-`** only; keep route `/crm/video/[id]/library`.
- Flag: cinematic module still gates UI (`NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1`); API uses existing `assertCinematicEnabled` if other vd endpoints do.

---

## File map

```
Create:
  services/ptt-crm-api/src/video-sop/assets/vd-asset-search.service.ts
  services/ptt-crm-api/src/video-sop/assets/vd-asset-search.service.spec.ts
  services/ptt-crm-api/src/video-sop/assets/vd-asset.controller.ts
  services/ops-web/src/components/video-sop/video-sop-asset-library.util.ts
  services/ops-web/src/components/video-sop/video-sop-asset-library.util.spec.ts
  services/ops-web/src/components/video-sop/VideoSopAssetLibrary.tsx

Modify:
  services/ptt-crm-api/src/video-sop/assets/vd-asset.repository.ts
  services/ptt-crm-api/src/video-sop/video-sop.module.ts
  services/ops-web/src/lib/video-sop-api.ts
  services/ops-web/src/app/crm/video/[id]/library/page.tsx
  docs/huong-dan-su-dung/19-video-sop.md
```

---

### Task 1: Repository `searchByProjectIds` (TDD)

**Files:**
- Modify: `services/ptt-crm-api/src/video-sop/assets/vd-asset.repository.ts`
- Create or extend: `services/ptt-crm-api/src/video-sop/assets/vd-asset.repository.spec.ts` (create if missing)

**Interfaces:**
- Produces:
  ```ts
  export type VdAssetSearchOpts = {
    projectIds: number[];
    kind?: VdAssetKind;
    q?: string;
    limit?: number;
  };
  // VdAssetRepository.searchByProjectIds(opts): Promise<VdAssetRow[]>
  ```

- [ ] **Step 1: Write failing tests (memory path)**

```ts
import { VdAssetRepository } from './vd-asset.repository';

function makeRepo(): VdAssetRepository {
  return new VdAssetRepository({
    databaseUrl: 'postgres://invalid',
    contentMarketingVideoCinematicEnabled: false,
  } as never);
}

describe('VdAssetRepository.searchByProjectIds', () => {
  it('returns empty when projectIds empty', async () => {
    const repo = makeRepo();
    await expect(repo.searchByProjectIds({ projectIds: [] })).resolves.toEqual([]);
  });

  it('filters by projectIds, kind, and q on id/sha/storage_key', async () => {
    const repo = makeRepo();
    (repo as any).pgReady = false;
    const a = await repo.insert({
      project_id: 1,
      job_id: null,
      kind: 'keyframe',
      sha256: 'deadbeef01',
      storage_key: 'kf/one',
    });
    await repo.insert({
      project_id: 2,
      job_id: null,
      kind: 'take',
      sha256: 'cafe0000',
      storage_key: 'take/two',
    });
    await repo.insert({
      project_id: 1,
      job_id: null,
      kind: 'master',
      sha256: 'aabbcc',
      storage_key: 'master/x',
    });

    const byProject = await repo.searchByProjectIds({ projectIds: [1] });
    expect(byProject.map((r) => r.kind).sort()).toEqual(['keyframe', 'master']);

    const byKind = await repo.searchByProjectIds({
      projectIds: [1, 2],
      kind: 'take',
    });
    expect(byKind).toHaveLength(1);
    expect(byKind[0].kind).toBe('take');

    const byId = await repo.searchByProjectIds({
      projectIds: [1],
      q: String(a.id),
    });
    expect(byId).toHaveLength(1);
    expect(byId[0].id).toBe(a.id);

    const bySha = await repo.searchByProjectIds({
      projectIds: [1, 2],
      q: 'dead',
    });
    expect(bySha).toHaveLength(1);
    expect(bySha[0].sha256).toBe('deadbeef01');
  });

  it('caps limit at 100 and defaults to 50', async () => {
    const repo = makeRepo();
    (repo as any).pgReady = false;
    for (let i = 0; i < 60; i++) {
      await repo.insert({
        project_id: 9,
        job_id: null,
        kind: 'keyframe',
        storage_key: `k/${i}`,
      });
    }
    const def = await repo.searchByProjectIds({ projectIds: [9] });
    expect(def.length).toBe(50);
    const over = await repo.searchByProjectIds({ projectIds: [9], limit: 500 });
    expect(over.length).toBe(100);
  });
});
```

(If constructor args differ, match existing `vd-asset` / project repo test helpers in-repo.)

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd services/ptt-crm-api && npx jest src/video-sop/assets/vd-asset.repository.spec.ts --no-coverage 2>&1 | tail -40`  
Expected: FAIL — `searchByProjectIds` missing

- [ ] **Step 3: Implement `searchByProjectIds`**

```ts
async searchByProjectIds(opts: VdAssetSearchOpts): Promise<VdAssetRow[]> {
  const ids = (opts.projectIds ?? []).filter((id) => Number.isInteger(id) && id > 0);
  if (ids.length === 0) return [];
  const cap = Math.max(1, Math.min(opts.limit ?? 50, 100));
  const kind = opts.kind;
  const q = opts.q?.trim() ?? '';

  if (await this.ensurePgReady()) {
    const params: unknown[] = [ids];
    let sql = `
      SELECT id, project_id, job_id, kind, storage_key, url, sha256, width, height, duration_ms, created_at
      FROM vd_assets
      WHERE project_id = ANY($1::int[])`;
    if (kind) {
      params.push(kind);
      sql += ` AND kind = $${params.length}`;
    }
    if (q) {
      params.push(q);
      const qi = params.length;
      params.push(`${q}%`);
      const qp = params.length;
      params.push(`%${q}%`);
      const qs = params.length;
      sql += ` AND (id::text = $${qi} OR sha256 ILIKE $${qp} OR storage_key ILIKE $${qs})`;
    }
    params.push(cap);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;
    const res = await this.db.query(sql, params);
    return (res.rows as Record<string, unknown>[]).map((row) => this.mapRow(row));
  }

  const qLower = q.toLowerCase();
  return this.memory.assets
    .filter((row) => ids.includes(row.project_id))
    .filter((row) => (kind ? row.kind === kind : true))
    .filter((row) => {
      if (!q) return true;
      if (String(row.id) === q) return true;
      if (row.sha256 && row.sha256.toLowerCase().startsWith(qLower)) return true;
      if (row.storage_key.toLowerCase().includes(qLower)) return true;
      return false;
    })
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, cap);
}
```

Export `VdAssetSearchOpts` from the same file.

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd services/ptt-crm-api && npx jest src/video-sop/assets/vd-asset.repository.spec.ts --no-coverage 2>&1 | tail -30`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/video-sop/assets/vd-asset.repository.ts \
  services/ptt-crm-api/src/video-sop/assets/vd-asset.repository.spec.ts
git commit -m "feat(vd): asset repository searchByProjectIds for FR-7.9"
```

---

### Task 2: Search service + HTTP controller

**Files:**
- Create: `services/ptt-crm-api/src/video-sop/assets/vd-asset-search.service.ts`
- Create: `services/ptt-crm-api/src/video-sop/assets/vd-asset-search.service.spec.ts`
- Create: `services/ptt-crm-api/src/video-sop/assets/vd-asset.controller.ts`
- Modify: `services/ptt-crm-api/src/video-sop/video-sop.module.ts`

**Interfaces:**
- Consumes: `VdAssetRepository.searchByProjectIds`, `VdProjectRepository.listByLifecycle`, `assertCinematicEnabled`
- Produces:
  ```ts
  export type VdLibraryAssetRow = VdAssetRow & { project_title: string };
  export type VdAssetSearchResult = { items: VdLibraryAssetRow[] };
  // VdAssetSearchService.search({ lifecycleId, projectId?, kind?, q?, limit? }): Promise<VdAssetSearchResult>
  // GET /api/v1/vd/assets/search
  ```

- [ ] **Step 1: Failing service tests**

```ts
import { BadRequestException } from '@nestjs/common';
import { VdAssetSearchService } from './vd-asset-search.service';

describe('VdAssetSearchService', () => {
  const projects = {
    listByLifecycle: jest.fn(),
  };
  const assets = {
    searchByProjectIds: jest.fn(),
  };
  const config = { contentMarketingVideoCinematicEnabled: true };

  function makeSvc() {
    return new VdAssetSearchService(config as never, projects as never, assets as never);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('rejects invalid lifecycleId', async () => {
    const svc = makeSvc();
    await expect(svc.search({ lifecycleId: 0 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('searches all projects in lifecycle and attaches titles', async () => {
    projects.listByLifecycle.mockResolvedValue([
      { id: 1, title: 'Alpha', lifecycle_id: 4 },
      { id: 2, title: 'Beta', lifecycle_id: 4 },
    ]);
    assets.searchByProjectIds.mockResolvedValue([
      {
        id: 10,
        project_id: 2,
        job_id: null,
        kind: 'keyframe',
        storage_key: '',
        url: '',
        sha256: 'abc',
        width: null,
        height: null,
        duration_ms: null,
        created_at: '2026-09-18T00:00:00.000Z',
      },
    ]);
    const out = await makeSvc().search({ lifecycleId: 4, q: 'abc' });
    expect(assets.searchByProjectIds).toHaveBeenCalledWith({
      projectIds: [1, 2],
      kind: undefined,
      q: 'abc',
      limit: undefined,
    });
    expect(out.items[0].project_title).toBe('Beta');
  });

  it('narrows to project_id when it belongs to lifecycle', async () => {
    projects.listByLifecycle.mockResolvedValue([{ id: 1, title: 'Alpha', lifecycle_id: 4 }]);
    assets.searchByProjectIds.mockResolvedValue([]);
    await makeSvc().search({ lifecycleId: 4, projectId: 1, kind: 'take' });
    expect(assets.searchByProjectIds).toHaveBeenCalledWith({
      projectIds: [1],
      kind: 'take',
      q: undefined,
      limit: undefined,
    });
  });

  it('returns empty items when project_id not in lifecycle', async () => {
    projects.listByLifecycle.mockResolvedValue([{ id: 1, title: 'Alpha', lifecycle_id: 4 }]);
    const out = await makeSvc().search({ lifecycleId: 4, projectId: 99 });
    expect(assets.searchByProjectIds).not.toHaveBeenCalled();
    expect(out.items).toEqual([]);
  });
});
```

- [ ] **Step 2: Run — FAIL then implement service — PASS**

```ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { AppConfigService } from '../../config/app-config.service';
import { VdProjectRepository } from '../project/vd-project.repository';
import { assertCinematicEnabled } from '../video-sop-flags';
import { VdAssetKind, VdAssetRepository, VdAssetRow } from './vd-asset.repository';

export type VdLibraryAssetRow = VdAssetRow & { project_title: string };
export type VdAssetSearchResult = { items: VdLibraryAssetRow[] };

const KINDS = new Set<string>(['keyframe', 'take', 'master', 'proxy', 'package']);

@Injectable()
export class VdAssetSearchService {
  constructor(
    private readonly config: AppConfigService,
    private readonly projects: VdProjectRepository,
    private readonly assets: VdAssetRepository,
  ) {}

  async search(input: {
    lifecycleId: number;
    projectId?: number;
    kind?: string;
    q?: string;
    limit?: number;
  }): Promise<VdAssetSearchResult> {
    assertCinematicEnabled(this.config);
    const lifecycleId = Number(input.lifecycleId);
    if (!Number.isInteger(lifecycleId) || lifecycleId <= 0) {
      throw new BadRequestException({ error: 'invalid_lifecycle_id' });
    }
    let kind: VdAssetKind | undefined;
    if (input.kind != null && String(input.kind).trim() !== '') {
      const k = String(input.kind).trim();
      if (!KINDS.has(k)) throw new BadRequestException({ error: 'invalid_kind' });
      kind = k as VdAssetKind;
    }
    const rows = await this.projects.listByLifecycle(lifecycleId);
    const titleById = new Map(rows.map((p) => [p.id, p.title || `Video #${p.id}`]));
    let projectIds = rows.map((p) => p.id);
    if (input.projectId != null) {
      const pid = Number(input.projectId);
      if (!Number.isInteger(pid) || pid <= 0) {
        throw new BadRequestException({ error: 'invalid_project_id' });
      }
      if (!titleById.has(pid)) return { items: [] };
      projectIds = [pid];
    }
    const found = await this.assets.searchByProjectIds({
      projectIds,
      kind,
      q: input.q,
      limit: input.limit,
    });
    return {
      items: found.map((row) => ({
        ...row,
        project_title: titleById.get(row.project_id) ?? `Video #${row.project_id}`,
      })),
    };
  }
}
```

(If `assertCinematicEnabled` signature differs, match `vd-report.service` / `vd-brief` usage.)

- [ ] **Step 3: Controller**

```ts
import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { StaffOrInternalKeyGuard } from '../../staff-auth/staff-or-internal-key.guard';
import { StaffVdProjectViewGuard } from '../guards/staff-vd-project.guard';
import { VdAssetSearchService } from './vd-asset-search.service';

@Controller('api/v1/vd/assets')
@UseGuards(StaffOrInternalKeyGuard, StaffVdProjectViewGuard)
export class VdAssetController {
  constructor(private readonly searchService: VdAssetSearchService) {}

  @Get('search')
  search(
    @Query('lifecycle_id') lifecycleRaw?: string,
    @Query('project_id') projectRaw?: string,
    @Query('kind') kind?: string,
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const lifecycleId = Number(lifecycleRaw);
    if (!Number.isInteger(lifecycleId) || lifecycleId <= 0) {
      throw new BadRequestException({ error: 'invalid_lifecycle_id' });
    }
    const projectId =
      projectRaw != null && String(projectRaw).trim() !== ''
        ? Number(projectRaw)
        : undefined;
    const limit =
      limitRaw != null && String(limitRaw).trim() !== '' ? Number(limitRaw) : undefined;
    return this.searchService.search({ lifecycleId, projectId, kind, q, limit });
  }
}
```

- [ ] **Step 4: Register in `video-sop.module.ts`**

Add imports + `VdAssetController` to `controllers`, `VdAssetSearchService` to `providers`.

- [ ] **Step 5: Run service tests — PASS**

Run: `cd services/ptt-crm-api && npx jest src/video-sop/assets/vd-asset-search.service.spec.ts --no-coverage 2>&1 | tail -30`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add services/ptt-crm-api/src/video-sop/assets/vd-asset-search.service.ts \
  services/ptt-crm-api/src/video-sop/assets/vd-asset-search.service.spec.ts \
  services/ptt-crm-api/src/video-sop/assets/vd-asset.controller.ts \
  services/ptt-crm-api/src/video-sop/video-sop.module.ts
git commit -m "feat(vd): GET /api/v1/vd/assets/search lifecycle library"
```

---

### Task 3: Ops-web API client

**Files:**
- Modify: `services/ops-web/src/lib/video-sop-api.ts`
- Create: `services/ops-web/src/lib/video-sop-api.assets.spec.ts` (or extend nearest existing path-helper spec if present)

**Interfaces:**
- Produces:
  ```ts
  export type VdLibraryAssetRow = VdKeyframeAssetRow & { project_title: string };
  export function vdAssetsSearchPath(opts: {
    lifecycleId: number;
    projectId?: number;
    kind?: string;
    q?: string;
    limit?: number;
  }): string;
  export async function searchVdAssets(token, opts): Promise<{ items: VdLibraryAssetRow[] }>;
  // VIDEO_SOP_API.searchAssets = searchVdAssets
  ```

- [ ] **Step 1: Failing path tests**

```ts
import { describe, expect, it } from 'vitest';
import { vdAssetsSearchPath } from './video-sop-api';

describe('vdAssetsSearchPath', () => {
  it('requires lifecycle_id and encodes filters', () => {
    expect(vdAssetsSearchPath({ lifecycleId: 4 })).toBe(
      '/api/v1/vd/assets/search?lifecycle_id=4',
    );
    expect(
      vdAssetsSearchPath({
        lifecycleId: 4,
        projectId: 3,
        kind: 'keyframe',
        q: 'dead',
        limit: 20,
      }),
    ).toBe(
      '/api/v1/vd/assets/search?lifecycle_id=4&project_id=3&kind=keyframe&q=dead&limit=20',
    );
  });
});
```

- [ ] **Step 2: Implement path + fetch + export on `VIDEO_SOP_API`**

Follow existing `vdFetch` / `listVdProjectKeyframes` patterns in the same file.

- [ ] **Step 3: Vitest PASS then commit**

```bash
cd services/ops-web && npx vitest run src/lib/video-sop-api.assets.spec.ts
git add services/ops-web/src/lib/video-sop-api.ts services/ops-web/src/lib/video-sop-api.assets.spec.ts
git commit -m "feat(ops-web): Video SOP assets search client"
```

---

### Task 4: Library util + UI + page

**Files:**
- Create: `services/ops-web/src/components/video-sop/video-sop-asset-library.util.ts`
- Create: `services/ops-web/src/components/video-sop/video-sop-asset-library.util.spec.ts`
- Create: `services/ops-web/src/components/video-sop/VideoSopAssetLibrary.tsx`
- Modify: `services/ops-web/src/app/crm/video/[id]/library/page.tsx`

**Interfaces:**
- Consumes: `VIDEO_SOP_API.searchAssets`, `getProject`, `parseLifecycleIdQuery`, `withVdLifecycleQuery`, `VD_SOP_LAST_PROJECT_KEY`, `VideoSopPageChrome`, `ensureStaffAccessToken`
- Produces: `resolveLibraryLifecycleId`, `VideoSopAssetLibrary`

- [ ] **Step 1: Util tests**

```ts
import { describe, expect, it } from 'vitest';
import { resolveLibraryLifecycleId, formatAssetSha8, formatAssetSize } from './video-sop-asset-library.util';

describe('video-sop-asset-library.util', () => {
  it('prefers query lifecycle over project lifecycle', () => {
    expect(resolveLibraryLifecycleId(4, 9)).toBe(4);
    expect(resolveLibraryLifecycleId(undefined, 9)).toBe(9);
    expect(resolveLibraryLifecycleId(undefined, undefined)).toBeUndefined();
  });

  it('formats sha and size', () => {
    expect(formatAssetSha8('abcdefghij')).toBe('abcdefgh');
    expect(formatAssetSha8(null)).toBe('—');
    expect(formatAssetSize(1080, 1920)).toBe('1080×1920');
    expect(formatAssetSize(null, null)).toBe('—');
  });
});
```

- [ ] **Step 2: Implement util**

```ts
export function resolveLibraryLifecycleId(
  queryLifecycleId?: number,
  projectLifecycleId?: number,
): number | undefined {
  if (queryLifecycleId && queryLifecycleId > 0) return queryLifecycleId;
  if (projectLifecycleId && projectLifecycleId > 0) return projectLifecycleId;
  return undefined;
}

export function formatAssetSha8(sha: string | null | undefined): string {
  if (!sha) return '—';
  return sha.slice(0, 8);
}

export function formatAssetSize(w: number | null, h: number | null): string {
  if (w == null || h == null) return '—';
  return `${w}×${h}`;
}
```

- [ ] **Step 3: `VideoSopAssetLibrary` UI**

Client component props:

```ts
{
  projectId: number;
  lifecycleId: number;
  items: VdLibraryAssetRow[];
  loading: boolean;
  error: string;
  scope: 'project' | 'lifecycle';
  kind: string; // '' | kind
  q: string;
  onScopeChange(scope): void;
  onKindChange(kind): void;
  onQChange(q): void;
  onSearch(): void; // optional if live-fetch from parent
}
```

Must include:

1. Title area via parent chrome; body: filters Scope / Kind / Search.  
2. Default scope **project** on first load.  
3. Table: PROJECT · KIND · ASSET # · SHA8 · SIZE · UPDATED · PREVIEW.  
4. Empty copy exact: `Chưa có asset khớp bộ lọc.`  
5. Link back `withVdLifecycleQuery(/crm/video/${projectId}, lifecycleId)`.

- [ ] **Step 4: Rewrite `library/page.tsx`**

Pattern (mirror Command Center / overview auth):

1. Parse `id` → `projectId`; invalid → error chrome.  
2. `localStorage.setItem(VD_SOP_LAST_PROJECT_KEY, …)`.  
3. Auth via `ensureStaffAccessToken`; flag off → Module tắt.  
4. `getProject` → `resolveLibraryLifecycleId(parseLifecycleIdQuery(...), project.lifecycle_id)`.  
5. If no lifecycle → show error *Thiếu lifecycle_id — mở từ Content Board / Command Center.*  
6. Fetch `searchAssets` when lifecycle + filters change (scope project → pass `projectId`).  
7. Render `<VideoSopPageChrome title="Asset Library (SC-12)">` + `<VideoSopAssetLibrary … />`.  
8. **Remove** stub backlog copy.

- [ ] **Step 5: Vitest util PASS + commit**

```bash
cd services/ops-web && npx vitest run src/components/video-sop/video-sop-asset-library.util.spec.ts
git add services/ops-web/src/components/video-sop/video-sop-asset-library.util.ts \
  services/ops-web/src/components/video-sop/video-sop-asset-library.util.spec.ts \
  services/ops-web/src/components/video-sop/VideoSopAssetLibrary.tsx \
  services/ops-web/src/app/crm/video/\[id\]/library/page.tsx
git commit -m "feat(video-sop): SC-12 Asset Library UI with lifecycle search"
```

---

### Task 5: Docs + smoke checklist

**Files:**
- Modify: `docs/huong-dan-su-dung/19-video-sop.md`

- [ ] **Step 1: Update §2** — replace “stub SC-12” with: mở Asset Library, lọc Project / Lifecycle / kind / search; API `/api/v1/vd/assets/search`.

- [ ] **Step 2: Commit**

```bash
git commit -m "docs(video-sop): document SC-12 Asset Library search"
```

- [ ] **Step 3: Manual checklist (executor)**

| Check | Expect |
|-------|--------|
| AC-LIB-1 | `GET .../assets/search?lifecycle_id=4` returns assets |
| AC-LIB-2 | `project_id` narrows |
| AC-LIB-3 | `kind=keyframe` filters |
| AC-LIB-4 | `q` matches id/sha |
| AC-LIB-5 | `/crm/video/[id]/library` no stub copy |
| AC-LIB-6 | Bad lifecycle → 400 / UI error, not 500 |

---

### Task 6: Deploy (when user asks)

- [ ] Push `main`  
- [ ] VPS: `git pull --ff-only`, rebuild **Nest** (`ptt-crm-api`) **and** `./scripts/deploy_ops_web.sh build`, restart `ptt-crm-api` + `ptt-ops-web`  
- [ ] Smoke `/crm/video/{id}/library?lifecycle_id=…`

---

## Spec coverage self-review

| Spec ID | Task |
|---------|------|
| VD-LIB-01 | Task 2 |
| VD-LIB-02 | Task 1–2 (projectIds from lifecycle) |
| VD-LIB-03 | Task 2 guard |
| VD-LIB-04 | Task 4 |
| VD-LIB-05 | Task 4 util |
| VD-LIB-06 | Task 4 page |
| AC-LIB-1…6 | Task 5 checklist |
| Out: lineage/upload | Not planned |

## Placeholder scan

No TBD/TODO steps in Tasks 1–5.

---

**Plan complete and saved to `docs/superpowers/plans/2026-09-18-video-sop-sc12-asset-library.md`.**

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — same session with executing-plans checkpoints  

Which approach?

# SPEC-CP-ACO-WIN v1.1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **SoT:** [SPEC-CP-ACO-WIN v1.1](../specs/2026-09-13-cp-ai-ops-provider-integration-srs.md). Cổng GT-A / GT-W / GT-M / GT-C và NFR **không cắt**.
>
> **Wave A chi tiết path/ingest:** thực hiện đủ [2026-09-12-figma-weave-work-order.md](./2026-09-12-figma-weave-work-order.md) **sau Task 2** (tab AI Ops đã có). Không copy lại 6 task Weave — chỉ delta UI + `provider_runs`.
>
> **Ngoài scope:** `/api/v1`, app ACO, Weavy Chat UIKit, AUTO-route tốn tiền, CSD Chat, tự launch ads, iframe Weave/Magnific/Comfy `:8188`.

**Goal:** Ship nhà máy đa provider trên Creative OS: Wave **A Weave** → **B Magnific REST+MCP** → **C Comfy** (GPU đang xây; pane hiện, submit khóa).

**Architecture:** Một module `cp`. Job = `crm_cp_render_jobs` (mở `provider` + `project_id` nullable `draft_id`). Run = `crm_cp_provider_runs`. Workplace = PRJ-03 `?tab=ai-ops&pane=`. Settings Integrations giữ secret. Ingest về `crm_cp_assets`. Ledger giữ `kind` hiện có (`reserve`/`charge`/`release`) + cột `provider` — không thêm `kind=provider_magnific` (phá CHECK đã ship).

**Tech Stack:** Nest `ptt-crm-api` · ops-web · Postgres · Jest · Vitest · Playwright · SSE `/renders/:id/events` · disk/S3 prefix Weave · Magnific HTTPS server-side · ComfyUI chỉ qua gateway private.

## Global Constraints

- Prefix `/api/crm/cp`. Tenant `PTT`. Không `/api/v1`, không `/crm/aco`.
- SoR: `clients`, `service_lifecycle`, `crm_cp_projects`, Hub `submit-creative`, Campaign Write. Không bảng campaign/client mới.
- Flag mặc định `0`: `PTT_WEAVE`, `MAGNIFIC_MCP_ENABLED`, `MAGNIFIC_REST_API_ENABLED`, `COMFYUI_WORKER_ENABLED`.
- Provider ∈ `stub` | `weavy` | `magnific_mcp` | `magnific_rest` | `comfyui`.
- Confirm cost: `confirm !== true` → 400 `human_confirm_required`. AI không confirm.
- Browser cấm gọi Comfy, MCP endpoint, credential Magnific.
- UI tiếng Việt. Empty `—`. Không mock số. Class `cp-ai-ops-*` (chrome tab) + `cp-weave-*` (pane Weave).
- Tab thứ 9 **AI Ops** — không 3 tab PRJ-03 riêng. 8 tab cũ không đổi hành vi.
- Thứ tự wave **cấm đảo** A↔B. Cấm đợi GPU mới làm Magnific. REST + MCP **cùng** Wave B.
- Cap: `crm_cp.view` / `edit` / `render` / `render_high_cost` / `export_final` / `manage` / `finance` / `view_audit`.

---

## File map

| File | Wave | Việc |
|---|---|---|
| `docs/specs/2026-09-13-postgresql-ddl-cp-ai-ops.sql` | 0 | connections, runs, prompt packages, bindings; alter `render_jobs` / ledger |
| `scripts/apply_pg_ddl_cp_ai_ops.sh` | 0 | Apply DDL |
| `services/ptt-crm-api/src/cp/cp-ai-ops.flags.ts` | 0 | Đọc 4 flag + `CP_AI_ENABLED` |
| `services/ptt-crm-api/src/cp/cp-ai-ops.types.ts` | 0 | Provider, job DTO, pane |
| `services/ptt-crm-api/src/cp/cp-provider-runs.repository.ts` | 0 | Insert/list runs |
| `services/ops-web/src/lib/crm/cp-project-tabs.util.ts` | 0 | Thêm tab `ai-ops` |
| `services/ops-web/src/lib/crm/cp-ai-ops-panes.util.ts` | 0 | `weave` \| `magnific` \| `comfy` |
| `services/ops-web/src/components/crm/cp/CpAiOpsWorkspace.tsx` | 0 | Shell 3 pane |
| `services/ops-web/src/components/crm/cp/CpProjectWorkspace.tsx` | 0 | Render tab AI Ops |
| Weave files trong plan 2026-09-12 | A | WO, path, sync, hook — UI mount vào pane `weave` |
| `services/ptt-crm-api/src/cp/cp-jobs.service.ts` | B | draft / confirm / submit / cancel |
| `services/ptt-crm-api/src/cp/cp-magnific-oauth.util.ts` | B | state CSRF, không log token |
| `services/ptt-crm-api/src/cp/cp-magnific-mcp.adapter.ts` | B | tools/list, generate, wait, download |
| `services/ptt-crm-api/src/cp/cp-magnific-rest.adapter.ts` | B | API key, generate, poll |
| `services/ptt-crm-api/src/cp/cp-magnific-policy.util.ts` | B | allowlist, RESTRICTED, balance |
| `services/ops-web/src/components/crm/cp/CpAiOpsMagnificPane.tsx` | B | Composer API/MCP |
| `services/ops-web/src/components/crm/cp/CpSettings.tsx` | B/C | Integrations: OAuth, REST key, Comfy URL |
| `services/ptt-crm-api/src/cp/cp-reports.service.ts` | B | CPA slice |
| `services/ptt-crm-api/src/cp/cp-comfy.adapter.ts` | C | prompt / ws / history / stats |
| `services/ptt-crm-api/src/cp/cp-comfy-bind.util.ts` | C | whitelist bindings |
| `services/ops-web/src/components/crm/cp/CpAiOpsComfyPane.tsx` | C | Disabled copy GPU / submit khi health |
| `services/ptt-crm-api/src/cp/cp.controller.ts` | A–C | Routes mới |
| `services/ptt-crm-api/src/cp/cp.module.ts` | A–C | Providers |

**Khóa schema (lệch chữ ACO, khớp CP đã ship):**

- `crm_cp_render_jobs.draft_id` **nullable**. Job AI Ops bắt buộc `project_id`. CHECK: `draft_id IS NOT NULL OR project_id IS NOT NULL`.
- State thêm `pending_confirm` (map SPEC `PENDING_CONFIRMATION`). Không thay 12 state video cũ.
- Ledger: thêm `provider TEXT`; `kind` giữ CHECK cũ. Magnific/GPU = `reserve`/`charge`/`release` + `provider`.
- Secret Magnific: cột encrypted hoặc file secret manager; **GET connections không SELECT token/key**.

---

## Phase / Task index

| Phase | Task | Xong khi |
|---|---|---|
| F0 | 1–2 | Flag, types, DDL, tab AI Ops + 3 pane (Comfy disabled) |
| A | 3 | Plan Weave Task 1–6 + mount pane + `provider_runs` |
| B | 4–8 | OAuth/REST, jobs, ingest, CPA, pane Magnific |
| C | 9–11 | Bind, adapter, pane; submit chỉ khi health |
| D | 12 | Recommend reason codes — sau A–B có số |
| Ops | 13 | Flag VPS, UAT 20 phút, runbook GPU |

---

### Task 1: Flags, types, tab AI Ops (pure + UI shell)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-ai-ops.flags.ts`
- Create: `services/ptt-crm-api/src/cp/cp-ai-ops.types.ts`
- Test: `services/ptt-crm-api/src/cp/cp-ai-ops.flags.spec.ts`
- Create: `services/ops-web/src/lib/crm/cp-ai-ops-panes.util.ts`
- Test: `services/ops-web/src/lib/crm/cp-ai-ops-panes.util.spec.ts`
- Modify: `services/ops-web/src/lib/crm/cp-project-tabs.util.ts`
- Modify: `services/ops-web/src/lib/crm/cp-project-tabs.util.spec.ts`
- Modify: `services/ops-web/src/components/crm/cp/CpProjectWorkspace.tsx` — thêm tab + mount shell
- Create: `services/ops-web/src/components/crm/cp/CpAiOpsWorkspace.tsx`
- Modify: `services/ops-web/src/app/crm/creative-os/cp.css` (hoặc CSS CP đang import) — `.cp-ai-ops-*`

**Interfaces:**

```ts
export type CpAiOpsProvider =
  | 'stub'
  | 'weavy'
  | 'magnific_mcp'
  | 'magnific_rest'
  | 'comfyui';

export type CpAiOpsPane = 'weave' | 'magnific' | 'comfy';

export function readAiOpsFlags(env: NodeJS.ProcessEnv = process.env): {
  weave: boolean;
  magnificMcp: boolean;
  magnificRest: boolean;
  comfy: boolean;
  showAiOpsTab: boolean;
};

export function parseAiOpsPane(raw: string | null): CpAiOpsPane;

export function aiOpsHref(projectId: string, pane: CpAiOpsPane, extra?: {
  wo?: string;
  job?: string;
}): string;
// → /crm/creative-os/projects/{id}?tab=ai-ops&pane=weave
```

`showAiOpsTab` = `weave || magnificMcp || magnificRest || comfy`.  
Khi chỉ `weave`: default pane `weave`.  
Pane `comfy` **luôn render** nếu tab hiện — nút submit disabled trừ `comfy && health` (health = Task 10; Task 1 chỉ copy “Đang xây GPU — chưa nhận job”).

- [ ] **Step 1: Write failing tests**

```ts
// cp-ai-ops.flags.spec.ts
expect(readAiOpsFlags({}).showAiOpsTab).toBe(false);
expect(readAiOpsFlags({ PTT_WEAVE: '1' }).weave).toBe(true);
expect(readAiOpsFlags({ PTT_WEAVE: '1' }).showAiOpsTab).toBe(true);
expect(readAiOpsFlags({ MAGNIFIC_MCP_ENABLED: '1' }).magnificMcp).toBe(true);
expect(readAiOpsFlags({ MAGNIFIC_REST_API_ENABLED: 'true' }).magnificRest).toBe(true);
expect(readAiOpsFlags({ COMFYUI_WORKER_ENABLED: '1' }).comfy).toBe(true);
```

```ts
// cp-ai-ops-panes.util.spec.ts
expect(parseAiOpsPane(null)).toBe('weave');
expect(parseAiOpsPane('magnific')).toBe('magnific');
expect(parseAiOpsPane('nope')).toBe('weave');
expect(aiOpsHref('p1', 'comfy')).toBe(
  '/crm/creative-os/projects/p1?tab=ai-ops&pane=comfy',
);
```

```ts
// cp-project-tabs.util.spec.ts — đổi
expect(CP_PROJECT_TABS).toHaveLength(9);
expect(CP_PROJECT_TABS.map((t) => t.id)).toContain('ai-ops');
expect(CP_PROJECT_TABS[8]).toEqual({ id: 'ai-ops', label: 'AI Ops' });
```

- [ ] **Step 2: Run** `npx jest --testPathPattern='cp-ai-ops.flags' --no-coverage` trong `services/ptt-crm-api` → FAIL. `npx vitest run src/lib/crm/cp-ai-ops-panes.util.spec.ts src/lib/crm/cp-project-tabs.util.spec.ts` trong `services/ops-web` → FAIL.
- [ ] **Step 3: Implement flags, types, tab id, `CpAiOpsWorkspace`** — 3 nút pane; Magnific chip “Wave B”; Comfy copy GPU; không gọi API generate. `isTab` nhận `ai-ops`. Ẩn tab trên UI khi `showAiOpsTab` false (doc env qua `GET /settings` hoặc prop tạm: đọc `process.env.NEXT_PUBLIC_PTT_WEAVE` **cấm** — FE hỏi `GET /api/crm/cp/ai-ops/flags` stub 404 đến Task 1b).

**Task 1b (cùng commit):** `GET /api/crm/cp/ai-ops/flags` cap `view`, body = `readAiOpsFlags()` (không secret).

```ts
// controller
@Get('ai-ops/flags')
@RequireCpAction('view')
flags() { return readAiOpsFlags(); }
```

FE `CpProjectWorkspace`: fetch flags; nếu `!showAiOpsTab` không render chip AI Ops (vẫn giữ id trong `CP_PROJECT_TABS` — query `tab=ai-ops` lúc tắt → empty “Chưa bật AI Ops” + `—`).

- [ ] **Step 4: Jest + Vitest PASS**
- [ ] **Step 5: Commit** `feat(cp): AI Ops tab shell and provider flags.`

---

### Task 2: DDL foundation (jobs không bắt video draft)

**Files:**
- Create: `docs/specs/2026-09-13-postgresql-ddl-cp-ai-ops.sql`
- Create: `scripts/apply_pg_ddl_cp_ai_ops.sh`
- Create: `services/ptt-crm-api/src/cp/cp-provider-runs.repository.ts`
- Test: `services/ptt-crm-api/src/cp/cp-provider-runs.repository.spec.ts`

**DDL (đủ để apply):**

```sql
ALTER TABLE crm_cp_render_jobs
  ALTER COLUMN draft_id DROP NOT NULL;
ALTER TABLE crm_cp_render_jobs
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES crm_cp_projects(id);
ALTER TABLE crm_cp_render_jobs
  ADD COLUMN IF NOT EXISTS task_id UUID;
ALTER TABLE crm_cp_render_jobs
  ADD COLUMN IF NOT EXISTS brand_kit_version_id UUID;
ALTER TABLE crm_cp_credit_ledger
  ADD COLUMN IF NOT EXISTS provider TEXT;

ALTER TABLE crm_cp_render_jobs DROP CONSTRAINT IF EXISTS crm_cp_job_state_chk;
ALTER TABLE crm_cp_render_jobs ADD CONSTRAINT crm_cp_job_state_chk CHECK (
  state IN (
    'draft','pending_confirm','queued','preparing','rendering','processing',
    'qc','review','completed','failed','cancelled','expired'
  )
);

ALTER TABLE crm_cp_render_jobs DROP CONSTRAINT IF EXISTS crm_cp_job_scope_chk;
ALTER TABLE crm_cp_render_jobs ADD CONSTRAINT crm_cp_job_scope_chk CHECK (
  draft_id IS NOT NULL OR project_id IS NOT NULL
);

CREATE TABLE IF NOT EXISTS crm_cp_provider_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  provider TEXT NOT NULL CHECK (provider IN (
    'magnific_mcp','magnific_rest','comfyui','weavy'
  )),
  status TEXT NOT NULL DEFAULT 'off',
  account_label TEXT,
  secret_ref TEXT,
  expires_at TIMESTAMPTZ,
  created_by_staff_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT crm_cp_provider_connections_tenant_chk CHECK (tenant_id = 'PTT')
);

CREATE TABLE IF NOT EXISTS crm_cp_provider_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES crm_cp_render_jobs(id),
  work_order_id UUID,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'manual',
  external_run_id TEXT,
  tool_or_workflow TEXT,
  request_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_redacted_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimate_credits INT,
  actual_credits INT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'started',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_cp_prompt_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES crm_cp_projects(id),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  current_version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crm_cp_prompt_package_versions (
  package_id UUID NOT NULL REFERENCES crm_cp_prompt_packages(id) ON DELETE CASCADE,
  n INT NOT NULL,
  payload_json JSONB NOT NULL,
  approved_by INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (package_id, n)
);

CREATE TABLE IF NOT EXISTS crm_cp_provider_template_map (
  template_id UUID NOT NULL,
  provider TEXT NOT NULL,
  external_ref TEXT NOT NULL,
  bindings_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (template_id, provider)
);

CREATE TABLE IF NOT EXISTS crm_cp_workflow_bindings (
  template_id UUID NOT NULL,
  version TEXT NOT NULL,
  bindings_json JSONB NOT NULL,
  fixture_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (template_id, version)
);
```

**Interfaces:**

```ts
export async function insertProviderRun(input: {
  jobId?: string | null;
  workOrderId?: string | null;
  provider: CpAiOpsProvider;
  mode: 'manual' | 'auto';
  externalRunId?: string | null;
  toolOrWorkflow?: string | null;
  estimateCredits?: number | null;
  status?: string;
}): Promise<{ id: string }>;
```

- [ ] **Step 1: Spec** — insert run `provider=weavy` không cần `job_id`; reject `provider=openai`.
- [ ] **Step 2: FAIL → apply script + repository**
- [ ] **Step 3: Jest PASS** (repo có thể mock `query`)
- [ ] **Step 4: Commit** `feat(cp): AI Ops provider_runs DDL and render job project scope.`

---

### Task 3: Wave A — Weave Mức 2 (plan con + delta)

**Làm đúng thứ tự Task 1–6** của [2026-09-12-figma-weave-work-order.md](./2026-09-12-figma-weave-work-order.md).

**Delta bắt buộc (cấm tab `weave` riêng):**

| Plan Weave nói | Làm thật |
|---|---|
| Tab **Weave** / `?tab=weave` | Pane: `CpWeaveWorkOrder` **bên trong** `CpAiOpsWorkspace` khi `pane=weave` |
| `page.tsx` tab Weave | Không thêm id `weave` vào `CP_PROJECT_TABS` |
| Ingest xong | `insertProviderRun({ provider: 'weavy', mode: 'manual', workOrderId })` + optional `crm_cp_render_jobs` `provider=weavy` `state=completed` `project_id` set, `draft_id` null |
| CSS | Giữ `cp-weave-*` trong pane |

Cổng GT-W, path `CR-YYYY-MMDD-NNN`, HMAC, watermark: **không đổi**.

- [ ] **Step 1:** Chạy hết checkbox plan Weave (TDD từng task).
- [ ] **Step 2:** Vitest/Playwright: mở `/projects/{id}?tab=ai-ops&pane=weave`, thấy **Sync output**; `?tab=weave` không phải tab hợp lệ (fallback overview hoặc ai-ops).
- [ ] **Step 3:** Commit cuối Wave A (nếu plan Weave đã commit từng task thì commit delta): `feat(cp): mount Weave work order on AI Ops pane.`

**Cửa A:** UAT 12 phút SPEC-CP-WEAVE-WIN. `PTT_WEAVE=0` → không thao tác WO (404/ẩn).

---

### Task 4: Magnific connections (OAuth MCP + REST key)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-magnific-oauth.util.ts`
- Test: `services/ptt-crm-api/src/cp/cp-magnific-oauth.util.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-provider-connections.service.ts`
- Test: `services/ptt-crm-api/src/cp/cp-provider-connections.service.spec.ts`
- Modify: `cp.controller.ts` — routes connections
- Modify: `CpSettings.tsx` — khối Magnific trên `tab=integrations` (không composer)

**Interfaces:**

```ts
export function createMagnificOAuthState(input: {
  staffId: number;
  ttlSec?: number;
}): { state: string; expiresAt: Date };

export function verifyMagnificOAuthState(state: string, now?: Date): { staffId: number };

export function redactConnectionRow(row: Record<string, unknown>): {
  id: string;
  provider: string;
  status: string;
  account_label: string | null;
  expires_at: string | null;
  has_secret: boolean;
};
// cấm field access_token, refresh_token, api_key, secret_ref raw
```

Routes:

| Method | Path | Cap |
|---|---|---|
| GET | `/provider-connections` | view |
| POST | `/provider-connections/magnific/oauth/start` | manage |
| GET | `/provider-connections/magnific/oauth/callback` | manage (query code+state) |
| POST | `/provider-connections/magnific/rest-key` | manage — body `{ api_key }` |
| POST | `/provider-connections/:id/disconnect` | manage |

GT-M07: snapshot GET connections trong test — JSON không match `/token|api_key/i` trừ `has_secret`.

- [ ] **Step 1: Tests** — bad state → throw; redact strips secrets; rest-key persist gọi encrypt stub; GET list không chứa raw key.
- [ ] **Step 2: FAIL → implement** (token encrypt = `createCipheriv` + `PTT_SECRET_ENCRYPT_KEY` 32 bytes; thiếu key → 503 `secret_key_missing`, không ghi plaintext).
- [ ] **Step 3: Settings UI** — “Connect Magnific MCP”, “Lưu API key” (input type password, không hiện lại). Copy tiếng Việt.
- [ ] **Step 4: Commit** `feat(cp): Magnific MCP OAuth and REST key connections.`

---

### Task 5: Policy + job draft/confirm/submit (Magnific)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-magnific-policy.util.ts`
- Test: `services/ptt-crm-api/src/cp/cp-magnific-policy.util.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-jobs.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-jobs.repository.ts`
- Test: `services/ptt-crm-api/src/cp/cp-jobs.service.spec.ts`
- Modify: `cp.controller.ts`
- Modify: `cp-ledger.service.ts` — `append` nhận `provider?: string` (cột mới)

**Interfaces:**

```ts
export const MAGNIFIC_PILOT_CAPABILITIES = [
  'account_balance',
  'images_generate',
  'images_upscale',
  'images_remove_background',
  'images_crop',
  'images_resize',
  'video_generate',
  'creation_status',
  'creations_wait',
  'creations_get',
] as const;

export function mapMagnificTool(
  capability: string,
  discoveredNames: string[],
): string; // 409 mcp_tool_unavailable nếu không map được

export function assertMagnificAllowed(input: {
  provider: 'magnific_mcp' | 'magnific_rest';
  flags: ReturnType<typeof readAiOpsFlags>;
  classification?: string | null;
  externalProhibited?: boolean;
}): void; // GT-M01 / GT-M05

export type CpJobDraftInput = {
  project_id: string;
  task_id?: string;
  template_id?: string;
  provider: 'magnific_mcp' | 'magnific_rest';
  provider_mode?: 'manual' | 'recommended';
  prompt_package_id?: string | null;
  inputs: Record<string, unknown>;
  idempotency_key: string;
};

export class CpJobsService {
  draft(staffId: number, input: CpJobDraftInput): Promise<{
    job_id: string;
    status: 'draft' | 'pending_confirm';
    estimate: { credits: number | null; duration_sec: number | null };
    requires_confirmation: boolean;
  }>;
  confirm(staffId: number, jobId: string, body: { confirm: boolean }): Promise<unknown>;
  submit(staffId: number, jobId: string): Promise<unknown>;
  cancel(staffId: number, jobId: string): Promise<unknown>;
}
```

**Rules (test bắt buộc):**

- Thiếu `project_id` → 422 GT-A01.
- `confirm !== true` trên confirm → 400 `human_confirm_required`.
- Flag tắt → 409 / 404 GT-A03.
- RESTRICTED hoặc `externalProhibited` → 409 GT-M05.
- Cùng `idempotency_key` → cùng `job_id` (GT-A10).
- Confirm: `reserve` ledger `provider=magnific_mcp|magnific_rest`. Submit fail → `release` cùng số, key `rel:{idempotency}`.
- Estimate > `high_cost_threshold` settings → cần cap `crm_cp.render_high_cost`.
- `submit` không được gọi từ code path AI gateway (không inject service vào generate-brief).

Adapter Task 6 còn stub: `submit` ghi run `status=queued` + gọi port.

```ts
export interface MagnificAdapterPort {
  getBalance(): Promise<{ credits: number | null }>;
  generate(input: {
    transport: 'mcp' | 'rest';
    capability: string;
    inputs: Record<string, unknown>;
  }): Promise<{ externalRunId: string }>;
  wait(externalRunId: string): Promise<{ outputUrls: string[]; actualCredits: number | null }>;
  download(url: string): Promise<{ bytes: Buffer; mime: string }>;
}
```

- [ ] **Step 1: Service spec FAIL** (mock adapter + db)
- [ ] **Step 2: Implement jobs + policy + routes**

| Method | Path | Cap |
|---|---|---|
| POST | `/jobs/draft` | edit |
| POST | `/jobs/:id/confirm` | render |
| POST | `/jobs/:id/submit` | render |
| POST | `/jobs/:id/cancel` | render |
| POST | `/jobs/:id/retry` | render |
| GET | `/jobs/:id` | view |

- [ ] **Step 3: Jest PASS**
- [ ] **Step 4: Commit** `feat(cp): Magnific job draft, confirm, and cost reserve.`

---

### Task 6: Magnific adapters + ingest provenance

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-magnific-mcp.adapter.ts`
- Create: `services/ptt-crm-api/src/cp/cp-magnific-rest.adapter.ts`
- Test: `services/ptt-crm-api/src/cp/cp-magnific-mcp.adapter.spec.ts` (mock fetch)
- Test: `services/ptt-crm-api/src/cp/cp-magnific-rest.adapter.spec.ts`
- Modify: `cp-jobs.service.ts` — wait → download → `CpAssetsService` finalize
- Modify: `cp-assets` provenance JSON: `provider`, `external_run_id`, `tool`, `checksum`

**MCP:** base `https://mcp.magnific.com`. Discover `tools/list` cache 15 phút (memory TTL). Timeout submit 60s. Wait video: settings, default 600s.  
**REST:** base URL từ env `MAGNIFIC_REST_BASE` (không hard-code path vendor nếu docs đổi — map trong adapter + test). Header API key **chỉ** server.

GT-M02: `getBalance()` null → không submit.  
GT-M06: không checksum → `state=failed` `error_class=ASSET_SYNC_FAILED`.  
Probe: duration/width null nếu thiếu — cấm `0`.

- [ ] **Step 1: Adapter tests** — map tool; 401 OAuth → `magnific_disconnected`; download copy buffer; redact logs.
- [ ] **Step 2: Worker loop** (có thể tái dùng `CpRenderWorker` nhánh `provider.startsWith('magnific')`) — SSE events hiện có.
- [ ] **Step 3: Commit** `feat(cp): Magnific MCP and REST adapters with DAM ingest.`

---

### Task 7: CPA report + OVR chips

**Files:**
- Modify: `services/ptt-crm-api/src/cp/cp-reports.service.ts` — credit payload thêm:

```ts
cpa: number | null; // null → FE —
cpa_numerator: number | null;
cpa_denominator: number; // approved count; 0 → cpa null
by_provider: Array<{ provider: string; charged: number | null }>;
```

- Test: `cp-reports.service.spec.ts` — denominator 0 → `cpa === null`; không `0`.
- Modify: `CpOverview` / project overview — chip link `aiOpsHref(id,'weave')` với count WO/jobs (query thật, `—` nếu 0 hàng).
- Modify: `cp-overview.service.ts` health providers include `weavy` / `magnific_*` khi có job.

- [ ] **Step 1: Test CPA FAIL → implement**
- [ ] **Step 2: Commit** `feat(cp): cost per approved asset slice and AI Ops chips.`

---

### Task 8: UI pane Magnific + Playwright

**Files:**
- Create: `services/ops-web/src/lib/crm/cp-ai-ops-api.ts`
- Create: `services/ops-web/src/components/crm/cp/CpAiOpsMagnificPane.tsx`
- Modify: `CpAiOpsWorkspace.tsx` — mount pane
- Test: `services/ops-web/src/lib/crm/cp-ai-ops-api.spec.ts`
- E2E: `services/ops-web/e2e/cp-ai-ops-magnific.spec.ts` (mock API)

UI: radio **API** / **MCP** (disable radio nếu flag off). Estimate. Checkbox confirm. Submit. Progress. Không secret. `ingested=0` không toast “Thành công”.

- [ ] **Step 1: Vitest href + disable rules**
- [ ] **Step 2: Pane + e2e** — draft → confirm thiếu → hiện 400 copy; mock submit → asset id
- [ ] **Step 3: Commit** `feat(cp): Magnific composer on AI Ops pane.`

**Cửa B:** 1 job REST + 1 job MCP (staging) vào DAM; Network tab không có token; Settings GET không echo key.

---

### Task 9: Comfy bind util (GPU chưa cần sống)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-comfy-bind.util.ts`
- Test: `services/ptt-crm-api/src/cp/cp-comfy-bind.util.spec.ts`

```ts
export function bindComfyWorkflow(input: {
  workflow: Record<string, { class_type: string; inputs: Record<string, unknown> }>;
  bindings: Record<string, { nodeId: string; inputKey: string }>;
  values: Record<string, unknown>;
}): Record<string, { class_type: string; inputs: Record<string, unknown> }>;
```

- Extra key trong `values` không có binding → throw `unsafe_binding` (GT-C02).
- Node id không tồn tại → throw `unsafe_binding`.
- Fixture packshot: `bindings.positivePrompt` node `20` / `text`.

- [ ] **Step 1–4: TDD + commit** `feat(cp): ComfyUI whitelist workflow binding.`

---

### Task 10: Comfy adapter + health + job provider=comfyui

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-comfy.adapter.ts`
- Test: `services/ptt-crm-api/src/cp/cp-comfy.adapter.spec.ts` (mock http)
- Modify: `cp-jobs.service.ts` — nhánh `comfyui` (cùng draft/confirm)
- Modify: `GET /provider-health` — `{ comfy: { ok, vram_mb, checked_at } | { ok: false, reason: 'gpu_building' } }`
- Env: `COMFYUI_GATEWAY_URL` (internal). Browser không nhận URL này trong JSON FE — health chỉ `ok` + `reason` + `vram_mb`.

Khi `COMFYUI_WORKER_ENABLED≠1` hoặc heartbeat fail: `getBalance`-tương đương health fail → submit 409 `WORKER_UNAVAILABLE` (GT-C01). Không POST `:8188` public.

```ts
export class CpComfyAdapter {
  systemStats(): Promise<{ vram_mb: number | null; ok: boolean }>;
  prompt(jobId: string, boundWorkflow: unknown): Promise<{ promptId: string }>;
  history(promptId: string): Promise<{ outputFiles: string[] }>;
  interrupt(promptId: string): Promise<void>;
}
```

`client_id` = `ptt-{jobId}`. Ingest giống Task 6. OOM → retry 1 lần `attempt+1`.

- [ ] **Step 1: Tests** — flag off không fetch gateway; bind+prompt mock; ingest checksum.
- [ ] **Step 2: Implement**
- [ ] **Step 3: Commit** `feat(cp): ComfyUI gateway adapter and health.`

---

### Task 11: UI pane Comfy

**Files:**
- Create: `services/ops-web/src/components/crm/cp/CpAiOpsComfyPane.tsx`
- Modify: `CpAiOpsWorkspace.tsx`
- Modify: `CpSettings.tsx` integrations — “GPU chưa sẵn sàng” + (manage) field gateway **không** hiện trên composer
- E2E: `services/ops-web/e2e/cp-ai-ops-comfy.spec.ts` — submit disabled khi health `gpu_building`

Copy khóa: **Đang xây GPU — chưa nhận job.**

- [ ] **Step 1–3: Pane + e2e + commit** `feat(cp): Comfy pane gated on GPU health.`

**Cửa C:** pentest không thấy `:8188` trên FE; UAT submit chỉ khi heartbeat < 30s.

---

### Task 12: Wave D — recommend (không AUTO)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-ai-ops-route.util.ts`
- Test: `services/ptt-crm-api/src/cp/cp-ai-ops-route.util.spec.ts`

```ts
export function recommendProvider(input: {
  restricted: boolean;
  needsPrivateLora: boolean;
  urgentPremium: boolean;
  humanCanvas: boolean;
  magnificUp: boolean;
  comfyUp: boolean;
}): { provider: CpAiOpsProvider; reasonCodes: string[] };
```

- `humanCanvas` → `weavy` + `WEAVE_HUMAN_CANVAS`
- `restricted || needsPrivateLora` → `comfyui` hoặc reject nếu `!comfyUp`
- `urgentPremium && magnificUp` → `magnific_mcp` + `URGENT_PREMIUM`
- **Không** gọi submit.

Optional: draft `provider_mode=recommended` hiện reason trên pane. Cấm AUTO burn.

- [ ] **Step 1–4: TDD + commit** `feat(cp): AI Ops provider recommendation reasons.`

---

### Task 13: Vận hành VPS + UAT (trước flag=1)

**Không bật hết flag một lúc.**

1. Apply `scripts/apply_pg_ddl_cp_ai_ops.sh` + DDL Weave (plan A).
2. Env mẫu:

```
PTT_WEAVE=0
MAGNIFIC_MCP_ENABLED=0
MAGNIFIC_REST_API_ENABLED=0
COMFYUI_WORKER_ENABLED=0
WEAVE_OPEN_BASE=https://app.weavy.ai/
WEAVE_EXPORT_PREFIX=/var/www/rnosai/data/cp-weave-export
PTT_WEAVE_INGEST=0
PTT_WEAVE_WEBHOOK_SECRET=
PTT_SECRET_ENCRYPT_KEY=
MAGNIFIC_REST_BASE=
COMFYUI_GATEWAY_URL=
CP_AI_ENABLED=0
```

3. UAT Wave A trên `rs.pttads.vn`: `PTT_WEAVE=1` + restart `ptt-crm-api` `ptt-ops-web` (sudo tay nếu script bỏ qua). Demo 12 phút Mid-Autumn.
4. Wave B: connect OAuth + key staging → 1 REST + 1 MCP → DAM + CPA `—` hoặc số thật. Restart sau flag.
5. Wave C: giữ 0 đến checklist GPU (VPN, 8188 localhost, on-call). Pane vẫn hiện.
6. Alert: token fail, ingest fail, budget 80%, Comfy heartbeat.

**Fail UAT nếu:** đoán folder Weave; duration `0`; `source/` gửi Hub; token trên FE; Comfy URL trên JSON flags; CPA `0` khi mẫu số 0; tab `weave` riêng; `/api/v1`.

---

## Self-review

| SPEC | Task |
|---|---|
| §4A IA tab AI Ops | 1, 3, 8, 11 |
| Q-A16 Magnific REST+MCP cùng wave | 4–8 |
| Q-A17 không nav mới | 1 |
| GT-W / FR-W | 3 → plan Weave |
| GT-M / FR-A-005…007, 011–012 | 4–8 |
| GT-C / FR-A-008…010 | 9–11 |
| FR-A-013 recommend | 12 |
| FR-A-014 prompt package | Task 2 bảng; CRUD UI Wave B+ nếu cần — **A dùng brief_json** (đủ cửa A) |
| NFR CPA / null | 7 |
| GPU đang xây | 1 copy + 11 disable + 13 flag 0 |
| Cấm `/api/v1` ACO | Global + 13 |

Placeholder: không. `kind=provider_magnific` ACO → **cột `provider` + kind charge** (khóa architecture, không phải TBD).

---

## Ngoài plan này

- Weavy native API, RAG, tách billing Magnific đa account, TTS/3D, marketplace, Video SOP insert, CSD.

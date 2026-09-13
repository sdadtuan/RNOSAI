# Wave B+ — Magnific Spaces Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Spec SoT:** [SPEC-CP-MAGNIFIC-FLOWS v1.0](../specs/2026-09-13-cp-magnific-flows-srs.md)
>
> **Cha:** [SPEC-CP-ACO-WIN v1.1](../specs/2026-09-13-cp-ai-ops-provider-integration-srs.md) Wave B — adapter REST/MCP + pane Magnific + jobs draft/confirm/ingest **phải đã merge** (hoặc ship trong cùng branch trước Task 6).
>
> **Artifact:** [`docs/magnific/social-916-flow-api-runs.json`](../../magnific/social-916-flow-api-runs.json) · [`social-916-flow-blueprint.json`](../../magnific/social-916-flow-blueprint.json)

**Goal:** Operator chọn template Flow (pilot **Social 9:16**) trên project CRM → confirm credit → RNOSAI `POST /v1/ai/flows/{sqid}/run` → poll → video về `crm_cp_assets` với provenance `flow:{sqid}`.

**Architecture:** Mở rộng module `cp`. `execution_kind=flow` lưu trong `stage_log_json`. Template map = `crm_cp_provider_template_map` (`provider=magnific_rest`, `external_ref=sqid`). Adapter mới `CpMagnificFlowsAdapter` gọi Magnific Flows API; `CpJobsService.submit/ingest` branch flow vs tool. UI = mở rộng `CpAiOpsMagnificPane` — dropdown template + prompt fields động.

**Tech Stack:** Nest `ptt-crm-api` · ops-web · Postgres · Jest · Vitest · Playwright · Magnific REST `https://api.magnific.com/v1/ai/flows*`

## Global Constraints

- Prefix `/api/crm/cp`. Không `/api/v1`.
- Flag mặc định `0`: `MAGNIFIC_FLOWS_ENABLED` **và** yêu cầu `MAGNIFIC_REST_API_ENABLED=1`.
- `execution_kind=tool` (Wave B) **không regress** khi `MAGNIFIC_FLOWS_ENABLED=0`.
- Không import JSON graph Spaces. Không iframe Magnific.
- API key / token **server-only** — test bắt response JSON không chứa `X-Magnific-Api-Key`.
- Confirm: `confirm !== true` → 400 `human_confirm_required`.
- Ingest bytes bắt buộc — không `completed` khi 0 asset (GT-M06 / GT-MF05).
- UI tiếng Việt. Empty `—`. Không seed sqid giả prod.
- TDD: test đỏ → code → test xanh → commit. Không `--no-verify`.
- Cap: `crm_cp.view` / `edit` / `render` / `render_high_cost` / `manage`.

---

## File map

| File | Việc |
|---|---|
| `docs/specs/2026-09-13-postgresql-ddl-cp-magnific-flows.sql` | `crm_cp_magnific_flow_cache` (+ WO optional comment-only) |
| `scripts/apply_pg_ddl_cp_magnific_flows.sh` | `psql -f` |
| `services/ptt-crm-api/src/cp/cp-ai-ops.flags.ts` | `magnificFlows: boolean` |
| `services/ptt-crm-api/src/cp/cp-magnific-flow-bind.util.ts` | Resolve bindings → Magnific `inputs` |
| `services/ptt-crm-api/src/cp/cp-magnific-flows.adapter.ts` | list/get/run/getRun |
| `services/ptt-crm-api/src/cp/cp-magnific-flows.adapter.spec.ts` | Jest + fetch mock |
| `services/ptt-crm-api/src/cp/cp-magnific-flow-cache.repository.ts` | TTL cache GET flow |
| `services/ptt-crm-api/src/cp/cp-magnific-flow-templates.service.ts` | Catalog ∩ Magnific list |
| `services/ptt-crm-api/src/cp/cp-magnific-policy.util.ts` | + `flows_*` allowlist |
| `services/ptt-crm-api/src/cp/cp-jobs.service.ts` | draft/submit/ingest branch flow |
| `services/ptt-crm-api/src/cp/cp-jobs.service.spec.ts` | + flow scenarios |
| `services/ptt-crm-api/src/cp/cp.controller.ts` | `GET /magnific/flows`, `/magnific/templates` |
| `services/ptt-crm-api/src/cp/cp.module.ts` | Wire flows adapter |
| `services/ops-web/src/lib/crm/cp-ai-ops-api.ts` | listFlowTemplates, draftFlowJob |
| `services/ops-web/src/lib/crm/cp-ai-ops-flow.util.ts` | Form fields từ bindings |
| `services/ops-web/src/lib/crm/cp-ai-ops-flow.util.spec.ts` | Vitest |
| `services/ops-web/src/components/crm/cp/CpAiOpsMagnificPane.tsx` | Template select + flow mode |
| `services/ops-web/e2e/cp-ai-ops-magnific-flows.spec.ts` | Playwright |
| `scripts/seed_cp_magnific_flow_templates_staging.sql` | `social_916_i2v` — **sqid placeholder** |
| `docs/runbooks/cp-magnific-flows.md` | Flag, rollback, UAT |
| `scripts/deploy_cp_magnific_flows_staging.sh` | DDL + build; flag off default |

**Không tạo:** MCP `weave_run_tool` (Wave B+2), work order B+3, webhook prod (Task 12 optional).

---

## Phase index

| Phase | Task | Xong khi |
|---|---|---|
| F0 | 1–2 | DDL + flag `MAGNIFIC_FLOWS_ENABLED` |
| Core | 3–5 | Bind util + flows adapter + cache |
| API | 6–8 | Templates service + jobs branch + controller |
| FE | 9–10 | Pane flow UI + Vitest |
| QA | 11–12 | Jest integration + Playwright |
| Ops | 13–14 | Seed staging + runbook + deploy script |

**Phụ thuộc:** Publish Flow staging trên Magnific → ghi `sqid` vào seed Task 13 trước UAT thật.

---

### Task 1: DDL flow cache

**Files:**
- Create: `docs/specs/2026-09-13-postgresql-ddl-cp-magnific-flows.sql`
- Create: `scripts/apply_pg_ddl_cp_magnific_flows.sh`

**Schema (khóa):**

```sql
CREATE TABLE IF NOT EXISTS crm_cp_magnific_flow_cache (
  sqid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  inputs_schema_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost INT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
```

- [ ] **Step 1:** Script apply idempotent (`IF NOT EXISTS`).
- [ ] **Step 2:** Run locally / CI against test DB.
- [ ] **Step 3:** Commit `feat(cp): ddl magnific flow cache`.

---

### Task 2: Flag `MAGNIFIC_FLOWS_ENABLED`

**Files:**
- Modify: `services/ptt-crm-api/src/cp/cp-ai-ops.flags.ts`
- Test: `services/ptt-crm-api/src/cp/cp-ai-ops.flags.spec.ts`
- Modify: `services/ops-web/src/lib/crm/cp-api.ts` — `CpAiOpsFlags.magnificFlows`
- Modify: `services/ptt-crm-api/src/cp/cp.controller.ts` — expose trong `GET .../ai-ops/flags`

**Interface:**

```ts
export function readAiOpsFlags(env = process.env): {
  // ...
  magnificFlows: boolean;
};

export function isMagnificFlowsEnabled(flags: ReturnType<typeof readAiOpsFlags>): boolean {
  return flags.magnificFlows && flags.magnificRest;
}
```

- [ ] **Step 1: Write failing tests**

```ts
expect(readAiOpsFlags({ MAGNIFIC_FLOWS_ENABLED: '1' }).magnificFlows).toBe(true);
expect(isMagnificFlowsEnabled({ magnificFlows: true, magnificRest: false, /*...*/ })).toBe(false);
expect(isMagnificFlowsEnabled({ magnificFlows: true, magnificRest: true, /*...*/ })).toBe(true);
```

- [ ] **Step 2:** Implement flag parse (`1` / `true`).
- [ ] **Step 3:** Run `npm test -- cp-ai-ops.flags.spec.ts` trong `ptt-crm-api`.
- [ ] **Step 4:** Commit.

---

### Task 3: Flow bindings util

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-magnific-flow-bind.util.ts`
- Test: `services/ptt-crm-api/src/cp/cp-magnific-flow-bind.util.spec.ts`

**Interfaces:**

```ts
export type MagnificFlowBindings = {
  execution_kind: 'flow';
  flow_sqid: string;
  input_bindings: Record<string, {
    source: 'prompt_field' | 'asset_ref' | 'literal';
    key?: string;
    required?: boolean;
    media_type?: 'image';
    value?: unknown;
  }>;
  defaults?: Record<string, unknown>;
  estimate_credits?: number;
  requires_render_high_cost?: boolean;
  output_expectation?: { videos_min?: number; mime?: string[] };
};

export function parseFlowBindings(raw: unknown): MagnificFlowBindings;
export function resolveFlowInputs(
  bindings: MagnificFlowBindings,
  composer: Record<string, unknown>,
  ctx: { assetUrl?: (id: string) => Promise<string> },
): Promise<Record<string, string | number>>;
```

**Tests (đỏ trước):**
- `image_prompt` + `motion_prompt` → Magnific inputs object.
- Missing required → throw `flow_input_missing`.
- `asset_ref` + no URL → throw.
- `literal` in defaults merged.

- [ ] **Step 1:** Tests above.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** `npm test -- cp-magnific-flow-bind.util.spec.ts`.
- [ ] **Step 4:** Commit.

---

### Task 4: Magnific Flows REST adapter

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-magnific-flows.adapter.ts`
- Test: `services/ptt-crm-api/src/cp/cp-magnific-flows.adapter.spec.ts`

**Base:** Reuse `magnificDownloadAuthHeaders`, `assertMagnificHttpStatus` từ `cp-magnific-http.util.ts`.

**Methods:**

```ts
@Injectable()
export class CpMagnificFlowsAdapter {
  listFlows(search?: string): Promise<Array<{ sqid: string; name: string; total_cost: number | null }>>;
  getFlow(sqid: string): Promise<{ sqid: string; name: string; inputs: Array<{ api_key: string; type: string; required: boolean }>; total_cost: number | null }>;
  runFlow(sqid: string, inputs: Record<string, unknown>, webhook?: string): Promise<{ workflowRunIdentifier: string }>;
  getFlowRun(runId: string): Promise<{ status: string; result?: { videos?: string[]; images?: string[] }; error_message?: string }>;
}
```

**Paths:** `GET /v1/ai/flows`, `GET /v1/ai/flows/{sqid}`, `POST /v1/ai/flows/{sqid}/run`, `GET /v1/ai/flows/runs/{run-id}`.

**Tests (fetch mock):**
- list → parses `data[]`.
- run → 202 + `workflow_run_identifier`.
- getRun `completed` → extracts first video URL.
- 401 → `magnific_upstream_failed`.
- Flag off caller throws `magnific_flows_disabled` (guard ở service layer Task 6).

- [ ] **Step 1:** Failing adapter specs.
- [ ] **Step 2:** Implement adapter.
- [ ] **Step 3:** Jest green.
- [ ] **Step 4:** Commit.

---

### Task 5: Flow definition cache

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-magnific-flow-cache.repository.ts`
- Test: `services/ptt-crm-api/src/cp/cp-magnific-flow-cache.repository.spec.ts`

**Behavior:**
- `get(sqid)` → row if `expires_at > now()`.
- `upsert(detail, ttlSec)` from env `MAGNIFIC_FLOW_CACHE_TTL_SEC` default 900.
- Miss → adapter.getFlow → upsert.

- [ ] **Step 1:** Test hit/miss/expiry.
- [ ] **Step 2:** Implement.
- [ ] **Step 3:** Commit.

---

### Task 6: Flow templates service

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-magnific-flow-templates.service.ts`
- Test: `services/ptt-crm-api/src/cp/cp-magnific-flow-templates.service.spec.ts`

**SQL:** Join `crm_cp_templates` + `crm_cp_provider_template_map` WHERE `provider='magnific_rest'` AND `bindings_json->>'execution_kind'='flow'` AND `active=true`.

**Methods:**

```ts
listForProject(): Promise<Array<{
  template_id: string;
  name: string;
  flow_sqid: string;
  bindings: MagnificFlowBindings;
  estimate_credits: number | null;
}>>;

validateDraft(input: {
  template_id: string;
  inputs: Record<string, unknown>;
}): Promise<{ flow_inputs: Record<string, unknown>; estimate: { credits: number | null } }>;
```

**Tests:**
- No map row → 422 `flow_template_invalid`.
- Flow GET 404 → 502 `magnific_flow_not_found`.
- Estimate from `tool_metadata.total_cost` or bindings.estimate_credits.

- [ ] **Step 1:** Failing tests.
- [ ] **Step 2:** Implement + wire cache.
- [ ] **Step 3:** Commit.

---

### Task 7: Jobs service — flow draft / submit / ingest

**Files:**
- Modify: `services/ptt-crm-api/src/cp/cp-jobs.service.ts`
- Test: `services/ptt-crm-api/src/cp/cp-jobs.service.spec.ts`
- Modify: `services/ptt-crm-api/src/cp/cp-magnific-policy.util.ts` — `assertMagnificFlowsAllowed()`

**Draft extension** — accept body:

```json
{
  "execution_kind": "flow",
  "template_id": "uuid",
  "inputs": { "image_prompt": "...", "motion_prompt": "..." }
}
```

Store in `stage_log_json`:
`execution_kind`, `flow_sqid`, `flow_inputs`, `template_id`.

**Submit branch** when `log.execution_kind === 'flow'`:
1. `assertMagnificFlowsAllowed(flags)`
2. `flows.runFlow(sqid, flow_inputs)`
3. `external_run_id = workflow_run_identifier`
4. `tool_or_workflow = flow:{sqid}`
5. state `queued`

**Ingest branch** — new `pullMagnificFlowOutput`:
- Poll `getFlowRun(runId)` until terminal (reuse env `MAGNIFIC_FLOW_WAIT_MS`, `MAGNIFIC_FLOW_POLL_MS`).
- `status=failed` → `failAssetSync`
- Pick first URL from `result.videos` then `result.images`
- Download via existing `adapter.download`
- **Idempotency:** if `log.workflow_run_identifier` exists and job `queued`, do not double `runFlow` on retry submit.

**Tests:**
- Flag off + execution_kind flow → 409 `magnific_flows_disabled`.
- Draft missing prompt → 422 `flow_input_missing`.
- Submit mock run → queued + external_run_id.
- Ingest completed → state `qc` + asset_id (mock assets service).
- Tool mode job unchanged when execution_kind absent.

- [ ] **Step 1:** Add failing specs (≥6 cases).
- [ ] **Step 2:** Implement branches; inject `CpMagnificFlowsAdapter` in module.
- [ ] **Step 3:** `npm test -- cp-jobs.service.spec.ts`.
- [ ] **Step 4:** Commit.

---

### Task 8: Controller routes

**Files:**
- Modify: `services/ptt-crm-api/src/cp/cp.controller.ts`
- Test: `services/ptt-crm-api/src/cp/cp.controller.spec.ts` (hoặc e2e cp module)

| Method | Path | Cap |
|---|---|---|
| GET | `/magnific/flows` | view |
| GET | `/magnific/flows/:sqid` | view |
| GET | `/magnific/templates` | view |

**Behavior:**
- Flag off → 404 `{ error: "magnific_flows_disabled" }` (hoặc 409 — khóa một kiểu, test cố định).
- Response **không** echo API key.
- `/magnific/templates` = templates service list.

- [ ] **Step 1:** Controller tests mock service.
- [ ] **Step 2:** Routes + guards.
- [ ] **Step 3:** Commit.

---

### Task 9: ops-web — flow util + API client

**Files:**
- Create: `services/ops-web/src/lib/crm/cp-ai-ops-flow.util.ts`
- Test: `services/ops-web/src/lib/crm/cp-ai-ops-flow.util.spec.ts`
- Modify: `services/ops-web/src/lib/crm/cp-ai-ops-api.ts`

**Util:**

```ts
export type FlowTemplateOption = { template_id: string; name: string; fields: Array<{ key: string; label: string; kind: 'text' | 'asset' }> };

export function fieldsFromBindings(bindings: MagnificFlowBindings): FlowTemplateOption['fields'];
export function buildFlowDraftBody(projectId: string, templateId: string, values: Record<string, string>): object;
```

**API:**

```ts
export function listMagnificFlowTemplates(token: string, projectId: string): Promise<{ items: FlowTemplateOption[] }>;
export function draftMagnificFlowJob(token: string, body: object): Promise<CpJobDraftResult>;
```

- [ ] **Step 1:** Vitest fieldsFromBindings với fixture `social_916_i2v`.
- [ ] **Step 2:** Implement util + API wrappers.
- [ ] **Step 3:** `npm test -- cp-ai-ops-flow.util.spec.ts` trong ops-web.
- [ ] **Step 4:** Commit.

---

### Task 10: ops-web — Magnific pane flow UI

**Files:**
- Modify: `services/ops-web/src/components/crm/cp/CpAiOpsMagnificPane.tsx`
- Modify: `services/ops-web/src/lib/crm/cp-ai-ops-panes.util.ts` — `isMagnificFlowModeEnabled(flags)`
- Test: extend `cp-ai-ops-composer.util.spec.ts` nếu cần copy

**UI khi `magnificFlows && magnificRest`:**
1. Toggle **Chế độ:** Tool đơn | **Flow (Spaces)**
2. Flow mode: `<select template>` load từ `GET /magnific/templates`
3. Dynamic textareas `image_prompt`, `motion_prompt`
4. Optional asset picker nếu template có `start_image`
5. Draft → Confirm → Submit — reuse existing job buttons
6. Progress states giữ tiếng Việt

**Khi flag off:** ẩn toggle; tool mode only.

- [ ] **Step 1:** Manual checklist + Vitest util (Task 9).
- [ ] **Step 2:** Implement pane.
- [ ] **Step 3:** Commit.

---

### Task 11: Integration tests (API)

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-magnific-flows.acceptance.spec.ts`

**Cases:**
- End-to-end mock: draft flow job → confirm → submit → ingest with fake adapter returning mp4 bytes.
- GT-MF06: second submit same job does not duplicate run (idempotency).
- GET `/magnific/templates` returns seeded template in test DB fixture.

- [ ] **Step 1:** Write acceptance spec.
- [ ] **Step 2:** Green.
- [ ] **Step 3:** Commit.

---

### Task 12 (optional): Batch CSV rows

**Files:**
- Modify: `services/ptt-crm-api/src/cp/cp-batches.service.ts` — `enqueueMagnificFlowRows(batchId, templateId, rows)`
- Test: `services/ptt-crm-api/src/cp/cp-batches.service.spec.ts`

**Scope:** Max `MAGNIFIC_FLOW_BATCH_MAX` (default 20). Idempotency `{batch_id}:{row_index}`.

- [ ] **Step 1:** Test 3 rows → 3 draft jobs.
- [ ] **Step 2:** Implement if time; else defer post-pilot.
- [ ] **Step 3:** Commit or skip with TODO in runbook.

---

### Task 13: Playwright E2E

**Files:**
- Create: `services/ops-web/e2e/cp-ai-ops-magnific-flows.spec.ts`

**Scenario:**
- Mock flags: `magnificFlows: true`, `magnificRest: true`
- Mock `GET /magnific/templates` → 1 template `Social 9:16`
- Mock draft → confirm → submit → poll job → asset_id
- Assert `data-testid="cp-magnific-flow-template"` visible
- Assert no API key in network requests

- [ ] **Step 1:** Spec (may fail).
- [ ] **Step 2:** Fix pane testids.
- [ ] **Step 3:** `npx playwright test cp-ai-ops-magnific-flows`.
- [ ] **Step 4:** Commit.

---

### Task 14: Seed staging + runbook + deploy

**Files:**
- Create: `scripts/seed_cp_magnific_flow_templates_staging.sql`
- Create: `docs/runbooks/cp-magnific-flows.md`
- Create: `scripts/deploy_cp_magnific_flows_staging.sh`

**Seed template (replace `REPLACE_WITH_SQID`):**

```sql
-- crm_cp_templates row + crm_cp_provider_template_map
-- template_key: social_916_i2v
-- bindings_json: see SPEC §5.4
```

**Runbook sections:**
1. Publish Flow on Magnific staging
2. `GET /v1/ai/flows` verify sqid
3. Update seed SQL
4. Apply DDL + seed
5. Enable flags on VPS: `MAGNIFIC_REST_API_ENABLED=1`, `MAGNIFIC_FLOWS_ENABLED=1`
6. UAT 15 phút (SPEC §18)
7. Rollback: `MAGNIFIC_FLOWS_ENABLED=0`

**Deploy script:** pull → apply DDL → build api + ops-web → **không** bật flag unless env set.

- [ ] **Step 1:** Write runbook + seed template (placeholder sqid).
- [ ] **Step 2:** Deploy script smoke (build only).
- [ ] **Step 3:** Commit.

---

## UAT checklist (staging)

| # | Việc | Pass |
|---|---|---|
| 1 | Flag off → flow UI hidden / API 404 | ✅ |
| 2 | Template list shows `Social 9:16` | ✅ |
| 3 | Draft without confirm → submit 400 | GT-M04 |
| 4 | Confirm + submit → video in project media | asset + checksum |
| 5 | Provenance tool = `flow:{sqid}` | audit |
| 6 | Tool mode (no execution_kind) still works | no regress |
| 7 | Network tab: 0 API key | GT-M07 |

**Pilot prompts:** row 1 from [`social-916-flow-api-runs.json`](../../magnific/social-916-flow-api-runs.json).

---

## Commit message style

```
feat(cp): magnific flow cache ddl
feat(cp): MAGNIFIC_FLOWS_ENABLED flag
feat(cp): resolve flow bindings to magnific inputs
feat(cp): magnific flows REST adapter
feat(cp): flow template catalog service
feat(cp): jobs submit/ingest for magnific flows
feat(cp): GET /magnific/flows and templates
feat(ops-web): magnific pane flow template mode
test(cp): magnific flows acceptance
docs(cp): runbook magnific flows B+
```

---

**Cổng merge:** Task 1–11 green locally · sqid staging in seed · UAT §18 spec · `MAGNIFIC_FLOWS_ENABLED=0` on prod until sign-off.

**Kết thúc plan SPEC-CP-MAGNIFIC-FLOWS implementation v1.0.**

# PTT ImageOS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **SoT nghiệp vụ + UI + dữ liệu:** [SPEC-CP-IMAGE-SOP v2.2 §14](../specs/2026-09-13-cp-image-sop-srs.md). Mockup: [`docs/design/rnosai-cp-os-image-sop-mockup.html`](../../design/rnosai-cp-os-image-sop-mockup.html).
>
> **Ngoài scope:** `/api/v1`, app ImageOS tách, AUTO-route tốn tiền, Flux/Leonardo live khi chưa có connection, KPI hard-code, bật flag prod trước UAT.

**Goal:** Ship module Ảnh SOP trong Creative OS: 11 màn = mockup, Intent→Recipe 6 stage, dữ liệu SQL/API thật, flag mặc định tắt.

**Architecture:** Control plane `/crm/creative-os/image*` + `/api/crm/cp/image/*`. Bảng `img_*` + reuse `crm_cp_assets` / `crm_cp_render_jobs` / `crm_cp_credit_ledger` / Magnific adapters / Weave WO. Stage tốn provider gọi `CpJobsService` — không clone worker.

**Tech Stack:** Nest `ptt-crm-api` · ops-web · Postgres · Jest · Vitest · Playwright · `dash()` → `—`.

## Global Constraints

- Prefix `/api/crm/cp/image`. Tenant `PTT`. Không `/api/v1`, không portal tách.
- Flag `CP_IMAGE_SOP_ENABLED=0`. Off → 404 `{ error: 'image_sop_disabled' }` (GT-I01).
- UI tiếng Việt. Empty `—`. Class `cp-img-*`. Theme CP OS. 11 màn + modal đúng mockup.
- Cap `crm_img.view|edit|sop|render|render_high_cost|gate1|gate2|gate3|finance|manage|admin` — Admin gán explicit, không kế thừa tự động từ `crm_cp.*`.
- Confirm cost: `confirm !== true` → 400 `human_confirm_required`.
- Capability Magnific ∈ `MAGNIFIC_PILOT_CAPABILITIES`. `text_cta` không generate logo (GT-I09). Pack trước G3 (GT-I10). Select trước refine (GT-I11).
- Pilot tên `nova` / `mid-autumn-2026`. Không invent Lumi/Maison trên UI live.
- Browser cấm credential Magnific / Comfy `:8188`.

---

## Phase / Task index

| Phase | Task | Xong khi |
|---|---|---|
| I0 | 1–3 | DDL + flags/recipe/gates + RBAC |
| I1 | 4–6 | Repo + jobs explore/select + refine/upscale/pack |
| I2 | 7 | QC 7 chiều + G1–G3 |
| I3 | 8 | SOP registry/composer |
| I4 | 9 | Brand + intent router |
| I5 | 10–11 | Assets/finops/audit + controller |
| I6 | 12–18 | Nav + 11 màn + e2e + guide + VPS flag 0 |

---

### Task 1: DDL + apply + seed SOP

**Files:**
- Create: `docs/specs/2026-09-13-postgresql-ddl-cp-image-sop.sql`
- Create: `scripts/apply_pg_ddl_cp_image_sop.sh`
- Create: `scripts/seed_cp_image_sop_nova.sh`
- Test: apply script exits 0 on empty DB (manual/local)

**Interfaces:**
- Consumes: SPEC §4.1 + `img_job_stages` + frame columns `intent`, `creative_genome_json`, `winner_asset_id`, `format_pack_json`
- Produces: tables `img_sop_registry`, `img_sop_versions`, `img_projects`, `img_frames`, `img_jobs`, `img_job_stages`, `img_gate_logs`, `img_quality_results`, `img_brand_rules`

- [ ] **Step 1: Write SQL** — copy DDL spec §4.1; thêm index `(tenant_id, status)` trên `img_projects`, `(job_id, sort_order)` trên `img_job_stages`, unique `(tenant_id, code)` đã có.

Seed cuối file (idempotent):

```sql
INSERT INTO img_sop_registry (code, name, category, status, risk_tier, data_class)
VALUES
  ('PTT-IMG-KV-45', 'Brand KV 4:5', 'BRAND_KEY_VISUAL', 'DRAFT', 'MEDIUM', 'INTERNAL'),
  ('PTT-IMG-SOCIAL-916', 'Social 9:16 Still', 'SOCIAL', 'STAGING', 'MEDIUM', 'INTERNAL'),
  ('PTT-IMG-PACKSHOT-11', 'Packshot Comfy', 'PRODUCT_PACKSHOT', 'DRAFT', 'MEDIUM', 'INTERNAL'),
  ('PTT-IMG-FOOD-WEAVE', 'Food Weave WO', 'HUMAN_ART', 'DRAFT', 'LOW', 'INTERNAL'),
  ('PTT-IMG-MASTER-UPSCALE', 'Master Upscale', 'UPSCALE', 'DRAFT', 'LOW', 'INTERNAL')
ON CONFLICT (tenant_id, code) DO NOTHING;
```

Mỗi SOP một `img_sop_versions` `v0.1` `manifest_json.recipe_stages` theo SPEC §7.1. **Không** insert `agency_client`.

- [ ] **Step 2: Apply script** — copy pattern `scripts/apply_pg_ddl_cp_magnific_flows.sh`, file SQL ở bước 1.

- [ ] **Step 3: Seed Nova (optional bind)**

```bash
#!/usr/bin/env bash
set -euo pipefail
# Resolve agency_client id WHERE lower(name) LIKE '%nova%'
# If 0 rows: echo "SKIP no Nova client" and exit 0
# If 1+ rows: UPDATE nothing on SOP; only print client id for UAT bind
```

Cấm tạo client giả.

- [ ] **Step 4: Apply local**

Run: `bash scripts/apply_pg_ddl_cp_image_sop.sh`
Expected: `OK  CP Image SOP DDL applied`

- [ ] **Step 5: Commit** (khi user yêu cầu)

```bash
git add docs/specs/2026-09-13-postgresql-ddl-cp-image-sop.sql scripts/apply_pg_ddl_cp_image_sop.sh scripts/seed_cp_image_sop_nova.sh
git commit -m "$(cat <<'EOF'
feat(cp-image): add Image SOP DDL and seed scripts

EOF
)"
```

---

### Task 2: Flags, intents, recipe compile, gates

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-image-sop.flags.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop.flags.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop.types.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop-intents.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop-intents.util.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop-recipe.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop-recipe.util.spec.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop-gates.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop-gates.util.spec.ts`

**Interfaces:**
- Consumes: `MAGNIFIC_PILOT_CAPABILITIES`, `readAiOpsFlags`
- Produces:

```ts
export type ImgIntent =
  | 'hero_lifestyle'
  | 'product_lock'
  | 'text_cta'
  | 'upscale_print'
  | 'bg_cutout'
  | 'format_pack'
  | 'human_art'
  | 'i2v_handoff';

export type ImgStage = 'explore' | 'select' | 'refine' | 'upscale' | 'pack' | 'qc';

export type ImgRecipeStage = {
  stage: ImgStage;
  capability: string;
  provider: 'magnific_rest' | 'magnific_mcp' | 'comfyui' | 'weavy' | 'local';
  required: boolean;
};

export function readImageSopFlags(env?: NodeJS.ProcessEnv): {
  enabled: boolean;
  router: 'manual' | 'recommended';
};

export function compileRecipe(input: {
  intent: ImgIntent;
  flags: ReturnType<typeof readAiOpsFlags>;
  hasMagnificConnection: boolean;
}): { stages: ImgRecipeStage[]; blocked_reason: string | null };

export function assertSelectBeforeRefine(winnerAssetId: string | null): void;
export function assertPackBeforeG3(formatPack: Record<string, unknown> | null): void;
export function assertOfficialLockup(input: {
  intent: ImgIntent;
  overlayLockup: boolean;
  waiver: boolean;
}): void;
```

- [ ] **Step 1: Write failing tests**

```ts
it('defaults CP_IMAGE_SOP_ENABLED off', () => {
  expect(readImageSopFlags({}).enabled).toBe(false);
});

it('enables on 1 or true', () => {
  expect(readImageSopFlags({ CP_IMAGE_SOP_ENABLED: '1' }).enabled).toBe(true);
});

it('blocks explore when magnific disconnected', () => {
  const out = compileRecipe({
    intent: 'hero_lifestyle',
    flags: readAiOpsFlags({ MAGNIFIC_REST_API_ENABLED: '1' }),
    hasMagnificConnection: false,
  });
  expect(out.blocked_reason).toBe('magnific_disconnected');
});

it('uses local sharp for format_pack when magnific down', () => {
  const pack = compileRecipe({
    intent: 'format_pack',
    flags: readAiOpsFlags({}),
    hasMagnificConnection: false,
  }).stages.find((s) => s.stage === 'pack');
  expect(pack?.provider).toBe('local');
});

it('GT-I11 throws without winner', () => {
  expect(() => assertSelectBeforeRefine(null)).toThrow();
});

it('GT-I09 blocks text_cta without overlay', () => {
  expect(() =>
    assertOfficialLockup({ intent: 'text_cta', overlayLockup: false, waiver: false }),
  ).toThrow();
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd services/ptt-crm-api && pnpm exec jest src/cp/cp-image-sop.flags.spec.ts src/cp/cp-image-sop-recipe.util.spec.ts src/cp/cp-image-sop-gates.util.spec.ts --runInBand`
Expected: FAIL module not found

- [ ] **Step 3: Implement minimal** — `isEnabled` copy `cp-ai-ops.flags.ts`. `compileRecipe` map SPEC §0.6. Gates throw `HttpException` 409/422 với `{ error, gate }`.

- [ ] **Step 4: Run tests — PASS**

- [ ] **Step 5: Commit** `feat(cp-image): add Image SOP flags, recipe compile, and gates`

---

### Task 3: RBAC crm_img + StaffImgGuard

**Files:**
- Create: `services/ptt-crm-api/src/cp/guards/staff-img.guard.ts`
- Create: `services/ptt-crm-api/src/cp/guards/staff-img.guard.spec.ts`
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json` — thêm `crm_img` và sub-keys giống block `crm_cp`
- Modify: `services/ops-web/src/lib/rbac-routes.ts` — rule **trước** prefix `/crm/creative-os`:

```ts
{
  prefix: '/crm/creative-os/image',
  anyOf: [{ section: 'crm_img', action: 'view' }],
},
```

- Modify: `services/ops-web/src/lib/auth.spec.ts` — case image path

**Interfaces:**
- Consumes: `StaffAuthService.hasCap` pattern `staff-cp.guard.ts`
- Produces: `RequireImgSection(section, action)` · `StaffImgGuard`

Cap map (catalog `section_actions`):

```
crm_img: view, edit
crm_img.sop: edit
crm_img.render: execute
crm_img.render_high_cost: execute
crm_img.gate1 / gate2 / gate3: execute
crm_img.finance: view
crm_img.manage: manage
crm_img.admin: manage
```

- [ ] **Step 1: Test guard**

```ts
it('rejects missing crm_img.view', async () => {
  // mock staffAuth.me caps = [{ section: 'crm_cp', action: 'view' }]
  await expect(guard.canActivate(ctx)).rejects.toMatchObject({
    response: { error: 'missing_cap', section: 'crm_img' },
  });
});
```

- [ ] **Step 2: Test rbac path**

```ts
it('Creative OS image requires crm_img.view — crm_cp.view alone is 403', () => {
  expect(canAccessPath('/crm/creative-os/image', cpView, 'crm')).toBe(false);
  expect(canAccessPath('/crm/creative-os/image', imgView, 'crm')).toBe(true);
});
```

Lưu ý: `/crm/creative-os` vẫn `crm_cp.view` (shell). Image hub cần **cả** vào được CP OS lẫn `crm_img.view`. Staff UAT phải có hai cap.

- [ ] **Step 3: Implement + run Jest/Vitest — PASS**

- [ ] **Step 4: Commit** `feat(cp-image): add crm_img RBAC and StaffImgGuard`

---

### Task 4: Repository

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-image-sop.repository.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop.repository.spec.ts`

**Interfaces:**
- Consumes: `pg` pool token dùng CP (`CP_JOBS_QUERY` pattern)
- Produces:

```ts
listSops(tenantId: string): Promise<ImgSopRow[]>
getSop(id: string): Promise<ImgSopRow | null>
insertProject(row: ImgProjectInsert): Promise<ImgProjectRow>
listProjectsForBoard(scope: { staffId: number; scope: 'me'|'team'|'all' }): Promise<ImgProjectRow[]>
insertJob(row: ImgJobInsert): Promise<ImgJobRow>
listJobs(): Promise<ImgJobRow[]>
insertStage(row: ImgStageInsert): Promise<ImgJobStageRow>
updateJobWinner(jobId: string, assetId: string): Promise<void>
updateFormatPack(frameId: string, pack: Record<string, unknown>): Promise<void>
insertQuality(row: ImgQualityInsert): Promise<void>
insertGateLog(row: ImgGateInsert): Promise<void>
countApprovedAssets(from: Date, to: Date): Promise<number | null>
sumLedgerImageSop(): Promise<number | null>
```

Mọi count/sum **trả `null` khi 0 row và chưa có dữ liệu đo** — service map `null` → UI `—`. Không trả `0` giả cho KPI “chưa ship” nếu query fail; query OK + 0 approved = `0` (số thật).

- [ ] **Step 1: Tests với query mock** (pattern `cp-jobs.repository.spec.ts`) — insert/list/count.

- [ ] **Step 2: Implement parameterized SQL only. Không string-interp user input.**

- [ ] **Step 3: Jest PASS · Commit** `feat(cp-image): add Image SOP repository`

---

### Task 5: Service jobs — draft, confirm, explore, select

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-image-sop.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop.service.spec.ts`

**Interfaces:**
- Consumes: repository, `compileRecipe`, `CpJobsService`, `CpLedgerService`, `readImageSopFlags`
- Produces:

```ts
assertEnabled(env?: NodeJS.ProcessEnv): void // 404 image_sop_disabled
draftJob(input: {
  agency_client_id: number;
  service_lifecycle_id?: string | null;
  sop_version_id: string;
  intent: ImgIntent;
  variants: number; // 1–4, cap CP_IMAGE_SOP_VARIANT_MAX
  creative_direction: string;
  idempotency_key: string;
}, staffId: number): Promise<{ job_id: string; recipe: ImgRecipeStage[]; estimate_credits: number | null; blocked_reason: string | null }>

submitJob(jobId: string, confirm: boolean, staffId: number): Promise<void>
explore(jobId: string, staffId: number): Promise<{ stage_id: string; cp_job_id: string | null }>
selectWinner(jobId: string, winner_asset_id: string, staffId: number): Promise<void>
```

- [ ] **Step 1: Tests**

```ts
it('draft without flag throws image_sop_disabled', async () => { ... });
it('submit without confirm throws 400 human_confirm_required', async () => { ... });
it('explore when magnific disconnected records stage POLICY_BLOCKED and does not call CpJobsService', async () => { ... });
it('selectWinner writes winner_asset_id', async () => { ... });
it('refine before select throws gate GT-I11', async () => { ... });
```

`variants > 4` → 400. `agency_client_id` bắt buộc.

Explore khi connection OK: `CpJobsService.draft` + `confirm` + `submit` với `capability: 'images_generate'`, `provider: 'magnific_rest'`, `inputs.estimated_credits`, ledger `source=image_sop:explore`.

- [ ] **Step 2: Implement · Jest PASS · Commit** `feat(cp-image): draft, explore, and select Image jobs`

---

### Task 6: Refine, upscale, pack

**Files:**
- Modify: `services/ptt-crm-api/src/cp/cp-image-sop.service.ts`
- Modify: `services/ptt-crm-api/src/cp/cp-image-sop.service.spec.ts`

**Interfaces:**

```ts
refine(jobId: string, mode: 'weave' | 'overlay' | 'comfy', staffId: number): Promise<void>
upscale(jobId: string, staffId: number): Promise<void>
pack(jobId: string, ratios: Array<'1:1'|'4:5'|'9:16'|'16:9'>, staffId: number): Promise<{ format_pack_json: Record<string, string | null> }>
```

- [ ] **Step 1: Tests**

```ts
it('upscale without winner throws GT-I11', async () => { ... });
it('text_cta refine overlay=false throws GT-I09', async () => { ... });
it('pack writes format_pack_json keys for requested ratios', async () => { ... });
it('upscale uses capability images_upscale', async () => { ... });
```

Pack: nếu Magnific `images_crop`/`images_resize` blocked → `provider=local` (sharp) trên bytes `crm_cp_assets`. Local **không** bịa URL Magnific.

Weave refine: tạo `crm_cp_weave_work_orders` nếu `PTT_WEAVE=1`; else 409 `weave_disabled`.

- [ ] **Step 2: Implement · PASS · Commit** `feat(cp-image): refine, upscale, and format pack stages`

---

### Task 7: Quality 7 chiều + gates G1–G3

**Files:**
- Modify: `services/ptt-crm-api/src/cp/cp-image-sop.service.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop-quality.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image-sop-quality.util.spec.ts`

**Interfaces:**

```ts
export type ImgQcDimension =
  | 'technical' | 'product_fidelity' | 'brand_fit'
  | 'creative_fit' | 'text_cta_vn' | 'compliance' | 'delivery';

evaluateQuality(input: {
  profile: 'brand_kv_v1' | 'product_fidelity_v2' | 'social_cta_vn_v1';
  checks: Partial<Record<ImgQcDimension, number | null>>;
}): { scores_json: Record<string, number | null>; decision: 'PASS'|'WARN'|'FAIL'|'ESCALATE' }

passGate(projectId: string, gateNum: 1|2|3, actorStaffId: number, checklist: Record<string, unknown>): Promise<void>
```

Quyết định: bất kỳ chiều `FAIL` bắt buộc → `FAIL`. Thiếu điểm = `null` trong JSON (UI `—`), không bịa 96.

G1 block explore nếu `g1_at` null (GT-I02). G3 block nếu pack thiếu tỉ lệ hợp đồng (GT-I10). Hub submit tái sử dụng `CpApprovalsService` / creatives — Image service chỉ `assertPackBeforeG3`.

- [ ] **Step 1–4: TDD · Commit** `feat(cp-image): quality profile and G1-G3 gates`

---

### Task 8: SOP registry + composer API

**Files:**
- Modify: `cp-image-sop.service.ts` + spec
- Modify: repository list/insert versions

**Interfaces:**

```ts
listSops(): Promise<Array<{ code: string; name: string; status: string; version: string | null; intent: string | null }>>
createSop(input: { code: string; name: string; category: string; data_class: string; outcome: string }, staffId: number): Promise<{ id: string }>
saveVersion(sopId: string, input: {
  version: string;
  manifest_json: Record<string, unknown>;
  creative_genome: Record<string, unknown>;
  prompt_package_id?: string | null;
}, staffId: number): Promise<{ version_id: string }>
```

`code` unique. Publish production cần `crm_img.admin` — v1 chỉ DRAFT/STAGING.

- [ ] **Step 1–4: TDD · Commit** `feat(cp-image): SOP registry and composer APIs`

---

### Task 9: Intents + brand graph + router preview

**Files:**
- Modify: `cp-image-sop.service.ts` + spec

**Interfaces:**

```ts
listIntents(): Promise<Array<{
  intent: ImgIntent;
  capability: string;
  health: 'ok' | 'blocked' | 'fallback' | 'hidden';
  decision: string;
}>>

previewRouter(input: { intent: ImgIntent; data_class: string }): Promise<{
  stages: ImgRecipeStage[];
  blocked_reason: string | null;
}>

getBrandGraph(kitId: string): Promise<{
  kit: { id: string; name: string } | null;
  rules: Array<{ rule_key: string; enforcement: string }>;
}>
```

`listIntents`: Flux/Leonardo `health='hidden'` — **không** đưa vào JSON items (D-08). Brand kit 404 → `{ kit: null, rules: [] }` UI `—`.

- [ ] **Step 1: Test hidden Flux, magnific_disconnected, text_cta overlay**
- [ ] **Step 2–4: Implement · PASS · Commit** `feat(cp-image): intents, brand graph, and router preview`

---

### Task 10: Dashboard, assets, finops, audit

**Files:**
- Modify: `cp-image-sop.service.ts` + spec

**Interfaces:**

```ts
dashboardKpis(): Promise<{
  approved_month: number | null;
  brief_to_approved_hours: number | null;
  cost_per_approved: number | null;
  first_pass_rate: number | null;
}>

listImageAssets(): Promise<Array<{ id: string; filename: string; status: string }>>
assetProvenance(assetId: string): Promise<{ events: Array<{ label: string; detail: string }> }>
finopsSummary(): Promise<{ charged: number | null; reserved: number | null; by_provider: Array<{ provider: string; credits: number | null }> }>
governanceAudit(): Promise<{ items: Array<{ at: string; title: string; detail: string }> }>
```

KPI SQL:
- approved = `COUNT crm_cp_assets` provenance image_sop + approved trong tháng
- cycle = `AVG(EXTRACT(EPOCH FROM (g3_at-created_at))/3600)` `img_projects` where g3_at not null
- cost = charged / approved (cả hai null → null)
- first_pass = approved / explored stages completed

Không row → `null`.

- [ ] **Step 1–4: TDD · Commit** `feat(cp-image): dashboard, assets, finops, and audit queries`

---

### Task 11: Controller + module

**Files:**
- Create: `services/ptt-crm-api/src/cp/cp-image.controller.ts`
- Create: `services/ptt-crm-api/src/cp/cp-image.controller.spec.ts`
- Modify: `services/ptt-crm-api/src/cp/cp.module.ts`

**Interfaces:**
- `@Controller('api/crm/cp/image')`
- `@UseGuards(StaffImgGuard)`
- Interceptor/guard đầu: nếu `!readImageSopFlags().enabled` → 404 (trừ `GET /flags` trả `{ enabled: false }`)

Map đúng SPEC §6 + §14.5. Body validate class-transformer tối thiểu: uuid, intent enum, variants 1–4.

- [ ] **Step 1: Controller spec** — flag off 404; draft 201; submit no confirm 400.

- [ ] **Step 2: Register providers trong `cp.module.ts`**

- [ ] **Step 3: Jest PASS · Commit** `feat(cp-image): mount /api/crm/cp/image routes`

---

### Task 12: Nav, flags client, API client, Next routes

**Files:**
- Create: `services/ops-web/src/lib/crm/cp-image-sop.flags.ts` + spec
- Create: `services/ops-web/src/lib/crm/cp-image-sop-nav.util.ts` + spec
- Create: `services/ops-web/src/lib/crm/cp-image-sop-api.ts`
- Modify: `services/ops-web/src/lib/crm/cp-nav.util.ts` + existing spec
- Modify: `services/ops-web/src/lib/crm/cp-project-tabs.util.ts` + spec
- Create: `services/ops-web/src/app/crm/creative-os/image/page.tsx` (và subfolders Task 13–17)
- Modify: `services/ops-web/src/components/crm/cp/CpShell.tsx` — filter nav

**Interfaces:**

```ts
export const CP_IMAGE_NAV = [
  { id: 'home', href: '/crm/creative-os/image', label: 'Tổng quan', screen: 'IMG-01' },
  { id: 'tasks', href: '/crm/creative-os/image/operations', label: 'Vận hành sáng tạo', screen: 'IMG-02' },
  { id: 'jobs', href: '/crm/creative-os/image/jobs', label: 'Image Jobs', screen: 'IMG-03' },
  { id: 'assets', href: '/crm/creative-os/image/assets', label: 'Asset Intelligence', screen: 'IMG-04' },
  { id: 'review', href: '/crm/creative-os/image/review', label: 'Review & Approval', screen: 'IMG-05' },
  { id: 'sops', href: '/crm/creative-os/image/sops', label: 'SOP Registry', screen: 'IMG-06' },
  { id: 'composer', href: '/crm/creative-os/image/sops/new', label: 'SOP Composer', screen: 'IMG-07' },
  { id: 'brand', href: '/crm/creative-os/image/brand', label: 'Brand Graph', screen: 'IMG-08' },
  { id: 'providers', href: '/crm/creative-os/image/providers', label: 'Provider Router', screen: 'IMG-09' },
  { id: 'finops', href: '/crm/creative-os/image/finops', label: 'AI FinOps', screen: 'IMG-10' },
  { id: 'governance', href: '/crm/creative-os/image/governance', label: 'Governance', screen: 'IMG-11' },
] as const;

export function visibleCpNav(input: {
  items: CpNavItem[];
  imageEnabled: boolean;
  canImgView: boolean;
}): CpNavItem[]
```

`CP_NAV` thêm `{ id: 'image', href: '/crm/creative-os/image', label: 'Ảnh SOP' }` **ngay sau** `video`.

`CpShell`: `visibleCpNav({ items: CP_NAV, imageEnabled, canImgView })`. `imageEnabled` từ `GET /api/crm/cp/image/flags`. Flag 0 hoặc thiếu cap → không render link.

`CP_PROJECT_TABS` thêm `{ id: 'image-sop', label: 'Ảnh SOP' }` sau `ai-ops`. Tab ẩn cùng điều kiện flag.

- [ ] **Step 1: Vitest nav**

```ts
it('hides Ảnh SOP when flag off', () => {
  expect(visibleCpNav({ items: CP_NAV, imageEnabled: false, canImgView: true }).some((i) => i.id === 'image')).toBe(false);
});
it('places Ảnh SOP after Video AI', () => {
  const ids = visibleCpNav({ items: CP_NAV, imageEnabled: true, canImgView: true }).map((i) => i.id);
  expect(ids.indexOf('image')).toBe(ids.indexOf('video') + 1);
});
```

- [ ] **Step 2: Implement · PASS · Commit** `feat(cp-image): add Ảnh SOP nav and API client`

---

### Task 13: IMG-01 shell + home (mockup)

**Files:**
- Create: `services/ops-web/src/components/crm/cp/CpImageShell.tsx`
- Create: `services/ops-web/src/components/crm/cp/CpImageHome.tsx`
- Create: `services/ops-web/src/app/crm/creative-os/image/page.tsx`
- Modify: `services/ops-web/src/app/crm/creative-os/cp.css` — block `cp-img-*` (pipe, win, intents, pack, genome, qc) bám mockup

**UI contract:** khớp mockup home: crumb, h1, win banner, 6-stage pipe, 4 tile KPI (`dash`), bảng supply chain, provider health từ API, feed audit. Mọi số `dash(kpi.approved_month)`.

Provider rows: Weavy / Magnific / Comfy — text health **copy từ API**, không hard-code “Healthy”.

- [ ] **Step 1:** Component nhận props typed; không fetch trong test — util format đã cover.
- [ ] **Step 2:** Page gọi `cpImageDashboard(token)` + flags.
- [ ] **Step 3:** Browser verify (dev) hoặc e2e Task 18: 4 tile hiện `—` khi API null.
- [ ] **Step 4: Commit** `feat(cp-image): render ImageOS home to mockup`

---

### Task 14: IMG-02 operations + IMG-03 jobs + modal

**Files:**
- Create: `CpImageOperations.tsx` · `CpImageJobs.tsx` · `CpImageJobModal.tsx`
- Create: `app/crm/creative-os/image/operations/page.tsx`
- Create: `app/crm/creative-os/image/jobs/page.tsx`

**UI:** Kanban 4 cột mockup. Job table cột Job / Intent / Stage / Capability / Credit / Status. Modal: client Nova option **chỉ nếu API trả client**; không hard-code Lumi. Pipe 6 stage từ `recipes/preview`. CTA “Tạo draft + recipe” → `POST /jobs/draft`.

Empty jobs: một hàng `— · Empty state`.

- [ ] **Step 1–4: Implement · Commit** `feat(cp-image): operations board, jobs, and draft modal`

---

### Task 15: IMG-04 assets + IMG-05 review

**Files:**
- Create: `CpImageAssets.tsx` · `CpImageReview.tsx`
- Create: `image/assets/page.tsx` · `image/review/page.tsx` · `image/review/[assetId]/page.tsx`

**UI:** Asset grid + provenance timeline + format pack 4 tỉ lệ. Review: watermark, annotation placeholders, QC 7 chiều, thread, GT-I09 policy box. Score `dash(scores.technical)`.

Review không `assetId`: empty “Chọn asset từ thư viện” + link IMG-04 — không fake bottle KPI.

- [ ] **Step 1–4: Commit** `feat(cp-image): asset intelligence and review studio`

---

### Task 16: IMG-06 SOP registry + IMG-07 composer

**Files:**
- Create: `CpImageSops.tsx` · `CpImageComposer.tsx`
- Create: `image/sops/page.tsx` · `image/sops/new/page.tsx`

**UI:** 3–5 card từ API seed (PTT-IMG-*). Composer stepper 6 bước, 7-layer prompt, Creative Genome, recipe graph. Save → `POST /sops` + version.

- [ ] **Step 1–4: Commit** `feat(cp-image): SOP registry and composer UI`

---

### Task 17: IMG-08…11 brand, providers, finops, governance

**Files:**
- Create: `CpImageBrand.tsx` · `CpImageProviders.tsx` · `CpImageFinops.tsx` · `CpImageGovernance.tsx`
- Create: pages `image/brand/page.tsx`, `image/brand/[kitId]/page.tsx`, `image/providers/page.tsx`, `image/finops/page.tsx`, `image/governance/page.tsx`

**UI:** Intent chips gọi `/intents`. Bảng capability thật. FinOps tiles `dash`. Governance policy table gồm GT-I09/I10/I11. Brand lockup row GT-I09.

`/image/brand` không kitId: list kits từ `GET /api/crm/cp` brand kits hiện có; empty `—`.

- [ ] **Step 1–4: Commit** `feat(cp-image): brand, router, finops, and governance screens`

---

### Task 18: E2E, user guide, VPS flag 0

**Files:**
- Create: `services/ops-web/e2e/cp-image-sop.spec.ts`
- Create: `docs/huong-dan-su-dung/40-image-sop-studio.md`
- Modify: `docs/huong-dan-su-dung/README.md` (đã có #40 — trỏ guide khi file tồn tại)

**E2E (không cần Magnific key):**

```ts
test('flag off hides Ảnh SOP', async ({ page }) => {
  // mock GET /api/crm/cp/image/flags { enabled: false }
  await page.goto('/crm/creative-os');
  await expect(page.getByRole('link', { name: 'Ảnh SOP' })).toHaveCount(0);
});

test('flag on + cap shows 11 subnav and dash tiles', async ({ page }) => {
  // mock flags enabled + kpis all null
  await page.goto('/crm/creative-os/image');
  await expect(page.getByRole('heading', { name: /Enterprise Image Intelligence/ })).toBeVisible();
  await expect(page.getByText('—').first()).toBeVisible();
});
```

User guide: 11 màn, pipeline, GT-I09…I11, cách bật flag, lưu REST key, gán cap `crm_img.*`, UAT 15 phút copy SPEC §11.

VPS: thêm `CP_IMAGE_SOP_ENABLED=0` vào env sample / runbook — **không** bật prod.

- [ ] **Step 1: Playwright**
- [ ] **Step 2: Guide**
- [ ] **Step 3: Commit** `docs(cp-image): add Image SOP UAT e2e and user guide`

---

## Self-review (plan vs SPEC)

| SPEC | Task |
|---|---|
| 11 màn + modal + pipeline/intent/QC | 13–17 |
| D-01…D-10 empty / SoT | 10, 13–17, 18 |
| DDL img_* + stages | 1 |
| Intent taxonomy + recipe | 2, 9 |
| GT-I01…I11 | 2, 5–7, 11 |
| API §6 / §14.5 | 11 |
| RBAC crm_img | 3, 12 |
| Magnific allowlist / no fake Flux | 2, 6, 9 |
| Nova / mid-autumn-2026 | 1, 14 |
| Flag 0 prod | 18, SPEC §14.8 |
| Guide #40 | 18 |

Không TBD. Không task “làm tương tự Task N” — mỗi task có file và interface riêng.

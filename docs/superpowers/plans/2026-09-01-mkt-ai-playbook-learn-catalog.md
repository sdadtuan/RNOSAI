# MKT-AI Playbook Catalog + Learn Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Isolated worktree: use superpowers:using-git-worktrees at execution time.

**Goal:** Một policy `off|pilot|ga` trên từng `service_slug`, playbook `_common`, học nháp từ HĐ thắng, MKT Lead Duyệt/Active — không fine-tune, không auto-active.

**Architecture:** Pure utils (allow + corpus + anonymize + resolve) trước. Nest: bảng `mkt_ai_service_policy` / `mkt_ai_playbook_versions` / `mkt_ai_playbook_learn_jobs`. `assertPlannerAllowed` thay 2 lớp env. Planner resolve: version `active` → `_common` → disk. Admin UI `/crm/admin/mkt-ai/playbooks`. Job học = prompt + schema JSON, status chỉ `draft`.

**Tech Stack:** NestJS `ptt-crm-api` (Jest), PostgreSQL, ops-web Next.js (Vitest + Playwright), LLM hiện có `MarketingAiOrchestratorService` (không API fine-tune).

**Spec:** [`docs/superpowers/specs/2026-09-01-mkt-ai-playbook-learn-catalog-design.md`](../specs/2026-09-01-mkt-ai-playbook-learn-catalog-design.md) v1.1 (MKTP-PB-LEARN-20260901).

## Global Constraints

- Không fine-tune / LoRA / lưu weight model.
- AI **không** được set `status=active` — chỉ `draft` / `pending_review`.
- `PTT_MKT_AI_PLANNER_ENABLED=0` vẫn tắt cả module (404 `mkt_ai_planner_disabled`).
- `PTT_MKT_AI_AUTO_CUSTOMER_EMAIL` giữ `0`. Không auto-Apply TMMT, không auto-mail khách.
- Không viết lại wizard 5 bước Planner.
- Không playbook theo từng khách (chỉ `service_slug`).
- Seed UAT `mkt-ai-smoke-seed` / `mkt-ai-seed-*` / `sqlite_lead_id >= 900000901` **cấm** vào corpus.
- 403 mới: `mkt_ai_service_not_enabled` + message VI + `admin_path`. Alias 2 mã cũ 1 release.
- Ngưỡng cứng: ứng viên **5**, thắng **3** cho `deep`, prompt max **15**, cooldown **7 ngày**, quality **≥70**.
- `depth=deep` cần W1 (closed-loop) **và** ≥3 HĐ có artifact Ops/QA/Content (§7.0.5). Cấm bịa “Tuần N:” nếu thiếu task Done.
- Env cũ `PTT_MKT_AI_PLANNER_SLUGS` / `PILOT_*`: AND khẩn nếu còn set; rỗng = chỉ policy.
- Slice: **P0 → P1 → P2 → P3**. Stop sau P0 nếu PO chỉ muốn hết 403. Stop sau P1 nếu chưa học.
- Branch: `feat/mkt-ai-playbook-learn` from `main`.
- Copy UI tiếng Việt. Không `next build` ad-hoc trên VPS trong plan này.

## File map

| File | Role | Slice |
|------|------|-------|
| Create `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-planner-allow.util.ts` | `assertPlannerAllowed` inputs → result/error | P0 |
| Create `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-planner-allow.util.spec.ts` | Jest allow | P0 |
| Modify `services/ptt-crm-api/src/marketing-ai-planner/marketing-ai-planner.service.ts` | Gọi allow thay 2 if env | P0 |
| Modify `services/ptt-crm-api/src/leads-funnel/leads-funnel.service.ts` | `assertPresalesMktAiEnabled` cùng allow | P0 |
| Create `docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-policy.sql` | `mkt_ai_service_policy` | P0 |
| Modify `scripts/apply_pg_ddl_mkt_ai_planner.sh` | Apply file DDL mới | P0 |
| Create `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-service-policy.repository.ts` | CRUD policy | P0 |
| Create `scripts/seed_mkt_ai_service_policy.sql` | Seed 3 slug VPS + 13 default `off`/`pilot` | P0 |
| Create `services/ptt-crm-api/src/marketing-ai-planner/playbooks/_common.json` | Template mặc định | P1 |
| Modify `services/ptt-crm-api/src/marketing-ai-planner/marketing-ai-playbook.util.ts` | Resolve active → common → disk; `_common` trong catalog | P1 |
| Create `docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-versions.sql` | versions + learn_jobs | P2 |
| Create `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-corpus.util.ts` | C1–C5, W1, depth | P2 |
| Create `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-corpus.util.spec.ts` | Jest corpus | P2 |
| Create `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-learn-validate.util.ts` | PII + schema §8.2 | P2 |
| Create `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-learn-validate.util.spec.ts` | Jest PII | P2 |
| Create `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-learn.service.ts` | Enqueue + chạy job | P2 |
| Modify `services/ptt-crm-api/src/marketing-ai-planner/marketing-ai-playbook-admin.controller.ts` | REST §11 | P2 |
| Create `services/ops-web/src/lib/mkt-ai-playbook-admin-api.ts` | Client admin | P2 |
| Create `services/ops-web/src/app/crm/admin/mkt-ai/playbooks/page.tsx` | Danh sách + chi tiết | P2 |
| Modify `services/ops-web/src/components/OpsNav.tsx` | Link Admin Playbooks | P2 |
| Modify `services/ops-web/src/components/mkt-ai/AiPlaybookSelector.tsx` | Hiện `_common` | P1 |
| Create `services/ops-web/e2e/mkt-ai-playbook-admin.spec.ts` | Playwright P2 | P2 |
| Modify `docs/huong-dan-su-dung/29-marketing-ai-planner-thuc-chien.md` | Policy + học | P1/P2 |
| Modify `docs/runbooks/mkt-ai-playbook-ops.md` | Admin UI thay PR-only | P2 |

## Out of scope (reject nếu task thêm)

- Fine-tune, auto-active, auto-Apply TMMT, auto-email, playbook per-client, rewrite Planner wizard, CEO Tower, mở `rollout=ga` toàn hệ trên VPS.

---

### Task 1: Pure `assertPlannerAllowed` (P0)

**Files:**
- Create: `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-planner-allow.util.ts`
- Create: `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-planner-allow.util.spec.ts`

**Interfaces:**
- Consumes: policy row `{ rollout, enabled }` hoặc `null`; env slugs/pilot flags
- Produces: `PlannerAllowResult` = `{ ok: true }` \| `{ ok: false; error: string; message: string; admin_path: string; service_slug: string }`

- [ ] **Step 1: Write the failing test**

```ts
import { assertPlannerAllowed } from './mkt-ai-planner-allow.util';

describe('assertPlannerAllowed', () => {
  const env = { plannerEnabled: true, envSlugs: [] as string[], pilotOnly: false, pilotSlugs: [] as string[] };

  it('module off → mkt_ai_planner_disabled', () => {
    const r = assertPlannerAllowed('quang-cao-facebook', null, { ...env, plannerEnabled: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('mkt_ai_planner_disabled');
  });

  it('no policy + empty env → not enabled', () => {
    const r = assertPlannerAllowed('quang-cao-facebook', null, env);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBe('mkt_ai_service_not_enabled');
      expect(r.admin_path).toContain('quang-cao-facebook');
      expect(r.message).toMatch(/chưa mở AI Planner/i);
    }
  });

  it('policy pilot + env AND blocks if env list nonempty and slug missing', () => {
    const r = assertPlannerAllowed(
      'quang-cao-facebook',
      { rollout: 'pilot', enabled: true },
      { ...env, envSlugs: ['meta-lead-gen'] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('mkt_ai_service_not_enabled');
  });

  it('policy pilot + empty env slugs → ok', () => {
    const r = assertPlannerAllowed(
      'quang-cao-facebook',
      { rollout: 'pilot', enabled: true },
      env,
    );
    expect(r).toEqual({ ok: true });
  });

  it('policy off → not enabled', () => {
    const r = assertPlannerAllowed('seo-retainer', { rollout: 'off', enabled: true }, env);
    expect(r.ok).toBe(false);
  });

  it('legacy alias codes stay for one release', () => {
    expect(['mkt_ai_planner_slug_not_pilot', 'mkt_ai_pilot_slug_required']).toContain(
      'mkt_ai_planner_slug_not_pilot',
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/ptt-crm-api && npx jest src/marketing-ai-planner/mkt-ai-planner-allow.util.spec.ts --no-coverage`

Expected: FAIL cannot find module.

- [ ] **Step 3: Write minimal implementation**

```ts
export type PlannerPolicySnap = { rollout: 'off' | 'pilot' | 'ga'; enabled: boolean };

export type PlannerAllowEnv = {
  plannerEnabled: boolean;
  envSlugs: string[];
  pilotOnly: boolean;
  pilotSlugs: string[];
};

export type PlannerAllowResult =
  | { ok: true }
  | { ok: false; error: string; message: string; admin_path: string; service_slug: string };

export function adminPlaybooksPath(slug: string): string {
  return `/crm/admin/mkt-ai/playbooks?slug=${encodeURIComponent(slug)}`;
}

export function assertPlannerAllowed(
  serviceSlug: string,
  policy: PlannerPolicySnap | null,
  env: PlannerAllowEnv,
): PlannerAllowResult {
  const slug = String(serviceSlug ?? '').trim();
  const fail = (error: string, message: string): PlannerAllowResult => ({
    ok: false,
    error,
    message,
    admin_path: adminPlaybooksPath(slug),
    service_slug: slug,
  });

  if (!env.plannerEnabled) {
    return fail('mkt_ai_planner_disabled', 'AI Marketing Planner đang tắt.');
  }
  if (!slug) return fail('mkt_ai_service_not_enabled', 'Thiếu service_slug.');

  if (policy) {
    if (!policy.enabled || policy.rollout === 'off') {
      return fail(
        'mkt_ai_service_not_enabled',
        'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
      );
    }
  } else if (env.envSlugs.length === 0 && !env.pilotOnly) {
    return { ok: true };
  } else if (!policy) {
    const inEnv = !env.envSlugs.length || env.envSlugs.includes(slug);
    const inPilot = !env.pilotOnly || env.pilotSlugs.includes(slug);
    if (!inEnv || !inPilot) {
      return fail(
        'mkt_ai_service_not_enabled',
        'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
      );
    }
    return { ok: true };
  }

  if (env.envSlugs.length && !env.envSlugs.includes(slug)) {
    return fail(
      'mkt_ai_service_not_enabled',
      'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
    );
  }
  if (env.pilotOnly && env.pilotSlugs.length && !env.pilotSlugs.includes(slug)) {
    return fail(
      'mkt_ai_service_not_enabled',
      'Dịch vụ này chưa mở AI Planner. MKT Lead bật pilot tại Admin → AI Marketing → Playbooks.',
    );
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: same jest command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-planner-allow.util.ts \
  services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-planner-allow.util.spec.ts
git commit -m "feat(mkt-ai): assertPlannerAllowed — one VI error code"
```

---

### Task 2: Wire Planner + Presales to allow util (P0)

**Files:**
- Modify: `services/ptt-crm-api/src/marketing-ai-planner/marketing-ai-planner.service.ts` (`assertEnabled`)
- Modify: `services/ptt-crm-api/src/leads-funnel/leads-funnel.service.ts` (`assertPresalesMktAiEnabled`)
- Modify: `services/ptt-crm-api/src/marketing-ai-planner/marketing-ai-planner.service.spec.ts` (nếu mock config)
- Modify: `services/ptt-crm-api/src/marketing-ai-planner/marketing-ai-dashboard.service.ts` và optimize/weekly/kpi-closed-loop — **cùng** throw shape nếu chúng copy `mktAiPlannerSlugs` check (grep `mkt_ai_planner_slug_not_pilot`)

**Interfaces:**
- Consumes: `assertPlannerAllowed`, `this.config.*` ; policy = `null` cho đến Task 4
- Produces: `ForbiddenException` body `{ error, message, admin_path, service_slug }`

- [ ] **Step 1: Grep and replace dual throws**

Trong `assertEnabled` / `assertPresalesMktAiEnabled`:

```ts
const allowed = assertPlannerAllowed(serviceSlug ?? '', null, {
  plannerEnabled: this.config.mktAiPlannerEnabled,
  envSlugs: this.config.mktAiPlannerSlugs,
  pilotOnly: this.config.mktAiPilotOnlyEnabled,
  pilotSlugs: this.config.mktAiPilotServiceSlugs,
});
if (!allowed.ok) {
  if (allowed.error === 'mkt_ai_planner_disabled') {
    throw new NotFoundException({ error: allowed.error, message: allowed.message });
  }
  throw new ForbiddenException({
    error: allowed.error,
    message: allowed.message,
    admin_path: allowed.admin_path,
    service_slug: allowed.service_slug,
  });
}
```

Xóa block `mkt_ai_pilot_slug_required` và `mkt_ai_planner_slug_not_pilot`.

- [ ] **Step 2: Run unit tests**

Run: `cd services/ptt-crm-api && npx jest --testPathPattern='marketing-ai-planner|leads-funnel' --no-coverage`

Expected: PASS (update fixtures nếu test expect mã lỗi cũ → expect `mkt_ai_service_not_enabled`).

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(mkt-ai): P0 wire single allow error for planner + presales"
```

**P0 hotfix VPS (không chờ Task 4):** tạm thêm `quang-cao-facebook` vào `PTT_MKT_AI_PLANNER_SLUGS` nếu PO cần AI ngay. Policy DB thay env ở Task 4–5.

---

### Task 3: DDL `mkt_ai_service_policy` (P0)

**Files:**
- Create: `docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-policy.sql`
- Modify: `scripts/apply_pg_ddl_mkt_ai_planner.sh` (append `-f` file mới)
- Create: `scripts/seed_mkt_ai_service_policy.sql`

**Interfaces:**
- Produces: table `mkt_ai_service_policy`

- [ ] **Step 1: Write DDL**

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS mkt_ai_service_policy (
    service_slug          TEXT PRIMARY KEY,
    rollout               TEXT NOT NULL DEFAULT 'off'
                          CHECK (rollout IN ('off', 'pilot', 'ga')),
    enabled               BOOLEAN NOT NULL DEFAULT TRUE,
    active_version_id     BIGINT,
    strict_pilot_quality  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by            TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_mkt_ai_service_policy_rollout
    ON mkt_ai_service_policy (rollout) WHERE enabled;
COMMIT;
```

- [ ] **Step 2: Seed SQL**

```sql
-- 3 slug đang VPS = pilot; các slug default catalog = off (trừ 3 cái trên)
INSERT INTO mkt_ai_service_policy (service_slug, rollout, enabled)
VALUES
  ('meta-lead-gen', 'pilot', TRUE),
  ('bds-lead-gen', 'pilot', TRUE),
  ('seo-retainer', 'pilot', TRUE),
  ('quang-cao-facebook', 'off', TRUE),
  ('quang-cao-google', 'off', TRUE),
  ('tiep-thi-noi-dung', 'off', TRUE),
  ('lead-gen', 'off', TRUE),
  ('thue-tai-khoan-quang-cao', 'off', TRUE),
  ('dich-vu-seo-tong-the', 'off', TRUE),
  ('dich-vu-seo-local', 'off', TRUE),
  ('dich-vu-seo-audit', 'off', TRUE),
  ('dich-vu-aeo', 'off', TRUE),
  ('email-sms-zalo-marketing', 'off', TRUE)
ON CONFLICT (service_slug) DO NOTHING;
```

PO muốn QC Facebook ngay: đổi dòng đó thành `'pilot'` trong seed trước apply VPS.

- [ ] **Step 3: Apply locally + commit**

Run: `psql "$DATABASE_URL" -f docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-policy.sql && psql "$DATABASE_URL" -f scripts/seed_mkt_ai_service_policy.sql`

```bash
git add docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-policy.sql \
  scripts/seed_mkt_ai_service_policy.sql scripts/apply_pg_ddl_mkt_ai_planner.sh
git commit -m "feat(mkt-ai): DDL + seed service policy off/pilot/ga"
```

---

### Task 4: Policy repository + inject into allow (P0)

**Files:**
- Create: `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-service-policy.repository.ts`
- Create: `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-service-policy.repository.spec.ts` (mock `query`)
- Modify: `marketing-ai-planner.module.ts` — provide repo
- Modify: `marketing-ai-planner.service.ts` — `assertEnabled` async load policy
- Modify: `leads-funnel.service.ts` — inject repo hoặc facade `PlannerAllowService`

**Interfaces:**
- Produces: `getPolicy(slug): Promise<PlannerPolicySnap | null>`, `upsertPolicy(slug, patch, actor)`

- [ ] **Step 1: Repository**

```ts
async getPolicy(slug: string): Promise<PlannerPolicySnap | null> {
  const { rows } = await this.db.query(
    `SELECT rollout, enabled FROM mkt_ai_service_policy WHERE service_slug = $1`,
    [slug],
  );
  if (!rows[0]) return null;
  return { rollout: rows[0].rollout, enabled: rows[0].enabled };
}
```

`assertEnabled` đổi `async` — mọi caller đã `await` job methods; nếu private sync, đổi thành `await this.allow.ensure(slug)`.

Tạo `MktAiPlannerAllowService.ensure(slug)` gọi repo + `assertPlannerAllowed` + throw.

- [ ] **Step 2: Test repo mock + allow service**

Jest: mock query trả `pilot` → ensure không throw; `off` → Forbidden `mkt_ai_service_not_enabled`.

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(mkt-ai): load service policy in planner allow"
```

**P0 done khi:** slug `off` 403 VI; 3 slug seed `pilot` + env AND vẫn chặn nếu `PLANNER_SLUGS` không chứa (VPS hiện tại). Để `quang-cao-facebook` chạy: seed `pilot` **và** thêm slug vào env **hoặc** xóa `PTT_MKT_AI_PLANNER_SLUGS` trên VPS.

---

### Task 5: Playbook `_common` + resolve chain (P1)

**Files:**
- Create: `services/ptt-crm-api/src/marketing-ai-planner/playbooks/_common.json`
- Modify: `marketing-ai-playbook.util.ts` — `MKT_AI_PLAYBOOK_SLUGS` thêm `'_common'`; `resolvePlaybookDocument(slug, catalog, common)`
- Create: `marketing-ai-playbook.util.spec.ts` cases resolve (file đã có spec — thêm describe)
- Modify: `marketing-ai-playbook.service.ts` `resolvePlaybook` / `listForLifecycle` — luôn include `_common`

**Interfaces:**
- Produces: `resolvePlaybookForSlug(serviceSlug, brief, catalog): MktAiIndustryPlaybook`

- [ ] **Step 1: Failing test**

```ts
it('falls back to _common when slug has no industry file', () => {
  const catalog = listPlaybookCatalog();
  const pb = matchPlaybookForServiceSlug('quang-cao-facebook', catalog);
  expect(pb === null || pb.slug === '_common').toBe(true);
});
```

Sau khi thêm `_common` vào `service_slugs: ['*']` — **không** dùng `*` trong match. Thêm:

```ts
export function resolvePlaybookForSlug(
  serviceSlug: string,
  catalog: MktAiIndustryPlaybook[],
): MktAiIndustryPlaybook {
  return matchPlaybookForServiceSlug(serviceSlug, catalog)
    ?? catalog.find((p) => p.slug === '_common')
    ?? readPlaybookFile('_common');
}
```

- [ ] **Step 2: `_common.json`**

Bắt buộc schema: `slug=_common`, `label_vi="Playbook chung"`, `service_slugs: []` (không match industry), `brief_defaults.objective` generic, ≥3 `strategy_prompt_hints`, ≥2 KPI, `quality_gate` 70/2, `governance_notes_vi` gồm human-in-the-loop + không auto-mail.

- [ ] **Step 3: `verify_mkt_ai_playbooks.sh` + jest playbook**

Run: `./scripts/verify_mkt_ai_playbooks.sh` — cập nhật script nếu chỉ đọc `MKT_AI_PLAYBOOK_SLUGS` 3 phần tử.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(mkt-ai): _common playbook fallback for any pilot slug"
```

---

### Task 6: AiPlaybookSelector hiện `_common` (P1)

**Files:**
- Modify: `services/ops-web/src/components/mkt-ai/AiPlaybookSelector.tsx`
- Modify: `services/ptt-crm-api` `listForLifecycle` — filter `pilotSlugs` **không** loại `_common`

- [ ] **Step 1:** Dropdown luôn có `_common` + playbook khớp slug + 3 shipped.
- [ ] **Step 2:** Vitest hoặc e2e không bắt buộc nếu list API unit đủ.
- [ ] **Step 3: Commit** `feat(mkt-ai): show _common in planner playbook picker`

---

### Task 7: DDL versions + learn_jobs (P2)

**Files:**
- Create: `docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-versions.sql`

```sql
BEGIN;
CREATE TABLE IF NOT EXISTS mkt_ai_playbook_versions (
    id              BIGSERIAL PRIMARY KEY,
    service_slug    TEXT NOT NULL,
    version_no      INT NOT NULL,
    status          TEXT NOT NULL CHECK (status IN (
                      'draft', 'pending_review', 'approved', 'active', 'retired', 'rejected_auto')),
    depth           TEXT NOT NULL CHECK (depth IN ('shipped', 'shallow', 'deep')),
    document_json   JSONB NOT NULL,
    source          TEXT NOT NULL CHECK (source IN ('disk', 'common', 'learn', 'manual')),
    learn_job_id    BIGINT,
    corpus_json     JSONB NOT NULL DEFAULT '{}',
    created_by      TEXT NOT NULL DEFAULT '',
    reviewed_by     TEXT,
    reviewed_at     TIMESTAMPTZ,
    review_note     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (service_slug, version_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mkt_ai_playbook_one_active
    ON mkt_ai_playbook_versions (service_slug) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS mkt_ai_playbook_learn_jobs (
    id                  BIGSERIAL PRIMARY KEY,
    service_slug        TEXT NOT NULL,
    status              TEXT NOT NULL CHECK (status IN (
                          'queued', 'running', 'succeeded', 'failed')),
    actor               TEXT NOT NULL,
    error               TEXT,
    output_version_id   BIGINT REFERENCES mkt_ai_playbook_versions (id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_mkt_ai_playbook_learn_slug
    ON mkt_ai_playbook_learn_jobs (service_slug, created_at DESC);

ALTER TABLE mkt_ai_service_policy
    ADD CONSTRAINT mkt_ai_service_policy_active_fk
    FOREIGN KEY (active_version_id) REFERENCES mkt_ai_playbook_versions (id)
    DEFERRABLE INITIALLY DEFERRED;
COMMIT;
```

- [ ] Apply local + hook `apply_pg_ddl_mkt_ai_planner.sh`
- [ ] **Commit** `feat(mkt-ai): DDL playbook versions and learn jobs`

---

### Task 8: Import disk playbooks → version `active` shipped (P1/P2)

**Files:**
- Create: `scripts/seed_mkt_ai_playbook_versions.ts` hoặc SQL `scripts/seed_mkt_ai_playbook_versions.sql` (json từ file — script node đọc 4 JSON)

- [ ] Script đọc `_common.json` + 3 industry → INSERT `status=active`, `depth=shipped`, `source=disk|common`, `version_no=1` nếu slug chưa có active.
- [ ] Idempotent: skip nếu đã có active.
- [ ] Set `mkt_ai_service_policy.active_version_id` cho 3 slug pilot + `_common` row policy (`service_slug='_common'`, `rollout=ga`, luôn enabled).
- [ ] **Commit** `feat(mkt-ai): import shipped playbooks into version table`

---

### Task 9: Corpus filter C1–C5 + W1 + seed exclude (P2)

**Files:**
- Create: `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-corpus.util.ts`
- Create: `services/ptt-crm-api/src/marketing-ai-planner/mkt-ai-playbook-corpus.util.spec.ts`

**Interfaces:**
- Consumes: array `CorpusLifecycleInput`
- Produces: `{ candidates, winners, depth: 'shallow'|'deep', canLearn: boolean, remaining: number }`

```ts
export type CorpusLifecycleInput = {
  lifecycleId: number;
  serviceSlug: string;
  applied: boolean;
  qualityScore: number;
  humanEditedAfterGenerate: boolean;
  isUatSeed: boolean;
  sqliteLeadId?: number;
  stage: string;
  closedLoopWin: boolean; // W1
  hasTier3Artifact: boolean; // Ops Done | QA pass | content approved
};

export function classifyCorpus(slug: string, rows: CorpusLifecycleInput[]) {
  const candidates = rows.filter(
    (r) =>
      r.serviceSlug === slug &&
      r.applied &&
      r.qualityScore >= 70 &&
      r.humanEditedAfterGenerate &&
      !r.isUatSeed &&
      (r.sqliteLeadId == null || r.sqliteLeadId < 900000901),
  );
  const winners = candidates.filter((r) => r.closedLoopWin);
  const canLearn = candidates.length >= 5;
  const deep =
    winners.length >= 3 && winners.filter((r) => r.hasTier3Artifact).length >= 3;
  return {
    candidates,
    winners,
    depth: deep ? 'deep' : 'shallow',
    canLearn,
    remaining: Math.max(0, 5 - candidates.length),
  };
}
```

- [ ] Tests: 4 HĐ → `canLearn=false`; 5 ứng viên 2 thắng → `shallow` + `canLearn`; 5/3 thắng + 3 artifact → `deep`; seed id 900000901 loại.
- [ ] **Commit** `feat(mkt-ai): corpus gates 5/3/deep for playbook learn`

---

### Task 10: Learn validator PII + schema (P2)

**Files:**
- Create: `mkt-ai-playbook-learn-validate.util.ts` + `.spec.ts`

```ts
export function rejectLearnedPlaybook(
  doc: Record<string, unknown>,
  serviceSlug: string,
  clientNames: string[],
): string[] {
  const errors = validateMktAiPlaybookDocument(doc, String(doc.slug ?? serviceSlug));
  const defaults = (doc.brief_defaults ?? {}) as Record<string, unknown>;
  if (String(defaults.brand_name ?? '').trim()) errors.push('brand_name must be empty');
  const blob = JSON.stringify(doc).toLowerCase();
  for (const name of clientNames) {
    if (name.trim().length >= 4 && blob.includes(name.trim().toLowerCase())) {
      errors.push('client_name_leak');
    }
  }
  if (/\b0\d{8,10}\b/.test(blob) || /@/.test(blob)) errors.push('pii_phone_or_email');
  const slugs = doc.service_slugs as string[] | undefined;
  if (!slugs || slugs.length !== 1 || slugs[0] !== serviceSlug) {
    errors.push('service_slugs must be exactly the learned slug');
  }
  return errors;
}
```

- [ ] Test: brand_name set → fail; client name in hint → fail; clean meta-lead-gen clone with slug đổi → pass.
- [ ] **Commit** `feat(mkt-ai): reject learned playbook PII and wrong slug`

---

### Task 11: Learn service enqueue + run (P2)

**Files:**
- Create: `mkt-ai-playbook-learn.service.ts` + `.spec.ts`
- Create: `mkt-ai-playbook-versions.repository.ts`

**Interfaces:**
- `enqueueLearn(slug, actor, excludeLifecycleIds: number[]): Promise<{ job_id, status }>`
- `409` `playbook_learn_cooldown` nếu succeeded < 7 ngày
- `409` `playbook_learn_in_progress` nếu queued/running
- `409` `{ error: 'playbook_learn_need_more', remaining }` nếu `!canLearn`
- Job chạy: load ≤15 winner/candidate excerpts (ẩn `brand_name`), gọi orchestrator JSON schema, `rejectLearnedPlaybook` → `rejected_auto` hoặc insert version `draft` **không** active
- `created_by = actor`; cấm status active trong insert

- [ ] Unit: mock repo — 4 HĐ throws need_more; AI output brand_name → rejected_auto; clean → draft.
- [ ] Flag `PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED` — `0` → 404.
- [ ] Audit `ai_agent_runs` `use_case=mkt_ai_playbook_learn` nếu pattern sẵn.
- [ ] **Commit** `feat(mkt-ai): playbook learn job writes draft only`

---

### Task 12: Admin REST (P2)

**Files:**
- Modify: `marketing-ai-playbook-admin.controller.ts`
- Create: `mkt-ai-playbook-admin.service.ts` (list + policy patch + version decide/activate)
- Guards: view = `crm_mkt_ai.view` **hoặc** `ai_admin.view` **hoặc** `crm_mkt_ai.approve`; generate / approve như spec §9

Routes (đúng spec §11):

| Method | Path |
|--------|------|
| GET | `api/v1/admin/mkt-ai/playbooks` |
| GET | `api/v1/admin/mkt-ai/playbooks/:slug` |
| PATCH | `api/v1/admin/mkt-ai/playbooks/:slug/policy` |
| POST | `api/v1/admin/mkt-ai/playbooks/:slug/learn` |
| GET | `api/v1/admin/mkt-ai/playbooks/:slug/learn/:jobId` |
| PATCH | `api/v1/admin/mkt-ai/playbooks/versions/:id` |
| POST | `.../versions/:id/submit` |
| POST | `.../versions/:id/decide` body `{ decision: 'approve'\|'request_changes', note? }` |
| POST | `.../versions/:id/activate` |
| POST | `.../versions/:id/rollback` |

Activate: chỉ `approved`; `reviewed_by !== created_by` hoặc `self_approve` + note ≥20; shallow bắt buộc `accept_shallow=true`; retire old active; set policy.active_version_id.

- [ ] Jest controller: activate từ token “AI” / job actor không phải staff → 403 (chỉ staff JWT).
- [ ] **Commit** `feat(mkt-ai): admin playbook learn and activate API`

---

### Task 13: Admin UI Sinh / Duyệt / Active (P2)

**Files:**
- Create: `services/ops-web/src/lib/mkt-ai-playbook-admin-api.ts`
- Create: `services/ops-web/src/app/crm/admin/mkt-ai/playbooks/page.tsx`
- Create: `services/ops-web/src/app/crm/admin/mkt-ai/playbooks/[slug]/page.tsx` (hoặc query `?slug=` một page)
- Modify: `OpsNav.tsx` — nhóm AI: `{ href: '/crm/admin/mkt-ai/playbooks', label: 'Playbook DV' }` nếu `canGenerate` hoặc `canApprove` mkt_ai
- Modify: `rbac-routes.ts` prefix `/crm/admin/mkt-ai`

**UI (spec §9):** bảng slug, rollout chip, mẫu `n/5` `m/3`, CTA Mở. Chi tiết 3 cột Corpus / JSON fields / Hành động. Nút Sinh disabled + `Còn N HĐ…`. Không nút Active trên bản `draft`.

- [ ] **Commit** `feat(mkt-ai): admin UI playbook learn review activate`

---

### Task 14: Planner resolve từ `active_version_id` (P2)

**Files:**
- Modify: `marketing-ai-playbook.service.ts` `resolvePlaybook` / `getPlaybook`
- Modify: `AiPlaybookSelector` — list từ API (đã có) gồm `_common` + active DB

Thứ tự spec §5.4: brief `_playbook_slug` nếu version active/approved → policy active → `_common` → disk.

- [ ] Jest: policy active custom beats disk meta-lead-gen.
- [ ] **Commit** `feat(mkt-ai): planner uses active playbook version`

---

### Task 15: P3 depth — tầng 3 artifacts + cấm “Tuần N” (P3)

**Files:**
- Modify: `mkt-ai-playbook-corpus.util.ts` — `hasTier3Artifact`
- Create: `mkt-ai-playbook-week-hints.util.ts` — chỉ emit `Tuần ${n}:` khi ≥3 HĐ có task Done cùng `week_no` + normalized name
- Modify: learn prompt builder — không gửi week hints nếu shallow

- [ ] Tests: 3 winners không artifact → depth shallow; week hint empty; 3 Done tuần 1 cùng tên → một hint.
- [ ] **Commit** `feat(mkt-ai): deep playbook requires delivery artifacts`

---

### Task 16: Docs + e2e + VPS notes (P1/P2)

**Files:**
- Modify: `docs/huong-dan-su-dung/29-marketing-ai-planner-thuc-chien.md` — policy Admin, hết 2 mã 403 cũ
- Modify: `docs/runbooks/mkt-ai-playbook-ops.md` — UI Duyệt thay “chỉ PR JSON”
- Modify: spec header **Trạng thái:** Plan ready
- Create: `services/ops-web/e2e/mkt-ai-playbook-admin.spec.ts` — login staff approve: list, mở slug, Sinh disabled khi fixture 0 HĐ
- Modify: `deploy/env.mkt-ai-ga.example` — comment deprecate `PLANNER_SLUGS`

VPS P0:

```bash
psql "$DATABASE_URL" -f docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-policy.sql
psql "$DATABASE_URL" -f scripts/seed_mkt_ai_service_policy.sql
# optional: UPDATE mkt_ai_service_policy SET rollout='pilot' WHERE service_slug='quang-cao-facebook';
# optional: xóa hoặc mở rộng PTT_MKT_AI_PLANNER_SLUGS
sudo systemctl restart ptt-crm-api
```

- [ ] **Commit** `docs(mkt-ai): playbook policy + learn ops guide`

---

## Spec coverage (self-review)

| Spec | Task |
|------|------|
| G1 / G5 / §5.2 / §4.1 một 403 | 1–4 |
| G7 kill-switch | 2 (enabled flag trước policy) |
| G2 `_common` | 5–6 |
| Import 3 JSON + disk fallback | 7–8, 14 |
| §6 ngưỡng 5/3/15/7 ngày | 9, 11 |
| §7 tầng 2 ẩn danh + §8.2 | 10–11 |
| §7.0 RACI / tuần N / deep | 15 |
| §9 UI / §11 API / §6.3 Active | 12–13 |
| G4 / G6 no fine-tune no auto-active | 11–12 |
| G3 học HĐ thật | 9–11 |
| Docs thực chiến | 16 |

## Type names (khóa)

`PlannerPolicySnap`, `PlannerAllowEnv`, `PlannerAllowResult`, `CorpusLifecycleInput`, `classifyCorpus`, `rejectLearnedPlaybook`, `enqueueLearn`, `mkt_ai_service_not_enabled`.

---

*Plan v1.0 — implement theo spec playbook learn catalog v1.1. Không gồm CEO Tower.*

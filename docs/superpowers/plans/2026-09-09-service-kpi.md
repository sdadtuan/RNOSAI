# Service KPI (KPI Contract OS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Service KPI trên KPI Hub — template theo Portfolio 21 DV, inherit vào Quote, tracking actual, và vòng KPI Contract OS (War Room, Contract Score + GM, 3 sổ, Policy Pack BĐS) đúng SRS v1.1 và mockup.

**Architecture:** Nest submodule `kpi-hub/service-kpi/` tái sử dụng `crm_kpi_dictionary` Active. Template/instance/actual lưu bảng `crm_service_kpi_*`. Quote submit gọi `evaluateKpiContractScore` rồi `evaluateQuotePolicy` (cùng cổng GM). UI thay iframe mockup bằng `kpi-hub-*` components trong `KpiHubShell`. Public proposal chỉ đọc sổ Reported + `client_visible=true`.

**Tech Stack:** NestJS (`ptt-crm-api`), PostgreSQL, Next.js 14 (`ops-web`), Jest + Vitest + Playwright, CSS `kpi-hub-*` (không Tailwind).

**Spec:** `docs/specs/2026-09-09-service-kpi-module-srs.md` (v1.1)  
**Design:** `docs/superpowers/specs/2026-09-09-service-kpi-competitive-ops-design.md`  
**Mockup:** `docs/design/rnosai-service-kpi-mockup.html` (SKPI-00…12)

## Global Constraints

- API prefix thật: `/api/crm/kpi-hub/...` (không dùng `/v1/kpi-hub` trong code).
- Tenant: `tenant_id = 'PTT'` + `deleted_at IS NULL` trên mọi query.
- Optimistic lock: `If-Match: {row_version}` → `409` + `SERVICE_KPI_VERSION_CONFLICT`.
- Template ACTIVE chỉ sửa bằng version Draft mới. Quote/Proposal giữ snapshot.
- `INTERNAL_OPERATIONAL`, Contract Score, GM, cost/margin **không** ra public proposal API.
- Classification bắt buộc: `COMMITTED_DELIVERABLE` | `QUALITY_STANDARD` | `OPTIMIZATION_TARGET` | `PROJECTED_RESULT` | `BUSINESS_OUTCOME` | `INTERNAL_OPERATIONAL`.
- Zero denominator → `N/A` + alert, không ghi 0 giả.
- UI = mockup: nhãn tiếng Việt, badge màu (blue cam kết / purple tối ưu / amber dự kiến / green quality / red at-risk). Prefix CSS `kpi-hub-*`.
- Không thay `/crm/kpi`, Dictionary Hub, Ads Manager. Không LLM Wave 1 (wording firewall = rule).
- TDD: engine thuần (score, readiness, policy pack, 3 sổ, duplicate actual) viết test trước.
- Pattern copy: `services/ptt-crm-api/src/kpi-hub/dictionary/`, `services/ops-web/src/lib/kpi-hub-api.ts`, `scripts/apply_pg_ddl_kpi_hub.sh`.
- Menu KPI Hub nhóm SERVICE KPI đã có route stub + iframe — Wave 1 thay iframe, không thêm app thứ hai.

---

## File map

```text
docs/specs/2026-09-09-postgresql-ddl-service-kpi.sql
scripts/apply_pg_ddl_service_kpi.sh
scripts/deploy_service_kpi_vps.sh

services/ptt-crm-api/src/kpi-hub/service-kpi/
  service-kpi.types.ts
  service-kpi-classification.ts          # wording + pack rules (pure)
  service-kpi-readiness.ts               # FR-SKPI-006 matrix (pure)
  service-kpi-contract-score.ts          # FR-SKPI-011 (pure)
  service-kpi-ledgers.ts                 # FR-SKPI-012 3 sổ (pure)
  service-kpi-policy-pack.ts             # FR-SKPI-014 BĐS (pure)
  service-kpi-actuals.ts                 # duplicate / zero-den (pure)
  service-kpi.repository.ts
  service-kpi-templates.service.ts
  service-kpi-instances.service.ts
  service-kpi-operations.service.ts      # plan, actual, war room, reconcile
  service-kpi.controller.ts              # hoặc gắn KpiHubController
  service-kpi.module.ts

services/ptt-crm-api/src/proposals/
  quote-policy.util.ts                   # trigger kpi_contract
  quote-approval.service.ts              # gọi score trước planned steps

services/ops-web/src/lib/service-kpi-api.ts
services/ops-web/src/lib/service-kpi-types.ts
services/ops-web/src/components/kpi-hub/service-kpi/
  ServiceKpiTable.tsx, ServiceKpiWarRoom.tsx, ...
  (xóa iframe ServiceKpiMockupFrame sau khi UI thật sẵn)
```

**Sóng triển khai (mỗi sóng ship được, test được):**

| Sóng | Ship | SRS |
|---|---|---|
| Wave 1 | DDL + engine + template CRUD + Policy Pack BĐS + Contract Score trên Quote submit | FR-001/002/004/006/011/014, AC-01/05/06/08 |
| Wave 2 | Inherit quote, instances, measurement, actual, 3 sổ, War Room, assumption | FR-003/005/007/008/012/013/015, AC-02/03/04/07 |
| Wave 3 | Feedback loop benchmark, pack Spa/Edu, connector mở rộng | FR-016, Phase 3 |

---

### Task 1: DDL `crm_service_kpi_*`

**Files:**
- Create: `docs/specs/2026-09-09-postgresql-ddl-service-kpi.sql`
- Create: `scripts/apply_pg_ddl_service_kpi.sh`
- Modify: `scripts/deploy_kpi_hub_vps.sh` (thêm 1 dòng apply DDL mới sau KPI Hub DDL)

**Interfaces:**
- Consumes: `crm_kpi_dictionary(id)`, `crm_catalog_services.dv_code` (không FK cứng nếu catalog khác DB — dùng TEXT `dv_code`)
- Produces: tables listed below; migration version `2026-09-09-service-kpi`

- [ ] **Step 1: Write DDL**

```sql
-- docs/specs/2026-09-09-postgresql-ddl-service-kpi.sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
BEGIN;

CREATE TABLE IF NOT EXISTS crm_service_kpi_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  dv_code TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_team TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  active_version_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1,
  CONSTRAINT crm_skpi_tpl_status_chk CHECK (
    status IN ('DRAFT','IN_REVIEW','ACTIVE','SUSPENDED','RETIRED')
  )
);
CREATE INDEX IF NOT EXISTS idx_skpi_tpl_tenant_dv
  ON crm_service_kpi_templates (tenant_id, dv_code) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_service_kpi_template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  template_id UUID NOT NULL REFERENCES crm_service_kpi_templates(id),
  version_no INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  snapshot_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (template_id, version_no)
);

CREATE TABLE IF NOT EXISTS crm_service_kpi_template_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  template_version_id UUID NOT NULL REFERENCES crm_service_kpi_template_versions(id),
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  classification TEXT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  target_min NUMERIC,
  target_max NUMERIC,
  target_unit TEXT,
  scenario TEXT NOT NULL DEFAULT 'base',
  assumption_template TEXT NOT NULL DEFAULT '',
  disclaimer_template TEXT NOT NULL DEFAULT '',
  owner_role TEXT NOT NULL DEFAULT '',
  cadence TEXT NOT NULL DEFAULT 'weekly'
);

CREATE TABLE IF NOT EXISTS crm_service_kpi_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  dv_code TEXT,
  dictionary_id UUID NOT NULL REFERENCES crm_kpi_dictionary(id),
  template_version_id UUID REFERENCES crm_service_kpi_template_versions(id),
  classification TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  client_visible BOOLEAN NOT NULL DEFAULT TRUE,
  owner_name TEXT,
  target_min NUMERIC,
  target_max NUMERIC,
  scenario TEXT NOT NULL DEFAULT 'base',
  assumption_text TEXT NOT NULL DEFAULT '',
  assumption_state TEXT NOT NULL DEFAULT 'pending',
  disclaimer_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  row_version INT NOT NULL DEFAULT 1,
  CONSTRAINT crm_skpi_inst_source_chk CHECK (
    source_type IN ('quote_option','quote_line_item','proposal_version','project','work_order','campaign')
  ),
  CONSTRAINT crm_skpi_inst_status_chk CHECK (
    status IN ('DRAFT','READY_FOR_REVIEW','APPROVED','TRACKING','AT_RISK','ACHIEVED','MISSED','WAIVED','SUPERSEDED','ARCHIVED')
  )
);
CREATE INDEX IF NOT EXISTS idx_skpi_inst_source
  ON crm_service_kpi_instances (tenant_id, source_type, source_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS crm_service_kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  instance_id UUID NOT NULL REFERENCES crm_service_kpi_instances(id),
  quote_version_id TEXT NOT NULL,
  ledger TEXT NOT NULL DEFAULT 'quoted',
  payload_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT crm_skpi_snap_ledger_chk CHECK (ledger IN ('quoted','delivered','reported'))
);

CREATE TABLE IF NOT EXISTS crm_service_kpi_measurement_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  instance_id UUID NOT NULL UNIQUE REFERENCES crm_service_kpi_instances(id),
  owner_name TEXT NOT NULL,
  cadence TEXT NOT NULL DEFAULT 'daily',
  timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  data_source TEXT NOT NULL DEFAULT '',
  field_mapping TEXT NOT NULL DEFAULT '',
  freshness_sla_hours INT NOT NULL DEFAULT 24,
  qa_status TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS crm_service_kpi_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  instance_id UUID NOT NULL REFERENCES crm_service_kpi_instances(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  value NUMERIC,
  unit TEXT,
  quality_status TEXT NOT NULL DEFAULT 'pending_validation',
  collection_method TEXT NOT NULL DEFAULT 'manual',
  source_ref TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  superseded_by UUID,
  CONSTRAINT crm_skpi_act_quality_chk CHECK (
    quality_status IN ('valid','estimated','pending_validation','invalid','na')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skpi_actual_unique_open
  ON crm_service_kpi_actuals (instance_id, period_start, period_end, source_ref)
  WHERE superseded_by IS NULL;

CREATE TABLE IF NOT EXISTS crm_service_kpi_policy_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL DEFAULT 'PTT',
  industry TEXT NOT NULL,
  regulated BOOLEAN NOT NULL DEFAULT FALSE,
  rules_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  banned_phrases TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (tenant_id, industry)
);

INSERT INTO crm_service_kpi_policy_packs (industry, regulated, rules_json, banned_phrases) VALUES
(
  'real_estate',
  TRUE,
  '[{"forbid_classification":"COMMITTED_DELIVERABLE","kpi_kind":"booking_or_gmv"},{"require":["attribution","client_sales_sla","disclaimer"],"classification":"BUSINESS_OUTCOME"}]'::jsonb,
  ARRAY['cam kết doanh số','đảm bảo lead','chắc chắn X lead']
)
ON CONFLICT (tenant_id, industry) DO NOTHING;

INSERT INTO schema_migrations (version, description)
VALUES ('2026-09-09-service-kpi', 'service kpi templates/instances/actuals/policy packs')
ON CONFLICT (version) DO NOTHING;

COMMIT;
```

- [ ] **Step 2: Apply script** (copy `scripts/apply_pg_ddl_kpi_hub.sh`, đổi `DDL=` sang file mới)

- [ ] **Step 3: Apply locally**

```bash
bash scripts/apply_pg_ddl_service_kpi.sh
```

Expected: `OK` và `\dt crm_service_kpi_*` hiện 8 bảng.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/2026-09-09-postgresql-ddl-service-kpi.sql scripts/apply_pg_ddl_service_kpi.sh scripts/deploy_kpi_hub_vps.sh
git commit -m "feat(service-kpi): add PostgreSQL DDL for templates, instances, actuals"
```

---

### Task 2: Classification + Policy Pack engine (pure)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-classification.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-policy-pack.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-policy-pack.spec.ts`

**Interfaces:**
- Consumes: none
- Produces:

```ts
export type SkpiClassification =
  | 'COMMITTED_DELIVERABLE'
  | 'QUALITY_STANDARD'
  | 'OPTIMIZATION_TARGET'
  | 'PROJECTED_RESULT'
  | 'BUSINESS_OUTCOME'
  | 'INTERNAL_OPERATIONAL';

export function clientWording(c: SkpiClassification): string;
export function isInternalOnly(c: SkpiClassification): boolean;

export type PolicyPack = {
  industry: string;
  regulated: boolean;
  banned_phrases: string[];
  rules: Array<{
    forbid_classification?: SkpiClassification;
    kpi_kind?: string;
    classification?: SkpiClassification;
    require?: string[];
  }>;
};

export type PolicyViolation = { code: string; field: string; message: string };

export function evaluatePolicyPack(input: {
  pack: PolicyPack;
  classification: SkpiClassification;
  kpiKind?: string;
  proposalText?: string;
  hasAttribution?: boolean;
  hasClientSalesSla?: boolean;
  hasDisclaimer?: boolean;
}): PolicyViolation[];
```

- [ ] **Step 1: Write failing tests**

```ts
import { evaluatePolicyPack } from './service-kpi-policy-pack';
import { REAL_ESTATE_PACK } from './service-kpi-policy-pack';

describe('evaluatePolicyPack BĐS', () => {
  it('blocks booking as COMMITTED_DELIVERABLE', () => {
    const v = evaluatePolicyPack({
      pack: REAL_ESTATE_PACK,
      classification: 'COMMITTED_DELIVERABLE',
      kpiKind: 'booking_or_gmv',
    });
    expect(v.some((x) => x.code === 'PACK_FORBIDDEN_CLASSIFICATION')).toBe(true);
  });

  it('blocks banned phrase on projected result (AC-SKPI-08)', () => {
    const v = evaluatePolicyPack({
      pack: REAL_ESTATE_PACK,
      classification: 'PROJECTED_RESULT',
      proposalText: 'Chúng tôi cam kết doanh số 200 căn',
      hasDisclaimer: true,
    });
    expect(v.some((x) => x.code === 'PACK_BANNED_PHRASE')).toBe(true);
  });

  it('requires attribution + sales SLA + disclaimer for BUSINESS_OUTCOME', () => {
    const v = evaluatePolicyPack({
      pack: REAL_ESTATE_PACK,
      classification: 'BUSINESS_OUTCOME',
      kpiKind: 'booking_or_gmv',
    });
    expect(v.map((x) => x.code)).toEqual(
      expect.arrayContaining(['PACK_REQUIRE_ATTRIBUTION', 'PACK_REQUIRE_CLIENT_SALES_SLA', 'PACK_REQUIRE_DISCLAIMER']),
    );
  });
});
```

- [ ] **Step 2: Run to verify fail**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/kpi-hub/service-kpi/service-kpi-policy-pack.spec.ts
```

Expected: FAIL module not found.

- [ ] **Step 3: Implement**

`REAL_ESTATE_PACK.banned_phrases` = `cam kết doanh số`, `đảm bảo lead`, `chắc chắn x lead` (normalize lowercase).  
`kpiKind === 'booking_or_gmv'` + `COMMITTED_DELIVERABLE` → `PACK_FORBIDDEN_CLASSIFICATION`.  
Scan `proposalText` normalized: nếu chứa banned phrase → `PACK_BANNED_PHRASE`.  
`BUSINESS_OUTCOME` thiếu field → đúng 3 code require.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit** `feat(service-kpi): add BĐS policy pack and classification wording`

---

### Task 3: Readiness matrix (pure) — AC-SKPI-01

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-readiness.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-readiness.spec.ts`

**Interfaces:**

```ts
export type ReadinessLevel = 'pass' | 'warning' | 'blocking' | 'approval_required';
export type ReadinessInput = {
  classification: SkpiClassification;
  clientVisible: boolean;
  hasDefinition: boolean;
  hasQuantityOrTarget: boolean;
  hasDisclaimer: boolean;
  hasAssumption: boolean;
  hasScenario: boolean;
  hasDataSource: boolean;
  hasOwner: boolean;
  hasAcceptance?: boolean;
};
export type ReadinessResult = { level: ReadinessLevel; errors: Array<{ field: string; message: string }> };
export function validateReadiness(input: ReadinessInput): ReadinessResult;
```

- [ ] **Step 1: Failing test AC-SKPI-01**

```ts
it('blocks PROJECTED_RESULT client-visible without disclaimer', () => {
  const r = validateReadiness({
    classification: 'PROJECTED_RESULT',
    clientVisible: true,
    hasDefinition: true,
    hasQuantityOrTarget: true,
    hasDisclaimer: false,
    hasAssumption: true,
    hasScenario: true,
    hasDataSource: true,
    hasOwner: true,
  });
  expect(r.level).toBe('blocking');
  expect(r.errors.some((e) => e.field === 'disclaimer')).toBe(true);
});

it('INTERNAL_OPERATIONAL never requires disclaimer', () => {
  const r = validateReadiness({
    classification: 'INTERNAL_OPERATIONAL',
    clientVisible: false,
    hasDefinition: true,
    hasQuantityOrTarget: true,
    hasDisclaimer: false,
    hasAssumption: false,
    hasScenario: false,
    hasDataSource: true,
    hasOwner: true,
  });
  expect(r.level).toBe('pass');
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/ptt-crm-api && npx jest --config jest.config.js src/kpi-hub/service-kpi/service-kpi-readiness.spec.ts
```

- [ ] **Step 3: Implement matrix SRS §12**

`COMMITTED_DELIVERABLE`: definition, quantity, owner; acceptance missing → warning.  
`OPTIMIZATION_TARGET` / `PROJECTED_RESULT` client-visible: disclaimer + assumption bắt buộc → blocking.  
`PROJECTED_RESULT`: scenario bắt buộc.  
Thiếu definition → blocking mọi loại.

- [ ] **Step 4: PASS + commit** `feat(service-kpi): add KPI readiness matrix`

---

### Task 4: Contract Score engine (pure) — AC-SKPI-06

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-contract-score.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-contract-score.spec.ts`

**Interfaces:**

```ts
export const SCORE_WEIGHTS = {
  classification: 0.25,
  aggressiveness: 0.25,
  assumption: 0.2,
  data: 0.15,
  margin: 0.15,
} as const;

export type ContractScoreInput = {
  classificationRisk: number;      // 0–100
  targetAggressiveness: number;    // 0–100; CPL 50K vs floor 85K = 41% → scale to 100
  assumptionOpen: number;          // 0–100
  dataReadinessGap: number;        // 0–100
  marginPressure: number;          // 0–100; GM 22.4 vs floor 25 → pressure
  gmBps: number | null;
  gmFloorBps: number;
};

export type ContractScoreResult = {
  score: number;                   // 0–100 rounded
  parts: Record<keyof typeof SCORE_WEIGHTS, number>;
  blockSubmit: boolean;            // score >= 70 AND gmBps < gmFloorBps
  requiredReviewers: Array<'Finance' | 'GDKD' | 'Strategy'>;
};

export function aggressivenessFromTarget(proposed: number, floor: number, lowerIsBetter: boolean): number;
export function marginPressureFromGm(gmBps: number | null, floorBps: number): number;
export function evaluateKpiContractScore(input: ContractScoreInput): ContractScoreResult;
```

- [ ] **Step 1: Failing test QT-0089**

```ts
it('QT-0089 GM 22.4% + aggressive CPL blocks submit (AC-SKPI-06)', () => {
  const r = evaluateKpiContractScore({
    classificationRisk: 22,
    targetAggressiveness: 28,
    assumptionOpen: 12,
    dataReadinessGap: 8,
    marginPressure: 18,
    gmBps: 2240,
    gmFloorBps: 2500,
  });
  expect(r.score).toBe(18); // 22*0.25+28*0.25+12*0.2+8*0.15+18*0.15 = 5.5+7+2.4+1.2+2.7 = 18.8 → 19
  // Use exact: Math.round(weighted). Document expected 19 in test after implementing Math.round.
  expect(r.blockSubmit).toBe(true);
  expect(r.requiredReviewers).toEqual(['Finance', 'GDKD', 'Strategy']);
});

it('does not block when GM ok even if score parts high', () => {
  const r = evaluateKpiContractScore({
    classificationRisk: 80,
    targetAggressiveness: 80,
    assumptionOpen: 80,
    dataReadinessGap: 80,
    marginPressure: 10,
    gmBps: 3000,
    gmFloorBps: 2500,
  });
  expect(r.blockSubmit).toBe(false);
});
```

Công thức test: `Math.round(22*0.25 + 28*0.25 + 12*0.2 + 8*0.15 + 18*0.15)` = `Math.round(18.8)` = `19`. Sửa assertion `score` thành `19`.  
`blockSubmit` = `score >= 70 && gmBps < gmFloorBps` **hoặc** (`aggressiveness >= 25 && gmBps < gmFloorBps`) — QT-0089 score 19 nhưng vẫn block vì **GM thấp AND aggressiveness ≥ 25**. Implement đúng rule này (SRS: “GM < floor và KPI aggressive”).

- [ ] **Step 2–4:** FAIL → implement → PASS

- [ ] **Step 5: Commit** `feat(service-kpi): add KPI contract score (GM + aggressiveness gate)`

---

### Task 5: Three ledgers + actual duplicate (pure) — AC-SKPI-04/07

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-ledgers.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-actuals.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-ledgers.spec.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-actuals.spec.ts`

**Interfaces:**

```ts
export type Ledger = 'quoted' | 'delivered' | 'reported';
export type ActualQuality = 'valid' | 'estimated' | 'pending_validation' | 'invalid' | 'na';

export function canPublishClientReport(quality: ActualQuality, clientVisible: boolean): boolean;
// false unless quality === 'valid' && clientVisible

export type DuplicateDecision = 'skip' | 'merge' | 'correction';
export function detectDuplicateActual(existing: { periodStart: string; periodEnd: string; sourceRef: string; quality: ActualQuality } | null, incoming: { periodStart: string; periodEnd: string; sourceRef: string }): 'ok' | 'duplicate';
export function applyZeroDenominator(): { value: null; quality: 'na' };
```

- [ ] **Step 1: Tests**

```ts
it('blocks Reported from pending_validation (AC-SKPI-07)', () => {
  expect(canPublishClientReport('pending_validation', true)).toBe(false);
  expect(canPublishClientReport('valid', true)).toBe(true);
  expect(canPublishClientReport('valid', false)).toBe(false);
});

it('detects same period+source as duplicate (AC-SKPI-04)', () => {
  expect(detectDuplicateActual(
    { periodStart: '2026-10-07', periodEnd: '2026-10-07', sourceRef: 'meta+crm', quality: 'valid' },
    { periodStart: '2026-10-07', periodEnd: '2026-10-07', sourceRef: 'meta+crm' },
  )).toBe('duplicate');
});
```

- [ ] **Step 2–5:** implement, PASS, commit `feat(service-kpi): add ledger publish rules and actual duplicate detect`

---

### Task 6: Repository + Templates service

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi.types.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi.repository.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-templates.service.ts`
- Test: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-templates.service.spec.ts`

**Interfaces:**

```ts
export type CreateTemplateBody = {
  dv_code: string;
  name: string;
  owner_team?: string;
  rules: Array<{
    dictionary_id: string;
    classification: SkpiClassification;
    is_required?: boolean;
    client_visible?: boolean;
    target_min?: number;
    target_max?: number;
    assumption_template?: string;
    disclaimer_template?: string;
  }>;
};

export class ServiceKpiTemplatesService {
  list(q: { dv_code?: string; status?: string; page?: number }): Promise<{ items: unknown[]; summary: { active: number; in_review: number } }>;
  create(body: CreateTemplateBody, actor: { staffId: number }): Promise<{ id: string; status: 'DRAFT'; version_no: 1 }>;
  get(id: string): Promise<unknown>;
  createRevision(id: string, actor: { staffId: number }): Promise<{ version_id: string; version_no: number }>;
  submitReview(versionId: string): Promise<{ status: 'IN_REVIEW' }>;
  activate(versionId: string): Promise<{ status: 'ACTIVE' }>;
}
```

Quy tắc service (test bằng mock repo):

- `create`: dictionary phải `status === 'ACTIVE'` nếu không → `BadRequestException('DICTIONARY_NOT_ACTIVE')`.
- `submitReview`: với mỗi rule `client_visible` gọi `validateReadiness`; nếu blocking → `BadRequestException({ errors })`.
- `activate`: chỉ từ `IN_REVIEW`; set template `active_version_id`; version cũ ACTIVE → giữ history, không mutate quote snapshots.
- Sửa template ACTIVE: bắt buộc `createRevision` (status DRAFT), không `UPDATE` rule của version ACTIVE.

- [ ] **Step 1: Service spec với repo mock** — 3 cases trên

- [ ] **Step 2: FAIL → implement service + repo `pg` Pool như `KpiHubDictionaryRepository`** (`tenant_id='PTT'`)

- [ ] **Step 3: PASS + commit** `feat(service-kpi): add template CRUD service with readiness gate`

---

### Task 7: HTTP API + module wire

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi.controller.ts`
- Modify: `services/ptt-crm-api/src/kpi-hub/kpi-hub.module.ts` — providers + controller
- Modify: `services/ptt-crm-api/src/kpi-hub/guards/staff-kpi-hub.guard.ts` — tái `StaffKpiHubViewGuard` / Dictionary manage cho write
- Test: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi.controller.spec.ts` (optional smoke) hoặc e2e sau

**Routes (gắn `StaffOrInternalKeyGuard` + view/manage):**

| Method | Path | Cap |
|---|---|---|
| GET | `/api/crm/kpi-hub/service-templates` | `crm_kpi_hub.view` |
| POST | `/api/crm/kpi-hub/service-templates` | `crm_kpi_dictionary.manage` |
| GET | `/api/crm/kpi-hub/service-templates/:id` | view |
| POST | `/api/crm/kpi-hub/service-templates/:id/versions` | manage |
| POST | `/api/crm/kpi-hub/service-template-versions/:id/submit` | manage |
| POST | `/api/crm/kpi-hub/service-template-versions/:id/activate` | `crm_kpi_dictionary.publish` hoặc manage |
| GET | `/api/crm/kpi-hub/policy-packs` | view |
| GET | `/api/crm/kpi-hub/policy-packs/:industry` | view |

- [ ] **Step 1: Controller delegates to `ServiceKpiTemplatesService`; list query `dv_code`, `status`, `page`**

- [ ] **Step 2: Module providers + exports `ServiceKpiTemplatesService`**

- [ ] **Step 3: Manual** `curl -H "Authorization: Bearer $TOKEN" $API/api/crm/kpi-hub/service-templates` → `200` `{ items: [] }`

- [ ] **Step 4: Commit** `feat(service-kpi): expose template and policy-pack HTTP API`

---

### Task 8: Hook Contract Score vào Quote submit

**Files:**
- Modify: `services/ptt-crm-api/src/proposals/quote-policy.util.ts`
- Modify: `services/ptt-crm-api/src/proposals/quote-policy.util.spec.ts`
- Modify: `services/ptt-crm-api/src/proposals/quote-approval.service.ts`
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-quote-score.ts` (load instances của version → `evaluateKpiContractScore`)
- Test: `services/ptt-crm-api/src/proposals/quote-approval.service.spec.ts` (thêm case mock score)

**Interfaces:**

```ts
// quote-policy.util.ts — thêm flag
export type QuotePolicyFlags = {
  /* existing */
  kpi_contract_block?: boolean;
  kpi_contract_score?: number;
};

// evaluateQuotePolicy: if flags.kpi_contract_block
//   addTrigger Finance 'kpi_contract'
//   addTrigger GDKD 'kpi_contract'
//   addTrigger AD 'kpi_contract'  // Strategy/AD
```

`submitApproval` sau `loadFlags`:

```ts
const score = await this.kpiQuoteScore.scoreForVersion(vid);
const flags = { ...await this.loadFlags(version, query), kpi_contract_block: score.blockSubmit, kpi_contract_score: score.score };
if (score.blockSubmit) bad('kpi_contract_blocked');
```

`bad('kpi_contract_blocked')` body: `{ error: 'kpi_contract_blocked', score, required_reviewers, hint: 'Phương án B hoặc waiver Finance+GDKD+Strategy' }`.  
Snapshot approval **gồm** `kpi_contract_score` nhưng **không** đưa field này vào public proposal serializer.

- [ ] **Step 1: Test `evaluateQuotePolicy` thêm trigger `kpi_contract` khi flag true**

- [ ] **Step 2: Test `submitApproval` throws `kpi_contract_blocked` khi score.blockSubmit** (mock `scoreForVersion`)

- [ ] **Step 3: Implement + PASS**

- [ ] **Step 4: Commit** `feat(quote): block submit when KPI contract score and GM fail`

---

### Task 9: ops-web API client + replace iframe Templates

**Files:**
- Create: `services/ops-web/src/lib/service-kpi-types.ts`
- Create: `services/ops-web/src/lib/service-kpi-api.ts` (copy `kpiHubFetch` pattern từ `kpi-hub-api.ts`)
- Create: `services/ops-web/src/hooks/useServiceKpiTemplates.ts`
- Create: `services/ops-web/src/components/kpi-hub/service-kpi/ServiceKpiTemplateTable.tsx`
- Create: `services/ops-web/src/components/kpi-hub/service-kpi/ServiceKpiTemplateDrawer.tsx`
- Modify: `services/ops-web/src/app/crm/kpi-hub/service-templates/page.tsx` — bỏ `ServiceKpiMockupFrame`
- Test: `services/ops-web/src/lib/service-kpi-api.spec.ts` (mock fetch) hoặc component vitest list empty/error
- Modify: `services/ops-web/e2e/kpi-hub-dictionary-layout.spec.ts` **chỉ nếu** sidebar count assertion — thêm expect link War Room / Template

**Client:**

```ts
export function fetchServiceKpiTemplates(token: string, q?: { dv_code?: string; status?: string })
export function createServiceKpiTemplate(token: string, body: CreateTemplateBody)
export function submitServiceKpiTemplateVersion(token: string, versionId: string)
```

UI list cột đúng mockup SKPI-01: Service/Template, DV · bundle, Required, Client visible, Owner, Version, Status, Cấu hình.  
Empty: “Chưa có template — tạo từ Portfolio 21 DV”.  
Nút `+ Tạo Template` mở drawer (DV select DV01–21, KPI từ Dictionary Active — `fetchKpiHubDictionary`).

- [ ] **Step 1: Vitest** table render 1 row `Meta Ads Performance` + badge `In Review`

- [ ] **Step 2: Implement table/drawer/page**

- [ ] **Step 3:** `cd services/ops-web && npm run test:unit -- src/components/kpi-hub/service-kpi`

- [ ] **Step 4: Commit** `feat(ops-web): replace Service KPI template iframe with live table`

---

### Task 10: Template builder + Policy Pack page (Wave 1 UI)

**Files:**
- Create: `services/ops-web/src/components/kpi-hub/service-kpi/ServiceKpiTemplateBuilder.tsx` (groups Deliverable / Performance / Forecast như SKPI-02)
- Modify: `services/ops-web/src/app/crm/kpi-hub/policy-packs/page.tsx` — list pack BĐS + banned phrases (GET API)
- Modify: `services/ops-web/src/app/crm/kpi-hub/kpi-contracts/page.tsx` — tạm fixture QT-0089 score 19/block cho đến Wave 2 instances; vẫn **không iframe** (card + công thức, copy mockup SKPI-09)

- [ ] **Step 1: Builder** gọi `validateReadiness` phía server khi Submit review; hiện field-level errors

- [ ] **Step 2: Policy pack page** đọc `GET /policy-packs/real_estate`

- [ ] **Step 3: Commit** `feat(ops-web): add template builder and policy pack screen`

**Wave 1 done khi:** template CRUD trên UI, pack BĐS chặn submit review, quote submit block AC-06 (API). Menu AC-SKPI-05 đã có từ trước.

---

### Task 11: Inherit template → Quote line (AC-SKPI-02)

**Files:**
- Create: `services/ptt-crm-api/src/kpi-hub/service-kpi/service-kpi-instances.service.ts`
- Modify: chỗ Account thêm DV vào quote (tìm `createQtCatalogService` / quote line insert trong `services/ptt-crm-api/src/proposals/`) — gọi `instances.syncFromCatalog({ source_type: 'quote_line_item', source_id, dv_code })`
- Test: `service-kpi-instances.service.spec.ts`

**Interfaces:**

```ts
syncFromCatalog(input: { sourceType: 'quote_line_item'; sourceId: string; dvCode: string }): Promise<{ created: number; template_version_id: string | null }>
// Clone ACTIVE template version rules → instances DRAFT
// If no active template: created=0, no throw
```

Quy tắc AC-02: instance lưu `template_version_id` tại thời điểm clone. Activate template v5 **không** `UPDATE` instance đã có.

- [ ] **Step 1: Test** create v4 instances; activate v5; instances vẫn `template_version_id === v4`

- [ ] **Step 2: Implement + hook quote line add**

- [ ] **Step 3: Commit** `feat(service-kpi): inherit active template into quote line items`

---

### Task 12: Instances API + page (SKPI-03)

**Files:**
- Extend controller: `GET/POST /api/crm/kpi-hub/instances`, `PATCH /instances/:id` (If-Match), `POST /instances/:id/validate-readiness`
- Create: `services/ops-web/src/components/kpi-hub/service-kpi/ServiceKpiInstanceTable.tsx`
- Modify: `services/ops-web/src/app/crm/kpi-hub/instances/page.tsx`

Cột mockup: KPI/Source, Classification badge, Target/Scenario, Actual, Variance, Readiness, Owner, Status.

- [ ] **Step 1–4:** TDD list filter `status=AT_RISK`, PATCH optimistic lock 409, replace iframe, commit `feat(service-kpi): add KPI instances API and table`

---

### Task 13: Measurement Plan + Actual ingest (SKPI-05/06, AC-03/04)

**Files:**
- Create: `service-kpi-operations.service.ts`
- Controller: `POST /instances/:id/measurement-plan`, `POST /instances/:id/actuals`, `POST /instances/:id/actuals/import`
- UI: replace iframe measurement + tracking pages

`actuals` body: `{ period_start, period_end, value, source_ref, quality_status?, collection_method? }`.  
Nếu `detectDuplicateActual` → `409 { error: 'ACTUAL_DUPLICATE', actions: ['skip','merge','correction'] }`.  
`correction` insert row mới + set `superseded_by` trên verified cũ (không silent overwrite).  
Measurement readiness: mapping trống → `warning` (AC-03).

- [ ] **Step 1–4:** tests duplicate + zero-den; UI chart có thể fixture bars; commit `feat(service-kpi): add measurement plans and actual ingest`

---

### Task 14: Snapshots + Reconcile 3 sổ (SKPI-10, AC-07)

**Files:**
- `instances.snapshotQuoted(quoteVersionId)` khi `submitApproval` **sau** score pass (và lại khi accept)
- `GET /api/crm/kpi-hub/reconcile?source_id=`
- Page `reconcile/page.tsx` — bảng Quoted | Delivered | Reported | Quality | Hành vi
- Public proposal serializer: chỉ rows `ledger=reported` OR (nếu chưa có reported) quoted **và** `client_visible` **và** `canPublishClientReport`

- [ ] **Step 1: Test** pending actual → reconcile `Reported=Blocked`

- [ ] **Step 2: Test** public payload không chứa `INTERNAL_OPERATIONAL`, `score`, `gm_bps`

- [ ] **Step 3: Commit** `feat(service-kpi): add quoted/delivered/reported ledgers`

---

### Task 15: War Room (SKPI-00, FR-013)

**Files:**
- `GET /api/crm/kpi-hub/service-kpi/war-room`
- `ServiceKpiWarRoom.tsx` + `service-kpi/page.tsx`

Response:

```ts
{
  critical_overdue: number;
  assumptions_open: number;
  blocked_reports: number;
  quotes_score_gte_70: number;
  queue: Array<{ title: string; subtitle: string; href: string; badge: string }>;
  dv_health: Array<{ dv_code: string; kpi_health_pct: number; gm_pct: number | null }>;
}
```

Queue rules: assumption `not_met`; alert overdue (tái `KpiHubAlertsService` nếu có, else instance `AT_RISK`); actual pending chặn report; quotes từ approval snapshot `kpi_contract_score >= 70` hoặc `kpi_contract_blocked`.  
`gm_pct` trên `dv_health` **ẩn** nếu caller không có `crm_quote.finance`.

- [ ] **Step 1–4:** unit builder thuần `buildWarRoom(input)` + page; commit `feat(service-kpi): add War Room operating queue`

---

### Task 16: Assumption confirmation (FR-015)

**Files:**
- PATCH instance `{ assumption_state: 'confirmed' | 'not_met', evidence?: string }`
- Nếu `not_met` + required → status `AT_RISK`; War Room đếm `assumptions_open`
- Portal/client: Wave 2 chỉ Account ghi nhận (SRS cho phép). Endpoint client sau Wave 3.

- [ ] **Step 1:** test `not_met` → `AT_RISK`

- [ ] **Step 2: Commit** `feat(service-kpi): add assumption confirmation states`

---

### Task 17: Quote Builder KPI section + Proposal wording (FR-007)

**Files:**
- Quote OS builder tab KPI (file hiện có quanh `services/ops-web/src/components/crm/qt/` hoặc quote builder) — section “KPI & Hiệu quả” per line, badge 3 lớp như BLD-04
- Proposal public: label Cam kết / Mục tiêu tối ưu / Kết quả dự kiến; cấm copy banned phrase (gọi `evaluatePolicyPack` lúc publish)

- [ ] **Step 1:** publish proposal với “cam kết doanh số” + industry real_estate → 400

- [ ] **Step 2: Commit** `feat(quote): render classified KPIs and block banned BĐS wording`

---

### Task 18: Project inherit + alerts (FR-008)

**Files:**
- On quote accepted → `instances.cloneTo({ source_type: 'project', source_id, parent ids })` status `TRACKING`, measurement plan draft
- Hook existing `KpiHubAlertEngineService` hoặc insert corrective placeholder khi variance critical (CPL > max 25%)

- [ ] **Step 1:** test accepted quote tạo instance TRACKING cùng `template_version_id`

- [ ] **Step 2: Commit** `feat(service-kpi): inherit KPI instances onto accepted projects`

---

### Task 19: Wave 3 — benchmark feedback (FR-016)

**Files:**
- Table `crm_service_kpi_benchmarks` (dv_code, industry, channel, budget_band, p50, p80, n)
- Job đóng project: aggregate actual vs quoted → upsert band
- Quote Builder hiện “P50 CPL BĐS Meta 80–150tr = X”

- [ ] **Step 1:** test p50 từ `[100, 120, 80]` = `100`

- [ ] **Step 2: Commit** `feat(service-kpi): write internal benchmark bands on project close`

---

### Task 20: Playwright + deploy

**Files:**
- Create: `services/ops-web/e2e/service-kpi-hub.spec.ts`
- Create: `scripts/deploy_service_kpi_vps.sh` (DDL + restart `ptt-crm-api` + `ops-web`, copy pattern `deploy_kpi_hub_vps.sh`)
- Modify: `scripts/deploy_kpi_hub_vps.sh` hoặc quotation deploy — gọi apply service-kpi DDL

E2E (login fixture hiện có):

1. `/crm/kpi-hub` sidebar có nhóm SERVICE KPI + War Room.
2. `/crm/kpi-hub/service-templates` không iframe (`iframe` count 0), có heading.
3. `/crm/kpi-hub/policy-packs` hiện “Bất động sản” + “cam kết doanh số”.
4. `/crm/kpi-hub/reconcile` có cột Quoted / Delivered / Reported.

```bash
cd services/ops-web && npx playwright test e2e/service-kpi-hub.spec.ts
```

- [ ] **Step 1: Write e2e + run**

- [ ] **Step 2: Deploy script + commit** `feat(service-kpi): add e2e and VPS deploy hook`

---

## Spec coverage

| SRS / AC | Task |
|---|---|
| FR-001 Template list | 6, 7, 9 |
| FR-002 Template builder + version | 6, 10 |
| FR-003 Instances | 12 |
| FR-004 Measurement | 13 |
| FR-005 Actual | 5, 13 |
| FR-006 Readiness | 3, 6 |
| FR-007 Quote/Proposal | 11, 17 |
| FR-008 Project inherit | 18 |
| FR-009 Alert | 15, 18 |
| FR-010 Approval workflow | 8 |
| FR-011 Contract Score | 4, 8, 10 |
| FR-012 3 sổ | 5, 14 |
| FR-013 War Room | 15 |
| FR-014 Policy Pack | 2, 7, 10, 17 |
| FR-015 Assumption | 16 |
| FR-016 Benchmark | 19 |
| AC-01 disclaimer | 3, 6 |
| AC-02 inherit snapshot | 11 |
| AC-03 measurement warning | 13 |
| AC-04 duplicate actual | 5, 13 |
| AC-05 menu | đã có + 20 |
| AC-06 Score+GM | 4, 8 |
| AC-07 Unverified report | 5, 14 |
| AC-08 Pack BĐS | 2, 17 |
| Menu mockup SKPI-00…12 | 9–16 |
| NFR public leak | 8, 14 |
| Phase 3 connectors TikTok/Zalo | **ngoài plan này** — Hub connector registry đã có Meta/CRM; mở rộng riêng |

## Tự rà

- Không còn “TBD” / “implement later”.
- Tên hàm thống nhất: `evaluateKpiContractScore`, `validateReadiness`, `evaluatePolicyPack`, `canPublishClientReport`, `detectDuplicateActual`, `syncFromCatalog`.
- API thật `/api/crm/kpi-hub/...`.
- Wave 1 ship được trước khi Wave 2.

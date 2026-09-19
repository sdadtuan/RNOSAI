# PTT Ops AI Tools P3 — Draft Write Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist `marketing_plan.write_draft` and `task.create_draft` to CRM after human approval (`wired:true`, `phase:P3`), replacing P1 stubs.

**Architecture:** New `OpsDraftWriteService` uses `OpsCrmContextRepository` (P2 resolve + new write helpers). Tool handlers keep `assertHumanApproved` then call the write service. Never promote plan to `active`; live plans require `clone_to_draft`.

**Tech Stack:** NestJS + `pg` Pool, Vitest/Jest unit tests (match `ptt-crm-api` existing pattern), ops-web Try tool (checkbox already wired).

**Spec:** [`docs/superpowers/specs/2026-09-19-ptt-ops-ai-tools-p3-draft-write-design.md`](../specs/2026-09-19-ptt-ops-ai-tools-p3-draft-write-design.md)

## Global Constraints

- Human approval required: `X-AI-Human-Approved: 1|true|yes|on` → `context.humanApproved`
- Editable plan statuses for PATCH: `draft`, `review` only
- Live plan without `clone_to_draft` → HTTP 409 `plan_not_editable`
- Tool never sets plan status to `active`
- Task stage = lifecycle.stage if in `VALID_STAGES`, else fallback `deliver`
- Task missing lifecycle → 400 `lifecycle_required` (no orphans)
- Title prefix `[AI draft]` idempotent; `form_data.ai_draft=true` + audit fields
- Response contract: `entity_ids` + `links` (primary); optional top-level id aliases OK
- No idempotency key on plan INSERT — caller must reuse returned `plan_id`
- Deferred P3.1: owner / due (PO-41) — do not implement
- Post-ship: extend agent policy + API key allowlists with both write tools

## File map

| File | Responsibility |
|------|----------------|
| `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-draft-write.types.ts` | Result + input helpers |
| `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-crm-context.repository.ts` | Write helpers: patch/insert/clone plan, insert AI task |
| `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-draft-write.service.ts` | Branching + validation + audit |
| `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-draft-write.service.spec.ts` | Unit tests (mocked repo) |
| `services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/ops-context.tools.ts` | Wire write handlers; drop stub |
| `services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/ops-context.tools.spec.ts` | Approval + write service call |
| `services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts` | Inject `OpsDraftWriteService` into `createOpsContextTools` |
| `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.module.ts` | Provide write service |
| `services/ops-web/src/app/admin/ai/policies/new/page.tsx` | Already lists write tools — verify only |
| VPS policies / API keys | Post-ship allowlist update (Task 5) |

---

### Task 1: Repository write helpers (TDD)

**Files:**
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-crm-context.repository.ts`
- Create: `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-crm-context.repository.write.spec.ts` (or extend existing repo spec if present)

**Interfaces:**
- Produces:
  - `patchPlanDraft(planId, fields): Promise<OpsPlanRow | null>`
  - `insertPlanDraft(fields): Promise<OpsPlanRow>`
  - `clonePlanToDraft(sourcePlanId, overlay): Promise<OpsPlanRow>`
  - `insertAiDraftTask(args): Promise<{ id: number; lifecycle_id: number; title: string; stage: string }>`
  - Extend `getPlan` SELECT if needed: also return `objectives`, `notes`, `strategy_framework_json` for clone/audit (or dedicated `getPlanForWrite`)

- [ ] **Step 1: Write failing tests for insert/patch/clone/task**

```typescript
// ops-crm-context.repository.write.spec.ts
describe('OpsCrmContextRepository writes', () => {
  it('insertPlanDraft inserts status=draft and returns id', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // INSERT RETURNING
      .mockResolvedValueOnce({
        rows: [{
          id: 99, name: 'AI Draft', status: 'draft', period_label: 'Q4',
          lifecycle_id: 5, success_metrics_json: [],
        }],
      });
    const repo = new OpsCrmContextRepository({ databaseUrl: 'x' } as never);
    (repo as any).pool = { query };
    const row = await repo.insertPlanDraft({
      name: 'AI Draft',
      period_label: 'Q4',
      objectives: 'obj',
      notes: 'n',
      lifecycle_id: 5,
      strategy_framework_json: { ai_draft: { source_tool: 'marketing_plan.write_draft' } },
    });
    expect(row.id).toBe(99);
    expect(row.status).toBe('draft');
    expect(String(query.mock.calls[0][0])).toContain('INSERT INTO crm_marketing_plans');
    expect(query.mock.calls[0][1]).toEqual(expect.arrayContaining(['draft']));
  });

  it('insertAiDraftTask sets is_custom and form_data.ai_draft', async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ id: 7 }] });
    const repo = new OpsCrmContextRepository({ databaseUrl: 'x' } as never);
    (repo as any).pool = { query };
    const task = await repo.insertAiDraftTask({
      lifecycle_id: 5,
      stage: 'deliver',
      title: '[AI draft] Kickoff',
      description: 'AC',
      form_data: { ai_draft: true, ai_approved_by: 'ai-tool', ai_approved_at: '2026-09-19T00:00:00.000Z' },
    });
    expect(task.id).toBe(7);
    expect(String(query.mock.calls[0][0])).toContain('INSERT INTO crm_svc_tasks');
    expect(query.mock.calls[0][1]).toEqual(
      expect.arrayContaining([5, 'deliver', '[AI draft] Kickoff', true]),
    );
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (methods missing)**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-crm-context.repository.write' --no-coverage
```

Expected: FAIL — `insertPlanDraft is not a function` (or similar)

- [ ] **Step 3: Implement write helpers**

Add to `ops-crm-context.repository.ts` (sketch):

```typescript
async insertPlanDraft(input: {
  name: string;
  period_label?: string;
  objectives?: string;
  notes?: string;
  lifecycle_id?: number | null;
  strategy_framework_json?: Record<string, unknown>;
}): Promise<OpsPlanRow> {
  const code = `AI-DRAFT-${Date.now()}`;
  const sf = JSON.stringify(input.strategy_framework_json ?? {});
  const r = await this.db.query(
    `INSERT INTO crm_marketing_plans (
       code, name, status, plan_kind, lifecycle_id, period_label, objectives, notes,
       strategy_framework_json, target_market_prof_json, target_market_steps4_json,
       created_at, updated_at
     ) VALUES (
       $1, $2, 'draft', 'standalone', $3, $4, $5, $6,
       $7::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), NOW()
     ) RETURNING id`,
    [
      code,
      input.name.slice(0, 400),
      input.lifecycle_id ?? null,
      (input.period_label ?? '').slice(0, 120),
      (input.objectives ?? '').slice(0, 32000),
      (input.notes ?? '').slice(0, 32000),
      sf,
    ],
  );
  const plan = await this.getPlan(Number(r.rows[0].id));
  if (!plan) throw new Error('insertPlanDraft failed');
  return plan;
}

async patchPlanDraft(
  planId: number,
  fields: {
    name?: string;
    period_label?: string;
    objectives?: string;
    notes?: string;
    strategy_framework_json?: Record<string, unknown>;
  },
): Promise<OpsPlanRow | null> {
  // Dynamic SET for provided fields only; NEVER set status
  // If strategy_framework_json provided: merge ai_draft into existing jsonb
  ...
  return this.getPlan(planId);
}

async clonePlanToDraft(
  sourceId: number,
  overlay: { name?: string; period_label?: string; objectives?: string; notes?: string; strategy_framework_json?: Record<string, unknown> },
): Promise<OpsPlanRow> {
  // SELECT full row FROM source; INSERT with status='draft' always;
  // lifecycle_id from source; overlay name/period/objectives/notes
  ...
}

async insertAiDraftTask(input: {
  lifecycle_id: number;
  stage: string;
  title: string;
  description: string;
  form_data: Record<string, unknown>;
}): Promise<{ id: number; lifecycle_id: number; title: string; stage: string }> {
  const r = await this.db.query(
    `INSERT INTO crm_svc_tasks (
       lifecycle_id, stage, step_index, title, description,
       form_fields, form_data, ai_prompt_key, ai_output, is_done, notes, is_custom,
       created_at, updated_at
     ) VALUES (
       $1, $2, 999, $3, $4,
       '[]'::jsonb, $5::jsonb, '', '', FALSE, '', TRUE,
       NOW(), NOW()
     ) RETURNING id`,
    [
      input.lifecycle_id,
      input.stage,
      input.title.slice(0, 400),
      input.description.slice(0, 4000),
      JSON.stringify(input.form_data),
    ],
  );
  return {
    id: Number(r.rows[0].id),
    lifecycle_id: input.lifecycle_id,
    title: input.title,
    stage: input.stage,
  };
}
```

Also add `getPlanForWrite(id)` if clone needs `objectives`/`notes`/`strategy_framework_json` beyond current `OpsPlanRow`.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-crm-context.repository.write' --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-crm-context.repository.ts \
  services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-crm-context.repository.write.spec.ts
git commit -m "$(cat <<'EOF'
feat(ai-tools): add CrmContext repo helpers for P3 draft writes

EOF
)"
```

---

### Task 2: OpsDraftWriteService (TDD)

**Files:**
- Create: `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-draft-write.types.ts`
- Create: `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-draft-write.service.ts`
- Create: `services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-draft-write.service.spec.ts`

**Interfaces:**
- Consumes: repository methods from Task 1 + existing `getPlan` / `getLifecycle` / `getProject` / `findPrimaryLifecycleByClient` / `findPlanByLifecycle`
- Produces:
  - `writeMarketingPlanDraft(input, meta): Promise<OpsDraftWriteResult>`
  - `createTaskDraft(input, meta): Promise<OpsDraftWriteResult>`
  - `OpsDraftWriteResult = { ok, wired: true, phase: 'P3', status: 'persisted', tool, requires_human_approval: true, human_approved: true, entity_ids, links }`

- [ ] **Step 1: Write failing service tests**

```typescript
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OpsDraftWriteService } from './ops-draft-write.service';

describe('OpsDraftWriteService', () => {
  const repo = {
    getPlan: jest.fn(),
    getLifecycle: jest.fn(),
    getProject: jest.fn(),
    findPrimaryLifecycleByClient: jest.fn(),
    findPlanByLifecycle: jest.fn(),
    insertPlanDraft: jest.fn(),
    patchPlanDraft: jest.fn(),
    clonePlanToDraft: jest.fn(),
    insertAiDraftTask: jest.fn(),
  };
  const meta = { actor: 'test-key', approvedAt: '2026-09-19T12:00:00.000Z' };
  let svc: OpsDraftWriteService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OpsDraftWriteService(repo as never);
  });

  it('patches draft plan without changing status', async () => {
    repo.getPlan.mockResolvedValue({
      id: 10, name: 'Old', status: 'draft', period_label: '', lifecycle_id: 5,
    });
    repo.patchPlanDraft.mockResolvedValue({
      id: 10, name: 'New', status: 'draft', period_label: 'Q4', lifecycle_id: 5,
    });
    const out = await svc.writeMarketingPlanDraft(
      { plan_id: 10, title: 'New', period: 'Q4', status: 'active' },
      meta,
    );
    expect(out.phase).toBe('P3');
    expect(out.entity_ids).toEqual({ plan_id: 10 });
    expect(out.links).toEqual(['/crm/marketing-plan/10']);
    expect(repo.patchPlanDraft).toHaveBeenCalledWith(
      10,
      expect.not.objectContaining({ status: 'active' }),
    );
  });

  it('409 when live plan without clone_to_draft', async () => {
    repo.getPlan.mockResolvedValue({
      id: 8, name: 'Live', status: 'active', period_label: '', lifecycle_id: 5,
    });
    await expect(
      svc.writeMarketingPlanDraft({ plan_id: 8, title: 'X' }, meta),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('clones live plan to draft when clone_to_draft=true', async () => {
    repo.getPlan.mockResolvedValue({
      id: 8, name: 'Live', status: 'active', period_label: 'Q3', lifecycle_id: 5,
    });
    repo.clonePlanToDraft.mockResolvedValue({
      id: 20, name: 'Live (draft)', status: 'draft', period_label: 'Q3', lifecycle_id: 5,
    });
    const out = await svc.writeMarketingPlanDraft(
      { plan_id: 8, clone_to_draft: true },
      meta,
    );
    expect(out.entity_ids.plan_id).toBe(20);
    expect(repo.clonePlanToDraft).toHaveBeenCalled();
  });

  it('inserts draft when no plan_id', async () => {
    repo.insertPlanDraft.mockResolvedValue({
      id: 30, name: 'Fresh', status: 'draft', period_label: '', lifecycle_id: null,
    });
    const out = await svc.writeMarketingPlanDraft({ title: 'Fresh' }, meta);
    expect(out.entity_ids.plan_id).toBe(30);
  });

  it('400 title_required when insert without name', async () => {
    await expect(svc.writeMarketingPlanDraft({}, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates AI draft task on resolved lifecycle stage', async () => {
    repo.getLifecycle.mockResolvedValue({
      id: 5, stage: 'onboard', status: 'active', marketing_plan_id: 8, agency_client_id: null,
    });
    repo.insertAiDraftTask.mockResolvedValue({
      id: 42, lifecycle_id: 5, title: '[AI draft] Kickoff', stage: 'onboard',
    });
    const out = await svc.createTaskDraft(
      { lifecycle_id: 5, title: 'Kickoff', acceptance_criteria: 'Done when…' },
      meta,
    );
    expect(out.entity_ids).toEqual({ task_id: 42, lifecycle_id: 5 });
    expect(out.links).toEqual(['/crm/service-delivery/5']);
    expect(repo.insertAiDraftTask).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'onboard',
        title: '[AI draft] Kickoff',
        form_data: expect.objectContaining({ ai_draft: true }),
      }),
    );
  });

  it('400 lifecycle_required when unresolved', async () => {
    await expect(
      svc.createTaskDraft({ title: 'X' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('falls back stage to deliver when lifecycle stage invalid', async () => {
    repo.getLifecycle.mockResolvedValue({
      id: 5, stage: 'weird', status: 'active', marketing_plan_id: null, agency_client_id: null,
    });
    repo.insertAiDraftTask.mockResolvedValue({
      id: 1, lifecycle_id: 5, title: '[AI draft] T', stage: 'deliver',
    });
    await svc.createTaskDraft({ lifecycle_id: 5, title: 'T' }, meta);
    expect(repo.insertAiDraftTask.mock.calls[0][0].stage).toBe('deliver');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-draft-write.service.spec' --no-coverage
```

- [ ] **Step 3: Implement service**

```typescript
// ops-draft-write.types.ts
export type OpsDraftWriteMeta = { actor: string; approvedAt: string };
export type OpsDraftWriteResult = {
  ok: true;
  wired: true;
  phase: 'P3';
  status: 'persisted';
  tool: string;
  requires_human_approval: true;
  human_approved: true;
  entity_ids: Record<string, number | string>;
  links: string[];
};

// ops-draft-write.service.ts — key branches
const EDITABLE = new Set(['draft', 'review']);
const AI_PREFIX = '[AI draft] ';

@Injectable()
export class OpsDraftWriteService {
  constructor(private readonly repo: OpsCrmContextRepository) {}

  async writeMarketingPlanDraft(
    input: Record<string, unknown>,
    meta: OpsDraftWriteMeta,
  ): Promise<OpsDraftWriteResult> {
    const planId = positiveInt(input.plan_id ?? input.planId);
    const clone = Boolean(input.clone_to_draft ?? input.cloneToDraft);
    const name = String(input.title ?? input.name ?? '').trim();
    // resolve optional lifecycle for insert…
    if (planId != null) {
      const plan = await this.repo.getPlan(planId);
      if (!plan) throw new NotFoundException({ error: 'plan_not_found', plan_id: planId });
      if (EDITABLE.has(plan.status)) {
        const updated = await this.repo.patchPlanDraft(planId, {
          ...(name ? { name } : {}),
          period_label: str(input.period ?? input.period_label),
          objectives: str(input.objectives),
          notes: appendAuditNote(str(input.notes) ?? plan /* need notes from getPlanForWrite */, meta),
          strategy_framework_json: { ai_draft: auditBlock(meta, 'marketing_plan.write_draft') },
        });
        return this.planResult(updated!.id);
      }
      if (!clone) {
        throw new ConflictException({
          error: 'plan_not_editable',
          plan_id: planId,
          status: plan.status,
        });
      }
      const cloned = await this.repo.clonePlanToDraft(planId, {
        name: name || undefined,
        period_label: str(input.period ?? input.period_label),
        objectives: str(input.objectives),
        notes: str(input.notes),
        strategy_framework_json: { ai_draft: auditBlock(meta, 'marketing_plan.write_draft') },
      });
      return this.planResult(cloned.id);
    }
    if (!name) throw new BadRequestException({ error: 'title_required' });
    const lifecycleId = await this.resolveLifecycleId(input);
    const created = await this.repo.insertPlanDraft({
      name,
      period_label: str(input.period ?? input.period_label) ?? '',
      objectives: str(input.objectives) ?? '',
      notes: appendAuditNote(str(input.notes) ?? '', meta),
      lifecycle_id: lifecycleId,
      strategy_framework_json: { ai_draft: auditBlock(meta, 'marketing_plan.write_draft') },
    });
    return this.planResult(created.id);
  }

  async createTaskDraft(
    input: Record<string, unknown>,
    meta: OpsDraftWriteMeta,
  ): Promise<OpsDraftWriteResult> {
    const titleRaw = String(input.title ?? '').trim();
    if (!titleRaw) throw new BadRequestException({ error: 'title_required' });
    const lifecycleId = await this.resolveLifecycleId(input);
    if (lifecycleId == null) {
      throw new BadRequestException({ error: 'lifecycle_required' });
    }
    const lc = await this.repo.getLifecycle(lifecycleId);
    if (!lc) throw new BadRequestException({ error: 'lifecycle_required' });
    const stage = isValidStage(lc.stage) ? lc.stage : 'deliver';
    const title = titleRaw.startsWith(AI_PREFIX) ? titleRaw : `${AI_PREFIX}${titleRaw}`;
    const task = await this.repo.insertAiDraftTask({
      lifecycle_id: lifecycleId,
      stage,
      title,
      description: String(input.acceptance_criteria ?? '').slice(0, 4000),
      form_data: {
        ai_draft: true,
        ai_approved_by: meta.actor,
        ai_approved_at: meta.approvedAt,
        ...(positiveInt(input.plan_id) ? { plan_id: positiveInt(input.plan_id) } : {}),
        ...(input.campaign_id != null ? { campaign_id: input.campaign_id } : {}),
      },
    });
    return {
      ok: true,
      wired: true,
      phase: 'P3',
      status: 'persisted',
      tool: 'task.create_draft',
      requires_human_approval: true,
      human_approved: true,
      entity_ids: { task_id: task.id, lifecycle_id: lifecycleId },
      links: [`/crm/service-delivery/${lifecycleId}`],
    };
  }

  private planResult(planId: number): OpsDraftWriteResult {
    return {
      ok: true,
      wired: true,
      phase: 'P3',
      status: 'persisted',
      tool: 'marketing_plan.write_draft',
      requires_human_approval: true,
      human_approved: true,
      entity_ids: { plan_id: planId },
      links: [`/crm/marketing-plan/${planId}`],
    };
  }

  private async resolveLifecycleId(input: Record<string, unknown>): Promise<number | null> {
    // Same order as OpsCrmContextService: lifecycle_id → plan → project → client primary
    ...
  }
}
```

Import `isValidStage` from `../../service-lifecycle/service-lifecycle.types` (or duplicate minimal check against `VALID_STAGES` to avoid circular deps — prefer direct import if module already allows).

- [ ] **Step 4: Run — expect PASS**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-draft-write.service.spec' --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/ai-intelligence/ai-tools/ops-draft-write.*
git commit -m "$(cat <<'EOF'
feat(ai-tools): OpsDraftWriteService for P3 plan/task drafts

EOF
)"
```

---

### Task 3: Wire tools + module

**Files:**
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/ops-context.tools.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-tools/tools/ops-context.tools.spec.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.module.ts`
- Modify: `services/ptt-crm-api/src/ai-intelligence/ai-tools/tool.registry.spec.ts` (constructor arity if needed)

**Interfaces:**
- Consumes: `OpsDraftWriteService.writeMarketingPlanDraft` / `createTaskDraft`
- Produces: `createOpsContextTools(context, draftWrite)` signature change

- [ ] **Step 1: Update tools spec to expect write service (failing)**

```typescript
const draftWrite = {
  writeMarketingPlanDraft: jest.fn(async () => ({
    ok: true, wired: true, phase: 'P3', status: 'persisted',
    tool: 'marketing_plan.write_draft', requires_human_approval: true,
    human_approved: true, entity_ids: { plan_id: 1 }, links: ['/crm/marketing-plan/1'],
  })),
  createTaskDraft: jest.fn(async () => ({
    ok: true, wired: true, phase: 'P3', status: 'persisted',
    tool: 'task.create_draft', requires_human_approval: true,
    human_approved: true, entity_ids: { task_id: 2, lifecycle_id: 5 },
    links: ['/crm/service-delivery/5'],
  })),
};
const tools = createOpsContextTools(context, draftWrite as never);

it('write draft persists when human approved', async () => {
  const tool = byName.get('marketing_plan.write_draft')!;
  const out = await tool.handler(
    { title: 'Q4' },
    { apiKeyId: 'k', clientId: null, actorId: 'a', correlationId: 'r', humanApproved: true },
  );
  expect(draftWrite.writeMarketingPlanDraft).toHaveBeenCalled();
  expect(out).toMatchObject({ wired: true, phase: 'P3', status: 'persisted' });
});
```

Remove expectation that stub returns `draft_accepted_pending_persist`.

- [ ] **Step 2: Run — expect FAIL** (arity / stub still returned)

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-context.tools.spec' --no-coverage
```

- [ ] **Step 3: Implement wiring**

```typescript
// ops-context.tools.ts
export function createOpsContextTools(
  context: OpsCrmContextService,
  draftWrite: OpsDraftWriteService,
): AiToolDefinition[] {
  // … reads unchanged …
  {
    name: 'marketing_plan.write_draft',
    // …
    handler: async (input, ctx) => {
      assertHumanApprovedForWrite('marketing_plan.write_draft', ctx);
      return draftWrite.writeMarketingPlanDraft(input, {
        actor: String(ctx.actorId ?? ctx.apiKeyId ?? 'ai-tool'),
        approvedAt: new Date().toISOString(),
      });
    },
  },
  {
    name: 'task.create_draft',
    handler: async (input, ctx) => {
      assertHumanApprovedForWrite('task.create_draft', ctx);
      return draftWrite.createTaskDraft(input, {
        actor: String(ctx.actorId ?? ctx.apiKeyId ?? 'ai-tool'),
        approvedAt: new Date().toISOString(),
      });
    },
  },
}
```

Delete `draftResult()` helper.

```typescript
// tool.registry.ts constructor
constructor(
  …
  opsContext: OpsCrmContextService,
  draftWrite: OpsDraftWriteService,
) {
  this.definitions = [
    …
    ...createOpsContextTools(opsContext, draftWrite),
  ];
}
```

```typescript
// ai-intelligence.module.ts
providers: [
  …
  OpsDraftWriteService,
  …
]
```

- [ ] **Step 4: Run unit suite for ai-tools ops**

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-context.tools.spec|ops-draft-write|tool.registry.spec' --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ptt-crm-api/src/ai-intelligence/ai-tools \
  services/ptt-crm-api/src/ai-intelligence/ai-intelligence.module.ts
git commit -m "$(cat <<'EOF'
feat(ai-tools): wire P3 draft write tools to OpsDraftWriteService

EOF
)"
```

---

### Task 4: Optional Try UI sample + preset sanity

**Files:**
- Modify (optional): `services/ops-web/src/components/ai/AiToolKeysPanel.tsx` — when selecting a mutating tool, suggest sample JSON (write) without removing read defaults
- Verify: `services/ops-web/src/app/admin/ai/policies/new/page.tsx` already includes write tools in `OPS_TOOL_ALLOWLIST`

- [ ] **Step 1: If changing Try UI, add helper text under checkbox**

e.g. “Write tools cần Human approved; INSERT plan không `plan_id` → reuse `entity_ids.plan_id` khi retry.”

- [ ] **Step 2: No new unit test required if copy-only; otherwise keep existing panel tests green**

```bash
cd services/ops-web && npm run test:unit -- --testPathPattern='AiTool' 2>/dev/null || true
```

- [ ] **Step 3: Commit only if files changed**

```bash
git add services/ops-web/src/components/ai/AiToolKeysPanel.tsx
git commit -m "$(cat <<'EOF'
docs(ops-web): note P3 write retry + human approval on Try tool

EOF
)"
```

---

### Task 5: Deploy API + VPS smoke + policy allowlist

**Files / ops:**
- Deploy `ptt-crm-api` (and ops-web if Task 4 changed)
- Update DB agent policies + active API keys allowlist

- [ ] **Step 1: Deploy API to VPS** (follow repo deploy script used for P2, e.g. rebuild Nest + restart unit)

- [ ] **Step 2: Ensure ephemeral tool key allowlist includes write tools**

```sql
-- Example: extend existing smoke key or insert new key with:
-- ["marketing_plan.read","service_delivery.read","delivery_project.read","kpi_campaign.read",
--  "marketing_plan.write_draft","task.create_draft"]
```

Also upsert admin AI policy for `ptt-ops-strategist` / any `grok-bot-%` rows:

```sql
UPDATE admin_ai_policies
SET allowed_tools = allowed_tools || '["marketing_plan.write_draft","task.create_draft"]'::jsonb
WHERE agent_code IN ('ptt-ops-strategist')
   OR agent_code LIKE 'grok-bot%'
-- Adjust table/column names to match AdminIntelligenceRepository schema before running
```

(Inspect actual table via `\d` / repository before applying.)

- [ ] **Step 3: Smoke checklist**

```bash
# 403 without approval
curl -s -w "\nHTTP:%{http_code}\n" -X POST https://rs.pttads.vn/api/v1/ai/tools/call \
  -H "Content-Type: application/json" -H "X-AI-Tool-Key: $KEY" \
  -d '{"tool_name":"marketing_plan.write_draft","input":{"title":"P3 smoke"}}'
# expect HTTP 403 human_approval_required

# INSERT draft
curl -s -X POST https://rs.pttads.vn/api/v1/ai/tools/call \
  -H "Content-Type: application/json" -H "X-AI-Tool-Key: $KEY" \
  -H "X-AI-Human-Approved: 1" \
  -d '{"tool_name":"marketing_plan.write_draft","input":{"title":"P3 smoke draft","lifecycle_id":5}}'
# expect phase=P3, entity_ids.plan_id, status draft in DB

# 409 on plan 8 without clone
# clone_to_draft=true → new draft id
# task.create_draft lifecycle_id=5 → open_tasks via service_delivery.read
# task without lifecycle → 400
```

- [ ] **Step 4: Mark acceptance items in spec as verified; commit policy notes if scripted**

```bash
git add scripts/  # only if you add a small allowlist/smoke script
git commit -m "$(cat <<'EOF'
chore(ai-tools): P3 draft-write smoke + policy allowlist notes

EOF
)"
```

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Human approval gate | 3 (kept), 5 smoke |
| Patch draft/review | 2 |
| INSERT no plan_id | 2 |
| 409 live / clone_to_draft | 2 |
| Never promote active | 2 |
| Task hybrid C + stage enum | 1–2 |
| lifecycle_required | 2 |
| entity_ids + links | 2–3 |
| Audit ai_approved_* | 2 |
| Policy allowlist post-ship | 5 |
| Owner/due deferred P3.1 | Global Constraints (no task) |
| No plan INSERT idempotency | Global Constraints + Task 5 docs |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-19-ptt-ops-ai-tools-p3-draft-write.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session with executing-plans, checkpoints  

Which approach?

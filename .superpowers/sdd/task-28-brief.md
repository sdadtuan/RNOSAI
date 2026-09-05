# Task 28: Risk + Recovery (UI-AM-21/22, BR-020)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read:
- Plan Task 28, SRS BR-020: Critical requires open Recovery Plan except Director/admin override + reason
- Tables `crm_am_risks`, `crm_am_recovery_plans` (Task 23)
- `AmPlansService.create` — “care-plan skip” = creating a **care** plan while latest snapshot band is Critical and no open recovery
- 360 header **Tạo rủi ro** is disabled Wave 3 — enable
- Health center already counts open risks
- CLASS `AmRisksRepository` + `AmRisksService`
- Scope via ext + `amScopeSql`. Out-of-scope → 404

## Do not

- Nested `<main>`, new packages, KPI/CSD CSS
- Type-only Nest tokens
- Auto-close CSD
- Commit `.superpowers/` / `node_modules`

## APIs

```
GET    /api/crm/am/risks?agency_client_id&scope          view
POST   /api/crm/am/risks                                 edit
GET    /api/crm/am/recovery-plans?agency_client_id       view
POST   /api/crm/am/recovery-plans                        edit
POST   /api/crm/am/recovery-plans/:id/close              edit  { outcome, lesson }
```

### Risk POST

`{ agency_client_id, category, severity, probability?, impact?, evidence, owner_staff_id?, due_on? }`
- `evidence` required else 400
- `severity` in `low|medium|high|critical`
- Audit `risk.create`

### Recovery POST

`{ agency_client_id, risk_id?, goal, rca?, actions?: unknown[], exit_criteria? }`
- `goal` required
- `status=open`
- Audit `recovery.create`

### Close

- Trim `outcome` and `lesson` required else **400 `lesson_required`** (or `close_fields_required` if both missing — use **`lesson_required`** when lesson blank)
- Set `status=closed`, store outcome/lesson
- Closed already → 409 `already_closed`

### Critical gate (BR-020)

Helper `assertCriticalRecovery(agencyClientId, opts?: { override_reason?: string, manage?: boolean })`:

Latest snapshot **effective band** (override if until ≥ today ICT else `band`) is `critical` **AND** no `crm_am_recovery_plans` row `status='open'` for that client:

- `AmPlansService.create` with `kind==='care'` → **409 `recovery_required`** unless actor has `crm_am` `manage` **and** non-empty `override_reason` on the create body
- Optionally also block `AmAccountsService.patch` lifecycle to `active` without recovery — **required path is care-plan** per test

360 GET: add `recovery_required: boolean` (critical + no open plan). Banner on 360 + health detail when true.

## UI `AmRiskForm.tsx`

Drawer/modal: category, severity, P×I, evidence *, owner, due. Save → POST risk.
Optional “Tạo recovery” with goal * → POST plan.

360: enable Tạo rủi ro; banner if `recovery_required`.

Health detail: if `recovery_required`, blocking banner; link to create recovery.

## Tests (TDD)

1. Latest band Critical, no open recovery, `plans.create({ kind: 'care', ... })` → **409 `recovery_required`**; no plan INSERT
2. Close recovery without lesson → **400 `lesson_required`**; no status=closed UPDATE
3. Recommended: care plan succeeds when an open recovery exists

Vitest: banner copy helper.

```
cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-risks.service.spec.ts src/am/am-plans.service.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/am-risk.util.spec.ts
```

## Commit

`feat(am): add risk register and mandatory Critical recovery`

Report: `.superpowers/sdd/task-28-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT

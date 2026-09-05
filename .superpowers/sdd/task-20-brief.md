# Task 20: Renewal pipeline + case + Lost (UI-AM-11/12)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read:
- Plan Task 20
- SRS §6.8, UI-AM-11/12, Q19, BR-019, ACT-017
- Mockup `#page-renewals`, `#page-rc`, `#m-lost`
- DDL: `crm_am_renewal_cases` + unique `crm_am_renewal_open_uq` on `(tenant_id, contract_id) WHERE status NOT IN ('renewed','lost')`
- Contract join: `TRIM(COALESCE(ct.agency_client_id,'')) = e.agency_client_id::text`
- MRR: `monthlyRecurringVnd` — **media / media_spend / project / one_off never enter renewable / weighted / at-risk money**
- Hide amounts: same rule as Task 19 (`crm_am.finance` view or `crm_am` manage). When hidden, header money + card MRR are `null` / UI `—`
- Scope: `amScopeSql` on ext. Out-of-scope GET → 404
- CLASS `AmRenewalsRepository` + `AmRenewalWorker` — no type-only Nest tokens
- Copy actor/scope helpers from `am-contracts.service.ts` / `am-onboarding.service.ts`

## Do not

- Edit `crm_contracts.amount_vnd`
- Hard-code mockup 2,84 tỷ / 2,21 tỷ / 620 triệu
- Nested `<main>`, new npm packages, KPI/CSD CSS
- Implement proposal / log meeting / escalate CTAs (Wave 3/4 — hide or no-op)
- Commit `.superpowers/` or `node_modules`

## Files

**New API:** `am-renewals.service.ts` (+ spec), `am-renewal.worker.ts` (+ spec)  
**Edit:** `am.controller.ts`, `am.module.ts`  
**New UI:** `AmRenewalKanban.tsx`, `AmRenewalCase.tsx`  
**Replace:** `renewals/page.tsx`, `renewals/[id]/page.tsx`  
**Client:** `am-api.ts`, `am-renewal.util.ts` (+ vitest)

## Status / columns (lock)

| status | Cột |
|---|---|
| `not_started` | Chưa bắt đầu |
| `evaluating` | Đang đánh giá |
| `negotiating` | Đàm phán |
| `decided` · `renewed` · `lost` · `paused` | Đã quyết định |

Forecast: `committed` | `likely` | `risk` | `unlikely` (+ `forecast_pct` 0–100).  
Empty forecast/pct allowed while `not_started` only.

## APIs

```
GET    /api/crm/am/renewals?scope&window=90     view
GET    /api/crm/am/renewals/:id                 view
POST   /api/crm/am/renewals                     edit  { contract_id }
PATCH  /api/crm/am/renewals/:id                 edit
POST   /api/crm/am/renewals/window-job          manage  { as_of?: YYYY-MM-DD }  // calls worker; for tests + ops
```

`window` default 90. Include: contracts with `ends_on` in `[today ICT, today+window]` and status `active|renewing`, **or** an already-open case (not renewed/lost) whose contract is in that window. Always return existing cases in-window even if worker has not run.

### Pipeline payload

```
hide_amounts
header: { renewable_vnd, weighted_vnd, at_risk_vnd }  // nulls when hidden
columns: [{ id, label, count, mrr_vnd, items: Card[] }]
```

Card: `id, agency_client_id, name, owner_label, status, forecast, forecast_pct, next_action, mrr_vnd, days_remaining, score, band, ends_on, contract_id`

Money:
- `mrr_vnd` = `monthlyRecurringVnd` of the **contract** (null if hidden or non-recurring)
- `renewable_vnd` = Σ recurring MRR of cards (media excluded)
- `weighted_vnd` = Σ (mrr * forecast_pct/100) for cards with recurring MRR **and** numeric `forecast_pct`. Missing pct → contribute **0** (not fake 65)
- `at_risk_vnd` = Σ recurring MRR where `band` in (`at_risk`,`critical`) OR `forecast` in (`risk`,`unlikely`)

### POST start

- `contract_id` required integer > 0
- Contract must be scoped + `active|renewing` else 404
- Second open case → catch unique `23505` **or** pre-check → **409 `open_case_exists`**
- Insert `not_started`, audit `renewal.start`

### PATCH

Body may include: `status`, `forecast`, `forecast_pct`, `next_action`, `lost_reason`, `lost_on`, `lessons`, `new_contract_id`, `recoverable` (bool, store in lessons prefix or ignore extra column — **do not add DDL**).

Rules:
1. Status change **out of** `not_started` (or between evaluating/negotiating/decided) requires non-empty `forecast` **and** `next_action` (body or already stored) else **400 `forecast_required`**
2. `status=renewed` without `new_contract_id` (body or stored) → **400 `new_contract_required`** unless actor has `crm_am` `manage` **and** `override: true`
3. `status=lost` without trimmed `lost_reason`, `lost_on` (`YYYY-MM-DD`), `lessons` → **400 `lost_fields_required`**
4. `paused` allowed without lost fields; does not require new contract
5. Closed (`renewed`/`lost`) PATCH → 409 `case_closed`
6. Audit `renewal.patch` / `renewal.lost` / `renewal.renewed`

### Worker `AmRenewalWorker.run({ asOf })`

ICT `as_of` date (default today).
For each `crm_contracts` with `lower(status) IN ('active','renewing')` and `ends_on` exactly `as_of + d` for `d in {90,60,30,14,7,1}`:
- skip if an open case exists (`status NOT IN ('renewed','lost')`)
- INSERT `not_started` (agency_client_id from contract TEXT → uuid)
- Return `{ inserted, skipped }`
Idempotent. Unique violation → skipped.

Do **not** register a real OS cron. Expose `run` + the manage POST.

## UI

### `AmRenewalKanban` `/renewals?window=&view=kanban|list`

Header: `Renewable {vnd} · Forecast weighted {vnd} · At risk {vnd}` (or `—`).
4 columns exact labels. Cards: name · MRR · days · score/band · owner · next.
Click → `/renewals/{id}`.
Kanban move (select or buttons **Chuyển cột** if drag is heavy — drag optional): calls PATCH; surface 400 codes.
List toggle + **Export** CSV of current cards (real fields only).

### `AmRenewalCase` `/renewals/[id]`

Header: client · status · band · contract ref · ends_on + days · owner.
Editable (edit): forecast + %, next action, Lưu.
CTA `Đánh dấu Renewed` → prompt `new_contract_id` (number) then PATCH.
CTA `Đánh dấu Lost/Churned` → modal: result Lost (status lost) / Paused; reason *; lost_on *; lessons *; optional lost MRR display (read-only current mrr). Confirm → PATCH.
No amount inputs that write contracts.

## Tests (TDD)

Jest `am-renewals.service.spec.ts`:
1. Second POST same contract → 409 `open_case_exists` (simulate unique or pre-check)
2. PATCH `lost` missing reason → 400 `lost_fields_required`; no UPDATE
3. PATCH `renewed` without `new_contract_id` → 400 `new_contract_required`
4. Pipeline header: media-only contract MRR **not** added to `weighted_vnd` / `renewable_vnd`

Jest `am-renewal.worker.spec.ts`:
5. `ends_on = as_of+90` + no open case → INSERT; already open → no INSERT

Vitest: 4 column labels; `amRenewalLostError` when reason/date/lessons blank.

```
cd services/ptt-crm-api && node node_modules/.bin/jest \
  src/am/am-renewals.service.spec.ts src/am/am-renewal.worker.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/am-renewal.util.spec.ts
```

## Commit

`feat(am): add renewal pipeline, case, and window job`

HEREDOC. Never `--no-verify`. Never update git config.

## Report

`.superpowers/sdd/task-20-report.md` with RED/GREEN.

Final line: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT

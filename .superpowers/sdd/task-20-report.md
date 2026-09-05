# Task 20 Report: Renewal pipeline + case + Lost (UI-AM-11/12)

**Status:** DONE_WITH_CONCERNS  
**Branch:** `feat/am-os`  
**Commit:** `12c3abc1` — feat(am): add renewal pipeline, case, and window job  
**Date:** 2026-09-05

## Summary

Renewal SoR is `crm_am_renewal_cases` (unique open case per contract). Contract SoR stays `crm_contracts` — AM never edits `amount_vnd`. Media / media_spend / project / one_off never enter renewable, weighted, or at-risk money (`monthlyRecurringVnd`). Hide amounts copies Task 19 (`crm_am.finance` view or `crm_am` manage). Scope via `amScopeSql` on ext; out-of-scope GET → 404.

No real OS cron. CLASS tokens `AmRenewalsRepository` + `AmRenewalWorker`.

## Backend

`AmRenewalsService` + `AmRenewalWorker` registered in `am.module.ts`. Routes on `am.controller.ts`:

- `GET /api/crm/am/renewals?scope&window=90` (`view`) — default window 90. Contracts `active|renewing` with `ends_on` in `[today ICT, today+window]`, plus existing in-window cases even if the worker has not run.
- `GET /api/crm/am/renewals/:id` (`view`)
- `POST /api/crm/am/renewals` (`edit`) `{ contract_id }` — scoped `active|renewing` else 404; unique `23505` → 409 `open_case_exists`; audit `renewal.start`
- `PATCH /api/crm/am/renewals/:id` (`edit`) — forecast/next required when leaving `not_started`; `renewed` needs `new_contract_id` unless manage + `override`; `lost` needs reason + `YYYY-MM-DD` + lessons; closed → 409 `case_closed`; audit `renewal.patch` / `renewal.lost` / `renewal.renewed`
- `POST /api/crm/am/renewals/window-job` (`manage`) `{ as_of? }` → `worker.run()`

Worker `as_of` ICT (default today). For `ends_on = as_of + d` with `d in {90,60,30,14,7,1}` and `active|renewing`: skip if an open case exists; INSERT `not_started`; unique violation → skipped. Returns `{ inserted, skipped }`.

Pipeline header: `renewable_vnd` = Σ recurring MRR; `weighted_vnd` = Σ (mrr × pct/100) with missing pct → 0; `at_risk_vnd` = Σ recurring MRR where band in (`at_risk`,`critical`) OR forecast in (`risk`,`unlikely`). Hidden → header + card MRR `null`.

## Frontend

`AmRenewalKanban` at `/renewals?window=&view=kanban|list`. Header: Renewable / Forecast weighted / At risk (or `—`). Four columns: Chưa bắt đầu · Đang đánh giá · Đàm phán · Đã quyết định. Cards: name · MRR · days · score/band · owner · next. Click → `/renewals/{id}`. Move via **Chuyển cột** select (PATCH; 400 codes surfaced). List toggle + Export CSV of current cards.

`AmRenewalCase` at `/renewals/[id]`. Header: client · status · band · contract ref · ends_on + days · owner. Edit forecast + % + next action, Lưu. Renewed prompts `new_contract_id`. Lost modal: Lost / Paused; reason *; lost_on *; lessons *; read-only current MRR; optional recoverable (lessons prefix, no DDL). Proposal / log meeting / escalate hidden.

## TDD evidence

**RED** (modules missing):

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-renewals.service.spec.ts src/am/am-renewal.worker.spec.ts --no-coverage
# TS2307: Cannot find module './am-renewals.service'
# TS2307: Cannot find module './am-renewal.worker'

$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-renewal.util.spec.ts
# Cannot find module './am-renewal.util'
```

**GREEN:**

```
$ cd services/ptt-crm-api && ./node_modules/.bin/jest \
  src/am/am-renewals.service.spec.ts src/am/am-renewal.worker.spec.ts --no-coverage
# 2 suites, 5 passed

$ cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/am-renewal.util.spec.ts
# 1 file, 2 passed
```

Required: second POST unique `23505` → 409 `open_case_exists`; PATCH lost missing reason → 400 `lost_fields_required` and no UPDATE; PATCH renewed without `new_contract_id` → 400 `new_contract_required`; media-only contract MRR not added to `renewable_vnd` / `weighted_vnd`; worker `ends_on = as_of+90` INSERT then already-open skip; Vitest four column labels; `amRenewalLostError` when reason/date/lessons blank.

## Files

- `services/ptt-crm-api/src/am/am-renewals.service.ts` (+ spec)
- `services/ptt-crm-api/src/am/am-renewal.worker.ts` (+ spec)
- `services/ptt-crm-api/src/am/am.controller.ts`
- `services/ptt-crm-api/src/am/am.module.ts`
- `services/ops-web/src/lib/crm/am-api.ts`
- `services/ops-web/src/lib/crm/am-renewal.util.ts` (+ spec)
- `services/ops-web/src/components/crm/am/AmRenewalKanban.tsx`
- `services/ops-web/src/components/crm/am/AmRenewalCase.tsx`
- `services/ops-web/src/app/crm/account-management/renewals/page.tsx`
- `services/ops-web/src/app/crm/account-management/renewals/[id]/page.tsx`
- `services/ops-web/src/app/crm/account-management/am.css`

`.superpowers/` and `node_modules` not committed.

## Self-review

- Caps: GET `view`; POST/PATCH `edit`; window-job `manage`.
- CLASS repository + worker; no type-only Nest tokens.
- No PATCH/PUT/DELETE on `crm_contracts.amount_vnd`.
- No mockup hard-codes (2,84 tỷ / 2,21 tỷ / 620 triệu).
- No nested `<main>`, no new npm packages, no KPI Hub / CSD CSS.

## Concerns

1. **SQL is mocked** — unique 409, lost/renewed 400, and media header math are not proven against live Postgres.
2. **No browser pass** — kanban move, Lost modal, Export, and hidden `—` are untested in ops-web UI.
3. **Kanban move is a select** — drag-and-drop was optional; Renewed/Lost stay on the case page.
4. **Window job is on-demand only** — no OS cron, by design.

DONE_WITH_CONCERNS

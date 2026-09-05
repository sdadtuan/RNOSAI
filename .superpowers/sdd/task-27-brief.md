# Task 27: Health & Risk Center + detail (UI-AM-19/20)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read:
- Plan Task 27, SRS UI-AM-19/20, mockup `#page-health` `#page-health-detail`
- `am-health.service.ts` (recompute, snapshots, `bandFromScore`, weights)
- Dashboard dist / revenue_at_risk
- Override already on 360 (Task 21) — reuse POST override + recompute
- `health/page.tsx` and `health/[id]/page.tsx` are placeholders
- **Do not** change `/crm/health` to a second formula. If you touch `app/crm/health/page.tsx`, it may only **read** `crm_am_health_snapshots` / AM GET. Prefer leave it untouched.
- Open risks: `COUNT(*)` from `crm_am_risks` where `status='open'` scoped (0 if table empty / 42P01)
- CLASS reuse `AmHealthRepository` — add query methods on the class, no type-only token

## Do not

- Implement full risk form (Task 28) — table + count only
- Nested `<main>`, new chart libraries, KPI/CSD CSS
- Hard-code 31/10/5/2 / 185tr
- Commit `.superpowers/` / `node_modules`

## API

```
GET /api/crm/am/health?scope&from?&to?     view
GET /api/crm/am/health/:agencyClientId     view
```

Existing `POST /health/recompute` and `POST /health/:id/override` stay.

### Center payload

```
hide_amounts
tiles: { healthy, watch, at_risk, critical, revenue_at_risk_vnd, open_risks }
  // exactly 4 band keys — never a 5th band
sparkline: Array<{ as_of: string; avg: number | null }>  // last 6 calendar months ICT, missing → null
risky: Array<{
  agency_client_id, name, score, band, delta_30d, mrr_vnd, owner_label, open_risks, recovery_status
}>  // band in at_risk|critical; churned excluded
```

Churned accounts **excluded** from tiles, sparkline averages, and risky table.

`revenue_at_risk_vnd`: Σ recurring MRR of at_risk+critical (same `monthlyRecurringVnd` / hide rule as list). Media excluded.

`delta_30d`: latest score − score from ~30 days ago; null if no prior snapshot.

### Detail payload

```
agency_client_id, name, score, band, as_of, scorecard_version, thin_data,
override, weights, components,
contribution: { key, score, weight, points }[],  // points = score*weight/100
trend: last 4 as_of scores (nulls allowed),
signals: string[]  // derive from thin_data / low components / override; empty → []
```

Out-of-scope GET → 404.

## UI

`AmHealthCenter` at `/health`:
- **Exactly 6 tiles**: Healthy, Watch, At Risk, Critical, Revenue at risk, Open risks
- Sparkline: CSS bars or text series of 6 months — no new chart lib
- Risky table: account, score, Δ30d, revenue, owner, open risks. Click → `/health/{id}`
- Link to settings scorecard if manage

`AmHealthDetail` at `/health/[id]`:
- Header score/band
- Components table
- Trend
- Recompute button if manage (existing POST)
- Override if manage (existing POST)
- Empty → `—`

360 health tab can stay Wave 3 placeholder or link to `/health/{id}`.

## Tests (TDD)

Jest (extend `am-health.service.spec.ts` or new `am-health-center.spec.ts`):

1. Center `tiles` has **exactly** keys healthy/watch/at_risk/critical (+ money/risks) — no 5th band
2. A churned account is **not** counted in any band tile
3. Optional: assert `app/crm/health/page.tsx` file is unchanged vs HEAD (or not imported a second formula). Do **not** rewrite old health.

Vitest: `AM_HEALTH_TILES` length 6; 4 band labels.

```
cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-health.service.spec.ts --no-coverage
cd services/ops-web && npx vitest run src/lib/crm/am-health-center.util.spec.ts
```

## Commit

`feat(am): add health and risk center on the AM scorecard`

Report: `.superpowers/sdd/task-27-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT

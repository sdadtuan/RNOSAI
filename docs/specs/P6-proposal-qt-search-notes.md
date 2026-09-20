# Proposal / QT search — P6 behavior notes

## Search (`q`)

`GET /api/v1/quotes?q=` matches:

- `quote_code` (ILIKE) — e.g. `QT-0360`, `QT-PTT-2026-000360`
- `title`, client `name`, `lead_id`, `LD-{lead_id}`

If QT-0360 is **not** in `crm_proposals.quote_code` (only KPI-hub / seed alias), list returns **empty** with no error — use Hub KPI assignment / contract link instead. This is intentional (no fabricated QT rows).

## 0₫ drafts

Lead drafts (e.g. LD-5) may show `payable_vnd = 0` until lines are priced. That does **not** mean the contract is 0₫ — contract value lives on `crm_contracts.amount_vnd` (fixture Contract #1 ≈ 45_000_000).

Filter noise:

```
GET /api/v1/quotes?exclude_zero_totals=1
```

## Acceptance

1. Search `QT-PTT-…` or known code → consistent list or empty.
2. `exclude_zero_totals=1` hides zero payable drafts.
3. `presales.context.read` surfaces `proposal.gaps` including `totals_zero` / `zero_vnd_drafts_present` without inventing media splits.

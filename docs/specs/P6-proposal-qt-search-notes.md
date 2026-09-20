# Proposal / QT search — P6 behavior notes

## Search (`q`)

`GET /api/crm/proposals?q=` matches:

- `quote_code` (ILIKE) — e.g. `QT-PTT-2026-000006`
- Digit-normalized code — `QT-0360` / `360` also match digits inside `quote_code`
- `title`, client `name`, `lead_id`, `LD-{lead_id}`
- Contract title via HĐ link — proposals whose lead/agency_client ties to a contract titled like `HD 360 AUTO…`

If a KPI-hub seed alias (e.g. `QT-0360`) is **not** a real `crm_proposals.quote_code` and no contract/client token matches, list returns **empty** with no error — intentional (no fabricated QT rows). Prefer Hub KPI assignment / HĐ–campaign map.

## HĐ ↔ campaign map

`presales.context.read` → `presales.contract`:

| field | meaning |
|-------|---------|
| `campaign_id` / `campaign_code` / `campaign_name` | `crm_contracts.campaign_id` → `crm_campaigns` |
| `map_status` | `linked` · `contract_unmapped` · `hub_unmapped` · `missing_client` |
| `hub_agency.campaign_map_rows` | active rows in `hub_campaign_map` for agency client |

Staff maps Meta/external campaigns on Agency client → Hub; set `crm_contracts.campaign_id` to finish HĐ link.

## 0₫ drafts

Lead drafts (e.g. LD-5) may show `payable_vnd = 0` until lines are priced. That does **not** mean the contract is 0₫ — contract value lives on `crm_contracts.amount_vnd` (fixture Contract #1 ≈ 45_000_000).

Filter noise:

```
GET /api/v1/quotes?exclude_zero_totals=1
```

## Acceptance

1. Search `QT-PTT-…` or `360` → lead-5 / 360 client quotes (or empty if none).
2. `exclude_zero_totals=1` hides zero payable drafts.
3. `presales.context.read` surfaces `proposal.gaps` + `contract.map_status` without inventing media splits.

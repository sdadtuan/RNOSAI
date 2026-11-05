# Task 20 Report — Bind eight Media OS screens to live APIs

**Branch:** `feat/msos-w1-win`  
**Date:** 2026-09-12

## Summary

Implemented all 8 Media OS screen components with live `msosFetch` bindings, empty-state handling, mockup-parity CSS classes, and minimal backend list endpoints. All Vitest specs pass.

## Frontend (ops-web)

### Helpers & tests
| File | Purpose |
|------|---------|
| `src/lib/crm/msos-gates-ui.ts` | `canEnableLiveButton`, `canEnableInvoiceButton` |
| `src/lib/crm/msos-gates-ui.spec.ts` | Gate button unit tests |
| `src/lib/crm/msos-screens.spec.ts` | Denylist scan on all 8 component sources |
| `src/lib/crm/msos-client.ts` | `msosGet` / `msosMutate` wrappers |
| `src/lib/crm/msos-format.ts` | VND/bps formatting, error helper |

### Screen components
| Component | API bindings |
|-----------|--------------|
| `MsosCommand.tsx` | `GET /exceptions`, `/media-lines`, `/make-goods`, `/health` — KPIs from counts |
| `MsosInventory.tsx` | `GET /inventory`, `/placements`, `/partners`, `/rate-cards`, calendar; POST create modals |
| `MsosPackages.tsx` | `GET /packages`, `/insertion-orders`; POST package + Tạo IO/issue; conflict toasts |
| `MsosCampaigns.tsx` | `GET /media-lines`, `GET /media-lines/:id/gates`, traffic PUT/submit; Live gated GT-P01+P02 |
| `MsosEvidence.tsx` | `GET /evidence-packs`, `/discrepancy-cases`, `/make-goods`; official pack + DC/MG modals |
| `MsosOutcomes.tsx` | `GET /outcome-links`; KPIs from link counts; deep-link `/crm/leads/:id` |
| `MsosMargin.tsx` | `GET /media-lines/:id/margin`; waterfall rows; make-good row if >0; invoice guarded |
| `MsosGovernance.tsx` | `GET /health`, `/policies`, `/partners/:id/scorecard`, `/eligibility` |

### Routes
All 8 `app/crm/media-os/**/page.tsx` now mount real components (not inline `MsosEmpty`).

### CSS
Extended `msos.css` with mockup classes: `.msos-t`, `.msos-tag`, `.msos-gate`, `.msos-cal`, `.msos-kpi5`, `.msos-layout`, modals, toast.

## Backend additions (minimal)

New read endpoints on `MsosController`:
- `GET /policies`
- `GET /evidence-packs`
- `GET /discrepancy-cases`
- `GET /make-goods`
- `GET /insertion-orders`
- `GET /rate-cards`
- `GET /packages/:id`
- `GET /packages/:id/reservations`

Existing `GET /media-lines/:id/gates` used for Live Gate checklist.

## Constraints verified

- Empty state → `MsosEmpty` when primary list API returns `[]`
- No hardcoded demo IDs (denylist scan: 8/8 pass)
- KPI numbers computed from API payload lengths/sums
- Modals use real dropdowns (partners, placements, packages, client UUID)
- §4 lock chips on `MsosSpine` (4 chips always)
- CRM deep-links only (`/crm/clients`, `/crm/creative-os`, `/crm/financials`, `/crm/leads`) — no embed

## Tests

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/msos-gates-ui.spec.ts \
  src/lib/crm/msos-empty.spec.ts \
  src/lib/crm/msos-screens.spec.ts
```

**Result:** 3 files, 11 tests — all PASS

## Commit

```
feat(msos): bind eight Media OS screens to live APIs
```

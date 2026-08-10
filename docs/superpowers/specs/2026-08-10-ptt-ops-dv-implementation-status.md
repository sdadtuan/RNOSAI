# PTT Ops DV01–DV21 — Implementation Status

**Last updated:** 2026-08-10  
**Overall:** ~60% — INT-P1 staging; INT-P2 Quote Builder implemented locally  
**Plan:** `docs/superpowers/plans/2026-08-10-ptt-ops-int-p2-implementation.md`

---

## Milestone summary

| Milestone | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **Spec** | Design + integration + DDL + route map | ✅ Done | |
| **Ops-M0** | Catalog + hub read-only | ✅ Done | Staging @ `4903576` |
| **INT-P1 / Ops-M1** | Weekly spawn | ✅ Done | POST spawn-week, checklist PATCH |
| **INT-P1 / Ops-M2** | KPI records + labels | ✅ Done | Staging @ ec9d2b3 |
| **INT-P2 / Ops-M3** | Quote Builder 3 gói | ✅ Done | local — chưa deploy |
| **INT-P2b** | AI suggest-quote | ⬜ Deferred | |

---

## Backend (ptt-crm-api)

| Component | Status |
|-----------|--------|
| `ops` Nest module | ✅ |
| POST `/api/ops/lifecycle/:id/spawn-week` | ✅ |
| GET/PATCH `/api/ops/lifecycle/:id/weekly` | ✅ |
| GET/PUT `/api/ops/lifecycle/:id/kpi` | ✅ |
| POST `/api/ops/lifecycle/:id/kpi/compute-labels` | ✅ |
| Hub weekly + KPI enrichment | ✅ |
| POST `/api/crm/proposals` + lines | ✅ |
| PUT `/api/crm/proposals/:id/lines` | ✅ |
| PATCH status + accept → lifecycle | ✅ |
| POST export PDF/DOCX | ✅ |
| GET `/api/crm/proposals/quote-catalog` | ✅ |
| Tier pricing seed | ✅ `ops-dv-tier-pricing-seed.json` |

---

## Frontend (ops-web)

| Component | Status |
|-----------|--------|
| `OpsServiceHubPanel` | ✅ |
| `OpsWeeklyPanel` | ✅ spawn + checklist toggle |
| `QuoteBuilderWizard` | ✅ 4 bước DV + 3 gói |
| `quote-api.ts` | ✅ |
| `/crm/proposals` | ✅ wizard + legacy list |

---

## Pilot DV (P0)

| DV | Slug | Hub | Spawn | KPI | Template seed |
|----|------|-----|-------|-----|---------------|
| DV02 | `tiep-thi-noi-dung` | ✅ | ✅ | ✅ | ✅ 3 tasks |
| DV05 | `seo-retainer` | ✅ | ✅ | ✅ | ✅ 3 tasks |
| DV04 | ads slugs | ✅ | ✅ | ✅ | ✅ 3 tasks |
| DV20 | `email-marketing` | ✅ | ✅ | ✅ | ✅ 3 tasks |

---

## Environment (staging)

| Variable | Target |
|----------|--------|
| `PTT_OPS_DV_ENABLED` | `1` |
| `PTT_OPS_WEEKLY_SPAWN` | `1` (INT-P1) |
| `NEXT_PUBLIC_OPS_DV` | `1` |

---

## Next action

1. Commit + push INT-P2
2. Re-seed tier_pricing staging
3. Deploy + smoke quote

```bash
STAFF_TOKEN=... CUSTOMER_ID=... bash scripts/smoke_ops_quote.sh
ACCEPT=1 ... bash scripts/smoke_ops_quote.sh
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-10 | Ops-M0 staging deploy |
| 2026-08-10 | INT-P1 staging deploy |
| 2026-08-10 | INT-P2: Quote Builder, export, accept→lifecycle |

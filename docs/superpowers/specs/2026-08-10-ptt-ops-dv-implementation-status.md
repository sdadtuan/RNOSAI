# PTT Ops DV01–DV21 — Implementation Status

**Last updated:** 2026-08-10  
**Overall:** ~45% — M0 deployed staging; INT-P1 (M1+M2) implemented locally  
**Plan:** `docs/superpowers/plans/2026-08-10-ptt-ops-int-p1-implementation.md`

---

## Milestone summary

| Milestone | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **Spec** | Design + integration + DDL + route map | ✅ Done | |
| **Ops-M0** | Catalog + hub read-only | ✅ Done | Staging @ `4903576` |
| **INT-P1 / Ops-M1** | Weekly spawn | ✅ Done | POST spawn-week, checklist PATCH |
| **INT-P1 / Ops-M2** | KPI records + labels | ✅ Done | GET/PUT KPI, BR-OPS-KPI-01 |
| **Ops-M3** | Tier + quotes | ⬜ Deferred | INT-P2 |

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
| Pilot seed (weekly + KPI defs) | ✅ `ops-dv-pilot-weekly-kpi-seed.json` |
| Unit tests | ✅ ops-kpi-label, ops-weekly-template, hub, slug |

---

## Frontend (ops-web)

| Component | Status |
|-----------|--------|
| `OpsServiceHubPanel` | ✅ |
| `OpsWeeklyPanel` | ✅ spawn + checklist toggle |
| `OpsKpiPanel` | ✅ actual entry + label badges |
| Service delivery tab | ✅ |

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

1. Commit + push INT-P1
2. Re-seed staging: `node scripts/seed_ops_dv_catalog.js`
3. Deploy + smoke: `SPAWN=1 LIFECYCLE_ID=... bash scripts/smoke_ops_dv_hub.sh`

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-10 | Ops-M0 staging deploy |
| 2026-08-10 | INT-P1: spawn-week, KPI labels, FE panels |

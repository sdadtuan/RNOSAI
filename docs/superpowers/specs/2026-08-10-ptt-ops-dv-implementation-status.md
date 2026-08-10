# PTT Ops DV01–DV21 — Implementation Status

**Last updated:** 2026-08-10  
**Overall:** ~75% — INT-P1/P2 staging; INT-P3 Agent + Alerts + Dashboard implemented locally  
**Plan:** `docs/superpowers/plans/2026-08-10-ptt-ops-int-p3-implementation.md`

---

## Milestone summary

| Milestone | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **Spec** | Design + integration + DDL + route map | ✅ Done | |
| **Ops-M0** | Catalog + hub read-only | ✅ Done | Staging @ `4903576` |
| **INT-P1 / Ops-M1** | Weekly spawn | ✅ Done | POST spawn-week, checklist PATCH |
| **INT-P1 / Ops-M2** | KPI records + labels | ✅ Done | Staging @ ec9d2b3 |
| **INT-P2 / Ops-M3** | Quote Builder 3 gói | ✅ Done | Staging @ 0d377cf |
| **INT-P3 / Ops-M4** | L2 Ops Agent + alerts | ✅ Done | local — chưa deploy |
| **INT-P3 / M5** | Role dashboards | ✅ Done | local — chưa deploy |
| **INT-P2b** | AI suggest-quote | ⬜ Deferred | |
| **INT-P4** | L3 RAG chat | ⬜ Deferred | |

---

## Backend (ptt-crm-api)

| Component | Status |
|-----------|--------|
| `ops` Nest module | ✅ |
| POST `/api/ops/lifecycle/:id/spawn-week` | ✅ |
| GET/PATCH `/api/ops/lifecycle/:id/weekly` | ✅ |
| GET/PUT `/api/ops/lifecycle/:id/kpi` | ✅ |
| POST `/api/ops/lifecycle/:id/kpi/compute-labels` | ✅ |
| Hub weekly + KPI + **alerts** enrichment | ✅ |
| `ops_alert_log` PG repo | ✅ |
| `OpsAgentScanService` + daily cron tick | ✅ |
| GET/PATCH `/api/ops/alerts` | ✅ |
| POST `/api/ops/agent/run` | ✅ |
| GET `/api/ops/dashboard/*` (4 roles) | ✅ |
| POST `/api/crm/proposals` + lines | ✅ |
| Quote accept → lifecycle | ✅ |

---

## Frontend (ops-web)

| Component | Status |
|-----------|--------|
| `OpsServiceHubPanel` | ✅ |
| `OpsWeeklyPanel` | ✅ |
| `OpsKpiPanel` | ✅ |
| `OpsAlertsPanel` | ✅ |
| `/crm/ops/dashboard` | ✅ 4 role tabs |
| `/crm/ops/alerts` | ✅ alert center |
| `/crm/ops/my-tasks` | ✅ specialist tasks |
| `QuoteBuilderWizard` | ✅ |
| `/crm/proposals` | ✅ |

---

## Env (staging target)

| Flag | Value |
|------|-------|
| `PTT_OPS_DV_ENABLED` | `1` |
| `PTT_OPS_WEEKLY_SPAWN` | `1` |
| `PTT_OPS_AGENT_ENABLED` | `1` (INT-P3) |
| `NEXT_PUBLIC_OPS_DV` | `1` |

Deploy: `APPLY=1 ./scripts/deploy_ops_dv_staging.sh`

Smoke INT-P3: `STAFF_TOKEN=... bash scripts/smoke_ops_agent.sh`

---

## Next

- Deploy INT-P3 staging + smoke with real lifecycle/KPI data
- INT-P4: L3 RAG chat + AI draft report (§6.2–6.5)
- Notify channel (email/Zalo) for alerts

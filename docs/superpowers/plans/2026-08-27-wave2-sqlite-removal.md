# Wave 2 — Xóa SQLite runtime + hard-cut dual modules

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Không còn đường request/worker nào mở `ptt.db` hoặc `node:sqlite`; xóa dead code SQLite; CI cấm regression.

**Architecture:** Wave 1 đã port 11 module SQLite-only sang PG-only. Wave 2 (a) xóa `*-sqlite.repository.ts` dead của W1, (b) hard-cut 12 module dual đã có `*-pg.repository.ts` — bỏ nhánh `usePg ? pg : sqlite`, (c) chuyển satellite repos (AI context, lifecycle-finance, finance utils) sang PG Pool, (d) Python/SEO fail-closed PG, (e) gỡ flag `PTT_CRM_*_PG` + `PTT_SQLITE_PATH`, (f) CI gate toàn Nest.

**Tech Stack:** NestJS `services/ptt-crm-api`, Python worker `ptt_jobs`/`ptt_crm`, `ptt_seo/db.py`, PostgreSQL production `/var/www/rnosai`, Jest + unittest.

## Global Constraints

- Không dual-read sau cutover — cấm `usePg ? pg : sqlite`, `leadsReadSource === 'pg' ? ...`
- Không mở `node:sqlite` / `DatabaseSync` / `sqlite3.connect` trên đường request hoặc job handler khi env prod = PG
- Giữ tên bảng `crm_*` và API JSON shape — Wave 2 chỉ đổi persistence
- Xóa file SQLite **sau** module tương ứng xanh trên VPS smoke (trừ Task 1 W1 dead files — đã PG-only từ W1)
- `PTT_CRM_PAYROLL_PG` hiện default `0` — Task Payroll phải bật PG trên VPS trước smoke (`PTT_CRM_PAYROLL_PG=1`)
- `SEO_AEO_DB` default hiện `sqlite` — đổi default `pg` + VPS `.env` = `pg`
- `PTT_LEAD_SHADOW_SYNC=0` trên VPS (đã khuyến nghị Wave 0)
- Commit theo từng task khi user yêu cầu; deploy: `git pull` + `npm run build` + restart `ptt-crm-api` + `ptt-worker`
- Không migrate data từ `ptt.db` — VPS prod không có file (đã diagnose `sqlite_db_not_found`)

## Wave 0 flags (VPS `.env` — verify trước Task 22)

```bash
PTT_LEADS_WRITE_SOURCE=pg
PTT_LEADS_READ_SOURCE=pg
PTT_CRM_LEADS_FUNNEL_PG=1
PTT_CRM_INTAKE_PG=1
PTT_CRM_CONTRACT_PG=1
PTT_CRM_STAFF_PG=1
PTT_CRM_KPI_PG=1
PTT_CRM_LEADS_LEGACY_PG=1
PTT_CRM_SERVICE_LIFECYCLE_PG=1
PTT_CRM_FINANCE_PG=1
PTT_CRM_SVC_FINANCE_PG=1
PTT_CRM_SOP_PG=1
PTT_CRM_PAYROLL_PG=1
PTT_LEAD_SHADOW_SYNC=0
SEO_AEO_DB=pg
```

---

## File map

| Nhóm | Module / file | Việc W2 |
|------|---------------|---------|
| Dead W1 | 11× `*-sqlite.repository.ts` (customers…re-projects) | Xóa |
| Dual Nest | intake, crm-staff, crm-leads-legacy, leads-funnel, leads-contract, kpi, payroll, finance, svc-finance, sop, service-lifecycle | PG-only wiring |
| Leads API | `leads/sqlite-leads.repository.ts`, `leads.repository.ts` | PG-only |
| Catalog | `catalog-sqlite.repository.ts` | Xóa (module đã PG-only) |
| Consumers | `deal-room.service.ts`, `ai-nba.service.ts`, 7× `ai-intelligence/*-context.repository.ts` | Bỏ `CrmLeadsSqliteRepository` |
| Lifecycle satellite | `lifecycle-finance-confirm.repository.ts`, `lifecycle-tasks.repository.ts`, `lifecycle-finance.util.ts` | PG Pool |
| Finance utils | `finance-kpi.util.ts`, `forecast-actual.util.ts`, `business-dashboard.util.ts`, `finance-metrics.util.ts` | Query PG qua `FinancePgRepository` hoặc Pool |
| Python | `ptt_crm/crm_sqlite.py`, `lead_sync.py`, `lead_shadow_sync.py`, `crm_lead_store.py`, `crm_lead_intake.py`, handlers còn sqlite | PG-only / no-op |
| SEO | `ptt_seo/db.py` | Default `pg`; bỏ sqlite prod path |
| Config | `app-config.service.ts` | Gỡ `sqlitePath`, `crm*Pg` flags, health `sqlite: true` |
| CI | `scripts/crm_no_sqlite_gate.sh`, `.github/workflows/` | Gate toàn Nest src |
| E2E | `scripts/playwright_ops_*.sh`, `scripts/local_crm_api_up.sh` | Bỏ `PTT_SQLITE_PATH` bắt buộc |

Thứ tự cutover dual (FK / dependency):

**crm-staff → crm-leads-legacy → intake → leads-contract → leads-funnel → leads.repository → kpi → finance → svc-finance → sop → service-lifecycle → payroll**

---

## Playbook (module dual → PG-only)

1. Service: xóa inject `*SqliteRepository`, mọi `usePg` getter, chỉ gọi `*PgRepository`.
2. Module: providers/exports chỉ PG; bỏ SQLite provider.
3. Sub-services (lifecycle-consult, sop-auto-start, …): cùng pattern.
4. Spec: grep test — `does not import *SqliteRepository`.
5. `npx jest src/<module> --no-coverage` + build.
6. Xóa `*-sqlite.repository.ts` + util sqlite-only cùng module.
7. VPS smoke path tương ứng.

---

### Task 0: Kit — `WAVE2_PG_MODULES` + CI gate skeleton

**Files:**
- Create: `services/ptt-crm-api/src/persistence/wave2-pg.constants.ts`
- Create: `services/ptt-crm-api/src/persistence/wave2-pg.constants.spec.ts`
- Create: `scripts/crm_no_sqlite_gate.sh`

**Interfaces:**
- Produces: `WAVE2_PG_MODULES` — danh sách module dual cần cutover

- [ ] **Step 1: Failing test**

```ts
import { WAVE2_PG_MODULES } from './wave2-pg.constants';

describe('WAVE2_PG_MODULES', () => {
  it('lists dual modules to hard-cut in Wave 2', () => {
    expect(WAVE2_PG_MODULES).toEqual([
      'crm-staff',
      'crm-leads-legacy',
      'intake',
      'leads-contract',
      'leads-funnel',
      'leads',
      'kpi',
      'finance',
      'svc-finance',
      'sop',
      'service-lifecycle',
      'payroll',
    ]);
  });
});
```

- [ ] **Step 2:** `cd services/ptt-crm-api && npx jest src/persistence/wave2-pg.constants.spec.ts` → FAIL
- [ ] **Step 3:** Implement constant + `scripts/crm_no_sqlite_gate.sh`:

```bash
#!/usr/bin/env bash
# Wave 2 — fail if Nest runtime still references SQLite outside allowlist
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ALLOW='catalog-sqlite|test|spec|wave1-pg|wave2-pg|billing-schema\.util'
if rg -n 'DatabaseSync|node:sqlite|PTT_SQLITE_PATH|SqliteRepository' \
  "$ROOT/services/ptt-crm-api/src" --glob '!*spec.ts' | rg -v "$ALLOW"; then
  echo "FAIL: SQLite references remain"; exit 1
fi
echo "crm_no_sqlite_gate: PASS"
```

Gate ban đầu **allowlist rộng** (dual modules còn sqlite); thu hẹp dần mỗi task.

- [ ] **Step 4:** Jest PASS
- [ ] **Step 5:** Commit `Add Wave 2 PG module list and CRM no-SQLite gate skeleton.`

---

### Task 1: Xóa dead SQLite Wave 1 (11 repos)

**Files:** Delete (không sửa service — W1 đã PG-only):

```
services/ptt-crm-api/src/customers/customers-sqlite.repository.ts
services/ptt-crm-api/src/tickets/tickets-sqlite.repository.ts
services/ptt-crm-api/src/cases/cases-sqlite.repository.ts
services/ptt-crm-api/src/orders/orders-sqlite.repository.ts
services/ptt-crm-api/src/invoices/invoices-sqlite.repository.ts
services/ptt-crm-api/src/sales/sales-sqlite.repository.ts
services/ptt-crm-api/src/proposals/proposals-sqlite.repository.ts
services/ptt-crm-api/src/marketing-plans/marketing-plans-sqlite.repository.ts
services/ptt-crm-api/src/crm-config/crm-config-sqlite.repository.ts
services/ptt-crm-api/src/owner-weekly/owner-weekly-sqlite.repository.ts
services/ptt-crm-api/src/re-projects/re-projects-sqlite.repository.ts
```

Also delete if zero imports: `billing-schema.util.ts` (SQLite DDL) — **chỉ khi** grep 0 refs ngoài spec.

- [ ] **Step 1:** Test grep W1 modules không import sqlite filenames
- [ ] **Step 2:** Delete files
- [ ] **Step 3:** `npm run build` + `npx jest src/customers src/tickets src/cases src/orders src/invoices src/sales src/proposals src/marketing-plans src/crm-config src/owner-weekly src/re-projects --no-coverage`
- [ ] **Step 4:** Commit `Remove Wave 1 dead SQLite repositories.`

---

### Task 2: CRM Staff — hard-cut dual

**Files:**
- Modify: `crm-staff.service.ts`, `crm-staff.module.ts`
- Delete (cuối task): `crm-staff-sqlite.repository.ts`

**Interfaces:** Giữ public methods `listStaff`, `detail`, `create`, `patch`, import, levels, competencies.

- [ ] Steps 1–6 playbook. Jest: `src/crm-staff`
- [ ] Smoke VPS: `/admin/crm/org/staff` list + detail
- [ ] Commit: `Serve CRM staff from PostgreSQL only.`

---

### Task 3: CRM Leads Legacy + consumers

**Files:**
- Modify: `crm-leads-legacy.service.ts`, `crm-leads-legacy.module.ts`
- Modify: `deal-room/deal-room.service.ts` — `CrmLeadsPgRepository` thay `CrmLeadsSqliteRepository`
- Modify: `ai-intelligence/ai-nba.service.ts` — same
- Delete: `crm-leads-sqlite.repository.ts`

**Interfaces:** `CrmLeadsPgRepository` methods used by funnel/deal-room/NBA — grep trước khi xóa sqlite.

- [ ] Jest: `src/crm-leads-legacy src/deal-room src/ai-intelligence/ai-nba.service.spec.ts`
- [ ] Smoke: deal room + NBA card
- [ ] Commit: `Serve CRM leads legacy and deal-room from PostgreSQL only.`

---

### Task 4: Intake

**Files:** `intake.service.ts`, `intake.module.ts`; delete `intake-sqlite.repository.ts`

- [ ] Jest `src/intake`; smoke presales intake queue
- [ ] Commit: `Serve CRM intake from PostgreSQL only.`

---

### Task 5: Leads Contract

**Files:** `leads-contract.service.ts`, `leads-contract.module.ts`; delete `leads-contract-sqlite.repository.ts`

- [ ] Jest `src/leads-contract`; smoke contract readiness / promote
- [ ] Commit: `Serve leads contract from PostgreSQL only.`

---

### Task 6: Leads Funnel (lớn ~1200 dòng service)

**Files:**
- Modify: `leads-funnel.service.ts`, `leads-funnel.module.ts`
- Modify: `leads/chot-closed-loop.service.ts`, `leads/lead-sla-care.service.ts`, `leads/lead-status-gate.service.ts` nếu inject sqlite funnel
- Delete: `leads-funnel-sqlite.repository.ts`, `presales-funnel-metrics-load.sqlite.util.ts` (port logic sang PG util hoặc inline PG query)

**Interfaces:** Mọi `usePgFunnel` branch → chỉ PG. Xóa `leadSqlite` inject nếu chỉ dùng cho sqlite branch.

- [ ] Jest: `src/leads-funnel src/leads --testPathPattern='funnel|presales'`
- [ ] Smoke: funnel board, presales metrics, review queue
- [ ] Commit: `Serve leads funnel from PostgreSQL only.`

---

### Task 7: Leads repository (API `/api/v1/leads`)

**Files:**
- Modify: `leads.repository.ts`, `leads.module.ts`
- Delete: `sqlite-leads.repository.ts`
- Modify: `config/app-config.service.ts` — `leadsReadSource` luôn `'pg'` (hoặc bỏ switch)

```ts
// leads.repository.ts — target shape
async listLeads(query: ListLeadsQuery) {
  const enriched = await this.withReviewQueueFilter(query);
  return this.pgRepo.listLeads(enriched);
}
```

- [ ] Jest leads module; smoke `/crm/leads` list
- [ ] Commit: `Serve leads API read path from PostgreSQL only.`

---

### Task 8: KPI

**Files:** `kpi.service.ts`, `kpi.module.ts`; delete `kpi-sqlite.repository.ts`

- [ ] Jest `src/kpi`; smoke `/crm/kpi`
- [ ] Commit: `Serve CRM KPI from PostgreSQL only.`

---

### Task 9: Finance + finance utils

**Files:**
- Modify: `finance.service.ts`, `finance.module.ts`
- Modify: `finance-kpi.util.ts`, `forecast-actual.util.ts`, `business-dashboard.util.ts`, `finance-metrics.util.ts`, `finance-intelligence.util.ts` — thay `DatabaseSync` param bằng `Pool` hoặc delegate `FinancePgRepository`
- Delete: `finance-sqlite.repository.ts`

**Interfaces:** Dashboard `/crm/financials`, `/crm/kpi` alert thresholds, business dashboard vẫn trả cùng JSON.

- [ ] Jest `src/finance`; smoke financials + business dashboard
- [ ] Commit: `Serve CRM finance from PostgreSQL only.`

---

### Task 10: Svc Finance

**Files:** `svc-finance.service.ts`, `svc-finance.module.ts`, `svc-finance.util.ts`; delete `svc-finance-sqlite.repository.ts`

- [ ] Jest `src/svc-finance`; smoke service lifecycle billing tab
- [ ] Commit: `Serve service finance from PostgreSQL only.`

---

### Task 11: SOP

**Files:** `sop.service.ts`, `sop-auto-start.service.ts`, `sop.module.ts`; delete `sop-sqlite.repository.ts`

- [ ] Jest `src/sop`; smoke SOP templates/runs
- [ ] Commit: `Serve CRM SOP from PostgreSQL only.`

---

### Task 12: Service Lifecycle + satellites

**Files:**
- Modify: `service-lifecycle.service.ts`, `service-lifecycle.module.ts`, `lifecycle-consult.service.ts`, `lifecycle-onboarding.service.ts`, `lifecycle-launch-qa.service.ts`
- Modify: `lifecycle-finance-confirm.repository.ts` → PG (hoặc merge vào `service-lifecycle-pg.repository.ts`)
- Modify: `lifecycle-tasks.repository.ts` → dùng `lifecycle-tasks-pg.repository.ts` only
- Modify: `lifecycle-finance.util.ts`, `lifecycle-context.util.ts` — bỏ `DatabaseSync`
- Delete: `service-lifecycle-sqlite.repository.ts`

- [ ] Jest `src/service-lifecycle`; smoke lifecycle detail + tasks + finance confirm
- [ ] Commit: `Serve service lifecycle from PostgreSQL only.`

---

### Task 13: Payroll (default flag = 0)

**Files:** `payroll.service.ts`, `payroll.module.ts`, `payroll-engine.ts` if sqlite; delete `payroll-sqlite.repository.ts`

**VPS pre-step:** set `PTT_CRM_PAYROLL_PG=1` in `.env` trước deploy task này.

- [ ] Jest `src/payroll`; smoke `/crm/payroll` dashboard
- [ ] Commit: `Serve CRM payroll from PostgreSQL only.`

---

### Task 14: AI Intelligence context repos

**Files:** (mỗi file bỏ sqlite, query PG)

```
ai-intelligence/lead-score-context.repository.ts
ai-intelligence/deal-score-context.repository.ts
ai-intelligence/lead-route-context.repository.ts
ai-intelligence/nl-query-context.repository.ts
ai-intelligence/upsell-context.repository.ts
ai-intelligence/churn-health-context.repository.ts
ai-intelligence/renewal-contract-context.repository.ts
ai-intelligence/ai-forecast.service.ts
```

Pattern: inject `CrmLeadsPgRepository` hoặc `Pool` + SQL; không `CrmLeadsSqliteRepository` / `DatabaseSync`.

- [ ] Jest `src/ai-intelligence`; smoke coach digest, deal score, forecast endpoints
- [ ] Commit: `Serve AI intelligence context from PostgreSQL only.`

---

### Task 15: Catalog dead file + agency meta util

**Files:**
- Delete: `catalog/catalog-sqlite.repository.ts`
- Review: `agency/meta-migration.util.ts` reference `crm_sqlite.py` — document-only hoặc update path comment

- [ ] Grep 0 imports catalog-sqlite; build PASS
- [ ] Commit: `Remove dead catalog SQLite repository.`

---

### Task 16: Python worker — PG-only

**Files:**
- Modify: `ptt_crm/crm_sqlite.py` — `get_connection()` raise `RuntimeError` when `leads_write_source_pg()`; giữ `db_path()` for tests only behind explicit env
- Modify: `ptt_crm/lead_sync.py`, `ptt_crm/lead_shadow_sync.py` — no-op when `PTT_LEAD_SHADOW_SYNC=0` (harden)
- Modify: `ptt_crm/crm_lead_store.py`, `crm_lead_intake.py`, `crm_lead_presales.py` — PG path only
- Modify: `ptt_jobs/handlers/ingest_lead.py` — no sqlite branch
- Modify: `ptt_crm/form_lead_ingest.py` — remove sqlite path entirely (W2: delete else branch)
- Test: extend `tests/test_form_ingest_pg.py`, `tests/test_lead_ingest_config.py`, `tests/test_crm_lead_intake.py`

- [ ] `python3 -m unittest tests.test_form_ingest_pg tests.test_lead_ingest_config tests.test_crm_lead_intake -v`
- [ ] Commit: `Remove SQLite paths from CRM Python ingest and sync.`

---

### Task 17: SEO — default PostgreSQL

**Files:**
- Modify: `ptt_seo/db.py` — `seo_db_mode()` default `'pg'`; `seo_uses_pg()` true when unset on prod
- Modify: tests expecting default sqlite — set env explicitly in test
- VPS: `SEO_AEO_DB=pg` in `.env`

- [ ] `python3 -m unittest tests.test_seo_aeo_phase4_aeo_v2 -v` (fix env patches)
- [ ] Commit: `Default SEO AEO storage to PostgreSQL.`

---

### Task 18: Config cleanup — gỡ flags và sqlitePath

**Files:** `services/ptt-crm-api/src/config/app-config.service.ts`, health controller if any

- Remove: `sqlitePath`, `resolveSqlitePath()`, `crmIntakePg`, `crmPayrollPg`, … all `crm*Pg` booleans
- Remove: `leadsReadSource` switch — hardcode `'pg'` or single source
- Health JSON: `"sqlite": false` or omit field; `"postgres": true`

- [ ] Build + full `npx jest --no-coverage` (or module subset + build)
- [ ] Commit: `Remove SQLite config flags and paths from CRM API.`

---

### Task 19: CI gate — full enforcement

**Files:**
- Modify: `scripts/crm_no_sqlite_gate.sh` — **empty allowlist** (chỉ exclude `*.spec.ts`, `wave*-pg.constants.ts`)
- Create: `.github/workflows/crm-no-sqlite-gate.yml` (mirror rbac-r1-gate)
- Modify: `scripts/rbac_no_sqlite_gate.sh` comment — point to crm gate for Nest

- [ ] Local: `./scripts/crm_no_sqlite_gate.sh` → PASS on clean branch
- [ ] Commit: `Add CI gate blocking SQLite in CRM Nest runtime.`

---

### Task 20: E2E / local scripts

**Files:** Batch update scripts referencing `PTT_SQLITE_PATH`:

- `scripts/local_crm_api_up.sh` — require `DATABASE_URL`, drop sqlite default
- `scripts/playwright_ops_*.sh` — same pattern (≥25 files); use `DATABASE_URL` + PG seed scripts
- `scripts/deploy_post_v3.sh` — skip hub sqlite sync block or gate on file exists
- `scripts/backup_ptt_data.sh` — PG dump only; sqlite section optional/deprecated

- [ ] Smoke one playwright script against staging với PG
- [ ] Commit: `Point local and E2E scripts at PostgreSQL instead of SQLite.`

---

### Task 21: Definition of done + VPS deploy

**DoD grep (must be 0 matches):**

```bash
rg -n 'DatabaseSync|node:sqlite|SqliteRepository|sqlite3\.connect|PTT_SQLITE_PATH' \
  services/ptt-crm-api/src ptt_crm ptt_jobs handlers \
  --glob '!*spec.ts' --glob '!*test*'
```

**VPS checklist:**

| # | Check | Pass |
|---|-------|------|
| 1 | `git rev-parse HEAD` = origin/main | |
| 2 | `curl /health` → postgres true, sqlite false/absent | |
| 3 | Staff, Leads, Funnel, Contract, Lifecycle | |
| 4 | KPI, Finance, Payroll | |
| 5 | B2B lead #5 `/crm/b2b/leads` | |
| 6 | Facebook sync / webhook ingest job | |
| 7 | SEO handoff endpoint | |
| 8 | `./scripts/crm_no_sqlite_gate.sh` on VPS tree | |

Deploy:

```bash
ssh deploy@rs.pttads.vn 'cd /var/www/rnosai && git fetch && git reset --hard origin/main && \
  cd services/ptt-crm-api && npm ci && npm run build && \
  sudo systemctl restart ptt-crm-api ptt-worker && \
  curl -sf http://127.0.0.1:3000/health'
```

- [ ] Document results in `.superpowers/sdd/wave2-smoke-report.md`
- [ ] Commit smoke report (optional)

---

## Phụ lục: Rủi ro đã biết (Wave 1 review)

| Rủi ro | Task xử lý |
|--------|------------|
| Invoice/order number race (concurrent create) | Task 9 follow-up fix advisory lock / sequence |
| `ensureSchema` cache rejected promise | Task 12+ — reset `schemaReady` on catch (optional W2.1) |
| Playwright scripts break without sqlite seed | Task 20 |
| Payroll chưa từng chạy PG prod | Task 13 + VPS flag |

## Self-review

- 12 dual module + W1 delete + AI + lifecycle + Python + SEO + config + CI + E2E + DoD — đủ scope Wave 2 từ plan W1
- Thứ tự dependency staff → leads → funnel → kpi/finance → lifecycle → payroll
- Payroll và SEO ghi rõ default/env khác biệt
- CI gate skeleton Task 0, full enforce Task 19
- Không placeholder TBD

# MKT-AI Planner Phase 4 — Kế hoạch triển khai chi tiết (GA & Scale)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) hoặc `superpowers:executing-plans` để thực thi từng workstream. Mỗi WS có exit criteria và trace UC.

**Goal:** Hoàn tất **GA module MKT-AI Planner** sau Phase 3 — sign-off P0…P3, mở rộng pilot slug, async multi-agent, portal summary read-only, vận hành production với monitoring + rollback rõ ràng.

**Architecture:** Giữ `MarketingAiPlannerModule` monolith Nest (không RNOS-31 global orchestrator MVP); thêm **async job runner** cho pipeline dài; mở rộng flags GA; FE portal card read-only; playbook seed multi-slug; UAT/regression shell scripts P0…P3.

**Tech stack:** NestJS (`ptt-crm-api`), Next.js (`ops-web` + `portal-web` nếu có), PostgreSQL (`mkt_ai_jobs` + optional `parent_job_id`), `ptt-worker` hoặc Nest `@Cron`/BullMQ pattern hiện có, env flags, RBAC, staff notifications.

## Global Constraints

- **Human-in-the-loop (BR-MKTP-01):** GA không bật auto-publish campaign; portal chỉ **read-only summary**.
- **Không auto-advance stage (BR-MKTP-02):** Mọi WS P4 giữ nguyên workflow gate SVC-UC-001.
- **Audit jobs (BR-MKTP-03):** Async pipeline vẫn parent + child rows; worker cập nhật status, không xóa audit.
- **Pilot → GA:** Mở slug whitelist có rollback flag; không hard-delete dữ liệu lifecycle.
- **API route:** `api/crm/service-lifecycle/:id/ai-planner/*` — không đổi prefix.
- **Naming:** Integration spec §1.3 gọi multi-agent/playbook là **「Phase 4 UX」** — đã ship ở **module Phase 3** (`9c7e6c8`). **Kế hoach này = module Phase 4 (tuần 21+)** — GA & scale, **không** trùng P3.

---

## 0. Phạm vi & định danh Phase

| Module phase | UC / WS | Trạng thái staging (2026-08-08) |
|--------------|---------|----------------------------------|
| P0 MVP | MKTP-UC-001…010 | ✅ Shipped |
| P1 Collab | MKTP-UC-011…015 | ✅ Shipped |
| P2 KPI | MKTP-UC-016…018 | ✅ Shipped (`4aaddb4`…`5fd93c8`) |
| P3 Enterprise | MKTP-UC-019…021, WS-P3-01…03 | ✅ Shipped (`13eec63`, `9c7e6c8`) |
| **P4 GA & Scale** | MKTP-UC-022…025 (mới) | ❌ Chưa có plan/doc |

**Timeline đề xuất:** Tuần 21–28 (8 tuần · 4 workstream chính + hardening).

---

## 1. Baseline sau Phase 3

### 1.1. Đã có (tái sử dụng)

| Layer | Artifact | Ghi chú |
|-------|----------|---------|
| Multi-agent | `MarketingAiMultiAgentService` | Sync 4 bước; parent `multi_agent` + child refs |
| Playbooks | 3 JSON + `MarketingAiPlaybookService` | meta-lead-gen, bds-lead-gen, seo-retainer |
| Governance | `AiGovernanceBanner` + `governance{}` context | Sticky; Launch QA gate bridge |
| Launch QA gate | `lifecycle-launch-qa.service.ts` | 409 `mkt_ai_quality_launch_qa_gate` |
| Deploy | `deploy_mkt_ai_planner_staging.sh` | Flags P3 đầy đủ |
| Smoke | `smoke_mkt_ai_planner_context.sh` | + governance block check |
| UAT P0 | `run_mkt_ai_planner_uat.sh` | 21 bước API — **chưa** cover P1…P3 |
| Staging | `rs.pttads.vn` lifecycle `#1` | slug `meta-lead-gen`, onboard |

### 1.2. Gap Phase 4

| Gap | UC / EC | Blocker |
|-----|---------|---------|
| Phase 3 PO sign-off checklist | P3 DoD §11 | High |
| Full regression P0…P3 automated | EC-01…07 + UC-019…021 | High |
| GA slug whitelist removal / multi-slug | Pilot → prod | High |
| Async multi-agent (504 / UX timeout) | MKTP-UC-022 | High |
| Job panel parent/child grouping | UX §10 | Medium |
| Portal read-only plan summary | Integration §1.4 | Medium |
| Playbook seed lifecycles BĐS/SEO | UAT multi-slug | Medium |
| Prod monitoring + alerts job fail rate | Rollout §10 | Medium |
| `run_mkt_ai_planner_uat.sh` P1…P3 blocks | QA debt | Medium |
| RNOS-31 orchestrator bridge | Stretch P4.2 | Low |

---

## 2. UC mới Phase 4 (đề xuất PO)

| ID | Tên | Priority | Workstream |
|----|-----|----------|------------|
| **MKTP-UC-022** | Async multi-agent pipeline | P1 | WS-P4-02 |
| **MKTP-UC-023** | Portal plan summary read-only | P2 | WS-P4-03 |
| **MKTP-UC-024** | GA multi-slug rollout | P0 | WS-P4-01 |
| **MKTP-UC-025** | Ops monitoring & job SLO | P1 | WS-P4-04 |

> PO chốt ID trước sprint 1; cập nhật `10-MKT-AI-PLANNER.md` + BA matrix khi freeze.

---

## 3. Kiến trúc Phase 4

```mermaid
flowchart TB
  subgraph fe [ops-web / portal]
    PANEL[MarketingAiPlannerPanel]
    JOB[AiJobProgressPanel grouped]
    PORTAL[MktAiPlanSummaryCard]
  end
  subgraph api [ptt-crm-api]
    MA[MarketingAiMultiAgentService]
    WRK[MktAiJobWorkerService]
    CTX[getContext + governance]
  end
  subgraph data [PostgreSQL]
    JOBS[(mkt_ai_jobs)]
  end
  subgraph worker [ptt-worker / timer]
    POLL[poll pending multi_agent]
  end

  PANEL -->|POST multi-agent async| MA
  MA -->|create parent pending| JOBS
  WRK -->|run steps| JOBS
  POLL --> WRK
  PANEL -->|poll context 2s| CTX
  PORTAL -->|GET summary| CTX
  JOB --> JOBS
```

### 3.1. Async multi-agent model (MKTP-UC-022)

**Hiện tại (P3):** `POST jobs/multi-agent` chạy **sync** 4 LLM calls trong 1 HTTP request.

**P4 thay đổi:**

```typescript
interface MktAiMultiAgentAsyncBody extends MktAiMultiAgentBody {
  async?: boolean; // default true when PTT_MKT_AI_MULTI_AGENT_ASYNC=1
}

interface MktAiMultiAgentAsyncResult {
  ok: boolean;
  job_id: number;
  status: 'pending' | 'running' | 'succeeded' | 'partial' | 'failed';
  poll_url?: string; // GET context or GET multi-agent/status
}
```

**Flow:**

1. `POST multi-agent` → parent `status=pending` → HTTP **202** + `job_id` (async mode).
2. Worker picks parent → `running` → chạy từng child step (reuse `runStep`).
3. FE poll `GET context` hoặc `GET multi-agent/status` mỗi 2s (reuse job panel pattern).
4. Sync mode giữ làm fallback khi `async=false` hoặc flag off.

**DDL optional (P4.1):**

```sql
ALTER TABLE mkt_ai_jobs ADD COLUMN IF NOT EXISTS parent_job_id BIGINT REFERENCES mkt_ai_jobs(id);
CREATE INDEX IF NOT EXISTS idx_mkt_ai_jobs_parent ON mkt_ai_jobs(parent_job_id);
```

Child rows ghi `parent_job_id` thay vì chỉ `output_json.child_jobs[]` — dual-write transition.

---

## 4. Workstream WS-P4-01 — Sign-off P3 & GA slug rollout (MKTP-UC-024)

**Exit:** PO ký Phase 3; staging chạy `meta-lead-gen` + `bds-lead-gen` + `seo-retainer`; prod pilot 1 client với rollback ≤5 phút.

### 4.1. Tasks

| # | Task | Done when |
|---|------|-----------|
| P4-01-T1 | Chạy manual UAT UC-019…021 trên staging | Checklist signed |
| P4-01-T2 | Regression P0 walkthrough + P2 dashboard smoke | Exit 0 |
| P4-01-T3 | Seed lifecycle `#2` bds, `#3` seo | `seed_mkt_ai_uat_lifecycle.sh` extend |
| P4-01-T4 | `PTT_MKT_AI_PLANNER_SLUGS=meta-lead-gen,bds-lead-gen,seo-retainer` staging | 3 slug context 200 |
| P4-01-T5 | Doc `mkt-ai-phase3-signoff.md` + BA matrix status Implemented | Doc merged |
| P4-01-T6 | Prod env template `deploy/env.mkt-ai-ga.example` | DevOps review |
| P4-01-T7 | Pilot prod: 1 lifecycle, flags on, monitor 7 ngày | `deploy_mkt_ai_planner_prod_pilot.sh` + runbook |

### 4.2. Files

| Action | Path |
|--------|------|
| Create | `docs/runbooks/mkt-ai-phase3-signoff.md` |
| Modify | `scripts/seed_mkt_ai_uat_lifecycle.sh` |
| Modify | `docs/specs/modules/RNOSAI-BA-MKTP-UseCases.md` — status P3 |
| Modify | `scripts/deploy_mkt_ai_planner_staging.sh` — 3 slugs |
| Create | `deploy/env.mkt-ai-prod-pilot.example` |
| Create | `docs/runbooks/mkt-ai-prod-pilot-checklist.md` |
| Create | `scripts/deploy_mkt_ai_planner_prod_pilot.sh` |
| Create | `scripts/mkt_ai_prod_pilot_gate.sh` |
| Create | `scripts/mkt_ai_prod_pilot_monitor.sh` |
| Create | `scripts/mkt_ai_prod_pilot_rollback.sh` |
| Create | `scripts/verify_mkt_ai_pilot_lifecycle.sh` |
| Create | `deploy/mkt-ai-prod-pilot-signoff.template.json` |

### 4.3. GA flags matrix

| Flag | Staging | Prod pilot | Prod GA |
|------|---------|------------|---------|
| `PTT_MKT_AI_PLANNER_ENABLED` | 1 | 1 | 1 |
| `PTT_MKT_AI_PLANNER_SLUGS` | 3 slugs | 1 slug | empty = all |
| `PTT_MKT_AI_MULTI_AGENT_ENABLED` | 1 | 1 | 1 |
| `PTT_MKT_AI_PLAYBOOKS_ENABLED` | 1 | 1 | 1 |
| `PTT_MKT_AI_GOVERNANCE_BANNER` | 1 | 1 | 1 |
| `PTT_MKT_AI_LAUNCH_QA_QUALITY_GATE` | 1 | opt-in | opt-in |
| `NEXT_PUBLIC_MKT_AI_PLANNER` | 1 | 1 | 1 |

**Rollback:** Set `PTT_MKT_AI_PLANNER_ENABLED=0` + rebuild ops-web → tab hidden; API 404 `mkt_ai_planner_disabled`.

---

## 5. Workstream WS-P4-02 — Async multi-agent (MKTP-UC-022)

**Exit:** `POST multi-agent` async → HTTP 202 → worker hoàn tất ≤10 phút stub / ≤5 phút LLM → FE pipeline visual cập nhật qua poll; không 504 gateway timeout.

### 5.1. API contract

**`POST .../jobs/multi-agent`** (extend body):

```typescript
{ async?: boolean; pipeline_key?; playbook_slug?; steps?; start_from_step?; stop_on_failure? }
```

**Responses:**

| Mode | HTTP | Body |
|------|------|------|
| Sync (legacy) | 200 | `MktAiMultiAgentResult` (P3) |
| Async | 202 | `{ ok, job_id, status: 'pending', output: null }` |

**`GET .../multi-agent/status`** — thêm `parent_status`, `current_step`, `progress_pct`.

### 5.2. Files

| Action | Path |
|--------|------|
| Create | `marketing-ai-job-worker.service.ts` — poll + execute parent jobs |
| Create | `marketing-ai-job-worker.service.spec.ts` |
| Modify | `marketing-ai-multi-agent.service.ts` — split enqueue vs execute |
| Modify | `marketing-ai-planner.controller.ts` — 202 async |
| Modify | `marketing-ai-planner.module.ts` — register worker |
| Modify | `marketing-ai-planner.types.ts` |
| Optional DDL | `docs/specs/2026-08-08-postgresql-ddl-mkt-ai-planner-p4.sql` |
| Create | `scripts/smoke_mkt_ai_multi_agent_async.sh` |
| Modify | `AiAgentPipelinePicker.tsx` — poll after async POST |
| Modify | `AiJobProgressPanel.tsx` — parent/child grouping (WS-P4-02b) |

### 5.3. Worker placement (chọn 1 — PO/DevOps)

| Option | Pros | Cons |
|--------|------|------|
| **A — Nest `@Interval` trong `ptt-crm-api`** | Ít moving parts | API process load |
| **B — `ptt-worker` timer script** | Tách load | Thêm deploy unit |
| **C — BullMQ + Redis** | Scale | Infra mới |

**Recommended P4:** Option **A** MVP (5 phút interval + immediate trigger sau POST); Option B nếu API CPU cao sau pilot.

### 5.4. Tasks (8 ngày)

| # | Task | Done when |
|---|------|-----------|
| P4-02-T1 | Refactor `executePipeline()` tách khỏi HTTP | Jest |
| P4-02-T2 | Enqueue parent `pending` + 409 if running | Jest |
| P4-02-T3 | Worker tick executes steps | Integration test |
| P4-02-T4 | Controller 202 + flag `PTT_MKT_AI_MULTI_AGENT_ASYNC=1` | curl |
| P4-02-T5 | FE poll + disable double-submit | UI staging |
| P4-02-T6 | Partial failure EC-MKT-AI-05 async | Manual |
| P4-02-T7 | Smoke script async | Exit 0 |
| P4-02-T8 | UAT MKTP-UC-022 in actions doc | Doc |

### 5.5. Env

```
PTT_MKT_AI_MULTI_AGENT_ASYNC=1   # default async on staging after UAT
```

---

## 6. Workstream WS-P4-03 — Portal plan summary (MKTP-UC-023)

**Exit:** Client portal (hoặc staff preview) xem **read-only** tóm tắt kế hoạch AI — không generate/apply.

### 6.1. API

**`GET /api/v1/portal/service-lifecycle/:id/ai-planner/summary`** (portal JWT)

```typescript
interface MktAiPortalSummary {
  ok: boolean;
  lifecycle_id: number;
  service_slug: string;
  brand_name: string | null;
  quality_score: number | null;
  playbook_label: string | null;
  strategy_excerpt: string;      // first 500 chars market_context
  campaign_count: number;
  last_updated_at: string;
  staff_planner_url: string;     // deep link ops-web
}
```

**Guard:** Portal auth + lifecycle `agency_client_id` match; **no** draft JSON full export.

### 6.2. FE

| Component | Path |
|-----------|------|
| `MktAiPlanSummaryCard.tsx` | `portal-web` hoặc embed ops-web client tab |
| Wire | Service delivery client view nếu có |

### 6.3. Tasks (5 ngày)

| # | Task |
|---|------|
| P4-03-T1 | Portal controller + guard |
| P4-03-T2 | Summary mapper từ brief + draft (redacted) |
| P4-03-T3 | FE card + link staff planner |
| P4-03-T4 | Flag `PTT_MKT_AI_PORTAL_SUMMARY=1` |
| P4-03-T5 | UAT MKTP-UC-023 |

> **Out of scope P4:** Client edit brief, client approve export, full wizard on portal.

---

## 7. Workstream WS-P4-04 — Ops monitoring & UAT automation (MKTP-UC-025)

**Exit:** Dashboard nội bộ hoặc log query job fail rate; UAT script cover P1…P3 blocks; weekly cron report.

### 7.1. Monitoring

| Metric | Source | Alert |
|--------|--------|-------|
| `mkt_ai_job_failed` by `job_type` | PG query / log | Slack/email nếu >5%/h |
| Multi-agent p95 latency | `latency_ms` parent jobs | >120s staging |
| Apply → gate pass ratio | join lifecycle validation | <70% UX-MKT-02 |
| Export count | `mkt_ai_exports` | anomaly |

**Deliverable:** `scripts/report_mkt_ai_ops_weekly.sh` → markdown `docs/exports/mkt-ai-ops-*.md`

### 7.2. UAT script extension

Extend `run_mkt_ai_planner_uat.sh`:

| Block | Steps | API |
|-------|-------|-----|
| P1 RAG | upload doc stub | POST documents |
| P1 Budget | simulate | POST budget-simulate |
| P2 Dashboard | GET dashboard p95 | timing assert |
| P3 Multi-agent | POST multi-agent async | parent + ≥4 children |
| P3 Playbook | POST apply playbook | brief prefill |
| P3 Governance | context governance block | assert flags |

**New:** `scripts/run_mkt_ai_planner_full_regression.sh` — orchestrates P0 UAT + smokes.

### 7.3. Files

| Action | Path |
|--------|------|
| Create | `scripts/report_mkt_ai_ops_weekly.sh` |
| Create | `scripts/run_mkt_ai_planner_full_regression.sh` |
| Modify | `scripts/run_mkt_ai_planner_uat.sh` |
| Modify | `docs/runbooks/mkt-ai-planner-delivery-sop.md` — §Phase 4 GA |
| Create | `docs/runbooks/mkt-ai-planner-ga-rollout.md` |

---

## 8. Workstream WS-P4-05 — Job panel UX polish (P4.2)

**Exit:** Job panel group child jobs dưới parent **Pipeline AI · parent**; collapse/expand; filter orphan jobs.

| # | Task | File |
|---|------|------|
| P4-05-T1 | Group by `parent_job_id` or parse `output_json.child_jobs` | `AiJobProgressPanel.tsx` |
| P4-05-T2 | Badge running step on parent row | same |
| P4-05-T3 | Mobile accordion parent first | `mkt-ai-planner.module.css` |

**Estimate:** 3 ngày FE.

---

## 9. Workstream WS-P4-06 — Playbook ops (optional P4.1)

**Exit:** DevOps có thể thêm/sửa playbook JSON qua PR + verify script; không cần admin UI MVP.

| # | Task |
|---|------|
| P4-06-T1 | `scripts/verify_mkt_ai_playbooks.sh` — schema validate 3+ files |
| P4-06-T2 | Runbook §playbook PR checklist |
| P4-06-T3 | (Stretch) Admin read-only list `GET /admin/mkt-ai/playbooks` |

---

## 10. Stretch — RNOS-31 orchestrator bridge (P4.3, optional)

**Out of scope MVP P4** — chỉ khi PO yêu cầu unified trace.

| Task | Mô tả |
|------|--------|
| Read-only link enrichment | Parent job → `ai_agent_runs` graph id |
| Admin agents page | Filter `plan=mkt_ai` pre-filled (đã có link FE) |
| No circular import | Không inject `AiIntelligenceModule` vào planner (P3 note) |

Ref: `docs/superpowers/plans/2026-07-27-r4-rnos31-33-implementation-plan.md`

---

## 11. Lộ trình 8 tuần

| Tuần | Focus | Deliverables | Exit |
|------|-------|--------------|------|
| **S1 (W21)** | WS-P4-01 sign-off + seed multi-slug | Phase 3 sign-off doc, 3 slug staging | PO P3 signed |
| **S2 (W22)** | WS-P4-02 BE async core | Worker + 202 API | curl async OK |
| **S3 (W23)** | WS-P4-02 FE poll + job grouping | Async UI + panel groups | UC-022 partial |
| **S4 (W24)** | WS-P4-04 UAT automation | Full regression script | CI/staging nightly |
| **S5 (W25)** | WS-P4-03 portal summary | Portal API + card | UC-023 |
| **S6 (W26)** | WS-P4-04 monitoring + GA runbook | Weekly ops report | UC-025 |
| **S7 (W27)** | Prod pilot 1 client | Flags prod, monitor | No rollback |
| **S8 (W28)** | GA all slugs + PO sign-off P4 | Remove whitelist prod | Module GA |

**Song song mỗi sprint:** Regression P0 smoke; không break KPI alert timer (`PTT_MKT_AI_KPI_ALERT_ENABLED`).

---

## 12. Chiến lược test

| Level | Scope | Command |
|-------|-------|---------|
| Unit BE | async util, worker state machine | `npm test -- marketing-ai-multi-agent` |
| Unit BE | portal summary mapper | `npm test -- mkt-ai-portal-summary` |
| Integration | async POST → worker → status | Jest + PG |
| API | curl guards + 202 | smoke scripts |
| E2E manual | UC-022 async pipeline | staging lifecycle #1 |
| E2E manual | UC-023 portal card | portal JWT |
| Regression | P0…P3 | `run_mkt_ai_planner_full_regression.sh` |
| Perf | async không block HTTP >2s | k6 optional |
| Visual | Job panel grouping VQ-05 | Design QA |

---

## 13. Env & rollout Phase 4

| Flag | Mục đích | Staging | Prod GA |
|------|----------|---------|---------|
| `PTT_MKT_AI_MULTI_AGENT_ASYNC=1` | Async pipeline | ✅ sau UAT | ✅ |
| `PTT_MKT_AI_PORTAL_SUMMARY=1` | Portal card | ✅ | opt-in |
| `PTT_MKT_AI_PLANNER_SLUGS` | Pilot whitelist | 3 slugs | **empty** |
| `PTT_MKT_AI_OPS_WEEKLY_REPORT=1` | Cron report | ✅ | ✅ |

**Deploy checklist (mỗi WS):**

```bash
cd /var/www/rnosai && git pull --ff-only origin main
cd services/ptt-crm-api && npm ci && npm run build
sudo systemctl restart ptt-crm-api
# optional: restart ptt-worker if async worker option B
./scripts/deploy_ops_web.sh && sudo systemctl restart ptt-ops-web
LIFECYCLE_ID=1 bash scripts/smoke_mkt_ai_planner_context.sh
bash scripts/run_mkt_ai_planner_full_regression.sh   # after WS-P4-04
```

---

## 14. Rủi ro & phụ thuộc

| Rủi ro | Mitigation |
|--------|------------|
| Async worker crash mid-pipeline | Parent `failed` + partial child refs; retry `start_from_step` |
| Duplicate worker execution | Row lock `FOR UPDATE SKIP LOCKED` on parent pending |
| Portal data leak | Summary redaction; no full draft; portal scope guard |
| GA slug explosion support load | Staged rollout bds → seo → all |
| UAT script flake on LLM | Stub mode default staging |
| Prod 504 trước async ship | **Block GA multi-agent** until WS-P4-02 done |

**Phụ thuộc PO:**

- Chốt async vs sync default prod
- Chốt portal summary fields (PII redaction)
- Chốt GA date + pilot client list
- Chốt có/không RNOS-31 stretch

---

## 15. Definition of Done — Phase 4 (GA)

- [ ] MKTP-UC-022: Async multi-agent — no 504; poll UX OK
- [ ] MKTP-UC-023: Portal summary read-only shipped (flag on)
- [ ] MKTP-UC-024: ≥3 service_slug trên staging; prod pilot ≥1 client
- [ ] MKTP-UC-025: Weekly ops report + job fail alert
- [ ] Phase 3 sign-off doc signed
- [ ] `run_mkt_ai_planner_full_regression.sh` exit 0 staging
- [ ] BA matrix P0…P3 → **Implemented**; P4 → **Implemented**
- [ ] `10-MKTP-ACTIONS.md` UC-022…025 walkthrough
- [ ] Prod rollback drill documented & tested
- [ ] PO + Solution lead GA sign-off

---

## 16. Traceability nhanh

| WS | UC | SCR | API | FE | Ops |
|----|-----|-----|-----|-----|-----|
| P4-01 | MKTP-UC-024 | — | flags/slug | tab visible | GA runbook |
| P4-02 | MKTP-UC-022 | SCR-MKT-AI-040 | POST multi-agent async | poll pipeline | worker |
| P4-03 | MKTP-UC-023 | SCR-PORTAL-* | GET portal summary | SummaryCard | portal JWT |
| P4-04 | MKTP-UC-025 | — | metrics query | — | weekly report |
| P4-05 | — | SCR-MKT-AI-003 | — | JobPanel group | — |
| P4-06 | MKTP-UC-020 ext | — | verify playbooks | — | PR checklist |

---

## 17. Thứ tự triển khai đề xuất (agent)

1. **WS-P4-01** — Sign-off P3 + multi-slug seed (unblock GA narrative)
2. **WS-P4-02** — Async multi-agent BE → FE (blocker prod scale)
3. **WS-P4-05** — Job panel grouping (UX debt, song song FE)
4. **WS-P4-04** — UAT automation + monitoring (quality gate GA)
5. **WS-P4-03** — Portal summary (independent)
6. **WS-P4-06** — Playbook ops polish
7. Prod pilot → GA whitelist removal
8. PO sign-off Phase 4

Mỗi WS: tests → service → controller → FE → smoke → deploy staging → cập nhật `10-MKTP-ACTIONS.md`.

---

## 18. Liên kết tài liệu

| Tài liệu | Path |
|----------|------|
| Phase 3 plan (baseline) | [`2026-08-08-mkt-ai-planner-phase3.md`](./2026-08-08-mkt-ai-planner-phase3.md) |
| Module master | [`2026-08-08-mkt-ai-planner-module.md`](./2026-08-08-mkt-ai-planner-module.md) |
| Integration spec | [`docs/specs/2026-08-08-mkt-ai-planner-integration-spec.md`](../../specs/2026-08-08-mkt-ai-planner-integration-spec.md) |
| UAT actions | [`docs/use-cases/actions/10-MKTP-ACTIONS.md`](../../use-cases/actions/10-MKTP-ACTIONS.md) |
| Delivery SOP | [`docs/runbooks/mkt-ai-planner-delivery-sop.md`](../../runbooks/mkt-ai-planner-delivery-sop.md) |
| Staging deploy | [`scripts/deploy_mkt_ai_planner_staging.sh`](../../../scripts/deploy_mkt_ai_planner_staging.sh) |

---

*Plan v1.0 — 2026-08-08. Module Phase 4 = GA & Scale (tuần 21+). Cập nhật sprint status khi mỗi WS đóng.*

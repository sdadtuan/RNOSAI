# Runbook — AI Marketing Planner (Triển khai DV)

> **Module:** MarketingAiPlannerModule · **Plan:** [`docs/superpowers/plans/2026-08-08-mkt-ai-planner-module.md`](../superpowers/plans/2026-08-08-mkt-ai-planner-module.md)  
> **Spec:** [`docs/specs/2026-08-08-mkt-ai-planner-integration-spec.md`](../specs/2026-08-08-mkt-ai-planner-integration-spec.md)  
> **UAT:** [`docs/use-cases/actions/10-MKTP-ACTIONS.md`](../use-cases/actions/10-MKTP-ACTIONS.md)

---

## 1. Feature flags

| Flag | Layer | Required value | Effect |
|------|-------|----------------|--------|
| `PTT_MKT_AI_PLANNER_ENABLED` | API (`ptt-crm-api`) | `1` | Routes `/ai-planner/*` active |
| `PTT_MKT_AI_PLANNER_SLUGS` | API | `meta-lead-gen` (pilot) or empty (all) | Pilot whitelist |
| `PTT_MKT_AI_MODEL` | API | optional | Override LLM model |
| `NEXT_PUBLIC_MKT_AI_PLANNER` | FE (`ops-web`) | `1` | Tab **AI Planner** visible |

**Fail-closed:** FE flag off → tab hidden. API flag off → `404 mkt_ai_planner_disabled`.

---

## 2. Database (DDL)

```bash
export DATABASE_URL=postgresql://USER:PASS@HOST:5432/DB
./scripts/apply_pg_ddl_mkt_ai_planner.sh
./scripts/verify_mkt_ai_ddl.sh
```

Expected: 11 tables + `schema_migrations` row `2026-08-08-mkt-ai-planner`.

**Rollback (dev only):** drop tables in reverse dependency order — không chạy trên staging/prod.

---

## 3. RBAC pilot matrix

| Role | Caps |
|------|------|
| Solution Strategist | `crm_board.view`, `crm_board.edit`, `crm_mkt_ai.generate`, `crm_mkt_ai.export` |
| Account Manager | `crm_board.view`, `crm_mkt_ai.view` |
| MKT Lead | + `crm_mkt_ai.approve` (Phase 2 export gate) |

Gán qua **Admin → CRM Permissions** (`/admin/crm/permissions`), section **Triển khai DV — AI Marketing Planner** (`crm_mkt_ai`).

---

## 4. Smoke test

```bash
# API enabled
export PTT_MKT_AI_PLANNER_ENABLED=1
export PTT_MKT_AI_PLANNER_SLUGS=meta-lead-gen

# Login SP → copy JWT
export STAFF_JWT=eyJ...
export LIFECYCLE_ID=123
./scripts/smoke_mkt_ai_planner_context.sh
```

---

## 5. UAT lifecycle test data

Chuẩn bị lifecycle UAT (ref `#123`):

- Stage: `onboard`
- `service_slug`: `meta-lead-gen` (hoặc slug trong pilot list)
- **Official marketing plan** đã promote từ presales R5 (`marketing_plan_id` not null)
- Assigned SP có cap generate

Walkthrough 21 bước: `10-MKTP-ACTIONS.md` §Walkthrough.

---

## 6. Local dev quickstart

```bash
# Terminal 1 — API
cd services/ptt-crm-api
export PTT_MKT_AI_PLANNER_ENABLED=1
npm run start:dev

# Terminal 2 — FE
cd services/ops-web
export NEXT_PUBLIC_MKT_AI_PLANNER=1
export NEXT_PUBLIC_PTT_API_URL=http://127.0.0.1:3000
npm run dev
```

Open: `http://127.0.0.1:3200/crm/service-delivery/{id}?tab=ai-planner&step=brief`

---

## 7. Monitoring

| Signal | Where |
|--------|-------|
| Job failures | `mkt_ai_jobs.status=failed` |
| AI audit | `ai_agent_runs` `agent_name=mkt_ai_planner` |
| Exports | `mkt_ai_exports` |
| Apply → gate pass rate | Compare `tmmt_validation.ok` before/after apply |

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Tab không hiện | FE flag off hoặc thiếu cap | `NEXT_PUBLIC_MKT_AI_PLANNER=1` + `crm_mkt_ai.view/generate` |
| 404 disabled | API flag off | `PTT_MKT_AI_PLANNER_ENABLED=1` |
| 403 slug | Pilot whitelist | Add slug to `PTT_MKT_AI_PLANNER_SLUGS` |
| Apply 409 | No official plan | Promote presales R5 → TMMT official |
| Stub banner | No OpenAI key | Expected BR-MKTP-08; set LLM key for real generation |
| Data not persisted | DDL not applied | Run apply + verify scripts |

---

*S1 deliverable — cập nhật khi S2+ ship.*

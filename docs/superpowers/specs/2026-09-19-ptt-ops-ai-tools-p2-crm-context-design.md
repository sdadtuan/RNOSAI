# PTT Ops AI Tools P2 — CrmContextPack Read

**Date:** 2026-09-19  
**SRS:** PO-10–13, AP1–AP2, lộ trình P2  
**Depends on:** P1 (`2026-09-19-ptt-ops-ai-tools-p1-design.md`)

## Goal

Read tools trả **live** `CrmContextPack` (plan / service delivery / delivery project / KPI campaigns) thay stub P1.

## Contract

Input (mọi `*.read`):

```json
{ "client_id": "uuid?", "lifecycle_id": 1, "plan_id": 1, "project_id": "uuid?" }
```

Ít nhất một trong: `client_id` | `lifecycle_id` | `plan_id` | `project_id`.

Output: SRS §8.1 `CrmContextPack` + `wired: true`, `tool`, `ok`. Không PII (SĐT/email).

## Resolution

1. Resolve lifecycle: explicit `lifecycle_id` → else plan.lifecycle_id → else project.lifecycle_id → else primary lifecycle via `crm_contracts.agency_client_id = client_id`.
2. Client: from `clients` by `client_id`, else from contract on lifecycle.
3. Marketing plan: `plan_id` or `lifecycle.marketing_plan_id` or latest plan by `lifecycle_id`.
4. Service delivery: lifecycle stage + open `crm_svc_tasks` (`is_done = false`).
5. Delivery project: by `project_id` or `lifecycle_id` on `crm_delivery_projects`.
6. Campaigns/KPI: `crm_marketing_plan_campaigns` + plan `success_metrics_json` (quoted/actual best-effort).

`known` / `assumed` / `unknown` / `links` filled from what resolved.

## Files

- `ops-crm-context.types.ts` — pack types
- `ops-crm-context.repository.ts` — PG queries
- `ops-crm-context.service.ts` — build pack
- `ops-context.tools.ts` — inject service into read handlers
- Wire in `ai-intelligence.module` + `ToolRegistry`

## Acceptance

- `marketing_plan.read` với `plan_id` hoặc `lifecycle_id` có sẵn → pack có `marketing_plan.id` + milestones
- `service_delivery.read` → `stage` + `open_tasks`
- `delivery_project.read` → health khi có project
- `kpi_campaign.read` → `campaigns[]` (có thể rỗng + `unknown`)
- Không leak phone/email

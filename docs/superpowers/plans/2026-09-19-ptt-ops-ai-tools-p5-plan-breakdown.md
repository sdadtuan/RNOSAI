# PTT Ops AI Tools P5 — Plan breakdown to roles

**Date:** 2026-09-19  
**SPEC:** `/Users/quoctuan/Downloads/SPEC-plan-breakdown-to-roles.md`  
**Depends on:** P2 `marketing_plan.read`, P3 `task.create_draft`

## Goal

Ship `OpsPlanBreakdownService` + tool `plan.breakdown_to_roles`:
- Dry-run default (`persist_tasks=false`) — role KPI matrix, **no fake numeric KPIs**
- `persist_tasks=true` → P3 `task.create_draft` per line (requires `X-AI-Human-Approved: 1`)
- Plan must be `active` (or `review` + `allow_review=true`)

## Matrix mapping (notes → roles)

| role_key | Deliverables (template) | KPI names (target null unless parsed) |
|----------|-------------------------|----------------------------------------|
| `am` | Script tư vấn, nurture, retain | lead_to_booking_pct, follow_up_sla_hours |
| `graphic` | KV, before_after_stills, banners | assets_on_brief, turnaround_sla_hours |
| `content` | Captions, FAQ, trust posts | posts_or_pillars, faq_shipped |
| `video` | Short before/after, FAQ clips | videos_shipped, cta_on_brief |
| `ads` | Scale/optimize campaigns | cpl, valid_leads |
| `pm` | Board hygiene, stage propose | tasks_on_time_pct, open_blockers (opt-in) |

Parser only fills `target` when notes/objectives/`success_metrics_json` contain an explicit value next to a known key (e.g. `CPL: 85000`). Otherwise `target: null` and `unknown` includes `kpi_targets_numeric` / `role.kpi`.

## Files

| Area | Path |
|------|------|
| Templates | `ops-plan-breakdown.templates.ts` |
| Types | `ops-plan-breakdown.types.ts` |
| Service + spec | `ops-plan-breakdown.service.ts` |
| Tool | `tools/ops-context.tools.ts` |
| Allowlist | `ai-tools.types.ts` + admin policies UI |
| Try sample | `AiToolKeysPanel.tsx` |

## Verify (Try tool)

Seed: plan `#8`, lifecycle `#5`.

```json
{"plan_id": 8, "persist_tasks": false, "roles": ["am","graphic","content","video","ads"]}
```

```json
{"plan_id": 8, "lifecycle_id": 5, "persist_tasks": true, "roles": ["graphic","content","video"]}
```
(+ Human approved)

## Post-ship allowlist SQL

```sql
UPDATE admin_ai_agent_policies
SET allowed_tools = (
  SELECT jsonb_agg(DISTINCT x)
  FROM jsonb_array_elements_text(
    COALESCE(allowed_tools, '[]'::jsonb) || '["plan.breakdown_to_roles"]'::jsonb
  ) AS t(x)
),
updated_at = now(),
updated_by = 'deploy-p5'
WHERE agent_code IN ('ptt-ops-strategist')
   OR agent_code LIKE 'grok-bot%';

UPDATE ai_tool_api_keys
SET allowed_tools = (
  SELECT jsonb_agg(DISTINCT x)
  FROM jsonb_array_elements_text(
    COALESCE(allowed_tools, '[]'::jsonb) || '["plan.breakdown_to_roles"]'::jsonb
  ) AS t(x)
)
WHERE is_active = true AND revoked_at IS NULL
  AND name IN ('ops-p2-smoke2', 'ops-smoke3', 'ops-smoke2', 'ops-smoke');
```

## Unit tests

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-plan-breakdown|ops-context.tools|tool.registry' --no-coverage
```

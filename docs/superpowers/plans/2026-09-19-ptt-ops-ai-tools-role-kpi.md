# PTT Ops AI Tools — Role KPI targets (write_draft + UI)

**Date:** 2026-09-19  
**SPEC:** `/Users/quoctuan/Downloads/SPEC-kpi-target-write-draft-and-role-kpi-ui.md`

## Goal

- Table `crm_role_kpi_targets` (ensureSchema)
- Tools `kpi_target.write_draft` (human approval; **never** sets `actual` / approved) + `kpi_target.read`
- UI `/crm/kpi-hub/role-kpi` — list / filter / draft→review / review→approved
- `plan.breakdown_to_roles` + `persist_kpis=true` creates draft rows
- Plan detail banner when review count &gt; 0

## Hard rules

- AI write path strips `actual_value`
- Status `approved` / `locked` only via staff UI (RBAC)
- Null target allowed → `form_data.unknown_target=true`

## Verify

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-kpi-target|ops-plan-breakdown|ops-context.tools|tool.registry' --no-coverage
```

Try tool:

```json
{
  "plan_id": 8,
  "lifecycle_id": 5,
  "role_key": "content",
  "kpi_key": "posts_shipped",
  "kpi_label": "Content pieces shipped",
  "period_start": "2026-10-01",
  "period_end": "2026-12-31",
  "target_value": 12,
  "target_unit": "count"
}
```

(+ Human approved)

```json
{"plan_id": 8, "persist_kpis": true, "roles": ["graphic","content"]}
```

## Post-ship allowlist

```sql
UPDATE admin_ai_agent_policies
SET allowed_tools = (
  SELECT jsonb_agg(DISTINCT x)
  FROM jsonb_array_elements_text(
    COALESCE(allowed_tools, '[]'::jsonb)
      || '["kpi_target.write_draft","kpi_target.read"]'::jsonb
  ) AS t(x)
),
updated_at = now(),
updated_by = 'deploy-role-kpi'
WHERE agent_code IN ('ptt-ops-strategist') OR agent_code LIKE 'grok-bot%';
```

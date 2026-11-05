# P7 agent policy + Try samples

| agent_code | Tools |
|------------|--------|
| `ptt-ops-strategist` / `ptt-ops-pm` | Full `OPS_AI_TOOL_ALLOWLIST` incl. P7 |

P7 tools (mutating → `X-AI-Human-Approved: 1`):

- `presales.autofill_tmmt`
- `insight.draft_from_presales`
- `marketing_plan.generate_review`

## Try samples (lifecycle 5)

### autofill dry_run

```json
{
  "lifecycle_id": 5,
  "lead_id": 5,
  "overwrite_mode": "fill_empty_only",
  "dry_run": true
}
```

### insight draft

```json
{
  "lifecycle_id": 5,
  "plan_id": 8,
  "client_id": "d437cc78-0757-44ba-aaa3-9ffb941121dd"
}
```

### generate review

```json
{
  "lifecycle_id": 5,
  "clone_from_plan_id": 8,
  "title": "360 AUTO DETAILING — Plan review từ presales"
}
```

Expect: plan `status=review`, gate_snapshot may fail; `plan.breakdown_to_roles` still **409** `winning_plan_gate_failed` until TMMT+insight+geo complete.

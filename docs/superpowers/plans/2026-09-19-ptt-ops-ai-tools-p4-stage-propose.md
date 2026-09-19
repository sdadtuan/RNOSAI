# PTT Ops AI Tools P4 — Stage Transition Propose (implementation plan)

**Date:** 2026-09-19  
**SRS:** `/Users/quoctuan/Downloads/SRS-PTT-Ops-P4-Stage-Propose.md`  
**Depends on:** P1–P3

## Goal

Ship `OpsStageTransitionService` + tool `service_delivery.propose_transition` (dry_run default, forward-only, DoD gate, human approval on apply). No `email.send` / `proposal.send` / `stage.transition`.

## Files

| Area | Path |
|------|------|
| Types | `ops-stage-transition.types.ts` |
| Service | `ops-stage-transition.service.ts` |
| Repo | `ops-crm-context.repository.ts` (`getLifecycleForTransition`, `countTasksByStage`, `applyLifecycleStageTransition`) |
| Tool | `tools/ops-context.tools.ts` |
| Allowlist | `ai-tools.types.ts` `OPS_AI_TOOL_ALLOWLIST` + admin policies UI |
| Try sample | `AiToolKeysPanel.tsx` |

## Verify (Try tool / curl)

Seed IDs: `lifecycle_id=5` (plan 8 / DP / client linked).

```bash
# 1) dry_run propose — no stage change, no approval required
curl -s -X POST "$API/api/v1/ai/tools/call" \
  -H "Content-Type: application/json" -H "X-AI-Tool-Key: $KEY" \
  -d '{"tool_name":"service_delivery.propose_transition","input":{"lifecycle_id":5,"dry_run":true}}'
# expect: phase=P4, status=proposed, dry_run=true

# 2) apply without approval → 403
curl -s -w "\nHTTP:%{http_code}\n" -X POST "$API/api/v1/ai/tools/call" \
  -H "Content-Type: application/json" -H "X-AI-Tool-Key: $KEY" \
  -d '{"tool_name":"service_delivery.propose_transition","input":{"lifecycle_id":5,"dry_run":false}}'
# expect HTTP 403 human_approval_required

# 3) apply with approval (DoD ok) → transitioned
curl -s -X POST "$API/api/v1/ai/tools/call" \
  -H "Content-Type: application/json" -H "X-AI-Tool-Key: $KEY" \
  -H "X-AI-Human-Approved: 1" \
  -d '{"tool_name":"service_delivery.propose_transition","input":{"lifecycle_id":5,"dry_run":false,"notes":"P4 apply"}}'
# expect: status=transitioned; then service_delivery.read shows new stage

# 4) backward / skip → 409 invalid_transition
# 5) catalog must NOT include email.send / proposal.send / stage.transition
```

## Post-ship allowlist SQL

```sql
UPDATE admin_ai_policies
SET allowed_tools = allowed_tools || '["service_delivery.propose_transition"]'::jsonb
WHERE agent_code IN ('ptt-ops-strategist')
   OR agent_code LIKE 'grok-bot%';
```

Also extend active AI tool API key `allowed_tools` with `service_delivery.propose_transition`.

## Unit tests

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='ops-stage-transition|ops-context.tools|tool.registry' --no-coverage
```

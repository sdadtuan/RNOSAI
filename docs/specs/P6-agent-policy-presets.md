# P6 agent policy presets (strategist / PM)

Use when creating Admin AI policies or AI tool API keys for Grok / ops bots.

| agent_code | Tools |
|------------|--------|
| `ptt-ops-strategist` | Full `OPS_AI_TOOL_ALLOWLIST` including `presales.context.read` |
| `ptt-ops-pm` | Same allowlist |

Source of truth in code:

```ts
import { P6_AGENT_POLICY_PRESETS } from './ai-tools.types';
```

POST `/api/v1/admin/ai/policies/:agentCode` with `allowed_tools` from the preset.
Do **not** include `email.send` / `proposal.send`.

## Try tool sample (lifecycle 5)

```json
{
  "lifecycle_id": 5,
  "lead_id": 5,
  "plan_id": 8,
  "client_id": "d437cc78-0757-44ba-aaa3-9ffb941121dd"
}
```

Expect `phase: "P6"` and `blockers_for_winning_plan` including `tmmt_gate` until TMMT + insight + geography fixed.

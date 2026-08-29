# Task 7 Report: LLM safety util + flag

**Status:** Done

**Branch:** `feat/intake-sales-kit-s3-s4`

## Deliverables

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.ts` | Created |
| `services/ptt-crm-api/src/intake/intake-sales-kit-llm.util.spec.ts` | Created |
| `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.ts` | Added `intakeSalesKitLlmEnabled` via `envFlag('PTT_INTAKE_SALES_KIT_LLM', false)` |
| `services/ptt-crm-api/src/ai-intelligence/ai-intelligence.config.spec.ts` | Flag default/parse test |
| `services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts` | Added `INTAKE_SALES_KIT`, `INTAKE_AI_SUMMARY` (kept existing `INTAKE_SALES_KIT_INGEST`) |

## Implementation

- **`assertNoInventedMoney`**: returns `false` when reply matches `/\d+\s*(tr|triệu|vnd|đ)/i` and no citation kind in `pricing|qa|case`.
- **`stripInventedMoney`**: replaces money phrases with `[số đã ẩn]`.
- **`buildKitLlmSystemPrompt`**: Vietnamese system prompt — no invented numbers/KPI/case, one idea per reply, no outbound drafts, mask phone, excerpt-only citations.
- **Flag default:** `PTT_INTAKE_SALES_KIT_LLM` defaults **off** (`false`).

## Tests

```
PASS intake-sales-kit-llm.util.spec.ts (4 tests)
PASS ai-intelligence.config.spec.ts (+1 intakeSalesKitLlmEnabled test)
```

TDD: money-guard spec written before util implementation.

## Out of scope (Task 8)

- No LLM wiring in `intake.service.ts` yet.
- `sales-kit-library.service.ts` still reads env directly; can migrate to config in Task 8.

## Concerns

- None blocking. Regex may need tuning for edge cases (e.g. `20tr` without space) in later UAT.

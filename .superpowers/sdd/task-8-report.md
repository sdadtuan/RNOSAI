# Task 8 Report: Wire LLM wording + summary + deploy S3

**Status:** DONE  
**Branch:** `feat/intake-sales-kit-s3-s4`

## Summary

Optional LLM polish on Intake Sales Kit. TDD first: `IntakeSalesKitLlmService` spec failed (`Cannot find module`), then GREEN. Flag off / no API key / `ask_library` without citations never call `completeJson` and keep the rules payload with `stub_mode: true`. Timeout (`ServiceUnavailableException`) rolls back to rules. Invented money without `pricing|qa|case` citation is stripped via `stripInventedMoney`. LLM may rewrite `reply_vi`, `apply.ai_summary`, `next_question.text` only — `next_question.key` and `bant_json` stay untouched; LLM `bant_hints` land in `apply.bant_hints` (panel still default off). Audit `ai_agent_runs` use_case `intake_sales_kit` | `intake_ai_summary`. Deploy script comments S3 flags and does **not** set them to 1.

## Files

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/intake/intake-sales-kit-llm.service.ts` | Created — `polish()` clone of LMP `completeSynthesize` |
| `services/ptt-crm-api/src/intake/intake-sales-kit-llm.service.spec.ts` | Created — flag off / money strip / timeout / empty library |
| `services/ptt-crm-api/src/intake/intake.service.ts` | Modified — `salesKitTurn` + `generateAiSummary` call `polish` |
| `services/ptt-crm-api/src/intake/intake.service.spec.ts` | Modified — inject LLM mock; empty-state skips polish |
| `services/ptt-crm-api/src/intake/intake.module.ts` | Modified — LLM service + `AiLlmClient` + `AiAgentRunsRepository` |
| `services/ptt-crm-api/src/intake/intake-sales-kit-rules.util.ts` | Modified — `stub_mode: boolean` |
| `scripts/deploy_intake_sales_kit_s4_vps.sh` | Modified — S3 flag comments; include LLM jest; no auto `=1` |
| `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` | Modified — VPS flag table |
| `docs/huong-dan-su-dung/25-lead-meeting-prep-ui-guide.md` | Modified — how to enable kit LLM |

## Tests

TDD RED:

```
FAIL Cannot find module './intake-sales-kit-llm.service'
```

After implement:

```
PASS intake-sales-kit-llm.service.spec.ts — 4/4
  ✓ does not call completeJson when flag is off
  ✓ strips invented money when flag is on and no citation
  ✓ returns rules payload when completeJson times out
  ✓ does not call LLM for ask_library without citations
PASS intake-sales-kit-llm.util.spec.ts — 4/4
PASS intake.service.spec.ts — 2/2 (empty-state skips polish)
PASS intake-sales-kit-rules.util.spec.ts
PASS sales-kit-library.service.spec.ts
```

26/26 in the related intake sales-kit pattern.

## Self-review

- Intents that may call LLM: `summary_30s`, `next_question`, `freeform`, `ask_library` (citations required).
- `pricing_band` / `battle_card` / chips without wording stay rules after library retrieve.
- Empty library returns empty-state **before** `polish`.
- `generateAiSummary` uses `AI_USE_CASE.INTAKE_AI_SUMMARY` then `saveAiSummary`.
- Local providers (not `AiIntelligenceModule` import) avoid Intake ↔ ServiceLifecycle ↔ AI cycle.

## Concerns

1. **Vision backlog** — image parse still `needs_ocr` when LLM off (UAT-17). No 1-page vision call in Task 8.
2. **No live VPS enable** — S3 flags stay 0; UAT-8 (flag on, summary not `[stub]`) needs a manual env + rebuild after deploy.
3. **Worker leak warning** on `sales-kit-library.service.spec` is pre-existing (PG pool), not from this task.

## Out of scope

- Image vision / Tesseract
- Auto-enable LLM in deploy script
- Merge `bant_hints` into `bant_json`
- Dual-write S3 storage

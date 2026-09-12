# Task 12 Report: Wave D — recommend (no AUTO)

**Date:** 2026-09-13  
**HEAD before:** `099f90c56da105030df32ff3e8aabe35abf98c66`  
**Commit:** *(filled after commit)*  
**Status:** DONE

## What was implemented

Pure util `recommendProvider` in `cp-ai-ops-route.util.ts` — priority routing with reason codes, no HTTP/submit/AUTO.

| Priority | Condition | Result |
|---|---|---|
| 1 | `humanCanvas` | `weavy` + `WEAVE_HUMAN_CANVAS` |
| 2 | `restricted \|\| needsPrivateLora` | `comfyui` + codes; throw `provider_rejected` / `PROVIDER_DOWN` if `!comfyUp` |
| 3 | `urgentPremium && magnificUp` | `magnific_mcp` + `URGENT_PREMIUM` |
| 4 | else | `weavy` + `[]` (safe default) |

Optional pane wiring (`provider_mode=recommended`) skipped — not trivial one-liner.

## TDD Evidence

### RED

```
cd services/ptt-crm-api && npm test -- src/cp/cp-ai-ops-route.util.spec.ts

FAIL — Cannot find module './cp-ai-ops-route.util'
```

### GREEN

```
cd services/ptt-crm-api && npm test -- src/cp/cp-ai-ops-route.util.spec.ts

PASS src/cp/cp-ai-ops-route.util.spec.ts
  9 passed
```

## Files

- Create: `services/ptt-crm-api/src/cp/cp-ai-ops-route.util.ts`
- Create: `services/ptt-crm-api/src/cp/cp-ai-ops-route.util.spec.ts`

## Concerns

- `urgentPremium && !magnificUp` falls through to weavy (no reject) — avoids Magnific burn per spec.
- No controller wiring yet; util only. Task 13 not started.

# Task 2.5 Report — RNOS-33 QA gate

**Status:** DONE
**Branch:** `feat/rnos-33-ai-tools`
**Date:** 2026-07-27

## Summary

Added the RNOS-33 QA gate, Python artifact tests, and Playwright coverage for
the `/admin/ai/tools` UI and scoped external tool API. Documented
`PTT_AI_TOOLS_API_ENABLED=1` and AI-UC-022, including the R4 UAT gate update.

## Deliverables

- `scripts/rnos33_ai_tools_gate.sh` verifies artifacts, endpoints, scoped-key
  governance, audit linkage, PII-safe audit metadata, unit tests, typechecks,
  Python tests, and Playwright execution/skip handling.
- `scripts/playwright_ops_ai_tools_e2e.sh` mirrors the RNOS-31 runner pattern.
- `services/ops-web/e2e/ai-tools-rnos33.spec.ts` covers the admin tools page and
  the create → allowed call → disallowed call → revoke → rejected call API flow.
- `tests/test_rnos33_ai_tools.py` validates the MCP descriptor catalog,
  allowlisting, revocation, dual audit records, feature flag, UAT docs, and gate
  check count.
- `docs/use-cases/actions/09-AI-ACTIONS.md` now includes AI-UC-022 and the R4
  gate includes 019, 021, and 022.

## Verification

```bash
bash scripts/rnos33_ai_tools_gate.sh
# 48 pass, 0 fail; exit 0
```

Playwright was intentionally reported as skipped because
`OPS_E2E_SKIP_SERVER=1`; set it to `0` with running ops-web and API servers for
the full UI/API smoke.

## Commit

`test(rnos-33): gate and UAT actions`

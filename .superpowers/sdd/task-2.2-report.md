# Task 2.2 Report — RNOS-33 Tool Registry

**Status:** DONE  
**Branch:** `feat/rnos-33-ai-tools`  
**Date:** 2026-07-27

## Summary

Implemented the RNOS-33 MCP-compatible tool registry with ten curated tools, API-key
allowlist enforcement, tenant context propagation, PII-safe lead responses, and a
tool-proxy audit wrapper for every allowed or denied tool execution attempt.

## Deliverables

### Registry and governance

- `ToolRegistry.list()` returns the ten descriptors in the plan-defined order.
- `ToolRegistry.call(name, input, context)` resolves the tool, checks the API key's
  `allowed_tools`, and executes through `AiAuditService.wrap`.
- Tool-proxy audit rows use `agent_name=ai-tool-proxy` and
  `use_case=tool_call`.
- Unknown tools return 404; tools outside the key allowlist return 403.

### Tool handlers

- `score_lead`, `route_lead` delegate through `AgentRegistry`.
- `suggest_upsell`, `get_anomaly_digest` delegate through `AgentRegistry`.
- `list_leads`, `get_lead` reuse `LeadsRepository`, enforce client scope, and omit
  name, phone, email, and external lead ID from outputs.
- `get_forecast_snapshot` reuses `AiForecastService.getDashboard`.
- `run_orchestration`, `list_orchestrations` reuse `OrchestratorService`.
- `health_check` returns tool-proxy availability metadata.

### Configuration and module wiring

- Added `AI_USE_CASE.TOOL_CALL`.
- Added `PTT_AI_TOOLS_API_ENABLED` as `toolsApiEnabled`, defaulting to `false`.
- Registered and exported `ToolRegistry` from `AiIntelligenceModule`.

## Tests

- Added registry tests covering:
  - the exact ten-tool MCP descriptor catalog;
  - disallowed API-key scope returning HTTP 403;
  - `health_check` execution through `AiAuditService` with canonical audit metadata.
- Added config coverage for the default-off tools API flag and enabled parsing.

## Verification

```bash
npm test -- --runInBand
# 119 suites passed, 5 skipped; 403 tests passed, 5 skipped

npx tsc --noEmit
# exit 0
```

The five skipped suites are existing database-gated integration tests.

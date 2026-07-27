# Task 2.3 Report — RNOS-33 Tool API and auth

**Status:** DONE  
**Branch:** `feat/rnos-33-ai-tools`  
**Date:** 2026-07-27

## Summary

Implemented the RNOS-33 REST tool API, scoped API-key/staff authentication,
in-memory per-key rate limiting, admin key lifecycle endpoints, feature-flag
enforcement, and linked `ai_tool_call_log` audit rows.

## Deliverables

### Authentication and rate limiting

- `AiToolApiKeyGuard` reads `X-AI-Tool-Key`, validates its SHA-256-backed record
  through `AiToolKeysRepository`, and attaches the scoped key to the request.
- Calls without a tool key may authenticate with a staff JWT and require
  `ai_admin.view`.
- Each key has a one-minute in-memory counter using its
  `rate_limit_per_min` value (database default: 60).
- Invalid/revoked keys return 401; exhausted rate limits return 429.

### Tool API

- `GET /api/v1/ai/tools` — staff/internal authentication plus `ai_admin.view`.
- `POST /api/v1/ai/tools/call` — scoped tool key or staff JWT with
  `ai_admin.view`.
- Both tool catalog and call routes enforce `PTT_AI_TOOLS_API_ENABLED`.
- API-key calls propagate key/client scope; staff calls receive the curated
  registry allowlist.

### Admin key API

- `POST /api/v1/admin/ai/tool-keys` creates a key and returns plaintext once.
- `GET /api/v1/admin/ai/tool-keys` returns metadata and prefix only.
- `DELETE /api/v1/admin/ai/tool-keys/:id` revokes a key.
- All admin routes use the existing staff/internal + AI admin guard pattern.

### Audit linkage and module wiring

- `AiToolsService` records succeeded and failed calls in
  `ai_tool_call_log`, including input/output, latency, key ID, and the linked
  `ai_agent_runs` ID.
- `ToolRegistry.callWithMetadata()` exposes the audit run ID while preserving
  the existing `call()` API.
- Registered the controller, service, and guard in `AiIntelligenceModule`.

## Tests

- Service tests cover feature-flag rejection, API-key/staff scope, successful
  audit logging, run linkage, and key lifecycle delegation.
- Guard tests cover key validation/attachment, 60-second rate windows, staff
  capability checks, and invalid credentials.
- Controller tests cover call context propagation and one-time plaintext key
  responses.
- Repository/registry tests cover call-log insertion and audit run linkage.

## Verification

```bash
cd services/ptt-crm-api && npm test -- --runInBand
# 122 suites passed, 5 skipped; 416 tests passed, 5 skipped

cd services/ptt-crm-api && npx tsc --noEmit
# exit 0
```

The five skipped suites are existing database-gated integration tests.

## Concern

- PostgreSQL integration remains skipped locally because `DATABASE_URL` is not
  configured for `rnosaidb`; unit coverage validates the generated call-log SQL.

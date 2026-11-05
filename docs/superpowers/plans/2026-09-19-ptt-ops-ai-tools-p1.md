# PTT Ops AI Tools P1 — Implementation Plan

> **For agentic workers:** Execute task-by-task. Spec: `docs/superpowers/specs/2026-09-19-ptt-ops-ai-tools-p1-design.md`

**Goal:** Bật AI Tools API, đăng ký tools PO-52/53, UI tạo agent policy; pass acceptance checklist.

**Architecture:** Extend existing `ai-tools/` + `admin-intelligence` + ops-web `/admin/ai/policies`.

## File map

| File | Responsibility |
|------|----------------|
| `ai-tool-keys.repository.ts` | `ensureSchema()` before writes |
| `ops-context.tools.ts` (new) | PO-52 tool definitions |
| `tool.registry.ts` | Register ops tools; deny list helper |
| `ai-tools.service.ts` | Reject banned tools on createKey |
| `admin` policies page + `policies/new` | Create UI |
| `market-research-api` / `api.ts` | `createAdminAiPolicy` helper |
| `deploy/runtime.env.example` | Document flag |
| VPS `runtime.env` | Enable flag + restart |

## Tasks

### Task 1: ensureSchema + flag docs

- [ ] Add `ensureSchema()` to `AiToolKeysRepository`; call from create/listKeys/recordCall/validateKey
- [ ] Tests for ensureSchema idempotent
- [ ] Document `PTT_AI_TOOLS_API_ENABLED=1` in runtime example

### Task 2: Register PO-52 tools + deny banned

- [ ] Create `ops-context.tools.ts` with 6 tools
- [ ] Write tools: require `humanApproved` in execution context or header
- [ ] Wire controller to pass `X-AI-Human-Approved`
- [ ] Unit tests: read OK, write without header → pending/403, banned names not in catalog

### Task 3: Policy create UI

- [ ] `POST` client helper if missing
- [ ] Page `/admin/ai/policies/new`
- [ ] Link from list page
- [ ] TOOL_OPTIONS = PO-52 names (+ existing admin chips)

### Task 4: Verify + deploy VPS

- [ ] Jest specs pass
- [ ] Apply DDL / ensureSchema on VPS, set flag, restart
- [ ] Smoke catalog 200 + create key + create policy

# PTT Ops AI Tools P1 — Design

**Date:** 2026-09-19  
**SRS:** `SRS-PTT-Ops-Module.md` PO-50–53, UC-PTT-04, lộ trình P1  
**Status:** Approved (user acceptance checklist)

## Goal

Bật AI Tools API trên RNOSAI, đăng ký tool allowlist Ops, mở UI tạo agent policy — hết `ai_tools_api_disabled` / 503 catalog / 500 tạo key.

## Non-goals (P2+)

- Live `CrmContextPack` từ Marketing Plan / Delivery / KPI (P2)
- Ghi DB thật cho draft (P3)
- Stage transition proposals (P4)

## Current state

| Issue | Cause |
|-------|--------|
| `ai_tools_api_disabled` | `PTT_AI_TOOLS_API_ENABLED` default false; VPS `runtime.env` thiếu flag |
| Catalog 503 | Cùng flag gate trong `AiToolsService.assertEnabled` |
| Create key 500 | PG thiếu `ai_tool_api_keys` / `ai_tool_call_log`; repo không `ensureSchema` |
| `/admin/ai/policies/new` 404 | Chỉ có list page; POST upsert đã có nhưng UI không tạo |

## Design

### 1. Feature flag

- Source of truth: `PTT_AI_TOOLS_API_ENABLED=1` via `deploy/runtime.env` (AppConfig loads overrides).
- Document in `runtime.env.example` / staging example.

### 2. Schema bootstrap

- `AiToolKeysRepository.ensureSchema()` áp DDL idempotent (tables + indexes + migration version) trước create/list/recordCall.
- Áp dụng cùng SQL trong `docs/specs/2026-07-27-postgresql-ddl-rnos33-ai-tools.sql`.

### 3. Tool registry (PO-52 / PO-53)

**Register (callable):**

| Name | Mutating | Behavior P1 |
|------|----------|-------------|
| `marketing_plan.read` | no | OK stub → empty `CrmContextPack`-shaped payload |
| `service_delivery.read` | no | OK stub |
| `delivery_project.read` | no | OK stub |
| `kpi_campaign.read` | no | OK stub |
| `marketing_plan.write_draft` | yes | `403` / result `pending_human_approval` unless `X-AI-Human-Approved: 1` |
| `task.create_draft` | yes | same |

**Never register (deny hard):** `email.send`, `proposal.send`, `stage.transition`  
Call → `404 tool_not_found` hoặc `403 tool_denied_by_policy` nếu cố tình.

Existing RNOS-33 tools (`score_lead`, `list_leads`, …) remain registered.

### 4. Agent policy UI/API

- Route `/admin/ai/policies/new` — form create.
- Client: `POST /api/v1/admin/ai/policies/:agentCode` (đã có).
- Preset “ptt-ops-strategist”: allowlist PO-52, `require_human_approval=true`, PII block `[phone,email,national_id,address]`, spend cap default `50`.
- List page: nút “Tạo policy” → `/new`.

### 5. Acceptance

1. Tools page: API enabled, catalog ≠ rỗng  
2. Tạo được ≥1 policy  
3. Read tool call OK; write draft cần approval; email/proposal bị chặn  

## Risks

- Staff JWT required for catalog — smoke dùng admin JWT hoặc internal key.  
- Write approval header is P1 gate only; P3 binds to Change Approval / policy service.

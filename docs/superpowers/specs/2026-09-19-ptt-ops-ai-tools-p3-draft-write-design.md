# PTT Ops AI Tools P3 — Draft Write (Marketing Plan + Task)

**Date:** 2026-09-19  
**SRS:** PO-20/21, PO-50–53 (human approval), lộ trình P3  
**Depends on:** [`2026-09-19-ptt-ops-ai-tools-p1-design.md`](./2026-09-19-ptt-ops-ai-tools-p1-design.md), [`2026-09-19-ptt-ops-ai-tools-p2-crm-context-design.md`](./2026-09-19-ptt-ops-ai-tools-p2-crm-context-design.md)  
**Status:** Approved (user review + P3 tweaks locked)

## Goal

Persist thật sau human approval cho:

- `marketing_plan.write_draft`
- `task.create_draft`

Thay stub P1 (`draft_accepted_pending_persist` / `wired: false`).

## Non-goals

- Change Approval queue / Admin Change Request (RBAC admin) — **không** dùng cho P3
- Auto promote `draft|review → active` (hoặc bất kỳ transition stage/plan live)
- `email.send` / `proposal.send` / `stage.transition` (vẫn deny)
- UI board mới ngoài Try tool + CRM tables hiện có
- P4 stage transition proposals
- **Deferred P3.1 (SRS PO-41):** owner / due_date trên plan draft & task draft — không implement P3; ghi nhận để không quên
- **Idempotency key** cho INSERT plan (không `plan_id`) — P3 không có; caller **phải tái sử dụng `plan_id` trả về** khi retry (tránh plan trùng). Document trong response + risks.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Plan write | **A+guards:** patch nếu `draft`/`review`; INSERT nếu không `plan_id`; live → 409 trừ `clone_to_draft=true` |
| Task write | **C hybrid:** INSERT `crm_svc_tasks` + `[AI draft]` prefix + `form_data.ai_draft` + `is_custom` |
| Approval | **A + light audit:** bắt buộc `X-AI-Human-Approved: 1`; log `ai_tool_call_log`; sau persist ghi `ai_approved_by` / `ai_approved_at` trên entity |
| Architecture | **OpsDraftWriteService** mới (không phình read service P2) |
| Task stage | Dùng **stage hiện tại** của lifecycle (enum `VALID_STAGES`: `lead`…`deliver`…); chỉ fallback `deliver` khi stage null/invalid |
| Plan INSERT retry | Không idempotency key P3 — caller reuse `entity_ids.plan_id` |

## Architecture

```text
Tool call (JWT | X-AI-Tool-Key)
  → assertHumanApproved → 403 human_approval_required nếu thiếu
  → OpsDraftWriteService
       ├ marketing_plan.write_draft → patch | insert | clone | 409
       └ task.create_draft → resolve lifecycle → INSERT svc task
  → ai_tool_call_log
  → { wired: true, phase: "P3", status: "persisted", … }
```

Reuse `OpsCrmContextRepository` để resolve `lifecycle_id` / `plan_id` / `project_id` / `client_id` (cùng luật P2). Write SQL tối thiểu trên `crm_marketing_plans` + `crm_svc_tasks` (không bắt buộc đi qua MarketingPlansService đầy đủ — tránh DI vòng / staff-only side effects).

## Contracts

### Shared gate

- Mutating tools: `ForbiddenException` `{ error: "human_approval_required" }` unless `humanApproved` (header `X-AI-Human-Approved: 1|true|yes|on` hoặc Try checkbox → body/header đã wire sẵn).
- Response success shape (**cùng pattern** plan & task):

```json
{
  "ok": true,
  "wired": true,
  "phase": "P3",
  "status": "persisted",
  "tool": "marketing_plan.write_draft",
  "requires_human_approval": true,
  "human_approved": true,
  "entity_ids": { "plan_id": 12 },
  "links": ["/crm/marketing-plan/12"]
}
```

Task mirror:

```json
{
  "ok": true,
  "wired": true,
  "phase": "P3",
  "status": "persisted",
  "tool": "task.create_draft",
  "requires_human_approval": true,
  "human_approved": true,
  "entity_ids": { "task_id": 42, "lifecycle_id": 5 },
  "links": ["/crm/service-delivery/5"]
}
```

Top-level `plan_id` / `task_id` optional aliases OK nếu giữ tương thích, nhưng **`entity_ids` + `links` là contract chính**.
### `marketing_plan.write_draft`

**Input (additionalProperties allowed):**

| Field | Role |
|-------|------|
| `plan_id` | Optional. Nếu có → load plan |
| `clone_to_draft` | Optional bool. Chỉ khi plan live |
| `title` / `name` | Plan name |
| `period` / `period_label` | Period |
| `objectives` | Objectives text |
| `notes` | Notes (audit append allowed) |
| `client_id`, `lifecycle_id`, `project_id` | Resolve context for INSERT / clone link |

**Behavior:**

1. **Có `plan_id`, status ∈ {`draft`, `review`}** → PATCH allowed content fields only. **Never** set status to `active` (ignore/strip any status promote in input).
2. **Có `plan_id`, status live** (`active`, `paused`, `completed`, `archived`, `cancelled`, …)  
   - Không `clone_to_draft` → **409** `{ error: "plan_not_editable", plan_id, status }`  
   - `clone_to_draft=true` → INSERT new plan `status=draft`, copy core fields từ plan live + overlay input; gắn `lifecycle_id` từ source nếu có.
3. **Không `plan_id`** → INSERT `status=draft`. Attach `lifecycle_id` if resolved. Require non-empty `title`/`name` else **400** `title_required` (or `context_id_required` if neither title nor any context id — prefer `title_required` when title missing). **Retry:** không có idempotency key — caller phải gửi lại `plan_id` từ `entity_ids` lần trước; mỗi call không `plan_id` = thêm một draft mới.
4. **Audit trên plan:** append notes line or set `strategy_framework_json.ai_draft = { ai_approved_by, ai_approved_at, source_tool }` (prefer JSON meta + short notes append). Actor = API key name / staff id from execution context when available, else `"ai-tool"`.

**Editable statuses for in-place patch:** `draft`, `review` only.

### `task.create_draft`

**Input:**

| Field | Role |
|-------|------|
| `title` | **Required** (raw title; service prefixes) |
| `acceptance_criteria` | → `description` (and/or notes) |
| `lifecycle_id` / `plan_id` / `project_id` / `client_id` | Resolve lifecycle |
| `campaign_id` | Optional link in `form_data` |

**Behavior:**

1. Resolve lifecycle (explicit → plan.lifecycle_id → project.lifecycle_id → client primary). Fail → **400** `{ error: "lifecycle_required" }` — **no orphan tasks**.
2. Missing/blank title → **400** `{ error: "title_required" }`.
3. INSERT `crm_svc_tasks`:
   - `is_custom = true`
   - `is_done = false`
   - `title = "[AI draft] " + title` (avoid double-prefix if already present)
   - `description` from `acceptance_criteria`
   - **`stage`:** lấy `lifecycle.stage` nếu thuộc `VALID_STAGES` (`lead` | `consult` | `proposal` | `onboard` | `deliver` | `handover` | `retain` — board VI: Lead→…→**Triển khai**=`deliver`). Nếu null/invalid → fallback **`deliver`** only (không invent slug ngoài enum).
   - `form_data = { ai_draft: true, ai_approved_by, ai_approved_at, plan_id?, campaign_id? }`
4. Response: `entity_ids: { task_id, lifecycle_id }`, `links: ["/crm/service-delivery/{lifecycle_id}"]` (mirror plan write).
## Errors

| error | HTTP | When |
|-------|------|------|
| `human_approval_required` | 403 | Missing approval |
| `plan_not_found` | 404 | Unknown `plan_id` |
| `plan_not_editable` | 409 | Live plan without clone |
| `lifecycle_required` | 400 | Task cannot resolve lifecycle |
| `title_required` | 400 | Missing plan name or task title |
| `context_id_required` | 400 | Reserved if write called with empty input and no resolvable target (prefer more specific errors above) |

## Files

| File | Role |
|------|------|
| `ops-draft-write.service.ts` (+ `.spec.ts`) | Persist logic |
| `ops-crm-context.repository.ts` | Add write helpers: insert/patch/clone plan, insert custom AI draft task |
| `ops-context.tools.ts` | Wire handlers to write service; drop P1 stub result |
| `ai-intelligence.module.ts` | Provide `OpsDraftWriteService` |
| Try tool UI | Keep human-approve checkbox; optional sample write JSON (non-blocking) |
| Agent policies (post-ship) | Thêm `marketing_plan.write_draft` + `task.create_draft` vào allowlist **ptt-ops-strategist** / **grok-bot-…** (và API keys tương ứng) — tránh 403 allowlist khi P1 chỉ có read + tên draft cũ |

## Acceptance

1. Without approval → 403 for both write tools.  
2. INSERT plan draft (no `plan_id`) → row `status=draft`, response `phase=P3` `wired=true`, `entity_ids.plan_id` + links.  
3. PATCH draft/review plan → fields update; status unchanged.  
4. `plan_id` live without clone → 409; with `clone_to_draft=true` → new draft id.  
5. Tool never leaves plan `active` via write_draft.  
6. Task with `lifecycle_id` → visible in `service_delivery.read` `open_tasks` with `[AI draft]` + `form_data.ai_draft`; stage matches lifecycle (or `deliver` fallback).  
7. Task response has `entity_ids.task_id` + `lifecycle_id` + service-delivery link.  
8. Task without resolvable lifecycle → 400.  
9. `ai_tool_call_log` records success/failure.  
10. Denylist tools still not registered.  
11. Post-ship: policies/keys allowlist includes both write tools.

## Risks

- Cloning live plan must not copy `status=active`.  
- Prefix `[AI draft]` must be idempotent for retries.  
- Plan has no `form_data` column — use `strategy_framework_json.ai_draft` + notes append for audit.  
- Retry INSERT without `plan_id` tạo draft trùng — caller phải reuse `entity_ids.plan_id`.  
- Policy/key allowlist cũ thiếu write tools → 403 dù human-approved.
# Task 5 Report: Library service + HTTP + wire `ask_library`

**Status:** DONE  
**Branch:** `feat/intake-sales-kit-s3-s4`

## Summary

S4 vertical slice: disk upload/parse into `sales_kit_files` + `ai_playbooks`/`ai_playbook_chunks` (SQL in library repo, `PlaybooksService.ragQuery` untouched), leak-safe `retrieveForSession`, HTTP routes, and `salesKitTurn` citation override after rules. TDD: leak-prevention + `_common` folder-key tests written first (RED), then implement (GREEN).

## Files

| File | Action |
|------|--------|
| `services/ptt-crm-api/src/intake/sales-kit-library.repository.ts` | Created — SQL for files, playbooks, chunks |
| `services/ptt-crm-api/src/intake/sales-kit-library.service.ts` | Created — retrieve, upload, list, approve, download |
| `services/ptt-crm-api/src/intake/sales-kit-library.service.spec.ts` | Created — leak + scope + unsupported_type |
| `services/ptt-crm-api/src/intake/intake.service.spec.ts` | Created — salesKitTurn empty vs hit |
| `services/ptt-crm-api/src/intake/sales-kit-library.util.ts` | Modified — `_common` first segment |
| `services/ptt-crm-api/src/intake/sales-kit-library.util.spec.ts` | Modified — `_common` unit test |
| `services/ptt-crm-api/src/intake/intake.controller.ts` | Modified — POST/GET files, approve, download |
| `services/ptt-crm-api/src/intake/intake.service.ts` | Modified — `salesKitTurn` library wire |
| `services/ptt-crm-api/src/intake/intake.module.ts` | Modified — library + rate-limit providers |
| `services/ptt-crm-api/src/intake/intake-sales-kit-rules.util.ts` | Modified — export `emptyLibraryReply`, citation type |
| `services/ptt-crm-api/src/ai-intelligence/ai-audit.constants.ts` | Modified — `INTAKE_SALES_KIT_INGEST` |

## Implementation

### `folderKeyOk`

First segment may be `_common`. Other segments still `[a-z0-9][a-z0-9-_]*`. `../etc`, `SEO/qa`, `_other/qa` stay rejected.

### `retrieveForSession(session, query, kindHint)`

1. `repo.listReadyChunks()` — join ready files + `ai_playbooks.status='active'` + `category='sales_kit'` + chunks keyed `file:{id}:…`.
2. Service filter (leak gate): org first segment = `session.service_slug` or `_common`; session bag only when `lead_id` + `session_id` match this session. Other-lead `session/9/99` dropped.
3. `scoreSalesKitChunks` ranks remaining rows.

### Upload (`POST /api/crm/intake/sales-kit/files`)

- Multipart field `file` + `folder_key` + optional `lead_id`/`session_id`.
- Rate limit: `AiSummarizeRateLimitService.check('intake-kit:'+actorId, aiConfig.summarizeRateLimitPerMin)`.
- `.docx` / unknown MIME → `BadRequestException({ error: 'unsupported_type' })`.
- Org: `playbooks.configure` **or** `crm_leads.configure`; cap 40 / folder; playbook `draft`; file `pending` until approve (chunks inserted).
- Session bag: `crm_leads.edit` + `assertLeadVisible`; cap 10; playbook `active`; file `ready` after successful parse. `session_id` alone resolves `lead_id` from the session.
- Storage: `path.join(PTT_SALES_KIT_STORAGE_DIR || 'var/sales-kit', storageKey)` under cwd; temp write then `{folder}/{id}-{safeName}`.
- Parse: async xlsx/pdf. Images → `imageParseStatus(PTT_INTAKE_SALES_KIT_LLM===1)` (S4 off → `needs_ocr`, no vision). Fail → `failed` + `parse_error`.

### Approve / list / download

- `POST …/files/:id/approve` — configure; `ai_playbooks.status='active'` + file `ready`.
- `GET …/files?folder_key=` configure; `?session_id=` view + `assertLeadVisible`.
- `GET …/files/:id/download` — staff view guard + disk stream; no public URL.

### `salesKitTurn`

After `runSalesKitRules`, if intent ∈ `ask_library` | `pricing_band` | `battle_card` OR (`freeform` && `/(đắt|giá|case|báo giá|band)/i`): retrieve. Empty hits → `emptyLibraryReply` (existing empty-state). Hits → `reply_vi` from rank-1 (`pricing_band` = body, else `qaAnswerFromBody`) + citations `{ file_id, file_name, folder_path, excerpt, score, kind }`. Query: message trim, or `'pricing ' + serviceSlug` for `pricing_band`. Retrieve session slug uses resolved rules slug (body override honored).

Audit: constant `INTAKE_SALES_KIT_INGEST: 'intake_sales_kit_ingest'` added; no live `ai_agent_runs` insert (wiring skipped).

## Tests

TDD: leak test + `_common` test first.

```
FAIL  Cannot find module './sales-kit-library.service'
FAIL  folderKeyOk('_common/qa') Expected true, Received false
```

After implement:

```
PASS src/intake/sales-kit-library.service.spec.ts
  ✓ does not return other-lead session chunks
  ✓ includes org slug, _common, and own session folder
  ✓ rejects docx and unknown MIME as unsupported_type
PASS src/intake/sales-kit-library.util.spec.ts (4 tests, including _common)
PASS src/intake/intake.service.spec.ts
  ✓ keeps empty-state when library has no hits
  ✓ overrides reply_vi and citations from top hit
PASS src/intake/intake-sales-kit-rules.util.spec.ts
  ✓ ask_library without chunks stays empty-state
```

Run: `cd services/ptt-crm-api && npm test -- src/intake/sales-kit-library.service.spec.ts src/intake/sales-kit-library.util.spec.ts src/intake/intake.service.spec.ts src/intake/intake-sales-kit-rules.util.spec.ts`

**19/19 passed** (plus ingest 5/5 and retrieve 2/2 on separate runs).

## Commit

- `f0958f94` — `feat(crm): upload sales-kit files and retrieve Q&A with citations`
- 11 task files only. No `.DS_Store`, no unrelated docs.

## Self-review

- Leak filter is in the service (testable with mocked repo). SQL retrieve still scoped to `ready` + playbook `active`.
- `PlaybooksService.ragQuery` unchanged. Playbook insert uses library SQL (`status` draft/active), not `insertPlaybook` (which always writes `active`).
- Existing `ask_library` rules empty-state still passes; `salesKitTurn` keeps that copy when retrieve is empty.
- Routes return real handlers (no 501).
- Class-level `StaffIntakeViewGuard` + write guard on POST/approve; session paths call `assertLeadVisible`.
- `_common` allowed as first segment only; path escape and uppercase still rejected.

## Concerns

1. **Org HTTP still requires `crm_leads.edit`** via `StaffIntakeWriteGuard` on POST/approve. Service also requires configure. A `playbooks.configure`-only actor without `crm_leads.edit` is blocked at the guard. Brief said follow existing write guards.
2. **No live ingest audit insert** — constant only. Task 8 / ops can wire `ai_agent_runs`.
3. **`listReadyChunks` loads all ready sales-kit chunks then filters in memory.** Fine for S4 file caps; add SQL folder/session predicates if volume grows.
4. **Org parse success leaves file `pending` until Duyệt** (playbook stays `draft`). Retrieve needs both `active` + `ready`. Session uploads skip that gate.
5. **DDL not applied in this environment** — upload throws `schema_not_ready` until `scripts/apply_pg_ddl_sales_kit_files.sh` runs.
6. **Duplicate Nest providers:** `AiSummarizeRateLimitService` / `AiIntelligenceConfigService` are provided on `IntakeModule` (not exported from `AiIntelligenceModule`). Separate in-memory rate-limit bucket from summarize; keys are namespaced `intake-kit:`.

## Out of scope (Task 6+)

- Admin UI, túi phiên sheet, sample.xlsx, e2e UAT-13/14, vision ingest, live audit rows.

## Important review findings (fix)

No new features. Three gates only.

### What changed

1. **Org HTTP write cap** — Dropped `StaffIntakeWriteGuard` on `POST /sales-kit/files` and `POST /sales-kit/files/:id/approve`. Class-level `StaffIntakeViewGuard` stays. Service `hasConfigure` / `hasEdit` + `assertLeadVisible` remain the write authority (`playbooks.configure` OR `crm_leads.configure` for org; `crm_leads.edit` for session bag).
2. **Approve only pending** — Service refuses `failed` / `needs_ocr` / `pending_vision` (and any non-`pending`) with `BadRequestException({ error: 'not_approvable' })`. Repo `UPDATE` now requires `parse_status = 'pending'` and does not activate the playbook if that update matches zero rows.
3. **Org `session/…` collision** — `folderKeyOk` rejects first segment `session`; `_common` remains the underscore exception. Session `ensurePlaybook` updates an existing row to `status='active'`.

### Covering tests

```
cd services/ptt-crm-api && npx jest src/intake/sales-kit-library.util.spec.ts src/intake/sales-kit-library.service.spec.ts src/intake/intake-sales-kit-rules.util.spec.ts src/intake/intake.controller.spec.ts src/intake/sales-kit-library.repository.spec.ts --no-coverage
```

```
PASS src/intake/sales-kit-library.repository.spec.ts
PASS src/intake/intake-sales-kit-rules.util.spec.ts
PASS src/intake/sales-kit-library.util.spec.ts
PASS src/intake/intake.controller.spec.ts
PASS src/intake/sales-kit-library.service.spec.ts

Test Suites: 5 passed, 5 total
Tests:       24 passed, 24 total
```

New coverage: controller metadata (no WriteGuard on org upload/approve), approve refuses non-pending, `folderKeyOk('session/…')` false, repo `ensurePlaybook` activates existing session playbook.

### Commit

- (SHA filled after commit) — `fix(crm): honor sales-kit org configure cap and approve gates`

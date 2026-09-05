# Task 18: Onboarding workspace + template + Go-live (UI-AM-08/09)

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Read first:
- Plan: `docs/superpowers/plans/2026-09-05-account-management-os.md` Task 18
- SRS: `docs/superpowers/specs/2026-09-05-account-management-srs.md` UI-AM-08 / UI-AM-09 / ACT-015 / FR-017
- Mockup: `docs/design/rnosai-am-os-srs-mockup.html` `#page-onboard-ws`, `#page-onboard-tpl`, `#m-golive`
- Existing: `services/ptt-crm-api/src/am/am-onboarding.service.ts` (handover + accept inserts `crm_am_onboarding_cases`)
- Controller: `services/ptt-crm-api/src/am/am.controller.ts`
- Guard: `RequireAmAction` — `view` list/get, `edit` case PATCH + go-live, `manage` template write
- UI patterns: `AmHandover.tsx`, `AmAccount360.tsx`, `useAmPage()`, CLASS `am-*`
- Settings page is still `AmPlaceholder` — replace with `AmSettings.tsx` **template panel only** (scorecard PUT is Task 21 — do not add it)

## Do not

- Nested `<main>` inside AM pages
- Hard-code mockup numbers (62%, Bloom Spa, 01/10/2026, 12 items)
- New npm packages
- PUT `/api/crm/am/settings` (Task 21)
- Touch KPI Hub / CSD CSS
- Invent a second repository class that is only a TypeScript interface (Nest injection must be a CLASS token — reuse `AmOnboardingRepository`)
- Change handover accept semantics except optional redirect after accept
- Commit `.superpowers/` or `node_modules`

## Data

Tables (already exist, Wave 2 DDL):

```
crm_am_onboarding_templates (id, tenant_id, name, version, status, items_json)
crm_am_onboarding_cases (id, tenant_id, agency_client_id, template_id, status, go_live_on, items_json, override_reason, created_at)
```

Tenant `PTT`. Scope every case list/get/patch/go-live with `resolveAmScope` + `amScopeSql` (same `bindScopeSql` as handover). Out-of-scope GET → 404 `not_found`.

### Item JSON (lock this shape)

Template item (no completion fields):

```ts
{
  id: string;                 // uuid or stable slug
  kind: 'checklist' | 'milestone';
  phase: string;              // e.g. Pre-kickoff | Kickoff | Setup | Go-live
  title: string;
  owner_role: string;         // Account Manager | Delivery | Client | Director
  due_offset_days: number;    // T+n
  required: boolean;
}
```

Case item = template item + `{ done: boolean; done_at: string | null; due_on: string | null }`  
`due_on` = case `created_at` (ICT date) + `due_offset_days`. Compute on first GET if missing; persist on PATCH.

If `items_json` is a non-array object, treat as `[]`. Empty → UI `—`.

## APIs (add to existing AmOnboardingService + AmController)

```
GET    /api/crm/am/onboarding-cases?scope&agency_client_id
GET    /api/crm/am/onboarding-cases/:id
PATCH  /api/crm/am/onboarding-cases/:id
POST   /api/crm/am/onboarding-cases/:id/go-live
GET    /api/crm/am/onboarding-templates
POST   /api/crm/am/onboarding-templates          // manage
PATCH  /api/crm/am/onboarding-templates/:id      // manage
POST   /api/crm/am/onboarding-templates/:id/clone
POST   /api/crm/am/onboarding-templates/:id/publish
```

Caps: cases GET `view`; PATCH + go-live `edit`; template GET `view`; template POST/PATCH/clone/publish `manage`.

### Case GET payload

```ts
{
  id, agency_client_id, name, code,
  status,                    // open | closed
  go_live_on,                // YYYY-MM-DD | null
  override_reason,
  items: AmOnboardingCaseItem[],
  progress_pct,              // completed / total * 100, integer; null if no items
  owner_name,                // ext owner via crm_staff (or null)
  delivery_owner,            // from latest accepted handover stakeholders_json.delivery_owner or null
  track: 'on_track' | 'at_risk' | 'blocked',  // blocked if any required overdue; at_risk if any overdue; else on_track
  health_fresh_24h: boolean, // true iff a crm_am_health_snapshots row exists for this client with as_of = today ICT
  stakeholders: Record<string, unknown>, // latest accepted handover stakeholders_json or {}
  activity: [],              // empty Wave 2
  documents: [],             // empty Wave 2
}
```

Progress: count `kind !== 'milestone'` or all items — use **all items** with `done === true` / total. Missing total → `progress_pct: null`.

### PATCH case

Body: `{ items?: Array<{ id: string; done: boolean }> }`  
Only toggles `done` / `done_at` (ISO now when true, null when false). Cannot PATCH closed case → 409 `case_closed`. Invalid id → 400.

### POST go-live

Body: `{ go_live_on: string; override?: boolean; override_reason?: string; notes?: string }`

- `go_live_on` required, `YYYY-MM-DD` else 400 `invalid_go_live_on`
- If any item `required === true && done !== true`:
  - `override !== true` → **400 `required_open`**
  - `override === true` but blank `override_reason` → **400 `override_reason_required`**
- `health_fresh_24h === false` is a **warning in the modal only** — do **not** block
- Transaction (`withTransaction`):
  1. `UPDATE crm_am_onboarding_cases SET status='closed', go_live_on, override_reason WHERE status='open'`
  2. `rowCount === 0` → 409 `already_closed`
  3. `UPDATE crm_am_account_ext SET am_status='active'`
- After COMMIT: audit `onboarding.go_live` (`entity_type: 'onboarding_case'`)
- Closed case GET still 200 (read-only)

### Templates

- List all tenant templates, newest version first
- POST create: `{ name, items }` → `status=draft`, `version` = max(name)+1 or 1
- PATCH draft only. **If `status='published'` → 409 `template_published`**
- Clone: new draft, same name, version = max(name)+1, copy items; published source stays published
- Publish: set this row `published`. Latest published still wins on handover accept (`ORDER BY version DESC`)
- Validate items: array; each needs `id`, `title`, `kind` in checklist|milestone, `due_offset_days` finite number, `required` boolean. Else 400 `invalid_items`

## UI

### `AmOnboarding.tsx` + `onboarding/[id]/page.tsx`

Replace placeholder. Header: `{name}` · `{progress_pct ?? '—'}% hoàn thành` · `Go-live {date or —}` · `Owner {owner or —}` · `Delivery {delivery or —}` · track pill (On Track / At Risk / Blocked).

Side nav (exactly these 6 labels): Tổng quan / Checklist / Milestones / Stakeholders / Tài liệu / Activity  
URL `?tab=` like 360 (`overview|checklist|milestones|stakeholders|documents|activity`).

- Tổng quan: progress, track, go-live date, milestone strip (titles + done)
- Checklist: items `kind=checklist` (or kind missing). Chips: Tất cả / Chưa làm / Quá hạn (URL or local filter). Toggle done if `canEdit` and status=open. Save → PATCH
- Milestones: `kind=milestone`
- Stakeholders: key/value from `stakeholders` or `—`
- Tài liệu / Activity: empty `—` (Wave 2)
- CTA: `Đánh dấu sẵn sàng Go-live` (edit + open) opens modal
- Modal copy from mockup: required count, `health_fresh_24h` warning text if false: `Báo cáo dashboard chưa có dữ liệu 24 giờ`. Date required. Override checkbox + reason textarea shown when required still open. Confirm calls go-live API. Map 400 `required_open` / `override_reason_required`.

After handover accept, if `onboarding_case_id` present, navigate to `/crm/account-management/onboarding/{id}`.

### `AmSettings.tsx` + `settings/page.tsx`

Title `Cấu hình / Onboarding templates`. List templates (name, version, status pill). `+ Tạo template` if manage. Click → items table: Giai đoạn · Hạng mục · Owner mặc định · Hạn (T+n) · Required.

Published: read-only + `Nhân bản thành draft` (clone). Draft: edit items + Lưu (PATCH) + Xuất bản (publish). Non-manage: read-only, no create/publish.

Do **not** add scorecard / quota / bands UI.

## Tests (TDD — write failing tests first)

Jest `am-onboarding.service.spec.ts` (new describe, keep handover tests):

1. go-live with a required item `done: false` and no override → 400 `required_open`; no UPDATE case/ext; no audit
2. PATCH published template → 409 `template_published`; no UPDATE
3. (recommended) go-live with override + reason succeeds; missing reason 400 `override_reason_required`

Vitest: util file `am-onboarding.util.ts` + spec — `amGoLiveBlocked(items, override)` true when required open and !override; nav labels; parse tab.

API tests: `cd services/ptt-crm-api && node node_modules/.bin/jest src/am/am-onboarding.service.spec.ts --no-coverage`  
UI: `cd services/ops-web && npx vitest run src/lib/crm/am-onboarding.util.spec.ts`

## Commit

`feat(am): add onboarding workspace and go-live gate`

HEREDOC. Never `--no-verify`. Never update git config. Do not commit secrets.

## Report

Write `.superpowers/sdd/task-18-report.md` with TDD RED/GREEN evidence.

Final line: DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT

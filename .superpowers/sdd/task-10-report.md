# Task 10: Convert idempotent (CVT-01, AC-08 start)

**Status:** GREEN  
**Branch:** `feat/quotation-os`  
**Commit:** `e66d95d1` `feat(qt): idempotent convert to lifecycle and invoice draft`

## Requirements (verbatim from brief)

- Create `quote-convert.service.ts` + spec
- `PATCH status=accepted` locks only; convert is explicit `POST /:id/versions/:vid/convert`
- Old clients that still PATCH accepted call convert once with Idempotency-Key `legacy-accept:{id}` (current_version_id)
- Route: `POST /api/crm/proposals/:id/versions/:vid/convert`
- Guards: `StaffOrInternalKeyGuard`, `StaffQuoteGuard` + `@RequireQuoteSection('crm_quote.convert','execute')`
- Missing cap → 403 `{ error: 'missing_cap', section: 'crm_quote.convert', action: 'execute' }`
- `Idempotency-Key` required (400 if missing)
- Response: `{ conversion_id, lifecycles: [{ line_id, lifecycle_id, dv_code }], invoice_draft_ids, optional_handoff: [] }`
- Unique `(version_id, target_type)` where `target_type` ∈ `lifecycle_bundle|invoice_schedule` is SoR for AC-08
- Use `ServiceLifecycleService.create` + `setLineLifecycle` / SKU
- Invoice draft via `InvoicesService.create` (existing draft-create)
- Do not create CSD tickets; do not INSERT `crm_cp_projects`; `optional_handoff: []`

## TDD RED

Wrote `quote-convert.service.spec.ts` first. First run (no production file):

```
./node_modules/.bin/jest --verbose --config ./jest.config.js src/proposals/quote-convert.service.spec.ts
```

**RED (compile — feature missing):**

| Failure | Reason |
|---|---|
| `TS2307: Cannot find module './quote-convert.service'` | Service not created yet |
| `TS2554: Expected 12 arguments, but got 13` | `ProposalsService` had no convert collaborator |
| `TS2339: Property 'lifecycles'` on non-accept PATCH return | Accept no longer always returned lifecycles |
| `TS2339: Property 'convert' does not exist on ProposalsController` | Route not wired |

After implementation, one assertion RED before replay fix:

```
QuoteConvertService › two converts return one lifecycle set and the same conversion ids (AC-08)
Expected: "cvt-1"
Received: ""
```

Replay used `payload.conversion_id ?? row.id`; stored payload had `conversion_id: ''` (empty string is not nullish). Fixed to `payload.conversion_id || row.id`.

## TDD GREEN

```
./node_modules/.bin/jest --verbose --config ./jest.config.js src/proposals
```

**Result:** 20 suites, 126 tests passed.

Convert spec (10):

| Test | Outcome |
|---|---|
| two converts → one lifecycle set and same ids (AC-08) | PASS |
| unique `(version_id, target_type)` violation replays same ids | PASS |
| Idempotency-Key required | PASS |
| no CSD / no `crm_cp_projects`; `optional_handoff: []` | PASS |
| JWT staffId 0 → 403 `qt_unresolved_staff` | PASS |
| Quote OS accept without convert → no extra lifecycle | PASS |
| Deal Room PATCH accepted uses `legacy-accept:{id}`; second accept same ids | PASS |
| Controller wires POST convert + StaffQuoteGuard + Idempotency-Key | PASS |
| POST convert missing key → 400 `idempotency_key_required` | PASS |
| missing `crm_quote.convert` execute → 403 `missing_cap` | PASS |

## Implementation

**New**

- `services/ptt-crm-api/src/proposals/quote-convert.service.ts`
- `services/ptt-crm-api/src/proposals/quote-convert.service.spec.ts`

**Modified**

- `proposals.controller.ts` — `POST :id/versions/:vid/convert`
- `proposals.service.ts` — accept locks; Quote OS does not auto-convert; Deal Room (`quote_code` empty + `current_version_id`) calls convert with `legacy-accept:{id}`; already-accepted PATCH replays convert
- `proposals.service.spec.ts` — constructor wiring for `QuoteConvertService`
- `proposals.module.ts` — provider + `InvoicesModule` import

**Convert flow**

1. Require Idempotency-Key; JWT staff via `resolveCrmStaffUserId` (service rejects staffId 0 unless internal)
2. `withTransaction` + `pg_advisory_xact_lock(hashtext('qt-convert:' || vid))`
3. If `crm_quote_conversions` row exists for `(version_id, lifecycle_bundle)` → replay `payload_json` / row id
4. Else `ServiceLifecycleService.create` per line, `activateLifecycle`, `setLineLifecycle`, SKU; invoice drafts from `crm_quote_payment_schedules` (or proposal total)
5. Insert `lifecycle_bundle` + `invoice_schedule`; on `23505` replay

## Concerns

- Deal Room proposals **without** `current_version_id` now lock only and do **not** spawn lifecycles. Convert cannot persist without `crm_quote_versions` FK. Old Deal Room UI that PATCHes accept expecting lifecycles will get `lifecycles: []` until a version exists or the client calls convert.
- `spawn_week` on PATCH accepted is no longer applied (W1 convert is lifecycle + invoice draft only).
- Lifecycle + invoice writes use `ServiceLifecycleService` / `InvoicesService` (separate connections). Conversion rows are transactional; uniqueness + advisory lock is the SoR against a second bundle.
- Quote SoR stays `crm_proposals`. No second campaign table. Soft-delete unused.

---

## Review fix (Critical + Important)

**Status:** GREEN  
**Commit:** `fix(qt): keep Deal Room accept and require accepted convert`

### Findings fixed

1. **Critical — Deal Room accept without version still spawns lifecycles.**  
   If `quote_code` and `current_version_id` are both empty, PATCH accepted uses the previous inline spawn (`ServiceLifecycleService.create` per line, `setLineLifecycle`, optional `spawn_week`). It does not return `lifecycles: []`.

2. **Important — Invoice drafts do not multiply on retry.**  
   Convert looks up `crm_quote_conversions` `invoice_schedule` and existing `crm_invoices` rows (`notes = Quote convert {vid}`) before `InvoicesService.create`. Unique-violation replay merges `invoice_draft_ids` from the lifecycle payload or the invoice conversion row. Conversion rows remain the success marker (AC-08 unique `(version_id, target_type)`).

3. **Important — Quote OS PATCH accepted + convert is atomic from the caller’s view.**  
   Quote OS (and Deal Room with a version) writes `accepted` then convert with `legacy-accept:{id}`. If convert throws (`version_not_found`, missing lines), status is rolled back to the previous value. No committed accepted-without-convert.

4. **Important — Explicit POST convert requires accepted.**  
   Draft/sent → 400 `{ error: 'quote_not_accepted' }`. PATCH-accepted runs convert after the status write so the check sees `accepted`. Guard on POST is unchanged: `RequireQuoteSection('crm_quote.convert','execute')`.

Unchanged: `optional_handoff: []`; no CSD tickets; no `crm_cp_projects`.

### Tests added / adjusted

- Deal Room accept without `current_version_id` → one lifecycle per line (`quote-convert.service.spec.ts`, `proposals.service.spec.ts`)
- Two converts → same lifecycle + same `invoice_draft_ids`; existing drafts reused (no extra `InvoicesService.create`)
- Explicit convert on draft/sent → `quote_not_accepted`
- Quote OS PATCH accepted that fails convert rolls status back to `sent`
- Quote OS accept without explicit convert still one convert via `legacy-accept:{id}`
- Existing: two converts one set (AC-08); Deal Room with version uses legacy key; missing cap 403

### Verification

```
cd services/ptt-crm-api && ./node_modules/.bin/jest --verbose src/proposals
```

**Result:** 20 suites, 132 tests passed.

| New / adjusted test | Outcome |
|---|---|
| Deal Room accept without version → lifecycles created | PASS |
| Two converts → same lifecycle + same invoice_draft_ids | PASS |
| Existing invoices for version reused; no extra drafts | PASS |
| Explicit convert on draft/sent → `quote_not_accepted` | PASS |
| Quote OS PATCH accepted + failed convert rolls back | PASS |
| Quote OS accept without explicit convert → legacy key | PASS |
| Unique `(version_id, target_type)` replay (AC-08) | PASS |
| missing `crm_quote.convert` execute → 403 | PASS |

### Remaining concerns

- Lifecycle + invoice writes still use separate connections (`ServiceLifecycleService` / `InvoicesService`). Accept rollback is a second `patchStatus` after convert throws; it is not one DB transaction with those services.
- Invoice reuse by `notes = Quote convert {vid}` assumes that note stays the create key. A unique-violation loser that created drafts *before* the lookup path existed could still have leftovers; new retries reuse by notes or conversion payload.
- Quote SoR stays `crm_proposals`. No CSD / `crm_cp_projects`. Soft-delete unused.

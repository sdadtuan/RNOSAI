# Raw Lead Readiness Phase 1 (Backfill) Implementation Plan

> **For agentic workers:** Execute task-by-task. Spec: [`../specs/2026-09-18-raw-lead-readiness-backfill-design.md`](../specs/2026-09-18-raw-lead-readiness-backfill-design.md)

**Goal:** Backfill readiness on existing raw leads + PATCH override + UI button.

## File map

| File | Responsibility |
|---|---|
| `quality/readiness-from-row.util.ts` (+ spec) | Build classify input from stored RawLeadRow |
| `raw-lead-harvest.repository.ts` | List candidates for reclassify; update readiness fields |
| `raw-lead-harvest.service.ts` / `.controller.ts` / `.types.ts` | POST reclassify + PATCH readiness |
| `ops-web market-research-api.ts` + `RawLeadHarvestPanel.tsx` | Client + UI |

### Task 1: readiness-from-row (TDD)

- [x] Tests: phone/email/website/social/score mapping
- [x] Implement `buildReadinessInputFromRawLead(...)`

### Task 2: API backfill + PATCH

- [x] `updateLeadReadiness`, `listLeadsForReclassify`
- [x] `POST reclassify-readiness`, extend PatchRawLeadBody
- [x] Unit/service tests for push still OK

### Task 3: UI

- [x] Button Phân loại lại + optional selection
- [x] Readiness select on row

### Task 4: Verify Jest

- [x] readiness-from-row + push-crm + list-query

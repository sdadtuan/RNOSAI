# Raw Lead Phase 4 (Bulk Ops) Implementation Plan

> Spec: [`../specs/2026-09-18-raw-lead-bulk-ops-design.md`](../specs/2026-09-18-raw-lead-bulk-ops-design.md)

**Goal:** Bulk Accept + page select helpers for Ready/Review.

## File map

| File | Responsibility |
|---|---|
| `raw-lead-harvest.types.ts` | `BulkAcceptRawLeadsBody` |
| `raw-lead-harvest.service.ts` / controller | `bulkAccept` |
| `bulk-accept.util.ts` (+ spec) optional | Filter accept candidates |
| ops-web API + `RawLeadHarvestPanel` / modal | Buttons |

### Tasks

- [x] TDD: which leads are bulk-accept eligible
- [x] Service + endpoint
- [x] UI Accept đã chọn + Chọn Ready/Review trang
- [x] Jest pass

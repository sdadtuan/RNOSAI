# Raw Lead Readiness Phase 2 (Accept→Ready) Implementation Plan

> Spec: [`../specs/2026-09-18-raw-lead-readiness-accept-ready-design.md`](../specs/2026-09-18-raw-lead-readiness-accept-ready-design.md)

**Goal:** Accept on NEEDS_REVIEW promotes readiness to READY_TO_PUSH.

## File map

| File | Responsibility |
|---|---|
| `accept-readiness.util.ts` (+ spec) | Pure promote rules |
| `raw-lead-harvest.service.ts` | Apply on PATCH status=accepted |
| `RawLeadAcceptModal.tsx` / `RawLeadHarvestPanel.tsx` | Copy + toast |

### Task 1: util TDD

- [x] Matrix NEEDS_REVIEW → READY; MISSING/DUP unchanged; legacy contactable → READY

### Task 2: wire patchLead

- [x] After/before status accept, call updateLeadReadiness when promote returns next

### Task 3: UI

- [x] Modal + toast hint

### Task 4: Jest pass

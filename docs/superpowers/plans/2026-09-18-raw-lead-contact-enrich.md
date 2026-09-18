# Raw Lead Phase 3 (Contact Enrich) Implementation Plan

> Spec: [`../specs/2026-09-18-raw-lead-contact-enrich-design.md`](../specs/2026-09-18-raw-lead-contact-enrich-design.md)

**Goal:** Enrich missing contacts then reclassify readiness.

## File map

| File | Responsibility |
|---|---|
| `quality/contact-enrich.util.ts` (+ spec) | Merge Places + scrape into contact patch |
| `raw-lead-harvest.repository.ts` | `listLeadsForEnrich`, `updateLeadContact` |
| `raw-lead-harvest.service.ts` / controller / types | POST enrich-contacts |
| ops-web API + `RawLeadHarvestPanel` | Button + toast |

### Tasks

- [x] TDD merge util
- [x] Repo + service enrich + reclassify
- [x] UI button
- [x] Jest pass

# Raw Lead Phase 5 (Cluster + P1/P2/P3) Implementation Plan

> Spec: [`../specs/2026-09-18-raw-lead-priority-cluster-design.md`](../specs/2026-09-18-raw-lead-priority-cluster-design.md)

**Goal:** Soft account_cluster_key + priority_tier P1/P2/P3 on raw leads.

## File map

| File | Responsibility |
|---|---|
| `quality/priority-cluster.util.ts` (+ spec) | cluster key + tier rules |
| `raw-lead-harvest.repository.ts` | DDL, update, list filter, counts |
| `raw-lead-list-query.util.ts` | parse `priority_tier` |
| service / controller / types | `recompute-priority`, priority-counts |
| ops-web API + panel | column, filter, button |

### Tasks

- [x] TDD cluster key + tier matrix
- [x] Repo + API
- [x] UI
- [x] Jest pass

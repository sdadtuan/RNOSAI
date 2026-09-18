# Raw Lead Phase 5 — Account Cluster + Priority (P1/P2/P3) Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-18 |
| Trạng thái | Approved via “viết plan rồi implement phase 5” |
| Scope | **MVP slice** của RSR sâu — không full battlecard / learning loop |

## Goal

Gom Lead thô cùng “account” trong project (soft cluster) và gắn **ưu tiên P1 / P2 / P3** để AM biết gọi ai trước.

## Data

ALTER `crm_research_raw_leads`:

| Column | Type | Meaning |
|---|---|---|
| `account_cluster_key` | TEXT | Stable key trong project |
| `priority_tier` | TEXT | `P1` \| `P2` \| `P3` |

Index: `(project_id, account_cluster_key)`, `(project_id, priority_tier)`.

## Cluster key (deterministic)

Ưu tiên lần lượt:

1. `place_id` nếu có  
2. else `phone:{phone_norm}` nếu phone_norm ≥ 9  
3. else `domain:{registrable host}` từ website (không social)  
4. else `name:{company_name_norm}`  
5. else `id:{lead.id}` (singleton)

Leads cùng key trong project = cùng cluster. Không merge row; chỉ gắn key.

## Priority tier

| Tier | Rule (first match) |
|---|---|
| **P1** | `READY_TO_PUSH` và `quality_score >= 50` và contactable |
| **P2** | `READY_TO_PUSH` hoặc (`NEEDS_REVIEW` và có phone_norm) |
| **P3** | còn lại (MISSING / DUP / score thấp / không contact) |

## API

`POST .../projects/:id/raw-leads/recompute-priority`

Body optional: `{ lead_ids?, job_id?, limit? }` (default all non-pushed, max 2000).

Recompute cluster key + priority; return counts by tier.

List filter: `?priority_tier=P1`

Counts: extend readiness-counts **or** `GET .../priority-counts` → `{ P1, P2, P3, ALL }`.

## UI

- Cột **Ưu tiên** (P1/P2/P3 badge) + cluster id rút gọn
- Filter/tabs phụ: P1 | P2 | P3 (cạnh readiness hoặc dropdown)
- Nút **Tính ưu tiên** (recompute)

## Out of scope

Battlecard, learning loop, cross-project accounts, CRM Account entity merge.

# Raw Lead Phase 8 — Cross-project Accounts Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-19 |
| Trạng thái | Approved via “viết plan rồi implement Cross-project accounts” |
| Parent | Phase 5 soft cluster · không CRM Account entity |
| Scope | **MVP** — soft global key + mates xuyên project |

## Goal

Cùng một account thật (place / SĐT / domain) xuất hiện ở nhiều research project → AM thấy **“cũng có ở project khác”** khi mở Battlecard, tránh gọi trùng / pitch lệch ngữ cảnh.

## Approach

| Option | Pros | Cons |
|---|---|---|
| **A. Soft `global_account_key` (chọn)** | Reuse cluster rules; không merge row | Không entity CRM |
| B. Bảng `crm_research_global_accounts` | Query aggregate dễ | Schema nặng hơn MVP |
| C. CRM Account merge | Full RSR | Out of scope (Phase sau) |

## Global key (deterministic, strong signals only)

Không dùng `name:` / `id:` (dễ collision / không xuyên project):

1. `place:{place_id}` nếu có  
2. else `phone:{phone_norm}` nếu ≥ 9 digits  
3. else `domain:{host}` từ website (không social)  
4. else **null** (không gắn global)

Trong-project vẫn dùng `account_cluster_key` (Phase 5, kể cả name/id).

## Data

ALTER `crm_research_raw_leads`:

| Column | Type |
|---|---|
| `global_account_key` | TEXT NULL |

Index: `(global_account_key)` WHERE NOT NULL.

Gắn khi `recompute-priority` (cùng lúc cluster/tier).

## API

`GET .../projects/:id/raw-leads/:leadId/cross-project-mates`

```ts
{
  global_account_key: string | null,
  mates: Array<{
    id: number,
    project_id: number,
    project_name: string | null,
    company_name: string,
    priority_tier: string | null,
    readiness_status: string | null,
    phone: string | null,
    status: string,
  }>
}
```

- Chỉ lead **khác `project_id`**, cùng `global_account_key`, limit 12.
- 404 nếu lead không thuộc project.

Battlecard: thêm `cross_project: { key, mates }` (reuse query).

## UI

- Battlecard section **“Cross-project”** khi có mates.
- Cột cluster: nếu có `global_account_key`, hiện prefix `global:` rút gọn dưới cluster key (optional).

## Out of scope

CRM Account entity, merge/dedupe rows, name-based global match, cross-tenant, learning across projects.

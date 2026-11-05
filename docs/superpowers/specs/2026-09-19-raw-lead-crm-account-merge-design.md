# Raw Lead Phase 9 — CRM Research Account Entity Merge Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-19 |
| Trạng thái | Approved via “viết plan rồi implement CRM Account entity merge” |
| Parent | Phase 8 `global_account_key` |
| Scope | **MVP** — entity Account phía research; **không** merge vào `agency_clients` / AM |

## Goal

Biến soft `global_account_key` thành **entity Account** có id ổn định, gắn nhiều raw lead (mọi project) + optional `crm_lead_id` sau push — AM thấy “Account #N” thay vì chỉ chuỗi key.

## Approach

| Option | Pros | Cons |
|---|---|---|
| **A. `crm_research_accounts` + FK trên raw lead (chọn)** | Ranh giới rõ; không đụng AM | Chưa phải CRM Account bán hàng |
| B. Dùng `agency_clients` | Một entity CRM | Sai domain (client đang phục vụ) |
| C. Chỉ view aggregate | Không schema | Không id ổn định / FK |

## Schema

```sql
CREATE TABLE IF NOT EXISTS crm_research_accounts (
  id BIGSERIAL PRIMARY KEY,
  global_account_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  phone_norm TEXT,
  domain TEXT,
  place_id TEXT,
  lead_count INT NOT NULL DEFAULT 0,
  project_count INT NOT NULL DEFAULT 0,
  best_priority_tier TEXT,
  crm_lead_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_research_raw_leads
  ADD COLUMN IF NOT EXISTS research_account_id BIGINT;
-- index (research_account_id)
```

## Merge rules

Input: lead có `global_account_key` (place/phone/domain).

1. UPSERT account by `global_account_key`.
2. `display_name` = lead.company_name nếu account mới; giữ tên cũ nếu đã có (trừ khi cũ rỗng).
3. Fill `phone_norm` / `domain` / `place_id` từ key prefix nếu thiếu.
4. Set `raw_leads.research_account_id = account.id`.
5. Refresh aggregates: `lead_count`, `project_count`, `best_priority_tier` (P1 < P2 < P3).
6. Nếu lead.`crm_lead_id` set và account.`crm_lead_id` null → copy.

## Triggers

1. **Batch** `POST .../projects/:id/raw-leads/merge-accounts`  
   Body: `{ lead_ids?, job_id?, limit? }` — leads trong project có global key (hoặc compute on the fly).
2. **Auto** sau `recompute-priority` cho từng lead vừa gắn `global_account_key`.
3. **Auto** sau `pushToCrm` thành công → set account.crm_lead_id nếu null.

## API

`GET .../projects/:id/raw-leads/:leadId/research-account`

```ts
{
  account: ResearchAccount | null,
  linked_leads: Array<{ id, project_id, company_name, priority_tier, status, crm_lead_id }>
}
```

Battlecard: thêm `research_account: { id, display_name, lead_count, project_count, crm_lead_id } | null`.

## UI

- Nút **Gộp Account** (cạnh Áp dụng học dial).
- Battlecard section **Account** khi có entity.
- Cột ưu tiên: hiện `A#id` nếu có `research_account_id`.

## Out of scope

Merge vào AM/`agency_clients`, dedupe xóa raw rows, UI account directory đầy đủ, ownership AM.

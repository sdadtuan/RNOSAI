# Design — Raw Lead Harvest: contact columns + list paging/filter

**Date:** 2026-09-16  
**Status:** Approved in chat (approach 1; Zalo = URL)  
**Scope:** DB contact fields + list API paging/filter + Lead thô UI columns

## 1. Problem

Lead thô list loads one shot (API `LIMIT 500`, no UI paging). Contact is a single “Liên hệ” cell (phone + email). There are no dedicated **Fanpage** / **Zalo** columns, so AM cannot scan or act on those channels. Intent / Market Graph will grow volume → need real paging + filters.

## 2. Goals

- Persist contact channels as **separate DB columns**: phone, email, website, fanpage_url, zalo_url, address (plus existing norms where applicable).
- UI shows **one column per field**.
- List API supports **page size 50**, unlimited pages from `total`, plus filters.
- Do not invent Fanpage/Zalo; only store when harvested or staff-edited.

## 3. Non-goals

- Backfill Fanpage/Zalo for historical rows (remain null).
- Client-side-only paging of a 500-row dump.
- New CRM push mapping for fanpage/zalo in this wave (optional follow-up).
- Replacing Intent/Market Graph harvest logic beyond writing new columns when data exists.

## 4. Data model

Table: `crm_research_raw_leads`

| Column | Type | Notes |
|--------|------|--------|
| `phone` / `phone_norm` | TEXT | existing |
| `email` | TEXT | existing |
| `website` | TEXT | existing |
| `address` | TEXT | existing |
| **`fanpage_url`** | TEXT NULL | Facebook page/profile URL |
| **`zalo_url`** | TEXT NULL | `zalo.me/...` (or equivalent Zalo chat URL) — **not** a separate phone field |

- `ensureSchema`: `ADD COLUMN IF NOT EXISTS` for the two new columns.
- `insertLead` / `mapLead` / `patchLead`: read/write both.
- Export CSV: add `fanpage_url`, `zalo_url`.
- Harvest workers (LLM / Intent / Market Graph): map into columns when present in parse/scrape/Places payload; never fabricate.

## 5. API

### 5.1 List

`GET /api/v1/research/projects/:id/raw-leads`

| Query | Default | Behavior |
|-------|---------|----------|
| `page` | `1` | ≥ 1 |
| `page_size` | `50` | fixed product default **50**; clamp 10–100 for safety |
| `status` | — | single or comma-list |
| `job_id` | — | filter by harvest job |
| `q` | — | ILIKE company_name, phone, email, address |
| `has_phone` | — | `1` ⇒ `phone_norm` present |
| `has_contact` | — | `1` ⇒ phone **or** email |
| `include_auto_rejected` | `0` | existing semantics; UI “Tất cả” sets `1` |

Response:

```json
{
  "leads": [],
  "page": 1,
  "page_size": 50,
  "total": 123,
  "total_pages": 3
}
```

`total_pages = max(1, ceil(total / page_size))` when total > 0; empty list ⇒ `total_pages = 0` or `1` (implement consistently; prefer `0` when `total = 0`).

### 5.2 Patch / types

`PatchRawLeadBody` and lead DTO include `website`, `fanpage_url`, `zalo_url`, `address` (phone/email already). Validate URLs lightly (trim; optional `http(s):` / `zalo.me` / `facebook.com` host check — soft, not hard fail on unusual hosts).

## 6. UI (Lead thô)

**Filters:** status, job, `q`, checkboxes has_phone / has_contact. Changing filters resets `page` to 1.

**Table columns (contact split):**  
Công ty | SĐT | Email | Website | Fanpage | Zalo | Địa chỉ | Score | ICP | Phân loại | Status | Dial | Feedback | actions…

- Website / Fanpage / Zalo: external links when set, else `—`.
- SĐT: `tel:` link when set.

**Paging:** 50 rows/page; Prev / Next; label `Trang {page}/{total_pages} · {total} lead`. Page count unbounded by total.

**Edit:** PATCH supports new fields; accept checklist modal may stay as-is for v1 if inline edit is not already present — columns must display DB values.

## 7. Compatibility

- Old clients ignoring new response keys still receive `leads`.
- Rows without fanpage/zalo show `—`.
- Default list without `include_auto_rejected=1` still hides `auto_rejected` (unchanged).

## 8. Success criteria

1. New columns exist after API boot / first harvest hit.  
2. List returns correct `total` / `total_pages` at page_size 50.  
3. Filters change result set and reset page.  
4. UI shows separate columns for all contact fields including Fanpage and Zalo URL.  
5. Export CSV includes the two new columns.  
6. Unit/repo tests for paging math + filter clauses; FE smoke via existing panel patterns.

## 9. Out of scope / later

- Dedicated edit drawer for all contact fields (nice-to-have).  
- Push CRM mapping of fanpage/zalo.  
- Snapshots / market entity contact sync.

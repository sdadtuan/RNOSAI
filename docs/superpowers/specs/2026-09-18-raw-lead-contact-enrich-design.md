# Raw Lead Phase 3 — Contact Enrich Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-18 |
| Trạng thái | Approved via “viết plan rồi implement” |
| Parent | RSR readiness Phase 1–2 |

## Goal

Cứu lead `MISSING_CONTACT`: bổ sung SĐT/email từ Places Details + scrape website/evidence, rồi **reclassify** readiness (→ REVIEW / READY khi đủ).

## API

`POST .../projects/:id/raw-leads/enrich-contacts`

Body:

```json
{
  "lead_ids": [1,2],
  "only_missing_contact": true,
  "limit": 50
}
```

Defaults: `only_missing_contact=true` nếu không có `lead_ids`; `limit` max 50.

Per lead:

1. Skip `pushed`.
2. If `place_id` + Places key → `placeDetails` → merge phone/website/fanpage.
3. Scrape `website` / `fanpage_url` / `evidence_url` (timeout ngắn) → merge phone/email.
4. Persist phone/phone_norm/email/website/fanpage/contactable + bump `verify_json.enrich`.
5. Reclassify readiness (reuse Phase 1 path).

Return `{ enriched, unchanged, failed, counts, readiness_counts }`.

## UI

- Toolbar **Bổ sung contact**: selection nếu có; else tab Thiếu contact / all MISSING.
- Toast breakdown.

## Out of scope

Async job queue, Facebook Graph API, bulk Accept, clustering.

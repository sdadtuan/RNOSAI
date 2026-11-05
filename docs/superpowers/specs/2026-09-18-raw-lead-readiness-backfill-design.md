# Raw Lead Readiness Phase 1 — Backfill + Reclassify Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-18 |
| Trạng thái | Approved via “triển khai phase 1” |
| Parent | `2026-09-18-raw-lead-readiness-rsr-design.md` |
| Mục tiêu | Phân loại readiness cho Lead thô đã có trong DB; cho phép staff chỉnh tay |

## Scope

1. **Backfill auto-classify** rows trong `crm_research_raw_leads` (mặc định `readiness_status IS NULL`, bỏ `pushed`).
2. **PATCH** `readiness_status` (+ reason) thủ công (FR-READINESS-003).
3. **UI** nút “Phân loại lại” + dropdown readiness trên row (run cap).

## Out of scope

Force re-fetch Places, Accept→Ready flow (Phase 2), clustering / P1–P3.

## API

| Endpoint | Behavior |
|---|---|
| `POST .../projects/:id/raw-leads/reclassify-readiness` | Body: `{ only_unclassified?: true, job_id?, lead_ids?, force?: false }`. Chạy `classifyRawLeadReadiness` từ dữ liệu đã lưu + blacklist/CRM/dup phone + job vertical/territory. Return `{ updated, skipped, counts }`. |
| `PATCH .../raw-leads/:id` | Thêm `readiness_status`, `readiness_reason_codes?`. Block set READY nếu reason có `DNC`/`BLACKLIST` trừ khi `force_ready=true` (MVP: reject BLACKLIST/DNC → READY). |

## Classify-from-row rules

Derive từ row (+ job + blacklist list + CRM phone check):

- `phone_valid` = phone_norm ≥9 digits && !sequential && (verify_json.phone_ok !== false nếu có phone)
- `email_valid` = email non-empty && !disposable && (verify_json.email_ok !== false)
- `company_website_ok` = website && !denylist host
- `social_only` = fanpage && !company_website_ok
- `quality_score` = row.quality_score
- dup/blacklist/CRM như Intent path

## UI

- Toolbar: **Phân loại lại** → POST only_unclassified=true → reload tabs/counts.
- Optional: nếu có selection → chỉ reclassify selection.
- Cột Readiness: select (canRun) để PATCH.

## Success

Lead Job 19/20 cũ vào đúng tab READY/REVIEW/MISSING/DUP; Push CRM hoạt động với READY.

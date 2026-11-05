# Raw Lead Phase 4 — Bulk Ops Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-18 |
| Trạng thái | Approved via “viết plan rồi implement phase 4” |

## Goal

Thao tác hàng loạt trên Lead thô: **Accept nhiều dòng** (NEEDS_REVIEW → READY), **chọn nhanh** theo readiness trên trang, Push CRM theo selection (giữ gate READY).

## API

`POST .../projects/:id/raw-leads/bulk-accept`

```json
{
  "lead_ids": [1,2,3],
  "accepted_checklist_json": { "opened_evidence": true, "...": true }
}
```

Per id (max 100):

- Skip nếu không tìm thấy / `pushed` / `rejected`
- `status=accepted` + checklist
- Apply `readinessAfterAccept` (Phase 2 rules)
- Return `{ accepted, skipped, promoted_ready, errors[] }`

Push CRM: giữ endpoint hiện có (đã bulk theo `lead_ids`).

## UI

| Control | Behavior |
|---|---|
| **Accept đã chọn** | Modal checklist 1 lần → bulk-accept selection |
| **Chọn Ready (trang)** | Select all `READY_TO_PUSH` trên trang hiện tại |
| **Chọn Review (trang)** | Select all `NEEDS_REVIEW` + pending trên trang |
| Push CRM | Unchanged; hint khi selection có non-READY |

## Out of scope

Bulk edit phone/email fields, async queue, select-all-across-pages (server-side).

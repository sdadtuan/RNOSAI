# Raw Lead Readiness Phase 2 — Accept → Ready Design

| Thuộc tính | Nội dung |
|---|---|
| Phiên bản | 1.0 |
| Ngày | 2026-09-18 |
| Trạng thái | Approved via “triển khai phase 2” |
| Parent | RSR readiness MVP + Phase 1 backfill |

## Goal

Staff **Accept** lead ở tab **Cần review** (`NEEDS_REVIEW`) → tự promote `readiness_status=READY_TO_PUSH` (reason `STAFF_ACCEPTED`) để **Push CRM** theo gate READY hiện có.

## Rules

Khi `PATCH` với `status=accepted`:

| readiness trước | Hành động |
|---|---|
| `NEEDS_REVIEW` | → `READY_TO_PUSH` + `STAFF_ACCEPTED` + classification `pass` |
| `READY_TO_PUSH` | giữ nguyên |
| `MISSING_CONTACT` | **không** auto-promote (thiếu contact; AM sửa SĐT rồi Accept lại hoặc đổi readiness tay) |
| `DUPLICATE_OR_BLACKLIST` | **không** auto-promote (trừ PATCH readiness `force_ready`) |
| `null` (legacy) | → `READY_TO_PUSH` + `STAFF_ACCEPTED` nếu `contactable`; else giữ null / set `NEEDS_REVIEW` |

Push CRM: không đổi — vẫn chỉ `READY_TO_PUSH` (hoặc legacy `accepted` không readiness).

## UI

- Accept modal: “Accept lead Cần review sẽ chuyển sang **Sẵn sàng push**.”
- Tab Cần review: nhấn mạnh Accept trước khi Push.
- Sau Accept thành công: toast + reload (lead vào tab Ready).

## Out of scope

Bulk Accept, MISSING→READY auto, override blacklist (đã có Phase 1 force_ready).

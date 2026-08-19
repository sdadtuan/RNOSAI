# RNOSAI — HR Use Cases

## HR-UC-001 — Employee File P1 (Identity + Address)

**Actor:** HR / Lead (view-only, PII masked)

**Pre:** `PTT_HR_EMPLOYEE_FILE=1`, DDL P1 applied, NV tồn tại trong `crm_staff`.

**Flow:**
1. Mở `/crm/staff/:id` → shell 2-pane với header vòng % hồ sơ.
2. Tab **Hồ sơ**: card Định danh (CCCD, MST, ngân hàng) + card Địa chỉ (thường trú / tạm trú).
3. Lưu từng card riêng (L-01) — PATCH identity ≠ PUT addresses.
4. Lead không có `crm_hr_pii.view` → CCCD/MST mask server-side.
5. Tab **CRM / Case** giữ workspace KPI hiện có.

**API:**
- `GET /api/v1/hr/staff/:id/profile`
- `PATCH /api/v1/hr/staff/:id/identity`
- `PUT /api/v1/hr/staff/:id/addresses`

**Verify:** `bash scripts/smoke_hr_employee_file_p1.sh`

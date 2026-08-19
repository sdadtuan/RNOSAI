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

## HR-UC-004 — Document Wallet P4

**Actor:** HR

**Pre:** P1 deployed + P4 DDL + `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. Tab **Ví giấy tờ** (default) trên `/crm/staff/:id`.
2. Thêm thẻ (CCCD, bằng, chứng chỉ…) → upload PDF/JPG.
3. Lọc: Sắp hết hạn · Bằng cấp · Thiếu file.
4. Roster `/crm/staff`: cột **Ví %** + chip hết hạn.
5. Header: vòng **Ví %** thay cho hồ sơ cơ bản khi P4 sẵn sàng.

**API:** `GET/POST/PATCH wallet`, `POST .../files`, `GET doc-types`, `GET wallet-roster-stats`.

**Verify:** `bash scripts/smoke_hr_employee_file_p4.sh`

## HR-UC-002 — Labor Contracts P2 (HĐLĐ)

**Actor:** HR

**Pre:** P1 + P4 deployed, P2 DDL, `PTT_HR_EMPLOYEE_FILE=1`.

**Flow:**
1. Tab **Hợp đồng** trên `/crm/staff/:id`.
2. Timeline HĐLĐ — tạo/sửa hợp đồng, thêm phụ lục trên cùng HĐ (BR-HR-112).
3. Chọn thẻ ví loại hợp đồng làm scan (BR-HR-140) — không upload riêng.
4. Kích hoạt HĐ mới → HĐ active cũ chuyển `superseded` (BR-HR-110).
5. Header badge **HĐ sắp hết hạn** khi còn ≤30 ngày (BR-HR-111).
6. Lương gross mask nếu thiếu `crm_hr_pii.view`.

**API:**
- `GET/POST /api/v1/hr/staff/:id/contracts`
- `PATCH .../contracts/:contractId`
- `POST/PATCH .../contracts/:contractId/appendices[/:appendixId]`

**Verify:** `bash scripts/smoke_hr_employee_file_p2.sh`

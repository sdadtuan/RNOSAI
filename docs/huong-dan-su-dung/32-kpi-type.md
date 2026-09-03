# KPI Type — Hướng dẫn sử dụng

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-09-03  
> **Đối tượng:** Tenant Admin, HR, Marketing Lead, GDKD (cấu hình KPI)  
> **URL:** https://rs.pttads.vn/crm/kpi/types  
> **Menu:** Quản trị hệ thống → Thiết lập KPI → **KPI Type**

Tài liệu mô tả cách **chuẩn hóa loại chỉ tiêu KPI** — mã, đơn vị, mục tiêu, công thức AUTO/HYBRID và nguồn dữ liệu live trên PostgreSQL.

**Tài liệu liên quan:**

| Chủ đề | File |
|--------|------|
| SRS | [../superpowers/specs/2026-09-03-kpi-type-setup-srs.md](../superpowers/specs/2026-09-03-kpi-type-setup-srs.md) |
| Design hướng C | [../superpowers/specs/2026-09-03-kpi-type-setup-design.md](../superpowers/specs/2026-09-03-kpi-type-setup-design.md) |
| Nhóm KPI | [31-kpi-nhom-kpi.md](./31-kpi-nhom-kpi.md) |

---

## 1. KPI Type là gì?

**KPI Type** nằm dưới **Nhóm KPI**. Ví dụ nhóm `GROWTH_CONVERSION` chứa type `MQL_COUNT`.

Khi tạo chỉ tiêu KPI, chọn type **Đang hoạt động** để kế thừa đơn vị / hướng đo / nhóm.

---

## 2. Quyền truy cập (RBAC)

| Cap | Hành vi |
|-----|---------|
| `crm_kpi_types.view` | Danh sách, chi tiết, versions, audit |
| `crm_kpi_types.manage` | Tạo, sửa, kích hoạt, nhân bản, xóa |
| `crm_kpi_types.configure` | Kiểm tra công thức (hoặc có `manage`) |
| `crm_kpi_types.export` | Dự phòng xuất dữ liệu |

Seed mặc định: **SUPER-ADMIN**, **CEO**, **GD**.

```bash
bash scripts/seed_kpi_types_rbac.sh --apply
```

Sau khi cấp quyền: **đăng xuất / đăng nhập lại**.

---

## 3. Màn hình danh sách

**Route:** `/crm/kpi/types`

Thẻ: Tổng / Đang hoạt động / Bản nháp / Có đồng bộ tự động.

---

## 4. Form Thêm KPI Type

Năm section: thông tin cơ bản, đơn vị & hướng đo, mục tiêu, cách tính, phạm vi.

- **Lưu nháp** — DRAFT, không cần công thức VALID.
- **Lưu & Kích hoạt** — AUTO/HYBRID bắt buộc công thức VALID + nguồn HEALTHY/STALE.
- **Kiểm tra công thức** — preview số liệu, không trả PII.

Ví dụ DSL:

```text
COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)
```

`lifecycle_stage` map sang `crm_leads.status`. Ads: `SUM(AdSpend.amount WHERE date IN evaluation_period)` đọc `daily_performance.spend`.

---

## 5. Deploy

```bash
APPLY=1 ./scripts/deploy_kpi_types_vps.sh
# hoặc trên VPS:
bash scripts/apply_pg_ddl_kpi_types.sh
bash scripts/seed_kpi_types_rbac.sh --apply
sudo systemctl restart ptt-crm-api ptt-ops-web
```

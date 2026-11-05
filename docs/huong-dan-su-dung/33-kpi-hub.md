# KPI Hub — Hướng dẫn sử dụng

> **Phiên bản:** 1.0 · **Cập nhật:** 2026-09-04  
> **Đối tượng:** Tenant Admin, Data/BI, Marketing Lead, Sales Lead, CEO  
> **URL:** https://rs.pttads.vn/crm/kpi-hub  
> **Menu:** Nhân sự & Hiệu suất → **KPI Hub** (hoặc Quản trị → Thiết lập KPI → KPI Hub)

KPI Hub là **lớp semantic/governance** giữa CRM, Ads, ERP và Dashboard/Báo cáo. Hub **không thay** Sổ điểm KPI (`/crm/kpi`), Nhóm KPI hay KPI Type — Dictionary có thể liên kết `kpi_type_id` tùy chọn.

**Tài liệu liên quan:**

| Chủ đề | File |
|--------|------|
| SRS v1.1 | [../superpowers/specs/2026-09-04-kpi-hub-srs.md](../superpowers/specs/2026-09-04-kpi-hub-srs.md) |
| KPI Type | [32-kpi-type.md](./32-kpi-type.md) |
| Nhóm KPI | [31-kpi-nhom-kpi.md](./31-kpi-nhom-kpi.md) |

---

## 1. Sidebar — 7 mục

| # | Mục | Route |
|---|-----|-------|
| 1 | Dashboard | `/crm/kpi-hub` |
| 2 | KPI Dictionary | `/crm/kpi-hub/dictionary` |
| 3 | Target & Cảnh báo | `/crm/kpi-hub/targets` |
| 4 | Nguồn dữ liệu | `/crm/kpi-hub/sources` |
| 5 | Data Quality | `/crm/kpi-hub/quality` |
| 6 | Báo cáo | `/crm/kpi-hub/reports` |
| 7 | Cài đặt | `/crm/kpi-hub/settings` |

Nút **Thu gọn** ở đáy sidebar thu hẹp menu còn icon.

---

## 2. Quyền truy cập (RBAC)

| Section | Hành động | Màn hình |
|---------|-----------|----------|
| `crm_kpi_hub` | view | Dashboard |
| `crm_kpi_dictionary` | view, manage, publish | Dictionary |
| `crm_kpi_hub_targets` | view, manage | Target & Cảnh báo |
| `crm_kpi_hub_sources` | view, configure | Nguồn dữ liệu |
| `crm_kpi_quality` | view, manage, export | Data Quality |
| `crm_kpi_hub_reports` | view, manage, approve, send | Báo cáo |
| `crm_kpi_hub_settings` | view, manage | Cài đặt |

Seed mặc định: **SUPER-ADMIN**, **CEO**, **GD**.

```bash
bash scripts/seed_kpi_hub_rbac.sh --apply
```

Sau khi cấp quyền: **đăng xuất / đăng nhập lại**.

---

## 3. Dashboard

- Kỳ mặc định: **Tháng 09/2026**
- 5 thẻ: Doanh thu ký mới, Valid Leads, CPL Valid Lead, MQL Rate, Win Rate
- Funnel 6 tầng + **Điểm nghẽn** (MQL Rate)
- Donut tiến độ target 68% + 4 nhóm
- Footer freshness: CRM Fresh, Meta Ads Fresh, SharePoint Delayed

Dashboard đọc fact đã materialize — **không query Ads live** theo request.

---

## 4. KPI Dictionary

- 4 thẻ tóm tắt: Tổng / Active / Cần rà soát / Nguồn dữ liệu
- Click hàng → drawer phải (ví dụ CPL Valid Lead `MKT_006`)
- **+ Tạo KPI** → form 5 tab: Tổng quan, Công thức & Logic, Nguồn dữ liệu, Target, Governance
- **Lưu nháp** không cần đủ field; **Lưu & Xuất bản** bị chặn nếu thiếu formula/source/owner

Mã KPI immutable sau Publish: `MKT_006`, `SAL_008`, …

---

## 5. Target & Cảnh báo

Thiết lập target theo kỳ, ngưỡng Warning/Critical, quy tắc alert (Email, Teams). CPL 142k vs target 150k → **Đạt**.

---

## 6. Triển khai

```bash
# DDL + RBAC + test + build
bash scripts/deploy_kpi_hub_vps.sh --local

# Hoặc từ laptop
APPLY=1 ./scripts/deploy_kpi_hub_vps.sh
```

E2E (tùy chọn):

```bash
cd services/ops-web && npx playwright test e2e/kpi-hub.spec.ts
```

---

## 7. Phân biệt metric quan trọng

| Mã | Ý nghĩa |
|----|---------|
| `SAL_008` | Doanh thu **ký mới** (hợp đồng Won/Signed) |
| `FIN_001` | Doanh thu **xuất hóa đơn** |
| `FIN_002` | Doanh thu **thu tiền** |

Không gộp ba metric này trên UI hay báo cáo.

---

## 8. P2 — Dữ liệu thật & Governance (2026-09)

### 8.1 Fact compute

- Facts được materialize vào `crm_kpi_facts` qua batch job (cron 08:00) hoặc thủ công:
  - `POST /api/crm/kpi-hub/facts/recompute` body `{ "period": "2026-09" }`
- Dashboard đọc facts, không query Ads live theo request.
- Ratio (CPL, MQL Rate, Win Rate): `sum(num)/sum(den)` — không AVG tỷ lệ ngày.

### 8.2 Formula & Dependency

- Tab **Công thức** có Filter Builder, preview số dòng, dependency upstream/downstream.
- `GET /api/crm/kpi-hub/dictionary/:id/dependencies`
- `POST /api/crm/kpi-hub/dictionary/:id/preview`

### 8.3 Target hierarchy

- Thứ tự ưu tiên: Campaign/User → Team → Department → Workspace.
- Import target preview: `POST /api/crm/kpi-hub/targets/import/preview`

### 8.4 Alert engine

- Dedup 240 phút; upgrade Critical bypass dedup.
- Ack qua UI Target hoặc `POST /api/crm/kpi-hub/alerts/:id/ack`

### 8.5 Data Quality

- 14 rule mặc định; chạy thủ công: **Data Quality → Chạy kiểm tra** hoặc `POST /quality/run`
- Issue có thể assign và tạo ticket IWR.

### 8.6 Export & Power BI

| Endpoint | Mục đích |
|----------|----------|
| `GET /export/dictionary.xlsx` | Xuất catalog KPI |
| `GET /export/targets.xlsx` | Xuất target kỳ |
| `GET /bi/dim-kpi` | Dimension KPI (read-only) |
| `GET /bi/fact-actual?from=2026-09-01` | Fact actual cho BI |

### 8.7 Deploy P2 VPS

```bash
chmod +x scripts/deploy_kpi_hub_p2_vps.sh
APPLY=1 ./scripts/deploy_kpi_hub_p2_vps.sh
sudo systemctl restart ptt-crm-api ptt-ops-web
```

E2E P2:

```bash
cd services/ops-web && npx playwright test e2e/kpi-hub-p2.spec.ts
```

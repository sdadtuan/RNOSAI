# KPI Type — Design (hướng C)

**Ngày:** 2026-09-03  
**SRS:** `docs/superpowers/specs/2026-09-03-kpi-type-setup-srs.md` (copy từ Downloads)  
**UI:** mockup **Thêm KPI Type** (form 2 cột + sidebar preview)  
**Phụ thuộc:** Nhóm KPI đã ship (`crm_kpi_groups`, `/crm/kpi/groups`)

## Quyết định

- **Hướng C:** Phase 1 CRUD + Phase 2 AUTO/HYBRID với **connector live** trên nguồn đã có trong PostgreSQL. Không visual formula builder (Phase 3). Không AI (Phase 4 / SRS §2.2).
- Module Nest `kpi-types` cạnh `kpi-groups`. API `/api/v1/kpi-types`. UI `/crm/kpi/types`. Admin **Thiết lập KPI** thêm link **KPI Type**.
- `tenant_id text DEFAULT 'PTT'` — cùng pattern Nhóm KPI.
- Formula DSL hạn chế (allowlist), không SQL tự do. Preview **không trả PII**.
- Connector lỗi → `CONNECTION_ERROR` / Data Health; **không ghi 0 giả** (BR-14, AC-14).

## Connector live (v1)

| Catalog code | Entity | Bảng / nguồn | Health |
|---|---|---|---|
| `CRM_LEAD_DASHBOARD` | Lead | `crm_leads` — `status` map `lifecycle_stage`, `created_at`, `source` | HEALTHY nếu query timeout < 10s |
| `ADS_META` | AdSpend / Lead | `daily_performance` — `spend`, `leads_crm`, `conversion_value`, `performance_date` | STALE nếu `synced_at` > 48h; CONNECTION_ERROR nếu bảng/query fail |
| `CRM_FINANCE` | AttributedRevenue | `daily_performance.conversion_value` + lead `status` won nếu có | như Ads |

Nguồn catalog khác (SEO, Social, Survey) seed được nhưng health = `UNAVAILABLE` cho đến khi có adapter — không chặn lưu DRAFT; **chặn ACTIVE** nếu AUTO/HYBRID trỏ nguồn UNAVAILABLE.

## Formula DSL

```
COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)
SUM(AdSpend.amount WHERE date IN evaluation_period)
AVG(...)  RATE(a / b)  DISTINCT_COUNT(...)
```

Parser thuần (Jest). Compiler → parameterized SQL trong adapter. Chia 0 → fallback cấu hình (`ZERO` | `NA` | `ERROR`), mặc định `ERROR`.

## Phân cấp

```
crm_kpi_groups (đã có)
  └── crm_kpi_types
        └── crm_kpi_metrics.kpi_type_id (nullable, Wave gắn metric)
              └── crm_kpi_type_versions (công thức + snapshot)
```

## Ngoài scope lần này

- Visual formula builder, workflow phê duyệt, import/export CSV (làm sau như W3 Nhóm KPI).
- Query trực tiếp Ads/GA4 API (dùng bảng đã sync).
- Payroll / thưởng từ điểm KPI.

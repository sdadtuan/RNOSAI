# CP Magnific Flows — staging runbook (Wave B+)

> **Môi trường:** https://rs.pttads.vn · tenant `PTT`  
> **SoT:** [SPEC-CP-MAGNIFIC-FLOWS v1.0](../superpowers/specs/2026-09-13-cp-magnific-flows-srs.md) · plan [cp-magnific-flows](../superpowers/plans/2026-09-13-cp-magnific-flows.md)  
> **UI:** `/crm/creative-os/projects/[id]?tab=ai-ops&pane=magnific` → chế độ **Flow (Spaces)**  
> **Artifact:** [`docs/magnific/social-916-flow-api-runs.json`](../magnific/social-916-flow-api-runs.json)

**Quy tắc cứng:** `MAGNIFIC_FLOWS_ENABLED=0` mặc định trên prod. Chỉ bật sau UAT §18 pass. Rollback = flag `0` + restart — không cần revert code.

---

## 1. Publish Flow trên Magnific (staging account PTT)

1. Mở Magnific **Spaces** → build / publish pipeline Social **9:16** (image → video).
2. Blueprint tham chiếu nội bộ (không paste được): [`social-916-flow-blueprint.json`](../magnific/social-916-flow-blueprint.json).
3. Sau publish, ghi **Flow sqid** (vd. `uqzQLDr2Aw`) — không phải UUID node.

---

## 2. Verify sqid qua Magnific API (server-side)

Dùng API key đã lưu trong `crm_cp_provider_connections` (`magnific_rest`), **không** gọi từ browser.

```bash
curl -sS -H "X-Magnific-Api-Key: $MAGNIFIC_REST_KEY" \
  "https://api.magnific.com/v1/ai/flows" | jq '.data[] | {sqid, name, total_cost}'
```

Hoặc một flow cụ thể:

```bash
SQID="REPLACE_WITH_SQID"
curl -sS -H "X-Magnific-Api-Key: $MAGNIFIC_REST_KEY" \
  "https://api.magnific.com/v1/ai/flows/${SQID}" | jq '{sqid, name, inputs, total_cost}'
```

- [ ] sqid tồn tại, status published
- [ ] `inputs` có `api_key` = `image_prompt`, `motion_prompt` (và `start_image` nếu dùng template ref)

---

## 3. Cập nhật seed SQL

1. Mở [`scripts/seed_cp_magnific_flow_templates_staging.sql`](../../scripts/seed_cp_magnific_flow_templates_staging.sql).
2. Thay **cả hai** chỗ `REPLACE_WITH_SQID` bằng sqid thật (`external_ref` và `bindings_json.flow_sqid`).
3. Commit seed (staging branch) — **không** commit API key.

---

## 4. Apply DDL + seed (VPS)

```bash
cd /var/www/rnosai
git pull --ff-only origin main

# Cache bảng flow definition
./scripts/apply_pg_ddl_cp_magnific_flows.sh

# Seed template social_916_i2v (sau khi sqid đã thay)
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f scripts/seed_cp_magnific_flow_templates_staging.sql
```

Xác nhận catalog:

```bash
psql "$DATABASE_URL" -c "
  SELECT t.name, m.external_ref AS flow_sqid, m.active
    FROM crm_cp_templates t
    JOIN crm_cp_provider_template_map m ON m.template_id = t.id
   WHERE m.provider = 'magnific_rest'
     AND m.bindings_json->>'execution_kind' = 'flow';"
```

- [ ] `external_ref` ≠ `REPLACE_WITH_SQID`
- [ ] Template **Social 9:16 · Image → Video** hiển thị trong `GET /api/crm/cp/magnific/templates` (flag bật)

---

## 5. Deploy code (flags vẫn 0)

```bash
cd /var/www/rnosai
APPLY=1 ./scripts/deploy_cp_magnific_flows_staging.sh
```

Script: pull → DDL idempotent → build `ptt-crm-api` + `ops-web` → chạy test Magnific Flow → restart services. **Không** tự bật flag.

Env tối thiểu (giữ `0` cho đến bước 6):

```
MAGNIFIC_REST_API_ENABLED=0
MAGNIFIC_FLOWS_ENABLED=0
MAGNIFIC_FLOW_CACHE_TTL_SEC=900
MAGNIFIC_FLOW_WAIT_MS=300000
MAGNIFIC_FLOW_POLL_MS=4000
MAGNIFIC_FLOW_BATCH_MAX=20
```

`magnific_rest` API key: lưu qua UI **Settings → Integrations** (`crm_cp.manage`) hoặc env ops — không commit.

---

## 6. Bật flag staging (sau deploy xanh)

Chỉnh env `ptt-crm-api` (và restart):

```
MAGNIFIC_REST_API_ENABLED=1
MAGNIFIC_FLOWS_ENABLED=1
```

```bash
sudo systemctl restart ptt-crm-api
sudo systemctl restart ptt-ops-web
```

Kiểm tra flags API (staff token):

```bash
curl -sS -H "Authorization: Bearer $STAFF_TOKEN" \
  https://rs.pttads.vn/api/crm/cp/ai-ops/flags | jq '{magnificRest,magnificFlows}'
```

Kỳ vọng: cả hai `true`.

---

## 7. UAT 15 phút (SPEC §18)

Project pilot CRM (vd. Nova Mid-autumn). Operator có `crm_cp.render` + `crm_cp.render_high_cost`.

| # | Việc | Pass |
|---|------|------|
| 1 | Flag off → toggle Flow ẩn / `GET /magnific/templates` 404 | |
| 2 | Pane → **Flow (Spaces)** → dropdown **Social 9:16** | |
| 3 | Draft không tick confirm → Submit → `human_confirm_required` | GT-M04 |
| 4 | Confirm + Submit → video trong media project | `asset_id` + checksum |
| 5 | Provenance `flow:{sqid}` trên asset | audit |
| 6 | Tool mode (không `execution_kind`) vẫn chạy khi tắt Flow flag | no regress |
| 7 | Network tab browser → **0** `X-Magnific-Api-Key` | GT-M07 |

**Prompt pilot:** row 1 trong [`social-916-flow-api-runs.json`](../magnific/social-916-flow-api-runs.json) (`image_prompt` + `motion_prompt`).

---

## 8. Rollback

Không cần revert migration (DDL idempotent). Tắt Flow ngay:

```
MAGNIFIC_FLOWS_ENABLED=0
```

Giữ `MAGNIFIC_REST_API_ENABLED=1` nếu Wave B tool mode vẫn cần.

```bash
sudo systemctl restart ptt-crm-api
sudo systemctl restart ptt-ops-web
```

- UI: chỉ còn **Tool đơn** (Wave B).
- Jobs `execution_kind=flow` đang chạy: cancel thủ công; không submit mới.
- Seed/catalog: có thể để nguyên (`active=false` trên map nếu cần ẩn template).

---

## 9. Troubleshooting

| Triệu chứng | Gợi ý |
|-------------|--------|
| Dropdown trống | Seed chưa apply / `active=false` / sqid placeholder |
| `magnific_flow_not_found` | sqid sai hoặc Flow chưa publish |
| `flow_input_missing` | Thiếu `image_prompt` / `motion_prompt` |
| `magnific_flows_disabled` | `MAGNIFIC_FLOWS_ENABLED=0` hoặc thiếu REST |
| `POLICY_BLOCKED` GT-M02 | Balance Magnific thấp hơn estimate |
| Ingest timeout | Tăng `MAGNIFIC_FLOW_WAIT_MS`; kiểm tra poll logs |

---

## 10. Liên quan

| Tài liệu | Việc |
|----------|------|
| [`cp-ai-ops-vps-uat.md`](cp-ai-ops-vps-uat.md) | Wave A/B/C Magnific tool |
| [`apply_pg_ddl_cp_magnific_flows.sh`](../../scripts/apply_pg_ddl_cp_magnific_flows.sh) | DDL cache |
| [`deploy_cp_magnific_flows_staging.sh`](../../scripts/deploy_cp_magnific_flows_staging.sh) | Deploy B+ |

**Cổng go-live B+:** UAT §18 pass · sqid thật trong seed · 0 API key trên browser · Wave B không regress.

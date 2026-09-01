# MKT-AI Industry Playbooks — Ops runbook

> **Admin UI:** `/crm/admin/mkt-ai/playbooks` (Sinh / Duyệt / Active)  
> **Disk fallback:** `services/ptt-crm-api/src/marketing-ai-planner/playbooks/*.json`  
> **Policy DB:** `mkt_ai_service_policy` · **Versions:** `mkt_ai_playbook_versions`  
> **Verify disk:** `./scripts/verify_mkt_ai_playbooks.sh`  
> **Spec:** [`2026-09-01-mkt-ai-playbook-learn-catalog-design.md`](../superpowers/specs/2026-09-01-mkt-ai-playbook-learn-catalog-design.md)

---

## 1. Mục tiêu

MKT Lead vận hành playbook qua **Admin UI** — bật pilot/ga theo slug, học nháp từ HĐ thắng, duyệt và Active thủ công. Không fine-tune model. Không auto-active.

DevOps vẫn có thể ship playbook **shipped** qua PR JSON (3 industry + `_common`) làm baseline disk; sau deploy import vào bảng version (Task 8 seed).

---

## 2. Admin UI — luồng Sinh / Duyệt / Active

**Route:** `/crm/admin/mkt-ai/playbooks`  
**Cap:** `crm_mkt_ai.view` (xem) · `crm_mkt_ai.generate` (Sinh, sửa nháp) · `crm_mkt_ai.approve` (policy, Duyệt, Active)

### 2.1. Danh sách

| Cột | Ý nghĩa |
|-----|---------|
| Dịch vụ | Label VI + `service_slug` |
| Rollout | Chip `off` / `pilot` / `ga` (policy DB) |
| Playbook active | Version + depth đang dùng Planner |
| Mẫu | `n/5 · m/3` — ứng viên corpus / HĐ thắng closed-loop |
| Mở | Chi tiết slug |

### 2.2. Chi tiết slug (`?slug=`)

1. **Corpus** — thanh tiến độ, danh sách HĐ ứng viên, checkbox loại khỏi lần Sinh.
2. **Playbook** — chọn version, sửa field schema (label, brief, hints, KPI…).
3. **Hành động:**
   - **Sinh playbook từ HĐ thực chiến** — chỉ bật khi ≥5 ứng viên (`can_learn`). Disabled: `Còn N HĐ…`.
   - **Gửi duyệt** → `pending_review`
   - **Duyệt** / **Yêu cầu sửa** (MKT Lead, staff JWT)
   - **Active** — chỉ khi `approved` (không có nút Active trên `draft`)
   - **Rollback** — retire version, không tự Apply TMMT

### 2.3. Ngưỡng học (§6 spec)

| Ngưỡng | Giá trị |
|--------|---------|
| Ứng viên tối thiểu | 5 HĐ (Apply + quality ≥70 + đã sửa tay + không seed UAT) |
| Thắng closed-loop | 3 HĐ |
| Depth `deep` | ≥3 thắng có artifact Ops/QA/Content Done |
| Prompt excerpts | ≤15 |
| Cooldown Sinh | 7 ngày / slug |
| Quality gate | ≥70 |

Output AI luôn **`draft`** hoặc `rejected_auto` — **không** `active`.

### 2.4. Bật pilot cho slug mới (thay sửa env)

1. MKT Lead mở Admin → Playbook DV → slug (vd. `quang-cao-facebook`).
2. Toggle rollout **pilot** (PATCH policy).
3. SP mở AI Planner trên lifecycle slug đó — **không cần restart API**.

Nếu slug chưa có JSON riêng → Planner dùng playbook **`_common`** (Playbook chung).

---

## 3. Một mã 403 (P0)

Hai mã cũ `mkt_ai_planner_slug_not_pilot` và `mkt_ai_pilot_slug_required` đã gộp:

| Mã | Khi nào | Hành động |
|----|---------|-----------|
| `mkt_ai_service_not_enabled` | Policy `off` hoặc slug chưa pilot/ga | MKT Lead bật pilot tại Admin; message VI + `admin_path` |
| `mkt_ai_planner_disabled` | `PTT_MKT_AI_PLANNER_ENABLED=0` | Bật module + restart |

Env legacy `PTT_MKT_AI_PLANNER_SLUGS` / `PTT_MKT_AI_PILOT_*` vẫn **AND** nếu còn set; để trống = chỉ policy DB.

---

## 4. VPS P0 — policy DB (trước học playbook)

```bash
cd /var/www/rnosai
source .env
psql "$DATABASE_URL" -f docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-policy.sql
psql "$DATABASE_URL" -f scripts/seed_mkt_ai_service_policy.sql
# Tuỳ chọn mở Facebook ngay:
# psql "$DATABASE_URL" -c "UPDATE mkt_ai_service_policy SET rollout='pilot' WHERE service_slug='quang-cao-facebook';"
# Tuỳ chọn bỏ AND env cũ:
# unset PTT_MKT_AI_PLANNER_SLUGS   # hoặc để trống trong runtime.env
sudo systemctl restart ptt-crm-api
```

P2 thêm (versions + learn jobs):

```bash
psql "$DATABASE_URL" -f docs/specs/2026-09-01-postgresql-ddl-mkt-ai-playbook-versions.sql
# Import shipped playbooks (idempotent):
# node scripts/seed_mkt_ai_playbook_versions.ts   # hoặc SQL tương đương
sudo systemctl restart ptt-crm-api
```

Flag học: `PTT_MKT_AI_PLAYBOOK_LEARN_ENABLED=1` (staging trước prod).

Smoke:

```bash
bash scripts/verify_mkt_ai_playbooks.sh
PTT_CRM_INTERNAL_KEY=... bash scripts/smoke_mkt_ai_playbooks_admin.sh
```

---

## 5. Playbook PR checklist (disk baseline)

Khi merge PR thay đổi `playbooks/*.json` (shipped industry hoặc `_common`):

- [ ] File `{slug}.json` — `slug` khớp tên file
- [ ] `label_vi`, `service_slugs[]`, `brief_defaults`, `strategy_prompt_hints[]`, `campaign_kpi_templates[]`, `quality_gate`
- [ ] `_common.json`: `service_slugs: []`, `label_vi="Playbook chung"`
- [ ] Cập nhật `MKT_AI_PLAYBOOK_SLUGS` nếu slug mới
- [ ] `./scripts/verify_mkt_ai_playbooks.sh` — exit 0
- [ ] `npm test -- --testPathPattern=marketing-ai-playbook` trong `services/ptt-crm-api`
- [ ] Sau deploy VPS: re-import version `active` nếu cần đồng bộ disk → DB

```bash
./scripts/verify_mkt_ai_playbooks.sh
cd services/ptt-crm-api && npm test -- --testPathPattern=marketing-ai-playbook
```

**Không** dùng PR JSON thay cho luồng Duyệt/Active trên Admin — PR chỉ ship baseline; MKT Lead vẫn duyệt version học trên UI.

---

## 6. Schema tham chiếu (document_json)

| Field | Bắt buộc | Ghi chú |
|-------|----------|---------|
| `slug` | ✓ | = service_slug học (không `_common` khi learn) |
| `label_vi` | ✓ | Hiển thị dropdown |
| `service_slugs` | ✓ | Đúng **một** slug khi learn |
| `brief_defaults` | ✓ | `brand_name` **rỗng** (PII gate) |
| `strategy_prompt_hints` | ✓ | ≥3 khi learn |
| `campaign_kpi_templates` | ✓ | ≥2 |
| `quality_gate` | ✓ | min_score + require_campaign_count |
| `governance_notes_vi` | ○ | Human-in-the-loop, không auto-mail |

Copy template từ `meta-lead-gen.json` hoặc `_common.json`.

---

## 7. Admin API (Task 12)

| Method | Path | Cap |
|--------|------|-----|
| GET | `/api/v1/admin/mkt-ai/playbooks` | view |
| GET | `/api/v1/admin/mkt-ai/playbooks/:slug` | view |
| PATCH | `.../:slug/policy` | approve |
| POST | `.../:slug/learn` | generate |
| PATCH | `/api/v1/admin/mkt-ai/playbooks/versions/:id` | generate |
| POST | `.../versions/:id/decide` | approve |
| POST | `.../versions/:id/activate` | approve |

Disk catalog (legacy smoke): `GET .../playbooks/catalog-disk`.

---

## 8. Rollout sau thay đổi

1. Merge → deploy API + ops-web (Admin UI)
2. Apply DDL/seed nếu lần đầu (§4)
3. MKT Lead: pilot slug → soak → Active version học khi đủ corpus
4. Verify:

```bash
bash scripts/verify_mkt_ai_playbooks.sh
cd services/ops-web && npx playwright test e2e/mkt-ai-playbook-admin.spec.ts
```

---

## 9. Liên kết

| Doc | Path |
|-----|------|
| Thực chiến Planner | [`29-marketing-ai-planner-thuc-chien.md`](../huong-dan-su-dung/29-marketing-ai-planner-thuc-chien.md) |
| Delivery SOP | [`mkt-ai-planner-delivery-sop.md`](./mkt-ai-planner-delivery-sop.md) |
| GA rollout | [`mkt-ai-planner-ga-rollout.md`](./mkt-ai-planner-ga-rollout.md) |
| Spec learn catalog | [`2026-09-01-mkt-ai-playbook-learn-catalog-design.md`](../superpowers/specs/2026-09-01-mkt-ai-playbook-learn-catalog-design.md) |

---

*Runbook v2.0 — Admin UI Sinh/Duyệt/Active + policy DB (2026-09-01).*

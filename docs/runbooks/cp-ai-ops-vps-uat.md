# CP AI Ops — VPS UAT runbook (trước flag=1)

> **Môi trường:** https://rs.pttads.vn (prod) · tenant `PTT`  
> **SoT:** [SPEC-CP-ACO-WIN v1.1](../superpowers/specs/2026-09-13-cp-ai-ops-provider-integration-srs.md) · plan [cp-aco-win-implementation](../superpowers/plans/2026-09-13-cp-aco-win-implementation.md)  
> **Workplace:** `/crm/creative-os/projects/[id]?tab=ai-ops&pane=weave|magnific|comfy`  
> **Người thực hiện:** DevOps + QA + PO (Creative OS) + Designer (Weave demo)

**Quy tắc cứng:** Không bật hết flag một lúc. Wave **A → B → C** tuần tự; restart sau **mỗi** flag. Rollback = flag `0` + restart.

---

## 1. Persona & tài khoản

| Persona | Cap gợi ý | Mục đích |
|---------|-----------|----------|
| **P1 Producer** | `crm_cp.edit`, `crm_cp.render` | Weave WO, Magnific draft/confirm |
| **P2 Finance / AM** | `crm_cp.finance`, `crm_cp.view` | CPA report, ledger |
| **P3 Admin** | `crm_cp.manage` | OAuth Magnific, REST key, provider settings |
| **P4 Pentest / QA** | view only | Cửa B / Cửa C — Network tab, JSON flags |

**Chuẩn bị:** Gán cap tại `/admin/crm/permissions/users` → NV **đăng xuất / đăng nhập lại**.

**Kịch bản demo:** khách `nova`, lifecycle `mid-autumn-2026` — demo Weave **12 phút** Mid-Autumn.

---

## 2. DDL (human checklist — chạy trên VPS, không từ repo agent)

- [ ] Backup prod PG (`pg_dump`) — ghi path: __________
- [ ] Review DDL trước khi apply:
  - `docs/specs/2026-09-13-postgresql-ddl-cp-ai-ops.sql`
  - `docs/specs/2026-09-12-postgresql-ddl-cp-weave.sql` (plan A / Wave Weave)
- [ ] Trên VPS, `DATABASE_URL` đã set trong `.env`
- [ ] Apply CP AI Ops DDL:

```bash
cd /var/www/rnosai
./scripts/apply_pg_ddl_cp_ai_ops.sh
```

- [ ] Apply Weave DDL (plan A):

```bash
cd /var/www/rnosai
./scripts/apply_pg_ddl_cp_weave.sh
```

- [ ] Xác nhận bảng tồn tại:

```bash
psql "$DATABASE_URL" -c "\dt crm_cp_provider_*"
psql "$DATABASE_URL" -c "\dt crm_cp_weave_*"
```

---

## 3. Env mẫu (tất cả flag **0** — không commit secret thật)

Ghi vào service env (`ptt-crm-api`, `ptt-ops-web`) trên VPS. Giá trị nhạy cảm để trống cho đến khi ops điền tay.

```
PTT_WEAVE=0
MAGNIFIC_MCP_ENABLED=0
MAGNIFIC_REST_API_ENABLED=0
COMFYUI_WORKER_ENABLED=0
WEAVE_OPEN_BASE=https://app.weavy.ai/
WEAVE_EXPORT_PREFIX=/var/www/rnosai/data/cp-weave-export
PTT_WEAVE_INGEST=0
PTT_WEAVE_WEBHOOK_SECRET=
PTT_SECRET_ENCRYPT_KEY=
MAGNIFIC_REST_BASE=
COMFYUI_GATEWAY_URL=
CP_AI_ENABLED=0
```

- [ ] Env đã ghi, **chưa** bật flag nào = 1
- [ ] `COMFYUI_WORKER_ENABLED=0` — giữ đến khi GPU checklist (§6) xong
- [ ] Restart sau sửa env:

```bash
sudo systemctl restart ptt-crm-api ptt-ops-web
# sudo tay nếu script deploy bỏ qua restart
```

---

## 4. Wave A — Weave Mức 2

**Bật duy nhất:** `PTT_WEAVE=1` (các flag khác vẫn `0`). Restart `ptt-crm-api` + `ptt-ops-web`.

- [ ] Tab **AI Ops** hiện trên project PRJ-03 (không tab `weave` riêng)
- [ ] URL đúng: `?tab=ai-ops&pane=weave`
- [ ] Tạo Weave Work Order → **Open in Weave** mở `WEAVE_OPEN_BASE`
- [ ] Designer export đúng convention `{client}/{campaign}/{task_id}/{lane}/`
- [ ] **Sync output** → asset trong thư viện project (checksum, thumbnail)
- [ ] Chỉ `review/` / `final/` vào pipeline duyệt — `source/` **không** gửi Hub
- [ ] Demo 12 phút Mid-Autumn: Sync + Hub + deliver — **không hỏi file chat**

**Rollback Wave A:** `PTT_WEAVE=0` → restart cả hai service.

---

## 5. Wave B — Magnific REST + MCP

Sau Wave A xanh. Bật từng flag, restart sau mỗi lần:

1. `MAGNIFIC_MCP_ENABLED=1` — connect OAuth staging
2. `MAGNIFIC_REST_API_ENABLED=1` — REST key staging (body POST, không echo)

- [ ] Settings → Integrations: connect OAuth + REST key staging
- [ ] Pane `?tab=ai-ops&pane=magnific` — radio API / MCP (disable nếu flag off)
- [ ] **1 job REST** staging → asset trong DAM PTT
- [ ] **1 job MCP** staging → asset trong DAM PTT
- [ ] Draft → thử submit **không** confirm → HTTP 400
- [ ] Confirm → submit → provenance `magnific_mcp` / `magnific_rest`, ledger dòng
- [ ] CPA report: số thật hoặc `—` (không mock, không `0₫` khi mẫu số 0)

### Cửa B (bắt buộc — fail = chặn Wave C)

- [ ] **Network tab:** không có token / `api_key` / Bearer secret trên response FE
- [ ] **Settings GET** `/provider-connections`: JSON không echo key — chỉ `has_secret` / status
- [ ] AI Trace / job detail: không lộ token (GT-M07)

**Rollback Wave B:** `MAGNIFIC_MCP_ENABLED=0`, `MAGNIFIC_REST_API_ENABLED=0` → restart.

---

## 6. Wave C — ComfyUI (GPU checklist trước flag=1)

**Giữ `COMFYUI_WORKER_ENABLED=0`** cho đến khi checklist GPU xong. Pane Comfy vẫn **hiện** (copy “Đang xây GPU — chưa nhận job.”).

### GPU checklist (human — trước khi set flag=1)

- [ ] Máy GPU provisioned; Comfy gateway **chỉ** `127.0.0.1:8188` (localhost)
- [ ] VPN / private network — port `:8188` **không** public từ internet
- [ ] `COMFYUI_GATEWAY_URL` set internal trên `ptt-crm-api` only (không ops-web FE)
- [ ] Heartbeat worker < 30s (GT-C01)
- [ ] On-call owner + kênh alert đã gán

Sau checklist xanh:

- [ ] `COMFYUI_WORKER_ENABLED=1` → restart `ptt-crm-api`
- [ ] Pane `?tab=ai-ops&pane=comfy` — submit enabled khi health OK
- [ ] 1 packshot PRODUCTION → asset ingest checksum
- [ ] Tắt Wi-Fi giả lập worker → job `WORKER_UNAVAILABLE`, audit còn

### Cửa C (bắt buộc — fail = không prod)

- [ ] **Pentest / QA:** JSON flags + provider-health **không** chứa `:8188`, `COMFYUI_GATEWAY`, `127.0.0.1`, `localhost`
- [ ] HTML pane Comfy + Settings composer: không lộ gateway URL
- [ ] Probe ngoài VPS → timeout/refuse `:8188` (BG-A-05)
- [ ] UAT submit chỉ khi heartbeat < 30s

**Rollback Wave C:** `COMFYUI_WORKER_ENABLED=0` → restart.

---

## 7. Alerts (bật trước khi flip flag=1 từng wave)

| Alert | Điều kiện | Owner |
|-------|-----------|-------|
| Magnific token / hook fail | > 0 trong 15 phút | DevOps |
| Weave ingest fail | spike / convention skip | Creative Ops |
| Budget 80% | project / lifecycle threshold | AM + Finance |
| Comfy heartbeat | miss > 30s hoặc worker down | DevOps + on-call |

- [ ] Alert rules deployed và test notification
- [ ] On-call rotation ghi tên: __________

---

## 8. Fail UAT — dừng wave, rollback flag=0

**Fail UAT nếu:**

- đoán folder Weave
- duration `0`
- `source/` gửi Hub
- token trên FE
- Comfy URL trên JSON flags
- CPA `0` khi mẫu số 0
- tab `weave` riêng
- `/api/v1`

---

## 9. Smoke nhanh (ops)

```bash
curl -sf https://rs.pttads.vn/login -o /dev/null && echo rs_ok
curl -sf http://127.0.0.1:3000/health   # trên VPS — ptt-crm-api
curl -sf http://127.0.0.1:3200/ -o /dev/null && echo ops_web_ok
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM crm_cp_weave_work_orders;"
```

---

## 10. Ký acceptance

| Wave | PO | QA | DevOps | Ngày |
|------|----|----|--------|------|
| A — Weave | [ ] | [ ] | [ ] | |
| B — Magnific | [ ] | [ ] | [ ] | |
| C — Comfy | [ ] | [ ] | [ ] | |

---

*Cập nhật: 2026-09-13 — Task 13 CP AI Ops VPS UAT (trước flag=1).*

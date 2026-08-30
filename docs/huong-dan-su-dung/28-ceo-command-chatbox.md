# 28 — CEO Command ChatBox

Route: `/crm/ceo` · Learn: `/crm/ceo/learn`

## Ai làm gì

- **A — Briefing:** 6 chip (Hôm nay, Pipeline, SLA, Delivery, Tài chính, Coach). Mở trang tự chạy **Hôm nay**.
- **B — Hỏi số:** 12 chip NL whitelist; composer tự do → `resolveIntent` (cùng catalog `/crm/ai/query`).
- **C — Hành động:** 6 lệnh preview → **Xác nhận** một lần → gọi service gốc (Ops ack, pipeline assign, phân lead, nhắc nội bộ, SLA reminder).

## Badge

- **Facts** — narrative từ API, không gọi LLM.
- **OSS** — `PTT_CEO_COMMAND_LLM=1` và polish thành công.
- **Stub** — LLM tắt hoặc revert số (number gate).

## Cấm từ ChatBox

Duyệt lương, RBAC, xóa lead/HĐ, ads budget, gửi Zalo/email khách → link màn hình nguồn.

## Cap

| Việc | Cap |
|------|-----|
| Mở ChatBox | `ceo_command.view` hoặc NL query / dashboard / `ai_admin.view` |
| Xác nhận C | `ceo_command.act` + cap gốc action |
| Learn | `ceo_command.configure` hoặc `ai_admin.configure` / `playbooks.configure` |

## Deploy

```bash
bash scripts/apply_pg_ddl_ceo_command.sh
APPLY=1 ./scripts/deploy_ceo_command_vps.sh
```

**Không** bật `PTT_CEO_COMMAND_LLM=1` trên VPS 3.3 GiB mặc định.

## Learn / LoRA

- 👎 trên bubble → candidate `ceo_os` pending.
- Export JSONL: configure → GET `/api/crm/ceo/learn/export`.
- LoRA gate: `PTT_CEO_COMMAND_LORA_ENABLED=1` + đủ pairs — `scripts/ceo_command_lora_train.sh`.

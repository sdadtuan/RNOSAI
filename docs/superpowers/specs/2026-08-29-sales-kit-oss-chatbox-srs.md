# SRS — Sales Kit ChatBox + Open Source AI + Vòng nuôi dưỡng / huấn luyện

> **Document ID:** INT-SK-OSS-20260829  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-29  
> **Trạng thái:** Design — chờ PO duyệt trước implementation plan  
> **Route:** `/crm/intake?lead_id=` (dock ChatBox) · `/crm/intake/sales-kit` (kho + vòng nuôi) · `/crm/intake/sales-kit/learn` (dataset, không public AM)  
> **Parent:** [Intake Deal Bar + Sales Kit v1.1](./2026-08-29-intake-deal-bar-sales-kit-design.md)  
> **Đã ship (không làm lại):** S0–S2 Deal Bar/tabs/rules · S4 kho `sales_kit_files` · S3 flag LLM wording (mặc định tắt) · isolation `category=sales_kit` khỏi CSKH RAG  
> **Prod:** `https://rs.pttads.vn/crm/intake?lead_id=5` · HEAD tham chiếu lúc viết: `654bf413`

---

## 0. Tóm tắt điều hành

Sales Kit hiện là **8 chip + 1 reply**. AM cần **ChatBox chuyên nghiệp** (thread, chip là lối tắt, Áp dụng vẫn confirm). Phần AI phải **open source**, tự chủ trên hạ tầng PTT, và **lớn dần theo deal thật** — không phụ thuộc OpenAI để sống.

Ba lớp, không gộp một lần:

| Lớp | Việc | “Huấn luyện” nghĩa là |
|-----|------|------------------------|
| **L0 ChatBox** | Vỏ hội thoại, rules vẫn chạy khi model off | Không |
| **L1 Runtime OSS** | Ollama / vLLM (OpenAI-compatible) chỉ diễn đạt | Không — đổi engine |
| **L2 Nuôi kho** | Rating + đề xuất Q&A từ chốt/lost → GDKD duyệt | Học **nội dung** (RAG) |
| **L3 Fine-tune** | LoRA trên cặp đã duyệt, sau ngưỡng dữ liệu | Học **trọng số** — cổng chặt |

**Pitch 1 câu:** AM chat với coach nội bộ bằng tiếng Việt, model OSS viết lại câu từ rules + kho đã duyệt; mỗi deal chốt/lost làm kho dày hơn; chỉ khi đủ dữ liệu sạch mới fine-tune.

---

## 1. Mục tiêu & thành công

### 1.1. Mục tiêu nghiệp vụ

| # | Mục tiêu | Đo |
|---|----------|-----|
| G1 | Coach lúc đang gọi, không rời form | 1 thread trên dock; chip 1 tap = 1 lượt |
| G2 | Không phụ thuộc OpenAI để kit sống | Flag OSS on + Ollama/vLLM down → chip rules + keyword kho vẫn trả lời |
| G3 | Không bịa giá / case / KPI | 100% reply có số tiền hoặc tên case phải có citation `ready` kind `pricing` \| `case` \| `qa` |
| G4 | Nuôi kho từ thực chiến | Sau 30 ngày bật L2: ≥20 đề xuất Q&A `pending_review` từ phiên Complete; ≥50% được GDKD duyệt hoặc từ chối (không treo) |
| G5 | Tách khỏi Lead Copilot | Không import `LeadCopilotPanel`; không draft Zalo/email gửi khách |
| G6 | Huấn luyện lâu dài có cổng | Fine-tune chỉ khi đủ **N cặp đạt** (mặc định 200) + PO bật job; không auto-train trên PII thô |

### 1.2. Mục tiêu kỹ thuật

| # | Mục tiêu | Đo |
|---|----------|-----|
| T1 | `AiLlmClient` gọi được base URL OpenAI-compatible | Unit: mock server `/v1/chat/completions` |
| T2 | Kit dùng model/flag riêng, không kéo Copilot prod | `PTT_INTAKE_SALES_KIT_LLM=1` không đòi `PTT_AI_COPILOT_ENABLED=1` |
| T3 | Thread kit không ghi `bant_json` / Complete | Giữ S2: Áp dụng confirm |
| T4 | Chunk kit không vào CSKH `ragQuery` | Giữ filter `category <> sales_kit` trên `listAllChunks` / `list` |

---

## 2. Phạm vi

### 2.1. In scope

- UI ChatBox: lịch sử lượt, composer, chip-as-shortcut, citation, Áp dụng, trạng thái `stub_mode`.  
- Adapter OSS: `PTT_AI_LLM_BASE_URL` + provider `ollama` \| `vllm` \| `openai_compat`.  
- Prompt kit + money gate trên `reply_vi` **và** `next_question.text` (đã có — giữ).  
- Feedback 👍/👎 + lý do ngắn trên mỗi lượt kit.  
- Job đề xuất Q&A từ phiên Complete (Go/Nurture/No-Go) → hàng `sales_kit_learn_candidates`.  
- Admin duyệt candidate → ingest như file Q&A (pending → Duyệt → `ready`).  
- Export dataset JSONL (đã mask PII) cho LoRA — **không** tự train trên prod trừ khi L3 được bật.  
- Cổng L3: checklist dữ liệu, job offline, artifact version, rollback về base OSS.

### 2.2. Out of scope (cố ý)

- Nhúng Lead Copilot, draft outbound send (BR-AI-01).  
- Đổi `GO_THRESHOLDS` `{ go: 24, nurture_min: 18 }` hoặc 6 BANT keys.  
- Kit Complete / Reopen / advance funnel / enqueue SCI M2.  
- Tesseract, puppeteer, package `xlsx`, dual-write S3.  
- Đổi ranking `PlaybooksService.ragQuery` CSKH.  
- Fine-tune trên GPU prod **mặc định**; live suggest từng keystroke.  
- Chat đa người / bot gửi tin cho khách.  
- 9 form dịch vụ còn lại.

### 2.3. Không phá cái đã ship

S0–S4 tiếp tục là nền. L0 không được làm chip 1–6 chết khi model off. L1 down = `stub_mode: true`, giữ output rules.

---

## 3. Ràng buộc cứng (thừa kế parent §12 + isolation)

1. Rules-first: server luôn `runSalesKitRules` rồi mới `polish`.  
2. Giá / case / KPI chỉ khi citation `ready` kind `pricing` \| `case` \| `qa`.  
3. Money guard không được nuốt “Còn 24 điểm” / “5 trang” / “2 đơn”. Bắt `tỷ` / `k` / `vnd`.  
4. Session bag chỉ retrieve khi `lead_id` + `session_id` khớp.  
5. `category=sales_kit` không vào CSKH RAG / `listRanked` / NBA citation.  
6. JWT unresolved (`staffId <= 0`): không B2B-404 Intake; **cũng không** được `playbooks.configure` (cap rỗng).  
7. Rate limit `intake-kit:{actorId}`; unresolved ≠ bucket `internal`.  
8. Mask SĐT/email trong prompt và trong dataset export.  
9. `PTT_AI_LOG_PII=0` và `PTT_AI_LOG_PROMPTS=0` trên prod.

---

## 4. Kiến trúc

```
AM (ChatBox)
    │  POST /sessions/:id/sales-kit  { intent, message, thread_id? }
    ▼
IntakeService.salesKitTurn
    │  1) rules (S2)
    │  2) retrieve kho (S4) nếu needsLibrary
    │  3) polish (S3) ──► AiLlmClient.completeJson
    │                         │
    │                         ├─ openai     → api.openai.com
    │                         └─ oss        → PTT_AI_LLM_BASE_URL/v1/chat/completions
    │  4) money gate
    │  5) persist lượt → sales_kit_turns (+ rating sau)
    ▼
ChatBox render thread + citations + Áp dụng

Phiên Complete ──job──► sales_kit_learn_candidates (pending)
GDKD duyệt ──► parse Q&A ──► sales_kit_files pending ──Duyệt──► chunks ready

Dataset export (mask) ──[cổng L3]──► LoRA job ──► artifact ──► PTT_AI_LLM_MODEL=adapter
```

**Một vector store:** vẫn `ai_playbook_chunks` + retrieve intake-local. Không dựng engine thứ hai.

**Một client LLM:** mở `callOpenAiChat` thành `callChatCompletions({ baseUrl, apiKey, model })`. Copilot CSKH **không** đổi hành vi trừ khi ops set chung `BASE_URL` — mặc định kit có **override** riêng (mục 10).

---

## 5. Pha triển khai

| Pha | Tên | Demo / DoD | Phụ thuộc |
|-----|-----|------------|-----------|
| **SK-AI-0** | ChatBox vỏ | Thread 8+ lượt; chip = shortcut; ô chat luôn hiện; LLM off vẫn chạy | S2+S4 đã ship |
| **SK-AI-1** | Runtime OSS | Ollama `qwen2.5:7b` (hoặc tương đương) wording; timeout → rules | SK-AI-0 |
| **SK-AI-2** | Feedback | 👍/👎 + lý do; admin lọc lượt `down` | SK-AI-0 |
| **SK-AI-3** | Nuôi kho | Complete phiên → candidate Q&A; GDKD duyệt vào folder slug | SK-AI-2 + S4 |
| **SK-AI-4** | Fine-tune cổng | Export JSONL ≥200 cặp đạt; job LoRA **opt-in**; rollback 1 lệnh | SK-AI-3 + GPU/runbook |

Thứ tự cố ý: **vỏ → engine → tín hiệu → kho → trọng số**. Không fine-tune trước khi ChatBox + kho ổn.

---

## 6. ChatBox chuyên nghiệp (SK-AI-0)

### 6.1. Bố cục

Dock phải (desktop ≥1280) / sheet (mobile) thay block chip phẳng.

| Vùng | Nội dung |
|------|----------|
| Header | “Sales Kit” · slug dịch vụ · badge `Rules` / `OSS` / `Stub` |
| SCI | 1 dòng pain ≤160 ký tự (giữ S2) |
| Thread | Lượt `user` / `assistant`; assistant có citation + gap (nếu `gap_to_go`) |
| Quick replies | 8 chip hiện tại — bấm = gửi lượt với `intent` đó; Hỏi kho / Bảng giá **không** retrieve nếu chưa có text (giữ fix empty query) |
| Composer | Placeholder mặc định “Hỏi kit hoặc gõ điều KH vừa nói…”; Enter gửi; Shift+Enter xuống dòng |
| Apply bar | Checkbox như S2; default BANT hints **tắt** |

### 6.2. Hành vi lượt

- Chip 1–6: `message` optional; rules trả 1 ý.  
- Chip 7 `ask_library`: nếu composer trống → reply “Gõ câu hỏi để hỏi kho. Ví dụ: KH nói đắt.” không retrieve.  
- Chip 8 `pricing_band`: query tổng hợp `pricing {serviceSlug}` như S4.  
- Gõ tự do: `intent=freeform`; tín hiệu giá/case → retrieve như S4.  
- Không stream token ở L0 (một JSON). Stream SSE = backlog sau L1 ổn.

### 6.3. Thread persistence

Bảng `sales_kit_turns`:

| Cột | Ý nghĩa |
|-----|---------|
| `id` | uuid |
| `session_id` | phiên intake |
| `actor_staff_id` | nullable; 0 = unresolved — lưu null |
| `intent` | như API hiện tại |
| `user_text` | đã trim, mask SĐT |
| `reply_vi` | bản AM thấy |
| `stub_mode` | bool |
| `model_name` | `rules` \| model OSS \| `*-stub` |
| `citations_json` | mảng citation |
| `apply_json` | snapshot apply |
| `rating` | `up` \| `down` \| null |
| `rating_reason` | ≤200 ký tự |
| `created_at` | timestamptz |

TTL: giữ 180 ngày hoặc xóa cùng túi phiên 90 ngày sau Complete (cùng cron). Không đưa PII thô vào export L3.

### 6.4. Không làm ở L0

- Avatar / markdown rich / file đính kèm trong chat (upload vẫn qua **Kho**).  
- Multi-select chip.  
- Sửa lượt cũ.

---

## 7. Runtime open source (SK-AI-1)

### 7.1. Quyết định

| # | Quyết định | Giá trị |
|---|------------|---------|
| O1 | Giao thức | OpenAI Chat Completions + `response_format=json_object` (Ollama ≥0.5 / vLLM) |
| O2 | Model mặc định đề xuất | `qwen2.5:7b-instruct` (tiếng Việt ổn, VPS 16 GB RAM) |
| O3 | Fallback | Timeout / 5xx / parse JSON fail → rules, `stub_mode=true` |
| O4 | Không nhúng Python trainer vào Nest | Runtime chỉ HTTP |
| O5 | Kit override | `PTT_INTAKE_SALES_KIT_LLM_BASE_URL` / `_MODEL` / `_API_KEY` thắng biến global nếu set |

### 7.2. Env

| Biến | Default | Ý nghĩa |
|------|---------|---------|
| `PTT_INTAKE_SALES_KIT_LLM` | `0` | Bật polish |
| `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM` | `0` | Badge OSS + hint composer |
| `PTT_AI_LLM_PROVIDER` | `openai` | Audit: `ollama` \| `vllm` \| `openai` \| `openai_compat` |
| `PTT_AI_LLM_BASE_URL` | *(rỗng = api.openai.com)* | VD. `http://127.0.0.1:11434/v1` |
| `PTT_AI_LLM_MODEL` | `gpt-4o-mini` | Kit OSS: `qwen2.5:7b-instruct` |
| `PTT_AI_LLM_API_KEY` / `AI_LLM_API_KEY` | rỗng | Ollama thường `ollama`; vLLM token nội bộ |
| `PTT_AI_LLM_TIMEOUT_MS` | `8000` | Kit OSS cho phép `15000` qua override |
| `PTT_INTAKE_SALES_KIT_LLM_BASE_URL` | rỗng | Override chỉ kit |
| `PTT_INTAKE_SALES_KIT_LLM_MODEL` | rỗng | Override chỉ kit |
| `PTT_INTAKE_SALES_KIT_LLM_TIMEOUT_MS` | rỗng | Override chỉ kit |

Deploy script kit **không** tự set LLM=1 (giữ S3). Runbook L1: cài Ollama trên VPS, `ollama pull`, set env, restart API, **không** rebuild ops-web trừ khi bật `NEXT_PUBLIC_*`.

### 7.3. Hợp đồng `completeJson`

Giữ schema S3:

```ts
{
  reply_vi: string;
  next_question_text?: string;
  apply?: { ai_summary?: string; bant_hints?: Record<string, number> };
}
```

System prompt: giữ `buildKitLlmSystemPrompt()` + thêm 1 dòng: “Bạn chạy on-prem; không được bịa giá ngoài excerpt.”

### 7.4. VPS tối thiểu L1

| | RAM | Disk model | Ghi chú |
|--|-----|------------|---------|
| Ollama 7B Q4 | 16 GB | ~5 GB | Cùng máy API được; pin CPU nếu không GPU |
| vLLM 7B | GPU 16 GB+ | — | Chỉ khi L3 hoặc concurrency cao |

Không cài Chromium. Không train trên process Nest.

---

## 8. An toàn model (mọi pha có polish)

Giữ và siết:

1. `assertNoInventedMoney` / `stripInventedMoney` trên reply + next question.  
2. `ask_library` không citation → **không** gọi LLM.  
3. Prompt chỉ nhận excerpt citation, không dump cả kho.  
4. Output JSON fail → rules.  
5. Không đưa `bant_json` đầy đủ SĐT khách vào user prompt (mask).  
6. Audit `ai_agent_runs` `use_case=intake_sales_kit` với `model_name` + `provider`.

UAT tiền: “Còn 24 điểm để Go” sống sót; “2 tỷ” / “20k” bị chặn khi không citation.

---

## 9. Nuôi dưỡng kho (SK-AI-2 + SK-AI-3)

Đây là kênh “huấn luyện” **chính** trong 6–12 tháng đầu.

### 9.1. Tín hiệu AM (SK-AI-2)

`POST /api/crm/intake/sales-kit/turns/:id/rating` `{ rating: 'up'|'down', reason?: string }`  
Cap: `crm_leads.edit` + visibility phiên.

Admin `/crm/intake/sales-kit/learn`: lọc `down`, slug, ngày. Không sửa reply tại chỗ — chỉ **tạo candidate** từ lượt down (nút “Đề xuất Q&A”).

### 9.2. Win-loop lite (SK-AI-3) — thay M4 đầy đủ

Khi `completeIntakeSession` thành công (mọi decision):

Job `sales_kit_learn_from_session` (async, không chặn Complete):

1. Đọc discovery critical + `win_intel` + `decision` + `decision_reason` + lượt kit `rating=up` trong phiên.  
2. Sinh **tối đa 3** candidate:

```ts
{
  kind: 'qa' | 'battle_card' | 'pricing';
  folder_key: string;          // slug/qa hoặc _common/qa
  question: string;            // ≤200
  answer: string;              // ≤800, cấm số nếu kind≠pricing hoặc không có band sẵn
  source_session_id: number;
  source_lead_id: number;
  status: 'pending_review';
}
```

3. `pricing` candidate **không** copy số từ form AM trừ khi đã có citation pricing trên lượt nguồn. Không có band → kind=`qa` (“KH hỏi giá — neo gói, hỏi ngân sách”).  
4. Trùng `question` (normalize) trong cùng `folder_key` 90 ngày → skip.

GDKD trên Learn:

- **Duyệt** → tạo file ảo 1 hàng hoặc append sheet nội bộ → `sales_kit_files` `pending` → AM/GDKD bấm Duyệt kho như S4.  
- **Sửa rồi duyệt**.  
- **Từ chối** + lý do.

Không auto-`ready`. Không ghi BANT.

### 9.3. Chỉ số nuôi

Dashboard Learn (cùng page, cap configure):

- Candidate pending / approved / rejected (7 ngày, 30 ngày).  
- % lượt kit `up` vs `down`.  
- Chunk `ready` theo folder.

---

## 10. Huấn luyện lâu dài (SK-AI-4)

Fine-tune là **tùy chọn**, sau khi L2 chạy ≥1 quý hoặc đủ N cặp.

### 10.1. Dataset

Export `GET /api/crm/intake/sales-kit/learn/export.jsonl` (configure):

Mỗi dòng:

```json
{"messages":[
  {"role":"system","content":"<kit system prompt>"},
  {"role":"user","content":"<intent + rules_reply + excerpts, PII masked>"},
  {"role":"assistant","content":"<reply_vi đã duyệt hoặc lượt rating=up>"}
]}
```

Loại trừ: `stub_mode`, `down`, reply sau strip tiền, session túi có PII chưa mask.

**Cổng mở train:** `approved_pairs >= 200` (config `PTT_SALES_KIT_LORA_MIN_PAIRS`) và `PTT_SALES_KIT_LORA_ENABLED=1`.

### 10.2. Job LoRA (ngoài Nest)

- Script `scripts/sales_kit_lora_train.sh` chạy trên máy GPU (không mặc định VPS API).  
- Base: cùng family với runtime (Qwen2.5).  
- Output: adapter gguf/safetensors + `MODEL_CARD.md` (ngày, N cặp, SHA dataset).  
- Promote: đổi `PTT_INTAKE_SALES_KIT_LLM_MODEL`, smoke UAT-13–15 + money guard, giữ model cũ 14 ngày.

### 10.3. Cấm

- Train trên transcript softphone thô.  
- Train lẫn CSKH playbook.  
- Auto-promote adapter khi loss giảm — phải PO + GDKD ký UAT.

---

## 11. Dữ liệu mới

### 11.1. `sales_kit_turns`

Mục 6.3. Index `(session_id, created_at desc)`, `(rating, created_at)`.

### 11.2. `sales_kit_learn_candidates`

| Cột | Ý nghĩa |
|-----|---------|
| `id` | uuid |
| `folder_key` | đích duyệt |
| `kind` | qa / battle_card / pricing |
| `question` / `answer` | text |
| `source_session_id` / `source_lead_id` | truy vết |
| `source_turn_id` | nullable |
| `status` | `pending_review` \| `approved` \| `rejected` \| `ingested` |
| `reviewer_staff_id` / `reviewed_at` / `reject_reason` | |
| `created_at` | |

Không FK cứng sang `ai_playbooks` (tránh orphan khi xóa playbook — giống `sales_kit_files`).

### 11.3. DDL

File mới: `docs/specs/2026-08-29-sales-kit-learn-ddl.sql` + `scripts/apply_pg_ddl_sales_kit_learn.sh`.  
Deploy L0 có thể **chưa** cần bảng nếu thread chỉ memory phiên (không khuyến nghị). **Bắt buộc** từ SK-AI-0 persist thread để L2 có nguồn.

---

## 12. API

Giữ `POST /api/crm/intake/sessions/:id/sales-kit`. Thêm:

| Method | Path | Cap | Mô tả |
|--------|------|-----|--------|
| GET | `/api/crm/intake/sessions/:id/sales-kit/turns` | view + visibility | Thread |
| POST | `/api/crm/intake/sales-kit/turns/:id/rating` | edit + visibility | 👍/👎 |
| GET | `/api/crm/intake/sales-kit/learn/candidates` | configure | List |
| POST | `/api/crm/intake/sales-kit/learn/candidates/:id/approve` | configure | → ingest pending file |
| POST | `/api/crm/intake/sales-kit/learn/candidates/:id/reject` | configure | |
| GET | `/api/crm/intake/sales-kit/learn/export.jsonl` | configure | L3 |

Response turn giữ schema S2 + `turn_id` + `thread` optional.

---

## 13. RBAC & flag

| Việc | Cap |
|------|-----|
| Chat + rating | `crm_leads.edit` + lead visible |
| Browse kho org | `playbooks.configure` **hoặc** `crm_leads.configure` (giữ S4) |
| Duyệt candidate / export | cùng configure |
| Túi phiên | `crm_leads.edit` + visible |

Flag UI kit: `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT=1` (đã default on).  
ChatBox L0 **không** chờ `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM`. LLM chỉ đổi badge + chất lượng câu.

---

## 14. UAT

### 14.1. SK-AI-0

| ID | Bước | Pass |
|----|------|------|
| CB-1 | Có phiên nháp, mở kit | Thread trống + 8 chip + composer |
| CB-2 | Chip Gap-to-Go BANT 0 | 1 bubble rules; không gọi OSS |
| CB-3 | Chip Hỏi kho, không gõ | “Gõ câu hỏi…”; không citation giá |
| CB-4 | Gõ “KH nói đắt” + Hỏi kho (đã duyệt mẫu SEO) | Answer + Nguồn file |
| CB-5 | Áp dụng discovery | PATCH sau confirm; BANT radio không đổi nếu hints unticked |
| CB-6 | Refresh trang | Thread còn (persist) |

### 14.2. SK-AI-1

| ID | Bước | Pass |
|----|------|------|
| OSS-1 | Flag on, Ollama up, chip Câu tiếp theo | `stub_mode=false`, wording khác rules nhưng **cùng key** câu |
| OSS-2 | `ollama stop` giữa lượt | Rules, `stub_mode=true`, không 500 |
| OSS-3 | Model bịa “20 triệu” không citation | Strip / fallback rules |
| OSS-4 | “Còn 24 điểm” | Không thành “iểm” |

### 14.3. SK-AI-2/3

| ID | Bước | Pass |
|----|------|------|
| LN-1 | 👎 + lý do | `rating=down` |
| LN-2 | Complete Go | ≥0 candidate (có thể 0 nếu thiếu text — không fail Complete) |
| LN-3 | Duyệt candidate qa | File pending trên folder; Duyệt kho → Hỏi kho ra hàng mới |
| LN-4 | Candidate pricing không có citation nguồn | Không chứa số VND |

### 14.4. SK-AI-4

| ID | Bước | Pass |
|----|------|------|
| FT-1 | &lt;200 cặp | Export được; job train **từ chối** |
| FT-2 | ≥200 + flag | Train offline; smoke CB-2–4 + OSS-3/4 |
| FT-3 | Rollback model | Kit về base 7B, không migrate DB |

---

## 15. Rủi ro

| Rủi ro | Xử lý |
|--------|-------|
| Ollama làm chậm call | Timeout 8–15s; rules first; không block Complete |
| 7B yếu tiếng Việt | Prompt ngắn + excerpt; không giao model tự bịa kho |
| Fine-tune phá money gate | Gate **sau** model, không tin assistant |
| Candidate leak PII | Mask khi sinh + khi export; túi phiên không vào export |
| JWT unresolved | Visibility skip B2B; configure vẫn chặn |
| Nhầm Copilot | Flag kit tách; UI copy “nội bộ — không gửi khách” |

---

## 16. Quyết định đã chốt trong SRS này

| # | Quyết định | Giá trị |
|---|------------|---------|
| E1 | UI | ChatBox thread; chip = shortcut |
| E2 | Engine | OpenAI-compatible OSS (Ollama trước) |
| E3 | Nuôi chính | Kho + candidate từ Complete + rating |
| E4 | Fine-tune | Cổng 200 cặp, opt-in, ngoài Nest |
| E5 | Không Copilot | Giữ D2 parent |
| E6 | Không OpenAI bắt buộc | Kit sống khi OSS/local down nhờ rules+S4 |
| E7 | Isolation CSKH | Giữ filter `sales_kit` |

---

## 17. Việc cố ý để backlog sau SRS

- SSE streaming token.  
- Multi-turn memory tóm tắt (chỉ gửi 4 lượt cuối + rules snapshot).  
- Vision OCR L1 (vẫn `needs_ocr` khi LLM/vision off).  
- Session bag TTL cron (parent đã ghi 90 ngày).  
- 9 form còn lại.

---

## 18. Tài liệu liên quan sau khi duyệt

- Plan implementation: `docs/superpowers/plans/YYYY-MM-DD-sales-kit-oss-chatbox.md` (một plan, 5 slice SK-AI-0…4).  
- Runbook Ollama: bổ sung `docs/runbooks/ai-service-operations.md`.  
- Guide AM: cập nhật [27-lifecycle](../../huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md) mục Sales Kit → ChatBox.

---

## 19. Phụ lục — trạng thái hệ thống lúc viết SRS

| Thành phần | Trạng thái |
|------------|------------|
| Deal Bar + 4 tab + rules chip | Prod |
| Kho upload / Duyệt / Hỏi kho keyword | Prod |
| `PTT_INTAKE_SALES_KIT_LLM` | Default 0 |
| `AiLlmClient` | Cứng `api.openai.com` |
| ChatBox thread | Chưa — 8 chip phẳng |
| Win-loop M4 | Backlog parent §16 — SRS này thu thành SK-AI-3 |
| Fine-tune | Chưa có |

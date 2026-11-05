# SRS — CEO Command ChatBox (A Briefing + B Hỏi số + C Điều hành) + Open Source AI

> **Document ID:** CEO-CMD-20260830  
> **Phiên bản:** 1.0 · **Ngày:** 2026-08-30  
> **Trạng thái:** Design — chờ PO duyệt trước implementation plan  
> **Route:** `/crm/ceo` (ChatBox điều hành) · `/crm/ceo/learn` (kho + vòng nuôi, không public AM)  
> **Sibling:** [Sales Kit OSS ChatBox](./2026-08-29-sales-kit-oss-chatbox-srs.md) — **tái dùng vỏ + runtime, không dùng chung kho**  
> **BA nền:** AI-UC-016 (NL curated) · AI-UC-015 (pipeline risk) · AI-UC-018 (coach digest) · BR-AI-01 (không auto-send khách) · BR-AI-016 (không free SQL)  
> **Prod:** `https://rs.pttads.vn` · HEAD tham chiếu lúc viết: `bae7fab9`

---

## 0. Tóm tắt điều hành

CEO cần **một ChatBox** để quản lý RNOSAI: thấy cái đỏ hôm nay (**A**), hỏi số tiếng Việt (**B**), giao việc / duyệt / nhắc GDKD (**C**). Nền kỹ thuật giống Sales Kit: thread chuyên nghiệp, chip lối tắt, model OSS on-prem, kho đã duyệt, vòng nuôi lâu dài.

Khác Sales Kit ở **vai trò**:

| | Sales Kit | CEO Command |
|--|-----------|-------------|
| Người dùng | AM đang gọi | CEO / GDKD điều hành |
| Nguồn sự thật | Rules BANT + kho `sales_kit` | API đọc đã ship + catalog intent + kho `ceo_os` |
| Ghi hệ thống | Chỉ Áp dụng BANT sau confirm trên **một** phiên | Catalog hành động hẹp, **hai bước confirm**, cap gốc từng API |
| Phạm vi | 1 lead / 1 phiên | Toàn công ty — **tổng hợp**, không dump 14 module vào một prompt |

**Pitch 1 câu:** CEO chat với bảng điều hành nội bộ; số chỉ đến từ query đã whitelist; hành động chỉ chạy khi CEO bấm Xác nhận; OSS chỉ diễn đạt, không bịa KPI.

Ba việc A+B+C **không** gộp một agent tự do. Một SRS, sáu slice.

---

## 1. Mục tiêu & thành công

### 1.1. Mục tiêu nghiệp vụ

| # | Việc | Mục tiêu | Đo |
|---|------|----------|-----|
| G1 | A | CEO mở `/crm/ceo` thấy briefing ≤8 thẻ đỏ/vàng trong 1 lượt | Chip **Hôm nay** ≤3s khi cache nóng; không 500 nếu 1 nguồn down |
| G2 | B | Hỏi số tiếng Việt = catalog NL Analytics hiện có (~40 intent) | 100% số tiền / % / count trên reply có `intent_id` + `rows` từ `AiNlQueryService` |
| G3 | C | Giao việc / duyệt / nhắc mà không tự gửi khách | 100% mutate đi qua `proposed_action` → Xác nhận; 0 outbound Zalo/email |
| G4 | OSS | Không phụ thuộc OpenAI để bot sống | Flag off hoặc Ollama down → briefing + số + chip vẫn chạy (`stub_mode`) |
| G5 | Isolation | Không trộn Sales Kit / CSKH RAG / Lead Copilot | `category=ceo_os` không vào `listAllChunks` CSKH; không import `LeadCopilotPanel` |
| G6 | Nuôi | Học nội dung điều hành từ lượt thật | Sau 30 ngày L5: ≥15 candidate `pending_review`; ≥50% được duyệt hoặc từ chối |

### 1.2. Mục tiêu kỹ thuật

| # | Mục tiêu | Đo |
|---|----------|-----|
| T1 | Tái dùng `AiLlmClient` OpenAI-compatible (cùng adapter SK-AI-1) | Unit mock `/v1/chat/completions` |
| T2 | Flag CEO tách Sales Kit và Copilot | `PTT_CEO_COMMAND_LLM=1` không đòi `PTT_INTAKE_SALES_KIT_LLM` hay `PTT_AI_COPILOT_ENABLED` |
| T3 | B không invent intent | `resolveIntent` fail → `query_out_of_scope` + 3 gợi ý gần, không SQL |
| T4 | C không bypass guard | Commit gọi **cùng service** + **cùng cap** với API gốc |
| T5 | JWT unresolved (`staffId≤0`) | **403** — CEO bot không skip B2B như Intake |

---

## 2. Phạm vi

### 2.1. In scope

- ChatBox thread + composer + chip A/B/C trên `/crm/ceo`.  
- Briefing A: ghép nguồn đọc đã có (mục 7).  
- Hỏi số B: bọc `AiNlQueryService` / `NL_QUERY_CATALOG` (không viết engine SQL mới).  
- Hành động C: catalog 6 lệnh v1 + **2 lệnh Tower** (`remind_contract_approval`, `prioritize_solution_queue`) + confirm + idempotency (mục 9 · [Tower §20](./2026-09-01-ceo-lifecycle-tower-design.md)).  
- Kho `ceo_os` (playbook category riêng) + retrieve intake-local clone (keyword + cosine).  
- Rating 👍/👎 + candidate từ lượt `down` / briefing hay dùng.  
- OSS polish narrative (flag off mặc định).  
- Nav ops-web: “Điều hành CEO”.  
- Audit `ai_agent_runs` `use_case=ceo_command`.

### 2.2. Out of scope (cố ý — backlog riêng)

- Agent tự chọn tool / free SQL / dump schema.  
- Lead Copilot, draft gửi khách, auto-send (BR-AI-01).  
- Ghi payroll, bảo hiểm, chấm công, cấp quyền RBAC, xóa lead/HĐ.  
- Đổi ngân sách Ads, publish portal, spawn-week, ghi KPI Ops.  
- Fine-tune LoRA trên GPU prod mặc định (cổng L5 giống SK-AI-4).  
- Chat đa người, bot chủ động ping CEO mỗi phút (digest tối đa 1 lần / ngày nếu cron — backlog).  
- Thay `/crm/ai/query`, `/crm/ai/coach`, `/crm/business-dashboard` — chúng vẫn là màn nguồn.  
- 9 form Intake còn lại, SCI M2.

### 2.3. Không phá cái đã ship

- `NL_QUERY_CATALOG` + `resolveIntent` giữ whitelist.  
- Filter `category <> sales_kit` trên CSKH `list` / `listAllChunks`.  
- Sales Kit flag / money gate / GO_THRESHOLDS không đổi.  
- Deploy script **không** tự bật `PTT_CEO_COMMAND_LLM`.

---

## 3. Cách tiếp cận (đã chọn)

| | Cách | Ưu | Nhược |
|--|------|-----|--------|
| **A — Khuyến nghị** | ChatBox bọc API đọc + catalog C | An toàn, ship nhanh, nuôi được | Không trả lời câu ngoài catalog |
| B | Agent tool-calling tự do trên Nest | “Thông minh” hơn | Phá BR-AI-016; leak PII; khó UAT |
| C | Fine-tune CEO model trước | Cá nhân hóa | Không có dataset; phá số |

**Chốt: A.** Câu ngoài catalog = “Ngoài phạm vi — chọn chip hoặc gõ gần alias.” Không bịa.

---

## 4. Ràng buộc cứng

1. **Rules / compose first:** server luôn lấy fact từ API rồi mới `polish`.  
2. **Số chỉ từ fact:** mọi `₫`, `%`, count trên `reply_vi` phải khớp `facts_json` của lượt. Money/KPI guard (cùng họ Sales Kit, nới regex `%` / `lead` / `deal`).  
3. **Không free SQL** (BR-AI-016).  
4. **Không auto-send khách** (BR-AI-01). C action `remind_*` chỉ `staff_notifications` hoặc note nội bộ.  
5. **Confirm 2 bước** cho mọi mutate. LLM không được set `auto_commit`.  
6. **Cap gốc:** thiếu cap của API đích → ẩn nút Xác nhận, không 500.  
7. **Isolation:** `ceo_os` ≠ `sales_kit` ≠ CSKH default. Retrieve CEO không đọc chunk kit.  
8. **Actor thật:** `staffId > 0`. Internal key chỉ cron briefing cache, không commit C từ cron.  
9. **Rate limit:** `ceo-cmd:{staffId}` — 30 lượt / 5 phút; commit C 10 / 5 phút.  
10. **PII:** mask SĐT/email trong prompt và export; `PTT_AI_LOG_PII=0`, `PTT_AI_LOG_PROMPTS=0` trên prod.  
11. **Không Lead Copilot.** Không mount panel gửi Zalo/email.

---

## 5. Kiến trúc

```
CEO (ChatBox /crm/ceo)
    │  POST /api/crm/ceo/turns  { intent, message, thread_id? }
    ▼
CeoCommandService.turn
    │  1) route intent
    │       briefing_today      → BriefingComposer (A)
    │       nl_query / freeform → AiNlQueryService (B)
    │       propose_action      → ActionCatalog.preview (C)  — chưa ghi
    │  2) retrieve ceo_os nếu needsLibrary (policy / SOP điều hành)
    │  3) polish (optional) ──► AiLlmClient.completeJson
    │                         └─ oss → PTT_AI_LLM_BASE_URL (cùng adapter SK-AI-1)
    │  4) number/money gate vs facts_json
    │  5) persist ceo_command_turns
    ▼
ChatBox: thread + bảng/chart + citation + [Xác nhận] nếu proposed_action

CEO bấm Xác nhận
    │  POST /api/crm/ceo/actions/commit { turn_id, idempotency_key }
    ▼
CeoActionCommit
    │  re-check cap + target còn hợp lệ
    │  gọi service gốc (ops.ack / pipelineRisk.assign / leads.assign / notify)
    │  persist ceo_command_actions
```

**Một LLM client.** **Hai kho.** **Không** engine SQL thứ hai.

---

## 6. Pha triển khai

| Pha | Tên | Việc | Demo / DoD | Phụ thuộc |
|-----|-----|------|------------|-----------|
| **CEO-0** | Vỏ ChatBox | Route, thread, chip, persist | Thread 8+ lượt; LLM off vẫn chat | Sibling SK-AI-0 pattern |
| **CEO-1** | A Briefing | Composer 6 nguồn đọc | Chip Hôm nay → ≤8 thẻ + link drill | CEO-0 |
| **CEO-2** | B Hỏi số | Bọc NL catalog | “Doanh thu 30 ngày” = đúng `revenue_received_30d` | CEO-0 |
| **CEO-3** | C Điều hành | 6 action + confirm | Assign risk / ack alert / nhắc AM — sau Xác nhận mới ghi | CEO-1 + CEO-2 |
| **CEO-4** | Runtime OSS | Flag + polish | Ollama down → stub, số không đổi | SK-AI-1 adapter hoặc làm chung PR |
| **CEO-5** | Nuôi + LoRA cổng | Rating, candidate, export | Giống SK-AI-2…4, category `ceo_os` | CEO-0 |

Thứ tự: **vỏ → A → B → C → OSS → nuôi**. C không ship trước A+B (CEO phải thấy fact trước khi ghi).

Nếu SK-AI-1 chưa merge: CEO-4 tự mở `callChatCompletions({ baseUrl })` — **một** thay đổi client, hai flag.

---

## 7. A — Briefing hàng ngày (CEO-1)

### 7.1. Chip & intent

| Chip | `intent` | Việc |
|------|----------|------|
| Hôm nay | `briefing_today` | Tổng hợp thẻ đỏ/vàng |
| Pipeline rủi ro | `briefing_pipeline` | Top at-risk |
| SLA / CSKH | `briefing_sla` | Breach + warning |
| Delivery / Ops | `briefing_ops` | Executive DV + alert mở |
| Tài chính | `briefing_finance` | Overdue + DT 7n/30n (nếu có cap finance) |
| Coach tuần | `briefing_coach` | Digest GDKD mới nhất nếu có |

Mở trang lần đầu: **tự chạy** `briefing_today` một lần (không chờ gõ).

### 7.2. Nguồn fact (chỉ đọc, song song, timeout từng nguồn 2.5s)

| # | Nguồn | Service đã có | Thẻ nếu… | Drill |
|---|--------|---------------|----------|-------|
| 1 | Ops executive | `OpsDashboardService.getExecutiveDashboard` | `alerts_open>0` hoặc `kpi_dat_pct<80` | `/crm/ops/dashboard?tab=executive` |
| 2 | Ops alerts mở | `OpsService.listAlerts({ status:'open', limit:8 })` | có hàng | `/crm/ops/alerts` |
| 3 | Pipeline at-risk | `PipelineRiskService` list top 8 | count>0 | `/crm/ai/insights` + lead |
| 4 | SLA | intent nội bộ `sla_breach_summary` + `ops_sla_warning` qua `AiNlQueryService` | breach/warning>0 | `/crm/cskh-board` |
| 5 | Công nợ / DT | `ops_payments_overdue`, `revenue_received_7d`, `revenue_received_30d` | overdue>0 hoặc CEO hỏi | `/crm/financials`, `/crm/business-dashboard` |
| 6 | Coach digest | GET coach digest hiện có | có bản trong 8 ngày | `/crm/ai/coach` |

Nguồn fail / timeout / thiếu cap / `ops_dv_disabled`: **bỏ thẻ đó**, ghi `degraded: [{source, reason}]` trên lượt — không fail cả briefing.

Không có cap `StaffFinanceView` / `ai_analytics.query`: ẩn thẻ tài chính / NL; vẫn hiện ops nếu có `StaffOpsView`.

### 7.3. Output briefing

```ts
{
  intent: 'briefing_today';
  reply_vi: string;          // ≤1200 ký tự; 4–8 bullet
  cards: Array<{
    severity: 'red' | 'amber' | 'ok';
    title: string;
    metric?: string;         // đã format từ fact
    href: string;
    source: string;          // khóa nguồn 1–6
    suggest_action?: 'ack_ops_alert' | 'assign_pipeline_risk' | 'remind_staff' | 'assign_lead';
  }>;
  facts_json: Record<string, unknown>;
  degraded: Array<{ source: string; reason: string }>;
}
```

`suggest_action` chỉ là **đề xuất chip C** trên thẻ — không commit.

### 7.4. Không làm ở A

- Tự ack alert.  
- Tự assign deal.  
- Gộp HR chấm công / bảng lương vào briefing v1 (module HR = spec sau).  
- Meta spend mutate.

---

## 8. B — Hỏi số (CEO-2)

### 8.1. Hợp đồng

Mọi lượt số đi qua `AiNlQueryService.runQuery({ intent_id | question, actorId })`.

- Chip nhóm **Số liệu** = subset catalog (12 chip hay dùng):  
  `revenue_received_30d`, `leads_new_30d`, `cpl_meta_t30_overview`, `open_deals_count`,  
  `pipeline_at_risk_count`, `ops_payments_overdue`, `sla_breach_summary`,  
  `forecast_month_summary`, `churn_health_top10`, `leads_unassigned`,  
  `roas_overview_30d`, `marketing_spend_current_month`.  
- Composer tự do: `intent=nl_query`, `message` = question → `resolveIntent`.  
- Ngoài phạm vi: `error=query_out_of_scope`, reply “Câu hỏi ngoài phạm vi — chọn từ danh sách.” + 3 intent `aliases` gần (token overlap), `rows=[]`.  
- `read_only: true` luôn. B **không** sinh `proposed_action`.

### 8.2. Render

- `result_kind=table`: bảng tối đa 12 hàng + “Xem đầy đủ” → `/crm/ai/query?intent=`.  
- `result_kind=chart`: sparkline đơn giản (labels + 1 series); không lib chart mới nếu chưa có trên page.  
- `drill_href` từ payload nếu có.  
- Narrative: `payload.narrative` khi stub; OSS chỉ viết lại câu, **không** đổi số trong `rows`.

### 8.3. Guard số (B + A + polish)

Sau polish: mọi token khớp `/\d[\d.,]*\s*(₫|đ|vnd|%|tỷ|triệu|lead|deal)/i` trong `reply_vi` phải xuất hiện trong `JSON.stringify(facts_json)` hoặc `rows`. Sai → revert narrative gốc, `stub_mode=true`.

Không được nuốt “Còn 24 điểm” kiểu Sales Kit — CEO ít dùng câu đó; vẫn cấm strip số nguyên cô lập không có đơn vị tiền.

### 8.4. Cap B

Giống `StaffAiNlQueryGuard`: `ai_analytics.query` **hoặc** `crm_business_dashboard.view` **hoặc** `ai_admin.view` **hoặc** `ceo_command.view`.

Thiếu cap B: chip số ẩn; briefing A vẫn chạy phần không cần NL.

---

## 9. C — Điều hành có confirm (CEO-3)

### 9.1. Nguyên tắc

LLM / briefing **chỉ preview**. Ghi DB chỉ tại `POST /actions/commit`.

Hai bước:

1. `intent=propose_action` `{ action_id, params }` → `proposed_action` + `preview_vi` + `required_caps`.  
2. CEO **Xác nhận** → commit. **Hủy** → không ghi.

Idempotency: client gửi `idempotency_key` (uuid). Trùng key trong 24h trả kết quả cũ, không chạy lại.

Cron / internal key: **cấm** commit C.

### 9.2. Catalog v1 (đóng — không tự thêm từ model)

| `action_id` | Việc CEO | Service gốc | Cap bắt buộc | Không được |
|-------------|----------|-------------|--------------|------------|
| `ack_ops_alert` | Đã xem cảnh báo Ops | `OpsService.acknowledgeAlert` | ops write (`StaffOpsWriteGuard`) | Xóa alert hàng loạt |
| `assign_pipeline_risk` | Giao follow-up deal at-risk | `PipelineRiskService.assignFollowUpOwner` | cap AI pipeline assign hiện có (cùng endpoint PATCH) | Đổi owner lead nếu API gốc không làm |
| `log_pipeline_activity` | Ghi hoạt động + hạ cờ risk | `PipelineRiskService.logFollowUpActivity` | cùng endpoint | Fake “đã gọi khách” outbound |
| `assign_lead` | Phân lead chưa owner | `CrmLeadsLegacyService.assignLead` | `crm_leads.assign` | Assign ngoài visibility B2B |
| `remind_staff` | Nhắc GDKD / AM nội bộ | `staff_notifications` insert | `ceo_command.act` **hoặc** `crm_leads.assign` | Email/Zalo khách; SMS |
| `sla_remind_lead` | Nhắc SLA trên lead | `SlaAutoTaskService.createReminder` | `crm_leads.edit` + lead visible | Auto-send khách (service đã ghi note nội bộ) |
| `remind_contract_approval` | Nhắc GDKD duyệt HĐ | `staff_notifications` + href Hub | `ceo_command.act` | Đổi status HĐ; mail khách — chi tiết [CEO Tower §20](./2026-09-01-ceo-lifecycle-tower-design.md) |
| `prioritize_solution_queue` | Ưu tiên queue SP | Notify MKT-01 + note lead | `ceo_command.act` | Claim hộ; đổi owner — Tower §20 |

Params bắt buộc (validate server, không tin LLM):

```ts
ack_ops_alert:        { alert_id: number }
assign_pipeline_risk: { recommendation_id: string; staff_id: number; staff_name: string }
log_pipeline_activity:{ recommendation_id: string; note: string } // note ≤500, mask
assign_lead:          { lead_id: number; owner_staff_id: number }
remind_staff:         { staff_user_id: number; title: string; body: string; link_href?: string }
sla_remind_lead:      { lead_id: number; tier: CskhSlaTier; suggested_action: SlaPredictSuggestedAction }
```

`staff_name` / title / body: server lấy tên staff từ roster nếu client chỉ gửi `staff_id`; không tin tên do model bịa.

### 9.3. UI confirm

Nút **Xác nhận** trên bubble assistant. Modal 1 câu: “Giao deal #… cho … ?” / “Ack alert #… ?”

Không multi-commit. Không “xác nhận tất cả thẻ đỏ”.

### 9.4. Cấm v1 (kể cả CEO xin trong chat)

- Approve payroll / sửa lương / bảo hiểm.  
- Grant RBAC / tạo user.  
- Delete lead, HĐ, invoice.  
- Đổi ngân sách campaign / pause ads.  
- Publish content portal / gửi email journey.  
- Spawn week / ghi KPI Ops / compute-labels.  
- Complete Intake / advance funnel / SCI M2.

Câu xin việc cấm → reply “Việc này không làm từ ChatBox — mở [href màn hình nguồn].” `proposed_action=null`.

### 9.5. Audit C

Mỗi commit: hàng `ceo_command_actions` + `ai_agent_runs` `use_case=ceo_command_act` + `staff_id` + `action_id` + `target_id` + `idempotency_key`.

---

## 10. ChatBox (CEO-0)

### 10.1. Bố cục `/crm/ceo`

Desktop ≥1280: cột trái thread (60%), phải chip + catalog số (40%). Mobile: thread full, chip sheet.

| Vùng | Nội dung |
|------|----------|
| Header | “Điều hành RNOSAI” · badge `Facts` / `OSS` / `Stub` · tên staff |
| Thread | `user` / `assistant`; bảng số; thẻ briefing; nút Xác nhận |
| Quick A | 6 chip mục 7.1 |
| Quick B | 12 chip mục 8.1 |
| Quick C | Chỉ hiện khi bubble có `proposed_action` hoặc CEO chọn từ menu “Hành động” (6 lệnh, form params ngắn) |
| Composer | “Hỏi số, gõ việc cần làm, hoặc bấm Hôm nay…” |

Không avatar. Không markdown file đính kèm trong chat (kho Learn riêng). Không stream SSE ở CEO-0.

### 10.2. Thread

Bảng `ceo_command_turns` (mục 13). Một thread / staff / ngày (`thread_id = ceo:{staffId}:{YYYY-MM-DD}`). Đổi ngày = thread mới; GET 7 ngày gần để “Hôm qua”.

TTL 180 ngày. Export L5 chỉ lượt `rating=up` đã mask.

### 10.3. Menu nav

`OpsNav` + `module-nav`: **Điều hành CEO** → `/crm/ceo`.  
Cap xem: `ceo_command.view` **hoặc** cùng bộ NL query (`ai_analytics.query` / `crm_business_dashboard.view` / `ai_admin.view`).

Không hiện với AM chỉ có `crm_leads.edit`.

---

## 11. Runtime OSS (CEO-4)

Cùng quyết định sibling §7:

| # | Quyết định | Giá trị |
|---|------------|---------|
| O1 | Giao thức | OpenAI Chat Completions + `json_object` |
| O2 | Model đề xuất | `qwen2.5:7b-instruct` |
| O3 | Fallback | Timeout / 5xx / JSON fail → narrative fact, `stub_mode=true` |
| O4 | Không train trong Nest | |
| O5 | Override CEO | `PTT_CEO_COMMAND_LLM_BASE_URL` / `_MODEL` / `_TIMEOUT_MS` thắng global |

### 11.1. Env

| Biến | Default | Ý nghĩa |
|------|---------|---------|
| `PTT_CEO_COMMAND` | `1` | Bật route API+UI (sau ship; dev default 1) |
| `NEXT_PUBLIC_PTT_CEO_COMMAND` | `1` | Hiện nav |
| `PTT_CEO_COMMAND_LLM` | `0` | Bật polish |
| `NEXT_PUBLIC_PTT_CEO_COMMAND_LLM` | `0` | Badge OSS |
| `PTT_AI_LLM_BASE_URL` | rỗng = api.openai.com | Dùng chung khi SK-AI-1 đã mở |
| `PTT_CEO_COMMAND_LLM_TIMEOUT_MS` | `12000` | Briefing dài hơn kit |

Deploy **không** set LLM=1.

### 11.2. `completeJson` CEO

```ts
{
  reply_vi: string;
  highlight_ids?: string[]; // id card, không được thêm card
}
```

System prompt: “Bạn là trợ lý điều hành nội bộ PTT. Chỉ diễn đạt facts JSON. Cấm bịa số, tên khách, tên deal. Cấm kêu gọi gửi tin cho khách. Cấm tự commit hành động.”

Không đưa `bant_json` / SĐT lead vào prompt. Briefing facts đã aggregate.

---

## 12. Kho `ceo_os` + nuôi (CEO-5)

### 12.1. Kho

Tái dụng `ai_playbooks` / `ai_playbook_chunks` với `category='ceo_os'`.

Folder gợi ý: `_common/policy`, `_common/qa` (câu CEO hay hỏi ngoài số: “quy trình duyệt HĐ”, “ai được xem lương”).

Upload + Duyệt giống Sales Kit admin, route `/crm/ceo/learn`. Cap: `ceo_command.configure` **hoặc** `ai_admin.configure` **hoặc** `playbooks.configure`.

Retrieve: copy intake-local (keyword + cosine). **Không** gọi `PlaybooksService.ragQuery`.  
`list()` / `listAllChunks()` CSKH thêm `category <> 'ceo_os'` (cùng chỗ đã lọc `sales_kit`).

`needsLibrary` khi freeform không match NL intent **và** không match action parse.

Câu khớp kho nhưng có số tiền không citation `ready` kind `policy`/`qa` → không polish số.

### 12.2. Rating

`POST /api/crm/ceo/turns/:id/rating` `{ rating, reason? }` — chính chủ lượt hoặc configure.

### 12.3. Candidate

Job đêm (không chặn turn): từ lượt `down` + lượt `briefing_today` không degraded → tối đa 3 candidate `ceo_os` `pending_review`. Cấm copy số từ `rows` vào answer trừ khi kind=`metric_note` và giữ nguyên chuỗi fact.

Duyệt → file pending → Duyệt kho → `ready`. Không auto-ready.

### 12.4. LoRA

Cổng giống SK-AI-4: ≥200 cặp `up` đã mask + PO bật job ngoài Nest. Rollback 14 ngày về base 7B. Không bắt buộc cho A+B+C sống.

---

## 13. Dữ liệu mới

### 13.1. `ceo_command_turns`

| Cột | Ý nghĩa |
|-----|---------|
| `id` | uuid |
| `thread_id` | `ceo:{staffId}:{date}` |
| `actor_staff_id` | >0 |
| `intent` | briefing_* / nl_query / propose_action / freeform / ask_library |
| `user_text` | trim, mask |
| `reply_vi` | bản CEO thấy |
| `stub_mode` | bool |
| `model_name` | `facts` \| model \| `*-stub` |
| `facts_json` | nguồn A/B |
| `citations_json` | chunk ceo_os + intent_id |
| `proposed_action_json` | nullable |
| `cards_json` | briefing cards |
| `degraded_json` | nguồn lỗi |
| `rating` / `rating_reason` | |
| `created_at` | timestamptz |

Index `(actor_staff_id, created_at desc)`, `(thread_id, created_at)`, `(rating, created_at)`.

### 13.2. `ceo_command_actions`

| Cột | Ý nghĩa |
|-----|---------|
| `id` | uuid |
| `turn_id` | preview |
| `idempotency_key` | unique 24h |
| `action_id` | catalog |
| `params_json` | đã validate |
| `status` | `committed` \| `rejected_cap` \| `target_gone` \| `failed` |
| `result_json` | |
| `actor_staff_id` | |
| `created_at` | |

### 13.3. `ceo_command_learn_candidates`

Giống `sales_kit_learn_candidates` với `folder_key` trong `ceo_os`.

### 13.4. RBAC catalog

Thêm section `ceo_command`: `view`, `act`, `configure`.  
Gán sẵn job function GDKD / Admin (không gán AM).  
Thiếu row catalog = fallback cap NL query cho **view only** (không `act`).

### 13.5. DDL

`docs/specs/2026-08-30-ceo-command-ddl.sql` + `scripts/apply_pg_ddl_ceo_command.sh`.  
CEO-0 **bắt buộc** persist (không memory-only).

---

## 14. API

Prefix `/api/crm/ceo`. Guard: JWT staff + cap view (mục 10.3). Internal key: GET briefing cache only.

| Method | Path | Cap | Mô tả |
|--------|------|-----|--------|
| GET | `/context` | view | Badge, caps act, catalog chip |
| GET | `/threads?days=7` | view | Thread của mình |
| GET | `/turns?thread_id=` | view | Lịch sử |
| POST | `/turns` | view | Một lượt A/B/preview C |
| POST | `/actions/commit` | `act` + cap gốc | Ghi |
| POST | `/turns/:id/rating` | view (chính chủ) | 👍/👎 |
| GET | `/learn/files` | configure | Kho ceo_os |
| POST | `/learn/files` | configure | Upload |
| POST | `/learn/files/:id/approve` | configure | ready |
| GET | `/learn/candidates` | configure | |
| POST | `/learn/candidates/:id/approve` | configure | |
| POST | `/learn/candidates/:id/reject` | configure | |
| GET | `/learn/export.jsonl` | configure | L5 |

Không thêm route tool-calling động.

---

## 15. RBAC & flag (tóm)

| Việc | Cap |
|------|-----|
| Mở ChatBox, A (phần không finance) | `ceo_command.view` hoặc bộ NL |
| B hỏi số | bộ NL **hoặc** `ceo_command.view` |
| Preview C | view; nút Xác nhận ẩn nếu thiếu cap gốc |
| Commit C | `ceo_command.act` **và** cap gốc action |
| Kho / candidate | `ceo_command.configure` hoặc `ai_admin.configure` hoặc `playbooks.configure` |

AM không vào nav. CEO không thấy túi Sales Kit phiên.

---

## 16. UAT

### 16.1. CEO-0

| ID | Bước | Pass |
|----|------|------|
| V-1 | Login GDKD, mở `/crm/ceo` | Header + composer + chip A/B |
| V-2 | Login AM chỉ `crm_leads.edit` | 403 / không có nav |
| V-3 | Gõ linh tinh 3 lần | Thread persist; refresh còn |
| V-4 | JWT staff map fail | 403, không skip |

### 16.2. CEO-1 (A)

| ID | Bước | Pass |
|----|------|------|
| A-1 | Chip Hôm nay, mọi nguồn OK | ≤8 thẻ, mỗi thẻ có href |
| A-2 | Tắt Ops DV | Briefing không 500; `degraded` chứa ops |
| A-3 | Không cap finance | Không thẻ DT/overdue số ₫ |

### 16.3. CEO-2 (B)

| ID | Bước | Pass |
|----|------|------|
| B-1 | Chip Doanh thu 30 ngày | `intent_id=revenue_received_30d`; số = `/crm/ai/query` cùng intent |
| B-2 | “Lead Meta tháng này CPL” | Khớp alias catalog |
| B-3 | “Xóa hết lead giúp tôi” | `query_out_of_scope`; không mutate |
| B-4 | So sánh tab NL Analytics | Cùng rows |

### 16.4. CEO-3 (C)

| ID | Bước | Pass |
|----|------|------|
| C-1 | Preview assign risk, không bấm Xác nhận | DB risk không đổi |
| C-2 | Xác nhận assign | Đúng service gốc; audit action |
| C-3 | Commit lần 2 cùng idempotency_key | Không double assign |
| C-4 | AM mở URL commit | 403 |
| C-5 | “Gửi Zalo khách nhắc nợ” | Từ chối; không notification khách |
| C-6 | “Duyệt lương tháng này” | Từ chối + link HR nếu có |

### 16.5. CEO-4 / 5

| ID | Bước | Pass |
|----|------|------|
| O-1 | LLM on, Ollama up | `stub_mode=false`; rows B không đổi |
| O-2 | Ollama stop | Facts vẫn ra; stub |
| O-3 | Model bịa “2 tỷ” | Revert narrative |
| L-1 | 👎 | `rating=down` |
| L-2 | CSKH ragQuery | 0 chunk `ceo_os` và `sales_kit` |

---

## 17. Rủi ro

| Rủi ro | Xử lý |
|--------|-------|
| CEO hiểu bot = ChatGPT toàn quyền | Copy header “chỉ số whitelist + confirm”; C cấm list rõ |
| Briefing chậm 6 nguồn | Promise.allSettled + timeout 2.5s + cache 60s / staff |
| Leak Sales Kit / lương | Category filter + không nguồn HR v1 |
| Assign nhầm người | Server resolve staff từ roster; preview hiện tên DB |
| OSS bịa KPI | Gate sau model vs `facts_json` |
| Trùng SK-AI-1 client | Một PR mở `baseUrl`; hai flag |
| Phạm vi “toàn bộ RNOSAI” | V1 = CRM + Ops + AI risk + finance đọc; Ads/SEO/Email/HR = chip “mở hub” không query sâu |

---

## 18. Quyết định đã chốt

| # | Quyết định | Giá trị |
|---|------------|---------|
| E1 | A+B+C một sản phẩm, sáu slice | CEO-0…5 |
| E2 | Không agent tool tự do | Catalog đóng |
| E3 | B = `AiNlQueryService` hiện có | Không SQL mới |
| E4 | C = 6 action, confirm + idempotency | Không payroll/RBAC/ads/send |
| E5 | Kho `ceo_os` tách `sales_kit` | |
| E6 | OSS optional, default off | Cùng protocol sibling |
| E7 | HR / Ads / SEO sâu | Backlog spec riêng; v1 chỉ link hub |
| E8 | Không Lead Copilot | |
| E9 | Unresolved JWT | 403 |
| E10 | Nav | `/crm/ceo` — Điều hành CEO |

---

## 19. Việc cố ý để backlog

- SSE streaming.  
- Briefing cron 08:00 → `staff_notifications` (không commit C).  
- Intent NL mới (SEO hub, Meta spend, HR headcount) — **từng** intent + test, không mở whitelist bằng LLM.  
- Multi-select confirm.  
- Voice.  
- Fine-tune bắt buộc.

---

## 20. Tài liệu sau khi duyệt

- Plan: `docs/superpowers/plans/2026-08-30-ceo-command-oss-chatbox.md` (một plan, 6 slice).  
- DDL: `docs/specs/2026-08-30-ceo-command-ddl.sql`.  
- Guide: `docs/huong-dan-su-dung/28-ceo-command-chatbox.md` (tạo khi CEO-0 xong).  
- Sibling Sales Kit không sửa trừ khi mở chung `AiLlmClient` base URL.

---

## 21. Phụ lục — hệ thống lúc viết

| Thành phần | Trạng thái |
|------------|------------|
| NL Analytics `/crm/ai/query` + ~40 intent | Prod |
| Coach `/crm/ai/coach`, Insights, pipeline risk assign | Prod |
| Ops executive + ack alert | Prod (khi Ops DV on) |
| Business dashboard / owner-weekly | Prod |
| `staff_notifications` | Prod |
| Sales Kit ChatBox SRS | Design `bae7fab9` — chưa ship vỏ |
| `AiLlmClient` | Vẫn cứng `api.openai.com` cho tới SK-AI-1 / CEO-4 |
| CEO Command | Chưa có |

---

## 22. Phụ lục — map “toàn bộ RNOSAI” → v1

| Domain | V1 ChatBox | Cách |
|--------|------------|------|
| CRM lead / pipeline / CSKH | Có | A+B+C |
| Finance AR / DT | Có (đọc) | A+B nếu cap |
| Ops DV delivery | Có | A + ack |
| AI risk / coach | Có | A+C |
| Meta / Zalo / Google Ads | Link hub | Không intent spend mới |
| SEO / Email / Content / Video | Link hub | |
| HR / Payroll | Link `/crm/hr` | Cấm mutate |
| Portal / Mobile | Không | |
| Admin RBAC | Không | |

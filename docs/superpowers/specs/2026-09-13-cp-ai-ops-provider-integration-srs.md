# Software Requirements Specification

# Creative OS — Tích hợp nghiệp vụ AI Ops (Weave · Magnific MCP · ComfyUI)

| Thuộc tính | Giá trị |
|---|---|
| Tên | PTT Creative OS — nhà máy đa provider trên SoR sẵn; thắng đối thủ trên vòng kín brief → chạy đúng runtime → ingest có luật → duyệt → bàn giao → cost/asset |
| Mã tài liệu | SPEC-CP-ACO-WIN-2026-09-13 |
| Phiên bản | **1.1 — Wave A Weave → B Magnific (REST+MCP) → C Comfy (đang xây GPU); IA màn hình khóa** |
| Nguồn phân tích | `/Users/quoctuan/Downloads/SRS_PTT_AI_Creative_Operations_Weavy_Magnific_MCP_ComfyUI.md` (ACO 1.0.0, 2026-09-13) — **capability + ràng buộc provider**; không phải SoT route/entity |
| Cha | [Creative Production OS SRS v2.0](./2026-09-07-creative-production-os-srs.md) — **không thu hồi** |
| Con Weave (Mức 2) | [SPEC-CP-WEAVE-WIN](./2026-09-13-figma-weave-cp-integration-srs.md) — cổng GT-W / path / Sync **giữ nguyên** |
| Playbook video | [CP Video Agency Win](./2026-09-10-cp-video-agency-win-design.md) |
| Quote / margin thương mại | [Quotation OS](./2026-09-08-quotation-os-srs.md) — **tham chiếu**, không clone invoice |
| Plan triển khai (SoT code) | [2026-09-13-cp-aco-win-implementation.md](../plans/2026-09-13-cp-aco-win-implementation.md) |
| Plan Weave (con Wave A) | [2026-09-12-figma-weave-work-order.md](../plans/2026-09-12-figma-weave-work-order.md) |
| Prod | `https://rs.pttads.vn` · tenant `PTT` · UI tiếng Việt · empty `—` |
| Trạng thái | Draft — SoT tích hợp nghiệp vụ + vận hành; **chưa code provider mới** |
| Flag mặc định | `PTT_WEAVE=0` · `MAGNIFIC_MCP_ENABLED=0` · `MAGNIFIC_REST_API_ENABLED=0` · `COMFYUI_WORKER_ENABLED=0` · `CP_AI_ENABLED` giữ nguyên |
| Wave khóa (v1.1) | **A Weave** → **B Magnific REST API + Magnific MCP** (cùng wave, hai flag) → **C ComfyUI** (GPU đang xây; UI hiện, submit khóa) |

**Tuyên bố kế thừa:** Q1–Q19 CP OS đúng. Khách = `clients`. Campaign = `service_lifecycle`. Project = `crm_cp_projects`. Brief = `crm_cp_briefs`. Task = `crm_cp_tasks`. DAM = `crm_cp_assets`. Kit = `crm_cp_brand_kits`. Job = `crm_cp_render_jobs` (mở `provider`). Duyệt khách = Creative Hub `submit-creative`. Launch ads = Campaign Write. Video người = Video SOP. CSD Chat **không đụng**. Credit = `crm_cp_credit_ledger`.

**Tuyên bố thắng:** PTT không bán “có Weave + Magnific + Comfy”. PTT bán **một phiếu việc trên CRM** được route đúng runtime, output về đúng kho, đúng cổng người, đúng giá — đo **Cost per Approved Asset**.

---

## 0. Phân tích file đính kèm — giữ / bỏ / sửa

File ACO 1.0.0 đúng **ý kiến trúc**: CRM-first, provider-agnostic, template-first, human-in-the-loop; Weavy không giả định API; Magnific = MCP OAuth + copy asset về kho PTT; ComfyUI = GPU private, cấm browser gọi `:8188`; cost = estimate → reserve → reconcile; provenance bắt buộc.

Nếu **code nguyên ACO** trên RNOSAI thì thua: tạo platform thứ hai, lệch SoR, Phase 0 làm lại foundation đã có, Phase 1 ComfyUI khi **chưa có GPU farm vận hành**, API `/api/v1` không tồn tại.

### 0.1. Giữ (đúng ràng buộc vendor + nghiệp vụ)

| Ý ACO | Áp vào RNOSAI |
|---|---|
| Không RPA/Playwright login Weave | Giữ — Q-W2 / ngoài scope |
| Weave = deep-link + work order + ingest | Wave A — SPEC-CP-WEAVE-WIN |
| Magnific MCP: `https://mcp.magnific.com`, streamable HTTP, OAuth 2.0, `tools/list` cache TTL | Wave B — cùng REST |
| Magnific REST API: API key secret manager, backend-to-backend | Wave B — **không** để sau; không thay MCP; hai adapter một pane |
| Output Magnific **copy** vào object storage PTT, không chỉ URL provider | Bắt buộc |
| Token OAuth không xuống browser; tenant/account-scoped | NFR-SEC |
| ComfyUI: `/prompt` `/ws` `/history` `/queue` `/interrupt` `/system_stats` sau gateway | Wave C |
| Không raw workflow từ browser; chỉ bind whitelist | Wave C |
| Job bất đồng bộ; UI queued/progress; không timeout HTTP chờ render | Mọi provider |
| North-star: Cost per Approved Asset | RPT credit + governance |
| Brand snapshot tại lúc submit | `brand_kit_version_id` trên job |
| Agent không tự burn credit vô hạn | Confirm + cap `render` / `render_high_cost` |

### 0.2. Bỏ / cấm (nếu giữ = phá hệ thống)

| ACO viết | Vì sao cấm trên RNOSAI |
|---|---|
| Sản phẩm **PTT ACO** + portal riêng | Đã khóa `/crm/creative-os*` (Q1) |
| `/api/v1/creative-briefs`, `/api/v1/ai/jobs` | Prefix SoT = `/api/crm/cp` |
| Bảng `organizations`, `workspaces`, `campaigns` | Tenant `PTT`; campaign = `service_lifecycle` |
| Client Editor/Approver trên portal ACO mới | Portal = `/creatives` + Hub |
| Phase 0 “foundation 2 tuần” (client/brand/task/DAM/RBAC) | Đã có DDL `crm_cp_*` + cap `crm_cp.*` |
| Permission code `ai.job.*` / `ai.provider.*` thay cap hiện có | Map vào `crm_cp.view\|edit\|render\|render_high_cost\|export_final\|finance\|manage\|view_audit` |
| AUTO-route job tốn tiền ở v1 | Chỉ `MANUAL` / `RECOMMENDED` + confirm. AUTO = Wave D |
| Quality score công thức 0.30/0.30/0.25/0.15 làm SoT | Giữ engine QC CP + pack ngành (`bds_social`, `lead_social`, `tvc_short`). Điểm tổng = báo cáo, không cổng |
| Mirror mọi canvas event Weave | Đồng bộ task / asset / comment Hub thôi |
| Vector DB + RAG Brand/SOP ở v1 | Wave D; không chặn A–C |
| Marketplace workflow bên thứ ba | Ngoài scope |
| Tự publish mọi ads/social | Q8 / Q18 CP OS |
| Agent Service Account submit cost job | Draft + đề xuất thôi; người confirm |
| Export prefix kiểu `NOVA_MA2026_TASK-028` | **Thua** convention đã khóa `{client}/{campaign}/{task_id}/{lane}` + `CR-YYYY-MMDD-NNN` |

### 0.3. Thứ tự Wave — khóa v1.1 (không theo ACO Phase 1–3)

ACO xếp ComfyUI trước vì “API sẵn”. **PTT khóa theo hạ tầng và việc đang chạy:**

| Wave | Provider | Lý do vận hành |
|---|---|---|
| **A** | Figma Weave Mức 2 | Canvas designer sẵn; không GPU; đóng Drive/Zalo trước |
| **B** | **Magnific REST API + Magnific MCP** | Cùng wave. REST = job backend (key). MCP = agent/tool OAuth. Một pane UI, hai flag độc lập |
| **C** | ComfyUI | **GPU đang xây.** Tab/pane hiện từ Wave A (disabled). Submit chỉ khi `COMFYUI_WORKER_ENABLED=1` + heartbeat |
| **D** | Router đề xuất + CPA tinh + RAG | Sau khi A–B có số thật; C có thể chưa live |

Cấm đảo A↔B. Cấm đợi GPU xong mới làm Magnific. Cấm tách REST Magnific sang wave sau MCP.

---

## 1. Câu thắng (một câu)

**PTT không tích hợp ba tool. PTT vận hành một Creative Task trên CRM: brief + Brand Kit snapshot → chọn runtime (Weave tay, Magnific MCP, hoặc ComfyUI) → mọi output về `crm_cp_assets` (checksum, provenance, watermark) → QC + Hub → Campaign Write — đo cost/asset duyệt, trong khi đối thủ dừng ở canvas, MCP chat, hoặc Comfy mở port 8188.**

---

## 2. Ba hướng — chốt A

| | **A — Adapter trên CP OS (khóa)** | B — App ACO mới | C — Nút sâu từng tool |
|---|---|---|---|
| Làm | Mở `crm_cp_render_jobs.provider` + Work Order Weave + MCP/Comfy adapter; SoR cũ | Portal + `/api/v1` + org/workspace | Tab Magnific, tab Comfy, Drive |
| Thắng ai | Nova (một runtime), agency Drive+Zalo, studio Comfy trần, Magnific chat không CRM | Không — 6 tháng lệch book | Không — vẫn hỏi “file đâu?” |
| Rủi ro | Router tham lam | Phá Q1–Q8 | Không provenance |
| Thời gian | Wave A đã có plan; B/C theo flag | Không kiểm soát | Nhanh, thua |

**Chốt A.** File ACO = phụ lục ràng buộc vendor. Tài liệu này = SoT tích hợp.

---

## 3. Map thuật ngữ ACO → SoR RNOSAI

| ACO | RNOSAI (duy nhất) | Không làm |
|---|---|---|
| Organization / Workspace | `tenant_id='PTT'` + scope Của tôi/Team/Toàn PTT | Bảng workspace |
| Client | `clients` / `agency_client_id` | `aco_clients` |
| Brand / Brand Kit | `crm_cp_brand_kits` + versions + rules | Kit ACO |
| Campaign | `service_lifecycle.lifecycle_id` | `campaigns` |
| Project | `crm_cp_projects` | — |
| Creative Brief | `crm_cp_briefs.body_json` | `/api/v1/creative-briefs` |
| Creative Task | `crm_cp_tasks` (+ deliverable) | Task ACO |
| Prompt Package | Wave A: `brief_json` / draft `prompt`. Wave B: `crm_cp_prompt_packages` nếu 2 provider dùng chung một gói đã duyệt | Prompt chỉ trong chat |
| Template | `crm_cp_templates` + `crm_cp_weave_templates` + `crm_cp_provider_template_map` | Catalog 12 loại ngay wave A |
| AI Job | `crm_cp_render_jobs` | `ai_jobs` song song |
| Provider Run | `crm_cp_provider_runs` (bảng mới, FK job) | Run chỉ ở log file |
| Weavy Work Order | `crm_cp_weave_work_orders` | JSON `wwo_01` ngoài CP |
| Magnific creation | `crm_cp_provider_runs.external_run_id` | Workspace Magnific = master |
| Comfy prompt_id | `external_run_id` + `client_id=ptt-{job_id}` | Browser `/ws` |
| Asset / provenance | `crm_cp_assets` + version + JSON provenance | GPU disk = master |
| Review / approve | `crm_cp_approvals` + Hub `/creatives` | Review board ACO |
| Cost / credit | `crm_cp_credit_ledger` + project `credit_budget` 50/80/100 | Ledger USD tách |
| Quote / GM | Quotation OS + RPT | Invoice trong CP |
| Realtime | SSE `GET /api/crm/cp/renders/:id/events` (đã spec) | Channel `workspace:{id}` mới |
| MCP PTT (RNOS-33) | Tool registry nội bộ — **không** là Magnific MCP | Gộp hai MCP thành một server |

---

## 4. Quyết định khóa (Q-ACO)

| # | Khóa |
|---|---|
| Q-A1 | Một nhà máy: Creative OS. Ba adapter. Không app ACO. |
| Q-A2 | Prefix `/api/crm/cp`. Không `/api/v1`. |
| Q-A3 | Mọi job (trừ sandbox `crm_cp.manage`) bắt buộc `agency_client_id` + (`lifecycle_id` hoặc project đã gắn lifecycle) + `project_id`. |
| Q-A4 | Provider ∈ `stub` \| `weavy` \| `magnific_mcp` \| `magnific_rest` \| `comfyui`. `stub` giữ khi AI/GPU/MCP tắt. |
| Q-A5 | Flag tắt → 404/ẩn UI; không stub “thành công giả” có file. |
| Q-A6 | Browser **cấm** gọi ComfyUI, Magnific credential, MCP endpoint. |
| Q-A7 | Cost-incurring: hiện estimate + confirm. Thiếu confirm → 400 `human_confirm_required`. AI/agent không confirm. |
| Q-A8 | Reserve ledger khi submit; reconcile khi run xong; thất bại → release. Idempotency-Key bắt buộc. |
| Q-A9 | Master asset = object storage PTT. Workspace Magnific / disk GPU = staging. |
| Q-A10 | Ingest chung: MIME allowlist, SHA-256, thumb, probe (`null` không `0`), watermark draft/review. |
| Q-A11 | Lane Weave (`source/drafts/review/approved/final`) **chỉ** cho `provider=weavy`. Magnific/Comfy: version + `approval_status` CP; không giả 5 folder trên GPU. |
| Q-A12 | `EXTERNAL_PROCESSING_PROHIBITED` hoặc classification `RESTRICTED` → không Magnific; chỉ Comfy hoặc upload tay / Weave nếu policy cho (mặc định: Comfy hoặc nội bộ). |
| Q-A13 | Weavy API native = flag `WEAVY_API_ENABLED` tương lai; không đổi path/cổng Wave A. |
| Q-A14 | Không tự launch ads. Deliver = Campaign Write / CP publish video-only. |
| Q-A15 | North-star CPA tính từ ledger + số asset `final_approved` — query thật, không seed. |
| Q-A16 | Wave B = Magnific **REST + MCP**. Hai flag. Một pane. REST không thay MCP. |
| Q-A17 | UI **không** app mới, **không** nav Creative OS thứ 9. Workplace = **tab thứ 9 của PRJ-03: AI Ops**. |

---

## 4A. IA — UI nằm màn nào (SoT v1.1)

Không portal ACO. Không `/crm/aco`. Không đụng CSD Chat, Content OS, Media OS (MSOS), Video SOP (trừ deep-link).

OpsNav giữ 8 mục CP OS. Việc AI provider **sống trên project** — vì SoR khách/campaign/task ở đó.

### 4A.1. PRJ-03 — workplace (màn chính)

**Route:** `/crm/creative-os/projects/[id]?tab=ai-ops`  
**Label:** **AI Ops**  
**Tab thứ 9** sau 8 tab đã ship: Tổng quan · Brief · Deliverables · Công việc · Media · Phê duyệt · Ngân sách · Hoạt động.

8 tab cũ **không đổi** copy/hành vi. AI Ops **không** thay Deliverables / Công việc / Media.

**Sub-pane** (query `pane=`):

| `pane` | Wave | Việc trên màn | Ẩn / khóa |
|---|---|---|---|
| `weave` | A | Tạo WO, brief, copy prompt, Open in Weave, path, **Sync output**, gửi review, deliver | Ẩn cả tab AI Ops nếu `PTT_WEAVE=0` **và** B/C tắt. Khi A bật: pane Weave là default |
| `magnific` | B | Chọn transport **API** / **MCP**, template, estimate, confirm, progress, output | Pane hiện từ A với chip “Wave B”. Submit khóa tới `MAGNIFIC_*_ENABLED` |
| `comfy` | C | Template packshot, bind input, estimate GPU, confirm, progress | Pane hiện từ A: copy **“Đang xây GPU — chưa nhận job”**. Nút submit disabled tới worker health |

Query đầy đủ: `?tab=ai-ops&pane=weave|magnific|comfy&wo=&job=`

**Không** tách 3 tab PRJ-03 (`weave` / `magnific` / `comfy`) — phá IA, AM lạc.

### 4A.2. Màn hỗ trợ (reuse, không nhân)

| Screen | Route | UI thêm | Không làm ở đây |
|---|---|---|---|
| PRJ-03 Tổng quan | `?tab=overview` | Chip: N WO mở / N job Magnific / Comfy (số query) → link `ai-ops` | Composer generate |
| PRJ-03 Công việc | `?tab=tasks` | Task gắn `wo_id` / `job_id` (deep-link) | Open in Weave / Sync |
| PRJ-03 Media | `?tab=media` | Asset sau ingest (badge provider `weavy` / `magnific_*` / `comfyui`) | Sync prefix; OAuth |
| PRJ-03 Phê duyệt | `?tab=approvals` | Version từ AI Ops vào hàng duyệt sẵn | Cổng lane Weave |
| PRJ-03 Ngân sách | `?tab=budget` | Dòng reserve/charge provider | Connect Magnific |
| PRJ-03 Hoạt động | `?tab=activity` | Event open/sync/submit/confirm | — |
| MED-01 Library | `/crm/creative-os/media` | Lọc `provider=` | Tạo job |
| MED-02 Detail | `/media/[id]` | Provenance (provider, external_run_id, checksum) | Gọi MCP |
| MED-03 Ingest | `?tab=ingest` | Log ingest Weave/Magnific/Comfy | Đổi convention path |
| VID-01 Studio | `/crm/creative-os/video/[id]` | Nếu output **video**: mở version để QC/timeline | Không phải chỗ bấm Magnific/Comfy lần đầu |
| OVR-03 Monitor | `/crm/creative-os/ops` | Hàng provider: Weave sync lag, Magnific token/queue, Comfy heartbeat/VRAM | Deep-link job → `ai-ops` |
| OVR-02 Actions | `?panel=actions` | WO >7 ngày chưa linked; Magnific confirm treo; Comfy worker down | — |
| RPT credit | `/crm/creative-os/reports?tab=credit` | Slice CPA + provider | Nút generate |
| RPT governance | `?tab=governance` | Skip convention, ingest fail | — |
| SET Integrations | `/crm/creative-os/settings?tab=integrations` | Weave: prefix + template URL. Magnific: **Connect MCP (OAuth)** + **API key REST** (không hiện secret). Comfy: worker URL nội bộ + “GPU chưa sẵn sàng” | Job composer |
| SET Models / Policy / Credit | `?tab=models` `policy` `credit` | Allowlist tool MCP; cấm external; ngưỡng `render_high_cost` | — |
| Creative Hub | `/crm/creatives` | Bản `review`/`final` như CP | Pane AI Ops |
| Campaign Write | Ads Ops | Nhận deliver | Embed Weave |

### 4A.3. Sơ đồ “bấm ở đâu”

```
AM/Producer vào project (PRJ-03)
        │
        ├─ tab AI Ops / Weave     → Open + Sync          Wave A
        ├─ tab AI Ops / Magnific  → API hoặc MCP + confirm Wave B
        └─ tab AI Ops / Comfy     → chờ GPU / submit     Wave C
                │
                ▼
     Media + Phê duyệt (cùng project)
                │
                ▼
     Hub /creatives  →  Campaign Write
                │
     Ops / Settings / Báo cáo credit   (vận hành + secret, không làm việc creative)
```

### 4A.4. Cấm UI

- Nav gốc “ACO” / “Weavy” / “Magnific” / “Comfy”.  
- Iframe Weave / Magnific / Comfy `:8188`.  
- Composer trên Settings.  
- Secret/token trên mọi màn.  
- Tick xanh pane Comfy khi GPU chưa heartbeat.

## 5. Vai trò ba provider (nghiệp vụ, không brochure)

| Việc PTT làm mỗi tuần | Runtime đúng | Không dùng |
|---|---|---|
| Concept / node graph / designer iterate / import LoRA·Fal trong canvas | **Weave** — Work Order + Sync output | Gọi Comfy từ tab Weave |
| 1–20 ảnh/video premium gấp, không cần LoRA riêng | **Magnific MCP** — confirm credit | Mở chat Magnific ngoài CRM |
| Packshot / batch / LoRA khách / asset `RESTRICTED` / tái lập seed | **ComfyUI** — template versioned | Public `:8188` cho designer |
| Video người quay | Video SOP | Cả ba |
| Copy / lịch chữ | Content OS | Cả ba |
| Lead → CPL | Ads Ops + CRM | Cả ba (chỉ nhận `final`) |

Router Wave A–C: **người chọn** (hoặc đề xuất + confirm). Reason code bắt buộc khi hệ thống đề xuất: `PRIVATE_LORA`, `RESTRICTED`, `URGENT_PREMIUM`, `BATCH`, `WEAVE_HUMAN_CANVAS`, `BUDGET`, `PROVIDER_DOWN`.

---

## 6. Luồng nghiệp vụ thống nhất (một xương sống)

```
AM/Producer                 Policy / Ledger              Adapter                 Storage / Hub
    │                              │                        │                         │
1. Project + Task (SoR)            │                        │                         │
2. Brief + Kit snapshot            │                        │                         │
3. Chọn template + provider ──────►│ estimate + cổng        │                         │
4a. weavy: Open WO / Sync          │                        │  canvas ngoài           │
4b. magnific: confirm → MCP        │ reserve ──────────────►│  tool allowlist         │
4c. comfy: confirm → /prompt       │ reserve ──────────────►│  worker gateway         │
5. Run / progress (SSE)            │                        │                         │
6. Ingest master + provenance ─────│ reconcile ─────────────┴────────────────────────►│ DAM
7. QC pack (tech + ngành)          │                        │                         │
8. Hub / Brand / Legal             │                        │                         │
9. Deliver Campaign Write          │                        │                         │
10. CPA / revision feedback        │                        │                         │
```

**Đầu ra mỗi bước phải truy vết:** `project_id`, `task_id` (nghiệp vụ), `job_id`, `provider`, `external_run_id` (nếu có), `asset_id`, `ledger_id`.

Thiếu bước 6 → chưa có asset SoR. Thiếu bước 8 → không deliver. Thiếu bước 9 → chưa thắng Ads.

---

## 7. Wave A — Weave (thừa kế, không viết lại luật)

Toàn bộ cổng **GT-W01…12**, path, filename `CR-YYYY-MMDD-NNN`, Sync output, HMAC hook, watermark lane, UAT 12 phút: [SPEC-CP-WEAVE-WIN](./2026-09-13-figma-weave-cp-integration-srs.md).

Bổ sung so với ACO §3.5 / FR-007:

- `provider=weavy`, `provider_run_mode=manual` trên `crm_cp_provider_runs` khi Sync thành công (1 run / lần ingest có file mới).
- Job CP: tạo `crm_cp_render_jobs` state `completed` (hoặc `ingested`) **sau** Sync — không giả `PROCESSING` khi designer còn trên canvas.
- ACO “milestone OPENED / DRAFT_EXPORTED” = status WO đã khóa, không bảng mới.
- Presigned upload fallback = FR-W-017 đã có.

---

## 8. Wave B — Magnific REST API + Magnific MCP (cùng wave)

Hai adapter, **một pane** `ai-ops&pane=magnific`. Operator chọn transport trên job (hoặc template map sẵn):

| Transport | `provider` | Auth | Việc đúng |
|---|---|---|---|
| **REST API** | `magnific_rest` | API key — secret manager; flag `MAGNIFIC_REST_API_ENABLED` | Batch / job ổn định backend-to-backend |
| **MCP** | `magnific_mcp` | OAuth 2.0 — token mã hóa; flag `MAGNIFIC_MCP_ENABLED` | Agent, `tools/list`, streamable HTTP |

REST **không** thay MCP. MCP **không** là bước “trước API”. Thiếu entitlement REST → ẩn radio API, MCP vẫn chạy (và ngược lại). Cả hai: copy output về DAM, cùng cổng GT-M / GT-A, cùng ledger.

### 8.1. Kết nối (Settings → Integrations — không nằm composer)

**MCP**

```
SET Integrations → Connect Magnific MCP
  → GET oauth/start (state CSRF)
  → Magnific authorize
  → callback server-only
  → token at rest · tools/list TTL 15 phút
```

Endpoint MCP: `https://mcp.magnific.com`.

**REST**

```
SET Integrations → Lưu API key Magnific (một chiều; GET không trả key)
```

- Connect do `crm_cp.manage`. Không OAuth/key cá nhân designer làm prod trừ ownership + người kế nhiệm.  
- Pilot: **một** account/key PTT + chargeback `agency_client_id`. Tách billing = Wave D.  
- `account_balance` (MCP và/hoặc REST usage) trước job tốn credit. Không đọc được balance → không submit.

### 8.2. Tool allowlist (pilot)

Bật từng nhóm; mặc định **tắt** 3D / custom_references / spaces.

| Nhóm | Tool (ví dụ; SoT = `tools/list`) | Pilot |
|---|---|---|
| Account | `account_balance`, `project_report` | Bắt buộc |
| Image | `images_generate`, `images_upscale`, `images_remove_background` | Bật |
| Edit | `images_crop`, `images_resize` | Bật |
| Video | `video_generate` | Bật + `render_high_cost` nếu estimate ≥ ngưỡng settings |
| Status | `creation_status`, `creations_wait`, `creations_get` | Bắt buộc |
| Upload ref | `creations_request_upload` … finalize | Chỉ asset đã rights-ok + không RESTRICTED |
| Audio TTS | `audio_tts` | Tắt tới khi Video SOP/CP voice policy xong |
| 3D / Spaces / custom refs | còn lại | Tắt |

Hard-code tên tool **cấm** làm giả định vĩnh viễn: map `capability_key` → tool name từ discovery; thiếu tool → 409 `mcp_tool_unavailable`.

### 8.3. Luồng job

1. Composer trên project: template + prompt package/brief + inputs.  
2. `POST /jobs/draft` `provider=magnific_mcp` **hoặc** `magnific_rest` → validate brand policy + estimate.  
3. `PENDING_CONFIRMATION` nếu estimate > 0 hoặc > threshold.  
4. `POST /jobs/:id/confirm` `{ confirm: true }` — staff JWT + cap `render`.  
5. Adapter gọi tool → lưu `external_run_id`.  
6. Wait/poll; timeout cấu hình (submit 60s, wait video dài hơn, tối đa settings).  
7. Tải bytes → ingest DAM → provenance (`magnific_mcp` hoặc `magnific_rest`, tool/route name, redacted snapshot).  
8. Ledger reconcile credits thật nếu API trả; không thì giữ estimate + cờ `actual_estimated=true` (UI `—` cho actual, không bịa).  
9. QC → review như video/asset CP.

### 8.4. Cổng Magnific

| ID | Pass | Fail |
|---|---|---|
| GT-M01 | Flag đúng transport: MCP = OAuth còn hạn; REST = key configured | 409 `magnific_disconnected` |
| GT-M02 | Balance đọc được và ≥ estimate | `POLICY_BLOCKED` / `BUDGET` |
| GT-M03 | Tool ∈ allowlist ∩ discovery | `mcp_tool_unavailable` |
| GT-M04 | Confirm nếu cost-incurring | 400 |
| GT-M05 | Không RESTRICTED / không cấm external | lock Comfy hoặc từ chối |
| GT-M06 | Ingest checksum xong mới `QUALITY_CHECK` | `ASSET_SYNC_FAILED`; job không `completed` |
| GT-M07 | Token không vào JSON FE / AI Trace | test bắt buộc |

---

## 9. Wave C — ComfyUI (GPU đang xây)

### 9.1. Topology bắt buộc

```
Internet → ops-web / ptt-crm-api
  → Orchestrator (private)
  → WireGuard/Tailscale/VPC
  → Nginx/Caddy allowlist IP orchestrator
  → ComfyUI 127.0.0.1:8188
```

Checklist go-live (Appendix ACO B — **giữ**, gắn on-call):

- Port 8188 không public.  
- Health `/system_stats` timeout 5s.  
- Image queue ≠ video queue (khi có 2 worker).  
- Disk GPU ≠ master DAM.

Không đủ checklist → `COMFYUI_WORKER_ENABLED` giữ 0.

### 9.2. Workflow

- JSON workflow + `crm_cp_workflow_bindings` (nodeId, inputKey) versioned.  
- Production template immutable; sửa = version mới.  
- `POST /prompt` với `client_id=ptt-{job_id}`.  
- Theo `/ws`; hoàn tất `GET /history/{prompt_id}`.  
- Copy output → storage → mới `completed`.  
- OOM → retry policy (1 lần, cùng idempotency parent, `attempt+1`); hết → `OUT_OF_MEMORY`.  
- `interrupt` chỉ `crm_cp.render` + job của scope.

### 9.3. Cổng Comfy

| ID | Pass | Fail |
|---|---|---|
| GT-C01 | Worker heartbeat < 30s | `WORKER_UNAVAILABLE` |
| GT-C02 | Binding whitelist only | 422 `unsafe_binding` |
| GT-C03 | VRAM/capability match template | 409 `worker_capability` |
| GT-C04 | Output ingest checksum | không complete |
| GT-C05 | Browser không thấy host:8188 | pentest |

---

## 10. Cost, credit, margin (thắng Finance)

Luồng CP đã khóa: **Estimate → pre-check → Reserve → Charge → Release**. Áp mọi provider.

| Nguồn chi | Cách ghi ledger |
|---|---|
| Magnific credits | `kind=provider_magnific`; amount = credit × rate settings (VND/credit hoặc điểm nội bộ — **một đơn vị**, ghi trong SET) |
| Comfy GPU-giây | `kind=gpu_seconds` × rate worker class |
| Weave | `kind=operator` optional (phút designer) Wave D; Wave A không bịa giờ |
| Storage | không charge job (ops) |
| LLM brief | token nếu `CP_AI_ENABLED`; đã có pattern Video SOP |

Cảnh báo project **50 / 80 / 100%**. 100% hard = không submit (trừ `finance` override + audit).

**CPA (north-star):**

```
CPA = (Σ ledger charged trong kỳ gắn campaign/project) / (số asset version final_approved phát sinh trong kỳ)
```

Mẫu số = 0 → KPI `—`, không chia 0, không hiện 0₫ giả.

Báo cáo: theo `agency_client_id`, `lifecycle_id`, `project_id`, `provider`, `template_key`. Không clone Quotation invoice. Nút “mở báo giá” deep-link QT nếu `quote_id` có trên lifecycle.

---

## 11. Cổng chung (GT-A)

| ID | Cổng | Pass | Fail |
|---|---|---|---|
| GT-A01 | Context | client + project + (lifecycle hoặc lý do sandbox manage) | 422 |
| GT-A02 | Kit snapshot | `brand_kit_version_id` ghi vào job lúc confirm | Job historical không đổi kit mới |
| GT-A03 | Flag provider | env + settings | Ẩn nút |
| GT-A04 | Confirm cost | `confirm=true` | 400 |
| GT-A05 | Cap | `render` / `render_high_cost` / `export_final` | 403 |
| GT-A06 | Ingest | checksum + MIME | không duyệt |
| GT-A07 | QC Blocked | không Hub client, không deliver | 409 |
| GT-A08 | Hub | `submit-creative` như CP | không portal mới |
| GT-A09 | Deliver | Campaign Write + URI + checksum | không tự ads |
| GT-A10 | Idempotent | cùng Idempotency-Key | không nhân job/charge |

AI không override GT-A04…A09.

---

## 12. Yêu cầu chức năng

| ID | Tên | Wave | Tóm tắt |
|---|---|---|---|
| FR-A-001 | Task trên SoR | A | Mọi run gắn `crm_cp_tasks` / deliverable / project |
| FR-A-002 | Provider run row | A | Insert khi Weave sync / Magnific submit / Comfy prompt |
| FR-A-003 | Weave WO + Sync | A | SPEC-CP-WEAVE-WIN đủ |
| FR-A-004 | Job list đa provider | A | OVR-03 / VID-04 hiện `weavy` khi có run |
| FR-A-005 | Magnific OAuth | B | Connect/disconnect/rotate; không trả token |
| FR-A-006 | Magnific draft/confirm/submit | B | Allowlist + balance |
| FR-A-007 | Magnific ingest + provenance | B | Copy master |
| FR-A-008 | Comfy gateway | C | prompt/ws/history |
| FR-A-009 | Workflow registry bind | C | Version + fixture tối thiểu 1 template packshot |
| FR-A-010 | Worker health | C | system_stats → OVR-03 |
| FR-A-011 | Cost guard | B | Estimate/reserve/reconcile Magnific; C thêm GPU |
| FR-A-012 | CPA report | B | Query; `—` nếu mẫu số 0 |
| FR-A-013 | Recommend (không auto) | C/D | Reason codes; user confirm |
| FR-A-014 | Prompt package version | B | Object dùng chung Weave copy + Magnific; A dùng brief_json |
| FR-A-015 | SSE progress | B/C | Tái dùng `/renders/:id/events`; Weave không giả % canvas |
| FR-A-016 | Circuit breaker | B/C | Provider down → không treo queue; fallback = đề xuất, không tự burn provider khác |
| FR-A-017 | Audit | A | open/sync/submit/confirm/approve/credential |

---

## 13. Chất lượng vận hành (NFR)

### 13.1. SLA (bổ sung ACO §7.1 — số vận hành PTT)

| Hạng | Mục tiêu |
|---|---|
| API đọc CP p95 | Theo SLO CRM hiện có (ACO ≤500ms = mục tiêu, không fail UAT nếu p95 CRM đã công bố khác) |
| Draft job / validate | ≤ 3s |
| Weave Sync | SPEC-CP-WEAVE-WIN §11.2 (p95 < 30s ≤20 file) |
| Magnific submit tool | timeout mặc định 60s; generation async |
| Magnific wait video | cấu hình; UI progress; không HTTP user treo |
| Comfy health | 5s |
| SSE event p95 sau event provider | ≤ 3s khi worker sống |
| Preview | signed URL; ≤ 3s mạng nội bộ |

Render/video **không** cam kết phút tuyệt đối.

### 13.2. Độ tin cậy

- Idempotency submit/retry/ingest.  
- DLQ `ai.jobs.dead-letter` (tên queue nội bộ; Redis/Bull hoặc worker hiện có — **không** bắt buộc RabbitMQ mới nếu CP đã có queue).  
- Outbox cho event duyệt/cost.  
- Checkpoint poll Magnific/Comfy khi process restart.  
- Partial ingest: file ok commit; file lỗi warning.

### 13.3. Bảo mật (ACO §7.4 — giữ, gắn cap PTT)

- WAF/HTTPS như prod hiện tại.  
- Comfy không public.  
- OAuth: state, redirect allowlist, PKCE nếu flow yêu cầu, không log token.  
- PII/redaction text trước gửi Magnific khi policy bật (Wave B: checklist tay + block RESTRICTED).  
- Signed URL TTL = `crm_cp_settings.signed_url_ttl_min`.  
- MIME allowlist đồng bộ Weave + upload CP.

### 13.4. Quan sát

Correlation: `request_id`, `project_id`, `task_id`, `job_id`, `provider_run_id`, `external_run_id`, `asset_id`.

Metric cửa xanh 30 ngày sau khi **bật** từng flag:

| Metric | Cửa |
|---|---|
| Weave convention % | ≥ 90% sau tuần 1 (GT-W) |
| Magnific ingest fail | < 5% job completed-without-asset |
| Magnific hook/token fail | alert > 0 trong 15 phút |
| Comfy queue wait p95 | < SLA template (settings) |
| Job accepted mất | 0 |
| CPA | số query; không seed |

### 13.5. DoR / DoD nhà máy

**DoR chạy job tốn tiền:** project + task + kit version + template + estimate hiện + flag on + (OAuth hoặc worker health).

**DoD:** asset master trên PTT + checksum + provenance + ledger closed (charged hoặc released) + QC state + (Hub hoặc lý do cancel).

---

## 14. Dữ liệu — chỉ bảng mới

Không tạo lại project/brief/asset/kit/ledger.

```text
crm_cp_provider_connections
  id, tenant_id, provider, status, account_label,
  created_by, created_at, updated_at
  -- token: secret manager / cột encrypted, KHÔNG SELECT ra API

crm_cp_provider_runs
  id, job_id, work_order_id null,
  provider, mode,           -- magnific_mcp | comfyui | weavy ; auto|manual
  external_run_id,
  tool_or_workflow,
  request_redacted_json, response_redacted_json,
  estimate_credits, actual_credits,
  started_at, ended_at, status

crm_cp_provider_template_map
  template_id, provider, external_ref, bindings_json, active

crm_cp_prompt_packages          -- Wave B
  id, project_id, name, status, current_version

crm_cp_prompt_package_versions
  package_id, n, payload_json, approved_by, created_at

crm_cp_workflow_bindings        -- Wave C
  template_id, version, bindings_json, fixture_json
```

`crm_cp_render_jobs.provider` CHECK mở thêm `weavy`, `magnific_mcp`, `magnific_rest`, `comfyui`.  
`crm_cp_weave_*` giữ theo plan Weave.

---

## 15. API (mỏng)

Mọi path dưới `/api/crm/cp`. Auth staff JWT.

| Method | Path | Cap | Wave |
|---|---|---|---|
| * | `/weave-orders*` `/weave-ingest/hook` | như WEAVE-WIN | A |
| GET | `/provider-connections` | view / manage | B |
| POST | `/provider-connections/magnific/oauth/start` | manage | B MCP |
| POST | `/provider-connections/magnific/rest-key` | manage | B REST — body key, không echo |
| POST | `/provider-connections/:id/disconnect` | manage | B |
| POST | `/jobs/draft` | edit | B |
| POST | `/jobs/:id/confirm` | render | B |
| POST | `/jobs/:id/submit` | render | B |
| POST | `/jobs/:id/cancel` `/retry` | render | B/C |
| GET | `/jobs/:id` | view | B |
| GET | `/renders/:id/events` | view | đã có — mở provider |
| GET | `/provider-health` | view | B/C |
| GET | `/reports/credit` | finance/view | đã có — thêm CPA slice |

**Cấm** ship `/api/v1/creative-briefs` từ file ACO.

Payload draft (B) — field map SoR, không `workspaceId`:

```json
{
  "project_id": "uuid",
  "task_id": "uuid",
  "template_id": "uuid",
  "provider": "magnific_mcp",
  "provider_mode": "manual",
  "prompt_package_id": null,
  "inputs": { "aspect_ratio": "4:5", "variants": 4 },
  "idempotency_key": "uuid"
}
```

---

## 16. RBAC — map role ACO → cap PTT

| Việc ACO | Cap RNOSAI |
|---|---|
| Connect OAuth / secret | `crm_cp.manage` |
| Tạo brief/task/WO | `crm_cp.edit` |
| Confirm/submit Magnific/Comfy | `crm_cp.render` |
| Job đắt | `crm_cp.render_high_cost` |
| Open Weave / Sync | `crm_cp.edit` |
| Override đề xuất provider | `crm_cp.manage` hoặc producer lead (`manage`) |
| Duyệt nội bộ | approval CP hiện có |
| Duyệt khách | Hub / portal — không cap ops |
| Deliver | `crm_cp.export_final` |
| Xem CPA / ledger | `crm_cp.finance` hoặc view limited AM |
| Log kỹ thuật | `crm_cp.view_audit` |
| Agent | không cap riêng Wave A–C; cấm confirm |

Client không thấy graph Comfy, path model, stack trace, tool raw MCP.

---

## 17. Mục tiêu thắng (business + vận hành)

| ID | Mục tiêu | Cửa | Không đo |
|---|---|---|---|
| BG-A-01 | Một campaign Mid-Autumn **không hỏi file chat** | UAT Weave 12 phút (WEAVE-WIN) | Số node Weave |
| BG-A-02 | Một job Magnific **trong CRM** ra DAM + checksum | 1 image generate → asset PTT; Magnific tab ngoài không phải SoR | Số model Magnific |
| BG-A-03 | Credit không cháy im | 1 job không confirm → 400; 1 balance fail → không submit | — |
| BG-A-04 | RESTRICTED không ra ngoài | 1 kit cấm external → Magnific 409 | — |
| BG-A-05 | Comfy không lộ net | Probe ngoài → timeout/refuse :8188 | Benchmark GPU marketing |
| BG-A-06 | Một CPA thật | Report kỳ có ≥ 1 approved + ledger; mẫu số 0 = `—` | ROI ads |
| BG-A-07 | Không app thứ hai | 0 route `/aco`, 0 `/api/v1/ai` | — |
| BG-A-08 | Không tự ads | 0 job adapter gọi Campaign Write launch | — |
| BG-A-09 | Idempotent | Retry cùng key không nhân charge | — |
| BG-A-10 | Đối thủ canvas/MCP/Comfy trần | Demo 20 phút: A rồi B (C nếu worker sẵn) | Feature parity tool |

---

## 18. Lộ trình vận hành thực tế

Không dùng Phase 0–4 ACO (làm lại foundation / Comfy trước).

| Wave | Thời gian gợi ý | Xong khi | Phụ thuộc hạ tầng |
|---|---|---|---|
| **A — Weave Mức 2** | Plan W0–W5 | UAT 12 phút; tab **AI Ops → Weave** | Disk/S3 prefix |
| **B — Magnific REST + MCP** | 2–3 tuần sau A | 1 job REST + 1 job MCP → DAM; Settings Integrations connect cả hai | Entitlement API key **và/hoặc** OAuth; GPU **không** chặn B |
| **C — ComfyUI** | Khi GPU + VPN + heartbeat | 1 packshot PRODUCTION; trước đó pane Comfy chỉ “đang xây GPU” | Máy GPU — **đang xây**, không đảo lên trước B |
| **D — Router / CPA / RAG** | 4+ tuần | Recommend + reason | Data A–B (C optional) |

Song song A: không chặn Video SOP / Hub / Ads.  
C không block B. B không block A.

Ops runbook mỗi wave (bắt buộc trước flag=1):

1. Env + secret + rollback flag=0.  
2. UAT checklist §19.  
3. Alert: token fail / queue / ingest fail / budget 80%.  
4. Owner on-call + kênh.

---

## 19. UAT / demo thắng (20 phút, không slide)

**Kịch bản khách `nova`, lifecycle `mid-autumn-2026`.**

| Phút | Việc | Pass | Fail nếu |
|---|---|---|---|
| 0–12 | Đúng case Weave WEAVE-WIN | Sync + Hub + deliver | Đoán folder; duration 0 |
| 12–16 | Connect Magnific (staging) → draft packshot → **không** bấm confirm → thử submit | 400 confirm | Tự generate |
| 16–19 | Confirm → asset trong thư viện project, provenance `magnific_mcp`, ledger dòng | File chỉ ở Magnific | |
| 19–20 | Mở CPA report | Số hoặc `—` | 0₫ giả / số seed |

Khi có Wave C: thêm 5 phút packshot Comfy + tắt Wi-Fi giả lập worker → job `WORKER_UNAVAILABLE`, không mất audit.

UAT bảo mật (trước prod B/C): IDOR job/asset; token không trong Network FE; Comfy port; OAuth state giả.

---

## 20. Ngoài phạm vi (cố định A–C)

- App/portal ACO; `/api/v1`; org/workspace/campaign table.  
- Weavy UIKit Chat/Files; RPA Weave; embed iframe.  
- AUTO-route tốn tiền; agent confirm.  
- Marketplace workflow; train foundation model PTT.  
- K8s multi-region; Vector DB bắt buộc.  
- TTS/3D/Spaces Magnific.  
- Tự publish ads/social.  
- Clone Quotation / Finance invoice.  
- Đụng CSD Chat.  
- Seed Nova/Sunlight/Tâm An trên prod.

---

## 21. Đối thủ — ma trận sau khi map đúng hệ thống

| Capability | Weave / Magnific / Comfy trần | Nova CP | Drive+chat | **PTT sau A–C** |
|---|---|---|---|---|
| Canvas node | Weave | — | — | Work Order + lane |
| MCP generate | Magnific chat | — | — | Job + ledger + DAM |
| Private LoRA | Comfy local | ⚠️ | — | Gateway + version workflow |
| Khách + campaign SoR | ❌ | ⚠️ workspace | ❌ | `clients` + lifecycle |
| Duyệt khách | ❌ | portal riêng | mail | Hub sẵn |
| Ads handoff | ❌ | ❌ | tay | Campaign Write |
| CPA | ❌ | credit workspace | ❌ | ledger / approved |
| Không lock-in 1 model | 1 tool | 1 stack | — | 3 adapter, 1 SoR |

**Đừng cạnh tranh model.** Cạnh tranh **phiếu việc + cổng + kho + giá + ads**.

---

## 22. Self-review

| Kiểm | Kết quả |
|---|---|
| Placeholder TBD | Không |
| ACO vs RNOSAI | `/api/v1` và entity mới = cấm; capability provider = giữ |
| Weave | Không đổi convention / GT-W |
| Thứ tự | A Weave → B Magnific → C Comfy (ngược ACO vì hạ tầng thật) |
| SoR | Không bảng campaign/client mới |
| Scope | Một module CP; ba adapter; không ACO app |
| Thắng đo | BG-A-01…10 + SLA từng wave |

---

## 23. Tài liệu liên quan

| Tài liệu | Vai trò |
|---|---|
| ACO 1.0.0 (Downloads) | Ràng buộc vendor + ý tưởng FR; **không code theo route/entity** |
| [CP OS SRS](./2026-09-07-creative-production-os-srs.md) | Module cha |
| [WEAVE-WIN](./2026-09-13-figma-weave-cp-integration-srs.md) | SoT Wave A |
| [Plan Weave](../plans/2026-09-12-figma-weave-work-order.md) | Task code Wave A |
| [CP Video Win](./2026-09-10-cp-video-agency-win-design.md) | QC pack ngành |
| [QT OS](./2026-09-08-quotation-os-srs.md) | Giá bán / GM — deep-link |
| Plan Weavy Chat UIKit | Ngoài scope |

# RNOSAI BA — Market Research OS Use Cases (MarketResearchModule)

## Document control

| Thuộc tính | Giá trị |
| --- | --- |
| Document ID | RNOSAI-BA-RES-UC |
| Phiên bản | 1.0 |
| Ngày xuất | 2026-08-14 |
| Module | MOD-MARKET-RESEARCH |
| Nest module | `MarketResearchModule` |
| Số UC | 38 (RES-UC-001…020 P0 · 021…027 P1 · 030…033 P2 · 040…042 P3 · 050…051 P4 · 060…061 P5) |
| Spec thủ công | 38/38 |
| Master index | [RNOSAI-BA-Master-Spec.md](../RNOSAI-BA-Master-Spec.md) |
| Design spec | [`../superpowers/specs/2026-08-14-market-research-os-design.md`](../../superpowers/specs/2026-08-14-market-research-os-design.md) |
| SRS | [`../2026-08-14-market-research-os-srs.md`](../2026-08-14-market-research-os-srs.md) |
| UX/UI | [`../2026-08-14-market-research-os-ui-ux.md`](../2026-08-14-market-research-os-ui-ux.md) |
| Catalog | [`../../use-cases/12-MARKET-RESEARCH-OS.md`](../../use-cases/12-MARKET-RESEARCH-OS.md) |
| Actions | [`../../use-cases/actions/12-RES-ACTIONS.md`](../../use-cases/actions/12-RES-ACTIONS.md) |
| Catalog DV | DV12 `phan-tich-thi-truong` |

---

## 1. Tóm tắt module

**Market Research OS** vận hành insight có truy vết cho deliverable DV12:

**Decision → Research Question → Source → Evidence → Insight (duyệt) → Report Version → Activation.**

AI = copilot (Tavily desk, Deep Research nguồn nháp, Claude soạn). Không auto-publish. Không trộn `/crm/sales?tab=market` (NCTT BĐS).

### 1.1. Màn hình liên quan

| SCR | Tên | Route | Phase | UC |
| --- | --- | --- | --- | --- |
| SCR-RES-001 | Project list | `/crm/research` | P0 | 001, 010, 013 |
| SCR-RES-002 | Wizard G0 | `/crm/research/new` | P0 | 002 |
| SCR-RES-003 | Workspace | `/crm/research/[id]` | P0 | 015 |
| SCR-RES-003a | Brief | `?tab=brief` | P0 | 003 |
| SCR-RES-003b | Sources | `?tab=sources` | P0 | 004, 005, 014, 019, 061 |
| SCR-RES-003c | Evidence | `?tab=evidence` | P0 | 006, 017 |
| SCR-RES-003d | Insights | `?tab=insights` | P0 | 007, 008, 011, 018 |
| SCR-RES-003e | Report | `?tab=report` | P0 | 009, 012 |
| SCR-RES-003f | Activity | `?tab=activity` | P0 | 016, 020 |
| SCR-RES-004 | Insight drawer | `?insight=` | P0 | 007, 008 |
| SCR-RES-005 | Report preview | `/report/[versionId]` | P0 | 009 |
| SCR-RES-006 | Gate dialog | modal | P0 | 008 |
| SCR-RES-007 | Job chip | panel | P0 | 004, 005, 020 |
| SCR-RES-008 | Deep Research modal | modal | P0 | 005 |
| SCR-RES-009 | Evidence form | drawer | P0 | 006 |
| SCR-RES-010 | Flag-off | — | P0 | 013 |
| SCR-RES-020 | Competitors | `?tab=competitors` | P1 | 022 |
| SCR-RES-021 | Insert → plan | `/crm/marketing-plan/[id]` | P1 | 023 |
| SCR-RES-022 | Confidence rubric | drawer | P1 | 021 |
| SCR-RES-030 | Studies | `?tab=studies` | P2 | 030, 060 |
| SCR-RES-031 | Ops KPI | `/crm/research/analytics` | P2 | 033 |
| SCR-RES-040 | Portal report | portal | P3 | 040 |

### 1.2. Ma trận UC

| ID | Tên | Priority | Phase | Status | FR / Story |
| --- | --- | --- | --- | --- | --- |
| RES-UC-001 | Nav Lên kế hoạch + list project | P0 | P0 | Spec ready | FR-NAV-01 · US-NAV-01 |
| RES-UC-002 | Wizard tạo project G0 | P0 | P0 | Spec ready | FR-PRJ-01 · US-AM-01 |
| RES-UC-003 | CRUD Research Questions | P0 | P0 | Spec ready | FR-PRJ-04 · US-AM-02 |
| RES-UC-004 | Chạy Desk Tavily | P0 | P0 | Spec ready | FR-SRC-02 · US-AN-01 |
| RES-UC-005 | Chạy Deep Research | P0 | P0 | Spec ready | FR-SRC-03 · US-AN-02 |
| RES-UC-006 | Verify source / tạo evidence | P0 | P0 | Spec ready | FR-EVD-01 · US-AN-03 |
| RES-UC-007 | Soạn insight + gắn evidence | P0 | P0 | Spec ready | FR-INS-01 · US-AN-04 |
| RES-UC-008 | Lead duyệt insight | P0 | P0 | Spec ready | FR-REV-02 · US-LD-01 |
| RES-UC-009 | Sinh report + xuất DOCX | P0 | P0 | Spec ready | FR-RPT-01 · US-AN-05 |
| RES-UC-010 | Client tenancy | P0 | P0 | Spec ready | FR-RBAC-03 · US-SEC-01 |
| RES-UC-011 | Copilot insight từ evidence | P0 | P0 | Spec ready | FR-AI-03 |
| RES-UC-012 | Copilot report draft | P0 | P0 | Spec ready | FR-AI-04 |
| RES-UC-013 | Feature flag ẩn module | P0 | P0 | Spec ready | FR-NAV-04 |
| RES-UC-014 | Keep / reject source | P0 | P0 | Spec ready | FR-SRC-04 |
| RES-UC-015 | Chuyển trạng thái project | P0 | P0 | Spec ready | FR-PRJ-03 |
| RES-UC-016 | Xem nhật ký Activity / AI runs | P0 | P0 | Spec ready | FR-AI-05 |
| RES-UC-017 | Evidence immutable / supersede | P0 | P0 | Spec ready | FR-EVD-02 · FR-EVD-05 |
| RES-UC-018 | AM duyệt bản khách | P0 | P0 | Spec ready | FR-REV-03 |
| RES-UC-019 | Thêm nguồn thủ công | P0 | P0 | Spec ready | FR-SRC-01 |
| RES-UC-020 | Poll / retry job AI | P0 | P0 | Spec ready | FR-AI-01 |
| RES-UC-021 | Confidence rubric 5 chiều | P1 | P1 | Spec ready | FR-INS-04 · US-AN-10 |
| RES-UC-022 | Competitor + snapshot | P1 | P1 | Spec ready | FR-CI-01 · US-AN-11 |
| RES-UC-023 | Chèn insight vào marketing-plan | P1 | P1 | Spec ready | FR-INT-01 · US-AM-10 |
| RES-UC-024 | Methodology appendix bắt buộc TC/CS | P1 | P1 | Spec ready | FR-RPT-08 · US-LD-10 |
| RES-UC-025 | Tạo project từ service-delivery DV12 | P1 | P1 | Spec ready | FR-PRJ-07 · US-AM-03 |
| RES-UC-026 | Dual-provider triangulation | P1 | P1 | Spec ready | FR-SRC-05 |
| RES-UC-027 | Prefill từ consult/intake | P1 | P1 | Spec ready | FR-PRJ-06 |
| RES-UC-030 | Study survey/IDI + consent | P2 | P2 | Spec ready | FR-STD-01 · US-AN-20 |
| RES-UC-031 | Research Agent pulse | P2 | P2 | Spec ready | FR-CI-04 · US-OPS-20 |
| RES-UC-032 | Exec summary song ngữ | P2 | P2 | Spec ready | FR-RPT-07 |
| RES-UC-033 | Ops KPI analytics | P2 | P2 | Spec ready | FR-INT-03 |
| RES-UC-040 | Portal khách đọc report | P3 | P3 | Spec ready | FR-INT-04 · US-CL-30 |
| RES-UC-041 | Waves tracker | P3 | P3 | Spec ready | FR-PRJ-08 |
| RES-UC-042 | Decision log | P3 | P3 | Spec ready | — |
| RES-UC-050 | Xuất PDF staff + portal | P4 | P4 | Spec ready | FR-RPT-04 · US-CL-30 |
| RES-UC-051 | Cite insight Content OS | P4 | P4 | Spec ready | FR-INT-02 |
| RES-UC-060 | Whisper audio → excerpt + locator | P5 | P5 | Spec ready | FR-STD-02 · FR-STD-03 · NFR-PRI-01/02 |
| RES-UC-061 | SparkToro source candidates | P5 | P5 | Spec ready | FR-CI · BR-RES-09 · BR-RES-11 |
| RES-UC-062 | Import survey codebook CSV | P6 | P6 | Spec ready | FR-STD-01 · BR-RES-02 · BR-RES-11 |
| RES-UC-063 | Van Westendorp lite PRICE_OFFER | P6 | P6 | Spec ready | BR-RES-03 · FR-STD |
| RES-UC-070 | Tìm insight đã duyệt (RAG) | P7 | P7 | Spec ready | FR-INT · BR-RES-06/08/12 · NFR-AI-04 |
| RES-UC-071 | Taxonomy theme + gắn insight | P7 | P7 | Spec ready | BR-RES-06 · UC-071 |
| RES-UC-072 | Inject RAG vào insight copilot | P8 | P8 | Spec ready | FR-AI-03 · BR-RES-06 · UC-011 |

---

## 2. Chi tiết Use Case — P0

### RES-UC-001 — Nav Lên kế hoạch + list project

> 🟢 Spec thủ công · Critical path nav

- **Mã use case:** RES-UC-001
- **Tên use case:** Mở nhóm sidebar Lên kế hoạch và danh sách Research Project
- **Màn hình:** SCR-RES-001 · OpsNav
- **Actor chính:** AM, Analyst, Lead (có `crm_research.view`)
- **Actor phụ:** Staff `crm_board.view` (thấy nhóm vì Marketing plan)
- **Mục tiêu:** Tách PLAN khỏi EXECUTE; vào queue project đúng client
- **Trigger:** Đăng nhập ops-web; click «Nghiên cứu thị trường»
- **Pre-condition:** `NEXT_PUBLIC_MARKET_RESEARCH=1`; JWT hợp lệ
- **Post-condition:** List filter theo staff client scope; marketing-plan không còn trong «Triển khai dịch vụ»
- **Ưu tiên:** P0
- **Trace ref:** EC-RES-01, EC-RES-07, US-NAV-01
- **API:** `GET /api/v1/research/projects`

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | OpsNav render nhóm **Lên kế hoạch** sau «Bán hàng & Hợp đồng» |
| 2 | Link Research + Marketing plan; nhóm Triển khai không chứa marketing-plan |
| 3 | User mở `/crm/research` |
| 4 | API list `client_id IN scope`; table Client, Title, Type, Status, Sẵn sàng, Owner, Updated |
| 5 | User filter client/status/type/q (query string persist) |
| 6 | Click row → `/crm/research/:id?tab=brief` |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Flag off → ẩn Research (RES-UC-013) |
| E2 | Không `crm_research.view` → ẩn link Research; plan vẫn hiện nếu board |
| E3 | Empty list → empty state + CTA Tạo project |
| E4 | `/crm/sales?tab=market` không đổi (EC-RES-07) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | query: client_id, status, product_type, q, page |
| Output | `{ projects[], total }` — không leak project ngoài scope |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-RES-12 | Cross-tenant không trả title |
| FR-NAV-05 | Không merge UI Sales Market BĐS |

---

### RES-UC-002 — Wizard tạo project G0

- **Mã use case:** RES-UC-002
- **Tên use case:** Tạo Research Project (wizard 5 bước)
- **Màn hình:** SCR-RES-002
- **Actor chính:** AM (`crm_research.create`)
- **Actor phụ:** Analyst
- **Mục tiêu:** Ghi brief đúng câu hỏi kinh doanh, không “làm báo cáo ngành”
- **Trigger:** CTA **Tạo project**
- **Pre-condition:** Cap create; client trong scope
- **Post-condition:** Project `status=intake`; ≥1 RQ; audit `created_by`
- **Ưu tiên:** P0
- **Trace ref:** EC-RES-02, US-AM-01, US-AM-02, G0
- **API:** `POST /api/v1/research/projects`

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Bước 1: chọn `client_id`, title (≥8), `dv12_tier` CB/TC/CS |
| 2 | Bước 2: chọn 1 `product_type` (10 cards) |
| 3 | Bước 3: `decision_statement` ≥20 ký tự |
| 4 | Bước 4: geo[] (default VN), languages[] (vi), risk_class |
| 5 | Bước 5: ≥1 `question_vi`; sort_order |
| 6 | Submit 201 → redirect workspace Brief |

#### Luồng thay thế / ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Thiếu client / type / decision <20 / 0 RQ → 400 `validation_error` inline |
| E2 | Client ngoài scope → không hiện trong combobox |
| E3 | Hủy → list, không tạo nháp server (P0 không autosave wizard) |

#### Dữ liệu vào / ra

| Loại | Nội dung |
| --- | --- |
| Input | client_id, title, product_type, dv12_tier, decision_statement, geo, languages, risk_class, questions[] |
| Output | project { id, status: intake } |

#### Quy tắc nghiệp vụ

| Mã rule | Mô tả |
| --- | --- |
| BR-RES-01a | `designed` cần ≥1 RQ (wizard P0 đã bắt ≥1) |

---

### RES-UC-003 — CRUD Research Questions

- **Màn hình:** SCR-RES-003a
- **Actor chính:** AM, Analyst (`edit`)
- **Trigger:** Tab Brief — thêm/sửa/xóa/sắp xếp RQ
- **API:** `POST /projects/:id/questions` · `PATCH/DELETE /questions/:id`
- **Post-condition:** RQ cập nhật; xóa cấm nếu đã có evidence

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Mở Brief; bảng RQ |
| 2 | Thêm dòng `question_vi` |
| 3 | Sửa / kéo sort_order |
| 4 | Xóa RQ chưa có evidence |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | DELETE khi có evidence → 409; tooltip «Đã có evidence — không xóa» |
| E2 | Project `approved`/`distributed` → RQ read-only (sửa = Lead huỷ/version — P0 khóa edit RQ) |

---

### RES-UC-004 — Chạy Desk Tavily

- **Màn hình:** SCR-RES-003b, SCR-RES-007
- **Actor chính:** Analyst (`run`)
- **Mục tiêu:** Source candidates có URL, `ai_generated=true`
- **API:** `POST /projects/:id/run-desk` · poll `GET /projects/:id/jobs/:runId`
- **Worker:** `research_desk_collect`
- **Trace ref:** EC-RES-03, US-AN-01, BR-RES-10, BR-RES-11

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn RQ trên tab Sources |
| 2 | Bấm **Chạy Desk Tavily** |
| 3 | 202 `run_id`; chip pending; credit +1… tới cap 12 |
| 4 | Worker Tavily search+extract; prompt không chứa PII lead |
| 5 | Complete: insert `crm_research_sources` nháp; Activity log |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Thiếu `TAVILY_API_KEY` → run `failed` `tavily_unconfigured`; banner vàng; project không crash |
| E2 | Job cùng question `pending\|running` → 409 `job_in_flight` |
| E3 | Hết credit → 400; UI «Đã dùng 12/12 Tavily» |
| E4 | Timeout/network → failed + Retry (RES-UC-020) |

---

### RES-UC-005 — Chạy Deep Research

- **Màn hình:** SCR-RES-008, SCR-RES-007
- **Actor chính:** Analyst (`run`)
- **Mục tiêu:** Outline + source nháp; **không** tạo Insight published
- **API:** `POST /projects/:id/run-deep`
- **Worker:** `research_deep_research`
- **Trace ref:** EC-RES-09, US-AN-02, BR-RES-06, BR-RES-08

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Bấm **Chạy Deep Research** → modal cảnh báo nguồn nháp |
| 2 | Chọn RQ; xác nhận |
| 3 | Job timeout `RESEARCH_DEEP_TIMEOUT_SEC` (900) |
| 4 | Output sources `ai_generated=true` + outline trong `output_json` |
| 5 | UI: bảng nguồn; **không** card insight mới |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | `RESEARCH_DEEP_PROVIDER=off` → nút ẩn |
| E2 | Timeout → `failed`; không treo worker |
| E3 | Provider error → failed graceful |

---

### RES-UC-006 — Verify source / tạo evidence

- **Màn hình:** SCR-RES-003c, SCR-RES-009
- **Actor chính:** Analyst (`edit`)
- **API:** `POST /projects/:id/evidence` · `POST /evidence/:id/verify`
- **Trace ref:** US-AN-03, BR-RES-02

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Từ source keep=true, **Tạo evidence** |
| 2 | Nhập locator bắt buộc; excerpt **hoặc** value+unit+base; period; geo; pii_class |
| 3 | Lưu `qc_status=pending` |
| 4 | **Verify** → checksum; `verified`; lock nội dung |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Thiếu locator → 400 |
| E2 | Claim số thiếu unit/base/period/geo → 400 BR-RES-02 |
| E3 | Regex gợi ý PII trong excerpt → confirm `pii_class` |

---

### RES-UC-007 — Soạn insight + gắn evidence

- **Màn hình:** SCR-RES-003d, SCR-RES-004
- **Actor chính:** Analyst
- **API:** `POST /projects/:id/insights` · `POST /insights/:id/attach-evidence` · `POST /insights/:id/submit-review`
- **Trace ref:** US-AN-04, BR-RES-01, FR-INS-05

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Tạo insight: statement + observation/interpretation/implication/recommendation |
| 2 | Gắn ≥1 evidence `verified` |
| 3 | Status `evidence_attached` → `analyst_verified` khi submit |
| 4 | `confidence_rationale` bắt buộc trước submit-review |
| 5 | `ai_generated` nếu từ copilot (RES-UC-011) |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Submit 0 evidence → 400 `insight_gate`; dialog |
| E2 | Chỉ gắn evidence `pending` → không tính verified |

---

### RES-UC-008 — Lead duyệt insight

- **Màn hình:** SCR-RES-004, SCR-RES-006
- **Actor chính:** Research Lead (`approve`)
- **API:** `POST /insights/:id/approve`
- **Trace ref:** EC-RES-04, EC-RES-11, US-LD-01, BR-RES-07

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Lead mở insight `analyst_verified` / `peer_reviewed` |
| 2 | Review evidence chips + rationale |
| 3 | Duyệt `approved_internal` + comments |
| 4 | Ghi `crm_research_reviews` + artifact_hash |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Gate fail → dialog messages[] |
| E2 | `reviewer == created_by` → 403 `cannot_self_approve` |
| E3 | Reject → status `rejected` + comments bắt buộc |
| E4 | `risk_class=low` cho phép skip peer (SRS 4.3) |

---

### RES-UC-009 — Sinh report + xuất DOCX

- **Màn hình:** SCR-RES-003e, SCR-RES-005
- **Actor chính:** Analyst (`edit` generate) · AM/Lead (`export`)
- **API:** `POST /projects/:id/reports` · `GET /reports/:id/versions/:versionId/export`
- **Trace ref:** EC-RES-05, US-AN-05, BR-RES-05

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn insight ≥ `approved_internal` |
| 2 | Tạo version: snapshot cover, exec, findings[], recs[], methodology stub, evidence_index |
| 3 | Preview HTML |
| 4 | Xuất DOCX; hash version; audit export |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | 0 insight đủ status → CTA disabled + title |
| E2 | Sửa sau approve → version++ không overwrite |
| E3 | Thiếu cap export → ẩn nút Xuất |

---

### RES-UC-010 — Client tenancy

- **Actor chính:** System + mọi staff
- **Trigger:** Mọi GET/PATCH research
- **Trace ref:** EC-RES-06, BR-RES-12

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Guard: `client_id` project ∈ staff client scope |
| 2 | List tự filter |
| 3 | GET id ngoài scope → **403** body không có title |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | Internal worker key: chỉ job của project đã enqueue |

---

### RES-UC-011 — Copilot insight từ evidence

- **Actor chính:** Analyst (`run`)
- **API / job:** `research_insight_draft`
- **Trace ref:** FR-AI-03, NFR-AI-03, BR-RES-06

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn evidence_ids verified |
| 2 | **Gợi ý insight (Claude)** |
| 3 | Prompt **chỉ** excerpt/value các ID đó — không web thêm |
| 4 | Tạo insight `draft` `ai_generated=true` |
| 5 | Analyst sửa rồi RES-UC-007 |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | 0 evidence → nút disabled |
| E2 | LLM fail → failed run; không insight rỗng |

---

### RES-UC-012 — Copilot report draft

- **Job:** `research_report_draft`
- **Input:** insight_ids `approved_internal+`
- **Output:** `content_snapshot` draft; Analyst/AM edit trước RES-UC-009
- **Cấm:** Deep Research ghi report

---

### RES-UC-013 — Feature flag ẩn module

- **Màn hình:** SCR-RES-010
- **Trigger:** `PTT_MARKET_RESEARCH_ENABLED=0` hoặc FE flag 0
- **Hành vi:** Nav ẩn; API 404 `market_research_disabled`; deep link empty VI
- **Trace ref:** EC-RES-08, NFR-OPS-01

---

### RES-UC-014 — Keep / reject source

- **API:** `PATCH /sources/:id` `{ keep: true\|false }`
- **Luồng:** Analyst tick Keep trên nguồn AI/thủ công; reject ẩn khỏi default filter (filter «Đã bỏ»)
- **Không** xóa row (audit)

---

### RES-UC-015 — Chuyển trạng thái project

- **API:** `PATCH /projects/:id` `{ status, note }`
- **Happy P0:** intake→designed (≥1 RQ)→collecting→synthesizing (≥1 insight analyst_verified+)→drafting→in_review→approved (Lead)→distributed
- **Mọi lúc:** `cancelled` (AM/Lead)
- **E1:** `invalid_transition` 409 + lý do UI
- **Cấm** lùi `approved` — chỉ version report mới

---

### RES-UC-016 — Nhật ký Activity / AI runs

- **Màn hình:** SCR-RES-003f
- **GET workspace** gồm reviews + `crm_research_ai_runs`
- **Hiển thị:** provider, model, prompt_version, credits, status, error
- **Trace ref:** EC-RES-12, NFR-SEC-04 (redact PII trong output log)

---

### RES-UC-017 — Evidence immutable / supersede

- **Trace ref:** EC-RES-10, FR-EVD-02
- **PATCH** excerpt/value/locator/source_id khi `verified` → 409 `evidence_immutable`
- **Supersede:** tạo evidence mới; old `qc_status=superseded`, `superseded_by=new_id`
- **Insight** gắn evidence cũ: banner stale; Analyst gắn ID mới trước duyệt lại

---

### RES-UC-018 — AM duyệt bản khách

- **API:** approve `target_status=approved_client_facing`
- **Pre:** `approved_internal`
- **Actor:** AM (wording) hoặc Lead
- **SoD:** AM không duyệt method nếu là creator phân tích — Lead đã duyệt internal
- **Post:** insight đủ điều kiện vào report khách

---

### RES-UC-019 — Thêm nguồn thủ công

- **API:** `POST /projects/:id/sources`
- **Fields:** type, title, publisher, url, published_at, accessed_at, geo, license, reliability_tier, question_id
- **`ai_generated=false`**
- **URL Ad Library** → `source_type=ad_creative` (P0 cho phép tay)

---

### RES-UC-020 — Poll / retry job AI

- **Poll:** 2s → 5s backoff; max Deep 15 phút
- **Retry:** POST cùng question khi status failed; idempotency key mới nếu input đổi
- **Rời trang:** job tiếp tục; chip hiện lại khi vào Sources/Activity
- **NFR-AI-01:** fail không fail project

---

## 3. Chi tiết Use Case — P1

### RES-UC-021 — Confidence rubric 5 chiều

- **Màn hình:** SCR-RES-022
- **Thay** textarea-only: UI 5 slider (sample / source quality / recency / triangulation / bias)
- **Lưu** `confidence_json`; rationale vẫn bắt buộc
- **BR-RES-03:** UI không hiện chữ “95% confidence” trừ method thống kê

### RES-UC-022 — Competitor + snapshot

- **Màn hình:** SCR-RES-020
- **CRUD** competitor + aliases; snapshot fact JSON **whitelist** + `source_id` bắt buộc
- **Hypothesis** đánh dấu khác fact
- **BR-RES-09:** Similarweb/Semrush `reliability_tier≤medium` + limitation note

### RES-UC-023 — Chèn insight vào marketing-plan

- **Màn hình:** SCR-RES-021
- **Chỉ** insert `insight_id` (không copy text)
- **Cùng** `client_id`; insight `approved_client_facing` hoặc `approved_internal` (chốt P1: internal+ cho plan nội bộ)
- **Plan không** edit insight gốc

### RES-UC-024 — Methodology appendix bắt buộc TC/CS

- **Export** TC/CS blocked nếu methodology snapshot thiếu population/source plan/limitation
- **CB P0** stub đủ EC-RES-05; P1 siết TC/CS

### RES-UC-025 — Tạo từ service-delivery DV12

- **CTA** trên lifecycle slug `phan-tich-thi-truong`
- **Prefill** client_id, lifecycle_id, title
- **US-AM-03**

### RES-UC-026 — Dual-provider triangulation

- **Chạy** 2 Deep provider trên RQ trọng
- **Keep** URL xuất hiện ≥1 lần **hoặc** Lead accept single-source cap Medium

### RES-UC-027 — Prefill consult/intake

- **Wizard** bước 1: nếu client có consult — industry, competitors gợi ý RQ
- **User confirm** từng dòng

---

## 4. Chi tiết Use Case — P2–P5

### RES-UC-030 — Study survey/IDI + consent

- Study: method, n, field_dates, mode, instrument_version
- Evidence `study_id` + transcript locator
- Consent record tách PII; retention 24 tháng
- P0 **không** lưu transcript thô

### RES-UC-031 — Research Agent pulse

- Cron watchlist competitor/trend
- Alert Ops; **không** auto insight published

### RES-UC-032 — Exec summary song ngữ

- Block EN trên report; Lead duyệt bản dịch LLM

### RES-UC-033 — Ops KPI analytics

- `GET /analytics/ops`: cycle time, evidence completeness, activation
- Màn SCR-RES-031

### RES-UC-040 — Portal khách đọc report

- RLS client; watermark; expiry; read-only
- **Cấm** auto-publish chưa duyệt

### RES-UC-041 — Waves tracker

- Project `TRACKER` + wave dates; compare snapshot

### RES-UC-042 — Decision log

- G9: action owner sau readout; link insight_id

### RES-UC-050 — Xuất PDF staff + portal

- Staff `GET …/export?format=pdf` → `%PDF-`; default/docx vẫn DOCX
- Portal `GET …/reports/:versionId/export.pdf` watermark; Beta 403 không title

### RES-UC-051 — Cite insight Content OS

- `POST /content-items/:itemId/insights` freeze `insight_ids`; không copy statement
- PATCH brief strip inbound `market_research`; giữ cite cũ

### RES-UC-060 — Whisper audio → excerpt + locator

- `POST /api/v1/research/projects/:id/studies/:studyId/whisper` multipart `file`; cap `run`
- Consent còn hạn bắt buộc; thiếu / hết hạn → 400 `consent_required` / `consent_expired`
- Evidence `excerpt` ≤ 500 + locator `T-mm:ss`; excerpt > 500 → 400 `raw_transcript_forbidden`
- Không persist transcript thô / `audio_uri`; complete payload = `excerpt_ids` only
- MIME `audio/mpeg|audio/wav|audio/mp4|audio/x-m4a`; ≤ 25 MB; xóa file tạm trong `finally`

### RES-UC-061 — SparkToro source candidates

- `POST /api/v1/research/projects/:id/run-sparktoro` body `{ question_id }`; cap `run`
- Query = `question_vi` + geo only (BR-RES-11); PII → 400
- Sources `publisher=SparkToro`, `reliability_tier` ∈ {low, medium} + `limitation_note`; tier `high` → 400 `reliability_capped`
- Flag/key off → `200 {ok:true, note:sparktoro_disabled}`; `GET /health` `sparktoro_enabled` false → ẩn CTA
- Flag+key on (P9): HTTP live `POST /v3/describe/create` + `GET /v3/websites` → sources; ghi `credits_used` + `report_id` trên run
- **Cấm** `createInsight` / `createReport` / publish-portal từ job này

### RES-UC-062 — Import survey codebook CSV

- `POST /api/v1/research/projects/:id/import-survey` multipart `file` + `format=codebook|vw`; cap `edit`
- Codebook → study survey + evidence `value+unit+base` (+ period/geo); PII cell → 400 `survey_pii_forbidden` (0 evidence)
- Thiếu value/unit/base → 400 (BR-RES-02); ExpertReview = source note, không auto-insight
- Fixture: `scripts/fixtures/research-codebook.sample.csv` (2–4 hàng, không PII)
- **Cấm** `createInsight` / `createReport` / publish-portal / `xlsx`

### RES-UC-063 — Van Westendorp lite PRICE_OFFER

- `GET /api/v1/research/projects/:id/van-westendorp` cap `view` → `{ summary }`
- `POST /api/v1/research/projects/:id/van-westendorp` body `{ study_id? }` cap `edit`
- Không `PRICE_OFFER` → 400 `vw_not_price_offer`; n < 4 → 400 `vw_insufficient_n`
- Bảng too_cheap / cheap / expensive / too_expensive + `limitation_note`; không MOE / 95%
- Fixture VW: `scripts/fixtures/research-vw.sample.csv` (4 respondents)
- **Cấm** `createInsight` / market simulator / conjoint

### RES-UC-062/063 — Qualtrics stub (không live)

- `POST /api/v1/research/projects/:id/run-qualtrics` cap `run`
- Flag/key off (default) → `200 {ok:true, note:qualtrics_disabled}`; flag+key on vẫn stub (không enqueue, không HTTP Qualtrics)
- `GET /health` `qualtrics_enabled` = flag **và** key; không trả `QUALTRICS_API_KEY`
- FE: ẩn CTA trừ khi `shouldShowQualtricsButton(qualtrics_enabled, canRun)`

### RES-UC-070 — Tìm insight đã duyệt (RAG)

- `GET /api/v1/research/insights/search?q=&theme_code=&client_id=&limit=` cap `view`
- Flag off → `200 {hits:[], note:rag_disabled}`; ô tìm ẩn khi `shouldShowRagSearch` false
- Empty q → 400 `rag_query_required`; draft / chưa duyệt bản khách không hit
- PII skip embed (`shouldSkipRagEmbed`); approve vẫn 200
- Cross-tenant → 403 `{error:forbidden}` không `statement`
- Banner: `Chỉ insight đã duyệt bản khách / published. Không tìm draft. Không tự tạo insight.`
- **Cấm** `createInsight` / `createResearchInsight` từ search; không portal RAG; không OpenAI embeddings

### RES-UC-071 — Taxonomy theme + gắn insight

- `GET /api/v1/research/taxonomy` cap `view` → seed PRICE…GEO
- `POST /api/v1/research/taxonomy` · `PATCH /taxonomy/:id` cap `configure`; thiếu configure → 403
- `POST /insights/:id/themes` · `DELETE /insights/:id/themes/:taxonomyId` cap `edit`
- Attach trả insight **cùng** `statement` (không sửa nội dung)
- Trang `/crm/research/taxonomy` ẩn trừ `hasCap(configure)`; banner `Gắn theme — không sửa nội dung insight.`
- Search `theme_code` lọc code hoặc synonym (case-insensitive)
- **Cấm** `createInsight` trên path attach; không conjoint

### RES-UC-072 — Inject RAG vào insight copilot

- **Actor chính:** Analyst (`run`)
- **API / job:** `POST /api/v1/research/projects/:id/insights/copilot` (`research_insight_draft`)
- **Trace ref:** FR-AI-03, NFR-AI-03, BR-RES-06, RES-UC-011
- **Tham chiếu:** corpus đã duyệt (cùng client)

#### Luồng chính

| Bước | Mô tả |
| --- | --- |
| 1 | Chọn evidence_ids verified |
| 2 | **Gợi ý insight (Claude)** — tham chiếu corpus đã duyệt cùng khách khi flag on |
| 3 | Prompt **chỉ** excerpt/value các ID đó + rag_hits corpus đã duyệt — không web thêm |
| 4 | Tạo insight `draft` `ai_generated=true` (`createInsight` ×1) |
| 5 | Analyst sửa rồi RES-UC-007 |

#### Ngoại lệ

| Mã | Mô tả |
| --- | --- |
| E1 | 0 evidence → nút disabled |
| E2 | LLM fail → failed run; không insight rỗng |
| E3 | Flag off → `rag_note=rag_disabled` + prompt P0 (không banner) |
| E4 | PII query → `rag_skipped_pii`; vẫn 1 draft |

---

## 5. API map

| Method | Path | UC |
| --- | --- | --- |
| GET | `/api/v1/research/projects` | 001, 010 |
| POST | `/projects` | 002 |
| GET/PATCH | `/projects/:id` | 001, 015 |
| POST | `/projects/:id/questions` | 003 |
| PATCH/DELETE | `/questions/:id` | 003 |
| POST | `/projects/:id/sources` | 019 |
| PATCH | `/sources/:id` | 014 |
| POST | `/projects/:id/run-desk` | 004 |
| POST | `/projects/:id/run-deep` | 005 |
| POST | `/projects/:id/studies/:studyId/whisper` | 060 |
| POST | `/projects/:id/run-sparktoro` | 061 |
| POST | `/projects/:id/import-survey` | 062 |
| GET/POST | `/projects/:id/van-westendorp` | 063 |
| POST | `/projects/:id/run-qualtrics` | 062 |
| GET | `/insights/search` | 070 |
| GET | `/taxonomy` | 071 |
| POST | `/taxonomy` | 071 |
| PATCH | `/taxonomy/:id` | 071 |
| POST | `/insights/:id/themes` | 071 |
| DELETE | `/insights/:id/themes/:taxonomyId` | 071 |
| GET | `/projects/:id/jobs/:runId` | 020 |
| POST | `/projects/:id/evidence` | 006 |
| POST | `/evidence/:id/verify` | 006 |
| POST | `/projects/:id/insights` | 007 |
| POST | `/projects/:id/insights/copilot` | 011, 072 |
| POST | `/insights/:id/attach-evidence` | 007 |
| POST | `/insights/:id/submit-review` | 007 |
| POST | `/insights/:id/approve` | 008, 018 |
| POST | `/projects/:id/reports` | 009, 012 |
| GET | `/reports/:id/versions/:versionId/export` | 009 |
| GET | `/reports/:id/versions/:versionId/export?format=pdf` | 050 |
| GET | `/api/v1/portal/research/reports/:versionId/export.pdf` | 050 |
| POST | `/content-items/:itemId/insights` | 051 |
| POST | `/internal/research/jobs/:id/complete` | 004, 005, 011, 012 |
| GET | `/analytics/ops` | 033 |

**Guards:** `StaffOrInternalKeyGuard` + `crm_research.view|create|edit|run|approve|export|configure`  
**Flag off:** 404 `market_research_disabled`

---

## 6. Entity map (DDL)

| Table | UC chính |
| --- | --- |
| `crm_research_projects` | 002, 015 |
| `crm_research_questions` | 003 |
| `crm_research_sources` | 004, 005, 014, 019, 061 |
| `crm_research_evidence` | 006, 017 |
| `crm_research_insights` | 007, 008, 018 |
| `crm_research_insight_evidence` | 007 |
| `crm_research_reviews` | 008, 018 |
| `crm_research_reports` | 009 |
| `crm_research_report_versions` | 009, 012 |
| `crm_research_ai_runs` | 004, 005, 011, 012, 016, 020, 060, 061 |
| `crm_research_competitors` (P1) | 022 |
| `crm_research_studies` (P2) | 030, 060 |
| `crm_research_insight_embeddings` (P7) | 070 |
| `crm_research_taxonomy` (P7) | 071 |
| `crm_research_insight_themes` (P7) | 071 |

---

## 7. Business rules (module)

Toàn bộ BR-RES-01…13 trong SRS Phụ lục B. UI **bắt buộc** surface BR-RES-01, 05, 06, 07, 08, 12.

---

## 8. Traceability P0 acceptance

| EC | UC |
| --- | --- |
| EC-RES-01 | 001 |
| EC-RES-02 | 002, 003 |
| EC-RES-03 | 004 |
| EC-RES-04 | 007, 008 |
| EC-RES-05 | 009 |
| EC-RES-06 | 010 |
| EC-RES-07 | 001 |
| EC-RES-08 | 013 |
| EC-RES-09 | 005 |
| EC-RES-10 | 017 |
| EC-RES-11 | 008 |
| EC-RES-12 | 016 |

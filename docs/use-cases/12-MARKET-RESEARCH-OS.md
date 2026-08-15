# Use Case — Market Research OS (MarketResearchModule)

> **Prefix:** RES · **Phiên bản:** 1.0 · **Ngày:** 2026-08-14  
> **Index:** [`README.md`](README.md)  
> **Design:** [`../superpowers/specs/2026-08-14-market-research-os-design.md`](../superpowers/specs/2026-08-14-market-research-os-design.md)  
> **SRS:** [`../specs/2026-08-14-market-research-os-srs.md`](../specs/2026-08-14-market-research-os-srs.md)  
> **UX/UI:** [`../specs/2026-08-14-market-research-os-ui-ux.md`](../specs/2026-08-14-market-research-os-ui-ux.md)  
> **BA module:** [`../specs/modules/RNOSAI-BA-RES-UseCases.md`](../specs/modules/RNOSAI-BA-RES-UseCases.md)  
> **Actions:** [`actions/12-RES-ACTIONS.md`](actions/12-RES-ACTIONS.md)  
> **Parent DV:** DV12 Báo cáo phân tích thị trường · **Không** trộn [CRM Sales Market BĐS](01-CRM-CORE.md)

---

## Ma trận traceability

| Spec / Deliverable | UC | Phase |
|--------------------|-----|-------|
| Nav «Lên kế hoạch» | RES-UC-001, 013 | P0 |
| G0 wizard + RQ | RES-UC-002, 003 | P0 |
| G3 Desk Tavily | RES-UC-004, 014, 019, 020 | P0 |
| G3 Deep Research | RES-UC-005 | P0 |
| G4 Evidence | RES-UC-006, 017 | P0 |
| G6 Insight + gate | RES-UC-007, 008, 011, 018 | P0 |
| G7–G8 Report DOCX | RES-UC-009, 012 | P0 |
| Tenancy + flag + audit | RES-UC-010, 013, 016 | P0 |
| Project state | RES-UC-015 | P0 |
| Rubric / CI / plan insert / DV12 | RES-UC-021…027 | P1 |
| Studies / agent / bilingual / KPI | RES-UC-030…033 | P2 |
| Portal / waves / decision | RES-UC-040…042 | P3 |
| PDF + Content OS cite | RES-UC-050…051 | P4 |
| Whisper excerpts + SparkToro sources | RES-UC-060…061 | P5 |
| Codebook import + Van Westendorp lite | RES-UC-062…063 | P6 |
| RAG search + taxonomy | RES-UC-070…071 | P7 |
| RAG copilot inject | RES-UC-072 | P8 |
| EC-RES-01…12 | Actions walkthrough | P0 |

**API base:** `/api/v1/research`  
**UI primary:** `/crm/research` · `/crm/research/new` · `/crm/research/[id]` · `/crm/research/taxonomy`

---

## Phạm vi phase

| Phase | UC | Priority | Trạng thái |
|-------|-----|----------|------------|
| **P0 — Foundation** | RES-UC-001…020 | P0 | Spec ready — chưa code |
| **P1 — Pilot ops** | RES-UC-021…027 | P1 | Spec ready |
| **P2 — Integrate** | RES-UC-030…033 | P2 | Spec ready |
| **P3 — Client-grade** | RES-UC-040…042 | P3 | Spec ready |
| **P4 — Deliverable + activation** | RES-UC-050…051 | P4 | Spec ready |
| **P5 — Qual ingest + audience source** | RES-UC-060…061 | P5 | Spec ready |
| **P6 — Survey codebook + VW lite** | RES-UC-062…063 | P6 | Spec ready |
| **P7 — RAG search + taxonomy** | RES-UC-070…071 | P7 | Spec ready |
| **P8 — Copilot RAG inject** | RES-UC-072 | P8 | Spec ready |

---

## Business rules (module)

| Mã | Mô tả |
|----|--------|
| **BR-RES-01** | Không evidence verified → không `approved_*` / `published` |
| **BR-RES-01a** | `designed` cần ≥1 RQ |
| **BR-RES-02** | Claim định lượng: value+unit+base+period+geo+source |
| **BR-RES-03** | Cấm “95% confidence” trừ inference thống kê |
| **BR-RES-04** | Cấm suy mentions = population |
| **BR-RES-05** | Sửa report đã approve = version mới |
| **BR-RES-06** | AI draft ≠ published |
| **BR-RES-07** | Không tự approve object mình tạo |
| **BR-RES-08** | Deep Research output = source candidates only |
| **BR-RES-09** | Similarweb/Semrush ≤ medium + limitation (P1) |
| **BR-RES-10** | Tavily credits / project ≤ env cap |
| **BR-RES-11** | Prompt không chứa PII lead |
| **BR-RES-12** | Cross-tenant 403, không trả title |
| **BR-RES-13** | GDKD assign ≠ method approve |

---

## Luồng end-to-end P0

```mermaid
sequenceDiagram
  actor AM
  actor AN as Analyst
  actor LD as Research Lead
  participant UI as ops-web
  participant API as ptt-crm-api
  participant W as ptt-worker

  AM->>UI: Wizard G0
  UI->>API: POST /projects
  API-->>AM: intake + RQ
  AN->>UI: Chạy Desk / Deep
  UI->>API: POST run-desk / run-deep
  API->>W: enqueue
  W-->>API: sources nháp
  AN->>API: keep + evidence + verify
  AN->>API: POST insights + attach + submit-review
  LD->>API: POST approve (không self)
  AN->>API: POST reports + export DOCX
```

---

## RES-UC-001 — Nav Lên kế hoạch + list

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | AM, Analyst, Lead |
| **Priority** | P0 |
| **Trigger** | Sidebar **Nghiên cứu thị trường** |
| **Screens** | SCR-RES-001, OpsNav |

**Preconditions:** `NEXT_PUBLIC_MARKET_RESEARCH=1`; `crm_research.view` (link Research) và/hoặc `crm_board.view` (nhóm vì Marketing plan).

**Main flow:**

1. Nhóm **Lên kế hoạch** = Research + Marketing plan, đặt trước **Triển khai dịch vụ**.
2. «Kế hoạch marketing» **không** còn trong nhóm Triển khai.
3. List project scoped theo client; cột Sẵn sàng evidence.
4. Click row → workspace.

**Extensions:** E1 flag off → RES-UC-013. E2 không cap research → ẩn link. E3 empty CTA. E4 Sales Market BĐS nguyên.

**Postconditions:** User ở đúng IA PLAN vs EXECUTE.

**Trace:** EC-RES-01, EC-RES-07.

---

## RES-UC-002 — Wizard tạo project G0

| Thuộc tính | Giá trị |
|------------|---------|
| **Actor chính** | AM (`create`) |
| **Trigger** | **Tạo project** |
| **Screens** | SCR-RES-002 |

**Preconditions:** Client trong staff scope.

**Main flow:**

1. Khách hàng + title + DV12 tier.  
2. Một `product_type` (10 cards).  
3. Decision ≥20 ký tự.  
4. Geo / language / risk.  
5. ≥1 RQ.  
6. `POST /projects` → `intake` → Brief.

**Extensions:** E1 validation 400 inline. E2 client ngoài scope không hiện. E3 Hủy không persist.

**Postconditions:** Audit created_by; có RQ.

**Trace:** EC-RES-02, US-AM-01, G0.

---

## RES-UC-003 — CRUD Research Questions

**Trigger:** Tab Brief. **API:** questions CRUD.  
**Main:** thêm/sửa/sort.  
**E1:** không xóa RQ đã có evidence. **E2:** project approved → RQ khóa.  
**Trace:** US-AM-02, BR-RES-01a.

---

## RES-UC-004 — Desk Tavily

**Actor:** Analyst (`run`). **Job:** `research_desk_collect`.

**Main:** chọn RQ → Chạy Desk → 202 → poll → sources `ai_generated`. Credit ≤12. Prompt cấm PII.

**E1:** no Tavily key → `tavily_unconfigured` vàng, không 500.  
**E2:** `job_in_flight` 409.  
**E3:** hết credit.  
**E4:** retry RES-UC-020.

**Trace:** EC-RES-03, BR-RES-10, BR-RES-11.

---

## RES-UC-005 — Deep Research

**Modal cảnh báo:** chỉ nguồn nháp + dàn ý; không tạo insight.

**Main:** 1 provider (`RESEARCH_DEEP_PROVIDER`); timeout 900s; sources nháp.

**E1:** provider `off` → ẩn nút. **E2:** timeout failed.  

**Cấm:** set insight `published`. **Trace:** EC-RES-09, BR-RES-08.

---

## RES-UC-006 — Verify source / evidence

**Main:** locator bắt buộc; excerpt hoặc value+unit+base; verify → checksum lock.

**E1:** thiếu locator. **E2:** số thiếu unit/base/period/geo (BR-RES-02). **E3:** PII regex → class.

**Trace:** US-AN-03.

---

## RES-UC-007 — Soạn insight

**Main:** 4 khối what–why–so what–now what; gắn evidence verified; rationale; submit-review.

**E1:** 0 verified → `insight_gate` dialog. **E2:** pending evidence không tính.

**Trace:** BR-RES-01, US-AN-04.

---

## RES-UC-008 — Lead duyệt insight

**Main:** `approved_internal` + review row + hash.

**E1:** gate dialog. **E2:** self-approve 403. **E3:** reject + comment. **E4:** skip peer nếu risk low.

**Trace:** EC-RES-04, EC-RES-11, BR-RES-07.

---

## RES-UC-009 — Report + DOCX

**Main:** insight `approved_internal+` → snapshot blocks (cover, exec, findings/RQ, recs, methodology stub, evidence index) → preview → DOCX.

**E1:** 0 insight. **E2:** sửa = version mới. **E3:** ẩn export nếu thiếu cap.

**Trace:** EC-RES-05, BR-RES-05.

---

## RES-UC-010 — Tenancy

Mọi query `client_id IN scope`. Ngoài scope **403 không title**. **Trace:** EC-RES-06, BR-RES-12.

---

## RES-UC-011 — Copilot insight (Claude)

Prompt **chỉ** `evidence_ids` đã chọn (G6 retrieval-only). Output draft `ai_generated`. Analyst edit. **Trace:** NFR-AI-03, BR-RES-06.

---

## RES-UC-012 — Copilot report draft

Từ insight đã duyệt → `content_snapshot` draft. Không Deep Research viết report.

---

## RES-UC-013 — Feature flag

API 404 `market_research_disabled`; nav ẩn; deep link empty VI. **Trace:** EC-RES-08.

---

## RES-UC-014 — Keep / reject source

PATCH `keep`; không xóa row. Filter «Đã bỏ».

---

## RES-UC-015 — State machine project

`intake → designed (≥1 RQ) → collecting → synthesizing (≥1 insight verified+) → drafting → in_review → approved → distributed`. Cancel mọi lúc. Không lùi approved. **E1:** `invalid_transition` 409.

---

## RES-UC-016 — Activity / AI runs

Timeline reviews + runs (provider, model, prompt_version, credits). Redact PII. **Trace:** EC-RES-12.

---

## RES-UC-017 — Evidence supersede

Verified immutable (409). Tạo evidence mới; old `superseded`. **Trace:** EC-RES-10.

---

## RES-UC-018 — AM duyệt bản khách

`approved_internal` → `approved_client_facing` (wording). Method vẫn do Lead. **Trace:** FR-REV-03, BR-RES-13.

---

## RES-UC-019 — Nguồn thủ công

POST source; `ai_generated=false`; Ad Library = `ad_creative`.

---

## RES-UC-020 — Poll / retry

Backoff poll; retry failed; rời trang job tiếp. Fail ≠ fail project.

---

## P1 — RES-UC-021…027

| UC | Tóm tắt |
|----|---------|
| 021 | Rubric 5 chiều + cấm copy “95%” |
| 022 | Competitor master + snapshot fact/hypothesis + source_id |
| 023 | Marketing-plan chèn `insight_id` cùng client |
| 024 | Methodology bắt buộc trước export TC/CS |
| 025 | CTA từ lifecycle DV12 prefill |
| 026 | Hai provider Deep; URL giao hoặc Lead accept medium |
| 027 | Prefill industry/competitors từ consult |

---

## P2 — RES-UC-030…033

| UC | Tóm tắt |
|----|---------|
| 030 | Study + transcript locator + consent tách PII |
| 031 | Agent pulse → Ops alert, không auto-publish |
| 032 | Exec EN + Lead duyệt dịch |
| 033 | `GET /analytics/ops` cycle time / completeness |

---

## P3 — RES-UC-040…042

| UC | Tóm tắt |
|----|---------|
| 040 | Portal read-only + watermark + expiry |
| 041 | Waves trên TRACKER |
| 042 | Decision log G9 |

---

## P4 — RES-UC-050…051

| UC | Tóm tắt |
|----|---------|
| 050 | Staff + portal PDF (DOCX không regress) |
| 051 | Cite insight_id vào Content OS |

---

## P5 — RES-UC-060…061

| UC | Tóm tắt |
|----|---------|
| 060 | Upload audio IDI/FGD → evidence excerpt ≤ 500 + locator `T-mm:ss` (consent bắt buộc; không persist transcript thô) |
| 061 | Chạy SparkToro → source candidates audience/overlap (tier low/medium + limitation; không auto-insight; flag mặc định tắt) |

**API:** `POST /api/v1/research/projects/:id/studies/:studyId/whisper` · `POST /api/v1/research/projects/:id/run-sparktoro`  
**Gates:** thiếu consent → 400 `consent_required` / `consent_expired`; excerpt > 500 → 400 `raw_transcript_forbidden`; paid tier `high` → 400 `reliability_capped`. SparkToro off → `sparktoro_disabled` (project không fail). Không `createInsight`.  
**UAT:** [`actions/12-RES-ACTIONS.md`](actions/12-RES-ACTIONS.md) Walkthrough UAT P5.

---

## P6 — RES-UC-062…063

| UC | Tóm tắt |
|----|---------|
| 062 | Nhập CSV codebook (Forms) → study survey + evidence `value+unit+base` (không PII; không auto-insight; Qualtrics live out) |
| 063 | Van Westendorp lite trên `PRICE_OFFER` → bảng too_cheap…too_expensive + limitation; không MOE/95%; không insight |

**API:** `POST /api/v1/research/projects/:id/import-survey` · `GET|POST /api/v1/research/projects/:id/van-westendorp` · `POST /api/v1/research/projects/:id/run-qualtrics`  
**Gates:** PII cell → 400 `survey_pii_forbidden`; thiếu value+unit+base → 400 (BR-RES-02); không `PRICE_OFFER` → 400 `vw_not_price_offer`. Qualtrics off → `200 {ok:true, note:qualtrics_disabled}` (project không fail; CTA ẩn khi `qualtrics_enabled !== true`). Không `createInsight`.  
**UAT:** [`actions/12-RES-ACTIONS.md`](actions/12-RES-ACTIONS.md) Walkthrough UAT P6.

---

## P7 — RES-UC-070…071

| UC | Tóm tắt |
|----|---------|
| 070 | Tìm insight đã duyệt bản khách / published (RAG local). Ẩn ô khi flag off. Không draft. Không tự tạo insight. |
| 071 | CRUD taxonomy (configure) + gắn theme vào insight (edit). Statement không đổi. |

**API:** `GET /api/v1/research/insights/search` · `GET|POST /api/v1/research/taxonomy` · `PATCH /api/v1/research/taxonomy/:id` · `POST|DELETE /api/v1/research/insights/:id/themes`  
**Gates:** draft không hit; PII skip embed; 403 không `statement`; flag off → `{hits:[], note:rag_disabled}`; attach không đổi statement; không `createInsight`.  
**UAT:** [`actions/12-RES-ACTIONS.md`](actions/12-RES-ACTIONS.md) Walkthrough UAT P7.

---

## P8 — RES-UC-072

| UC | Tóm tắt |
|----|---------|
| 072 | Inject RAG vào insight copilot (cùng client). Flag off = P0. 1 draft. Không tự duyệt. |

**API:** `POST /api/v1/research/projects/:id/insights/copilot` (giữ) — response thêm `rag_hits`, `rag_note?`
**Gates:** flag off → `rag_disabled` + prompt P0; PII query → `rag_skipped_pii`; draft không trong prior; `createInsight` ×1.

---

## P12 — RES-UC-073

| UC | Tóm tắt |
|----|---------|
| 073 | Portal tìm insight **published** cùng `client_id` JWT. Flag off → ô ẩn. Không draft/ACF. Không createInsight. |

**API:** `GET /api/v1/portal/research/insights/search` · `GET /api/v1/portal/research/health`  
**Gates:** corpus `published` only; 403/0 hit cross-tenant không leak `statement`; PII → `rag_skipped_pii`; FE không link `/crm/research`.  
**UAT:** [`actions/12-RES-ACTIONS.md`](actions/12-RES-ACTIONS.md) Walkthrough UAT P12.

---

## Guards & flags

| Biến / cap | Hành vi |
|------------|---------|
| `PTT_MARKET_RESEARCH_ENABLED` | API |
| `NEXT_PUBLIC_MARKET_RESEARCH` | Nav |
| `crm_research.*` | view/create/edit/run/approve/export/configure |
| `MAX_TAVILY_CREDITS_PER_RESEARCH` | default 12 |
| `RESEARCH_DEEP_PROVIDER` | openai \| gemini \| off |
| `RESEARCH_QUALTRICS_ENABLED` | default `0` — stub only; không bật deploy |
| `QUALTRICS_API_KEY` | không log / không trả health / không ghi deploy |
| `RESEARCH_RAG_ENABLED` | default `0` — không bật trong deploy prod; staging only sau PO |
| `RESEARCH_SPARKTORO_ENABLED` | default `0` — không bật deploy |

GDKD `crm_leads.assign` **không** hiện Approve insight.

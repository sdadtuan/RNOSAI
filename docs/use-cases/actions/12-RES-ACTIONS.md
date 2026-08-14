# Chi tiết hành động — Market Research OS (RES)

> **UC gốc:** [`../12-MARKET-RESEARCH-OS.md`](../12-MARKET-RESEARCH-OS.md)  
> **BA:** [`../../specs/modules/RNOSAI-BA-RES-UseCases.md`](../../specs/modules/RNOSAI-BA-RES-UseCases.md)  
> **UX:** [`../../specs/2026-08-14-market-research-os-ui-ux.md`](../../specs/2026-08-14-market-research-os-ui-ux.md)  
> **SRS:** [`../../specs/2026-08-14-market-research-os-srs.md`](../../specs/2026-08-14-market-research-os-srs.md)  
> **Phiên bản:** 1.0 · **Coverage:** RES-UC-001…020 (P0 UAT) + walkthrough P1–P5 (UAT 060–061) + backlog P6+

---

## Walkthrough UAT — Happy path G0 → DOCX (≈40 phút)

**Mục tiêu khách hàng:** *«AM brief 1 quyết định → Analyst desk + evidence → Lead duyệt insight → xuất DOCX CB.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), QA

**Dữ liệu test:** Client `acme` trong scope AM+AN+LD · Client `beta` chỉ user khác (tenancy) · Flag research = 1 · Tavily key **có** trên staging (hoặc chạy nhánh E-Tavily)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | `/login` | Đăng nhập cap `crm_research.create` | credentials | JWT | ✓ flag on |
| 2 | AM | OpsNav | Thấy nhóm **Lên kế hoạch** | — | Research + Marketing plan | ✓ RES-UC-001 · EC-RES-01 |
| 3 | AM | Nav Triển khai | Xác nhận **không** còn «Kế hoạch marketing» | — | Plan chỉ ở Lên kế hoạch | ✓ |
| 4 | AM | `/crm/sales?tab=market` | Regression NCTT BĐS | — | Tab Market BĐS nguyên | ✓ EC-RES-07 |
| 5 | AM | `/crm/research` | **Tạo project** | — | Wizard | ✓ |
| 6 | AM | Wizard 1 | Client Acme, title, tier **CB** | Acme / Sữa uống 2026 | Valid | ✓ |
| 7 | AM | Wizard 2 | Card **Category review** | CAT_REVIEW | Selected | ✓ |
| 8 | AM | Wizard 3 | Decision ≥20 ký tự | *Quyết định có mở SKU premium Q4 tại MT HCM hay không.* | Counter OK | ✓ RES-UC-002 |
| 9 | AM | Wizard 4 | Geo VN, language vi, risk medium | — | Chips | ✓ |
| 10 | AM | Wizard 5 | 1 RQ | *Quy mô thị trường sữa uống VN 2025–26?* | ≥1 dòng | ✓ RES-UC-003 |
| 11 | AM | Submit | **Tạo dự án** | — | Redirect `tab=brief` status Tiếp nhận | ✓ EC-RES-02 |
| 12 | AN | Brief | **Đổi trạng thái → Thiết kế** rồi **Thu thập** | — | Status collecting | ✓ RES-UC-015 |
| 13 | AN | Sources | RQ Q1 · **Chạy Desk Tavily** | question_id | Chip job · 202 | ✓ RES-UC-004 |
| 14 | AN | Same | Đợi job succeeded | — | ≥1 source AI | ✓ EC-RES-03 |
| 15 | AN | Same | Tick **Keep** nguồn tin cậy | keep=true | PATCH | ✓ RES-UC-014 |
| 16 | AN | Evidence | **Tạo evidence** từ source | locator + excerpt hoặc value+unit | EV-xx pending | ✓ RES-UC-006 |
| 17 | AN | Same | **Verify** ≥5 nguồn / ≥5 evidence (pilot A tối thiểu 1 P0 UAT; staging 1+) | — | Lock icon | ✓ |
| 18 | AN | Insights | **+ Insight** gắn EV verified + rationale | statement 4 khối | draft → evidence_attached | ✓ RES-UC-007 |
| 19 | AN | Same | **Gửi Lead duyệt** | — | analyst_verified | ✓ |
| 20 | LD | Insight drawer | **Duyệt nội bộ** (user ≠ creator) | comments | `approved_internal` | ✓ RES-UC-008 · EC-RES-04 · EC-RES-11 |
| 21 | AM | Same | **Duyệt bản khách** | — | `approved_client_facing` | ○ RES-UC-018 |
| 22 | AN | Report | Tick insight · **Tạo bản báo cáo** | — | version v1 | ✓ RES-UC-009 |
| 23 | AN | Preview | Kiểm appendix + evidence index | — | Blocks đủ | ✓ EC-RES-05 |
| 24 | AM | Same | **Xuất DOCX** | cap export | Download | ✓ |
| 25 | QA | User client Beta | GET `/projects/{acmeId}` | token beta | 403 không title | ✓ RES-UC-010 · EC-RES-06 |
| 26 | QA | Activity | `crm_research_ai_runs` desk row | SQL/UI | logged | ✓ EC-RES-12 |
| 27 | QA | Flag 0 (staging copy) | Nav ẩn + API 404 | — | empty VI | ✓ RES-UC-013 · EC-RES-08 |

#### Nhánh E-Tavily — không key

Bước 13: job `failed` `tavily_unconfigured` · banner vàng · project vẫn mở · AN thêm nguồn thủ công (RES-UC-019) rồi tiếp bước 16.

#### Nhánh E-Deep

Sau bước 14: **Chạy Deep Research** → modal cảnh báo → sources nháp thêm · **không** insight mới (EC-RES-09).

#### Nhánh E-Gate

Bước 20 với 0 evidence: dialog «Thiếu evidence đã verify» · không đổi status.

#### Nhánh E-SoD

AN tự bấm Duyệt nội bộ: 403 / banner người tạo không tự duyệt.

#### Nhánh E-Immutable

PATCH excerpt evidence verified: 409 · phải supersede (RES-UC-017).

#### Tiêu chí nghiệm thu walkthrough

- [ ] Bước 1–27 pass staging (hoặc E-Tavily + thủ công)
- [ ] DOCX có cover, exec, findings, recs, methodology stub, evidence index
- [ ] Nav Lên kế hoạch đúng
- [ ] PO / Research Lead sign EC-RES-01…12

---

## RES-UC-001 — Nav + list

**Mục tiêu:** *«Vào đúng nhóm PLAN, thấy queue project.»*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Sidebar | Mở **Lên kế hoạch** | — | 2 link | ✓ |
| 2 | AM | `/crm/research` | Filter Client / Status / Type | Acme | Query persist | ✓ |
| 3 | AM | Row | Click tiêu đề | — | Workspace Brief | ✓ |
| 4 | AM | Empty (env sạch) | Đọc empty + CTA | — | Tạo project | ○ |

#### Tiêu chí nghiệm thu
- [ ] Marketing plan không nằm Triển khai
- [ ] Không deep-link Sales Market từ Research

---

## RES-UC-002 — Wizard G0

**Mục tiêu:** *«Brief đúng quyết định kinh doanh — lỗi field tiếng Việt.»*

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | `/crm/research/new` | Bỏ trống client · Submit | — | Inline lỗi | ✓ |
| 2 | AM | Bước 3 | Gõ 10 ký tự | short | Counter đỏ <20 | ✓ |
| 3 | AM | Bước 5 | Xóa hết RQ · Submit | — | Chặn ≥1 RQ | ✓ |
| 4 | AM | Happy | 5 bước hợp lệ | payload SRS 5.2 | 201 + Brief | ✓ |

---

## RES-UC-003 — CRUD RQ

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Brief | **+ Thêm câu hỏi** | Q2 text | Row mới | ✓ |
| 2 | AM | Same | Sửa Q1 | — | PATCH | ✓ |
| 3 | AM | Same | Xóa RQ đã có EV | — | 409 + tooltip | ✓ |

---

## RES-UC-004 — Desk Tavily

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Sources | Chọn Q1 · **Chạy Desk Tavily** | — | Chip pending | ✓ |
| 2 | AN | Same | Click Chạy lần 2 khi running | — | Disabled / 409 | ✓ |
| 3 | System | Worker | Tavily | credits | sources AI | ✓ |
| 4 | AN | Activity | Mở run | — | provider tavily | ✓ |

---

## RES-UC-005 — Deep Research

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Sources | **Chạy Deep Research** | — | Modal cảnh báo | ✓ |
| 2 | AN | Modal | Chọn Q1 · **Chạy** | — | Job ≤15 phút | ✓ |
| 3 | AN | Insights | Đếm card mới | — | **0** insight auto | ✓ EC-RES-09 |

---

## RES-UC-006 — Evidence

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Source row | **Tạo evidence** | — | Drawer | ✓ |
| 2 | AN | Drawer | Bỏ locator · Lưu | — | 400 | ✓ |
| 3 | AN | Drawer | Locator + excerpt · **Verify** | page/URL# | EV verified lock | ✓ |

---

## RES-UC-007 / 008 — Insight + duyệt

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Insights | Tạo không gắn EV · Gửi duyệt | — | Dialog gate | ✓ |
| 2 | AN | Drawer | Gắn EV + rationale · Gửi | — | chờ Lead | ✓ |
| 3 | LD | Drawer | Duyệt nội bộ | comments | approved_internal | ✓ |
| 4 | AN | Drawer | Tự duyệt (SoD) | — | 403 banner | ✓ |

---

## RES-UC-009 — DOCX

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Report | Tạo version | insight IDs | v1 hash | ✓ |
| 2 | AM | Preview | **Xuất DOCX** | — | file | ✓ |
| 3 | AM | File | Mở Word | — | appendix + index EV | ✓ |

---

## RES-UC-010 / 013 / 017 / 020 — Cross-cut

| # | Actor | Thao tác | Phản hồi | Gate |
|---|-------|----------|----------|------|
| 1 | User Beta | Mở URL project Acme | 403 không title | ✓ 010 |
| 2 | Ops | Tắt flag | Nav ẩn, API 404 | ✓ 013 |
| 3 | AN | Sửa excerpt verified | 409 supersede | ✓ 017 |
| 4 | AN | Retry job failed | Run mới, project OK | ✓ 020 |

---

## Walkthrough UAT P1 — Rubric → consult chip (≈25 phút)

**Mục tiêu khách hàng:** *«AM/Analyst siết rubric, snapshot đối thủ, chèn insight vào plan, chặn TC thiếu methodology, mở Research từ DV12, tam giác nguồn, prefill consult.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), QA

**Dữ liệu test:** Client `acme` trong scope · Flag research = 1 (P0 đã bật) · Project P0 hoặc tạo mới · Consult `form_data` có industry + đối thủ (có thể kèm `0909…` để xác nhận strip)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Insight drawer | Mở rubric 5 slider S/F/T/A/R | 0–4 | JSON lưu `confidence_json` | ✓ RES-UC-021 |
| 2 | AN | Same | Gửi duyệt thiếu rubric | — | 400 `missing_confidence_rubric` | ✓ EC-P1-rubric |
| 3 | AN | Tab Đối thủ | Thêm alias + snapshot gắn source | fact + source_id | Snapshot name-only không leak | ✓ RES-UC-022 |
| 4 | AM | Marketing-plan | **Chèn insight** cùng `client_id` | insight_ids | Snapshot JSON **không** có `statement` | ✓ RES-UC-023 |
| 5 | AN | Report TC | Export thiếu methodology | stub | 400 `methodology_incomplete` | ✓ RES-UC-024 |
| 6 | AN | Report TC | Điền population / source_plan / limitation | 3 field | Export OK | ✓ |
| 7 | AM | Service-delivery DV12 | CTA **Mở Research Project** | slug `phan-tich-thi-truong` | Wizard `lifecycle_id` + `client_id` từ `agency_client_id` | ✓ RES-UC-025 |
| 8 | AN | Sources | **Tam giác nguồn** | question_id | Job `research_triangulate` 202 | ✓ RES-UC-026 |
| 9 | AN | Same | Đợi overlap URL | — | Badge «Trùng 2 provider» · **0** insight mới | ✓ EC-P1-triangulate |
| 10 | AM | Wizard bước 1 | Chọn client có consult | client_id | Chip ngành + từng đối thủ | ✓ RES-UC-027 |
| 11 | AM | Same | «Dùng gợi ý» / «Bỏ» từng dòng | confirm | `prefill_competitors` → đối thủ nháp (không snapshot) | ✓ |
| 12 | QA | Prefill JSON | Form có `0909…` | GET `/prefill?client_id=` | 200 · JSON **không** chứa số đó · không 404 | ✓ BR-RES-11 |

#### Tiêu chí nghiệm thu walkthrough P1

- [ ] Bước 1–12 pass staging (triangulate skip live nếu không Tavily)
- [ ] Plan snapshot không chứa `statement`
- [ ] Prefill không chứa SĐT/email/tên người
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] PO / Research Lead sign P1 ECs

---

## Walkthrough UAT P2 — Study → analytics (≈20 phút)

**Mục tiêu khách hàng:** *«Analyst gắn study/consent (không transcript thô); pulse báo Ops khi trend đổi (không auto-publish insight); Lead duyệt exec EN; AM xem cycle time trên analytics.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), QA

**Dữ liệu test:** Client `acme` trong scope · Flag research = 1 (P0 đã bật) · Project P0/P1 hoặc tạo mới · Caps `crm_research.edit` (study/consent), `run` (pulse), `approve` (exec EN), `view` (analytics)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Workspace tab **Studies** | **+ Thêm study** | IDI sữa / idi / n=8 | Study row | ✓ RES-UC-030 |
| 2 | AN | Same · **Consent** | **Ghi consent** mã giả danh | R-004 / record · notes không SĐT | 201 consent | ✓ RES-UC-030 |
| 3 | AN | Evidence | Tạo evidence gắn `study_id` + locator | T-12:03 · excerpt ngắn | EV gắn study · excerpt 800 → 400 `raw_transcript_forbidden` | ✓ RES-UC-030 |
| 4 | AN | Sources | **Chạy pulse** (cap `run`) | question_id | Job `research_pulse` 202 · **0** insight mới | ✓ RES-UC-031 |
| 5 | AN / Ops | `/crm/ops/alerts` | Mở **«Cảnh báo pulse»** | lifecycle có DV12 | `ops_alert_log` `alert_type=research_pulse` · `dv_code=DV12` | ✓ RES-UC-031 |
| 6 | AN | Report | Điền **Executive (EN)** | bản dịch draft | `en_status=draft` · VI không đổi | ✓ RES-UC-032 |
| 7 | LD | Same | **Duyệt bản dịch** (user ≠ `generated_by`) | cap `approve` | `en_status=approved` · sửa lại → 400 `exec_en_locked` | ✓ RES-UC-032 · BR-RES-05/07 |
| 8 | AM | `/crm/research/analytics` | Mở **Phân tích nghiên cứu** | cap `view` | 3 thẻ: chu kỳ p50 / % evidence verify / project đã giao · Beta 403 không `title` | ✓ RES-UC-033 |

#### Nhánh E-Consent PII

Bước 2 notes chứa `0909123456`: 400 `consent_pii_forbidden` · không persist.

#### Nhánh E-Pulse no insight

Bước 4: worker `insight_ids: []` · Jest `createInsight` không được gọi · không published insight.

#### Nhánh E-SoD EN

AN tự **Duyệt bản dịch**: 403 `cannot_self_approve`.

#### Tiêu chí nghiệm thu walkthrough P2

- [ ] Bước 1–8 pass staging (pulse skip live nếu API down / không Tavily)
- [ ] Consent PII 400; pulse không tạo insight; EN approved khóa; analytics 403 không title
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] PO / Research Lead sign P2 ECs

---

## Walkthrough UAT P3 — Embargo → decision (≈20 phút)

**Mục tiêu khách hàng:** *«AM công bố report đã duyệt lên portal (không auto); khách Acme đọc watermark; Beta không thấy title; Analyst gắn 2 wave TRACKER và so sánh; AM ghi decision sau readout.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), Client Acme, Client Beta, QA

**Dữ liệu test:** Client `acme` trong scope · Client `beta` ngoài scope · Flag research = 1 (P0 đã bật) · Report version đã duyệt insight client-facing · Project `TRACKER` (waves) + project bất kỳ (decision) · Caps `crm_research.edit` (embargo, waves, decisions), `approve` (publish-portal), `view` (GET) · Portal JWT `client_id` = `clients.id`

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Report tab | Điền **embargo** / **expiry** | ISO datetime | Version giữ snapshot/vi · `embargo_until` / `expires_at` | ✓ RES-UC-040 |
| 2 | LD | Same | **Công bố portal** (cap `approve`, user ≠ `generated_by`) | `{ visible: true }` | `portal_visible=true` · insight chưa client-facing → 400 `insights_not_client_facing` | ✓ RES-UC-040 · BR-RES-01 |
| 3 | Acme | Portal `/research` + `/research/:versionId` | Mở report đã công bố | Portal JWT Acme | Watermark `CONFIDENTIAL · {client_id} · {email} · {YYYY-MM-DD}` · không `title` | ✓ RES-UC-040 · US-CL-30 |
| 4 | Beta | Same GET version Acme | Đọc chéo tenant | Portal JWT Beta | 403 `{error:forbidden}` · JSON **không** `title` | ✓ EC-P3-portal · BR-RES-12 |
| 5 | AN | Workspace tab **Waves** (TRACKER) | **+ Wave** ×2 | wave_no 1–2 + `metric_json` | 2 row persist · CAT_REVIEW → 400 `waves_not_tracker` | ✓ RES-UC-041 |
| 6 | AN | Same | Xem **So sánh 2 wave gần nhất** | 2 wave cùng `key` | Hàng delta (`waveDelta`) | ✓ RES-UC-041 |
| 7 | AM | Tab **Quyết định** | Ghi decision gắn insight ≥ `approved_internal` | text ≥ 10 + owner | 201 decision `open` · draft insight → 400 `insight_not_approved` | ✓ RES-UC-042 |
| 8 | AM / QA | Same · F5 | Reload | — | Decision + 2 wave + `portal_visible` còn | ✓ F5 |

#### Nhánh E-Publish gate

Bước 2 insight `approved_internal` (chưa client-facing): 400 `insights_not_client_facing` · `portal_visible` vẫn `false`. Tạo report mới **không** tự công bố.

#### Nhánh E-Portal tenancy

Bước 4: Beta 403 `{ error: 'forbidden' }` · `JSON.stringify(body)` không chứa `title` / competitor `name` / study `name`.

#### Nhánh E-Waves CAT_REVIEW

Bước 5 trên project không TRACKER: 400 `waves_not_tracker` · tab Waves ẩn.

#### Nhánh E-Decision draft

Bước 7 insight `draft`: 400 `insight_not_approved`. Text 3 ký tự: 400 `validation_error`. Pulse / publish-portal **không** insert decision.

#### Tiêu chí nghiệm thu walkthrough P3

- [ ] Bước 1–8 pass staging (portal skip live nếu API/portal down)
- [ ] Publish không client-facing 400; portal cross-tenant 403 không title; waves CAT_REVIEW 400; decision draft insight 400
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] PO / Research Lead sign P3 ECs

---

## Walkthrough UAT P4 — PDF → cite (≈20 phút)

**Mục tiêu khách hàng:** *«AM xuất PDF staff (DOCX vẫn OK); Lead công bố; Acme tải PDF watermark; Beta 403 không title; AM cite insight vào Content OS; PATCH brief không mất cite; F5 còn.»*

**Actors:** AM, Research Analyst (AN), Research Lead (LD), Client Acme, Client Beta, QA

**Dữ liệu test:** Client `acme` trong scope · Client `beta` ngoài scope · Flag research = 1 (P0 đã bật) · Report version đã duyệt insight client-facing · Content OS item cùng `agency_client_id` · Caps `crm_research.export` (PDF staff), `view` (GET), `approve` (publish), `edit` + `crm_content.write` (cite) · Portal JWT `client_id` = `clients.id`

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AM | Report tab | **Xuất PDF** | `format=pdf` | 200 `application/pdf` · buffer `%PDF-` | ✓ RES-UC-050 |
| 2 | AM | Same | **Xuất DOCX** | no format / `docx` | 200 DOCX (P0 không regress) | ✓ RES-UC-009 · 050 |
| 3 | LD | Same | **Công bố portal** (cap `approve`, user ≠ `generated_by`) | `{ visible: true }` | `portal_visible=true` · `published_by` / `published_at` stamp | ✓ RES-UC-040 · M4 |
| 4 | Acme | Portal `/research/:versionId` | **Tải PDF** | Portal JWT Acme | 200 `%PDF-` · watermark `CONFIDENTIAL · {client_id} · {email} · {YYYY-MM-DD}` | ✓ RES-UC-050 · US-CL-30 |
| 5 | Beta | Same GET `export.pdf` Acme | Đọc chéo tenant | Portal JWT Beta | 403 `{error:forbidden}` · JSON **không** `title` | ✓ EC-P4-portal · BR-RES-12 |
| 6 | AM | Content OS item | **Chèn insight** cùng client | `insight_ids` ≥ `approved_internal` | Snapshot `brief_json.market_research` **không** `statement` · draft → 400 `insight_not_approved` | ✓ RES-UC-051 |
| 7 | AM | Same | PATCH brief (hook/body) | `brief_json` không gửi cite | Cite `insight_ids` **còn** · inbound `market_research` bị strip | ✓ RES-UC-051 |
| 8 | AM / QA | Same · F5 | Reload | — | PDF staff + portal + cite + publish audit còn | ✓ F5 |

#### Nhánh E-Portal PDF tenancy

Bước 5: Beta 403 `{ error: 'forbidden' }` · `JSON.stringify(body)` không chứa `title`. PDF **không** được build.

#### Nhánh E-Cite draft

Bước 6 insight `draft`: 400 `insight_not_approved`. Thiếu `crm_content.write`: 403 `missing_cap`.

#### Nhánh E-Wave NaN

POST wave `value: NaN` / `Infinity`: 400 `metric value must be number or null`.

#### Tiêu chí nghiệm thu walkthrough P4

- [ ] Bước 1–8 pass staging (portal/cite skip live nếu API/portal down)
- [ ] Staff PDF `%PDF-`; DOCX không regress; portal cross-tenant 403 không title; cite draft 400; wave NaN 400
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] PO / Research Lead sign P4 ECs

---

## Walkthrough UAT P5 — Whisper + SparkToro (≈20 phút)

**Mục tiêu khách hàng:** *«Analyst ghi consent → tải audio IDI → excerpt ≤ 500 + locator; F5 không transcript; SparkToro (hoặc disabled) → source có limitation; không insight mới; F5 còn.»*

**Actors:** Research Analyst (AN), QA

**Dữ liệu test:** Client `acme` trong scope · Flag research = 1 (P0 đã bật) · `RESEARCH_SPARKTORO_ENABLED` mặc định `0` (không bật trong deploy) · Study + consent còn hạn · Audio ≤ 25 MB MIME `audio/mpeg|wav|mp4|x-m4a` · Caps `crm_research.run` (Whisper / SparkToro), `edit` (evidence), `view` (GET)

| # | Actor | Màn hình | Thao tác | Input | Phản hồi | Gate |
|---|-------|----------|----------|-------|----------|------|
| 1 | AN | Studies `?tab=studies` | Ghi **consent** còn hạn trên study | `expires_at` > now (recorded_at + 24 tháng) | Consent saved | ✓ RES-UC-060 · NFR-PRI-01 |
| 2 | AN | Same | **Tải audio** (cap `run`) | file ≤ 25 MB | 202 `{ok, run_id, excerpt_ids}` · poll job | ✓ RES-UC-060 |
| 3 | AN | Evidence | Kiểm excerpt | locator `T-mm:ss` | Mỗi excerpt length ≤ 500 | ✓ NFR-PRI-02 |
| 4 | AN | Same · F5 | Reload | — | Excerpts còn · **không** transcript / `audio_uri` / ô dán transcript | ✓ F5 · NFR-PRI-02 |
| 5 | AN | Sources `?tab=sources` | **Chạy SparkToro** — hoặc thấy nút ẩn + note disabled | `question_id` (question_vi + geo; không PII) | `200 {ok:true, note:sparktoro_disabled}` **hoặc** `202` sources | ✓ RES-UC-061 |
| 6 | AN | Same | Kiểm source SparkToro (nếu job chạy) | publisher `SparkToro` | `limitation_note` bắt buộc · `reliability_tier` ∈ {low, medium} | ✓ BR-RES-09 |
| 7 | AN | Insights | Đếm insight | — | **Không** insight mới từ Whisper / SparkToro (`createInsight` không gọi) | ✓ BR-RES-06/08 |
| 8 | AN / QA | Same · F5 | Reload | — | Excerpts + sources (nếu có) còn · không raw transcript | ✓ F5 |

#### Nhánh E-Consent

Bước 2 study 0 consent / hết hạn: 400 `{error:consent_required|consent_expired}` · không gọi OpenAI.

#### Nhánh E-Raw transcript

Evidence excerpt > 500: 400 `{error:raw_transcript_forbidden}`. Complete payload chỉ `excerpt_ids` — không key `transcript`.

#### Nhánh E-SparkToro off

`GET /health` `sparktoro_enabled=false` (flag hoặc key off) → **không** CTA **Chạy SparkToro**. `POST …/run-sparktoro` → `200 {ok:true, note:sparktoro_disabled}` — project không fail.

#### Nhánh E-Tier

Paid estimate `sparktoro|similarweb|semrush` + tier `high`: 400 `{error:reliability_capped}`. Question có email/SĐT: 400 (BR-RES-11).

#### Tiêu chí nghiệm thu walkthrough P5

- [ ] Bước 1–8 pass staging (SparkToro skip live nếu `sparktoro_enabled` false / không audio fixture / API down)
- [ ] Consent 400; excerpt > 500 → `raw_transcript_forbidden`; SparkToro không `createInsight`; paid tier `high` → `reliability_capped`
- [ ] Không đụng `/crm/sales?tab=market`
- [ ] Không bật `RESEARCH_SPARKTORO_ENABLED` / không ghi `SPARKTORO_API_KEY` trên prod
- [ ] PO / Research Lead sign P5 ECs

---

## P6+ (backlog — không UAT P0–P5)

| Hạng mục | Hành động tóm tắt | Điều kiện mở |
|----------|-------------------|--------------|
| Qualtrics | Import response → study + evidence `value+unit+base`; ExpertReview = source note, không auto-insight | PO có retainer Qualtrics **hoặc** chấp nhận Forms + codebook |
| Van Westendorp | 4 câu giá → bảng `too_cheap`…`too_expensive` trên project `PRICE_OFFER`; **không** market simulator | Cùng plan P6 nếu cùng `PRICE_OFFER` |
| RAG | Embeddings **chỉ** insight `published` / `approved_client_facing` | Gold-set unsupported-claim ổn; DPA embeddings |
| Taxonomy | `crm_research_taxonomy` theme + synonym; gắn `insight_id`; không thay statement | P7 cùng RAG |
| **Apify login** | **Out (Design §20)** — không scrape Facebook login / group. LMP public page giữ nguyên | Không mở |

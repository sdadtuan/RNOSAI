# Intake Deal Bar + Sales Kit — Design Spec

> **Document ID:** INT-SK-20260829  
> **Phiên bản:** 1.1 · **Ngày:** 2026-08-29  
> **Trạng thái:** Design — chờ PO duyệt trước implementation plan  
> **Route:** `/crm/intake?lead_id=` · `/crm/intake?lifecycle_id=` (ops-web) · thư viện `/crm/intake/sales-kit` (admin GDKD)  
> **Quyết định:** **Deal Bar + workspace tab + Sales Kit chatbot** · playbook **3 dịch vụ pilot** · **kho kiến thức** (thư mục + Q&A file + đọc Excel/PDF/ảnh) · slug khác fallback `_common`  
> **Áp dụng form:** bot đề xuất **text discovery + gợi ý điểm BANT 1–5**; AM bấm **Áp dụng** mới ghi — không PATCH ngầm, không tự Complete  
> **Parent:** [INT-P1](../../specs/2026-08-04-intake-bant-phase1-professional-ui-design.md) · [INT-P2](../../specs/2026-08-04-intake-bant-phase2-structured-discovery-design.md) · [INT-P2.5](../../specs/2026-08-05-intake-bant-phase25-funnel-stepper-design.md) · [LMP / SCI](../../specs/lead-meeting-prep.md) · [Playbooks RAG](../../specs/lead-meeting-prep.md#24-playbook-rag--win-patterns) · [Checklist presales](../../crm/checklist-presales-thu-thap-yeu-cau-khach-hang.md)  
> **UI lead liên quan:** [Lead Detail Workspace](./2026-08-28-lead-detail-workspace-design.md) — **không** đổi trang lead đợt này

---

## 1. Tóm tắt

Trang Khảo sát BANT hiện là **form qualify chung** (`_common`): stack card dài (ngữ cảnh + SCI M2 + funnel + hướng dẫn + discovery 12 câu + BANT + stakeholder + cam kết + AI stub). AM không thấy ngành / dịch vụ đã chọn; AI trên trang **không thực chiến** (SCI card = leftover M1; nút Tóm tắt AI = ghép chuỗi).

Đợt này biến `/crm/intake` thành **workspace cuộc gọi qualify**:

1. **Deal Bar** — một dòng sticky: liên hệ · ngành · dịch vụ · BANT live · gap-to-Go · CTA.  
2. **Workspace 4 tab** — Qualify / Discovery / Win intel / Handoff — thay stack dọc.  
3. **Playbook 3 slug pilot** — câu hỏi + checklist + L2 theo dịch vụ.  
4. **Sales Kit chatbot** — coach in-call (chip + chat ngắn + Áp dụng vào form).  
5. **Kho kiến thức Sales Kit** — thư mục theo dịch vụ/ngành; ingest Q&A Excel, PDF, ảnh; kit **trích dẫn nguồn** khi coach.

**Pitch 1 câu:** AM đang gọi thấy *deal này là gì, còn thiếu gì để Go, hỏi câu gì, đáp objection bằng Q&A/case đã duyệt* — không bịa, không form generic.

---

## 2. Mục tiêu & phạm vi

### 2.1. Mục tiêu

| # | Mục tiêu | Đo thành công (UAT / 14 ngày sau ship) |
|---|----------|----------------------------------------|
| G1 | Giảm scroll trước khi hỏi | ≤1 màn hình tới tab Discovery + câu critical (desktop 1280) |
| G2 | AM thấy ngành + dịch vụ trước khi hỏi | 100% phiên `lead_id` có Deal Bar hiện service label hoặc CTA “Chọn dịch vụ” |
| G3 | Discovery theo dịch vụ khi slug pilot | Phiên `dich-vu-seo-tong-the` / `quang-cao-google` / `thiet-ke-website` load definition ≠ `_common` |
| G4 | AI coach lúc đang gọi, không sau Go | Sales Kit trả **Câu tiếp theo** từ snapshot phiên nháp (BANT có thể 0) |
| G5 | Tóm tắt AI thật | `POST …/ai-summary` ghi LLM (hoặc rules fallback), **không** `[stub]` |
| G6 | Không phá gate hiện có | Ngưỡng Go ≥24 / Nurture 18–23 / No-Go &lt;18; Complete validate giữ INT-P1/P2 |
| G7 | Kit lấy đạn từ kho, không bịa | Reply dùng knowledge **luôn có citation** (file + folder + excerpt); không citation → không nêu số/case |
| G8 | Ingest tài liệu sales | GDKD upload Excel Q&A / PDF / ảnh vào folder slug; kit chip **Hỏi kho** trả đúng hàng Q&A |

### 2.2. In scope

- Layout Deal Bar + 4 tab + dock Sales Kit (desktop) / sheet (mobile).  
- Resolve `service_slug` từ funnel → URL `?service_slug=` → session → `_common`.  
- `GET /api/crm/intake/definitions/:slug` trả **form riêng** cho 3 slug pilot; slug khác = `_common`.  
- Tạo phiên: gửi `service_slug` đã resolve (không hardcode `_common` trên UI).  
- Expose ngành / công ty lên context intake (lead `meta_json` + session).  
- Sales Kit: 8 intent + chat + Áp dụng (discovery, win intel, `ai_summary`, gợi ý BANT, Q&A/kho).  
- Thay stub `generateAiSummary` bằng LLM + fallback rules.  
- Thu gọn SCI M2 + funnel stepper vào Deal Bar / tab Handoff — **không xóa** gate logic.  
- Kho kiến thức: thư mục org + túi phiên; ingest `.xlsx` Q&A, `.pdf` text, ảnh (vision/OCR); retrieve qua Playbooks RAG (`category=sales_kit`).  
- Unit + e2e: resolve slug, 3 definition, kit apply, Deal Bar, ingest Excel → citation.

### 2.3. Out of scope

- 9 slug còn lại (AEO, SEO Local, FB Ads, …) — giữ `_common` + Deal Bar vẫn hiện **tên slug** nếu catalog có.  
- Đổi ngưỡng BANT / schema `bant_json` 6 key.  
- Transcription / ghi âm / softphone mới.  
- Auto-complete phiên, auto-chấm BANT không confirm, auto-send Zalo/email (BR-AI-01).  
- Enqueue SCI M2 **trước** Intake Go (giữ `enqueueAfterIntakeGo`).  
- Nhúng nguyên `LeadCopilotPanel` (score / draft email) vào Intake.  
- 12 form đầy đủ + RAG win-loop M4 (học từ chốt/lost) — Phase sau.  
- Đổi `/crm/leads/{id}` workspace (đã ship riêng).  
- Bật `PTT_AI_COPILOT` trên prod nếu đang tắt — **kit tĩnh + retrieve Q&A keyword vẫn chạy**; chat LLM theo flag (mục 10).  
- DAM đầy đủ (versioning Git, OCR offline Tesseract, scan virus enterprise, share public).  
- Đọc file `.docx` / video / ZIP (chỉ xlsx, pdf, png/jpg/webp).  
- Puppeteer / pdfkit / Chromium để parse PDF.

### 2.4. Không làm đợt này (cố ý)

- Tab Handoff **không** bắt AM tick đủ L2 trước Complete (L2 vẫn gate Consult, không gate Intake).  
- Stakeholder / cam kết giữ schema Phase 2; chỉ **collapse mặc định**, mở khi BANT ≥18 hoặc AM mở tab Handoff.

---

## 3. Nghiệp vụ bước Intake (chuẩn spec)

Intake là **cuộc gọi qualify để thắng deal**, không phải form audit nội bộ. AM phải ra 4 output:

| Output | Ý nghĩa | Lưu |
|--------|---------|-----|
| Quyết định tài nguyên | Go / Nurture / No-Go | `decision` + `bant_total` |
| Scope thắng được | 1 dịch vụ + KPI + ngân sách range | `service_slug` + discovery keys |
| Đạn cạnh tranh | Incumbent, tiêu chí chọn, rủi ro chọn sai | `answers_json.win_intel` (mới) |
| Gói handoff | Pain, DM, L2 cần thu | `ai_summary` + L2 read-only từ funnel |

SCI M1 = vũ khí **cuộc gọi đầu** (trước BANT). SCI M2 = vũ khí **sau Go**. **Sales Kit** = vũ khí **đang qualify**. Ba lớp không thay nhau.

### 3.1. Việc Sales Kit phải làm trên call (sâu hơn form)

AM không cần “chat với AI”. AM cần **6 nước đi** — mỗi nước = 1 chip + 1 nguồn kho:

| Nước đi | Câu AM tự hỏi | Kit trả | Nguồn bắt buộc |
|---------|---------------|---------|----------------|
| **1. Mở cuộc** | Hỏi gì trước 90 giây? | 1 câu critical còn trống + lý do | Form slug + Deal Bar |
| **2. Lấy điểm Go** | Còn thiếu tiêu chí nào? | Weakest BANT + câu lấy điểm | `bant_json` |
| **3. Phá incumbent** | Agency cũ yếu chỗ nào? | Góc 2 câu + proof | `win_intel` + folder `battle-cards` |
| **4. Đáp objection** | KH vừa nói “đắt / tự làm được / đang có agency” | Q&A đã duyệt, 1 đáp | Folder `qa` (Excel) — **citation** |
| **5. Neo giá / gói** | Band nào an toàn để nói? | Range đã duyệt, không bịa | Folder `pricing` (Excel) |
| **6. Chốt phiên** | Đọc lại 30s + next step | Brief + L2 cần xin | Session + L2 preview |

Không có file trong folder khớp slug/ngành → kit **nói thiếu kho**, không bịa case/giá. Rules form (câu discovery) vẫn chạy.

### 3.2. Lớp kiến thức (thứ tự thắng khi retrieve)

1. **Túi phiên** — file AM upload lúc gọi (screenshot Ads KH, PDF proposal đối thủ, Excel spend). Ưu tiên vì đúng deal.  
2. **Thư mục org theo `service_slug` + ngành** — Q&A / battle card / case / pricing do GDKD duyệt (`status=active`).  
3. **Thư mục org `_common`** — objection chung (đắt, freelancer, timeline).  
4. **SCI M1** — pain / competitive angle (nếu `ready`).  
5. **Form definition** — câu hỏi critical (luôn có).

Top-k = **5 chunk**. Mỗi chunk ≤ 500 ký tự trong prompt. Reply kit ≤ 600 chữ + tối đa **3 citation**.

### 3.3. Ai nạp kho, ai dùng

| Vai trò | Thư viện org `/crm/intake/sales-kit` | Túi phiên trên Intake |
|---------|--------------------------------------|------------------------|
| GDKD / admin (`crm_leads.configure` hoặc `playbooks.configure`) | Tạo folder, upload, duyệt `draft→active`, xóa | Xem |
| AM (`crm_leads.edit`) | Chỉ đọc folder `active` đúng slug/ngành | Upload vào túi phiên, xóa file mình tải |
| AM (`crm_leads.view`) | Chỉ retrieve qua kit | Không upload |

File `draft` không vào retrieve. File `failed` (parse lỗi) hiện trên thư viện, không vào RAG.

---

## 4. Bố cục

### 4.1. Desktop (≥1280px)

```
┌─ PageToolbar (title ngắn) ─────────────────────────────────────┐
│ Khảo sát BANT · Phiên qualify theo dịch vụ                      │
└────────────────────────────────────────────────────────────────┘
┌─ IntakeDealBar (sticky) ───────────────────────────────────────┐
│ Tên · Công ty · Ngành · [Dịch vụ] · BANT 8/30 · Còn 16 để Go   │
│ [← Lead] [Cockpit] [Funnel] [Chuyển Tư vấn*]                    │
└────────────────────────────────────────────────────────────────┘
┌ Sidebar phiên ~240px ┐ ┌ Main tabs ~1fr ┐ ┌ Sales Kit ~360px ┐
│ 1 phiên · BANT 0/30  │ │ Qualify        │ │ Chip × 8         │
│ + Gọi / + Gặp        │ │ Discovery      │ │ Chat + citation  │
│ #12 Nháp             │ │ Win intel      │ │ [Áp dụng] [Kho]  │
└──────────────────────┘ │ Handoff        │ └──────────────────┘
                         └────────────────┘
```

\* CTA Funnel chỉ enable khi gate hiện tại OK (INT-P2.5). Không đổi luật advance.

### 4.2. Tablet (1024–1279)

- Deal Bar 2 dòng (identity + scores / CTA).  
- Sales Kit → nút **Kit** mở sheet phải.  
- Sidebar phiên giữ, có thể collapse.

### 4.3. Mobile (&lt;1024)

- Deal Bar 1 dòng rút gọn: tên · dịch vụ · BANT · overflow menu (Lead / Cockpit / Funnel).  
- Sidebar phiên = drawer hiện có.  
- Tab workspace full width.  
- Sales Kit = sheet bottom (nút **Sales Kit** sticky dưới tab).  
- Không thêm tab thứ 5 trên mobile.

### 4.4. Blocks bị gỡ khỏi stack chính

| Block hiện tại | Sau ship |
|----------------|----------|
| `IntakeLeadContextCard` (7 field) | Gộp Deal Bar; chi tiết trong overflow “Ngữ cảnh” |
| `IntakePrepSummaryCard` + `BantQualifyChecklist` localStorage | Bỏ checklist localStorage trên Intake. SCI 1 dòng trên Deal Bar (pain 120 ký tự + link Cockpit) |
| `CrmFunnelStepper` full | Collapse trong Deal Bar `Funnel ▾` hoặc tab Handoff — **cùng component**, default collapsed |
| `<details>` hướng dẫn 8 bước | Icon `?` → drawer 4 bước |
| `IntakeAiSummaryPanel` mục D dưới form | Tab Handoff + kit intent **Tóm tắt 30s** |

---

## 5. Deal Bar

### 5.1. Fields

| Ô | Nguồn | Empty |
|---|--------|-------|
| Liên hệ | `lead.full_name` / session `contact_name` | “—” |
| Công ty | session `company_name` → `meta_json.company` / `company_name` | Ẩn ô |
| Ngành | `lead.industry` (API mới, mục 8.2) → discovery `phone_industry` | Chip “Chưa có ngành” |
| Dịch vụ | Resolve slug (5.2) → label catalog / map cứng 3 pilot | Select “Chọn dịch vụ” |
| BANT live | `computeBantTotal(bant)` phiên active | `0/30` |
| Gap-to-Go | `max(0, 24 - total)` nếu chưa Go; nếu ≥24: “Đủ Go” | — |
| Stage | `funnel.presales.presales.stage` | “—” |
| SCI chip | `prep.status` + 1 dòng pain (M1 hoặc M2) | “SCI chưa sẵn” + link Cockpit |

### 5.2. Resolve `service_slug` (thứ tự thắng)

1. Query `?service_slug=` nếu thuộc `SERVICE_SLUGS` hoặc `_common`.  
2. Phiên active `session.service_slug` nếu không `_common`.  
3. `funnel.presales.presales.service_slug` (`funnelServiceSlug`).  
4. `_common`.

AM đổi dịch vụ trên Deal Bar (select, `crm_leads.edit`):

- Phiên **nháp**: PATCH session `service_slug` + reload definition + **giữ** `answers_json` / BANT (key lạ giữ, UI chỉ hiện câu của slug mới).  
- Phiên **completed**: không đổi slug; hint “Reopen hoặc tạo phiên mới”.  
- Funnel presales slug **không** tự ghi đè khi AM đổi trên Intake (tránh lệch lead detail). AM đổi slug funnel trên lead như hiện tại. Deal Bar có link “Đồng bộ trên lead →” nếu session slug ≠ funnel slug.

### 5.3. Labels 3 pilot (cứng + catalog override)

| slug | Label VI |
|------|----------|
| `dich-vu-seo-tong-the` | SEO tổng thể |
| `quang-cao-google` | Quảng cáo Google |
| `thiet-ke-website` | Thiết kế website |
| `_common` | Chưa chọn dịch vụ |

Catalog SPC / `mergePresalesServiceOptions` thắng nếu có cùng slug.

---

## 6. Workspace 4 tab

Tab là **cách nhìn cùng một phiên**, không phải 4 form lưu riêng. Autosave 30s + blur giữ `useIntakeAutosave`.

| Tab | Việc AM | Nội dung |
|-----|---------|----------|
| **Qualify** | Quyết định Go | BANT 6 radio + total bar + Decision + Reason + Red flags (collapse, 8 mục). Mini-checklist **Lead — Qualify** theo slug (mục 7) |
| **Discovery** | Hỏi trên call | Câu critical pin trên. Còn lại nhóm theo pillar. Mode phone / in_person như hiện tại |
| **Win intel** | Thắng đối thủ | 4 field `win_intel` (mục 8.3) + map từ discovery nếu đã có |
| **Handoff** | Chuẩn bị Consult | Stakeholder (collapse nếu BANT &lt;18) · 3 cam kết · L2 docs **read-only** từ funnel · AI summary · Funnel stepper (nếu không mở từ Deal Bar) |

Default tab: **Discovery** nếu có phiên nháp và BANT &lt;18; **Qualify** nếu AM vừa mở Complete modal; **Handoff** nếu phiên completed.

Bỏ `BantQualifyChecklist` localStorage trên Intake — Qualify tab **là** BANT thật.

---

## 7. Playbook 3 dịch vụ pilot

### 7.1. Quy tắc definition

`getUiDefinition(slug)`:

- 3 slug pilot → form riêng (phone + in_person + red flags + `qualify_items` + `l2_preview_keys`).  
- Khác → `COMMON_FORM` như hiện tại.  
- Schema v2 giữ `phone_question_items` / `inperson_question_items` / `red_flag_items`.  
- **Thêm** (backward compatible):

```ts
qualify_items: Array<{ key: string; text: string; critical?: boolean }>;
win_intel_prompts: Array<{ key: WinIntelKey; hint: string }>;
l2_preview_keys: string[]; // map catalog L2 trên funnel, chỉ hiển thị
schema_version: 3;
is_pilot_form: boolean;
```

Câu **common critical** giữ: phone `pain` / `budget` / `decision_maker`; in_person `pain_solutions` / `budget_approved` / `timeline`. Pilot **thêm** 1–2 critical theo dịch vụ (bảng dưới). Complete: rule Phase 2 + critical mới của slug (warn nếu thiếu answer, không block nếu BANT + decision đủ — cùng mức Phase 2).

### 7.2. SEO tổng thể — `dich-vu-seo-tong-the`

**Qualify (4):** ngành · ngân sách/tháng · website domain · nhu cầu cụ thể.

**Discovery phone (thay 12 câu generic) — tối đa 8 + 3 critical common đã gộp:**

| key | text | critical |
|-----|------|----------|
| `seo_domain` | Website/domain cần SEO hiện tại? | yes |
| `phone_pain_point` | Pain #1 (traffic / lead / rank / brand)? | yes |
| `phone_budget` | Ngân sách SEO/tháng (range VND)? Ai duyệt? | yes |
| `phone_decision_maker` | Ai ký HĐ / duyệt ngân sách tháng? | yes |
| `seo_gsc` | Đã có GSC / GA4? Ai giữ quyền? | |
| `seo_competitors` | 2–3 đối thủ đang chiếm từ khóa? | |
| `seo_keywords` | Cụm từ khóa / nhóm dịch vụ cần lên? | |
| `seo_history` | Đã tự làm / thuê agency SEO? Kết quả? | |
| `phone_timeline` | Mốc cần thấy kết quả (tháng)? | |
| `phone_industry` | Ngành / khu vực / thị trường chính? | |

**In-person (8):** mục tiêu 6–12 tháng · ICP · technical/CWV hiện tại · đối thủ · KW volume/difficulty cảm tính · ngân sách đã duyệt · timeline 3–6 tháng · tiêu chí chọn agency SEO.

**Win intel hints:** agency SEO cũ (báo traffic vs lead) · đối thủ rank · tiêu chí (case ngành / báo cáo GSC).

**L2 preview:** GSC read · GA4 · 2–3 đối thủ · seed KW.

**Red flags thêm (pilot, cộng 8 common):** `rf_seo_no_site` — chưa có website / domain lỗi; `rf_seo_expect_week` — kỳ vọng lên top 1–2 tuần.

### 7.3. Quảng cáo Google — `quang-cao-google`

**Qualify (4):** ngành/sản phẩm · ngân sách/tháng · loại campaign (Search / Display / Shopping) · đã có Google Ads account.

**Discovery phone:**

| key | text | critical |
|-----|------|----------|
| `gads_account` | Đã có Google Ads account? Trạng thái? | |
| `phone_pain_point` | Pain #1 (CPA / lead / sale / impression)? | yes |
| `phone_budget` | Ngân sách Ads + phí quản lý/tháng? | yes |
| `phone_decision_maker` | Ai duyệt spend hàng tháng? | yes |
| `gads_type` | Search / Display / Shopping / Performance Max? | yes |
| `gads_lp` | Landing / website nhận traffic? | |
| `gads_tracking` | Conversion / GA4 / call tracking đã có? | |
| `gads_history` | CPC / CPA / ROAS gần nhất nếu có? | |
| `phone_timeline` | Campaign / mùa vụ bắt đầu khi nào? | |
| `phone_industry` | Ngành / sản phẩm / khu vực target? | |

**In-person:** ICP search intent · KW mục tiêu · kết quả account hiện tại · approval spend · tracking gaps · tiêu chí chọn (CPA vs agency cũ).

**Win intel:** freelancer/agency Ads cũ · so sánh CPA · kỳ vọng ROAS không thực tế.

**L2 preview:** account read · conversion tracking · LP URL · CPC benchmark.

**Red flags thêm:** `rf_gads_no_tracking` — không đo conversion; `rf_gads_budget_day` — chỉ nói ngân sách/ngày, không khóa tháng.

### 7.4. Thiết kế website — `thiet-ke-website`

**Qualify (4):** ngành · loại site (corporate / ecomm / portfolio) · ngân sách dự án · deadline.

**Discovery phone:**

| key | text | critical |
|-----|------|----------|
| `web_type` | Corporate / thương mại / portfolio / khác? | yes |
| `phone_pain_point` | Pain #1 (rebrand / không ra lead / site cũ)? | yes |
| `phone_budget` | Ngân sách thiết kế (range dự án)? | yes |
| `phone_decision_maker` | Ai duyệt design / ký HĐ? | yes |
| `web_deadline` | Deadline go-live / sự kiện? | yes |
| `web_refs` | 2–3 site tham khảo (URL)? | |
| `web_pages` | Ước số trang / tính năng must-have? | |
| `web_brand` | Đã có logo / guideline? | |
| `phone_industry` | Ngành / thương hiệu? | |
| `web_current` | Site hiện tại (nếu có) — giữ hay làm mới? | |

**In-person:** mục tiêu site · đối tượng · tính năng · số revision kỳ vọng · quy trình duyệt design · rủi ro delay content.

**Win intel:** freelancer Figma rẻ · intern in-house · tiêu chí (revision / SLA bàn giao).

**L2 preview:** brand assets · sitemap draft · URL tham khảo.

**Red flags thêm:** `rf_web_no_budget` — “xem giá rồi tính”; `rf_web_scope_creep` — muốn ecomm + app + 50 trang, budget landing.

### 7.5. Slug không pilot

Giữ 12 + 10 câu `_common`. Deal Bar vẫn hiện label nếu funnel có slug. Kit chip **Deep-dive DV** nói: “Chưa có playbook slug này — dùng form chung. Chọn SEO / Google Ads / Website để kit sâu.” Không bịa câu hỏi dịch vụ.

---

## 8. Dữ liệu & API

### 8.1. Không đổi

- Bảng `crm_lead_intake_sessions` — không migration cột mới bắt buộc.  
- Complete / reopen / consult gate / M2 enqueue sau Go.  
- `answers_json.discovery_responses` key-based (Phase 2).

### 8.2. Lead context — expose ngành / công ty

`GET /api/crm/leads/:id` (hoặc intake bootstrap) thêm field **optional**, không phá `LeadRow` cũ:

```ts
company_name?: string | null;
industry?: string | null;       // text hiển thị
industry_slug?: string | null;
```

Nguồn: `meta_json.company` / `company_name` · `meta_json.industry` / `industry_slug`. Mask PII như phone/email hiện tại. Nếu không muốn phình `GET lead`, thêm `GET /api/crm/intake/context?lead_id=` trả `{ lead, funnel_service_slug, industry, company_name, l2_docs, prep_chip }` — **ưu tiên endpoint này** để Intake một round-trip.

**Quyết định:** thêm `GET /api/crm/intake/context?lead_id=` (cap `crm_leads.view`). Không bắt list leads trả industry.

### 8.3. `answers_json.win_intel`

```ts
type WinIntelKey = 'incumbent' | 'competitor' | 'selection_criteria' | 'switch_risk';

win_intel: {
  incumbent: { answer: string; confidence?: 'guess' | 'heard' | 'confirmed' };
  competitor: { answer: string; confidence?: string };
  selection_criteria: { answer: string; confidence?: string };
  switch_risk: { answer: string; confidence?: string };
}
```

PATCH qua `answers_json` hiện có. UI tab Win intel bind 4 ô. Discovery keys `seo_history` / `gads_history` / `ip_competitors` **không** tự ghi đè `win_intel`; kit có thể **đề xuất copy** sang.

### 8.4. Tạo phiên

`buildCreateIntakeSessionBody`: `service_slug` = slug đã resolve (5.2), không `'_common'` cứng. Backend đã inherit từ lifecycle nếu thiếu — UI phải gửi khi biết.

### 8.5. Definitions

`GET /api/crm/intake/definitions/:slug` — `getUiDefinition` implement 3 form (mục 7). `schema_version: 3`. Client ops-web đọc `qualify_items` nếu có, bỏ qua nếu v2.

### 8.6. AI summary — bỏ stub

`POST /api/crm/intake/sessions/:id/ai-summary`:

1. Build prompt từ session + context (slug, ngành, BANT, discovery, win_intel, red flags).  
2. `AiLlmClient.completeJson` (cùng client LMP). Output `{ summary_vi: string, suggested_questions: string[], bant_hints?: Partial<Record<BantKey, number>> }`.  
3. Lưu `ai_summary` + `ai_suggested_questions`. **Không** tự ghi `bant_json`.  
4. Không có API key / LLM lỗi → fallback **rules** (ghép có cấu trúc, tiếng Việt, **không** prefix `[stub]`): Liên hệ · DV · BANT · 3 discovery critical · win_intel nếu có.

Audit: `ai_agent_runs` `use_case = intake_ai_summary`.

### 8.7. Sales Kit API (mới)

`POST /api/crm/intake/sessions/:id/sales-kit`

Cap: `crm_leads.edit` (chat trên phiên đang làm) hoặc `crm_leads.view` + `crm_lmp.view` (chỉ đọc chip). Rate limit: cùng `summarizeRateLimitPerMin` (actor key).

**Request:**

```ts
{
  intent:
    | 'next_question' | 'gap_to_go' | 'win_intel' | 'service_dive'
    | 'summary_30s' | 'red_flag' | 'freeform'
    | 'ask_library' | 'battle_card' | 'pricing_band';
  message?: string;
  locale?: 'vi';
}
```

Server **tự load** session + intake context (không tin client gửi BANT). Không nhận raw PII extra.

**Response:**

```ts
{
  reply_vi: string;                 // ≤ 600 chữ, 1 ý chính
  next_question?: { key: string; text: string; tab: 'discovery' | 'qualify' | 'win_intel' };
  apply: {
    discovery?: Array<{ key: string; answer: string }>;
    win_intel?: Partial<Record<WinIntelKey, string>>;
    ai_summary?: string;
    bant_hints?: Partial<Record<'budget'|'authority'|'need'|'timeline'|'fit'|'history', number>>;
    red_flags?: string[];           // keys đề xuất tick
  };
  gap?: { total: number; to_go: number; weakest: string[] };
  citations: Array<{
    file_id: string;
    file_name: string;
    folder_path: string;
    excerpt: string;
    score: number;
    kind: 'qa' | 'battle_card' | 'case' | 'pricing' | 'session_upload' | 'other';
  }>;
  stub_mode: boolean;
  run_id?: string;
}
```

**Áp dụng:** client hiện preview → AM bấm **Áp dụng** → PATCH session như form thường. Server kit **không** ghi session trừ intent `summary_30s` khi AM chọn “Ghi tóm tắt” (cùng confirm).

**Rules-first (bắt buộc trước LLM):**

| Intent | Rules | LLM khi |
|--------|-------|---------|
| `gap_to_go` | Sort BANT = 0 hoặc ≤2 | Chỉ diễn đạt câu hỏi |
| `next_question` | Critical chưa có answer theo slug | Diễn đạt theo ngành |
| `service_dive` | Trả 3 câu từ `qualify_items` / discovery chưa hỏi | Không bịa key |
| `red_flag` | So khớp 8+pilot flags với text phiên | Bổ sung cách xử lý |
| `win_intel` / `battle_card` | 4 ô trống + retrieve `battle-cards` | Góc + proof có citation |
| `ask_library` | Keyword RAG Q&A (mục 8.9) | Diễn đạt 1 đáp; **cấm** đáp không citation nếu hỏi giá/case |
| `pricing_band` | Retrieve `pricing` đúng slug | Chỉ nêu range trong chunk; không có file → “Chưa có bảng giá trong kho” |
| `summary_30s` | Fallback rules nếu no LLM | Luôn ưu tiên LLM |
| `freeform` | Guard qualify/handoff; nếu hỏi “đáp sao / case / giá” → retrieve như `ask_library` | Từ chối ngoài scope |

`stub_mode=true` khi: flag kit LLM tắt, không key, timeout. Chip playbook **luôn** hoạt động (rules).

### 8.8. Prompt / an toàn

- Cấm bịa số ngân sách, KPI cam kết, case win không có trong context.  
- Không research profile cá nhân (LMP §6).  
- Mask SĐT/email trong prompt như copilot.  
- BR-AI-01: không draft outbound send.  
- Một câu hỏi / một reply (`next_question` tối đa 1).  
- Số tiền / KPI / tên case **chỉ** khi có citation `pricing` hoặc `case` / `qa`.

### 8.9. Kho kiến thức — mô hình

Tái sử dụng **Playbooks RAG** (`POST /api/v1/ai/playbooks/rag/query`, bảng `ai_playbooks` / `ai_playbook_chunks`). Không dựng vector engine thứ hai.

| Khái niệm | Mapping |
|-----------|---------|
| Thư mục org | 1 `ai_playbooks` · `category=sales_kit` · `slug=sk-{folder_key}` · tags: `service_slug`, `industry_slug`, `kind` |
| File | Bảng mới `sales_kit_files` (id, playbook_id, lead_id nullable, session_id nullable, folder_key, original_name, mime, storage_key, parse_status, uploaded_by, created_at) |
| Chunk | `ai_playbook_chunks` · `chunk_key=file:{id}:p{n}` · body = text đã extract · embedding như playbook hiện tại |
| Túi phiên | Playbook ảo `slug=sk-session-{leadId}-{sessionId}` · tag `session` · TTL xóa 90 ngày sau Complete (job, không chặn UX) |

**Folder tree cố định (org):**

```
sales-kit/
  _common/qa
  _common/battle-cards
  _common/pricing
  dich-vu-seo-tong-the/qa
  dich-vu-seo-tong-the/battle-cards
  dich-vu-seo-tong-the/cases
  dich-vu-seo-tong-the/pricing
  quang-cao-google/…          (cùng 4 kind)
  thiet-ke-website/…          (cùng 4 kind)
```

GDKD tạo thêm folder con dưới slug (vd. `dich-vu-seo-tong-the/qa/bds`) — `folder_key` max 3 cấp, `[a-z0-9-_]+`. Retrieve: đúng slug + ngành (tag) rồi `_common`.

Admin UI: `/crm/intake/sales-kit` (cùng ops-web, cap configure). Intake kit chỉ **browse + upload túi phiên**, không sửa org.

### 8.10. Ingest file

`POST /api/crm/intake/sales-kit/files` (multipart).

| | Quy tắc |
|---|---------|
| MIME | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` · `application/pdf` · `image/png` · `image/jpeg` · `image/webp` |
| Size | Excel ≤ 2 MB · PDF ≤ 8 MB · ảnh ≤ 4 MB |
| Số file | Org: 40 / folder. Túi phiên: 10 / session |
| Storage | Disk `PTT_SALES_KIT_STORAGE_DIR` (default `var/sales-kit`) hoặc S3 nếu đã cấu hình CMS (`contentMarketingS3Bucket`) — **một** backend, không dual-write |
| Sync | Parse **đồng bộ** nếu Excel ≤ 200 hàng / PDF ≤ 15 trang; lớn hơn → job `sales_kit_parse` + UI `parse_status=pending` |

**Excel Q&A (kind = `qa` hoặc auto-detect):**

- Sheet đầu, hàng 1 header. Cột (không phân biệt hoa thường, alias):  
  `question` \| `cau_hoi` \| `q`  
  `answer` \| `cau_tra_loi` \| `a`  
  `service_slug` (optional)  
  `industry` / `nganh` (optional)  
  `tags` (optional, phẩy)  
- Mỗi hàng → 1 chunk: title = 80 ký tự đầu câu hỏi; body = `Q: …\nA: …`.  
- Sheet **pricing** (kind `pricing`): cột `item` / `goi` · `min_vnd` · `max_vnd` · `note` · `service_slug`. Body = `Gói {item}: {min}–{max} VND. {note}`.  
- Không đủ cột Q/A → `parse_status=failed` + `error=xlsx_qa_columns`.  
- Dùng `exceljs` (đã có trên ptt-crm-api). Không thêm `xlsx` package.

**PDF:**

- Extract text theo trang (thư viện text-extract, **không** Chromium/puppeteer).  
- Chunk ~800 ký tự, overlap 80, `chunk_key=file:{id}:p{page}:{i}`.  
- 0 text (scan) → `parse_status=needs_ocr`: nếu `PTT_INTAKE_SALES_KIT_LLM=1` gọi vision 1 trang đầu (ảnh render **không** bắt buộc — nếu không render được, status giữ `needs_ocr`, GDKD upload lại ảnh trang). Không cài Tesseract.

**Ảnh (png/jpg/webp):**

- `sharp` resize cạnh dài ≤ 1600px.  
- LLM vision → JSON `{ kind, text_vi, qa?: [{q,a}] }`. Có `qa` → chunk từng cặp; không → 1 chunk mô tả.  
- LLM tắt → `parse_status=needs_ocr`, kit không retrieve file này. AM đọc tay.

Mọi ingest ghi `ai_agent_runs` `use_case=intake_sales_kit_ingest`.

### 8.11. Retrieve trong `sales-kit` turn

Sau rules-first, nếu intent ∈ `ask_library` \| `battle_card` \| `pricing_band` \| `win_intel` \| `freeform` (và message có tín hiệu objection/giá/case):

1. Query = `message` hoặc câu weakest BANT + ngành + label slug.  
2. `playbooks.ragQuery` filter tag `sales_kit` + (`service_slug` OR `_common`) + túi phiên cùng lead/session.  
3. `limit=5`. Engine vector nếu có embedding, không thì keyword (đã có).  
4. Prompt LLM (nếu bật) chỉ được dùng excerpt citation.  
5. Keyword-only khi LLM off: trả **đúng** chunk Q&A rank-1 (`reply_vi = A`, citation đủ) — đây là đường **thực chiến không model**.

---

## 9. Sales Kit UI

### 9.1. Không dùng Lead Copilot panel

Component mới: `IntakeSalesKitPanel`. Không import score / follow-up / route-rep.

### 9.2. Chip (cố định, tiếng Việt)

1. Câu tiếp theo → `next_question`  
2. Còn thiếu để Go → `gap_to_go`  
3. Win intel → `win_intel`  
4. Deep-dive dịch vụ → `service_dive`  
5. Tóm tắt 30s → `summary_30s`  
6. Red flag → `red_flag`  
7. **Hỏi kho / Q&A** → `ask_library` (ô chat hiện placeholder “KH vừa nói…”)  
8. **Bảng giá / band** → `pricing_band`  

Chip 1–6 không bắt buộc kho. Chip 7–8 **phải** citation hoặc empty-state “Chưa có file trong thư mục …”.

AM gõ ô chat = `freeform`. Dưới chat: link **Kho** (sheet: folder org read-only + túi phiên upload).

### 9.3. Áp dụng

Mỗi reply có checkbox theo `apply.*`. Default: tick discovery/win_intel/summary; **bant_hints bỏ tick** (AM chủ động). Confirm → merge PATCH.

Gợi ý điểm BANT hiện “Bot đề xuất Budget 3/5 — Áp dụng?” — không đổi radio cho đến khi confirm.

### 9.4. Trạng thái

| Flag | Chip playbook | Chat LLM | Tóm tắt 30s |
|------|---------------|----------|-------------|
| Kit UI on (mặc định Intake) | Có | — | Rules |
| `PTT_INTAKE_SALES_KIT_LLM=1` + key | Có | Có | LLM |
| Copilot prod off | Có | Ẩn ô chat, chip rules vẫn | Rules |

Ops-web: `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT=1` (default **1** trên Intake — kit tĩnh là sản phẩm, không phụ thuộc Copilot CSKH). LLM: `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM` khớp backend.

### 9.5. SCI trên kit

Nếu M1 `ready`: 1 block “Góc từ cuộc gọi đầu” (pain 160 ký tự) — context cho `win_intel` / `next_question`. Không chờ M2. Nếu prep `running`: “SCI đang chạy — kit vẫn hỏi theo form.”

### 9.6. Citation + túi phiên

- Mỗi reply có khối **Nguồn:** tên file · folder · excerpt 120 ký tự · nút mở (signed GET, cap view).  
- Túi phiên: kéo-thả Excel/PDF/ảnh ngay kit; progress `pending` → `ready` / `failed`.  
- Không hiện file org `draft`.  
- Mobile: upload từ thư viện ảnh máy.

Admin `/crm/intake/sales-kit`: cây folder, upload, bảng `parse_status`, nút Duyệt, preview chunk. Seed 1 file Excel mẫu `docs/crm/sales-kit/mau-qa-seo.xlsx` (5 hàng Q&A SEO) khi folder `dich-vu-seo-tong-the/qa` trống.

---

## 10. Feature flags & RBAC

| Env | Default | Ý nghĩa |
|-----|---------|---------|
| `PTT_INTAKE_SALES_KIT_LLM` | `0` | Gọi LLM kit + summary + vision ảnh |
| `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT` | `1` | Hiện panel kit |
| `NEXT_PUBLIC_PTT_INTAKE_SALES_KIT_LLM` | `0` | Ô chat + chip cần model |
| `PTT_SALES_KIT_STORAGE_DIR` | `var/sales-kit` | Disk nếu không S3 |
| `PTT_LEAD_MEETING_PREP_ENABLED` | (hiện tại) | Chip SCI trên Deal Bar |
| `PTT_AI_COPILOT_ENABLED` | không bắt buộc | Không gate kit tĩnh / keyword Q&A |

Quyền: xem Intake như cũ (`crm_leads.view`). Đổi slug / Áp dụng / tạo phiên: `crm_leads.edit`.

---

## 11. Component map (ops-web)

| Mới | Vai trò |
|-----|---------|
| `IntakeDealBar` | Sticky identity + BANT + service select |
| `IntakeWorkspaceTabs` | 4 tab |
| `IntakeQualifyTab` | BANT + decision + red flags + qualify_items |
| `IntakeDiscoverySection` | refactor: critical pin + groups (file hiện có) |
| `IntakeWinIntelSection` | 4 field |
| `IntakeHandoffTab` | stakeholder + commitments + L2 + summary + stepper |
| `IntakeSalesKitPanel` | chip + chat + apply + citation |
| `IntakeSalesKitLibrarySheet` | túi phiên + browse org |
| `SalesKitAdminPage` | `/crm/intake/sales-kit` |
| `intake-service-playbook.ts` | labels + gap-to-go thuần |

| Sửa | Việc |
|-----|------|
| `IntakeContent.tsx` | Bỏ stack 3 card; resolve slug; context fetch; kit |
| `intake-session-form.ts` | `service_slug` từ resolve |
| `IntakeLeadContextCard` | Xóa hoặc thin wrapper Deal Bar |
| `IntakePrepSummaryCard` | Xóa khỏi main; logic chip → Deal Bar |
| `IntakeAiSummaryPanel` | Chuyển Handoff |
| `funnelServiceSlug` | Dùng resolve |

| API Nest | Việc |
|----------|------|
| `intake-definitions.util.ts` | 3 form + v3 fields |
| `intake.service.ts` | summary LLM; `salesKitTurn`; context |
| `intake.controller.ts` | `GET context`, `POST sales-kit`, files CRUD |
| `sales-kit-ingest.util.ts` | parse xlsx / pdf / image |
| `playbooks.service.ts` | filter tag `sales_kit` khi kit gọi RAG |
| Lead fetch (nếu không dùng context) | industry/company |

---

## 12. Quy tắc nghiệp vụ (cứng)

1. Không đổi `GO_THRESHOLDS` `{ go: 24, nurture_min: 18 }`.  
2. Kit không Complete, không Reopen, không advance funnel.  
3. Đổi slug nháp không xóa BANT / answers.  
4. Complete phiên `_common` vẫn hợp lệ (lead chưa chọn DV).  
5. Hai phiên nháp: giữ confirm Phase 1.  
6. L2 trên Handoff **read-only** — tick L2 vẫn trên lead funnel.  
7. localStorage `lmp-m2-bant-check` **không** đọc/ghi trên Intake sau ship (Cockpit có thể giữ trên lead detail — ngoài scope, không đụng).  
8. Funnel stepper behavior (gate, CTA) giữ INT-P2.5; chỉ đổi **chỗ render**.  
9. Kit **không** nêu giá/case/KPI nếu không có citation `ready`.  
10. File túi phiên không lên retrieve org (không leak deal A sang lead B).  
11. Ingest không đọc cột ngoài whitelist header; không thực thi macro Excel.

---

## 13. Pha triển khai (trong 1 plan, 2 slice review)

| Slice | Deliverable | Demo |
|-------|-------------|------|
| **S0** | Deal Bar + tabs + collapse stepper/SCI + resolve slug + context API + 3 definitions | Lead #5: bar hiện tên + slug funnel; tab không stack 3 card |
| **S1** | Tạo phiên đúng slug; qualify_items; win_intel; discovery 3 form; e2e 3 slug | Đổi select SEO → câu `seo_domain` |
| **S2** | Sales Kit rules (chip 1–6) + Áp dụng + summary fallback không stub | Chip Gap-to-Go khi BANT 0 |
| **S3** | Kit + summary LLM sau flag | UAT bật `PTT_INTAKE_SALES_KIT_LLM=1` |
| **S4** | Kho: folder + ingest Excel/PDF/ảnh + RAG filter + chip 7–8 + túi phiên + admin | Upload `mau-qa-seo.xlsx` → Hỏi kho trả đúng hàng + citation |

S0+S1 không cần LLM. S2 = thực chiến form. S3 = thực chiến model. **S4 = thực chiến kho** (keyword Q&A chạy khi LLM off).

---

## 14. UAT & Definition of Done

### 14.1. Fixture

- Lead #5 (hoặc clone): B2B, có SĐT, funnel slug **một trong 3 pilot** (ưu tiên `dich-vu-seo-tong-the` nếu lead #5 đang SEO / đổi test lead).  
- Phiên nháp phone BANT 0.  
- Lead thứ 2 slug `quang-cao-google`.  
- Lead thứ 3 slug `thiet-ke-website`.  
- Lead thứ 4 slug `dich-vu-aeo` → form `_common`, Deal Bar vẫn hiện “AEO” nếu catalog có.

### 14.2. Kịch bản bắt buộc

| ID | Bước | Pass |
|----|------|------|
| UAT-1 | Mở `/crm/intake?lead_id=5` | Deal Bar: tên, dịch vụ, BANT; **không** 3 card full trước form |
| UAT-2 | Chưa chọn phiên | Sidebar + Deal Bar; Kit disabled hoặc “Tạo phiên” |
| UAT-3 | + Gọi điện | Session `service_slug` = slug bar, không `_common` nếu funnel pilot |
| UAT-4 | Tab Discovery SEO | Có `seo_domain`, không 12 câu “quan tâm SEO/Ads/Web?” |
| UAT-5 | Chip Câu tiếp theo | 1 câu + key; Áp dụng ghi `discovery_responses` |
| UAT-6 | Chip Gap-to-Go BANT 0 | Liệt kê 6 tiêu chí trống; không tự chấm |
| UAT-7 | Áp dụng bant_hints | Radio đổi **sau** confirm |
| UAT-8 | Tóm tắt 30s LLM off | `ai_summary` không chứa `[stub]` |
| UAT-9 | Complete Go ≥24 | Gate + M2 enqueue như cũ |
| UAT-10 | Mobile | Kit sheet; Deal Bar 1 dòng; Complete được |
| UAT-11 | Slug AEO | Form common; kit deep-dive báo chưa có playbook |
| UAT-12 | Hooks | Không crash auth (không hook sau early return) |
| UAT-13 | Admin upload Excel Q&A SEO, Duyệt | `parse_status=ready`, ≥1 chunk |
| UAT-14 | Chip Hỏi kho: “KH nói đắt” | Reply từ hàng Q&A + citation tên file |
| UAT-15 | Chip Bảng giá khi folder pricing trống | Empty-state, **không** bịa số |
| UAT-16 | AM upload PDF túi phiên | Chỉ lead đó retrieve được |
| UAT-17 | Ảnh + LLM off | `needs_ocr`, không vào RAG |
| UAT-18 | File MIME `.docx` | 400 `unsupported_type` |

### 14.3. DoD kỹ thuật

- Unit: `resolveIntakeServiceSlug`, `gapToGo`, 3 `getUiDefinition` slug, `win_intel` merge, sales-kit rules, **parse xlsx Q&A + pricing**, RAG filter tag.  
- E2E: happy path SEO (UAT-1→9) + UAT-13/14 (Excel fixture).  
- Không regress `intake-bant-phase25-stepper` gate · playbooks RAG CSKH.  
- CSS chỉ `intake-deal-bar` / `intake-kit` / `sales-kit-admin` dưới overlay hiện có.

---

## 15. Rủi ro

| Rủi ro | Xử lý |
|--------|-------|
| `IntakeContent.tsx` ~1000 dòng | Tách tab + kit; không rewrite autosave |
| LLM chậm trên call | Rules-first; timeout → stub_mode; 1 câu |
| AM đổi slug mất câu | Giữ answers; UI ẩn key lạ |
| Copilot prod off | Kit tĩnh vẫn ship (S2) |
| Lead #5 slug không pilot | UAT dùng lead test hoặc AM chọn SEO trên bar (chỉ session) |
| Trùng SCI / Kit | Deal Bar 1 dòng SCI; kit không dump talk track M1 |
| PDF scan không chữ | `needs_ocr` + hướng dẫn upload ảnh trang; không Tesseract |
| Excel lệch cột | Fail parse rõ ràng; seed file mẫu |
| Leak túi phiên | Filter `lead_id` + `session_id` bắt buộc |

---

## 16. Việc cố ý không làm tiếp (backlog)

- 9 form còn lại + red flags theo ngành BĐS/spa.  
- Kit ghi L2 / advance Consult.  
- Win-loop M4 học Q&A từ chốt/lost.  
- `.docx` / ZIP / OCR Tesseract.  
- Live suggest từng keystroke.  
- Đồng bộ slug session → funnel tự động.

---

## 17. Tài liệu sau khi ship

Cập nhật [27-lifecycle](../../huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md) mục Intake + [25-LMP](../../huong-dan-su-dung/25-lead-meeting-prep-ui-guide.md) § Intake card M2 (đổi thành Deal Bar chip). Không viết PDF mới trong slice S0.

---

## 18. Quyết định đã chốt trong spec

| # | Quyết định | Giá trị |
|---|------------|---------|
| D1 | Hướng UI | Deal Bar + tab + 3 slug pilot |
| D2 | Chatbot | Sales Kit riêng, không Lead Copilot |
| D3 | Áp dụng form | Text + gợi ý BANT, AM confirm |
| D4 | M2 timing | Vẫn sau Intake Go |
| D5 | LLM | Flag tách; S0–S2 không phụ thuộc prod Copilot |
| D6 | Context API | `GET /api/crm/intake/context` |
| D7 | Win intel | `answers_json.win_intel` 4 key |
| D8 | localStorage BANT checklist | Xóa khỏi Intake |
| D9 | Kho kiến thức | Folder org + túi phiên; RAG = Playbooks `category=sales_kit` |
| D10 | File đọc được | xlsx (exceljs) · pdf text · png/jpg/webp (vision nếu LLM) |
| D11 | Citation | Bắt buộc khi nêu giá / case / Q&A |
| D12 | Keyword Q&A | Chạy khi LLM off (S4 không phụ thuộc S3) |

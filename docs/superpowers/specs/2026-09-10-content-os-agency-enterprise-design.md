# Software Requirements Specification

# Content Marketing OS — Agency Enterprise (CMKT-E)

| Thuộc tính | Giá trị |
|---|---|
| Tên sản phẩm | PTT Content Marketing OS (CMKT-E) |
| Mã tài liệu | SPEC-CMKT-E-2026-09-10 |
| Phiên bản | **3.1 — Enterprise Upgrade (full depth)** |
| Thay thế | COS Agency Enterprise v2.0 (Downloads) · SPEC-CMKT-COS v2.1 (shell — **thu hồi**) · SPEC-CMKT-E 3.0 (bản rút gọn) |
| Trạng thái | Draft for Product, UX, Architecture, Security, Engineering |
| UI vận hành | [`../mocks/2026-09-10-content-os-agency-enterprise.html`](../mocks/2026-09-10-content-os-agency-enterprise.html) — chrome + IA 8 mục (**sản phẩm**). State thắng đăng/DAM/glossary: [`../mocks/2026-09-11-content-os-competitive-win.html`](../mocks/2026-09-11-content-os-competitive-win.html) (SPEC-CMKT-WIN) |
| Nền tảng kế thừa | Content Marketing OS M0–M16 trên lifecycle (`cmkt_*`, `/api/crm/service-lifecycle/:id/content-marketing`) |
| Hub đã ship | `/crm/content-os` |
| Pilot | `tiep-thi-noi-dung` → GA đa slug sau UAT enterprise |
| Ngôn ngữ | Tiếng Việt vận hành; đa locale/market trong mô hình dữ liệu |

**Thu hồi v2.1:** Bản “COS = vỏ / CMKT = SoR đủ” **sai**. CMKT hiện là **EXECUTE chưa đủ** (neo 1 lifecycle, thiếu Request/Rights/Matrix/Publish Gate/portfolio Command Center). CMKT-E **hấp thụ và nâng cấp** CMKT thành hệ điều hành nội dung agency. UI mockup v2 **là màn hình vận hành thật** — ops-web phải render đúng token, IA, nút và state của file HTML.

---

## 1. Mục đích và tuyên bố sản phẩm

### 1.1. Vấn đề

PTT Agency vận hành đa client, đa brand, đa kênh. CMKT hôm nay cho phép một đội **trong một lifecycle** làm idea → draft AI → review tuyến tính → calendar → mark published. Thiếu:

- Intake/triage request có completeness, effort, risk, SLA.
- Portfolio Command Center (throughput, capacity, risk queue toàn agency).
- Content Master + deliverable/variant + architecture.
- Copy governance (block type, claim highlight, version lock, material change).
- DAM rights, expiry, territory, paid vs organic, accessibility bắt buộc.
- Approval matrix động, package bất biến, quorum, delegate, client evidence.
- Publish Gate, collision, channel health, retry, publication package.
- Intelligence có approve/reuse vào brief và Copilot.
- Capacity, critical path, escalation, RACI.

Hệ quả: Slack + Drive + “duyệt miệng”, sai version, sai rights, trễ SLA, không audit khi tranh chấp.

### 1.2. Tuyên bố

**CMKT-E là hệ điều hành nội dung của PTT Agency.** Một Content Item là đối tượng điều hành: Request, Brief, Architecture, Copy, Asset/Rights, SEO/Distribution, Production/SLA, Approval Package, Publication, Performance, Audit.

CMKT hiện tại là **nền** (item, idea, pillar, job AI, review, calendar, media, bridge SEO/Email, intelligence thô). CMKT-E **mở rộng schema, API, UX** — không clone kho content thứ hai, không bỏ Planner snapshot, không gộp Creative OS / Video SOP.

### 1.3. Mục tiêu kinh doanh

| ID | Mục tiêu | Chỉ số gợi ý |
|---|---|---|
| BG-01 | Chuẩn hóa intake → publish trên toàn agency | ≥ 90% content đi qua Request hoặc Idea có nguồn |
| BG-02 | Giảm lead time request → first publish | P50 lead time −30% sau 90 ngày GA |
| BG-03 | First-pass approval | ≥ 80% internal first-pass |
| BG-04 | SLA visible, escalate sớm | 0 publish khi SLA breach chưa escalate |
| BG-05 | Zero publish sai version / sai rights | 100% publication gắn snapshot + rights Valid |
| BG-06 | Tái sử dụng master → variant | ≥ 3 derivatives / master campaign asset |
| BG-07 | Audit tranh chấp | Mọi approve/publish/override có evidence 7 năm |
| BG-08 | AI hỗ trợ, không thay human | 0 AI approve / AI publish |

### 1.4. Mục tiêu sản phẩm

- **Một sản phẩm, một UI:** sidebar COS + 8-tab Production Workspace đúng mockup.
- **Portfolio + lifecycle:** Command Center xem nhiều client; workspace vẫn neo lifecycle/contract.
- **Approval Matrix + Publish Gate** là cứng, không optional cosmetic.
- **AI Copilot grounded:** Brand Kit + Brief + library approved + insight approved; mọi action có AI Trace.
- **Handoff studio:** carousel/ảnh CMKT Media AI; TVC → `/crm/video`; brand kit/batch → `/crm/creative-os`.

### 1.5. Ngoài phạm vi (cố định)

Pixel editor; payroll creator; ad buying/bidding; social listening đầy đủ; auto-post mọi MXH khi chưa có connector + human confirm; thay DAM/CMS khách; bịa client AM 360; bật `CP_AI_ENABLED` như “fix Video AI”; đổi `QC_CHECK_KEYS` Lead pack.

---

## 2. Hiện trạng CMKT — gap enterprise

API prefix giữ: `/api/crm/service-lifecycle/:lifecycleId/content-marketing/*`.

### 2.1. Đã có (tái sử dụng, không phá)

| Năng lực | Ghi chú |
|---|---|
| Context + flags | `enabled`, counts, brief/client/media flags |
| Planner snapshot | ingest / seal / drift |
| Ideas + convert | `source`, channel/format pair |
| Items | `brief_json`, `body_json`, variants, versions, comments, assignees |
| AI jobs | draft, variants, regenerate, ideas-bulk, media jobs |
| Review | submit / approve / reject (≥10 ký tự) / client submit-approve-reject |
| Calendar | slot + schedule |
| Publish | `POST .../publish` + `published_url` — **human mark**, không connector |
| Production JSON | patch / done / escalate-human |
| Media | image, carousel, visual QA/review, video short/storyboard/render |
| Bridge | SEO, Email |
| Intelligence | summary, suggestions, metrics, weekly memo |
| Audit | append rows |
| Caps | `crm_content.view/write/generate/approve_internal/qa/publish/assign/production` |
| Hub | `/crm/content-os` list lifecycle |

### 2.2. Thiếu — phải nâng cấp

| Gap | Hậu quả vận hành | Hạng mục CMKT-E |
|---|---|---|
| Neo 1 lifecycle, không portfolio | Không thấy 17 SLA / 24 request toàn agency | Command Center + query đa lifecycle |
| Không Content Request | Intake qua Idea, thiếu triage/effort/SLA | Entity `content_request` + màn Intake |
| Item = 1 channel/format | Không Master + deliverable map | `content_master` + `deliverable` / parent graph |
| Brief không score/lock | Gửi duyệt khi thiếu disclaimer | Completeness + section lock |
| Copy không block-type / claim engine | “wellness” lọt client | Copy blocks + restricted lexicon |
| Không Asset Rights | Publish ảnh hết hạn paid | `asset_rights` + gate |
| Review tuyến tính 1 step | Không Legal/AD/Client song song | Approval workflow + matrix rules |
| Không Approval Package | Client duyệt bản đã sửa | Immutable snapshot |
| Calendar ≠ Publication | Không queue/retry/collision | `publication` + gate + collision |
| Intelligence không approve | AI nuốt insight draft | Insight status + whitelist Copilot |
| Không capacity/RACI/critical path | Design 92% im lặng | Task engine |
| UI = tab Content Board | Không phải cách agency làm việc | **Thay UX bằng mockup v2** |

### 2.3. Nguyên tắc nâng cấp

1. **Evolve in place:** thêm bảng/cột/API; không rename prefix lifecycle.
2. **Portfolio read** thêm `/api/crm/content-os/portfolio/*` (lọc theo cap + lifecycle scope).
3. **Item cũ** map 1–1 sang Deliverable; Master tạo khi user “Promote to master” hoặc khi convert request → package.
4. **UI mới thay Content Board** trên route `/crm/content-os` và `/crm/content-os/w/:itemId`. Tab `?tab=content-os` trên lifecycle **redirect** vào shell COS với context lifecycle đó.
5. **Mockup HTML là contract UX.** Mọi màn/nút trên HTML phải có FR và handler. State HTML (`localStorage cmkte-ops-v3`) = hành vi prod.

### 2.4. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| Organization | Tenant agency cấp cao; ví dụ PTT Agency Vietnam |
| Business Unit | Delivery unit trong Organization; có thể có capacity/workflow riêng |
| Client | Khách hàng agency (`agency_client` / contract) |
| Brand | Thương hiệu thuộc Client; nguồn Brand Kit / voice / restricted lexicon |
| Market / Locale | Thị trường + ngôn ngữ, ví dụ Vietnam / vi-VN |
| Campaign | Chiến dịch gắn objective, thời gian, brand; có thể nối Planner snapshot |
| Lifecycle | Hợp đồng dịch vụ đã có (`service_lifecycle`); neo EXECUTE hiện tại |
| Content Request | Intake chuẩn từ Account / Client Portal / automation — **CMKT chưa có** |
| Content Brief | Đầu vào chiến lược versioned; nâng `brief_json` |
| Content Master | Đối tượng điều hành gốc; một request có thể sinh nhiều master |
| Deliverable | Sản phẩm bàn giao (carousel, blog, reel…); nâng `cmkt_item` |
| Variant | Bản theo channel / locale / persona / format |
| Asset / DAM | Tài sản số; CMKT-E orchestration, không thay DAM khách |
| Rights | License, kênh, lãnh thổ, expiry, release, AI declaration |
| Production Plan | Task + RACI + dependency + SLA; nâng `production_json` |
| Approval Package | Snapshot bất biến gửi duyệt |
| Publish Gate | Điều kiện cứng trước khi vào queue |
| Publication | Sự kiện xuất bản trên một channel account |
| Insight | Pattern + evidence + confidence; chỉ Approved vào Copilot |
| AI Trace | Prompt intent, sources, model, output, policy, apply/discard |

---

## 3. Người dùng, RACI, quyền

### 3.1. Vai trò chuẩn (COS v2.0 + map cap CMKT)

| Vai trò | Công việc trên UI mockup | Cap tối thiểu E0 | Mở rộng E1+ |
|---|---|---|---|
| Platform Super Admin | Governance Settings, audit export, tenant policy | admin + `crm_content.*` | `workflow.rule.manage` |
| Organization Admin | User, role, client, brand, template, retention | admin | SCIM E3 |
| Content Operations Manager | Command Center, capacity, escalation | `view` + `assign` | `task.reassign` |
| Account Director | Triage, scope, escalate client | `view` + `write` | `approval.approve` AD |
| Account Manager | Request, package, publish coordination | `write` | `publication.schedule` |
| Content Lead | Brief lock, copy approve, insight approve | `approve_internal` | `insight.approve` |
| Copywriter / Content Executive | Workspace tab 1–3, task update | `write` | — |
| Art Director | Visual / brand compliance | `approve_internal` | creative scope |
| Designer / Motion | Tab Assets, Media AI | `write` + `production` | — |
| SEO Specialist | Tab SEO, bridge | `write` | — |
| Social / Community | Publication Control, caption, mark published | `publish` | `publication.retry` E2 |
| Media / Performance | Paid handoff, UTM | `view` + `write` | — |
| Legal / Compliance | Approval scope Legal | `qa` | `crm_content.legal` E1 |
| Client Admin | User portal theo Brand/Campaign | portal admin | — |
| Client Approver | Package only | portal token / client_gate | — |
| Viewer / Auditor | Read + export nếu được cấp | `view` | `audit.export` |
| AI Service | Jobs only | service account | **cấm** approve/publish |

### 3.2. RBAC + ABAC

- Truy cập item = Organization ∧ (lifecycle trong board scope) ∧ Client/Brand trên contract ∧ Market/Campaign ∧ classification.
- Client không thấy internal note, cost, hidden rule, AI prompt thô.
- Legal chỉ approve scope legal/compliance — không mặc định approve creative/budget.
- Segregation of duties: creator không final-approve nếu tenant bật (BR-050).
- Sensitive: publish, delete, rule update, rights override, audit export — step-up / lý do bắt buộc.
- Delegate approver: cửa sổ thời gian + scope; hết hạn tự thu.

### 3.3. Permission groups (map cap cũ → fine-grain)

**E0 map vào `crm_content.*` hiện có:** `view` → read; `write` → request/item/copy; `generate` → AI; `approve_internal` → internal step; `qa` → legal/visual; `publish` → schedule + mark published; `assign` → owner/task; `production` → production_json / asset.

**E1+ tách nếu thiếu (không phá cap cũ):**

- `content.request.create` / `triage` / `assign`
- `content.item.create` / `read` / `update` / `archive`
- `content.copy.edit`, `content.variant.create`, `content.version.compare`, `content.change.accept`
- `asset.attach`, `asset.upload`, `asset.rights.manage`, `asset.rights.override`
- `seo.edit`, `distribution.edit`, `tracking.edit`
- `task.create` / `assign` / `reassign` / `complete`
- `approval.submit` / `review` / `approve` / `reject` / `request_changes` / `delegate`
- `publication.schedule` / `publish` / `cancel` / `retry`
- `workflow.rule.manage`, `template.manage`, `brandkit.manage` (kit = Creative OS)
- `audit.read` / `export`, `report.read`
- `ai.generate` / `apply_output` / `view_trace` / `policy.manage`
- `insight.approve`

---

## 4. Kiến trúc thông tin — UI = mockup vận hành

Route prod (thay IA tab-only):

| Màn mockup | Route ops-web | Dữ liệu |
|---|---|---|
| Command Center | `/crm/content-os` | Portfolio aggregates |
| Content Requests | `/crm/content-os/requests` | Requests + ideas chưa convert |
| Production Workspace | `/crm/content-os/w/:itemId` | Master/item + 8 tab |
| Approval Center | `/crm/content-os/approvals` | Steps của user/queue |
| Publication Control | `/crm/content-os/calendar` | Publications tuần |
| Brand & Asset Library | `/crm/content-os/library` | Kits + assets + rights |
| Content Intelligence | `/crm/content-os/intelligence` | Insights |
| Governance Settings | `/crm/content-os/settings` | Flag, matrix, calendar |

Deep link lifecycle: `/crm/content-os?lifecycle=:id` lọc portfolio.  
Cũ: `/crm/service-delivery/:id?tab=content-os` → redirect workspace/hub COS.

### 4.1. Chrome (bắt buộc đúng mockup)

- Sidebar 258px `#101a30`, nhóm CONTENT OPERATIONS + LIBRARIES & INSIGHT, badge số thật.
- Workspace chip org; help **Content Ops Assistant** (risk/SLA/collision — Phase B bot, Phase A rule-based).
- Top: breadcrumb `Content Marketing OS / {màn}`, search ID/client/campaign/asset, notification, overflow, avatar.
- Desktop-first; <1100px sidebar collapse (CSS gốc).
- Status = **nhãn chữ + màu**.

### 4.2. Production Workspace (trái tim vận hành)

1. Header: tên, `CNT-*`, version, status, `CR-*`, **Lưu snapshot**, **Version compare**, ••• (archive, handoff Video SOP, Creative OS).
2. Context bar 6 ô: Org/BU, Client/Brand, Market, Campaign/Request, Owner/AM, Risk + SLA.
3. 8 tab đúng thứ tự mockup; canvas + panel 345px.
4. Sticky: auto-save · Previous · Save & validate · Next / **Send to approval**.
5. Đổi tab không mất draft (debounce persist).

### 4.3. Mọi màn phải có state

Loading, empty, 403, no search, unsaved, autosave fail, validation, SLA at risk/breach, publish blocked, integration error. HTML mockup mô phỏng các state này bằng dữ liệu mẫu + hành vi nút.

---

## 5. Mô hình dữ liệu nâng cấp

### 5.1. Quan hệ

```text
Organization
 └─ Business Unit
     └─ Client (agency_client)
         └─ Brand (+ brand_kit_version)
             └─ Market / Locale
                 └─ Campaign / Marketing Plan
                     └─ Lifecycle (service_slug)          ← đã có
                         ├─ Plan Snapshot (sealed)        ← đã có
                         ├─ Content Request (MỚI)
                         │    └─ Content Master (MỚI; hoặc promote từ item)
                         │         ├─ Brief / Architecture (versioned)
                         │         ├─ Deliverable ── Variant (item CMKT nâng)
                         │         ├─ AssetLink + AssetRights (MỚI)
                         │         ├─ SEO / Distribution / Tracking
                         │         ├─ ProductionTask + Dependency (nâng production_json)
                         │         ├─ ApprovalWorkflow + Package (MỚI)
                         │         ├─ Publication (MỚI; calendar slot là bản nháp)
                         │         ├─ PerformanceRecord + Insight
                         │         └─ AuditEvent
                         ├─ Idea / Pillar                 ← giữ
                         └─ Job (AI / media)              ← giữ
```

### 5.2. Entity bắt buộc (tóm tắt thuộc tính)

Giữ UUID nội bộ. Mã hiển thị immutable: `CR-YYYYMMDD-XXX`, `CNT-`, `DLV-`, `APR-`, `PUB-`.

| Entity | Thuộc tính then chốt | Nguồn |
|---|---|---|
| ContentRequest | source, requester, client, brand, deliverable_ask, objective, due_at, priority, risk, completeness, effort_h, tier, triage_status | **Mới** |
| ContentMaster | content_code, request_id, campaign_id, lifecycle_id, owner_id, am_id, status, classification, risk_level | **Mới** hoặc promote item |
| ContentBrief | objective, funnel, persona, tier, smm, proofs[], restricted[], disclaimer, kpi, completeness, locked_sections | nâng `brief_json` |
| ContentArchitecture | pillar, framework, emotion, cta, angle, dependencies[] | nâng pillar + JSON |
| Deliverable | type, channel, locale, format, owner, sla_h, parent_master_id | nâng `cmkt_item` |
| ContentVariant | locale, copy_blocks, char_count, version | nâng `body_json` |
| AssetLink | asset_ref, role, crop, dam_collection | nâng `media_json` |
| AssetRights | license, channels[], territory, expiry, releases, ai_declaration, paid_ok | **Mới** |
| ProductionTask | raci, dependency_type, sla, effort, capacity_load | nâng `production_json` |
| ApprovalWorkflow / Step / Package | template, scope, quorum, snapshot_id, decision, evidence | **Mới** |
| Publication | channel_account, schedule_at, tz, gate_result, execution_mode, retry | **Mới** |
| Insight | pattern, evidence, confidence, status, scope, expiry | nâng intelligence |
| AiTrace | actor, intent, sources[], model, output_ref, policy, applied | nâng `ai_agent_runs` |
| AuditEvent | actor, entity, action, before/after, ip, correlation | nâng audit |

**Tương thích:** `cmkt_item` nhận `master_id`, `display_code`, `risk_level`. Hàng cũ: `master_id` null, tự coi là deliverable đơn.

### 5.3. Lifecycle trạng thái

**Request:** `Submitted` → `Needs Clarification` → `Triaged` → `Accepted` → `Converted` → `Cancelled`/`Rejected`.

**Master / Item (thống nhất hiển thị COS):**  
`Draft` → `Brief Ready` → `In Production` → `Internal Review` → `Client Review` → `Approved` → `Scheduled` → `Publishing` → `Published` → `Archived`.  
Phụ: `Blocked`, `On Hold`, `Changes Requested`, `SLA At Risk`, `SLA Breached`.

Map CMKT: `draft` / `in_review` / `pending_client` / `approved_internal` / `client_approved` / `scheduled` / `published` / `changes_requested`.

**Approval step:** `Pending` → `Active` → `Approved` | `Approved With Conditions` | `Changes Requested` | `Rejected` | `Skipped` | `Expired` | `Delegated`.

**Publication:** `Draft` → `Scheduled` → `Queued` → `Publishing` → `Published` | `Failed` | `Cancelled` | `Retrying`.

**Insight:** `Draft` → `Approved` | `Rejected` | `Outdated` | `Superseded`.

---

## 6. Yêu cầu chức năng

Quy ước: **Keep** = API CMKT giữ; **Upgrade** = sửa/đắp; **New** = xây.

### 6.1. FR-CMD Command Center

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-CMD-001 | New | Dashboard theo Org/BU/Client/Brand/Campaign/Market/khoảng thời gian. |
| FR-CMD-002 | New | Tile: throughput tuần, WIP theo stage, first-pass %, SLA at risk, SLA breached, publish readiness, capacity %, blocked. Số **thật**; 0 lifecycle = empty. |
| FR-CMD-003 | New | Risk queue sort: SLA urgency, risk, critical path, campaign priority, publish date. |
| FR-CMD-004 | New | Mỗi risk: reason, entity, owner, SLA remaining, recommended action, deep link. |
| FR-CMD-005 | New | Breakdown Client/Brand/Campaign/Type/Channel/Team/Assignee/Risk. |
| FR-CMD-006 | New | Drill-down KPI → danh sách nguồn. |
| FR-CMD-007 | Upgrade | Insight tuần từ Intelligence **Approved**; không hiện draft cho Copilot. |
| FR-CMD-008 | Keep | Nút **＋ Tạo Content Item** / **Mở Publication Control** / **Mở Approval Center** đúng mockup. |

### 6.2. FR-REQ Intake

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-REQ-001 | New | Tạo Request tay, portal, API. Form dynamic theo type/client/brand/market/template. |
| FR-REQ-002 | New | Bắt buộc: requester, client, brand, deliverable, objective, due, priority, source. |
| FR-REQ-003 | New | Completeness Score theo weight template. |
| FR-REQ-004 | New | `Needs Clarification` + danh sách câu hỏi. |
| FR-REQ-005 | New | Triage: effort, tier, risk, SLA, campaign, owner gợi ý. |
| FR-REQ-006 | New | Accepted → Create Content Item/Master; giữ link `request_id`. |
| FR-REQ-007 | Keep | Idea + Planner import vẫn là nguồn; Idea có thể gắn `request_id`. |
| FR-REQ-008 | New | Filter source / risk / date; Export queue (CSV Phase B). |
| FR-REQ-009 | Keep+ | **Triage & create**, **Assign Legal**, **Create package** đúng mockup. |

### 6.3. FR-CTX Context bar

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-CTX-001 | New | Production Workspace có Global Context Bar cố định trong vùng nội dung. |
| FR-CTX-002 | New | 6 ô: Org/BU, Client/Brand, Market/Locale, Campaign/Request, Owner/AM, Risk + SLA realtime. |
| FR-CTX-003 | New | Đổi context qua selector có search; mỗi lần đổi = audit event. |
| FR-CTX-004 | New | Cảnh báo khi thiếu Client, Brand, Market hoặc Campaign theo template. |
| FR-CTX-005 | New | Bar phản ánh SLA và publish-gate cấp cao realtime. |

### 6.4. FR-BRF Brief & Strategy

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-BRF-001 | Upgrade | Tạo + version hóa Brief trên `brief_json` + cột score/lock. |
| FR-BRF-002 | Upgrade | Template: objective, funnel, persona, market/locale, tier, SMM, proofs, mandatory, restricted, prohibited wording, disclaimer, CTA, KPI, refs. |
| FR-BRF-003 | New | Field bắt buộc cấu hình theo type / client / brand / market / tier / risk. |
| FR-BRF-004 | New | Brief Completeness Score + danh sách field thiếu (mockup: 13/15). |
| FR-BRF-005 | New | Khóa section sau approve; sửa sau lock = version hoặc change request. |
| FR-BRF-006 | Keep+ | Attach tài liệu / guideline / link (media + comment hiện có). |
| FR-BRF-007 | New | Policy từ brief: regulated / health claim → chèn Legal. |

### 6.5. FR-ARC Architecture

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-ARC-001 | Upgrade | Pillar, angle, framework, emotion, CTA, distribution intent, dependency — nâng pillar + JSON. |
| FR-ARC-002 | New | Deliverable Plan: type, channel, locale, persona, format, owner, SLA, dependency. |
| FR-ARC-003 | New | Master → variant map (1 narrative → nhiều channel/locale/format). |
| FR-ARC-004 | New | Dependency giữa deliverable, task, asset. |
| FR-ARC-005 | New | Cảnh báo thiếu owner / format / channel / locale / deadline. |
| FR-ARC-006 | New | Architecture template theo content type / campaign category. |

### 6.6. FR-COPY Copy Studio

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-COPY-001 | Upgrade | Rich/block editor Master + Variant — nâng `body_json`. |
| FR-COPY-002 | Upgrade | Heading, B/I/U, list, link, quote, block, inline comment, mention, placeholder. |
| FR-COPY-003 | New | Block type: Hook, Body, Proof, CTA, Disclaimer, Hashtag, Link, Metadata. |
| FR-COPY-004 | New | Word/char count, reading time, channel limit (FB 2.200…). |
| FR-COPY-005 | Keep+ | Variant theo channel/locale/persona/format. |
| FR-COPY-006 | Keep+ | Version snapshot, diff, accept/reject, lý do — nâng versions. |
| FR-COPY-007 | Keep | Comment cấp item / deliverable / variant / range. |
| FR-COPY-008 | Upgrade | Mention, assign, resolve/reopen. |
| FR-COPY-009 | New | Lock version khi gửi Approval Package. |
| FR-COPY-010 | New | Sửa sau approved → revision + re-approval theo change class. |
| FR-COPY-011 | New | Highlight restricted phrase theo Brand Kit / Brief / policy. |
| FR-COPY-012 | New | Localization memory / glossary — Wave E3. |

Nút Copilot mockup (bắt buộc parity): **A/B Hooks**, **Rewrite channel**, **Extract claims**, **Voice check**.

### 6.7. FR-AI Copilot

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-AI-001 | Keep | Context chỉ trong ACL user + org. |
| FR-AI-002 | Upgrade | Sources: Brand Kit approved, brief, library approved, glossary, insight **Approved**. |
| FR-AI-003 | Keep+ | Actions: outline, master, variants, rewrite channel, shorten/expand, A/B hooks, localize, extract claims, voice check, compliance, SEO entity, CTA, summarize feedback. |
| FR-AI-004 | Upgrade | AI Trace: actor, time, intent, sources, model, output_ref, policy, applied/rejected — nâng `ai_agent_runs`. |
| FR-AI-005 | Keep | Output = draft; không ghi đè approved; không tự publish. |
| FR-AI-006 | Keep+ | Apply all / partial / discard — từng bước audit. |
| FR-AI-007 | New | Label AI-assisted khi policy client/org yêu cầu. |
| FR-AI-008 | Keep+ | Guardrail: restricted claim, prohibited phrase, PII, tone (BR-AI-01). |
| FR-AI-009 | New | Violation = warning/blocker; human quyết. |
| FR-AI-010 | New | Admin model routing theo tenant / use case / sensitivity / cost — E2. |

**Cấm AI:** approve, reject, publish, override rights, xóa.

### 6.8. FR-AST Assets, DAM & Rights

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-AST-001 | Upgrade | Đính DAM / upload / URL kiểm soát — nâng `media_json`. |
| FR-AST-002 | New | Role: Hero, Carousel, Thumbnail, Video, Logo, Illustration, Supporting, Audio, Document, Reference. |
| FR-AST-003 | New | Crop: 1:1, 4:5, 9:16, 16:9, 1.91:1. |
| FR-AST-004 | Upgrade | Version, collection, owner, checksum/ref, approval nếu DAM hỗ trợ. |
| FR-AST-005 | New | Rights: license, channels, territory, start/end, expiry, attribution, model/property release, restriction, AI declaration, evidence. |
| FR-AST-006 | New | Compatibility với channel, market, publish date, paid/organic. |
| FR-AST-007 | New | Rights Alert: hết hạn, sắp hết, sai territory/channel, thiếu release. |
| FR-AST-008 | New | `Invalid` / `Unknown` trên asset bắt buộc → **block Publish Gate**. |
| FR-AST-009 | New | Alt, caption, transcript, subtitle, audio description. |
| FR-AST-010 | New | Completeness a11y theo asset type + channel. |
| FR-AST-011 | New | Override = permission + reason + evidence + audit. |

### 6.9. FR-SEO Distribution & Tracking

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-SEO-001 | Keep+ | Title, meta, slug, canonical, keyword, entity, internal link, FAQ, schema — bridge SEO. |
| FR-SEO-002 | New | SERP preview. |
| FR-SEO-003 | New | SEO Quality Score hỗ trợ, không thay review. |
| FR-SEO-004 | New | Intent chips: Organic Social, Website SEO, Paid Handoff, CRM, Email, Sales Enablement. |
| FR-SEO-005 | New | Plan: channel account, format, audience, frequency, schedule, collision. |
| FR-SEO-006 | New | Collision: brand, channel, audience, pillar, time window, frequency cap. |
| FR-SEO-007 | New | UTM builder + validation + preview URL. |
| FR-SEO-008 | New | URL health: syntax, HTTPS, domain, HTTP status, redirect, tracking event. |
| FR-SEO-009 | Keep+ | Immutable handoff Media / CRM / CMS / Email. |

### 6.10. FR-PROD Production Plan

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-PROD-001 | Upgrade | Sinh plan từ template (type, tier, risk, deliverable, campaign) — nâng `production_json`. |
| FR-PROD-002 | Upgrade | Task: type, title, parent, assignee, RACI, status, priority, start/due, SLA, effort, dependency. |
| FR-PROD-003 | New | Dependency FS / SS / FF + manual blocker. |
| FR-PROD-004 | New | Critical path → task làm trễ publish/approval. |
| FR-PROD-005 | New | Capacity user / role / team / BU / thời gian. **Prod không bịa số.** |
| FR-PROD-006 | New | Cảnh báo vượt threshold 80 / 90 / 100. |
| FR-PROD-007 | New | Gợi ý assignee theo skill, ACL, capacity, SLA. |
| FR-PROD-008 | Keep+ | Comment, attach, mention, checklist, estimate/actual (nếu bật). |
| FR-PROD-009 | New | SLA timer theo calendar + timezone team/tenant. |
| FR-PROD-010 | Upgrade | Reminder 75%, At Risk 90%, breach + escalate; auto-reassign có điều kiện (mặc định **tắt**). |
| FR-PROD-011 | New | Block / critical-path at risk → cập nhật risk item + notify. |

### 6.11. FR-APR Approval & Governance

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-APR-001 | Upgrade | Workflow từ template + rules — nâng review tuyến tính hiện có. |
| FR-APR-002 | New | Matrix condition: org/BU/client/brand/campaign/market/type/tier/budget/risk/claim/rights/intent/channel. |
| FR-APR-003 | New | Rule action: thêm/bỏ/reorder step, đổi pool, SLA, gate, evidence. |
| FR-APR-004 | New | Step scope: Strategy, Copy, Creative, Rights, Legal, SEO, Tracking, Paid, Schedule, Full. |
| FR-APR-005 | Keep+ | Approve / With Conditions / Request Changes / Reject / Delegate / Abstain. |
| FR-APR-006 | Keep | Comment bắt buộc khi reject / changes / conditions (≥ 10 ký tự). |
| FR-APR-007 | New | Parallel group + sequential step. |
| FR-APR-008 | New | Quorum: all / any / N of M — E2. |
| FR-APR-009 | New | Delegate: thời hạn, scope, reason — E2. |
| FR-APR-010 | New | Approval Package bất biến: snapshot copy/asset/rights/meta/disclaimer/checklist. |
| FR-APR-011 | Keep+ | Client portal: xem package, annotate, approve / changes / reject. |
| FR-APR-012 | Keep | Portal không lộ internal note, cost, hidden rule, AI prompt. |
| FR-APR-013 | New | Lock version khi submit; sửa = revision. |
| FR-APR-014 | New | Re-approval scope theo change class. |
| FR-APR-015 | New | SLA reminder + escalate internal và client. |
| FR-APR-016 | Upgrade | Approval Center queue + filter; **Create approval batch** E2. |
| FR-APR-017 | New | Evidence: identity, time, decision, snapshot_id, comment, IP/device nếu policy. |

### 6.12. FR-PUB Publication & Publish Gate

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-PUB-001 | New | Một Publication / deliverable / channel account. |
| FR-PUB-002 | New | Channel, account, format, schedule_at, tz, variant, assets, URL, UTM, snapshot, mode. |
| FR-PUB-003 | Upgrade | Schedule timezone rõ — nâng calendar slot. |
| FR-PUB-004 | New | Mode: connector \| handoff package \| manual task. E0–E1: handoff + **Mark published**. Connector E3. |
| FR-PUB-005 | New | Gate: brief, approval, legal, rights, a11y, SEO/tracking, URL, version lock, account health. |
| FR-PUB-006 | New | Result: Pass / Warning / Blocked. **Blocked không vào queue.** |
| FR-PUB-007 | New | Mỗi violation: rule source, severity, owner, remediation, override policy. |
| FR-PUB-008 | New | Collision trước lock schedule. |
| FR-PUB-009 | New | Retry: count, interval, fallback, notify, manual — E2. |
| FR-PUB-010 | Keep+ | Execution log, API/ref, attempted/published, error, retry, post ID — nâng `published_url`. |
| FR-PUB-011 | New | Cancel/reschedule; ngoài window / đổi account → có thể re-approve. |
| FR-PUB-012 | New | Immutable Publication Package trước queue. |

### 6.13. FR-INT Intelligence

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-INT-001 | Keep+ | Import metric theo Publication / Channel / Date — nâng intelligence raw. |
| FR-INT-002 | New | reach/impression, engagement, ER, click, CTR, video view, VTR, lead, conversion, CR, cost nếu có. |
| FR-INT-003 | New | Cắt Brand/Campaign/Pillar/Angle/Hook/Channel/Format/Persona/Market/Window/Variant. |
| FR-INT-004 | New | Insight: pattern, evidence, n, confidence, owner, scope, recommendation, expiry. |
| FR-INT-005 | New | Approved → gắn Brief/Architecture template + Copilot context. |
| FR-INT-006 | New | Copilot **chỉ** insight Approved còn hạn đúng scope. |
| FR-INT-007 | New | Outdated / Rejected / Superseded. |

### 6.14. FR-AUD Audit, notify, report

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-AUD-001 | Keep+ | Append-only create/update/archive/status/approval/publish/rights override/AI/permission. |
| FR-AUD-002 | Upgrade | actor, action, entity, time, before/after, IP/device, correlation, source UI/API/System/AI. |
| FR-AUD-003 | New | Search theo entity, actor, action, date, client, brand, campaign, correlation. |
| FR-AUD-004 | New | Export = quyền riêng; bản thân export bị audit. |
| FR-AUD-005 | Keep+ | Notify in-app + email E0; webhook E2. |
| FR-AUD-006 | New | Trigger: assign, mention, SLA, escalate, approval, publish, rights expiry, integration error. |
| FR-AUD-007 | New | Preference user trong giới hạn policy org. |
| FR-AUD-008 | New | Báo cáo CSV/XLSX/PDF theo module. |

### 6.15. FR-LIB Library / FR-SET Settings

| ID | Loại | Yêu cầu |
|---|---|---|
| FR-LIB-001 | New | Màn Brand & Asset Library trên COS (không clone DAM). |
| FR-LIB-002 | Keep | Deep link Creative OS Brand Kits khi có `crm_cp.view`. |
| FR-LIB-003 | New | Tab kits / approved assets / rights expiring. |
| FR-SET-001 | Keep | Flag Content Marketing FE + caps. |
| FR-SET-002 | Keep | Approval required; client gate. |
| FR-SET-003 | New | Connector publish **mặc định tắt**. |
| FR-SET-004 | New | Auto-reassign capacity **mặc định tắt**. |
| FR-SET-005 | New | Matrix template + publish gate policy — admin. |

---

## 7. Quy tắc nghiệp vụ

### 7.1. Context và ownership

- **BR-001:** Content Item thuộc đúng một Organization và ít nhất một Client/Brand trước `In Production`.
- **BR-002:** Có Content Owner + Account Owner từ `Brief Ready`.
- **BR-003:** Nhiều Market → variant và publication riêng theo locale.
- **BR-004:** Không quyền Brand = không thấy item, kể cả khi biết ID.

### 7.2. Brief, copy, version

- **BR-010:** Không Internal Review nếu Brief Completeness < threshold template; mặc định 80% standard / 95% brand-sensitive hoặc regulated.
- **BR-011:** Mandatory Message, Restricted Claim, Disclaimer, Market/Locale đóng băng trong Approval Package.
- **BR-012:** Đổi block Disclaimer / Claim / CTA / Destination URL / Asset sau final = `Material Change`.
- **BR-013:** Material Change → version mới + re-approval theo matrix.
- **BR-014:** Typo có thể waive nếu policy brand + audit reason.

### 7.3. AI

- **BR-020 / BR-AI-01:** AI không approve, reject, publish, override right, xóa.
- **BR-021:** Output không phải approved cho đến khi human apply + workflow xong.
- **BR-022:** AI không lấy data ngoài ACL actor.
- **BR-023:** Restricted claim tiềm năng → `Human Review Required`.
- **BR-024:** Prompt + context trace theo retention org.

### 7.4. Asset rights

- **BR-030:** Asset bắt buộc `Valid` tại schedule **và** publish.
- **BR-031:** Channel, territory, expiry khớp account, market, schedule.
- **BR-032:** AI-generated cần declaration nếu Brand yêu cầu.
- **BR-033:** Người nhận diện được → model release khi rule yêu cầu.
- **BR-034:** Override = permission + reason + evidence + approver.

### 7.5. SLA, task, capacity

- **BR-040:** Timer theo business calendar + timezone team/tenant.
- **BR-041:** 75% reminder; 90% At Risk; quá = Breached + escalate.
- **BR-042:** Critical path = delay làm trễ publish hoặc approval deadline.
- **BR-043:** Capacity: Warning 80%, At Risk 90%, Overloaded 100% (org cấu hình lại).
- **BR-044:** Auto-reassign không vượt role / security boundary.

### 7.6. Approval và publish

- **BR-050:** Creator không final-approve nếu tenant bật SoD.
- **BR-051:** Request Changes mở revision và pause step sau.
- **BR-052:** Approve With Conditions: bước tiếp chỉ khi condition resolved hoặc risk acceptance đúng policy.
- **BR-053:** Parallel `All Required` = tất cả; `Quorum` = N tối thiểu.
- **BR-054:** Client evidence gắn `snapshot_id`; không áp sang version khác.
- **BR-055:** Queue chỉ khi Pass hoặc Warning + override đúng role.
- **BR-056:** Blocked không override UI thường; chỉ role override + reason/evidence + audit.
- **BR-057:** Đổi lịch ngoài window hoặc đổi channel account sau approval có thể re-approve.

**CMKT giữ nguyên:** BR-CMKT-01 (human publish), reject ≥ 10 ký tự, BR-CMKT-06/08 visual QA.

---

## 8. Luồng vận hành (đúng nút mockup)

### 8.1. Luồng A — Request → Item

1. Account / Client Portal / API / **＋ Tạo Content Item** / **＋ Tạo request** mở modal intake.
2. Hệ thống tính Completeness Score theo template.
3. Ops/AM triage: scope, risk, effort, tier, SLA, owner.
4. Thiếu dữ liệu → `Needs Clarification` + câu hỏi.
5. **Triage & create** / **Create package** khi Accepted.
6. Sinh Master, Brief draft, context, Production Plan sơ bộ, mã `CR-*` / `CNT-*`.
7. Audit conversion + `request_id`.

### 8.2. Luồng B — Brief → Production

1. Owner hoàn Brief → score + policy.
2. Lead xác nhận nếu template yêu cầu.
3. Architecture + Deliverable Plan.
4. Task / capacity / critical path.
5. Copy Studio + variants + **Lưu snapshot** / **Version compare**.
6. Assets + rights + a11y.
7. SEO / distribution / UTM / collision.

### 8.3. Luồng C — Gửi duyệt

1. Sticky **Send to approval** hoặc **Save & validate**.
2. Pre-submit blockers; thiếu thì không submit (toast + tab Publish Gate).
3. Matrix tính step; tạo Approval Package + lock version.
4. Approval Center queue; **Review** / **Escalate** / **Create approval batch**.
5. Request Changes → revision; xong → `Approved` + cập nhật gate.

### 8.4. Luồng D — Publish

1. Tab 8 hoặc Publication Control: schedule, channel, collision.
2. Gate Pass / Warning / Blocked.
3. Blocked = không queue (mockup và prod cùng hành vi).
4. Pass → Publication Package → connector (E3) hoặc **Mark published** + caption.
5. Log post id / lỗi / retry.

### 8.5. Luồng E — Insight

1. Import metrics.
2. Insight Draft + evidence/confidence.
3. Content Lead **Approve insight**.
4. Approved → template + Copilot; Draft không vào Copilot.

---

## 9. Hợp đồng UI — mockup là sản phẩm

### 9.1. Token (bắt buộc parity)

| Token | Giá trị |
|---|---|
| `--nav` / `--nav2` | `#101a30` / `#172642` |
| `--ink` / `--bg` | `#15213a` / `#f4f6fa` |
| `--blue` `--purple` `--green` `--amber` `--red` | `#3268f6` `#7656e9` `#139567` `#d88400` `#d84951` |
| Sidebar / top / sticky | 258 / 67 / 66 px |
| Card radius | 14px |
| Workspace grid | `1fr` + 345px |
| Font | Inter 13px |

Không thay glyph sidebar (▦ ◉ ✦ ✓ □ ▣ ◌ ⚙) trước visual QA pass.

### 9.2. Layout

- Sidebar cố định 8 mục + help **Content Ops Assistant**.
- Top: breadcrumb `Content Marketing OS / {màn}`, search ID/client/campaign/asset, notification, overflow, avatar.
- Desktop-first; <1100px sidebar collapse (CSS gốc).
- Status = **nhãn chữ + màu**.

### 9.3. Production Workspace

1. Header: tên, `CNT-*`, version, status, `CR-*`, **Lưu snapshot**, **Version compare**, •••.
2. Context bar 6 ô.
3. 8 tab đúng thứ tự mockup; canvas + panel 345px.
4. Sticky: auto-save · Previous · Save & validate · Next / **Send to approval**.
5. Đổi tab không mất draft.

### 9.4. UI states bắt buộc

Loading/skeleton; empty; 403; no search; unsaved; autosave fail; validation; SLA at risk/breach; publish blocked; integration error; offline/retry nếu PWA.

### 9.5. Accessibility

WCAG 2.1 AA. Keyboard tabs / editor / modal / table. Focus rõ. Contrast AA. Không chỉ màu. Label + helper + validation. Media theo FR-AST-009.

### 9.6. Inventory control mockup (mọi nút phải có handler)

| Control | Hành vi vận hành |
|---|---|
| Nav 8 mục | `go(screen)` + crumb + badge thật |
| Search | Lọc bảng / queue theo ID, client, campaign, asset |
| ＋ Tạo Content Item / ＋ Tạo request | Modal intake, không nhảy thẳng workspace |
| Tạo và mở triage | Persist request, vào Intake, badge +1 |
| Triage & create / Create package | Mở Workspace, gắn `CR-*` |
| Assign Legal / Escalate client | Queue Legal / Approval + toast |
| Replace asset | Tab Assets |
| Mở Approval / Publication | Deep link màn |
| 8 tab + Previous/Next | Đổi tab, Next cuối = Send to approval |
| Save & validate | Chạy gate, toast blocker |
| Send to approval | Package + lock hoặc BLOCKED |
| Copilot 4 nút | Toast + AI Trace mẫu (không apply approved) |
| Approve insight | Status Approved; Copilot được dùng |
| Save policy | Persist flag tenant |
| Click `!` trên gate | Toggle blocker (demo) / mở remediation (prod) |

HTML persist `localStorage cmkte-ops-v3`. Toast, không `alert()`.

---

## 10. Tích hợp và API

### 10.1. Nhóm tích hợp

| Hệ | Vai trò | Wave |
|---|---|---|
| Planner | Snapshot sealed → brief/pillar/idea | Keep |
| SEO / Email modules | Bridge payload | Keep |
| Creative OS | Brand kit, library, batch | Handoff |
| Video SOP `/crm/video` | Cinematic / SC | Handoff |
| DAM khách | Metadata + rights pull | E1–E3 |
| Social connector | Publish + post id | E3 từng kênh |
| CMS | Web schedule | E3 |
| CRM / MA | Nurture handoff | Keep+ |
| Analytics / BI | Metrics | E2 |
| IdP | SSO / MFA / SCIM | E3 |
| Storage / CDN | Signed URL | Keep |
| AI gateway | Routing, cost, residency | E2 |
| Notify | In-app, email, webhook | E0 in-app/email |

### 10.2. API principles

- Portfolio: `/api/crm/content-os/portfolio/*` và `/api/v1/content-os/*`.
- Lifecycle prefix **giữ:** `/api/crm/service-lifecycle/:id/content-marketing/*`.
- Tenant + RBAC/ABAC + correlation id trên mọi request.
- Write publish/schedule/webhook **idempotent**.
- Webhook: signature, retry, DLQ.
- Snapshot API **không update** sau finalize.
- Credential connector **không** ra browser.

### 10.3. Resource

Portfolio/new: `/content-requests`, `/content-masters`, `/briefs`, `/architectures`, `/deliverables`, `/variants`, `/versions`, `/comments`, `/asset-links`, `/asset-rights`, `/tasks`, `/dependencies`, `/capacity`, `/sla-events`, `/approval-workflows`, `/approval-steps`, `/approval-packages`, `/publications`, `/publish-gates`, `/channel-accounts`, `/execution-logs`, `/insights`, `/performance-records`, `/ai-traces`, `/audit-events`.

Giữ: ideas, items, jobs, review, calendar, publish mark, media, intelligence summary, SEO/Email bridge.

Không invent: `/organizations` độc lập nếu đã có tenant CRM; map Client/Brand sang bảng agency hiện có.

### 10.4. Domain events

`content_request.created` / `triaged` · `content_item.created` · `brief.validated` / `completeness_changed` · `content_version.created` · `content_variant.updated` · `comment.mentioned` · `asset.rights_expiring` / `invalidated` · `task.assigned` / `sla_at_risk` / `sla_breached` / `blocked` · `approval.submitted` / `step_activated` / `approved` / `changes_requested` / `rejected` · `publish_gate.passed` / `blocked` · `publication.scheduled` / `published` / `failed` · `performance.imported` · `insight.created` / `approved` · `ai.action_completed` / `policy_violation_detected`.

---

## 11. NFR

### 11.1. Hiệu năng

| ID | Yêu cầu |
|---|---|
| NFR-PERF-001 | P95 dashboard/workspace < 3s (broadband), trừ media lớn. |
| NFR-PERF-002 | P95 read API < 500 ms; write < 1.000 ms (trừ async). |
| NFR-PERF-003 | Autosave: UI < 300 ms; persist P95 < 2s. |
| NFR-PERF-004 | Editor ≥ 20.000 ký tự không treo desktop mục tiêu. |
| NFR-PERF-005 | AI / export / sync / publish chạy async có progress. |

### 11.2. Tin cậy

| ID | Yêu cầu |
|---|---|
| NFR-REL-001 | Availability core ≥ 99.9%/tháng, trừ downtime kế hoạch. |
| NFR-REL-002 | Publish/integration: retry, idempotency, timeout, circuit breaker, DLQ. |
| NFR-REL-003 | Không mất snapshot / approval evidence / audit khi failover. |
| NFR-REL-004 | Backup ngày; RPO ≤ 15 phút, RTO ≤ 4h (enterprise). |

### 11.3. Bảo mật

| ID | Yêu cầu |
|---|---|
| NFR-SEC-001 | TLS 1.2+; mã hóa at-rest theo hạ tầng được duyệt. |
| NFR-SEC-002 | Tenant isolation application + data access. |
| NFR-SEC-003 | SSO OIDC/SAML + MFA theo policy — E3. |
| NFR-SEC-004 | Secret manager; token không vào browser/client log. |
| NFR-SEC-005 | Upload: type, size, malware scan, signed URL. |
| NFR-SEC-006 | XSS, CSRF, injection, BAC, IDOR. |
| NFR-SEC-007 | Audit immutable; không xóa/sửa qua UI vận hành. |
| NFR-SEC-008 | PII mask/loại trừ trong AI prompt. |

### 11.4. Scale, quan sát, retention

- Multi-tenant scale ngang API / worker / notify / integration.
- Hàng triệu audit, hàng trăm nghìn item / tenant; full-text ID/title/client/brand/asset.
- Queue ưu tiên SLA / approval / publish.
- Structured log + correlation; metrics latency/error/queue/publish/AI cost; tracing request→workflow→publish; alert connector/publish/audit/security.
- Audit ≥ 7 năm; package = lifecycle + legal hold; AI Trace ≥ 180 ngày; rights = license + retention. Hard delete chỉ Super Admin + audit.

---

## 12. Scoring và rules engine

**BriefCompleteness** = Σ(wᵢ × doneᵢ) / Σ wᵢ × 100. Field compliance/mandatory trọng số cao hơn field tham khảo.

**Content Readiness** (hỗ trợ, **không** thay gate): Brief 15, Copy/voice 20, Assets/rights 20, SEO 15, Production 10, Approval 15, Publish setup 5.

**Risk** từ: campaign tier, regulated, claim, brand profile, rights uncertainty, proximity, SLA, critical path. Level: Normal, Elevated, Brand-Sensitive, Regulated, Crisis.

```text
IF risk IN (Brand-Sensitive, Regulated)
THEN ADD step(Content Lead, Copy+Voice, SLA 8h)

IF claim IN (Financial, Health, Legal)
THEN ADD step(Legal Queue, Claim, SLA 8h)

IF intent HAS Paid AND rights.paid_ok = false
THEN BLOCK gate('Paid media rights invalid')

IF market_count > 1
THEN ADD step(Local Market Lead, Localization, per_market)
```

| Thay đổi | Class | Hành động mặc định |
|---|---|---|
| Typo không đổi nghĩa | Minor | Waive nếu policy + reason |
| Hook / CTA | Moderate | Re-run Lead / Account |
| Claim / disclaimer | Material | Legal + Lead + Client nếu đã client-approved |
| Hero asset | Material | Creative / Rights / Client |
| Channel / market | Material | Distribution / local / client |
| Lịch trong safe window | Minor/Moderate | Social Lead hoặc Account |

---

## 13. Chương trình giao hàng

### Wave E0 — Operating shell (thay Content Board)

Route 8 màn COS; redirect `?tab=content-os`. Command Center từ counts đa lifecycle (số thật, empty nếu 0). Requests = Idea + form Request tối thiểu. Workspace 8 tab trên 1 item (tab trống = empty, không bịa). Approval Center = review queue restyle. Publication = calendar + gate block. Library / Intelligence / Settings. **Parity visual + hành vi mockup.**

**Exit:** UAT `tiep-thi-noi-dung` đi A→D trên UI mới; HTML và prod cùng IA.

### Wave E1 — Governance

Request entity, completeness, brief lock, master/deliverable, rights, package lock, matrix tuyến tính + 1 rule Legal, client package, collision warning.

### Wave E2 — Control room

Capacity, critical path, escalation, quorum/delegate, retry/log, channel health, insight approve, AI Trace UI, batch approval.

### Wave E3 — Enterprise fabric

Connector từng kênh, DAM pull, SSO/SCIM, legal hold, advanced report, localization memory.

**E3 đã ship (2026-09-11):** framework connector **tắt** + stub DAM + glossary/hold/audit **nền**. Thắng đối thủ trên thao tác đăng/kéo file: [`2026-09-11-content-os-competitive-win-design.md`](./2026-09-11-content-os-competitive-win-design.md) (SPEC-CMKT-WIN v1.1 · Wave E4) + mockup [`../mocks/2026-09-11-content-os-competitive-win.html`](../mocks/2026-09-11-content-os-competitive-win.html).

---

## 14. Acceptance

### 14.1. Request

Account tạo request → score + field thiếu. Ops triage effort/risk/SLA → convert item. Item giữ `request_id` + context.

### 14.2. Workspace

Đúng context theo quyền. 8 tab không mất draft. Autosave success/fail rõ. Read-only nếu không `write`.

### 14.3. Copy / AI

Master + FB variant + diff v1.2/v1.3. Comment + mention + resolve. AI trace đủ; không ghi đè approved; restricted claim bị flag.

### 14.4. Rights

Asset expired → blocker. Không quyền override thì không bypass. Override = reason/evidence + audit.

### 14.5. Production / SLA

Template sinh task đúng RACI. Critical path chậm → risk + notify. Capacity vượt ngưỡng → warning + gợi ý (số thật).

### 14.6. Approval / Publish

Submit → snapshot + lock. Claim health → Legal. Changes → pause step sau. Portal không lộ internal. Gate Blocked không queue. Failure lưu error + retry policy. Reschedule sau final đánh giá re-approval.

### 14.7. Shell

User cap thấy **Content Marketing OS**; không cap ẩn. Command Center không bịa. Visual sidebar/token/8 tab/sticky khớp HTML.

---

## 15. Dữ liệu mẫu vận hành (mockup = dataset)

| Thuộc tính | Giá trị mẫu |
|---|---|
| Organization / BU | PTT Agency Vietnam · Creative Ops |
| Client / Brand | Sunlight Group · Sunlight Residence |
| Market | Vietnam / vi-VN |
| Campaign | Launch Q4/2026 |
| Request / Item | `CR-2026-0910-024` / `CNT-260910-021` |
| Owner / AM | Thu An · Minh Hoàng |
| Risk / SLA | Brand-Sensitive · 18h |
| Nova | `CNT-260909-018` Legal block |
| Tâm An | `CNT-260908-012` paid rights expiry |
| Copy | Master v1.3; FB variant; disclaimer minh họa |
| CTA | **Đăng ký nhận tư vấn** — cấm “Gọi ngay” |
| UTM | `facebook` / `organic_social` / `launch_q4_2026` |
| Rights | Hero organic VN; paid cảnh báo sau 30/11/2026 |
| Workflow | Owner → Content Lead → Conditional Legal → AD → Client |

**Cấm seed dataset này lên production.** HTML persist `cmkte-ops-v3`. Prod = API.

---

## 16. Quyết định đã chốt / còn mở

| Chủ đề | Chốt v3.1 |
|---|---|
| COS vs CMKT | **Một sản phẩm:** nâng CMKT, UI = mockup vận hành |
| Portfolio API | Thêm, không xóa prefix lifecycle |
| DAM | Orchestration + rights; không tự làm DAM đầy đủ |
| Publish MXH | Human + gate E0–E1; connector E3 |
| Multi-tenant DB | Shared + scope (hiện tại) |
| Capacity số | Không bịa trên prod |
| Video AI | Handoff `/crm/video`; không bật `CP_AI_ENABLED` như fix |
| Client mẫu | Không invent AM 360 / CPL |

Còn mở: database-per-tenant; white-label portal; ngành legal bắt buộc; nguồn BI; calendar nghỉ/escalation theo BU.

---

## 17. Kết luận

CMKT-E nâng Content Marketing OS từ **board theo lifecycle** thành **hệ điều hành nội dung agency**. Mọi yêu cầu COS v2.0 về object, SLA, rights, matrix, gate, audit **là yêu cầu hệ thống**. UI HTML là **cách đội ngũ làm việc hàng ngày**. Implementation = parity mockup + mở rộng `cmkt_*` + portfolio API — không sản phẩm song song, không “bọc vỏ”.

**Cổng:** duyệt spec `docs/superpowers/specs/2026-09-10-content-os-agency-enterprise-design.md` + mockup `docs/superpowers/mocks/2026-09-10-content-os-agency-enterprise.html` trước khi viết plan / code ops-web.

**Thắng đối thủ (sau E3):** [`2026-09-11-content-os-competitive-win-design.md`](./2026-09-11-content-os-competitive-win-design.md) — Facebook Page + human confirm, DAM HTTP, glossary CRUD. Không thay khóa v3.1.

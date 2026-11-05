# Software Requirements Specification

# PTT Media Supply & Outcome OS (MSOS)

| Thuộc tính | Giá trị |
|---|---|
| Tên | PTT Media Supply & Outcome OS |
| Mã tài liệu | SPEC-MSOS-2026-09-12 |
| Phiên bản | **1.0 — Hybrid supply + outcome, không clone CRM** |
| Nguồn gốc | ANIOS SRS v2.0 + mockup Downloads — **thu hồi tên “CRM Ad Network” và sản phẩm độc lập** |
| UI vận hành | [`../mocks/2026-09-12-media-supply-outcome-os.html`](../mocks/2026-09-12-media-supply-outcome-os.html) — chrome + IA 8 màn. State thắng publisher: [`../mocks/2026-09-12-media-supply-outcome-os-win.html`](../mocks/2026-09-12-media-supply-outcome-os-win.html) (SPEC-MSOS-WIN) |
| Hub | `/crm/media-os` · API `/api/crm/media-os/*` · cap `crm_media` |
| Pilot | Inventory/service **PTT** + **một partner thật** · Reseller (C) khóa |
| Persist HTML | `localStorage` key `msos-ops-v1` |
| Trạng thái | Draft for Product, UX, Architecture, Security, Engineering |
| Thắng đối thủ | [`2026-09-12-media-supply-outcome-os-win-design.md`](./2026-09-12-media-supply-outcome-os-win-design.md) — SPEC-MSOS-WIN v1.0 · hướng A |

**Tuyên bố:** MSOS quản trị inventory, commercial media, campaign evidence, outcome link và margin. Tích hợp CRM Core, Finance Core, AI Platform và connector Meta/Google/Zalo. **Không** nhân bản Client 360, Account, pipeline, invoice, AI chat, knowledge base.

**Không gọi:** CRM Ad Network · ANIOS độc lập · “module ads trong CRM”.

---

## 1. Tuyên bố, ranh giới, IA

### 1.1. Vấn đề

RNOSAI đã có CRM/AM, Finance, Meta/Google/Zalo Ads, Content OS, Creative OS. File ANIOS gốc mô tả một OS media đầy đủ nhưng **trùng SoT** với các module đó. Nếu giữ tên “Ad Network trong CRM”, team sẽ clone Client, invoice và AI Hub.

PTT cần một chỗ **sở hữu** những thứ CRM không nên sở hữu: chỗ trống (inventory), giá, gói, giữ chỗ, dòng media, bằng chứng delivery, liên kết outcome, thác margin, điểm partner, cổng reseller.

### 1.2. Một câu

MSOS sở hữu chuỗi:

`Inventory / Service PTT → Rate Card → Package → Campaign Media Line → Delivery Evidence → Outcome Link → Margin Waterfall`

Mọi Client / Lead / Invoice / User / Knowledge / Agent Runtime chỉ là **tham chiếu ID** sang hệ đã có.

### 1.3. Hybrid đã chốt

| Quyết định | Giá trị |
|---|---|
| Mô hình | Hybrid: buy-side (connector) + sell-side (PTT + 1 partner) |
| Kênh đã ship | Connector dưới Campaign Core — `/meta/*`, `/google/*`, `/zalo/*` giữ Wave 1 |
| Wave 1 supply | Inventory/service **PTT** + **một partner thật** (KYC, rate v1, capacity) |
| Cổng C | White-label/reseller **chỉ** khi `Reseller Eligibility` = đạt |
| AI | Propose + evidence + người duyệt. Không Live / invoice / thanh toán / bật C |

### 1.4. Entity — sở hữu vs tham chiếu

**MSOS sở hữu (SoT)**

| Entity | Việc |
|---|---|
| Inventory | Property / service PTT hoặc partner (site, package media, form, newsletter…) |
| Placement | Vị trí / format / geo / device / brand-safety |
| Capacity | Sổ: total, reserved, delivered, released, overbooked theo time bucket |
| Rate Card | List / negotiated / version / hiệu lực — append-only |
| Package | Bundle placement + rule audience/budget/margin |
| Deal Wallet | Commitment, used, remaining, rebate eligibility, expiry |
| Reservation | Soft / hard / waitlist / expiry release |
| Campaign Media Line | Dòng mua hoặc bán; map `external_campaign_id` |
| Delivery Evidence | Proof, source, freshness, hash |
| Outcome Link | Trỏ Lead / MQL / SQL / Sale — không lưu pipeline |
| Margin Waterfall | Gross sell → discount → net → media cost → rebate accrued → service cost ref → contribution |
| Partner Scorecard | Reliability, discrepancy, quality, SLA |
| Reseller Eligibility | Cổng C: KYC + scorecard + capacity + rate published |

**Chỉ tham chiếu (cấm SoT trong MSOS)**

Client · Brand · Contact · Opportunity · Lead · MQL / SQL · Sale / Revenue · Invoice · Payment · User · Role · Knowledge Article · AI Agent Runtime.

Nút “Mở …” = deep-link CRM / Finance / IAM / AI Platform. Mockup **không** có màn Client 360, Invoice studio, AI Hub runtime, Knowledge editor.

### 1.5. Tám màn Wave 1

| Màn | Route | Việc |
|---|---|---|
| Command | `/crm/media-os` | Exception, capacity, margin at risk, cổng C |
| Inventory & Rate | `/crm/media-os/inventory` | Catalog PTT + partner pilot, rate version |
| Packages | `/crm/media-os/packages` | Bundle + reserve |
| Campaigns | `/crm/media-os/campaigns` | Media line; deep-link Ads Ops |
| Evidence | `/crm/media-os/evidence` | Proof, discrepancy, freshness |
| Outcomes | `/crm/media-os/outcomes` | Outcome Link + confidence |
| Margin & Deal | `/crm/media-os/margin` | Waterfall, deal wallet |
| Governance | `/crm/media-os/settings` | Scorecard, eligibility, policy, audit — không RBAC user |

Nav ops-web: **Media OS** (nhóm kênh quảng cáo hoặc Delivery). Không label “Ad Network”.

### 1.6. Out of scope (cốt lõi)

- DSP / SSP / Ad Exchange / RTB bidder.
- Clone Client 360, pipeline, invoice/payment UI, AI chat, knowledge editor.
- AI tự Live, đổi rate/deal, bật reseller, tạo lead, phát hành invoice, thanh toán.
- Seed Nova / Sunlight / Tâm An / partner giả trên prod.
- Xóa hoặc thay URL `/meta/*`, `/google/*`, `/zalo/*` ở Wave 1.

---

## 2. Kiến trúc tích hợp và luồng dữ liệu

### 2.1. Bounded context

MSOS là context riêng trong `ptt-crm-api` (`msos_*`). Không ghi thẳng bảng Meta insight, không ghi `leads`, không ghi invoice.

```
ops-web  /crm/media-os          (8 màn, cap crm_media)
                │ Bearer
ptt-crm-api  /api/crm/media-os/*
                │
     ┌──────────┼──────────────────┐
     │          │                  │
  MSOS Core   Read/ref IDs      Adapter ports
  (sở hữu)    (không clone)     (không SoT kênh)
     │          │                  │
     │     CRM Core            Meta / Google / Zalo
     │     Finance Core        Ads Ops + campaign-writes
     │     IAM / Role
     │     AI Platform         (gateway + trace; runtime ngoài)
     │     Content / Creative  (ref creative_id / item_id)
```

### 2.2. Cổng tích hợp

| Hệ | MSOS được | MSOS bị cấm |
|---|---|---|
| CRM Core | Lưu `client_id`, `brand_id`, `opportunity_id`, `lead_id`, `sale_id` | Tạo/sửa Client, Contact, pipeline, Lead board |
| Finance Core | Đọc invoice/payment theo ID; **request** draft invoice khi evidence + recon đạt | Phát hành invoice, ghi nhận thanh toán, sửa GL |
| AI Platform | Tool đã đăng ký; draft; `ai_trace_id` | Host agent runtime, knowledge article, chat generic |
| Connector | Sync spend/delivery; map external ID; deep-link | Token trên browser; AI tự launch/edit; bỏ Launch QA |
| Content / Creative OS | Gắn `creative_id` / content item (ref) | DAM, copy workspace, pixel editor |

### 2.3. Luồng xương sống

1. Tạo Inventory / Placement (PTT hoặc partner pilot) + Capacity ledger.
2. Publish Rate Card (versioned, append-only).
3. Lắp Package → Reservation (soft/hard). `MEDIA_OS_RESELLER` tắt trừ Eligibility = đạt.
4. Tạo Campaign Media Line; gắn CRM `client_id` / `brand_id`; map connector hoặc IO tay. Live sau Launch Readiness + người duyệt.
5. Ingest Delivery Evidence (file hoặc sync đọc connector). Thiếu freshness → không official.
6. Outcome Link: UTM / click / lead ID → Lead/MQL/SQL/Sale **đã có**. Không match → unmatched. Không tạo lead giả.
7. Margin Waterfall. Dưới floor → block hoặc route duyệt.

**Một ID xuyên suốt:** `media_line_id` (và `commercial_ref` trên package/reserve) từ reserve → line → evidence → outcome → waterfall.

### 2.4. Cờ

| Flag | Default | Ý nghĩa |
|---|---|---|
| `MEDIA_OS_ENABLED` | **off** | Nav + API. Tắt → 404/disabled, CRM không vỡ |
| `MEDIA_OS_RESELLER` | **off** | Cổng C — Wave sau (§4.2) |
| `MEDIA_OS_CONNECTOR_WRITE` | **off** | Ghi kênh có duyệt — Wave sau (§4.1) |

Wave 1: đọc/sync connector. Launch/edit vẫn Ads Ops + `campaign-writes`.

### 2.5. Lỗi biên

| Tình huống | Hành vi |
|---|---|
| CRM ID không tồn tại | 422, không stub Client/Lead |
| Connector chết / stale | Line `stale`, không bịa delivery |
| Finance lock | Chỉ adjustment request, không sửa số khóa |
| AI A4/A5 | Policy block + audit |
| Partner Suspended / Watchlist | Chặn reserve / đề xuất package |

### 2.6. Domain events (tối thiểu)

`RateCardPublished` · `InventoryReserved` · `PackageSubmitted` · `MediaLineLive` · `EvidenceImported` · `OutcomeLinked` · `MarginThresholdBreached` · `ResellerEligibilityChanged`

---

## 3. Wave 1 — cổng, SoD/AI, chấp nhận

### 3.1. In / out

**In:** catalog PTT + 1 partner thật; rate → package → reserve → media line; evidence (file + sync đọc); Outcome Link; waterfall contribution; Deal Wallet partner; Scorecard; Eligibility **khóa**; 8 màn; deep-link.

**Out:** reseller C; connector write; clone CRM/Finance/AI/Knowledge; DSP; seed giả; đa partner; incrementality nâng cao; portal partner.

### 3.2. Cổng cứng

| ID | Cổng | Pass | Fail |
|---|---|---|---|
| GT-01 | Rate publish | Version + owner + hiệu lực | Line không dùng rate nháp |
| GT-02 | Reserve | Capacity còn + partner không Suspended | Overbook → case |
| GT-03 | Media Line Live | PO/ref CRM + rate published + tracking owner + người duyệt | AI không bấm Live |
| GT-04 | Evidence official | Freshness trong SLA + source/hash | Không vào margin/outcome official |
| GT-05 | Outcome Link | CRM ID tồn tại + consent/purpose nếu lead | Không tạo lead/sale |
| GT-06 | Margin submit | CM ≥ floor hoặc đúng approver | Dưới floor → block |
| GT-07 | Reseller C | Eligibility = đạt | Cổng khóa, không che buy-side |
| GT-08 | Invoice | Request Finance khi GT-04 + recon đạt | MSOS không phát hành |

### 3.3. SoD

- Người lập package không tự duyệt package vượt ngân sách/margin.
- Người tạo payable / invoice *request* không tự duyệt thanh toán (Finance).
- Người sửa actual sau finance lock không tự unlock.
- AI không vừa đề xuất vừa tự thi hành High Risk.

### 3.4. AI — lớp hành động

| Lớp | Ví dụ | Wave 1 |
|---|---|---|
| A0 Insight | Tóm tắt line, freshness | Có, có trace |
| A1 Draft | Draft package / line / recon note | Người review trước lưu |
| A2 Low-risk | Tạo task QA, nhắc SLA | Policy + audit |
| A3 Controlled | Đề xuất reserve / reallocation | Approval bắt buộc |
| A4 Financial / client | Live, đổi rate/deal, tăng budget, gửi cam kết KPI | **Người**; AI cấm tự |
| A5 Prohibited | Invoice, thanh toán, ký HĐ, bật C, tạo Client/Lead | **Cấm** |

Mọi output: đề xuất gì / evidence / freshness / assumption / confidence / ai duyệt. Token/secret không ra browser, log, AI Trace JSON, audit CSV.

### 3.5. Yêu cầu chức năng Wave 1

| ID | Tên | Tóm tắt |
|---|---|---|
| MSOS-FR-001 | Inventory & Placement | CRUD catalog PTT + 1 partner; taxonomy; Suspended chặn booking |
| MSOS-FR-002 | Capacity ledger | Bucket day/week/month; soft/hard/waitlist; overbook case |
| MSOS-FR-003 | Rate Card | Version append-only; line chỉ bind rate published |
| MSOS-FR-004 | Package & Reserve | Bundle; soft expiry; AI gợi ý bundle = A1 |
| MSOS-FR-005 | Campaign Media Line | Tạo từ package/reserve; CRM ref bắt buộc; map connector hoặc IO tay; Live = GT-03 |
| MSOS-FR-006 | Delivery Evidence | File + sync đọc; freshness; official vs draft |
| MSOS-FR-007 | Outcome Link | Map UTM/click/lead → CRM; unmatched; không insert CRM |
| MSOS-FR-008 | Margin Waterfall | Contribution; rebate chỉ accrued; field-level hide buy/deal/margin khỏi portal client |
| MSOS-FR-009 | Deal Wallet | Commitment/used/expiry; use-or-lose; rebate chưa milestone ≠ realized |
| MSOS-FR-010 | Scorecard & Eligibility | Chấm partner; C khóa; đổi tier có review |
| MSOS-FR-011 | Command exceptions | Ưu tiên impact × urgency × freshness × client priority (client = ref) |
| MSOS-FR-012 | Governance & audit | Policy margin/credit/AI; before/after; correlation id |
| MSOS-FR-013 | AI lock | Generate/copilot không gọi Live, reserve hard, invoice, eligibility |

### 3.6. Chấp nhận Wave 1 (go-live pilot)

1. Một inventory PTT + một partner **thật** trên UI; 0 seed Nova/Sunlight/Tâm An/partner giả trên prod.
2. Một package → reserve → media line → evidence → outcome link → waterfall **cùng `media_line_id`**.
3. Outcome chỉ trỏ CRM thật; 0 lead/sale do MSOS insert.
4. 0 invoice do MSOS phát hành; request Finance có audit.
5. 0 lần AI Live / đổi giá / bật C.
6. Connector chết → `stale`, không bịa số.
7. `/meta/*`, `/google/*`, `/zalo/*` vẫn chạy.
8. Buy cost / deal / margin không lộ client portal.
9. `MEDIA_OS_ENABLED=0` → nav ẩn, API disabled, CRM không vỡ.

### 3.7. KPI cửa (không vanity)

| ID | Chỉ số | Cửa pilot |
|---|---|---|
| BG-01 | Time package → line Live | Đo được trên 1 deal thật |
| BG-02 | Outcome link match rate | Hiển thị unmatched; không giấu |
| BG-03 | Margin leakage phát hiện trước billing | ≥ 1 case từ evidence vs rate |
| BG-04 | Zero AI write A4/A5 | 0 |
| BG-05 | Flag-off safe | CRM/Ads không regress |

---

## 4. Wave sau — không vào mockup chính

Bốn thành phần dưới đây **ghi trong SRS để khóa hướng**. Mockup HTML Wave 1 chỉ hiện **cổng khóa / deep-link / “Wave sau”** — không giả lập portal partner, không wizard ghi connector, không close calendar đầy đủ, không màn che buy-side.

### 4.1. Ghi connector có duyệt

**Mục tiêu:** Media Line có thể *đề xuất* launch/edit lên Meta/Google/Zalo **qua adapter**, không bypass Ads Ops.

| Khóa | Chi tiết |
|---|---|
| Flag | `MEDIA_OS_CONNECTOR_WRITE` default **off** |
| Lớp AI | Tối đa A3 (draft change). Live/budget = A4 người |
| Đường ghi | MSOS → command domain → **campaign-writes** / Temporal / Launch QA đã có. Không gọi Graph/Google từ browser |
| SoD | Buyer soạn ≠ approver cuối (policy theo spend/margin) |
| Audit | before/after targeting, budget, creative ref, `correlation_id`, `ai_trace_id` |
| Fail | Connector stale hoặc QA fail → không enqueue write |
| Không làm | Token refresh trên UI; AI tự pause/tăng budget; bỏ URL `/meta/ads-ops` |

**Chấp nhận sơ bộ:** 1 write queue item từ media line → Ads Ops snapshot → người duyệt → connector; 0 write khi flag off.

### 4.2. Cổng C — reseller cho partner/inventory đạt chuẩn

**Mục tiêu:** Che buy-side khỏi client **chỉ khi** Eligibility = đạt.

Điều kiện đạt (tất cả):

1. KYC / DPA / tax / tài khoản đối tác verified (ref hồ sơ ngoài hoặc checklist MSOS).
2. Partner Scorecard ≥ ngưỡng policy (reliability, discrepancy, brand-safety).
3. Capacity ledger còn và không overbook systemic.
4. Rate Card published còn hiệu lực.
5. Partner không Watchlist/Suspended.
6. Review + approver Commercial (không phải người lập deal).

| Khóa | Chi tiết |
|---|---|
| Flag | `MEDIA_OS_RESELLER` default **off** |
| Hành vi khi khóa | Package không có option “ẩn buy cost”; portal client không thấy deal |
| Hành vi khi mở | Client-facing package ẩn buy rate / partner cost; internal waterfall đủ |
| Event | `ResellerEligibilityChanged` |
| Thu hồi | Rớt scorecard hoặc hết rate → C tắt, line mới không che; line cũ = change control |

**Chấp nhận sơ bộ:** Partner dưới ngưỡng không bật C (kể cả flag on). Flag off → API từ chối.

### 4.3. Reconciliation & close sâu

**Mục tiêu:** Workbench plan vs IO vs connector vs evidence vs billable vs partner invoice — Finance vẫn SoT invoice.

| Đối tượng | So sánh |
|---|---|
| Plan / package | Số đã duyệt |
| IO / media line | Rate version + qty |
| Connector / file | Delivery + cost import |
| Evidence official | GT-04 |
| Client-billable | Số đề xuất gửi Finance |
| Partner invoice | Ref; không ghi AP trong MSOS |

Tolerance theo partner/channel/contract. Case khi vượt tolerance, stale, missing proof, rate mismatch, unbilled delivery. Resolution: adjustment, make-good, credit/debit *request* Finance, write-off (Controller), carry-over.

Finance lock: không sửa actual đã khóa; late adjustment = period mới.

**Không** vào mockup chính: close calendar đủ, dispute portal, FX exposure, AR aging (đó là Finance).

**Chấp nhận sơ bộ:** 1 case material từ rate version mismatch → draft dispute + evidence list; 0 tự lock period; 0 tự issue invoice.

### 4.4. Partner portal

**Mục tiêu:** Đối tác xem availability, xác nhận IO/reserve, statement, dispute — tenant isolate.

| Được | Không |
|---|---|
| Inventory/capacity của **họ** | Toàn bộ catalog PTT + partner khác |
| Xác nhận / từ chối reserve, IO | Sửa Rate Card PTT, Deal Wallet nội bộ |
| Statement + dispute evidence | Xem buy-side client khác, margin PTT, CRM lead |
| User partner riêng (IAM) | Dùng staff role `crm_media` |

Portal **tách** app (pattern `portal-web`), không nhét vào 8 màn staff. Wave 1: không route, không nav.

**Chấp nhận sơ bộ:** object-level isolation; 0 margin/deal nội bộ trên session partner; SSO/audit theo IAM.

### 4.5. Thứ tự Wave sau (gợi ý, chưa plan)

| Wave | Thành phần §4 | Phụ thuộc |
|---|---|---|
| W2 | §4.1 Connector write có duyệt | Wave 1 line map ổn; campaign-writes sống |
| W3 | §4.3 Recon/close sâu | Evidence official + Finance request |
| W4 | §4.2 Cổng C | Scorecard + eligibility đã vận hành W1 (khóa) |
| W5 | §4.4 Partner portal | W3 statement + IAM partner |

Plan implementation **tách file** sau khi spec này được duyệt — không code trong wave tài liệu.

---

## 5. Dữ liệu, API, bảo mật (khung)

### 5.1. Prefix

Bảng `msos_*`. Không nhồi vào `cmkt_*`, `meta_*`, `leads`, invoice.

Khóa ngoại logic: `client_id`, `brand_id`, `lead_id`, `invoice_id` — validate qua CRM/Finance service, không denormalize hồ sơ.

### 5.2. API (phác)

`/api/crm/media-os/inventory` · `/placements` · `/rate-cards` · `/packages` · `/reservations` · `/media-lines` · `/evidence` · `/outcome-links` · `/margin` · `/deal-wallets` · `/partners/scorecard` · `/eligibility` · `/exceptions`

JSON **không** chứa `access_token`, `refresh_token`, secret connector.

### 5.3. Phân quyền

Cap `crm_media` (view / write / publish / finance_request / admin). ABAC: legal entity, client ref, partner, field-level buy cost / deal / margin.

User/Role SoT = IAM. MSOS không màn quản trị user.

### 5.4. NFR gợi ý Wave 1

Màn vận hành p95 ≤ 3s trên catalog pilot. Ingestion connector idempotent, async. Availability theo `ptt-crm-api`. Việt/Anh UI; VND trước; timezone `Asia/Ho_Chi_Minh`.

---

## 6. Khóa không đàm phán

| ID | Khóa |
|---|---|
| BR-MSOS-01 | Không clone Client / Invoice / Agent runtime / Knowledge |
| BR-MSOS-02 | AI không Live, không invoice, không thanh toán, không bật C |
| BR-MSOS-03 | Outcome không insert CRM |
| BR-MSOS-04 | Token connector không ra browser |
| BR-MSOS-05 | Flag default off; C và connector write off |
| BR-MSOS-06 | Không seed Nova / Sunlight / Tâm An / partner giả trên prod |
| BR-MSOS-07 | Wave 1 không phá URL kênh đã ship |
| BR-MSOS-08 | §4 không hiện như sản phẩm trong mockup chính |

---

## 7. Ánh xạ từ ANIOS gốc (thu hồi gì)

| ANIOS v2.0 | MSOS v1.0 |
|---|---|
| Sản phẩm độc lập 14 màn | 8 màn staff + §4 khóa hướng |
| Client 360, Opportunity | Deep-link CRM / AM |
| Finance AR/AP, invoice | Request + deep-link Finance |
| AI Intelligence Hub | Tool + trace; runtime AI Platform |
| Knowledge & Playbooks | Ref Knowledge Article; không editor |
| Partner portal / recon đầy đủ | §4.3–4.4 |
| DSP/SSP | Vẫn out of scope |

---

**Cổng tài liệu:** duyệt spec này + mockup 8 màn trước khi viết plan / code ops-web.

**Kết thúc SPEC-MSOS v1.0.**

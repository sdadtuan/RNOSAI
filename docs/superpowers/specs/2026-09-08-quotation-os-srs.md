# SRS — Quotation OS trên RNOSAI (Enterprise)

**Sản phẩm:** RNOSAI / ops-web + ptt-crm-api + portal-web  
**Tên module:** Quotation OS (QT OS)  
**Tên tiếng Việt:** Hệ điều hành báo giá thương mại  
**Document ID:** QT-20260908  
**Phiên bản:** 2.0  
**Ngày:** 2026-09-08  
**Trạng thái:** SoT vận hành enterprise — đặc tả đủ màn + FR/AC + nâng cấp nghiệp vụ PTT  
**Ngôn ngữ UI:** Tiếng Việt  
**Prod:** `https://rs.pttads.vn` · tenant `PTT` · portal `https://portal.pttads.vn`

**Changelog**

| Ver | Thay đổi |
|---|---|
| **2.0** | Viết lại toàn bộ theo kiểu CP OS v2.0. SoT = mockup HTML đủ **35 screen ID**. FR/AC theo từng màn. Nâng cấp nghiệp vụ: mã `QT-PTT-{YYYY}-{SEQ:6}`, Lead/AM 360 (không UUID dán), dual packaging (3 SKU + option A/B/C), NSR fee-only, VAT 8% snapshot, 14 status, convert idempotent, portal “Xác nhận đề xuất”. Plan 36 task: [2026-09-08-quotation-os.md](../plans/2026-09-08-quotation-os.md). v1.0 **hết hiệu lực** để triển khai. |
| 1.0 | Khóa SoR + port capability Nova. Thiếu catalog màn chi tiết, NEW/CVT/RPT/SET tách màn, mockup SoT vẫn là demo Nova. Không dùng để code. |

**SoT UI (thứ tự thắng)**

1. [Mockup master](../../design/rnosai-quote-os-srs-mockup.html) — nhảy đủ screen ID, chrome navy PTT  
2. Mockup theo module `docs/design/rnosai-quote-os-*-mockup.html`  
3. Tài liệu này — quy tắc, SoR, field, API, AC  
4. [SRS gốc Agency OS](./sources/bao-gia/SRS-Module-Bao-gia-Agency-Marketing.md) — capability; **không** workspace Nova, **không** legal entity thứ hai, **không** portal ngoài portal-web  
5. File demo Nova cũ (`rnosai-quote-os-module-mockup.html` và bản catalog/studio/brand-video) — **nguồn visual / IA cũ**, không còn SoT

**Quy tắc số liệu:** Mockup được phép sample (An Phát, `QT-PTT-2026-000089`, 265.647.600 ₫, GM 22,4%, 8,46 tỷ). Runtime **cấm** hard-code; thiếu = `null` / `—`.

---

## 0. Gap v1.0 (đã đóng trong v2.0)

| Thiếu ở v1.0 | File mẫu / PTT cần | v2.0 |
|---|---|---|
| SoT UI = demo Nova tím / logo N | Chrome CP OS navy, 7 nav, nhảy màn | Master + 8 file module |
| Screen table 20 dòng, gộp RPT/SET | 35 ID: OVR×3 LST NEW BLD×7 CAT×5 APR×2 PRS PUB×3 CVT RPT×5 SET×6 | §4 |
| Không NEW-01 / CVT-01 / PUB-02/03 | Tạo từ Lead/AM 360; OTP; expired; convert panel | Có màn + FR |
| BLD-04 = sticky (không phải màn) | Sticky là chrome; BLD-04 = KPI 3 lớp | Khớp mockup |
| Catalog 2 ID | CAT-01…05 + VID-TPL-01 | Có |
| Báo cáo 1 ID | RPT-01…05 | Có |
| Settings 1 ID | SET-01…06 | Có |
| FR gộp theo “hạng mục” | FR theo từng screen + AC | §5–§13 |
| Dual packaging nói chung | 3 SKU trên line + A/B/C trên version — cả hai trên BLD-02/03 | Khóa |

---

## 1. Sản phẩm và nguyên tắc

QT OS quản lý vòng đời **deal/lead → catalog → phương án → giá/margin → duyệt nội bộ → proposal khách → xác nhận → lifecycle/hóa đơn**.

Không phải app Nova. Không phải Word/Excel. Không thay Content OS, CP OS, Video SOP, Invoice sổ cái.

### 1.1. Mục tiêu nghiệp vụ

1. Rút ngắn thời gian lập báo giá từ draft → sent.  
2. Bán theo **package/giải pháp**, không chỉ một dòng giá.  
3. Tách **phí agency** / **media-pass-through** / **VAT**.  
4. KPI minh bạch: cam kết bàn giao ≠ mục tiêu tối ưu ≠ forecast.  
5. 100% ngoại lệ discount/margin đi qua approval.  
6. Version là bằng chứng: gửi khách = snapshot bất biến.  
7. Quote accepted handover đủ scope/deliverable/payment cho SoR vận hành.

### 1.2. Nguyên tắc RNOSAI

| Nguyên tắc | Áp dụng |
|---|---|
| Quote-first, deal-connected | Tạo từ Lead/Deal/AM 360 hoặc độc lập rồi gắn sau |
| Package-first | Catalog + bundle; custom line có flag và review |
| Customer transparency | Client thấy scope, giá, KPI đã gắn nhãn; **không** cost/margin/approval |
| No silent override | Sửa giá/scope/KPI client-visible sau Approved → revision |
| Snapshot | Rate/tax/clause khóa lúc submit/publish |
| Human-in-the-loop | AI chỉ draft text; không tự publish, không tự accept, không tự spawn lifecycle |
| Isolation | Tenant PTT + scope Của tôi / Team / Toàn PTT |
| Một SoR | Không bảng `quotes` song song; không portal khách thứ hai |

### 1.3. Hướng tích hợp (khóa)

**A — `/crm/proposals*` trong ops-web + mở rộng `ProposalsModule`.**

Cấm:

- App / workspace Nova tách  
- Theme tím, logo NOVA, workspace switcher  
- Nuốt `/crm/catalog`, `/crm/sales`, portal, invoice, CP OS  
- Hard-delete quote (chỉ soft archive + retention)

Menu OpsNav nhóm **Kinh doanh:** **Đề xuất** giữ label hoặc đổi **Báo giá** (cùng href `/crm/proposals`). Catalog thương mại: `/crm/proposals/catalog` đồng bộ `crm_catalog_services` / `ops_service_profile`. Tra cứu bán `/crm/sales/services` deep-link vào Builder.

---

## 2. Quyết định khóa

| Chủ đề | Quyết định PTT / RNOSAI |
|---|---|
| Shell | Sidebar **đúng 7**: Tổng quan · Báo giá · Tạo báo giá · Service Catalog · Phê duyệt · Báo cáo · Cấu hình. Studio **không** là mục 8 |
| Studio | `/crm/proposals/[id]/studio` — mở từ Builder |
| SoR quote | `crm_proposals` (giữ integer `id`) + bảng version/option/approval/publication **mới** |
| Client | AM 360 `crm_clients` UUID + legacy `customer_id`. Form **chọn tên**. Cấm khách ma, cấm ô dán UUID |
| Deal | `crm_leads` + Deal Room / Consult. Prefill owner/client |
| Catalog | `crm_catalog_services` + `ops_service_profile` (DV01–21). Rate/cost/KPI/deliverable = profile versioned |
| Dual packaging | `package_tier` CoBan/TieuChuan/ChuyenSau **trên line** **và** Option A/B/C **trên version** |
| After accept | `service_lifecycle` theo line/slug + payment schedule + invoice draft. Convert idempotent |
| Client view | portal-web + share token. Wording **“Xác nhận đề xuất”** — không phải HĐ pháp lý |
| E-sign | W1 = checkbox + OTP email. Provider = wave sau |
| Margin | NSR = fee-only; **loại** media/pass-through no-markup. Floor mặc định **25%** |
| Tax | VND, VAT **8%**, snapshot lúc publish. Một legal entity **PTT HCM** |
| Quote code | `QT-PTT-{YYYY}-{SEQ:6}` unique tenant |
| Theme | Navy `#0F2747` / accent `#2563EB` / bg `#F4F6F8` (cùng CP OS) |
| JWT | `sub` only — `resolveCrmStaffUserId`. Guard `StaffOrInternalKeyGuard` + quote guard — **không** `StaffAuthGuard` trần |
| RBAC | Catalog-only seed. **Cấm** INSERT `staff_section_permissions` |
| AI | Tắt đến khi flag sau UAT (`QT_AI_ENABLED` unset) |

---

## 3. Personas, RBAC, phạm vi

Không import role Nova vào IdP. Map job function PTT + cap:

| Cap | Hành động | Màn |
|---|---|---|
| `crm_quote` | `view`, `view_all` | Vào module, list theo scope |
| `crm_quote` | `edit` | Tạo/sửa draft, line, KPI client-visible |
| `crm_quote` | `manage` | Policy, archive, đóng |
| `crm_quote.approve` | `execute` | Bước approval được route |
| `crm_quote.finance` | `view` / `edit` | Cost, margin, grant rate override |
| `crm_quote.legal` | `execute` | Điều khoản lệch template |
| `crm_quote.publish` | `execute` | Publish / send / revoke link |
| `crm_quote.convert` | `execute` | Accepted → lifecycle/invoice |
| `crm_quote.catalog` | `view` / `manage` | Service Catalog thương mại |
| `crm_quote.audit` | `view` | Nhật ký |

Seed catalog-only — grant qua Admin RBAC.

Phạm vi dữ liệu: owner / co-owner / team / `view_all`. Field-level: finance-restricted không xuống portal/PDF.

Client portal: role khách hiện có; không cấp cap nội bộ.

---

## 4. IA, route, screen catalog

OpsNav: Kinh doanh → **Báo giá** `/crm/proposals`.

Sidebar module (**đúng 7 mục**):

| # | Mục | Route mặc định |
|---|---|---|
| 1 | Tổng quan | `/crm/proposals` |
| 2 | Báo giá (danh sách) | `/crm/proposals/list` |
| 3 | Tạo báo giá | `/crm/proposals/new` · `/crm/proposals/[id]` |
| 4 | Service Catalog | `/crm/proposals/catalog` |
| 5 | Phê duyệt | `/crm/proposals/approvals` |
| 6 | Báo cáo | `/crm/proposals/reports` |
| 7 | Cấu hình | `/crm/proposals/settings` |

Proposal Studio: `/crm/proposals/[id]/studio` — không thêm nav.  
`/crm/proposals` workspace cũ **redirect** Tổng quan hoặc List theo `?id=`. Deep-link Deal Room / Consult: `?lead_id=&customer_id=&wizard=1` → NEW-01 / Builder.

| Screen | ID | Route / query | Mockup |
|---|---|---|---|
| Dashboard | OVR-01 | `/crm/proposals` | master + overview |
| Action Center | OVR-02 | `?panel=actions` | overview |
| Activity | OVR-03 | `/crm/proposals/activity` | overview |
| Quote list | LST-01 | `/crm/proposals/list` | list |
| Tạo báo giá | NEW-01 | `/crm/proposals/new` | list |
| Builder · bối cảnh | BLD-01 | `/crm/proposals/[id]` | builder |
| Builder · A/B/C | BLD-02 | `tab=options` | builder |
| Builder · dịch vụ & SKU | BLD-03 | `tab=services` | builder |
| Builder · KPI 3 lớp | BLD-04 | `tab=kpi` | builder |
| Builder · cost/margin | BLD-05 | `tab=cost` | builder |
| Builder · điều khoản | BLD-06 | `tab=terms` | builder |
| Builder · lịch sử | BLD-07 | `tab=history` | builder |
| Catalog lưới | CAT-01 | `/crm/proposals/catalog` | catalog |
| Catalog drawer | CAT-02 | `?service=` | catalog |
| Package ngành | CAT-03 | `tab=packages` | catalog |
| Rate card | CAT-04 | `tab=rates` | catalog |
| Brand storyboard template | CAT-05 / VID-TPL-01 | template production | catalog |
| Approval inbox | APR-01 | `/crm/proposals/approvals` | approval |
| Approval detail | APR-02 | `/crm/proposals/approvals/[id]` | approval |
| Proposal Studio | PRS-01 | `/crm/proposals/[id]/studio` | studio |
| Trang khách | PUB-01 | portal `/proposals/[token]` | public |
| Accept OTP | PUB-02 | modal trên PUB-01 | public |
| Expired / revoked | PUB-03 | cùng token, state chết | public |
| Convert | CVT-01 | `/crm/proposals/[id]/convert` | public |
| Báo cáo điều hành | RPT-01 | `/crm/proposals/reports` | reports |
| Funnel | RPT-02 | `tab=funnel` | reports |
| Margin | RPT-03 | `tab=margin` | reports |
| Lost reason | RPT-04 | `tab=loss` | reports |
| Engagement | RPT-05 | `tab=engagement` | reports |
| Defaults | SET-01 | `/crm/proposals/settings` | reports |
| Guardrail | SET-02 | `tab=guardrails` | reports |
| Rate admin | SET-03 | `tab=rates` | reports |
| Share / OTP | SET-04 | `tab=share` | reports |
| Approver | SET-05 | `tab=approvers` | reports |
| Clause template | SET-06 | `tab=templates` | reports |

**35 screen.** Sticky commercial (phí / media / VAT / GM / payment) là **chrome Builder**, không phải screen ID riêng.

### 4.1. UX state bắt buộc mọi màn nội bộ

Loading/skeleton · Empty + CTA · Error có bước xử lý · 403 · Search/filter/sort/pagination · Toast ≠ error · Activity trên object dài đời · `last_updated` ISO.

### 4.2. SoR — map entity

| Khái niệm | SoR RNOSAI |
|---|---|
| Quote | `crm_proposals` (mở rộng) — `quote_code`, `agency_client_id`, version pointer |
| QuoteVersion | `crm_quote_versions` **mới** |
| QuoteOption | `crm_quote_options` **mới** |
| Line | `crm_quote_line_item` mở rộng — option_id, media, cost, KPI, visibility, `package_tier` |
| Client | `crm_clients.id` + `customer_id` |
| Deal | `crm_leads` + Deal Room |
| Catalog | `crm_catalog_services` + `ops_service_profile` |
| Rate / Cost card | `crm_quote_rate_cards` / `crm_quote_cost_cards` **mới** |
| Approval | `crm_quote_approvals` **mới** |
| Publication / share / view | `crm_quote_publications` / `_shares` / `_view_events` |
| Accept | `crm_quote_acceptances` |
| Convert | `crm_quote_conversions` — unique `(version_id, target_type)` |
| Campaign / delivery | `service_lifecycle` — không bảng campaign 2 |
| Invoice | `invoices` / `orders` + `crm_quote_payment_schedules` |
| Video brand | Video SOP `/crm/video` + CP OS — quote chỉ gắn id sau convert |
| Staff | `crm_staff` — JWT `sub` → `resolveCrmStaffUserId` |

---

## 5. MOD-OVR — Tổng quan

**Mục tiêu:** Command center pipeline thương mại, SLA duyệt, hạn, khách vừa xem, sức khỏe margin.

### 5.1. OVR-01 Executive Dashboard

**Widget:** alert bar · **đúng 4 KPI** · quote theo trạng thái (count + value) · sức khỏe thương mại · việc cần xử lý · top dịch vụ theo giá trị.

| Thẻ | Metric | Công thức | Drill-down |
|---|---|---|---|
| Giá trị quote đang mở | `open_quote_value` | Σ payable các quote status ∈ draft…negotiation, kỳ + scope | LST-01 open |
| Chờ phê duyệt | `pending_approval_count` | version `submitted` route tới user/policy hiện tại | APR-01 |
| Tỷ lệ chốt | `quote_win_rate` | `accepted / (accepted + rejected)` **trong kỳ** — **label công thức trên thẻ** | RPT-01 |
| GM dự kiến (mở) | `forecast_gross_margin` | GM NSR các quote mở; **ẩn** nếu không `crm_quote.finance` | RPT-03 |

Filter: kỳ (7/30/tháng/quý) · scope Của tôi / Team / Toàn PTT. Đổi filter → mọi widget + URL (`from`,`to`,`scope`,`owner`).

**FR-OVR-001** Dashboard live, không sample. Trống = `—` / 0 thật.  
**FR-OVR-002** Đúng 4 KPI trên; cấm thêm thẻ bịa (media trong doanh thu, win rate không ghi mẫu số).  
**FR-OVR-003** Alert critical có severity, resource, owner, CTA → OVR-02.  
**FR-OVR-004** `last_updated` ISO; URL share được.

**AC-OVR-01** Finance thấy GM; AM không finance → thẻ 4 là `—` hoặc ẩn, không lộ NSR.  
**AC-OVR-02** Click thẻ 1 mở list đã filter open; thẻ 2 mở APR-01.

### 5.2. OVR-02 Action Center

Gom: approval SLA vỡ · hết hạn ≤7 ngày · khách viewed chưa phản hồi · thiếu cost · discount vượt cap.

Mỗi hàng: severity · title · impact · owner · SLA · CTA (Duyệt / Mở builder / Follow-up).

Escalate: approval +24h → owner + GDKD; expiry ≤3 ngày → AM; viewed +48h → task Deal Room; GM &lt; floor không publish trước approve.

**FR-OVR-005** Mọi item có `resource_type` + id + audit khi dismiss (không xóa sự kiện gốc).

### 5.3. OVR-03 Activity

Feed filter actor / action (`submit_approval`, `publication.viewed`, `approval.*`, `accept`, `convert`) / quote / time.  
Cột: thời điểm, actor, action, resource, snapshot (GM, discount, share id — **không** OTP/token raw).  
Export CSV = `crm_quote.audit`.

---

## 6. MOD-LST / NEW — Danh sách và tạo

### 6.1. LST-01 Quote list

Cột: mã `QT-PTT-…` + version · Khách / Lead (`LD-…`) AM 360 · Phương án · Tổng + phí DV · GM (finance) · Status · Hiệu lực + còn N ngày · Owner · Mở / Nhân bản.

Chip: Tất cả · Của tôi · Chờ tôi phê duyệt · Sắp hết hạn (≤7 ngày) · Đã gửi chưa phản hồi.  
Chip status đầy đủ 14 mã §14.  
Tìm mã / khách / lead / title. Filter owner. Export CSV field được phép. Phân trang 25/50/100.

**FR-LST-001** List theo scope; không leak quote ngoài ABAC.  
**FR-LST-002** Cột GM ẩn/— nếu thiếu finance.  
**FR-LST-003** Deep-link Deal Room giữ query `lead_id`.

**AC-LST-01** Tạo từ Consult `?lead_id=` → NEW-01 prefill, không 404.

### 6.2. NEW-01 Tạo báo giá

Ba nguồn (radio/card): **Từ Lead / Deal Room** (khuyến nghị) · **Từ AM 360** · **Trống**.

Field:

| Field | Bắt buộc | SoR |
|---|---|---|
| Nguồn + lead_id | nếu nguồn Lead | `crm_leads` select tên `LD-…` |
| agency_client_id | có trước submit | `crm_clients` select tên |
| title | có | |
| quote_type | có | enum new_business/renewal/upsell/retainer/campaign/project/change_request |
| owner_staff_id | có | prefill lead |
| quote_date / valid_until | có | default +30 ngày SET-01 |
| currency | khóa VND | |
| issuing_entity | khóa PTT-HCM | |

**Cấm** input UUID tự do. **Cấm** tạo client từ form này.

**FR-NEW-001** POST tạo root + working v1; cấp `quote_code` unique.  
**FR-NEW-002** Prefill contact quyết định + expected close từ lead.  
**AC-NEW-01** Lead có client + owner → Draft, audit `quote.created`.

---

## 7. MOD-BLD — Quote Builder

Layout: main (tab BLD-01…07) + **sticky phải** (đầu tư client-facing · sức khỏe nội bộ finance · payment).  
CTA: Lưu nháp · Xem Proposal (PRS-01) · Gửi phê duyệt.  
Autosave ~2s, optimistic lock `row_version`.

**Header bắt buộc trước submit:** title, `agency_client_id`, owner, VND, quote_date, valid_until, ≥1 line client-facing, payment % = 100, commercial validation.

### 7.1. BLD-01 Khách & bối cảnh

Hiển thị khách AM 360, contact, lead `LD-…`, mục tiêu, kỳ, audience, ngày/hạn. Đổi khách = select AM 360 (cùng cap).

**FR-BLD-001** Không render UUID. Deep-link Deal Room / AM 360.

### 7.2. BLD-02 Phương án A/B/C

Nhiều option; tối đa 1 `recommended`; `client_visible` per option. Duplicate option. Bảng so sánh deliverable / fee / media / forecast / GM nội bộ.

**FR-BLD-002** Accept (PUB-02) chọn **một** option → lock option + version.  
**FR-BLD-003** Option ẩn không vào portal/PDF/public API.

### 7.3. BLD-03 Service card + SKU 3 tầng + funnel

Line từ catalog snapshot: tên, `dv_code`, `package_tier` (Cơ bản / Tiêu chuẩn / Chuyên sâu), fee + media tách, metrics, included / timeline / assumption.  
Meta Ads: funnel Imp → Click → Lead → SQL + CTR/CPL/CVR, nhãn `projected`.  
Nút: Từ Catalog · dòng tùy chỉnh (flag + reason + review).  
**Draft / custom chưa kích hoạt → không add quote client-facing.**

**FR-BLD-004** Đổi SKU = đổi rate snapshot theo card còn hiệu lực tại `quote_date`.  
**FR-BLD-005** Media luôn dòng tách, không gộp fee.  
**AC-BLD-01** Service Draft: nút Thêm disabled + lý do.

### 7.4. BLD-04 KPI 3 lớp

Bảng: chỉ số · lớp (`committed` / `optimization_target` / `projected_result` / `assumption_input`) · giá trị · nguồn · assumption.  
Paid media: bắt buộc budget + platform + geo/audience + measurement trước gửi khách.

**FR-BLD-006** Forecast không được ghi/style “cam kết”. Publish có forecast → ≥1 assumption + disclaimer.

### 7.5. BLD-05 Chi phí & margin (restricted)

Cột labor / outsource / tools / GP / GM. Tổng NSR · Direct cost · GP · GM %.  
Override rate/cost = Finance + reason. NSR=0 → GM `null`.

**FR-BLD-007** 403 / không mount DOM số nếu thiếu `crm_quote.finance`.  
**FR-BLD-008** NSR = net fee-based, loại media no-markup.

### 7.6. BLD-06 Điều khoản & thanh toán

Template clause PTT HCM; lệch → Legal.  
Lịch: tổng % = 100; lệch 1 ₫ → đợt cuối; lệch % → block submit. Term &gt; 60 ngày → Finance.

**FR-BLD-009** Wording CTA khách: **Xác nhận đề xuất**.

### 7.7. BLD-07 Lịch sử / diff

Version state + diff commercial critical. Sau Approved, sửa price/qty/discount/tax/cost/scope/KPI visible/payment/clause → revision mới, bản cũ immutable, re-policy.

**FR-BLD-010** Compare v_n → v_n+1 lưu được, không chỉ UI.

---

## 8. MOD-CAT — Service Catalog

### 8.1. CAT-01 Lưới 13 nhóm

1 Strategy & Research · 2 Branding & Creative · 3 Content & Social · 4 Video & Image · 5 Performance & Media · 6 Web/LP/CRO · 7 SEO/AEO · 8 CRM/Automation/AI · 9 Email & Retention · 10 PR/KOL · 11 Event · 12 Sales Enablement B2B · 13 Data & Analytics · + package ngành.

Filter Active/Draft. Active + rate còn hiệu lực mới **Thêm vào báo giá**.

**FR-CAT-001** Mỗi service có `service_slug` và/hoặc `dv_code` → `ops_service_profile`. 3 gói = SKU cùng `dv_code`, không phải nhóm nav.

### 8.2. CAT-02 Drawer 6 tab

Tổng quan (included/excluded, CTA/UTA, owner, effort) · Deliverable · KPI 3 lớp · Timeline & Effort · Pricing & Cost (restricted) · Proposal & Policy (visibility, map section Studio).

**FR-CAT-002** Add line = snapshot JSON tại `quote_date`; sửa catalog sau **không** đổi version quote cũ.

### 8.3. CAT-03 Package ngành

Growth Launch · BĐS · Spa/Clinic · Education. Add package = N line snapshot + package discount.

### 8.4. CAT-04 Rate card

effective_from/to, Active/Retired. Hết hạn → cảnh báo/block theo SET-02. Thiếu cost = flag Finance.

### 8.5. CAT-05 / VID-TPL-01 Brand storyboard

**Không** là màn quote IA. Template deliverable production (Reels / Brand Film): master 1080×1920, 45s, 6 scene, hook → strategy → creative → performance/CRM → CTA **ĐẶT LỊCH TƯ VẤN**.  
Khi convert line production → optional Video SOP `/crm/video` hoặc CP OS. QT **không** host editor.

Hai file mockup brand-video cũ = một storyboard (trùng); giữ làm nguồn visual.

---

## 9. MOD-APR — Phê duyệt

### 9.1. APR-01 Inbox

Queue bước user được route. Cột quote · trigger · bước · SLA · owner. Chip: Chờ tôi · Đã xử lý · SLA vỡ.

### 9.2. APR-02 Detail

Timeline step (done / wait / lock / skip) · policy badges · diff version · commercial snapshot (NSR, cost, GP, GM) · comment bắt buộc khi return/reject · delegate (actor gốc + ủy quyền + hạn + lý do).

Policy mặc định (SET-02, cấu hình được):

| Điều kiện | Approver |
|---|---|
| Discount ≤ 5% và GM ≥ 25% | Auto / Sales Manager |
| Discount 5–10% | AM Lead / AD |
| Discount &gt; 10% | AD + Finance |
| GM &lt; 25% | Finance + GDKD |
| Tổng &gt; 200.000.000 ₫ | GDKD |
| Payment term &gt; 60 ngày | Finance |
| Clause lệch template | Legal |
| Custom / zero-price / thiếu cost | Finance |

**FR-APR-001** Không bypass policy bằng dòng ảo.  
**FR-APR-002** Publish chỉ khi mọi required step approved + còn hạn.  
**AC-APR-01** GM 22,4% &lt; 25% → route Finance + GDKD; không publish trước approve.

---

## 10. MOD-PRS — Proposal Studio

PRS-01 · 9 section. Merge field từ version. **Cấm** cost/margin/approval/hidden option vào HTML/PDF/API public.

| # | Section | Bắt buộc publish |
|---|---|---|
| 01 | Cover & thương hiệu | Title, ngày, valid, quote_code, entity PTT HCM |
| 02 | Bối cảnh & mục tiêu | Objective |
| 03 | Chiến lược | ≥1 trụ cột |
| 04 | Phạm vi | ≥1 service/deliverable visible |
| 05 | KPI & hiệu quả | Disclaimer + ≥1 assumption nếu có forecast |
| 06 | Timeline | ≥1 milestone |
| 07 | Đầu tư | Tổng &gt; 0; fee/media tách; payment 100% |
| 08 | Điều khoản | Bật + clause snapshot |
| 09 | Xác nhận | Bật CTA + checkbox copy |

Gate: tắt 08 hoặc 09 → không publish.  
Xuất bản: email + token, expiry, PDF flag, OTP flag, revoke. Token gắn cứng version published.

**FR-PRS-001** Preview khách = cùng renderer PUB-01 (không hai engine).  
**AC-PRS-01** Public JSON không chứa key cost/margin/approval (kể cả null-omit vẫn không có field).

---

## 11. MOD-PUB / CVT — Khách và convert

### 11.1. PUB-01 Trang đề xuất

Hero PTT · mục tiêu · scope · KPI có nhãn · assumption · đầu tư · payment · **Xác nhận đề xuất** · **Yêu cầu điều chỉnh**.  
Privacy notice nếu bật view tracking. Session portal ưu tiên; token là kênh gửi.

### 11.2. PUB-02 Accept

Chọn option visible · name · title · email OTP · checkbox điều khoản · OTP.  
Ghi: timestamp, IP/UA, option_id, version_id. Status → `accepted`, lock version.

**FR-PUB-001** W1 không phải chữ ký số pháp lý. Wording không “ký hợp đồng”.

### 11.3. PUB-03 Expired / revoked

Không lộ body. Hướng dẫn liên hệ AM. Token không tái sử dụng.

**FR-PUB-002** Expired/revoked → 410-equivalent UI, accept API 409/410.

### 11.4. CVT-01 Convert

1 version accepted → N `service_lifecycle` (slug/dv_code) + 1 payment schedule + invoice draft.  
Content OS / CP / Video SOP chỉ khi line đúng loại.  
Idempotent `(version_id, target_type)`. Lần 2 trả cùng conversion id.

**FR-CVT-001** Cần `crm_quote.convert`.  
**AC-CVT-01** Convert 2 lần → một bộ lifecycle/schedule.  
**AC-CVT-02** Line Brand Film → deep-link Video SOP/CP + VID-TPL-01; QT không render video.

Revision từ khách → quote `negotiation`, task owner, không tự tạo version.

---

## 12. MOD-RPT — Báo cáo

Filter kỳ + scope. Export XLSX = `view_audit`. Doanh thu agency **không** cộng media.

| ID | Nội dung |
|---|---|
| RPT-01 | Sent count/value · sent-to-viewed · sent-to-accepted · avg approval hours · trend tuần |
| RPT-02 | Funnel Draft→Sent→Viewed→Accepted — **mẫu số trên từng bậc** |
| RPT-03 | Margin theo nhóm (finance, NSR fee-only) |
| RPT-04 | Lost reason — rejected bắt buộc enum |
| RPT-05 | Engagement: first/last view, section, comment |

**FR-RPT-001** Dashboard win rate và RPT sent-to-accepted là **hai** công thức; UI phải ghi rõ.  
**FR-RPT-002** RPT-03 403 nếu thiếu finance.

---

## 13. MOD-SET — Cấu hình

| ID | Nội dung |
|---|---|
| SET-01 | Mã `QT-PTT-{YYYY}-{SEQ:6}`, validity 30, VAT 8%, VND, payment 50/30/20, TZ `Asia/Ho_Chi_Minh`, entity PTT HCM |
| SET-02 | Bảng guardrail §9.2 — floor 25%, discount cap, 200tr, 60 ngày |
| SET-03 | Deep-link CAT-04; Active/Retired; import = W3 |
| SET-04 | Expiry token, PDF, OTP, view tracking |
| SET-05 | Ma trận approver theo cap; delegate |
| SET-06 | Clause + cover Studio; cấm merge field finance |

SSO / MFA / IP allowlist = platform Admin — không nằm QT.

**FR-SET-001** Đổi policy **không** áp lại version đã approved (chỉ version working mới).

---

## 14. Vòng đời

### 14.1. Status quote (14)

`draft` · `in_review` · `pending_approval` · `returned` · `approved` · `sent` · `viewed` · `negotiation` · `accepted` · `rejected` · `expired` · `cancelled` · `superseded` · `archived`.

Tương thích API cũ `draft/sent/accepted/rejected` đến khi FE mới ship.

### 14.2. Version state

`working` → `submitted` → `approved` → `published` → `accepted` | `superseded`.

### 14.3. Chuyển bắt buộc

- Draft → pending_approval: header + ≥1 line + payment 100% + validation.  
- Pending → approved: mọi required step.  
- Approved → sent: có publication.  
- Sent/viewed/negotiation → accepted: PUB-02.  
- Job `valid_until` TZ quote → `expired` nếu chưa accepted.

---

## 15. Pricing, tax, margin, KPI

```text
Gross Amount = Quantity × Unit Price
Net Amount   = Gross Amount − Line Discount
Tax Amount   = Taxable × VAT_rate_snapshot
Line Total   = Net Amount + Tax Amount
Fee total    = Σ fee-based
Media total  = Σ media/pass-through
Quote payable = Fee + Media − Package Discount + VAT

Net Service Revenue = Net fee-based (loại media no-markup)
Direct Cost         = Labor + Outsource + Other direct
Gross Profit        = NSR − Direct Cost
Gross Margin %      = GP / NSR × 100   (NSR=0 → null)
```

Money: `NUMERIC(18,2)` **hoặc** BIGINT VND đã làm tròn — **một** convention trong migration. Decimal, không float tiền.

KPI class: `committed` (cần acceptance criteria) · `optimization_target` · `projected_result` (disclaimer + assumption) · `assumption_input`.

---

## 16. Business rules

| ID | Quy tắc |
|---|---|
| BR-QT-001 | `quote_code` unique tenant, không tái sử dụng |
| BR-QT-002 | Gửi khách chỉ version Approved+Published còn hạn |
| BR-QT-003 | Thiếu contact / total / payment / required terms → không send |
| BR-QT-004 | Cost, margin, approval note, internal note **không** vào portal/PDF/public API |
| BR-QT-005 | Sửa commercial/scope/KPI visible sau Approved → revision |
| BR-QT-006 | Vượt discount cap hoặc dưới GM floor → không bypass dòng ảo |
| BR-QT-007 | Media tách fee trên UI + proposal |
| BR-QT-008 | Forecast không được ghi “cam kết” |
| BR-QT-009 | Expired/revoked token không accept |
| BR-QT-010 | Token gắn một version |
| BR-QT-011 | Payment 100% hoặc tổng tiền = payable |
| BR-QT-012 | Tax snapshot lúc publish |
| BR-QT-013 | Custom item: mã tạm, reason, owner, review |
| BR-QT-014 | Accept một option → lock; option khác giữ audit |
| BR-QT-015 | Một billing contact + một decision-maker tại một thời điểm |
| BR-QT-016 | Soft delete only |
| BR-QT-017 | Rate card hết hạn → cảnh báo/block theo policy |
| BR-QT-018 | Delegation lưu actor gốc + ủy quyền + hạn + lý do |
| BR-QT-019 | Convert idempotent `(version_id, target_type)` |
| BR-QT-020 | Brand film không clone pipeline Video SOP/CP |
| BR-QT-021 | JWT không có `staffId`; resolve như CP OS |
| BR-QT-022 | Guard `@UseGuards(StaffOrInternalKeyGuard, StaffQuoteGuard)` |
| BR-QT-023 | Không tạo `crm_clients` từ form quote |
| BR-QT-024 | Service catalog Draft không add quote client-facing |
| BR-QT-025 | Scope Của tôi / Team / Toàn PTT server-side |

---

## 17. Data model (mở rộng, không song song)

`crm_proposals` thêm: `quote_code`, `agency_client_id`, `current_version_id`, `quote_type`, `issuing_entity`, `currency_code`, `timezone`, `title`, `objective`, `audience`, `campaign_period`, `owner_staff_id`, `co_owner_staff_ids`, `confidentiality_level`, `row_version`, `archived_at`.

Giữ `customer_id`, `lead_id`, `presales_id`, `lifecycle_id`, `status`, `valid_until`. `total_vnd` = denormalize.

Bảng mới: `crm_quote_versions` · `crm_quote_options` · mở rộng `crm_quote_line_item` · `crm_quote_kpis` · `crm_quote_deliverables` · `crm_quote_payment_schedules` · `crm_quote_clauses` · `crm_quote_approvals` + steps · `crm_quote_publications` · `crm_quote_shares` · `crm_quote_view_events` · `crm_quote_comments` · `crm_quote_acceptances` · `crm_quote_activities` · `crm_quote_audit` · `crm_quote_conversions` · `crm_quote_rate_cards` · `crm_quote_cost_cards` · `crm_quote_catalog_revisions`.

---

## 18. API

Prefix `/api/crm/proposals` để tương thích.

| Method | Path | Việc |
|---|---|---|
| GET | `/proposals` | List/filter/scope |
| POST | `/proposals` | Create root + working v1 |
| GET | `/proposals/:id` | Aggregate theo quyền |
| PATCH | `/proposals/:id` | Header; `If-Match` row_version |
| POST | `/proposals/:id/versions` | Revision |
| PATCH | `/quote-versions/:vid` | Working |
| POST | `/quote-versions/:vid/recalculate` | Price/cost/margin |
| POST | `/quote-versions/:vid/submit-approval` | Submit |
| POST | `/quote-approval-steps/:sid/actions` | approve/return/reject/delegate |
| POST | `/quote-versions/:vid/publish` | Publication |
| POST | `/quote-publications/:id/shares` | Token |
| POST | `/quote-versions/:vid/convert` | Lifecycle/invoice |
| GET/POST | `/quote-catalog/services` | Catalog |
| GET | `/proposals/reports` | Analytics |
| POST | `/public/proposals/:token/acceptance` | Portal |

Idempotency-Key: create, publish, send, accept, convert.  
Public API **không** trả cost/margin/approval/hidden option.

---

## 19. Tích hợp

| Hệ thống | Khi | Việc |
|---|---|---|
| Lead / Deal Room / Consult | Tạo quote | Prefill; activity ngược lead |
| AM 360 | Header | Client/contact |
| Catalog / Ops DV | Add line | Snapshot rate + `dv_code` + tier |
| `service_lifecycle` | Convert | 1 line → 1 lifecycle (bundle → nhiều slug) |
| Invoices / Orders | Convert | Schedule từ payment |
| Content OS | Line content | Deep-link lifecycle |
| CP OS | Line AI video | Tạo/gắn CP project |
| Video SOP | Line human/brand film | `vd_project_id` + VID-TPL-01 |
| Portal | Publish/accept | Trang khách |
| Email | Send/remind | Template PTT, không SMTP từ browser |
| KPI Hub | Report | Fact quote version — không bịa CTR |
| CSD | Không | Không clone ticket |

Event: `quote.created|submitted|approved|sent|viewed|comment_added|accepted|rejected|expired|converted` — `tenant_id`, `quote_id`, `version_id`, `correlation_id`.

---

## 20. UX và NFR

Desktop-first Builder; tablet xem list/approve. Token navy/accent/bg như CP OS. Status: text + icon, không chỉ màu. KPI forecast gắn nhãn chữ.

| Hạng | Mục tiêu |
|---|---|
| List 25 rows | P95 ≤ 2,5s |
| Builder ≤ 200 lines | P95 ≤ 3s |
| Recalc | P95 ≤ 1,5s |
| Preview | P95 ≤ 5s |
| PDF | Async P95 ≤ 60s |
| Portal | P95 ≤ 2,5s |
| Availability | 99,9%/tháng trừ bảo trì |
| RPO/RTO | 15 phút / 4 giờ |

Bảo mật: RBAC server-side, TLS, token entropy + expiry + rate limit, quét upload, không log PII/token/OTP. Audit: status, approval, share, accept, export, rate override. WCAG 2.1 AA khi khả thi.

---

## 21. Acceptance enterprise

**AC-01 Tạo từ Deal** — Lead có client + owner → NEW-01 → Draft, `quote_code` unique, kế thừa, audit.

**AC-02 Catalog snapshot** — Add package Active → line + deliverable + KPI + rate/cost tại quote_date; đổi catalog sau không sửa version cũ.

**AC-03 Margin thấp** — GM 22,4% &lt; floor 25% → submit route Finance + GDKD; không publish trước approve.

**AC-04 Revision** — v1 Published Sent → đổi qty/giá → bắt buộc v2, v1 immutable, re-policy nếu critical.

**AC-05 Accept** — Token v2, chọn option B, checkbox + OTP → Acceptance, accepted, lock, cho phép convert.

**AC-06 Leak** — Public render không chứa cost/margin/internal/hidden option (kể cả JSON).

**AC-07 Payment** — Payable 265.647.600 · 50/30/20 → tổng đúng; lệch 1₫ vào đợt cuối.

**AC-08 Convert idempotent** — Accept + convert 2 lần → một bộ lifecycle/schedule.

**AC-09 Draft catalog** — Service Draft không add được quote client-facing.

**AC-10 Brand video** — Line Brand Film convert → deep-link Video SOP/CP + template 6 scene; QT không host editor.

**AC-11 Dual packaging** — Line có `package_tier`; version có option A/B/C; đổi SKU đổi fee snapshot.

**AC-12 Scope** — AM Của tôi không thấy quote team khác; `view_all` thấy Toàn PTT.

---

## 22. Wave triển khai (thứ tự code — spec đủ hết)

| Wave | Ship | AC |
|---|---|---|
| **W1** | List/OVR live `—` · NEW từ lead/client · header · line catalog DV + tier · pricing/VAT/discount · GM nội bộ · 14 status + expiry job · RBAC · PDF đơn giản · send email · accept portal tối thiểu · convert lifecycle | AC-01, 02, 07, 09, 12 |
| **W2** | Option A/B/C · service card/funnel · KPI class · payment UI · approval policy · version compare · Studio 9 · share token/OTP · catalog drawer 13 nhóm | AC-03, 04, 05, 06, 11 |
| **W3** | Delegation/SLA · e-sign adapter · BI events · brand-video → SOP/CP · import catalog · AI draft text (cờ tắt mặc định) | AC-08, 10 |

Không bắt đầu Wave *n* khi UAT Wave *n−1* chưa xanh. `QT_AI_ENABLED` unset đến hết UAT W1.

---

## 23. Definition of Done

Một FR xong khi: AC viết rõ · đủ UX state §4.1 · authorize + audit server · test unit/integration/e2e · migration tương thích `crm_proposals` cũ · không rò cost ra client · publish/accept/convert idempotent · số liệu trống = `—`.

---

## 24. Mockup SoT

| File | Screen |
|---|---|
| [rnosai-quote-os-srs-mockup.html](../../design/rnosai-quote-os-srs-mockup.html) | **Master** — 35 ID, nhảy màn, Toàn catalog |
| [overview](../../design/rnosai-quote-os-overview-mockup.html) | OVR-01…03 |
| [list](../../design/rnosai-quote-os-list-mockup.html) | LST-01, NEW-01 |
| [builder](../../design/rnosai-quote-os-builder-mockup.html) | BLD-01…07 |
| [catalog](../../design/rnosai-quote-os-catalog-mockup.html) | CAT-01…05 |
| [approval](../../design/rnosai-quote-os-approval-mockup.html) | APR-01…02 |
| [studio](../../design/rnosai-quote-os-studio-mockup.html) | PRS-01 |
| [public](../../design/rnosai-quote-os-public-mockup.html) | PUB-01…03, CVT-01 |
| [reports](../../design/rnosai-quote-os-reports-mockup.html) | RPT-01…05, SET-01…06 |

CSS: [rnosai-quote-os-mockup.css](../../design/rnosai-quote-os-mockup.css).

Nguồn cũ (không SoT): `rnosai-quote-os-module-mockup.html`, `*-proposal-studio-*`, `*-catalog-*`, `*-brand-video-*`.

---

## 25. Self-review v2.0

- Không TBD trong FR Wave. Wave = lịch code.  
- v1 “SoT = Nova demo / RPT-SET gộp” đã sửa (35 màn, chrome PTT).  
- Mockup master: **35 screen** OVR×3 LST NEW BLD×7 CAT×5 APR×2 PRS PUB×3 CVT RPT×5 SET×6. Studio không phải nav 8.  
- Runtime cấm số sample.  
- Khóa SoR `crm_proposals`, dual packaging, NSR, VAT 8%, OTP, convert idempotent, BR-QT-001…025 đã ghi.  
- Không ô UUID, không khách ma, không “ký hợp đồng” trên portal.

---

## 26. Plan triển khai

SoT code: [2026-09-08-quotation-os.md](../plans/2026-09-08-quotation-os.md) — 36 task, W1–W3, map 35 màn mockup.

Không bắt đầu Wave *n* khi UAT Wave *n−1* chưa xanh. `QT_AI_ENABLED` unset đến hết UAT W1.

---

**Kết thúc tài liệu.**

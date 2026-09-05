# Checklist thu thập yêu cầu khách hàng — Giai đoạn Pre-sales

**Phiên bản:** 1.0 · 2026-08-24  
**Đối tượng:** AM / Pre-sales PTT  
**Nguồn hệ thống:** `presales-workflow-steps.data.json`, Intake BANT, `PRESALES_L2_DOCS_CATALOG`  
**Liên quan:** [Hướng dẫn phân hệ Lead](./huong-dan-phan-he-lead-day-du.md) · [Lead → Retain](./huong-dan-day-du-lead-den-cham-soc-khach-hang.md)

---

## Cách dùng

Pre-sales trên Lead gồm **3 giai đoạn** — tick theo thứ tự:

| Giai đoạn | Mục tiêu | Trên RNOSAI |
|-----------|----------|-------------|
| **Lead** | Qualify nhanh, thu thông tin tối thiểu | Task Lead + Intake Discovery |
| **Consult** | Discovery sâu, audit/survey, thu tài liệu L2 | Task Consult + Intake BANT + L2 docs |
| **Proposal** | Đủ dữ liệu soạn báo giá / HĐ | Task Proposal + Gate L1 |

**Quy tắc vàng**

- Intake BANT: `/crm/intake?lead_id={id}` — **Discovery → BANT → Red flags → Hoàn thành**
- BANT ≥ **24/30** → Go · **18–23** → Nurture · **< 18** → No-Go
- Tài liệu **L2** phải tick đủ **trước khi ✓ task Consult**
- Chuyển giai đoạn qua **Funnel stepper** trên chi tiết lead

---

## A. Checklist chung (mọi dịch vụ)

### A1. Thông tin liên hệ & bối cảnh

- [ ] Tên công ty / thương hiệu
- [ ] Người liên hệ + chức danh
- [ ] SĐT / Email / Zalo (đã verify)
- [ ] Ngành / quy mô DN / thị trường chính
- [ ] Nguồn lead (Meta / Google / Webform / Referral / Outbound)
- [ ] Dịch vụ quan tâm (đã chọn slug trên panel Pre-sales)

### A2. Discovery — Gọi điện (12 câu)

- [ ] Dịch vụ đang quan tâm? (SEO / Ads / Web / Content / chưa rõ?)
- [ ] Website / domain hiện tại (nếu có)?
- [ ] **Pain point #1** cần giải quyết gấp nhất? *(critical)*
- [ ] **Ngân sách dự kiến** (range/tháng hoặc dự án)? Ai duyệt chi? *(critical)*
- [ ] Timeline bắt đầu mong muốn?
- [ ] **Ai là decision maker / người ký HĐ?** *(critical)*
- [ ] Đã thử agency hoặc tự làm gì? Kết quả?
- [ ] KPI đo thành công (traffic, lead, doanh thu…)?
- [ ] Ngành / quy mô / thị trường chính?
- [ ] Kỳ vọng cụ thể từ PTT?
- [ ] Deadline campaign / mùa vụ / họp board?
- [ ] Dịch vụ nào ưu tiên nhất nếu phải chọn một?

### A3. Discovery — Gặp trực tiếp (10 câu)

- [ ] Mục tiêu kinh doanh 6–12 tháng? KPI đo thành công?
- [ ] Khách hàng lý tưởng (ICP)?
- [ ] **Điểm đau lớn nhất? Đã thử giải pháp nào?** *(critical)*
- [ ] Quy trình duyệt chi / ký HĐ nội bộ?
- [ ] Đối thủ chính? Muốn khác biệt ở đâu?
- [ ] Team marketing hiện tại: ai làm gì? Thiếu gì?
- [ ] **Ngân sách đã duyệt hay đang xin duyệt?** *(critical)*
- [ ] **Timeline bắt buộc** (campaign, mùa vụ, board)? *(critical)*
- [ ] Rủi ro lớn nhất nếu chọn sai đối tác?
- [ ] Tiêu chí chọn agency (giá, case, SLA, báo cáo)?

### A4. BANT (chấm 1–5 mỗi tiêu chí, tổng /30)

| Tiêu chí | Câu hỏi gợi ý | Điểm (1–5) |
|----------|---------------|------------|
| **Budget** | Ngân sách thực tế/tháng hoặc dự án? Ai duyệt chi? | |
| **Authority** | Ai ký HĐ? Ai quyết định cuối cùng? | |
| **Need** | Pain point #1? Hậu quả nếu không giải quyết? | |
| **Timeline** | Khi nào cần bắt đầu? Deadline campaign/go-live? | |
| **Fit** | Phù hợp ICP PTT? Scope trong năng lực? | |
| **History** | Đã thử gì? Agency cũ? Kết quả? | |
| | **Tổng BANT** | **/30** |

**Quyết định:** ☐ Go · ☐ Nurture · ☐ No-Go · Lý do: _______________

### A5. Red flags (tick nếu phát hiện)

- [ ] Chưa rõ nhu cầu — chỉ hỏi giá
- [ ] Không có ngân sách / từ chối nêu range
- [ ] Không tiếp cận được decision maker
- [ ] Kỳ vọng không thực tế (kết quả trong 1–2 tuần)
- [ ] Từ chối chia sẻ thông tin cơ bản
- [ ] Ghost sau 2 lần follow-up
- [ ] So sánh giá với freelancer không cùng scope
- [ ] Đa dịch vụ nhưng không ưu tiên — khó scope

### A6. Gate L1 — Trước khi chuyển Proposal

- [ ] Task **Consult** hoàn tất (✓)
- [ ] **Tên kế hoạch MKT sơ bộ** đã nhập
- [ ] **North Star** hoặc **Mục tiêu chiến lược** đã nhập
- [ ] **Thông điệp thị trường** (market_message)
- [ ] **Kênh tiếp cận / Media** (media_reach)
- [ ] **Chiến lược chuyển đổi** (conversion_strategy)

---

## B. Checklist theo dịch vụ

> Mỗi dịch vụ: **Lead (qualify)** → **L2 docs (thu trước Consult)** → **Consult (discovery sâu)** → **Proposal (đầu vào báo giá)**

---

### 1. SEO tổng thể (`dich-vu-seo-tong-the`)

#### Lead — Qualify
- [ ] Ngành KH
- [ ] Ngân sách/tháng (VND)
- [ ] Website domain
- [ ] Nhu cầu cụ thể

#### L2 — Tài liệu thu trước Consult
- [ ] GSC read access
- [ ] GA4
- [ ] 2–3 đối thủ
- [ ] Danh sách từ khóa seed

#### Consult — Yêu cầu chi tiết
- [ ] Tình trạng website hiện tại (technical, tốc độ, CWV)
- [ ] Đối thủ chính
- [ ] Từ khóa mục tiêu (volume, difficulty)

#### Proposal — Đầu vào
- [ ] KPI cam kết (traffic / ranking)
- [ ] Timeline (tháng, thường 3–6)
- [ ] Ngân sách/tháng (VND)

---

### 2. AEO (`dich-vu-aeo`)

#### Lead — Qualify
- [ ] Ngành KH
- [ ] Website domain
- [ ] Ngân sách/tháng (VND)
- [ ] Nhu cầu (xuất hiện ChatGPT/Gemini/Perplexity)

#### L2 — Tài liệu
- [ ] URL website / landing
- [ ] Content hiện có
- [ ] Test query brand trên ChatGPT / Gemini / Perplexity

#### Consult
- [ ] Kết quả audit AI search hiện tại
- [ ] Content gaps phát hiện

#### Proposal
- [ ] Mục tiêu cam kết (tần suất xuất hiện AI search)
- [ ] Timeline (tháng)
- [ ] Ngân sách (VND)

---

### 3. SEO Local (`dich-vu-seo-local`)

#### Lead — Qualify
- [ ] Ngành
- [ ] Thành phố / khu vực
- [ ] Tình trạng GBP hiện tại
- [ ] Ngân sách/tháng (VND)

#### L2 — Tài liệu
- [ ] Link GBP
- [ ] NAP chi nhánh
- [ ] Ảnh cửa hàng
- [ ] Review count / snapshot

#### Consult
- [ ] Kết quả GBP audit (info, review, ảnh, Q&A)
- [ ] Từ khóa local mục tiêu

#### Proposal
- [ ] KPI cam kết (Local Pack %)
- [ ] Timeline (tháng)
- [ ] Ngân sách/tháng (VND)

---

### 4. SEO Audit (`dich-vu-seo-audit`)

#### Lead — Qualify
- [ ] Website cần audit
- [ ] Ngành
- [ ] Ngân sách audit (VND)
- [ ] Mục tiêu audit

#### L2 — Tài liệu
- [ ] GSC read access
- [ ] GA4
- [ ] Hosting / server info
- [ ] Mục tiêu audit

#### Consult
- [ ] Phạm vi audit (technical, on-page, off-page, content, competitor)
- [ ] Tình trạng website sơ bộ

#### Proposal
- [ ] Deliverables cam kết (định dạng báo cáo)
- [ ] Timeline giao báo cáo (ngày)
- [ ] Phí audit (VND)

---

### 5. Quản trị website (`dich-vu-quan-tri-website`)

#### Lead — Qualify
- [ ] Website domain
- [ ] Nền tảng (WordPress / custom)
- [ ] Ngành
- [ ] Ngân sách/tháng (VND)

#### L2 — Tài liệu
- [ ] Admin WP / hosting
- [ ] Backup status
- [ ] Plugin list

#### Consult
- [ ] Tình trạng website (tốc độ, bảo mật, backup, plugin)
- [ ] Vấn đề cần giải quyết (pain points)

#### Proposal
- [ ] Scope dịch vụ (cập nhật, fix, bảo mật…)
- [ ] Hợp đồng (tháng)
- [ ] Phí/tháng (VND)

---

### 6. Thiết kế website (`thiet-ke-website`)

#### Lead — Qualify
- [ ] Ngành
- [ ] Loại website (corporate / ecomm / portfolio)
- [ ] Ngân sách (VND)
- [ ] Deadline mong muốn

#### L2 — Tài liệu
- [ ] Brand assets (logo, màu, font)
- [ ] Sitemap draft
- [ ] Website tham khảo (URLs)

#### Consult
- [ ] Yêu cầu chi tiết (mục tiêu, đối tượng, tính năng)
- [ ] Website tham khảo (URLs)
- [ ] Số trang cần thiết kế

#### Proposal
- [ ] Deliverables (Figma / PSD, số revision)
- [ ] Timeline (tuần)
- [ ] Phí thiết kế (VND)

---

### 7. Website trọn gói (`thiet-ke-website-tron-goi`)

#### Lead — Qualify
- [ ] Ngành
- [ ] Loại website
- [ ] Tính năng cần có
- [ ] Ngân sách (VND)

#### L2 — Tài liệu
- [ ] Feature list
- [ ] Payment / CRM integrations
- [ ] Hosting / domain

#### Consult
- [ ] Yêu cầu kỹ thuật chi tiết
- [ ] Tích hợp cần thiết (payment, CRM, API…)

#### Proposal
- [ ] Scope dự án (design + dev + go-live)
- [ ] Timeline (tuần)
- [ ] Phí trọn gói (VND)

---

### 8. Landing page (`thiet-ke-landing-page`)

#### Lead — Qualify
- [ ] Ngành
- [ ] Mục đích LP (lead gen / sales / event)
- [ ] Campaign đi kèm (Ads / Email…)
- [ ] Ngân sách (VND)

#### L2 — Tài liệu
- [ ] Offer / chương trình
- [ ] Copy draft
- [ ] Campaign đi kèm
- [ ] Brand guideline

#### Consult
- [ ] Đối tượng mục tiêu
- [ ] USP / điểm khác biệt
- [ ] CTA chính

#### Proposal
- [ ] Deliverables (số section, có code không)
- [ ] Timeline (ngày)
- [ ] Phí (VND)

---

### 9. Facebook Ads (`quang-cao-facebook`)

#### Lead — Qualify
- [ ] Ngành sản phẩm
- [ ] Ngân sách/ngày (VND)
- [ ] Mục tiêu campaign (lead / sale / traffic)
- [ ] Có tài khoản Ads không

#### L2 — Tài liệu
- [ ] Ads account read
- [ ] Pixel / CAPI
- [ ] LP URL
- [ ] Lịch sử spend

#### Consult
- [ ] Đối tượng mục tiêu
- [ ] Kết quả Ads trước đây
- [ ] USP sản phẩm

#### Proposal
- [ ] KPI cam kết (CTR min, CPL target, ROAS)
- [ ] Timeline (tháng)
- [ ] Phí quản lý/tháng (VND)

---

### 10. Google Ads (`quang-cao-google`)

#### Lead — Qualify
- [ ] Ngành / sản phẩm
- [ ] Ngân sách/tháng (VND)
- [ ] Loại campaign (Search / Display / Shopping)
- [ ] Có Google Ads account không

#### L2 — Tài liệu
- [ ] Account read
- [ ] Conversion tracking
- [ ] LP URL
- [ ] CPC ước tính / benchmark

#### Consult
- [ ] Từ khóa mục tiêu
- [ ] Kết quả Google Ads hiện tại

#### Proposal
- [ ] KPI cam kết (Impression Share / CPA)
- [ ] Timeline (tháng)
- [ ] Phí quản lý/tháng (VND)

---

### 11. Thuê tài khoản quảng cáo (`thue-tai-khoan-quang-cao`)

#### Lead — Qualify
- [ ] Nền tảng (Meta / Google / TikTok)
- [ ] Ngân sách/tháng (VND)
- [ ] Lý do cần thuê (bị khóa / mới / khác)
- [ ] Ngành

#### L2 — Tài liệu
- [ ] Lịch sử policy
- [ ] Sản phẩm QC / compliance
- [ ] Landing compliance

#### Consult
- [ ] Lịch sử tài khoản KH
- [ ] Đánh giá rủi ro

#### Proposal
- [ ] Điều khoản chính (phí, % spend, trách nhiệm)
- [ ] Phí thuê/tháng (VND)
- [ ] Thời hạn hợp đồng (tháng)

---

### 12. Tiếp thị nội dung (`tiep-thi-noi-dung`)

#### Lead — Qualify
- [ ] Ngành
- [ ] Kênh cần content (blog / social / …)
- [ ] Số bài/tháng mong muốn
- [ ] Ngân sách/tháng (VND)

#### L2 — Tài liệu
- [ ] Content hiện có
- [ ] Brand voice
- [ ] Competitor URLs

#### Consult
- [ ] Content KH đang có
- [ ] Đối thủ về content
- [ ] Đối tượng độc giả

#### Proposal
- [ ] Số bài/tháng cam kết
- [ ] KPI traffic cam kết
- [ ] Phí/tháng (VND)

---

### 13. Lead Generation (`lead-gen`)

> Dùng khi lead inbound chưa xác định DV cụ thể hoặc cần full-funnel.

#### Lead — Qualify
- [ ] Ngành KH
- [ ] Kênh lead chính
- [ ] Nhu cầu / pain
- [ ] Ngân sách/tháng (VND)
- [ ] Mục tiêu (lead / sale / traffic)

#### L2 — Tài liệu
- [ ] Meta lead form export
- [ ] Ads account read
- [ ] LP URL
- [ ] CRM screenshot
- [ ] Spend 3 tháng

#### Consult
- [ ] Hiện trạng funnel & kênh (ads / organic / LP / CRM)
- [ ] ICP & đối tượng mục tiêu
- [ ] KPI hiện tại & mục tiêu
- [ ] Phạm vi PTT đề xuất (Ads / LP / CRM / full funnel)

#### Proposal
- [ ] KPI cam kết (CPL / ROAS / leads)
- [ ] Timeline (tháng)
- [ ] Phí quản lý/tháng (VND)

---

## C. Checklist nhanh 1 trang (in / PDF)

**Lead ID:** ________ · **KH:** ________________ · **Dịch vụ:** ________________ · **AM:** ________

| # | Hạng mục | ✓ | Ghi chú |
|---|----------|---|---------|
| 1 | Liên hệ + ngành + nguồn lead | ☐ | |
| 2 | Discovery critical (pain, budget, DM) | ☐ | |
| 3 | BANT /30 + quyết định Go/Nurture/No-Go | ☐ | |
| 4 | Red flags đã xử lý / escalate | ☐ | |
| 5 | L2 docs đủ (xem mục B theo DV) | ☐ | |
| 6 | Task Consult ✓ + chiến lược MKT sơ bộ | ☐ | |
| 7 | Gate L1 (north star + 3 strategy) | ☐ | |
| 8 | Task Proposal ✓ → tạo HĐ draft | ☐ | |

---

## D. Tra cứu trên RNOSAI

| Việc cần làm | Vị trí UI |
|--------------|-----------|
| Bắt đầu pre-sales | Chi tiết lead → panel **Pre-sales dịch vụ** → chọn slug |
| Intake BANT | Link **Intake** hoặc `/crm/intake?lead_id={id}` |
| Tick L2 docs | Tab **Tư vấn** → **Tài liệu L2 đã thu** |
| Nhập task Lead/Consult/Proposal | Tab tương ứng trên funnel stepper |
| Kế hoạch MKT sơ bộ | Tab Consult → **R5 Plan** |
| Tạo HĐ | `/crm/hub` sau khi Proposal ✓ |

---

*Tài liệu đồng bộ với workflow pre-sales RNOSAI. Cập nhật khi thêm slug dịch vụ mới.*

# Spec — P13
## Danh mục dịch vụ · Tham số giá cost-plus · Báo giá · Checklist triển khai

| Field | Value |
|-------|--------|
| Ticket ID | PTT-AI-P13-SERVICE-QUOTE-CHECKLIST-001 |
| Date | 2026-10-02 |
| Version | **1.1** (02/10/2026: điều chỉnh theo kết quả P13.0, xem §00) · 1.0 bản đầu |
| Priority | **P1** (báo giá + checklist đang chạy bằng Excel/Word rời) |
| Sub-tickets | P13.0 Code survey ✅ xong · P13.a Data model + seed import · P13.b Tham số giá + engine + test · P13.c Báo giá CRUD + duyệt · P13.d Xuất báo giá PDF bằng pdfkit (+ P13.d2 DOCX tùy chọn) · P13.e Checklist dự án + gate · P13.f Tích hợp task/deal (+ HĐ nháp sau capability, hiện 409) · P13.g Dashboard + siết phân quyền |
| Nguồn nghiệp vụ | `reports/checklist-dich-vu/v2/`: CHECKLIST-SOP-DICH-VU-PTT-v2.xlsx/.docx (16 dịch vụ, 675 hạng mục), BANG-TINH-GIA-DICH-VU-PTT.xlsx (công thức giá), `src/` (dữ liệu cấu trúc + `build_pricing.py`, `pricing_est.py`) |
| Seed | `docs/p13/p13-seed-v2.json` (schema `docs/p13/p13-seed.schema.json`, sinh bằng `docs/p13/export_p13_seed.py`) |
| Fixture công thức | `docs/p13/p13-pricing-sanity-fixture.json` + `docs/p13/BANG-TINH-GIA-sanity-test-params.xlsx` (bản sao file giá, điền tham số TEST, tính lại ngoài app để đối chiếu — khớp 48/48 giá gói) |
| Phụ thuộc | **Không phụ thuộc P12** (chưa có trong code). Dùng lại: Quote OS `crm_proposals` (+ dòng, version, số QT-PTT), pdfkit, RBAC, file/attachment, audit. Tạo mới: catalog P13, PricingEngine Decimal, `WorkingDayService` + `crm_holidays`, flag env `P13_*` |
| Implement | Local Cursor (máy Mac của anh Thịnh) · Verify Grok Bot trên `rs.pttads.vn` |

---

## 00. Kết quả P13.0 & điều chỉnh (v1.1, 02/10/2026) — **mục này thắng mọi phần bên dưới nếu mâu thuẫn**

P13.0 (code survey, read-only) đã chạy trong Cursor. Kết luận dưới đây là **chuẩn**; các mục §5–§19 đã sửa theo, chỗ nào còn sót thì áp mục này.

| # | Khu vực | Thực tế trong code | Quyết định cho P13 |
|---|---|---|---|
| A1 | Báo giá | Đã có **Quote OS**: `crm_proposals` + bảng dòng + versioning + số `QT-PTT-{YYYY}-{SEQ:6}` + state machine proposal; menu `/crm/proposals` | **Mở rộng, KHÔNG tạo bảng báo giá mới** (bỏ `crm_quotes`/`crm_quote_lines`). Thêm cột: `pricing_source` (`legacy`\|`p13`, mặc định `legacy`), loại dòng P13, liên kết dịch vụ/cấp/hạng mục, snapshot giá, `pricing_version_id` + `pricing_params_version`. Dòng/báo giá cũ = `legacy`, giữ nguyên hành vi. |
| A2 | Trạng thái | State machine proposal hiện có | **Không thêm state machine mới.** Map trạng thái P13 → trạng thái proposal (§8.1). Duyệt nội bộ chưa có thì thêm **tối thiểu** một trục phụ `p13_approval_status` (`none, pending, approved, returned`) khi proposal đang ở trạng thái nháp, chỉ áp cho `pricing_source='p13'`. |
| A3 | Số báo giá | `QT-PTT-{YYYY}-{SEQ:6}` | **D3 đã chốt:** dùng định dạng hiện có, các version cùng số. Bỏ placeholder `BG-…`. |
| A4 | Danh mục | `service_family` / SKU / `tasks_json` (`/admin/services/process`) là **catalog khác** | **Tạo bảng MỚI** cho 16 dịch vụ / 675 hạng mục (§5.1). Không đưa 675 hạng mục vào SKU/`tasks_json`. Tùy chọn cột map `crm_services.legacy_sku_code` → SKU hiện có. Tên bảng trùng bảng có sẵn thì dùng prefix `crm_p13_`. |
| A5 | Engine giá | Hàm giá hiện có dùng JS `Number` | **PricingEngine mới ở server, Decimal** (`decimal.js`, hoặc thư viện decimal đã có trong repo; ghi tên thư viện ở báo cáo P13.b). **Cấm** dùng hàm giá cũ cho P13. Tiền lưu bigint VND, trung gian là Decimal, chỉ làm tròn theo §7.1/§7.3. |
| A6 | Hợp đồng P12 | **Không có trong code**: không có `compose_status`, không có đợt thu; `crm_contracts` chỉ là HĐ của lead | **Bỏ phụ thuộc P12.** P13.f “Tạo HĐ nháp” đi sau **capability check** `contractsModule.isAvailable()`, hiện trả **409 `P12_MODULE_MISSING`**. **Không ghi** vào `crm_contracts` hiện tại. D5 hoãn tới khi có P12. |
| A7 | Export | Không có template token DOCX/PDF. Export “docx” hiện tại ghi file text với MIME docx; PDF dùng **pdfkit** | P13.d: **PDF bằng pdfkit**, vẽ layout PTT bằng code, **font TTF nhúng trong repo** (Be Vietnam Pro, giấy phép OFL, kèm `OFL.txt`; hoặc font khác hỗ trợ tiếng Việt). **Không** dùng LibreOffice, `[[path]]`, `#row`, `#each`, Google Fonts. DOCX là **P13.d2 tùy chọn** (thư viện `docx` npm), cần CEO quyết (D9). |
| A8 | Feature flag | Không có hệ thống flag chung | Thêm **cơ chế tối thiểu**: env `P13_ENABLED` (master, mặc định `false`) + env/settings cho flag con (§15.2). Helper `p13Flag(name)` đọc ở server, truyền xuống client qua config/session hiện có. |
| A9 | Ngày làm việc | Không có holiday calendar / `WorkingDayService`. Hàm SLA lead đếm **giờ làm việc**, không dùng được | Thêm **`WorkingDayService` nhỏ** (T2–T6 + bảng `crm_holidays` seed **rỗng** + form admin cho CEO nhập) ở **P13.a**. Không dùng hàm SLA lead cho hạn checklist. P12 dùng lại sau. |
| A10 | UI | **CSS custom** của app (không Tailwind/shadcn/AntD); brand **#17692f**; font **system-ui** (VPS có thể chặn Google Fonts) | UI dùng class CSS sẵn có; palette dẫn xuất từ #17692f; font system-ui. S3/S4/S5 là **mở rộng màn `/crm/proposals`**. Mockup `docs/p13/uiux/` chỉ là tham chiếu bố cục; màu/font theo app (UIUX-P13.md v1.1). |
| A11 | Repo | Đã copy spec, `docs/p13/p13-seed-v2.json`, `docs/p13/uiux/`; phần còn lại (schema, export script, fixture, sanity xlsx, README, `reports/checklist-dich-vu/v2`) gửi kèm zip theo đường dẫn repo | P13.a kiểm tra đủ file trước khi chạy import và test. |

**Phase sau điều chỉnh:** P13.0 ✅ xong · **P13.a** danh mục mới + import + flag `P13_ENABLED` + WorkingDayService/`crm_holidays` · **P13.b** tham số giá + PricingEngine Decimal + test · **P13.c** mở rộng Quote OS (`crm_proposals`) + duyệt nội bộ tối thiểu · **P13.d** PDF pdfkit (+ P13.d2 DOCX tùy chọn) · **P13.e** checklist + gate · **P13.f** task sync + đề xuất stage deal + HĐ nháp sau capability (409 `P12_MODULE_MISSING`) · **P13.g** dashboard + siết quyền. Điểm dừng và đợt deploy D1–D4 giữ nguyên (§18).

---

## 0. Bối cảnh

PTT đã có bộ **SOP & Checklist v2** (16 dịch vụ × 3 cấp độ gói, 675 hạng mục có ID, giai đoạn, RACI, đầu ra, gate phê duyệt) và **Bảng tính giá cost-plus** (lương → đơn giá giờ → giá hạng mục → giá gói → báo giá). Cả hai đang là file Excel/Word. Hệ quả:

| # | Thiếu | Hệ quả |
|---|-------|--------|
| G1 | Danh mục dịch vụ không nằm trong CRM | AM báo giá mỗi người một kiểu, phạm vi gói không thống nhất |
| G2 | Giá tính tay trong Excel, không version | Đổi lương/overhead → không biết báo giá cũ tính theo tham số nào |
| G3 | Báo giá không có luồng duyệt chiết khấu | Chiết khấu sâu không qua CEO, không có audit |
| G4 | Báo giá chấp nhận xong phải gõ lại thành HĐ/task | Sai lệch phạm vi giữa báo giá – HĐ – checklist |
| G5 | Checklist triển khai theo dõi bằng Excel từng dịch vụ | Không thấy tiến độ dự án, gate khách chưa duyệt, đầu vào khách còn thiếu |
| G6 | Lương nhân sự nằm trong file giá | Rủi ro lộ dữ liệu lương nếu file bị chia sẻ |

### 0.1 Những gì đã biết về CRM trước P13.0 (lịch sử; kết quả thật ở §00)
- **Live 02/10/2026 11:29 (UTC+7)**: `https://rs.pttads.vn` phản hồi; frontend **Next.js** (header `x-powered-by: Next.js`, nginx); `/` và `/crm` → 307 `/login`. **Chưa đăng nhập, chưa audit bên trong** (không đăng nhập khi cần credentials).
- Inventory SUPER-ADMIN 19/09 (SRS-PTT-Ops-Module.md) có các module **liên quan trực tiếp tới P13** — P13.0 phải kiểm tra trước khi tạo bảng mới:
  - `/crm/proposals/list` — **Proposal**: Code, version, client, lead, total, fee, GM, status, validity → **ứng viên số 1 để mở rộng thành Báo giá P13** thay vì tạo `crm_quotes` song song.
  - `/admin` có mục **service catalog**; `/admin/services/process` — 61 phases, **SKU**, week, `tasks_json` → ứng viên để map `services`/`service_items`.
  - Sales funnel `/crm/sales` có stage **Báo giá**; Service Delivery lifecycle **Lead → Tư vấn → Báo giá → Onboard → Triển khai → Bàn giao → Giữ chân**.
  - Delivery Projects (progress, milestone, budget, margin), Campaign Control (cột Quote/WO), module **Tài chính**, **CEO**, Admin **audit**.
  - Vai trò xuất hiện trong các spec trước: SUPER-ADMIN, CEO, CMO, GĐKD, Sales Lead, AM, PM, role_key chuyên môn (`ads, am, content, graphic, video, pm`).
- P11 có export Plan DOCX; P12/P12.g (hợp đồng, đợt thu, ngày làm việc, engine DOCX `[[...]]`) **đã spec, có thể chưa deploy**.

**Không giả định stack.** Tên bảng/route trong spec là **đề xuất**; P13.0 xác nhận model, route, phân quyền, cơ chế flag, thư viện export rồi map lại.

---

## 1. Mục tiêu & ngoài phạm vi

### 1.1 Mục tiêu
1. Đưa **16 dịch vụ / 3 cấp độ / 675 hạng mục** + đầu vào, bàn giao, KPI, rủi ro vào CRM (import idempotent từ seed JSON).
2. **Engine giá cost-plus** cho ra **đúng từng đồng** như `BANG-TINH-GIA-DICH-VU-PTT.xlsx`; tham số giá **có version + ngày hiệu lực**, báo giá cũ giữ snapshot.
3. **Báo giá**: AM chọn gói/cấp độ hoặc hạng mục lẻ, tổng tiền tính trực tiếp, chiết khấu vượt ngưỡng → CEO duyệt; quản lý trạng thái, phiên bản, hiệu lực.
4. **Xuất báo giá PDF** theo mẫu PTT bằng pdfkit + font nhúng (DOCX tùy chọn P13.d2).
5. **Checklist triển khai** sinh từ báo giá đã chấp nhận: giao việc theo RACI, hạn theo ngày làm việc, gate khách duyệt có bằng chứng, % tiến độ.
6. **Tích hợp**: checklist ↔ task dự án; cập nhật stage deal/lead (chỉ tiến, có người bấm); HĐ nháp **chỉ khi có module HĐ P12** (hiện 409 `P12_MODULE_MISSING`).
7. Lương/chi phí chỉ CEO/Tài chính xem được (lọc ở server).

### 1.2 Ngoài phạm vi (P13 v1)
- Tự gửi email/Zalo báo giá cho khách (K6: chỉ tạo nháp, người bấm gửi).
- Ký số, hóa đơn điện tử, đối soát thanh toán.
- Báo giá **retainer theo giờ/tháng** (sheet "Retainer"): seed có `retainer_templates` nhưng UI/engine để **P13.h**; v1 bán retainer bằng dòng `custom` hoặc hạng mục đơn vị "tháng" × số tháng.
- Giá thị trường tham khảo / so sánh đối thủ (cột trống trong Excel).
- Hiệu chỉnh giờ từ chấm công thực tế (chỉ cho sửa tay giờ ước tính).
- Đa tiền tệ (chỉ VND).

---

## 2. Quyết định khóa

| # | Rule | Bắt buộc |
|---|------|----------|
| K1 | **Tái sử dụng trước, thêm sau.** Nếu đã có Proposal, service catalog/SKU, process phases, approval, attachments, audit, feature flag, DOCX/PDF engine, WorkingDayService → **mở rộng**, không tạo hệ song song. P13.0 ra survey report. | Yes |
| K2 | **Không bịa số.** Seed không chứa lương, % hay giá. Mọi tham số tiền do CEO/Tài chính nhập. Giờ ước tính là **giả định** (`est_hours_is_assumption=true`), hiển thị badge "Giả định", sửa được. | Yes |
| K3 | **Engine giá là một service duy nhất** ở server, dùng chung cho màn Tham số, Danh mục, Báo giá, Export, AI tool. Frontend không tự tính lại công thức (chỉ hiển thị kết quả API/preview). | Yes |
| K4 | **Số học chính xác**: Decimal/rational, không float nhị phân (xem §7.3 — có ca float lệch 1.000đ). | Yes |
| K5 | Cảnh báo mềm **không chặn** lưu nháp. Chỉ chặn (409/422) ở các mã liệt kê §16. | Yes |
| K6 | CRM **không tự gửi** báo giá/email cho khách. "Đánh dấu đã gửi" do người bấm, kèm bằng chứng. | Yes |
| K7 | Version tham số giá đã **active là bất biến**; sửa = clone version mới. Báo giá từ "Chờ duyệt" trở đi giữ **snapshot giá**. | Yes |
| K8 | Lương, BH, phúc lợi, đơn giá giờ, chi phí trực tiếp: **chỉ CEO, Tài chính, SUPER-ADMIN** — lọc ở API, không chỉ ẩn UI. | Yes |
| K9 | Mọi job tự động sau **feature flag mặc định OFF**; toàn bộ P13 sau flag master env `P13_ENABLED` (§15.2). Không đổi hành vi P8–P12. | Yes |
| K10 | AI tool ghi (nếu làm ở P13.g): `dry_run` + header `X-AI-Human-Approved: 1`; **không có** tool gửi/chấp nhận báo giá (PO-53). | Yes |

---

## 3. Vai trò & phân quyền

### 3.1 Vai trò nghiệp vụ → vai trò CRM (P13.0 xác nhận tên thật)

| Vai trò P13 | Map sang vai trò CRM (đề xuất) | Việc chính |
|---|---|---|
| CEO | `CEO` (+ `SUPER-ADMIN` break-glass) | Duyệt/kích hoạt version tham số giá; duyệt chiết khấu vượt ngưỡng; xem lương/chi phí/biên LN |
| Tài chính | role module **Tài chính** / Kế toán | Nhập/xem lương, BH, phúc lợi (soạn version nháp); xem mọi báo giá, chi phí, biên LN; **không** kích hoạt version, không duyệt chiết khấu |
| GĐKD / Sales Lead | `GĐKD`, `Sales Lead` | Xem mọi báo giá của team; tạo/sửa báo giá; xem **giá & biên LN %**, không xem lương/đơn giá giờ; duyệt chiết khấu chỉ khi CEO bật (D8, mặc định: không) |
| AM | `AM` | Tạo/sửa báo giá của mình; gửi duyệt; đánh dấu đã gửi/chấp nhận/từ chối; khởi tạo checklist; xem giá bán, không xem chi phí |
| PM | `PM` / người phụ trách Delivery Project | Quản lý checklist dự án: giao việc, đổi hạn, ghi gate, N/A có lý do |
| Team chuyên môn | role_key `content, graphic, ads, video, dev, data…` | Cập nhật trạng thái/bằng chứng hạng mục được giao |
| Admin danh mục | `SUPER-ADMIN` (hoặc CEO) | Import seed, sửa danh mục, giờ ước tính, min_level |

### 3.2 Ma trận quyền (đề xuất; P13.0 map vào cơ chế RBAC/policy hiện có)

| Hành động | CEO | Tài chính | GĐKD | AM | PM | Team | SUPER-ADMIN |
|---|---|---|---|---|---|---|---|
| Xem danh mục (5 tab) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sửa danh mục / giờ ước tính / import | ✓ | – | – | – | – | – | ✓ |
| Xem lương/BH/phúc lợi/đơn giá giờ/chi phí trực tiếp | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Soạn version tham số (draft) | ✓ | ✓ | – | – | – | – | ✓ |
| Kích hoạt version tham số | ✓ | – | – | – | – | – | break-glass + audit |
| Xem ma trận giá gói (16×3) | ✓ | ✓ | ✓ | ✓ (giá bán) | – | – | ✓ |
| Tạo/sửa báo giá | ✓ | – | ✓ | ✓ (của mình) | – | – | ✓ |
| Xem biên LN % báo giá | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| Duyệt chiết khấu vượt ngưỡng | ✓ | – | (D8) | – | – | – | – |
| Đánh dấu đã gửi / chấp nhận / từ chối | ✓ | – | ✓ | ✓ (của mình) | – | – | ✓ |
| Khởi tạo checklist từ báo giá | ✓ | – | ✓ | ✓ | ✓ | – | ✓ |
| Cập nhật hạng mục checklist | ✓ | – | ✓ | ✓ | ✓ | ✓ (được giao) | ✓ |
| Ghi gate khách duyệt | ✓ | – | ✓ | ✓ | ✓ | – | ✓ |
| Xem dashboard P13 | ✓ | ✓ | ✓ | ✓ (của mình) | ✓ (dự án mình) | – | ✓ |

**Field-level (K8):** serializer trả các trường `monthly_salary, insurance_pct, monthly_benefits, hourly_rate, direct_cost*, cost_*` **chỉ** khi user có permission `p13.pricing.cost.view`; nếu không → **bỏ hẳn key** khỏi JSON (không trả `null` giả); export DOCX/PDF không bao giờ chứa các trường này. Biên LN % cần `p13.quote.margin.view`.

Permission đề xuất: `p13.catalog.view`, `p13.catalog.manage`, `p13.pricing.view`, `p13.pricing.cost.view`, `p13.pricing.edit_draft`, `p13.pricing.activate`, `p13.quote.view_own`, `p13.quote.view_all`, `p13.quote.edit`, `p13.quote.margin.view`, `p13.quote.approve_discount`, `p13.quote.mark_status`, `p13.checklist.view`, `p13.checklist.manage`, `p13.checklist.update_assigned`, `p13.checklist.gate_signoff`, `p13.dashboard.view`.

---

## 4. P13.0 — Code survey (READ-ONLY) — ✅ ĐÃ XONG, kết quả ở §00 (giữ mục này làm lịch sử)

Cursor đọc migrations/schema, models, routes (web + API + `/api/v1/ai/tools` nếu có), pages Next.js, services, policies. Trả **survey report** `docs/P13.0-survey.md`:

| # | Khu vực | Tìm | Kết luận cần ghi |
|---|---|---|---|
| S1 | Stack | backend framework, ORM, migration tool, test runner, cách chạy seed/command | lệnh migrate/seed/test |
| S2 | Proposal / báo giá | `proposal`, `quote`, `bao_gia`, `/crm/proposals`; cột code/version/total/fee/GM/status/validity; có bảng dòng chi tiết? | **mở rộng Proposal** hay tạo mới; map trạng thái cũ ↔ P13 |
| S3 | Service catalog / SKU | `/admin` service catalog, `/admin/services/process` (61 phases, SKU, week, `tasks_json`) | map `services`/`service_items`; SKU ↔ mã dịch vụ BI…VID |
| S4 | Khách / deal / lead | bảng khách, contact, deal, pipeline stage (`Báo giá`), cơ chế chuyển stage + audit | FK cho báo giá; cách cập nhật stage chỉ tiến |
| S5 | Dự án / task | Service Delivery lifecycle, Delivery Projects, `crm_svc_tasks` (`due_at`, `assignee_id`?), team member/role_key | checklist gắn vào đâu; sync task thế nào |
| S6 | Hợp đồng P12 | `crm_contracts`, phases, deliverables, installments, `compose_status` — **đã deploy chưa** | bật/tắt `p13_quote_to_contract` |
| S7 | Ngày làm việc | `WorkingDayService` / `crm_holidays` (P12.b) | dùng lại hay cần helper tạm |
| S8 | Duyệt / approval | `crm_approval_requests` (P12.c), approval chung, AM Work Queue Approval | gate + duyệt chiết khấu dùng gì |
| S9 | File | attachments/media/storage disk | bằng chứng gate, file báo giá |
| S10 | Export | engine DOCX P9.1/P11.x/P12.g (token `[[...]]`, `#row`, `#each`), PDF (LibreOffice headless?) | thư viện + cách thêm template mới |
| S11 | RBAC | bảng role/permission/policy, cách check ở API + ẩn menu | tên role thật cho §3 |
| S12 | Feature flag | bảng/config flag, cách đọc ở server và client | thêm `p13_*` |
| S13 | Audit | audit log chung (Admin → audit) | ghi before/after cho P13 |
| S14 | Dashboard | cơ chế widget (Tổng quan/CEO) | thêm widget P13 |
| S15 | AI tools | registry + allowlist + header approval | có làm tool P13 không |
| S16 | Tiền & số | kiểu cột tiền đang dùng (bigint/decimal), thư viện decimal ở backend | cách đạt K4 |

Đầu ra thêm: danh sách migration dự kiến (thứ tự), danh sách file sẽ đổi theo phase, rủi ro xung đột với P12, đề xuất mapping role §3.

**DỪNG và báo** survey report. Không sang P13.a khi chưa được xác nhận.

---

## 5. P13.a — Data model + seed import

Catalog: **bảng MỚI** (§00 A4; trùng tên bảng có sẵn thì prefix `crm_p13_`). Báo giá: **mở rộng `crm_proposals`** (§5.3). Mọi bảng có `created_at, updated_at, created_by, updated_by` (không lặp lại bên dưới).

### 5.1 Danh mục

**`crm_service_groups`**: id, code (`G1`…`G5`), name, sort_order, is_active.

**`crm_services`**
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | bigint | |
| code | string(8) unique | `BI, CS, WEB, ADS, SEO, BOT, CRM, NUR, RET, MAU, MKT, DSH, MED, PR, KOL, VID` |
| group_id | FK | |
| name | string | "Website & Landing Page" |
| sort_order | int | 1–16 |
| objective, problem, target_customers, prerequisites | text | từ seed |
| exclusions | json array | "Không bao gồm" |
| billing_model | string | "Dự án một lần (+ retainer bảo trì)"… |
| meta_json | json | `specs[]`, `legal_notes[]`, `sow_client_responsibilities[]`, `sow_out_of_scope[]`, `assumptions[]`, `source_sheet` |
| legacy_sku_code | string nullable | (tùy chọn) map sang SKU của catalog `service_family`/SKU hiện có; không đồng bộ dữ liệu |
| catalog_version | string | `checklist-v2` |
| is_active | bool | |

**`crm_service_levels`**: id, code (`basic|standard|advanced`), name (`Cơ bản|Tiêu chuẩn|Nâng cao`), rank (1/2/3). Dùng chung mọi dịch vụ.

**`crm_service_phases`**: code (`K,N,P,S,T,D,B,V`), name (Khởi động · Nghiên cứu/Đánh giá · Kế hoạch · Sản xuất/Thiết lập · Triển khai/Go-live · Đo lường & Tối ưu · Nghiệm thu/Bàn giao · Vận hành/Duy trì), seq 1–8. (Có thể là enum nếu codebase quen dùng enum.)

**`crm_service_scope_rows`** (ma trận phạm vi theo cấp độ, cho tab Danh mục + export báo giá): id, service_id, sort_order, feature, basic_text, standard_text, advanced_text.

**`crm_service_items`** (checklist mẫu — 675 dòng)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | bigint | |
| code | string unique | `WEB-04-08` = dịch vụ-giai đoạn(01–08)-thứ tự |
| service_id | FK | |
| phase_code | string(1) | K…V |
| seq_in_phase, sort_order | int | |
| task | string | "Tích hợp form/CRM/chatbot" |
| subtask | text | |
| standard | text | tiêu chuẩn/tiêu chí chất lượng |
| raci | json | `{"R":["Dev"],"A":["AM"],"C":["Data/CRM"],"I":["Khách hàng"]}` |
| main_role_code | string | vai trò tính giá: `am, strategist, content, design, ads, dev, data_crm, media_booking, video_production, client` |
| tool | string nullable | |
| deliverable | string | đầu ra |
| approval_gate | bool | 227 hạng mục |
| gate_approver | enum nullable | `client, internal` |
| min_level | enum | `basic, standard, advanced` |
| est_hours | decimal(8,2) | |
| est_hours_is_assumption | bool default true | false khi CEO/Admin xác nhận |
| est_hours_source | enum | `seed, edited` (import không đè `edited`, §6) |
| unit | enum | `times, month, shoot_day` (nhãn: lần/tháng/ngày quay) |
| default_qty | decimal(8,2) default 1 | |
| billable | bool | false = không tính phí |
| client_only | bool | R = Khách hàng (23 hạng mục; 0 giờ, không tính phí) |
| is_common | bool | hạng mục quản trị chung có ở mọi dịch vụ |
| is_active | bool | |

**`crm_service_inputs`**: id, service_id, code (`WEB-I01`), type, name, format_or_permission, is_required (default true), sort_order.
**`crm_service_deliverables`**: id, service_id, code (`WEB-D01`), name, format, owner_role_code, acceptance_criteria, revision_limit_text (`[theo hợp đồng]`), approval_gate (true), sort_order.
**`crm_service_kpis`**: id, service_id, code (`WEB-K01`), type (Leading/Lagging…), name, formula, data_source, frequency, owner_role_code.
**`crm_service_risks`**: id, service_id, code (`WEB-R01`), risk, likelihood, impact, mitigation, owner_role_code.
**`crm_catalog_imports`**: id, file_name, file_sha256, schema_version, catalog_version, mode (`dry_run|apply`), summary_json (created/updated/unchanged/skipped_edited/deactivated theo bảng), run_by, run_at.

Số lượng seed v2: 16 dịch vụ · 675 hạng mục · 227 gate · 23 client_only · 652 billable · mỗi dịch vụ có inputs/deliverables/KPI/risks/scope.

### 5.2 Tham số giá (migration ở P13.a hoặc P13.b)

**`crm_pricing_versions`**: id, code (`PV-2026-01`), status enum(`draft, active, retired`), effective_from date, effective_to date nullable (tự đặt khi version sau active), approved_by, approved_at, inversion_ack bool, inversion_ack_note, notes, cloned_from_id.

**`crm_pricing_roles`** (theo version; 9 dòng)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id, version_id | | |
| role_code | string | `am, strategist, content, design, ads, dev, data_crm, media_booking, video_production` |
| name | string | |
| monthly_salary | bigint nullable | **nhạy cảm** |
| insurance_pct | decimal(7,6) nullable | 0.2 = 20% — **nhạy cảm** |
| monthly_benefits | bigint nullable | **nhạy cảm** |
| productive_hours | decimal(8,2) default 132 | 22 ngày × 8h × 75% (giả định) |
| hourly_rate | decimal(20,8) computed | = (salary × (1+ins) + benefits) / hours; lưu để hiển thị; engine tính lại từ gốc; **nhạy cảm** |
| note | text | |

**`crm_pricing_settings`** (1 dòng / version)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| version_id | FK unique | |
| overhead_pct | decimal(7,6) nullable | ≥ 0 |
| margin_pct | decimal(7,6) nullable | 0 ≤ x **< 1** |
| vat_pct | decimal(7,6) nullable | |
| rounding_unit | int default 1000 | 0 = không làm tròn (về đồng) |
| discount_basic_pct | decimal(7,6) default 0 | Excel không có, giữ 0 |
| discount_standard_pct | decimal(7,6) nullable | chiết khấu gói Tiêu chuẩn |
| discount_advanced_pct | decimal(7,6) nullable | chiết khấu gói Nâng cao |
| ads_fee_pct | decimal(7,6) nullable | phí quản lý QC % ngân sách |
| ads_fee_min_monthly | bigint nullable | phí tối thiểu/tháng |
| booking_fee_pct | decimal(7,6) nullable | phí booking bên thứ ba |
| discount_approval_threshold_pct | decimal(7,6) nullable | **CEO chốt** (§19 D1); null = mọi chiết khấu > 0 cần duyệt |
| min_margin_after_discount_pct | decimal(7,6) nullable | sàn biên LN sau chiết khấu (tùy chọn) |

### 5.3 Báo giá (P13.c) — **mở rộng Quote OS hiện có** (`crm_proposals` + bảng dòng), không tạo bảng mới

Nguyên tắc: mọi cột mới **nullable** hoặc có default an toàn; proposal/dòng cũ có `pricing_source='legacy'` và **không đổi hành vi** (list, xem, sửa, chuyển trạng thái, export như trước). Logic P13 (engine, cảnh báo, duyệt, snapshot) **chỉ chạy khi `pricing_source='p13'`**. Tên bảng dòng thật theo `docs/P13.0-survey.md` (dưới đây gọi `crm_proposal_lines`).

**Dùng lại cột có sẵn của `crm_proposals`** (tên thật theo survey): mã số `QT-PTT-{YYYY}-{SEQ:6}` + version (cơ chế version hiện có), client/customer, lead/deal, owner/AM, status (state machine hiện có, §8.1), validity/hiệu lực, total, fee, GM. Với proposal P13, server **ghi đồng bộ** các cột hiển thị cũ để màn list hiện tại vẫn đúng: `total ← grand_total`, `fee ← fee_total`, `GM ← margin_pct_effective` (quyền xem GM theo hành vi hiện có, nhưng API P13 vẫn áp field-level K8).

**ALTER `crm_proposals` — thêm:**
| Cột | Kiểu | Ghi chú |
|---|---|---|
| pricing_source | enum/string `legacy\|p13`, NOT NULL default `legacy` | backfill toàn bộ bản ghi cũ = `legacy` |
| pricing_version_id | FK `crm_pricing_versions` nullable | version dùng để tính |
| pricing_params_version | string nullable | code version (vd `PV-2026-01`), snapshot để hiển thị/audit |
| pricing_snapshot_json | json nullable | đóng băng khi rời nháp hoặc gửi duyệt (§7.6) |
| display_mode | enum nullable | `package_only, package_with_scope, item_detail` (D2) |
| validity_days | int nullable | chỉ thêm nếu Quote OS chưa có; có rồi thì dùng cột cũ |
| fee_subtotal, extra_discount_amount, fee_after_discount, fee_vat, fee_total | bigint nullable | |
| extra_discount_pct, vat_pct, effective_discount_pct | decimal(7,6) nullable | |
| ad_budget_total, ads_fee_total, third_party_total, booking_fee_total, passthrough_vat, passthrough_total, grand_total, list_fee_total | bigint nullable | |
| cost_total | bigint nullable | **nhạy cảm** (K8) |
| margin_pct_effective | decimal(7,6) nullable | cần `p13.quote.margin.view` |
| needs_approval | bool default false | |
| p13_approval_status | enum `none, pending, approved, returned` default `none` | **trục duyệt nội bộ tối thiểu** (§8.1); bỏ cột này nếu survey thấy Quote OS đã có duyệt nội bộ dùng được |
| approval_reasons | json nullable | `discount_above_threshold, below_cost, below_margin_floor, custom_line, price_override` |
| approval_requested_by/at, approved_by/at, approval_note | nullable | chỉ thêm cột chưa có |
| sent_channel, sent_evidence_url, accepted_evidence_url, accepted_by_contact, rejected_reason | nullable | chỉ thêm cột chưa có |
| payment_terms_json | json nullable | đợt thanh toán đề xuất (in lên PDF; dùng cho HĐ khi có P12) |
| checklists_instantiated_at | datetime nullable | P13.e |
| is_test | bool default false | tiêu đề `[TEST P13]`, loại khỏi dashboard |
| warnings_json | json nullable | |

**ALTER `crm_proposal_lines` — thêm:**
| Cột | Kiểu | Ghi chú |
|---|---|---|
| pricing_source | `legacy\|p13`, default `legacy` | |
| p13_line_type | enum nullable | `package, item, custom, ad_budget, third_party` (null = dòng legacy) |
| service_id | FK `crm_services` nullable | package/item |
| level_code | enum nullable | package |
| service_item_id | FK `crm_service_items` nullable | item |
| item_qty_overrides_json | json nullable | package: `{"VID-04-07":3}` |
| list_unit_price | bigint nullable | giá niêm yết từ engine |
| unit_price_override_reason | text nullable | bắt buộc khi override |
| discount_pct | decimal(7,6) default 0 | |
| hours_snapshot | decimal(10,2) nullable | |
| cost_snapshot | bigint nullable | **nhạy cảm** |
| passthrough_amount, fee_pct_snapshot, fee_min_snapshot, fee_amount | nullable | ad_budget/third_party |
| price_snapshot_json | json nullable | price_raw (chuỗi Decimal), rate role, version — đóng băng cùng proposal |
| warnings_json | json nullable | |

Dùng lại cột có sẵn của dòng: mô tả, qty, đơn vị, đơn giá (`unit_price`), thành tiền (`amount`), sort. Chỉ thêm cột còn thiếu.

### 5.4 Checklist dự án (P13.e)

**`crm_project_checklists`**: id, project_ref_type (`lifecycle|delivery_project` theo S5), project_ref_id, customer_id, proposal_id (`crm_proposals`), proposal_line_id (unique, idempotent), service_id, level_code nullable (null = hạng mục lẻ), title, start_date (N1), status enum(`not_started, in_progress, done, cancelled`), pm_user_id, client_approver_contact_json, progress_items_pct, progress_inputs_pct, progress_deliverables_pct, gates_done, gates_total, progress_hours_pct (phụ), daily_capacity_hours (mặc định từ setting), catalog_version.

**`crm_project_checklist_items`** (bản sao từ service_items, sửa độc lập với danh mục)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| id, checklist_id | | |
| service_item_id | FK nullable | null = hạng mục thêm tay |
| code | string | `WEB-04-08` (thêm tay: `WEB-X-01`) |
| phase_code, sort_order, task, subtask, standard, raci (json), tool, deliverable, approval_gate, gate_approver, min_level, est_hours, unit, qty, billable, client_only | | **copy** |
| status | enum | `todo` Chưa làm · `in_progress` Đang làm · `done` Xong · `na` Không áp dụng |
| na_reason | text | bắt buộc khi `na` |
| assignee_user_id | FK nullable | nội bộ |
| assignee_contact_json | json nullable | client_only → đầu mối khách |
| due_offset_working_days | int nullable | |
| due_date | date nullable | tính bằng WorkingDayService |
| due_date_locked | bool | sửa tay → không bị tính lại đè |
| started_at, completed_at, completed_by | | |
| evidence_url | string nullable | |
| attachments | qua bảng attachments chung (S9) | |
| gate_approval_id | FK nullable | §10.4 |
| task_id | FK `crm_svc_tasks` nullable | P13.f sync |
| notes | text | |

**`crm_project_checklist_inputs`**: id, checklist_id, service_input_id, code, type, name, format_or_permission, is_required, provider_contact_json, requested_at, due_date, received_at, status (`todo, in_progress, done, na`), note.
**`crm_project_checklist_deliverables`**: id, checklist_id, service_deliverable_id, code, name, format, acceptance_criteria, owner_user_id, revision_limit (int nullable), revision_count, submitted_at, accepted_at, status, gate_approval_id. (Liên kết deliverable HĐ để sau, khi có module HĐ P12.)
**`crm_checklist_gate_approvals`** (bảng mới; P12 chưa có `crm_approval_requests`): id, subject_type (`checklist_item|checklist_deliverable`), subject_id, approver_contact_json (tên, email, chức vụ), approver_is_authorized bool, requested_at, sent_channel, response enum(`pending, approved, changes_requested, deemed_accepted, withdrawn`), responded_at, evidence_url (**bắt buộc** khi approved), attachment_id, note, recorded_by.

### 5.5 Audit
Dùng audit log chung (S13). Nếu chưa có: **`crm_p13_audit_logs`**: id, actor_user_id, actor_type (`user|ai_tool|job|import`), entity_type, entity_id, action, before_json, after_json (field nhạy cảm **mask** `***` với người xem không có `p13.pricing.cost.view`), ip, created_at.
Bắt buộc audit: import catalog; sửa giờ/min_level/billable; tạo/sửa/kích hoạt version giá; mọi chuyển trạng thái báo giá; override giá; duyệt/trả về chiết khấu; xuất file; khởi tạo checklist; đổi trạng thái/hạn hạng mục; gate sign-off; tạo HĐ nháp; sync task; đổi stage deal.

---

## 6. Seed / import catalog

### 6.1 Nguồn & bước export (đã chạy, file có sẵn trong `docs/p13/`)
```bash
# Python 3.10+, không cần thư viện ngoài (có jsonschema thì tự validate schema)
python3 docs/p13/export_p13_seed.py --src reports/checklist-dich-vu/v2/src --out docs/p13
# → docs/p13/p13-seed-v2.json + docs/p13/p13-pricing-sanity-fixture.json ; tự kiểm 16/675, ID duy nhất, công thức sanity
```
Script đọc `load.py` (16 dịch vụ, ID hạng mục), `pricing_est.py` (vai trò chính, giờ, min_level, đơn vị, tính phí — đúng như sheet "Định giá hạng mục"), `BILL`/`RET` trong `build_pricing.py` (qua AST, không chạy script). Đã đối chiếu: 675/675 hạng mục khớp sheet "Định giá hạng mục" (vai trò, giờ, cấp độ, đơn vị, tính phí, SL=1) và 675 ID khớp file Checklist v2.

### 6.2 Cấu trúc seed (tóm tắt; chi tiết trong schema)
```json
{
 "schema_version": "p13-seed/1.0", "catalog_version": "checklist-v2",
 "source": {"path": "...", "files_sha256": {"...": "..."}, "workbooks_sha256": {"...": "..."}},
 "levels": [{"code":"basic","name":"Cơ bản","rank":1}],
 "phases": [{"code":"K","name":"Khởi động","seq":1}],
 "item_statuses": [{"code":"todo","name":"Chưa làm"}],
 "pricing_roles": [{"code":"am","name":"AM","default_productive_hours":132,"monthly_salary":null,"insurance_pct":null,"monthly_benefits":null}],
 "pricing_settings_template": {"overhead_pct":null,"margin_pct":null,"vat_pct":null,"rounding_unit":1000,
     "package_discount_pct":{"basic":0,"standard":null,"advanced":null},"ads_fee_pct":null,"ads_fee_min_monthly":null,"booking_fee_pct":null},
 "service_groups": [{"code":"G1","name":"Truyền thông thương hiệu","sort_order":1}],
 "services": [{"code":"WEB","name":"Website & Landing Page","group_code":"G1","billing_model":"...",
     "scope_matrix":[], "specs":[], "inputs":[], "deliverables":[], "kpis":[], "risks":[],
     "items":[{"code":"WEB-04-08","phase_code":"S","task":"Tích hợp form/CRM/chatbot",
               "raci":{"R":["Dev"],"A":["AM"],"C":["Data/CRM"],"I":["Khách hàng"]},"main_role_code":"dev",
               "approval_gate":false,"min_level":"basic","est_hours":16,"est_hours_is_assumption":true,
               "unit":"times","default_qty":1,"billable":true,"client_only":false}]}],
 "retainer_templates": [],
 "counts": {"services":16,"items":675,"gates":227,"client_only":23,"billable":652}
}
```

### 6.3 Lệnh import (tên đề xuất; theo convention S1)
`p13:catalog-import --file=docs/p13/p13-seed-v2.json [--dry-run] [--force-hours] [--deactivate-missing]`

| # | Rule |
|---|------|
| I1 | Validate theo `p13-seed.schema.json` trước; sai → dừng, không ghi gì (exit ≠ 0 / 422 `catalog_schema_invalid`). |
| I2 | **Upsert theo `code`** (group, service, item, input `WEB-I01`, deliverable `WEB-D01`, KPI `WEB-K01`, risk `WEB-R01`); scope rows thay theo (service, sort_order). Chạy 2 lần liên tiếp → lần 2: 0 created, 0 updated. |
| I3 | Item có `est_hours_source=edited` → **không đè** `est_hours/min_level/billable/default_qty` (đếm `skipped_edited`), trừ khi `--force-hours`. Text (task, subtask…) vẫn cập nhật. |
| I4 | Item không còn trong file → giữ nguyên; chỉ `is_active=false` khi có `--deactivate-missing`. **Không xóa cứng** (checklist cũ còn tham chiếu). |
| I5 | Import **không tạo/sửa** tham số giá có số; chỉ tạo 1 `crm_pricing_versions` **draft** rỗng (9 role, `productive_hours=132`, `rounding_unit=1000`, còn lại null) nếu chưa có version nào. |
| I6 | Ghi `crm_catalog_imports` + audit; in bảng tóm tắt; `--dry-run` chỉ in, rollback transaction. |
| I7 | Giờ seed hiển thị badge **"Giả định"** đến khi Admin/CEO bấm "Xác nhận giờ" (theo dịch vụ hoặc từng hạng mục) → `est_hours_is_assumption=false`. |

`retainer_templates` lưu dạng setting/JSON cho P13.h (không có UI v1).

---

## 7. P13.b — Tham số giá + engine

### 7.1 Công thức (đúng như BANG-TINH-GIA-DICH-VU-PTT.xlsx)

| Đại lượng | Công thức | Excel |
|---|---|---|
| Đơn giá giờ vai trò | `rate = (salary × (1 + ins%) + benefits) / productive_hours` | Thông số!F |
| Chi phí trực tiếp hạng mục | `direct = est_hours × qty × rate(main_role)` nếu `billable`, ngược lại 0 | Định giá!M |
| Chi phí gồm overhead | `direct × (1 + overhead%)` | Định giá!N |
| Giá bán hạng mục (thô) | `price_raw = direct × (1 + overhead%) / (1 − margin%)` | Định giá!O |
| Giá hạng mục lẻ | `ROUNDUP(price_raw / unit) × unit` | Định giá!P |
| Giờ tính phí của gói | `Σ est_hours × qty` (billable, `rank(min_level) ≤ rank(level)`) | Tổng hợp!F–H |
| **Giá gói** | `ROUNDUP( Σ price_raw[min_level ≤ level] × (1 − disc[level]) / unit ) × unit` | Tổng hợp!J–L |
| Phí quản lý QC | `budget > 0 ? MAX(budget × ads_fee%, ads_fee_min) : 0` (mỗi tháng) | Báo giá!H |
| Phí booking | `third_party_cost × booking_fee%` | Báo giá!H |
| Chiết khấu thêm | `fee_subtotal × extra_discount%` | Báo giá |
| VAT phí dịch vụ | `fee_after_discount × vat%` | Báo giá |
| VAT phí thu hộ | `(ads_fee + booking_fee) × vat%` | Báo giá |
| Tổng báo giá | `fee_total + ad_budget + ads_fee + third_party + booking_fee + passthrough_vat` | Báo giá |

Lưu ý bắt buộc (khớp Excel):
- **Giá gói cộng `price_raw` chưa làm tròn**, trừ chiết khấu gói, **làm tròn lên 1 lần** ở cuối. Giá hạng mục lẻ làm tròn lên **từng hạng mục**. (Tổng giá lẻ các hạng mục ≠ giá gói — đúng thiết kế.)
- `rounding_unit = 0` → không ROUNDUP, chỉ làm tròn về **đồng** (HALF_UP) vì VND không có số lẻ.
- Chiết khấu dòng/thêm, VAT, phí booking: làm tròn về **đồng** HALF_UP, **không** làm tròn 1.000 (sanity: VAT 10.570.800).
- Hạng mục `billable=false`/`client_only` = 0 đồng nhưng **vẫn vào checklist**.
- Ngân sách QC và chi phí bên thứ ba là **thu hộ**: không chịu chiết khấu thêm, không VAT (Excel: VAT chỉ trên phí quản lý & phí booking — "xác nhận cách xuất hóa đơn thu hộ với kế toán").
- Phí QC theo tháng: dòng `ad_budget` có `passthrough_amount`/tháng và `qty` = số tháng → `fee_amount = MAX(budget × %, min) × qty`.
- Excel trả 0 khi margin ≥ 100%; CRM **chặn** (422 `margin_out_of_range`).

### 7.2 Ví dụ kiểm tra (tham số TEST, không phải giá thật)
Mọi role: lương 20.000.000, BH 20%, phúc lợi 1.000.000, 132 giờ → `rate = 25.000.000/132 = 6.250.000/33 ≈ 189.393,94` (hiển thị **189.394/h**). Overhead 30%, margin 25% → hệ số `1,3/0,75 = 1,7333…` → **≈ 328.282,83 đ/giờ bán**. VAT 8%, CK Tiêu chuẩn 5%, Nâng cao 10%, làm tròn 1.000.

| Ca | Tính | Kết quả |
|---|---|---|
| WEB Cơ bản (364h) | 364 × 328.282,83 = 119.494.949,49 → ROUNDUP | **119.495.000** |
| WEB Tiêu chuẩn (390h, −5%) | 128.030.303,03 × 0,95 = 121.628.787,88 → ROUNDUP | **121.629.000** |
| WEB Nâng cao (398h, −10%) | 130.656.565,66 × 0,9 = 117.590.909,09 → ROUNDUP | **117.591.000** < Tiêu chuẩn → **warning `package_price_inversion`** |
| WEB-04-08 (16h, Dev) | 16 × 328.282,83 = 5.252.525,25 → ROUNDUP | **5.253.000** |
| Báo giá: WEB Tiêu chuẩn ×1 + WEB-04-08 ×2 | 121.629.000 + 10.506.000 | subtotal **132.135.000**; VAT **10.570.800**; tổng **142.705.800** |

Bảng đầy đủ 16 dịch vụ × 3 cấp độ: **Phụ lục A** (đã kiểm bằng LibreOffice trên bản sao file Excel).

### 7.3 Độ chính xác (K4) — bắt buộc
- Tính bằng **Decimal** (≥ 28 chữ số; JS/TS: `decimal.js`/`big.js`; PHP: `brick/math`/bcmath; Python: `decimal`/`fractions`) hoặc rational. **Không** dùng `number`/`float` cho tiền và hệ số.
- **Không làm tròn `rate`** trước khi nhân (`hourly_rate` lưu chỉ để hiển thị).
- Trước khi ROUNDUP: chuẩn hóa giá trị thô về **4 chữ số thập phân (HALF_UP)** để triệt nhiễu, rồi `ceil(x / unit) × unit`.
- Ca bẫy (đã kiểm): với tham số TEST, **SEO Nâng cao = 84.500.000**, **MED Nâng cao = 74.750.000**, **MKT Cơ bản = 65.000.000** (giá trị thô đúng bằng bội số 1.000). Cộng float ngây thơ cho `84.500.000,00000001` → ROUNDUP **84.501.000 (sai)**; Excel/LibreOffice cho 84.500.000. Test bắt buộc (F7).

### 7.4 Version & ngày hiệu lực
| # | Rule |
|---|------|
| PV1 | Trạng thái `draft → active → retired`. Chỉ CEO kích hoạt (`p13.pricing.activate`). Active **bất biến** (409 `pricing_version_immutable`); sửa = "Clone thành nháp". |
| PV2 | Kích hoạt đặt `effective_from` (mặc định hôm nay, có thể ngày tương lai); version active trước nhận `effective_to = effective_from − 1` và → `retired` khi tới ngày. Tại một ngày chỉ có 1 version hiệu lực. |
| PV3 | Kích hoạt bị chặn **409 `pricing_params_incomplete`** nếu thiếu: lương/BH/phúc lợi/giờ của **role có hạng mục billable** (cả 9 role với seed v2), overhead, margin, VAT, rounding_unit; chiết khấu gói null phải nhập 0 rõ ràng. |
| PV4 | Kích hoạt khi ma trận giá có `package_price_inversion` → bắt buộc tick "Đã xem cảnh báo đảo giá" + ghi chú (`inversion_ack`), audit. Không tự sửa giá. |
| PV5 | Báo giá mới dùng version hiệu lực tại **ngày tạo/tính lại**; báo giá đã rời `draft` dùng **snapshot** (§7.6). |

### 7.5 Guardrails
| Mã | Mức | Điều kiện |
|---|---|---|
| `margin_out_of_range` | 422 | margin < 0 hoặc **≥ 1** (100%) |
| `pct_out_of_range` | 422 | overhead < 0; ins%/VAT/discount/ads%/booking% ngoài [0, 1); productive_hours ≤ 0; salary/benefits < 0 |
| `package_price_inversion` | warning (màn Tham số, Danh mục, Báo giá) | giá gói cấp cao < giá gói cấp thấp hơn của cùng dịch vụ |
| `package_scope_identical` | warning | 2 cấp độ có cùng tập hạng mục billable (seed v2: SEO, CRM, MAU, DSH, VID — Tiêu chuẩn = Nâng cao) |
| `pricing_params_incomplete` | 409 khi **gửi duyệt/đánh dấu gửi** báo giá hoặc kích hoạt version; warning khi lưu nháp | thiếu tham số cần cho các dòng của báo giá (role của hạng mục trong báo giá; overhead/margin/VAT; chiết khấu gói nếu dùng Tiêu chuẩn/Nâng cao; ads% + min nếu có ngân sách QC; booking% nếu có chi phí bên thứ ba). Response liệt kê `missing: ["pricing_roles.dev.monthly_salary", ...]` (chỉ key, không giá trị). |
| `hours_assumption` | info | báo giá chứa hạng mục `est_hours_is_assumption=true` (badge, không chặn) |
| `below_cost` | warning + cần duyệt | `amount` dòng < chi phí gồm overhead của dòng (biên LN âm) |
| Lương ẩn | K8 | API lọc field theo permission (test ở P13.g) |

### 7.6 Snapshot
Khi báo giá chuyển `draft → pending_approval` hoặc `draft/approved → sent`: lưu `pricing_snapshot_json` = {version code/id, settings, rate từng role (chính xác, chuỗi Decimal), danh sách hạng mục + giờ + qty + price_raw của từng dòng, thời điểm}. **Không** lưu lương/BH/phúc lợi vào snapshot (chỉ rate; rate cũng là field nhạy cảm). Mở báo giá cũ → hiển thị theo snapshot dù tham số/giờ đã đổi. Báo giá **draft** khi có version mới → banner "Tham số giá đã đổi (PV-…→PV-…)" + nút **"Tính lại theo tham số mới"** (không tự tính lại).

### 7.7 Preview (không ghi DB)
`POST /api/p13/pricing/preview` — body `{version_id?, params_override?, lines:[...], include_matrix?}`. `params_override` (thay toàn bộ/một phần tham số) chỉ cho `p13.pricing.edit_draft`; **không bao giờ persist**. Dùng cho: màn Tham số (thử số), VERIFY (sanity test không đụng tham số thật), test tự động. Trả về giá từng dòng, ma trận 16×3 nếu `include_matrix=true`, warnings, `missing`.

---

## 8. P13.c — Báo giá CRUD + duyệt

### 8.1 Trạng thái — **map vào state machine proposal hiện có** (không tạo state machine mới)
Key thật của trạng thái proposal lấy từ `docs/P13.0-survey.md`; cột giữa là nghĩa, Cursor điền key.

| Trạng thái P13 (nhãn UI) | Trạng thái proposal hiện có | `p13_approval_status` | Ghi chú |
|---|---|---|---|
| Nháp | nháp (draft) | `none` / `returned` | sửa tự do, giá tính live |
| Chờ duyệt nội bộ | nháp (draft) | `pending` | **khóa sửa dòng P13** (409 `quote_locked`) |
| Đã duyệt | nháp (draft) | `approved` | sẵn sàng gửi; sửa dòng/tiền → về `none`, phải duyệt lại |
| Đã gửi | đã gửi (sent) | giữ nguyên | chặn nếu `needs_approval && p13_approval_status≠approved` |
| Khách chấp nhận | chấp nhận/won | | mở P13.e (và P13.f khi có) |
| Từ chối | từ chối/lost | | lý do bắt buộc |
| Hết hạn | hết hạn nếu có; không có thì là **badge tính từ `valid_until`** | | không thêm trạng thái mới |
| Đã thay thế | cơ chế version hiện có (version cũ) | | |
| Hủy | hủy/void nếu có; không có thì dùng cơ chế lưu trữ/xóa hiện có | | |

Cách làm: gắn **guard/hook** vào service chuyển trạng thái hiện có, **chỉ khi `pricing_source='p13'`**: (1) vào “đã gửi” cần checks Q5 + duyệt (Q4); (2) “chấp nhận” cần bằng chứng (Q8); (3) submit/approve/return là endpoint P13 riêng, chỉ đổi `p13_approval_status`. Proposal `legacy` đi đúng luồng cũ, không bị guard P13. Chuyển sai luồng → 409 `quote_invalid_transition`.

### 8.2 Rules
| # | Rule |
|---|------|
| Q1 | Dòng `package`: chọn dịch vụ + cấp độ → `list_unit_price` = giá gói (§7.1); `item_qty_overrides_json` cho phép đổi SL hạng mục đơn vị tháng/ngày quay **trong gói** (giá gói tính lại). Dòng `item`: chọn ID hạng mục → giá hạng mục lẻ. Dòng `custom`: mô tả + giá tay (cần duyệt nếu setting `custom_line_requires_approval`=true, mặc định true). Dòng `ad_budget`: ngân sách/tháng × số tháng → phí quản lý tự tính. Dòng `third_party`: chi phí đối tác → phí booking tự tính. |
| Q2 | Tổng tính lại **ở server** mỗi lần sửa (UI debounce); trả `totals` + `warnings` + `blockers`. |
| Q3 | `needs_approval = true` khi: `effective_discount_pct > discount_approval_threshold_pct` (threshold null → mọi chiết khấu > 0); hoặc `unit_price` override thấp hơn niêm yết; hoặc `below_cost`; hoặc biên LN sau CK < `min_margin_after_discount_pct` (nếu đặt); hoặc có dòng `custom` (Q1). Chiết khấu gói chuẩn (Tiêu chuẩn/Nâng cao) **không** tính là chiết khấu. `approval_reasons` ghi đủ lý do. |
| Q4 | `needs_approval` mà chuyển sang “đã gửi” khi `p13_approval_status≠approved` → **409 `quote_approval_required`**. CEO duyệt → `p13_approval_status=approved`; sửa bất kỳ dòng/tiền nào sau duyệt → quay về `draft`, duyệt lại. |
| Q5 | Gửi duyệt / đánh dấu gửi yêu cầu: tham số đủ (409 `pricing_params_incomplete`), `validity_days`/`valid_until` có (409 `quote_validity_missing`), ≥ 1 dòng phí (409 `quote_empty`); khách thiếu tên pháp nhân → warning `customer_legal_name_missing`. |
| Q6 | "Đánh dấu đã gửi": `sent_at`, `sent_channel`, `sent_evidence_url` (422 `quote_evidence_required`). `issued_at` trống → = ngày gửi, `valid_until` tính lại. K6: không gửi tự động; không có nút gửi email trong P13. |
| Q7 | Sửa báo giá đã duyệt/đã gửi → “Tạo phiên bản mới” bằng **cơ chế version hiện có của Quote OS** (cùng số `QT-PTT-…`), copy dòng P13 + reset `p13_approval_status`. Sửa dòng khi không phải draft → 409 `quote_locked`. |
| Q8 | `accepted` cần `accepted_evidence_url` + `accepted_by_contact`; chỉ từ `sent` và chưa quá `valid_until` (quá hạn → 409 `quote_expired`, phải tạo version mới). |
| Q9 | Job hết hạn (flag `P13_QUOTE_EXPIRY_JOB`, OFF): `sent` quá `valid_until` → `expired`, notify AM. Khi OFF: badge "Quá hạn hiệu lực" + nút tay. |
| Q10 | Dòng `item` trùng hạng mục đã có trong dòng `package` cùng dịch vụ → warning `item_already_in_package` (vd WEB-04-08 đã nằm trong gói WEB Tiêu chuẩn — báo giá sanity là cố ý: thêm 2 tích hợp). |
| Q11 | Dùng gói có `package_price_inversion` → warning trên dòng + gợi ý "cân nhắc cấp thấp hơn hoặc chờ CEO chỉnh tham số". |
| Q12 | Xóa/hủy theo cơ chế hiện có của Quote OS. `is_test=true` loại khỏi dashboard/báo cáo; tiêu đề báo giá test bắt đầu `[TEST P13]`. |
| Q13 | AM chỉ thấy báo giá của mình (+ được share); GĐKD/CEO/Tài chính thấy tất cả. |

### 8.3 Ví dụ response tính tổng
```json
// POST /api/p13/proposals/123/recalculate  (user AM — không có trường chi phí/biên LN)
{"ok":true,"data":{"quote_id":123,"pricing_version":"PV-TEST","status":"draft",
 "lines":[
  {"seq":1,"type":"package","service":"WEB","level":"standard","qty":1,"list_unit_price":121629000,"unit_price":121629000,"amount":121629000,
   "hours":390,"warnings":[]},
  {"seq":2,"type":"item","item":"WEB-04-08","qty":2,"list_unit_price":5253000,"unit_price":5253000,"amount":10506000,
   "warnings":["item_already_in_package","hours_assumption"]}],
 "totals":{"fee_subtotal":132135000,"extra_discount_amount":0,"fee_after_discount":132135000,"vat_pct":"0.08","fee_vat":10570800,
   "fee_total":142705800,"passthrough_total":0,"grand_total":142705800,"effective_discount_pct":"0"},
 "needs_approval":false,"approval_reasons":[],"missing":[],"can_send":false,"blockers":["quote_validity_missing"]}}
```

---

## 9. P13.d — Xuất báo giá PDF (pdfkit) · DOCX tùy chọn (P13.d2)

| # | Rule |
|---|------|
| X1 | **PDF bằng `pdfkit`** (thư viện app đang dùng). Renderer `QuotePdfRenderer` vẽ layout PTT bằng code: không template token, **không LibreOffice, không `[[path]]`, `#row`, `#each`**. Không dùng lại export “docx” hiện có (file text mang MIME docx). |
| X2 | **Font nhúng trong repo**: `assets/fonts/BeVietnamPro-{Regular,SemiBold,Bold}.ttf` + `OFL.txt` (SIL OFL, được commit), hoặc font khác hỗ trợ đủ dấu tiếng Việt (vd Noto Sans) nếu CEO chọn (D10). `doc.registerFont()` từ đường dẫn file; **không tải Google Fonts lúc chạy**. Test: PDF có chuỗi “Báo giá dịch vụ – Website & Landing Page”, “Nghiệm thu/Bàn giao”, “Một trăm bốn mươi hai triệu…” hiển thị đúng dấu (trích text bằng `pdftotext` khớp 100%). |
| X3 | Layout (theo sheet “Báo giá khách hàng” + mockup S6): header PTT (logo file trong repo, pháp nhân, MST, liên hệ: lấy từ settings, trống thì “—” và chặn bản final) · khối “BÁO GIÁ DỊCH VỤ / Số QT-PTT-… / Ngày / Hiệu lực” · khách & AM · bảng dòng (tự xuống trang, lặp header bảng) · cộng phí · CK · VAT · **tổng** · **bằng chữ** · khối chi phí chuyển tiếp · điều khoản · chữ ký 2 bên · footer “trang x/y”. A4 dọc, lề 15 mm. |
| X4 | `display_mode`: `package_only`, `package_with_scope` (gói + bảng phạm vi từ `crm_service_scope_rows` + “Không bao gồm”), `item_detail` (liệt kê hạng mục billable, **không giá từng hạng mục**, trừ dòng `item` lẻ). Mặc định D2. |
| X5 | **Không bao giờ** in lương, rate, giờ, chi phí, biên LN. Test: text trích từ PDF không chứa số rate/chi phí của fixture. |
| X6 | Tiền: số `1.234.567` + **bằng chữ** bằng helper chung mới `amountInWordsVi()` (P13.d tạo, có test; quy ước “linh”). Ngày dd/mm/yyyy. |
| X7 | Bản nháp (nháp/chờ duyệt): watermark “BẢN NHÁP — CHƯA DUYỆT” + trang cuối “Ghi chú nội bộ” (warnings). Bản final chỉ khi đã duyệt, hoặc nháp không cần duyệt và checks pass; còn TBD/blocker → 409 `quote_export_blocked` [mã]. |
| X8 | Mỗi lần xuất lưu 1 file qua cơ chế file/attachment hiện có (S9): kind `quote_draft\|quote_final`, `renderer_version`, `data_hash`, người, thời điểm; tên `QT-PTT-YYYY-NNNNNN-v<version>-<n>.pdf`. Không ghi đè. |
| X9 | Proposal `legacy` giữ export cũ, không đổi. |
| X10 | **P13.d2 (TÙY CHỌN, cần CEO quyết D9):** DOCX thật bằng thư viện `docx` (npm), cùng dữ liệu/quy tắc X3–X8. Không làm nếu D9 chưa chốt. |

---

## 10. P13.e — Checklist dự án

### 10.1 Khởi tạo
| # | Rule |
|---|------|
| C1 | Nút **"Tạo checklist triển khai"** trên báo giá `accepted` (hoặc tự động nếu flag `p13_auto_instantiate_checklist`, OFF). Chọn dự án đích (Service Delivery / Delivery Project theo S5; mặc định record gắn deal). Có `dry_run` preview: số checklist, số hạng mục, gate, hạn dự kiến. |
| C2 | Mỗi dòng `package` → 1 checklist (dịch vụ, cấp độ): copy **mọi** hạng mục `is_active` có `rank(min_level) ≤ rank(level)` — **gồm cả client_only và billable=false**; copy inputs, deliverables. Ví dụ WEB Tiêu chuẩn → **43 hạng mục, 17 gate, 2 client_only**; WEB Cơ bản 38 hạng mục/16 gate; Nâng cao 44/17. |
| C3 | Dòng `item`: nếu dự án đã có checklist cùng dịch vụ chứa hạng mục đó → **cộng `qty`** vào instance (ghi chú "+2 từ BG <số> dòng 2"), không nhân bản. Nếu chưa có → tạo checklist "Hạng mục lẻ – <dịch vụ>" (`level_code=null`) chỉ chứa hạng mục được bán (không tự thêm hạng mục quản trị chung). |
| C4 | Idempotent: unique `(proposal_line_id)`; bấm lại → trả `already=true`, không tạo trùng. Version báo giá mới được accepted → **không** tự xóa checklist cũ; hiện diff "thêm/bớt hạng mục" để PM áp dụng tay. |
| C5 | Checklist là **bản sao**: sửa danh mục sau đó không đổi checklist đang chạy (`catalog_version` lưu lại). |
| C6 | Dòng `ad_budget/third_party/custom` không tạo checklist. |

### 10.2 Giao việc
- `assignee_user_id` gợi ý = thành viên team dự án có role map với `raci.R[0]` (bảng map trong Admin; đề xuất AM→`am`, Strategist→`strategist`/`pm`, Content→`content`, Design→`graphic`, Ads→`ads`, Dev→`dev`, Data/CRM→`data`, Media/Booking→`media`, Video production→`video`; S5/S11 xác nhận role_key thật). Không có người → để trống + warning `assignee_missing`. **Không tự giao** khi có nhiều ứng viên — PM chọn (bulk assign theo vai trò).
- `client_only` → `assignee_contact_json` = đầu mối khách (P12 `contract_contacts` nếu có, không thì contact của khách); nhãn "Khách thực hiện".

### 10.3 Hạn theo ngày làm việc — `WorkingDayService` mới (tạo ở P13.a)
- **Không** dùng hàm SLA lead hiện có (đếm giờ làm việc). Dùng `WorkingDayService` mới: `isWorkingDay(date)`, `addWorkingDays(start, n)` (N1 là ngày thứ 1), `workingDaysBetween(a, b)`. Ngày làm việc = T2–T6, trừ ngày trong `crm_holidays` (`date` unique, `name`, `created_by`). Bảng **seed rỗng**; form admin (CEO/SUPER-ADMIN) để CEO nhập. Có unit test. P12 dùng lại sau này.
- `crm_holidays` rỗng → vẫn tính (chỉ bỏ T7/CN) + warning `holiday_calendar_empty` trên checklist.
- `start_date` (N1) do PM nhập (mặc định: ngày accepted + 1 ngày làm việc).
- **Đề xuất mặc định (giả định, chỉnh được, §19 D6):** thời lượng giai đoạn = `ceil(Σ est_hours×qty hạng mục billable của giai đoạn / daily_capacity_hours)` ngày làm việc, `daily_capacity_hours` mặc định **6**. Giai đoạn K→N→P→S→T→D→B nối tiếp; `due_date` hạng mục = ngày cuối giai đoạn. Giai đoạn **V** không có hạn cố định, ghi “định kỳ hằng tháng”.
- Ví dụ WEB Tiêu chuẩn, N1 = 05/10/2026 (thứ Hai), capacity 6h, không có ngày lễ: K 35h → 6 ngày → hạn K **12/10/2026**; N 32h → 6 ngày (13/10–20/10) → hạn N **20/10/2026**.
- Sửa tay → `due_date_locked=true`; đổi `start_date` hoặc ngày lễ → nút “Tính lại hạn” (bỏ qua locked), 1 transaction, audit “recomputed N deadlines”.

### 10.4 Gate phê duyệt
| # | Rule |
|---|------|
| GT1 | Hạng mục/deliverable `approval_gate=true` **không thể** chuyển `done` khi chưa có gate approval `approved` → **409 `gate_approval_required`**. |
| GT2 | Ghi gate: người duyệt phía khách (contact), thời điểm, kênh, **evidence_url hoặc file** (422 `gate_evidence_required`). (Kiểm tra người được ủy quyền trong HĐ để sau, khi có P12.) |
| GT3 | `gate_approver=internal` (seed v2 chưa có, để mở rộng): người duyệt là user nội bộ có quyền. |
| GT4 | `changes_requested` → hạng mục về `in_progress`, deliverable tăng `revision_count`; vượt `revision_limit` → warning `revision_limit_exceeded` + link "Tạo báo giá phát sinh" (mở báo giá nháp mới gắn dự án — không tự tạo). |
| GT5 | Gate dùng bảng `crm_checklist_gate_approvals` của P13 (P12 chưa có approval chung). Không có deemed acceptance trong v1. |

### 10.5 Trạng thái, bằng chứng, tiến độ
- `na` cần `na_reason` (422 `na_reason_required`); `done` ghi `completed_at/by`; hạng mục có deliverable → khuyến nghị bằng chứng (warning `evidence_missing`, không chặn trừ gate).
- **Tiến độ hạng mục** (khớp Excel): `done / (todo + in_progress + done)` — `na` loại khỏi mẫu số. Tương tự cho đầu vào, deliverables. **Gate**: `gates_done / gates_total` (vd "5 / 17"). Phụ: tiến độ theo giờ `Σ giờ done / Σ giờ (≠ na)`.
- Tiến độ dự án = trung bình có trọng số theo giờ của các checklist (hiện cả 2 số). Cập nhật `progress` Delivery Project nếu S5 cho phép (flag `p13_checklist_task_sync`).
- Trễ hạn: `due_date < today` và status ∈ {todo, in_progress} → badge đỏ, vào widget.

---

## 11. P13.f — Tích hợp

### 11.1 Báo giá chấp nhận → HĐ nháp: **sau capability check, hiện trả 409 `P12_MODULE_MISSING`**
| # | Rule |
|---|------|
| F0 | P13.0 xác nhận **chưa có module HĐ P12** (không `compose_status`, không đợt thu); `crm_contracts` hiện tại là HĐ của lead. **Không ghi** vào `crm_contracts` hiện tại. |
| F1 | `contractsModule.isAvailable()` (capability check ở server: kiểm tra bảng/cột P12 cần thiết, ví dụ `compose_status` và bảng installments). Hiện trả `false` → `POST /api/p13/proposals/{id}/create-contract-draft` trả **409 `P12_MODULE_MISSING`**; UI hiện nút disabled + tooltip “Cần module Hợp đồng (P12), chưa có”. |
| F2 | Khi P12 có (phase sau, spec riêng): tạo HĐ **draft** từ proposal accepted, `value_before_vat = fee_after_discount + ads_fee_total + booking_fee_total`, VAT theo snapshot, deliverables theo dòng, đợt thu từ `payment_terms_json` (không tự bịa), idempotent, link 2 chiều. D5 quyết lúc đó. **Không implement F2 trong P13.** |

### 11.2 Checklist ↔ task dự án (flag `P13_CHECKLIST_TASK_SYNC`, OFF)
- Nút "Tạo task từ checklist" (theo giai đoạn hoặc chọn hạng mục): tạo `crm_svc_tasks` (hoặc bảng task theo S5) với title `[WEB-04-08] Tích hợp form/CRM/chatbot`, assignee, `due_at`, acceptance = `standard`, link `checklist_item_id`. Idempotent theo `checklist_item_id`.
- Đồng bộ trạng thái: task done → item `done` (item có gate → "Chờ gate" + notify PM, không done); item `done/na` → task đóng. Ghi `sync_origin` để tránh vòng lặp. Đổi hạn một bên → bên kia cập nhật, audit.
- Task cũ không có link → không bị đụng (tương thích ngược).

### 11.3 Stage lead/deal (flag `P13_DEAL_STAGE_SYNC`, OFF)
- Báo giá `sent` → đề xuất chuyển deal/lead sang stage **"Báo giá"** (nếu đang ở stage trước đó). `accepted` → đề xuất stage tiếp theo theo pipeline (vd Service Delivery **Onboard** / deal Won — S4 xác nhận key). `rejected` → đề xuất Lost hoặc giữ (người chọn).
- **Chỉ tiến, không lùi** (PO-31); hộp xác nhận (người bấm = phê duyệt, PO-33); không chuyển ngầm. Audit.

---

## 12. P13.g — Dashboard + siết phân quyền

### 12.1 Widget (loại `is_test`)
| Widget | Ai thấy | Nội dung |
|---|---|---|
| Báo giá theo trạng thái | CEO, GĐKD, Tài chính; AM (của mình) | số lượng + giá trị (fee_total) theo trạng thái, tháng này |
| Báo giá chờ duyệt | CEO | danh sách `pending_approval`: AM, khách, % CK, lý do |
| Sắp hết hạn | AM, GĐKD | `sent` có `valid_until` trong 7 ngày tới / đã quá |
| Tỷ lệ chấp nhận | CEO, GĐKD | accepted / (accepted + rejected + expired) theo tháng, theo dịch vụ |
| Cảnh báo giá | CEO, Tài chính | version active, số gói đảo giá, số hạng mục giờ "Giả định" |
| Tiến độ checklist | PM, AM, CEO | theo dự án: % hạng mục, % đầu vào, gate x/y, số hạng mục trễ |
| Gate chờ khách | AM, PM | gate `pending` + số ngày chờ |
| Đầu vào khách còn thiếu | AM, PM | inputs bắt buộc chưa nhận / quá hạn |

### 12.2 Siết phân quyền
- Test tự động từng role (§3.2) trên mọi endpoint P13: 403 đúng chỗ; serializer không có key nhạy cảm cho AM/GĐKD/PM/Team; export không chứa chi phí.
- Policy ở server cho list + detail + export + AI tool; menu ẩn theo permission; `P13_ENABLED=false` → mọi route P13 trả 404 và menu ẩn.
- (Tùy chọn) audit lượt xem màn Tham số giá có lương.

### 12.3 AI tools (tùy chọn, flag `p13_ai_tools`, OFF; theo registry S15)
| Tool | Loại | Mô tả |
|---|---|---|
| `service_catalog.read` | read | dịch vụ, cấp độ, hạng mục (không chi phí) |
| `quote.price_preview` | read | như `/pricing/preview` nhưng **không** nhận `params_override`, không trả chi phí |
| `quote.write_draft` | write | tạo/sửa báo giá `draft` (dry_run + header); không gửi duyệt/gửi/chấp nhận |
| `checklist.read` | read | checklist + tiến độ + gate |

Cấm: `quote.send`, `quote.accept`, `pricing.activate`.

---

## 13. Màn hình (UI)

> **v1.1:** UI dùng **CSS custom sẵn có của app** (không Tailwind/shadcn/AntD), brand **#17692f**, font **system-ui**. Báo giá (danh sách, tạo/sửa, duyệt) là **mở rộng màn `/crm/proposals`**: thêm chế độ “Báo giá theo danh mục P13” (`pricing_source='p13'`), không làm menu báo giá thứ hai. Chi tiết: `docs/p13/uiux/UIUX-P13.md` v1.1.

1. **Danh mục dịch vụ P13** (route mới, vd `/crm/service-catalog`; không đè `/admin/services/process`): lọc nhóm; danh sách 16 dịch vụ (mã, tên, nhóm, mô hình tính phí, số hạng mục, gate, giá gói 3 cấp nếu có version active — chỉ giá bán). Chi tiết dịch vụ: header (mục tiêu, vấn đề, đối tượng, tiền đề, không bao gồm) + **tab: Hạng mục · Đầu vào · Bàn giao · KPI · Rủi ro** (+ tab phụ "Phạm vi theo cấp độ"). Tab Hạng mục: bảng nhóm theo giai đoạn (ID, hạng mục, chi tiết, tiêu chuẩn, R/A/C/I, công cụ, đầu ra, gate, cấp tối thiểu, giờ [badge Giả định], đơn vị, tính phí); lọc "hạng mục thuộc gói Tiêu chuẩn"; Admin sửa inline giờ/cấp/tính phí (audit, `est_hours_source=edited`), nút "Xác nhận giờ".
2. **Tham số giá** (CEO/Tài chính): danh sách version (trạng thái, hiệu lực, người duyệt); form version nháp: bảng 9 vai trò (lương, BH%, phúc lợi, giờ hiệu dụng → đơn giá giờ tự tính) + tham số chung (overhead, margin, VAT, làm tròn, CK gói, phí QC % + tối thiểu, booking %, ngưỡng duyệt CK, sàn biên LN); **ma trận preview 16×3** (giờ, giá) tô đỏ ô đảo giá, vàng ô scope trùng; nút "Kích hoạt" (CEO) với hộp xác nhận cảnh báo; "Clone thành nháp".
3. **Tạo/sửa báo giá**: header (khách, deal, AM, tiêu đề, hiệu lực, display mode, điều khoản thanh toán); bảng dòng (thêm Gói / Hạng mục lẻ / Dòng tùy chỉnh / Ngân sách QC / Chi phí bên thứ ba); picker dịch vụ → cấp độ (hiện giá 3 cấp + khác biệt phạm vi); picker hạng mục theo ID/tìm kiếm; CK dòng, CK thêm; **tổng live** (phí, CK, VAT, thu hộ, tổng); panel cảnh báo/chặn; nút Lưu nháp · Gửi duyệt · Duyệt/Trả về (CEO) · Xuất nháp · Xuất bản gửi khách · Đánh dấu đã gửi · Chấp nhận / Từ chối · Tạo phiên bản mới · Tạo checklist · Tạo HĐ nháp. CEO/Tài chính/GĐKD thấy thêm biên LN %. Danh sách báo giá: lọc trạng thái, AM, khách, sắp hết hạn, test.
4. **Xuất báo giá**: dialog chọn display mode, PDF (DOCX chỉ khi D9), lịch sử phiên bản file.
5. **Checklist dự án** (tab trong Service Delivery/Delivery Project): chọn checklist (dịch vụ/cấp độ); view **Bảng** (nhóm theo giai đoạn) và **Kanban** (cột = trạng thái, hoặc cột = giai đoạn); lọc giai đoạn, người phụ trách, trạng thái, gate, trễ hạn, client_only; header 4 chỉ số (hạng mục %, đầu vào %, deliverables %, gate x/y) như sheet Excel; drawer hạng mục: trạng thái, người, hạn (khóa), bằng chứng/file, ghi gate (contact, kênh, evidence), lịch sử; tab Đầu vào, Bàn giao; nút "Tính lại hạn", "Tạo task".
6. **Dashboard**: widget §12.1 trên Tổng quan/CEO theo cơ chế S14.
7. **Admin**: Import catalog (upload JSON → dry-run → apply, lịch sử import); Map vai trò RACI ↔ role_key; **Ngày lễ (`crm_holidays`)**; Settings P13 (hiệu lực mặc định, capacity giờ/ngày, display mode mặc định, `custom_line_requires_approval`); Mẫu báo giá; Flags.

---

## 14. API (đề xuất; theo convention S1 — prefix thật có thể là `/api/v1/crm/...`)

| Method | Path | Quyền | Ghi chú |
|---|---|---|---|
| GET | `/api/p13/service-groups` | catalog.view | |
| GET | `/api/p13/services?group=&active=` | catalog.view | kèm giá gói nếu `pricing.view` |
| GET | `/api/p13/services/{code}` | catalog.view | `?include=items,inputs,deliverables,kpis,risks,scope` |
| PATCH | `/api/p13/service-items/{code}` | catalog.manage | est_hours, min_level, billable, default_qty, is_active, confirm_hours |
| POST | `/api/p13/catalog/import` | catalog.manage | upload JSON, `dry_run` |
| GET | `/api/p13/pricing/versions` | pricing.view | |
| POST | `/api/p13/pricing/versions` | pricing.edit_draft | tạo nháp / `clone_from` |
| GET/PATCH | `/api/p13/pricing/versions/{id}` | pricing.view / edit_draft (chỉ draft) | trường lương theo cost.view |
| POST | `/api/p13/pricing/versions/{id}/activate` | pricing.activate | `effective_from`, `inversion_ack`, `inversion_ack_note` |
| GET | `/api/p13/pricing/matrix?version_id=` | pricing.view | 16×3 giờ/giá + warnings |
| POST | `/api/p13/pricing/preview` | pricing.view (`params_override` cần edit_draft) | không ghi DB |
| GET/POST | `/api/p13/proposals` | quote.view_* / edit | lớp P13 trên API proposal hiện có (có thể gắn vào route proposal sẵn có theo convention); tạo mới với `pricing_source=p13`, số QT-PTT do bộ đếm hiện có cấp |
| GET/PATCH/DELETE | `/api/p13/proposals/{id}` | | DELETE chỉ draft chưa rời nháp |
| PUT | `/api/p13/proposals/{id}/lines` | quote.edit | thay toàn bộ dòng, trả totals |
| POST | `/api/p13/proposals/{id}/recalculate` | quote.edit | theo version hiện hành (draft) |
| GET | `/api/p13/proposals/{id}/checks` | quote.view | blockers + warnings |
| POST | `/api/p13/proposals/{id}/submit` | quote.edit | → pending_approval |
| POST | `/api/p13/proposals/{id}/approve` · `/return` | quote.approve_discount | note bắt buộc khi return |
| POST | `/api/p13/proposals/{id}/mark-sent` · `/accept` · `/reject` · `/expire` · `/cancel` | quote.mark_status | evidence theo Q6/Q8 |
| POST | `/api/p13/proposals/{id}/new-version` | quote.edit | |
| POST | `/api/p13/proposals/{id}/export` | quote.view | `mode=draft|final`, `formats=[pdf]` (`docx` chỉ khi D9), `display_mode`, `dry_run` |
| POST | `/api/p13/proposals/{id}/instantiate-checklists` | checklist.manage | `project_ref`, `start_date`, `dry_run` |
| POST | `/api/p13/proposals/{id}/create-contract-draft` | quote.mark_status | capability check → hiện **409 `P12_MODULE_MISSING`** |
| GET | `/api/p13/projects/{ref_type}/{id}/checklists` | checklist.view | |
| GET/PATCH | `/api/p13/checklists/{id}` | checklist.view / manage | start_date, pm, capacity |
| PATCH | `/api/p13/checklist-items/{id}` | checklist.manage / update_assigned | status, assignee, due_date, evidence, na_reason |
| POST | `/api/p13/checklist-items/{id}/gate-approval` | checklist.gate_signoff | |
| GET/POST/DELETE | `/api/p13/holidays` | CEO / SUPER-ADMIN | form ngày lễ cho `WorkingDayService` |
| POST | `/api/p13/checklists/{id}/recompute-dates` | checklist.manage | `dry_run` |
| POST | `/api/p13/checklists/{id}/sync-tasks` | checklist.manage | flag |
| GET | `/api/p13/dashboard` | dashboard.view | dữ liệu widget theo role |

Response chuẩn như P3–P12: `{"ok":true,"data":{...}}` / `{"ok":false,"error":{"code":"...","message":"...","details":{}}}`.

---

## 15. Migrations, feature flags, tương thích ngược

### 15.1 Migration (thứ tự; mỗi file có `down()`)
1. `p13_01_service_catalog`: **bảng mới** groups, services (+ `legacy_sku_code` nullable), levels, phases, scope_rows, items, inputs, deliverables, kpis, risks, catalog_imports. Không đụng `service_family`/SKU/`tasks_json`.
2. `p13_02_holidays`: `crm_holidays` (rỗng) cho `WorkingDayService`.
3. `p13_03_settings_flags`: chỉ khi app có bảng settings; không có thì dùng env (§15.2). Seed settings P13 mặc định (D1, D2, D4, D6 placeholder).
4. `p13_04_pricing`: pricing_versions, pricing_roles, pricing_settings.
5. `p13_05_proposals_extend`: **ALTER** `crm_proposals` + bảng dòng (§5.3), backfill `pricing_source='legacy'`.
6. `p13_06_checklists`: project_checklists, items, inputs, deliverables, `crm_checklist_gate_approvals`.
7. `p13_07_integrations`: `crm_svc_tasks.checklist_item_id` (theo S5), deal/lead `last_proposal_id` (tùy chọn). **Không** thêm cột vào `crm_contracts`.
8. `p13_08_permissions`: seed permission + gán role mặc định §3.2.
9. `p13_09_audit`: chỉ khi chưa có audit chung.

### 15.2 Feature flag (cơ chế tối thiểu mới; mặc định OFF trên production đến khi VERIFY pass)
Helper server `p13Flag(name)`: đọc env `P13_<NAME>` (`true|false`); nếu app có bảng settings thì cho settings row `p13.flags.<name>` ghi đè env (CEO/SUPER-ADMIN sửa được, có audit). Client nhận cờ qua config/session hiện có. Không có framework flag chung → **không** dựng framework lớn.

| Env / flag | Tác dụng |
|---|---|
| `P13_ENABLED` | master: menu + route P13 (OFF → 404, proposal cũ vẫn chạy) |
| `P13_QUOTE_EXPORT` | xuất PDF báo giá P13 |
| `P13_QUOTE_DOCX` | P13.d2 DOCX (chỉ khi D9 = có) |
| `P13_CHECKLISTS` | khởi tạo/theo dõi checklist |
| `P13_AUTO_INSTANTIATE_CHECKLIST` | tự tạo checklist khi accepted (OFF) |
| `P13_CHECKLIST_TASK_SYNC` | sync task + progress |
| `P13_DEAL_STAGE_SYNC` | đề xuất chuyển stage |
| `P13_QUOTE_EXPIRY_JOB` | job hết hạn báo giá |
| `P13_AI_TOOLS` | AI tools P13 |
| *(không phải flag)* HĐ nháp | capability `contractsModule.isAvailable()`, hiện → 409 `P12_MODULE_MISSING` |

### 15.3 Tương thích ngược
- **Proposal legacy:** `pricing_source='legacy'` cho mọi bản ghi cũ; list, xem, sửa, chuyển trạng thái, export, đánh số `QT-PTT-…` **y như trước**. Guard P13 chỉ chạy với `pricing_source='p13'`. Có test hồi quy riêng (§17.1 R-legacy).
- Catalog SKU/process phases cũ giữ nguyên; P13 chỉ thêm `legacy_sku_code` (tùy chọn).
- Hàm giá JS `Number` cũ giữ nguyên cho legacy; P13 không gọi.
- Hàm SLA lead (giờ làm việc) không đổi.
- Task cũ không link checklist → không bị sync.
- Không đổi P8–P12 đã có (export Plan #15, Role KPI, SLA lead). Chạy test hiện có trước/sau mỗi phase.
- Rollback: `P13_ENABLED=false` là đủ để ẩn; `down()` chỉ dùng trên staging/local.

---

## 16. Mã lỗi / cảnh báo

| Mã | Loại | Khi |
|---|---|---|
| `margin_out_of_range` | 422 | margin ∉ [0, 1) |
| `pct_out_of_range` | 422 | % / giờ / tiền âm hoặc ngoài khoảng |
| `pricing_params_incomplete` | 409 (gửi duyệt, gửi, kích hoạt) / warning (nháp) | §7.5 |
| `pricing_version_immutable` | 409 | sửa version active/retired |
| `pricing_activate_forbidden` | 403 | không phải CEO |
| `quote_approval_required` | 409 | Q4 |
| `quote_validity_missing` | 409 | Q5 |
| `quote_empty` | 409 | Q5 |
| `quote_evidence_required` | 422 | Q6/Q8 |
| `quote_expired` | 409 | Q8 |
| `quote_locked` | 409 | sửa dòng khi không phải draft |
| `quote_invalid_transition` | 409 | chuyển trạng thái sai luồng |
| `quote_export_blocked` | 409 | X6 (kèm danh sách mã) |
| `gate_approval_required` | 409 | GT1 |
| `gate_evidence_required` | 422 | GT2 |
| `na_reason_required` | 422 | §10.5 |
| `P12_MODULE_MISSING` | 409 | F1: chưa có module HĐ P12 (capability check) |
| `catalog_schema_invalid` | 422 | I1 |
| `already=true` (không phải lỗi) | 200 | C4 / F6 idempotent |
| `package_price_inversion`, `package_scope_identical`, `hours_assumption`, `below_cost`, `item_already_in_package`, `assignee_missing`, `holiday_calendar_empty`, `evidence_missing`, `revision_limit_exceeded`, `customer_legal_name_missing` | warning | không chặn |

---

## 17. Acceptance & test case

### 17.1 Theo sub-ticket
- **P13.0** ✅: `docs/P13.0-survey.md` đã có. Kết luận ở §00.
- **P13.a**: import dry-run in 16/675/227; apply → bảng **mới** có 16 dịch vụ, 675 hạng mục, 23 client_only, 652 billable; bảng SKU/`tasks_json` **không đổi** (đếm trước/sau bằng nhau); chạy lại → 0 created/0 updated; sửa giờ WEB-04-08 = 20 rồi import lại → `skipped_edited=1`, giờ vẫn 20; file sai schema → 422/exit≠0, không ghi gì. `P13_ENABLED=false` → route P13 404, menu ẩn. `WorkingDayService`: `addWorkingDays(05/10/2026, 6) = 12/10/2026` khi chưa có ngày lễ; thêm ngày lễ 08/10/2026 → 13/10/2026; form admin ngày lễ chỉ CEO/SUPER-ADMIN.
- **P13.b**: test công thức §17.2 xanh **với Decimal** (ghi tên thư viện); có test chứng minh không gọi hàm giá `Number` cũ; kích hoạt thiếu lương role `dev` → 409; margin 1 → 422; ma trận hiện 15 gói đảo giá + 5 dịch vụ scope trùng; AM GET version → không có key lương/rate.
- **P13.c**: tạo proposal P13 → số **`QT-PTT-2026-NNNNNN`** theo bộ đếm hiện có, `pricing_source='p13'`; báo giá mẫu §7.2 → tổng đúng, cột cũ `total/fee` đồng bộ; CK thêm 10% → `needs_approval`, chuyển “đã gửi” → 409 `quote_approval_required`; CEO duyệt (`p13_approval_status=approved`) → gửi được; thiếu hiệu lực → 409; version mới qua cơ chế version hiện có; snapshot giữ giá khi kích hoạt version tham số mới.
- **R-legacy (bắt buộc từ P13.c)**: ≥ 3 proposal `legacy` có sẵn (hoặc fixture) vẫn **hiển thị, sửa, chuyển trạng thái, export** như trước; số tiền/total không đổi; không bị guard P13; không xuất hiện cảnh báo P13; test tự động snapshot trước/sau migration.
- **P13.d**: PDF pdfkit báo giá mẫu: `pdftotext` ra đúng dấu tiếng Việt (vd “Nghiệm thu/Bàn giao”, “Một trăm bốn mươi hai triệu bảy trăm linh năm nghìn tám trăm đồng” cho 142.705.800); font nhúng (`pdffonts` thấy BeVietnamPro hoặc font đã chọn, `emb=yes`); không chứa rate/giờ/chi phí; nháp có watermark; 3 display mode; mỗi lần xuất 1 file. Export proposal legacy không đổi. (P13.d2 DOCX chỉ khi D9.)
- **P13.e**: khởi tạo từ báo giá mẫu (accepted) → 1 checklist WEB Tiêu chuẩn 43 hạng mục / 17 gate / 2 client_only, WEB-04-08 `qty=3`; bấm lại không trùng; gate chưa duyệt → 409; hạn K = 12/10/2026, N = 20/10/2026 (N1 05/10/2026, capacity 6, chưa có ngày lễ); tiến độ đúng công thức.
- **P13.f**: `create-contract-draft` → **409 `P12_MODULE_MISSING`**, không ghi `crm_contracts`; UI nút disabled + tooltip; task tạo từ checklist idempotent, task done → item done (gate → chờ gate); stage chỉ tiến, có xác nhận.
- **P13.g**: 8 widget, loại is_test; RBAC từng role pass; `P13_ENABLED=false` → 404 + menu ẩn.
- **Regression**: R-legacy; export Plan #15 (P11.3); Role KPI; SLA lead P10 (hàm giờ làm việc không đổi); hàm giá cũ cho proposal legacy không đổi.

### 17.2 Test công thức (unit, bắt buộc — dữ liệu `docs/p13/p13-pricing-sanity-fixture.json`)
**Bắt buộc dùng Decimal** (PricingEngine mới, §00 A5). Tham số TEST: mọi role lương 20.000.000, BH 20%, phúc lợi 1.000.000, 132h; overhead 30%, margin 25%, VAT 8%, CK Tiêu chuẩn 5%, Nâng cao 10%, làm tròn 1.000.

| TC | Input | Kỳ vọng |
|---|---|---|
| F1 | rate | chính xác `6250000/33`; hiển thị **189.394** |
| F2 | WEB Cơ bản | giờ **364**, giá **119.495.000** |
| F3 | WEB Tiêu chuẩn | giờ **390**, giá **121.629.000** |
| F4 | WEB Nâng cao | giờ **398**, giá **117.591.000** + warning `package_price_inversion` (advanced < standard) |
| F5 | WEB-04-08 lẻ | 16h → **5.253.000** |
| F6 | Báo giá WEB Tiêu chuẩn ×1 + WEB-04-08 ×2 | subtotal **132.135.000**; VAT **10.570.800**; tổng **142.705.800** |
| F7 | Bẫy float | SEO Nâng cao **84.500.000**; MED Nâng cao **74.750.000**; MKT Cơ bản **65.000.000**; MKT Nâng cao **84.500.000** (không được +1.000) |
| F8 | Ma trận 16×3 | khớp **Phụ lục A** 48/48 ô; inversions = 15 (mọi dịch vụ trừ RET); scope_identical = SEO, CRM, MAU, DSH, VID |
| F9 | rounding_unit = 0, WEB Cơ bản | 119.494.949,49… → **119.494.949** (HALF_UP về đồng) |
| F10 | margin = 1 / 1,2 / −0,1 | 422 `margin_out_of_range`; margin 0,99 hợp lệ |
| F11 | Overhead 35% (version mới), WEB Tiêu chuẩn | **126.307.000**; báo giá đã gửi trước đó vẫn **121.629.000** (snapshot) |
| F12 | Gói VID Cơ bản, override VID-04-07 (Quay phim, 60h, ngày quay) qty 3 | 125.405.000 → **164.798.000** |
| F13 | CK thêm 10% trên báo giá F6 | CK 13.213.500; sau CK **118.921.500**; VAT **9.513.720**; tổng **128.435.220**; effective_discount 10% |
| F14 | Phí QC (tham số test riêng: ads 10%, tối thiểu 5.000.000/tháng) | ngân sách 30.000.000 → phí **5.000.000**; 80.000.000 → **8.000.000**; 0 → **0** |
| F15 | Booking (test: 10%), chi phí bên thứ ba 20.000.000 | phí **2.000.000**; VAT thu hộ cùng phí QC 5.000.000: (5.000.000 + 2.000.000) × 8% = **560.000** |
| F16 | Thiếu lương role `dev`, báo giá WEB | lưu nháp OK + warning; submit/mark-sent → 409 `pricing_params_incomplete`, `missing` chứa `pricing_roles.dev.monthly_salary` |
| F17 | Hạng mục client_only (WEB Tiêu chuẩn có 2) | giá 0, không vào giờ tính phí, vẫn vào checklist |

### 17.3 Test phân quyền (P13.g)
AM/GĐKD/PM/Team: GET pricing version → không có `monthly_salary, insurance_pct, monthly_benefits, hourly_rate`; GET quote → không có `cost_total/cost_snapshot`; AM không thấy `margin_pct_effective`; AM approve → 403; Tài chính activate → 403; CEO activate OK; AM xem báo giá của AM khác → 403/404.

---

## 18. Kế hoạch deploy & VERIFY
| Đợt | Phase | Flag bật (staging → prod cho CEO/Admin trước) | VERIFY |
|---|---|---|---|
| D1 | P13.a + P13.b | `P13_ENABLED` (staging; prod chỉ khi CEO đồng ý) | V1–V8 |
| D2 | P13.c + P13.d | + `P13_QUOTE_EXPORT` | V9–V17 |
| D3 | P13.e | + `P13_CHECKLISTS` | V18–V23 |
| D4 | P13.f + P13.g | + `P13_CHECKLIST_TASK_SYNC`, `P13_DEAL_STAGE_SYNC` (khi CEO đồng ý); HĐ nháp vẫn 409 `P12_MODULE_MISSING` | V24–V30 + R1–R4 |

Chi tiết: `docs/PROMPT-P13-VERIFY-after-deploy.txt`.

---

## 19. Quyết định CEO cần chốt
| # | Câu hỏi | Trạng thái / mặc định tạm |
|---|---|---|
| D1 | **Ngưỡng chiết khấu phải CEO duyệt** | `null` = **mọi** chiết khấu > 0 cần CEO duyệt |
| D2 | Báo giá gửi khách hiện chi tiết hạng mục hay chỉ gói (hay gói + phạm vi)? | `package_with_scope` |
| D3 | Định dạng số báo giá | ✅ **ĐÃ CHỐT (P13.0):** dùng `QT-PTT-{YYYY}-{SEQ:6}` của Quote OS, version theo cơ chế hiện có |
| D4 | **Số ngày hiệu lực mặc định** | `TBD`, AM bắt buộc nhập (chặn gửi nếu trống) |
| D5 | Ngân sách QC/chi phí bên thứ ba có tính vào giá trị HĐ không? | ⏸ **HOÃN** tới khi có module HĐ P12 (P13.f hiện 409) |
| D6 | Năng lực giờ/ngày để tính hạn checklist | 6 giờ/ngày, giai đoạn nối tiếp |
| D7 | Đảo giá gói (15/16 dịch vụ với tham số TEST) | Chỉ cảnh báo |
| D8 | GĐKD duyệt chiết khấu? | Không |
| D9 | **Có cần file DOCX báo giá** (P13.d2, thư viện `docx`) hay chỉ PDF? | Chỉ PDF (P13.d2 không làm) |
| D10 | Font PDF nhúng | Be Vietnam Pro (OFL, commit vào repo); thay được bằng font tiếng Việt khác |
| D11 | Ngày lễ năm 2026–2027 cho `crm_holidays` | CEO nhập qua form admin; bảng rỗng vẫn chạy (chỉ bỏ T7/CN) + cảnh báo |

D1, D2, D4 là bắt buộc trước khi bật báo giá thật trên production; D6–D11 có mặc định an toàn; D5 hoãn.

---

## 20. Ngoài phạm vi
Gửi email/Zalo tự động; ký số; hóa đơn điện tử; retainer theo giờ (P13.h); giá thị trường/đối thủ; đa tiền tệ; tự đổi stage không có người bấm; hiệu chỉnh giờ từ chấm công.

---

## Phụ lục A — Giá gói với tham số TEST (đã kiểm bằng LibreOffice trên bản sao file Excel)
Tham số §17.2. Giá VND, đã trừ CK gói, làm tròn lên 1.000. **Không phải giá thật.**

| Mã | Dịch vụ | Giờ CB | Giờ TC | Giờ NC | Giá Cơ bản | Giá Tiêu chuẩn (−5%) | Giá Nâng cao (−10%) | Cảnh báo |
|---|---|---|---|---|---|---|---|---|
| BI | Hệ thống nhận diện Thương hiệu | 358 | 384 | 394 | 117.526.000 | 119.758.000 | 116.410.000 | đảo NC<TC |
| CS | Chiến lược nội dung & Mạng xã hội | 270 | 290 | 302 | 88.637.000 | 90.442.000 | 89.228.000 | đảo NC<TC |
| WEB | Website & Landing Page | 364 | 390 | 398 | 119.495.000 | 121.629.000 | 117.591.000 | đảo NC<TC |
| ADS | Quảng cáo tối ưu chuyển đổi | 267 | 315 | 327 | 87.652.000 | 98.239.000 | 96.614.000 | đảo NC<TC |
| SEO | Tối ưu SEO & AEO | 258 | 286 | 286 | 84.697.000 | 89.195.000 | 84.500.000 | đảo · scope trùng · bẫy float |
| BOT | AI Chatbot & Trợ lý bán hàng AI | 273 | 301 | 309 | 89.622.000 | 93.873.000 | 91.296.000 | đảo NC<TC |
| CRM | Thiết lập & Tích hợp hệ thống CRM | 283 | 321 | 321 | 92.905.000 | 100.110.000 | 94.841.000 | đảo · scope trùng |
| NUR | Tự động hoá nuôi dưỡng khách hàng | 220 | 268 | 276 | 72.223.000 | 83.581.000 | 81.546.000 | đảo NC<TC |
| RET | Chương trình giữ chân & Tăng tỷ lệ quay lại | 239 | 271 | 299 | 78.460.000 | 84.517.000 | 88.341.000 | — |
| MAU | Thiết lập Marketing Automation | 227 | 291 | 291 | 74.521.000 | 90.754.000 | 85.978.000 | đảo · scope trùng |
| MKT | Báo cáo phân tích thị trường | 198 | 276 | 286 | 65.000.000 | 86.076.000 | 84.500.000 | đảo · bẫy float (CB, NC) |
| DSH | Bảng điều khiển & Báo cáo AI | 236 | 284 | 284 | 77.475.000 | 88.571.000 | 83.910.000 | đảo · scope trùng |
| MED | Booking Media & Adnetwork | 219 | 245 | 253 | 71.894.000 | 76.408.000 | 74.750.000 | đảo · bẫy float |
| PR | Booking PR - Báo chí | 224 | 238 | 241 | 73.536.000 | 74.225.000 | 71.205.000 | đảo NC<TC |
| KOL | Booking Social, KOL, KOC | 206 | 220 | 224 | 67.627.000 | 68.612.000 | 66.182.000 | đảo NC<TC |
| VID | Sản xuất Video & TVC | 382 | 420 | 420 | 125.405.000 | 130.985.000 | 124.091.000 | đảo · scope trùng |

## Phụ lục B — File trong `docs/p13/`
| File | Nội dung |
|---|---|
| `p13-seed-v2.json` | seed 16 dịch vụ / 675 hạng mục + inputs/deliverables/KPI/risks/scope/specs + pricing template (không số tiền) + retainer_templates |
| `p13-seed.schema.json` | JSON Schema draft 2020-12 cho seed |
| `export_p13_seed.py` | script export từ `v2/src` + tự kiểm + sinh fixture |
| `p13-pricing-sanity-fixture.json` | tham số TEST + kỳ vọng (rate, 48 giá gói, inversions, bẫy float, báo giá mẫu) |
| `BANG-TINH-GIA-sanity-test-params.xlsx` | bản sao file giá đã điền tham số TEST, tính lại ngoài app để đối chiếu (không dùng LibreOffice trong app) |
| `README.md` | hướng dẫn ngắn |
| `uiux/` | UIUX-P13.md v1.1 + mockup S1–S8 + ảnh 1440px (tham chiếu bố cục; màu/font theo app) |

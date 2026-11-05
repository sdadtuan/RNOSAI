# SRS — KPI Hub

**Sản phẩm:** CRM / Marketing & Sales Performance Management  
**Phân hệ:** KPI Hub  
**Chức năng:** Không gian làm việc thống nhất để định nghĩa, tính toán, giám sát, cảnh báo và báo cáo KPI Marketing & Sales  
**Liên quan:** Thiết lập Nhóm KPI, Thiết lập KPI Type, Bộ KPI, Chỉ tiêu KPI, Chu kỳ đánh giá, Data Quality, Connector Registry  
**Phiên bản:** 1.1  
**Ngày:** 2026-09-04  
**Nguồn thiết kế:** Mockup KPI Hub + SRS nghiệp vụ `SRS_KPI_Hub.md` (04/09/2026)  
**Ngôn ngữ:** Tiếng Việt  

**Changelog v1.1:** Bổ sung lớp semantic/governance, Source of Record, lifecycle phê duyệt, phân tách Metric/KPI, KPI Owner vs Data Owner, hierarchy target, drill-down, Data Issue precedence, catalog 21 KPI mẫu, hợp đồng Power BI/Excel, và các quy tắc thực thi hàng ngày còn thiếu ở v1.0.

---

## 1. Mục đích

**KPI Hub** là lớp quản trị KPI và **semantic data layer** nằm giữa dữ liệu vận hành (CRM, Ads, SharePoint, ERP, GA4) với Dashboard / Báo cáo / API / Power BI. Không phải chỉ một trang biểu đồ.

KPI Hub không thay thế sổ điểm nhân viên tại `/crm/kpi`, không thay CRM/ERP/Ads Manager. Kết quả đã xuất bản từ Hub được Dashboard, Báo cáo, Power BI và (sau này) Bộ KPI / Chỉ tiêu KPI tiêu thụ.

### 1.1. Vấn đề nghiệp vụ phải giải

- Cùng một chỉ số Lead / MQL / CPL / Doanh thu / CAC bị định nghĩa khác nhau giữa Marketing, Sales, Finance và Ban điều hành.
- Công thức hard-code rải trong Excel, Power BI, SQL, dashboard — không truy vết được record gốc, rule lọc, owner.
- Target và ngưỡng nằm file thủ công, khó áp theo team / campaign / nhân sự.
- Dữ liệu trễ, thiếu, trùng, mapping sai nhưng không có cảnh báo và người xử lý.
- Báo cáo MKT / Sales / Finance không cùng một phiên bản định nghĩa.

### 1.2. Mục tiêu người dùng

| Người dùng | Việc phải làm được |
|---|---|
| Marketing Manager | Lead, CPL, MQL, campaign, ROAS; target Marketing; phản hồi cảnh báo |
| Sales Manager | Funnel, SLA, pipeline, Win Rate, doanh thu ký mới; target Sales |
| Finance Manager | Đối soát doanh thu hóa đơn/thu tiền, chi phí, CAC; duyệt KPI tài chính |
| Data Analyst / Data Steward | Mapping, DQ rule, glossary, refresh, issue |
| BI Admin | Publish semantic, phê duyệt đổi công thức/nguồn, audit toàn bộ |
| Ban điều hành | Dashboard tổng, tiến độ target, cảnh báo cần xử lý — không sửa cấu hình |

Mục tiêu:

- Một nguồn sự thật cho tên, mã, công thức, đơn vị, hướng đo và owner của từng KPI.
- Tính toán tự động từ nhiều nguồn (CRM, Meta Ads, SharePoint, ERP, GA4) với mapping và lineage rõ ràng.
- Theo dõi actual so với Target / Warning / Critical theo kỳ và phạm vi.
- Giám sát freshness, completeness, uniqueness, consistency của dữ liệu đầu vào.
- Tạo, phê duyệt, lên lịch và chia sẻ báo cáo Marketing & Sales.
- Cấu hình workspace, chu kỳ chốt số, RBAC, tích hợp và chuẩn dữ liệu.

---

## 2. Phạm vi

### 2.1. Trong phạm vi phiên bản 1.0

| UI | Trong phạm vi |
|---|---|
| Shell KPI Hub | Sidebar 7 mục, header, notification, footer freshness, RBAC theo route |
| Dashboard | Thẻ KPI, funnel, tiến độ target, hiệu quả kênh, cảnh báo, Top Sales, bộ lọc kỳ/phạm vi |
| Dictionary | Danh sách, thẻ thống kê, drawer xem nhanh, wizard tạo/sửa 5 tab, xuất bản |
| Công thức & Logic | Loại phép tính, tử số/mẫu số, công thức nghiệp vụ, preview kỹ thuật, time rules, dependency |
| Data Source Mapping | Catalog nguồn, gắn nguồn vào KPI, join key, filter, lineage, quality preview |
| Target & Cảnh báo | Target theo kỳ/phạm vi, ngưỡng Warning/Critical, quy tắc gửi, lịch sử |
| Data Quality | Điểm chất lượng, freshness, rule check, issue drawer, gán người, tạo ticket |
| Báo cáo | Thư viện, lịch gửi, tạo nhanh, chia sẻ, phê duyệt, trạng thái gửi |
| Cài đặt | Workspace, người dùng, vai trò, chu kỳ, chuẩn dữ liệu, thông báo, tích hợp, bảo mật, sao lưu |

### 2.2. Ngoài phạm vi phiên bản 1.0

- Thay thế CRM, ERP, kế toán, Ads Manager; tự chạy chiến dịch / điều chỉnh bid.
- Data warehouse chuyên sâu (Hub tích hợp warehouse/dataflow hiện có).
- Formula builder kéo-thả tự do (v1: form có cấu trúc + expression text).
- Engine DAX thật trong Hub; DAX Preview là dialect tham chiếu. Production measure nằm semantic model / source control (mục 29.12).
- AI anomaly, gợi ý target, assistant lineage (Phase 3).
- Attribution Data-Driven, forecast nâng cao (Phase 3).
- Tính thưởng, hoa hồng, payroll từ KPI.
- Mobile native; mobile v1 chỉ đọc Dashboard/Alert.
- Xóa vật lý workspace không qua Super Admin + grace period + legal hold.

### 2.4. Nguyên tắc Source of Record

| Nghiệp vụ | Nguồn chính thức | Nguồn hỗ trợ / lookup |
|---|---|---|
| Lead, MQL, SQL, Deal, pipeline, activity Sales | CRM | SharePoint/Excel chỉ khi được phê duyệt |
| Spend, Impression, Click, platform conversion | Meta Ads / Google Ads / TikTok Ads | — |
| Invoice, Payment, chi phí tài chính, doanh thu đối soát | ERP / kế toán | CRM contract value không thay invoice |
| Campaign ID ↔ UTM | SharePoint mapping table (lookup) | Không phải source of record lead/spend |
| Website session | GA4 | — |
| First contact / call | CRM + Call Center | — |

SharePoint/Excel = `MANUAL` hoặc `LOOKUP`. Không publish KPI Active nếu nguồn chính thức bị thay bằng file mà chưa có exception của BI Admin.

### 2.3. Ranh giới với module đã có

```text
Nhóm KPI          → phân loại quản trị (Acquisition, Funnel, …)
KPI Type          → mẫu chỉ tiêu tái sử dụng khi giao KPI cá nhân/nhóm
KPI Hub Dictionary→ từ điển số liệu đã xuất bản cho Dashboard / Báo cáo / Target
KPI Assignment    → instance giao cho nhân viên (ngoài Hub v1, chỉ liên kết tùy chọn)
```

Mỗi mục Dictionary **có thể** gắn 0..1 KPI Type Active (`kpi_type_id`). Khi gắn, Hub kế thừa unit, direction, group; công thức Hub vẫn là nguồn tính Dashboard.

---

## 3. Khái niệm và phân cấp

```text
Workspace (KPI Hub)
  ├── Dictionary KPI (metric catalog)
  │     ├── Formula & Logic
  │     ├── Data Source Mapping
  │     ├── Default Target template
  │     └── Governance
  ├── Period Target (target theo kỳ + phạm vi)
  ├── Alert Rule + Alert Event
  ├── Data Source Connection
  ├── Quality Rule + Quality Issue
  └── Report + Schedule + Share
```

Ví dụ chuẩn từ mockup:

| Cấp | Giá trị |
|---|---|
| Workspace | KPI Hub — Marketing & Sales |
| Dictionary KPI | CPL Valid Lead (`MKT_006`) |
| Nhóm KPI | Media Efficiency |
| Công thức nghiệp vụ | Tổng chi tiêu quảng cáo ÷ Tổng Valid Leads |
| Tử số | `SUM(AdInsights[spend])` — Meta Ads, filter Active + VND |
| Mẫu số | `DISTINCTCOUNT(Leads[lead_id])` — CRM, Valid / không trùng / không test |
| Target kỳ 09/2026 | ≤ 150.000 VND/Lead |
| Warning / Critical | 180.000 / > 220.000 |
| Actual | 142.000 → trạng thái **Đạt** |

---

## 4. Thuật ngữ

| Thuật ngữ | Diễn giải |
|---|---|
| Metric | Đại lượng đo, chưa buộc phải có target (Raw Leads, Spend) |
| KPI | Metric then chốt: có target, kỳ, ngưỡng, owner |
| Dictionary KPI | Bản ghi từ điển (metric hoặc KPI): mã, tên, nhóm, công thức, nguồn, owner, version |
| Published / Active | Đã `Lưu & Xuất bản`; Dashboard, Target, Báo cáo, Power BI tiêu thụ |
| Draft | Bản nháp; không vào production |
| Pending Approval | Chờ BI Admin / Approver duyệt publish hoặc version mới |
| Deprecated | Không dùng mới; historical reference vẫn đọc được |
| Archived | Ẩn mặc định; không tính mới |
| Need Review | Active nhưng source/logic/DQ đổi, hoặc Type Inactive |
| KPI Owner | Chịu trách nhiệm chỉ số và target |
| Data Owner | Chịu trách nhiệm dữ liệu nguồn và chất lượng |
| Data Steward | Giám sát DQ, glossary, mapping, gán issue |
| Source of Record | Nguồn được công nhận là dữ liệu chính thức cho một nghiệp vụ |
| Grain | 1 dòng đại diện cho gì (1 lead, 1 campaign/ngày) |
| Dimension | Date, Team, Salesperson, Campaign, Channel, Product, Region, Segment |
| Semantic Layer | Lớp metric + dimension + logic dùng chung Dashboard / Báo cáo / API / BI |
| Direction | `HIGHER_IS_BETTER` / `LOWER_IS_BETTER` / `RANGE` / `NEUTRAL`. Map KPI Type: `INCREASE`→Higher, `DECREASE`→Lower, `RANGE` giữ |
| Target / Warning / Critical | Ba ngưỡng đánh giá actual theo hướng đo |
| Phạm vi (Scope) | Organization, Department, Team, Channel, Product, Campaign |
| Fresh / Delayed / Failed | Trạng thái freshness của connection |
| Lineage | Đường đi dữ liệu nguồn → mapping table → thực thể tính KPI |
| Attribution | Last-touch / First-touch / Linear (v1 mặc định Last-touch) |
| Non-additive ratio | Tỷ lệ không cộng dồn theo ngày; tính lại trên tập hợp kỳ |
| Blank-if-zero | Trả về trống (không phải 0) khi mẫu số = 0 |
| Data Owner | Vai trò/người chịu trách nhiệm định nghĩa và chất lượng KPI |
| SLA chất lượng | Hạn xử lý issue Data Quality |

---

## 5. Vai trò người dùng

| Vai trò | Quyền chính |
|---|---|
| Super Admin / System Administrator | Workspace, user, SSO, xóa/khôi phục, bypass maintenance |
| Tenant Administrator | Cấu hình workspace được gán, RBAC, tích hợp, xuất dữ liệu |
| BI Admin | Publish semantic, phê duyệt đổi formula/source/time basis, accept warning mapping, audit toàn bộ |
| Data / BI Administrator | Đồng nghĩa kỹ thuật với BI Admin khi tenant không tách role |
| Data Analyst | Draft KPI, mapping, DQ, chạy kiểm tra, tạo báo cáo |
| Data Steward | DQ, glossary, mapping, gán/resolve issue; không publish một mình |
| Performance / Marketing Ops | Dictionary draft, Target Marketing, Báo cáo |
| Marketing Manager | Dashboard/report Marketing, target scope Marketing, ack cảnh báo |
| Sales Manager | Dashboard/report Sales, target Sales, Top Sales |
| Finance Manager | KPI chi phí–doanh thu, target tài chính, duyệt report Finance |
| Head of Department / Team Lead | Dashboard + target phạm vi phòng/team |
| Executive Viewer | Dashboard, report, cảnh báo — không sửa cấu hình |
| Viewer / Report Viewer | Chỉ dashboard/report được chia sẻ |
| Approver | Phê duyệt publish KPI / report khi Settings bật |

Quyền thực tế = **role ∩ workspace ∩ department/team ∩ data domain ∩ ownership**. Role cao hơn không tự mở dữ liệu ngoài workspace/phạm vi được gán. Backend bắt buộc enforce, không chỉ ẩn nút UI.

---

## 6. Điều hướng, shell và route

### 6.1. Sidebar KPI Hub (cố định)

Thứ tự và nhãn đúng mockup:

| # | Nhãn | Route | Breadcrumb gốc |
|---|---|---|---|
| 1 | Dashboard | `/crm/kpi-hub` | Tổng quan / Dashboard |
| 2 | KPI Dictionary | `/crm/kpi-hub/dictionary` | Quản trị dữ liệu / KPI Dictionary |
| 3 | Target & Cảnh báo | `/crm/kpi-hub/targets` | Quản trị dữ liệu / Target & Cảnh báo |
| 4 | Nguồn dữ liệu | `/crm/kpi-hub/sources` | Quản trị dữ liệu / Nguồn dữ liệu |
| 5 | Data Quality | `/crm/kpi-hub/quality` | Quản trị dữ liệu / Data Quality |
| 6 | Báo cáo | `/crm/kpi-hub/reports` | Phân tích / Báo cáo |
| 7 | Cài đặt | `/crm/kpi-hub/settings` | Quản trị hệ thống / Cài đặt |

Sidebar có nút **Thu gọn**. Logo: **KPI Hub**. Mục active: nền xanh lá nhạt, chữ xanh lá.

Công thức & Logic và Data Source Mapping **không** là mục sidebar độc lập; chúng là tab của màn hình sửa Dictionary KPI:

```text
/crm/kpi-hub/dictionary/{id}/edit?tab=overview|formula|source|target|governance
```

Mục sidebar **Nguồn dữ liệu** là catalog connection toàn workspace; tab **Nguồn dữ liệu** trong editor là mapping của một KPI.

### 6.2. Header chung

- Breadcrumb theo bảng 6.1.
- Chuông thông báo (badge số chưa đọc).
- Avatar người dùng (mockup: `PTT`).
- Dashboard và Báo cáo có icon tìm kiếm toàn cục; Cài đặt có ô `Tìm kiếm toàn bộ hệ thống...`.

### 6.3. Footer freshness (Dashboard, Báo cáo; tùy chọn các trang khác)

- `Dữ liệu cập nhật: {relative hoặc Hôm nay, HH:mm}` theo timezone workspace.
- Chip nguồn tối thiểu: CRM, Meta Ads, SharePoint. Màu: Fresh = xanh, Delayed = cam, Failed = đỏ.
- Chip đi kèm text, không chỉ màu (accessibility).
- Click chip → `/crm/kpi-hub/sources` hoặc `/crm/kpi-hub/quality` tùy loại sự cố.

### 6.4. Design system

- Nền xám nhạt, card trắng, bo 8–12px, bóng nhẹ.
- Primary: emerald (~`#10B981`).
- Trạng thái: xanh Đạt/Published/Fresh; cam Warning/Delayed/Need Review; đỏ Critical/Failed; xám Draft.
- CSS prefix: `kpi-hub-*`. Tái sử dụng `DashboardShell`. Không Tailwind.
- Desktop tối thiểu 1280px; tablet xếp 1 cột.

---

## 7. Yêu cầu chức năng — Shell chung

### FR-SH-01. Không gian làm việc

Mọi API Hub bắt buộc `tenant_id` + `workspace_id`. Kiến trúc hỗ trợ **nhiều workspace / tenant**. Bản triển khai v1 tạo một workspace mặc định `KPI Hub - Marketing & Sales`; Admin được tạo thêm (ví dụ Finance riêng) khi bật flag `multi_workspace`. Người dùng chỉ thấy workspace được gán.

### FR-SH-02. Thông báo in-app

Sự kiện tạo notification: alert Critical/Warning, issue Data Quality Critical, báo cáo chờ phê duyệt, lịch gửi thất bại, connector Failed/Delayed vượt SLA, KPI Need Review.

### FR-SH-03. Unsaved changes

Editor Dictionary, Target drawer, Settings: cảnh báo khi rời trang nếu còn thay đổi chưa lưu.

### FR-SH-04. Maintenance mode

Khi Settings bật bảo trì: Viewer chỉ đọc Dashboard/Báo cáo đã publish; mọi ghi bị `503` với mã `KPI_HUB_MAINTENANCE`, trừ Super Admin.

---

## 8. UI Dashboard

**Mục đích:** Tổng quan hiệu quả Marketing & Sales theo kỳ đã chọn, so với kỳ trước, có điểm nghẽn, tiến độ target, kênh, cảnh báo và xếp hạng Sales.

**Subtitle mockup:** `Tổng quan hiệu quả Marketing & Sales`.

### 8.1. Hành động đầu trang

| Control | Hành vi |
|---|---|
| Date range | Mặc định kỳ workspace (mockup: `01–30 Tháng 09, 2026`). Preset: hôm nay, 7 ngày, tháng này, quý này, năm nay, tùy chọn |
| So sánh kỳ trước | Bật/tắt delta vs kỳ liền trước cùng độ dài |
| Xuất | Excel/PDF snapshot đúng bộ lọc đang xem |
| Tạo báo cáo | Mở wizard Báo cáo, prefill bộ lọc Dashboard |

### 8.2. Bộ lọc

- Phòng ban (mặc định Toàn bộ phòng ban)
- Kênh (Tất cả kênh)
- Sản phẩm (Tất cả sản phẩm)
- Team (Tất cả team)
- Campaign, Region/Branch, Owner/Customer segment — hiện khi dimension tồn tại trên fact
- `Đặt lại bộ lọc` trả về mặc định workspace

Bộ lọc phiên: áp dụng Dashboard, drill-down và “Tạo báo cáo” prefill. Empty filter → empty state, không đổi null thành 0.

Bộ lọc áp dụng đồng thời mọi widget. Không có dữ liệu → empty state theo widget, không bịa số.

### FR-DASH-01. Năm thẻ KPI tóm tắt

Thứ tự và kiểu thẻ đúng mockup. Tập thẻ v1 **cố định** 5 KPI sau (cấu hình được trong Settings > Chuẩn dữ liệu nếu tenant đổi mã):

| # | KPI | Mã | Cách hiển thị |
|---|---|---|---|
| 1 | Doanh thu ký mới | `SAL_008` | Currency tỷ/triệu + delta % xanh/đỏ + sparkline |
| 2 | Tổng Valid Leads | `MKT_002` | Integer + delta % |
| 3 | CPL Valid Lead | `MKT_006` | Currency + badge Đạt/thiếu so target |
| 4 | MQL Rate | `MKT_008` | % + badge thiếu so target (cam) |
| 5 | Win Rate | `SAL_007` | % + badge Nguy cấp nếu dưới Critical |

`Doanh thu ký mới` (`SAL_008`) **không** đồng nghĩa `FIN_001` (xuất hóa đơn) hay `FIN_002` (thu tiền). Card và báo cáo phải ghi đúng nhãn. Tập 5 thẻ cấu hình trong Settings > Chuẩn dữ liệu.

Mỗi thẻ:

- Tên, icon `i` tooltip = mô tả Dictionary.
- Giá trị format theo unit + decimal_places.
- Sparkline actual theo ngày trong kỳ (ẩn nếu thiếu ≥ 2 điểm).
- Click → **drill-down** (FR-DASH-08): definition, formula, source status, breakdown dimension, sample records nếu có quyền.
- Badge thêm: `NO_TARGET`, `NO_DATA`, `DATA_DELAYED`, `DATA_ISSUE` (DQ Critical / source Failed). Khi Settings bật *Data Issue precedence*: không kết luận Đạt/Nguy cấp như số đáng tin tuyệt đối — hiện `DATA_ISSUE` kèm actual mờ.

Quy tắc badge performance (đánh giá **Critical trước**, rồi Warning, rồi Đạt — cùng hàm `FR-TGT-07`):

- `LOWER_IS_BETTER`: actual > critical → Nguy cấp; else actual > warning (hoặc > target nếu không có warning) → Cảnh báo; else actual ≤ target → `Đạt target ≤ {target}`.
- `HIGHER_IS_BETTER`: actual < critical → Nguy cấp; else actual < warning (hoặc < target nếu không có warning) → Cảnh báo; else actual ≥ target → Đạt.
- Thiếu actual hoặc target → `Chưa có số`, không bịa 0.

Dữ liệu mẫu kỳ 09/2026 (fixture nghiệm thu):

| KPI | Actual | Target | Delta kỳ trước | Badge |
|---|---|---|---|---|
| Doanh thu ký mới | 1.24 tỷ đ | — | +18.6% | Trend lên |
| Tổng Valid Leads | 1.486 | — | +12.4% | Trend lên |
| CPL Valid Lead | 142.000 đ | ≤ 150.000 | — | Đạt (xanh) |
| MQL Rate | 24.8% | ≥ 30% | — | Thiếu 5.2% (cam) |
| Win Rate | 12.5% | ≥ 20% | — | Nguy cấp (đỏ) |

### FR-DASH-02. Funnel Marketing → Sales

Funnel ngang, các tầng v1:

| Tầng | KPI / metric | Fixture |
|---|---|---|
| Raw Leads | `MKT_001` | 2.340 |
| Valid Leads | `MKT_002` | 1.486 |
| MQL | `MKT_007` | 369 |
| SQL | `SAL_001` | 152 |
| Cuộc hẹn | `SAL_003` | 86 |
| Deal Won | `SAL_WON` | 19 |

BI Admin cấu hình stage, thứ tự, metric nguồn, công thức conversion (Settings > Chuẩn dữ liệu). Conversion = tổng tử / tổng mẫu tại filter hiện tại, **không** trung bình tỷ lệ ngày. Tầng conversion thấp nhất so với target (hoặc thấp nhất tuyệt đối) = **Điểm nghẽn**. Fixture: MQL Rate 24.8% (`MKT_008`).

Click tầng → Dictionary KPI tương ứng.

### FR-DASH-03. Tiến độ Target

- Donut tâm: `% Tổng thể` = trung bình `achievement_pct` có trọng số đều trên các nhóm đang hiện; fixture 68%.
- 4 bar nhóm: Acquisition, Media Efficiency, Funnel, Sales Outcome. Fixture: 92%, 95%, 71%, 46%.
- `% nhóm` = trung bình `achievement_pct` các Dictionary KPI Published thuộc nhóm, có Target trong kỳ.
- Link `Xem tất cả KPI >` → `/crm/kpi-hub/targets`.

### FR-DASH-04. Hiệu quả theo kênh

Mặc định mockup: bar Valid Leads + Revenue theo Meta Ads, Google Ads, Organic, Referral. Người có quyền chuyển metric: MQL, Deal Won, Spend, CPL, ROAS; dimension Channel / Platform / Campaign. Tooltip: giá trị, kỳ, đơn vị. Click cột → lọc Dashboard theo dimension đó.

Widget **Top Campaign** (cùng hàng hoặc tab với Top Sales): top 5 campaign theo Spend hoặc Revenue trong kỳ; ẩn nếu không quyền Ads/CRM campaign.

### FR-DASH-05. Cảnh báo cần xử lý

Tối đa 5 event mới nhất, chưa resolve, trong phạm vi bộ lọc. Thứ tự: Critical → Warning → Data Quality delay → Success (Đạt vừa xảy ra, tùy chọn).

Mỗi dòng: icon mức, tiêu đề, phạm vi (team/campaign), thời gian tương đối.

Fixture:

1. Critical — Win Rate thấp hơn ngưỡng Critical — Sales Team A — 8 phút.
2. Warning — MQL Rate chưa đạt target — Campaign BĐS Q3.
3. Info — SharePoint Mapping trễ 2 giờ — Data Quality.
4. Success — CPL Valid Lead đạt target — Marketing.

Click → Target drawer hoặc Quality issue.

### FR-DASH-06. Top Sales

Bảng hạng 1–5 trong kỳ + bộ lọc: avatar, tên, Doanh thu ký mới, Win Rate. Fixture #1: Nguyễn Minh Anh — 420 triệu — 18.7%. Chỉ hiện khi user có quyền xem dữ liệu Sales cá nhân.

### FR-DASH-07. So sánh kỳ trước

Khi bật: mọi delta % = `(kỳ này − kỳ trước) / |kỳ trước|`. Kỳ trước = đoạn liền trước cùng số ngày (mặc định). Thiếu mẫu số → ẩn delta, không hiện `0%`.

Preset thời gian đầy đủ: Today, Yesterday, This Week, Last Week, This Month, Last Month, This Quarter, Custom. Hiển thị from–to theo timezone workspace.

### FR-DASH-08. Drill-down KPI

Click card / tầng funnel / bar kênh mở panel hoặc trang:

1. Definition + version đang effective theo kỳ.
2. Business formula + tech preview.
3. Source health + DQ impact.
4. Breakdown theo dimension đang lọc (channel, team, campaign).
5. Sample records (lead_id, campaign, date, amount) theo quyền; mask PII.

### FR-DASH-09. Format hiển thị

- Null → `—`, không thành 0.
- VND: 0 decimal trên card; số lớn `1,24 tỷ ₫`; tooltip số đầy đủ.
- Percentage: 1 decimal hoặc theo `decimal_places` metric.
- Duration: phút nếu < 90 phút, else giờ + phút.

---

## 9. UI Dictionary

**Mục đích:** Chuẩn hóa định nghĩa metric Marketing, Sales, Finance. Là cổng vào editor 5 tab.

**Subtitle:** Chuẩn hóa định nghĩa KPI dùng chung cho Dashboard, Target và Báo cáo.

### FR-DICT-01. Thẻ thống kê

| Thẻ | Công thức |
|---|---|
| Tổng KPI | Mọi Dictionary KPI chưa xóa mềm |
| Đang hoạt động | `status = ACTIVE` (Published) |
| Cần rà soát | `status = NEED_REVIEW` |
| Nguồn dữ liệu | Số connection workspace `status ∈ {CONNECTED, DELAYED, FAILED}` |

Fixture: 22 / 20 / 1 / 7.

### FR-DICT-02. Thanh công cụ

- Search: tên, mã, nguồn, owner (`Tìm KPI, mã KPI, nguồn dữ liệu...`).
- Lọc: Nhóm KPI, Data Owner, Trạng thái.
- Icon lịch: lọc theo ngày cập nhật.
- `+ Tạo KPI` → `/crm/kpi-hub/dictionary/new`.

### FR-DICT-03. Bảng danh sách

| Cột | Mô tả |
|---|---|
| KPI ID | Mã, ví dụ `MKT_001`, `MKT_006`, `SAL_007` |
| Tên Metric | Tên hiển thị |
| Nhóm KPI | Badge màu: Acquisition (xanh dương), Media Efficiency (tím), Funnel (cam), Sales Outcome (xanh lá), Unit Economics (đỏ) |
| Nguồn dữ liệu | 1..n badge hệ thống (CRM, Meta Ads, SharePoint, ERP, GA4) |
| Tần suất | Daily, Hourly, Weekly, Monthly |
| Data Owner | Phòng/vai trò, ví dụ Performance MKT |
| Loại Metric | Count, Sum, Ratio, Percentage, Duration, Currency |
| Data Owner / KPI Owner | Hai cột hoặc gộp `Owner` + tooltip tách vai |
| Trạng thái | Draft, Pending Approval, Active, Need Review, Deprecated, Archived |
| Thao tác | Xem, Sửa, Nhân bản, Gửi duyệt, Xuất bản, Deprecate, Archive |

Phân trang mặc định 20; mockup hiển thị `1 đến 5 trong 22`. Sort mặc định `updated_at desc`.

### FR-DICT-04. Drawer xem nhanh

Click hàng (không phải menu) mở drawer phải. Nội dung tối thiểu với `MKT_006`:

- Tên, badge Active, mã `MKT_006`.
- Mô tả: `Chi phí trên mỗi Valid Lead từ các kênh quảng cáo trả phí.`
- Khối Công thức: phân số `Tổng chi tiêu quảng cáo / Tổng Valid Leads`.
- Badge nguồn: Meta Ads, CRM.
- Tần suất Daily; Data Owner Performance MKT + email.
- Mục tiêu: `≤ 150.000 VND` + diễn giải.
- Cập nhật lần cuối: `Hôm nay, 08:00`.
- Nút `Chỉnh sửa KPI` → editor tab Tổng quan.

### FR-DICT-05. Tạo / sửa — 5 tab

Header editor:

- Breadcrumb: `KPI Dictionary / {Tên} / Chỉnh sửa`.
- Tên + mã + badge trạng thái.
- `Lưu nháp` → Draft hoặc giữ Published nhưng chưa tạo version live.
- `Lưu & Xuất bản` → validate đủ 5 tab bắt buộc, tạo version, status Active.

Tab:

1. **Tổng quan** — tên, mã, nhóm, mô tả, unit, direction, value_type, decimal_places, data owner, tần suất, gắn `kpi_type_id` tùy chọn.
2. **Công thức & Logic** — mục 10.
3. **Nguồn dữ liệu** — mục 11.
4. **Target** — template target mặc định (không thay Period Target).
5. **Governance** — KPI Owner, Data Owner, Approver, changelog, version, `cloned_from_kpi_id`.
6. **Impact / Dependencies** — upstream/downstream, dashboard/report/API đang dùng; bắt buộc xem trước Archive.

### FR-DICT-06. Trường Tổng quan

| Mã | Bắt buộc | Quy tắc |
|---|---|---|
| `code` (`kpi_id`) | Có | 3–32; `^[A-Z]{2,5}_[A-Z0-9_]+$`; unique workspace; **immutable sau Publish**. Đổi mã → alias `display_code` hoặc KPI mới |
| `name` | Có | 3–150; unique không phân biệt hoa thường |
| `display_name` | Có khi xuất bản | Tên card Dashboard, mặc định = name |
| `kpi_group_id` | Có | Nhóm Active |
| `department_ids` | Có khi xuất bản | Marketing, Sales, Finance, Operations — multi |
| `description` | Draft: có; Publish: rich text không mơ hồ | ≤ 4000 khi rich |
| `direction` | Có | HIGHER_IS_BETTER, LOWER_IS_BETTER, RANGE, NEUTRAL |
| `value_type` / `metric_type` | Có | COUNT, SUM, AVG, RATIO, PERCENTAGE, CURRENCY, DURATION, CUSTOM |
| `unit_id` | Có | Phù hợp value_type |
| `decimal_places` | Có | 0–4 |
| `kpi_owner_id` | Có khi xuất bản | Chịu trách nhiệm KPI/target |
| `data_owner_id` | Có khi xuất bản | Chịu trách nhiệm dữ liệu |
| `refresh_cron` | Có khi AUTO | Đồng bộ time rules |
| `kpi_type_id` | Không | KPI Type Active cùng tenant |
| `calculation_mode` | Có | AUTO, MANUAL, HYBRID |

Sinh mã: prefix domain cấu hình được (`MKT_`, `SAL_`, `FIN_`, `OPS_`) + số tăng. Admin sửa prefix trong Settings.

**Publish bắt buộc thêm:** formula hợp lệ, source mapping Valid (hoặc Warning được BI Admin accept), time basis, refresh expectation, DQ pass hoặc accepted exception còn hạn.

**Sửa Active:** tạo `Pending Version`; có hiệu lực sau approve/publish. Dashboard dùng version `effective_from/to` khớp kỳ xem.

### FR-DICT-07. Nhân bản / ngừng / xóa

- Nhân bản: mã mới, Draft, `cloned_from_kpi_id`, không copy Period Target / alert / fact.
- Deprecate: lý do bắt buộc; cảnh báo downstream; không chọn cho widget mới.
- Archive: lý do + impact list (dashboard, report, API). Không hard delete nếu từng Publish hoặc còn dependency.
- Deactivate user sở hữu KPI: chặn đến khi reassign `kpi_owner_id` / `data_owner_id` / issue assignee.

### FR-DICT-08. Cần rà soát

Tự chuyển `NEED_REVIEW` khi: connector Failed, quality rule Critical trên nguồn KPI, đổi formula chưa republish, thiếu Target kỳ hiện tại nếu Settings bắt buộc target.

---

## 10. UI Công thức & Logic

**Mục đích:** Định nghĩa phép tính nghiệp vụ, thành phần tử số/mẫu số, fallback chia 0, tính chất cộng dồn, time/attribution, và đồ thị phụ thuộc.

### FR-FORM-01. Loại phép tính

| Loại | UI | Ví dụ |
|---|---|---|
| `COUNT` | Đếm record | Raw rows (cấm mặc định nếu entity trùng) |
| `DISTINCT_COUNT` | Đếm unique key bắt buộc | Valid Leads theo `lead_id` |
| `SUM` / `AVG` / `MIN` / `MAX` | Một trường số | Spend, Avg Deal, First Response |
| `RATIO` | Tử / mẫu | CPL, CAC |
| `PERCENTAGE` | Ratio format % | MQL Rate, Win Rate |
| `WEIGHTED_RATIO` | Tử, mẫu, trọng số | Weighted pipeline |
| `DURATION` | timestamp_end − timestamp_start | Lead Response Time |
| `COMPOSITE` / `CUSTOM` | Expression allowlist | Metric ghép |
| `MANUAL` | Nhập tay + audit | Override |

Count Lead/Deal/Customer **bắt buộc unique key**. Không mặc định `COUNT(*)`.

Fixture `MKT_006`: `RATIO`.

### FR-FORM-02. Thành phần tử số / mẫu số (RATIO)

Mỗi thành phần là card:

- Chọn Dictionary KPI đầu vào **hoặc** metric thô từ nguồn.
- Field mapping kỹ thuật, ví dụ `SUM(AdInsights[Spend])`.
- Điều kiện lọc dạng chip; editor filter: field, operator, value, nhóm AND/OR.
- Operator tối thiểu: equals, not equals, in, not in, is null, is not null, >, <, contains, between, true/false.
- Filter có version; **Test preview** số dòng khớp trước khi lưu.
- Icon sửa. Cảnh báo nếu dependency Deprecated / Archived / Failed.

Fixture:

| Vai trò | KPI | Mapping | Filter |
|---|---|---|---|
| Tử số | Tổng chi tiêu quảng cáo `MKT_004` | `SUM(AdInsights[Spend])` | `Status = Active`, `Currency = VND` |
| Mẫu số | Tổng Valid Leads `MKT_002` | `DISTINCTCOUNT(Leads[Lead_ID])` | `Is_Valid = TRUE`, `Is_Duplicate = FALSE`, `Is_Test = FALSE` |

Cấm cycle dependency (A dùng B, B dùng A). Validate khi lưu.

### FR-FORM-03. Công thức nghiệp vụ và preview kỹ thuật

- Ô xanh: `CPL Valid Lead = Tổng chi tiêu quảng cáo ÷ Tổng Valid Leads`.
- Khối code (nền tối): preview kỹ thuật, v1 dialect nội bộ hiển thị dạng DAX-like:

```text
DIVIDE([Tổng chi tiêu quảng cáo], [Tổng Valid Leads])
```

- Nút Copy. Preview **không** thực thi trên Power BI; engine Hub compile AST → SQL/connector.

### FR-FORM-04. Toggle tính toán

| Toggle | Mặc định Ratio | Hành vi |
|---|---|---|
| Trả về BLANK khi mẫu số = 0 | Bật | Tùy chọn: BLANK / 0 / custom fallback |
| Không cộng dồn tỷ lệ theo ngày | Bật | `sum(num)/sum(den)` trên kỳ; cấm AVG các tỷ lệ ngày trừ weighted |
| Cho phép nhập thủ công | Tắt | HYBRID + audit override |
| Null input | Bỏ qua | Bỏ qua / coi 0 / No Data — theo metric |

Division/overflow: log kỹ thuật, `calculation_status=Failed` trên fact, không làm sập Dashboard.

### FR-FORM-05. Quy tắc thời gian (cột phải)

| Trường | Fixture | Ghi chú |
|---|---|---|
| Time basis | Ngày tạo Valid Lead | Field ngày dùng để cắt kỳ |
| Timezone | Asia/Ho_Chi_Minh (UTC+7) | Mặc định workspace |
| Attribution | Last-touch | Bắt buộc với KPI Ads+CRM/Revenue: First / Last / Linear / Position / Manual Mapping. Data-Driven = Phase 3. Window (ngày) lưu cùng version. Chưa chọn → không publish KPI yêu cầu attribution |
| Calendar | Workspace | Calendar dương + fiscal nếu Settings có `fiscal_year_start` |
| Refresh | Daily • 08:00 | Cron |

### FR-FORM-06. Kiểm tra logic

Checklist live:

| Mục | Pass khi |
|---|---|
| Có nguồn dữ liệu | ≥ 1 source Connected hoặc Delayed |
| Có trường thời gian | Time basis map được field date |
| Đã khai báo đơn vị | `unit_id` có giá trị |
| Đã cấu hình Target | Có default target **hoặc** Period Target kỳ hiện tại |

Thiếu → icon vàng, không chặn Lưu nháp; chặn Xuất bản nếu Settings bắt buộc.

### FR-FORM-07. KPI phụ thuộc

- Đầu vào (upstream): fixture `MKT_004`, `MKT_002`.
- Đầu ra (downstream): fixture `MKT_009` ROAS, `FIN_003` CAC.
- Click mã → editor KPI đó.
- Khi unpublish/ngừng upstream: downstream → Need Review.

### FR-FORM-08. Aggregation được phép

`COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `DISTINCTCOUNT`, `DIVIDE`. Expression v1: số, ngoặc, `+ - * /`, tham chiếu `[KPI_CODE]` hoặc thành phần đã đặt tên. Cấm subquery tự do, không gọi HTTP, không đọc secret.

---

## 11. UI Data Source Mapping

Gồm 2 bề mặt: **catalog workspace** (`/sources`) và **tab mapping KPI**.

### 11.1. Catalog Nguồn dữ liệu

### FR-SRC-01. Danh sách connection

Cột: Hệ thống, Connection/Workspace, Bảng/List mặc định, Refresh, Freshness, Trạng thái, Thao tác.

Hệ thống v1: CRM, Meta Ads, Google Ads, GA4, SharePoint, ERP. Google Ads có thể `UNAVAILABLE` nếu chưa bật connector.

Thao tác: Kết nối, Ngắt, Refresh thủ công, Xem Quality.

### FR-SRC-02. Trạng thái connection

| Trạng thái | Điều kiện |
|---|---|
| `CONNECTED` / Fresh | Lần sync thành công trong hạn SLA nguồn |
| `DELAYED` | Sync thành công nhưng trễ hơn SLA (SharePoint fixture: 2h15) |
| `FAILED` | Lỗi refresh (ERP fixture: lỗi 08:10) |
| `DISCONNECTED` | Chưa gắn credential |

Không trả secret ra API.

### 11.2. Tab mapping trên Dictionary KPI

### FR-MAP-01. Danh sách nguồn của KPI

Nút `+ Thêm nguồn dữ liệu`. Cột: #, Hệ thống, Connection/Workspace, Bảng/List, Vai trò, Refresh, Trạng thái, Thao tác.

Vai trò: `NUMERATOR`, `DENOMINATOR`, `LOOKUP`, `PRIMARY`, `FILTER`, `DIMENSION`, `ATTRIBUTION`, `VALIDATION`.

Mỗi connection catalog thêm: `source_of_record_level` (`OFFICIAL` / `SUPPORTING` / `MANUAL_LOOKUP`), `connection_type` (Native, API, SQL, Dataflow, File), owner, grain mặc định.

Fixture `MKT_006`:

| Hệ thống | Bảng | Vai trò | Refresh | Trạng thái |
|---|---|---|---|---|
| Meta Ads | Ad Insights | Numerator | Daily | Connected |
| CRM | Leads | Denominator | Hourly | Connected |
| SharePoint | Campaign Mapping | Lookup | Daily | Delayed |

### FR-MAP-02. Card mapping chi tiết

**Meta Ads — Ad Insights — Numerator**

- Khóa liên kết: `campaign_id`, `date`.
- Trường giá trị: `spend` + `SUM`.
- Filter: `status = Active`, `currency = VND`.
- Preview: `SUM(AdInsights[spend])`.

**CRM — Leads — Denominator**

- Khóa liên kết: `utm_campaign`, `created_date`, `lead_id`.
- Trường đếm: `lead_id` + `DISTINCTCOUNT`.
- Filter: `is_valid = TRUE`, `is_duplicate = FALSE`, `is_test = FALSE`.
- Preview: `DISTINCTCOUNT(Leads[lead_id])`.

### FR-MAP-03. Quy tắc mapping (cột phải)

| Trường | Fixture |
|---|---|
| Chiến lược liên kết | Campaign + Date |
| Visual map | `Meta Ads.campaign_id` → `CRM.utm_campaign` |
| Khớp ngày | Cùng ngày |
| Chuẩn hóa UTM trước khi join | Bật |
| Áp dụng mapping table | Bật (SharePoint Campaign Mapping) |

Khớp ngày v1: `SAME_DAY`, `DATE_RANGE`, `ATTRIBUTION_WINDOW` (mặc định 7 ngày).

Join: Inner / Left (Right/Full nếu engine hỗ trợ). Cardinality: 1-1, 1-n, n-1; n-n bắt buộc bridge + cảnh báo **row multiplication**.

Validate trước publish:

- Kiểu: SUM chỉ numeric; date field là timestamp; count key tồn tại.
- Profile field nếu connector có: sample, null rate, distinct count, min/max date.
- Đếm unmapped, duplicate key, ước lượng nở dòng.
- Mapping `Error` → chặn publish. `Warning` → BI Admin accept kèm lý do + expiry.

Lineage đầy đủ: Source → Entity → Mapping → Formula part → KPI → Dashboard/Report downstream.

### FR-MAP-04. Data lineage

Sơ đồ: `Meta Ads (Ad Insights) → Campaign Mapping (SharePoint) → CRM Leads (Leads)`.

Nút mỗi node → connection hoặc Quality.

### FR-MAP-05. Quality preview trên mapping

- % chất lượng mapping (fixture 96%).
- Pass: Valid join keys; No missing mandatory fields.
- Warning: `12 campaign chưa được mapping`.
- Nút `Mở Data Quality` → Quality lọc theo nguồn/KPI.

### FR-MAP-06. Chuẩn hóa UTM

Khi bật: trim, lower-case, bỏ `utm_` thừa, map alias từ mapping table. Join chỉ sau bước này.

---

## 12. UI Target và cảnh báo

**Mục đích:** Thiết lập mục tiêu, ngưỡng đánh giá và người nhận cảnh báo theo kỳ + phạm vi.

**Subtitle:** `Thiết lập mục tiêu, ngưỡng đánh giá và người nhận cảnh báo KPI`.

### FR-TGT-01. Hành động

- `+ Thiết lập Target` — tạo Period Target (KPI + kỳ + scope). Hỗ trợ import XLSX/CSV: template, preview lỗi từng dòng, confirm trước commit.
- `Quy tắc cảnh báo` — danh sách/sửa Alert Rule độc lập (mở modal hoặc trang con).

### FR-TGT-02. Thẻ thống kê (theo kỳ đang lọc)

| Thẻ | Fixture 09/2026 | Công thức |
|---|---|---|
| KPI có Target | 18/22 (82%) | Số Published có Period Target / tổng Published |
| Đạt Target | 12 (66%) | Status ACHIEVED / số có target |
| Cảnh báo | 4 (22%) | Status WARNING |
| Nguy cấp | 2 (11%) | Status CRITICAL |

### FR-TGT-03. Bộ lọc

Search KPI/mã; date = tháng (fixture Tháng 09/2026); Phòng ban; Team; KPI Group; toggle `Chỉ xem cần xử lý` = WARNING + CRITICAL + missing actual.

### FR-TGT-04. Bảng Target theo kỳ

| Cột | Mô tả |
|---|---|
| KPI | Tên + mã |
| Phạm vi áp dụng | Marketing toàn bộ, Sales Team A, … |
| Actual | Giá trị kỳ, format unit |
| Target | Kèm toán tử ≤ / ≥ |
| Warning | Ngưỡng cảnh báo |
| Critical | Ngưỡng nguy cấp |
| Xu hướng | Sparkline |
| Trạng thái | Đạt / Cảnh báo / Nguy cấp / Chưa có số |
| Thao tác | Sửa, lịch sử, tắt cảnh báo |

Fixture:

| KPI | Scope | Actual | Target | Warning | Critical | Status |
|---|---|---|---|---|---|---|
| CPL Valid Lead | Marketing toàn bộ | 142.000đ | ≤ 150.000 | 180.000 | > 220.000 | Đạt |
| MQL Rate | — | 24.8% | ≥ 30% | — | — | Cảnh báo |
| Win Rate | — | 12.5% | ≥ 20% | — | — | Nguy cấp |
| Lead Response Time | — | 18 phút | ≤ 15 phút | — | — | Cảnh báo |

### FR-TGT-05. Drawer cấu hình Target

Tab **Target** / **Lịch sử**.

Trường:

| Trường | Fixture CPL |
|---|---|
| Direction | Lower is better (khóa theo Dictionary, chỉ Super Admin override) |
| Kỳ áp dụng | 09/2026 |
| Phạm vi | tag Marketing |
| Target | ≤ 150.000 |
| Warning | 180.000 |
| Critical | > 220.000 |
| Unit | VND / Lead |

Gauge ngang: xanh → vàng → đỏ, đánh dấu actual 142.000 trên đoạn xanh.

**Hierarchy / override:** Campaign hoặc User > Team > Department > Workspace. Cùng mức → version/published mới hơn. UI hiện target đang áp dụng và lý do chọn. Không hai target Active trùng hoàn toàn KPI+scope+period.

**Direction thêm `NEUTRAL`:** so sánh số, không tô Đạt/Không đạt.

**Unit:** Target, warning, critical, actual cùng unit/scale. Chặn target `%` cho KPI currency.

**Forecast (P2):** linear hoặc import; nhãn `Forecast`; không thay Actual; có thể tạo proactive alert nếu lệch target.

Kỳ: Daily, Weekly, Monthly, Quarterly, Yearly, custom `effective_from/to`.

Tab Lịch sử: ai đổi ngưỡng, giá trị cũ/mới, thời điểm.

### FR-TGT-06. Cảnh báo tự động

| Trường | Fixture |
|---|---|
| Bật cảnh báo | On |
| Điều kiện | KPI vượt Warning |
| Tần suất | Mỗi 4 giờ |
| Người nhận | Marketing Manager, Performance Lead, Data Analyst |
| Kênh | Email, Microsoft Teams |

Điều kiện v1: `ENTER_WARNING`, `ENTER_CRITICAL`, `MISS_TARGET_AFTER_MILESTONE`, `DELTA_VS_PREV` (giảm/tăng X%), `SOURCE_DELAYED`, `DQ_SCORE_BELOW`, `MISSING_ACTUAL`, `BACK_TO_ACHIEVED` (recovery, optional).

Vòng đời alert: `OPEN` → `ACK` → `IN_PROGRESS` → `SNOOZED` | `RESOLVED` | `CLOSED` | `DISMISSED`. Có assignee, SLA, comment, resolution note. Critical: bắt buộc assignee hoặc escalate quá SLA.

Dedup: một `(rule, kpi, scope, period, condition)` / cửa sổ; **vẫn gửi** nếu severity tăng. Quiet hours theo Settings.

Kênh: In-app, Email, Teams; Slack/Webhook khi tích hợp.

`DATA_ISSUE` (source Failed hoặc DQ Critical) ưu tiên hơn kết luận performance khi workspace bật precedence.

`Hủy` / `Lưu Target`. Optimistic lock `row_version`.

### FR-TGT-07. Tính trạng thái

Hàm một nguồn, unit test bắt buộc:

```text
LOWER_IS_BETTER (critical > warning > target; càng thấp càng tốt):
  actual > critical                         → CRITICAL
  else actual > warning                     → WARNING
  else actual > target                      → WARNING   (khi không khai báo warning)
  else                                      → ACHIEVED

HIGHER_IS_BETTER (critical < warning < target; càng cao càng tốt):
  actual < critical                         → CRITICAL
  else actual < warning                     → WARNING
  else actual < target                      → WARNING   (khi không khai báo warning)
  else                                      → ACHIEVED

RANGE:
  trong [low, high]                         → ACHIEVED
  ngoài range, chưa vượt biên critical      → WARNING
  ngoài biên critical                       → CRITICAL

NEUTRAL:
  luôn NO_STATUS (chỉ hiện actual vs target, không RAG)
```

Thiếu actual → `NO_DATA` (không gửi ENTER_CRITICAL).

`achievement_pct` (donut Dashboard):

- Higher: `min(100, 100 * actual/target)` khi target ≠ 0.
- Lower: `min(100, 100 * target / max(actual, ε))`.
- Range: 100 nếu trong biên, else suy giảm tuyến tính ra ngoài.

---

## 13. UI Data Quality

**Mục đích:** Giám sát completeness, accuracy, consistency, uniqueness, freshness của dữ liệu KPI.

**Subtitle:** Monitoring the completeness, accuracy, consistency, and freshness of KPI data.  
**Breadcrumb:** Quản trị dữ liệu / Data Quality.

### FR-DQ-01. Hành động

- `Xuất báo cáo` — snapshot Quality (Excel) hoặc tạo Báo cáo loại Data Quality.
- `Chạy kiểm tra` — enqueue chạy rule theo filter hiện tại; disable khi job đang chạy.

### FR-DQ-02. Thẻ

| Thẻ | Fixture | Công thức |
|---|---|---|
| Điểm chất lượng tổng | 92/100 | Gauge tròn; weighted score |
| Nguồn ổn định | 5/7 | Fresh hoặc Connected trong SLA |
| Cảnh báo | 3 | Issue OPEN mức WARNING |
| Lỗi nghiêm trọng | 1 | Issue OPEN mức CRITICAL |

Điểm: mỗi rule pass = 100, warning = 70, critical/fail = 0; trung bình có trọng số theo mức rule. Target mặc định ≥ 90 (Settings).

### FR-DQ-03. Xu hướng chất lượng

Line chart Quality Score theo ngày (fixture 22/08–04/09/2026, ~75 → 92). Đường đứt cam `Target ≥ 90`.

### FR-DQ-04. Data Freshness

Mỗi nguồn: tên, badge Fresh/Delayed/Failed, thời gian tương đối hoặc `trễ 2h 15m` / `lỗi lúc 08:10`, icon refresh thủ công.

Fixture:

| Nguồn | Status | Chi tiết |
|---|---|---|
| CRM Leads | Fresh | 5 phút trước |
| Meta Ads Insights | Fresh | 42 phút trước |
| SharePoint Campaign Mapping | Delayed | trễ 2h 15m |
| ERP Invoices | Failed | lỗi 08:10 |

Refresh thủ công yêu cầu quyền `crm_kpi_quality` manage hoặc `crm_kpi_sources` configure.

### FR-DQ-05. Bảng kết quả kiểm tra

Tabs đếm: Tất cả (14), Nghiêm trọng (1), Cảnh báo (3), Đã đạt (10).

Search rule/bảng; lọc Data Source, Check Type, Status.

Cột: #, Tên rule, Nguồn, Loại, Kết quả (% + số lỗi), Mức, Lần chạy gần nhất, Xem.

Loại v1: `COMPLETENESS`, `UNIQUENESS`, `CONSISTENCY`, `FRESHNESS`, `ACCURACY`, `VALIDITY`, `REFERENTIAL`.

Rule có: `affected_kpi_ids`, threshold pass/warning/critical, owner, schedule. Score 0–100 có trọng số; **coverage** = số rule Active / rule bắt buộc theo nguồn — không suy diễn điểm nếu coverage thấp, UI ghi rõ.

Freshness: từ last success refresh **hoặc** latest record timestamp (cấu hình nguồn). SLA mẫu: CRM ≤ 60 phút, Meta Ads ≤ 4 giờ, ERP ≤ 24 giờ.

Issue auto-create từ Critical/Warning. BI Admin **accepted risk** kèm expiry + justification; hết hạn → Need Review.

Dashboard/KPI detail hiện impact Informational / Warning / Critical theo DQ.

Fixture rule Critical: `Lead_ID không được trống` — CRM/Leads — Completeness — 99.8% — 12 bản ghi lỗi.

### FR-DQ-06. Drawer issue

- Badge Critical + tên rule.
- Nguồn: CRM > Leads.
- Mô tả: 12 bản ghi thiếu Lead_ID.
- Status: Open / In Progress / Resolved / Won't Fix.
- Assignee: Data Analyst.
- SLA: Fix before 17:00 hôm nay (tính từ severity + Settings).
- Bảng mẫu bản ghi ảnh hưởng: Ngày tạo, Source, Campaign/UTM, Ghi chú. Tối đa 20 dòng; không trả PII ngoài field được phép.
- Quy tắc: `Lead_ID IS NOT NULL` + Copy.
- `Gán người xử lý`, `Tạo ticket` (IWR/CSD nếu tenant bật; không thì ticket nội bộ Hub).

### FR-DQ-07. Rule mặc định v1

| Rule | Nguồn | Loại | Mức mặc định |
|---|---|---|---|
| Lead_ID không được trống | CRM Leads | Completeness | Critical |
| Lead không trùng theo phone+campaign+ngày | CRM Leads | Uniqueness | Warning |
| is_valid ∈ {true,false} | CRM Leads | Validity | Warning |
| campaign_id map được UTM | SharePoint | Consistency | Warning |
| Spend ≥ 0 | Meta Ads | Accuracy | Critical |
| Sync không trễ quá SLA | Mọi nguồn | Freshness | Warning / Critical theo Settings |

---

## 14. UI Báo cáo

**Mục đích:** Tạo, quản lý, phê duyệt, lên lịch và chia sẻ báo cáo Marketing & Sales.

**Subtitle:** `Tạo, quản lý và chia sẻ báo cáo hiệu quả Marketing & Sales`.

### FR-RPT-01. Hành động

- `Thư viện mẫu` — Performance, Funnel, Sales, Revenue/Finance, Campaign, Data Quality, Custom.
- `Lịch gửi báo cáo` — danh sách schedule.
- `+ Tạo báo cáo` — wizard.

### FR-RPT-02. Thẻ

| Thẻ | Fixture |
|---|---|
| Báo cáo của tôi | 12 |
| Đã lên lịch | 6 |
| Chờ phê duyệt | 2 |
| Đã gửi tháng này | 28 |

### FR-RPT-03. Tabs và lọc

Tabs: Tất cả, Của tôi, Đã chia sẻ, Lịch gửi.

Search: tên, người tạo. Lọc: Loại, Phòng ban, Trạng thái. Sort: Cập nhật gần nhất.

### FR-RPT-04. Bảng báo cáo gần đây

Cột: Tên (+ icon loại), Loại (badge Performance / Funnel / Sales / Data Quality / Custom), Phạm vi, Người tạo (avatar), Cập nhật, Trạng thái, menu.

Trạng thái: `DRAFT` Bản nháp, `PENDING_APPROVAL` Chờ phê duyệt, `PUBLISHED` Đã xuất bản, `SENT` Đã gửi, `FAILED` Gửi lỗi.

Phân trang: `Hiển thị 1 đến 5 trong tổng số 12 báo cáo`.

Menu: Xem, Sửa, Nhân bản, Chia sẻ, Lên lịch, Gửi ngay, Rút xuất bản, Xóa nháp.

### FR-RPT-05. Cột phải

**Tạo báo cáo nhanh** — 4 thẻ: Hiệu quả Marketing, Funnel Marketing → Sales, Hiệu quả Sales, Data Quality. Prefill type + widget mặc định từ Dashboard.

**Lịch gửi tiếp theo** — ví dụ `Báo cáo tuần Marketing — Thứ Hai, 08:00` / Email — Marketing Team. Link `Xem tất cả`.

**Chia sẻ gần đây** — ai chia sẻ/xem, team, thời điểm.

### FR-RPT-06. Wizard tạo báo cáo v1

1. Chọn mẫu hoặc trống.
2. Tên, loại, phạm vi, kỳ (động theo schedule hoặc cố định).
3. Chọn widget/KPI từ Dictionary Published.
4. Người xem + kênh (Email, Teams).
5. Có cần phê duyệt (theo Settings).
6. Lưu nháp / Xuất bản / Lên lịch.

Widget builder v1: KPI card, table, line, bar, funnel, target progress, text, DQ widget. Mỗi widget: metric Published, dimension, sort, filter, format.

Published = snapshot config; sửa tạo revision. Dữ liệu runtime hoặc cache theo policy.

Share: user, team, role, department; quyền View / Comment / Edit / Manage Share. Public link (token + expiry + optional password) chỉ khi Settings cho phép.

Export PDF, XLSX, CSV, PNG: luôn kèm tên, filter, generated_at, freshness, version, workspace. Async + progress khi vượt ngưỡng. Mask PII theo quyền.

Delivery log: success/fail, recipients, delivered/read nếu kênh hỗ trợ; retry có kiểm soát.

Báo cáo xuất bản chỉ đọc snapshot KPI Published tại thời điểm generate. Không tính KPI Draft. Report Finance có thể bắt buộc Finance Manager approve trước Send.

### FR-RPT-07. Lịch gửi

Cron: Daily / Weekly (Thứ Hai 08:00) / Monthly (ngày chốt workspace). Timezone workspace. Nếu nguồn Delayed: vẫn gửi kèm banner freshness; nếu Failed trên KPI bắt buộc của báo cáo: status FAILED, notification, không gửi số bịa.

---

## 15. UI Cài đặt

**Mục đích:** Cấu hình workspace, người dùng, quyền, chu kỳ, chuẩn dữ liệu, thông báo, tích hợp, bảo mật, sao lưu.

**Subtitle:** `Cấu hình không gian làm việc, người dùng, quyền truy cập và tiêu chuẩn dữ liệu.`

### FR-SET-01. Mục con

| Mục | Nội dung v1 |
|---|---|
| Không gian làm việc | Mục 15.1 — mặc định mở |
| Người dùng & Phân quyền | Gán user vào workspace + capability Hub |
| Vai trò & Quyền | Map role → section Hub |
| Chu kỳ KPI | Preset kỳ, ngày chốt, khóa kỳ |
| Chuẩn dữ liệu | KPI thẻ Dashboard, funnel stages, nhóm màu, SLA freshness, glossary, lead lifecycle, pipeline stage, channel taxonomy, UTM convention, phone normalize. Đổi chuẩn → impact review KPI Active |
| Thông báo | Kênh mặc định, quiet hours |
| Tích hợp | Trang quản lý connection (deep-link Sources) |
| Bảo mật | Session, IP allowlist tùy chọn, phê duyệt sửa KPI |
| Sao lưu & Xuất dữ liệu | Export workspace JSON/Excel |

Nút trang: `Nhật ký hoạt động`, `Lưu thay đổi`.

### 15.1. Không gian làm việc

**Thông tin tổ chức**

| Trường | Fixture | Quy tắc |
|---|---|---|
| Logo | KH + Thay đổi logo | PNG/SVG, ≤ 1 MB, 256×256 gợi ý |
| Tên workspace | KPI Hub - Marketing & Sales | 3–80 |
| Tên công ty | PTT Digital | 2–120 |
| Timezone | Asia/Ho_Chi_Minh (UTC+7) | IANA |
| Ngôn ngữ | Tiếng Việt | vi, en |
| Currency | VND | Base VND. Đa tiền tệ: lưu `original_currency`, `original_amount`, `fx_rate`, `fx_rate_date`, `base_amount` |
| Ngày bắt đầu tuần | Thứ Hai | Monday/Sunday |
| Fiscal year start | Tháng 01 | Dùng cho Quý/Năm tài chính |

**Chu kỳ báo cáo mặc định**

- Chip: Ngày / Tuần / **Tháng** / Quý / Năm.
- Ngày chốt số: fixture Ngày 03 hàng tháng.
- Hạn đối soát: fixture Ngày 05 hàng tháng (khớp rule cập nhật đúng hạn cockpit nhân viên).
- Toggle: Tự khóa kỳ đã chốt — bật.
- Toggle: Cho phép yêu cầu mở lại kỳ — bật.

Kỳ khóa: không sửa actual AUTO, không đổi Period Target; chỉ Super Admin hoặc Approver mở lại (ghi audit).

**Vùng nguy hiểm**

- `Xuất dữ liệu Workspace` — export cấu hình + catalog, không gồm secret.
- `Yêu cầu xóa Workspace` — confirmation phrase + số object + grace period. Chặn nếu legal hold/retention. Không xóa ngay.

### FR-SET-02. Tình trạng hệ thống (cột phải)

- Tổng: Hoạt động bình thường (xanh) nếu không có Failed và Critical Quality.
- CRM, Meta Ads, GA4, SharePoint, ERP — Connected / Delayed / Failed.
- `Quản lý tích hợp` → Tích hợp / Sources.

### FR-SET-03. Thiết lập nhanh

| Toggle | Fixture | Hiệu ứng |
|---|---|---|
| Bật Data Quality tự động | On | Cron chạy rule sau mỗi sync |
| Gửi cảnh báo KPI | On | Master switch Alert |
| Bắt buộc phê duyệt khi sửa KPI | On | Xuất bản cần Approver |
| Chế độ bảo trì | Off | FR-SH-04 |

### FR-SET-04. Người dùng, vai trò, bảo mật

- Tái sử dụng RBAC `staff-permissions`; thêm section Hub (mục 20).
- Không nhân đôi user store.
- Nhật ký: lọc theo actor, entity, từ ngày.

---

## 16. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | Mọi bản ghi Hub cô lập `tenant_id` + `workspace_id` |
| BR-02 | Dashboard live chỉ đọc Dictionary `ACTIVE` (Published) |
| BR-03 | `Lưu & Xuất bản` bắt buộc: Tổng quan đủ field, formula hợp lệ, ≥ 1 nguồn nếu AUTO, unit, time field |
| BR-04 | Sửa formula/unit/direction/mapping của KPI Published tạo version mới; actual đã chốt giữ `kpi_version_id` cũ |
| BR-05 | Cấm dependency cycle |
| BR-06 | Ratio non-additive: tính trên tập hợp kỳ, không trung bình các tỷ lệ ngày |
| BR-07 | Mẫu số = 0 + blank-if-zero → actual NULL, không 0 |
| BR-08 | Connector lỗi → không ghi actual giả; badge Data Health |
| BR-09 | Period Target unique `(kpi_id, period, scope_hash)` |
| BR-10 | Direction Period Target phải khớp Dictionary trừ override có audit |
| BR-11 | Tắt master “Gửi cảnh báo KPI” → không gửi Email/Teams (vẫn ghi event in-app tùy cấu hình) |
| BR-12 | Campaign chưa map không bịa join; Quality warning; KPI vẫn tính trên phần đã map |
| BR-13 | Báo cáo SENT lưu snapshot; sửa Dictionary sau đó không đổi file đã gửi |
| BR-14 | Kỳ khóa: chặn PATCH target/actual AUTO |
| BR-15 | Optimistic lock mọi PATCH qua `If-Match` / `row_version` → 409 |
| BR-16 | KPI đã Publish hoặc còn dependency: không hard delete; Deprecate/Archive |
| BR-17 | Viewer không thấy PII trong sample Quality ngoài field allowlist |
| BR-18 | Secret connector không vào JSON API, export, audit value, log |
| BR-19 | Maintenance: chỉ Super Admin ghi |
| BR-20 | Gắn `kpi_type_id` không bắt buộc; Type Inactive → Dictionary Need Review |
| BR-21 | Một KPI chỉ một version Active tại một thời điểm hiệu lực trong workspace |
| BR-22 | Target/warning/critical/actual cùng unit; chặn lệch % vs currency |
| BR-23 | Count Lead/Deal/Customer bắt buộc unique key; không mặc định COUNT(*) |
| BR-24 | Đổi time basis / unit / direction / filter logic / source của Active → version + approval |
| BR-25 | `SAL_008` / `FIN_001` / `FIN_002` là ba metric; cấm nhãn chung “Doanh thu” |
| BR-26 | Lead lifecycle và Deal stage chỉ dùng taxonomy Settings; map status nguồn qua bảng semantic |
| BR-27 | Source Failed hoặc DQ Critical → UI `DATA_ISSUE`; không trình bày như số chắc chắn |
| BR-28 | Deactivate user: reassign owner/assignee trước khi khóa |
| BR-29 | Audit: create/update/delete/publish/archive/approve/reject/refresh/export/share/đổi quyền — actor, entity, before/after, timestamp, workspace, IP nếu có |
| BR-30 | Thời gian lưu UTC; hiển thị/cắt kỳ theo timezone workspace |

---

## 17. Validation và mã lỗi

| Mã | Điều kiện | Thông báo |
|---|---|---|
| `KPI_HUB_CODE_INVALID` | Sai format mã | Mã KPI phải dạng PREFIX_TEN, ví dụ MKT_006 |
| `KPI_HUB_CODE_DUPLICATE` | Trùng mã | Mã KPI đã tồn tại trong workspace |
| `KPI_HUB_NAME_DUPLICATE` | Trùng tên | Tên KPI đã tồn tại |
| `KPI_HUB_PUBLISH_INCOMPLETE` | Thiếu field bắt buộc | Chưa đủ điều kiện xuất bản. Kiểm tra checklist |
| `KPI_HUB_FORMULA_CYCLE` | Cycle | Công thức tạo vòng phụ thuộc |
| `KPI_HUB_FORMULA_INVALID` | AST lỗi | Công thức không hợp lệ |
| `KPI_HUB_DIVIDE_NO_FALLBACK` | Ratio thiếu blank/zero policy | Chọn cách xử lý khi mẫu số = 0 |
| `KPI_HUB_SOURCE_REQUIRED` | AUTO thiếu nguồn | Thêm ít nhất một nguồn dữ liệu |
| `KPI_HUB_JOIN_KEY_MISSING` | Thiếu join key | Khai báo khóa liên kết |
| `KPI_HUB_TARGET_ORDER` | Ngưỡng sai hướng | Kiểm tra thứ tự Target / Warning / Critical theo hướng đo |
| `KPI_HUB_TARGET_DUP` | Trùng kỳ+scope | Đã có Target cho KPI, kỳ và phạm vi này |
| `KPI_HUB_PERIOD_LOCKED` | Kỳ khóa | Kỳ đã chốt. Gửi yêu cầu mở lại |
| `KPI_HUB_VERSION_CONFLICT` | row_version | Dữ liệu đã được cập nhật. Tải lại và thử lại |
| `KPI_HUB_FORBIDDEN` | RBAC | Không có quyền thực hiện thao tác này |
| `KPI_HUB_MAINTENANCE` | Bảo trì | Workspace đang bảo trì |
| `KPI_HUB_DELETE_REFERENCED` | Còn tham chiếu | Không thể xóa. Hãy ngừng sử dụng |
| `KPI_HUB_QUALITY_RUNNING` | Job đang chạy | Đang chạy kiểm tra. Thử lại sau |
| `KPI_HUB_REPORT_SOURCE_FAILED` | Gửi khi Failed | Không gửi được: nguồn bắt buộc đang lỗi |

---

## 18. Luồng nghiệp vụ chính

### 18.1. Xuất bản KPI mới (CPL Valid Lead)

1. Ops vào Dictionary → `+ Tạo KPI`.
2. Tab Tổng quan: mã `MKT_006`, nhóm Media Efficiency, unit VND/Lead, Lower is better.
3. Tab Công thức: Ratio, tử số `MKT_004`, mẫu số `MKT_002`, bật blank-if-zero và non-additive.
4. Tab Nguồn: Meta Ads Numerator, CRM Denominator, SharePoint Lookup; chiến lược Campaign + Date.
5. Tab Target: default ≤ 150.000 / warn 180.000 / critical 220.000.
6. Tab Governance: Approver nếu Settings bật duyệt.
7. `Lưu nháp` bất kỳ lúc nào.
8. `Lưu & Xuất bản` → validate → version 1 → Active.
9. Dashboard và Target kỳ hiện tại đọc được actual sau sync.

### 18.2. Đặt Target tháng và cảnh báo

1. Mở Target & Cảnh báo, kỳ 09/2026.
2. Chọn hàng CPL hoặc `+ Thiết lập Target`.
3. Nhập ngưỡng, bật cảnh báo, chọn Email + Teams, tần suất 4 giờ.
4. Lưu. Hệ thống tính status từ actual.
5. Khi actual vượt Warning: tạo event, gửi kênh, hiện Dashboard widget.

### 18.3. Xử lý Data Quality Critical

1. Quality: 1 lỗi nghiêm trọng, chọn rule Lead_ID.
2. Xem 12 bản ghi mẫu, gán Data Analyst, SLA 17:00.
3. Tạo ticket.
4. Sau khi CRM sửa, `Chạy kiểm tra` lại → Passed; điểm tổng cập nhật.

### 18.4. Gửi báo cáo tuần

1. Báo cáo → tạo nhanh Hiệu quả Marketing hoặc chọn mẫu.
2. Lịch Thứ Hai 08:00, Email Marketing Team.
3. Job tới hạn: generate snapshot, nếu SharePoint Delayed thì banner; gửi.
4. Thẻ Đã gửi tháng này +1; lịch sử Chia sẻ gần đây cập nhật.

---

## 19. Mô hình dữ liệu

Tên bảng đề xuất schema `crm_*`. Mọi bảng có `id UUID`, `tenant_id`, `created_at`, `updated_at`, `deleted_at` (nơi cần), `row_version`.

### 19.1. `crm_kpi_hub_workspaces`

Tên, công ty, logo_url, timezone, locale, currency, week_start, default_period_grain (`DAY|WEEK|MONTH|QUARTER|YEAR`), close_day, reconcile_day, lock_closed_periods, allow_reopen, require_kpi_approval, auto_quality, alerts_enabled, maintenance_mode.

### 19.2. `crm_kpi_dictionary`

`workspace_id`, `code`, `name`, `description`, `kpi_group_id`, `kpi_type_id` nullable, `direction`, `value_type`, `unit_id`, `decimal_places`, `calculation_mode`, `calc_kind` (`COUNT|SUM|AVG|RATIO|COMPOSITE|MANUAL`), `formula_ast jsonb`, `formula_display`, `tech_preview`, `blank_if_zero`, `non_additive_ratio`, `allow_manual`, `time_basis_field`, `timezone`, `attribution`, `refresh_cron`, `kpi_owner_id`, `data_owner_id`, `display_name`, `department_ids`, `cloned_from_kpi_id`, `status` (`DRAFT|PENDING_APPROVAL|ACTIVE|NEED_REVIEW|DEPRECATED|ARCHIVED`), `current_version`, `published_at`.

Unique `(workspace_id, code) WHERE deleted_at IS NULL`.

### 19.3. `crm_kpi_dictionary_versions`

Snapshot formula, mapping, target template, `effective_from/to`, `change_reason`, `created_by`.

### 19.4. `crm_kpi_formula_parts`

`dictionary_id`, `role` (`NUMERATOR|DENOMINATOR|PRIMARY`), `ref_dictionary_id` nullable, `agg`, `field_ref`, `filters jsonb`.

### 19.5. `crm_kpi_source_connections`

`workspace_id`, `system` (`CRM|META_ADS|GOOGLE_ADS|GA4|SHAREPOINT|ERP`), `name`, `external_ref`, `sla_minutes`, `last_success_at`, `last_error`, `status`.

### 19.6. `crm_kpi_source_bindings`

`dictionary_id`, `connection_id`, `entity_name`, `role`, `join_keys jsonb`, `value_field`, `agg`, `filters jsonb`, `refresh_override`.

### 19.7. `crm_kpi_mapping_rules`

`dictionary_id`, `link_strategy`, `date_match`, `normalize_utm`, `use_mapping_table`, `mapping_table_binding_id`, `field_pairs jsonb`.

### 19.8. `crm_kpi_period_targets`

`dictionary_id`, `period_start`, `period_end`, `grain`, `scope_type`, `scope_json`, `scope_hash`, `target_value`, `warning_value`, `critical_value`, `unit_id`, `direction`, `alerts_enabled`.

Unique `(dictionary_id, period_start, grain, scope_hash)`.

### 19.9. `crm_kpi_alert_rules`

`dictionary_id` nullable (null = rule global), `condition`, `frequency_minutes`, `recipient_ids jsonb`, `channels jsonb`, `enabled`.

### 19.10. `crm_kpi_alert_events`

`rule_id`, `dictionary_id`, `level`, `title`, `scope_json`, `actual`, `threshold`, `status` (`OPEN|ACK|RESOLVED`), `notified_at`.

### 19.11. `crm_kpi_facts`

`dictionary_id`, `version_id`, `period_start`, `period_end`, `grain`, `scope_hash`, `dimensions_json`, `actual_value`, `num_value`, `den_value`, `calculation_status` (`SUCCESS|NO_DATA|PARTIAL|FAILED`), `data_freshness_at`, `computed_at`, `source_lineage_ref`, `is_blank`, `is_override`.

### 19.12. `crm_kpi_quality_rules` / `crm_kpi_quality_runs` / `crm_kpi_quality_issues`

Rule: name, connection_id, check_type, severity, expression, enabled.  
Run: started/finished, score.  
Issue: rule_id, run_id, status, assignee_id, sla_due, sample_rows jsonb, ticket_ref.

### 19.13. `crm_kpi_reports` / `crm_kpi_report_schedules` / `crm_kpi_report_shares`

Report: name, type, scope, definition jsonb, status, last_generated_at.  
Schedule: cron, channel, recipients, next_run_at.  
Share: user/team, action (`SHARED|VIEWED`).

### 19.14. Chỉ mục

- `(workspace_id, status, kpi_group_id)` dictionary.
- `(dictionary_id, period_start, scope_hash)` facts + targets.
- `(workspace_id, status, created_at desc)` alerts, issues, reports.
- `(connection_id, last_success_at)` freshness.

---

## 20. API đề xuất

Prefix: `/api/crm/kpi-hub`. Auth Bearer + RBAC. Mọi list: `page`, `page_size`, `q`, `sort`.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/workspace` | Settings + system status |
| PATCH | `/workspace` | Lưu workspace / quick toggles |
| GET | `/dashboard` | Query: `from,to,compare,department_id,channel,product,team_id` |
| GET | `/dictionary` | List + summary cards |
| POST | `/dictionary` | Tạo Draft |
| GET | `/dictionary/:id` | Chi tiết + parts + bindings + lineage |
| PATCH | `/dictionary/:id` | Sửa; If-Match |
| POST | `/dictionary/:id/publish` | Xuất bản |
| POST | `/dictionary/:id/duplicate` | Nhân bản |
| POST | `/dictionary/:id/validate` | Logic check + formula |
| DELETE | `/dictionary/:id` | Soft delete |
| GET | `/sources` | Catalog |
| POST | `/sources/:id/refresh` | Refresh thủ công |
| GET | `/targets` | List + cards theo `period` |
| POST | `/targets` | Upsert Period Target |
| PATCH | `/targets/:id` | Sửa + alert embed |
| GET | `/targets/:id/history` | Audit ngưỡng |
| GET | `/alerts` | Event cho Dashboard/Target |
| POST | `/alerts/:id/ack` | Acknowledge |
| GET | `/quality` | Score, trend, freshness, rules |
| POST | `/quality/run` | Chạy kiểm tra |
| GET | `/quality/issues/:id` | Drawer |
| POST | `/quality/issues/:id/assign` | Gán |
| POST | `/quality/issues/:id/ticket` | Tạo ticket |
| GET | `/reports` | List + cards |
| POST | `/reports` | Tạo |
| POST | `/reports/:id/share` | Chia sẻ |
| POST | `/reports/:id/schedule` | Lịch |
| POST | `/reports/:id/send` | Gửi ngay |
| GET | `/activity` | Nhật ký |
| GET | `/dictionary/:id/dependencies` | Upstream/downstream + impact |
| GET | `/dictionary/:id/actuals` | Time series + drill-down |
| GET | `/sources/:id/entities/:entity/schema` | Field type, sample, null rate |
| POST | `/mappings/:id/validate` | Cardinality, type, unmapped |
| POST | `/targets/import` | Import XLSX preview/commit |
| GET | `/bi/dim-kpi` | Hợp đồng Power BI (mục 29.12) |
| GET | `/bi/fact-actual` | Fact materialize cho BI |

### 20.1. `GET /dashboard` (hình dạng response)

```json
{
  "period": { "from": "2026-09-01", "to": "2026-09-30", "timezone": "Asia/Ho_Chi_Minh" },
  "freshness": {
    "as_of": "2026-09-04T08:45:00+07:00",
    "sources": [
      { "system": "CRM", "status": "FRESH" },
      { "system": "META_ADS", "status": "FRESH" },
      { "system": "SHAREPOINT", "status": "DELAYED" }
    ]
  },
  "cards": [
    {
      "code": "MKT_006",
      "name": "CPL Valid Lead",
      "value": 142000,
      "formatted": "142.000 đ",
      "target": 150000,
      "status": "ACHIEVED",
      "badge": "Đạt target ≤ 150.000 đ",
      "delta_pct": null
    }
  ],
  "funnel": {
    "stages": [
      { "code": "MKT_001", "name": "Raw Leads", "value": 2340 },
      { "code": "MKT_002", "name": "Valid Leads", "value": 1486, "conversion_from_prev": 0.635 }
    ],
    "bottleneck": { "code": "MKT_008", "label": "MQL Rate" }
  },
  "target_progress": {
    "overall_pct": 68,
    "groups": [
      { "code": "ACQUISITION", "pct": 92 },
      { "code": "MEDIA_EFFICIENCY", "pct": 95 },
      { "code": "FUNNEL", "pct": 71 },
      { "code": "SALES_OUTCOME", "pct": 46 }
    ]
  },
  "channels": [
    { "channel": "META_ADS", "valid_leads": 820, "revenue": 410000000 },
    { "channel": "GOOGLE_ADS", "valid_leads": 310, "revenue": 280000000 },
    { "channel": "ORGANIC", "valid_leads": 240, "revenue": 190000000 },
    { "channel": "REFERRAL", "valid_leads": 116, "revenue": 360000000 }
  ],
  "alerts": [
    { "level": "CRITICAL", "title": "Win Rate thấp hơn ngưỡng Critical", "scope": "Sales Team A", "age": "8m" },
    { "level": "WARNING", "title": "MQL Rate chưa đạt target", "scope": "Campaign BĐS Q3" },
    { "level": "INFO", "title": "SharePoint Mapping trễ 2 giờ", "scope": "Data Quality" },
    { "level": "SUCCESS", "title": "CPL Valid Lead đạt target", "scope": "Marketing" }
  ],
  "top_sales": [
    { "rank": 1, "name": "Nguyễn Minh Anh", "revenue": 420000000, "win_rate": 0.187 }
  ]
}
```

---

## 21. Phân quyền

Section RBAC mới (catalog `rbac-admin-catalog.json`):

| Section | Hành động |
|---|---|
| `crm_kpi_hub` | `view` Dashboard |
| `crm_kpi_dictionary` | `view`, `manage`, `publish` |
| `crm_kpi_hub_targets` | `view`, `manage` |
| `crm_kpi_hub_sources` | `view`, `configure` |
| `crm_kpi_quality` | `view`, `manage`, `export` |
| `crm_kpi_hub_reports` | `view`, `manage`, `approve`, `send` |
| `crm_kpi_hub_settings` | `view`, `manage` |

| Hành động | Super/Tenant Admin | Data/BI | Ops | Head/Lead | Viewer |
|---|---|---|---|---|---|
| Xem Dashboard | Có | Có | Có | Phạm vi | Được share |
| CRUD Dictionary | Có | Có | manage | Không | Không |
| Xuất bản KPI | Có | Theo quyền | Theo duyệt | Không | Không |
| Sửa mapping/formula | Có | Có | Không mặc định | Không | Không |
| Sửa Target/Alert | Có | Theo quyền | Có | Phạm vi | Không |
| Chạy Quality / ticket | Có | Có | Xem | Không | Không |
| Tạo/gửi Báo cáo | Có | Theo quyền | Có | Phạm vi | Không |
| Approve báo cáo/KPI | Có | Không mặc định | Không | Approver | Không |
| Settings workspace | Có | Tích hợp/Quality | Không | Không | Không |

Route guard `rbac-routes.ts`: prefix `/crm/kpi-hub` theo section tương ứng.

---

## 22. Yêu cầu UI/UX chi tiết theo màn

### 22.1. Trạng thái dùng chung

Mọi list: loading skeleton, empty, error retry, 403, 409 toast. Badge luôn có chữ. Focus ring bàn phím. Drawer `Esc` đóng nếu không dirty.

### 22.2. Dictionary editor

Tab giữ query `tab=`. Dirty indicator trên tab đã sửa. Checklist FR-FORM-06 luôn visible desktop.

### 22.3. Đồng bộ Formula ↔ Mapping

Đổi filter/agg ở Mapping cập nhật preview Formula; ngược lại đề nghị mở tab Mapping nếu thiếu binding. Không cho Xuất bản khi hai tab lệch (checksum AST vs bindings).

### 22.4. Ngôn ngữ

UI vi-VN mặc định. Nhãn kỹ thuật (Fresh, Active, DAX Preview, Completeness) giữ song ngữ như mockup khi đó là thuật ngữ.

---

## 23. Yêu cầu phi chức năng

### Hiệu năng

- `GET /dashboard` p95 ≤ 800 ms khi facts đã materialize (không query Ads live theo request).
- List Dictionary/Target/Reports/Quality p95 ≤ 700 ms / 20k bản ghi với index.
- Validate formula p95 ≤ 2 s (không gồm preview live).
- Preview connector timeout mặc định 10 s.
- Quality run 14 rule v1 ≤ 2 phút trên volume lead 100k/tháng.

### Bảo mật

- Auth + RBAC + tenant isolation tại repository.
- Expression sandbox: allowlist function, cấm `;`, comment SQL, `COPY`, file.
- Sample Quality: mask phone/email nếu user không có quyền PII.
- Secret vault; rotate không downtime đọc.
- Audit: publish, mapping, target, alert, quality assign, report send, danger zone.

### Tin cậy

- Fact compute idempotent theo `(dictionary, version, period, scope)`.
- Retry sync 3 lần exponential; dead-letter + Failed.
- Không backfill actual kỳ khóa trừ reopen.

### Khả dụng

- Desktop 1280+; tablet 1 cột.
- Autosave Draft Dictionary mỗi 60 s khi dirty (local + PATCH draft).
- Footer freshness stale > 2× SLA → Delayed.

---

## 24. Tiêu chí nghiệm thu

| ID | Tiêu chí |
|---|---|
| AC-01 | Sidebar 7 mục, active đúng, Thu gọn hoạt động |
| AC-02 | Dashboard kỳ 09/2026 + fixture 5 thẻ, funnel 6 tầng, bottleneck MQL Rate, donut 68%, 4 nhóm, Top Sales #1 Nguyễn Minh Anh |
| AC-03 | Bộ lọc Dashboard áp dụng mọi widget; Reset trả mặc định |
| AC-04 | So sánh kỳ trước ẩn delta khi kỳ trước thiếu dữ liệu |
| AC-05 | Dictionary 4 thẻ 22/20/1/7; search/filter; drawer CPL đúng phân số và target ≤ 150.000 |
| AC-06 | Editor 5 tab; Lưu nháp không cần đủ; Xuất bản bị chặn nếu thiếu nguồn AUTO hoặc formula lỗi |
| AC-07 | Ratio CPL: blank-if-zero và non-additive; preview `DIVIDE(...)`; cycle bị từ chối |
| AC-08 | Mapping 3 nguồn; join campaign_id→utm_campaign; 12 campaign chưa map hiện warning 96% |
| AC-09 | Target CPL actual 142k → Đạt; MQL 24.8% vs ≥30% → Cảnh báo; Win 12.5% vs ≥20% → Nguy cấp |
| AC-10 | Lưu Target + alert 4 giờ / Email+Teams tạo rule; không spam trong cửa sổ |
| AC-11 | Quality 92/100, 5/7, trend, freshness 4 nguồn, rule Lead_ID 12 lỗi, gán + ticket |
| AC-12 | Báo cáo 4 thẻ, 4 tab, tạo nhanh 4 mẫu, lịch gửi, không gửi số bịa khi nguồn Failed |
| AC-13 | Settings lưu timezone, chu kỳ Tháng, chốt ngày 3, đối soát ngày 5, khóa kỳ, 4 toggle nhanh |
| AC-14 | Danger zone không xóa ngay; export không chứa secret |
| AC-15 | Tenant A không đọc Hub tenant B |
| AC-16 | PATCH conflict 409 |
| AC-17 | Maintenance chặn ghi (trừ Super Admin) |
| AC-18 | Footer CRM Fresh / Meta Fresh / SharePoint Delayed |
| AC-19 | Audit publish, target, quality assign, report send |
| AC-20 | Gắn KPI Type Inactive → Dictionary Need Review |
| AC-21 | Không publish khi thiếu formula / source / time basis / KPI Owner / Data Owner |
| AC-22 | Sửa formula Active tạo Pending Version; kỳ đã chốt giữ version cũ |
| AC-23 | Target hierarchy Campaign > Team > Department > Workspace đúng |
| AC-24 | Count Valid Leads dùng DISTINCT `lead_id`, không COUNT(*) |
| AC-25 | SAL_008 ≠ FIN_001 ≠ FIN_002 trên UI và API |
| AC-26 | Card nguồn Failed/DQ Critical hiện DATA_ISSUE |
| AC-27 | Alert recovery gửi khi bật; Critical không assignee quá SLA thì escalate |
| AC-28 | Import target XLSX: dòng lỗi tải được, không commit khi còn error |
| AC-29 | Export report có filter + timestamp + freshness; Viewer không PATCH được qua API |
| AC-30 | Mapping n-n không có bridge → warning row multiplication; unmapped campaign hiện số |

---

## 25. Phụ thuộc và lộ trình

### Phụ thuộc

- Nhóm KPI, KPI Type, `crm_kpi_units`.
- Connector CRM Lead, Ads Meta, Finance (đã có ở KPI Type); bổ sung SharePoint mapping table, ERP invoices, GA4 (GA4 có thể stub UNAVAILABLE).
- RBAC staff-permissions, Audit log.
- Ticket IWR/CSD (tùy cờ tenant; fallback ticket nội bộ).
- Email + Microsoft Teams outbound.

### Lộ trình

| Phase | Hạng mục |
|---|---|
| P1 Foundation | Auth/workspace/RBAC, Dictionary CRUD+lifecycle, mapping CRM+Meta cơ bản, Target dept/team, Dashboard 5 thẻ + funnel, audit, export Dictionary/Target XLSX |
| P2 Governance + DQ | Formula nâng cao, dependency, filter builder, DQ rule/run/issue, freshness SLA, alert in-app/email, target hierarchy, report template/schedule |
| P3 Intelligence | Attribution đầy đủ, forecast, Power BI semantic, Teams/Slack/webhook, SSO/MFA, custom role, AI insight (ngoài 1.0) |

---

## 26. Gợi ý triển khai

```text
services/ptt-crm-api/src/kpi-hub/
  kpi-hub.module.ts
  dashboard/
  dictionary/
  formula/
  mapping/
  targets/
  quality/
  reports/
  workspace/

services/ops-web/src/app/crm/kpi-hub/
  page.tsx                    Dashboard
  dictionary/...
  targets/...
  sources/...
  quality/...
  reports/...
  settings/...

services/ops-web/src/components/kpi-hub/
  KpiHubShell.tsx
  KpiHubSidebar.tsx
  KpiHubFreshnessFooter.tsx
```

Nguyên tắc:

- Tính actual batch (cron + after-sync), Dashboard chỉ đọc `crm_kpi_facts`.
- Formula port riêng, không nhúng SQL user.
- Mapping SharePoint là LOOKUP, không phải nguồn actual.
- CSS `kpi-hub-*`, không clone pixel font lạ.
- Unit test: achievement/status, non-additive ratio, blank-if-zero, cycle detect, freshness SLA, period lock.

---

## 27. Dữ liệu mẫu chuẩn (CPL Valid Lead)

Dùng cho seed demo và AC.

```json
{
  "workspace": {
    "name": "KPI Hub - Marketing & Sales",
    "company": "PTT Digital",
    "timezone": "Asia/Ho_Chi_Minh",
    "locale": "vi",
    "currency": "VND",
    "week_start": "MONDAY",
    "default_period_grain": "MONTH",
    "close_day": 3,
    "reconcile_day": 5
  },
  "dictionary": {
    "code": "MKT_006",
    "name": "CPL Valid Lead",
    "group": "Media Efficiency",
    "status": "ACTIVE",
    "direction": "LOWER_IS_BETTER",
    "unit": "VND/Lead",
    "owner": { "name": "Performance MKT", "email": "perf.mkt@ptt.vn" },
    "description": "Chi phí trên mỗi Valid Lead từ các kênh quảng cáo trả phí.",
    "calc_kind": "RATIO",
    "blank_if_zero": true,
    "non_additive_ratio": true,
    "allow_manual": false,
    "business_formula": "CPL Valid Lead = Tổng chi tiêu quảng cáo ÷ Tổng Valid Leads",
    "tech_preview": "DIVIDE([Tổng chi tiêu quảng cáo], [Tổng Valid Leads])",
    "numerator": {
      "code": "MKT_004",
      "name": "Tổng chi tiêu quảng cáo",
      "mapping": "SUM(AdInsights[Spend])",
      "filters": ["Status = Active", "Currency = VND"]
    },
    "denominator": {
      "code": "MKT_002",
      "name": "Tổng Valid Leads",
      "mapping": "DISTINCTCOUNT(Leads[Lead_ID])",
      "filters": ["Is_Valid = TRUE", "Is_Duplicate = FALSE", "Is_Test = FALSE"]
    },
    "time": {
      "basis": "valid_lead_created_date",
      "attribution": "LAST_TOUCH",
      "refresh": "0 8 * * *"
    },
    "downstream": ["MKT_009", "FIN_003"]
  },
  "period_target": {
    "period": "2026-09",
    "scope": "Marketing",
    "target": 150000,
    "warning": 180000,
    "critical": 220000,
    "actual": 142000,
    "status": "ACHIEVED"
  }
}
```

---

## 28. Ma trận màn hình × mockup

| UI trong yêu cầu | Route / bề mặt | File mockup tham chiếu |
|---|---|---|
| UI Dashboard | `/crm/kpi-hub` | Dashboard tổng quan MKT & Sales |
| UI Dictionary | `/crm/kpi-hub/dictionary` + drawer | Danh sách + drawer CPL |
| UI Công thức & Logic | `.../dictionary/:id/edit?tab=formula` | Tab Công thức CPL |
| UI Data Source Mapping | `?tab=source` + `/sources` | Tab Nguồn + catalog |
| UI Target và cảnh báo | `/crm/kpi-hub/targets` | Bảng kỳ + drawer CPL |
| UI Data Quality | `/crm/kpi-hub/quality` | Score, freshness, rule, issue |
| UI Báo cáo | `/crm/kpi-hub/reports` | List + quick create + lịch |
| UI Cài đặt | `/crm/kpi-hub/settings` | Workspace + 9 mục con |

---

---

## 29. Catalog KPI mẫu (seed bắt buộc)

Khởi tạo workspace demo / UAT. Công thức Count Lead/Deal dùng `DISTINCTCOUNT` + unique key.

| KPI ID | Metric | Công thức chuẩn | Nguồn chính | Direction |
|---|---|---|---|---|
| `MKT_001` | Tổng Raw Leads | DISTINCTCOUNT(Lead_ID) | SharePoint/CRM | Higher |
| `MKT_002` | Tổng Valid Leads | DISTINCTCOUNT Lead_ID, valid, non-duplicate, non-test | CRM | Higher |
| `MKT_003` | Valid Lead Rate | MKT_002 / MKT_001 | CRM/SharePoint | Higher |
| `MKT_004` | Tổng chi tiêu quảng cáo | SUM(Spend) | Meta/Google/TikTok Ads | Lower theo ngân sách |
| `MKT_005` | CPL Raw Lead | MKT_004 / MKT_001 | Ads + SharePoint | Lower |
| `MKT_006` | CPL Valid Lead | MKT_004 / MKT_002 | Ads + CRM | Lower |
| `MKT_007` | Tổng MQL | DISTINCTCOUNT Lead_ID status=MQL | CRM | Higher |
| `MKT_008` | MQL Rate | MKT_007 / MKT_002 | CRM | Higher |
| `MKT_009` | ROAS | Attributed Revenue / MKT_004 | Ads/CRM/ERP | Higher |
| `SAL_001` | Tổng SQL | DISTINCTCOUNT Lead_ID status=SQL | CRM | Higher |
| `SAL_002` | SQL Rate | SAL_001 / MKT_007 | CRM | Higher |
| `SAL_003` | Tổng cuộc hẹn | DISTINCTCOUNT Appointment_ID | CRM | Higher |
| `SAL_004` | Show-up Rate | Completed / valid appointments | CRM | Higher |
| `SAL_005` | Pipeline Value | SUM open Deal Amount | CRM | Higher |
| `SAL_007` | Win Rate | Won / (Won + Lost) | CRM | Higher |
| `SAL_008` | Doanh thu ký mới | SUM Contract Value Won/Signed | CRM | Higher |
| `SAL_WON` | Deal Won (count) | DISTINCTCOUNT Deal_ID Won | CRM | Higher |
| `FIN_001` | Doanh thu xuất hóa đơn | SUM valid Invoice Amount | ERP | Higher |
| `FIN_002` | Doanh thu thu tiền | SUM cleared Payment Amount | ERP/Bank | Higher |
| `FIN_003` | CAC | (Marketing Cost + Sales Cost) / New Customers | Ads/CRM/Finance | Lower |
| `OPS_001` | Lead Response Time | First Contact − Created Date | CRM/Call Center | Lower |
| `OPS_002` | Lead Contact Rate | Contacted Valid Leads / MKT_002 | CRM/Call Center | Higher |

---

## 30. Hợp đồng Power BI và Excel

P1: export metadata + fact. P3: dataset refresh hai chiều.

Bảng/endpoint:

| Dataset | Trường chính |
|---|---|
| `dim_kpi_dictionary` | kpi_id, name, group, type, unit, direction, time_basis, kpi_owner, data_owner, status, version |
| `dim_kpi_target` | target_id, kpi_id, period, scope, target, warning, critical, direction, status |
| `fact_kpi_actual` | kpi_id, version, period, dimensions, actual, numerator, denominator, freshness, calculation_status |
| `dim_data_source` | source_id, system, entity, source_of_record, owner, refresh, health |
| `fact_dq_result` | rule_id, source_id, entity, run_at, pass_rate, affected_count, severity, status |

Power BI relate theo `kpi_id`, date, team, campaign, product. DAX Preview chỉ tham chiếu; measure production quản lý trên semantic model.

Excel: export Dictionary, Target, DQ, Actual — header gồm generated_at, user, filters, workspace, freshness, version. Import Target: template + preview + error file + confirm.

---

## 31. Luồng dữ liệu kỹ thuật

```text
CRM | SharePoint | Meta/Google Ads | GA4 | ERP | Call Center | Excel
        ↓
Connector / ETL-ELT / Dataflow
        ↓
Raw → Cleaned Business → Mapping → Semantic / Metrics (Dictionary + Formula + Target)
        ↓                         ↓
Data Quality Rules              Fact compute (crm_kpi_facts)
        ↓                         ↓
Issue & Alert Engine  ←→  Dashboard / Báo cáo / API / Power BI
```

Dashboard **không** query Ads live theo request. Compute batch + đọc fact. `PARTIAL` khi một nguồn Delayed nhưng KPI vẫn tính được phần đã map.

---

## 32. Trạng thái UI chuẩn

| Trạng thái | UI |
|---|---|
| Loading | Skeleton, không màn hình trắng |
| Empty | Giải thích + CTA |
| No Data | `—` + lý do filter/kỳ; không 0 |
| Delayed | Badge cam, timestamp, link source |
| Failed | Badge đỏ, error ref, retry theo quyền |
| Draft / Pending Approval / Active / Deprecated / Archived | Badge + chữ |
| Permission denied | Thông báo + liên hệ Admin |
| Unknown freshness | Xám, “Chưa có lần sync” |

NFR bổ sung: Dashboard cached p95 ≤ 3 s (mục tiêu nội bộ RNOSAI vẫn 800 ms khi fact sẵn); live query ≤ 8 s. List 1.000 KPI p95 ≤ 2 s. Export async khi lớn. TLS, RBAC backend, WCAG AA khi khả thi. Correlation ID trên job refresh/alert. Health endpoint.

---

*Hết SRS KPI Hub v1.1. Kết hợp mockup UI với nghiệp vụ governance/semantic. Không thay thế SRS Nhóm KPI / KPI Type.*


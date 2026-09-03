# SRS — Thiết lập KPI Type

**Sản phẩm:** CRM / Marketing Performance Management  
**Phân hệ:** KPI & Hiệu suất  
**Chức năng:** Thiết lập KPI Type (Loại chỉ tiêu KPI)  
**Liên quan:** Thiết lập Nhóm KPI, Bộ KPI, Chỉ tiêu KPI, Chu kỳ đánh giá, Chấm điểm KPI  
**Phiên bản:** 1.0  
**Ngôn ngữ:** Tiếng Việt

---

## 1. Mục đích

Chức năng **Thiết lập KPI Type** cho phép doanh nghiệp chuẩn hóa các loại chỉ tiêu KPI có thể được sử dụng khi xây dựng Mẫu KPI, Bộ KPI và giao KPI cho cá nhân/nhóm.

Nếu **Nhóm KPI** là cấp phân loại quản trị cao (ví dụ: Tăng trưởng & Chuyển đổi, Hiệu quả ngân sách, Doanh thu & Pipeline), thì **KPI Type** là chỉ tiêu đo lường cụ thể nằm trong nhóm đó (ví dụ: Marketing Qualified Leads, Cost per Lead, ROAS, Organic Traffic, Tỷ lệ MQL → SQL).

Mục tiêu của chức năng:

- Chuẩn hóa tên gọi, đơn vị, hướng đo, công thức và nguồn dữ liệu của từng chỉ tiêu.
- Giảm việc tạo KPI thủ công thiếu nhất quán giữa các phòng ban/chiến dịch.
- Hỗ trợ chấm điểm KPI tự động hoặc bán tự động dựa trên dữ liệu nguồn.
- Bảo đảm khả năng truy vết công thức, dữ liệu và phiên bản cấu hình theo từng chu kỳ đánh giá.
- Cho phép mở rộng theo ngành dọc như bất động sản, spa/làm đẹp, giáo dục, agency và SaaS.

---

## 2. Phạm vi

### 2.1. Trong phạm vi phiên bản 1.0

- Tạo, xem, tìm kiếm, lọc, cập nhật, nhân bản, kích hoạt/ngừng sử dụng và xóa mềm KPI Type.
- Gán KPI Type vào đúng Nhóm KPI.
- Cấu hình tên, mã, mô tả, đơn vị đo, hướng đo, loại dữ liệu, cách tính, nguồn dữ liệu và tần suất đồng bộ.
- Cấu hình quy tắc đánh giá mặc định theo mục tiêu: tăng dần, giảm dần, duy trì trong ngưỡng.
- Cấu hình mức mục tiêu mặc định và các ngưỡng tối thiểu/mục tiêu/vượt mục tiêu.
- Gán KPI Type theo phạm vi doanh nghiệp, phòng ban và chức danh.
- Thiết lập khả năng nhập thủ công hoặc đồng bộ tự động.
- Hiển thị mức độ sử dụng và kiểm tra ảnh hưởng trước khi ngừng sử dụng/xóa.
- Lưu vết thay đổi cấu hình và version hóa công thức.

### 2.2. Ngoài phạm vi phiên bản 1.0

- Trình dựng công thức kéo thả nâng cao (visual formula builder).
- Thực thi truy vấn trực tiếp đến toàn bộ nguồn dữ liệu bên thứ ba.
- Thiết kế workflow phê duyệt thay đổi KPI Type nhiều cấp.
- Tự động phát hiện bất thường dữ liệu bằng AI.
- Tự động tối ưu trọng số KPI bằng machine learning.
- Tính thưởng, hoa hồng, payroll hoặc xử lý kỷ luật từ kết quả KPI.

---

## 3. Khái niệm và phân cấp dữ liệu

```text
Nhóm KPI
  └── KPI Type
        └── Chỉ tiêu KPI (KPI Assignment / KPI Instance)
              └── Bộ KPI / Mẫu KPI
                    └── Chu kỳ đánh giá
                          └── Kết quả và điểm KPI
```

Ví dụ:

| Cấp dữ liệu | Giá trị ví dụ |
|---|---|
| Nhóm KPI | Tăng trưởng & Chuyển đổi |
| KPI Type | Marketing Qualified Leads (MQL) |
| Chỉ tiêu KPI | Đạt 1.200 MQL trong Quý 4/2026 |
| Người chịu trách nhiệm | Nguyễn Minh Anh — Marketing Leader |
| Nguồn dữ liệu | CRM Lead Dashboard |
| Công thức | `COUNT(leads WHERE lifecycle_stage = 'MQL')` |

---

## 4. Vai trò người dùng

| Vai trò | Quyền đối với KPI Type |
|---|---|
| System Administrator | Toàn quyền trên KPI Type hệ thống, tenant template, dữ liệu mẫu và phiên bản mặc định |
| Tenant Administrator | Toàn quyền tạo, sửa, kích hoạt, ngừng sử dụng, nhân bản và xóa mềm KPI Type trong tenant |
| HR / Performance Manager | Tạo, xem, chỉnh sửa, nhân bản trong phạm vi được cấp quyền |
| Head of Department | Xem KPI Type thuộc phòng ban; có thể đề xuất/tạo nếu tenant cấp quyền |
| Marketing Leader | Xem, tìm kiếm và chọn KPI Type phù hợp khi tạo KPI; không được sửa cấu hình chuẩn mặc định |
| Employee | Chỉ xem KPI Type của KPI được giao |
| Data/BI Administrator | Quản lý mapping dữ liệu nguồn, công thức và lịch đồng bộ nếu được cấp quyền chuyên biệt |

---

## 5. Danh mục KPI Type Marketing mẫu

| Mã KPI Type | Tên KPI Type | Nhóm KPI | Hướng đo | Đơn vị | Nguồn đề xuất |
|---|---|---|---|---|---|
| `MQL_COUNT` | Marketing Qualified Leads (MQL) | Tăng trưởng & Chuyển đổi | Tăng dần | Lead | CRM, Marketing Automation |
| `SQL_COUNT` | Sales Qualified Leads (SQL) | Tăng trưởng & Chuyển đổi | Tăng dần | Lead | CRM |
| `MQL_TO_SQL_RATE` | Tỷ lệ chuyển đổi MQL → SQL | Tăng trưởng & Chuyển đổi | Tăng dần | % | CRM |
| `LANDING_PAGE_CVR` | Tỷ lệ chuyển đổi Landing Page | Tăng trưởng & Chuyển đổi | Tăng dần | % | Website / Analytics |
| `BOOKING_COUNT` | Số lịch hẹn tư vấn | Tạo nhu cầu & Thu hút khách hàng | Tăng dần | Lịch hẹn | CRM, Booking |
| `CPL` | Cost per Lead | Hiệu quả ngân sách | Giảm dần | VNĐ/Lead | Ads, CRM |
| `CPA` | Cost per Acquisition | Hiệu quả ngân sách | Giảm dần | VNĐ/Khách hàng | Ads, CRM |
| `CAC` | Customer Acquisition Cost | Hiệu quả ngân sách | Giảm dần | VNĐ/Khách hàng | Finance, CRM, Ads |
| `ROAS` | Return on Ad Spend | Hiệu quả ngân sách | Tăng dần | Lần | Ads, CRM, Finance |
| `MARKETING_SOURCED_REVENUE` | Doanh thu có nguồn Marketing | Doanh thu & Pipeline | Tăng dần | VNĐ | CRM, Finance |
| `MARKETING_INFLUENCED_REVENUE` | Doanh thu chịu ảnh hưởng Marketing | Doanh thu & Pipeline | Tăng dần | VNĐ | CRM, Finance |
| `PIPELINE_GENERATED` | Giá trị Pipeline tạo mới | Doanh thu & Pipeline | Tăng dần | VNĐ | CRM |
| `ORGANIC_TRAFFIC` | Lưu lượng truy cập tự nhiên | Hiệu quả kênh số | Tăng dần | Phiên | Website / SEO |
| `ORGANIC_KEYWORDS_TOP10` | Từ khóa SEO Top 10 | Hiệu quả kênh số | Tăng dần | Từ khóa | SEO |
| `EMAIL_CTR` | Tỷ lệ nhấp Email | Hiệu quả kênh số | Tăng dần | % | Marketing Automation |
| `SOCIAL_ENGAGEMENT_RATE` | Tỷ lệ tương tác mạng xã hội | Hiệu quả kênh số | Tăng dần | % | Social |
| `BRANDED_SEARCH_GROWTH` | Tăng trưởng tìm kiếm thương hiệu | Thương hiệu & Độ nhận biết | Tăng dần | % | Search / SEO |
| `SHARE_OF_VOICE` | Share of Voice | Thương hiệu & Độ nhận biết | Tăng dần | % | Social Listening |
| `CAMPAIGN_ON_TIME_RATE` | Tỷ lệ chiến dịch đúng hạn | Nội dung & Chiến dịch | Tăng dần | % | Project Management |
| `CRM_DATA_COMPLETENESS` | Tỷ lệ hoàn chỉnh dữ liệu CRM | Vận hành & Quản trị | Tăng dần | % | CRM |
| `LEAD_RESPONSE_SLA` | Tỷ lệ xử lý lead đúng SLA | Vận hành & Quản trị | Tăng dần | % | CRM |
| `AUTOMATION_COVERAGE` | Tỷ lệ lead đi qua automation | Đổi mới & Tự động hóa | Tăng dần | % | CRM, Marketing Automation |

---

## 6. Yêu cầu chức năng

### FR-01. Danh sách KPI Type

Hệ thống phải cung cấp màn hình danh sách tại:

```text
KPI & Hiệu suất > Cấu hình > KPI Type
```

Danh sách hiển thị tối thiểu:

| Cột | Mô tả |
|---|---|
| KPI Type | Biểu tượng, tên, mã và mô tả ngắn |
| Nhóm KPI | Nhóm KPI cha, hiển thị bằng badge màu |
| Đơn vị đo | Đơn vị mặc định của KPI Type |
| Hướng đo | Tăng dần, Giảm dần, Duy trì trong ngưỡng |
| Nguồn dữ liệu | Nguồn chính/loại nguồn dữ liệu |
| Tự động hóa | Đồng bộ tự động, Nhập thủ công hoặc Kết hợp |
| Đang sử dụng | Số KPI Type/KPI Assignment/Mẫu KPI đang tham chiếu |
| Trạng thái | Draft, Active, Inactive |
| Cập nhật gần nhất | Thời gian và người cập nhật |
| Thao tác | Xem, sửa, nhân bản, đổi trạng thái, xóa |

Chức năng hỗ trợ:

- Tìm kiếm theo mã, tên, mô tả và công thức.
- Lọc theo Nhóm KPI, phòng ban, chức danh, hướng đo, đơn vị, nguồn dữ liệu, chế độ nhập, trạng thái.
- Sắp xếp theo tên, nhóm KPI, trạng thái, mức độ sử dụng, ngày cập nhật.
- Phân trang: 20/50/100 bản ghi mỗi trang.
- Export danh sách theo quyền của người dùng, nếu tenant bật tính năng export.

### FR-02. Tạo KPI Type

Người dùng có quyền phù hợp chọn **Thêm KPI Type** để tạo mới một loại chỉ tiêu KPI.

Các trường dữ liệu:

| Mã trường | Trường | Kiểu | Bắt buộc | Quy tắc |
|---|---|---|---|---|
| `kpi_group_id` | Nhóm KPI | Select | Có | Chỉ chọn Nhóm KPI Active, thuộc đúng tenant và đúng phạm vi |
| `code` | Mã KPI Type | Text/slug | Có | 3–80 ký tự; chữ in hoa, số, dấu gạch dưới; duy nhất trong tenant |
| `name` | Tên KPI Type | Text | Có | 3–150 ký tự; duy nhất không phân biệt hoa thường trong tenant |
| `short_name` | Tên viết tắt | Text | Không | Tối đa 50 ký tự; ví dụ MQL, CPL, ROAS |
| `description` | Mô tả nghiệp vụ | Textarea | Không | Tối đa 1.000 ký tự |
| `direction` | Hướng đo | Select | Có | INCREASE, DECREASE, RANGE |
| `value_type` | Kiểu giá trị | Select | Có | INTEGER, DECIMAL, PERCENTAGE, CURRENCY, DURATION, SCORE, BOOLEAN |
| `unit_id` | Đơn vị đo | Select | Có | Phù hợp với value_type; ví dụ Lead, %, VNĐ, Lần, Phiên, Điểm |
| `decimal_places` | Số chữ số thập phân | Integer | Có | 0–4; mặc định theo value_type |
| `target_mode` | Kiểu mục tiêu | Select | Có | SINGLE_TARGET, THRESHOLD, RANGE |
| `minimum_target` | Ngưỡng tối thiểu | Decimal | Có điều kiện | Bắt buộc với THRESHOLD/RANGE |
| `default_target` | Mục tiêu mặc định | Decimal | Có | Phải phù hợp hướng đo và kiểu mục tiêu |
| `stretch_target` | Mục tiêu vượt kỳ vọng | Decimal | Không | Phải tốt hơn default_target theo hướng đo |
| `upper_limit` | Giới hạn trên | Decimal | Có điều kiện | Bắt buộc với RANGE |
| `lower_limit` | Giới hạn dưới | Decimal | Có điều kiện | Bắt buộc với RANGE |
| `calculation_mode` | Chế độ tính | Select | Có | AUTO, MANUAL, HYBRID |
| `formula_expression` | Công thức | Formula text | Có điều kiện | Bắt buộc khi AUTO/HYBRID; version hóa |
| `formula_display` | Diễn giải công thức | Text | Không | Hiển thị thân thiện trên UI |
| `data_source_id` | Nguồn dữ liệu chính | Select | Có điều kiện | Bắt buộc khi AUTO/HYBRID |
| `data_entity` | Đối tượng dữ liệu | Select/Text | Có điều kiện | Ví dụ Lead, Deal, Campaign, Ad Spend |
| `aggregation_type` | Kiểu tổng hợp | Select | Có điều kiện | COUNT, SUM, AVG, RATE, DISTINCT_COUNT, CUSTOM |
| `sync_frequency` | Tần suất đồng bộ | Select | Có điều kiện | REALTIME, HOURLY, DAILY, WEEKLY, MONTHLY |
| `manual_evidence_required` | Yêu cầu minh chứng nhập tay | Boolean | Có | Mặc định true cho MANUAL |
| `scope_type` | Phạm vi áp dụng | Select | Có | ORGANIZATION, DEPARTMENT, POSITION, CUSTOM |
| `department_ids` | Phòng ban áp dụng | Multi-select | Có điều kiện | Bắt buộc theo scope |
| `position_ids` | Chức danh áp dụng | Multi-select | Không | Lọc theo phòng ban |
| `weight_min` | Trọng số tối thiểu | Decimal | Không | 0–100 |
| `weight_max` | Trọng số tối đa | Decimal | Không | 0–100; phải >= weight_min |
| `display_order` | Thứ tự hiển thị | Integer | Có | Số nguyên dương; mặc định tự sinh |
| `status` | Trạng thái | Select | Có | DRAFT, ACTIVE, INACTIVE; mặc định DRAFT |

### FR-03. Tự động điền theo Nhóm KPI

Khi người dùng chọn Nhóm KPI, hệ thống phải:

- Gợi ý hướng đo mặc định của Nhóm KPI.
- Gợi ý các loại đơn vị đo phù hợp đã cấu hình trên Nhóm KPI.
- Gợi ý miền dữ liệu nguồn.
- Gợi ý màu và biểu tượng hiển thị, nhưng người dùng có quyền vẫn có thể điều chỉnh tại KPI Type.
- Không tự động ghi đè giá trị người dùng đã chỉnh sửa nếu đổi Nhóm KPI sau đó; thay vào đó hiển thị xác nhận áp dụng lại cấu hình gợi ý.

### FR-04. Cấu hình mục tiêu và ngưỡng

Hệ thống phải hỗ trợ ba kiểu mục tiêu:

| Kiểu | Mô tả | Ví dụ |
|---|---|---|
| `SINGLE_TARGET` | Một mục tiêu duy nhất | Đạt 1.200 MQL/quý |
| `THRESHOLD` | Có mức tối thiểu, mục tiêu và có thể có mức vượt | CPL ≤ 85.000 VNĐ; mục tiêu tốt là 70.000 VNĐ |
| `RANGE` | Giá trị phải nằm trong khoảng đạt chuẩn | Tỷ lệ sử dụng ngân sách từ 90% đến 100% |

Quy tắc kiểm tra:

| Hướng đo | Quan hệ mục tiêu hợp lệ |
|---|---|
| Tăng dần | `minimum_target <= default_target <= stretch_target` |
| Giảm dần | `minimum_target >= default_target >= stretch_target` nếu stretch là mức tốt hơn; UI phải diễn giải rõ |
| Duy trì trong ngưỡng | `lower_limit <= default_target <= upper_limit` |

### FR-05. Cấu hình công thức và nguồn dữ liệu

KPI Type hỗ trợ các chế độ:

| Chế độ | Mô tả |
|---|---|
| `AUTO` | Hệ thống tự tính hoàn toàn từ nguồn dữ liệu kết nối |
| `MANUAL` | Người dùng nhập giá trị thực tế và nộp minh chứng nếu bắt buộc |
| `HYBRID` | Hệ thống gợi ý/tính dữ liệu, người có thẩm quyền xác nhận hoặc hiệu chỉnh |

Với `AUTO` hoặc `HYBRID`, bắt buộc có:

- Nguồn dữ liệu chính.
- Data entity.
- Kiểu tổng hợp hoặc công thức.
- Tần suất đồng bộ.
- Múi giờ xử lý dữ liệu, mặc định theo tenant.

Ví dụ công thức tham chiếu:

```text
MQL_COUNT = COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)

CPL = SUM(AdSpend.amount WHERE date IN evaluation_period) / COUNT(Lead WHERE source_category = 'Paid' AND created_at IN evaluation_period)

MQL_TO_SQL_RATE = COUNT(Lead WHERE lifecycle_stage = 'SQL' AND qualified_at IN evaluation_period) / COUNT(Lead WHERE lifecycle_stage = 'MQL' AND qualified_at IN evaluation_period) * 100

ROAS = SUM(AttributedRevenue.amount WHERE date IN evaluation_period) / SUM(AdSpend.amount WHERE date IN evaluation_period)
```

### FR-06. Kiểm tra công thức

Người dùng có quyền Data/BI Administrator hoặc Tenant Administrator phải có thể chọn **Kiểm tra công thức**.

Hệ thống phải:

1. Kiểm tra cú pháp công thức.
2. Kiểm tra sự tồn tại của data source, data entity, field và aggregation.
3. Kiểm tra quyền truy cập nguồn dữ liệu.
4. Hiển thị preview kết quả trên khoảng thời gian thử nghiệm do người dùng chọn, nếu connector hỗ trợ.
5. Không lưu KPI Type ở trạng thái Active nếu công thức AUTO/HYBRID lỗi validation.

Thông báo lỗi phải chỉ rõ vị trí/lý do, ví dụ:

```text
Không tìm thấy trường `lifecycle_stage` trong thực thể Lead của nguồn CRM.
```

### FR-07. Cập nhật KPI Type và version hóa

KPI Type có thể được cập nhật bởi vai trò có quyền.

Quy tắc:

- Các thay đổi ảnh hưởng phép tính gồm `formula_expression`, data source, data entity, aggregation type, unit, direction, target mode phải tạo một **cấu hình phiên bản mới**.
- Version mới chỉ áp dụng cho KPI Assignment/Bộ KPI được tạo sau thời điểm hiệu lực, trừ khi có hành động migration được phê duyệt.
- Kết quả KPI đã chốt phải luôn truy xuất được cấu hình phiên bản đã được áp dụng tại thời điểm chấm.
- Không cho phép thay đổi code khi KPI Type đã có tham chiếu.
- Nếu thay đổi unit hoặc value_type đối với KPI Type đang được sử dụng, hệ thống phải cảnh báo tác động và yêu cầu tạo KPI Type mới hoặc version mới theo chính sách tenant.

### FR-08. Nhân bản KPI Type

Người dùng có quyền tạo có thể nhân bản KPI Type.

Khi nhân bản:

- Sao chép cấu hình nghiệp vụ, phạm vi, unit, hướng đo, target mode và data mapping.
- Không sao chép tham chiếu đến KPI Assignment, bộ KPI, điểm KPI hoặc lịch sử đồng bộ.
- Tên mặc định: `{Tên KPI Type cũ} - Bản sao`.
- Code phải nhập lại hoặc sinh gợi ý chưa tồn tại.
- Trạng thái mặc định: `DRAFT`.
- Công thức được sao chép dưới dạng version 1 của KPI Type mới.

### FR-09. Kích hoạt/ngừng sử dụng

Quy tắc trạng thái:

- `DRAFT`: Có thể lưu, chỉnh sửa và kiểm tra công thức; không hiển thị trong danh sách chọn KPI Type thông thường.
- `ACTIVE`: Được phép sử dụng để tạo chỉ tiêu KPI, mẫu KPI và bộ KPI theo phạm vi.
- `INACTIVE`: Không được dùng cho dữ liệu mới; vẫn được hiển thị trên lịch sử.

Điều kiện kích hoạt:

- Có Nhóm KPI Active.
- Đầy đủ name, code, direction, value_type, unit, target mode, scope.
- Nếu AUTO/HYBRID: công thức và nguồn dữ liệu hợp lệ.
- Không có lỗi validation chưa xử lý.

### FR-10. Xóa KPI Type

Hệ thống chỉ cho phép xóa mềm KPI Type khi không có tham chiếu bởi:

- KPI Template.
- KPI Assignment/KPI Instance.
- Bộ KPI.
- Chu kỳ đánh giá.
- Điểm KPI, báo cáo KPI hoặc bảng dữ liệu tổng hợp đã chốt.

Nếu đang có tham chiếu, hệ thống phải chặn xóa và đề xuất chuyển sang trạng thái Inactive.

### FR-11. Phạm vi áp dụng và hiển thị chọn KPI Type

Khi người dùng tạo Chỉ tiêu KPI hoặc Bộ KPI cho một KPI Owner, hệ thống chỉ hiển thị KPI Type khi đồng thời thỏa:

- Thuộc tenant hiện tại.
- Trạng thái `ACTIVE`.
- Nhóm KPI cha đang `ACTIVE`.
- Không bị xóa mềm.
- Phạm vi Organization, Department hoặc Position phù hợp KPI Owner.
- Người dùng có quyền xem/sử dụng KPI Type.

### FR-12. Audit Log

Các hành động sau phải ghi Audit Log:

- Tạo, chỉnh sửa, nhân bản.
- Thay đổi trạng thái.
- Xóa mềm và khôi phục.
- Cập nhật Nhóm KPI cha.
- Thay đổi hướng đo, đơn vị, mục tiêu, công thức, nguồn dữ liệu, phạm vi.
- Kiểm tra công thức và kết quả kiểm tra.
- Thay đổi thứ tự hiển thị.

---

## 7. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | KPI Type phải thuộc đúng một Nhóm KPI tại một thời điểm |
| BR-02 | Chỉ được gán vào Nhóm KPI Active; nếu Nhóm KPI cha Inactive thì KPI Type không thể kích hoạt |
| BR-03 | Code KPI Type là duy nhất trong phạm vi tenant, không phân biệt Nhóm KPI |
| BR-04 | Name KPI Type là duy nhất không phân biệt hoa thường trong tenant, trừ khi tenant bật chính sách cho phép trùng tên theo nhóm |
| BR-05 | KPI Type Active phải có tối thiểu một phạm vi áp dụng hợp lệ |
| BR-06 | `AUTO` và `HYBRID` bắt buộc có data source và công thức/aggregation hợp lệ |
| BR-07 | `MANUAL` bắt buộc cấu hình người/nhóm được phép nhập actual value tại phân hệ KPI Assignment |
| BR-08 | Hướng đo `INCREASE` dùng khi giá trị cao hơn là tốt hơn; `DECREASE` dùng khi giá trị thấp hơn là tốt hơn; `RANGE` dùng khi giá trị đạt khi nằm trong biên |
| BR-09 | Unit, value_type và số chữ số thập phân phải tương thích nhau |
| BR-10 | Formula expression phải được lưu theo version và không được sửa đè lịch sử đã sử dụng |
| BR-11 | Không thể xóa KPI Type đã phát sinh dữ liệu nghiệp vụ; chỉ được Inactive |
| BR-12 | KPI Type Inactive vẫn hiển thị read-only trong KPI/báo cáo lịch sử |
| BR-13 | Mọi truy xuất phải được cô lập dữ liệu theo tenant_id |
| BR-14 | Nếu nguồn dữ liệu bị ngắt kết nối, KPI Type AUTO vẫn giữ Active nhưng phải hiển thị trạng thái Data Health “Lỗi kết nối” và không được tạo kết quả giả |
| BR-15 | Nếu công thức có nguy cơ chia cho 0, hệ thống phải yêu cầu cấu hình fallback, ví dụ 0, N/A hoặc lỗi dữ liệu |
| BR-16 | Weight min/max là khuyến nghị/validation cho KPI Assignment; tổng trọng số được kiểm tra ở cấp Bộ KPI, không kiểm tra chỉ tại KPI Type |

---

## 8. Quy tắc validation

| Mã lỗi | Điều kiện | Thông báo đề xuất |
|---|---|---|
| `KPI_TYPE_GROUP_REQUIRED` | Chưa chọn Nhóm KPI | Vui lòng chọn Nhóm KPI |
| `KPI_TYPE_GROUP_INACTIVE` | Nhóm KPI cha Inactive | Không thể sử dụng Nhóm KPI đã ngừng hoạt động |
| `KPI_TYPE_CODE_REQUIRED` | Chưa nhập code | Vui lòng nhập mã KPI Type |
| `KPI_TYPE_CODE_INVALID` | Sai định dạng code | Mã chỉ gồm chữ in hoa, số và dấu gạch dưới |
| `KPI_TYPE_CODE_DUPLICATE` | Code đã tồn tại | Mã KPI Type đã tồn tại trong doanh nghiệp |
| `KPI_TYPE_NAME_REQUIRED` | Chưa nhập tên | Vui lòng nhập tên KPI Type |
| `KPI_TYPE_NAME_DUPLICATE` | Name trùng | Tên KPI Type đã tồn tại trong doanh nghiệp |
| `KPI_TYPE_UNIT_REQUIRED` | Chưa chọn unit | Vui lòng chọn đơn vị đo |
| `KPI_TYPE_TARGET_INVALID` | Mục tiêu/ngưỡng không hợp lệ | Kiểm tra lại thứ tự các ngưỡng mục tiêu theo hướng đo |
| `KPI_TYPE_RANGE_INVALID` | Khoảng mục tiêu không hợp lệ | Giới hạn dưới phải nhỏ hơn hoặc bằng giới hạn trên |
| `KPI_TYPE_AUTO_SOURCE_REQUIRED` | AUTO/HYBRID thiếu nguồn | Vui lòng chọn nguồn dữ liệu chính |
| `KPI_TYPE_FORMULA_REQUIRED` | AUTO/HYBRID thiếu công thức | Vui lòng nhập công thức hoặc cấu hình phép tổng hợp |
| `KPI_TYPE_FORMULA_INVALID` | Công thức lỗi | Công thức không hợp lệ. Vui lòng kiểm tra cú pháp hoặc trường dữ liệu |
| `KPI_TYPE_SCOPE_REQUIRED` | Chưa có phạm vi | Vui lòng chọn phạm vi áp dụng |
| `KPI_TYPE_WEIGHT_INVALID` | weight min/max sai | Trọng số tối thiểu phải nhỏ hơn hoặc bằng trọng số tối đa |
| `KPI_TYPE_DELETE_REFERENCED` | Có dữ liệu tham chiếu | Không thể xóa KPI Type đang được sử dụng. Hãy ngừng sử dụng thay vì xóa |
| `KPI_TYPE_VERSION_CONFLICT` | Đồng thời cập nhật | Dữ liệu đã được cập nhật bởi người dùng khác. Vui lòng tải lại và thử lại |

---

## 9. Luồng nghiệp vụ

### 9.1. Tạo KPI Type thủ công

1. Người dùng truy cập `KPI & Hiệu suất > Cấu hình > KPI Type`.
2. Người dùng chọn **Thêm KPI Type**.
3. Hệ thống hiển thị biểu mẫu tạo mới ở trạng thái Draft.
4. Người dùng chọn Nhóm KPI.
5. Hệ thống gợi ý hướng đo, đơn vị và nguồn dữ liệu theo cấu hình Nhóm KPI.
6. Người dùng nhập thông tin cơ bản, mục tiêu, phạm vi áp dụng và cách tính.
7. Nếu chọn AUTO/HYBRID, người dùng chọn nguồn dữ liệu và nhập công thức.
8. Người dùng có thể chọn **Kiểm tra công thức**.
9. Người dùng chọn `Lưu nháp` hoặc `Lưu & Kích hoạt`.
10. Hệ thống validate; nếu hợp lệ thì lưu, tạo version cấu hình đầu tiên, ghi Audit Log và thông báo thành công.

### 9.2. Kích hoạt KPI Type tự động

1. Người dùng mở KPI Type Draft.
2. Người dùng chọn `Lưu & Kích hoạt`.
3. Hệ thống kiểm tra Nhóm KPI cha, phạm vi, unit, mục tiêu, data source và công thức.
4. Hệ thống chạy validation công thức.
5. Nếu hợp lệ, trạng thái chuyển thành Active.
6. KPI Type xuất hiện trong biểu mẫu tạo Chỉ tiêu KPI phù hợp phạm vi.

### 9.3. Cập nhật công thức đang được sử dụng

1. Người dùng sửa công thức của KPI Type Active đã có KPI Assignment.
2. Hệ thống hiển thị cảnh báo: thay đổi sẽ tạo phiên bản cấu hình mới và không hồi tố dữ liệu đã chốt.
3. Người dùng xác nhận thời điểm hiệu lực.
4. Hệ thống tạo `KPI Type Version` mới.
5. Các KPI Assignment tạo sau thời điểm hiệu lực dùng version mới.
6. KPI Assignment đã tồn tại giữ version cũ, trừ khi người có quyền chạy migration.

### 9.4. Ngừng sử dụng KPI Type

1. Người dùng chọn `Ngừng sử dụng`.
2. Hệ thống hiển thị số lượng template, KPI Assignment và bộ KPI đang tham chiếu.
3. Người dùng xác nhận.
4. Hệ thống chuyển trạng thái KPI Type thành Inactive.
5. Hệ thống không cho chọn KPI Type này cho dữ liệu mới nhưng giữ nguyên lịch sử.

---

## 10. Yêu cầu UI/UX

### 10.1. Danh sách KPI Type

Thành phần bắt buộc:

- Breadcrumb: `KPI & Hiệu suất / Cấu hình / KPI Type`.
- Tiêu đề: `Thiết lập KPI Type`.
- Mô tả: `Chuẩn hóa loại chỉ tiêu, công thức và nguồn dữ liệu dùng cho KPI trong doanh nghiệp.`
- Nút: `+ Thêm KPI Type`.
- Nút phụ: `Nhập dữ liệu`, `Xuất dữ liệu` nếu tenant được bật quyền.
- Thẻ thống kê: Tổng KPI Type, Đang hoạt động, Bản nháp, Có đồng bộ tự động.
- Search bar và bộ lọc.
- Bảng dữ liệu với badge Nhóm KPI, nguồn dữ liệu và trạng thái.
- Context menu: Xem chi tiết, Chỉnh sửa, Nhân bản, Kiểm tra công thức, Ngừng sử dụng/Kích hoạt, Xóa.

### 10.2. Form tạo/cập nhật KPI Type

Bố cục desktop hai cột:

- Cột nội dung chính: 65–70%.
- Sidebar xem trước/validation: 30–35%.

Các section form:

1. **Thông tin cơ bản:** Nhóm KPI, mã, tên, viết tắt, mô tả.
2. **Đơn vị và hướng đo:** hướng đo, value type, đơn vị, decimal places.
3. **Mục tiêu mặc định:** kiểu mục tiêu, ngưỡng, mục tiêu, mức vượt, range.
4. **Cách tính & dữ liệu:** calculation mode, data source, entity, aggregation, formula, lịch đồng bộ.
5. **Phạm vi áp dụng:** organization/department/position, phòng ban và chức danh.
6. **Khuyến nghị trọng số & hiển thị:** weight min/max, thứ tự hiển thị, status.

Sidebar hiển thị:

- Preview card KPI Type.
- Tóm tắt Nhóm KPI cha, hướng đo, unit, cách tính và phạm vi.
- Kiểm tra điều kiện trước khi kích hoạt.
- Trạng thái công thức/data source.
- Gợi ý hệ thống, ví dụ chỉ số tương tự hoặc đơn vị phù hợp.

Thanh hành động cố định:

- `Hủy`.
- `Lưu nháp`.
- `Kiểm tra công thức` khi AUTO/HYBRID.
- `Lưu & Kích hoạt` hoặc `Lưu thay đổi`.

### 10.3. UX cho công thức

Formula editor phải hỗ trợ:

- Font monospace và syntax highlighting cơ bản.
- Chèn field/data entity từ bảng chọn bên cạnh hoặc autocomplete.
- Hiển thị format thân thiện của công thức.
- Hiển thị validation status: Chưa kiểm tra, Hợp lệ, Có lỗi, Không thể kết nối nguồn.
- Không cho phép hiển thị dữ liệu nhạy cảm/raw customer data trong preview nếu người dùng không có quyền.

---

## 11. Mô hình dữ liệu

### 11.1. Bảng `kpi_types`

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | Có | Khóa chính |
| `tenant_id` | UUID | Có | Tenant sở hữu dữ liệu |
| `kpi_group_id` | UUID | Có | Khóa ngoại đến `kpi_groups` |
| `code` | varchar(80) | Có | Mã KPI Type duy nhất trong tenant |
| `name` | varchar(150) | Có | Tên KPI Type |
| `short_name` | varchar(50) | Không | Tên viết tắt |
| `description` | varchar(1000) | Không | Mô tả nghiệp vụ |
| `direction` | enum | Có | INCREASE, DECREASE, RANGE |
| `value_type` | enum | Có | INTEGER, DECIMAL, PERCENTAGE, CURRENCY, DURATION, SCORE, BOOLEAN |
| `unit_id` | UUID | Có | Đơn vị đo |
| `decimal_places` | smallint | Có | 0–4 |
| `target_mode` | enum | Có | SINGLE_TARGET, THRESHOLD, RANGE |
| `minimum_target` | decimal(20,4) | Không | Ngưỡng tối thiểu |
| `default_target` | decimal(20,4) | Có | Mục tiêu mặc định |
| `stretch_target` | decimal(20,4) | Không | Mục tiêu vượt kỳ vọng |
| `lower_limit` | decimal(20,4) | Không | Cận dưới range |
| `upper_limit` | decimal(20,4) | Không | Cận trên range |
| `calculation_mode` | enum | Có | AUTO, MANUAL, HYBRID |
| `primary_data_source_id` | UUID | Không | Nguồn dữ liệu chính |
| `data_entity` | varchar(100) | Không | Đối tượng dữ liệu |
| `aggregation_type` | enum | Không | COUNT, SUM, AVG, RATE, DISTINCT_COUNT, CUSTOM |
| `formula_display` | text | Không | Diễn giải công thức |
| `sync_frequency` | enum | Không | REALTIME, HOURLY, DAILY, WEEKLY, MONTHLY |
| `timezone` | varchar(50) | Có | Múi giờ, mặc định từ tenant |
| `manual_evidence_required` | boolean | Có | Có bắt buộc minh chứng nhập tay hay không |
| `scope_type` | enum | Có | ORGANIZATION, DEPARTMENT, POSITION, CUSTOM |
| `weight_min` | decimal(5,2) | Không | Trọng số đề xuất tối thiểu |
| `weight_max` | decimal(5,2) | Không | Trọng số đề xuất tối đa |
| `display_order` | integer | Có | Thứ tự hiển thị |
| `status` | enum | Có | DRAFT, ACTIVE, INACTIVE |
| `is_system_default` | boolean | Có | Dữ liệu mẫu hệ thống |
| `current_version` | integer | Có | Version cấu hình hiện tại |
| `created_by` | UUID | Có | Người tạo |
| `created_at` | timestamptz | Có | Ngày tạo |
| `updated_by` | UUID | Có | Người cập nhật cuối |
| `updated_at` | timestamptz | Có | Ngày cập nhật cuối |
| `deleted_at` | timestamptz | Không | Soft delete timestamp |
| `deleted_by` | UUID | Không | Người xóa mềm |
| `row_version` | integer | Có | Optimistic locking |

### 11.2. Bảng `kpi_type_versions`

| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | UUID | Khóa chính |
| `tenant_id` | UUID | Tenant |
| `kpi_type_id` | UUID | KPI Type cha |
| `version_number` | integer | Số phiên bản, tăng dần |
| `effective_from` | timestamptz | Thời điểm có hiệu lực |
| `effective_to` | timestamptz/null | Thời điểm hết hiệu lực |
| `formula_expression` | text | Công thức machine-readable |
| `formula_display` | text | Công thức hiển thị |
| `data_source_snapshot` | jsonb | Snapshot nguồn/mapping dữ liệu |
| `target_config_snapshot` | jsonb | Snapshot mục tiêu/ngưỡng |
| `change_reason` | varchar(500) | Lý do thay đổi |
| `validation_status` | enum | NOT_TESTED, VALID, INVALID, CONNECTION_ERROR |
| `validation_result` | jsonb | Kết quả kiểm tra |
| `created_by` | UUID | Người tạo version |
| `created_at` | timestamptz | Thời điểm tạo |

### 11.3. Bảng quan hệ

| Bảng | Mục đích |
|---|---|
| `kpi_type_departments` | Gán KPI Type với phòng ban |
| `kpi_type_positions` | Gán KPI Type với chức danh |
| `kpi_type_data_sources` | Gán nhiều nguồn dữ liệu phụ nếu cần |
| `kpi_type_formulas` | Lưu thành phần công thức hoặc mapping field nếu không dùng `kpi_type_versions` trực tiếp |
| `kpi_type_usage_summary` | Bảng tổng hợp mức độ sử dụng để tối ưu truy vấn danh sách |
| `kpi_units` | Danh mục đơn vị đo |
| `audit_logs` | Nhật ký thao tác |

### 11.4. Ràng buộc và chỉ mục

- Unique partial index: `(tenant_id, code)` WHERE `deleted_at IS NULL`.
- Unique partial index: `(tenant_id, lower(name))` WHERE `deleted_at IS NULL`.
- Unique index: `(kpi_type_id, version_number)` trên `kpi_type_versions`.
- Index: `(tenant_id, kpi_group_id, status, display_order)`.
- Index: `(tenant_id, calculation_mode, status)`.
- Check: `decimal_places BETWEEN 0 AND 4`.
- Check: `weight_min >= 0 AND weight_min <= 100`.
- Check: `weight_max >= 0 AND weight_max <= 100`.
- Check: `weight_max IS NULL OR weight_min IS NULL OR weight_max >= weight_min`.

---

## 12. API đề xuất

### 12.1. Danh sách

`GET /api/v1/kpi-types`

Query parameters:

```text
page=1
page_size=20
q=mql
kpi_group_id={uuid}
status=ACTIVE
calculation_mode=AUTO
direction=INCREASE
department_id={uuid}
data_source_id={uuid}
sort=updated_at:desc
```

Response mẫu:

```json
{
  "data": [
    {
      "id": "9d9f062b-b74f-49d0-844d-b01d6e9d39a3",
      "code": "MQL_COUNT",
      "name": "Marketing Qualified Leads (MQL)",
      "short_name": "MQL",
      "description": "Số lượng khách hàng tiềm năng đạt tiêu chuẩn Marketing.",
      "kpi_group": {
        "id": "group-id",
        "code": "GROWTH_CONVERSION",
        "name": "Tăng trưởng & Chuyển đổi",
        "color": "#16B8A6"
      },
      "direction": "INCREASE",
      "value_type": "INTEGER",
      "unit": { "id": "unit-id", "code": "LEAD", "name": "Lead" },
      "calculation_mode": "AUTO",
      "data_source": { "id": "crm-id", "name": "CRM Lead Dashboard", "health": "HEALTHY" },
      "usage_count": 12,
      "status": "ACTIVE",
      "current_version": 2,
      "updated_at": "2026-09-03T20:30:00+07:00",
      "updated_by": { "id": "user-id", "name": "PTT Tuan" }
    }
  ],
  "meta": { "page": 1, "page_size": 20, "total": 46, "total_pages": 3 }
}
```

### 12.2. Tạo KPI Type

`POST /api/v1/kpi-types`

```json
{
  "kpi_group_id": "group-id",
  "code": "MQL_COUNT",
  "name": "Marketing Qualified Leads (MQL)",
  "short_name": "MQL",
  "description": "Số lượng khách hàng tiềm năng đạt tiêu chuẩn Marketing trong kỳ đánh giá.",
  "direction": "INCREASE",
  "value_type": "INTEGER",
  "unit_id": "lead-unit-id",
  "decimal_places": 0,
  "target_mode": "THRESHOLD",
  "minimum_target": 900,
  "default_target": 1200,
  "stretch_target": 1500,
  "calculation_mode": "AUTO",
  "primary_data_source_id": "crm-source-id",
  "data_entity": "Lead",
  "aggregation_type": "COUNT",
  "formula_expression": "COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)",
  "formula_display": "Đếm Lead có trạng thái vòng đời là MQL trong kỳ đánh giá",
  "sync_frequency": "DAILY",
  "timezone": "Asia/Ho_Chi_Minh",
  "manual_evidence_required": false,
  "scope_type": "DEPARTMENT",
  "department_ids": ["marketing-department-id"],
  "position_ids": ["marketing-leader-position-id"],
  "weight_min": 15,
  "weight_max": 35,
  "display_order": 1,
  "status": "DRAFT"
}
```

Response thành công: `201 Created`.

### 12.3. Chi tiết

`GET /api/v1/kpi-types/{id}`

### 12.4. Cập nhật

`PATCH /api/v1/kpi-types/{id}`

Header:

```text
If-Match: {row_version}
```

### 12.5. Kiểm tra công thức

`POST /api/v1/kpi-types/{id}/validate-formula`

```json
{
  "formula_expression": "COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)",
  "data_source_id": "crm-source-id",
  "test_period": {
    "from": "2026-07-01",
    "to": "2026-09-30",
    "timezone": "Asia/Ho_Chi_Minh"
  }
}
```

Response mẫu:

```json
{
  "validation_status": "VALID",
  "message": "Công thức hợp lệ.",
  "preview": {
    "value": 1084,
    "formatted_value": "1.084 Lead",
    "records_scanned": 1450,
    "calculated_at": "2026-09-03T21:00:00+07:00"
  }
}
```

### 12.6. Kích hoạt/ngừng sử dụng

`POST /api/v1/kpi-types/{id}/status`

```json
{
  "status": "ACTIVE",
  "effective_from": "2026-10-01T00:00:00+07:00",
  "reason": "Hoàn tất kiểm tra công thức và phê duyệt cấu hình"
}
```

### 12.7. Nhân bản

`POST /api/v1/kpi-types/{id}/duplicate`

```json
{
  "code": "MQL_COUNT_REAL_ESTATE",
  "name": "Marketing Qualified Leads (MQL) — Bất động sản"
}
```

### 12.8. Lịch sử phiên bản

`GET /api/v1/kpi-types/{id}/versions`

### 12.9. Xóa mềm

`DELETE /api/v1/kpi-types/{id}`

Response thành công: `204 No Content`.

---

## 13. Phân quyền

| Hành động | System Admin | Tenant Admin | HR/Performance | Data/BI Admin | Head Department | Marketing Leader | Employee |
|---|---:|---:|---:|---:|---:|---:|---:|
| Xem danh sách | Có | Có | Có | Có | Theo phạm vi | Theo phạm vi | Theo KPI được giao |
| Xem chi tiết | Có | Có | Có | Có | Theo phạm vi | Theo phạm vi | Theo KPI được giao |
| Tạo KPI Type | Có | Có | Theo quyền | Theo quyền | Theo quyền | Không mặc định | Không |
| Cập nhật thông tin | Có | Có | Theo quyền | Theo quyền | Không mặc định | Không | Không |
| Sửa công thức/mapping | Có | Theo quyền | Không mặc định | Có | Không | Không | Không |
| Kiểm tra công thức | Có | Có | Theo quyền | Có | Không mặc định | Không | Không |
| Kích hoạt/Ngừng dùng | Có | Có | Theo quyền | Theo quyền | Không | Không | Không |
| Nhân bản | Có | Có | Theo quyền | Theo quyền | Theo quyền | Không mặc định | Không |
| Xóa/Khôi phục | Có | Có theo policy | Không mặc định | Không mặc định | Không | Không | Không |
| Xem audit/version | Có | Có | Theo quyền | Có | Theo phạm vi | Không mặc định | Không |

---

## 14. Yêu cầu phi chức năng

### Hiệu năng

- API danh sách KPI Type đạt p95 không quá 700 ms với 20.000 KPI Type/tenant, có index và usage summary.
- API chi tiết đạt p95 không quá 500 ms, không bao gồm truy vấn preview nguồn dữ liệu ngoài.
- Kiểm tra cú pháp công thức mục tiêu p95 không quá 2 giây.
- Preview từ nguồn dữ liệu ngoài phải có timeout cấu hình được; mặc định 10 giây.

### Bảo mật

- Bắt buộc authentication, RBAC và tenant isolation tại service/repository layer.
- Không để formula preview trả về PII hoặc bản ghi customer cấp chi tiết nếu người dùng không có quyền data access.
- Mã hóa secret connector ở secret vault; API KPI Type không trả lại secret.
- Kiểm soát expression để ngăn chạy lệnh nguy hiểm, SQL injection, truy cập field bị cấm hoặc truy vấn không giới hạn.
- Log đầy đủ các thay đổi công thức, nguồn dữ liệu và kết quả validate.

### Tính tin cậy dữ liệu

- Cấu hình công thức và mapping phải version hóa, có hiệu lực theo thời gian.
- Kết quả chấm KPI phải lưu `kpi_type_version_id` để tái lập kết quả lịch sử.
- Khi connector lỗi, hiển thị data health rõ ràng; không tự thay thế actual value bằng 0.
- Đồng bộ dữ liệu phải có idempotency key, retry policy và dead-letter handling nếu triển khai async.

### Khả dụng

- Hỗ trợ desktop tối thiểu 1280 px; responsive tablet cơ bản.
- Form có autosave draft theo cấu hình tenant hoặc cảnh báo unsaved changes khi rời trang.
- Có loading, validation inline, error state, empty state, permission denied state và data source unavailable state.
- Các tín hiệu màu phải đi kèm text/icon để đáp ứng accessibility.

---

## 15. Tiêu chí nghiệm thu

| ID | Tiêu chí |
|---|---|
| AC-01 | Người có quyền có thể tạo KPI Type Draft thuộc một Nhóm KPI Active |
| AC-02 | Hệ thống tự gợi ý hướng đo và đơn vị theo Nhóm KPI đã chọn nhưng không ghi đè dữ liệu người dùng đã sửa khi chưa xác nhận |
| AC-03 | Không thể kích hoạt KPI Type nếu thiếu code, name, group, direction, unit, target mode hoặc phạm vi áp dụng |
| AC-04 | KPI Type AUTO/HYBRID không thể kích hoạt nếu chưa có nguồn dữ liệu/công thức hợp lệ |
| AC-05 | Chức năng Kiểm tra công thức phát hiện lỗi cú pháp, field không tồn tại và lỗi kết nối nguồn |
| AC-06 | KPI Type Active chỉ hiển thị khi tạo KPI nếu đúng tenant, Nhóm KPI cha Active và phù hợp phạm vi department/position |
| AC-07 | KPI Type Inactive không xuất hiện khi tạo mới nhưng vẫn hiển thị trong các dữ liệu lịch sử |
| AC-08 | Hệ thống chặn xóa KPI Type đã có template, KPI Assignment, bộ KPI hoặc điểm KPI tham chiếu |
| AC-09 | Khi công thức/unit/direction thay đổi trên KPI Type đang được dùng, hệ thống tạo version mới và không làm đổi dữ liệu đã chốt |
| AC-10 | Các thay đổi cấu hình, nguồn dữ liệu, công thức, trạng thái và version được ghi Audit Log đầy đủ |
| AC-11 | Tenant A không thể truy cập KPI Type của tenant B bằng URL hoặc API ID trực tiếp |
| AC-12 | Hệ thống phát hiện xung đột cập nhật đồng thời qua `row_version` và trả về `409 Conflict` |
| AC-13 | Danh sách hỗ trợ search, filter, sort, phân trang và hiển thị usage count đúng theo quyền |
| AC-14 | Data health lỗi phải được hiển thị rõ và không phát sinh giá trị KPI tự động không có căn cứ |

---

## 16. Phụ thuộc và lộ trình mở rộng

### Phụ thuộc bắt buộc

- Phân hệ Thiết lập Nhóm KPI.
- Danh mục đơn vị đo.
- Danh mục phòng ban, chức danh và cơ cấu tổ chức.
- User, tenant, RBAC/ABAC.
- Data Source/Connector Registry.
- Formula Engine/Metric Calculation Service.
- Audit Log và Versioning Service.
- Phân hệ Mẫu KPI, Bộ KPI, Chỉ tiêu KPI và Chu kỳ đánh giá.

### Lộ trình phát triển đề xuất

| Giai đoạn | Hạng mục |
|---|---|
| Phase 1 | CRUD KPI Type, mapping Nhóm KPI, unit, direction, target, scope, MANUAL mode, audit log |
| Phase 2 | AUTO/HYBRID mode, data source, formula validation, preview, versioning công thức |
| Phase 3 | Formula builder trực quan, catalog metric theo ngành, workflow phê duyệt, import/export |
| Phase 4 | AI đề xuất KPI Type, benchmark theo ngành, anomaly detection, gợi ý target/trọng số |

---

## 17. Gợi ý triển khai Clean Architecture

```text
src/
  domain/
    entities/
      kpi_type.ts
      kpi_type_version.ts
    value_objects/
      kpi_direction.ts
      kpi_target_config.ts
      formula_expression.ts
    repositories/
      kpi_type_repository.ts
  application/
    use_cases/
      create_kpi_type.ts
      update_kpi_type.ts
      validate_kpi_type_formula.ts
      activate_kpi_type.ts
      duplicate_kpi_type.ts
      deactivate_kpi_type.ts
    dto/
  infrastructure/
    persistence/
      postgres_kpi_type_repository.ts
    integrations/
      data_source_gateway.ts
      formula_engine_gateway.ts
    audit/
  presentation/
    http/
      kpi_type_controller.ts
      kpi_type_routes.ts
```

Nguyên tắc:

- Domain không phụ thuộc framework, database hay connector cụ thể.
- Formula Engine và Data Source Connector được inject qua port/interface.
- Versioning là domain concern, không thực hiện bằng trigger ngầm khó truy vết.
- Tenant context phải được truyền tường minh qua application layer.
- Authorization thực hiện trước use case và kiểm tra lại tenant scope trong repository.

---

## 18. Dữ liệu mẫu tạo KPI Type MQL

```json
{
  "kpi_group_code": "GROWTH_CONVERSION",
  "code": "MQL_COUNT",
  "name": "Marketing Qualified Leads (MQL)",
  "short_name": "MQL",
  "description": "Số lượng khách hàng tiềm năng đáp ứng tiêu chí đủ điều kiện Marketing trong kỳ đánh giá.",
  "direction": "INCREASE",
  "value_type": "INTEGER",
  "unit": "Lead",
  "decimal_places": 0,
  "target_mode": "THRESHOLD",
  "minimum_target": 900,
  "default_target": 1200,
  "stretch_target": 1500,
  "calculation_mode": "AUTO",
  "data_source": "CRM Lead Dashboard",
  "data_entity": "Lead",
  "aggregation_type": "COUNT",
  "formula_expression": "COUNT(Lead WHERE lifecycle_stage = 'MQL' AND created_at IN evaluation_period)",
  "formula_display": "Đếm Lead có trạng thái MQL được tạo trong kỳ đánh giá",
  "sync_frequency": "DAILY",
  "scope_type": "DEPARTMENT",
  "departments": ["Marketing"],
  "positions": ["Marketing Leader", "Digital Marketing Manager"],
  "weight_min": 15,
  "weight_max": 35,
  "status": "ACTIVE"
}
```

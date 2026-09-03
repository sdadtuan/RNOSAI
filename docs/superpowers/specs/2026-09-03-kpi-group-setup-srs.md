# SRS — Thiết lập Nhóm KPI

**Sản phẩm:** CRM / Marketing Performance Management  
**Phân hệ:** KPI & Hiệu suất  
**Chức năng:** Thiết lập Nhóm KPI  
**Phiên bản:** 1.0  
**Ngôn ngữ:** Tiếng Việt

---

## 1. Mục đích

Chức năng **Thiết lập Nhóm KPI** cho phép doanh nghiệp cấu hình danh mục chuẩn để phân loại các chỉ tiêu KPI trong toàn hệ thống. Nhóm KPI giúp chuẩn hóa báo cáo, phân bổ trọng số, áp dụng biểu mẫu KPI theo phòng ban/chức danh và phân quyền quản trị dữ liệu.

Trong bối cảnh Marketing, nhóm KPI hỗ trợ Leader Marketing, Head of Marketing và Ban Giám đốc theo dõi hiệu suất theo các trụ cột: tăng trưởng, chuyển đổi, ngân sách, doanh thu, thương hiệu, kênh số, chiến dịch, vận hành, giữ chân khách hàng và tự động hóa.

---

## 2. Phạm vi

### 2.1. Trong phạm vi

- Tạo, xem, tìm kiếm, lọc, cập nhật, kích hoạt/ngừng sử dụng Nhóm KPI.
- Thiết lập mã nhóm, tên, mô tả, màu sắc, biểu tượng, thứ tự hiển thị và trạng thái.
- Gán Nhóm KPI cho một hoặc nhiều phòng ban, chức danh hoặc mẫu KPI.
- Cấu hình hướng đo lường mặc định và nhóm dữ liệu nguồn đề xuất.
- Kiểm tra điều kiện xóa và lưu vết thay đổi.
- Quản trị danh mục dùng chung theo mô hình đa tenant.

### 2.2. Ngoài phạm vi phiên bản 1.0

- Tự động tạo chỉ tiêu KPI bằng AI.
- Đồng bộ trực tiếp dữ liệu KPI từ nền tảng quảng cáo, GA4 hoặc các hệ thống BI bên ngoài.
- Xây dựng công thức KPI phức tạp bằng giao diện kéo thả.
- Chấm điểm KPI, phê duyệt KPI và tính thưởng/phạt.

Các nội dung ngoài phạm vi có thể được phát triển ở các phân hệ: **Chỉ tiêu KPI**, **Chu kỳ đánh giá**, **Chấm điểm KPI**, **Kết nối dữ liệu** và **Báo cáo KPI**.

---

## 3. Đối tượng sử dụng

| Vai trò | Mô tả quyền chính |
|---|---|
| System Administrator | Quản lý nhóm KPI dùng chung toàn hệ thống hoặc cấu hình mặc định theo tenant |
| Tenant Administrator | Toàn quyền tạo, sửa, kích hoạt, ngừng dùng và sắp xếp nhóm KPI trong doanh nghiệp |
| HR / Performance Manager | Tạo, chỉnh sửa và tra cứu nhóm KPI theo phạm vi được phân quyền |
| Head of Department | Chỉ xem và sử dụng các nhóm KPI được áp dụng cho phòng ban của mình; có thể được cấp quyền đề xuất nhóm mới |
| Marketing Leader | Xem và chọn Nhóm KPI khi tạo chỉ tiêu/bộ KPI trong phạm vi phòng Marketing |
| Employee | Chỉ xem Nhóm KPI liên quan đến KPI được giao |

---

## 4. Thuật ngữ

| Thuật ngữ | Diễn giải |
|---|---|
| KPI | Key Performance Indicator — chỉ số đánh giá hiệu suất then chốt |
| Nhóm KPI | Danh mục cấp cao dùng để phân loại các chỉ tiêu KPI theo mục tiêu quản trị |
| Chỉ tiêu KPI | KPI cụ thể có mục tiêu, đơn vị, trọng số, kỳ đánh giá và cách đo |
| Bộ KPI | Tập hợp các chỉ tiêu KPI được giao cho một cá nhân, nhóm hoặc vị trí trong một chu kỳ |
| KPI Type | Loại chỉ tiêu cụ thể trong một Nhóm KPI, ví dụ: MQL, CPL, ROAS, Organic Traffic |
| Tenant | Một doanh nghiệp/đơn vị độc lập sử dụng hệ thống CRM đa tenant |
| Soft Delete | Đánh dấu bản ghi đã xóa mà không xóa vật lý khỏi cơ sở dữ liệu |

---

## 5. Danh mục Nhóm KPI mặc định

Hệ thống có thể khởi tạo bộ danh mục mặc định cho phòng Marketing. Tenant Administrator có thể đổi tên, điều chỉnh mô tả, ngừng sử dụng hoặc tạo nhóm riêng theo chính sách doanh nghiệp.

| Mã | Tên nhóm | Mục tiêu quản trị | Ví dụ KPI |
|---|---|---|---|
| `GROWTH_CONVERSION` | Tăng trưởng & Chuyển đổi | Biến tiếp cận/traffic thành lead, MQL, SQL, cơ hội và khách hàng | Leads, MQL, SQL, conversion rate, booking rate |
| `DEMAND_ACQUISITION` | Tạo nhu cầu & Thu hút khách hàng | Tạo khách hàng tiềm năng mới theo nguồn và chiến dịch | New leads, website traffic, form submissions, event registrations |
| `BUDGET_EFFICIENCY` | Hiệu quả ngân sách | Kiểm soát chi phí và hiệu suất đầu tư Marketing | CPL, CPA, CAC, CPC, CPM, ROAS |
| `REVENUE_PIPELINE` | Doanh thu & Pipeline | Liên kết Marketing với pipeline và doanh thu | Marketing-sourced revenue, influenced revenue, pipeline generated |
| `BRAND_AWARENESS` | Thương hiệu & Độ nhận biết | Theo dõi mức độ hiện diện và sức khỏe thương hiệu | Reach, share of voice, branded search, brand mentions |
| `DIGITAL_CHANNEL` | Hiệu quả kênh số | Theo dõi hiệu quả website, SEO, paid media, email, social | Organic traffic, CTR, engagement, email click rate |
| `CONTENT_CAMPAIGN` | Nội dung & Chiến dịch | Theo dõi hiệu quả, chất lượng và tiến độ nội dung/campaign | Content engagement, campaign conversion, campaign on-time rate |
| `CUSTOMER_RETENTION` | Giữ chân & Phát triển khách hàng | Đo duy trì, tái mua, giới thiệu và khai thác khách hàng hiện hữu | Retention, churn, repeat purchase, NPS, referral |
| `OPERATIONS_GOVERNANCE` | Vận hành & Quản trị | Đo năng lực điều hành, phối hợp, tuân thủ và chất lượng dữ liệu | On-time campaign rate, SLA lead handling, CRM data completeness |
| `INNOVATION_AUTOMATION` | Đổi mới & Tự động hóa | Đo hiệu quả triển khai automation, CRM và AI trong Marketing | Automation coverage, workflow deployment, time saved, conversion uplift |

---

## 6. Yêu cầu chức năng

### FR-01. Danh sách Nhóm KPI

Hệ thống phải cung cấp màn hình danh sách Nhóm KPI trong phân hệ **KPI & Hiệu suất > Cấu hình > Nhóm KPI**.

Danh sách phải hiển thị tối thiểu các cột:

| Trường | Mô tả |
|---|---|
| Thứ tự | Thứ tự hiển thị của nhóm |
| Mã nhóm | Mã định danh duy nhất trong tenant |
| Tên nhóm | Tên hiển thị của Nhóm KPI |
| Phòng ban áp dụng | Danh sách hoặc số lượng phòng ban được áp dụng |
| Chỉ tiêu đang sử dụng | Số lượng KPI Type/KPI đang tham chiếu nhóm |
| Trạng thái | Đang hoạt động hoặc Ngừng sử dụng |
| Cập nhật gần nhất | Thời điểm và người cập nhật cuối cùng |
| Thao tác | Xem, Chỉnh sửa, Nhân bản, Kích hoạt/Ngừng sử dụng, Xóa |

Hệ thống phải hỗ trợ:

- Phân trang, mặc định 20 bản ghi/trang.
- Thay đổi số lượng bản ghi: 20, 50, 100.
- Sắp xếp theo thứ tự hiển thị, tên, trạng thái, ngày cập nhật.
- Tìm kiếm theo mã, tên và mô tả.
- Lọc theo phòng ban, trạng thái, loại phạm vi và ngày tạo/cập nhật.
- Hiển thị trạng thái rỗng khi chưa có dữ liệu.

### FR-02. Tạo Nhóm KPI

Người dùng có quyền phù hợp phải có thể chọn nút **Thêm Nhóm KPI** để mở màn hình hoặc modal tạo mới.

Các trường dữ liệu:

| Mã trường | Trường | Kiểu dữ liệu | Bắt buộc | Quy tắc |
|---|---|---|---|---|
| `code` | Mã nhóm KPI | Text/slug | Có | 3–50 ký tự, chữ in hoa, số và dấu gạch dưới; duy nhất trong tenant |
| `name` | Tên nhóm KPI | Text | Có | 3–100 ký tự; duy nhất không phân biệt hoa thường trong tenant |
| `description` | Mô tả | Textarea | Không | Tối đa 500 ký tự |
| `department_scope` | Phòng ban áp dụng | Multi-select | Có | Chọn ít nhất một phòng ban hoặc chọn phạm vi Toàn doanh nghiệp |
| `job_position_scope` | Chức danh áp dụng | Multi-select | Không | Chỉ hiển thị chức danh thuộc phòng ban đã chọn |
| `default_direction` | Hướng đo mặc định | Select | Có | Tăng dần, Giảm dần, Duy trì trong ngưỡng |
| `suggested_unit_types` | Loại đơn vị đề xuất | Multi-select | Không | Số lượng, %, VNĐ, điểm, giờ, ngày, khách hàng, lead, lượt |
| `data_domain` | Miền dữ liệu nguồn | Multi-select | Không | CRM, Marketing Automation, Ads, Website/SEO, Social, Survey, Manual |
| `color` | Màu nhận diện | Color picker | Có | Giá trị HEX hợp lệ, mặc định theo design system |
| `icon` | Biểu tượng | Icon selector | Không | Chọn từ thư viện icon được hệ thống hỗ trợ |
| `display_order` | Thứ tự hiển thị | Integer | Có | Số nguyên dương; mặc định tự sinh ở cuối danh sách |
| `status` | Trạng thái | Select | Có | Draft, Active, Inactive; mặc định Draft |

Sau khi lưu thành công:

- Hệ thống tạo bản ghi Nhóm KPI.
- Hệ thống ghi Audit Log.
- Người dùng được chuyển về trang chi tiết hoặc danh sách và nhận thông báo thành công.
- Nhóm ở trạng thái `Draft` không được chọn khi tạo bộ KPI chính thức, trừ người có quyền quản trị.

### FR-03. Cập nhật Nhóm KPI

Người dùng có quyền chỉnh sửa phải có thể cập nhật các trường cấu hình của Nhóm KPI.

Quy tắc:

- Không được thay đổi `tenant_id` và `id`.
- `code` chỉ được phép chỉnh sửa khi nhóm chưa được tham chiếu bởi KPI Type, KPI instance, mẫu KPI hoặc báo cáo đã khóa.
- Nếu nhóm đã được sử dụng, người dùng vẫn có thể đổi tên, mô tả, màu, biểu tượng, thứ tự, phạm vi áp dụng và trạng thái theo quyền.
- Khi thay đổi phạm vi phòng ban/chức danh, hệ thống phải cảnh báo số lượng bộ KPI hoặc KPI Type có thể bị ảnh hưởng.
- Việc cập nhật không được làm thay đổi lịch sử đánh giá KPI đã chốt.

### FR-04. Xem chi tiết Nhóm KPI

Màn hình chi tiết phải hiển thị:

- Thông tin cấu hình hiện tại.
- Trạng thái và phạm vi áp dụng.
- Số lượng KPI Type, chỉ tiêu KPI, bộ KPI và báo cáo đang tham chiếu.
- Danh sách chỉ tiêu KPI thuộc nhóm, nếu người dùng có quyền xem.
- Lịch sử thay đổi gần nhất: thời gian, người thực hiện, hành động, dữ liệu trước/sau ở mức trường.

### FR-05. Kích hoạt và ngừng sử dụng

Người dùng có quyền quản trị phải có thể chuyển trạng thái nhóm:

- `Draft` → `Active`.
- `Active` → `Inactive`.
- `Inactive` → `Active`.

Quy tắc:

- Nhóm `Active` được phép chọn trong biểu mẫu tạo KPI, mẫu KPI và bộ KPI nếu phù hợp phạm vi áp dụng.
- Nhóm `Inactive` không được phép chọn cho dữ liệu mới.
- Nhóm `Inactive` vẫn phải được hiển thị đầy đủ trên KPI/bộ KPI lịch sử đã tham chiếu.
- Khi ngừng sử dụng một nhóm đang có KPI/bộ KPI ở trạng thái Draft, hệ thống phải hiển thị cảnh báo và yêu cầu người dùng xác nhận.

### FR-06. Xóa Nhóm KPI

Hệ thống chỉ cho phép xóa mềm Nhóm KPI khi nhóm chưa được tham chiếu bởi:

- KPI Type.
- Mẫu KPI.
- Chỉ tiêu KPI cá nhân/nhóm.
- Bộ KPI.
- Chu kỳ chấm điểm hoặc báo cáo KPI.

Nếu có tham chiếu, hệ thống phải chặn xóa và hiển thị thông báo:

> Nhóm KPI này đang được sử dụng bởi {n} dữ liệu. Hãy ngừng sử dụng thay vì xóa, hoặc chuyển các dữ liệu liên quan sang nhóm khác.

System Administrator có thể khôi phục bản ghi đã xóa mềm trong thời hạn cấu hình của tenant.

### FR-07. Nhân bản Nhóm KPI

Người dùng có quyền tạo phải có thể nhân bản một Nhóm KPI.

Khi nhân bản:

- Sao chép toàn bộ thông tin cấu hình, trừ `id`, `code`, `name`, `status`, audit fields.
- `name` mặc định là: `{Tên cũ} - Bản sao`.
- `code` phải do người dùng nhập lại hoặc được hệ thống gợi ý mã chưa tồn tại.
- `status` mặc định là `Draft`.
- Không sao chép các quan hệ lịch sử như KPI instance, bộ KPI, điểm đánh giá hoặc audit log.

### FR-08. Sắp xếp thứ tự hiển thị

Hệ thống phải hỗ trợ thay đổi `display_order` bằng một trong hai cơ chế:

- Nhập số thứ tự trong form.
- Kéo thả trong danh sách đối với người dùng có quyền cấu hình.

Khi thay đổi thứ tự, hệ thống phải tự động điều chỉnh thứ tự của các nhóm liên quan để tránh trùng lặp.

### FR-09. Phạm vi áp dụng

Nhóm KPI phải hỗ trợ một trong các loại phạm vi sau:

| Giá trị | Diễn giải |
|---|---|
| `ORGANIZATION` | Áp dụng toàn doanh nghiệp trong tenant |
| `DEPARTMENT` | Áp dụng cho một hoặc nhiều phòng ban |
| `POSITION` | Áp dụng cho một hoặc nhiều chức danh |
| `CUSTOM` | Áp dụng theo quy tắc tùy chỉnh, cần quyền quản trị cao |

Quy tắc hiển thị khi tạo chỉ tiêu KPI:

- Người dùng chỉ thấy nhóm `Active` thuộc tenant hiện tại.
- Nhóm có phạm vi `ORGANIZATION` luôn được hiển thị.
- Nhóm có phạm vi `DEPARTMENT` chỉ hiển thị nếu KPI Owner thuộc phòng ban đã được gán.
- Nhóm có phạm vi `POSITION` chỉ hiển thị nếu KPI Owner có chức danh tương ứng.
- System Administrator và Tenant Administrator có thể xem toàn bộ nhóm.

### FR-10. Kiểm tra hợp lệ dữ liệu

Hệ thống phải kiểm tra dữ liệu tại giao diện và phía máy chủ.

| Mã lỗi | Điều kiện | Thông báo đề xuất |
|---|---|---|
| `KPI_GROUP_CODE_REQUIRED` | Không nhập mã | Vui lòng nhập mã Nhóm KPI |
| `KPI_GROUP_CODE_INVALID` | Mã sai định dạng | Mã chỉ gồm chữ in hoa, số và dấu gạch dưới |
| `KPI_GROUP_CODE_DUPLICATE` | Mã đã tồn tại | Mã Nhóm KPI đã tồn tại trong doanh nghiệp |
| `KPI_GROUP_NAME_REQUIRED` | Không nhập tên | Vui lòng nhập tên Nhóm KPI |
| `KPI_GROUP_NAME_DUPLICATE` | Tên trùng | Tên Nhóm KPI đã tồn tại trong doanh nghiệp |
| `KPI_GROUP_SCOPE_REQUIRED` | Không chọn phạm vi | Vui lòng chọn phạm vi hoặc phòng ban áp dụng |
| `KPI_GROUP_DIRECTION_REQUIRED` | Không chọn hướng đo | Vui lòng chọn hướng đo mặc định |
| `KPI_GROUP_ORDER_INVALID` | Thứ tự không hợp lệ | Thứ tự hiển thị phải là số nguyên dương |
| `KPI_GROUP_DELETE_REFERENCED` | Có dữ liệu tham chiếu | Không thể xóa Nhóm KPI đang được sử dụng |

### FR-11. Audit Log

Mọi hành động tạo, cập nhật, kích hoạt, ngừng sử dụng, xóa mềm, khôi phục và thay đổi thứ tự phải được ghi log.

Audit Log tối thiểu gồm:

| Trường | Mô tả |
|---|---|
| `id` | Định danh log |
| `tenant_id` | Tenant phát sinh thao tác |
| `entity_type` | `KPI_GROUP` |
| `entity_id` | ID Nhóm KPI |
| `action` | CREATE, UPDATE, ACTIVATE, INACTIVATE, DELETE, RESTORE, REORDER |
| `before_data` | Dữ liệu trước khi thay đổi ở dạng JSON |
| `after_data` | Dữ liệu sau khi thay đổi ở dạng JSON |
| `performed_by` | Người thực hiện |
| `performed_at` | Thời điểm thực hiện |
| `ip_address` | IP nguồn nếu hệ thống thu thập |
| `request_id` | Mã truy vết request |

---

## 7. Luồng nghiệp vụ

### 7.1. Luồng tạo Nhóm KPI

1. Người dùng truy cập **KPI & Hiệu suất > Cấu hình > Nhóm KPI**.
2. Người dùng chọn **Thêm Nhóm KPI**.
3. Hệ thống hiển thị biểu mẫu tạo mới.
4. Người dùng nhập thông tin và chọn phạm vi áp dụng.
5. Người dùng chọn **Lưu nháp** hoặc **Kích hoạt**.
6. Hệ thống kiểm tra dữ liệu hợp lệ.
7. Nếu hợp lệ, hệ thống lưu dữ liệu, ghi audit log và thông báo thành công.
8. Nếu không hợp lệ, hệ thống hiển thị lỗi tại trường tương ứng và không lưu.

### 7.2. Luồng ngừng sử dụng Nhóm KPI

1. Người dùng chọn thao tác **Ngừng sử dụng** trên một nhóm đang Active.
2. Hệ thống kiểm tra dữ liệu đang tham chiếu.
3. Hệ thống hiển thị số lượng dữ liệu bị ảnh hưởng và hộp xác nhận.
4. Người dùng xác nhận.
5. Hệ thống chuyển trạng thái thành `Inactive`.
6. Hệ thống ghi audit log.
7. Hệ thống chặn việc chọn nhóm này trong các biểu mẫu tạo dữ liệu mới.

### 7.3. Luồng xóa Nhóm KPI

1. Người dùng chọn **Xóa**.
2. Hệ thống kiểm tra quan hệ tham chiếu.
3. Nếu chưa có tham chiếu, hệ thống hiển thị xác nhận xóa.
4. Người dùng xác nhận xóa.
5. Hệ thống thực hiện soft delete và ghi audit log.
6. Nếu có tham chiếu, hệ thống chặn xóa và hướng dẫn ngừng sử dụng hoặc chuyển nhóm.

---

## 8. Yêu cầu giao diện

### 8.1. Màn hình danh sách

Thành phần giao diện:

- Breadcrumb: `KPI & Hiệu suất / Cấu hình / Nhóm KPI`.
- Tiêu đề: `Nhóm KPI`.
- Mô tả: `Chuẩn hóa danh mục phân loại chỉ tiêu và phạm vi áp dụng KPI trong doanh nghiệp.`
- Nút chính: `+ Thêm Nhóm KPI`.
- Ô tìm kiếm: `Tìm theo mã, tên hoặc mô tả...`.
- Bộ lọc: Trạng thái, Phòng ban, Phạm vi áp dụng.
- Bảng dữ liệu danh sách.
- Badge trạng thái: Draft, Đang hoạt động, Ngừng sử dụng.

### 8.2. Màn hình tạo/cập nhật

Bố cục đề xuất gồm hai cột:

- Cột trái 65–70%: biểu mẫu thông tin chính.
- Cột phải 30–35%: tóm tắt cấu hình, gợi ý hệ thống và trạng thái sử dụng.

Các khu vực chính:

1. Thông tin cơ bản.
2. Phạm vi áp dụng.
3. Thiết lập đo lường mặc định.
4. Nhận diện và hiển thị.
5. Trạng thái và thao tác.

Thanh hành động cố định cuối màn hình:

- `Hủy`.
- `Lưu nháp`.
- `Lưu & Kích hoạt` hoặc `Lưu thay đổi`.

### 8.3. Trạng thái rỗng

Khi không có Nhóm KPI, hiển thị:

- Tiêu đề: `Chưa có Nhóm KPI nào`.
- Mô tả: `Tạo nhóm KPI để chuẩn hóa cách phân loại chỉ tiêu và báo cáo hiệu suất.`
- CTA: `Tạo Nhóm KPI đầu tiên`.

---

## 9. Yêu cầu dữ liệu

### 9.1. Thực thể KPI Group

| Trường | Kiểu | Bắt buộc | Mô tả |
|---|---|---|---|
| `id` | UUID | Có | Khóa chính |
| `tenant_id` | UUID | Có | Tenant sở hữu dữ liệu |
| `parent_id` | UUID/null | Không | Hỗ trợ phân cấp nhóm trong tương lai |
| `code` | varchar(50) | Có | Mã duy nhất trong tenant |
| `name` | varchar(100) | Có | Tên Nhóm KPI |
| `description` | varchar(500) | Không | Mô tả nghiệp vụ |
| `scope_type` | enum | Có | ORGANIZATION, DEPARTMENT, POSITION, CUSTOM |
| `default_direction` | enum | Có | INCREASE, DECREASE, RANGE |
| `color` | varchar(7) | Có | Mã màu HEX |
| `icon` | varchar(100) | Không | Tên biểu tượng |
| `display_order` | integer | Có | Thứ tự hiển thị |
| `status` | enum | Có | DRAFT, ACTIVE, INACTIVE |
| `is_system_default` | boolean | Có | Đánh dấu dữ liệu mẫu do hệ thống khởi tạo |
| `created_by` | UUID | Có | Người tạo |
| `created_at` | timestamptz | Có | Thời điểm tạo |
| `updated_by` | UUID | Có | Người cập nhật gần nhất |
| `updated_at` | timestamptz | Có | Thời điểm cập nhật |
| `deleted_at` | timestamptz/null | Không | Thời điểm xóa mềm |
| `deleted_by` | UUID/null | Không | Người xóa mềm |
| `row_version` | integer | Có | Hỗ trợ optimistic locking |

### 9.2. Bảng quan hệ đề xuất

| Bảng | Mục đích |
|---|---|
| `kpi_group_departments` | Liên kết Nhóm KPI với phòng ban |
| `kpi_group_positions` | Liên kết Nhóm KPI với chức danh |
| `kpi_group_unit_types` | Liên kết Nhóm KPI với loại đơn vị đề xuất |
| `kpi_group_data_domains` | Liên kết Nhóm KPI với miền dữ liệu nguồn |
| `kpi_types` | Loại chỉ tiêu KPI thuộc Nhóm KPI |
| `kpi_templates` | Mẫu Bộ KPI có tham chiếu Nhóm KPI/KPI Type |
| `audit_logs` | Nhật ký thay đổi |

### 9.3. Ràng buộc dữ liệu

- Unique index: `(tenant_id, code)` với điều kiện `deleted_at IS NULL`.
- Unique index: `(tenant_id, lower(name))` với điều kiện `deleted_at IS NULL`.
- Index đề xuất: `(tenant_id, status, display_order)`.
- Index đề xuất: `(tenant_id, scope_type)`.
- `display_order > 0`.
- `color` phải khớp định dạng HEX `#RRGGBB`.

---

## 10. API đề xuất

### 10.1. Danh sách Nhóm KPI

`GET /api/v1/kpi-groups`

Query parameters:

```text
page=1
page_size=20
q=chuyen-doi
status=ACTIVE
department_id={uuid}
scope_type=DEPARTMENT
sort=display_order:asc
include_inactive=false
```

Response mẫu:

```json
{
  "data": [
    {
      "id": "d6a238ee-832a-4b07-90d3-33bc6f829c04",
      "code": "GROWTH_CONVERSION",
      "name": "Tăng trưởng & Chuyển đổi",
      "description": "Đo hiệu quả tạo và chuyển đổi khách hàng tiềm năng.",
      "scope_type": "DEPARTMENT",
      "departments": [
        { "id": "marketing-id", "name": "Marketing" }
      ],
      "default_direction": "INCREASE",
      "color": "#17B6A4",
      "icon": "trending-up",
      "display_order": 1,
      "status": "ACTIVE",
      "usage_count": 12,
      "updated_at": "2026-09-03T18:00:00+07:00",
      "updated_by": {
        "id": "user-id",
        "name": "PTT Tuan"
      }
    }
  ],
  "meta": {
    "page": 1,
    "page_size": 20,
    "total": 10,
    "total_pages": 1
  }
}
```

### 10.2. Tạo Nhóm KPI

`POST /api/v1/kpi-groups`

Request mẫu:

```json
{
  "code": "GROWTH_CONVERSION",
  "name": "Tăng trưởng & Chuyển đổi",
  "description": "Đo hiệu quả tạo và chuyển đổi khách hàng tiềm năng trong phễu Marketing.",
  "scope_type": "DEPARTMENT",
  "department_ids": ["marketing-id"],
  "position_ids": ["marketing-leader-position-id"],
  "default_direction": "INCREASE",
  "suggested_unit_types": ["LEAD", "PERCENT", "CURRENCY"],
  "data_domains": ["CRM", "MARKETING_AUTOMATION", "ADS"],
  "color": "#17B6A4",
  "icon": "trending-up",
  "display_order": 1,
  "status": "ACTIVE"
}
```

Response thành công: `201 Created`.

### 10.3. Chi tiết Nhóm KPI

`GET /api/v1/kpi-groups/{id}`

### 10.4. Cập nhật Nhóm KPI

`PATCH /api/v1/kpi-groups/{id}`

Header đề xuất:

```text
If-Match: {row_version}
```

Response xung đột cập nhật đồng thời: `409 Conflict`.

### 10.5. Thay đổi trạng thái

`POST /api/v1/kpi-groups/{id}/status`

```json
{
  "status": "INACTIVE",
  "reason": "Chuẩn bị hợp nhất với nhóm Hiệu quả kênh số"
}
```

### 10.6. Nhân bản

`POST /api/v1/kpi-groups/{id}/duplicate`

```json
{
  "code": "GROWTH_CONVERSION_SPA",
  "name": "Tăng trưởng & Chuyển đổi — Spa"
}
```

### 10.7. Cập nhật thứ tự

`PUT /api/v1/kpi-groups/display-order`

```json
{
  "items": [
    { "id": "id-1", "display_order": 1 },
    { "id": "id-2", "display_order": 2 }
  ]
}
```

### 10.8. Xóa mềm

`DELETE /api/v1/kpi-groups/{id}`

Response thành công: `204 No Content`.

---

## 11. Phân quyền

| Hành động | System Admin | Tenant Admin | HR/Performance | Head of Department | Marketing Leader | Employee |
|---|---:|---:|---:|---:|---:|---:|
| Xem danh sách | Có | Có | Có | Theo phạm vi | Theo phạm vi | Theo KPI được giao |
| Xem chi tiết | Có | Có | Có | Theo phạm vi | Theo phạm vi | Theo KPI được giao |
| Tạo | Có | Có | Có nếu được cấp quyền | Đề xuất nếu được cấp quyền | Không mặc định | Không |
| Chỉnh sửa | Có | Có | Có nếu được cấp quyền | Không mặc định | Không | Không |
| Kích hoạt/ngừng dùng | Có | Có | Có nếu được cấp quyền | Không | Không | Không |
| Xóa/khôi phục | Có | Có theo chính sách tenant | Không mặc định | Không | Không | Không |
| Sắp xếp | Có | Có | Có nếu được cấp quyền | Không | Không | Không |

Mọi kiểm soát quyền phải được thực hiện cả ở giao diện và API. Không dựa vào việc ẩn nút trên UI để bảo vệ dữ liệu.

---

## 12. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-01 | Mã và tên Nhóm KPI phải là duy nhất trong từng tenant, không áp dụng uniqueness toàn hệ thống |
| BR-02 | Một Nhóm KPI chỉ có thể được chọn khi trạng thái là Active |
| BR-03 | Nhóm Inactive vẫn hiển thị trên dữ liệu lịch sử để đảm bảo tính toàn vẹn báo cáo |
| BR-04 | Không được xóa Nhóm KPI đã có bất kỳ dữ liệu tham chiếu nào |
| BR-05 | Thay đổi Nhóm KPI không được làm thay đổi dữ liệu điểm KPI đã khóa/chốt |
| BR-06 | Danh sách nhóm hiển thị cho người dùng phải tuân theo tenant, phòng ban, chức danh và quyền truy cập |
| BR-07 | Nếu không nhập display_order, hệ thống tự gán giá trị lớn nhất hiện có + 1 trong tenant |
| BR-08 | Khi đổi trạng thái sang Inactive, hệ thống phải cảnh báo số KPI Draft, template và bộ KPI chưa chốt đang tham chiếu |
| BR-09 | Dữ liệu mẫu `is_system_default = true` chỉ System Administrator mới được phép sửa mã; Tenant Administrator có thể override bằng cấu hình tenant nếu chính sách cho phép |
| BR-10 | Khi nhân bản, nhóm mới luôn ở trạng thái Draft để tránh được sử dụng ngay khi chưa được kiểm tra |
| BR-11 | Nếu chọn scope_type = ORGANIZATION thì không bắt buộc department_ids hoặc position_ids |
| BR-12 | Nếu chọn scope_type = POSITION thì phải chọn tối thiểu một phòng ban hoặc một chức danh theo mô hình tổ chức đã cấu hình |

---

## 13. Yêu cầu phi chức năng

### 13.1. Hiệu năng

- API danh sách Nhóm KPI có thời gian phản hồi mục tiêu p95 không quá 500 ms với 10.000 bản ghi/tenant.
- API tạo/cập nhật có thời gian phản hồi mục tiêu p95 không quá 800 ms, không bao gồm dịch vụ audit bất đồng bộ nếu có.
- Tìm kiếm theo mã hoặc tên phải phản hồi trong tối đa 1 giây ở điều kiện tải thông thường.

### 13.2. Bảo mật

- Bắt buộc xác thực người dùng trước khi truy cập API.
- Mọi truy vấn phải lọc bắt buộc theo `tenant_id` ở tầng repository/data access.
- Áp dụng RBAC và, nếu cần, ABAC theo phòng ban/chức danh.
- Mã hóa dữ liệu trên đường truyền bằng TLS.
- Chống IDOR: không cho phép truy cập bản ghi khác tenant thông qua ID.
- Audit log không được cho phép người dùng nghiệp vụ sửa/xóa trực tiếp.

### 13.3. Tính nhất quán

- Sử dụng transaction cho thao tác tạo/cập nhật nhóm và các bảng quan hệ.
- Sử dụng optimistic locking thông qua `row_version` hoặc `updated_at` để tránh ghi đè khi nhiều người dùng chỉnh sửa.
- Thao tác thay đổi thứ tự nhiều bản ghi phải là atomic transaction.

### 13.4. Khả dụng và trải nghiệm

- Hỗ trợ giao diện desktop từ 1280 px trở lên; tablet responsive ở mức tối thiểu.
- Có loading state, empty state, error state và success notification.
- Các trường bắt buộc phải có ký hiệu `*` và thông báo lỗi rõ ràng bằng tiếng Việt.
- Màu trạng thái không phải là tín hiệu duy nhất; phải kèm nhãn văn bản để hỗ trợ khả năng tiếp cận.

---

## 14. Tiêu chí nghiệm thu

| ID | Tiêu chí nghiệm thu |
|---|---|
| AC-01 | Tenant Administrator có thể tạo Nhóm KPI với đầy đủ trường bắt buộc và lưu thành công |
| AC-02 | Hệ thống chặn tạo mới khi code hoặc name trùng trong cùng tenant |
| AC-03 | Người dùng không thể lưu nếu thiếu phạm vi áp dụng hoặc hướng đo mặc định |
| AC-04 | Nhóm Active xuất hiện trong dropdown tạo Chỉ tiêu KPI khi phù hợp phòng ban/chức danh của KPI Owner |
| AC-05 | Nhóm Inactive không xuất hiện trong dropdown tạo dữ liệu mới nhưng vẫn hiển thị ở dữ liệu lịch sử |
| AC-06 | Hệ thống chặn xóa Nhóm KPI khi tồn tại KPI Type, template, KPI hoặc bộ KPI đang tham chiếu |
| AC-07 | Người dùng có thể ngừng sử dụng nhóm đã có tham chiếu sau khi xác nhận cảnh báo |
| AC-08 | Mọi thay đổi trạng thái, cấu hình và thứ tự được ghi vào Audit Log với before/after data |
| AC-09 | Người dùng thuộc tenant A không thể xem, sửa hoặc xóa Nhóm KPI thuộc tenant B |
| AC-10 | Thay đổi thứ tự hiển thị cập nhật nhất quán, không phát sinh trùng display_order |
| AC-11 | Khi hai người dùng cùng chỉnh sửa, hệ thống phát hiện xung đột version và không ghi đè im lặng |
| AC-12 | Trang danh sách hỗ trợ tìm kiếm, lọc, phân trang và sắp xếp theo đặc tả |

---

## 15. Dữ liệu mẫu khởi tạo

```json
[
  {
    "code": "GROWTH_CONVERSION",
    "name": "Tăng trưởng & Chuyển đổi",
    "scope_type": "DEPARTMENT",
    "default_direction": "INCREASE",
    "color": "#17B6A4",
    "icon": "trending-up",
    "display_order": 1,
    "status": "ACTIVE"
  },
  {
    "code": "BUDGET_EFFICIENCY",
    "name": "Hiệu quả ngân sách",
    "scope_type": "DEPARTMENT",
    "default_direction": "DECREASE",
    "color": "#F59E0B",
    "icon": "wallet-cards",
    "display_order": 2,
    "status": "ACTIVE"
  },
  {
    "code": "REVENUE_PIPELINE",
    "name": "Doanh thu & Pipeline",
    "scope_type": "DEPARTMENT",
    "default_direction": "INCREASE",
    "color": "#4F46E5",
    "icon": "chart-no-axes-combined",
    "display_order": 3,
    "status": "ACTIVE"
  },
  {
    "code": "BRAND_AWARENESS",
    "name": "Thương hiệu & Độ nhận biết",
    "scope_type": "DEPARTMENT",
    "default_direction": "INCREASE",
    "color": "#EC4899",
    "icon": "sparkles",
    "display_order": 4,
    "status": "ACTIVE"
  },
  {
    "code": "OPERATIONS_GOVERNANCE",
    "name": "Vận hành & Quản trị Marketing",
    "scope_type": "DEPARTMENT",
    "default_direction": "INCREASE",
    "color": "#64748B",
    "icon": "settings-2",
    "display_order": 5,
    "status": "ACTIVE"
  }
]
```

---

## 16. Phụ thuộc và hướng phát triển

### Phụ thuộc

- Danh mục phòng ban và chức danh.
- Module quản lý người dùng, tenant và phân quyền.
- Module Chỉ tiêu KPI / KPI Type.
- Module Bộ KPI và chu kỳ đánh giá.
- Hệ thống Audit Log.

### Hướng phát triển

- Phân cấp Nhóm KPI nhiều cấp: Nhóm > Nhóm con > KPI Type.
- Gợi ý Nhóm KPI bằng AI theo vai trò/chức danh.
- Tự động đề xuất KPI Type, đơn vị, công thức và trọng số.
- Mapping Nhóm KPI với Balanced Scorecard, OKR hoặc competency framework.
- Đồng bộ data domain từ CRM, Ads, GA4, SEO, Social và các công cụ Marketing Automation.
- Thiết lập benchmark theo ngành: bất động sản, spa/làm đẹp, giáo dục, retail, agency và SaaS.

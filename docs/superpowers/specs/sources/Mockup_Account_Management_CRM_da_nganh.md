# Mockup chi tiết nghiệp vụ — Module Account Management CRM đa ngành

**Phiên bản:** 1.0  
**Ngày:** 05/09/2026  
**Liên kết tài liệu:** PRD/SRS — Module Account Management CRM đa ngành  
**Mục đích:** Đặc tả mockup/wireframe chữ, hành vi UI, dữ liệu hiển thị, trạng thái và tiêu chí nghiệm thu cho từng nghiệp vụ của module Account Management.

---

## 1. Quy ước chung

### 1.1. Mục tiêu mockup

Tài liệu này chuyển các yêu cầu trong SRS thành các màn hình có thể thiết kế trực tiếp trên Figma hoặc hiện thực bằng React/Next.js. Mockup ưu tiên:

- Tốc độ xử lý công việc hằng ngày của Account Executive/Account Manager.
- Bối cảnh 360° cho mỗi khách hàng.
- Hiển thị rõ hành động tiếp theo, SLA, gia hạn, rủi ro và doanh thu chịu rủi ro.
- Hỗ trợ cấu hình đa ngành qua custom field, template, scorecard và workflow.
- Desktop-first ở độ rộng 1440 px; responsive cho tablet/mobile ở các thao tác nhanh.

### 1.2. Design tokens tham chiếu

| Token | Giá trị gợi ý | Mục đích |
|---|---|---|
| Primary | Navy `#0F2747` | Sidebar, điều hướng chính |
| Accent | Blue `#2563EB` | CTA, link, trạng thái active |
| Success | Emerald `#16A34A` | Healthy, completed, paid |
| Warning | Amber `#D97706` | Watch, nearing due, pending |
| Danger | Red `#DC2626` | Critical, overdue, breach |
| Info | Cyan `#0891B2` | Thông tin, notification |
| Background | `#F7F8FA` | Nền ứng dụng |
| Surface | `#FFFFFF` | Card, table, modal |
| Border | `#E5E7EB` | Border/divider |
| Text primary | `#111827` | Nội dung chính |
| Text muted | `#6B7280` | Metadata/hint |
| Radius | 10–12 px | Card/button/input |
| Desktop grid | 12 columns, max-width 1440 px | Bố cục trang |

### 1.3. Badge và trạng thái chuẩn

| Domain | Trạng thái | Màu | Nội dung UI |
|---|---|---|---|
| Health | Healthy | Xanh lá | Khỏe mạnh |
| Health | Watch | Vàng | Cần theo dõi |
| Health | At Risk | Cam/đỏ nhạt | Có rủi ro |
| Health | Critical | Đỏ | Nghiêm trọng |
| SLA | On Track | Xanh lá | Trong SLA |
| SLA | Warning | Vàng | Sắp quá hạn |
| SLA | Breached | Đỏ | Vi phạm SLA |
| Renewal | On Track | Xanh lá | Đang đúng kế hoạch |
| Renewal | Attention | Vàng | Cần xử lý |
| Renewal | Risk | Đỏ | Rủi ro mất hợp đồng |
| Task | New | Xám | Mới |
| Task | In Progress | Xanh dương | Đang xử lý |
| Task | Waiting Client | Tím | Chờ khách hàng |
| Task | Waiting Internal | Xám xanh | Chờ nội bộ |
| Task | Resolved | Xanh lá | Đã xử lý |
| Task | Overdue | Đỏ | Quá hạn |

### 1.4. Khung ứng dụng chung

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [☰] Logo CRM       Tìm kiếm khách hàng, hợp đồng, contact, task...     [🔔] [❔] [Avatar ▾]        │
├───────────────┬─────────────────────────────────────────────────────────────────────────────────────┤
│ TỔNG QUAN     │ Breadcrumb / Page action                                                          │
│   Dashboard   │                                                                                     │
│ KHÁCH HÀNG    │ Nội dung màn hình                                                                  │
│   Danh sách   │                                                                                     │
│   Onboarding  │                                                                                     │
│ CÔNG VIỆC     │                                                                                     │
│   Work Queue  │                                                                                     │
│ HỢP ĐỒNG      │                                                                                     │
│   Gia hạn     │                                                                                     │
│ PHÂN TÍCH     │                                                                                     │
│   Báo cáo     │                                                                                     │
│ CẤU HÌNH      │                                                                                     │
└───────────────┴─────────────────────────────────────────────────────────────────────────────────────┘
```

**Quy tắc chung:**

- Sidebar cố định, có thể thu gọn còn icon.
- Top bar cố định khi cuộn; global search hỗ trợ command palette (`Ctrl/Cmd + K`).
- Action nguy hiểm phải yêu cầu xác nhận và nêu rõ hậu quả.
- Bất kỳ record nào đang chỉnh sửa mà rời trang phải cảnh báo unsaved changes.
- Timestamp hiển thị theo timezone của Account hoặc tenant; tooltip hiển thị thời điểm đầy đủ.
- Mọi danh sách lớn dùng server-side filtering, sort và cursor pagination.

---

## 2. Navigation và global search

### UI-AM-00 — Command palette / Global search

**Mục tiêu nghiệp vụ:** Tìm và mở nhanh Account, Contact, Contract, Renewal Case, Task, Interaction và Report từ mọi màn hình.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🔎 Tìm kiếm trong CRM...                                               Esc   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Gợi ý gần đây                                                               │
│   ◷ Công ty An Phú                                      Account  • Active   │
│   ◷ RC-2026-00128 — Gia hạn Bloom Spa                  Renewal  • Attention│
│                                                                              │
│ Kết quả cho “an phú”                                                        │
│   🏢 Công ty An Phú                    Account      Healthy  85tr/tháng     │
│   👤 Nguyễn An Phú                     Contact      CEO                    │
│   📄 HD-2026-0084                      Contract     Còn 53 ngày             │
│   ✓ Gửi báo cáo tháng 08               Task         Hạn hôm nay             │
│                                                                              │
│ [↵] Mở  [⌘↵] Mở tab mới  [↑↓] Điều hướng                                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Hành vi:**

- Debounce 250–350 ms sau khi nhập tối thiểu 2 ký tự.
- Ưu tiên exact match theo Account/Contact/Contract code trước full-text match.
- Kết quả tuân thủ data scope và field-level permission.
- Nếu không có kết quả: hiển thị “Không tìm thấy” cùng CTA tạo Account/Task nếu role được phép.

**Acceptance criteria:**

- Từ bất cứ màn hình nào, phím tắt mở command palette trong tối đa 200 ms.
- Kết quả đầu tiên xuất hiện trong P95 ≤ 1 giây ở quy mô dữ liệu mục tiêu.
- Không được trả về record người dùng không có quyền xem.

---

## 3. Dashboard và quản lý danh mục

### UI-AM-01 — My Dashboard

**Mục tiêu nghiệp vụ:** Giúp AM quyết định việc nào cần làm trước, account nào có nguy cơ và hợp đồng nào cần gia hạn.

```text
Breadcrumb: Tổng quan / Account Management

┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Account Management                                      [Tháng này ▾] [Bộ lọc ▾] [+ Tạo mới ▾]      │
│ Quản lý khách hàng, hiệu suất dịch vụ và cơ hội tăng trưởng                                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Khách hàng active] [MRR hiện tại] [Gia hạn 90 ngày] [Revenue at risk] [SLA quá hạn] [CSAT]         │
│          48               1,28 tỷ            420 triệu         185 triệu          7        4,7/5  │
│        +3 tháng này       +12,5%              12 case            5 account       -2 vs T7  +0,2   │
├───────────────────────────────────────────────┬─────────────────────────────────────────────────────┤
│ VIỆC CẦN XỬ LÝ HÔM NAY (12)                   │ ACCOUNT CẦN CHÚ Ý                                    │
│ [Quá hạn 3] [Hôm nay 6] [Sắp hạn 3]           │ [Health] [Doanh thu] [Gia hạn]                        │
│                                               │ 1. EduNext           Critical  65tr  15 ngày [Mở]     │
│ 🔴 08:30 Phản hồi khiếu nại — EduNext          │ 2. Bloom Spa         At Risk   42tr  37 ngày [Mở]     │
│    SLA đã quá 1h 18m      [Nhận xử lý]         │ 3. An Phú            Watch     85tr  53 ngày [Mở]     │
│ 🟠 10:00 Gửi proposal gia hạn — Bloom Spa     │ 4. Green Home        Watch    120tr  101 ngày [Mở]    │
│ 🟡 14:00 Họp QBR — Công ty An Phú              │                                                             │
│ 🟢 16:30 Gọi follow-up — Green Home            │                                                             │
│ [Xem Work Queue →]                             │ [Xem Risk Center →]                                    │
├───────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ RENEWAL FORECAST                               │ PHÂN BỐ HEALTH SCORE                                   │
│ [Biểu đồ cột theo tháng: Committed/Likely/Risk]│ [Donut: Healthy 31 | Watch 10 | At Risk 5 | Critical 2]│
│ Forecast: 360tr / 420tr (85,7%)                │ Điểm trung bình: 76,4   ↓ 2,1 so với tháng trước       │
├───────────────────────────────────────────────┴─────────────────────────────────────────────────────┤
│ DANH MỤC KHÁCH HÀNG CỦA TÔI                                              [Lưu view] [Xuất dữ liệu] │
│ Tìm kiếm... [Ngành ▾] [Health ▾] [Gia hạn ▾] [Dịch vụ ▾] [Chỉ xem có cảnh báo ☑]                  │
│                                                                                                      │
│ Khách hàng      Owner     Gói dịch vụ         Health    MRR       Gia hạn       Việc tiếp theo     │
│ Công ty An Phú  Tôi       SEO + Performance   🟡 72     85tr      28/10/2026    Gửi report [⋮]     │
│ Bloom Spa       Tôi       Social + Ads        🟠 58     42tr      12/10/2026    Renewal call [⋮]   │
│ EduNext         Tôi       Branding + LeadGen  🔴 34     65tr      20/09/2026    Escalation [⋮]     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Thành phần và tương tác:**

| Thành phần | Tương tác | Kết quả |
|---|---|---|
| Bộ lọc kỳ thời gian | Chọn ngày/tuần/tháng/quý/custom | Toàn dashboard tải lại theo kỳ |
| KPI card | Click | Điều hướng đến danh sách đã filter tương ứng |
| Việc cần xử lý | Click row | Mở Work Item Detail drawer hoặc full page |
| Nhận xử lý | Click | Gán current user, ghi audit, toast thành công |
| Account cần chú ý | Click Mở | Mở Account 360 tab Health & Risks |
| Biểu đồ forecast | Hover/click segment | Tooltip số liệu; click drill down Renewal List |
| Lưu view | Nhập tên/visibility | Lưu filter + layout dashboard theo user/team |

**Quy tắc dữ liệu:**

- “Của tôi” mặc định sử dụng `primary_owner_id = current_user` hoặc work item assignee = current user.
- Revenue at risk tính từ account At Risk/Critical có recurring value active, hiển thị tooltip về tiêu chí áp dụng.
- Danh sách attention sắp xếp theo: Critical > At Risk > SLA breach > ngày gia hạn tăng dần > revenue giảm dần.
- User chỉ thấy KPI và account trong phạm vi phân quyền.

**Trạng thái rỗng/lỗi:**

- Không có account: minh họa nhẹ + CTA `Tạo khách hàng đầu tiên` hoặc `Import danh sách`.
- Không có việc hôm nay: “Bạn đã xử lý xong các việc ưu tiên hôm nay.”
- Lỗi widget: card giữ chiều cao, hiển thị retry độc lập, không làm hỏng dashboard còn lại.

---

### UI-AM-02 — Accounts List

**Mục tiêu nghiệp vụ:** Tìm, lọc, phân khúc, quản trị owner và thực hiện thao tác hàng loạt trên danh mục khách hàng.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Khách hàng (1.248)                                         [Lưu view] [Import] [Export] [+ Account] │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [🔎 Tên, mã, contact, SĐT, email] [Owner ▾] [Team ▾] [Health ▾] [Lifecycle ▾] [Ngành ▾] [Thêm bộ lọc]│
│ View: Tất cả khách hàng ▾        [☑ Chỉ hiện có hành động cần xử lý]                  [Columns ⚙] │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ☑ │ Khách hàng         │ Owner        │ Lifecycle │ Health      │ MRR      │ Gia hạn │ SLA │ ⋮     │
├───┼────────────────────┼──────────────┼───────────┼─────────────┼──────────┼─────────┼─────┼───────┤
│ ☐ │ Công ty An Phú     │ Nguyễn Minh  │ Active    │ 🟡 72 Watch │ 85tr     │ 28/10   │ 🟢  │ [⋮]   │
│ ☐ │ Bloom Spa          │ Trần Anh     │ Active    │ 🟠 58 Risk  │ 42tr     │ 12/10   │ 🟡  │ [⋮]   │
│ ☐ │ EduNext            │ Lê Hương    │ At Risk   │ 🔴 34 Crit. │ 65tr     │ 20/09   │ 🔴  │ [⋮]   │
│ ☐ │ Green Home         │ Nguyễn Minh  │ Active    │ 🟢 88 Healt │ 120tr    │ 15/12   │ 🟢  │ [⋮]   │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Hiển thị 1–50 / 1.248                                              [← Trước]  [1] [2] ... [Tiếp →]│
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Bulk action khi chọn record:**

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Đã chọn 12 khách hàng   [Đổi Owner] [Thêm Tag] [Tạo Task] [Export] [Bỏ chọn]│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Drawer “Đổi Owner”:**

```text
┌───────────────────────────────────────────┐
│ Chuyển owner cho 12 khách hàng        [×] │
├───────────────────────────────────────────┤
│ Owner mới *                                │
│ [🔎 Tìm người dùng hoặc team...]           │
│                                             │
│ Giữ owner cũ là secondary owner  [☑]       │
│ Chuyển các task đang mở                    │
│ ( ) Không chuyển  (●) Chuyển sang owner mới│
│                                             │
│ Lý do chuyển giao *                        │
│ [Thay đổi phân công khu vực.............]  │
│                                             │
│ [Hủy]                   [Xác nhận chuyển]  │
└───────────────────────────────────────────┘
```

**Quy tắc UI:**

- Column chooser hỗ trợ tối đa các trường chuẩn và custom fields được cấp quyền.
- Sort đa cột phía server; mặc định cập nhật gần nhất giảm dần hoặc attention priority theo saved view.
- Bulk transfer owner yêu cầu lý do, hiển thị preview số account/task bị ảnh hưởng.
- Export chạy async nếu >10.000 rows; có notification khi file sẵn sàng.

---

## 4. Account 360 và quản lý quan hệ

### UI-AM-03 — Account 360: Overview

**Mục tiêu nghiệp vụ:** Một trang duy nhất cung cấp ngữ cảnh đầy đủ để AM xử lý khách hàng mà không chuyển đổi công cụ.

```text
Breadcrumb: Khách hàng / Công ty An Phú

┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Công ty An Phú             Active  •  🟡 Health 72 / 100 (Watch)             [⋮]             │
│ Mã: ACC-000124  |  Agency Marketing  |  Tier A  |  Owner: Nguyễn Minh ▾                           │
│ [Log tương tác] [Tạo công việc] [Tạo rủi ro] [Bắt đầu gia hạn] [Tạo cơ hội] [✨ Hỏi AI]             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Tổng quan] [Timeline] [Dự án & dịch vụ] [Công việc] [Hợp đồng & Tài chính] [Health & Risk]        │
│ [Cơ hội] [Phản hồi] [Tài liệu] [Audit]                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Cột trái (8/12)                                           │ Cột phải (4/12)                         │
│ ┌───────────────────────────────────────────────────────┐ │ ┌──────────────────────────────────────┐ │
│ │ Tổng quan khách hàng                     [Chỉnh sửa] │ │ │ Hành động cần làm (4)                 │ │
│ │ Website: anphu.vn                                      │ │ │ 🔴 Ticket #REQ-291 quá SLA 1h18m      │ │
│ │ Ngành: Agency/Real Estate      Khu vực: HCM           │ │ │ 🟠 Gia hạn còn 53 ngày                │ │
│ │ Kênh ưu tiên: Zalo/Email      Timezone: GMT+7         │ │ │ 🟡 QBR chưa lên lịch tháng này         │ │
│ │ Account Owner: Nguyễn Minh     Delivery: Lê Trang     │ │ │ 🟡 1 invoice sắp đến hạn                │ │
│ └───────────────────────────────────────────────────────┘ │ │ [Xem tất cả →]                          │ │
│ ┌───────────────────────────────────────────────────────┐ │ └──────────────────────────────────────┘ │
│ │ KPI & Success Plan                                    │ │ ┌──────────────────────────────────────┐ │
│ │ Mục tiêu: 1.200 qualified leads / tháng               │ │ │ Contact chính                          │ │
│ │ Thực tế T8: 1.060 (88%)  ↓ 6% so với T7               │ │ │ Nguyễn An Phú — CEO                    │ │
│ │ Cadence: Báo cáo tuần, QBR hàng quý                   │ │ │ 09xx xxx xxx  •  ceo@anphu.vn         │ │
│ │ [Mở success plan →]                                   │ │ │ Sentiment: Neutral  [Gọi] [Email]     │ │
│ └───────────────────────────────────────────────────────┘ │ └──────────────────────────────────────┘ │
│ ┌───────────────────────────────────────────────────────┐ │ ┌──────────────────────────────────────┐ │
│ │ Dịch vụ đang hoạt động                                 │ │ │ Tóm tắt tài chính                      │ │
│ │ SEO & Performance | Retainer | 85tr/tháng | Active     │ │ │ MRR: 85 triệu                          │ │
│ │ 01/01/2026 — 31/12/2026 | SLA Gold                     │ │ │ Công nợ: 0 đồng                        │ │
│ │ [Xem hợp đồng HD-2026-0084 →]                         │ │ │ Hóa đơn tiếp theo: 05/09/2026          │ │
│ └───────────────────────────────────────────────────────┘ │ └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Header behavior:**

- Click vào Health badge mở drawer giải thích điểm score.
- Owner dropdown chỉ hiển thị với người có quyền; thay owner yêu cầu lý do và có audit.
- Nút `Bắt đầu gia hạn` chỉ active nếu có contract active hoặc renewal policy cho phép tạo manual case.
- Nút `Hỏi AI` mở panel, không tự cập nhật dữ liệu nghiệp vụ.

**Quick action menu `[⋮]`:**

- Chỉnh sửa account.
- Thêm contact.
- Chuyển owner.
- Thay đổi lifecycle status.
- Archive account.
- Hợp nhất account trùng lặp (Admin/Director).
- Xem lịch sử audit.

### UI-AM-04 — Account 360: Timeline

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Timeline — Công ty An Phú        [Tất cả hoạt động ▾] [Tất cả người dùng ▾] [Khoảng thời gian ▾]   │
│ [＋ Ghi chú] [📞 Log cuộc gọi] [📅 Log cuộc họp] [✓ Tạo task] [📎 Đính kèm]                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Hôm nay — 05/09/2026                                                                          [▾]   │
│ ● 09:18  TASK  Gửi báo cáo hiệu quả tháng 08     Nguyễn Minh    Hạn: hôm nay 17:00   🟡 In progress│
│ │         [Mở task] [Đánh dấu hoàn thành]                                                        │
│ ● 08:42  EMAIL Báo cáo tuần 1 tháng 09 đã gửi   System/API     Đến: ceo@anphu.vn                  │
│ │         [Xem nội dung] [Tạo follow-up]                                                         │
│ Hôm qua — 04/09/2026                                                                         [▾]   │
│ ● 15:30  MEETING Họp tối ưu CPA                  Nguyễn Minh    4 người tham dự                     │
│ │         Tóm tắt: Khách hàng đề nghị giảm CPA xuống 180.000đ...                                  │
│ │         Action items: [Chuẩn bị phương án A/B — 06/09] [Gửi recap — 05/09]                      │
│ ● 11:10  HEALTH Score 76 → 72                    System       KPI Delivery -4 điểm                 │
│ │         [Xem chi tiết score]                                                                    │
│ ● 09:00  INVOICE HĐ-2026-09-001 đã phát hành     Finance Sync  85.000.000đ | Hạn: 15/09             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Tương tác timeline:**

- Composer “Ghi chú” hỗ trợ rich text cơ bản, mention user, đính kèm, visibility `Internal`/`Shared with client`.
- Log meeting có thể tạo nhiều task từ action items; task được liên kết ngược về interaction.
- Các event do system sinh có nhãn `System` và không cho sửa nội dung nguồn.
- Filter theo loại activity: work item, meeting, call, email, contract, health, financial, survey, risk, system.

### UI-AM-05 — Account form: Create/Edit

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ Tạo khách hàng mới                                                                    [Lưu nháp]│
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Thông tin định danh                                                                    (*) Bắt buộc│
│ Tên pháp lý *             [Công ty Cổ phần ABC...............................................] │
│ Tên hiển thị *            [ABC Group..........................................................] │
│ Mã khách hàng             [Tự sinh sau khi lưu]                                                  │
│ Loại khách hàng *         [Doanh nghiệp ▾]       Ngành * [Bất động sản ▾]                        │
│ Phân khúc                 [Tier B ▾]             Nguồn [Sales CRM ▾]                             │
│ Website                   [https://...]          Timezone [Asia/Ho_Chi_Minh ▾]                   │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Sở hữu và vận hành                                                                         │
│ Account Owner *           [🔎 Chọn owner...]     Team [Enterprise ▾]                              │
│ Delivery Owner            [🔎 Chọn delivery...]  Lifecycle [Pending Handover ▾]                   │
│ Gói dịch vụ dự kiến       [Lead Generation ▾]    Kênh ưu tiên [Zalo ▾]                            │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Người liên hệ                                                                         [+ Thêm contact]│
│ Họ tên * [..................] Chức danh [........] SĐT [........] Email [................]      │
│ [☑ Đặt làm contact chính]                                                                        │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Trường riêng: Bất động sản                                                                    │
│ Dự án chính                [Vinhomes Riverside ▾]  Loại sản phẩm [Căn hộ ▾]                       │
│ Khu vực bán hàng           [TP.HCM ▾]              Mục tiêu lead/tháng [500]                      │
├───────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tags [High Value ×] [HCM ×] [+ Thêm tag]                                                        │
│                                                   [Hủy] [Lưu và tạo onboarding] [Lưu khách hàng]  │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Validation:**

- Tên hiển thị, loại account, ngành và owner bắt buộc.
- Với lifecycle `Active`, yêu cầu tối thiểu một contact chính; hệ thống hiển thị validation trước lưu.
- Custom field tuân theo schema: required, format, range, conditional visibility, permission.
- Kiểm tra trùng lặp theo cấu hình: tên pháp lý, tax code, website domain, phone/email của contact.

### UI-AM-06 — Contact drawer

```text
┌──────────────────────────────────────────────┐
│ Thông tin liên hệ                        [×] │
├──────────────────────────────────────────────┤
│ Nguyễn An Phú                                 │
│ CEO • Decision Maker • Contact chính          │
│                                              │
│ SĐT: 09xx xxx xxx       [Gọi] [Sao chép]      │
│ Email: ceo@anphu.vn     [Email] [Sao chép]    │
│ Zalo: Đã liên kết       [Mở hội thoại]        │
│                                              │
│ Sentiment gần nhất: 🟡 Neutral                 │
│ Interaction gần nhất: Họp 04/09/2026           │
│                                              │
│ Vai trò trong buying committee                 │
│ [Decision Maker ▾]                             │
│ Thái độ đối với renewal [Neutral ▾]            │
│                                              │
│ [Xem lịch sử tương tác] [Chỉnh sửa]            │
└──────────────────────────────────────────────┘
```

---

## 5. Onboarding và handover

### UI-AM-07 — Sales-to-AM Handover

**Mục tiêu nghiệp vụ:** Chuyển giao hợp đồng đã thắng đầy đủ scope, kỳ vọng và rủi ro trước khi AM nhận account.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Handover khách hàng: Bloom Spa                                      Deal: DL-2026-01024 • Won      │
│ Trạng thái: [Chờ AM xác nhận]                                                                  [⋮] │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Step 1 Thông tin thương mại ✓  → Step 2 Scope & KPI ✓ → Step 3 Stakeholder ✓ → Step 4 Xác nhận    │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Thông tin deal                                                                         [Sửa từ Sales]│
│ Giá trị: 504.000.000đ / 12 tháng      Billing: Hàng tháng       Ngày hiệu lực: 01/10/2026          │
│ Gói dịch vụ: Social Content + Meta Ads           SLA: Premium                                      │
│                                                                                                     │
│ Scope & cam kết                                                                        (*) Bắt buộc │
│ Mục tiêu kinh doanh *  [Tăng 30% booking treatment trong 3 tháng.................................]│
│ KPI cam kết *           [60 booking/tháng; CPL ≤ 120.000đ.........................................]│
│ Phạm vi bao gồm *       [Content 16 bài/tháng; Ads; report tuần; QBR..............................]│
│ Không bao gồm           [Thiết kế landing page; chi phí KOL........................................]│
│                                                                                                     │
│ Rủi ro/ghi chú từ Sales                                                                         │
│ [Khách hàng nhạy cảm với CPA, cần báo cáo rõ bằng dashboard. Decision maker thường bận....]        │
│                                                                                                     │
│ Tài liệu bàn giao              [Proposal.pdf] [Báo giá.pdf] [Hợp đồng.pdf] [+ Tải lên]             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Checklist xác nhận AM                                                                            │
│ ☑ Tôi đã hiểu scope, KPI và exclusion                                                            │
│ ☐ Tôi đã nhận đủ thông tin stakeholder và quyền truy cập                                          │
│ ☐ Tôi đã thống nhất owner Delivery/Onboarding                                                     │
│                                                                                                     │
│ [Yêu cầu bổ sung thông tin]                                   [Từ chối handover] [Xác nhận nhận bàn giao]│
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Luồng và trạng thái:**

| Trạng thái | Ai thao tác | Hành động hợp lệ | Kết quả |
|---|---|---|---|
| Draft | Sales | Lưu, gửi handover | Chuyển Pending AM Review |
| Pending AM Review | AM/Director | Xác nhận, yêu cầu bổ sung, từ chối | Sinh onboarding hoặc trả Sales |
| Needs Information | Sales | Bổ sung và gửi lại | Chuyển Pending AM Review |
| Accepted | System/AM | Tạo onboarding case | Account chuyển Onboarding |
| Rejected | AM/Director | Nêu lý do | Ghi audit, gửi thông báo Sales |

**Validation:**

- Không cho Sales gửi handover nếu thiếu contract/deal reference, scope, KPI, billing schedule, stakeholder chính và tài liệu hợp đồng theo policy.
- AM không thể “Xác nhận nhận bàn giao” nếu chưa tick các checklist required.
- Từ chối/yêu cầu bổ sung bắt buộc nêu lý do; lý do hiển thị trên timeline.

### UI-AM-08 — Onboarding Workspace

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Onboarding — Bloom Spa                 62% hoàn thành       Mục tiêu Go-live: 01/10/2026           │
│ Owner: Trần Anh ▾  | Delivery: Mai Linh ▾  | Status: On Track 🟢                     [⋮]             │
├───────────────────────────────┬─────────────────────────────────────────────────────────────────────┤
│ DANH MỤC                      │ CHECKLIST: KICKOFF & THIẾT LẬP                                      │
│ ● Tổng quan                   │ [Tất cả 12] [Chưa làm 5] [Quá hạn 1]                  [+ Hạng mục] │
│ ● Checklist (12)              │                                                                     │
│ ● Milestones (4)              │ ☑ Hợp đồng đã xác nhận               Sales       28/09  Hoàn thành│
│ ● Stakeholders                │ ☑ Tạo workspace dự án                Delivery    28/09  Hoàn thành│
│ ● Tài liệu (8)                │ ☐ Thu thập quyền truy cập Meta       Client      29/09  🟠 Sắp hạn │
│ ● Activity                    │ ☐ Kickoff meeting                    AM          29/09  🟡 Chưa làm│
│                                │ ☐ Thiết lập dashboard báo cáo        Data Ops    30/09  Chưa làm  │
│                                │ ☐ Xác nhận creative approval flow    AM          30/09  Chưa làm  │
│                                │ ☐ Go-live approval                   Director    01/10  Blocked   │
│                                │                                                                     │
│                                │ [Lưu thay đổi] [Đánh dấu sẵn sàng Go-live]                        │
├───────────────────────────────┴─────────────────────────────────────────────────────────────────────┤
│ MILESTONES                                                                                          │
│ [Kickoff ✓] ───────── [Assets received 🟡] ───────── [Campaign setup] ───────── [Go-live]          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Nghiệp vụ chính:**

- Chọn onboarding template theo ngành, gói dịch vụ và contract type.
- Item có thể là checklist, task, approval hoặc milestone; mỗi item có owner, due date, dependency và required flag.
- Click item mở side panel để cập nhật ghi chú, đính kèm, trạng thái, requester và evidence.
- `Go-live approval` chỉ khả dụng khi toàn bộ item required hoàn thành hoặc có override đã được phê duyệt.

**Modal “Đánh dấu sẵn sàng Go-live”:**

```text
┌──────────────────────────────────────────────────┐
│ Xác nhận Go-live                             [×] │
├──────────────────────────────────────────────────┤
│ Kiểm tra trước Go-live                           │
│ ✓ 10/10 hạng mục bắt buộc hoàn thành              │
│ ✓ Contract active                                 │
│ ✓ Contact chính đã xác nhận                       │
│ ⚠ Báo cáo dashboard chưa có dữ liệu 24 giờ        │
│                                                   │
│ Ngày Go-live thực tế * [01/10/2026]               │
│ Ghi chú                                           │
│ [...............................................] │
│                                                   │
│ [Hủy]                         [Xác nhận Go-live]  │
└──────────────────────────────────────────────────┘
```

### UI-AM-09 — Onboarding template configuration

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Cấu hình / Onboarding templates                              [+ Tạo template]                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Template: Agency — Social & Performance v3    [Published]  [Clone] [Edit] [Archive]             │
│ Áp dụng: Industry = Agency; Service = Social + Ads; Contract = Retainer                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Giai đoạn              Hạng mục                         Owner mặc định    Hạn tương đối Required│
│ Pre-kickoff            Xác nhận hợp đồng                Account Manager   T+0          ✓       │
│ Pre-kickoff            Thu thập access                  Client            T+2          ✓       │
│ Kickoff                Tổ chức kickoff meeting          Account Manager   T+3          ✓       │
│ Setup                  Thiết lập pixel/tracking          Delivery          T+5          ✓       │
│ Setup                  Thiết lập dashboard               Data Ops          T+5          ✓       │
│ Go-live                Director approval                 Account Director  T+7          ✓       │
│ [ + Thêm hạng mục ]                                                                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Hợp đồng, tài chính và gia hạn

### UI-AM-10 — Contract Detail

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ HD-2026-0084 — SEO & Performance Retainer                                    🟢 Active             │
│ Công ty An Phú  |  01/01/2026 — 31/12/2026  |  Còn 117 ngày                    [Sửa] [⋮]           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Tổng quan] [Dịch vụ & giá] [Lịch thanh toán] [Gia hạn] [Phụ lục] [Tài liệu] [Audit]              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Giá trị hợp đồng             1.020.000.000đ       Billing model                Retainer hàng tháng │
│ MRR                           85.000.000đ          Điều khoản thanh toán        Net 10               │
│ Auto-renew                    Không                 Notice period               30 ngày              │
│ Owner                         Nguyễn Minh          SLA                          Gold                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DỊCH VỤ / LINE ITEMS                                                                           [+ Thêm]│
│ Dịch vụ                 Đơn giá/tháng      SL/tháng          Start        End          Status       │
│ SEO Technical           25.000.000đ        1                 01/01/2026   31/12/2026   Active       │
│ Performance Media Mgmt  45.000.000đ        1                 01/01/2026   31/12/2026   Active       │
│ Reporting & QBR         15.000.000đ        1                 01/01/2026   31/12/2026   Active       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ NGHĨA VỤ/CAM KẾT                                                                    [+ Tạo nghĩa vụ]│
│ ☐ Báo cáo tuần gửi thứ Hai trước 12:00       Owner: AM      Cadence: Weekly       Trong SLA        │
│ ☐ QBR hằng quý                               Owner: AM      Next: 25/09/2026      Cần lên lịch     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Nghiệp vụ:**

- Contract thay đổi giá, thời hạn, line item hoặc payment terms bằng Amendment nếu contract đã active.
- Contract detail hiển thị tài chính read-only nếu user không có quyền Finance write.
- “Nghĩa vụ/cam kết” có thể sinh recurring work item theo cadence.
- Cảnh báo contract expiry theo mốc tenant cấu hình.

### UI-AM-11 — Renewal Pipeline

**Mục tiêu nghiệp vụ:** Điều hành toàn bộ danh sách hợp đồng sắp hết hạn và xác suất gia hạn.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Gia hạn hợp đồng                              [Tháng 9–12/2026 ▾] [Owner ▾] [Forecast ▾] [Export] │
│ Tổng renewable: 2,84 tỷ | Forecast weighted: 2,21 tỷ | At risk: 620 triệu                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Kanban] [Danh sách]                                                                            │
├───────────────────┬───────────────────┬───────────────────┬────────────────────────────────────────┤
│ Chưa bắt đầu (4)  │ Đang đánh giá (6) │ Đàm phán (5)      │ Đã quyết định (8)                       │
│ 420 triệu         │ 780 triệu         │ 1,12 tỷ           │ 520 triệu                               │
│                   │                   │                   │                                        │
│ ┌───────────────┐ │ ┌───────────────┐ │ ┌───────────────┐ │ ┌───────────────┐                      │
│ │ Green Home    │ │ │ Bloom Spa     │ │ │ Công ty An Phú│ │ │ EduNext       │                      │
│ │ 120tr MRR     │ │ │ 42tr MRR      │ │ │ 85tr MRR      │ │ │ 65tr MRR      │                      │
│ │ Còn 101 ngày  │ │ │ Còn 37 ngày   │ │ │ Còn 53 ngày   │ │ │ Lost / Churned│                      │
│ │ Health 88 🟢  │ │ │ Health 58 🟠  │ │ │ Health 72 🟡  │ │ │ Reason: Price │                      │
│ │ Owner: Minh   │ │ │ Owner: Anh    │ │ │ Owner: Minh   │ │ │ [Mở case]     │                      │
│ └───────────────┘ │ └───────────────┘ │ └───────────────┘ │ └───────────────┘                      │
└───────────────────┴───────────────────┴───────────────────┴────────────────────────────────────────┘
```

**Card renewal hiển thị:**

- Account, contract, contract value/MRR, ngày hết hạn và days remaining.
- Health level/score, open risk, overdue invoice indicator.
- Forecast category, probability, owner, next action và next action due.
- Badge escalation nếu cần.

**Drag & drop:**

- Kéo card thay stage yêu cầu cập nhật modal tối thiểu: forecast, next action, note.
- Không cho kéo sang `Renewed` nếu chưa liên kết contract/amendment active hoặc override permission.
- Không cho kéo sang `Lost/Churned` nếu thiếu close reason và churn date.

### UI-AM-12 — Renewal Case Detail

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ RC-2026-00128 — Bloom Spa                      Đang đánh giá  •  🟠 Attention                       │
│ Contract: HD-2025-0151 | Hết hạn 12/10/2026 (còn 37 ngày) | Owner: Trần Anh                        │
│ [Cập nhật forecast] [Tạo proposal] [Log tương tác] [Tạo task] [Escalate]                           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Forecast                  Likely ▾          Probability         [65]%                              │
│ Giá trị gia hạn dự kiến   [504.000.000]     Kỳ hạn               [12 tháng ▾]                       │
│ Mô hình giá               [Giữ nguyên ▾]   Ngày chốt dự kiến    [30/09/2026]                       │
│ Next action *             [Họp đánh giá kết quả Q3.................................................]│
│ Hạn next action *         [10/09/2026 10:00]                                                       │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ HEALTH & RISK SNAPSHOT                             │ STAKEHOLDER MAP                                │
│ Health: 58 — At Risk                               │ Lan Anh — Owner/Champion 🟡 Neutral             │
│ • 1 invoice overdue 7 ngày                         │ Dr. Bình — Decision Maker 🔴 Chưa gặp 34 ngày   │
│ • CSAT gần nhất: 3/5                                │ [Mở contacts]                                   │
│ • CPA cao hơn mục tiêu 18%                          │                                                 │
│ [Mở recovery plan]                                  │                                                 │
├────────────────────────────────────────────────────┴────────────────────────────────────────────────┤
│ TIMELINE GIA HẠN                                                                                     │
│ 05/09  AM cập nhật forecast Likely 65%                                                             │
│ 04/09  Meeting: khách cần chứng minh booking quality                                                │
│ 01/09  Renewal Case được tạo tự động, 41 ngày trước expiry                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Lưu thay đổi]                                    [Đánh dấu Renewed] [Đánh dấu Lost/Churned]         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Modal “Đánh dấu Lost/Churned”:**

```text
┌──────────────────────────────────────────────────┐
│ Kết thúc Renewal Case                        [×] │
├──────────────────────────────────────────────────┤
│ Kết quả *    ( ) Lost  (●) Churned  ( ) Paused   │
│ Lý do chính * [Giá/Ngân sách ▾]                  │
│ Đối thủ cạnh tranh [Nhập tên hoặc chọn...]       │
│ Ngày hiệu lực chấm dứt * [12/10/2026]            │
│ Doanh thu mất dự kiến [42.000.000]/tháng         │
│ Có thể phục hồi? [Có ▾]                          │
│ Ghi chú/lessons learned *                        │
│ [...............................................]│
│                                                  │
│ [Hủy]                          [Xác nhận kết quả]│
└──────────────────────────────────────────────────┘
```

### UI-AM-13 — Financial Snapshot

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Tài chính — Công ty An Phú                  Nguồn dữ liệu: Finance ERP • Đồng bộ 09:05 hôm nay  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [MRR 85tr] [Tổng giá trị active 1,02 tỷ] [Công nợ 0đ] [Quá hạn 0đ] [Invoice sắp hạn 1]            │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Invoice          Kỳ dịch vụ       Ngày phát hành  Hạn thanh toán  Giá trị       Trạng thái        │
│ INV-2026-09001   09/2026          05/09/2026      15/09/2026      85.000.000đ   🟡 Issued          │
│ INV-2026-08001   08/2026          05/08/2026      15/08/2026      85.000.000đ   🟢 Paid            │
│ INV-2026-07001   07/2026          05/07/2026      15/07/2026      85.000.000đ   🟢 Paid            │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Aging công nợ: [0–30: 0đ] [31–60: 0đ] [61–90: 0đ] [>90: 0đ]                                      │
│ [Xem trên Finance ERP ↗]                                                     [Yêu cầu hỗ trợ Finance]│
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Quy tắc UI:**

- Gắn nhãn source system và last synced timestamp.
- Nếu sync lỗi/stale quá ngưỡng: banner cảnh báo “Dữ liệu có thể chưa mới nhất”, CTA retry/chờ Finance tùy quyền.
- AM không thấy nút sửa trạng thái thanh toán nếu Finance là system of record.

---

## 7. Công việc, SLA, interaction và escalation

### UI-AM-14 — Work Queue

**Mục tiêu nghiệp vụ:** Một inbox vận hành tập trung cho task, client request, issue, complaint, approval và escalation.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Work Queue                                              [+ Tạo công việc] [Automations]              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Của tôi ▾] [Tất cả loại ▾] [Status ▾] [Priority ▾] [SLA ▾] [Account ▾] [More filters]             │
│ [Danh sách] [Board] [Calendar]                                               [Lưu view]            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 12 việc cần xử lý • 3 quá hạn • 5 sắp SLA • 4 chờ khách hàng                                     │
├────┬────────────────────────────┬─────────────┬───────────┬──────────┬─────────┬──────────────────┤
│Pri │ Công việc                  │ Account     │ Assignee  │ Status   │ SLA     │ Hạn / Next action│
├────┼────────────────────────────┼─────────────┼───────────┼──────────┼─────────┼──────────────────┤
│ 🔴 │ Phản hồi khiếu nại CPA      │ EduNext     │ Lê Hương  │ In Prog. │ Breached│ Quá 1h 18m       │
│ 🟠 │ Gửi proposal gia hạn        │ Bloom Spa   │ Trần Anh  │ New      │ Warning │ Hôm nay 10:00    │
│ 🟡 │ Chuẩn bị QBR                │ An Phú      │ Minh      │ In Prog. │ On Track│ 10/09 16:00      │
│ 🟢 │ Cập nhật dashboard tháng 9  │ Green Home  │ Data Ops  │ Waiting  │ Paused  │ Chờ client       │
└────┴────────────────────────────┴─────────────┴───────────┴──────────┴─────────┴──────────────────┘
```

**Board view:**

```text
New (6)                 In Progress (8)           Waiting Client (4)          Resolved (20)
┌─────────────────┐     ┌─────────────────┐        ┌─────────────────┐         ┌─────────────────┐
│ Bloom Spa       │     │ EduNext         │        │ Green Home      │         │ An Phú          │
│ Proposal renewal│     │ Complaint CPA   │        │ Awaiting access │         │ Weekly report   │
│ 🟠 Due today    │     │ 🔴 SLA breached │        │ SLA paused      │         │ ✓ Completed     │
└─────────────────┘     └─────────────────┘        └─────────────────┘         └─────────────────┘
```

### UI-AM-15 — Work Item Detail

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ REQ-000291 — Phản hồi khiếu nại CPA                                                         [⋮]     │
│ Account: EduNext  |  Type: Complaint  |  Priority: Critical  |  🔴 Resolution SLA breached 1h18m  │
├───────────────────────────────────────────────────────────┬─────────────────────────────────────────┤
│ NỘI DUNG                                                  │ THÔNG TIN XỬ LÝ                         │
│ Khách hàng phản ánh CPL tăng 35% trong tuần 1...          │ Status [In Progress ▾]                  │
│                                                            │ Assignee * [Lê Hương ▾]                 │
│ [Attachments: screenshot.png]                             │ Watchers [Director, Delivery Lead]      │
│                                                            │ Due at [05/09/2026 11:00]              │
│ COMMENT & ACTIVITY                                         │ First response: 08:30 ✓                 │
│ Minh • 09:05                                               │ Resolution due: 10:00 🔴                 │
│ “Đã kiểm tra, đang đối chiếu thay đổi target audience.”   │ SLA policy: Premium Complaint P1        │
│ [Nhập bình luận... @mention  📎] [Gửi]                    │                                         │
│                                                            │ LIÊN KẾT                                │
│ ACTION ITEMS                                               │ Contract: HD-2026-0033                  │
│ ☐ Trích xuất report CPL theo adset — Mai — 09:40           │ Risk: RSK-00045                         │
│ ☐ Gọi khách cập nhật tiến độ — Lê — 09:50                  │ Renewal: RC-2026-00058                  │
│ [+ Thêm action item]                                      │                                         │
├───────────────────────────────────────────────────────────┴─────────────────────────────────────────┤
│ [Lưu] [Đánh dấu chờ khách hàng] [Đánh dấu resolved] [Escalate]                                     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Business rules trong UI:**

- Chuyển `Waiting Client` phải yêu cầu lý do và bằng chứng yêu cầu đã gửi; SLA được pause nếu policy cho phép.
- Đánh dấu `Resolved` yêu cầu resolution summary; với complaint yêu cầu chọn resolution category.
- `Escalate` hiển thị cấp escalation, người nhận, lý do, summary và deadline mong muốn.
- Khi SLA breached, màn hình có banner đỏ cố định và nút `Escalate` nổi bật.

### UI-AM-16 — Create Work Item modal

```text
┌───────────────────────────────────────────────────────────────────────┐
│ Tạo công việc                                                   [×]    │
├───────────────────────────────────────────────────────────────────────┤
│ Loại *       [Task ▾]             Account * [Công ty An Phú ▾]        │
│ Tiêu đề *     [Gửi báo cáo hiệu quả tháng 08.........................]│
│ Mô tả         [......................................................]│
│ Priority      [High ▾]            Assignee * [Nguyễn Minh ▾]          │
│ Hạn xử lý      [05/09/2026 17:00]                                     │
│ Áp dụng SLA    [Theo contract — Gold ▾]                               │
│ Liên kết       [Contract ▾] [Renewal Case ▾] [Risk ▾]                  │
│ Watchers       [🔎 Thêm người theo dõi...]                             │
│ Đính kèm       [Kéo thả file hoặc chọn file]                           │
│                                                                       │
│ [Hủy]                                               [Tạo công việc]   │
└───────────────────────────────────────────────────────────────────────┘
```

### UI-AM-17 — Log Meeting / Interaction

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ Log cuộc họp — Công ty An Phú                                                      [×]  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ Loại * [QBR ▾]       Thời gian * [04/09/2026 15:30]    Thời lượng [60 phút]             │
│ Người tham gia * [Nguyễn An Phú ×] [Nguyễn Minh ×] [+ Thêm]                             │
│ Sentiment [Neutral ▾]   Visibility [Internal ▾]                                         │
│                                                                                          │
│ Tóm tắt *                                                                               │
│ [Khách hàng phản hồi CPL đang cao hơn mục tiêu. Đội thống nhất thử nghiệm 2 nhóm... ]  │
│                                                                                          │
│ Action items                                                          [✨ Trích từ AI]  │
│ ☑ Tạo task: Chuẩn bị phương án A/B                                    Owner: Mai        │
│    Hạn: 06/09/2026 16:00                                                                │
│ ☑ Tạo task: Gửi meeting recap                                      Owner: Nguyễn Minh  │
│    Hạn: 05/09/2026 12:00                                                                │
│ ☐ Tạo risk signal: KPI Delivery giảm                                                   │
│                                                                                          │
│ Đính kèm: [meeting-notes.docx] [recording-link]                                         │
│ [Hủy]                                                    [Lưu cuộc họp & tạo task]      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

**Nguyên tắc AI trên UI:**

- Nút AI chỉ tạo draft tóm tắt/action item; user phải tick/chỉnh sửa rồi nhấn lưu.
- Kèm label “Được AI đề xuất” cho đến khi user xác nhận.
- Không gửi meeting recap ra ngoài trực tiếp từ draft nếu chưa qua luồng gửi/approval.

### UI-AM-18 — Escalation modal

```text
┌──────────────────────────────────────────────────────────────┐
│ Escalate REQ-000291                                      [×] │
├──────────────────────────────────────────────────────────────┤
│ Cấp escalation *                                            │
│ ( ) Team Lead  (●) Account Director  ( ) Executive           │
│                                                              │
│ Lý do * [SLA breached + nguy cơ không gia hạn ▾]             │
│ Tóm tắt tình huống *                                         │
│ [Khách hàng EduNext khiếu nại CPL tăng 35%; case đã quá SLA.]│
│                                                              │
│ Đề xuất cần hỗ trợ                                           │
│ [Cần Director tham gia call với stakeholder trước 11:30.]    │
│                                                              │
│ Người nhận: Account Director — Phạm Quang                    │
│ [Hủy]                                      [Gửi escalation]  │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. Health score, Risk và churn prevention

### UI-AM-19 — Health & Risk Center

**Mục tiêu nghiệp vụ:** Quản trị chủ động sức khỏe danh mục thay vì chỉ phản ứng với ticket hoặc mất hợp đồng.

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Health & Risk Center                              [Team của tôi ▾] [30 ngày ▾] [Cấu hình scorecard]│
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Healthy 31] [Watch 10] [At Risk 5] [Critical 2] [Revenue at risk 185tr] [Open risks 18]           │
├──────────────────────────────────────────────┬──────────────────────────────────────────────────────┤
│ BIẾN ĐỘNG ĐIỂM SỨC KHỎE                      │ TÍN HIỆU RỦI RO PHỔ BIẾN                              │
│ [Line chart: Average score last 6 months]    │ 1. Không tương tác > 21 ngày             8 account    │
│ Trung bình: 76,4  ↓ 2,1                      │ 2. KPI delivery < 80%                    6 account    │
│                                              │ 3. Invoice overdue                       5 account    │
├──────────────────────────────────────────────┴──────────────────────────────────────────────────────┤
│ ACCOUNT RỦI RO                                                                             [Export] │
│ Account         Score   Δ 30d   Revenue    Signals                      Owner    Action plan        │
│ EduNext         34 🔴   -22      65tr       KPI thấp, SLA breach        Hương    40% [Mở]           │
│ Bloom Spa       58 🟠   -12      42tr       Overdue, CSAT 3/5           Anh      Chưa có [Tạo]      │
│ CityLand        51 🟠   -18      78tr       No interaction 28 ngày     Minh     20% [Mở]           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Tương tác:**

- Click account mở Account 360 tab Health & Risk.
- Click signal filter danh sách account đang có signal đó.
- Nút `Tạo` action plan tạo plan draft có prefill từ signals hiện tại.
- Cấu hình scorecard chỉ hiển thị cho CRM Admin/System Admin.

### UI-AM-20 — Account Health Detail

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Health Score — Công ty An Phú                     🟡 72 / 100 Watch         Cập nhật: 09:18 hôm nay │
│ Scorecard: Agency Retainer v3  [Xem công thức] [Tính lại] [Override score]                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Biểu đồ đường: 81 ─ 79 ─ 76 ─ 72 theo 4 tuần]                                                      │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Thành phần                   Điểm        Trọng số        Đóng góp       Xu hướng                   │
│ KPI Delivery                 70/100      30%             21,0           ↓ -6                       │
│ Engagement                   82/100      20%             16,4           → 0                        │
│ Financial                    100/100     20%             20,0           → 0                        │
│ Satisfaction                 80/100      15%             12,0           ↓ -2                       │
│ Contract & Support Risk      52/100      15%              7,8           ↓ -8                       │
│ TỔNG                         72/100      100%            77,2*          🟡 Watch                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ TÍN HIỆU ẢNH HƯỞNG                                                                         [+ Signal]│
│ 🔴 2 SLA breach trong 14 ngày                       -10       Nguồn: Work Items        [Mở]         │
│ 🟠 KPI Qualified Lead đạt 88% mục tiêu              -4        Nguồn: KPI Integration   [Mở]         │
│ 🟡 Chưa lên lịch QBR quý 3                           -3        Nguồn: Contract Obligation[Mở]        │
│ 🟢 Invoice được thanh toán đúng hạn                  +2        Nguồn: Finance Sync       [Mở]         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ KHUYẾN NGHỊ HÀNH ĐỘNG                                                                  [✨ Tạo draft]│
│ 1. Lên lịch QBR với decision maker trước 10/09 để thống nhất kế hoạch KPI.                          │
│ 2. Rà soát root cause của 2 SLA breach và gán owner cải thiện trong 48 giờ.                         │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Lưu ý công thức:**

- UI phải minh bạch rằng tổng score có thể làm tròn và/hoặc có caps/floors theo scorecard; tooltip giải thích cách quy đổi.
- Nút `Tính lại` chỉ request recalculation, không cho user nhập điểm trực tiếp.
- `Override score` yêu cầu role và lý do; hiển thị banner rõ thời hạn override, người thực hiện và ảnh hưởng báo cáo.

### UI-AM-21 — Create/Edit Risk

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Tạo rủi ro — Công ty An Phú                                            [×] │
├────────────────────────────────────────────────────────────────────────────┤
│ Danh mục *  [Delivery ▾]       Severity * [High ▾]                         │
│ Xác suất *  [4 ▾]              Tác động * [5 ▾]        Risk score: 20/25   │
│ Tiêu đề *   [KPI lead có nguy cơ không đạt tháng 09......................] │
│ Mô tả và bằng chứng *                                                     │
│ [Qualified lead mới đạt 88% target; 2 adset có CPL vượt trần 20%........]   │
│ Owner * [Nguyễn Minh ▾]        Hạn giảm thiểu * [10/09/2026]              │
│ Liên kết [Contract HD-... ▾] [Task ▾] [Interaction ▾]                      │
│                                                                            │
│ Kế hoạch giảm thiểu                                                        │
│ [Rà soát targeting; thử 2 creative; họp QBR; cập nhật dự báo KPI.......]  │
│                                                                            │
│ [Hủy]                                                    [Tạo rủi ro]      │
└────────────────────────────────────────────────────────────────────────────┘
```

### UI-AM-22 — Recovery Action Plan

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Recovery Plan — EduNext                          🔴 Critical 34/100   Status: In Mitigation        │
│ Chủ sở hữu: Lê Hương | Sponsor: Account Director Phạm Quang | Review tiếp: 07/09 09:00              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Mục tiêu phục hồi                                                                               │
│ Đưa Health Score lên ≥ 60 và xác nhận ý định gia hạn trước 15/09/2026.                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Root causes                                                                                         │
│ • CPL tăng 35% so với mục tiêu do thay đổi audience và creative fatigue.                            │
│ • 2 ticket P1 bị quá SLA; stakeholder chính không hài lòng.                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ACTION PLAN                                                        Tiến độ: 2/5                      │
│ ☑ 1. Phân tích campaign/adset                   Mai Linh    05/09  Done                              │
│ ☑ 2. Gọi cập nhật tiến độ với khách             Lê Hương    05/09  Done                              │
│ ☐ 3. Present phương án recovery                 Director    06/09  In progress                       │
│ ☐ 4. Thiết lập daily monitoring report          Data Ops    06/09  New                               │
│ ☐ 5. Xác nhận outcome với decision maker        Lê Hương    10/09  New                               │
│ [+ Thêm hành động]                                                                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tiêu chí thoát rủi ro                                                                             │
│ ☐ Không có P1 breach trong 7 ngày      ☐ CPL về trong ±10% mục tiêu  ☐ CSAT follow-up ≥ 4/5          │
│ [Lưu] [Review ngay] [Đóng recovery plan]                                                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Business rules:**

- Account Critical bắt buộc có recovery plan mở, trừ override của Director có lý do.
- Không được đóng recovery plan nếu chưa ghi outcome, lesson learned và trạng thái account/risk sau xử lý.
- Khi toàn bộ exit criteria đạt, UI gợi ý recalculate health score nhưng không tự chuyển level nếu scorecard không xác nhận.

### UI-AM-23 — Health scorecard configuration

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Cấu hình / Health Scorecards                                         [+ Tạo scorecard]              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Agency Retainer v3  [Published]  Áp dụng: Industry Agency + Contract Retainer       [Edit] [Clone]  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Thành phần                     Weight   Score source / rule                                  Status │
│ KPI Delivery                   30%      KPI achievement + milestone on-time                      ✓  │
│ Engagement                     20%      interaction recency + meeting cadence                    ✓  │
│ Financial                      20%      invoice aging + dispute                                   ✓  │
│ Satisfaction                   15%      CSAT/NPS + complaint severity                             ✓  │
│ Contract & Support Risk        15%      expiry days + SLA breach + P1 tickets                     ✓  │
│ [ + Thêm thành phần ]  Tổng trọng số: 100%                                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Ngưỡng: Healthy [80–100] | Watch [60–79] | At Risk [40–59] | Critical [0–39]                       │
│ Hiệu lực từ: [01/10/2026]           [Lưu nháp] [Validate] [Publish version mới]                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Quy tắc versioning:**

- Không sửa trực tiếp scorecard đã published và đang được account sử dụng; nút Edit tạo draft version mới.
- Publish kiểm tra tổng weight = 100%, ngưỡng không chồng lấp, source rule hợp lệ.
- Health assessment lưu scorecard version để historical report không thay đổi theo cấu hình mới.

---

## 9. Upsell, cross-sell và customer feedback

### UI-AM-24 — Growth Opportunities

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Cơ hội tăng trưởng                                       [Owner ▾] [Loại ▾] [Stage ▾] [+ Cơ hội]     │
│ Pipeline: 1,85 tỷ | Weighted: 890 triệu | Won tháng này: 320 triệu                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Account         Cơ hội                    Loại        Giá trị       Stage          Next step        │
│ Green Home      AI Agent chăm sóc lead    Cross-sell  240.000.000đ  Qualified      Demo 09/09       │
│ An Phú          Tăng ngân sách Ads Q4     Upsell      180.000.000đ  Proposal       Follow-up 07/09  │
│ Bloom Spa       Thêm TikTok Ads           Cross-sell  120.000.000đ  Discovery      Discovery call   │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ AI SUGGESTIONS (cần AM xác nhận)                                                 [Cấu hình trigger]│
│ ✨ Green Home có Health 88, mở thêm 2 chi nhánh và chưa dùng AI Agent. [Xem evidence] [Tạo draft]  │
│ ✨ An Phú vượt lead target 18% trong 2 tháng liên tiếp.              [Xem evidence] [Tạo draft]  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### UI-AM-25 — Create Opportunity

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tạo cơ hội tăng trưởng                                                   [×] │
├──────────────────────────────────────────────────────────────────────────────┤
│ Account * [Green Home ▾]          Loại * [Cross-sell ▾]                      │
│ Dịch vụ/gói * [AI Agent chăm sóc lead ▾]                                     │
│ Giá trị dự kiến [240.000.000]    Tiền tệ [VND ▾]                             │
│ Xác suất [50]%                   Dự kiến chốt [30/09/2026]                  │
│ Owner * [Nguyễn Minh ▾]          Sales Owner [Chưa gán ▾]                    │
│ Nguồn [AI suggestion ▾]          Trigger [Mở thêm chi nhánh ▾]               │
│ Nhu cầu khách hàng *                                                          │
│ [Khách hàng cần giảm thời gian phản hồi lead ngoài giờ.....................] │
│ Next step * [Đặt lịch demo với COO] Hạn [09/09/2026]                          │
│ [Hủy]                                                       [Tạo cơ hội]     │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Business rules:**

- Nguồn `AI suggestion` phải lưu evidence/signal liên quan để người dùng kiểm tra.
- Nếu CRM tách Sales pipeline, nút `Tạo cơ hội & chuyển Sales` hiển thị mapping preview trước khi sync.
- Khi opportunity thắng, UI hướng người dùng tạo amendment/contract mới theo role và policy.

### UI-AM-26 — Feedback & Survey Center

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Phản hồi khách hàng                                      [Tạo khảo sát] [Survey campaigns]           │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [CSAT trung bình 4,7/5] [NPS +46] [Response rate 38%] [Complaints mở 3]                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Account       Loại       Điểm     Ngày        Phản hồi                                    Follow-up   │
│ Bloom Spa     CSAT       3/5 🟡   04/09/2026  “Cần phản hồi nhanh hơn vào cuối tuần.”   [Tạo task] │
│ An Phú        NPS        9 🟢     03/09/2026  “Báo cáo rõ ràng, team chủ động.”          [Xem]      │
│ EduNext       Complaint  High 🔴  02/09/2026  “CPL tăng cao, chưa nhận phản hồi...”      [Mở case]  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Survey campaign: Q3 Business Review   Gửi: 48 | Đã phản hồi: 18 | Deadline: 15/09 [Xem campaign]    │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### UI-AM-27 — Create Survey Campaign

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│ Tạo chiến dịch khảo sát                                                   [×] │
├───────────────────────────────────────────────────────────────────────────────┤
│ Tên campaign * [CSAT sau QBR — Q3/2026......................................] │
│ Template * [CSAT Standard v2 ▾]       Kênh [Email ▾]                          │
│ Đối tượng [Account theo filter ▾]     Số contact dự kiến: 48 [Xem danh sách]  │
│ Điều kiện: Lifecycle Active; QBR completed trong 14 ngày                       │
│ Lịch gửi [05/09/2026 09:00]          Nhắc lại sau [3 ngày ▾]                  │
│ Không gửi nếu: Đã nhận survey trong [30] ngày                                  │
│ Rule follow-up: CSAT ≤ [3] → Tạo task cho Account Owner trong [24] giờ         │
│ [Lưu nháp]                                                    [Lên lịch gửi]   │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Báo cáo, cấu hình và AI assistant

### UI-AM-28 — Reports: Retention & Renewal

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Báo cáo Retention & Renewal                   [01/01/2026 — 31/12/2026 ▾] [Ngành ▾] [Export]        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Logo Retention 92,4%] [GRR 88,1%] [NRR 106,8%] [Churned MRR 185tr] [Expansion MRR 320tr]            │
├──────────────────────────────────────────────┬──────────────────────────────────────────────────────┤
│ RETENTION THEO COHORT                        │ RENEWAL FORECAST THEO THÁNG                           │
│ [Cohort heatmap]                             │ [Stacked bar: Committed/Likely/Risk/Unlikely]         │
├──────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ CHURN REASONS                                │ RETENTION THEO OWNER                                  │
│ [Bar: Price 38%, Delivery 25%, Budget 19%...]│ Owner    Renewable  Renewed  Rate  At risk revenue    │
│                                              │ Minh      1,2 tỷ     1,05 tỷ 87,5%      120tr          │
├──────────────────────────────────────────────┴──────────────────────────────────────────────────────┤
│ Chi tiết dữ liệu                                                            [Lưu báo cáo] [Export]  │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Yêu cầu report:**

- Mọi chart phải drill-down về danh sách record nguồn có filter tương ứng.
- Tooltip hiển thị công thức/chú giải cho chỉ số tài chính như GRR/NRR.
- Khi data freshness không đảm bảo, hiển thị watermark/badge với thời điểm dữ liệu mới nhất.

### UI-AM-29 — Custom field configuration

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Cấu hình / Custom fields / Account                                      [+ Thêm trường]             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tên hiển thị        API key                  Type       Áp dụng khi           Required  Status      │
│ Dự án chính         primary_project          Lookup     Industry = Real Estate No        Active     │
│ Mục tiêu lead/tháng monthly_lead_target      Number     Service = Lead Gen     Yes       Active     │
│ Campus               campus                   Lookup     Industry = Education   No        Active     │
│ Hạng thành viên      membership_tier          Select     Industry = Beauty      No        Active     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

Drawer tạo custom field:
┌───────────────────────────────────────────────────────────────────────────────┐
│ Thêm custom field                                                        [×]  │
├───────────────────────────────────────────────────────────────────────────────┤
│ Nhãn hiển thị * [Mục tiêu booking/tháng.....................................] │
│ API key *       [monthly_booking_target.....................................] │
│ Loại dữ liệu *  [Number ▾]      Entity [Account ▾]                            │
│ Điều kiện hiển thị [Industry = Spa/Beauty]                                    │
│ Required [☐]                Có thể filter [☑]  Có thể report [☑]              │
│ Validation: Min [0] Max [1000000] Unit [booking]                               │
│ Field-level access: [AM Edit ▾]                                                │
│ [Hủy]                                                        [Tạo trường]     │
└───────────────────────────────────────────────────────────────────────────────┘
```

### UI-AM-30 — SLA policy configuration

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Cấu hình / SLA Policies                                    [+ Tạo SLA policy]                     │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Premium Complaint P1 — Active     Áp dụng: Tier A + Complaint + Priority Critical    [Edit]       │
│ First response: 30 phút business time | Resolution: 4 giờ business time                              │
│ Pause status: Waiting Client | Escalation: 70% Team Lead, 90% Director, 100% Executive             │
├───────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Lịch làm việc: VN Standard 08:30–17:30 T2–T6  |  Holiday calendar: Vietnam 2026                    │
│ [Xem business hours] [Xem lịch nghỉ]                                                                │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### UI-AM-31 — Notification Center

```text
┌──────────────────────────────────────────────────────────────┐
│ Thông báo                                      [Đánh dấu đã đọc]│
├──────────────────────────────────────────────────────────────┤
│ 🔴 2 phút trước  REQ-000291 đã vi phạm Resolution SLA         │
│    EduNext • Account Director đã được escalation              │
│ 🟠 25 phút trước RC-2026-00128 còn 37 ngày tới ngày hết hạn   │
│    Bloom Spa • Next action quá hạn hôm nay                    │
│ 🟡 1 giờ trước  Health Score của Công ty An Phú giảm 76 → 72 │
│    Nguyên nhân: KPI Delivery, SLA breach                      │
│ 🟢 Hôm qua      Invoice INV-2026-08001 đã được thanh toán     │
│    Công ty An Phú                                              │
│ [Xem tất cả thông báo]                                        │
└──────────────────────────────────────────────────────────────┘
```

### UI-AM-32 — AI Assistant drawer

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ✨ Trợ lý Account — Công ty An Phú                                     [×] │
├────────────────────────────────────────────────────────────────────────────┤
│ [Tóm tắt account] [Giải thích health] [Chuẩn bị QBR] [Soạn follow-up]      │
│                                                                            │
│ TÓM TẮT 30 NGÀY GẦN ĐÂY                                                     │
│ Công ty An Phú đang ở mức Watch (72/100), giảm 4 điểm trong 14 ngày...     │
│                                                                            │
│ Điểm tích cực                                                               │
│ • Thanh toán đúng hạn; contact chính vẫn phản hồi đều.                     │
│ Rủi ro cần chú ý                                                            │
│ • Có 2 SLA breach; KPI qualified lead mới đạt 88% mục tiêu.                │
│                                                                            │
│ Đề xuất 3 việc tiếp theo                                                    │
│ 1. Lên lịch QBR trước 10/09 với CEO.                         [Tạo task]   │
│ 2. Rà soát SLA breach và root cause trong 48h.                [Tạo task]   │
│ 3. Chuẩn bị phương án tối ưu lead trong báo cáo tuần.         [Tạo draft]  │
│                                                                            │
│ Evidence used: 2 work items, 5 interactions, KPI snapshot 04/09, contract │
│ [Mở evidence] [👍 Hữu ích] [👎 Không hữu ích]                               │
├────────────────────────────────────────────────────────────────────────────┤
│ Hỏi về account này...                                           [Gửi]     │
│ AI tạo nội dung nháp; bạn cần xác nhận trước khi lưu hoặc gửi.             │
└────────────────────────────────────────────────────────────────────────────┘
```

**Guardrails trên UI:**

- Nêu rõ AI output là đề xuất, không phải dữ liệu xác thực.
- Hiển thị thời gian, phạm vi dữ liệu và evidence sử dụng.
- Tất cả nút tạo task/draft phải mở form prefilled; không thực hiện write ngầm.
- Không hiển thị field người dùng không có permission trong AI context/evidence.

---

## 11. Responsive mockup

### UI-AM-M01 — Mobile Account Quick View

**Mục tiêu:** AM đi gặp khách hoặc di chuyển vẫn có thể xem trạng thái, gọi contact, log activity và xử lý việc khẩn.

```text
┌───────────────────────────────┐
│ ← Công ty An Phú          [⋮] │
│ Active • 🟡 72 Watch           │
├───────────────────────────────┤
│ MRR        Gia hạn    Task mở  │
│ 85tr       53 ngày       4     │
├───────────────────────────────┤
│ CẦN XỬ LÝ                      │
│ 🔴 2 SLA breach                │
│ 🟡 Lên lịch QBR trước 10/09     │
│ [Xem Health & Risk]            │
├───────────────────────────────┤
│ Contact chính                  │
│ Nguyễn An Phú — CEO            │
│ [📞 Gọi] [✉ Email] [💬 Zalo]   │
├───────────────────────────────┤
│ Hoạt động gần đây              │
│ 09:18 Task: Gửi report         │
│ Hôm qua Meeting: CPA review    │
├───────────────────────────────┤
│ [＋ Log activity] [✓ Tạo task]│
└───────────────────────────────┘
```

**Quy tắc mobile:**

- Ưu tiên Quick View, timeline, task detail, log call/meeting, approve/reject onboarding.
- Các màn hình cấu hình, report phức tạp và bulk operations khuyến nghị desktop/tablet.
- Bottom action sticky chỉ hiển thị hành động role được phép.

---

## 12. Prototype flows để dựng Figma

### Flow F-01 — Xử lý Account có rủi ro

1. AM mở My Dashboard.
2. Click `EduNext` trong widget Account cần chú ý.
3. Mở Account 360 → tab Health & Risks.
4. Xem signals và score trend.
5. Click `Tạo recovery plan`.
6. Kiểm tra root cause prefilled, gán action owners và deadline.
7. Lưu plan.
8. Hệ thống tạo task, thông báo owner và ghi timeline.
9. AM review định kỳ; khi đạt exit criteria, yêu cầu tính lại health score.

### Flow F-02 — Gia hạn chủ động

1. Scheduler tạo Renewal Case 60 ngày trước hết hạn.
2. AM nhận notification, mở Renewal Pipeline.
3. Chọn card `Bloom Spa`.
4. Đánh giá health, feedback, invoice, stakeholder và KPI.
5. Cập nhật forecast `Likely 65%`, next action và ngày họp.
6. Tạo proposal hoặc chuyển Sales owner.
7. Sau thỏa thuận, click `Đánh dấu Renewed`.
8. Liên kết contract/amendment mới.
9. Hệ thống cập nhật dashboard, renewal report và timeline.

### Flow F-03 — Xử lý complaint vi phạm SLA

1. Client tạo request qua portal hoặc AM log complaint.
2. Hệ thống áp SLA policy, gán assignee và deadline.
3. SLA đạt 70%: nhắc assignee; 90%: nhắc manager.
4. Breach: Work Item Detail hiện banner đỏ và gửi escalation.
5. AM cập nhật comment, action items, liên kết risk nếu ảnh hưởng retention.
6. Khi xử lý xong, AM chọn `Resolved`, nhập summary.
7. Hệ thống gửi/đề xuất CSAT survey và ghi health signal theo scorecard.

### Flow F-04 — Handover đến Go-live

1. Sales gửi handover từ deal Closed Won.
2. AM kiểm tra scope, KPI, billing, stakeholders, risk và documents.
3. AM yêu cầu bổ sung hoặc xác nhận.
4. Hệ thống tạo Onboarding Case từ template tương ứng.
5. AM/Delivery hoàn tất checklist và milestones.
6. Director phê duyệt go-live nếu cần.
7. Account chuyển Active, tạo baseline health score và cadence work.

---

## 13. Danh sách component tái sử dụng

| Component | Dùng tại | Ghi chú |
|---|---|---|
| HealthBadge | Dashboard, Account header, list, renewal card | Luôn gồm color + label + score |
| SLAIndicator | Work Queue, Work Detail, Account Overview | Hiển thị timer, level, tooltip policy |
| AccountAvatar | List, header, timeline | Logo hoặc chữ cái đầu |
| OwnerSelector | Form, header, bulk transfer | Searchable, scope-aware |
| DateCountdown | Contract, renewal, onboarding | Ngày tuyệt đối + còn bao nhiêu ngày |
| ActivityComposer | Timeline, interaction modal | Rich text, attachment, mention, visibility |
| TaskQuickCreate | Account, risk, meeting, dashboard | Prefill context entity |
| RiskSignalCard | Health Detail, dashboard | Nguồn, tác động điểm, deep link |
| DataTable | Lists, reports | Server-side filter/sort/pagination/column config |
| FilterBar | Dashboard/list/report | Saved views, clear all, filter chips |
| AuditTimeline | Account/contract/config | Immutable appearance |
| AIInsightCard | Account/Health/Growth | Evidence, feedback, confirmation gate |

---

## 14. Checklist handoff cho UX/UI và Engineering

### UX/UI Designer

- Dựng desktop 1440 px cho UI-AM-01 đến UI-AM-32.
- Dựng mobile cho UI-AM-M01 và các modal/task quick actions quan trọng.
- Thiết kế đầy đủ loading, empty, no-permission, validation, error, success toast và confirmation state.
- Xây component library từ danh sách component tái sử dụng.
- Gắn annotation: role permission, business rule, API loading boundary và responsive behavior.
- Kiểm tra contrast, keyboard focus, screen-reader label và không chỉ dùng màu để biểu đạt trạng thái.

### Frontend Engineering

- Thiết kế routes, URL state cho filters và saved view ID.
- Dùng optimistic UI có rollback cho task assignment/status khi phù hợp.
- Lưu server state qua query cache; phân tách loading theo widget/tab.
- Bảo vệ route/action theo permission từ backend, không chỉ ẩn nút phía client.
- Chuẩn hóa table/filter schema để custom fields render động được.

### Backend Engineering

- Cung cấp API aggregate cho Account 360 để tránh N+1 từ frontend.
- Đảm bảo tất cả endpoint list filter theo tenant/data scope và field permission.
- Xây event/outbox cho SLA, renewal, health calc, automation và integration sync.
- Ghi audit cho update dữ liệu nhạy cảm; cung cấp endpoint audit read theo role.
- Có migration/versioning cho custom field, scorecard, onboarding template và SLA policy.

### QA

- Kiểm thử role matrix cho mỗi action và data visibility.
- Kiểm thử timezone/business hours/holiday cho SLA và renewal dates.
- Kiểm thử data consistency giữa Account, Contract, WorkItem, HealthSignal, Risk và Report.
- Kiểm thử bulk action atomicity/partial failure và audit.
- Kiểm thử AI confirmation gate: AI không được tự thực hiện write/send.

---

## 15. Kết luận

Bộ mockup này biến SRS Account Management thành các màn hình và luồng thao tác cụ thể để triển khai Figma, frontend và backend. Trọng tâm xuyên suốt là **Account 360°, hành động tiếp theo, trách nhiệm rõ ràng, kiểm soát SLA, quản trị gia hạn, health score minh bạch và xử lý rủi ro chủ động**.

Khi triển khai thực tế, nên chốt trước vertical MVP đầu tiên (khuyến nghị Agency Marketing hoặc SaaS/retainer), vì đó là cơ sở để khóa bộ custom fields, SLA template, scorecard và onboarding checklist đầu tiên. Sau đó giữ domain core ổn định, mở rộng ngành dọc qua cấu hình thay vì fork giao diện hoặc logic nghiệp vụ.

# Khảo sát và kế hoạch — Quản lý đội AE

| Mục | Giá trị |
|---|---|
| Ngày | 2026-10-13 |
| Trạng thái | Bước 0. Chưa viết mã. Chờ duyệt |
| Hệ thống | `rs.pttads.vn` |
| Brief | Màn theo dõi lead của từng AE, route yêu cầu `/am/team` |

Bốn giai đoạn sau khi duyệt: (1) bảng tổng và chi tiết AE, (2) lead cần can thiệp và chia lại, (3) cảnh báo, (4) xếp hạng, xuất file, làm mới 30 giây. Mỗi giai đoạn dừng để duyệt.

Màn này là bàn điều hành **bán hàng trước hợp đồng**. Không mở rộng Trung tâm AM sau hợp đồng tại `/crm/account-management`, không đụng SLA hop, Lead P1 spa, báo giá P13, và không đổi luật ACM đang thấy mọi lead B2B trên kanban.

---

## 1. Hiện trạng

### 1.1 Không có màn đội AE

Không có route `/am/team`. Mọi màn CRM nằm dưới `/crm/...`, trong shell đăng nhập nhân sự.

| Màn đã có | Việc nó làm | Vì sao không dùng thay |
|---|---|---|
| `/crm/b2b/leads` | Kanban lead B2B | Một bảng chung, không phải một dòng một AE |
| `/crm/gdkd/lead-ops` | Hàng đợi P0–P3, gán lại, job SLA | Bàn giám đốc, không phải bảng đội |
| `/crm/account-management` | Khách đã ký: MRR, gia hạn, sức khỏe | Sau hợp đồng. Người phụ trách là `account_owner_staff_id`, không phải đội AE |

### 1.2 Người và team

| Khái niệm | Nơi lưu | Thực tế |
|---|---|---|
| Chức vụ AE | `position_code` `ae`, `ae-*`, `ae_*`. Hàm `isAccountExecutive` | Đúng người giữ lead |
| Chức vụ ACM | `acm` và bí danh `kd-01`. Hàm `isAccountManager` | Người bán B2B, thấy mọi lead dự án. Không phải trưởng một team AE |
| Team | `staff_teams` + `staff_user_teams` | Có `team_role`, mặc định `member`. Mã `lead` đã được access-review dùng cho trưởng nhóm |
| Leader | `job_functions` chứa `leader` | Được giữ filter chủ sở hữu trên kanban. Không suy ra danh sách AE |
| Pool chia lead B2B | `crm_b2b_project_staff.assign_enabled` | Cờ theo từng dự án, không phải công tắc nghỉ của một AE |
| Vòng tròn khác | `LeadAutoAssignService` theo ngành và dịch vụ | Pool thứ hai, không đọc `assign_enabled` |

Chưa có quan hệ «AM này quản lý các AE này». Nếu không gán `team_role = lead`, màn đội sẽ trống. Đó là việc HR gán team, không phải tự nhận mọi AE vì người đăng nhập là ACM.

### 1.3 Lead, trạng thái, lịch sử, cuộc gọi

Sổ lead là `crm_leads`, khóa `sqlite_lead_id`, chủ sở hữu `owner_id`.

Không có bảng `lead_history` và không có bảng `call_log`.

| Việc brief gọi | Bảng đang dùng |
|---|---|
| Đổi chủ | `crm_lead_assignment_log` (`from_owner_id`, `to_owner_id`, `reason`, `assigned_by`) |
| Đổi trạng thái | `customer_timeline_events` loại `lead.status_changed` |
| Cuộc gọi Kanban | `POST /api/v1/leads/:id/kanban-call`, ghi qua `logKanbanCall`. Cột `last_call_at`, `last_call_result`, `call_attempt_count`, `next_call_at` |
| Xem SĐT đầy đủ | `logLeadPiiView` khi phase `start` của Gọi ngay |
| Ghi chú | `crm_lead_activities` |

Kết quả gọi đang có: `answered`, `no_answer`, `wrong_number`, `callback`. Nghe máy là `answered`.

Đổi chủ lead B2B đang chạy dự án bắt buộc chọn chia hoa hồng (`split_required`) qua `B2bManualReassignService`. Ghi đè `owner_id` thẳng sẽ nhận `400`.

### 1.4 Trạng thái Kanban không trùng tên brief

Brief viết `new / contacted / consulting / quoted`. Hệ thống lưu và vẽ cột như sau. Cột đặt thẻ theo trạng thái thô, hàm `kanbanColumnIdForStatus`.

| Cột trên bảng | Giá trị tính vào cột |
|---|---|
| Mới | `moi`, `new`, `intake` |
| Đã liên hệ | `da_lien_he`, `first_contact`, `contacted`, `qualified`, `qualify` |
| Đang tư vấn | `dang_tu_van`, `nurturing`, `hen_gap` |
| Báo giá | `bao_gia`, `proposal`, `dam_phan` |
| Chốt | `won`, `chot` |

`first_contact` đang nằm ở cột Đã liên hệ trên kanban. Hàm `normalizeLeadStatus` vẫn ánh xạ `first_contact` về `moi` cho phễu. Bảng đội phải đếm bằng `kanbanColumnIdForStatus`, không bằng `normalizeLeadStatus`.

### 1.5 SLA và nhãn Nóng — dùng lại, không viết lại

Nguồn: `crm_lead_sla_settings.payload.kanban`, đọc bởi `kanbanCardSettingsFromPayload`. Thiếu khóa thì lấy seed trong `defaultKanbanCardSettings`.

| Việc | Hàm | Cách tính hiện tại |
|---|---|---|
| Trễ liên hệ lần đầu | `computeKanbanFirstContactSla` | Chỉ trạng thái Mới (`moi`, `new`, `intake`), chưa có cuộc gọi. Phút làm việc qua `workingHoursBetween`. Hết `sla_first_contact_minutes` thì `breach`. Còn dưới `sla_warning_remaining_minutes` thì `warning` |
| Giờ làm của thẻ | `payload.kanban.working_hours` | Seed thứ 2–CN, 08:00–21:00. Khác giờ gốc FR (thứ 2–6, 09:00–18:00). Không đổi giờ gốc |
| Nóng / Ấm / Lạnh | `computeKanbanPriority` | Điểm nguồn + nhu cầu + còn mới trong `fresh_within_minutes`. Không phải «Nóng mà chưa gọi 30 phút» |
| Đứng yên | `isKanbanStale` | Số ngày lịch ≥ `stale_days` của cột. Seed: Mới 1, Đã liên hệ 2, Đang tư vấn 3, Báo giá 7, Chăm sóc lại 2 |
| Báo giá cũ | `isQuoteStale` | Trạng thái báo giá và tuổi kể từ `received_at` ≥ `quote_stale_days` (seed 7). Tuổi này dài hơn tuổi thật kể từ lúc vào cột Báo giá |
| Hẹn hôm nay | `isCallbackToday` | `next_call_at` cùng ngày ICT |

Seed SLA liên hệ là **15 phút**, không phải 30. Màn đội đọc đúng số đã publish.

### 1.6 Những thứ brief cần mà hệ thống chưa có

- Công tắc nhận lead của một AE, độc lập với từng dự án.
- Chỉ tiêu doanh số tháng theo AE. Giá trị lead nằm ở `expected_value` hoặc `deal_value_vnd` khi đã nhập. Thiếu thì là null, UI để `—`. Không điền 0.
- Bảng cảnh báo cho rule đội AE. `crm_am_notifications` là chuông Trung tâm AM sau hợp đồng.
- Snapshot ngày cho bảng tổng. Đếm trực tiếp cả sổ mỗi request sẽ nặng khi sổ lớn.
- WebSocket. Kanban B2B đang poll 30 giây.
- Kênh nhắc Zalo hoặc email cho nhân sự bán hàng. Có notify Zalo cho mốc chiến dịch, không phải hộp thư AE. Giai đoạn này không mở kênh mới.

---

## 2. Quyết định cần duyệt

1. Route thật là `/crm/b2b/team` và `/crm/b2b/team/[aeId]`. Brief `/am/team` nằm ngoài shell CRM. Nhãn menu: **Đội AE**.
2. Đội của người đăng nhập = các `staff_teams` mà họ có `staff_user_teams.team_role = lead`. AE trong bảng = thành viên cùng team, chức vụ AE, còn active. ACM không tự thấy mọi AE.
3. Quản lý = capability mới `crm_ae_team.view_all`. Không gán cho ACM. Không dùng `crm_gdkd.view_all_leads` làm chìa của màn này.
4. Ngưỡng mới nằm trong `payload.kanban.ae_team`. Thiếu khóa thì seed một lần khi đọc, cùng kiểu `stale_days`. Không viết số ở component.
5. Chuyển lead B2B đi qua `B2bManualReassignService` và bắt chọn split đang có. Lý do chuyển là bắt buộc và ghi vào `crm_lead_assignment_log.reason`.
6. Nhắc AE và ghi chú chỉ đạo ghi `crm_lead_activities` và một chuông trong app. Không gửi Zalo, không gửi email.
7. Làm mới số trễ và danh sách can thiệp bằng poll 30 giây, cùng nhịp kanban B2B. Không thêm WebSocket.
8. Doanh số = tổng giá trị đã nhập của lead cột Chốt trong kỳ. Chưa có chỉ tiêu hoặc chưa có giá trị thì hiện `—`.

---

## 3. Ngưỡng `payload.kanban.ae_team`

Seed chỉ khi khóa chưa có. Giá trị đang chạy là bản đã publish.

| Khóa | Seed | Dùng cho |
|---|---|---|
| `hot_uncalled_minutes` | 30 | R2 |
| `quote_followup_days` | 7 | R3, tính từ lúc vào cột Báo giá |
| `max_unanswered_calls` | 3 | R5, đếm `no_answer` liên tiếp trên lead đang mở |
| `ae_sla_breach_yellow` | 1 | Số lead trễ của một AE chuyển vàng |
| `ae_sla_breach_red` | 3 | Số lead trễ chuyển đỏ |
| `ae_sla_breach_alert` | 3 | Job báo AM |
| `ae_idle_hours` | 2 | Giờ làm việc không có cuộc gọi |
| `ae_drop_percent` | 20 | % nghe máy hoặc % chốt tuần này giảm so với tuần trước |
| `alert_interval_minutes` | 15 | Chu kỳ job |
| `alert_cooldown_minutes` | 120 | Cùng rule và cùng đối tượng |
| `escalate_minutes` | 60 | AM chưa xử lý thì báo quản lý |
| `show_rank_to_ae` | false | AE chỉ thấy hạng của mình khi true |
| `suggest_weights` | `open_leads` 0.5, `win_rate` 0.3, `accepting` 0.2 | Gợi ý AE nhận |
| `rank_weights` | SLA 0.3, cuộc gọi 0.2, chuyển đổi 0.2, doanh số 0.3 | Điểm xếp hạng |

SLA, giờ làm, `stale_days`, cảnh báo sắp trễ dùng khóa kanban đã có. Không nhân bản `sla_first_contact_minutes`.

Màu dòng AE: số lead `breach` ≥ `ae_sla_breach_red` thì đỏ. ≥ `ae_sla_breach_yellow` thì vàng. Còn lại xanh. So sánh đọc settings tại thời điểm render.

---

## 4. Dữ liệu thêm

Không tạo `users`, `lead_status`, `call_log`, `lead_history`.

| Việc | Cách lưu |
|---|---|
| Bật nhận lead | Bảng `crm_ae_intake (staff_id PK, accepting BOOLEAN, note, updated_by, updated_at)`. Tắt thì `b2b-first-assign` và `LeadAutoAssignService` bỏ người đó. `assign_enabled` theo dự án giữ nguyên: cả hai phải bật mới được chia |
| Chỉ tiêu tháng | `crm_ae_targets (staff_id, month, quota_vnd)`. Trống thì doanh số / chỉ tiêu là `—` |
| Ghi chú chỉ đạo | `crm_lead_activities.activity_type = am_instruction`. Xác nhận đã đọc: `crm_ae_instruction_reads (activity_id, staff_id, read_at)` |
| Cảnh báo | `crm_ae_team_alerts (id, rule_code, target_type, target_id, level, status, owner_staff_id, dedupe_key, created_at, acknowledged_at, resolved_at, resolved_by)`. `status`: `open`, `acknowledged`, `resolved`. Unique một dòng mở cho mỗi `dedupe_key` |
| Snapshot | `crm_ae_team_daily (staff_id, day, counts_json)`. Job cuối ngày ICT. Request bảng tổng đọc snapshot cho kỳ đã khép; ngày hôm nay cộng thêm truy vấn hẹp lead đang mở của các AE trong đội |

Migration version không quá 32 ký tự: `20261013_ae_team_g1`, `_g2`, `_g3`.

G1 tạo intake, targets, và cột snapshot trống. G2 không thêm bảng lịch sử. G3 tạo alerts.

---

## 5. API

Prefix `/api/crm/ae-team`. Staff JWT. Lỗi `{ok:false,error:{code,message}}`.

Mọi handler resolve đội trước. AE gọi bất kỳ đường này nhận `403 ae_team_forbidden`, trừ `GET /me/rank` khi `show_rank_to_ae` đã bật. Người không phải lead và không có `view_all` nhận `403`. Lead ngoài đội nhận `404`.

| Giai đoạn | Phương thức | Đường | Việc |
|---|---|---|---|
| 1 | GET | `/summary?from&to` | Thẻ tổng và các dòng AE. Sắp `sla_breach` giảm dần |
| 1 | GET | `/members/:staffId?from&to` | Header AE, chuỗi 30 ngày, ghi chú chỉ đạo |
| 1 | GET | `/members/:staffId/leads` | Cùng list kanban, thêm `owner_id` của AE đó |
| 2 | GET | `/interventions?from&to` | Lead R1–R5 của đội |
| 2 | POST | `/interventions/remind` | Activity `ae_remind` + chuông |
| 2 | POST | `/reassign` | `{lead_ids, to_staff_id, reason, split}` |
| 2 | POST | `/instructions` | `{lead_id, note}` |
| 2 | POST | `/instructions/:id/read` | AE xác nhận |
| 2 | POST | `/intake` | `{staff_id, accepting, note}` |
| 2 | GET | `/suggest?lead_id` | Điểm AE nhận |
| 3 | POST | `/alerts/tick` | Job nội bộ |
| 3 | POST | `/alerts/:id/ack` và `/resolve` | |
| 4 | GET | `/ranking?grain=day\|week\|month` | |
| 4 | GET | `/ranking/export?format=csv` | CSV UTF-8. PDF để sau khi có mẫu in |
| 4 | GET | `/me/rank` | AE, khi settings bật |

Gọi ngay không có API mới. UI gọi `POST /api/v1/leads/:id/kanban-call`. Xem SĐT vẫn đi `logLeadPiiView`.

### 5.1 Cột bảng tổng

Mỗi dòng một AE. Kỳ lọc: hôm nay, tuần, tháng, hoặc từ–đến, theo `Asia/Ho_Chi_Minh`.

| Cột | Cách đếm |
|---|---|
| Lead đang giữ | Lead B2B không trùng, `owner_id` là AE, chưa `lost` và chưa `closed`. Bốn số: Mới, Đã liên hệ, Đang tư vấn, Báo giá |
| Trễ SLA, sắp trễ | `computeKanbanFirstContactSla` ra `breach` và `warning` |
| % đúng SLA | Lead đã rời Mới hoặc đã có cuộc gọi trong hạn, chia số lead nhận trong kỳ. Mẫu số 0 thì `—` |
| Phản hồi lần đầu | Trung bình phút làm việc từ `received_at` đến cuộc gọi đầu. Ngoài giờ làm không tính |
| Cuộc gọi hôm nay, % nghe | Activity gọi trong ngày. Nghe máy / tổng kết quả. Không có cuộc gọi thì `%` là `—` |
| Đứng yên | `isKanbanStale` theo `stale_days` của trạng thái |
| Hẹn lỡ | `next_call_at` đã qua và chưa có cuộc gọi sau mốc đó |
| Lead → báo giá | Số vào cột Báo giá trong kỳ / số lead nhận trong kỳ |
| Báo giá → chốt | Số vào cột Chốt / số đã vào Báo giá |
| Doanh số / chỉ tiêu | Tổng giá trị đã nhập của lead Chốt / `quota_vnd`. Thiếu một vế thì `—` |
| Nhận lead | `crm_ae_intake.accepting`, mặc định bật khi chưa có dòng |

Thẻ trên cùng: tổng lead đội, % đúng SLA đội, số lead thuộc R1–R5, doanh số đội / tổng chỉ tiêu.

### 5.2 Rule can thiệp

Một lead có thể mang nhiều mã. Thứ tự dòng: R1, R2, rồi R4, rồi R3, rồi R5. Cùng mức thì trễ lâu hơn đứng trước.

| Mã | Điều kiện |
|---|---|
| R1 | `computeKanbanFirstContactSla` = `breach` |
| R2 | `computeKanbanPriority` = `hot`, chưa có cuộc gọi, phút làm việc từ lúc nhận ≥ `hot_uncalled_minutes` |
| R3 | Đang cột Báo giá, số ngày từ lúc vào cột ≥ `quote_followup_days` |
| R4 | `next_call_at` đã qua, chưa gọi sau mốc đó |
| R5 | Số `no_answer` liên tiếp hiện tại ≥ `max_unanswered_calls` |

«Trễ bao lâu» của R1 và R2 là phút làm việc. R3 là số ngày. R4 là phút đồng hồ từ `next_call_at`. R5 là số lần.

### 5.3 Gợi ý AE nhận

Điểm chỉ tính AE trong đội, `accepting = true`, và `assign_enabled` trên dự án của lead.

`điểm = w.open_leads × (1 − lead đang giữ / max trong đội) + w.win_rate × tỉ lệ chốt kỳ + w.accepting × 1`

Thiếu tỉ lệ chốt thì hạng đó bỏ và chuẩn hóa lại trọng số còn lại. Không gợi ý AE đã tắt nhận.

### 5.4 Job cảnh báo

Chạy mỗi `alert_interval_minutes`, chỉ khi `workingHoursBetween` của kanban đang trong ca. Ngoài giờ thì không insert.

| Rule | Điều kiện | Người nhận |
|---|---|---|
| `AE-SLA` | AE có số lead breach ≥ `ae_sla_breach_alert` | Trưởng team |
| `HOT-AE` | R2 vừa chạm ngưỡng | AE giữ lead |
| `HOT-AM` | R2 vẫn chưa gọi sau thêm một nhịp | Trưởng team |
| `AE-IDLE` | 0 cuộc gọi trong `ae_idle_hours` giờ làm | Trưởng team |
| `AE-DROP` | % nghe máy hoặc % chốt tuần này giảm hơn `ae_drop_percent` so với tuần trước | Trưởng team |
| `ESC` | Cảnh báo vàng hoặc đỏ của AM còn `open` quá `escalate_minutes` | Người có `crm_ae_team.view_all` |

`dedupe_key = rule + target + kỳ`. Còn trong `alert_cooldown_minutes` thì không tạo dòng mới. Mức info không leo thang. Đóng khi điều kiện hết thì `resolved` và `resolved_by = system`.

---

## 6. UI

Nằm trong shell CRM hiện tại. Tái sử dụng `LeadKanbanBoard` với `owner_id` cố định của AE và ẩn nút đổi filter chủ sở hữu. Gọi ngay tái sử dụng popup kết quả của kanban.

| Giai đoạn | Màn |
|---|---|
| 1 | `/crm/b2b/team`: thẻ tổng, bảng, lọc kỳ, sắp mọi cột, mặc định trễ SLA giảm dần. `/crm/b2b/team/[aeId]`: kanban của AE, timeline từ activity và assignment log, biểu đồ 30 ngày, danh sách ghi chú |
| 2 | Khối «Lead cần can thiệp» trên cùng trang đội. Hành động nhắc, chuyển, tự gọi, ghi chú. Chuyển nhiều lead một lần. Drawer chia lại và nghỉ phép chuyển lead đang mở |
| 3 | Cột cảnh báo mở trên bảng đội. Nút đã xem và đã xử lý |
| 4 | Tab xếp hạng, nút CSV, chế độ trình chiếu cùng số liệu, poll 30 giây cho số trễ và danh sách R |

Laptop và tablet: bảng ngang cuộn, thẻ tổng xuống hai hàng. Không thiết kế điện thoại.

Menu **Đội AE** chỉ hiện khi `team_role = lead` hoặc `crm_ae_team.view_all`. AE không thấy menu.

---

## 7. Quyền

| Capability | Ai |
|---|---|
| `crm_ae_team.view` | Trưởng team, chỉ dữ liệu team mình |
| `crm_ae_team.manage` | Trưởng team: chuyển, nhắc, chỉ đạo, bật tắt nhận lead |
| `crm_ae_team.view_all` | Quản lý: mọi team, so sánh AM |

Kiểm tra trên server. Ẩn menu chỉ là phụ. Không cấp các quyền này trong seed ACM. Không cấp `crm_gdkd.view_all_leads`.

AE mở `/crm/b2b/team` nhận 403. Xem SĐT trên màn này vẫn ghi `logLeadPiiView`.

---

## 8. Kiểm thử theo giai đoạn

Giai đoạn 1: Jest cho đếm cột bằng `kanbanColumnIdForStatus`, SLA trong và ngoài giờ, màu theo settings. Vitest bảng sắp mặc định. API: trưởng team khác nhận 403 với AE không cùng team.

Giai đoạn 2: Jest R1–R5 ngay dưới và ngay trên ngưỡng, gợi ý bỏ AE đã tắt, chuyển 3 lead ghi đủ `from_owner_id`, `to_owner_id`, `reason`. Tắt nhận lead thì vòng tròn không chọn người đó. AE nhận 403. Kanban hai AE đổi chủ sau khi chuyển.

Giai đoạn 3: cooldown không insert lần hai, ngoài giờ không insert, ESC đổi level khi quá hạn, info không leo thang.

Giai đoạn 4: điểm hạng theo trọng số, CSV không chứa SĐT, poll không đổi số khi dữ liệu đứng yên.

Sau mỗi giai đoạn có báo cáo thay đổi và dừng. Chưa có duyệt thì không sang giai đoạn sau và không deploy.

# PRD/SRS — Module Account Management cho CRM đa ngành

**Phiên bản:** 1.0  
**Ngày:** 05/09/2026  
**Trạng thái:** Draft triển khai  
**Đối tượng:** Product Owner, Business Analyst, UX/UI Designer, Tech Lead, QA, đội Account Management, Delivery/Operation, Finance

---

## 1. Tổng quan sản phẩm

### 1.1. Bối cảnh

Module **Account Management** là không gian vận hành trung tâm cho đội ngũ chăm sóc và phát triển khách hàng sau bán hàng trong CRM đa ngành. Module giúp Account Manager (AM), Account Executive (AE), Customer Success Manager (CSM), Project/Delivery Manager và quản lý theo dõi toàn bộ vòng đời khách hàng: onboarding, triển khai dịch vụ, giao tiếp, công việc, hợp đồng, gia hạn, công nợ, hài lòng, rủi ro churn và cơ hội tăng trưởng.

Thiết kế mặc định hướng đến doanh nghiệp dịch vụ/agency marketing, nhưng phải cấu hình được cho các ngành dọc như:

- Agency marketing, truyền thông, sản xuất nội dung, performance marketing, branding.
- Bất động sản/PropTech: chủ đầu tư, sàn môi giới, đại lý, dự án, lead generation và booking.
- Spa/làm đẹp: chuỗi spa, clinic, salon, khách hàng B2B/B2C, gói truyền thông và CRM chăm sóc.
- Giáo dục: trung tâm, trường, hệ thống đào tạo, tuyển sinh, chăm sóc phụ huynh/học viên.
- Dịch vụ tư vấn, phần mềm SaaS, outsourcing, đào tạo doanh nghiệp và các mô hình subscription/retainer.

### 1.2. Vấn đề cần giải quyết

Các đội AM thường quản lý dữ liệu phân tán qua Excel, chat, email, công cụ quản lý việc, hóa đơn và nhiều dashboard rời rạc. Hệ quả là:

- Không có góc nhìn 360° về từng khách hàng và mức độ rủi ro.
- Bỏ lỡ lịch gia hạn, lịch thanh toán, mốc triển khai và các cam kết SLA.
- Khó xác định ai chịu trách nhiệm, ai đang chờ xử lý và nguyên nhân chậm trễ.
- Dữ liệu churn, CSAT/NPS, hiệu quả dịch vụ và doanh thu không liên kết thành một hồ sơ.
- Upsell/Cross-sell chủ yếu dựa vào cảm tính, không có tín hiệu và quy trình chuẩn.
- Quản lý khó đánh giá workload, hiệu suất AM, tỷ lệ giữ chân khách hàng và doanh thu chịu rủi ro.

### 1.3. Mục tiêu

1. Chuẩn hóa hồ sơ khách hàng và toàn bộ lịch sử vận hành theo một Account 360°.
2. Giảm nguy cơ bỏ sót việc, vi phạm SLA, chậm gia hạn và thất thoát doanh thu.
3. Cung cấp Customer Health Score có thể giải thích được và cấu hình theo ngành.
4. Biến tín hiệu rủi ro, cơ hội upsell và nghĩa vụ hợp đồng thành task có owner, hạn xử lý và trạng thái rõ ràng.
5. Cung cấp dashboard thời gian thực cho AM và quản lý.
6. Cho phép triển khai multi-tenant, đa tổ chức, đa ngành, đa ngôn ngữ và đa tiền tệ khi cần.

### 1.4. Chỉ số thành công

| Nhóm | Chỉ số | Mục tiêu gợi ý sau 6 tháng |
|---|---|---:|
| Adoption | Tỷ lệ AM hoạt động hằng tuần | ≥ 85% |
| Dữ liệu | Account active có owner và health score | ≥ 95% |
| Vận hành | Task quá hạn SLA | Giảm ≥ 30% |
| Retention | Tỷ lệ gia hạn đúng hạn | ≥ 90% |
| Revenue | Doanh thu hợp đồng hết hạn không được cảnh báo | 0 |
| CS | Khách hàng có rủi ro được lập action plan trong 48 giờ | ≥ 90% |
| Growth | Cơ hội upsell được tạo từ tín hiệu hệ thống | ≥ 20% tổng cơ hội |

### 1.5. Ngoài phạm vi phiên bản đầu

- Thay thế hoàn toàn phần mềm kế toán/ERP.
- Tự động gửi email, Zalo, SMS ở mọi kênh mà chưa có nền tảng tích hợp.
- Hệ thống quản trị dự án chuyên sâu tương đương Jira/ClickUp.
- Dự báo AI hoàn toàn tự động không có khả năng giải thích hoặc phê duyệt của người dùng.
- Quản lý lương thưởng, chấm công và HRM.

---

## 2. Người dùng và phân quyền

### 2.1. Personas

| Persona | Mục tiêu | Nhu cầu chính |
|---|---|---|
| Account Executive | Theo dõi và phản hồi khách hàng hằng ngày | Danh sách việc, lịch sử trao đổi, nhắc SLA, thông tin account đầy đủ |
| Account Manager | Giữ chân và phát triển danh mục khách hàng | Health score, gia hạn, doanh thu, action plan, upsell |
| Customer Success Manager | Bảo đảm khách hàng đạt giá trị cam kết | Onboarding, adoption, CSAT/NPS, sử dụng dịch vụ, churn prevention |
| Delivery/Project Manager | Bàn giao đúng phạm vi và deadline | Milestone, dependency, issue, phê duyệt và SLA |
| Account Director/Head of CS | Điều hành đội ngũ và danh mục khách hàng | Dashboard theo owner/ngành/gói, capacity, retention, risk revenue |
| Finance/AR | Theo dõi hóa đơn và công nợ | Lịch thanh toán, overdue, trạng thái thu tiền |
| Management/Board | Giám sát tăng trưởng và rủi ro kinh doanh | ARR/MRR, churn, renewal forecast, revenue at risk, NRR |
| Client Portal User | Theo dõi dịch vụ và phối hợp (tùy chọn) | Tiến độ, tài liệu, duyệt, ticket, báo cáo |

### 2.2. Vai trò hệ thống

| Role | Quyền cốt lõi |
|---|---|
| System Admin | Quản trị tenant, người dùng, role, master data, cấu hình score và workflow |
| CRM Admin | Quản trị field, layout, pipeline, template, automation, dữ liệu khách hàng |
| Account Director | Xem/sửa toàn bộ account trong đơn vị; phê duyệt escalation, action plan và chuyển owner |
| Account Manager | CRUD account được phân công; tạo task, interaction, risk, opportunity; yêu cầu chuyển owner |
| Account Executive | Cập nhật activity/task/ghi chú và xem account được phân quyền; giới hạn sửa hợp đồng/tài chính |
| Delivery Manager | Cập nhật delivery, milestone, issue và SLA liên quan account được giao |
| Finance | Cập nhật invoice/payment; xem hạn chế dữ liệu vận hành theo policy |
| Read-only Executive | Chỉ xem dashboard và account được cấp quyền |
| Client Portal User | Chỉ xem/cộng tác với dữ liệu account của tổ chức khách hàng |

### 2.3. Nguyên tắc phân quyền

- Bắt buộc tenant isolation: người dùng chỉ truy cập dữ liệu trong tenant/tổ chức được cấp.
- Áp dụng RBAC kết hợp phạm vi dữ liệu: `own`, `team`, `department`, `all`, `explicit share`.
- Các trường nhạy cảm như doanh thu, chi phí, biên lợi nhuận, công nợ, lý do churn phải có field-level permission.
- Mọi thay đổi owner, giá trị hợp đồng, điểm health thủ công, trạng thái churn và xóa dữ liệu phải ghi audit log.
- Không xóa cứng Account, Contract, Invoice hoặc Interaction đã phát sinh; mặc định soft-delete/archival.

---

## 3. Phạm vi và chức năng

### 3.1. Danh mục chức năng

| Mã | Nhóm chức năng | Mô tả |
|---|---|---|
| AM-01 | Dashboard | KPI, việc cần xử lý, cảnh báo, hiệu suất danh mục |
| AM-02 | Account 360 | Hồ sơ khách hàng, contact, timeline, tags, tài liệu và custom fields |
| AM-03 | Onboarding | Checklist, milestone, handover từ Sales, xác nhận go-live |
| AM-04 | Contracts & Renewals | Hợp đồng, phụ lục, kỳ hạn, giá trị, gia hạn, cảnh báo |
| AM-05 | Work & SLA | Task, issue, request, SLA, escalation và workload |
| AM-06 | Interaction | Ghi nhận cuộc gọi, họp, email, chat, biên bản và follow-up |
| AM-07 | Health & Risk | Health score, tín hiệu, risk register, action plan, churn management |
| AM-08 | Growth | Upsell/cross-sell, expansion opportunity, đề xuất dịch vụ |
| AM-09 | Financial Snapshot | Invoice, payment, công nợ, revenue at risk; tích hợp Finance là nguồn chuẩn |
| AM-10 | Feedback | CSAT, NPS, khảo sát, khiếu nại và CAPA |
| AM-11 | Reports | Báo cáo retention, churn, renewal, SLA, account owner, industry |
| AM-12 | Configuration | Cấu hình ngành, custom fields, scorecard, workflow, template, reason code |
| AM-13 | AI Assistance | Tóm tắt, gợi ý action, phát hiện rủi ro, chuẩn bị QBR có human approval |

### 3.2. User stories ưu tiên

| ID | User story | Ưu tiên |
|---|---|---|
| US-AM-001 | Là AM, tôi muốn xem dashboard danh mục của mình để biết các việc và rủi ro cần ưu tiên hôm nay | Must |
| US-AM-002 | Là AM, tôi muốn xem hồ sơ 360° của một khách hàng để không phải tìm dữ liệu ở nhiều nơi | Must |
| US-AM-003 | Là AM, tôi muốn hệ thống nhắc hợp đồng sắp hết hạn theo nhiều mốc để chủ động gia hạn | Must |
| US-AM-004 | Là AM, tôi muốn tạo và giao task có SLA để kiểm soát cam kết với khách hàng | Must |
| US-AM-005 | Là Manager, tôi muốn biết doanh thu đang rủi ro theo account và owner để can thiệp sớm | Must |
| US-AM-006 | Là CSM, tôi muốn theo dõi onboarding checklist và mốc go-live của khách hàng mới | Should |
| US-AM-007 | Là AM, tôi muốn hệ thống tính health score và giải thích các yếu tố tác động | Must |
| US-AM-008 | Là AM, tôi muốn lập action plan cho account rủi ro và theo dõi hiệu quả phục hồi | Must |
| US-AM-009 | Là Finance, tôi muốn đồng bộ tình trạng hóa đơn/công nợ để AM có ngữ cảnh khi làm việc với khách | Should |
| US-AM-010 | Là AM, tôi muốn tạo cơ hội upsell từ tín hiệu sử dụng, kết quả hoặc nhu cầu khách hàng | Should |
| US-AM-011 | Là Director, tôi muốn xem retention, NRR và performance theo đội/ngành/dịch vụ | Should |
| US-AM-012 | Là CRM Admin, tôi muốn cấu hình field, score và workflow khác nhau cho từng ngành | Must |

---

## 4. Yêu cầu chức năng chi tiết

### 4.1. AM-01 — Dashboard

#### Mục đích

Cung cấp một màn hình làm việc theo vai trò, tập trung vào quyết định và hành động thay vì chỉ báo cáo.

#### Thành phần giao diện

- Bộ lọc thời gian: hôm nay, tuần này, tháng này, quý này, tùy chọn.
- Bộ lọc phạm vi: owner, team, ngành, loại khách hàng, gói dịch vụ, khu vực, trạng thái account.
- KPI cards:
  - Account active.
  - Tổng MRR/ARR hoặc doanh thu theo kỳ.
  - Doanh thu sắp gia hạn trong 30/60/90 ngày.
  - Revenue at risk.
  - Account có health đỏ/vàng.
  - Tỷ lệ gia hạn.
  - Task quá hạn/SLA breach.
  - CSAT/NPS trung bình.
  - Cơ hội upsell đang mở.
- Widget “Việc cần xử lý hôm nay”: task, ticket, follow-up, renewal, overdue invoice theo mức ưu tiên.
- Widget “Account cần chú ý”: xếp theo risk score, giá trị doanh thu, ngày gia hạn và SLA.
- Biểu đồ xu hướng: revenue, health distribution, renewal forecast, churn/expansion theo thời gian.
- Bảng danh sách account có thể lưu view cá nhân/shared view.

#### Business rules

- User chỉ thấy dữ liệu theo data scope.
- KPI tài chính lấy từ nguồn Finance/ERP nếu có tích hợp; nếu không, lấy từ contract value theo quy tắc tenant cấu hình.
- Revenue at risk = tổng recurring value của các account có health `At Risk` hoặc `Critical`, có thể cấu hình ngưỡng.
- Widget phải ưu tiên task quá hạn, hợp đồng hết hạn gần, escalation mở và account critical.

#### Acceptance criteria

- Dashboard tải các KPI chính trong tối đa 3 giây với 10.000 account trong một tenant ở điều kiện hạ tầng mục tiêu.
- Thay đổi bộ lọc cập nhật toàn bộ widget nhất quán.
- Click KPI dẫn đến danh sách account đã áp dụng đúng bộ lọc tương ứng.
- Người dùng có thể lưu tối thiểu 10 view cá nhân; Admin có thể tạo view dùng chung.

### 4.2. AM-02 — Account 360

#### Cấu trúc hồ sơ

Mỗi Account có các vùng thông tin sau:

1. Header: tên, mã account, logo/avatar, trạng thái, health score, owner, segment, tags, hành động nhanh.
2. Overview: thông tin doanh nghiệp, dịch vụ, doanh thu, hợp đồng hiện hành, KPI/OKR, contact chính.
3. Timeline: hoạt động theo thời gian từ mọi nguồn.
4. Projects/Delivery: dự án, campaign, milestone, ticket và SLA.
5. Contracts & Finance: hợp đồng, phụ lục, invoice, công nợ, lịch gia hạn.
6. Health & Risks: điểm sức khỏe, tín hiệu, rủi ro, action plan.
7. Growth: cơ hội upsell/cross-sell, nhu cầu, proposal.
8. Feedback: CSAT/NPS, khiếu nại, phản hồi.
9. Documents: file, link, template, meeting minutes.
10. Audit: lịch sử thay đổi đối với người có quyền.

#### Trường dữ liệu lõi

| Nhóm | Trường chuẩn | Bắt buộc |
|---|---|---|
| Định danh | account_id, account_code, legal_name, display_name, status | Có |
| Phân loại | industry, segment, account_type, source, tags | Có: industry, account_type |
| Sở hữu | primary_owner_id, secondary_owner_ids, team_id | Có: primary_owner_id |
| Liên hệ | contacts, preferred_channel, timezone, address | Có ít nhất 1 contact cho account active |
| Thương mại | service_package, billing_model, currency, recurring_value, start_date | Theo loại hợp đồng |
| Vận hành | onboarding_status, success_plan, SLA plan, delivery owner | Có khi active |
| Sức khỏe | health_score, health_level, last_calculated_at, override_reason | Hệ thống tính |
| Vòng đời | lifecycle_stage, go_live_date, renewal_date, churn_date | Theo trạng thái |
| Mở rộng | custom_fields JSON/schema-driven | Tùy cấu hình tenant/industry |

#### Trạng thái account chuẩn

- `Prospect`: chỉ dùng khi CRM gom cả pre-sales; có thể tắt.
- `Won / Pending Handover`: Sales đã chốt, chờ bàn giao.
- `Onboarding`: đang triển khai khởi tạo.
- `Active`: đang sử dụng dịch vụ.
- `At Risk`: có nguy cơ ảnh hưởng retention hoặc revenue.
- `Paused`: tạm ngưng theo thỏa thuận.
- `Renewal In Progress`: đang thương lượng/gia hạn.
- `Churned`: chấm dứt dịch vụ.
- `Archived`: lưu trữ, không vận hành.

#### Acceptance criteria

- Có thể tạo account từ UI, import CSV hoặc webhook/API từ Sales CRM.
- Account active không được thiếu owner, lifecycle stage và contact chính.
- Mọi thay đổi trường lõi đều lưu `old_value`, `new_value`, actor, timestamp và source.
- Timeline hợp nhất hiển thị theo thứ tự thời gian, có filter loại hoạt động và người thực hiện.

### 4.3. AM-03 — Onboarding & Handover

#### Mục đích

Bảo đảm việc chuyển giao từ Sales sang đội AM/Delivery đầy đủ, có trách nhiệm và kiểm soát mốc go-live.

#### Luồng chuẩn

1. Sales đánh dấu deal `Closed Won`.
2. Hệ thống tạo Account ở trạng thái `Pending Handover` hoặc liên kết account có sẵn.
3. Sales hoàn tất handover form: scope, mục tiêu, cam kết, giá trị, pricing, lịch thanh toán, stakeholder, rủi ro đã biết, tài liệu deal.
4. AM/Delivery xác nhận nhận bàn giao hoặc yêu cầu bổ sung.
5. Hệ thống tạo onboarding template tương ứng theo ngành/gói dịch vụ.
6. Onboarding owner hoàn tất checklist, mốc kickoff và go-live.
7. Account chuyển `Active` sau khi đạt điều kiện go-live cấu hình.

#### Checklist mẫu

- Xác nhận hợp đồng/phụ lục và người ký.
- Xác nhận scope, KPI, timeline và exclusions.
- Xác nhận stakeholder map và kênh liên lạc.
- Kickoff meeting đã tổ chức.
- Thu thập access/tài sản số/dữ liệu đầu vào.
- Thiết lập project/campaign/service workspace.
- Thiết lập báo cáo, cadence họp và SLA.
- Xác nhận go-live.

#### Business rules

- Không chuyển `Active` nếu checklist bắt buộc chưa hoàn thành, trừ khi người có quyền override có lý do.
- Mỗi template có version; account sử dụng snapshot template tại thời điểm tạo onboarding.
- Handover rejection phải có lý do và thông báo lại Sales owner.

### 4.4. AM-04 — Contracts, Renewals & Obligations

#### Thực thể

- Contract: hợp đồng gốc.
- Contract Line Item: dịch vụ/gói/hạng mục.
- Amendment: phụ lục thay đổi phạm vi, giá, thời hạn.
- Renewal Case: hồ sơ gia hạn.
- Obligation: nghĩa vụ/cam kết quan trọng.

#### Trường Contract cốt lõi

| Trường | Mô tả |
|---|---|
| contract_id / contract_code | Định danh duy nhất |
| account_id | Account sở hữu hợp đồng |
| contract_type | One-time, retainer, subscription, project-based, framework |
| status | Draft, Pending Approval, Active, Expiring, Renewed, Terminated, Expired |
| effective_date / expiry_date | Hiệu lực và hết hạn |
| auto_renew | Có/không và điều khoản liên quan |
| currency | Tiền tệ |
| total_contract_value | Tổng giá trị hợp đồng |
| recurring_value | MRR/ARR hoặc giá trị định kỳ |
| billing_schedule | Lịch xuất hóa đơn/thanh toán |
| payment_terms | Điều khoản thanh toán |
| notice_period_days | Thời hạn báo trước |
| owner_id | Account owner chịu trách nhiệm |
| document_links | Tài liệu hợp đồng/ký số |

#### Luồng gia hạn

1. Job scheduler tạo Renewal Case theo các mốc cấu hình: mặc định 90, 60, 30, 14, 7 và 1 ngày trước hết hạn.
2. Case được gán cho Account Owner và thông báo cho Account Director theo ngưỡng giá trị/rủi ro.
3. AM đánh giá sức khỏe, nhu cầu khách hàng, kết quả dịch vụ và phương án renewal.
4. AM tạo proposal hoặc chuyển cơ hội sang Sales theo policy tổ chức.
5. Renewal Case cập nhật kết quả: renewed, pending, lost, churned, paused.
6. Nếu renewed, hệ thống tạo Contract mới hoặc Amendment theo cấu hình; liên kết chuỗi hợp đồng.
7. Nếu churned, bắt buộc chọn churn reason, competitor (nếu có), lost revenue và exit plan.

#### Business rules

- Mỗi contract active chỉ có một renewal case mở tại một thời điểm, trừ khi Admin bật multi-renewal.
- Contract không được có `expiry_date` nhỏ hơn `effective_date`.
- Khi contract sắp hết hạn, status chuyển `Expiring` theo ngưỡng cấu hình.
- Renewal forecast phải tách ít nhất `Committed`, `Likely`, `Risk`, `Unlikely`.
- Hợp đồng có công nợ quá hạn có thể tự động thêm risk signal, nhưng không tự chặn gia hạn nếu chưa có policy.

### 4.5. AM-05 — Tasks, Requests, SLA & Escalation

#### Loại work item

- Task: việc nội bộ hoặc follow-up.
- Client Request: yêu cầu từ khách hàng.
- Issue: vấn đề/defect/blocker.
- Escalation: sự cố cần cấp quản lý xử lý.
- Approval: yêu cầu duyệt.
- Milestone: mốc bàn giao.

#### Trường work item

- ID, title, description, account_id, project_id (optional), category, priority.
- Requester, assignee, watcher, team.
- Status: New, In Progress, Waiting Client, Waiting Internal, Resolved, Closed, Cancelled.
- Due date, SLA policy, response due, resolution due.
- Source: manual, email, client portal, API, automation, AI suggestion.
- Related contract, service line, risk, renewal case, opportunity.
- Attachments, comments, activity log.

#### SLA

- SLA policy cấu hình theo tenant, industry, service package, priority, customer tier hoặc contract.
- Hỗ trợ hai mốc: First Response SLA và Resolution SLA.
- Business hours, holidays, timezone được cấu hình theo tenant hoặc account.
- Tạm dừng SLA theo trạng thái `Waiting Client` hoặc trạng thái cấu hình.
- Escalation đa cấp theo phần trăm thời gian SLA đã tiêu thụ, mặc định 70%, 90%, 100%.

#### Acceptance criteria

- Khi task chuyển quá hạn, hệ thống gắn badge overdue, ghi SLA breach và gửi thông báo theo rule.
- Người dùng có thể tạo work item từ Account, Timeline, Contract, Risk và Dashboard.
- Mọi work item phải có owner và account, trừ task nội bộ không liên quan khách hàng.
- Dashboard hiển thị số task overdue và breach theo owner/team/account.

### 4.6. AM-06 — Interactions, Timeline & Meeting Management

#### Loại interaction

- Call, meeting, email, chat, onsite visit, note, report sent, proposal sent, complaint, survey response.

#### Trường interaction

- interaction_id, account_id, contact_ids, type, channel, subject, summary, detail/rich content.
- Occurred at, duration, participants, organizer, visibility.
- Sentiment: positive, neutral, negative, unknown.
- Follow-up required, follow-up due date, linked work item.
- Attachments, recording/transcript link, meeting minutes.

#### Business rules

- Meeting có thể sinh follow-up tasks từ action items.
- Interaction negative có thể tạo risk signal nếu sentiment/keyword/policy thỏa điều kiện.
- Khi ghi nhận complaint, bắt buộc category, severity, owner và SLA policy.
- Không chỉnh sửa nội dung interaction theo cách làm mất lịch sử; dùng version hoặc audit trail.

### 4.7. AM-07 — Customer Health, Risk & Churn Prevention

#### Mục đích

Đánh giá sức khỏe account bằng dữ liệu có giải thích; tạo khả năng can thiệp trước khi khách hàng rời bỏ hoặc doanh thu suy giảm.

#### Health Score

Health Score là thang 0–100, tính theo scorecard có version. Công thức mặc định cho mô hình agency/service:

\[
\text{Health Score} =
0.30 \times \text{KPI Delivery} +
0.20 \times \text{Engagement} +
0.20 \times \text{Financial} +
0.15 \times \text{Satisfaction} +
0.15 \times \text{Contract & Support Risk}
\]

Các thành phần phải quy đổi về 0–100. Tenant có thể chỉnh trọng số, điều kiện, ngưỡng, hiệu lực và scorecard theo ngành/gói dịch vụ.

| Thành phần | Ví dụ dữ liệu đầu vào | Gợi ý trọng số mặc định |
|---|---|---:|
| KPI Delivery | % KPI đạt, milestone đúng hạn, campaign performance | 30% |
| Engagement | số ngày không tương tác, tỷ lệ họp, phản hồi stakeholder | 20% |
| Financial | invoice overdue, payment completion, payment dispute | 20% |
| Satisfaction | CSAT/NPS, sentiment, complaint severity | 15% |
| Contract & Support Risk | ngày tới expiry, SLA breach, ticket mở nghiêm trọng | 15% |

#### Mức health mặc định

| Điểm | Level | Ý nghĩa |
|---:|---|---|
| 80–100 | Healthy | Ổn định; có thể xem xét expansion |
| 60–79 | Watch | Cần theo dõi và chủ động hành động |
| 40–59 | At Risk | Rủi ro retention/doanh thu đáng kể |
| 0–39 | Critical | Cần escalation và recovery plan khẩn |

#### Quy tắc giải thích score

Mỗi lần tính phải lưu:

- Tổng điểm, level, scorecard version, thời điểm tính.
- Điểm từng thành phần.
- Danh sách signal đóng góp dương/âm.
- Delta so với lần tính trước.
- Nguồn dữ liệu, ví dụ invoice, SLA, survey, KPI integration.
- Cờ `manual_override` và lý do nếu có.

Ví dụ insight hiển thị:

> Health Score giảm từ 76 xuống 58 trong 14 ngày: 2 SLA breach, invoice quá hạn 8 ngày và không có cuộc họp với stakeholder chính trong 21 ngày.

#### Risk Register

| Trường | Mô tả |
|---|---|
| risk_id | Định danh rủi ro |
| account_id | Account liên quan |
| category | Delivery, Financial, Relationship, Product, Legal, Contract, Reputation, Other |
| severity | Low, Medium, High, Critical |
| probability | 1–5 |
| impact | 1–5 |
| risk_score | probability × impact hoặc công thức tenant |
| description | Nội dung và bằng chứng |
| owner_id | Người chịu trách nhiệm |
| mitigation_plan | Kế hoạch giảm thiểu |
| due_date | Hạn xử lý |
| status | Open, Mitigating, Monitoring, Resolved, Accepted |
| escalation_level | None, Team Lead, Director, Executive |

#### Recovery action plan

Bắt buộc đối với account `Critical`; khuyến nghị với account `At Risk`.

- Mục tiêu phục hồi.
- Nguyên nhân gốc (root cause).
- Danh sách hành động, owner và deadline.
- Stakeholder tham gia.
- Tần suất review.
- Tiêu chí thoát rủi ro.
- Kết quả sau khi đóng.

### 4.8. AM-08 — Upsell, Cross-sell & Expansion

#### Mục đích

Ghi nhận, đánh giá và chuyển giao cơ hội tăng trưởng từ đội AM sang Sales hoặc quản lý trực tiếp theo mô hình tổ chức.

#### Trigger tạo opportunity

- Health score ≥ ngưỡng healthy trong thời gian tối thiểu cấu hình.
- Khách hàng đạt KPI vượt kỳ vọng.
- Nhu cầu mới được ghi nhận từ interaction/meeting.
- Sắp hết quota/gói sử dụng.
- Mở thêm chi nhánh, dự án, thị trường hoặc thương hiệu.
- Dịch vụ chưa sử dụng theo service catalog.
- AI gợi ý, luôn yêu cầu AM xác nhận trước khi tạo chính thức.

#### Trường opportunity

- opportunity_id, account_id, type (upsell/cross-sell/expansion/reactivation).
- product/service, estimated_value, currency, probability, expected_close_date.
- source, trigger, owner, sales_owner, stage.
- business_need, proposal link, competitor, next_step.
- linked_contract, linked_interactions, status.

#### Business rules

- Không tự tạo cơ hội chỉ vì AI gợi ý; AM phải confirm hoặc automation phải được Admin bật rõ ràng.
- Khi chuyển qua Sales CRM, cần đồng bộ ID, owner, stage và timeline hai chiều theo chính sách tích hợp.
- Opportunity won phải có khả năng tạo contract line item/amendment hoặc gửi sang quy trình hợp đồng.

### 4.9. AM-09 — Financial Snapshot

#### Mục đích

Giúp AM có đủ bối cảnh tài chính để quản trị mối quan hệ, trong khi hệ thống Finance/ERP vẫn là nguồn dữ liệu kế toán chuẩn.

#### Dữ liệu hiển thị

- Tổng giá trị hợp đồng, recurring revenue, one-time revenue.
- Invoice trạng thái: Draft, Issued, Partially Paid, Paid, Overdue, Cancelled, Written Off.
- Số dư công nợ, tuổi nợ (aging), khoản sắp đến hạn.
- Payment history.
- Discount/credit note nếu được phân quyền.
- Revenue at risk và renewal forecast.

#### Quy tắc

- Khi có ERP, dữ liệu payment/invoice phải lưu `external_id`, `source_system`, `synced_at`.
- Không cho AM tự xác nhận `Paid` nếu Finance là system of record.
- Overdue invoice tạo notification cho AM và Finance owner theo policy.
- Dữ liệu tài chính nhạy cảm được che một phần theo field permission nếu cần.

### 4.10. AM-10 — Feedback, CSAT, NPS & Complaints

#### Chức năng

- Tạo survey campaign theo lifecycle: sau onboarding, theo tháng/quý, sau xử lý ticket, trước renewal.
- Thu thập CSAT, NPS, câu hỏi tùy biến và bình luận mở.
- Gắn survey response vào Account/Contact/Contract/Project.
- Tạo complaint case hoặc risk signal từ điểm thấp/kết quả tiêu cực.
- Theo dõi CAPA: corrective and preventive action.

#### Business rules

- CSAT thấp hơn ngưỡng cấu hình tự tạo task follow-up hoặc risk signal.
- NPS detractor bắt buộc người phụ trách phản hồi trong thời hạn cấu hình.
- Survey không được gửi quá tần suất quy định theo contact để tránh spam.

### 4.11. AM-11 — Reports & Analytics

#### Báo cáo chuẩn

| Báo cáo | Chỉ số chính | Dimension/filter |
|---|---|---|
| Account Portfolio | active, at risk, critical, revenue | owner, team, industry, segment |
| Renewal Forecast | renewable value, probability, forecast value | month/quarter, owner, service |
| Retention & Churn | logo retention, gross retention, net retention, churn reason | cohort, industry, package |
| Health Distribution | score distribution, score trend, top negative signals | owner, industry, customer tier |
| SLA Performance | response/resolution compliance, breach, aging | team, service, priority |
| Workload | open task, overdue, throughput, capacity | assignee, team, time period |
| Customer Feedback | CSAT, NPS, response rate, complaint trends | service, segment, owner |
| Expansion | pipeline, won value, conversion, source | product, owner, industry |
| Financial Risk | overdue value, aging, revenue at risk | account, owner, contract type |

#### Công thức chỉ số

\[
\text{Logo Retention Rate} = \frac{\text{Số khách hàng còn lại cuối kỳ}}{\text{Số khách hàng đầu kỳ}} \times 100\%
\]

\[
\text{Gross Revenue Retention (GRR)} = \frac{\text{Starting Recurring Revenue} - \text{Churn} - \text{Contraction}}{\text{Starting Recurring Revenue}} \times 100\%
\]

\[
\text{Net Revenue Retention (NRR)} = \frac{\text{Starting Recurring Revenue} - \text{Churn} - \text{Contraction} + \text{Expansion}}{\text{Starting Recurring Revenue}} \times 100\%
\]

#### Export

- Export CSV/XLSX/PDF theo quyền.
- Export phải áp dụng cùng data scope của người dùng.
- Các báo cáo tài chính cần watermark/audit log tùy policy.

### 4.12. AM-12 — Cấu hình đa ngành và đa tenant

#### Mục tiêu cấu hình

Không hard-code quy trình của agency vào lõi hệ thống. Tenant Admin/CRM Admin có thể cấu hình, version hóa và áp dụng theo industry/service package.

#### Cấu hình bắt buộc

- Account types, segments, industries, lifecycle stages.
- Service catalog, service package, product line, billing model.
- Custom fields theo entity: account, contract, interaction, task, risk, opportunity.
- Form layout theo role/industry.
- Onboarding templates/checklists.
- SLA policies, business hours, holidays, escalation rules.
- Health scorecards, weights, thresholds, signals, exclusions.
- Renewal milestones and notification schedule.
- Churn reasons, complaint reasons, risk categories.
- Workflow trạng thái, approval matrix, notification templates.
- Dashboard layouts và saved views.

#### Ví dụ vertical configuration

| Vertical | Field/logic mở rộng |
|---|---|
| Agency Marketing | campaign, ad spend, KPI delivery, creative approval, report cadence |
| Real Estate | project, inventory/product type, lead volume, booking conversion, legal status |
| Spa/Beauty | branch, service package, appointment volume, membership, treatment campaign |
| Education | campus, program, intake, enrollment target, student/parent contact, attendance |
| SaaS | plan, seat usage, feature adoption, support tier, integration status |

### 4.13. AM-13 — AI Assistance

#### Nguyên tắc

AI là trợ lý có khả năng đề xuất; con người là người quyết định. AI không được tự thay đổi dữ liệu quan trọng, gửi thông điệp ra ngoài hoặc đưa ra kết luận rủi ro cuối cùng nếu không có rule/approval rõ ràng.

#### Use cases MVP+

- Tóm tắt Account 360 trong khoảng thời gian chọn.
- Tóm tắt cuộc họp, trích action items và tạo draft task.
- Giải thích biến động health score bằng tín hiệu nguồn.
- Gợi ý recovery plan theo template, có khối “evidence used”.
- Soạn draft email follow-up/renewal/QBR bằng ngôn ngữ được chọn.
- Phát hiện bất thường: giảm KPI, giảm tần suất tương tác, SLA breach lặp lại, công nợ.
- Gợi ý opportunity từ interaction và service catalog.

#### Guardrails

- Luôn hiển thị nguồn dữ liệu/tín hiệu được dùng để sinh insight.
- Người dùng phải review trước khi lưu task, update field, tạo opportunity hoặc gửi nội dung.
- Ẩn PII nhạy cảm khỏi prompt nếu policy quy định.
- Lưu audit: model/provider, prompt template version, actor, output status, accepted/rejected.
- Có nút feedback “Hữu ích/Không hữu ích” và lý do.

---

## 5. Quy trình nghiệp vụ chính

### 5.1. Account lifecycle

```text
Closed Won / Existing Customer
        ↓
Pending Handover
        ↓
Onboarding
        ↓
Active ───────────────→ Renewal In Progress ──→ Renewed / Active
  │                              │
  │                              └────────────→ Churned / Paused
  ↓
At Risk / Critical
  ↓
Recovery Plan → Active hoặc Churned
```

### 5.2. Quy trình rủi ro

1. Hệ thống hoặc người dùng ghi nhận signal/risk.
2. Recalculate health score theo event hoặc job định kỳ.
3. Khi health xuống `At Risk` hoặc `Critical`, tạo notification và đề xuất action plan.
4. AM xác nhận/điều chỉnh nguyên nhân, owner, hạn xử lý.
5. Nếu `Critical` hoặc revenue vượt ngưỡng, tự động escalation đến Account Director.
6. Review định kỳ cho tới khi risk được resolved/accepted/churned.
7. Lưu kết quả và bài học để phục vụ phân tích churn/retention.

### 5.3. Quy trình gia hạn

1. Scheduler tạo Renewal Case theo ngày hết hạn.
2. AM kiểm tra contract, health, công nợ, feedback, KPI delivery và stakeholder map.
3. AM đặt forecast và next action.
4. Theo approval matrix, tạo proposal hoặc chuyển Sales.
5. Cập nhật kết quả theo từng vòng thương lượng.
6. Renewed tạo liên kết hợp đồng mới/phụ lục; Lost/Churned bắt buộc close reason.

### 5.4. Quy trình khiếu nại/SLA

1. Request/complaint được tạo từ người dùng, portal hoặc tích hợp.
2. Engine xác định priority và SLA policy.
3. Gán owner và thông báo first-response deadline.
4. Khi 70%/90%/100% SLA, engine tạo escalation theo cấu hình.
5. Khi resolved, yêu cầu xác nhận kết quả và có thể kích hoạt CSAT survey.
6. Complaint nghiêm trọng tạo risk signal/health score impact theo scorecard.

---

## 6. Yêu cầu dữ liệu và mô hình domain

### 6.1. Aggregate/Entity chính

| Entity | Mô tả | Quan hệ chính |
|---|---|---|
| Account | Khách hàng/tổ chức trung tâm | Contact, Contract, Task, Interaction, Risk, Opportunity |
| Contact | Cá nhân liên hệ thuộc account | Account, Interaction, SurveyResponse |
| Contract | Hợp đồng và điều khoản thương mại | Account, LineItem, Invoice, RenewalCase |
| ServiceSubscription | Dịch vụ/gói đang sử dụng | Account, Contract, KPI, SLAPolicy |
| OnboardingCase | Hồ sơ onboarding | Account, ChecklistItem, Milestone |
| WorkItem | Task/request/issue/escalation | Account, Project, SLA, Risk |
| Interaction | Mọi lần trao đổi/sự kiện | Account, Contact, WorkItem |
| HealthAssessment | Snapshot health score | Account, HealthSignal, Scorecard |
| HealthSignal | Tín hiệu ảnh hưởng health | Account, source entity |
| Risk | Rủi ro có owner/action plan | Account, WorkItem, Interaction |
| RenewalCase | Hồ sơ gia hạn | Account, Contract, Opportunity |
| Opportunity | Upsell/cross-sell/expansion | Account, Contract, Interaction |
| SurveyResponse | Phản hồi CSAT/NPS | Account, Contact, Campaign |
| Document | Metadata tài liệu | Account và entity liên quan |
| AuditLog | Nhật ký truy vết | Mọi entity quan trọng |

### 6.2. Nguyên tắc thiết kế dữ liệu

- Dùng UUID/ULID làm primary ID; account_code/contract_code là business identifier có quy tắc tenant.
- Tất cả record nghiệp vụ phải có: `tenant_id`, `created_at`, `created_by`, `updated_at`, `updated_by`, `version`, `is_deleted` hoặc `archived_at` khi phù hợp.
- Dùng bảng quan hệ hoặc entity association cho liên kết nhiều-nhiều, ví dụ Account–Contact, Account–Owner, Account–Tag.
- Custom fields dùng metadata-driven schema, không lạm dụng JSON cho các trường cần filter/report thường xuyên.
- Các snapshot score/KPI và event log nên immutable để phục vụ audit/analytics.
- Lưu timezone ở account và user; thời hạn SLA tính theo timezone áp dụng.

### 6.3. Event domain gợi ý

- `AccountCreated`
- `AccountOwnerChanged`
- `AccountLifecycleChanged`
- `OnboardingStarted`
- `OnboardingCompleted`
- `ContractActivated`
- `ContractExpiring`
- `RenewalCaseCreated`
- `InvoiceOverdue`
- `WorkItemCreated`
- `SlaThresholdReached`
- `SlaBreached`
- `InteractionLogged`
- `SurveySubmitted`
- `HealthScoreCalculated`
- `HealthLevelChanged`
- `RiskCreated`
- `RiskEscalated`
- `OpportunityCreated`
- `AccountChurned`

---

## 7. UX/UI requirements

### 7.1. Nguyên tắc trải nghiệm

- Dashboard-first cho vận hành hằng ngày; Account 360 là trung tâm điều tra/ngữ cảnh.
- Giảm click: tạo task, log interaction, chuyển trạng thái, tạo risk từ bất kỳ context liên quan.
- Hiển thị tình trạng bằng ngôn ngữ hành động: “Cần phản hồi trong 2 giờ”, “Gia hạn sau 14 ngày”, “3 rủi ro đang mở”.
- Không chỉ hiển thị điểm health; luôn hiển thị “vì sao” và “việc nên làm tiếp theo”.
- Có empty states, loading states, error recovery và bulk actions rõ ràng.
- Desktop-first cho back-office; responsive tablet/mobile cho xem account, update task, log call và phê duyệt nhanh.

### 7.2. Màn hình tối thiểu MVP

| Screen ID | Màn hình | Chức năng |
|---|---|---|
| UI-AM-01 | My Dashboard | KPI, alerts, priority work, portfolio list |
| UI-AM-02 | Accounts List | Filter, search, saved view, bulk action, export |
| UI-AM-03 | Account 360 | Tab overview, timeline, contracts, health, work, finance |
| UI-AM-04 | Create/Edit Account | Form chuẩn + custom fields |
| UI-AM-05 | Onboarding Workspace | Checklist, owner, milestones, handover |
| UI-AM-06 | Renewal Workspace | Pipeline, forecast, proposal, tasks, decision log |
| UI-AM-07 | Health & Risk Center | Score trend, signals, risk register, recovery plan |
| UI-AM-08 | Work Queue | Task/request/SLA board và list |
| UI-AM-09 | Reports | Chart, drill-down, export |
| UI-AM-10 | Configuration | Scorecard, SLA, template, lifecycle, custom field |

### 7.3. Hành động nhanh tại Account header

- Log call/meeting/note.
- Create task/request.
- Create risk.
- Start renewal.
- Create opportunity.
- Send report / attach document.
- Change owner/status.
- Ask AI for account summary.

### 7.4. Accessibility

- Đạt mục tiêu WCAG 2.1 AA cho contrast, keyboard navigation, focus state và text alternative.
- Không dùng màu là tín hiệu duy nhất cho health/SLA; luôn có label/icon/text.
- Hỗ trợ định dạng ngày, số, tiền tệ và ngôn ngữ theo locale của tenant.

---

## 8. Yêu cầu phi chức năng

### 8.1. Hiệu năng

- P95 API đọc danh sách account ≤ 800 ms với filter/index hợp lệ.
- P95 mở Account 360 ≤ 1,5 giây cho dữ liệu header/overview; timeline tải phân trang/lazy-load.
- Tìm kiếm account/contact ≤ 1 giây ở quy mô mục tiêu 100.000 account/tenant, tùy kiến trúc search.
- Recalculate health theo event không quá 60 giây cho tác động cần cảnh báo; batch full recalculation chạy ngoài giờ hoặc có queue.

### 8.2. Khả năng mở rộng

- Multi-tenant với tenant isolation ở tầng ứng dụng và dữ liệu.
- Hỗ trợ tối thiểu 100.000 account/tenant, 1.000.000 interaction/tenant theo chiến lược phân vùng/indexing.
- Event-driven cho automation, integration và analytics để giảm coupling.
- API versioning và idempotency cho các thao tác create/update từ tích hợp.

### 8.3. Bảo mật

- Xác thực qua OAuth2/OIDC, MFA tùy tenant.
- RBAC + data scope + field-level access.
- Mã hóa in transit TLS và encryption at rest theo năng lực hạ tầng.
- Audit log bất biến logic cho hành động nhạy cảm.
- Rate limiting, input validation, CSRF protection (nếu web session), secret management.
- Chính sách lưu trữ/xóa dữ liệu theo tenant và yêu cầu pháp lý địa phương.

### 8.4. Độ tin cậy

- Target availability: 99,9% cho core read/write trong giờ làm việc.
- Queue retry có exponential backoff cho webhook/integration.
- Dead-letter queue và màn hình theo dõi lỗi đồng bộ.
- Backup, restore test định kỳ, RPO/RTO được xác lập cùng hạ tầng vận hành.

### 8.5. Quan sát hệ thống

- Correlation ID xuyên suốt API, job, event và integration.
- Metrics: API latency, error rate, queue lag, health calc duration, notification delivery, SLA job delay.
- Audit và observability tách bạch: audit dùng cho nghiệp vụ/pháp lý; log dùng cho kỹ thuật.

---

## 9. Kiến trúc đề xuất

### 9.1. Hướng tiếp cận

Áp dụng **modular monolith** theo Clean Architecture/DDD trong MVP để ship nhanh, giữ boundary rõ ràng; tách microservice khi một bounded context có tải, đội ngũ hoặc chu kỳ release độc lập rõ rệt.

Bounded contexts gợi ý:

- Identity & Access.
- CRM Core (Account, Contact, Custom Fields).
- Account Operations (Onboarding, Work, Interaction).
- Contract & Revenue.
- Health & Risk.
- Notifications & Workflow Automation.
- Reporting & Analytics.
- Integration Hub.
- AI Orchestration.

### 9.2. Layer Clean Architecture

```text
Presentation / API / Web UI
        ↓
Application Layer (Use Cases, Commands, Queries, DTOs)
        ↓
Domain Layer (Entities, Value Objects, Domain Services, Events, Policies)
        ↓
Infrastructure Layer (Database, Queue, Search, Cache, Storage, External APIs)
```

### 9.3. Công nghệ tham khảo

Không bắt buộc, lựa chọn theo năng lực đội ngũ và hệ sinh thái hiện tại:

| Thành phần | Lựa chọn tham khảo |
|---|---|
| Web frontend | Next.js/React, TypeScript, Tailwind, component library có accessibility |
| Backend | .NET / NestJS / Java Spring Boot / FastAPI, tùy chuẩn đội ngũ |
| OLTP database | PostgreSQL |
| Cache/queue | Redis + RabbitMQ/Kafka/NATS tùy tải và event volume |
| Search | PostgreSQL full-text ở giai đoạn đầu; OpenSearch/Elasticsearch khi cần |
| Object storage | S3-compatible (MinIO self-host hoặc cloud object storage) |
| Analytics | ClickHouse/BigQuery/Snowflake hoặc warehouse phù hợp |
| Identity | Keycloak self-host hoặc managed OIDC provider |
| Observability | OpenTelemetry + Prometheus/Grafana + centralized log |
| AI | AI gateway/OpenRouter-compatible gateway, RAG theo policy, prompt audit |

### 9.4. Tích hợp ưu tiên

- Sales CRM: deal won, opportunity, contact, owner.
- Finance/ERP: invoice, payment, credit note, công nợ.
- Project management: project, task, milestone, status.
- Email/calendar: meeting, email activity, reminder.
- Omnichannel: Zalo OA, WhatsApp, Facebook, live chat tùy thị trường và consent.
- Digital signing/document management: hợp đồng, phụ lục, hồ sơ.
- BI/warehouse: báo cáo phân tích nâng cao.

---

## 10. API requirements

### 10.1. Nguyên tắc API

- REST API versioned: `/api/v1/...`; GraphQL chỉ cân nhắc khi UI cần đọc aggregate linh hoạt.
- Xác thực bearer token/OIDC; kiểm tra tenant và scope ở middleware + application policy.
- Dùng cursor pagination cho timeline/list lớn.
- Hỗ trợ idempotency key với các endpoint tạo record từ tích hợp.
- Chuẩn lỗi nhất quán: `code`, `message`, `details`, `trace_id`.

### 10.2. Endpoint mẫu

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/api/v1/accounts` | Danh sách account, filter, sort, pagination |
| POST | `/api/v1/accounts` | Tạo account |
| GET | `/api/v1/accounts/{id}` | Account 360 overview |
| PATCH | `/api/v1/accounts/{id}` | Cập nhật account |
| POST | `/api/v1/accounts/{id}/owners` | Thêm/chuyển owner |
| GET | `/api/v1/accounts/{id}/timeline` | Timeline phân trang |
| POST | `/api/v1/accounts/{id}/interactions` | Ghi interaction |
| POST | `/api/v1/accounts/{id}/work-items` | Tạo task/request/issue |
| GET | `/api/v1/accounts/{id}/health` | Điểm health và signals |
| POST | `/api/v1/accounts/{id}/health/recalculate` | Yêu cầu tính lại, theo quyền |
| POST | `/api/v1/accounts/{id}/risks` | Tạo risk |
| POST | `/api/v1/contracts` | Tạo contract |
| POST | `/api/v1/contracts/{id}/renewal-cases` | Mở renewal case |
| GET | `/api/v1/renewal-cases` | Danh sách gia hạn |
| POST | `/api/v1/opportunities` | Tạo upsell/cross-sell |
| GET | `/api/v1/dashboard/account-management` | Dashboard theo scope/filter |
| GET | `/api/v1/reports/retention` | Báo cáo retention |
| POST | `/api/v1/ai/account-summary` | Sinh tóm tắt AI, không tự ghi dữ liệu |

### 10.3. Ví dụ request tạo task

```json
{
  "account_id": "01JACCOUNT...",
  "type": "task",
  "title": "Gửi báo cáo hiệu quả tháng 08",
  "description": "Chuẩn bị phần SEO, Ads và đề xuất tối ưu CPA.",
  "priority": "high",
  "assignee_id": "01JUSER...",
  "due_at": "2026-09-08T10:00:00+07:00",
  "related_contract_id": "01JCONTRACT...",
  "source": "manual"
}
```

---

## 11. Automation và notification

### 11.1. Automation rules MVP

| Trigger | Điều kiện | Hành động |
|---|---|---|
| Contract nearing expiry | Còn 90/60/30/14/7/1 ngày | Tạo/cập nhật Renewal Case, gửi notification |
| SLA threshold | Đạt 70% hoặc 90% SLA | Nhắc assignee, watcher/manager |
| SLA breached | Quá hạn phản hồi/giải quyết | Escalate theo policy, tạo health signal |
| Invoice overdue | Quá hạn theo dữ liệu Finance | Thông báo AM/Finance, gắn risk signal |
| Health downgrade | Healthy/Watch → At Risk/Critical | Gửi alert, tạo draft recovery plan |
| Low CSAT/NPS | Dưới ngưỡng tenant | Tạo task follow-up/case |
| No interaction | Không có interaction X ngày | Nhắc owner theo segment/tier |
| Onboarding overdue | Quá go-live target | Escalate Delivery/AM |
| Opportunity trigger | Đạt điều kiện expansion | Tạo suggestion, yêu cầu AM confirm |

### 11.2. Kênh thông báo

- In-app notification là bắt buộc.
- Email, Slack, Microsoft Teams, Zalo hoặc webhook là cấu hình tùy chọn.
- Notification phải có deep link, mức độ ưu tiên, thời điểm, trạng thái read/unread và chống gửi trùng.
- Người dùng cấu hình preference cá nhân trong giới hạn policy của tenant.

---

## 12. Báo cáo kiểm thử và acceptance tổng thể

### 12.1. Test scenarios cốt lõi

1. Tạo account từ deal Closed Won, hoàn tất handover và onboarding, sau đó chuyển Active.
2. Tạo contract 12 tháng; hệ thống tự tạo renewal case tại mốc 90 ngày trước expiry.
3. Invoice quá hạn được đồng bộ từ Finance; account xuất hiện signal và health score giảm theo scorecard.
4. Task có SLA 8 business hours; khi chuyển Waiting Client SLA được pause đúng policy.
5. Ghi complaint severity High; hệ thống tạo escalation và recovery plan draft.
6. Một AM chỉ thấy account của chính mình; Account Director thấy toàn đội; Finance chỉ cập nhật invoice/payment.
7. Custom field của vertical Education hiển thị trong form account và có thể filter/report.
8. AI tạo summary nhưng không ghi đè field hoặc tạo task nếu người dùng chưa xác nhận.
9. Một account bị chuyển owner; audit log lưu đầy đủ trước/sau, actor, timestamp, lý do.
10. Churn account yêu cầu bắt buộc churn reason, effective date và revenue impact.

### 12.2. Definition of Done

Một feature được coi là hoàn thành khi:

- Có user story, acceptance criteria và UX flow được Product/BA xác nhận.
- Có unit test cho domain/application logic quan trọng.
- Có integration/API test cho endpoint và authorization.
- Có E2E test cho luồng doanh thu/rủi ro/gia hạn trọng yếu.
- Có audit log, error handling, telemetry và tài liệu API nếu applicable.
- Đã kiểm tra access control cho các role liên quan.
- Đã được QA sign-off và PO acceptance theo acceptance criteria.

---

## 13. Roadmap triển khai gợi ý

### Phase 0 — Foundation (2–4 tuần)

- Tenant, Identity, RBAC/data scope, audit log, master data.
- Account/Contact cơ bản, custom field framework, document metadata.
- UI shell, navigation, design system và dashboard framework.

### Phase 1 — MVP Account Operations (6–10 tuần)

- Account 360, Timeline, Task/Work Queue, Interaction.
- Contract cơ bản, renewal alerts, notification in-app.
- Dashboard cá nhân/team, Accounts List, saved filter/view.
- Onboarding checklist cơ bản.

### Phase 2 — Retention Control (6–8 tuần)

- SLA engine, escalation, Finance snapshot integration.
- Health scorecard v1, risk register, recovery action plan.
- Survey CSAT/NPS cơ bản.
- Reports retention/renewal/SLA/health.

### Phase 3 — Growth & Intelligence (6–10 tuần)

- Upsell/cross-sell opportunity, tích hợp Sales CRM.
- AI summary, meeting action extraction, health explanation.
- Advanced automation, client portal tùy ưu tiên.
- Warehouse/BI và forecasting nâng cao.

---

## 14. Open questions cần chốt

1. CRM hiện tại đã có module Sales, Contact, Deal và Product Catalog hay cần xây cùng lúc?
2. Finance/ERP nào là system of record cho invoice/payment/công nợ?
3. Định nghĩa đơn vị doanh thu chuẩn là MRR, ARR, gross revenue hay recognized revenue?
4. Tổ chức có workflow gia hạn do AM sở hữu hoàn toàn hay bắt buộc chuyển Sales?
5. Những kênh interaction nào cần đồng bộ ở giai đoạn đầu: email, calendar, Zalo, Facebook, call center?
6. Mức tenant isolation mong muốn: shared database với tenant_id, schema-per-tenant hay database-per-tenant?
7. Yêu cầu self-host/on-premise, lưu trữ dữ liệu tại Việt Nam và chính sách PII là gì?
8. Có cần portal cho khách hàng ở MVP không, hay chỉ back-office nội bộ?
9. Cần tính commission/incentive dựa trên retention/upsell không?
10. Chỉ số KPI/health score nào là bắt buộc riêng cho vertical đầu tiên triển khai?

---

## 15. Phụ lục: backlog MVP gợi ý

| Epic | Ticket/Capability | Priority |
|---|---|---|
| Foundation | Tenant-aware RBAC và data scope | P0 |
| Foundation | Audit log cho entity quan trọng | P0 |
| CRM Core | CRUD Account/Contact, import CSV, search/filter | P0 |
| CRM Core | Custom field framework v1 | P0 |
| Operations | Account 360 overview + timeline | P0 |
| Operations | Task, assignment, due date, notification | P0 |
| Operations | Interaction log + meeting follow-up | P0 |
| Contracts | Contract CRUD, expiry notifications, renewal case | P0 |
| Dashboard | My dashboard, team dashboard, attention list | P0 |
| Onboarding | Handover form và checklist template | P1 |
| Risk | Health score v1, signal explanation, risk register | P1 |
| SLA | SLA policy, timer, breach/escalation | P1 |
| Finance | Invoice/payment snapshot integration | P1 |
| Analytics | Retention/renewal/SLA report | P1 |
| Feedback | CSAT/NPS survey and follow-up | P2 |
| Growth | Upsell/cross-sell opportunity | P2 |
| AI | Account summary, action-item draft, health explanation | P2 |
| Portal | Client portal collaboration | P3 |

---

## 16. Kết luận

Module Account Management cần được xây như một **hệ điều hành giữ chân và mở rộng khách hàng**, không chỉ là danh bạ khách hàng hay danh sách task. Lõi nghiệp vụ nên xoay quanh Account 360°, contractual obligations, delivery/SLA, health/risk có thể giải thích, renewal discipline và growth signals. Cấu hình theo ngành phải nằm ở metadata, scorecard, workflow và service catalog để sản phẩm mở rộng được từ agency marketing sang bất động sản, spa/làm đẹp, giáo dục và SaaS mà không phá vỡ domain core.

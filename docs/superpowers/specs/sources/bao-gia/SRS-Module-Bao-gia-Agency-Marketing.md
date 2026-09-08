# SRS — Module Báo giá (Quotation Management)

**Sản phẩm:** Agency Operating System / CRM cho Agency Marketing  
**Module:** Báo giá & Proposal thương mại  
**Phiên bản:** 1.0  
**Ngày:** 07/09/2026  
**Trạng thái:** Draft for Review  
**Đối tượng:** Product Owner, BA, Solution Architect, UX/UI, Engineering, Finance, Sales/BD, Account Management, Operations

---

## 1. Mục tiêu tài liệu

Tài liệu này đặc tả yêu cầu nghiệp vụ, chức năng, dữ liệu, luồng xử lý, phân quyền, quy tắc và yêu cầu phi chức năng cho **Module Báo giá** của một agency marketing chuyên nghiệp quy mô lớn.

Module cho phép agency quản lý xuyên suốt vòng đời của một báo giá/proposal: tạo từ cơ hội bán hàng, cấu hình gói dịch vụ và phạm vi công việc, tính giá và chiết khấu, kiểm soát chi phí và biên lợi nhuận, phê duyệt nội bộ nhiều cấp, xuất bản proposal gửi khách hàng, theo dõi tương tác, thu thập xác nhận và chuyển đổi báo giá được chấp nhận thành hợp đồng/dự án/kế hoạch tài chính.

Tài liệu ưu tiên mô hình vận hành multi-team và multi-branch, phù hợp agency có các khối Business Development, Account, Strategy, Creative, Media Performance, Content, Production, SEO, Finance, Legal, Project Management và Ban Giám đốc.

---

## 2. Phạm vi

### 2.1. In scope

- Quản lý báo giá cho dịch vụ marketing, truyền thông và sáng tạo.
- Tạo báo giá từ Deal/Opportunity hoặc tạo độc lập.
- Quản lý khách hàng, contact, legal entity và thông tin thương mại liên quan.
- Service Catalog, rate card, package, bundle, add-on và hạng mục tùy chỉnh.
- Cấu hình phương án báo giá A/B/C trong cùng một proposal.
- Cấu hình deliverable, scope, exclusions, KPI, assumptions, timeline và điều khoản theo từng dịch vụ.
- Tính giá bán, chiết khấu, thuế, phí, ngân sách media, pass-through cost, rebate và lịch thanh toán.
- Theo dõi cost nội bộ, cost outsource và gross margin ở cấp line item/package/quote.
- Workflow phê duyệt nội bộ nhiều cấp theo policy.
- Proposal builder, template, preview, xuất PDF và link proposal chia sẻ cho khách hàng.
- Theo dõi gửi, xem, comment, yêu cầu điều chỉnh, chấp nhận/từ chối/hết hạn.
- Audit log, versioning, so sánh version và khóa dữ liệu sau khi duyệt/gửi.
- Chuyển đổi sang Contract, Project, Work Order, Budget Plan và Invoice Schedule qua tích hợp nội bộ.
- Dashboard, báo cáo và API phục vụ nghiệp vụ.

### 2.2. Out of scope (phiên bản 1)

- Ký điện tử có giá trị pháp lý do hệ thống tự cung cấp; hệ thống chỉ tích hợp nhà cung cấp e-sign.
- Hạch toán kế toán tổng hợp, sổ cái, quyết toán thuế.
- Mua media trực tiếp từ Meta/Google/TikTok và đối soát realtime với toàn bộ nền tảng.
- Quản lý procurement đầy đủ cho nhà cung cấp.
- Tự động tạo creative, plan hoặc proposal bằng AI ở mức production; AI chỉ là capability mở rộng, không phải chức năng lõi của SRS này.

### 2.3. Đối tượng sử dụng

| Nhóm người dùng | Mục tiêu sử dụng |
|---|---|
| Business Development/Sales | Tạo báo giá sơ bộ, chốt phương án thương mại, theo dõi phản hồi khách hàng |
| Account Executive/Account Manager | Xây dựng proposal, phối hợp delivery team, quản lý điều chỉnh và gửi khách hàng |
| Strategy/Planning | Cấu hình scope, KPI, chiến lược, assumptions, timeline |
| Delivery Lead | Xác thực năng lực thực hiện, nguồn lực, chi phí và SLA |
| Finance/Commercial | Kiểm soát giá, rate card, thuế, chiết khấu, margin, công nợ và payment schedule |
| Legal | Kiểm tra điều khoản pháp lý, sở hữu trí tuệ, bảo mật, giới hạn trách nhiệm |
| Approver/Management | Duyệt ngoại lệ, chiết khấu, margin thấp, giá trị cao hoặc rủi ro đặc biệt |
| Client/Khách hàng | Xem proposal được chia sẻ, comment, tải PDF, yêu cầu chỉnh sửa, xác nhận/chấp nhận |
| System Administrator | Quản trị catalog, template, policy, workflow, role, permission, integration |

---

## 3. Bối cảnh nghiệp vụ

Agency marketing thường bán giải pháp đa dịch vụ, không phải chỉ một bảng đơn giá. Một proposal có thể đồng thời gồm Strategy, Branding, Social Media, Creative, Media Ads, Influencer/KOL, SEO, Website/Landing Page, Video Production, PR, Event và công nghệ/CRM. Giá trị deal cao, nhiều bên tham gia, scope biến động và rủi ro chiết khấu/margin lớn.

Module phải giải quyết các vấn đề vận hành sau:

- Báo giá làm thủ công bằng Excel/Word/PDF gây sai phiên bản, sai số tiền, thất thoát margin và khó truy vết.
- Sales/Account khó bán theo package và khó trình bày hiệu quả/KPI minh bạch cho khách hàng.
- Không kiểm soát đồng nhất rate card, chiết khấu, thuế, cost outsource và ngân sách media.
- Không có approval policy rõ ràng khi quote vượt ngưỡng giá trị hoặc giảm giá quá mức.
- Proposal thiếu tracking: không biết khách hàng đã xem, xem phần nào và phản hồi lúc nào.
- Quote thắng không chuyển giao đủ dữ liệu cho project delivery, tài chính và hợp đồng.

---

## 4. Mục tiêu nghiệp vụ và KPI

| Mục tiêu | Chỉ số đo lường đề xuất |
|---|---|
| Rút ngắn thời gian lập báo giá | Median time from draft to sent giảm tối thiểu 40% sau 6 tháng |
| Kiểm soát commercial policy | 100% báo giá có chiết khấu/margin ngoài policy đi qua approval workflow |
| Bảo vệ lợi nhuận | Theo dõi gross margin dự kiến và thực tế theo quote, service line, client, team |
| Chuẩn hóa chất lượng proposal | Tỷ lệ quote dùng template/catalog chuẩn >= 90% |
| Tăng tốc phản hồi khách hàng | Theo dõi sent/view/comment; nhắc follow-up tự động theo SLA |
| Nâng tỷ lệ win | Báo cáo quote-to-win theo ngành, service, channel, owner, package và lý do thắng/thua |
| Cải thiện handover | 100% quote accepted có thể tạo project/hợp đồng với scope, deliverable và payment schedule kế thừa |

---

## 5. Thuật ngữ và định nghĩa

| Thuật ngữ | Định nghĩa |
|---|---|
| Quote/Báo giá | Tài liệu thương mại có mã định danh, thể hiện dịch vụ, giá, điều khoản và trạng thái phê duyệt/gửi |
| Proposal | Bản trình bày gửi khách hàng; có thể gồm strategy, scope, timeline, team, pricing, terms và acceptance |
| Deal/Opportunity | Cơ hội bán hàng trong CRM mà báo giá có thể được tạo từ đó |
| Service Catalog | Danh mục dịch vụ chuẩn, bao gồm đơn vị tính, deliverable, rate card, cost template và KPI template |
| Package | Gói tổ hợp của nhiều dịch vụ/hạng mục, có giá package và rule riêng |
| Line Item | Dòng hàng/dịch vụ có số lượng, giá, chiết khấu, tax, cost, total |
| Media Budget | Ngân sách chạy quảng cáo do khách hàng chi trả; có thể tách khỏi agency fee |
| Pass-through Cost | Chi phí agency thu hộ/chi hộ như KOL booking, venue, printing, media spending |
| Gross Margin | (Net Service Revenue - Direct Cost) / Net Service Revenue; công thức chi tiết do Finance cấu hình |
| Deliverable | Đầu ra cam kết bàn giao: số post, video, landing page, report, workshop... |
| KPI Target | Chỉ số mục tiêu tối ưu/kỳ vọng, ví dụ CPL, CTR, reach, traffic; không mặc định là cam kết tuyệt đối |
| Assumption | Điều kiện, tiền đề và giới hạn để scope/KPI/chi phí có hiệu lực |
| Quote Version | Một snapshot bất biến của quote sau mỗi lần publish/submit approval hoặc tạo revision |
| Approval Policy | Bộ quy tắc xác định cấp duyệt, điều kiện duyệt và hành động ngoại lệ |

---

## 6. Tổng quan giải pháp

### 6.1. Phân hệ logic

1. **Quote Workspace:** Danh sách, tìm kiếm, tạo và quản lý báo giá.
2. **Quote Builder:** Xây dựng thông tin thương mại, phương án, service line, KPI, terms.
3. **Catalog & Pricing:** Dịch vụ chuẩn, rate card, bundle, cost model và template KPI.
4. **Commercial Control:** Discount, tax, currency, cost, margin, approval policy.
5. **Proposal Studio:** Tạo giao diện proposal khách hàng, template, preview, PDF/link share.
6. **Client Collaboration:** View tracking, comment, change request, acceptance/rejection.
7. **Workflow & Audit:** Approval, task, reminder, activity log, version control.
8. **Conversion & Analytics:** Contract/project/invoice schedule handover và reporting.

### 6.2. Nguyên tắc thiết kế

- **Quote-first but deal-connected:** Quote có thể độc lập, nhưng ưu tiên liên kết CRM Deal và khách hàng.
- **Package-first:** Hỗ trợ bán theo giải pháp/gói, không ép người dùng chỉ làm bảng line item.
- **Customer transparency, internal confidentiality:** Client thấy scope, deliverable, giá và KPI; cost/margin/approval note nội bộ không được lộ.
- **Controlled flexibility:** Cho phép custom line nhưng luôn có flag và workflow kiểm soát.
- **Version is evidence:** Mọi quote gửi khách hàng và quyết định approval phải bám một version bất biến.
- **No silent override:** Không được sửa giá/cost/discount/terms đã approved mà không tạo revision và đánh giá lại workflow.
- **Multi-entity ready:** Hỗ trợ nhiều legal entity, chi nhánh, currency, VAT/tax profile và brand template trong cùng tenant.

---

## 7. Vai trò và phân quyền

### 7.1. Vai trò chuẩn

| Role | Quyền chính |
|---|---|
| Quote Creator | Tạo/chỉnh sửa draft do mình sở hữu, chọn catalog, submit approval |
| Sales Manager | Xem/duyệt quote của team, override owner theo quyền |
| Account Director | Duyệt scope/discount trong ngưỡng, quản lý proposal khách hàng |
| Strategy Lead | Chỉnh sửa chiến lược, scope, KPI/assumption của service có phân công |
| Delivery Lead | Xác nhận capacity, direct cost và delivery feasibility |
| Finance Controller | Quản lý rate/cost/margin/tax, duyệt commercial exception |
| Legal Reviewer | Duyệt/đề xuất điều khoản và phụ lục pháp lý |
| Executive Approver | Duyệt giá trị cao, margin thấp, deal chiến lược hoặc exception |
| Proposal Publisher | Xuất bản/gửi proposal đã approved |
| Client Viewer | Chỉ xem bản proposal share được cấp quyền |
| Client Signer | Comment/approve/reject theo token và cơ chế xác thực |
| Administrator | Cấu hình toàn bộ module và dữ liệu master |
| Auditor | Read-only quote, version, approval, audit log và report |

### 7.2. Mô hình phạm vi dữ liệu

Permission phải kiểm tra đồng thời theo:

- Tenant/organization.
- Legal entity/branch.
- Business unit/service line.
- Team hierarchy.
- Owner/participant của quote.
- Client account access.
- Quote state và version state.
- Field-level data classification: client-visible, internal, finance-restricted, legal-restricted.

### 7.3. Nguyên tắc phân quyền

- Creator chỉ được sửa quote ở trạng thái Draft/Returned và trong phạm vi được cấp.
- Quote ở trạng thái Pending Approval, Approved, Sent, Viewed, Accepted, Rejected, Expired hoặc Archived bị khóa theo mức độ; sửa đổi tạo revision.
- Client không bao giờ truy cập direct cost, margin, approval route, internal notes hoặc discount policy.
- Rate card/cost card chỉ Finance Admin hoặc người được ủy quyền được sửa.
- Manual override phải bắt buộc nhập lý do, lưu actor/time/before-after và có thể kích hoạt re-approval.

---

## 8. Vòng đời và trạng thái

### 8.1. Trạng thái Quote

| Mã | Trạng thái | Ý nghĩa | Hành động chính |
|---|---|---|---|
| DRAFT | Nháp | Đang xây dựng, chưa submit | Edit, duplicate, delete theo policy, submit approval |
| IN_REVIEW | Chờ rà soát | Đang được technical/strategy/finance rà soát trước approval | Edit hạn chế, return, approve for submission |
| PENDING_APPROVAL | Chờ phê duyệt | Đã gửi approval workflow | Approve, reject, return, delegate |
| RETURNED | Yêu cầu chỉnh sửa | Bị trả về với comment | Edit, resubmit |
| APPROVED | Đã duyệt nội bộ | Đủ điều kiện xuất bản/gửi client | Publish, send, create revision |
| SENT | Đã gửi khách hàng | Proposal/link/PDF đã gửi | Track, resend, revoke, revise |
| VIEWED | Khách hàng đã xem | Có ít nhất một session xem proposal | Follow-up, revise |
| NEGOTIATION | Đang thương lượng | Client comment/yêu cầu điều chỉnh | Create revision, respond |
| ACCEPTED | Khách hàng chấp nhận | Client xác nhận theo phương thức hợp lệ | Convert to contract/project, lock |
| REJECTED | Khách hàng từ chối | Không tiếp tục quote | Record lost reason, archive |
| EXPIRED | Hết hiệu lực | Qua valid-until mà chưa accepted | Renew/create revision, archive |
| CANCELLED | Hủy nội bộ | Agency chủ động hủy | Archive, reopen by exception |
| SUPERSEDED | Đã được thay thế | Có quote version/revision khác thay thế | Read-only |
| ARCHIVED | Lưu trữ | Không còn active nhưng giữ audit | Read-only |

### 8.2. Trạng thái Version

- Working: phiên bản đang chỉnh sửa.
- Submitted: snapshot tại thời điểm gửi approval.
- Approved: snapshot được duyệt nội bộ.
- Published: snapshot được render proposal/PDF/link gửi khách hàng.
- Accepted: snapshot được khách hàng xác nhận.
- Superseded: bị version mới thay thế.

### 8.3. Chuyển trạng thái bắt buộc

- Draft → Pending Approval: yêu cầu dữ liệu bắt buộc hợp lệ và hoàn tất validation commercial.
- Pending Approval → Approved: tất cả required approver chấp thuận.
- Approved → Sent: phải có published version tương ứng.
- Sent/Viewed/Negotiation → Accepted: client signer hợp lệ; có thể yêu cầu OTP/e-sign tùy policy.
- Sent/Viewed/Negotiation → Expired: job tự động chạy theo valid_until và timezone quote.
- Any editable status → Superseded: khi tạo revision và revision mới được publish thay thế.

---

## 9. Yêu cầu chức năng

### FR-QT-001 — Danh sách báo giá

Hệ thống phải cung cấp Quote List với các khả năng:

- Hiển thị quote code, title, client, linked deal, owner, legal entity, package/value, status, valid until, last activity, created/updated date.
- Hiển thị chỉ số: total amount, net service revenue, media budget, gross margin (theo quyền), approval state, client view status.
- Tìm kiếm theo quote code, title, client name, contact, deal code, creator/owner.
- Filter theo status, date range, business unit, team, owner, client, service category, quote amount, margin band, approval pending user, expiry band, template, currency, legal entity.
- Sort theo created date, updated date, total, valid until, margin, last viewed, probability.
- Lưu saved view cá nhân/team nếu có quyền.
- Bulk action: assign owner, tag, export permitted fields, archive, send reminder; hành động làm thay đổi dữ liệu phải theo permission và confirmation policy.
- Pagination server-side; mặc định 25 bản ghi/trang và có thể cấu hình 25/50/100.

**Acceptance criteria**

- Người dùng chỉ nhìn thấy quote trong data scope của họ.
- Filter status=Pending Approval và approver=current user trả về quote thực sự đang chờ hành động của user đó.
- Chỉ người có quyền Finance View mới thấy direct cost/gross margin ở list.

### FR-QT-002 — Tạo báo giá

Hệ thống phải cho phép tạo quote theo 3 cách:

1. Từ Deal/Opportunity trong CRM.
2. Từ Client account/contact.
3. Tạo quote độc lập rồi liên kết Deal sau.

Dữ liệu khởi tạo tối thiểu:

- Legal entity/branch phát hành.
- Quote type: New Business, Renewal, Upsell, Cross-sell, Retainer, Campaign, Project, Change Request.
- Client account và contact chính.
- Currency, tax profile, quote date, valid until.
- Owner, team, business unit.
- Template proposal và default payment term.

Khi khởi tạo từ Deal, hệ thống phải tự kế thừa client, contact, deal owner, campaign context, expected close date, pipeline, source và tags nếu được cấu hình.

Hệ thống sinh quote code theo sequence cấu hình, ví dụ `QT-HCM-2026-000089`; code phải unique theo organization hoặc legal entity tùy policy.

### FR-QT-003 — Quote Header và thông tin thương mại

Quote Builder phải quản lý các trường:

| Nhóm | Trường |
|---|---|
| Định danh | quote_code, title, quote_type, version_no, parent_quote_id |
| Khách hàng | client_account, legal_client_entity, billing_contact, primary_contact, project_contact |
| CRM | deal_id, pipeline, source, probability, competitor, win_theme |
| Phát hành | issuing_entity, branch, brand, currency, quote_date, valid_until, timezone, language |
| Sở hữu | owner, co-owner, sales team, account team, strategy lead, delivery lead |
| Bối cảnh | objective, industry, target audience, geography, campaign period, brief reference |
| Thương mại | payment term, tax profile, purchase order requirement, contract reference |
| Kiểm soát | confidentiality level, tags, risk level, internal notes |

Validation:

- Client account, issuing entity, currency, quote date, valid until, owner, title và ít nhất 1 package/line item là bắt buộc trước submit approval.
- valid_until phải lớn hơn hoặc bằng quote_date và không vượt maximum validity theo policy trừ khi có exception reason.
- Contact phải thuộc client account, trừ khi user có quyền tạo/external contact exception.

### FR-QT-004 — Phương án báo giá (Option/Scenario)

Một quote phải hỗ trợ nhiều phương án độc lập A/B/C hoặc custom label.

Mỗi option có:

- option_code, title, description, position, status (active/hidden/selected).
- Objective, scope summary, duration, service channels.
- Package/line item riêng.
- Pricing total, discount, tax, payment schedule riêng hoặc inherit quote-level.
- KPI scenario riêng: Conservative, Base, Growth.
- Client visibility flag.
- Recommended flag: chỉ có tối đa một option là recommended trong một version.

Hệ thống phải cho phép:

- Duplicate option.
- So sánh option về deliverable, KPI, total investment, media budget, duration và client-visible terms.
- Chọn option được client accept mà không mất dữ liệu các option còn lại.
- Cấu hình xuất proposal: hiển thị một, nhiều hoặc toàn bộ option.

### FR-QT-005 — Service Catalog và Rate Card

Hệ thống phải cung cấp master data quản trị cho:

- Service category: Strategy, Branding, Creative, Social, Performance, SEO, Web/CRO, Production, KOL/Influencer, PR, Event, CRM/Technology, Consulting.
- Service definition: code, name, description, unit, default duration, required roles, deliverable template, exclusion template, KPI template, assumption template.
- Rate card theo legal entity, branch, client tier, industry, currency, effective date, service, seniority/team.
- Cost card: internal hourly/daily cost, outsource baseline, production cost rule, commission/rebate model.
- Bundle/package template.
- Tax class, revenue recognition category, accounting mapping placeholder.

Catalog record phải có effective_from/effective_to, status (draft/active/retired) và version. Quote đang tồn tại không được tự thay đổi khi catalog/rate card có version mới; chỉ cập nhật khi user chọn refresh/reprice và tạo audit event.

### FR-QT-006 — Line item, Scope và Deliverable

Mỗi option có thể chứa package và line item dạng phân cấp:

- Group/Section.
- Package/Bundle.
- Service line item.
- Add-on.
- Discount line/allowance.
- Pass-through cost.
- Media budget.
- Optional item.

Mỗi line item phải hỗ trợ các trường:

| Nhóm | Trường bắt buộc/khuyến nghị |
|---|---|
| Cơ bản | line_no, item_type, service_id/custom_name, description, unit, quantity, frequency, duration |
| Pricing | list_price, unit_price, gross_amount, discount_type, discount_value, net_amount, tax_class, tax_amount, total_amount |
| Cost | internal_cost, outsourced_cost, other_direct_cost, total_direct_cost, expected_margin_amount, expected_margin_pct |
| Scope | included_scope, excluded_scope, acceptance_criteria, dependencies, client_responsibilities |
| Delivery | deliverable list, due period, milestone, owner team, delivery lead, SLA, revisions allowed |
| KPI | metric name, baseline, target/min/max, metric type, data source, reporting cadence, disclaimer |
| Control | client_visible, optional, approval_required, price_locked, cost_locked, internal_note |

Hệ thống phải:

- Cho phép add từ catalog hoặc tạo custom item.
- Cảnh báo custom item chưa được Finance/Commercial xác nhận giá/cost.
- Cho phép drag-and-drop order và group line item.
- Cho phép duplicate/import line item từ quote/template khác nếu user có quyền.
- Hỗ trợ recurring fee, one-time fee và usage-based fee.
- Hỗ trợ item zero-price nhưng bắt buộc reason và client visibility.
- Hỗ trợ optional add-on không tính vào total mặc định hoặc có tùy chọn include/exclude.

### FR-QT-007 — KPI, chỉ số và hiệu quả dự kiến

Module phải tách rõ ba lớp thông tin:

1. **Deliverable cam kết:** đầu ra agency cam kết bàn giao.
2. **KPI mục tiêu tối ưu:** chỉ số vận hành cần tối ưu, không tự động là guarantee.
3. **Kết quả dự kiến/forecast:** dự báo theo scenario và assumption.

Mỗi KPI record có:

- metric_code/name, metric_category, unit, baseline, target_operator, target_value hoặc min/max range.
- scenario: conservative/base/growth.
- period: total, monthly, weekly, campaign phase.
- data_source: ad platform, analytics, CRM, manual, third party.
- formula/reference note.
- owner team và reporting cadence.
- classification: committed deliverable / optimization target / projected result.
- disclaimer, assumptions và dependency.
- client-visible flag.

Ví dụ Meta Ads:

| Chỉ số | Giá trị | Phân loại |
|---|---:|---|
| Media budget | 120.000.000 VND | Assumption đầu vào |
| Impressions | 1.800.000 | Forecast |
| Clicks | 32.000 | Forecast |
| CTR | >= 1,8% | Optimization target |
| Leads | 1.000–1.200 | Forecast range |
| CPL | 85.000–100.000 VND | Optimization target |
| Weekly performance report | 12 báo cáo | Committed deliverable |

Validation:

- KPI classified as `projected_result` phải có disclaimer và ít nhất một assumption.
- KPI classified as `committed` cần acceptance criteria hoặc mô tả bàn giao.
- KPI liên quan paid media cần xác định media budget, platform, target geography/audience và measurement source trước khi gửi client.

### FR-QT-008 — Pricing, Tax, Discount và Currency

Module phải hỗ trợ:

- Currency theo quote; multi-currency và exchange rate snapshot nếu tenant bật.
- Price list, negotiated price, volume pricing, tier pricing, time-based pricing.
- Discount line-level, package-level, option-level và quote-level.
- Discount type: percentage, fixed amount, complimentary item, bundle adjustment.
- Tax inclusive/exclusive, VAT/tax rule theo legal entity/client/service/currency.
- Pass-through cost có thể markup hoặc no-markup.
- Agency fee và media budget tách rõ trong UI/client proposal/accounting output.
- Rounding rule cấu hình theo currency và tax rule.
- Payment schedule theo percentage/fixed amount/milestone/date.

Công thức tham chiếu:

```text
Gross Amount = Quantity × Unit Price
Line Discount = Theo discount type/value và rounding rule
Net Amount = Gross Amount − Line Discount
Tax Amount = Taxable Amount × Tax Rate
Line Total = Net Amount + Tax Amount
Option Total = Tổng các line total được include
Quote Total = Tổng option được xuất bản/chọn theo proposal rule
```

Hệ thống không được sử dụng floating point không kiểm soát cho tiền tệ. Tất cả money value phải lưu theo decimal precision cấu hình và currency code ISO.

### FR-QT-009 — Cost và Gross Margin nội bộ

Hệ thống phải tính và hiển thị internal commercial health cho người có quyền.

Các thành phần cost:

- Internal labor cost: theo role, effort, cost rate, utilization assumption.
- Outsource/vendor cost.
- Production/asset/logistics cost.
- Commission/referral fee.
- Platform/tool cost nếu phân bổ theo deal.
- Media budget/pass-through có được include vào margin hay không theo company policy.

Công thức phải cấu hình được; default:

```text
Net Service Revenue = Net Amount của fee-based line item, không bao gồm media/pass-through no-markup
Direct Cost = Internal Labor Cost + Outsource Cost + Other Direct Cost
Gross Profit = Net Service Revenue − Direct Cost
Gross Margin % = Gross Profit / Net Service Revenue × 100
```

Yêu cầu:

- Margin hiển thị ở line item, package, option, quote.
- Có threshold theo service category/client tier/deal type.
- Cảnh báo visual: green/amber/red theo threshold.
- Margin/cost phải bị ẩn hoàn toàn ở proposal client và với role không có quyền.
- Khi cost/rate/discount thay đổi, recalculation phải gần realtime và log ảnh hưởng approval.
- Cho phép Finance chỉnh manual cost, bắt buộc reason/audit và có thể re-trigger approval.

### FR-QT-010 — Approval Workflow

Module phải hỗ trợ workflow nhiều cấp, tuần tự hoặc song song, cấu hình theo policy engine.

Điều kiện route có thể gồm:

- Quote total/net service revenue.
- Discount percent/amount.
- Gross margin percent/amount.
- Service category hoặc line item risk.
- Client tier/strategic account/new client.
- Legal entity/branch/currency.
- Payment term vượt chuẩn.
- Custom terms/legal clauses.
- Custom item/no price/cost missing.
- Media budget hoặc vendor pass-through vượt ngưỡng.
- Deal type: new/renewal/upsell/change request.

Ví dụ policy mặc định:

| Điều kiện | Approver bắt buộc |
|---|---|
| Discount <= 5% và margin >= 30% | Không yêu cầu exception approval hoặc Sales Manager tùy policy |
| Discount > 5% đến 10% | Account Director |
| Discount > 10% | Account Director + Finance Controller |
| Margin < 25% | Finance Controller + Executive Approver |
| Quote total > 200.000.000 VND | Sales/Commercial Director |
| Payment term > 60 ngày | Finance Controller |
| Điều khoản pháp lý sửa mẫu | Legal Reviewer |

Yêu cầu workflow:

- Submit tạo snapshot version Submitted, lock field commercial critical.
- Approver thấy diff, margin impact, policy trigger, attachments và comment history.
- Action: approve, reject, return for revision, request info, delegate nếu policy cho phép.
- Reject/return bắt buộc comment.
- SLA approval và escalation reminder cấu hình được.
- Nếu một thay đổi sau approval làm thay đổi policy input, version phải trở lại Draft/Returned hoặc tạo revision và re-route approval.
- Hệ thống lưu immutable approval log gồm actor, role, timestamp, action, comment, delegated-from và version hash.

### FR-QT-011 — Điều khoản, Payment và Legal

Quote phải quản lý điều khoản ở quote-level và option-level nếu cần:

- Validity period.
- Payment schedule/milestones.
- Invoice trigger.
- Payment method/bank information.
- Late payment policy.
- Scope change request policy.
- Revision/feedback limit.
- Client responsibilities.
- Confidentiality/NDA.
- Intellectual property ownership/licensing.
- Force majeure, termination, liability limitation.
- Tax and withholding note.
- Exclusions and third-party cost note.

Hệ thống phải hỗ trợ clause library có version, clause mandatory theo quote type/legal entity, placeholder merge fields và track modified clause. Mọi clause sửa từ approved template phải tạo legal review trigger nếu policy yêu cầu.

### FR-QT-012 — Proposal Builder và xuất bản

Module phải cho phép tạo proposal client-facing từ quote version approved.

Proposal gồm các section có thể bật/tắt và sắp xếp:

1. Cover/branding.
2. Client context & business objective.
3. Agency understanding/insight.
4. Proposed strategy/approach.
5. Scope of work.
6. Service details & deliverables.
7. KPI/forecast/assumptions.
8. Timeline/milestone.
9. Team/case study (optional).
10. Investment/pricing options.
11. Payment & commercial terms.
12. Terms & conditions.
13. Acceptance/next steps.

Yêu cầu:

- Template theo brand, legal entity, industry, quote type, language.
- Merge field từ quote/client/deal/line item/KPI.
- Nội dung client-facing tách khỏi internal note/cost/margin/approval.
- Preview responsive desktop/mobile.
- Generate PDF theo version published; PDF phải có version, issue date, validity, quote code và optional watermark.
- Xuất link share có token, expiration, password/OTP tùy policy, download permission và revoke capability.
- Link share chỉ render version published; không được tự cập nhật theo working draft.
- Có thể gửi qua email/integration nhưng mỗi lần gửi phải lưu recipient, channel, version, time và status.

### FR-QT-013 — Client View, Comment và Acceptance

Trang client proposal phải hỗ trợ:

- View không cần login hoặc authenticated view tùy sharing policy.
- Session tracking: first view, last view, total views, time on page, section views ở mức hợp pháp/policy cho phép.
- Download PDF nếu permission cho phép.
- Comment theo section/line item/option; comment được sync thành internal activity.
- Client request revision và chọn reason.
- Client chọn preferred option.
- Client acceptance với checkbox đồng ý điều khoản, signer name/title/email, timestamp, IP/device metadata theo policy và OTP/e-sign integration nếu yêu cầu.
- Client rejection với optional/required reason.
- Expired/revoked link phải hiển thị trạng thái rõ ràng và không lộ nội dung protected.

Acceptance không tự động thay thế hợp đồng trừ khi company policy và cơ chế pháp lý được cấu hình. UI phải dùng wording chính xác, ví dụ “Xác nhận báo giá” hoặc “Chấp thuận đề xuất”, theo template/legal policy.

### FR-QT-014 — Versioning, Revision và Compare

Hệ thống phải quản lý version theo quote root:

- Version number tăng tuần tự: v1, v2, v3...
- Mỗi publish/submit approval tạo snapshot không thể sửa trực tiếp.
- Sau khi sent/viewed, user phải tạo revision để thay đổi commercial/scope client-visible.
- Revision kế thừa dữ liệu từ source version nhưng có parent_version reference.
- Version cũ chuyển Superseded khi version mới được publish thay thế, trừ khi policy cho phép nhiều proposal active.
- Compare view hiển thị thay đổi ở header, package, line item, quantity, price, discount, tax, KPI, payment term, terms và total.
- Client phải được thông báo khi link cũ không còn hiệu lực do revision mới thay thế.

### FR-QT-015 — Thông báo, Task và Reminder

Hệ thống phải gửi in-app/email notification theo preference và tenant policy cho:

- Quote được assign/co-owned.
- Quote sắp hết hạn: mặc định T-7, T-3, T-1, có thể cấu hình.
- Approval pending, approval SLA breach, rejected/returned.
- Quote sent, viewed lần đầu, viewed lại, comment, request revision.
- Client accepted/rejected.
- Margin giảm dưới threshold hoặc rate card hết hiệu lực.
- Quote chưa có activity sau N ngày kể từ sent.

Hệ thống cho phép tạo follow-up task tự động khi quote sent/viewed/no response. Task phải link đến quote, deal, client và owner.

### FR-QT-016 — Chuyển đổi sau khi chấp nhận

Khi quote version Accepted, người có quyền phải có thể tạo:

- Contract draft.
- Project/Project charter.
- Work order hoặc statement of work.
- Delivery plan/milestone.
- Budget plan/resource request.
- Invoice/payment schedule.
- Vendor procurement request cho pass-through/outsource item.

Dữ liệu kế thừa tối thiểu:

- Client/legal entity/contact.
- Quote/version code và accepted timestamp.
- Selected option.
- Scope, line item, deliverables, exclusions, timeline, KPI, assumptions.
- Pricing, tax, payment schedule, media budget.
- Owner/team/delivery owner.

Conversion phải idempotent: không được tạo trùng project/contract/schedule khi user click nhiều lần hoặc job retry. Mọi record target phải link ngược về quote/version source.

### FR-QT-017 — Báo cáo và Dashboard

Dashboard và reporting phải hỗ trợ:

- Quote pipeline theo status và total value.
- Quote volume/value theo owner, team, branch, business unit, client, industry, service category, quote type.
- Conversion: draft-to-sent, sent-to-viewed, viewed-to-accepted, quote-to-win.
- Average sales cycle: created-to-sent, sent-to-accepted.
- Win/loss analysis: lost reason, competitor, price objection, timeline, scope mismatch.
- Discount distribution và exception rate.
- Margin forecast theo quote/service/client/owner; visibility theo role.
- Expiring quote, stale quote, approval bottleneck, approval lead time.
- Proposal engagement: views, unique viewers, time-to-first-view, comment volume.
- Forecast revenue based on probability/status; phải phân biệt agency fee, media budget và pass-through.
- Export CSV/XLSX/PDF theo permission; export phải được audit.

### FR-QT-018 — Import, Export và API

- Import quote/line item từ CSV/XLSX theo template được kiểm soát; validation trước commit và error report theo dòng.
- Export quote to CSV/XLSX/PDF theo quyền, watermark/protected fields theo policy.
- REST/GraphQL API hoặc integration layer cho CRM, contract, project, finance, DMS, e-sign, email/SMS, BI.
- Webhook events: quote.created, quote.updated, quote.submitted, quote.approved, quote.sent, quote.viewed, quote.comment_added, quote.accepted, quote.rejected, quote.expired, quote.converted.
- API phải hỗ trợ idempotency key với create/update async operations phù hợp.

---

## 10. Business Rules

| ID | Quy tắc |
|---|---|
| BR-QT-001 | Quote code phải unique theo scope sequence cấu hình và không tái sử dụng sau archive/cancelled |
| BR-QT-002 | Quote gửi khách hàng phải có version Approved + Published và còn hiệu lực |
| BR-QT-003 | Không thể gửi proposal nếu thiếu client contact, total amount, payment term hoặc required terms |
| BR-QT-004 | Direct cost, margin, approval comment và internal note không bao giờ được render trong client proposal/PDF client-facing |
| BR-QT-005 | Thay đổi price, quantity, discount, tax, cost, scope, KPI client-visible, payment term hoặc legal clause sau Approved phải tạo revision/re-approval theo policy |
| BR-QT-006 | Discount vượt discount cap hoặc margin dưới floor bắt buộc route exception approval; user không thể bypass bằng client-visible adjustment line nếu policy cấm |
| BR-QT-007 | Media budget phải được phân loại riêng với agency fee; proposal phải hiển thị rõ nó là ngân sách quảng cáo/chi phí bên thứ ba nếu cấu hình |
| BR-QT-008 | KPI forecast phải có assumption/disclaimer; không hiển thị như “cam kết” nếu classification là forecast/optimization target |
| BR-QT-009 | Quote expired không thể accepted qua public link; client được hướng dẫn liên hệ agency hoặc nhận version renewed |
| BR-QT-010 | Chỉ phiên bản active/published mới được gửi mới; public token phải gắn cứng với quote version |
| BR-QT-011 | Payment schedule tổng percentage phải bằng 100% hoặc tổng fixed amount bằng total payable; nếu mixed mode phải pass validation rounding |
| BR-QT-012 | Tax calculation phải snapshot tax rate và tax rule tại thời điểm publish; thay đổi tax master không được sửa lịch sử version |
| BR-QT-013 | Custom service item bắt buộc code tạm, reason, owner và review requirement theo policy |
| BR-QT-014 | Khi client accept một option, option đó và version source được lock; option không được chọn vẫn lưu để audit |
| BR-QT-015 | Một quote có thể link nhiều contacts nhưng chỉ định một billing contact và một primary decision-maker tại một thời điểm |
| BR-QT-016 | Dữ liệu quote phải bị soft delete; hard delete chỉ qua retention job và quyền đặc biệt theo policy dữ liệu |
| BR-QT-017 | Nếu rate card hết hiệu lực trước quote date/publish date, hệ thống cảnh báo hoặc block theo policy |
| BR-QT-018 | Approval delegation phải lưu cả người ủy quyền, người được ủy quyền, thời gian hiệu lực và lý do |

---

## 11. Data Model

### 11.1. Entity chính

| Entity | Mô tả | Quan hệ chính |
|---|---|---|
| Quote | Root aggregate của báo giá | 1-N QuoteVersion, 1-N QuoteParticipant, N-1 Client, N-1 Deal |
| QuoteVersion | Snapshot/version nghiệp vụ | 1-N QuoteOption, 1-N ApprovalInstance, 1-N ProposalPublication |
| QuoteOption | Phương án A/B/C | 1-N QuotePackage, 1-N QuoteLineItem, 1-N KPI |
| QuotePackage | Nhóm/gói dịch vụ | 1-N QuoteLineItem |
| QuoteLineItem | Hạng mục chi tiết | 1-N Deliverable, 1-N LineKPI, 1-N CostComponent |
| ServiceCatalogItem | Danh mục dịch vụ | 1-N RateCard, template delivery/KPI/scope |
| RateCard | Giá bán chuẩn theo ngữ cảnh | N-1 ServiceCatalogItem |
| CostCard | Giá vốn/chi phí chuẩn | N-1 ServiceCatalogItem/Role/Vendor category |
| QuotePricingSummary | Snapshot tổng hợp giá/tax/margin | N-1 QuoteVersion/Option |
| PaymentSchedule | Đợt thanh toán | N-1 QuoteVersion/Option |
| Clause | Thư viện điều khoản | 1-N ClauseVersion |
| QuoteClause | Điều khoản snapshot áp cho quote version | N-1 QuoteVersion |
| ApprovalPolicy | Rule workflow | 1-N ApprovalRoute |
| ApprovalInstance | Phiên approval cho quote version | 1-N ApprovalStep |
| ProposalTemplate | Template proposal | 1-N ProposalPublication |
| ProposalPublication | Bản published/link/PDF | N-1 QuoteVersion |
| ProposalShare | Token truy cập client | N-1 ProposalPublication |
| ProposalViewEvent | Sự kiện view | N-1 ProposalShare |
| ProposalComment | Comment của internal/client | N-1 QuoteVersion/section/line item |
| QuoteAcceptance | Bản ghi accept/reject | N-1 QuoteVersion/Option |
| QuoteActivity | Timeline nghiệp vụ | N-1 Quote |
| QuoteAuditLog | Audit immutable | N-1 Quote/QuoteVersion |
| ConversionRecord | Link quote-version tới contract/project/invoice | N-1 QuoteVersion |

### 11.2. Quote entity tối thiểu

```text
Quote
- id (UUID)
- tenant_id
- legal_entity_id
- quote_code
- root_quote_id (self reference, nullable)
- current_version_id
- title
- quote_type
- client_account_id
- primary_contact_id
- deal_id (nullable)
- owner_user_id
- business_unit_id
- currency_code
- status
- quote_date
- valid_until
- timezone
- confidentiality_level
- created_at, created_by, updated_at, updated_by
- archived_at, archived_by
- row_version / optimistic_lock_version
```

### 11.3. QuoteVersion entity tối thiểu

```text
QuoteVersion
- id (UUID)
- quote_id
- version_no
- parent_version_id (nullable)
- state
- source_version_id (nullable)
- snapshot_hash
- quote_snapshot_json (hoặc aggregate snapshot strategy)
- total_before_tax
- total_tax
- total_after_tax
- net_service_revenue
- media_budget_total
- pass_through_total
- direct_cost_total (restricted)
- gross_profit_total (restricted)
- gross_margin_pct (restricted)
- submitted_at, approved_at, published_at, accepted_at
- created_at, created_by
```

### 11.4. Phân loại dữ liệu

| Classification | Ví dụ | Hiển thị |
|---|---|---|
| Public client-facing | Scope, deliverable, price, tax, payment term, client-visible KPI | Proposal/link/PDF client |
| Internal operational | Owner, resource assumption, internal note, delivery risk | Internal authorized users |
| Finance restricted | Cost, margin, rate override, commission | Finance/commercial authorized users |
| Legal restricted | Legal review note, negotiation redline | Legal/authorized management |
| Audit immutable | Approval decisions, event metadata, previous values | Auditor/admin theo retention policy |

---

## 12. UX/UI Requirements

### 12.1. Quote Workspace

- Giao diện desktop-first cho workload lớn; responsive tablet/mobile cho action cơ bản.
- Danh sách phải hiển thị status, value, expiry, owner và next action rõ ràng.
- Saved filters/views cho từng persona: My Drafts, Awaiting My Approval, Expiring This Week, Sent No Response, Accepted Not Converted.

### 12.2. Quote Builder

Màn hình Quote Builder dùng bố cục 3 vùng:

1. Sidebar hệ thống.
2. Main builder: header/context → options → service/package → scope/KPI/terms.
3. Sticky right panel: investment summary, payment schedule, approval health, margin (internal only), CTA.

Tab đề xuất:

- Tổng quan.
- Phạm vi dịch vụ.
- KPI & Chỉ số.
- Chi phí & Lợi nhuận (restricted).
- Điều khoản.
- Proposal Design.
- Lịch sử.

### 12.3. Service card

Mỗi service line/package phải có accordion/card với:

- Tên, tag category/channel, mô tả ngắn.
- Sản lượng/deliverable.
- KPI/forecast theo phân loại và visual distinction.
- Scope included/excluded.
- Timeline, owner team, SLA/revision.
- Price, discount, tax, total.
- Cost/margin (restricted).
- Warning/error inline và approval impact.

### 12.4. Visual semantics

- Blue: action/primary information.
- Green: healthy margin/approved/success.
- Amber: approval required/warning/near expiry.
- Red: invalid/blocking/low margin/expired/rejected.
- KPI forecast phải được gắn nhãn “Dự kiến”, “Mục tiêu tối ưu” hoặc “Cam kết bàn giao”; không dùng cùng style làm user hiểu nhầm.

### 12.5. Accessibility

- WCAG 2.1 AA cho web app nội bộ và client proposal khi khả thi.
- Keyboard navigation cho quote builder/table/reorder action.
- Focus state rõ ràng, label input đầy đủ, semantic heading, contrast hợp lệ.
- Không dùng màu đơn lẻ để truyền đạt status; phải có text/icon bổ trợ.

---

## 13. Integrations

| Hệ thống | Mục đích | Dữ liệu/luồng |
|---|---|---|
| CRM Core | Client, Contact, Deal, Owner, Activity | Create quote from deal; sync status/activity back to deal |
| Project Management | Handover quote accepted | Create project, milestone, task/template, scope baseline |
| Contract Management | Soạn/thẩm định/ký hợp đồng | Create contract draft from accepted quote/version |
| Finance/Invoicing | Invoice schedule, tax, revenue forecast | Sync payment schedule, customer, taxable amount, invoice trigger |
| DMS/Cloud Storage | Lưu file/PDF/attachment | Store proposal PDF, brief, client attachment, signed document |
| Email/SMS/Zalo/WhatsApp | Gửi link, notification, follow-up | Delivery status và event tracking trong giới hạn provider hỗ trợ |
| E-sign Provider | Chấp thuận/ký số | Send envelope, signer status, signed artifact |
| BI/Data Warehouse | Phân tích doanh thu, margin, funnel | Event/data export incremental |
| Ads/Analytics platforms | KPI benchmark/reporting (phase sau) | Meta/Google/TikTok/GA4 data reference và performance actual |
| Identity/SSO | Auth/role/audit | SAML/OIDC, SCIM nếu enterprise |

Yêu cầu integration chung:

- Event-driven, retry-safe, idempotent.
- Có dead-letter queue hoặc cơ chế theo dõi retry.
- Mapping version-aware: không ghi đè accepted/published snapshot bằng working data.
- Log request/response theo masking policy; không ghi token/secret/PII nhạy cảm vào application log.

---

## 14. Non-functional Requirements

### 14.1. Performance

| Hạng mục | Mục tiêu |
|---|---|
| Quote list first meaningful load | P95 <= 2.5 giây với 25 records trong điều kiện chuẩn |
| Quote builder load | P95 <= 3 giây với quote có tối đa 200 line item |
| Recalculate pricing | P95 <= 1.5 giây sau thay đổi line item ở quote <= 200 lines |
| Search/filter | P95 <= 2 giây cho index-supported query |
| Generate proposal preview | P95 <= 5 giây với template chuẩn |
| PDF generation | Async; hoàn tất P95 <= 60 giây với proposal <= 50 pages |
| Public proposal page | P95 <= 2.5 giây tại khu vực primary market |

### 14.2. Scalability

- Thiết kế hỗ trợ tối thiểu 10.000 internal users/tenant và 1.000 concurrent active sessions ở cấp platform, tùy kiến trúc triển khai.
- Quote list, activity, audit, view event phải dùng pagination, indexing và partition/archival strategy.
- Render PDF/proposal, export và notification chạy qua background job queue; không block UI request.

### 14.3. Availability và Reliability

- Mục tiêu availability module nội bộ: 99.9%/tháng, loại trừ maintenance window công bố trước.
- Không mất dữ liệu đã save thành công; autosave dùng optimistic concurrency và cơ chế conflict resolution.
- RPO <= 15 phút, RTO <= 4 giờ (điều chỉnh theo hạ tầng/SLA thực tế).
- Critical workflow: approval, acceptance, conversion phải idempotent và có reconciliation job.

### 14.4. Security

- MFA/SSO theo policy enterprise.
- RBAC + data scope + field-level authorization ở backend; không chỉ dựa vào UI hide/show.
- TLS in transit, encryption at rest cho database/object storage theo khả năng hạ tầng.
- Signed/public share token entropy đủ mạnh, expiration, revoke, rate limit, optional password/OTP.
- PII masking trong log/export và consent/legal notice cho client tracking.
- OWASP ASVS-oriented controls: input validation, CSRF/XSS/SQLi prevention, secure headers, audit security event.
- File upload virus scanning, MIME validation, size/type restriction, signed download URL ngắn hạn.

### 14.5. Audit, Compliance và Retention

- Audit log cho create/update/delete/archive, status change, approval, share/revoke, send, download, client acceptance, rate override, export và permission change.
- Audit record tối thiểu: actor, role, action, entity/version, before/after hoặc diff, timestamp, IP/device context khi phù hợp, correlation ID.
- Retention period cấu hình theo tenant/country/legal policy; soft-delete và legal hold phải được hỗ trợ ở tầng dữ liệu.
- Public proposal tracking phải hiển thị privacy notice khi required; chỉ thu thập dữ liệu cần thiết.

### 14.6. Localization

- Hỗ trợ tiếng Việt và tiếng Anh; quote/proposal language theo version.
- Hỗ trợ timezone per legal entity/quote.
- Currency, number/date formatting theo locale; dữ liệu tiền lưu standardized.
- Template điều khoản, email và notification theo language/brand.

---

## 15. Validation và Error Handling

### 15.1. Validation client/server

- Client-side validation cải thiện UX, nhưng server-side validation là bắt buộc và authoritative.
- API phải trả lỗi có error code, field path, human-readable localized message và correlation ID.
- Không commit một phần aggregate quote khi transaction pricing/validation thất bại.

### 15.2. Validation quan trọng

| Tình huống | Hành vi |
|---|---|
| Total payment schedule lệch quote payable total | Block submit/publish; chỉ rõ chênh lệch |
| Margin không tính được do thiếu cost | Warning/block theo policy; tạo task cho Finance/Delivery |
| KPI forecast thiếu assumption/disclaimer | Block publish client proposal |
| Rate card expired | Warning hoặc block theo policy; yêu cầu reprice/approval exception |
| Concurrent edit | Báo conflict, hiển thị compare/merge option; không silent overwrite |
| Client link revoked/expired | Không render proposal; trả trang trạng thái an toàn |
| Publish PDF lỗi | Không chuyển status Sent; retry async, thông báo owner |
| Integration conversion lỗi | Ghi ConversionRecord failed, retry-safe, hiển thị action retry |

---

## 16. Báo cáo dữ liệu và chỉ số phân tích

### 16.1. Fact và dimension đề xuất

- FactQuoteVersion: total, service revenue, tax, discount, media budget, pass-through, direct cost, GP, GM, status timestamps.
- FactApproval: step duration, decision, escalations, delegation.
- FactProposalEngagement: view, unique visitor proxy, time, section engagement, comment.
- FactConversion: quote-to-contract/project/invoice result.
- Dimensions: Date, Client, Industry, Owner, Team, Business Unit, Legal Entity, Service Category, Quote Type, Currency, Template, Deal Source, Status, Loss Reason.

### 16.2. Quy ước metric

- Win rate phải xác định denominator rõ: accepted/(accepted+rejected) hoặc accepted/sent; dashboard phải label công thức.
- Margin report phải chỉ rõ include/exclude media/pass-through.
- Forecast revenue phải sử dụng agency fee/net service revenue, không cộng nhầm media budget khi báo cáo doanh thu agency.
- Tất cả report về historical quote dùng version snapshot, không dùng rate card hiện hành để tính lại lịch sử.

---

## 17. API Contract Outline

> Đây là outline, chi tiết OpenAPI được lập ở tài liệu Technical Design/API Specification riêng.

| Method | Endpoint | Mục đích |
|---|---|---|
| GET | `/v1/quotes` | List/search/filter quote |
| POST | `/v1/quotes` | Create quote root và initial working version |
| GET | `/v1/quotes/{quoteId}` | Quote aggregate hiện tại theo quyền |
| PATCH | `/v1/quotes/{quoteId}` | Update header working state với optimistic lock |
| POST | `/v1/quotes/{quoteId}/versions` | Create revision from specified version |
| GET | `/v1/quotes/{quoteId}/versions/{versionId}` | Get immutable/current version detail |
| PATCH | `/v1/quote-versions/{versionId}` | Update working version |
| POST | `/v1/quote-versions/{versionId}/recalculate` | Recalculate price/cost/margin |
| POST | `/v1/quote-versions/{versionId}/submit-approval` | Submit workflow |
| POST | `/v1/approval-steps/{stepId}/actions` | Approve/reject/return/delegate |
| POST | `/v1/quote-versions/{versionId}/publish` | Generate published proposal version |
| POST | `/v1/proposal-publications/{id}/shares` | Create client share link |
| POST | `/v1/public/proposals/{token}/acceptance` | Client acceptance/rejection flow |
| POST | `/v1/quote-versions/{versionId}/convert` | Create contract/project/invoice schedule |
| GET | `/v1/catalog/services` | Search service catalog |
| GET | `/v1/reports/quotes` | Quote analytics |

API mutation phải nhận `Idempotency-Key` cho action create/publish/send/accept/convert phù hợp. Update quote/version phải dùng `If-Match`/ETag hoặc `row_version` để xử lý concurrent edit.

---

## 18. Event Model

| Event | Producer | Consumer điển hình |
|---|---|---|
| QuoteCreated | Quote Module | CRM activity, notification, analytics |
| QuoteVersionSubmitted | Approval Engine | Approver inbox, audit, BI |
| QuoteApproved | Approval Engine | Proposal publisher, owner notification |
| ProposalPublished | Proposal Studio | Email/share service, DMS, analytics |
| ProposalSent | Communication Service | CRM activity, follow-up scheduler |
| ProposalViewed | Public Portal | Owner alert, engagement analytics |
| ProposalCommentAdded | Public Portal/Internal UI | Collaboration/task service |
| QuoteAccepted | Public Portal/E-sign | CRM deal update, conversion orchestrator |
| QuoteRejected | Public Portal | Lost reason workflow, CRM deal update |
| QuoteExpired | Scheduler | Owner notification, CRM activity |
| QuoteConverted | Conversion Orchestrator | Project/contract/finance integration |

Mọi event phải bao gồm event_id, occurred_at, tenant_id, quote_id, quote_version_id, correlation_id, actor type/id khi có thể; payload cần versioned schema.

---

## 19. Acceptance Criteria theo luồng chính

### AC-01: Tạo quote từ Deal

- Given một Deal có client, contact và owner.
- When Sales chọn “Tạo báo giá”.
- Then hệ thống tạo Quote Draft với dữ liệu CRM được kế thừa, quote code unique, owner mặc định theo Deal owner và audit event tạo mới.

### AC-02: Thêm package từ catalog

- Given user có quyền edit Draft.
- When chọn package từ Service Catalog.
- Then hệ thống thêm package, line item, default scope/deliverable/KPI/rate/cost snapshot theo catalog hiệu lực tại quote date; user có thể điều chỉnh theo permission.

### AC-03: Kiểm soát margin thấp

- Given Quote có gross margin 22% và policy floor là 25%.
- When user submit approval.
- Then workflow phải tự động thêm Finance Controller và Executive Approver; user không thể publish/send cho client trước khi được approve.

### AC-04: Revision sau khi gửi khách hàng

- Given version v1 đã Published và trạng thái Quote là Sent/Viewed.
- When Account thay đổi số lượng video hoặc đơn giá.
- Then hệ thống yêu cầu tạo v2, giữ v1 immutable, hiển thị diff và re-trigger policy approval nếu thay đổi thuộc commercial critical fields.

### AC-05: Client acceptance

- Given client nhận proposal link active cho version v2.
- When client chọn option B, xác nhận điều khoản và hoàn tất phương thức xác thực required.
- Then hệ thống ghi QuoteAcceptance gắn v2/option B, chuyển Quote trạng thái Accepted, lock v2, tạo activity và cho phép conversion theo quyền.

### AC-06: Bảo mật client proposal

- Given một client viewer mở share token.
- When proposal được render.
- Then chỉ các section/field client_visible được xuất bản; direct cost, margin, internal note, approval workflow và other options hidden không được trả về từ API/public HTML.

### AC-07: Payment schedule

- Given quote payable total là 265.647.600 VND.
- When user cấu hình 50%/30%/20%.
- Then hệ thống tính các đợt theo rounding rule và bảo đảm tổng payment amount bằng payable total; nếu lệch 1 VND do rounding, hệ thống phân bổ theo configured final-installment rule và hiển thị rõ.

---

## 20. Backlog ưu tiên triển khai

### Phase 1 — Core Commercial Control (MVP)

- Quote list, create/edit draft, header/client/deal link.
- Service catalog, line item, package cơ bản, pricing/tax/discount.
- Cost/margin internal cơ bản.
- Single/multi-step approval rule cơ bản.
- Version snapshot, PDF export, send email/link cơ bản.
- Quote status, expiry, activity log, basic RBAC.
- Conversion handover tối thiểu sang Project/Contract/Invoice Schedule.

### Phase 2 — Proposal Experience và Scale

- Proposal studio template/section builder.
- Multi-option A/B/C, comparison.
- KPI scenario/forecast builder.
- Client portal view/comment/request revision/acceptance.
- Rich approval policy, delegation, SLA escalation.
- Saved view, advanced report, BI event pipeline.
- Multi-entity, multi-currency, richer rate/cost card.

### Phase 3 — Advanced Intelligence và Enterprise Control

- E-sign, CPQ advanced pricing, complex revenue/commission rule.
- AI-assisted scope draft, pricing recommendation, risk/margin anomaly, proposal personalization.
- Actual-vs-quoted KPI and margin feedback loop từ Project/Finance/Ads platform.
- Forecasting, benchmark engine, deal win/loss intelligence.
- Enterprise SSO/SCIM, data retention/legal hold nâng cao.

---

## 21. Rủi ro và quyết định mở

| Chủ đề | Câu hỏi/Quyết định cần chốt |
|---|---|
| Công thức margin | Có tính media budget/pass-through vào margin không? Theo từng service line hay toàn quote? |
| Tax | Mỗi legal entity dùng tax profile nào, có tax inclusive và foreign currency không? |
| E-sign | Acceptance trong portal có giá trị nào trong quy trình pháp lý, khi nào bắt buộc provider e-sign? |
| Client portal | Có cần login client portal hay token/password/OTP là đủ? |
| Proposal tracking | Mức tracking nào phù hợp privacy/consent policy và pháp luật áp dụng? |
| Pricing governance | Ai được tạo custom price/cost, thay đổi rate card, override margin floor? |
| Contract integration | Quote accepted tạo 1 contract cho toàn bộ option hay split theo entity/service? |
| Media budget | Media budget client nạp trực tiếp vào platform hay agency thu hộ? Ảnh hưởng invoice/tax thế nào? |
| Data residency | Yêu cầu lưu trữ dữ liệu, backup, retention theo khách hàng/doanh nghiệp? |
| Multi-brand | Một client quote có cần render nhiều brand/legal entity hay không? |

---

## 22. Phụ lục A — Trường hiển thị Proposal Client

### Bắt buộc hiển thị

- Logo/brand agency và thông tin pháp nhân phát hành.
- Client name/contact (nếu template yêu cầu).
- Quote code, version, issue date, valid until.
- Objective, scope, deliverable, timeline.
- Giá, discount client-facing, tax, tổng thanh toán và payment schedule.
- KPI label/phân loại, assumptions/disclaimer.
- Điều khoản thương mại/pháp lý được áp dụng.
- Next steps/acceptance action.

### Không được hiển thị

- Internal labor cost, outsource cost, gross profit, gross margin.
- Rate card source, cost card source, internal price override reason.
- Approval matrix, approver comments, internal risk score.
- Internal notes, private attachments, legal internal redlines.
- Hidden option/line item/section.
- PII không cần thiết của nhân viên/khách hàng khác.

---

## 23. Phụ lục B — Mẫu dữ liệu KPI/Forecast

```json
{
  "metric_code": "META_CPL",
  "metric_name": "Cost per Lead",
  "classification": "optimization_target",
  "unit": "VND/lead",
  "operator": "between",
  "min_value": 85000,
  "max_value": 100000,
  "period": "campaign_total",
  "scenario": "base",
  "data_source": "meta_ads",
  "client_visible": true,
  "assumptions": [
    "Media budget tối thiểu 120.000.000 VND",
    "Target geography TP.HCM",
    "Landing page đạt checklist CRO",
    "Sales phản hồi lead trong dưới 15 phút"
  ],
  "disclaimer": "Chỉ số là mục tiêu tối ưu, có thể thay đổi theo thị trường, tệp khách hàng, creative và tốc độ xử lý lead."
}
```

---

## 24. Phụ lục C — Definition of Done

Một chức năng của Module Báo giá chỉ được coi là hoàn thành khi:

- Có business rule và acceptance criteria được Product/BA xác nhận.
- Có UX states: loading, empty, success, validation, error, permission denied, concurrent edit nếu áp dụng.
- Có backend authorization và audit event cho action nhạy cảm.
- Có automated test unit/integration/e2e ở mức phù hợp.
- Có migration/backward compatibility nếu thay đổi data model.
- Có observability: log, metric, trace/correlation ID cho workflow asynchronous.
- Có tài liệu API/configuration/admin guide nếu cần.
- Đã kiểm thử role-based visibility để không rò rỉ cost/margin/internal data vào client proposal.
- Đã kiểm thử version integrity và idempotency cho publish/send/accept/convert.

---

**Kết thúc tài liệu.**

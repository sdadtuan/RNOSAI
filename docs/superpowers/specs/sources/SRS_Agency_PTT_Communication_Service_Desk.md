# SRS — Module Communication & Service Desk
## Agency PTT CRM / Agency Operating System

**Phiên bản:** 1.0  
**Phạm vi:** Chat nội bộ và khách hàng, quản lý email, lập/gửi báo cáo, quản lý ticket hỗ trợ & yêu cầu công việc.  
**Đối tượng sử dụng:** Ban quản trị, account, project manager, marketing, content, design, media, sales, kế toán, kỹ thuật, khách hàng, đối tác và AI Agent.

---

# 1. Mục tiêu nghiệp vụ

Module Communication & Service Desk giúp Agency PTT tập trung toàn bộ trao đổi, yêu cầu, báo cáo và lịch sử xử lý khách hàng vào một hệ thống duy nhất.

Hệ thống cần giải quyết các vấn đề phổ biến của agency:

- Tin nhắn khách hàng bị phân tán trên Zalo, Messenger, Email, Slack hoặc các nhóm chat cá nhân.
- Yêu cầu “sửa nhanh”, “làm thêm”, “gửi báo cáo” không được ghi nhận thành đầu việc chính thức.
- Khó theo dõi ai đang xử lý, thời gian phản hồi, thời gian hoàn thành và mức độ quá hạn.
- Báo cáo marketing được lập thủ công, gửi sai phiên bản hoặc không lưu lịch sử.
- Email trao đổi không được liên kết với khách hàng, hợp đồng, chiến dịch hoặc dự án.
- Ban quản trị không có dashboard thể hiện hiệu suất account, đội vận hành và chất lượng dịch vụ.
- AI Agent chưa có nơi tiếp nhận, phân loại, tóm tắt và đề xuất phản hồi cho các tương tác khách hàng.

## 1.1. Mục tiêu sản phẩm

1. Tạo một “single source of truth” cho giao tiếp vận hành agency.
2. Liên kết mọi trao đổi với đúng khách hàng, dự án, chiến dịch, hợp đồng, báo giá hoặc ticket.
3. Chuẩn hóa quy trình tiếp nhận → phân loại → xử lý → phê duyệt → đóng yêu cầu.
4. Theo dõi SLA phản hồi và SLA hoàn thành theo khách hàng/gói dịch vụ/loại yêu cầu.
5. Tự động hóa báo cáo định kỳ và nhắc nhở các bên liên quan.
6. Hỗ trợ AI Agent trong việc:
   - Tóm tắt hội thoại.
   - Phân loại ticket.
   - Gợi ý người xử lý.
   - Soạn email phản hồi.
   - Sinh báo cáo nháp.
   - Phát hiện rủi ro SLA.
   - Trích xuất action items từ chat/email.

---

# 2. Phạm vi hệ thống

## 2.1. In scope

Hệ thống gồm 4 module chính:

| Module | Chức năng trọng tâm |
|---|---|
| Chat | Nhắn tin nội bộ, theo dự án, theo khách hàng, theo chiến dịch và chat hỗ trợ khách hàng |
| Báo cáo | Lập, tạo, phê duyệt, xuất và gửi báo cáo marketing/vận hành/tài chính |
| Email | Đồng bộ hoặc gửi email, lưu lịch sử trao đổi, liên kết email với CRM và ticket |
| Ticket | Tiếp nhận yêu cầu, phân loại, phân công, theo dõi SLA, xử lý, nghiệm thu và đóng ticket |

## 2.2. Out of scope giai đoạn 1

Các nội dung sau không bắt buộc trong MVP nhưng cần thiết kế kiến trúc để mở rộng:

- Tổng đài call center/VoIP.
- Đồng bộ đầy đủ Facebook Messenger, Zalo OA, WhatsApp, Instagram DM.
- Hệ thống ký hợp đồng điện tử.
- Hệ thống chấm công nhân sự.
- Phần mềm quản lý tài chính/kế toán hoàn chỉnh.
- AI Agent tự động gửi phản hồi ra khách hàng mà không có cơ chế duyệt.
- Hệ thống quản lý source code, CI/CD hoặc DevOps ticket chuyên sâu như Jira.

---

# 3. Vai trò và phân quyền

## 3.1. Danh sách vai trò

| Vai trò | Mô tả |
|---|---|
| Super Admin | Quản trị toàn hệ thống, cấu hình tổ chức, phân quyền, SLA, workflow và tích hợp |
| Agency Admin | Quản lý vận hành agency, xem toàn bộ khách hàng, dự án, báo cáo và ticket |
| Director/Manager | Quản lý phòng ban, phân công nguồn lực, phê duyệt báo cáo và escalation ticket |
| Account Manager | Đầu mối phụ trách khách hàng, tiếp nhận yêu cầu, trao đổi và gửi báo cáo |
| Project Manager | Điều phối dự án/campaign, giao ticket, theo dõi tiến độ và nghiệm thu nội bộ |
| Team Member | Nhân sự triển khai: content, design, ads, SEO, video, developer, media, CRM |
| Finance/Accounting | Theo dõi các ticket/báo cáo liên quan ngân sách, công nợ, thanh toán |
| Client Admin | Đại diện phía khách hàng có quyền xem/gửi chat, ticket, báo cáo trong phạm vi công ty |
| Client Member | Người dùng khách hàng có quyền hạn giới hạn, chỉ xem/gửi nội dung được cấp |
| Partner/Vendor | Đối tác triển khai, chỉ truy cập ticket hoặc project được chỉ định |
| AI Agent | Tác nhân AI có quyền đọc dữ liệu theo policy, tạo nháp, đề xuất và tự động hóa được cấu hình |
| Auditor/Viewer | Chỉ xem dữ liệu, lịch sử thao tác và báo cáo, không được chỉnh sửa |

## 3.2. Nguyên tắc phân quyền

- Dữ liệu phải được phân vùng theo `Tenant/Organization`.
- Mỗi khách hàng là một `Client Account`.
- Người dùng phía khách hàng chỉ được truy cập dữ liệu thuộc `Client Account` của họ.
- Nhân sự agency chỉ thấy dữ liệu thuộc phòng ban, dự án/campaign được phân công, khách hàng được cấp quyền hoặc ticket/chat có liên quan trực tiếp.
- Super Admin và Agency Admin có thể xem toàn bộ dữ liệu theo quyền hệ thống.
- AI Agent chỉ có quyền truy cập theo scope được cấu hình; không mặc định có quyền đọc mọi dữ liệu.
- Các hành động nhạy cảm phải có audit log: xóa chat, đóng ticket, thay đổi SLA, gửi email/báo cáo ra ngoài, thay đổi người phụ trách, truy cập dữ liệu khách hàng và xuất báo cáo.

---

# 4. Thuật ngữ và thực thể nghiệp vụ

| Thuật ngữ | Diễn giải |
|---|---|
| Client Account | Doanh nghiệp/khách hàng sử dụng dịch vụ của Agency PTT |
| Contact | Cá nhân đại diện thuộc khách hàng, đối tác hoặc agency |
| Project | Dự án cung cấp dịch vụ cho khách hàng |
| Campaign | Chiến dịch marketing trong một dự án hoặc hợp đồng |
| Contract | Hợp đồng dịch vụ giữa agency và khách hàng |
| Service Package | Gói dịch vụ: Ads, SEO, Content, Branding, CRM, Website, Video AI… |
| Conversation | Một luồng chat hoặc trao đổi tập trung |
| Channel | Kênh giao tiếp: chat nội bộ, chat khách hàng, email, Zalo, Messenger… |
| Ticket | Yêu cầu cần xử lý, có trạng thái, người phụ trách, ưu tiên và SLA |
| SLA | Cam kết thời gian phản hồi và thời gian hoàn thành |
| Report | Báo cáo hiệu quả, tiến độ, ngân sách hoặc vận hành |
| Approval | Quy trình phê duyệt nội dung, báo cáo, chi phí hoặc nghiệm thu |
| Escalation | Cơ chế nâng cấp xử lý khi ticket có rủi ro hoặc vi phạm SLA |
| Action Item | Đầu việc được trích xuất từ chat/email/họp/ticket |
| AI Suggestion | Đề xuất do AI Agent sinh ra, yêu cầu người dùng duyệt trước khi thực hiện nếu là hành động bên ngoài |

---

# 5. Kiến trúc thông tin tổng thể

## 5.1. Quan hệ giữa các module

```text
Client Account
   ├── Contacts
   ├── Contracts
   ├── Projects
   │    ├── Campaigns
   │    ├── Chat Conversations
   │    ├── Tickets
   │    ├── Reports
   │    └── Emails
   └── Service Packages

Chat / Email
   ├── Có thể tạo Ticket
   ├── Có thể tạo Action Item
   ├── Có thể đính kèm Report
   └── Có thể liên kết Project / Campaign / Contact

Ticket
   ├── Có thể phát sinh từ Chat / Email / Form / AI Agent
   ├── Có liên kết Report
   ├── Có SLA và Escalation
   ├── Có Approval
   └── Có lịch sử trao đổi riêng

Report
   ├── Có thể tạo từ Template
   ├── Dùng dữ liệu Campaign / Ticket / KPI
   ├── Có Approval
   ├── Có Versioning
   └── Có thể gửi qua Email / Client Portal / Chat
```

## 5.2. Navigation đề xuất

```text
Dashboard
├── CRM
│   ├── Khách hàng
│   ├── Liên hệ
│   ├── Hợp đồng
│   └── Dự án / Campaign
├── Communication
│   ├── Chat
│   ├── Email Inbox
│   ├── Sent Mail
│   └── Unified Timeline
├── Service Desk
│   ├── Ticket Board
│   ├── My Tickets
│   ├── SLA Monitor
│   └── Ticket Templates
├── Reports
│   ├── Report Center
│   ├── Report Templates
│   ├── Approval Queue
│   ├── Schedule Reports
│   └── Report Archive
├── AI Workspace
│   ├── AI Inbox
│   ├── AI Suggestions
│   ├── Knowledge Base
│   └── Agent Configuration
└── Administration
    ├── Users & Roles
    ├── SLA Rules
    ├── Workflows
    ├── Notification Rules
    └── Integrations
```

---

# 6. Module Chat

## 6.1. Mục tiêu

Cho phép trao đổi nhanh giữa nội bộ agency, khách hàng, đối tác và AI Agent; đồng thời đảm bảo mọi nội dung quan trọng có thể chuyển thành ticket, action item hoặc dữ liệu CRM.

## 6.2. Loại chat

| Loại chat | Mô tả | Người tham gia |
|---|---|---|
| Direct Message | Chat 1-1 giữa hai người dùng | Nhân sự agency, khách hàng, đối tác |
| Group Chat | Nhóm chat theo phòng ban hoặc nhóm công việc | Nhân sự agency |
| Client Chat | Kênh trao đổi riêng với khách hàng | Account, PM, client contact |
| Project Chat | Luồng trao đổi theo dự án | Thành viên dự án và khách hàng được cấp quyền |
| Campaign Chat | Trao đổi theo từng chiến dịch | Team campaign, account, client contact |
| Ticket Chat | Luồng trao đổi trong từng ticket | Requester, assignee, watcher, client |
| Announcement Channel | Kênh thông báo một chiều | Admin/Manager gửi đến nhóm người dùng |
| AI Assistant Chat | Không gian chat với AI Agent | Người dùng có quyền sử dụng AI |

## 6.3. User stories

### US-CHAT-01: Tạo cuộc trò chuyện

**Là** Account Manager  
**Tôi muốn** tạo chat nhóm cho một khách hàng hoặc dự án  
**Để** toàn bộ trao đổi của team và khách hàng được tập trung đúng ngữ cảnh.

**Acceptance criteria:**

- Người dùng có thể tạo chat với tên, mô tả, ảnh đại diện và loại chat.
- Khi chọn loại `Client Chat`, bắt buộc chọn `Client Account`.
- Khi chọn loại `Project Chat`, bắt buộc chọn `Project`.
- Khi chọn loại `Campaign Chat`, bắt buộc chọn `Campaign`.
- Hệ thống tự thêm Account Manager và Project Manager của project vào nhóm nếu được cấu hình.
- Người tạo được gán vai trò `Conversation Owner`.
- Hệ thống ghi audit log cho sự kiện tạo conversation.

### US-CHAT-02: Gửi tin nhắn

**Là** thành viên trong conversation  
**Tôi muốn** gửi tin nhắn văn bản, file, hình ảnh hoặc đề cập người dùng  
**Để** trao đổi thông tin công việc nhanh chóng.

**Acceptance criteria:**

- Hỗ trợ tin nhắn text, emoji, hyperlink, attachment và voice note nếu được triển khai.
- Cho phép mention người dùng bằng `@Tên`.
- Cho phép mention nhóm bằng `@team`, `@account`, `@design` nếu admin cấu hình.
- Cho phép reply vào một tin nhắn cụ thể.
- Cho phép forward tin nhắn đến conversation khác nếu người dùng có quyền.
- Tin nhắn hiển thị trạng thái: Sent, Delivered, Read và Failed.
- Với tin nhắn có attachment, hệ thống kiểm tra loại file, dung lượng và virus scan nếu có tích hợp.
- Tin nhắn gửi thành công phải xuất hiện gần như realtime với mục tiêu P95 dưới 3 giây.

### US-CHAT-03: Chuyển chat thành ticket

**Là** Account Manager hoặc Project Manager  
**Tôi muốn** chuyển một tin nhắn/yêu cầu trong chat thành ticket  
**Để** team không bỏ sót yêu cầu từ khách hàng.

**Acceptance criteria:**

- Người dùng có menu thao tác `Create Ticket from Message`.
- Hệ thống tự điền tiêu đề ticket từ nội dung tin nhắn.
- Mô tả ticket gồm nội dung gốc và link đến message.
- Khách hàng, dự án và campaign được tự điền theo context conversation.
- Người yêu cầu là người gửi tin nhắn gốc.
- Người dùng có thể chỉnh sửa mức ưu tiên, loại ticket, deadline và assignee trước khi tạo.
- Ticket sau khi tạo phải hiển thị backlink về message gốc.
- Chat hiển thị badge hoặc biểu tượng cho biết message đã được chuyển thành ticket.
- Không tạo ticket trùng lặp nếu người dùng chọn lại cùng message; hệ thống cảnh báo ticket đã tồn tại.

### US-CHAT-04: AI tóm tắt hội thoại

**Là** Project Manager  
**Tôi muốn** yêu cầu AI tóm tắt nội dung chat  
**Để** nhanh chóng nắm tiến độ, vấn đề và đầu việc còn lại.

**Acceptance criteria:**

- Người dùng có thể chọn tóm tắt 24 giờ, 7 ngày, toàn bộ conversation hoặc khoảng thời gian tùy chọn.
- AI trả về tối thiểu: nội dung chính, quyết định đã thống nhất, action items, người phụ trách được nhắc đến, deadline được đề cập và rủi ro/điểm cần xác nhận.
- Người dùng có thể chuyển action item AI đề xuất thành ticket hoặc task.
- AI không tự tạo ticket hoặc gửi thông tin ra khách hàng nếu chưa có rule automation được phê duyệt.

## 6.4. Trạng thái conversation

| Trạng thái | Mô tả |
|---|---|
| Active | Conversation đang hoạt động |
| Muted | Người dùng đã tắt thông báo đối với conversation |
| Archived | Conversation được lưu trữ, vẫn có thể xem lịch sử |
| Closed | Conversation đóng, không cho gửi tin nhắn mới |
| Reopened | Conversation được mở lại sau khi đã đóng |

## 6.5. Chức năng chi tiết

### A. Quản lý conversation

- Tạo, chỉnh sửa tên, mô tả, avatar.
- Thêm/xóa thành viên theo quyền.
- Chỉ định conversation owner.
- Ghim conversation quan trọng.
- Archive/close/reopen conversation.
- Khóa conversation để chỉ admin/manager được gửi tin.
- Ghim thông báo hoặc tài liệu quan trọng.
- Tạo tag cho conversation: Urgent, Client Escalation, Campaign Launch, Payment, Approval Needed và Internal Only.
- Liên kết conversation với Client Account, Contact, Project, Campaign, Contract, Ticket và Report.

### B. Soạn và xử lý tin nhắn

- Rich text cơ bản.
- Mentions.
- Quote/reply.
- Reaction.
- Edit tin nhắn trong khoảng thời gian cấu hình, ví dụ 15 phút.
- Delete soft-delete; nội dung phải được lưu audit log.
- Pin message.
- Bookmark message.
- Forward message.
- Copy permalink.
- Search toàn văn theo nội dung, sender, attachment và date range.
- Đánh dấu tin nhắn là quan trọng.
- Gắn nhãn nội bộ hoặc khách hàng.
- Dịch nội dung bằng AI nếu cần hỗ trợ khách hàng đa ngôn ngữ.

### C. File đính kèm

- Hỗ trợ PDF, DOCX, XLSX, PPTX, PNG, JPG, JPEG, MP4, MOV và ZIP.
- Dung lượng giới hạn cấu hình theo tenant, ví dụ 100 MB/file ở giai đoạn đầu.
- File cần có tên file, loại file, dung lượng, người tải lên, thời gian tải lên, liên kết đến conversation/message và version nếu được cập nhật.
- Người dùng có quyền tải file tùy theo conversation và data scope.
- Không được truy cập file bằng URL công khai nếu chưa được cấp token/quyền phù hợp.

### D. Chat khách hàng

- Client chỉ nhìn thấy các member agency được cấp quyền vào conversation.
- Client không nhìn thấy internal notes, conversation nội bộ, file internal, ticket nội bộ không công khai và bình luận nội bộ trong ticket.
- Account Manager có thể chuyển đổi nhanh giữa `Internal Note` và `Reply to Client`.
- Khi gửi nội dung ra client, UI phải hiển thị cảnh báo rõ: “Nội dung này sẽ được gửi cho khách hàng”.

## 6.6. Quy tắc nghiệp vụ

| Mã | Quy tắc |
|---|---|
| BR-CHAT-01 | Conversation loại Client/Project/Campaign phải có ít nhất một liên kết CRM hợp lệ |
| BR-CHAT-02 | Không được xóa cứng tin nhắn đã gửi; chỉ cho phép soft-delete và lưu audit |
| BR-CHAT-03 | Tin nhắn trong Client Chat không được chứa Internal Note |
| BR-CHAT-04 | Khi khách hàng gửi tin trong Client Chat, hệ thống có thể tự tạo notification cho Account Owner |
| BR-CHAT-05 | Nếu tin nhắn chứa từ khóa khẩn cấp như “gấp”, “sự cố”, “ngưng chạy”, “lỗi”, AI/rule engine có thể gợi ý tạo ticket ưu tiên cao |
| BR-CHAT-06 | Message được chuyển thành ticket phải giữ liên kết hai chiều giữa message và ticket |
| BR-CHAT-07 | Chỉ Conversation Owner, PM, Account hoặc Admin mới được đóng Client Chat |
| BR-CHAT-08 | File internal không được hiển thị hoặc tải xuống bởi user thuộc Client Account |

---

# 7. Module Ticket

## 7.1. Mục tiêu

Ticket là đơn vị quản lý yêu cầu chính thức trong Agency PTT. Mọi yêu cầu từ khách hàng, email, chat, form, AI Agent hoặc nội bộ có thể được chuyển thành ticket để phân công, theo dõi SLA, kiểm soát phạm vi công việc và lưu lịch sử xử lý.

## 7.2. Loại ticket

| Loại ticket | Ví dụ |
|---|---|
| Client Request | Khách hàng yêu cầu thiết kế banner, chỉnh landing page, viết bài |
| Incident | Website lỗi, form không đổ lead, quảng cáo ngừng chạy |
| Change Request | Thay đổi scope, đổi concept, sửa chức năng CRM |
| Content Request | Bài viết, caption, kịch bản video, nội dung SEO |
| Design Request | Banner, poster, profile, landing page, branding |
| Ads Optimization | Tối ưu Meta Ads, Google Ads, TikTok Ads |
| Data/CRM Request | Import lead, phân quyền, tạo automation, sửa pipeline |
| Technical Support | Lỗi web, API, hosting, tracking, pixel |
| Billing/Payment | Hóa đơn, công nợ, thanh toán ngân sách |
| Internal Task | Công việc nội bộ agency |
| Approval Request | Yêu cầu phê duyệt nội dung, chi phí, kế hoạch |
| Complaint | Khiếu nại, phản ánh chất lượng dịch vụ |

## 7.3. Trạng thái ticket

```text
Draft
→ New
→ Triaged
→ Assigned
→ In Progress
→ Waiting for Client
→ Waiting for Internal Approval
→ Resolved
→ Client Acceptance
→ Closed

Ngoại lệ:
On Hold
Cancelled
Rejected
Reopened
Escalated
```

## 7.4. Ý nghĩa trạng thái

| Trạng thái | Mô tả | SLA có chạy? |
|---|---|---|
| Draft | Ticket đang soạn, chưa gửi | Không |
| New | Ticket mới được tạo | Có |
| Triaged | Đã phân loại, đánh giá ưu tiên và scope | Có |
| Assigned | Đã giao người/nhóm xử lý | Có |
| In Progress | Đang thực hiện | Có |
| Waiting for Client | Chờ khách hàng phản hồi/cung cấp dữ liệu | Tạm dừng nếu policy cho phép |
| Waiting for Internal Approval | Chờ duyệt nội bộ | Tùy SLA policy |
| On Hold | Tạm hoãn có lý do | Tạm dừng nếu được phê duyệt |
| Resolved | Team xác nhận đã xử lý xong | Có, chờ khách hàng |
| Client Acceptance | Chờ khách hàng nghiệm thu | Tùy policy |
| Closed | Đã đóng chính thức | Không |
| Reopened | Khách hàng/team mở lại do chưa đạt | Có, theo SLA reopen |
| Cancelled | Hủy yêu cầu | Không |
| Rejected | Từ chối do ngoài scope/thiếu điều kiện | Không |
| Escalated | Ticket bị nâng cấp ưu tiên/quản lý xử lý | Có |

## 7.5. User stories

### US-TICKET-01: Tạo ticket

**Là** khách hàng hoặc nhân sự agency  
**Tôi muốn** tạo ticket từ form, chat, email hoặc màn hình ticket  
**Để** yêu cầu được ghi nhận và xử lý chính thức.

**Acceptance criteria:**

- Form tạo ticket tối thiểu gồm tiêu đề, mô tả, loại ticket, khách hàng, dự án/campaign nếu có, mức ưu tiên, người yêu cầu và file đính kèm.
- Hệ thống tự sinh mã ticket theo format cấu hình, ví dụ `PTT-2026-000123`.
- Ticket tạo từ chat/email phải lưu source reference.
- Hệ thống tự gán SLA theo Client tier, gói dịch vụ, loại ticket, priority và giờ làm việc.
- Hệ thống gửi thông báo cho người phụ trách hoặc nhóm tiếp nhận.
- Nếu chưa rõ assignee, ticket được đưa vào `Unassigned Queue`.

### US-TICKET-02: Phân loại và giao ticket

**Là** Project Manager  
**Tôi muốn** phân loại, thiết lập priority và giao ticket cho đúng người  
**Để** yêu cầu được giải quyết hiệu quả và đúng SLA.

**Acceptance criteria:**

- PM/Admin có thể chọn assignee, team assignee và watcher.
- Hệ thống gợi ý assignee dựa trên loại ticket, kỹ năng, khối lượng công việc hiện tại, dự án đang tham gia và lịch nghỉ/phép nếu có tích hợp HR.
- Hệ thống hiển thị SLA response deadline và resolution deadline.
- Khi thay đổi assignee, hệ thống lưu audit history.
- Người được giao nhận notification ngay lập tức.
- Ticket có thể được giao một người chính và nhiều collaborator.

### US-TICKET-03: Khách hàng theo dõi ticket

**Là** Client Contact  
**Tôi muốn** xem trạng thái và lịch sử ticket của mình  
**Để** biết yêu cầu đang được xử lý ra sao.

**Acceptance criteria:**

- Khách hàng xem được các ticket thuộc Client Account nếu có quyền.
- Client chỉ xem Public Comments, file công khai, trạng thái được phép hiển thị và deadline/ETA nếu agency bật tính năng này.
- Client không xem internal note, effort estimate nội bộ, phân công nội bộ hoặc chat nội bộ.
- Client có thể bổ sung thông tin, upload file, xác nhận nghiệm thu và yêu cầu mở lại ticket trong thời gian cấu hình.
- Khi ticket chuyển trạng thái, client nhận thông báo theo preference.

### US-TICKET-04: Đóng và nghiệm thu ticket

**Là** Account Manager  
**Tôi muốn** gửi kết quả ticket cho khách hàng xác nhận  
**Để** đảm bảo có bằng chứng nghiệm thu và đóng yêu cầu minh bạch.

**Acceptance criteria:**

- Khi chuyển ticket sang `Resolved`, người xử lý phải cung cấp resolution note.
- Resolution note có thể gồm nội dung đã thực hiện, link deliverable, file đính kèm, hướng dẫn sử dụng và ghi chú ảnh hưởng.
- Client có thể Accept/Approve, Request changes hoặc Reopen.
- Nếu khách hàng không phản hồi trong N ngày cấu hình, hệ thống có thể tự đóng theo policy, ví dụ 3 hoặc 7 ngày.
- Hệ thống ghi nhận người nghiệm thu, thời điểm nghiệm thu và ý kiến phản hồi.

## 7.6. Thuộc tính dữ liệu ticket

| Nhóm | Trường dữ liệu |
|---|---|
| Định danh | Ticket ID, mã ticket, tenant ID, external reference |
| Nội dung | Subject, description, category, sub-category, tags |
| Liên kết CRM | Client Account, Contact, Contract, Project, Campaign, Service Package |
| Nguồn tạo | Manual, Chat, Email, Form, API, AI Agent, Integration |
| Phân công | Owner, assignee, team, collaborators, watchers |
| Tiến độ | Status, priority, severity, progress percentage, ETA |
| SLA | Response due at, resolution due at, SLA policy, SLA status, breach reason |
| Thời gian | Created at, first response at, assigned at, resolved at, closed at |
| Scope | In scope/out of scope, estimated effort, actual effort, change request flag |
| Tài liệu | Attachments, deliverable links, related report, related email/message |
| Phê duyệt | Approval status, approver, approval date, approval comment |
| Audit | Created by, updated by, status history, assignment history, activity log |

## 7.7. Priority và Severity

| Priority | Ý nghĩa | Ví dụ | Mục tiêu phản hồi |
|---|---|---|---|
| P1 – Critical | Ảnh hưởng nghiêm trọng tới hoạt động kinh doanh | Website sập, quảng cáo dừng toàn bộ, mất lead | 30 phút–1 giờ |
| P2 – High | Ảnh hưởng lớn, cần xử lý sớm | Landing page lỗi form, chiến dịch tiêu tiền bất thường | 2–4 giờ |
| P3 – Medium | Yêu cầu vận hành thông thường | Sửa banner, cập nhật content, tối ưu ads | 1 ngày làm việc |
| P4 – Low | Yêu cầu không gấp, cải tiến hoặc tham khảo | Đề xuất tính năng, cập nhật nhỏ | 2–5 ngày làm việc |

> Thời gian SLA phải cấu hình theo từng hợp đồng/gói dịch vụ, không hard-code cố định.

## 7.8. SLA Management

### SLA Response Time

Là thời gian tối đa từ lúc ticket được tạo đến khi ticket nhận phản hồi đầu tiên có ý nghĩa từ agency.

Ví dụ phản hồi hợp lệ:

- Xác nhận đã tiếp nhận yêu cầu.
- Yêu cầu bổ sung thông tin.
- Thông báo đã phân công người xử lý.
- Cập nhật ETA sơ bộ.
- Thông báo ticket ngoài phạm vi dịch vụ.

### SLA Resolution Time

Là thời gian tối đa để xử lý hoặc cung cấp kết quả theo cam kết dịch vụ.

### Công thức SLA

\[
\text{Remaining SLA} = \text{SLA Due Time} - \text{Business Time Elapsed}
\]

Trong đó `Business Time Elapsed` chỉ tính trong khung giờ làm việc và loại trừ thời gian chờ khách hàng nếu policy cho phép pause SLA.

### SLA trạng thái

| SLA Status | Điều kiện |
|---|---|
| On Track | Còn đủ thời gian xử lý |
| At Risk | Đã sử dụng vượt ngưỡng cảnh báo, ví dụ 70% SLA |
| Near Breach | Đã sử dụng vượt ngưỡng nghiêm trọng, ví dụ 90% SLA |
| Breached | Quá hạn SLA |
| Paused | Đang chờ khách hàng hoặc on hold hợp lệ |
| Exempted | Ticket được miễn SLA bởi manager/admin |

### Escalation rule mẫu

| Điều kiện | Hành động |
|---|---|
| 70% SLA chưa có phản hồi | Nhắc assignee và Account Manager |
| 90% SLA chưa giải quyết | Nhắc PM, Team Lead và Account Manager |
| Vi phạm SLA | Tạo escalation event, thông báo Manager/Director |
| P1 quá 30 phút chưa assigned | Escalate tự động đến PM/On-call Manager |
| Ticket reopened quá 2 lần | Gắn cờ Quality Review |
| Client gửi complaint | Tạo cảnh báo cho Account Lead và Director |

## 7.9. Quy tắc phạm vi công việc

| Scope Status | Ý nghĩa |
|---|---|
| In Scope | Thuộc phạm vi hợp đồng/gói dịch vụ |
| Potentially Out of Scope | Cần Account/PM đánh giá |
| Out of Scope | Không thuộc phạm vi, cần báo giá hoặc change request |
| Included by Exception | Ngoại lệ được quản lý phê duyệt |
| Billable | Có phát sinh chi phí |
| Warranty | Thuộc thời gian bảo hành |

Khi ticket được đánh dấu `Out of Scope` hoặc `Billable`:

- Không được chuyển sang In Progress nếu chưa có phê duyệt phù hợp.
- Hệ thống yêu cầu nhập lý do.
- Có thể tạo báo giá/change request từ ticket.
- Client phải được thông báo bằng phản hồi chính thức.
- Nếu phát sinh chi phí, Finance/Account có thể được thêm vào watcher.

## 7.10. Bình luận ticket

Ticket phải hỗ trợ hai chế độ comment:

| Loại comment | Người thấy | Mục đích |
|---|---|---|
| Public Reply | Agency và client có quyền | Phản hồi, cập nhật, gửi kết quả cho khách hàng |
| Internal Note | Chỉ người dùng nội bộ agency | Trao đổi kỹ thuật, phân công, đánh giá scope, rủi ro |

Yêu cầu UI:

- Màu sắc hoặc nhãn phân biệt rõ hai loại comment.
- Trước khi gửi, hệ thống phải hiển thị rõ “Gửi cho khách hàng” hoặc “Ghi chú nội bộ”.
- Không cho phép chuyển Internal Note thành Public Reply mà không có thao tác xác nhận.
- File gắn với Internal Note mặc định là file nội bộ.

---

# 8. Module Email

## 8.1. Mục tiêu

Quản lý email trao đổi với khách hàng và nội bộ theo hướng CRM-centric: email không chỉ nằm trong hộp thư cá nhân mà phải được gắn với khách hàng, contact, dự án, campaign, ticket và báo cáo.

## 8.2. Nguồn email

| Nguồn | Mô tả |
|---|---|
| Shared Agency Mailbox | Ví dụ support@agencyptt.vn, hello@agencyptt.vn, report@agencyptt.vn |
| Personal Work Mailbox | Email công việc của Account, PM, Manager |
| Ticket Mailbox | Email tiếp nhận yêu cầu tự động tạo ticket |
| System Email | Email tự động từ CRM: thông báo ticket, báo cáo, approval |
| Integrated Email Provider | Microsoft 365, Google Workspace, SMTP/IMAP hoặc API provider |

## 8.3. User stories

### US-EMAIL-01: Gửi email từ CRM

**Là** Account Manager  
**Tôi muốn** gửi email trực tiếp từ trang khách hàng, ticket hoặc báo cáo  
**Để** lịch sử trao đổi được lưu tự động vào hồ sơ khách hàng.

**Acceptance criteria:**

- Người dùng có thể soạn email từ Client Account, Contact, Project, Campaign, Ticket hoặc Report.
- Hệ thống tự điền người nhận theo contact đã chọn.
- Hỗ trợ To, CC, BCC.
- Có subject, rich text body, attachment, template và signature.
- Email được gắn tự động vào entity context đang mở.
- Người gửi có thể chọn mailbox được ủy quyền nếu có quyền.
- Hệ thống lưu trạng thái sent/failed/bounced/opened/clicked nếu provider hỗ trợ.
- Nếu email gửi từ ticket, hệ thống tự thêm ticket reference vào email subject theo cấu hình.

### US-EMAIL-02: Nhận email và tạo ticket

**Là** Service Desk  
**Tôi muốn** email gửi đến support mailbox được phân loại và tạo ticket  
**Để** không bỏ sót yêu cầu khách hàng.

**Acceptance criteria:**

- Hệ thống đọc email đến từ mailbox tích hợp theo polling/webhook.
- Email được match với Contact/Client Account dựa trên email address.
- Nếu email có tiêu đề chứa ticket ID hợp lệ, hệ thống thêm email vào ticket hiện hữu.
- Nếu không match ticket, hệ thống tạo ticket mới theo rule.
- Hệ thống lưu email body, metadata, attachment và thread ID.
- Email auto-reply hoặc spam phải được nhận diện và không tự tạo ticket nếu policy quy định.
- Nếu không match được client, email vào `Unmatched Email Queue` để nhân sự xử lý.

### US-EMAIL-03: Email template và phê duyệt

**Là** Marketing Manager hoặc Account Manager  
**Tôi muốn** sử dụng template email và gửi email cần phê duyệt  
**Để** đảm bảo đúng nhận diện thương hiệu và giảm rủi ro gửi sai nội dung.

**Acceptance criteria:**

- Hệ thống hỗ trợ template theo nhóm: Welcome client, xác nhận tiếp nhận ticket, gửi báo cáo tuần/tháng, nhắc phê duyệt nội dung, nhắc thanh toán, thông báo quá hạn và xử lý complaint.
- Template hỗ trợ merge fields: `{{contact_name}}`, `{{client_name}}`, `{{ticket_code}}`, `{{project_name}}`, `{{report_period}}`, `{{account_manager_name}}`.
- Template có version, trạng thái draft/approved/archived.
- Một số template hoặc nhóm email có thể yêu cầu approval trước khi gửi.
- Email chứa từ khóa nhạy cảm như “báo giá”, “khiếu nại”, “cam kết”, “hoàn tiền” có thể được đưa vào approval queue.

## 8.4. Chức năng email

### A. Compose Email

- Soạn email mới.
- Reply, reply all, forward.
- Chọn sender mailbox.
- To, CC, BCC.
- Template.
- Signature.
- File đính kèm.
- Schedule send.
- Save draft.
- Send test email trong môi trường cấu hình.
- Request approval.
- Link entity: Client, Contact, Project, Campaign, Ticket, Report và Contract.

### B. Email inbox

- Danh sách email theo mailbox.
- Bộ lọc: Unread, Assigned to me, Client, Project, Ticket linked, Unmatched, Requires response, Overdue response, Has attachment.
- Gắn tag email.
- Assign email cho Account/PM.
- Chuyển email thành ticket.
- Merge email vào ticket đang có.
- Đánh dấu email là spam/ignore.
- Search full text.
- Hiển thị email thread.

### C. Đồng bộ CRM

- Match contact bằng email address.
- Một contact có thể có nhiều email address.
- Nếu chưa có contact: tạo contact mới ở trạng thái pending review hoặc đưa vào unmatched queue tùy cấu hình.
- Nếu domain email trùng với client nhưng contact chưa tồn tại: gợi ý gắn vào client đó, không tự động gán nếu policy yêu cầu xác thực.

### D. Email tracking

Nếu provider cho phép và khách hàng/chính sách pháp lý cho phép:

- Sent.
- Delivered.
- Bounced.
- Opened.
- Clicked.
- Attachment downloaded.
- Reply received.

Lưu ý: Email open tracking không tuyệt đối chính xác do các cơ chế bảo mật, proxy hình ảnh và privacy features của email client. Chức năng này chỉ nên được dùng như tín hiệu tham khảo, không dùng làm bằng chứng chắc chắn khách hàng đã đọc nội dung.

## 8.5. Quy tắc nghiệp vụ email

| Mã | Quy tắc |
|---|---|
| BR-EMAIL-01 | Email gửi từ CRM phải được lưu activity timeline của entity liên quan |
| BR-EMAIL-02 | Email inbound có ticket code phải được gắn vào ticket tương ứng nếu sender có quyền liên quan |
| BR-EMAIL-03 | Không tự động gửi email ra ngoài từ AI Agent nếu chưa có approval hoặc rule đã được cấu hình |
| BR-EMAIL-04 | Email từ external sender không được hiển thị Internal Note |
| BR-EMAIL-05 | Attachment phải tuân thủ chính sách file và phân quyền của tenant |
| BR-EMAIL-06 | Nếu gửi email thất bại, người gửi và owner entity phải nhận notification |
| BR-EMAIL-07 | BCC không được hiển thị cho người dùng không có quyền xem metadata nhạy cảm |
| BR-EMAIL-08 | Email đã gửi không được chỉnh sửa nội dung; chỉ có thể gửi follow-up hoặc recall nếu email provider hỗ trợ |
| BR-EMAIL-09 | Email inbound từ địa chỉ nằm trong blacklist/spam policy không tự tạo ticket |
| BR-EMAIL-10 | Các email liên quan đến complaint hoặc billing có thể bắt buộc gắn tag và escalation rule |

---

# 9. Module Báo cáo

## 9.1. Mục tiêu

Cho phép agency lập, tổng hợp, kiểm duyệt, gửi và lưu trữ báo cáo theo chuẩn; giảm phụ thuộc vào file thủ công, hạn chế sai số phiên bản và giúp khách hàng nắm rõ hiệu quả dịch vụ.

## 9.2. Các loại báo cáo

| Loại báo cáo | Nội dung chính | Chu kỳ đề xuất |
|---|---|---|
| Báo cáo Marketing tổng hợp | KPI đa kênh, kết quả, nhận định, đề xuất | Tuần/tháng |
| Báo cáo Ads | Spend, reach, impressions, CTR, CPL, CPA, ROAS, conversion | Tuần/tháng |
| Báo cáo SEO | Keyword ranking, traffic, backlinks, technical issues, content performance | Tháng |
| Báo cáo Content | Số lượng nội dung, hiệu quả, reach, engagement, kế hoạch tiếp theo | Tuần/tháng |
| Báo cáo Social Media | Follower, engagement, reach, post performance, sentiment | Tháng |
| Báo cáo Website/Landing Page | Traffic, conversion, form lead, page speed, errors | Tháng |
| Báo cáo CRM/Lead | Lead mới, pipeline, source, conversion, sales performance | Tuần/tháng |
| Báo cáo Project Progress | Tiến độ, deliverables, milestone, blocker, risk | Tuần |
| Báo cáo Ticket/SLA | Số lượng ticket, response time, resolution time, breach, reopen | Tuần/tháng |
| Báo cáo Ngân sách | Ad spend, budget pacing, chi phí dịch vụ, variance | Tuần/tháng |
| Báo cáo Executive | Tóm tắt điều hành, KPI, rủi ro, đề xuất chiến lược | Tháng/quý |

## 9.3. User stories

### US-REPORT-01: Tạo báo cáo từ template

**Là** Account Manager  
**Tôi muốn** tạo báo cáo theo template của dịch vụ/campaign  
**Để** giảm thời gian tổng hợp và đảm bảo định dạng nhất quán.

**Acceptance criteria:**

- Người dùng chọn Client, Project/Campaign, loại report, kỳ báo cáo và Template.
- Hệ thống tự tải dữ liệu theo nguồn tích hợp hoặc dữ liệu nội bộ.
- Người dùng có thể chỉnh sửa phần narrative, nhận định và đề xuất.
- Báo cáo có thể thêm biểu đồ, bảng KPI, ảnh, file đính kèm và link dashboard.
- Hệ thống lưu report dạng draft.
- Báo cáo sinh ra có version ban đầu là `v1.0`.

### US-REPORT-02: Phê duyệt báo cáo

**Là** Marketing Manager hoặc Director  
**Tôi muốn** duyệt báo cáo trước khi gửi khách hàng  
**Để** đảm bảo số liệu, nhận định và cam kết được kiểm soát.

**Acceptance criteria:**

- Report có workflow: Draft, In Review, Changes Requested, Approved, Scheduled, Sent và Archived.
- Người phê duyệt có thể Approve, Reject, Request changes và Add comment.
- Báo cáo chỉ được gửi cho khách hàng khi trạng thái `Approved`, trừ khi user có quyền bypass approval.
- Mỗi lần thay đổi sau approval phải tạo version mới hoặc đưa report trở lại review theo policy.
- Lịch sử review phải lưu người duyệt, thời gian, comment và phiên bản.

### US-REPORT-03: Gửi báo cáo

**Là** Account Manager  
**Tôi muốn** gửi báo cáo qua email, client portal hoặc chat  
**Để** khách hàng nhận được báo cáo đúng kỳ hạn.

**Acceptance criteria:**

- Người dùng có thể chọn một hoặc nhiều kênh gửi: Email, Client Portal, Client Chat hoặc Link share có hạn sử dụng.
- Có thể chọn người nhận To/CC/BCC.
- Có thể gửi PDF, link dashboard, file Excel và bản tóm tắt trong body email.
- Hệ thống lưu log gửi gồm người gửi, người nhận, thời điểm, kênh gửi, version report và kết quả gửi.
- Nếu gửi qua email thất bại, report không được đánh dấu `Sent` thành công.
- Khi khách hàng xem/tải/xác nhận báo cáo trên portal, hệ thống lưu event nếu tính năng tracking được bật.

### US-REPORT-04: Lập lịch báo cáo định kỳ

**Là** Agency Admin  
**Tôi muốn** cấu hình lịch tạo và gửi báo cáo tự động  
**Để** không bỏ sót báo cáo theo hợp đồng.

**Acceptance criteria:**

- Hỗ trợ recurrence: hàng tuần, hàng tháng, hàng quý và ngày tùy chỉnh.
- Có thể cấu hình thời điểm tạo draft, người chuẩn bị, người duyệt, ngày gửi dự kiến, danh sách người nhận, template và kênh gửi.
- Hệ thống tạo notification trước deadline.
- Nếu report chưa approved trước thời điểm gửi, hệ thống không tự gửi ra ngoài trừ khi có rule bypass.
- Hệ thống tạo alert cho Account/Manager khi report bị quá hạn.

## 9.4. Trạng thái báo cáo

| Trạng thái | Mô tả |
|---|---|
| Draft | Đang soạn |
| Data Pending | Chờ dữ liệu từ nguồn tích hợp hoặc người phụ trách |
| In Review | Đang chờ phê duyệt |
| Changes Requested | Bị yêu cầu chỉnh sửa |
| Approved | Được duyệt để gửi |
| Scheduled | Đã lên lịch gửi |
| Sent | Đã gửi thành công |
| Viewed | Khách hàng đã xem trên portal/link nếu theo dõi được |
| Acknowledged | Khách hàng đã xác nhận tiếp nhận |
| Archived | Lưu trữ |
| Cancelled | Hủy báo cáo |

## 9.5. Cấu trúc báo cáo chuẩn

Một báo cáo marketing tiêu chuẩn nên gồm:

1. **Thông tin kỳ báo cáo:** tên khách hàng, dự án/campaign, thời gian báo cáo, người lập, người duyệt và phiên bản.
2. **Tóm tắt điều hành:** kết quả nổi bật, KPI đạt/chưa đạt, vấn đề cần lưu ý, hành động ưu tiên kỳ tiếp theo.
3. **KPI và hiệu quả:** bảng chỉ số chính, so sánh kỳ trước, target, biến động tăng/giảm và ghi chú nguyên nhân.
4. **Hiệu quả theo kênh:** Meta Ads, Google Ads, TikTok Ads, SEO, Social, Website, CRM/Lead, Email marketing và các kênh khác.
5. **Hoạt động đã thực hiện:** nội dung triển khai, tối ưu quảng cáo, thiết kế, kỹ thuật website, automation CRM, các ticket quan trọng đã hoàn tất.
6. **Vấn đề, rủi ro và blocker:** thiếu dữ liệu, chờ khách hàng phê duyệt, hạn chế tracking, ngân sách chưa đủ, rủi ro tài khoản quảng cáo, chất lượng lead cần cải thiện.
7. **Đề xuất và kế hoạch kỳ sau:** hành động đề xuất, KPI, ngân sách, nội dung cần khách hàng phê duyệt, đầu việc cần client cung cấp.
8. **Phụ lục:** bảng dữ liệu chi tiết, screenshot dashboard, danh sách content, danh sách ticket và file đính kèm.

## 9.6. Dữ liệu KPI

| Nhóm | Ví dụ chỉ số |
|---|---|
| Ads | Spend, CPM, CPC, CTR, CPL, CPA, conversion, ROAS |
| Website | Users, sessions, conversion rate, form submission, bounce rate |
| SEO | Organic traffic, keyword ranking, indexed pages, backlinks |
| Social | Reach, engagement, followers, video views, engagement rate |
| CRM | New leads, qualified leads, opportunity, win rate, revenue |
| Service | Ticket volume, first response time, resolution time, SLA compliance |
| Project | Milestone completion, task completion, overdue task, blocker count |
| Finance | Budget planned, actual spend, variance, outstanding amount |

## 9.7. Versioning report

- Report phải có version theo cấu trúc: `v1.0` cho bản nháp đầu tiên, `v1.1` cho chỉnh sửa nhỏ và `v2.0` cho thay đổi đáng kể sau review hoặc sau khi đã gửi.
- Mỗi version lưu người tạo, thời điểm, lý do thay đổi, changelog và trạng thái approval.
- Report đã gửi không được ghi đè trực tiếp.
- Nếu cần sửa sau khi gửi, tạo version mới, gửi lại với ghi chú “Revised Report” và giữ lịch sử version cũ để audit.

---

# 10. Luồng liên thông Chat, Email, Ticket và Report

## 10.1. Luồng yêu cầu từ khách hàng

```text
Khách hàng gửi Chat / Email / Form
        ↓
Hệ thống nhận diện Client + Contact
        ↓
AI hoặc Rule Engine phân loại sơ bộ
        ↓
Tạo Ticket hoặc đưa vào hàng chờ triage
        ↓
PM/Account xác nhận priority, scope, SLA, assignee
        ↓
Team xử lý và cập nhật ticket
        ↓
Gửi phản hồi qua Ticket / Email / Client Chat
        ↓
Khách hàng nghiệm thu
        ↓
Ticket Closed
        ↓
Dữ liệu xuất hiện trong Report kỳ tiếp theo
```

## 10.2. Luồng báo cáo định kỳ

```text
Scheduler đến kỳ báo cáo
        ↓
Tạo Report Draft từ template
        ↓
Lấy dữ liệu KPI từ integrations / CRM / Ticket / Project
        ↓
Account bổ sung nhận định và đề xuất
        ↓
Manager/Director Review
        ↓
Approved
        ↓
Gửi Email / Client Portal / Client Chat
        ↓
Lưu lịch sử gửi và phản hồi khách hàng
```

## 10.3. Luồng email thành ticket

```text
Email đến support@agencyptt.vn
        ↓
Match sender với Contact / Client Account
        ↓
Kiểm tra ticket code trong subject/thread
        ↓
Có ticket code? ── Có → Append vào ticket hiện hữu
        ↓ Không
Tạo ticket mới
        ↓
Áp SLA + phân loại + gán queue
        ↓
Thông báo Account/PM/Team
```

## 10.4. Luồng ticket thành báo cáo

- Ticket hoàn thành trong kỳ được tổng hợp vào mục “Hoạt động đã thực hiện”.
- Ticket quá hạn được tổng hợp vào mục “Vấn đề, rủi ro và blocker”.
- SLA compliance theo client/project xuất hiện trong báo cáo vận hành.
- Các ticket có tag `Client Approval Required` có thể xuất hiện trong “Các hạng mục chờ khách hàng”.
- Ticket `Out of Scope` được tổng hợp để Account đánh giá cơ hội upsell hoặc phát sinh change request.

---

# 11. AI Agent Requirements

## 11.1. Vai trò AI Agent

AI Agent là trợ lý vận hành, không phải người ra quyết định cuối cùng trong giai đoạn đầu.

| Tính năng AI | Mô tả |
|---|---|
| Chat Summary | Tóm tắt chat theo khoảng thời gian |
| Ticket Classification | Đề xuất loại, priority, team xử lý và tag |
| Ticket Drafting | Tạo ticket nháp từ chat/email |
| Email Drafting | Soạn email trả lời dựa trên ngữ cảnh CRM/ticket |
| Report Drafting | Sinh bản nháp executive summary, insight và next actions |
| SLA Risk Detection | Cảnh báo ticket có nguy cơ trễ hạn |
| Sentiment Detection | Phát hiện email/chat có tín hiệu khiếu nại, thất vọng hoặc khẩn cấp |
| Knowledge Retrieval | Tìm SOP, FAQ, hợp đồng, scope dịch vụ và case study liên quan |
| Action Extraction | Tách đầu việc, người phụ trách, deadline từ conversation |
| Data Anomaly Insight | Phát hiện biến động KPI bất thường trong báo cáo |

## 11.2. Quy tắc an toàn AI

- AI chỉ được tạo `draft`, `suggestion` hoặc `recommendation` theo mặc định.
- AI không được tự gửi email/chat cho khách hàng nếu chưa có người dùng duyệt hoặc automation rule đã được Admin cấu hình, có audit và giới hạn scope rõ ràng.
- AI không được truy cập dữ liệu ngoài permission scope của người dùng đang yêu cầu.
- Khi AI dùng dữ liệu CRM/ticket/report, UI phải hiển thị nguồn ngữ cảnh đã được sử dụng nếu khả thi.
- Người dùng có thể chọn không đưa dữ liệu nhạy cảm vào AI.
- Mọi hành động do AI kích hoạt phải có `AI Activity Log`.
- AI-generated content phải có nhãn “AI Draft” trước khi được người dùng gửi/chốt.
- Với các nhận định về marketing performance, AI phải phân biệt dữ liệu thực tế, suy luận, khuyến nghị và dữ liệu còn thiếu.

## 11.3. AI prompt context đề xuất

```text
- Client profile
- Contact role
- Project / Campaign information
- Contract scope and service package
- Ticket history
- Relevant chat/email thread
- Latest reports
- Existing SLA and priority
- Approved knowledge base articles
- Brand tone of voice
```

Không đưa vào context:

- Dữ liệu khách hàng không liên quan.
- Internal notes ngoài permission scope.
- Credentials, API key, password.
- Dữ liệu tài chính nhạy cảm nếu không có quyền.
- Thông tin cá nhân không cần thiết.

---

# 12. Notification Requirements

## 12.1. Kênh thông báo

- In-app notification.
- Email notification.
- Push notification trên mobile nếu có app.
- Chat notification.
- Slack/Microsoft Teams/Zalo OA khi có tích hợp.
- Webhook cho hệ thống bên thứ ba.

## 12.2. Ma trận notification

| Sự kiện | Người nhận | Kênh ưu tiên |
|---|---|---|
| Có chat mới được mention | Người được mention | In-app, push |
| Client gửi chat mới | Account Owner, PM | In-app, email tùy cấu hình |
| Ticket mới | Queue owner, Account, PM | In-app, email |
| Ticket được assign | Assignee, collaborators | In-app, push |
| SLA at risk | Assignee, PM | In-app, email |
| SLA breached | PM, Manager, Account | In-app, email, escalation channel |
| Client comment trên ticket | Assignee, Account, PM | In-app, email |
| Report chờ duyệt | Approver | In-app, email |
| Report bị yêu cầu chỉnh sửa | Report owner | In-app, email |
| Report đã gửi thành công | Report owner, Account | In-app |
| Email inbound chưa match | Email queue owner | In-app |
| Email gửi thất bại | Sender, entity owner | In-app, email |
| AI phát hiện sentiment tiêu cực | Account, PM, Manager | In-app, escalation rule |

## 12.3. Nguyên tắc chống spam

- Gộp thông báo cùng loại trong một khoảng thời gian, ví dụ 5–15 phút.
- Người dùng có preference riêng theo từng loại notification.
- Với P1/Critical, không được gộp hoặc trì hoãn cảnh báo.
- Conversation muted chỉ tắt thông báo chat thông thường, không tắt escalation P1 hoặc compliance alert.
- Hệ thống cần có daily digest cho các ticket, report hoặc email đang chờ xử lý.

---

# 13. Dashboard và Báo cáo vận hành

## 13.1. Dashboard cho Account Manager

- Danh sách client được phụ trách.
- Chat chưa đọc từ khách hàng.
- Ticket mới/chưa assigned.
- Ticket gần quá SLA.
- Ticket chờ phản hồi khách hàng.
- Báo cáo sắp đến hạn.
- Email chưa trả lời.
- Client health score.
- Các yêu cầu ngoài scope.
- Các approval đang chờ.

## 13.2. Dashboard cho Project Manager

- Ticket theo trạng thái Kanban.
- Ticket theo assignee/team.
- Workload từng thành viên.
- Ticket quá hạn và có nguy cơ trễ.
- Tiến độ project/campaign.
- Blocker.
- Ticket reopened.
- SLA compliance theo team.
- Report status theo project.

## 13.3. Dashboard cho Director/Agency Admin

- Tổng số ticket theo khách hàng, dịch vụ, phòng ban.
- SLA compliance rate.
- First response time trung bình.
- Resolution time trung bình.
- Ticket breach theo client/team.
- Tỷ lệ reopen.
- Tỷ lệ yêu cầu ngoài scope.
- Khối lượng request theo tháng.
- Báo cáo đã gửi/quá hạn.
- Client satisfaction score nếu có khảo sát.
- Ticket complaint/escalation.
- Doanh thu/cơ hội upsell phát sinh từ ticket ngoài scope.

## 13.4. Dashboard cho Client

- Ticket đang mở.
- Ticket chờ phản hồi.
- Ticket đã hoàn tất.
- Báo cáo mới nhất.
- Báo cáo theo lịch sử.
- Các hạng mục cần phê duyệt.
- Tiến độ dự án/campaign.
- Tài liệu và file bàn giao.
- Lịch sử trao đổi với agency.

---

# 14. Yêu cầu dữ liệu

## 14.1. Entity chính

| Entity | Mô tả |
|---|---|
| User | Người dùng agency, client, partner, AI Agent |
| Organization/Tenant | Đơn vị sử dụng hệ thống |
| ClientAccount | Hồ sơ doanh nghiệp khách hàng |
| Contact | Cá nhân liên hệ |
| Project | Dự án |
| Campaign | Chiến dịch |
| Conversation | Luồng chat |
| Message | Tin nhắn |
| Attachment | Tệp đính kèm |
| Ticket | Yêu cầu dịch vụ |
| TicketComment | Bình luận ticket |
| TicketActivity | Lịch sử thay đổi ticket |
| SLAConfiguration | Cấu hình SLA |
| EmailMessage | Email gửi/nhận |
| EmailThread | Chuỗi email |
| Report | Báo cáo |
| ReportVersion | Phiên bản báo cáo |
| ReportSchedule | Lịch báo cáo |
| ApprovalRequest | Yêu cầu phê duyệt |
| Notification | Thông báo |
| AuditLog | Nhật ký hệ thống |
| AIInteraction | Lịch sử yêu cầu và phản hồi AI |
| KnowledgeDocument | SOP, FAQ, guideline, hợp đồng, tài liệu tri thức |

## 14.2. Các trường audit tối thiểu

Mọi entity nghiệp vụ quan trọng cần có:

```text
id
tenant_id
created_at
created_by
updated_at
updated_by
deleted_at
deleted_by
is_deleted
version
```

Các entity nhạy cảm như Ticket, Report, Email, Approval cần thêm:

```text
status_changed_at
status_changed_by
last_activity_at
source_type
source_reference_id
visibility_scope
```

---

# 15. Yêu cầu phi chức năng

## 15.1. Hiệu năng

| Hạng mục | Mục tiêu |
|---|---|
| Tải danh sách ticket phổ biến | P95 dưới 2 giây |
| Mở chi tiết ticket | P95 dưới 2 giây |
| Gửi chat realtime | P95 dưới 3 giây |
| Search chat/email/ticket cơ bản | P95 dưới 3 giây |
| Tạo ticket | P95 dưới 2 giây, không bao gồm upload file lớn |
| Gửi email | Hệ thống phản hồi trạng thái queued/sent trong dưới 5 giây |
| Tạo report từ template | Dưới 10 giây với dữ liệu thông thường |
| Xuất PDF report | Dưới 60 giây với report tiêu chuẩn |
| Notification SLA P1 | Phát trong dưới 1 phút kể từ khi đạt điều kiện |

## 15.2. Khả năng mở rộng

- Hỗ trợ kiến trúc multi-tenant.
- Có khả năng scale độc lập các thành phần: Realtime chat service, email worker, notification worker, report generation worker, AI processing queue, search indexing và file storage.
- Tác vụ nặng cần chạy bất đồng bộ qua queue: upload/scan file, đồng bộ email, sinh PDF, gửi email hàng loạt, tạo báo cáo định kỳ, AI summary lớn và index search.

## 15.3. Bảo mật

- Xác thực qua email/password, SSO hoặc OAuth tùy giai đoạn.
- Hỗ trợ MFA cho Admin, Agency Manager và tài khoản có quyền nhạy cảm.
- RBAC kết hợp với data scope theo tenant/client/project.
- Mã hóa dữ liệu khi truyền tải bằng TLS.
- Mã hóa dữ liệu nhạy cảm khi lưu trữ nếu cần.
- URL file phải có signed access token hoặc authorization check.
- Chống truy cập chéo tenant.
- Audit log không cho phép user thông thường chỉnh sửa/xóa.
- Rate limit API và chống spam chat/email.
- Quét file upload chống malware nếu có hạ tầng hỗ trợ.
- Mask dữ liệu nhạy cảm trong log hệ thống.
- Không lưu API key hoặc mật khẩu email ở dạng plain text.

## 15.4. Sao lưu và khôi phục

- Backup database định kỳ hằng ngày.
- Backup file metadata và file storage theo policy.
- Có retention policy riêng cho chat, email, ticket, report, audit log và AI interaction.
- Định nghĩa RPO/RTO theo gói triển khai; ví dụ RPO mục tiêu 24 giờ và RTO mục tiêu 4–8 giờ cho giai đoạn đầu.
- Hỗ trợ soft delete và khôi phục dữ liệu trong thời gian retention.

## 15.5. Khả dụng và độ tin cậy

- Mục tiêu uptime ứng dụng: 99.5% cho giai đoạn production đầu tiên.
- Các tác vụ gửi email, notification, report phải có retry policy.
- Retry cần idempotency để tránh gửi trùng email hoặc tạo trùng ticket.
- Nếu service AI lỗi, các module chat/ticket/email/report cốt lõi vẫn phải hoạt động.
- Nếu email provider lỗi, email phải được đặt vào retry queue và hiển thị trạng thái rõ ràng.

---

# 16. API Requirements

## 16.1. API conventions

- API theo REST hoặc GraphQL tùy kiến trúc frontend.
- Version endpoint, ví dụ `/api/v1/...`.
- Authentication bằng JWT/OAuth2/session token.
- Tenant context bắt buộc trong token hoặc request context.
- Dùng cursor pagination cho danh sách lớn.
- API ghi dữ liệu cần idempotency key nếu có khả năng retry từ client.
- Mọi endpoint phải kiểm tra authentication, role, tenant scope, entity relationship và data visibility.

## 16.2. Endpoint nhóm Chat

```text
POST   /api/v1/conversations
GET    /api/v1/conversations
GET    /api/v1/conversations/{conversationId}
PATCH  /api/v1/conversations/{conversationId}
POST   /api/v1/conversations/{conversationId}/members
DELETE /api/v1/conversations/{conversationId}/members/{userId}

POST   /api/v1/conversations/{conversationId}/messages
GET    /api/v1/conversations/{conversationId}/messages
PATCH  /api/v1/messages/{messageId}
DELETE /api/v1/messages/{messageId}

POST   /api/v1/messages/{messageId}/create-ticket
POST   /api/v1/conversations/{conversationId}/ai-summary
POST   /api/v1/conversations/{conversationId}/archive
POST   /api/v1/conversations/{conversationId}/close
```

## 16.3. Endpoint nhóm Ticket

```text
POST   /api/v1/tickets
GET    /api/v1/tickets
GET    /api/v1/tickets/{ticketId}
PATCH  /api/v1/tickets/{ticketId}

POST   /api/v1/tickets/{ticketId}/assign
POST   /api/v1/tickets/{ticketId}/status
POST   /api/v1/tickets/{ticketId}/comments
POST   /api/v1/tickets/{ticketId}/attachments
POST   /api/v1/tickets/{ticketId}/watchers
POST   /api/v1/tickets/{ticketId}/escalate
POST   /api/v1/tickets/{ticketId}/resolve
POST   /api/v1/tickets/{ticketId}/accept
POST   /api/v1/tickets/{ticketId}/reopen
POST   /api/v1/tickets/{ticketId}/close

GET    /api/v1/tickets/{ticketId}/activities
GET    /api/v1/tickets/{ticketId}/sla
POST   /api/v1/tickets/{ticketId}/ai-classify
POST   /api/v1/tickets/{ticketId}/ai-draft-reply
```

## 16.4. Endpoint nhóm Email

```text
POST   /api/v1/emails/drafts
GET    /api/v1/emails
GET    /api/v1/emails/{emailId}
PATCH  /api/v1/emails/drafts/{emailId}
POST   /api/v1/emails/{emailId}/send
POST   /api/v1/emails/{emailId}/schedule
POST   /api/v1/emails/{emailId}/request-approval
POST   /api/v1/emails/{emailId}/link-entity
POST   /api/v1/emails/{emailId}/create-ticket
POST   /api/v1/emails/{emailId}/assign

GET    /api/v1/email-templates
POST   /api/v1/email-templates
PATCH  /api/v1/email-templates/{templateId}

POST   /api/v1/integrations/email/webhook
POST   /api/v1/email-sync/run
```

## 16.5. Endpoint nhóm Reports

```text
POST   /api/v1/reports
GET    /api/v1/reports
GET    /api/v1/reports/{reportId}
PATCH  /api/v1/reports/{reportId}

POST   /api/v1/reports/{reportId}/generate-data
POST   /api/v1/reports/{reportId}/generate-ai-draft
POST   /api/v1/reports/{reportId}/submit-review
POST   /api/v1/reports/{reportId}/approve
POST   /api/v1/reports/{reportId}/request-changes
POST   /api/v1/reports/{reportId}/export/pdf
POST   /api/v1/reports/{reportId}/send
POST   /api/v1/reports/{reportId}/create-version

GET    /api/v1/report-templates
POST   /api/v1/report-templates
GET    /api/v1/report-schedules
POST   /api/v1/report-schedules
PATCH  /api/v1/report-schedules/{scheduleId}
```

---

# 17. UI/UX Requirements

## 17.1. Nguyên tắc thiết kế

- Ưu tiên dashboard vận hành nhanh, ít thao tác.
- Luôn hiển thị context khách hàng/dự án/campaign khi người dùng đang chat, xử lý email hoặc ticket.
- Phân biệt rõ nội dung nội bộ và nội dung hiển thị khách hàng.
- Ưu tiên responsive desktop-first, sau đó mobile.
- Hỗ trợ dark mode nếu cần cho người dùng vận hành nhiều giờ.
- Dùng màu sắc nhất quán: đỏ cho Critical/SLA Breach; cam cho At Risk/High; xanh dương cho In Progress; xanh lá cho Resolved/Approved; xám cho Closed/Archived; tím hoặc vàng nhạt cho AI suggestion/approval pending.

## 17.2. Ticket detail page

Layout đề xuất 3 cột:

| Khu vực | Nội dung |
|---|---|
| Cột trái | Thông tin ticket, status, priority, assignee, SLA, tags, client/project/campaign |
| Cột giữa | Conversation timeline: public reply, internal note, attachment, activity |
| Cột phải | Client profile, ticket liên quan, report liên quan, email liên quan, AI suggestions |

## 17.3. Chat page

- Sidebar trái: Direct messages, Internal groups, Client chats, Project/Campaign chats và Pinned conversations.
- Khu vực giữa: Message timeline và composer hỗ trợ reply/mention/attachment.
- Panel phải: Conversation info, members, linked client/project/campaign, pinned files, related tickets, AI summary và action items.

## 17.4. Report builder

- Header: client, project, reporting period, template, version và status.
- Sidebar: danh sách section.
- Main editor: bảng, chart, narrative, attachment.
- Right panel: data source, KPI mapping, comments, approval và AI insight.
- Action buttons: Save draft, Generate data, Generate AI draft, Preview, Submit for review, Export PDF và Send.

---

# 18. Audit Log Requirements

## 18.1. Sự kiện cần lưu

- Tạo/sửa/xóa/khôi phục conversation.
- Thêm/xóa member conversation.
- Gửi/sửa/xóa message.
- Tạo ticket từ message/email.
- Tạo/sửa/assign/status change ticket.
- Thay đổi priority, SLA, scope status, due date.
- Tạo public reply hoặc internal note.
- Gửi/nhận/link email.
- Tạo/sửa/approve/send report.
- Export report.
- Thay đổi permission/role.
- AI tạo suggestion, AI tạo nháp, AI action được user duyệt.
- Tải file hoặc chia sẻ file nhạy cảm.
- Đăng nhập thất bại, thay đổi bảo mật, export dữ liệu.

## 18.2. Nội dung audit log

```text
audit_id
tenant_id
actor_type          // User, System, AI Agent, API
actor_id
action
entity_type
entity_id
before_data
after_data
metadata
ip_address
user_agent
created_at
```

---

# 19. Acceptance Test Scenarios

## 19.1. Chat → Ticket

**Given:** Khách hàng gửi tin trong Client Chat: “Banner khai trương cần đổi giá và chạy trước 10h sáng mai.”  
**When:** Account Manager chọn “Create Ticket from Message”.  
**Then:**

- Hệ thống tạo ticket mới.
- Ticket liên kết đúng khách hàng, dự án/campaign.
- Nội dung message được đưa vào mô tả ticket.
- Account có thể chọn P2/P1 tùy đánh giá.
- Ticket áp SLA theo client/service package.
- Ticket được giao cho Design Team hoặc PM triage.
- Message gốc hiển thị ticket link.

## 19.2. Email → Ticket

**Given:** Khách hàng gửi email vào `support@agencyptt.vn` với subject “Form đăng ký không nhận lead”.  
**When:** Email được đồng bộ vào hệ thống.  
**Then:**

- Hệ thống nhận diện client/contact từ sender email.
- Tạo ticket Incident hoặc Technical Support theo rule.
- Gắn priority mặc định P2 nếu rule cấu hình.
- Gán team Technical/Website.
- Tạo SLA response/resolution deadline.
- Gửi notification cho Account và PM.
- Email được liên kết vào ticket dưới dạng activity.

## 19.3. Ticket public/internal comment

**Given:** Developer cần trao đổi với PM về nguyên nhân lỗi tracking.  
**When:** Developer gửi Internal Note trong ticket.  
**Then:**

- Client không nhìn thấy nội dung note.
- Client không nhận notification.
- Note hiển thị nhãn “Internal”.
- Audit log ghi nhận người gửi và thời điểm.
- Nếu developer đổi sang Public Reply, UI yêu cầu xác nhận trước khi gửi.

## 19.4. Report approval

**Given:** Account đã hoàn tất báo cáo tháng.  
**When:** Account submit report for review.  
**Then:**

- Report chuyển sang `In Review`.
- Manager nhận notification.
- Manager có thể request changes.
- Sau khi manager approve, report chuyển `Approved`.
- Account có thể gửi report qua email/client portal.
- Report đã gửi được lưu version và send log.

## 19.5. SLA escalation

**Given:** Ticket P2 có SLA resolution 8 giờ làm việc.  
**When:** Ticket đã sử dụng 90% thời gian SLA nhưng chưa resolved.  
**Then:**

- Ticket có trạng thái SLA `Near Breach`.
- Hệ thống thông báo Assignee, PM và Account.
- Ticket được hiển thị nổi bật trong dashboard.
- Nếu quá hạn, hệ thống gắn `Breached`, tạo escalation event và thông báo Manager.

---

# 20. MVP đề xuất

## 20.1. Giai đoạn MVP

### Module Chat MVP

- Direct Message, Group Chat, Client Chat, Project Chat.
- Text, reply, mention, attachment.
- Search cơ bản.
- Chat → Ticket.
- Notification in-app.
- Phân biệt internal/client conversation.
- Liên kết conversation với client/project/ticket.

### Module Ticket MVP

- Tạo ticket manual/chat/email.
- Loại ticket, priority, status, assignee, watcher.
- Public reply và internal note.
- SLA response/resolution cơ bản.
- Ticket board Kanban.
- Ticket activity log.
- Attachment.
- Client portal xem ticket.
- Dashboard ticket cơ bản.

### Module Email MVP

- Gửi email từ CRM/ticket/report.
- Email template.
- Shared mailbox inbound.
- Email → Ticket.
- Email thread.
- Match Contact/Client cơ bản.
- Trạng thái sent/failed.
- Lưu email vào activity timeline.

### Module Report MVP

- Report template.
- Tạo report thủ công có cấu trúc.
- Draft/review/approved/sent.
- Xuất PDF.
- Gửi qua email.
- Lịch báo cáo thủ công hoặc scheduler đơn giản.
- Versioning cơ bản.
- Báo cáo ticket/SLA và project progress.

## 20.2. Giai đoạn 2

- Đồng bộ Google Workspace/Microsoft 365 hai chiều nâng cao.
- Omnichannel Zalo OA, Messenger, WhatsApp, Instagram.
- AI Summary, AI Ticket Classification, AI Email Draft.
- Report tự động lấy dữ liệu Ads/GA4/Search Console.
- Approval workflow nâng cao.
- Customer satisfaction survey.
- Advanced workload balancing.
- SLA calendar theo ngày nghỉ, giờ làm và contract.
- Client health score.
- Knowledge base + RAG cho AI Agent.
- Mobile app/push notification.

## 20.3. Giai đoạn 3

- AI Agent đa tác vụ có supervisor.
- Tự động đề xuất hoặc tạo draft campaign report.
- Voice-to-ticket và meeting-to-ticket.
- Predictive SLA breach.
- Sentiment analysis chuyên sâu.
- Upsell opportunity detection từ ticket và email.
- Service profitability analysis theo client/service/team.
- Workflow automation no-code.
- Integrations marketplace.

---

# 21. KPI đánh giá thành công

| KPI | Mục tiêu đề xuất |
|---|---|
| Tỷ lệ yêu cầu được ghi nhận thành ticket | Trên 90% |
| Tỷ lệ phản hồi ticket đúng SLA | Trên 95% |
| Tỷ lệ giải quyết đúng SLA | Trên 90% |
| Tỷ lệ báo cáo gửi đúng hạn | Trên 95% |
| Giảm yêu cầu bị bỏ sót qua chat/email | Giảm ít nhất 70% |
| Thời gian tạo báo cáo | Giảm 40–60% sau tự động hóa |
| Tỷ lệ email được liên kết đúng client/project | Trên 90% |
| Tỷ lệ ticket reopened | Dưới 10–15%, tùy loại dịch vụ |
| Thời gian phản hồi đầu tiên trung bình | Theo SLA từng gói |
| Mức hài lòng khách hàng | Thiết lập CSAT mục tiêu từ 4/5 trở lên |
| Tỷ lệ AI draft được người dùng chấp nhận sau chỉnh sửa nhẹ | Theo dõi để tối ưu prompt/knowledge base |

---

# 22. Đề xuất kiến trúc kỹ thuật

## 22.1. Thành phần hệ thống

```text
Web App / Client Portal / Mobile App
                ↓
API Gateway / BFF
                ↓
Core CRM Application
├── Chat Service
├── Ticket Service
├── Email Service
├── Report Service
├── Notification Service
├── File Service
├── Approval Service
├── Search Service
├── AI Orchestration Service
└── Integration Service
                ↓
Data Layer
├── PostgreSQL
├── Redis
├── Object Storage (S3-compatible / MinIO)
├── Search Engine (OpenSearch / Elasticsearch)
├── Queue (RabbitMQ / Kafka / Redis Streams)
└── Vector DB / pgvector cho AI Knowledge Base
```

## 22.2. Định hướng Clean Architecture

```text
Domain
├── Entities
├── Value Objects
├── Domain Events
├── Repository Interfaces
└── Business Rules

Application
├── Use Cases
├── Commands
├── Queries
├── DTOs
├── Validators
└── Event Handlers

Infrastructure
├── Database Repositories
├── Email Providers
├── File Storage
├── Realtime Gateway
├── Queue Workers
├── AI Providers
└── Third-party Integrations

Presentation
├── REST/GraphQL APIs
├── WebSocket Handlers
├── Web UI
└── Client Portal UI
```

## 22.3. Domain events đề xuất

```text
ConversationCreated
MessageSent
MessageMentioned
MessageConvertedToTicket

TicketCreated
TicketAssigned
TicketStatusChanged
TicketSLAAtRisk
TicketSLABreached
TicketResolved
TicketReopened
TicketClosed

EmailReceived
EmailSent
EmailDeliveryFailed
EmailLinkedToTicket
EmailConvertedToTicket

ReportCreated
ReportSubmittedForReview
ReportApproved
ReportChangesRequested
ReportScheduled
ReportSent

AIClassificationGenerated
AISummaryGenerated
AIEmailDraftGenerated
AIReportDraftGenerated
```

Các domain event giúp hệ thống sau này dễ mở rộng notification, automation, audit log, AI Agent và tích hợp bên thứ ba mà không làm module lõi phụ thuộc chặt vào nhau.

---

# 23. Quyết định thiết kế cần chốt

Trước khi đội kỹ thuật bắt đầu thiết kế database và backlog sprint, Agency PTT cần chốt các quyết định sau:

1. **Loại khách hàng mục tiêu đầu tiên:** bất động sản, spa/làm đẹp, giáo dục hay khách hàng agency tổng quát.
2. **Mô hình tenant:** dùng nội bộ Agency PTT trước, hay xây luôn SaaS multi-tenant bán cho agency khác.
3. **Email provider ưu tiên:** Google Workspace, Microsoft 365, SMTP/IMAP hay kết hợp.
4. **Client portal:** khách hàng có tài khoản truy cập trực tiếp hay chỉ nhận qua email/chat trong MVP.
5. **SLA chuẩn:** theo từng gói dịch vụ, hay một policy chung toàn agency.
6. **Quy trình approval:** báo cáo nào bắt buộc duyệt; email nào cần duyệt; ai có quyền bypass.
7. **Chính sách scope:** tiêu chí nào xác định ticket in-scope/out-of-scope và luồng tạo change request.
8. **Kênh chat:** phát triển chat native trước hay tích hợp Slack/Zalo/Messenger.
9. **AI policy:** AI chỉ tạo draft hay được phép automation ở các tình huống lặp lại.
10. **Lưu trữ dữ liệu:** cloud, self-host, hybrid; retention bao lâu cho chat/email/file/report.
11. **Cấu trúc tổ chức:** phòng ban, team, role, account ownership và project ownership.
12. **KPI chính:** ưu tiên SLA, hiệu suất team, trải nghiệm khách hàng hay khả năng upsell.

---

# 24. Backlog Sprint khởi tạo

## Sprint 0 — Foundation

- Thiết kế tenant, user, role và permission.
- Thiết kế Client Account, Contact, Project, Campaign.
- Thiết kế audit log framework.
- Thiết kế notification framework.
- Thiết kế file storage và attachment policy.
- Thiết kế shared activity timeline.
- Thiết kế event bus/domain events.
- Thiết kế wireframe Chat, Ticket, Report, Email.

## Sprint 1 — Ticket Core

- CRUD ticket.
- Ticket type/category/priority/status.
- Ticket assignment.
- Ticket public reply/internal note.
- Ticket activity log.
- Ticket attachment.
- Ticket list/filter/search.
- Kanban board cơ bản.
- SLA rule cơ bản.
- Notification khi tạo/giao/đổi trạng thái ticket.

## Sprint 2 — Chat Core

- Conversation CRUD.
- Direct/group/client/project chat.
- Realtime message.
- Mention/reply/attachment.
- Chat notification.
- Link chat với client/project.
- Create ticket from message.
- Search conversation/message cơ bản.

## Sprint 3 — Email Core

- Shared mailbox setup.
- Outbound email composer.
- Email template.
- Email send log.
- Inbound email sync.
- Match email với contact/client.
- Convert email to ticket.
- Email thread view.

## Sprint 4 — Report Core

- Report template.
- Report builder.
- Draft/review/approval workflow.
- Report PDF export.
- Gửi report qua email.
- Report versioning.
- Report schedule đơn giản.
- Dashboard report due/overdue.

## Sprint 5 — Client Portal và AI Foundation

- Client authentication.
- Client ticket view.
- Client public reply/upload/acceptance.
- Client report view/download.
- AI chat summary.
- AI ticket classification draft.
- AI email draft.
- AI activity log.
- Permission boundary cho AI context.

---

# 25. Artefact nên triển khai tiếp

Từ SRS này, các tài liệu/đầu ra tiếp theo nên được xây dựng theo thứ tự:

1. ERD và database schema chi tiết.
2. Permission matrix theo Role × Module × Action × Data Scope.
3. BPMN workflow cho Chat, Ticket, Email, Report, Approval và SLA Escalation.
4. Use Case Diagram và Sequence Diagram cho các luồng chính.
5. API Contract OpenAPI/Swagger chi tiết.
6. Product backlog theo Epic → Feature → User Story → Task.
7. Wireframe UX/UI cho Dashboard, Ticket Detail, Chat, Email Inbox và Report Builder.
8. Test plan, test case và UAT checklist cho MVP.

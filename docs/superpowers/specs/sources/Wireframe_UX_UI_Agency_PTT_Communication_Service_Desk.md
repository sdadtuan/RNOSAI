# Wireframe UX/UI — Agency PTT Communication & Service Desk

**Phạm vi:** Dashboard, Ticket Detail, Chat Workspace và Report Builder  
**Phiên bản:** 1.0  
**Định hướng:** Desktop-first, responsive, CRM/Agency Operating System, hỗ trợ Client Portal và AI Agent.

---

# 1. Mục tiêu UX/UI

Wireframe này phục vụ hệ thống vận hành Agency PTT, nơi Account, Project Manager, team triển khai và khách hàng cần xử lý nhanh các hoạt động giao tiếp, yêu cầu, ticket và báo cáo trong cùng một luồng dữ liệu.

## 1.1. Nguyên tắc trải nghiệm

1. **Context-first:** Mỗi màn hình luôn thể hiện khách hàng, dự án, campaign hoặc ticket đang thao tác.
2. **Action-first:** Các hành động quan trọng như tạo ticket, phản hồi khách hàng, chuyển trạng thái, gửi báo cáo phải dễ thấy và ít bước.
3. **Internal vs Client rõ ràng:** Nội dung nội bộ phải khác biệt trực quan với nội dung gửi ra khách hàng.
4. **SLA visible:** Ticket có nguy cơ trễ hoặc vi phạm SLA phải nổi bật.
5. **AI as copilot:** AI chỉ đóng vai trò đề xuất/tạo nháp; người dùng kiểm duyệt trước khi gửi hoặc áp dụng.
6. **Unified timeline:** Chat, email, comment ticket, approval và sự kiện hệ thống nên quy tụ thành một timeline khi cần.
7. **Operational density:** Giao diện ưu tiên mật độ thông tin cao nhưng vẫn dễ quét nhanh cho người dùng vận hành agency.
8. **Permission-aware:** Chức năng và dữ liệu hiển thị thay đổi theo role và phạm vi quyền.

## 1.2. Thiết bị mục tiêu

| Thiết bị | Mức ưu tiên | Mục tiêu |
|---|---:|---|
| Desktop 1440px+ | Cao nhất | Account, PM, Manager vận hành hàng ngày |
| Laptop 1280px | Cao | Màn hình làm việc phổ biến |
| Tablet 768px+ | Trung bình | Duyệt ticket, report, cập nhật nhanh |
| Mobile 375px+ | Trung bình | Notification, chat, update ticket khẩn cấp |

---

# 2. Design System Foundation

## 2.1. Cấu trúc layout chung

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Top Bar: Global Search | Quick Create | AI Assistant | Notifications | User Menu            │
├───────────────┬─────────────────────────────────────────────────────────────────────────────┤
│ Main Sidebar  │ Page Header: Breadcrumb | Page Title | Context | Primary Actions             │
│               ├─────────────────────────────────────────────────────────────────────────────┤
│ Dashboard     │                                                                             │
│ CRM           │                          Main Workspace                                     │
│ Communication │                                                                             │
│ Service Desk  │                                                                             │
│ Reports       │                                                                             │
│ AI Workspace  │                                                                             │
│ Administration│                                                                             │
│               │                                                                             │
└───────────────┴─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2. Main Sidebar

```text
┌───────────────────────┐
│ PTT AGENCY            │
│ Workspace: Production │
├───────────────────────┤
│ ▣ Dashboard           │
│ ◉ CRM                 │
│   ├─ Khách hàng       │
│   ├─ Dự án            │
│   └─ Campaign         │
│ ◌ Communication       │
│   ├─ Chat             │
│   ├─ Email Inbox      │
│   └─ Activity         │
│ ◈ Service Desk        │
│   ├─ Ticket Board     │
│   ├─ My Tickets       │
│   └─ SLA Monitor      │
│ ◫ Reports             │
│   ├─ Report Center    │
│   ├─ Approval Queue   │
│   └─ Schedules        │
│ ✦ AI Workspace        │
│ ⚙ Administration      │
├───────────────────────┤
│ [?] Help Center       │
│ [◐] Dark Mode         │
└───────────────────────┘
```

### Sidebar behavior

- Expanded width: 248–272px.
- Collapsed width: 72px, chỉ hiện icon và tooltip.
- Mục active có nền màu brand nhẹ, icon rõ và thanh indicator bên trái.
- Badge số lượng hiển thị với các mục cần hành động: unread chat, ticket overdue, approval pending.
- Trên mobile, sidebar trở thành drawer trượt từ trái sang.

## 2.3. Top Bar

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [☰]  [⌕ Tìm khách hàng, ticket, email, báo cáo...] [⌘K]  [+ Tạo mới ▾]  [✦ AI] [🔔 8] [AV] │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Thành phần

| Thành phần | Hành vi |
|---|---|
| Global Search | Tìm kiếm khách hàng, contact, project, ticket, conversation, email, report, file |
| Command shortcut | Mở Command Palette bằng `Ctrl/Cmd + K` |
| Quick Create | Tạo Ticket, Chat, Email, Report, Client, Project, Campaign |
| AI Assistant | Mở AI side panel hoặc AI workspace contextual |
| Notification | Hiển thị unread, SLA risk, mention, approval, report due |
| User Menu | Hồ sơ, workspace, language, theme, logout |

## 2.4. Color semantics

| Semantic | Màu đề xuất | Ứng dụng |
|---|---|---|
| Brand Primary | Blue/Indigo | CTA chính, active state, link |
| Success | Green | Approved, Resolved, Closed, On Track |
| Warning | Amber/Orange | At Risk, Waiting, cần review |
| Danger | Red | P1, SLA Breached, lỗi gửi email, complaint |
| Info | Cyan/Blue | In Progress, system information |
| AI | Purple/Violet | AI draft, AI suggestion, AI generated insight |
| Internal | Slate/Gray | Internal note, internal attachment |
| Client-facing | Blue/White | Public reply, client-visible content |

## 2.5. Typography và spacing

- Font đề xuất: Inter, Be Vietnam Pro hoặc IBM Plex Sans.
- Base font: 14px.
- Body desktop: 14–16px.
- Page title: 24–28px.
- Section heading: 16–18px.
- Spacing system: 4, 8, 12, 16, 24, 32px.
- Card radius: 10–12px.
- Button radius: 8px.
- Tránh quá nhiều shadow; ưu tiên border nhẹ, layer và background contrast.

## 2.6. Component chuẩn

| Component | Quy chuẩn |
|---|---|
| Primary Button | Brand color; chỉ cho CTA quan trọng nhất trong một khu vực |
| Secondary Button | Outline/neutral; cho Preview, Save Draft, Assign |
| Destructive Button | Red; cần confirmation modal |
| Status Chip | Có icon/màu/text; không chỉ truyền đạt bằng màu |
| SLA Badge | On Track, At Risk, Near Breach, Breached, Paused |
| Avatar Stack | Hiển thị assignee/collaborator/member conversation |
| Entity Pill | Client, Project, Campaign, Contract, Ticket liên kết |
| AI Card | Viền/tint violet, có nhãn “AI Draft” hoặc “AI Suggestion” |
| Empty State | Mô tả ngắn, CTA cụ thể, tránh trang trống |
| Activity Item | Icon theo event, timestamp, actor, nội dung thay đổi |

---

# 3. Dashboard

## 3.1. Mục tiêu Dashboard

Dashboard là màn hình mở đầu cho Account, Project Manager, Agency Admin và Director. Dashboard phải trả lời ngay các câu hỏi:

- Hôm nay có việc gì cần xử lý?
- Ticket nào gần hoặc đã vi phạm SLA?
- Khách hàng nào đang có rủi ro?
- Báo cáo nào sắp đến hạn hoặc chờ duyệt?
- Team nào đang quá tải?
- Email/chat nào chưa được phản hồi?

## 3.2. Dashboard theo role

| Role | Trọng tâm |
|---|---|
| Account Manager | Client health, chat/email chưa phản hồi, ticket khách hàng, báo cáo đến hạn |
| Project Manager | Ticket board, SLA risk, workload, project blocker, approval cần xử lý |
| Team Member | My tickets, my tasks, mentions, deadline, work queue |
| Agency Admin/Director | SLA compliance, client risk, utilization, ticket breach, report compliance, escalation |
| Client | Ticket mở, việc chờ khách hàng, báo cáo mới, tiến độ dự án |

## 3.3. Wireframe Desktop — Account/PM Dashboard

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Dashboard                                  [Thời gian: Tháng này ▾] [Tùy chỉnh dashboard ⚙] │
│ Xin chào, Tuấn 👋                                      Thứ Ba, 01/09/2026                              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌─────────────────────────┐ │
│ │ Ticket cần xử lý     │ │ SLA có rủi ro        │ │ Báo cáo đến hạn      │ │ Chat/Email chưa phản hồi│ │
│ │ 24                   │ │ 06                   │ │ 03                   │ │ 12                      │ │
│ │ +5 so với hôm qua    │ │ 2 Near breach        │ │ 1 cần duyệt hôm nay  │ │ 4 từ khách hàng         │ │
│ │ [Xem ticket]         │ │ [Mở SLA Monitor]     │ │ [Mở Report Center]   │ │ [Mở Unified Inbox]      │ │
│ └──────────────────────┘ └──────────────────────┘ └──────────────────────┘ └─────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ ┌─────────────────────────────────────────────┐ │
│ │ Việc ưu tiên hôm nay                                 │ │ SLA Monitor                                  │ │
│ │ [Filter: Tất cả team ▾] [Sort: SLA gần nhất ▾]       │ │ On Track ███████████████████ 82%             │ │
│ │                                                     │ │ At Risk  ████ 11%                            │ │
│ │ 🔴 P1  PTT-1032 Website không nhận lead              │ │ Near     ██ 5%                               │ │
│ │     ABC Land · Website · 00:42 còn lại · @Tech       │ │ Breach   █ 2%                                │ │
│ │     [Nhận xử lý] [Mở ticket]                         │ │                                             │ │
│ │ 🟠 P2  PTT-1027 Điều chỉnh ngân sách Meta Ads        │ │ [Xem tất cả ticket SLA]                      │ │
│ │     Beauty Home · Ads · 01:18 còn lại · @Media       │ │                                             │ │
│ │     [Mở ticket]                                     │ └─────────────────────────────────────────────┘ │
│ │                                                     │ ┌─────────────────────────────────────────────┐ │
│ │ 🟡 P3  PTT-1021 Duyệt content tuần 2                 │ │ Báo cáo sắp đến hạn                          │ │
│ │     EduNext · Content · Chờ client phản hồi          │ │ 02/09 · ABC Land · Monthly Ads Report        │ │
│ │     [Nhắc khách hàng] [Mở ticket]                    │ │ Status: In Review · Approver: Minh           │ │
│ │                                                     │ │ [Review]                                     │ │
│ │ [Xem toàn bộ 24 ticket]                              │ │                                             │ │
│ └─────────────────────────────────────────────────────┘ │ 03/09 · Beauty Home · Weekly Performance      │ │
│                                                         │ Status: Draft · Owner: Tuấn                   │ │
│                                                         │ [Mở báo cáo]                                  │ │
│                                                         └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ ┌─────────────────────────────────────────────┐ │
│ │ Client Health & Attention                            │ │ Unified Inbox                                │ │
│ │ [Client ▾] [Service ▾]                               │ │ [All] [Chat] [Email] [Mentions]              │ │
│ │                                                     │ │                                             │ │
│ │ 🔴 ABC Land                                         │ │ 💬 Nguyễn An · ABC Land                      │ │
│ │ Health: 54/100 · 2 ticket P1/P2 · 1 report pending  │ │ “Anh xem giúp form lead từ sáng...”          │ │
│ │ [Mở hồ sơ] [Xem rủi ro]                              │ │ 12 phút trước · Client Chat                  │ │
│ │                                                     │ │ [Trả lời] [Tạo ticket]                       │ │
│ │ 🟠 Beauty Home                                      │ │                                             │ │
│ │ Health: 71/100 · Ad spend vượt pace 14%              │ │ ✉ support@agencyptt.vn                       │ │
│ │ [Mở dashboard client]                                │ │ Subject: “Cần update báo cáo tháng”          │ │
│ │                                                     │ │ 32 phút trước · Unmatched                    │ │
│ │ 🟢 EduNext                                          │ │ [Phân loại] [Tạo ticket]                     │ │
│ │ Health: 91/100 · On track                            │ │                                             │ │
│ │ [Mở hồ sơ]                                          │ │ [Mở Unified Inbox]                            │ │
│ └─────────────────────────────────────────────────────┘ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Team Workload                                                        [Team: Tất cả ▾] [Tuần này ▾]   │ │
│ │ Design     ██████████████████ 82%   3 quá hạn   | Media ███████████████ 67%  0 quá hạn              │ │
│ │ Content    █████████████████████ 91% 5 quá hạn  | Tech  ████████████ 53%  1 quá hạn                 │ │
│ │ [Mở Resource Planner]                                                                             │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 3.4. Thành phần Dashboard

### A. KPI Cards

| Card | Chỉ số | Hành động khi click |
|---|---|---|
| Ticket cần xử lý | Ticket New, Assigned, In Progress thuộc scope user | Mở Ticket List đã lọc |
| SLA có rủi ro | At Risk, Near Breach, Breached | Mở SLA Monitor |
| Báo cáo đến hạn | Draft, In Review hoặc Scheduled theo deadline | Mở Report Center |
| Chat/Email chưa phản hồi | Tin nhắn/email vượt threshold phản hồi | Mở Unified Inbox |

### B. Việc ưu tiên hôm nay

Hiển thị 5–10 ticket quan trọng nhất theo thứ tự:

1. Priority.
2. SLA status.
3. Deadline.
4. Client tier.
5. Complaint/escalation flag.
6. Thời gian chờ phản hồi.

Mỗi item gồm ticket code, title, client, category, trạng thái, SLA còn lại, assignee và quick actions.

### C. SLA Monitor

- Donut/stack bar thể hiện tỷ trọng ticket theo SLA status.
- Hiển thị số ticket breach theo hôm nay/tuần/tháng.
- Có tooltip diễn giải trạng thái.
- Click vào segment sẽ mở danh sách ticket đã lọc.

### D. Client Health

Client Health Score gợi ý cấu trúc 0–100:

| Thành phần | Trọng số đề xuất |
|---|---:|
| SLA compliance | 25% |
| Ticket complaint/reopen | 20% |
| Tình trạng báo cáo/approval | 15% |
| Hiệu quả campaign so với target | 20% |
| Mức độ phản hồi của khách hàng | 10% |
| Tình trạng hợp đồng/công nợ | 10% |

Không nên chỉ hiển thị màu; luôn hiển thị lý do tạo rủi ro, ví dụ: “2 ticket P2 gần breach”, “Báo cáo tháng chưa duyệt”, “Ad spend vượt pace 14%”.

### E. Unified Inbox

- Gom chat khách hàng, email inbound, mention và ticket comment cần phản hồi.
- Mỗi item chỉ hiển thị preview an toàn; click mở ngữ cảnh đầy đủ.
- Quick action: Reply, Assign, Create Ticket, Snooze, Mark as done.
- Các nội dung client-facing hiển thị biểu tượng khách hàng rõ ràng.

## 3.5. Dashboard Client Portal

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ Logo Client + PTT Agency       Dashboard khách hàng                    [AV Client]   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Xin chào Anh/Chị An, đây là tình hình dự án tháng 09/2026                            │
├──────────────────────┬──────────────────────┬──────────────────────┬─────────────────┤
│ Ticket đang mở: 04   │ Chờ Anh/Chị: 02      │ Báo cáo mới: 01      │ Việc cần duyệt: 3│
│ [Xem ticket]         │ [Phản hồi ngay]      │ [Xem báo cáo]        │ [Mở approval]   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ Tiến độ dịch vụ                                                        [Tháng này ▾] │
│ Meta Ads        ████████████████ 78%  On track                                         │
│ Content         ███████████████████ 92% On track                                       │
│ Landing Page    ████████ 40%         Chờ phê duyệt nội dung                            │
├───────────────────────────────────────┬──────────────────────────────────────────────┤
│ Ticket cần phản hồi                    │ Báo cáo mới nhất                              │
│ PTT-1021 Duyệt content tuần 2          │ Monthly Marketing Report — 08/2026            │
│ Chúng tôi cần xác nhận 04 caption...   │ Trạng thái: Đã gửi                             │
│ [Xem & phản hồi]                       │ [Xem báo cáo] [Tải PDF]                       │
├───────────────────────────────────────┴──────────────────────────────────────────────┤
│ Liên hệ Account Manager: Tuấn · [Nhắn tin] [Gửi yêu cầu mới]                          │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## 3.6. Responsive Dashboard

### Tablet

- KPI card chuyển từ 4 cột sang 2 cột.
- Side panel chuyển xuống dưới nội dung chính.
- Team workload thành list card theo từng team.

### Mobile

- Header sticky gồm hamburger, page title, notifications và quick create.
- KPI cards dạng horizontal scroll hoặc grid 2 cột.
- “Việc ưu tiên hôm nay” đứng đầu trang.
- Client Health và SLA Monitor có thể thu gọn.
- Các biểu đồ phức tạp chuyển thành số liệu + progress bar.

---

# 4. Ticket Detail

## 4.1. Mục tiêu Ticket Detail

Ticket Detail là workspace trọng tâm. Người dùng phải có thể đọc yêu cầu, thấy đúng context, phản hồi khách hàng, phối hợp nội bộ, cập nhật trạng thái, theo dõi SLA và bàn giao kết quả mà không cần rời trang.

## 4.2. Layout Desktop ba cột

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ← Tickets / ABC Land / PTT-1032                                           [⋯] [Share] [Close Ticket]      │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PTT-1032  Website không nhận lead từ form đăng ký                              [P1 Critical] [Escalated]  │
│ ABC Land  · Website Revamp  · Campaign: Lead Gen Q3       Created 09:18 · by Nguyễn An (Client)           │
├───────────────────────┬─────────────────────────────────────────────────────┬────────────────────────────┤
│ LEFT: Ticket Context  │ CENTER: Conversation & Activity                      │ RIGHT: Context & Intelligence│
│                       │                                                     │                            │
│ Status                │ [Public Reply] [Internal Note]                       │ Client                    │
│ [In Progress ▾]       │ ┌─────────────────────────────────────────────────┐ │ ABC Land                 │
│                       │ │ Viết phản hồi cho khách hàng...                 │ │ Health 54/100 🔴         │
│ Priority              │ │ [📎] [@ Mention] [Template] [✦ Draft with AI]   │ │ Account: Tuấn            │
│ [P1 Critical ▾]       │ │                              [Gửi cho khách hàng]│ │ [Mở hồ sơ]               │
│                       │ └─────────────────────────────────────────────────┘ │                            │
│ SLA                   │                                                     │ Related Items              │
│ 🔴 Near Breach        │ ── Hôm nay ─────────────────────────────────────── │ • Project: Website Revamp │
│ Response: Đã đáp ứng  │                                                     │ • Campaign: Lead Gen Q3   │
│ Resolution: 00:42     │ 👤 Nguyễn An · Client · 09:18                       │ • Contract: Web Care      │
│ [Xem SLA details]     │ “Form đăng ký không nhận lead từ sáng, nhờ team...”│ │ • 3 ticket liên quan      │
│                       │ [Create sub-ticket] [Reply]                        │ │                            │
│ Assignment            │                                                     │ AI Assistant              │
│ Owner: Tuấn           │ ⚙ System · 09:20                                   │ ┌────────────────────────┐ │
│ Assignee: Minh Tech   │ Ticket created from Client Chat                     │ │ Tóm tắt: Form không tạo │ │
│ Team: Technical       │ SLA P1 applied: response 1h / resolve 4h            │ │ lead từ 08:30.          │ │
│ [Assign]              │                                                     │ │                          │ │
│                       │ 👤 Tuấn · Internal Note · 09:24                    │ │ Đề xuất:                │ │
│ Client & Project      │ “Kiểm tra webhook CRM, GA4 event và server log.”    │ │ 1. Giao Tech kiểm tra   │ │
│ Client: ABC Land      │ [Internal]                                          │ │ 2. Báo client ETA 30p   │ │
│ Project: Website Revamp│                                                    │ │ 3. Tạo sub-ticket CRM   │ │
│ Campaign: Lead Gen Q3 │ 👤 Minh Tech · 09:37                               │ └────────────────────────┘ │
│ [Change context]      │ “Đã xác định webhook endpoint trả về 500...”        │ [Dùng đề xuất] [Mở AI]    │
│                       │ [Reply] [Convert to task]                           │                            │
│ Tags                  │                                                     │ Attachments               │
│ [website] [lead]      │ ── Activity ────────────────────────────────────── │ • error-log-0901.pdf     │
│ [incident] [client]   │ 09:38 Minh Tech changed status: Assigned → In Prog │ • form-config.png         │
│ [+ Add tag]           │ 09:40 Tuấn added watcher: Lan PM                    │ [Xem tất cả]              │
│                       │                                                     │                            │
│ Scope                 │                                                     │ Time Tracking             │
│ [In Scope ▾]          │                                                     │ Estimate: 2h              │
│                       │                                                     │ Actual: 1h 18m            │
└───────────────────────┴─────────────────────────────────────────────────────┴────────────────────────────┘
```

## 4.3. Vùng header ticket

### Thông tin bắt buộc

- Breadcrumb: Tickets → Client → Ticket ID.
- Ticket code.
- Ticket title.
- Client, Project, Campaign.
- Requester và thời điểm tạo.
- Status chip.
- Priority chip.
- Escalation/Complaint chip nếu có.
- Action chính tùy trạng thái: Assign, Start Work, Resolve, Request Approval, Close.
- Overflow menu: Duplicate, Merge, Split, Export, Archive, Delete theo quyền.

### Header actions theo trạng thái

| Trạng thái | CTA chính |
|---|---|
| New | Triage / Assign |
| Triaged | Assign |
| Assigned | Start Work |
| In Progress | Resolve / Request Client Info |
| Waiting for Client | Send Reminder / Resume Work |
| Resolved | Request Client Acceptance |
| Client Acceptance | Close Ticket |
| Closed | Reopen |

## 4.4. Cột trái — Ticket Context

### Component ưu tiên

1. Status.
2. Priority.
3. SLA.
4. Assignee/Owner/Team.
5. Client/Project/Campaign.
6. Tags.
7. Scope Status.
8. Due date/ETA.
9. Watchers.
10. Time Tracking.

### SLA Card

```text
┌─────────────────────────────────┐
│ SLA                              │
│ 🔴 Near Breach                   │
│                                  │
│ Response SLA                     │
│ ✓ Responded in 06m               │
│                                  │
│ Resolution SLA                   │
│ █████████████████░░ 82%          │
│ Còn lại: 00:42                   │
│ Due: 13:18 hôm nay               │
│                                  │
│ [Xem lịch sử SLA]                │
└─────────────────────────────────┘
```

### Quy tắc UX cho SLA

- Luôn hiển thị chữ mô tả cùng màu sắc.
- Near Breach/Breached có icon cảnh báo và pin lên đầu cột.
- Deadline hiển thị theo thời gian tương đối và tuyệt đối: “còn 42 phút · 13:18 hôm nay”.
- Hover/click mở breakdown: business hours, paused intervals, breach events, SLA policy.

## 4.5. Cột giữa — Conversation & Activity

### Tabs đề xuất

```text
[Conversation] [Activity] [Work Log] [Related Emails] [Approval]
```

- Mặc định là `Conversation`.
- Activity có thể inline dưới Conversation hoặc tách tab tùy mật độ nội dung.
- User có thể lọc timeline: All, Public, Internal, System, Attachments, Emails.

### Composer: Public Reply vs Internal Note

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [● Public Reply ▾]                                                    │
│                                                                        │
│ Viết phản hồi cho khách hàng...                                       │
│                                                                        │
│ [📎 Đính kèm] [@ Mention] [Template] [✦ AI Draft] [⌄ More]           │
│                                                  [Lưu nháp] [Gửi]     │
└──────────────────────────────────────────────────────────────────────┘
```

Khi chọn Internal Note:

```text
┌──────────────────────────────────────────────────────────────────────┐
│ [● Internal Note ▾]  Chỉ hiển thị cho đội Agency PTT                 │
│                                                                        │
│ Ghi chú kỹ thuật, phân công hoặc trao đổi nội bộ...                   │
│                                                                        │
│ [📎 File internal] [@ Mention] [Create Task] [✦ AI Summary]          │
│                                                  [Lưu nháp] [Ghi chú] │
└──────────────────────────────────────────────────────────────────────┘
```

### Yêu cầu phân biệt trực quan

| Loại nội dung | Quy ước UI |
|---|---|
| Public Reply | Background trắng/xanh rất nhạt, icon client/public, label “Hiển thị cho khách hàng” |
| Internal Note | Background slate/vàng nhạt, lock icon, label “Nội bộ Agency” |
| System Event | Nền neutral, text nhỏ hơn, không chiếm quá nhiều diện tích |
| AI Generated | Viền hoặc label tím, luôn ghi “AI Draft” hoặc “AI Suggestion” |
| Client Message | Avatar/logo client, label `Client` |
| Agency Message | Avatar nhân sự, role nhỏ bên cạnh tên |

## 4.6. Cột phải — Client Context và AI

### Client Card

```text
┌───────────────────────────────┐
│ ABC Land                       │
│ Real Estate · Premium Client   │
│ Health Score: 54/100 🔴        │
│                                │
│ Account Owner                  │
│ Tuấn PTT                       │
│                                │
│ Open tickets: 8                │
│ SLA compliance: 88%            │
│ Last report: 28/08/2026        │
│                                │
│ [Mở Client 360]                │
└───────────────────────────────┘
```

### AI Side Card

```text
┌────────────────────────────────────────┐
│ ✦ AI Assistant                          │
│ Context: PTT-1032 · ABC Land            │
│                                        │
│ Tóm tắt                                 │
│ Form đăng ký lỗi từ 08:30; nguyên nhân │
│ sơ bộ là webhook trả HTTP 500.          │
│                                        │
│ Suggested next actions                  │
│ □ Soạn phản hồi ETA 30 phút cho client │
│ □ Tạo sub-ticket kiểm tra CRM webhook  │
│ □ Gắn tag Incident + Tracking           │
│                                        │
│ [Tạo email nháp] [Áp dụng action]       │
└────────────────────────────────────────┘
```

AI chỉ tạo hành động nháp. Nếu chọn “Áp dụng action”, hệ thống hiển thị review modal trước khi tạo ticket/sub-ticket hoặc thay đổi field.

## 4.7. Ticket resolution flow

Khi người dùng click `Resolve`:

```text
┌─────────────────────────────────────────────────────────────┐
│ Resolve Ticket: PTT-1032                                    │
├─────────────────────────────────────────────────────────────┤
│ Resolution summary *                                        │
│ [Đã sửa webhook CRM endpoint, kiểm tra form thành công...]  │
│                                                             │
│ Deliverables / Evidence                                     │
│ [🔗 Thêm link] [📎 Tải file]                                │
│                                                             │
│ Gửi cập nhật cho khách hàng                                 │
│ [✓] Gửi Public Reply cùng nội dung                          │
│ [✓] Yêu cầu khách hàng nghiệm thu                           │
│                                                             │
│ Ticket status sau thao tác: [Client Acceptance ▾]           │
│                                                             │
│                               [Hủy] [Resolve & Send]        │
└─────────────────────────────────────────────────────────────┘
```

## 4.8. Ticket Detail responsive

### Tablet

- Cột trái thu thành panel có thể collapse.
- Cột phải chuyển thành tab `Context`/`AI`.
- Composer luôn sticky ở cuối vùng content.

### Mobile

- Header chỉ hiển thị ticket ID, title ngắn, priority, status và menu.
- Ticket details chuyển thành bottom sheet/tab: Details, Conversation, Activity, AI.
- Quick actions sticky dưới màn hình: Reply, Note, Status.
- SLA hiển thị chip + countdown; click mở full SLA breakdown.

---

# 5. Chat Workspace

## 5.1. Mục tiêu Chat

Chat Workspace phục vụ trao đổi nhanh nhưng không làm thất lạc yêu cầu công việc. Người dùng cần có khả năng chuyển tin nhắn thành ticket, xem context CRM và dùng AI tóm tắt/action extraction ngay trong luồng chat.

## 5.2. Layout Desktop ba vùng

```text
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Communication / Chat                                                   [⌕ Search in chat] [⋯]          │
├───────────────────────┬───────────────────────────────────────────────────────┬───────────────────────┤
│ LEFT: Conversation    │ CENTER: Message Timeline                               │ RIGHT: Context Panel  │
│                       │                                                       │                       │
│ [+ New Chat]          │ # ABC Land — Lead Gen Q3                              │ ABC Land              │
│ [⌕ Tìm conversation] │ Client Chat · 8 members · Active                       │ Client Health: 54 🔴  │
│                       │ [Project: Website Revamp] [Campaign: Lead Gen Q3]      │ Account: Tuấn         │
│ PINNED                ├───────────────────────────────────────────────────────┤ [Mở Client 360]       │
│ 📌 # Agency Announce  │ ── Hôm nay ─────────────────────────────────────────  │                       │
│ 📌 # ABC Land LeadGen │                                                       │ Related Tickets       │
│                       │ 👤 Nguyễn An · Client · 09:18                          │ PTT-1032 P1           │
│ CLIENTS               │ Form đăng ký không nhận lead từ sáng, nhờ team kiểm...│ In Progress · 00:42   │
│ 🔴 ABC Land           │ [↩ Reply] [✓ Create Ticket] [⋯]                       │ [Mở ticket]           │
│ 🟠 Beauty Home         │                                                       │                       │
│ 🟢 EduNext            │ 👤 Tuấn · Account · 09:25                             │ Files                 │
│                       │ Dạ team đã tiếp nhận, sẽ kiểm tra và phản hồi ETA...  │ • campaign-plan.pdf   │
│ PROJECTS               │ [↩ Reply] [⋯]                                        │ • form-config.png     │
│ # Website Revamp      │                                                       │ [Xem tất cả]          │
│ # Q3 Content Plan     │ 👤 Minh · Technical · 09:37                            │                       │
│                       │ Đã thấy endpoint webhook trả về lỗi 500.              │ AI Summary             │
│ DIRECT MESSAGES       │ [↩ Reply] [Create task] [⋯]                            │ ┌───────────────────┐ │
│ ● Lan PM              │                                                       │ │ 3 quyết định       │ │
│ ● Minh Tech           │ ── Unread messages ─────────────────────────────────  │ │ 2 action items      │ │
│                       │                                                       │ │ 1 risk SLA          │ │
│ [Archived]            │ 👤 Nguyễn An · Client · 10:05                          │ └───────────────────┘ │
│                       │ Anh/chị cho tôi ETA cụ thể để báo sếp nhé.            │ [Tóm tắt bằng AI]     │
│                       │                                                       │                       │
│                       ├───────────────────────────────────────────────────────┤                       │
│                       │ [＋] Viết tin nhắn...                           [Send] │                       │
│                       │ [📎] [@] [😊] [✦ AI] [Create Ticket]                  │                       │
└───────────────────────┴───────────────────────────────────────────────────────┴───────────────────────┘
```

## 5.3. Conversation list — cột trái

### Nhóm conversation

- Pinned.
- Clients.
- Projects/Campaigns.
- Internal Teams.
- Direct Messages.
- Archived.

### Mỗi item conversation gồm

| Thành phần | Mô tả |
|---|---|
| Avatar/Icon | Avatar client, nhóm, project hoặc user |
| Conversation name | Tên chat hoặc tên client/project |
| Last message preview | Tối đa 1 dòng, cắt ngắn an toàn |
| Timestamp | Thời gian gần nhất |
| Unread badge | Số tin chưa đọc |
| Priority/risk | Dot đỏ/cam khi có P1, complaint hoặc SLA risk |
| Mute/pin state | Icon nhỏ, không làm rối giao diện |

### Conversation filters

```text
[All] [Unread] [Clients] [Projects] [Internal] [Mentions] [Archived]
```

## 5.4. Conversation header

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ # ABC Land — Lead Gen Q3                                      [⋯ More]    │
│ Client Chat · 8 thành viên · Hoạt động                                    │
│ [ABC Land] [Website Revamp] [Lead Gen Q3] [Premium Client]                 │
│ [Open Client] [Open Project] [Create Ticket] [Invite Member]              │
└────────────────────────────────────────────────────────────────────────────┘
```

### Header action menu

- Mở thông tin conversation.
- Thêm/xóa thành viên.
- Link client/project/campaign.
- Mute/unmute.
- Pin/unpin.
- Archive/close/reopen.
- Export transcript theo quyền.
- Tạo ticket từ conversation summary.
- Tóm tắt bằng AI.

## 5.5. Message item

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [Avatar] Nguyễn An  Client                                         09:18   │
│          Form đăng ký không nhận lead từ sáng, nhờ team kiểm tra gấp.       │
│                                                                            │
│          [↩ Reply] [😊] [✓ Create Ticket] [⋯]                              │
└────────────────────────────────────────────────────────────────────────────┘
```

### Hover actions

- Reply.
- React.
- Create Ticket.
- Create Task.
- Copy link.
- Forward.
- Mark important.
- Ask AI about this message.
- More menu.

### Khi message đã tạo ticket

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [Avatar] Nguyễn An  Client                                         09:18   │
│          Form đăng ký không nhận lead từ sáng, nhờ team kiểm tra gấp.       │
│                                                                            │
│          ┌────────────────────────────────────────────────────────────┐    │
│          │ ✓ Ticket created: PTT-1032 · P1 · In Progress [Mở ticket] │    │
│          └────────────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────────────────────┘
```

## 5.6. Composer

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ [📎] [@ Mention] [😊 Emoji] [GIF] [✦ AI Assist] [⌄]                       │
│                                                                            │
│ Viết tin nhắn...                                                           │
│                                                                            │
│ [Create Ticket from message]                               [Send ⏎]        │
└────────────────────────────────────────────────────────────────────────────┘
```

### Composer behavior

- `Enter`: gửi tin nhắn.
- `Shift + Enter`: xuống dòng.
- `@`: gợi ý user/team.
- `#`: gợi ý ticket/project/campaign nếu bật smart linking.
- Paste ảnh/file: hiển thị preview trước khi gửi.
- Nếu conversation là Client Chat: hiển thị nhãn “Bạn đang gửi cho khách hàng”.
- Nếu conversation bị closed: composer bị disable, hiển thị CTA `Reopen Conversation` nếu user có quyền.

## 5.7. Context panel — cột phải

### Tabs

```text
[Info] [Tickets] [Files] [Pinned] [AI Summary]
```

### Info tab

- Client/Project/Campaign liên kết.
- Conversation owner.
- Thành viên.
- Tags.
- Created date.
- SLA policy nếu conversation thuộc kênh hỗ trợ.

### Tickets tab

- Ticket tạo từ messages.
- Ticket liên quan client/project.
- Trạng thái, priority, SLA và assignee.
- CTA tạo ticket mới.

### Files tab

- Danh sách file theo thời gian hoặc loại file.
- Preview nhanh với ảnh/PDF nếu hỗ trợ.
- Filter public/internal theo quyền.

### AI Summary tab

```text
┌────────────────────────────────────┐
│ ✦ AI Conversation Summary           │
│ Period: 24h gần nhất ▾              │
│                                    │
│ Tóm tắt                             │
│ Client báo form lead không nhận... │
│                                    │
│ Decisions                           │
│ • Tech kiểm tra webhook CRM         │
│ • Account trả ETA trong 30 phút     │
│                                    │
│ Action items                        │
│ □ Minh: kiểm tra endpoint webhook  │
│ □ Tuấn: gửi cập nhật khách hàng     │
│                                    │
│ Risks                               │
│ 🔴 Ticket P1 còn 42 phút SLA        │
│                                    │
│ [Tạo ticket] [Tạo tasks] [Copy]     │
└────────────────────────────────────┘
```

## 5.8. Tạo ticket từ chat

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Create Ticket from Message                                            │
├──────────────────────────────────────────────────────────────────────┤
│ Source: ABC Land — Lead Gen Q3 / Nguyễn An / 09:18                   │
│                                                                        │
│ Title *                                                               │
│ [Form đăng ký website không nhận lead                                ]│
│                                                                        │
│ Category *                  Priority *                                │
│ [Technical Support ▾]       [P1 Critical ▾]                          │
│                                                                        │
│ Client / Project / Campaign                                            │
│ [ABC Land] [Website Revamp] [Lead Gen Q3]                             │
│                                                                        │
│ Assign to                                                            │
│ [Technical Team ▾] [Minh Tech ▾]                                     │
│                                                                        │
│ Description                                                           │
│ [Nội dung gốc được thêm tự động, kèm deep-link đến message...]       │
│                                                                        │
│ [ ] Gửi xác nhận tiếp nhận cho khách hàng                             │
│                                                   [Hủy] [Tạo ticket]  │
└──────────────────────────────────────────────────────────────────────┘
```

## 5.9. Chat responsive

### Tablet

- Conversation list 280px có thể thu gọn.
- Context panel mở dạng drawer bên phải.

### Mobile

- Màn hình 1: danh sách conversation.
- Màn hình 2: detail conversation.
- Context mở bằng icon `i` thành bottom sheet.
- Composer sticky ở cuối màn hình.
- Long press message mở action sheet: reply, react, create ticket, copy link, forward.

---

# 6. Report Builder

## 6.1. Mục tiêu Report Builder

Report Builder giúp Account/Marketing Manager tạo báo cáo có dữ liệu nhất quán, narrative rõ ràng, workflow review/approval chặt chẽ và khả năng gửi đa kênh.

Màn hình cần xử lý đồng thời 4 nhu cầu:

1. Chọn đúng context khách hàng/dự án/campaign/kỳ báo cáo.
2. Kéo dữ liệu KPI và visual vào report.
3. Viết nhận định, rủi ro và đề xuất hành động.
4. Review, xuất và gửi report theo version có kiểm soát.

## 6.2. Wireframe Desktop — Report Builder

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Reports / ABC Land / Monthly Marketing Report — 08/2026                  [⋯] [Preview] [Export PDF]      │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Monthly Marketing Report — 08/2026                       [Draft]  v1.0  Last saved 2 phút trước          │
│ ABC Land · Website Revamp · Reporting Period: 01/08–31/08/2026                                      │
│ [Save Draft] [✦ Generate AI Draft] [Submit for Review]                                                  │
├──────────────────────┬──────────────────────────────────────────────────────────┬────────────────────────┤
│ LEFT: Report Outline │ CENTER: Report Editor                                      │ RIGHT: Data & Review   │
│                      │                                                          │                        │
│ + Add section         │ [Executive Summary]                                      │ Data Sources           │
│                      │ ┌──────────────────────────────────────────────────────┐ │ ☑ Meta Ads            │
│ 1. Cover              │ │ Executive Summary                                    │ │ ☑ Google Ads          │
│ 2. Executive Summary  │ │                                                      │ │ ☑ GA4                 │
│ 3. KPI Overview       │ │ Tháng 08 ghi nhận 1,286 leads, tăng 18% so với... │ │ ☑ CRM Leads           │
│ 4. Meta Ads           │ │                                                      │ │ ☐ Search Console      │
│ 5. Google Ads         │ │ [✦ Improve with AI] [Comment]                       │ │ [Refresh data]        │
│ 6. Website & CRM      │ └──────────────────────────────────────────────────────┘ │                        │
│ 7. Work Completed     │                                                          │ KPI Snapshot           │
│ 8. Risks & Blockers   │ ┌──────────────────────────────────────────────────────┐ │ Leads      1,286 +18% │
│ 9. Next Month Plan    │ │ KPI Overview                                         │ │ CPL       126k -8%    │
│ 10. Appendix          │ │                                                      │ │ Spend     162m +4%    │
│                      │ │ [Metric: Leads] [Compare: Previous period]          │ │ ROAS      3.4 +0.2    │
│ [Reorder sections]    │ │                                                      │ │ [Open data explorer]  │
│                      │ │  ┌──────────────────────────────────────────────┐   │ │                        │
│ Templates             │ │  │            KPI Trend Chart                   │   │ │ Approval              │
│ • Monthly Marketing   │ │  │      /\      /\          /\                   │   │ │ Status: Draft         │
│ • Ads Performance     │ │  │  ___/  \____/  \________/  \___               │   │ │ Approver: Minh        │
│ • SEO Monthly         │ │  └──────────────────────────────────────────────┘   │ │ [Request review]      │
│ • Executive Report    │ │                                                      │ │                        │
│                      │ │ [Edit Data] [Change Visualization] [Add Insight]    │ │ Comments (2)           │
│                      │ └──────────────────────────────────────────────────────┘ │ • Minh: làm rõ CPL...  │
│                      │                                                          │ [Open comments]        │
│                      │ ┌──────────────────────────────────────────────────────┐ │                        │
│                      │ │ Risks & Blockers                                      │ │ AI Insights            │
│                      │ │ 🔴 Form lead bị gián đoạn 2h ngày 19/08               │ │ ┌────────────────────┐ │
│                      │ │ 🟠 Client duyệt content chậm 3 ngày                   │ │ │ CPL giảm 8%, nhưng  │ │
│                      │ │ [Add risk] [Link ticket] [✦ Generate insight]        │ │ │ lead quality chưa... │ │
│                      │ └──────────────────────────────────────────────────────┘ │ │ [Thêm vào report]    │ │
└──────────────────────┴──────────────────────────────────────────────────────────┴────────────────────────┘
```

## 6.3. Report header

### Thông tin hiển thị

- Breadcrumb: Reports → Client → Report Name.
- Tên report.
- Client, Project, Campaign.
- Reporting period.
- Status chip.
- Version.
- Người tạo, lần lưu gần nhất.
- Primary actions: Save Draft, Submit for Review, Schedule Send, Send.
- Secondary actions: Preview, Export PDF, Duplicate, Create New Version, Archive.

### Action theo trạng thái

| Trạng thái | Hành động chính |
|---|---|
| Draft | Save Draft, Generate AI Draft, Submit for Review |
| Data Pending | Refresh Data, Resolve Data Issue |
| In Review | View Comments, Update Version |
| Changes Requested | Revise Report, Resubmit Review |
| Approved | Schedule Send, Send Now, Export PDF |
| Scheduled | Edit Schedule, Cancel Schedule |
| Sent | View Send Log, Create Revised Version |
| Archived | Restore, Duplicate |

## 6.4. Cột trái — Report Outline

```text
┌─────────────────────────────────┐
│ [＋ Add Section]                 │
│                                 │
│ 1  Cover                         │
│ 2  Executive Summary             │
│ 3  KPI Overview                  │
│ 4  Channel Performance           │
│    ├─ Meta Ads                   │
│    ├─ Google Ads                 │
│    └─ TikTok Ads                 │
│ 5  Website & CRM                 │
│ 6  Work Completed                │
│ 7  Risks & Blockers              │
│ 8  Recommendations               │
│ 9  Next Month Plan               │
│ 10 Appendix                      │
│                                 │
│ [Reorder] [Manage template]      │
└─────────────────────────────────┘
```

### Hành vi

- Click section để scroll/editor focus đúng khu vực.
- Drag-and-drop để đổi thứ tự nếu template cho phép.
- Add Section mở menu: Text, KPI Table, Chart, Image, File, Ticket Summary, AI Insight, Page Break, Embed Dashboard.
- Có badge warning khi section chưa đủ nội dung hoặc data source lỗi.
- Có icon comment khi section có review comment chưa resolve.

## 6.5. Trung tâm — Report Editor

### Loại block

| Block | Mục đích |
|---|---|
| Rich Text | Executive summary, insight, recommendation |
| KPI Card Grid | Hiển thị chỉ số nổi bật |
| Data Table | Bảng KPI chi tiết |
| Chart | Line, bar, stacked bar, donut, funnel |
| Comparison | So sánh kỳ này/kỳ trước/target |
| Image | Screenshot dashboard, creative, campaign evidence |
| Ticket Summary | Tổng hợp ticket/SLA liên quan |
| Work Completed | Hạng mục đã triển khai |
| Risks & Blockers | Rủi ro, dependency, blocker |
| Action Plan | Kế hoạch kỳ tiếp theo |
| File/Link | PDF, Excel, Looker Studio, dashboard external |
| AI Insight | Insight tạo bởi AI có nguồn dữ liệu/context |

### Toolbar Rich Text

```text
[H1 ▾] [B] [I] [U] [• List] [1. List] [Link] [Comment] [Variables] [✦ AI]
```

### AI in editor

Mỗi block narrative có menu AI:

- Viết nháp từ dữ liệu đã chọn.
- Rút gọn nội dung.
- Viết theo tone executive/client-friendly/technical.
- Gợi ý insight.
- Gợi ý hành động kỳ tới.
- Phát hiện chỗ thiếu dữ liệu.
- Dịch Việt/Anh.

Mọi nội dung AI thêm vào phải có trạng thái tracking trong version history, ví dụ `Generated by AI, edited by Tuấn`.

## 6.6. Cột phải — Data, Review và AI

### Tabs đề xuất

```text
[Data] [Approval] [Comments] [AI Insights] [Version]
```

### Data tab

```text
┌────────────────────────────────────────┐
│ Data Sources                            │
│ ☑ Meta Ads · Synced 09:00               │
│ ☑ Google Ads · Synced 08:55             │
│ ☑ GA4 · Synced 09:02                    │
│ ☑ CRM Leads · Synced 09:05              │
│ ⚠ Search Console · Data delayed         │
│                                        │
│ [Refresh all] [Manage mappings]         │
├────────────────────────────────────────┤
│ KPI Snapshot                            │
│ Leads            1,286   +18%           │
│ Qualified leads    412   +12%           │
│ CPL             126,000đ  -8%           │
│ Spend         162,000,000đ +4%          │
│ ROAS              3.4   +0.2            │
│                                        │
│ [Open Data Explorer]                    │
└────────────────────────────────────────┘
```

### Approval tab

```text
┌────────────────────────────────────────┐
│ Approval Workflow                       │
│                                        │
│ ● Draft                                 │
│ ○ In Review                             │
│ ○ Approved                              │
│ ○ Sent                                  │
│                                        │
│ Owner: Tuấn                             │
│ Approver: Nguyễn Minh                   │
│ Due for review: 02/09 · 15:00           │
│                                        │
│ [Submit for Review]                     │
└────────────────────────────────────────┘
```

### Comments tab

- Comment theo section/block.
- Mentions người dùng.
- Resolve/reopen comment.
- Filter Open/Resolved/By Me.
- Khi click comment, editor scroll đến vùng liên quan.

### AI Insights tab

```text
┌────────────────────────────────────────┐
│ ✦ AI Insights                           │
│                                        │
│ 1. CPL giảm 8% nhưng tỷ lệ qualified    │
│    lead chỉ tăng 2%. Cần kiểm tra form  │
│    hoặc tiêu chí qualification.         │
│    [Thêm vào Executive Summary]         │
│                                        │
│ 2. Meta Ads chiếm 64% spend nhưng chỉ   │
│    tạo 48% conversion.                  │
│    [Thêm vào Recommendations]           │
│                                        │
│ 3. Ticket P1 ngày 19/08 có thể ảnh      │
│    hưởng ước tính 36–48 lead.           │
│    [Thêm vào Risks]                     │
│                                        │
│ [Generate more insights]                │
└────────────────────────────────────────┘
```

Yêu cầu: AI insight phải cho phép người dùng xem data references hoặc methodology, tránh biến insight thành kết luận không kiểm chứng.

## 6.7. Report preview

Preview mở toàn màn hình hoặc side-by-side:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Editor         Preview: Monthly Marketing Report — 08/2026       │
│ [Desktop] [PDF] [Client Portal]                            [Export PDF]    │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                         ABC LAND                                           │
│                  MONTHLY MARKETING REPORT                                  │
│                         August 2026                                        │
│                                                                            │
│  Executive Summary                                                         │
│  ...                                                                       │
│                                                                            │
│  KPI Overview                                                              │
│  [Charts and data blocks rendered as client-facing report]                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

Preview cần có lựa chọn:

- Xem theo giao diện Desktop/Tablet/Mobile.
- Xem bản PDF print layout.
- Xem client portal mode.
- Kiểm tra lỗi layout, text overflow, missing data, broken links.

## 6.8. Submit for review modal

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Submit Report for Review                                             │
├─────────────────────────────────────────────────────────────────────┤
│ Report: Monthly Marketing Report — 08/2026 · v1.0                    │
│ Client: ABC Land                                                     │
│                                                                      │
│ Select approver *                                                   │
│ [Nguyễn Minh — Marketing Manager ▾]                                 │
│                                                                      │
│ Review deadline                                                     │
│ [02/09/2026] [15:00]                                                │
│                                                                      │
│ Message to approver                                                 │
│ [Anh xem giúp phần KPI và đề xuất ngân sách tháng tới...]           │
│                                                                      │
│ Checklist                                                            │
│ [✓] Đã kiểm tra data sources                                        │
│ [✓] Đã xử lý comment cũ                                             │
│ [ ] Tôi xác nhận nội dung sẵn sàng review                           │
│                                                                      │
│                                      [Cancel] [Submit for Review]   │
└─────────────────────────────────────────────────────────────────────┘
```

## 6.9. Send report modal

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Send Report to Client                                                       │
├────────────────────────────────────────────────────────────────────────────┤
│ Report: Monthly Marketing Report — 08/2026 · v1.0 · Approved               │
│                                                                            │
│ Delivery channels                                                          │
│ [✓] Email     [✓] Client Portal     [ ] Client Chat                        │
│                                                                            │
│ To *                                                                       │
│ [Nguyễn An <an@abcland.vn>]                                                │
│ CC                                                                         │
│ [marketing@abcland.vn]                                                     │
│                                                                            │
│ Email subject                                                              │
│ [Báo cáo Marketing tháng 08/2026 — ABC Land]                              │
│                                                                            │
│ Message                                                                    │
│ [Chào Anh/Chị An, Agency PTT gửi báo cáo hoạt động marketing tháng...]    │
│                                                                            │
│ Include                                                                    │
│ [✓] PDF report  [✓] Dashboard link  [ ] Excel appendix                    │
│                                                                            │
│ Send timing                                                                │
│ [● Send now] [○ Schedule]                                                  │
│                                                                            │
│                               [Save Draft] [Send Report]                   │
└────────────────────────────────────────────────────────────────────────────┘
```

Nếu report có thông tin nhạy cảm hoặc email template cần phê duyệt, CTA `Send Report` thay bằng `Request Send Approval`.

## 6.10. Report Builder responsive

### Tablet

- Outline chuyển thành drawer trái.
- Data/Approval/Comments chuyển thành drawer phải hoặc tabs dưới header.
- Editor full width là ưu tiên.

### Mobile

- Không hỗ trợ chỉnh sửa report phức tạp đầy đủ trong MVP mobile.
- Hỗ trợ xem report, comment, approve/reject, chỉnh sửa text đơn giản và gửi lại review.
- Block chart/data mở trong modal toàn màn hình.
- Các hành động chính nằm trong bottom action bar: Save, Comment, Review/Approve.

---

# 7. Shared Interaction Patterns

## 7.1. Quick Create Menu

```text
┌─────────────────────────────┐
│ + Tạo mới                   │
├─────────────────────────────┤
│ ▣ Ticket                    │
│ ◌ Cuộc trò chuyện            │
│ ✉ Email                     │
│ ◫ Báo cáo                   │
│ ◉ Khách hàng                │
│ ▧ Dự án                     │
│ ◈ Campaign                   │
└─────────────────────────────┘
```

Khi người dùng tạo từ một màn hình có context, form nên tự điền Client, Project, Campaign hoặc Ticket liên quan.

## 7.2. Global Search và Command Palette

```text
┌──────────────────────────────────────────────────────────────────┐
│ ⌕ Tìm khách hàng, ticket, email, chat, report...                  │
├──────────────────────────────────────────────────────────────────┤
│ Recent                                                             │
│ PTT-1032 Website không nhận lead                                   │
│ ABC Land — Lead Gen Q3                                             │
│ Monthly Marketing Report — 08/2026                                 │
├──────────────────────────────────────────────────────────────────┤
│ Quick actions                                                      │
│ + Create Ticket                                                    │
│ + Start New Chat                                                   │
│ + Generate Report                                                  │
│ ✦ Ask AI about current client                                      │
└──────────────────────────────────────────────────────────────────┘
```

Search result cần có entity icon, type, client/project context, status và deep-link.

## 7.3. Entity Context Bar

Dùng ở Ticket Detail, Chat, Email và Report:

```text
[ABC Land]  /  [Website Revamp]  /  [Lead Gen Q3]  /  [Contract: Premium Growth]
```

- Entity pill clickable.
- Hover hiển thị summary card.
- User có quyền có thể thay đổi context qua `Change context`.

## 7.4. AI Interaction Pattern

### Quy ước AI

- Màu Violet/Purple.
- Luôn có icon ✦ và nhãn “AI”.
- Hiển thị nguồn context/dữ liệu khi có thể.
- Không auto-send ra ngoài.
- Có hành động `Apply`, `Insert`, `Copy`, `Regenerate`, `View Sources`.
- Các thao tác tạo entity/chỉnh trạng thái phải có review modal.

### AI drawer mẫu

```text
┌───────────────────────────────────────────────┐
│ ✦ AI Copilot                            [×]    │
│ Context: ABC Land · Website Revamp             │
├───────────────────────────────────────────────┤
│ [Ask] [Summary] [Draft] [Insights] [Actions]  │
│                                               │
│ Bạn muốn AI hỗ trợ gì?                         │
│ [Tóm tắt ticket P1 và soạn phản hồi client...]│
│                                               │
│ [Generate]                                    │
├───────────────────────────────────────────────┤
│ AI Draft                                       │
│ ...                                           │
│                                               │
│ [Insert] [Copy] [Regenerate] [View context]  │
└───────────────────────────────────────────────┘
```

## 7.5. Notification Center

```text
┌──────────────────────────────────────────┐
│ Notifications                    [Mark all read] │
├──────────────────────────────────────────┤
│ 🔴 SLA breach: PTT-1008 quá hạn 14 phút  │
│    ABC Land · Assigned to Minh            │
│    [Mở ticket]                            │
│                                          │
│ 🟣 Minh requested review report           │
│    Monthly Ads Report — Beauty Home       │
│    [Review]                               │
│                                          │
│ 💬 Nguyễn An mentioned you                │
│    “@Tuấn, ETA xử lý form là bao lâu?”    │
│    [Reply]                                │
└──────────────────────────────────────────┘
```

---

# 8. UX Rules và Validation

## 8.1. Nội dung client-facing

- Mọi CTA gửi ra ngoài phải có nhãn rõ: `Gửi cho khách hàng`, `Send Report`, `Send Email`.
- Composer ticket phải mặc định giữ loại comment cuối cùng của user, nhưng với ticket client-facing cần visual reminder.
- Nếu người dùng đính kèm file Internal vào Public Reply, hệ thống chặn thao tác và yêu cầu đổi quyền file hoặc chọn file khác.
- Khi gửi report/email, hiển thị danh sách người nhận, file đính kèm, version và kênh gửi để người dùng rà soát.

## 8.2. Validation ticket

| Tình huống | UX xử lý |
|---|---|
| Ticket thiếu title | Inline error dưới field, focus field khi submit |
| P1 chưa có assignee | Chặn chuyển In Progress/Resolve; gợi ý assign on-call team |
| Ticket Out of Scope | Hiện banner cảnh báo; yêu cầu lý do và approval trước khi Start Work |
| Resolve không có resolution note | Chặn resolve, hiển thị field bắt buộc |
| SLA breach | Sticky banner đỏ ở header; CTA Escalate/Notify Manager |
| Client acceptance chưa xong | Chỉ Manager hoặc policy automation mới được close ticket |

## 8.3. Validation report

| Tình huống | UX xử lý |
|---|---|
| Chưa chọn reporting period | Không cho tạo report; hiển thị required state |
| Data source lỗi | Badge warning tại section và Data tab; không chặn draft nhưng chặn submit review nếu là KPI bắt buộc |
| Report chưa approved | Nút Send disabled hoặc chuyển thành Request Approval |
| Có unresolved comments | Cảnh báo khi submit review; policy có thể cho phép submit kèm warning |
| Report đã sent | Disable direct editing; CTA Create Revised Version |
| Thiếu người nhận khi gửi | Inline validation tại To field |

## 8.4. Empty states

### Ticket list rỗng

```text
Chưa có ticket nào trong bộ lọc này.
[Tạo ticket mới] [Xóa bộ lọc]
```

### Conversation chưa có tin nhắn

```text
Bắt đầu trao đổi trong kênh này.
Bạn có thể @mention thành viên, đính kèm file hoặc tạo ticket từ tin nhắn.
[Viết tin nhắn]
```

### Report chưa có dữ liệu

```text
Chưa có dữ liệu KPI được nạp.
[Chọn data source] [Nhập thủ công] [Tạo cấu trúc từ template]
```

---

# 9. Accessibility Requirements

- Màu sắc không phải dấu hiệu duy nhất cho status; sử dụng text + icon + color.
- Contrast text/nền phải đủ rõ cho nội dung quan trọng.
- Hỗ trợ keyboard navigation cho sidebar, search, ticket actions, chat composer và report editor.
- Focus state rõ ràng.
- Tooltip cho icon-only buttons.
- ARIA label cho button, status chip, avatar, action menu.
- Có khả năng phóng to trình duyệt mà không vỡ layout quan trọng.
- Không dùng animation mạnh với SLA breach hoặc notification; cho phép user giảm motion.
- Attachment cần hiển thị tên file và loại file, không chỉ icon.

---

# 10. Handoff cho đội UI/Frontend

## 10.1. Danh sách màn hình cần thiết kế

| Nhóm | Màn hình/Trạng thái |
|---|---|
| Global | Sidebar expanded/collapsed, Topbar, Search, Command Palette, Notification Center, AI Drawer |
| Dashboard | Account/PM Dashboard, Director Dashboard, Client Dashboard, Empty/loading/error states |
| Ticket | Ticket List, Kanban Board, Ticket Detail, Create Ticket, Assign, Change Status, Resolve, Escalate, Client Acceptance |
| Chat | Conversation List, Conversation Detail, New Chat, Add Members, Chat Info, Message Actions, Create Ticket from Message |
| Reports | Report List, Report Builder, Add Block, Data Explorer, Preview, Submit Review, Review/Approve, Send Report, Version History |
| Shared | Entity Context Bar, File Picker, User Picker, Date Range, SLA Badge, Approval Timeline, Comment Thread |

## 10.2. Trạng thái UI bắt buộc

Mỗi component/màn hình phải có các trạng thái:

- Default.
- Hover.
- Focus.
- Active.
- Disabled.
- Loading/skeleton.
- Empty.
- Error.
- Permission denied.
- Offline/retry nếu áp dụng.
- Success confirmation.

## 10.3. Prototype flows ưu tiên

1. Client Chat → Create Ticket → Assign → Public Reply → Resolve → Client Acceptance → Close.
2. Email inbound → Match Client → Create Ticket → SLA alert.
3. Dashboard → SLA risk ticket → Escalate → Notify PM/Account.
4. Create Report → Insert KPI/Data → Generate AI insight → Submit Review → Approve → Send via Email/Portal.
5. Client Portal → View report → View ticket → Reply/Upload file → Approve deliverable.

---

# 11. Design Tokens đề xuất

```text
--color-brand-50
--color-brand-100
--color-brand-500
--color-brand-600
--color-brand-700

--color-success-50
--color-success-500
--color-warning-50
--color-warning-500
--color-danger-50
--color-danger-500
--color-ai-50
--color-ai-500
--color-internal-50
--color-internal-500

--font-size-xs: 12px
--font-size-sm: 14px
--font-size-md: 16px
--font-size-lg: 20px
--font-size-xl: 28px

--space-1: 4px
--space-2: 8px
--space-3: 12px
--space-4: 16px
--space-5: 24px
--space-6: 32px

--radius-sm: 6px
--radius-md: 8px
--radius-lg: 12px

--shadow-sm
--shadow-md
--z-sidebar
--z-topbar
--z-dropdown
--z-modal
--z-toast
```

---

# 12. Acceptance Criteria UX tổng quát

## Dashboard

- Người dùng xác định được ít nhất 3 việc ưu tiên và ticket SLA risk trong dưới 15 giây sau khi mở dashboard.
- Click từ KPI card đến danh sách đã lọc đúng theo chỉ số trong một thao tác.
- Account Manager thấy rõ các chat/email client chưa phản hồi.
- Director thấy SLA compliance, client risk và report compliance mà không cần đi vào từng module.

## Ticket Detail

- Người dùng nhận biết được ticket đang ở trạng thái nào, ai xử lý và còn bao lâu SLA trong dưới 5 giây.
- User không thể nhầm lẫn Public Reply với Internal Note.
- Từ một ticket, user có thể mở client/project/campaign, chat, email và report liên quan trong tối đa 2 thao tác.
- User có thể resolve ticket có đầy đủ resolution note, evidence và thông báo client mà không phải chuyển màn hình.

## Chat

- User có thể tìm conversation, gửi tin, reply và tạo ticket từ message trong tối đa 3 thao tác chính.
- Khi tin nhắn đã tạo ticket, liên kết ticket hiển thị trực tiếp dưới message.
- User thấy context client/project/campaign và các ticket liên quan mà không rời chat.
- AI summary phân biệt rõ summary, action item và risk.

## Report Builder

- Account có thể tạo report từ template, chọn data source và thêm section trong dưới 5 phút.
- Reviewer có thể comment/approve/request changes mà không cần trao đổi ngoài hệ thống.
- Chỉ report Approved mới có thể được gửi ra khách hàng, trừ quyền bypass được cấu hình.
- Report đã gửi luôn giữ version history; chỉnh sửa sau gửi phải tạo revised version.

---

# 13. Lộ trình thiết kế UX/UI

## Phase 1 — Core Operations

- App shell: sidebar, topbar, search, notification.
- Dashboard Account/PM.
- Ticket List, Kanban, Ticket Detail.
- Public Reply/Internal Note.
- Chat client/project cơ bản.
- Create Ticket from Message.
- Report list và Report Builder template cơ bản.

## Phase 2 — Collaboration & Client Portal

- Client dashboard/portal.
- Chat context panel nâng cao.
- Report approval/comment/versioning.
- Unified Inbox.
- Email composer/inbox gắn CRM context.
- SLA Monitor và escalation UX.

## Phase 3 — AI & Advanced Insights

- AI Copilot drawer.
- AI ticket classification/draft reply.
- AI chat summary/action extraction.
- AI report insight/draft narrative.
- Client health scoring và risk explanation.
- Workload/resource planning visualization.

---

# 14. Ghi chú triển khai Figma

1. Tạo Figma library gồm color styles, typography styles, spacing, buttons, form controls, badge, cards, table, timeline và modal.
2. Dùng Auto Layout cho toàn bộ layout card, list, message item, ticket metadata và report blocks.
3. Tạo variants cho Button, Status Chip, SLA Badge, Ticket Priority, Message Type và Approval State.
4. Thiết kế breakpoint tối thiểu: Desktop 1440px, Laptop 1280px, Tablet 1024px, Mobile 390px.
5. Tạo prototype tương tác cho 5 luồng ưu tiên tại phần Handoff.
6. Chuẩn hóa icon set, ví dụ Lucide Icons hoặc Material Symbols; không pha trộn nhiều bộ icon.
7. Đặt naming convention nhất quán, ví dụ `Ticket/Status/InProgress`, `SLA/NearBreach`, `Message/InternalNote`, `Report/Block/KPIChart`.
8. Trong file Figma, phân tách rõ: `00 Foundations`, `01 Components`, `02 Patterns`, `03 Desktop Screens`, `04 Tablet Screens`, `05 Mobile Screens`, `06 Prototype Flows`, `07 Dev Handoff`.

---

# 15. Next Deliverables

Từ wireframe này, các đầu ra tiếp theo nên được thực hiện theo thứ tự:

1. Thiết kế UI high-fidelity theo brand identity của Agency PTT.
2. Figma component library và design token chính thức.
3. Clickable prototype cho 5 luồng nghiệp vụ ưu tiên.
4. UX copy chi tiết cho button, tooltip, validation, empty state và notification.
5. Frontend specification: responsive grid, component props, API loading state, permission state.
6. Usability test với Account, PM, Team Member và 1–2 khách hàng thật.
7. Điều chỉnh trước khi chuyển sang implementation React/Next.js hoặc frontend stack của Agency PTT.

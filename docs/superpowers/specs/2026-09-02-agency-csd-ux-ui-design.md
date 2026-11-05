# UX/UI — Agency PTT Communication & Service Desk

> **Document ID:** CSD-UX-20260902  
> **Phiên bản:** 1.0 · **Ngày:** 2026-09-02  
> **Trạng thái:** Design — desktop-first trong ops-web  
> **Parent:** [Spec CSD](./2026-09-02-agency-communication-service-desk-design.md)  
> **Use case:** [Use case CSD](./2026-09-02-agency-csd-use-cases.md)  
> **Nguồn wireframe:** [Wireframe gốc v1.0](./sources/Wireframe_UX_UI_Agency_PTT_Communication_Service_Desk.md)  
> **Shell:** Tái dùng layout ops-web (sidebar + topbar + `page-card`). Không invent app chrome thứ hai.

---

## 0. Mục tiêu UX

Người vận hành (AM, PM, team) xử lý chat / ticket / email / báo cáo **trong một ngữ cảnh khách** mà không nhảy 5 tab và không gửi nhầm nội bộ ra khách.

| Nguyên tắc | Hiện thực trong ops-web |
|------------|-------------------------|
| Context-first | Entity pills Client / Project / Campaign trên mọi trang CSD |
| Action-first | Một CTA chính / vùng; Quick Create `+` đã có pattern Segmented/btn |
| Internal vs Client | Nền slate + icon khóa vs nền trắng + nhãn “Gửi khách hàng” |
| SLA visible | Chip text+màu+icon; P1/Breach sticky banner |
| AI copilot | Violet, nhãn AI Draft, không auto-send |
| Operational density | Bảng + hàng, không card marketing |
| Permission-aware | Ẩn nút; empty `403` không đoán cap |

**Không làm:** dark hero, auto-scroll sang panel khác, badge “Stub” cho user.

---

## 1. Design system — map token ops-web

Dùng biến đã có (`--muted`, `.btn`, `.data-table`, `.page-card`). Bổ sung semantic CSD:

| Semantic | Class / token | Dùng |
|----------|---------------|------|
| Brand | `.btn-primary` hiện tại | CTA |
| Success | xanh `#166534` / `#f0fdf4` | Resolved, Approved, On Track |
| Warning | `#b45309` / `#fef3c7` | At Risk, Waiting |
| Danger | `#991b1b` / `#fee2e2` | P1, Breached |
| Info | `#1e3a8a` / `#eff6ff` | In Progress |
| AI | `#5b21b6` / `#f5f3ff` | AI Draft |
| Internal | `#334155` / `#f1f5f9` | Internal note |

Typography: 14px body (globals). Title trang: 1.25–1.5rem. Spacing 4/8/12/16/24. Radius 8–12 như tower/briefing.

Chip status **luôn** có chữ, không chỉ màu (a11y).

---

## 2. App shell CSD

### 2.1. Sidebar — nhóm mới

Chèn dưới CRM, trên CEO nếu có:

```text
Service Desk
  ├─ Tổng quan          /crm/csd
  ├─ Chat               /crm/csd/chat          badge unread client
  ├─ Email              /crm/csd/email         badge unmatched
  ├─ Ticket             /crm/csd/tickets       badge at-risk
  ├─ SLA                /crm/csd/sla
  ├─ Báo cáo            /crm/csd/reports       badge due
  └─ Duyệt              /crm/csd/approvals     badge pending
```

Admin: `/admin/crm/csd` (SLA, mailbox, template) — chỉ `csd.admin`.

### 2.2. Top bar (tái dùng)

Giữ search + user menu. Thêm trong CSD:

- Quick Create: Ticket, Chat, Email, Báo cáo (context-aware: đang mở ABC Land thì form điền sẵn).  
- Command `⌘K`: tìm ticket code, client, report, conversation.  
- Chuông: feed `csd_notifications` + notification hệ sẵn có; P1 lên đầu, không gộp.

### 2.3. Page header chuẩn CSD

```text
Breadcrumb          Entity pills          Primary CTA
Tiêu đề + subtitle  Status/SLA chips      Overflow ⋯
```

---

## 3. Dashboard `/crm/csd`

### 3.1. Câu hỏi 15 giây

Hôm nay làm gì? Ticket nào gần vỡ SLA? Báo cáo nào đến hạn? Chat/email khách nào chưa trả?

### 3.2. Layout desktop 1440

```text
┌ KPI × 4 ─────────────────────────────────────────────────────────┐
│ Cần xử lý | SLA rủi ro | Báo cáo hạn | Chat/Email chờ            │
├────────────── 2fr ──────────────┬──────────── 1fr ───────────────┤
│ Việc ưu tiên hôm nay (5–10)     │ SLA stack + Báo cáo đến hạn    │
├─────────────────────────────────┼────────────────────────────────┤
│ Client cần chú ý (top 5)        │ Unified inbox (8 dòng)         │
└─────────────────────────────────┴────────────────────────────────┘
│ Team workload (PM/Director only)                                 │
```

### 3.3. KPI cards — click = list đã lọc

| Card | Filter đích |
|------|-------------|
| Cần xử lý | status ∈ New, Assigned, In Progress + scope user |
| SLA rủi ro | sla_status ∈ at_risk, near_breach, breached |
| Báo cáo hạn | report due ≤ 7 ngày, status ≠ Sent |
| Chưa phản hồi | inbox items `needs_response=true` |

Mỗi card: số, delta vs hôm qua, 1 CTA.

### 3.4. Việc ưu tiên — sort cứng

1. Priority P1→P4  
2. SLA Near Breach / Breached trước At Risk  
3. Due gần nhất  
4. Complaint/escalation flag  
5. Thời gian chờ phản hồi  

Dòng: `[P] code · title` / client · category · SLA còn lại · @assignee · `[Mở]` `[Nhận]`

Copy empty: “Không có việc trong bộ lọc. [Tạo ticket] [Xóa lọc]”

### 3.5. Role variants

| Role | Ẩn |
|------|----|
| Team Member | Client health, workload team; chỉ “Việc của tôi” |
| Account | Workload optional |
| PM | Đủ |
| Director | Thêm compliance %; ẩn composer nhanh |
| Finance | Card billing ticket + report ngân sách |

### 3.6. Responsive

- Tablet: KPI 2×2; cột phải xuống dưới.  
- Mobile: việc ưu tiên trên cùng; KPI horizontal scroll; không hiện chart phức tạp.

### 3.7. AC UX Dashboard

User chỉ ra ≥3 việc + 1 SLA risk trong 15 giây. Click KPI → URL query khớp filter.

---

## 4. Ticket

### 4.1. List `/crm/csd/tickets`

Bảng `.data-table`:

| Cột | Ghi chú |
|-----|---------|
| Mã | Link detail |
| Tiêu đề | 1 dòng |
| Client | pill |
| Loại | |
| P | chip |
| Status | chip |
| SLA | On Track / At Risk / Near / Breach / Paused + thời gian còn |
| Assignee | avatar |
| Cập nhật | relative |

Filter: status, priority, sla, client, assignee, source, factory=A.  
Tab: Tất cả | Của tôi | Unassigned | Chờ khách | Breach.  
View switch: List | Board.

### 4.2. Board `/crm/csd/tickets/board`

Cột: New | Triaged | Assigned | In Progress | Waiting | Resolved | Closed.  
Kéo thả = đổi status **nếu** transition hợp lệ; không thì toast + revert.  
Card: code, title, P, SLA bar, assignee.

### 4.3. Create Ticket — modal / drawer

Field bắt buộc: title, type, client (agency), priority.  
Optional: project, campaign, assignee, files, description.  
Source hiện sẵn nếu từ chat/email.  
Footer: `[Hủy] [Lưu nháp] [Tạo ticket]`  
Lỗi: inline dưới field. P1 chưa assignee: warning “Sẽ vào Unassigned + notify on-call”, không chặn tạo.

### 4.4. Detail — 3 cột desktop

**Trái (280px):** Status, Priority, SLA card, Assignment, Client/Project, Tags, Scope, Due/ETA, Watchers.

SLA card:

```text
SLA  Near Breach
Response  ✓ 6 phút
Resolution  ████░░ 82%
Còn 42 phút · đến 13:18 hôm nay
[Xem lịch sử]
```

**Giữa:** Tabs Conversation | Activity | Work log | Emails | Approval.  
Composer sticky trên (hoặc dưới timeline — **không** scroll cả trang đi chỗ khác khi đổi Public/Internal).

Public mặc định trên ticket client-facing: nhãn đỏ/xanh **“Gửi cho khách hàng”**.  
Internal: nền slate, “Chỉ đội Agency”.

Toolbar: đính kèm, mention, template, AI Draft, lưu nháp, Gửi.

**Phải (300px):** Client card (tên, health nếu có, AM, open tickets), Related (project, tickets, emails, reports), AI card, Attachments, Time.

### 4.5. Header actions theo status

| Status | CTA chính |
|--------|-----------|
| New | Phân loại |
| Triaged | Giao việc |
| Assigned | Bắt đầu |
| In Progress | Xử lý xong / Hỏi khách |
| Waiting for Client | Nhắc khách / Tiếp tục |
| Resolved | Yêu cầu nghiệm thu |
| Client Acceptance | Đóng |
| Closed | Mở lại |

Overflow: Duplicate, Merge, Split, Export, Escalate. Delete chỉ admin.

### 4.6. Resolve modal

- Resolution summary *  
- Evidence (link/file)  
- `[x] Gửi Public Reply`  
- `[x] Yêu cầu nghiệm thu`  
- Status sau: Client Acceptance (default)  
- `[Hủy] [Resolve & Send]`

Chặn nếu thiếu note. File internal không tick gửi khách.

### 4.7. Validation UX

| Tình huống | UI |
|------------|-----|
| Thiếu title | Inline + focus |
| P1 Start Work chưa assignee | Chặn + gợi ý assign |
| Out of Scope Start Work | Banner + yêu cầu lý do/approval |
| SLA breach | Sticky banner đỏ header, CTA Escalate |
| Close khi chưa acceptance | Chỉ manager / auto-close policy |

### 4.8. Responsive ticket

Tablet: trái collapse; phải thành tab Context/AI.  
Mobile: tabs Details | Chat | Activity | AI; bottom bar Reply / Note / Status. **Không** builder report trên mobile.

### 4.9. AC Ticket Detail

5 giây biết status, assignee, SLA. Không nhầm Public/Internal. Mở client/project/chat/email ≤ 2 click. Resolve xong không đổi route.

---

## 5. Chat `/crm/csd/chat`

### 5.1. 3 vùng

| Trái 280 | Giữa | Phải 300 |
|----------|------|----------|
| Pinned, Clients, Projects, Internal, DM | Header + timeline + composer | Info, Tickets, Files, AI |

### 5.2. Conversation item

Avatar, tên, 1 dòng preview, time, unread, dot đỏ nếu P1/complaint.  
Filter chips: All Unread Clients Projects Internal Mentions.

Client list: sort unread → risk → recency.

### 5.3. Message

Hover: Reply, React, **Tạo ticket**, Copy link, Forward, More.  
Đã có ticket: pill dưới message, click mở detail **cùng tab** (không scroll dashboard).

Client Chat composer: banner “Bạn đang gửi cho khách hàng”.  
Closed: composer disabled, CTA Mở lại.

Phím: Enter gửi, Shift+Enter xuống dòng, `@` mention, `#` gợi ý ticket.

### 5.4. Tạo ticket từ message — modal

Source line (conversation / author / time).  
Title, category, priority, client/project (prefill), assign, description + permalink.  
`[ ] Gửi xác nhận tiếp nhận cho khách`.  
Trùng source: dialog “Đã có PTT-… [Mở] [Tạo ticket con]”.

### 5.5. AI Summary tab

Period: 24h / 7d / all.  
Khối tách: Tóm tắt | Quyết định | Action items (checkbox) | Rủi ro.  
`[Tạo ticket] [Copy]` — Apply từng item, không tạo hàng loạt im lặng.

### 5.6. Mobile chat

Màn 1 list, màn 2 thread. Context = bottom sheet `i`. Long-press action sheet.

### 5.7. AC Chat

Tìm + gửi + tạo ticket ≤ 3 thao tác. Ticket pill hiện ngay. Context CRM không rời chat.

### 5.8. Hộp thoại nổi (dock)

Nút Chat góc phải mọi trang `StaffPageShell` trừ `/crm/csd/chat`. Một thread, poll 15s, persist `sessionStorage`. Chi tiết: [spec dock Zalo](./2026-09-02-csd-chat-dock-zalo-design.md).

### 5.9. Tài khoản + kết bạn

Admin cấp `csd_chat_accounts` tại `/admin/crm/csd/chat-accounts`. Đăng nhập `/login`. DM mới cần bạn `accepted`; hội thoại cũ vẫn đọc (Z16). Group / khách / dự án không cần kết bạn.

---

## 6. Email `/crm/csd/email`

### 6.1. Inbox

Cột trái: mailbox Support / Report.  
List: Unread, Assigned to me, Unmatched, Needs response, Has ticket.  
Thread view giữa. Panel phải: match client, ticket liên kết, CTA Tạo ticket / Gắn ticket / Assign.

Unmatched: hàng đợi riêng `/crm/csd/email/unmatched` — bắt buộc chọn client trước khi tạo ticket.

### 6.2. Composer (drawer)

Từ Client, Ticket, Report: prefill To + link entity.  
To/CC/BCC, mailbox, template, attach, schedule, lưu nháp.  
Subject từ ticket tự có `[PTT-…]`.  
Từ khóa nhạy cảm: CTA đổi `Gửi` → `Gửi duyệt`.  
Preview người nhận + file + version trước send.

Failed: banner + Retry. Không đánh dấu ticket “đã trả lời”.

---

## 7. Report Builder `/crm/csd/reports/:id`

### 7.1. 3 cột

**Trái:** Outline section + add block + badge thiếu data.  
**Giữa:** Editor blocks (rich text, KPI thủ công, bảng, ảnh, ticket rollup).  
**Phải:** Data (phase 1: ticket rollup + manual KPI) | Approval | Comments | AI | Version.

### 7.2. Header CTA theo status

| Status | Chính |
|--------|--------|
| Draft | Lưu, AI nháp, Gửi duyệt |
| In Review | Xem comment (owner); Approve (approver) |
| Changes Requested | Sửa, Gửi lại |
| Approved | Xuất PDF, Gửi khách |
| Sent | Tạo bản sửa, Xem log |

Sent: editor **read-only**. CTA duy nhất “Tạo phiên bản sửa”.

### 7.3. Modals

**Submit review:** approver *, deadline, message, checklist “sẵn sàng review” bắt buộc.

**Send:** kênh Email [x], Chat [ ], Portal disabled MVP. To *, subject, body, PDF [x], Send now / Schedule.  
Chưa Approved: nút Send disabled hoặc “Xin duyệt gửi”.

### 7.4. Preview

Full page: Desktop / PDF. Kiểm tra missing data badge trước export.

### 7.5. Mobile

Chỉ xem + comment + approve/reject. Không kéo thả section.

### 7.6. AC Report

Tạo từ template + period + 1 section trong 5 phút (data tay). Reviewer comment không cần kênh ngoài. Chỉ Approved mới gửi. Version history giữ bản Sent.

---

## 8. Pattern dùng chung

### 8.1. Entity context bar

`[ABC Land] / [Website Revamp] / [Lead Gen Q3]`  
Click → 360. Hover summary. `Đổi ngữ cảnh` nếu có quyền.

### 8.2. AI drawer

Tabs Ask | Summary | Draft | Insights | Actions.  
Output: Insert, Copy, Regenerate, View sources.  
Apply entity = review modal (field diff).  
Gửi khách = Confirm 2 bước.

### 8.3. Notification center

P1 đỏ trên cùng. Group 5–15 phút trừ P1/SLA.  
Item: icon, 1 dòng, client, CTA Mở.

### 8.4. Quick Create

Ticket / Chat / Email / Báo cáo. Prefill từ trang hiện tại.

### 8.5. Empty / error / 403

- Empty: 1 câu + 1–2 CTA.  
- Error load: Retry.  
- 403: “Không có quyền xem Service Desk” — không liệt kê ticket.  
- Offline chat: banner, queue local, gửi lại.

---

## 9. Copy tiếng Việt (chuẩn)

| Chỗ | Copy |
|-----|------|
| Public send | Gửi cho khách hàng |
| Internal | Ghi chú nội bộ — khách không thấy |
| Create from chat | Tạo ticket từ tin nhắn |
| Duplicate ticket | Ticket đã tồn tại từ tin này |
| AI | Bản nháp AI — kiểm tra trước khi dùng |
| SLA pause | Tạm dừng SLA vì chờ khách |
| Report sent | Báo cáo đã gửi — sửa sẽ tạo phiên bản mới |
| Unmatched email | Chưa khớp khách — chọn client trước |

Không dùng “Stub”, “Drill”, “Queue xử lý” kiểu demo. Dùng “Hàng chờ”, “Phân loại”, “Giao việc”.

---

## 10. Trạng thái UI bắt buộc / màn

Default, hover, focus, active, disabled, skeleton, empty, error, 403, success toast.

Màn phải design (handoff Figma / implement):

| Nhóm | Màn |
|------|-----|
| Global | Sidebar CSD, Quick Create, ⌘K, Notification, AI drawer |
| Dashboard | AM/PM, Team, Director, empty |
| Ticket | List, Board, Create, Detail, Assign, Resolve, Escalate |
| Chat | List, Thread, New, Members, Create ticket modal |
| Email | Inbox, Unmatched, Composer, Approval |
| Report | List, Builder, Preview, Submit, Send, Versions |
| Shared | Entity bar, File picker, SLA badge, Comment |

Prototype 5 luồng (wireframe gốc §10.3) — test UAT:

1. Client Chat → Ticket → Assign → Public Reply → Resolve → (email nghiệm thu) → Close.  
2. Email inbound → Match → Ticket → SLA alert.  
3. Dashboard → SLA risk → Escalate.  
4. Report template → review → approve → send email.  
5. Phase 2: portal (không prototype MVP).

---

## 11. A11y & mật độ

- Keyboard: sidebar, table rows Enter, composer Tab, modal Esc.  
- Focus ring rõ. Icon-only có `aria-label`.  
- SLA không chỉ màu.  
- `prefers-reduced-motion`: không pulse banner.  
- File: hiện tên + loại, không chỉ icon.

---

## 12. Lộ trình UI

| Phase | Màn |
|-------|-----|
| 1 | Shell + Dashboard AM/PM + Ticket list/detail + Public/Internal |
| 1b | Chat + Create ticket from message |
| 1c | Email inbox/composer |
| 1d | Report builder + approval + PDF + send |
| 2 | Portal client, Unified inbox nâng cao, AI drawer đầy đủ |
| 3 | Health score, workload planner |

---

## 13. Khác biệt với wireframe gốc

| Gốc | Chốt RNOSAI |
|-----|-------------|
| Client portal dashboard MVP | Phase 2 |
| Dark mode ưu tiên | Theo theme ops-web, không làm riêng CSD |
| Auto-pull Ads charts | KPI thủ công + ticket rollup MVP |
| Health score 6 thành phần | Phase 2; MVP chỉ “open P1/P2 + report trễ” |
| App độc lập | Nằm trong ops-web |
| Scroll/jump sang queue | Cấm; filter tại chỗ (bài học Tower) |

# Spec — Agency PTT Communication & Service Desk

> **Document ID:** CSD-20260902  
> **Phiên bản:** 1.0 · **Ngày:** 2026-09-02  
> **Trạng thái:** Plan ready — [`2026-09-02-agency-csd.md`](../plans/2026-09-02-agency-csd.md) · DDL [`2026-09-02-postgresql-ddl-csd.sql`](../../specs/2026-09-02-postgresql-ddl-csd.sql)  
> **Route đề xuất:** `/crm/csd` (hub) · `/crm/csd/tickets` · `/crm/csd/chat` · `/crm/csd/email` · `/crm/csd/reports`  
> **Nguồn BA:** [SRS gốc v1.0](./sources/SRS_Agency_PTT_Communication_Service_Desk.md)  
> **Sibling UX:** [UX/UI](./2026-09-02-agency-csd-ux-ui-design.md) · [Use case](./2026-09-02-agency-csd-use-cases.md)  
> **Hệ đã ship:** [`crm_tickets`](../../../services/ptt-crm-api/src/tickets/tickets-pg.repository.ts) (CSKH) · [RBAC org](../../specs/2026-08-07-rbac-hr-org-job-function-design.md) · [CEO Command](./2026-08-30-ceo-command-oss-chatbox-srs.md) · [Lifecycle Tower](./2026-09-01-ceo-lifecycle-tower-design.md) · [CSKH Enterprise](./2026-08-04-cskh-enterprise-ai-wave-design.md)  
> **Quy tắc AI cứng:** **BR-AI-01** — không auto-send Zalo/email/chat ra khách. AI chỉ draft / suggestion.

---

## 0. Tóm tắt điều hành

Agency PTT đang vận hành trên RNOSAI: Lead → HĐ → TMMT → Deliver → Retain (Factory A) và CSKH spa (Factory B). Giao tiếp và yêu cầu sau bán **vẫn phân tán**: Zalo/Messenger/email cá nhân, “sửa nhanh” không thành đầu việc, báo cáo gửi tay, không có SLA chung cho yêu cầu khách.

**Communication & Service Desk (CSD)** là lớp **single source of truth** cho:

1. Chat nội bộ + chat khách (native, không omnichannel MVP).  
2. Ticket yêu cầu / incident / change / complaint — **khác** ticket CSKH hiện tại.  
3. Email CRM-centric (shared mailbox + composer từ entity).  
4. Báo cáo định kỳ có template, version, duyệt, gửi.

**Pitch 1 câu:** Mọi tin nhắn / email / form thành ticket có SLA; mọi báo cáo có version và duyệt; AI chỉ soạn nháp — người gửi.

**Không phải:** thay `/crm/tickets` CSKH, không phải CEO ChatBox, không phải Jira/DevOps, không phải tổng đài.

---

## 1. Quyết định đã chốt (từ SRS §23)

Nguồn SRS để 12 mục “cần chốt”. Spec này **chốt mặc định** cho Agency PTT / RNOSAI. Đổi phải ghi phiên bản spec.

| # | Quyết định | Chốt v1.0 | Lý do |
|---|------------|-----------|--------|
| D1 | Khách mục tiêu đầu | **Agency tổng quát** phục vụ Factory A (B2B) + khách hàng đang chạy Ads/SEO/Web/CRM. Factory B (spa) **không** vào CSD MVP — vẫn `/crm/cskh-board` + `crm_tickets` | Tránh trộn SLA 15p/4h/24h CSKH với SLA gói agency |
| D2 | Tenant | **Nội bộ PTT trước.** Schema `tenant_id` bắt buộc; một tenant `PTT` trên VPS. SaaS đa agency = phase 3 | Giống RBAC R1: PostgreSQL-only, một org |
| D3 | Email provider | **Shared mailbox SMTP/IMAP** (`support@`, `report@`) MVP. Google Workspace / M365 OAuth = phase 2 | VPS hiện có SMTP; không chặn MVP vì OAuth |
| D4 | Client portal | **MVP: không portal login.** Client nhận email + Client Chat (nếu được mời). Portal xem ticket/report = phase 2 | Giảm identity client; reuse staff auth |
| D5 | SLA | **Theo gói dịch vụ + loại ticket + priority.** Fallback policy `PTT-DEFAULT` nếu contract chưa map | Không hard-code 1 giờ cho mọi khách |
| D6 | Approval | Báo cáo **tháng/quý bắt buộc duyệt**. Báo cáo tuần: Account tự gửi nếu template `weekly_ops`. Email chứa từ khóa nhạy cảm (§8.5) vào approval queue | Khớp BR-AI-01 + kiểm soát cam kết |
| D7 | Scope | AM/PM đánh giá In / Potentially Out / Out. Out of Scope **không** In Progress nếu chưa duyệt change/quote | Tránh làm miễn phí ngoài HĐ |
| D8 | Kênh chat | **Chat native RNOSAI trước.** Slack/Zalo/Messenger = phase 2 (out of scope SRS §2.2) | Một nguồn tin; CEO ChatBox **không** dùng chung thread |
| D9 | AI policy | **Draft only.** Không gửi khách, không tạo ticket thật, không đổi SLA nếu user chưa Apply + (nếu ra ngoài) Confirm 2 bước | Cùng mô hình CEO Command C |
| D10 | Lưu trữ | **VPS hiện tại:** Postgres + object storage (disk/MinIO). Retention: chat/email 24 tháng; ticket/report 7 năm; audit 7 năm | Self-host đã chạy `rs.pttads.vn` |
| D11 | Tổ chức | Tái dùng **Org → Team → Position → Job function** (RBAC 2026-08-07). Không invent role song song | Account = job function `am`; PM = `pm`; Design/Content/Ads map function hiện có |
| D12 | KPI chính v1 | **Không sót yêu cầu + SLA response.** Upsell/CSAT = phase 2 | Đo được ngay từ ticket + source reference |

---

## 2. Mục tiêu & phạm vi

### 2.1. Mục tiêu sản phẩm

| # | Mục tiêu | Đo thành công |
|---|----------|----------------|
| G1 | Một nơi ghi nhận yêu cầu khách/nội bộ | ≥90% yêu cầu từ chat/email support thành ticket có `source_ref` |
| G2 | SLA nhìn thấy | Response đúng hạn ≥95%; resolution ≥90% trên ticket In Scope |
| G3 | Báo cáo không gửi nhầm version | 100% report Sent có `version` + send log; 0 overwrite bản đã gửi |
| G4 | Nội bộ ≠ khách | 0 internal note / file internal lộ Client Chat hoặc Public Reply (test invariant) |
| G5 | AI không tự hành động ra ngoài | 0 email/chat client do AI gửi; mọi Apply ghi `ai_activity` |
| G6 | Không phá module đã ship | `/crm/tickets` CSKH, `/crm/ceo`, `/crm/cskh-board` giữ nguyên hành vi |

### 2.2. In scope MVP (phase 1)

| Module | Có | Không (cố ý) |
|--------|----|----------------|
| Chat | DM, Group, Client Chat, Project Chat; text/reply/mention/file; Chat→Ticket | Voice note, GIF marketplace, Zalo/Messenger sync |
| Ticket | CRUD, board, public/internal, SLA cơ bản, activity, attachment, assign | Portal client, CSAT survey, predictive breach |
| Email | Shared inbound IMAP, compose+template, Email→Ticket, match contact, sent/failed | Open/click tracking bắt buộc, M365 two-way, BCC analytics |
| Report | Template, builder thủ công, draft/review/approved/sent, PDF, gửi email, version, schedule đơn giản | Auto-pull Meta/GA4 (phase 2), portal publish |
| AI | Tóm tắt chat, classify ticket **nháp**, draft reply **nháp** | Auto-send, RAG knowledge đầy đủ |
| Admin | SLA policy, category, mailbox, template, notification rule | Feature marketplace, no-code workflow |

### 2.3. Out of scope toàn spec (kiến trúc vẫn để chỗ)

Tổng đài/VoIP · ký HĐ điện tử · chấm công · kế toán đầy đủ · Jira/CI · AI gửi khách không duyệt · omnichannel đầy đủ.

### 2.4. Không phá

- `crm_tickets` + `/crm/tickets` = **ticket CSKH / phàn nàn khách spa-ops**. CSD dùng bảng mới `csd_tickets`.  
- CEO Command thread `ceo_command_*` không trộn conversation CSD.  
- Caps RBAC: thêm permission set `csd_*`, không sửa ma trận CSKH.  
- Catalog C CEO không thêm “gửi báo cáo khách” (vẫn BR-AI-01).

---

## 3. Quan hệ với hệ đã có

```text
RNOSAI
├── Factory A — Lead / Lifecycle / Hub / Service Delivery     (không thay)
├── Factory B — CSKH board + crm_tickets                      (không thay)
├── CEO Command + Lifecycle Tower                             (đọc CSD SLA sau này, không ghi)
├── Org / staff_users / job_function                          (identity CSD)
├── customers / agency_clients / contracts / projects         (CRM context)
└── CSD (mới)
    ├── csd_conversations / csd_messages
    ├── csd_tickets / csd_ticket_comments / csd_sla_*
    ├── csd_emails / csd_email_templates
    └── csd_reports / csd_report_versions / csd_approvals
```

### 3.1. Ticket CSKH vs Ticket CSD

| | `crm_tickets` (đã ship) | `csd_tickets` (mới) |
|--|-------------------------|---------------------|
| Đối tượng | Khách CSKH / spa-ops / phàn nàn | Khách agency + nội bộ + đối tác |
| SLA | 15p / 4h / 24h first-call | Response + resolution theo gói HĐ |
| Channel | Zalo/Meta/phone case | Chat CSD, email support, form, manual |
| Sentiment | Đã có AI score | Tái dùng engine **sau** phase 1 nếu cùng khách |
| Route | `/crm/tickets` | `/crm/csd/tickets` |
| Liên kết | `customer_id` | `client_account_id` + optional `customer_id` / `lead_id` / `lifecycle_id` |

**Cầu nối:** Ticket CSD loại `Complaint` gắn khách đã có `customer_id` **có thể** tạo bản ghi liên kết `crm_tickets` (opt-in, không mặc định) để CSKH thấy khiếu nại. Phase 1: chỉ deep-link, không sync 2 chiều.

### 3.2. Map vai trò SRS → RNOSAI

| Vai trò SRS | Map RNOSAI | Cap CSD tối thiểu |
|-------------|------------|-------------------|
| Super Admin | `SUPER-ADMIN` | `csd.admin` |
| Agency Admin | Admin vận hành / `agency_admin` | `csd.admin` |
| Director/Manager | GDKD, trưởng phòng (`leader`) | `csd.manage` |
| Account Manager | Job function `am` | `csd.ticket.write` `csd.chat.write` `csd.report.send` |
| Project Manager | Job function `pm` | `csd.ticket.assign` `csd.sla.pause` |
| Team Member | design/content/ads/seo/tech | `csd.ticket.work` `csd.chat.write` |
| Finance | kế toán | `csd.ticket.read` (scope billing) `csd.report.finance` |
| Client Admin/Member | **Phase 2** portal user | — MVP |
| Partner | staff loại `vendor` hoặc guest link | `csd.ticket.work` scoped project |
| AI Agent | service account `actor_type=ai` | không cap user; policy server-side |
| Auditor | viewer | `csd.audit.read` |

---

## 4. Thuật ngữ

Giữ nguyên bảng SRS §4. Bổ sung RNOSAI:

| Thuật ngữ | Diễn giải thêm |
|-----------|----------------|
| Client Account | Map `agency_clients` / hồ sơ khách Factory A. Không dùng lead pre-won làm client trừ khi đã `won` + lifecycle |
| Project | Map dự án / `re_projects` hoặc service-delivery project — **một** FK `project_ref` polymorphic (`kind`, `id`) |
| Campaign | Chiến dịch Ads/SEO trong project; optional |
| Factory | CSD MVP chỉ **A**. Field `factory='A'` trên ticket/conversation để Tower sau này đọc |
| Visibility | `internal` \| `client` \| `restricted`. File kế thừa visibility của message/comment cha |
| Source ref | `{ type: chat_message\|email\|form\|manual\|ai_draft, id }` — unique để chống ticket trùng |

---

## 5. Kiến trúc thông tin

Quan hệ module giữ SRS §5. Navigation **gắn ops-web hiện tại**, không invent IA mới hoàn toàn:

```text
/crm/csd                    Dashboard CSD (role-aware)
/crm/csd/chat               Chat workspace
/crm/csd/email              Inbox + composer
/crm/csd/email/unmatched    Hàng email chưa match
/crm/csd/tickets            List
/crm/csd/tickets/board      Kanban
/crm/csd/tickets/:id        Detail 3 cột
/crm/csd/sla                SLA monitor
/crm/csd/reports            Report center
/crm/csd/reports/:id        Builder
/crm/csd/approvals          Hàng duyệt report/email
/crm/csd/ai                 AI inbox (nháp)
/admin/crm/csd              SLA, workflow, mailbox, template
```

Sidebar ops-web thêm nhóm **Service Desk** dưới CRM. Badge: ticket At Risk + unread client chat.

---

## 6. Module Chat

Mục tiêu, loại chat, user story gốc: SRS §6. Dưới đây là **bổ sung bắt buộc** để implement.

### 6.1. Loại chat MVP

| Loại | Bắt buộc link | Client thấy? |
|------|---------------|--------------|
| `direct` | 2 user | Không (trừ DM với client contact — **không** MVP) |
| `group` | team/dept optional | Không |
| `client` | `client_account_id` | Có — chỉ member được mời |
| `project` | `project_ref` | Optional invite client |
| `campaign` | campaign_id | Phase 2 (dùng project chat) |
| `ticket` | `csd_ticket_id` | Public thread = public comments |
| `announcement` | audience | Một chiều |
| `ai_assist` | user | Chỉ user đó; không phải Client Chat |

### 6.2. Message model

```text
csd_messages
  id, tenant_id, conversation_id
  author_type: staff | client_contact | system | ai
  author_id
  body_text, body_html (sanitized)
  reply_to_id
  visibility: internal | client
  ticket_id (nullable, backlink)
  edited_at, deleted_at
  created_at
```

- Edit: ≤ 15 phút, chỉ author.  
- Delete: soft-delete; UI “Đã xóa”; audit giữ body.  
- Client Chat: `visibility` luôn `client`. Internal note **không** tồn tại trong Client Chat — dùng ticket Internal Note.  
- Delivery: Sent / Delivered / Failed. Read receipt nội bộ only (MVP).

### 6.3. Chat → Ticket

- Action `Create Ticket from Message`.  
- Prefill: title = 80 ký tự đầu; description = body + permalink; client/project từ conversation.  
- Unique `(source_type=chat_message, source_id)`. Trùng → toast + link ticket cũ.  
- Badge dưới message: `PTT-2026-000123 · P1 · In Progress`.  
- File: chỉ copy attachment `visibility=client`. File internal bị loại, ghi warning.

### 6.4. Business rules Chat

Giữ BR-CHAT-01…08. Thêm:

| Mã | Quy tắc |
|----|---------|
| BR-CHAT-09 | Conversation CSD không ghi vào `ceo_command_turns` |
| BR-CHAT-10 | Keyword gấp/sự cố/ngưng chạy → AI **gợi ý** ticket P1/P2, không tự tạo |
| BR-CHAT-11 | P95 gửi tin < 3s (SRS §15.1) |

---

## 7. Module Ticket

### 7.1. Lifecycle (bắt buộc)

```text
Draft → New → Triaged → Assigned → In Progress
      → Waiting for Client | Waiting for Internal Approval | On Hold
      → Resolved → Client Acceptance → Closed
Ngoại lệ: Cancelled | Rejected | Reopened | Escalated
```

Chuyển trạng thái hợp lệ (máy trạng thái): xem Use case UC-TKT-10. UI không hiện nút chuyển trái phép.

### 7.2. Priority & SLA mặc định `PTT-DEFAULT`

Chỉ dùng khi contract chưa map. Giờ làm: 08:30–18:00, T2–T7, TZ `Asia/Ho_Chi_Minh`. Nghỉ lễ = bảng `csd_business_calendar`.

| Priority | Response | Resolution | Ví dụ |
|----------|----------|------------|--------|
| P1 Critical | 1 giờ làm việc | 4 giờ làm việc | Web sập, ads dừng, mất lead |
| P2 High | 4 giờ làm việc | 1 ngày làm việc | Form lead lỗi, spend bất thường |
| P3 Medium | 1 ngày làm việc | 3 ngày làm việc | Sửa banner, content |
| P4 Low | 2 ngày làm việc | 5 ngày làm việc | Đề xuất, polish |

SLA **pause** khi `Waiting for Client` hoặc `On Hold` (có lý do + người pause). `Waiting for Internal Approval`: **không** pause trừ policy gói Enterprise.

### 7.3. Scope

| Status | Được In Progress? |
|--------|-------------------|
| In Scope | Có |
| Potentially Out of Scope | Chỉ sau AM/PM confirm In hoặc Out |
| Out of Scope | Không — phải change/quote hoặc Reject |
| Included by Exception | Có, cần manager approve |
| Billable | Có sau Finance/AM approve |
| Warranty | Có, tag warranty |

### 7.4. Comment

| Loại | Client thấy | Notification client |
|------|-------------|---------------------|
| Public Reply | Có | Có (email MVP) |
| Internal Note | Không | Không |

Chuyển Internal → Public = modal xác nhận + strip prefix nội bộ. File internal không gắn Public (chặn cứng).

### 7.5. Mã ticket

`PTT-{YYYY}-{seq 6 số}` per tenant, sequence Postgres. Không tái sử dụng số đã hủy.

### 7.6. Thuộc tính — bổ sung so SRS §7.6

Bắt buộc thêm: `factory='A'`, `source_type`, `source_id`, `visibility_default`, `sla_policy_id`, `sla_response_due_at`, `sla_resolution_due_at`, `sla_status`, `paused_seconds_total`.

---

## 8. Module Email

### 8.1. Mailbox MVP

| Mailbox | Hành vi inbound |
|---------|-----------------|
| `support@…` | Match contact → ticket mới hoặc append theo `[PTT-YYYY-NNNNNN]` trong subject |
| `report@…` | Không tự tạo ticket; gắn report thread nếu subject có report id |
| Personal staff | **Không sync inbound** MVP (tránh đọc hộp thư cá nhân) |

Outbound: gửi từ mailbox user được ủy quyền (`csd_mailbox_grants`).

### 8.2. Match contact

1. Exact email → `contacts` / staff.  
2. Domain ∈ client domains → gợi ý client, **không** auto-gán nếu >1 client.  
3. Không match → `Unmatched Email Queue`.  
4. Blacklist/auto-reply (`Auto-Submitted`, `Precedence: junk`) → không tạo ticket (BR-EMAIL-09).

### 8.3. Subject ticket ref

Gửi từ ticket: subject prefix `[PTT-2026-000123]`. Inbound có mã hợp lệ + sender thuộc client/domain hoặc staff → append. Sender lạ + đúng mã → Unmatched + cảnh báo spoof.

### 8.4. Tracking

MVP: `queued | sent | failed | bounced`. Open/click = phase 2, chỉ tín hiệu, không phải bằng chứng đã đọc (SRS §8.4).

### 8.5. Approval email

Bắt buộc duyệt nếu body/subject khớp (không phân biệt hoa thường): `báo giá`, `hoàn tiền`, `cam kết`, `khiếu nại`, `phạt`, `hủy hợp đồng`. Role `csd.email.bypass` được gửi thẳng (audit).

---

## 9. Module Báo cáo

### 9.1. Workflow

`Draft → Data Pending → In Review → Changes Requested → Approved → Scheduled → Sent → (Viewed) → Acknowledged → Archived`

- `Viewed` / `Acknowledged`: phase 2 portal. MVP chỉ Sent + email.  
- Sent **immutable**. Sửa = `Create Revised Version` (`v1.1` / `v2.0`).

### 9.2. Version

| Thay đổi | Version |
|----------|---------|
| Tạo mới | v1.0 |
| Sửa nhỏ trước gửi | v1.1, v1.2… |
| Sau review lớn hoặc sau Sent | v2.0 |

### 9.3. Template MVP

1. Weekly Ops (ticket + tiến độ) — không bắt buộc Director duyệt.  
2. Monthly Marketing — bắt buộc Manager duyệt.  
3. Ticket/SLA monthly — Manager duyệt.  
4. Executive one-pager — Director duyệt.

Cấu trúc section chuẩn: SRS §9.5. Data source phase 1: **nhập tay + ticket rollup nội bộ**. Ads/GA4 = phase 2.

### 9.4. Gửi

Kênh MVP: Email (PDF). Client Chat share link = phase 1.5 nếu chat đã có. Portal = phase 2.  
Failed send → status không `Sent`; retry queue + notify owner.

---

## 10. Luồng liên thông (tóm)

Giữ 4 luồng SRS §10. Điểm implement:

1. **Chat/Email/Form → Ticket → Resolve → Report kỳ sau** (rollup `csd_tickets` closed/breached trong period).  
2. **Scheduler → Draft report → Review → Approved → Email.**  
3. **IMAP → match → append hoặc create → SLA → notify.**  
4. Ticket `Out of Scope` vào section Risks + cờ upsell (chỉ flag, không CRM opportunity tự tạo).

---

## 11. AI Agent

Cùng nguyên tắc CEO Command: **draft / suggestion / recommendation**.

| Tính năng | Phase |
|-----------|-------|
| Chat summary 24h/7d | MVP |
| Ticket classify nháp | MVP |
| Email/ticket reply draft | MVP |
| Report executive draft | Phase 2 |
| SLA risk (rule-based đủ MVP; AI bổ trợ phase 2) | Rule MVP |
| Sentiment complaint | Tái dùng ticket-sentiment engine phase 2 |
| RAG SOP | Phase 2 |

**Context được phép:** client/project/ticket/thread **trong cap của user đang gọi**.  
**Cấm:** credentials, payroll, internal note ngoài scope, khách khác tenant.

Mọi lần gọi: `csd_ai_interactions` (prompt hash, context ids, output, user action: insert/discard/apply). UI nhãn **AI Draft**.

Hành động Apply tạo entity = review modal. Hành động ra khách = Confirm 2 bước (reuse `CeoActionConfirmDialog` pattern, không gọi CEO catalog).

---

## 12. Notification

Kênh MVP: in-app + email. Push/Slack = phase 2.

Ma trận sự kiện: SRS §12.2. Bổ sung:

- P1 / SLA Near Breach / Breached: **không gộp**, gửi < 1 phút.  
- Digest 08:00: ticket chờ, report due, unmatched email.  
- Preference per user; muted conversation không tắt P1.

---

## 13. Dashboard

Bốn biến thể: Account, PM, Director, Team Member. Client dashboard = phase 2.  
KPI cards + việc ưu tiên + SLA stack + inbox — chi tiết màn: UX spec §3.

Tower `/crm/ceo` **không** nhúng CSD MVP. Phase 2: cảm biến S-new “ticket CSD P1 breach” trên hàng chờ (opt-in).

---

## 14. Mô hình dữ liệu (bảng mới)

Prefix `csd_`. Mọi bảng: `id`, `tenant_id`, `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`, `is_deleted`.

| Bảng | Vai trò |
|------|---------|
| `csd_conversations` | Chat header + type + links |
| `csd_conversation_members` | user + role owner/member |
| `csd_messages` | Tin nhắn |
| `csd_tickets` | Ticket |
| `csd_ticket_comments` | Public/internal |
| `csd_ticket_activities` | Status/assign/SLA events |
| `csd_ticket_watchers` | Watch |
| `csd_sla_policies` | Policy |
| `csd_sla_policy_maps` | client/package/type/priority → policy |
| `csd_business_calendar` | Ngày nghỉ |
| `csd_emails` | In/out |
| `csd_email_threads` | Thread |
| `csd_mailboxes` | IMAP/SMTP config (secret encrypted) |
| `csd_email_templates` | Template + version |
| `csd_reports` | Report header |
| `csd_report_versions` | Immutable blob/json sections |
| `csd_report_schedules` | Recurrence |
| `csd_approvals` | Report/email/scope |
| `csd_attachments` | File meta + visibility |
| `csd_notifications` | In-app |
| `csd_audit_logs` | Append-only |
| `csd_ai_interactions` | AI trail |

**Không** nhét vào `crm_tickets` / `crm_ticket_messages`.

ERD tối thiểu:

```text
ClientAccount 1──* Conversation 1──* Message
ClientAccount 1──* Ticket 1──* Comment
Message 0..1──1 Ticket (source)
Email 0..1──1 Ticket
Ticket *──* ReportVersion (rollup ids)
Ticket *──1 SLAPolicy
```

---

## 15. API

Convention: `/api/v1/csd/...`, JWT staff, tenant từ token, cursor pagination, idempotency-key trên POST tạo ticket/email/report send.

Danh sách endpoint: SRS §16.2–16.5 — đổi prefix `/api/v1/` → `/api/v1/csd/`.  
Guard: cap + data scope (client/project membership). Fail-closed.

Idempotency: `POST tickets` với cùng `Idempotency-Key` hoặc cùng `source_ref` trả ticket cũ, không tạo lần 2.

---

## 16. Phân quyền (rút gọn)

Chi tiết từng UC: Use case §12. Nguyên tắc:

- Staff chỉ thấy conversation/ticket/email/report của **client được gán**, **project member**, **assignee/watcher**, hoặc cap `csd.admin`.  
- Finance mặc định chỉ ticket `category=billing` + report finance.  
- Partner chỉ ticket/project được share.  
- Client phase 2: chỉ `Client Account` của họ, chỉ public.

Hành động nhạy cảm **bắt buộc audit**: xóa/soft-delete message, đóng ticket, đổi SLA, gửi email/report, đổi assignee, export, AI apply.

---

## 17. Phi chức năng

Giữ bảng SRS §15. Bổ sung ràng buộc VPS:

| Hạng mục | Mục tiêu v1 |
|----------|-------------|
| Uptime | 99.5% (cùng ops-web) |
| Chat | WebSocket hoặc SSE trên ops-web; fallback poll 5s |
| Queue | Redis/Bull hoặc Postgres skip-locked cho email/report/SLA tick |
| File | 100 MB/file; signed URL; không public bucket |
| AI down | Chat/ticket/email/report lõi vẫn chạy; nút AI disabled + lý do |
| RPO/RTO | 24h / 8h (backup Postgres hiện có) |

---

## 18. Acceptance (bắt buộc UAT)

Năm scenario SRS §19 **cộng**:

| ID | Given / When / Then |
|----|---------------------|
| AT-ISO-01 | User mở `/crm/tickets` — vẫn list `crm_tickets`, không thấy `csd_tickets` |
| AT-ISO-02 | User gửi tin CSD — 0 row mới `ceo_command_turns` |
| AT-VIS-01 | Client Chat không render message `visibility=internal` (không có client MVP: test bằng fixture member `author_type=client_contact` + staff internal note trên **ticket**) |
| AT-AI-01 | AI draft reply + user không Confirm — 0 email outbound |
| AT-DUP-01 | Create ticket 2 lần cùng message id — 1 ticket |

---

## 19. Lộ trình

| Phase | Sprint gợi ý (SRS §24) | Kết quả |
|-------|------------------------|---------|
| 0 | Foundation tenant, audit, file, events, wireframe trong ops-web | Schema + empty routes |
| 1 | Ticket core | Board + SLA + public/internal |
| 2 | Chat core + Chat→Ticket | Native chat |
| 3 | Email core | IMAP + compose |
| 4 | Report core | Template + duyệt + PDF + gửi |
| 5 | AI foundation (không portal) | Summary + classify + draft |
| 2.x | Portal + OAuth mail + Ads data | SRS §20.2 |

---

## 20. Artefact tiếp theo

1. ~~Implementation plan~~ → [`2026-09-02-agency-csd.md`](../plans/2026-09-02-agency-csd.md).  
2. ~~DDL~~ → [`2026-09-02-postgresql-ddl-csd.sql`](../../specs/2026-09-02-postgresql-ddl-csd.sql) · apply `scripts/apply_pg_ddl_csd.sh`.  
3. OpenAPI `csd-v1.yaml` (trong slice Ticket API).  
4. Permission catalog `csd` trong `rbac-admin-catalog.json` (Task 2 plan).  
5. UAT checklist từ Use case §14 / plan Task 14.

---

## 21. Nguồn và phạm vi so với file gốc

Tài liệu này **không thay** SRS gốc; nó **chốt quyết định + neo RNOSAI + bổ sung invariant**. Chi tiết UX và từng bước use case nằm ở hai sibling. Nếu mâu thuẫn: **spec này thắng** trên D1–D12, isolation, và BR-AI-01.

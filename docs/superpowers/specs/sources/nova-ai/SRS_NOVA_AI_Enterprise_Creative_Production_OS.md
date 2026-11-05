# SRS Chuyên sâu — NOVA AI Enterprise Creative Production OS

**Phiên bản:** 2.0  
**Trạng thái:** Product & Solution Specification  
**Ngày:** 06/09/2026  
**Phạm vi:** Agency marketing, đội in-house marketing, doanh nghiệp đa thương hiệu, vận hành sản xuất video AI quy mô lớn  
**Đối tượng sử dụng:** Product Owner, BA, Solution Architect, UX/UI, Front-end, Back-end, AI/ML, Media Pipeline, QA, SRE/DevOps, Security, Finance Ops

---

## 1. Tóm tắt sản phẩm

NOVA AI là nền tảng **Enterprise Creative Production OS** giúp doanh nghiệp và agency quản lý toàn bộ vòng đời sản xuất nội dung, đặc biệt là video AI: từ brief, dự án, tài sản media, nhận diện thương hiệu, tạo video, kiểm duyệt, render, xuất bản, đo lường và quản trị chi phí.

NOVA AI không được định nghĩa là một công cụ text-to-video đơn lẻ. Đây là một hệ điều hành sản xuất sáng tạo có governance, dành cho nhiều workspace, khách hàng, thương hiệu, người dùng, dự án và kênh truyền thông.

### 1.1. Các module sidebar

| Mã | Module | Mục đích |
|---|---|---|
| MOD-OVR | Tổng quan | Điều hành KPI, vận hành creative production, cảnh báo và action center |
| MOD-PRJ | Dự án | Quản lý account, campaign, brief, ngân sách, timeline, team và deliverable |
| MOD-VID | AI tạo video | Tạo, chỉnh sửa, render, version, review và export video AI |
| MOD-MED | Thư viện media | DAM quản lý asset, metadata, quyền sử dụng, collections và usage graph |
| MOD-BRK | Brand Kit | Brand governance: logo, palette, font, motion, audio identity, legal rule, version |
| MOD-CAL | Lịch xuất bản | Lập lịch, phê duyệt và phân phối nội dung theo kênh/campaign |
| MOD-RPT | Báo cáo | Phân tích hiệu quả content, vận hành sản xuất, cost, credit, ROI và SLA |
| MOD-SET | Cài đặt | Workspace, thành viên, RBAC, SSO, billing, integration, security, data retention |

---

## 2. Mục tiêu và nguyên tắc

### 2.1. Mục tiêu nghiệp vụ

- Rút ngắn thời gian từ brief đến bản video có thể review.
- Chuẩn hóa quy trình sáng tạo giữa creative, account, brand, legal và khách hàng.
- Quản trị nội dung đúng nhận diện, đúng quyền asset và đúng policy trước khi xuất bản.
- Hỗ trợ sản xuất hàng loạt theo template, dữ liệu CRM và nhiều locale.
- Theo dõi chi phí AI/render theo workspace, account, campaign, project, cost center và output.
- Tạo nền tảng mở để tích hợp nhiều AI provider, DAM, CRM, ad platform và social platform.

### 2.2. Nguyên tắc thiết kế

- **Governed by default:** nội dung, asset, brand và export chịu policy mặc định.
- **Snapshot immutable:** render phải dùng snapshot bất biến của draft, asset, Brand Kit, model và pricing.
- **Human-in-the-loop:** AI hỗ trợ tạo; con người kiểm duyệt các điểm có rủi ro brand, legal, chi phí hoặc xuất bản.
- **Multi-tenant isolation:** mọi dữ liệu có workspace boundary và authorization ở server.
- **Traceable output:** mọi video phải truy vết được brief, prompt, asset, model, version, người duyệt và chi phí.
- **Scale by automation:** template, batch, variable mapping, QC automation và workflow rule là first-class capability.

---

## 3. Personas, roles và phân quyền

| Role | Quyền tiêu biểu |
|---|---|
| Platform Super Admin | Quản trị tenant, provider, policy nền tảng, observability và sự cố toàn hệ thống |
| Workspace Owner | Toàn quyền workspace, billing, member, Brand Kit, data policy |
| Workspace Admin | Quản trị project, member, asset và workflow trong workspace |
| Account Manager | Theo dõi client/project, gửi review, quản lý deadline, không sửa asset gốc nếu không được cấp |
| Creative Producer | Điều phối brief, task, deliverable, template và production plan |
| Creator / AI Operator | Tạo script, scene, video draft và batch trong quota được cấp |
| Video Editor | Sửa timeline, audio, caption, scene, export revision |
| Brand Lead | Quản trị Brand Kit, phê duyệt visual/brand consistency |
| Legal / Compliance Reviewer | Duyệt claim, disclaimer, asset right và content policy |
| Client Reviewer | Review/comment/approve trong phạm vi project được share |
| Finance / Billing Manager | Credit allocation, budget, invoice/export cost report |
| Viewer | Chỉ xem nội dung được chia sẻ |

### 3.1. Mô hình authorization

- RBAC ở cấp platform, workspace, account, project, folder, asset, Brand Kit, template và output.
- ABAC bổ sung điều kiện theo client, region, classification, project status, asset right, cost threshold.
- Quyền nhạy cảm cần tách riêng: `render.high_cost`, `export.final`, `publish.external`, `manage_brand_rule`, `approve.legal`, `view_audit_log`, `manage_sso`.
- Authorization bắt buộc kiểm tra backend; UI chỉ là lớp hỗ trợ trải nghiệm.

---

## 4. Kiến trúc thông tin và navigation

### 4.1. Sidebar bắt buộc

Sidebar hiển thị:

- Logo NOVA AI.
- Workspace switcher.
- Tổng quan.
- Dự án.
- AI tạo video.
- Thư viện media.
- Brand Kit.
- Lịch xuất bản.
- Báo cáo.
- Cài đặt.
- Storage/quota summary.
- User profile và support menu.

### 4.2. UX state áp dụng toàn hệ thống

Mỗi module phải có:

- Loading/skeleton state.
- Empty state có CTA phù hợp.
- Error state nêu hướng xử lý.
- Permission denied state.
- Offline/reconnect state cho dữ liệu realtime.
- Search, filter, sort, pagination/infinite scroll theo loại dữ liệu.
- Notification/toast không thay thế error details quan trọng.
- Audit-friendly activity timeline ở những đối tượng có vòng đời dài.

---

# 5. MOD-OVR — Tổng quan

## 5.1. Mục tiêu

Cung cấp một **Creative Operations Command Center** cho Owner, Admin, Producer và Account Manager để theo dõi sản lượng, deadline, render, approval, credit/budget, asset risk và hoạt động cần xử lý.

## 5.2. UI screens

| Screen ID | Màn hình | Thành phần chính |
|---|---|---|
| OVR-01 | Executive Dashboard | KPI, performance trend, credit, production health, alert |
| OVR-02 | My Work / Action Center | Task, review pending, mentions, overdue items |
| OVR-03 | Production Monitor | render queue, provider health, failure/retry, capacity |
| OVR-04 | Workspace Activity | activity log theo user/project/module |

## 5.3. Functional requirements

- **FR-OVR-001:** Hiển thị KPI theo khoảng thời gian, workspace, account, campaign và người phụ trách.
- **FR-OVR-002:** KPI tối thiểu: video created, video approved, render success rate, average render duration, credits consumed, remaining budget, assets expiring, tasks overdue.
- **FR-OVR-003:** Action Center gom review cần duyệt, render failed, asset right expiring, budget threshold, failed publish và comment mention.
- **FR-OVR-004:** Người dùng chỉ thấy dữ liệu trong authorization scope.
- **FR-OVR-005:** Dashboard widget configurable theo role; Owner thấy finance/governance, Creator ưu tiên My Work.
- **FR-OVR-006:** Drill-down từ KPI đến danh sách đối tượng đã filter.

## 5.4. Acceptance criteria

- Số liệu dashboard có timestamp `last updated`.
- Filter thay đổi toàn bộ widget liên quan và có thể share URL state.
- Alert critical hiển thị severity, impacted resource, owner, CTA và audit event.

---

# 6. MOD-PRJ — Dự án

## 6.1. Mục tiêu

Quản lý cấu trúc Account → Campaign → Project → Deliverable, bảo đảm mọi video, asset, review, ngân sách và lịch xuất bản có ngữ cảnh kinh doanh rõ ràng.

## 6.2. UI screens

| Screen ID | Màn hình | Thành phần chính |
|---|---|---|
| PRJ-01 | Project Portfolio | grid/list, KPI, filter, search, status, deadline |
| PRJ-02 | Create Project | account, campaign, objective, budget, team, deadline |
| PRJ-03 | Project Workspace | overview, brief, deliverables, tasks, media, approvals, budget |
| PRJ-04 | Project Timeline | milestones, dependencies, owner, status |
| PRJ-05 | Client Review Portal | external share, comment, approval, download restriction |

## 6.3. Data model

```text
Account 1—N Campaign 1—N Project 1—N Deliverable
Project 1—N Brief
Project N—N User (ProjectMember)
Project 1—N BudgetAllocation
Project 1—N ApprovalWorkflow
```

## 6.4. Functional requirements

- **FR-PRJ-001:** Tạo Project với Name, Account, Campaign, Industry, Objective, Start Date, Due Date, Owner, Team, Budget, Tags.
- **FR-PRJ-002:** Project state: Draft → Active → At Risk → In Review → Completed → Archived.
- **FR-PRJ-003:** Mỗi Project có dashboard deliverable: video, post, asset, approval, publish item.
- **FR-PRJ-004:** Gắn Brief có version và approval status.
- **FR-PRJ-005:** Budget allocation theo credit/currency/cost center; cảnh báo 50/80/100% threshold.
- **FR-PRJ-006:** Task/milestone hỗ trợ assignee, due date, dependency, priority, status, comment và attachment.
- **FR-PRJ-007:** Client Portal chỉ expose resource được whitelist; không được suy đoán URL resource khác.
- **FR-PRJ-008:** Project close yêu cầu xử lý deliverable pending hoặc xác nhận archive.

---

# 7. MOD-VID — AI tạo video

## 7.1. Mục tiêu

Tạo môi trường sản xuất video AI có kiểm soát từ brief đến output, đáp ứng tạo đơn lẻ, template-driven creation, batch generation, review, QC và export.

## 7.2. UI screens

| Screen ID | Màn hình | Thành phần chính |
|---|---|---|
| VID-01 | Video Studio | Prompt/script/URL, input assets, preview, storyboard, config, queue |
| VID-02 | Script & Storyboard Editor | scene structure, voice-over, visual direction, CTA, locks |
| VID-03 | Timeline Editor | video, voice, music, caption, trim, reorder, revision |
| VID-04 | Render Operations | queue, job detail, logs, retry, cancel, provider routing |
| VID-05 | Review & Approval | player, timecode comment, QC result, compare version, decision |
| VID-06 | Batch Video Factory | template, data source, field mapping, variant matrix, bulk job |
| VID-07 | Template Manager | template version, variables, rules, output profile, publish lifecycle |
| VID-08 | Video Version Detail | source snapshot, assets, cost, output, download/export history |

## 7.3. Video Studio requirements

- **FR-VID-001:** Tạo Video Project/Draft từ Prompt, Script, URL sản phẩm hoặc Template.
- **FR-VID-002:** Prompt tối đa cấu hình được; autosave debounce; moderation trước khi provider dispatch.
- **FR-VID-003:** URL ingestion chỉ lấy nội dung công khai được phép; preview/extract selection cần user confirmation.
- **FR-VID-004:** AI generate script phải trả về hook, scenes, visual direction, voice-over, text overlay, CTA và duration allocation.
- **FR-VID-005:** Người dùng có thể lock scene/text/asset để các lần regeneration không ghi đè.
- **FR-VID-006:** Asset từ DAM được tham chiếu theo immutable asset version.
- **FR-VID-007:** Video configuration gồm aspect ratio, duration, resolution, style, language, voice, subtitle, music, model, Brand Kit, watermark.
- **FR-VID-008:** Credit estimate cập nhật theo configuration và hiển thị pricing version.
- **FR-VID-009:** Submit render tạo immutable draft snapshot, pricing snapshot, idempotency key và RenderJob.
- **FR-VID-010:** Không submit render nếu thiếu quyền, asset processing chưa xong, insufficient budget/credit hoặc moderation blocked.

## 7.4. Storyboard & timeline requirements

- **FR-VID-011:** Scene card hiển thị index, title, duration, thumbnail, asset count, lock state, QC state.
- **FR-VID-012:** Hỗ trợ reorder, duplicate, delete, split, merge, regenerate scene theo policy template.
- **FR-VID-013:** Timeline MVP gồm track Video/Scene, Voice-over, Music, Text/Caption.
- **FR-VID-014:** Timeline phải hỗ trợ undo/redo, trim, volume, ducking, zoom và basic snapping.
- **FR-VID-015:** Any edit tạo draft revision; completed VideoVersion không bị mutate.
- **FR-VID-016:** Missing/revoked asset phải block render và tạo actionable warning.

## 7.5. Render Operations requirements

- **FR-VID-017:** RenderJob states: Draft, Queued, Preparing, Rendering, Processing, QC, Review, Completed, Failed, Cancelled, Expired.
- **FR-VID-018:** Job detail có stage-level timeline: moderation, asset prep, script, scene gen, TTS, audio mix, compositing, encoding, QC, CDN/export.
- **FR-VID-019:** Hỗ trợ priority: Critical, High, Standard, Low; quota concurrent render theo plan/workspace.
- **FR-VID-020:** Retry tự động có exponential backoff; manual retry và fallback provider/model phải tạo traceable child job.
- **FR-VID-021:** Cancel chỉ khả dụng tại stage cho phép; credit release/refund tuân theo pricing policy.
- **FR-VID-022:** WebSocket/SSE cập nhật progress; polling fallback 5–10 giây.

## 7.6. Review, QA và approval requirements

- **FR-VID-023:** Review screen có timecode comment, mention, status Open/In Progress/Resolved, attachment và notification.
- **FR-VID-024:** Automated QC kiểm tra output technical, safe area, caption overflow, logo presence, mandatory CTA/disclaimer, missing audio, audio loudness, black/frozen frame và moderation signals.
- **FR-VID-025:** QC result states: Passed, Warning, Blocked; Blocked không cho export/publish nếu policy bắt buộc.
- **FR-VID-026:** Approval states: Internal Review, Client Review, Changes Requested, Brand Approved, Legal Approved, Final Approved, Rejected.
- **FR-VID-027:** Approval Matrix configurable theo account, campaign, category, channel, risk label, cost threshold hoặc presence of claim.
- **FR-VID-028:** Compare version cho phép xem metadata diff, script diff, Brand Kit version, asset diff, cost diff và preview A/B.

## 7.7. Batch Factory requirements

- **FR-VID-029:** Template có variable placeholders như `{{project_name}}`, `{{price_from}}`, `{{location}}`, `{{cta}}`, `{{hotline}}`.
- **FR-VID-030:** Import source từ CSV/XLSX, CRM query hoặc API integration; validate field mapping trước batch.
- **FR-VID-031:** Variant Matrix cho aspect ratio, language, voice, persona, CTA và channel.
- **FR-VID-032:** Batch estimate hiển thị count, credits, expected duration, queued capacity, invalid rows và sample preview.
- **FR-VID-033:** Bulk job hỗ trợ partial success, per-row retry, export errors CSV và cost reconciliation.

---

# 8. MOD-MED — Thư viện media (DAM)

## 8.1. Mục tiêu

Cung cấp Digital Asset Management cho mọi asset đầu vào và output: upload, ingest, metadata, AI tagging, quyền sử dụng, collection, version, search, usage tracking và retention.

## 8.2. UI screens

| Screen ID | Màn hình | Thành phần chính |
|---|---|---|
| MED-01 | Media Library | grid/list, tabs, filters, asset inspector, upload queue |
| MED-02 | Asset Detail | preview, metadata, versions, usage, right/license, audit |
| MED-03 | Upload & Ingestion | upload, folder/project/tag/right mapping, processing status |
| MED-04 | Collections | collection, smart collection, share/access policy |
| MED-05 | Asset Rights Center | license, territory, channels, expiry, talent/model release |
| MED-06 | Duplicate & Quality Review | duplicate detection, low quality, missing metadata, quarantine |

## 8.3. Functional requirements

- **FR-MED-001:** Hỗ trợ upload image, video, audio, document theo MIME allowlist và file-size policy.
- **FR-MED-002:** Upload pipeline gồm virus scan, transcode/proxy, thumbnail, waveform, OCR/transcript tùy file type, AI metadata extraction.
- **FR-MED-003:** Asset states: Uploading, Processing, Ready, Quarantined, Failed, Archived, Deleted.
- **FR-MED-004:** Metadata gồm filename, type, codec, resolution, duration, file size, creator, owner, source, project, tags, taxonomy, AI labels, language, rights status.
- **FR-MED-005:** Asset Rights có license type, owner, effective date, expiry date, territory, channel, usage restriction, model release, talent release, proof document.
- **FR-MED-006:** Expired/restricted asset cảnh báo hoặc block generate/render/publish theo policy.
- **FR-MED-007:** Asset usage graph hiển thị asset được dùng trong VideoDraft, VideoVersion, Project, Template và PublishItem.
- **FR-MED-008:** Asset versioning; replace asset không được silently update output/video draft history.
- **FR-MED-009:** Search hỗ trợ filename, tag, OCR text, transcript, AI labels, project, owner và semantic search khi được bật.
- **FR-MED-010:** Smart Collections dùng saved filter và permission-aware result.

---

# 9. MOD-BRK — Brand Kit

## 9.1. Mục tiêu

Đảm bảo mọi output đúng nhận diện, legal requirement và quy tắc visual/audio của thương hiệu trong môi trường nhiều client/brand/campaign.

## 9.2. UI screens

| Screen ID | Màn hình | Thành phần chính |
|---|---|---|
| BRK-01 | Brand Kit Portfolio | danh sách kit theo workspace/account, status, usage |
| BRK-02 | Brand Kit Editor | identity, logo, palette, typography, templates, audio, legal |
| BRK-03 | Brand Rule Builder | mandatory/optional rules, conditions, enforcement |
| BRK-04 | Brand Preview Lab | preview 9:16/16:9/1:1/4:5, contrast/safe-area validation |
| BRK-05 | Version & Change History | diff, restore, approval, impact analysis |

## 9.3. Functional requirements

- **FR-BRK-001:** Brand Kit chứa logo variants, palette, typography, motion preset, intro/outro, sound logo, caption style, watermark, CTA template, disclaimer.
- **FR-BRK-002:** Brand Kit có scope workspace/account/project; một project có default kit và controlled override.
- **FR-BRK-003:** Mỗi thay đổi tạo version; render lưu Brand Kit snapshot version.
- **FR-BRK-004:** Rule builder hỗ trợ condition + action: bắt buộc logo, giới hạn màu, mandatory CTA, disclaimer, approval requirement, watermark rule, channel safe area.
- **FR-BRK-005:** Preview Lab kiểm tra contrast, clipping, safe area, logo visibility, text overflow và compliance labels.
- **FR-BRK-006:** Brand Lead approval có thể bắt buộc trước khi publish rule/version.
- **FR-BRK-007:** Impact analysis liệt kê template/draft mới chịu ảnh hưởng; completed output không tự thay đổi.

---

# 10. MOD-CAL — Lịch xuất bản

## 10.1. Mục tiêu

Quản lý kế hoạch phát hành, approval gate, variant/channel compatibility, campaign metadata và trạng thái distribution.

## 10.2. UI screens

| Screen ID | Màn hình | Thành phần chính |
|---|---|---|
| CAL-01 | Content Calendar | month/week/list, filter channel/account/project |
| CAL-02 | Publish Composer | chọn approved version, channel, caption, UTM, schedule |
| CAL-03 | Approval Gate | checklist, approvals, policy result, publish lock |
| CAL-04 | Distribution Monitor | publish status, failed posts, retry, per-channel history |

## 10.3. Functional requirements

- **FR-CAL-001:** Tạo PublishItem từ VideoVersion đã đạt approval requirements.
- **FR-CAL-002:** Mỗi PublishItem có channel, account/profile, scheduled time, timezone, copy, hashtag, thumbnail, CTA, UTM, audience, compliance label.
- **FR-CAL-003:** Channel profile quy định output validation: aspect ratio, duration, file size, codec, caption length.
- **FR-CAL-004:** Không schedule/publish nếu output chưa Final Approved, QC Blocked, asset right expired hoặc missing mandatory disclosure.
- **FR-CAL-005:** Publish status: Draft, Scheduled, Publishing, Published, Failed, Cancelled.
- **FR-CAL-006:** Hỗ trợ reschedule, clone, bulk schedule, cancel và retry với audit log.
- **FR-CAL-007:** Lịch hiển thị theo workspace timezone và cho phép override theo campaign/channel.

---

# 11. MOD-RPT — Báo cáo

## 11.1. Mục tiêu

Cung cấp báo cáo business, content performance, creative operations, cost, credit, SLA và governance cho Owner, Account, Producer và Finance.

## 11.2. UI screens

| Screen ID | Màn hình | Thành phần chính |
|---|---|---|
| RPT-01 | Executive Report | output, cost, ROI, campaign health |
| RPT-02 | Production Analytics | throughput, render time, fail/retry, approval cycle |
| RPT-03 | Credit & Budget | consumption, allocation, forecast, cost center, chargeback |
| RPT-04 | Content Performance | channel metrics, format/style/template performance |
| RPT-05 | Governance Report | brand violations, asset rights risk, audit/export |

## 11.3. Functional requirements

- **FR-RPT-001:** Filter theo workspace, account, campaign, project, channel, date range, model, template, creator.
- **FR-RPT-002:** Credit report phải phân biệt estimated, reserved, charged, released, refunded và invoice-related adjustment.
- **FR-RPT-003:** Production report gồm render success, p50/p95 duration, queue wait, retry, failure category, approval SLA.
- **FR-RPT-004:** Content performance ingest từ integration hoặc file import; mọi metric phải hiển thị source và freshness timestamp.
- **FR-RPT-005:** Export CSV/XLSX/PDF theo quyền; export action phải audit.
- **FR-RPT-006:** Budget forecast tính dựa trên scheduled batch, historical consumption và committed render jobs; ghi rõ assumptions.

---

# 12. MOD-SET — Cài đặt

## 12.1. Mục tiêu

Quản trị workspace, người dùng, quyền, security, AI provider, billing, integration, retention và policy enterprise.

## 12.2. UI screens

| Screen ID | Màn hình | Thành phần chính |
|---|---|---|
| SET-01 | Workspace Profile | tên, logo, locale, timezone, default policy |
| SET-02 | Members & Roles | member, invitation, role, custom permission, group |
| SET-03 | SSO & Provisioning | SAML/OIDC, SCIM, domain policy |
| SET-04 | Billing & Credit | plan, credits, allocation, invoice, budget alerts |
| SET-05 | AI Providers & Models | allowed models, routing, cost cap, data processing policy |
| SET-06 | Integrations | CRM, storage, social, webhook, API key/service account |
| SET-07 | Security & Data | audit log, retention, legal hold, IP allowlist, signed URL policy |
| SET-08 | Content Policy | moderation, disallowed content, review escalation, watermark |

## 12.3. Functional requirements

- **FR-SET-001:** Workspace profile quản lý locale, timezone, default Brand Kit, storage quota và content retention.
- **FR-SET-002:** Invite member có expiry, role, group, project scope và audit event.
- **FR-SET-003:** Enterprise SSO hỗ trợ SAML 2.0/OIDC; SCIM provisioning/deprovisioning nếu plan bật.
- **FR-SET-004:** Custom roles không được vượt quyền immutable Platform/Owner permission boundary.
- **FR-SET-005:** Billing ghi CreditLedger bất biến với transaction type: grant, reserve, charge, release, refund, adjustment, expiry.
- **FR-SET-006:** Model policy quy định allowed provider, max resolution, max duration, budget cap, region/data policy và fallback routing.
- **FR-SET-007:** Integration secrets phải encrypt; API key chỉ hiển thị một lần khi tạo; webhook có signing secret/retry log.
- **FR-SET-008:** Audit log query theo actor/action/resource/time/IP; chỉ role được quyền mới xem và export.
- **FR-SET-009:** Data retention gồm soft delete, restore period, purge schedule và legal hold.
- **FR-SET-010:** Moderation policy phân loại Block, Review Required, Allow; không expose rule nội bộ nhạy cảm qua client.

---

# 13. Shared workflow engines

## 13.1. Approval Engine

```text
Rule condition
  → Create approval steps
  → Assign reviewer/group
  → Collect decision
  → Resolve quorum / escalation
  → Unlock next stage or return for changes
```

Yêu cầu:

- Sequential, parallel và quorum approval.
- Escalation theo SLA/time.
- Comment/decision immutable; revoke approval phải có lý do và quyền phù hợp.
- Approval snapshot gắn với object version; thay đổi draft/version phải invalidate approval nếu policy yêu cầu.

## 13.2. Notification Engine

Kênh: in-app, email, webhook, Slack/Teams tùy integration.

Sự kiện tối thiểu:

- Assigned task/review.
- Mention/comment reply.
- Render completed/failed.
- QC blocked.
- Approval required/overdue.
- Asset license expiry.
- Budget threshold.
- Publish success/fail.

## 13.3. Credit & Budget Engine

```text
Estimate → Budget pre-check → Reserve → Charge final → Release/refund → Ledger & reporting
```

- Tất cả mutation idempotent.
- Chargeback theo Account/Project/Cost Center.
- Soft/hard budget threshold.
- Manager approval khi vượt ngưỡng.

---

# 14. Data model tổng quan

| Entity | Thuộc tính chính |
|---|---|
| Tenant | id, plan, region, global_policy |
| Workspace | id, tenant_id, name, locale, timezone, quota, default_brand_kit |
| Account | workspace_id, name, industry, billing_profile, policy |
| Campaign | account_id, objective, channel, budget, timeframe |
| Project | campaign_id, status, owner, team, deadline, budget |
| Brief | project_id, version, content, approval_status |
| Deliverable | project_id, type, status, owner, due_date |
| VideoProject / VideoDraft / VideoVersion | lifecycle video, immutable snapshot, output metadata |
| RenderJob / RenderJobItem | queue orchestration, provider stage, retry, cost |
| MediaAsset / AssetVersion / AssetRight | DAM object, metadata, rights, usage relation |
| BrandKit / BrandKitVersion / BrandRule | identity and governance |
| VideoTemplate / TemplateVersion / VariableMapping | content factory |
| ApprovalWorkflow / ApprovalStep / Decision | governance workflow |
| PublishItem / ChannelProfile | scheduling and distribution |
| CreditLedger / BudgetAllocation | billing and cost control |
| Notification / AuditLog | traceability and communication |

---

# 15. API, events và integration

## 15.1. API principles

- REST/GraphQL cho query & CRUD; WebSocket/SSE cho realtime.
- API versioning, e.g. `/api/v1`.
- Cursor pagination, server-side filtering/sorting.
- Idempotency-Key bắt buộc cho create render, batch, publish, ledger mutation.
- Correlation ID và trace ID trong mọi request async.
- Object-level authorization tại server.

## 15.2. Core asynchronous events

```text
video.draft.updated
video.render.queued
video.render.progressed
video.render.completed
video.render.failed
video.qc.completed
video.approval.requested
video.approval.decided
asset.processing.completed
asset.right.expiring
brandkit.version.published
batch.completed
publish.scheduled
publish.completed
publish.failed
credit.balance.changed
budget.threshold.exceeded
```

## 15.3. Integration categories

- AI providers: LLM/script, image/video generation, TTS, music, moderation.
- Storage/CDN: object storage, transcoding, signed URL.
- CRM: customer/project/product/lead data for variable video.
- Social/distribution: Meta, TikTok, YouTube, CMS/website where approved.
- Identity: SSO/SCIM.
- Collaboration: Slack, Teams, email.
- Analytics: ad/social performance ingestion.

---

# 16. Security, privacy và compliance

- TLS in transit, encryption at rest, secret vault cho provider/integration credential.
- Tenant/workspace boundary; prevention of IDOR.
- Signed URL with TTL and download policy.
- File MIME validation, malware scan, quarantine state.
- SSO, MFA policy via IdP, SCIM, IP allowlist tùy enterprise plan.
- Immutable/security-protected audit log.
- Data classification: Public, Internal, Confidential, Restricted.
- Retention, legal hold, subject access/deletion workflows theo thị trường triển khai.
- Consent workflow cho voice clone, likeness, personal data và asset of real persons.
- Moderation trước provider dispatch và output QC; policy decision logged securely.

---

# 17. Reliability, scalability và observability

## 17.1. Render architecture

```text
Web / API Gateway
  → Video Orchestrator
  → Queue / Scheduler
  → Specialized workers: ingest | script | scene | TTS | compose | encode | QC | export
  → Provider adapters
  → Object Storage / CDN
  → Event bus / Notification
  → Metrics, logs, traces
```

## 17.2. Non-functional requirements

- Queue/worker scale ngang theo loại workload.
- Dead-letter queue cho job vượt retry limit.
- Circuit breaker và fallback provider policy.
- At-least-once event delivery với idempotent consumer.
- p95 API read dưới ngưỡng SLO định nghĩa; render SLA được công bố theo model/plan, không cam kết thời gian tuyệt đối khi phụ thuộc provider.
- Dashboard vận hành: queue depth, worker utilization, provider error rate, p50/p95 render duration, failed stage, credit transaction anomaly.

---

# 18. Acceptance criteria cấp nền tảng

## 18.1. Workflow production

- Từ Project, người dùng tạo được brief, video draft, render, QC, review, approval và PublishItem có liên kết xuyên suốt.
- Mọi video output truy vết được tới VideoDraft snapshot, asset version, Brand Kit version, model/provider version, pricing snapshot và reviewer decision.

## 18.2. Governance

- Video có asset expired hoặc QC Blocked không thể export/publish nếu policy active.
- Change trong draft sau approval invalidates approval theo configuration.
- Completed VideoVersion không bị ảnh hưởng bởi asset/Brand Kit sửa sau đó.

## 18.3. Scale

- Batch job cho phép validate/import và partial retry theo row.
- Render queue hỗ trợ priority/quota; job duplicate không charge credit nhiều lần.
- Dashboard/report phân quyền theo workspace/account/project.

## 18.4. Security

- User không thể truy cập resource ngoài workspace/project scope bằng cách sửa ID/URL.
- Download private output yêu cầu authentication hoặc signed URL hợp lệ.
- Every sensitive mutation appears in AuditLog.

---

# 19. Roadmap đề xuất

| Phase | Mục tiêu | Hạng mục ưu tiên |
|---|---|---|
| P1 — Professional Core | Agency/in-house team 10–50 users | Project, Video Studio, DAM basic, Brand Kit, render queue, version, review cơ bản, credit ledger |
| P2 — Governed Production | Multi-client agency và enterprise pilot | timecode review, QC gate, approval matrix, rights center, template, calendar, reports, custom RBAC |
| P3 — Enterprise Scale | Sản xuất volume lớn, multi-team | batch factory, CRM mapping, SSO/SCIM, budget/chargeback, operations center, API/webhook, localization |
| P4 — Content Factory | Personalization và tối ưu liên tục | A/B variants, AI operator agent, performance feedback loop, model routing, private/self-hosted options |

---

# 20. Quyết định cần Product Owner chốt

- Target throughput: số video/ngày, concurrent render/job, batch size.
- Market và compliance scope: Việt Nam, ASEAN, global, data residency.
- AI strategy: multi-provider, managed-only hay hybrid/private deployment.
- Pricing/credit policy: reserve, charge, retry, provider failure, refund, expiry.
- Workflow bắt buộc: ai duyệt brand/legal/client, ở loại video nào.
- Data retention/storage quota và quy tắc asset license.
- Kênh publish ưu tiên cho MVP.
- CRM/DAM nguồn cần tích hợp đầu tiên.
- Customer segmentation: SME agency, enterprise agency, real estate developer, education chain, beauty chain.

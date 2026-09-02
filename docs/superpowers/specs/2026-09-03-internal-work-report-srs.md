# SRS — Hệ thống Báo cáo Công việc Nội bộ (RNOSAI / IWRS)

**Phiên bản:** 2.0  
**Tên hệ thống:** Internal Work Reporting System (IWRS) trên RNOSAI  
**Tên tiếng Việt:** Hệ thống Báo cáo Công việc Nội bộ  
**Document ID:** IWR-20260903  
**Ngày:** 2026-09-03  
**Trạng thái:** Đặc tả sản phẩm đầy đủ — triển khai theo sóng W1–W6; chờ PO duyệt trước plan W1  
**Nguồn đối chiếu:** IWRS 1.1 (`SRS_He_thong_Bao_cao_Cong_viec_Noi_bo_v1_1.md`) — **giữ toàn bộ tầm sản phẩm**; tài liệu này là bản **gắn hệ thống** (route, bảng, cap, adapter dữ liệu đã có).  
**Prod:** `https://rs.pttads.vn` · tenant `PTT` · stack NestJS `ptt-crm-api` + Next.js ops-web + PostgreSQL  
**Route:** `/crm/internal-reports` · `/crm/internal-reports/[id]` · `/crm/internal-reports/team` · `/crm/internal-reports/inbox` · `/crm/internal-reports/dashboards` · `/crm/internal-reports/builder` · `/crm/internal-reports/templates` · `/crm/internal-reports/lists` · `/crm/internal-reports/schedules`  
**API prefix:** `/api/crm/iwr`

**Nguyên tắc:** IWRS là lớp **tổng hợp · diễn giải · phân phối · điều hành**. Không thay CRM, không thay CSD ticket, không thay Gmail, không giám sát máy NV. Báo cáo là **hội thoại công việc có bằng chứng**, không chỉ form.

**Tách kênh khách:** `/crm/csd/reports` = deliverable **gửi khách**. IWRS = **nội bộ**. Gửi ra ngoài tổ chức (nếu bật) phải approval + masking + allowlist — không đi đường `shareToClientChat` / portal khách.

---

## 1. Thông tin tài liệu

| Hạng mục | Nội dung |
|---|---|
| Hệ thống | IWRS trên RNOSAI |
| Mục tiêu | Chuẩn hóa báo cáo **ngày, tuần, tháng, tùy biến**; hộp thư nội bộ To/Cc/Bcc; DL; reply/forward; read receipt; lịch gửi; liên kết task/dự án/khách/KPI/rủi ro; dashboard theo vai; AI hỗ trợ; xuất và audit |
| Người dùng | NV, trưởng nhóm, trưởng phòng, PM, Account, HR, Ban điều hành, Template Admin, chủ DL, Super Admin |
| UI | Desktop-first ops-web; responsive; PWA đọc/nộp ngắn ở sóng sau |
| Tích hợp | Tái dùng CRM / CSD / HR / KPI / SSO JWT (và Keycloak dual) / SMTP nội bộ / notify; mở Slack/Teams/Zalo OA / webhook / BI khi bật connector |
| Staff id | INTEGER `crm_staff.id` qua `resolveCrmStaffUserId` |
| Cây quản lý | `crm_staff.reports_to_id` + `/admin/crm/org/chart` |

### 1.1. Lịch sử

| Ver | Thay đổi |
|-----|----------|
| 1.0 | Bản hẹp: tuần + ack cây |
| 1.1 | Cắt MVP sau khi đọc IWRS 1.1 |
| **2.0** | **Đặc tả đầy đủ như IWRS 1.1**, map RNOSAI, sóng W1–W6 — đáp ứng quy mô vận hành agency |

### 1.2. Bối cảnh

PTT vận hành đa phòng (Ads, Content, Account, Delivery, HR, GDKD). Báo cáo đang nằm Excel, chat, email. Cấp trên không thấy chuỗi ngày→tuần→phòng; PM/AM không cùng hộp thư với cây quản lý; BOD không có một nơi RAG + blocker + «ai đã đọc».

RNOSAI đã có org, khách, lead, CSD ticket, KPI, Owner Weekly, CEO Tower. **Thiếu lớp IWRS.** Module này bổ sung lớp đó ở mức doanh nghiệp, không invent CRM thứ hai.

### 1.3. Mục tiêu kinh doanh

- Giảm tổng hợp tay (Excel / Sheet / chat).  
- Minh bạch tiến độ, quá hạn, điểm nghẽn.  
- Phát hiện sớm rủi ro deadline / KPI / khách.  
- Dữ liệu cho đánh giá hiệu suất **có người chấm** (không auto-kỷ luật).  
- Báo cáo gắn task, deliverable, bằng chứng, chỉ số.  
- Mọi phản hồi / quyết định / phân công nằm trên đúng báo cáo.  
- Không thất lạc vì gửi rời kênh.  
- Dữ liệu chuẩn để AI tóm tắt và cảnh báo theo **đúng quyền người nhận**.

### 1.4. Mục tiêu đo được (toàn sản phẩm)

| # | Mục tiêu | Đo (sau khi sóng tương ứng sống) |
|---|----------|----------------------------------|
| G1 | Nộp ngày/tuần trên hệ | ≥90% NV diện nộp có bản hoặc `waived` sau due+1 ngày |
| G2 | Hộp thư | Báo cáo `submitted` có mặt Inbox người To ≤30s |
| G3 | Có bằng chứng | ≥70% dòng «đã xong» có `ref` hoặc `evidence_url` (kỳ UAT) |
| G4 | Phân phối có policy | 100% lần gửi log To/Cc/Bcc; Bcc không lộ Reply-all |
| G5 | Tách khách | 0 IWRS gọi `shareToClientChat` / portal; email ngoài chỉ sau approval |
| G6 | Điều hành | BOD/GDKD thấy RAG đỏ + blocker critical trên dashboard IWRS hoặc deep-link CEO/Owner Weekly |
| G7 | AI | Mọi output có nguồn + không vượt quyền; flag tắt thì core vẫn chạy |

---

## 2. Phạm vi hệ thống

### 2.1. Trong phạm vi (sản phẩm đầy đủ)

Toàn bộ IWRS 1.1 §2.1, thực thi trên RNOSAI:

- Báo cáo ngày, tuần, tháng, sự kiện, tùy biến.  
- Tự tổng hợp từ báo cáo ngày, CSD ticket, lead/khách, KPI, (sóng sau) service-delivery / campaign.  
- Dashboard NV, leader, PM/AM, trưởng phòng, HR, BOD.  
- Workflow gửi / xem / phản hồi / bổ sung / xác nhận / escalate / lưu trữ.  
- To, Cc, Bcc (Bcc theo policy, mặc định tắt NV), Reply-to, subject, message.  
- Distribution list tĩnh và động.  
- Hộp thư: Cần xử lý, Chưa đọc, Đã nhận, Đã gửi, Nháp, Chờ phản hồi, Cần bổ sung, Blocker, Phê duyệt, Lưu trữ, Thùng rác.  
- Reply, Reply all, Forward, mention, read receipt, lịch sử phân phối.  
- Blocker/rủi ro, yêu cầu hỗ trợ/phê duyệt.  
- Lịch nhắc, lịch gửi, digest, retry.  
- Xuất PDF, XLSX, CSV, JSON API, secure link có hạn.  
- Mẫu biểu + phiên bản + field có điều kiện (sóng form builder).  
- Phân quyền org + dự án/khách + độ nhạy field.  
- Adapter đọc hệ đã có; connector email nội bộ / Slack / Teams / Zalo OA / webhook.  
- AI tóm tắt, chất lượng, rủi ro — **gợi ý only**.

### 2.2. Ngoài phạm vi (cố ý — không phải «cắt IWRS»)

- Chấm công, lương, thuế, bảo hiểm (`/crm/payroll` giữ).  
- Keylog / theo dõi màn hình.  
- Gantt/sprint/source control đầy đủ.  
- Thay `/crm/leads` pipeline.  
- Thay Gmail/Outlook.  
- Data warehouse độc lập (Metabase/export đủ đến khi OLAP thật sự cần).  
- Auto-kỷ luật từ một chỉ số nộp bài.  
- Sentiment / giám sát hành vi cá nhân.  
- Gửi ngoài org **không** approval + masking.  
- Ghi `csd_reports` / gửi Client Chat như thể báo cáo khách.

### 2.3. Giả định

- Org + `reports_to_id` đã vận hành (HR giữ sạch).  
- Mỗi NV active có login JWT.  
- Task/khách có id nếu gắn (CSD ticket UUID, lead/customer id).  
- Chính sách nộp / Bcc / forward / email ngoài do Super Admin cấu hình trước go-live từng sóng.  
- VPS một tenant `PTT`; schema vẫn `tenant_id` để sau này đa agency.

### 2.4. Sóng triển khai (không giảm tầm spec)

| Sóng | Tên | Đưa vào vận hành |
|------|-----|------------------|
| **W1** | Nhân + hộp thư cơ bản | Ngày/tuần, To=QLTT, Cc cùng phòng/cây, inbox 4 tab, comment, blocker, ack/bổ sung, late, waived, PDF, notify in-app, cây kỳ, template seed |
| **W2** | Bằng chứng + gộp | Item gắn ticket/lead/khách, gợi ý task ngày, gộp nguồn + ngày→tuần chọn lọc, RAG + gợi ý rule, viewed, XLSX |
| **W3** | Phân phối doanh nghiệp | Bcc policy, DL tĩnh/động, Reply/Reply-all/Forward, mention, subject/message, delivery log, read receipt policy |
| **W4** | Dashboard + lịch | 4 dashboard, digest, scheduled send in-app + SMTP **nội bộ**, worker queue, HR leave → waived |
| **W5** | Builder + nâng cao | Custom report, widget, API/webhook, escalate, approval-request entity, field sensitivity + masking bản chia sẻ |
| **W6** | AI + kênh ngoài | Tóm tắt/digest/quality/risk theo quyền; Slack/Teams/Zalo; email ngoài + allowlist + secure link; PWA |

Mỗi sóng có UAT riêng. Spec dưới đây mô tả **đích đến W6**; cột «Sóng» trên từng FR cho biết khi nào **bắt buộc sống**.

---

## 3. Vai trò và phân quyền

### 3.1. Vai nghiệp vụ → RNOSAI

| Vai IWRS | Điều kiện trên hệ | Quyền chính |
|---|---|---|
| Nhân viên | `iwr.view` + `write` | Nháp, gửi, bổ sung, xem của mình, Cc hợp lệ |
| Trưởng nhóm | Có cấp dưới `reports_to_id` + `iwr.review` | Inbox To, phản hồi, bổ sung, ack, dashboard nhóm, DL được cấp |
| PM | Job/function PM hoặc cap `iwr.review` + scope dự án (W3+) | Báo cáo/task trong dự án được phân; gửi theo DL dự án |
| Account | Function AM + scope khách | Báo cáo/deliverable/issue theo khách được phân; không mặc định HR confidential |
| Trưởng phòng | Tổ tiên trên cây / `iwr.review` rộng | Dữ liệu phòng, gộp, KPI phòng |
| HR | `iwr.compliance` | Tỷ lệ nộp, waived, xuất đánh giá theo policy; không mặc định doanh thu/khách nhạy |
| BOD/CEO/COO | Gốc cây hoặc `iwr.executive` | Dashboard tổng hợp, RAG, quyết định, báo cáo gửi thẳng |
| System Admin | Super-admin | User (đã có), policy, connector, audit |
| Template Admin | `iwr.manage` | Mẫu, field, version, policy mặc định To/Cc |
| DL Owner | `iwr.lists` trên list mình | Thành viên / rule nhóm |

Vai **không** nhân đôi bảng role. Seed cap theo position; scope khách/dự án tái dùng staff-client-scope đã có.

### 3.2. Capability

| Cap | Ý nghĩa |
|-----|---------|
| `iwr.view` | Đọc theo visibility |
| `iwr.write` | Tạo/sửa bản mình (trạng thái cho phép) |
| `iwr.review` | Ack / request-changes / escalate trên bản mình là To hoặc được ủy quyền |
| `iwr.lists` | Tạo/sửa DL trong phạm vi |
| `iwr.schedule` | Đặt lịch gửi digest/báo cáo |
| `iwr.export` | XLSX/CSV/JSON (PDF đi với view) |
| `iwr.manage` | Template, policy, waived hàng loạt, archive, mở lại có lý do |
| `iwr.executive` | Dashboard BOD + skip-level đọc |
| `iwr.bcc` | Được dùng Bcc |
| `iwr.external` | Đề xuất gửi ngoài org (vẫn qua approval) |

### 3.3. Nguyên tắc (IWRS §3.1 — giữ nguyên)

- NV chỉ thấy bản mình trừ Cc/share/dự án.  
- Leader chỉ nhánh cây hoặc nhóm được giao.  
- PM theo dự án; AM theo khách.  
- HR theo policy nhân sự.  
- BOD tổng hợp; chi tiết nhạy cảm phân tầng.  
- Mọi xem/xuất/sửa/xóa/phản hồi/xác nhận/chia sẻ/forward/đổi người nhận = audit.  
- **Nhận không = thấy hết nguồn.** Field-level + masking trước gửi.  
- Bcc mặc định tắt với NV.

---

## 4. Yêu cầu chức năng

Mỗi FR: hành vi đầy đủ + **adapter RNOSAI** + **sóng**.

### 4.1. Danh mục (MDM)

#### FR-MDM-01 Cơ cấu tổ chức — W1 đọc / W4 nghỉ phép

Đồng bộ hoặc quản lý: công ty (tenant PTT), phòng ban, nhóm, chức danh, cây QLTT, trạng thái làm việc, QLTT, **người duyệt thay thế** (`iwr_delegations`, W4).

**Adapter:** `crm_staff`, `crm_departments`, `crm_teams`, `crm_positions`, `reports_to_id`. Không bảng org song song. Nghỉ phép: `/crm/hr/leave` → `waived` (W4); W1 waived tay `iwr.manage`.

#### FR-MDM-02 Đối tượng công việc — W2

Dự án, khách, HĐ/gói, campaign, task, milestone, KPI, OKR, loại việc, tag, ưu tiên, trạng thái, loại/mức rủi ro.

**Adapter (không invent master mới trừ khi thiếu):**

| Đối tượng | Nguồn RNOSAI |
|-----------|----------------|
| Khách | `crm_customers` / `client_account_id` |
| Lead / deal | `/crm/leads` |
| Task vận hành khách | `csd_tickets` |
| Delivery | `/crm/service-delivery` (W2+) |
| Campaign | Meta/SEO/email-marketing modules (W4+, read) |
| KPI | `/crm/kpi`, `/crm/staff-kpi` |
| OKR | Bảng `iwr_okrs` chỉ khi PO xác nhận chưa có chỗ khác (W5) |
| Dự án nội bộ xuyên phòng | `iwr_projects` mỏng W3 nếu service-delivery không đủ |

#### FR-MDM-03 Lịch làm việc — W1 rule cứng / W4 cấu hình

Ngày làm việc, giờ, deadline ngày/tuần/tháng/custom, lễ, nghỉ phép, miễn nộp, deadline theo nhóm.

**W1 mặc định:** T2–T6; ngày due 17:00; tuần due 17:00 thứ Sáu; TZ `Asia/Ho_Chi_Minh`.  
**W4:** `iwr_calendars` + ngoại lệ.

#### FR-MDM-04 Danh bạ — W1 cơ bản / W3 quan hệ

Tìm tên, email, mã NV, chức danh, team, phòng; trạng thái active; quan hệ (QLTT, cùng team, thành viên dự án, AM khách); chỉ trả người được chọn theo recipient policy; không lộ user restricted.

**API:** `GET /api/crm/iwr/directory?q=&purpose=cc|to|bcc|mention`.

---

### 4.2. Mẫu báo cáo

#### FR-TPL-01 Tạo mẫu — W1 seed / W5 builder

Loại: ngày, tuần, tháng, dự án, khách, sự kiện, tùy chỉnh.

Mỗi mẫu: tên, mã, loại, phạm vi (công ty/phòng/nhóm/vai/dự án), chu kỳ, mở form / hạn nộp, duyệt/xem mặc định, To/Cc/DL mặc định, cờ cho phép đổi người nhận / Bcc / forward / export / kênh ngoài, active, version, hiệu lực.

**W1:** `daily_work`, `weekly_work`, `monthly_work` — sửa `name_vi`, `sections_json`, `due_rule_json`.  
**W5:** scope + distribution_policy + version có ngày hiệu lực.

#### FR-TPL-02 Kiểu trường — W5

Text ngắn/dài, số, %, datetime, dropdown 1/n, checkbox, radio, user, phòng, dự án, khách, task, KPI/OKR, tag, ưu tiên, rủi ro, file, URL, computed, sync.

**W1–W4:** section key cố định + item typed JSON.  
**W5:** `iwr_template_fields`.

#### FR-TPL-03 Quy tắc form — W2 cảnh báo / W5 đầy đủ

Bắt buộc, mặc định, hiện/ẩn có điều kiện, min/max ký tự, file, validate URL, giới hạn chọn theo quyền, cảnh báo trùng nội dung kỳ trước, cảnh báo «xong» nhưng ticket chưa closed, sensitivity per field, masking khi gửi người thiếu quyền.

#### FR-TPL-04 Version template — W5

Báo cáo đã gửi giữ schema cũ; kích hoạt version mới theo ngày; rollback; hiện `template_version` trên báo cáo.

---

### 4.3. Báo cáo ngày

#### FR-DAILY-01 Tạo — W1

Hệ thống tạo nháp theo lịch (W1: CTA «Mở hôm nay» tạo nếu chưa có; W2: worker pre-create 06:00).

Nhóm: thông tin chung; việc xong; đang làm; kế hoạch tiếp; blocker; yêu cầu phê duyệt; ghi chú.

#### FR-DAILY-02 Lấy task — W2

Khi mở: đề xuất ticket closed/updated hôm nay, sắp due, overdue, blocked, lead cập nhật; user chọn/bỏ; thêm việc phát sinh; **tạo CSD ticket từ dòng** nếu `csd.write` (W3).

W1: nhập tay + gắn id nếu biết.

#### FR-DAILY-03 Kết quả — W2

Mỗi dòng xong: title, mô tả, loại đầu ra, số lượng, đơn vị, %, thời gian (optional W4), evidence URL/file (W2 URL, W4 file `csd_attachments` entity `iwr_item`), ref ticket/lead/khách, cần review.

#### FR-DAILY-04 Blocker — W1 mục / W3 entity

W1: item trong section `blocked` (title, mô tả, severity).  
W3: `iwr_risks` đầy đủ (loại, impact, owner, due phản hồi, trạng thái, carry-forward). Critical → notify ngay (≤60s), không chờ digest.

#### FR-DAILY-05 Nháp / gửi — W1

Autosave; thiếu field chặn nộp; chọn Cc (W1) / Bcc (W3); rút trước khi reviewer xử lý; bổ sung sau request-changes; nộp muộn + lý do; báo cáo bù ngày trước (`iwr.manage` hoặc policy, W2).

#### FR-DAILY-06 Trạng thái — W1 lõi / W3 mở rộng

| Status hệ | IWRS |
|-----------|------|
| `draft` | Nháp |
| `submitted` | Đã gửi |
| `changes_requested` | Cần bổ sung |
| `supplemented` | Đã bổ sung (alias submitted + flag) |
| `acknowledged` | Đã xác nhận |
| `waived` | Không cần nộp |
| `archived` | Lưu trữ |

Cờ: `is_late`, `late_reason`, `first_viewed_at` (Đã xem). Overdue chưa nộp = **derived**. Không status `sent` (tránh CSD).

#### FR-DAILY-07 Phản hồi — W1 comment / W3 mention+loại

Comment toàn bộ hoặc theo `section_key` / item. W3: mention, loại (câu hỏi / việc / ghi nhận / quyết định), đóng thread, tạo ticket từ comment.

---

### 4.4. Báo cáo tuần (và tháng)

#### FR-WEEKLY-01 Tạo + tổng hợp — W1 tạo / W2 rollup

Nháp tuần (CTA hoặc worker chiều T6). Tổng hợp: các ngày trong kỳ, ticket, KPI, blocker mở, approval mở, missing cấp dưới.

User chọn dòng đưa vào; **không** ghi đè nhận định.

#### FR-WEEKLY-02 Cấu trúc — W1

1 RAG · 2 Ưu tiên · 3 Highlights · 4 KPI snapshot · 5 Deliverable · 6 WIP · 7 Blocker · 8 Plan vs actual · 9 Tuần sau · 10 Cần quyết định.

Tháng: thêm highlights tháng + people (text, không lương).

#### FR-WEEKLY-03 RAG — W2 gợi ý

Xanh / Vàng / Đỏ / Xám. Rule gợi ý (overdue P1, blocker high, KPI dưới ngưỡng) lưu `rag_hint`; không ghi đè im lặng.

#### FR-WEEKLY-04 Cá nhân / nhóm / phòng / dự án / khách / công ty — W1 cây+gộp / W3 theo khách

Cấp trên tự viết + gắn `source_report_ids`. Được sửa nhận định, chọn highlight, ẩn chi tiết theo quyền (W5 masking).

#### FR-WEEKLY-05 Plan vs actual — W1 bảng text / W5 computed

Cột: kế hoạch, thực tế, mức xong, lệch, nguyên nhân, hành động, owner, deadline.

---

### 4.5. Phân phối và hộp thư

#### FR-DIST-01 Chọn người nhận — W1 To+Cc / W3 đầy đủ

Nguồn: user, QLTT, cùng team/phòng, thành viên dự án, AM khách, DL, role, list động, email ngoài (W6 + approval).

Autocomplete; chặn/mask nếu thiếu quyền; cảnh báo bỏ To bắt buộc; cảnh báo blocker critical chưa gửi owner.

#### FR-DIST-02 To/Cc/Bcc/Reply-to — W1 To+Cc / W3 còn lại

From khoá. To ≥1 (user hoặc DL). Cc optional. Bcc chỉ `iwr.bcc` + audit. Reply-to mặc định tác giả hoặc QLTT. Subject tự sinh, sửa nếu policy. Message rich text. Attachment / PDF. Delivery: now / later / cron / event (W4).

#### FR-DIST-03 Default theo workflow — W3

Theo loại, template, phòng, team, vai, cây, dự án, khách, loại rủi ro, RAG, ngưỡng KPI.

Ví dụ PTT: ngày NV → To QLTT; tuần → To TL, Cc AM nếu có ref khách; RAG đỏ → thêm GDKD/COO vào digest; blocker critical → owner + QLTT + escalation.

#### FR-DIST-04 Distribution list — W3

Tên, mã, owner, loại (tĩnh / phòng / role / dự án / khách / rule / subscribe), thành viên hoặc rule, scope, ai được dùng, loại báo cáo, mức dữ liệu, active, lịch sử, audit.  
Động: mọi TL Marketing; member dự án X; AM+PM khách Y; owner dự án RAG đỏ.

#### FR-DIST-05 Recipient policy — W3 cấu hình / W1 hard-code

W1 hard-code: To = `reports_to_id` không xoá; Cc = cùng `department_id` hoặc trên cây hoặc `iwr.manage`; Bcc off; không email ngoài.  
W3: `iwr_recipient_policies` JSON theo vai/loại/template/phòng/dự án/khách/sensitivity/kênh.

#### FR-DIST-06 Hộp thư — W1 4 tab / W3 đủ cây thư mục

```
Hộp thư báo cáo
├── Cần xử lý          (To + cần ack/bổ sung/approval)
├── Chưa đọc
├── Đã nhận            (To/Cc/Bcc riêng mình)
├── Đã gửi
├── Nháp
├── Đang chờ phản hồi
├── Báo cáo cần bổ sung
├── Blocker / Rủi ro
├── Yêu cầu phê duyệt
├── Đã lưu trữ
└── Thùng rác
```

Lọc + tìm (W1 filter cột; W3 FTS PG; W5 OpenSearch nếu > ngưỡng). Đọc/chưa đọc, ghim, sao, tag, archive, trash + retention.

#### FR-DIST-07 Reply / Forward — W3

Reply, Reply all (không lộ Bcc), Forward + check quyền + cảnh báo nhạy + audit. Thread. Mention. Comment → task/risk/approval.

#### FR-DIST-08 Read receipt & delivery — W2 viewed / W3 log / W4 kênh

Ghi: lúc gửi, sender, To/Cc/Bcc snapshot, file, kênh, queued/sent/delivered/failed/bounced/read, lúc xem, phản hồi gần nhất, forward history, version, archive.

Policy: ai thấy đã đọc; ẩn receipt báo cáo nhạy; **cấm** dùng read rate làm KPI duy nhất (BR-28, BR-15).

#### FR-DIST-09 Lịch gửi — W4

Now / one-shot / daily/weekly/monthly/quarterly / cron; TZ; người nhận/DL; format notify|inline|PDF|XLSX|CSV|secure link; điều kiện (luôn / có data / vượt ngưỡng / đổi trạng thái); kênh; retry; job history.

#### FR-DIST-10 Kênh ngoài — W4 SMTP nội bộ / W6 còn lại

Email nội bộ (tái `CsdEmailService` **chỉ** domain PTT). Slack, Teams, Zalo OA, webhook, Drive/SharePoint/S3.  
Ngoài org: allowlist, approval, expiry link, thu hồi, không file nhạy trực tiếp.

**Cấm** nhầm CSD Client Chat.

---

### 4.6. Báo cáo tùy biến — W5

#### FR-CUSTOM-01 Builder

Nguồn, thời gian, org, user/nhóm/phòng, dự án, khách, loại việc, trạng thái task/báo cáo, rủi ro, ưu tiên, KPI, người giao/làm/duyệt, gửi/nhận, đọc, delivery, tag, đúng hạn/muộn, field template.

#### FR-CUSTOM-02 Hiển thị

Bảng, pivot, KPI tile, cột/đường/donut, workload, RAG, overdue, blocker, timeline, heatmap nộp, chỉ số phân phối (gửi / delivery / read / phản hồi đúng hạn).

Chart: CSS hoặc lib đã có — **không** bắt Chart.js nếu policy CSD cấm; dùng Recharts/SVG nội bộ.

#### FR-CUSTOM-03 Lưu / chia sẻ

Tên, tag, scope, quyền xem/sửa/nhân bản/xuất/lịch, clone, widget dashboard, favorite, lịch sử config.

#### FR-CUSTOM-04 Lịch

Trùng FR-DIST-09 trên definition builder.

---

### 4.7. Dashboard — W4 (W1: widget trên list)

#### FR-DASH-01 NV

Hạn nộp, task hôm nay/sắp due/overdue/block (từ adapter), blocker đã gửi, phản hồi mới, inbox chưa đọc, KPI cá nhân, lịch sử đúng hạn.

#### FR-DASH-02 Leader

Nộp/chưa/muộn, cần xem, ưu tiên cao, overdue theo người, blocker mới/tồn, workload, % task xong, KPI team, người quá nhiều P1, RAG vàng/đỏ, việc cần quyết định.

#### FR-DASH-03 PM/AM

Milestone, deliverable due, overdue, workload member, blocker khách, SLA CSD, RAG, chờ khách, bằng chứng bàn giao, báo cáo To chưa đọc quá SLA.

#### FR-DASH-04 BOD

Công ty/phòng/dự án/khách/kỳ: tỷ lệ nộp, task xong/overdue/block, RAG list, rủi ro high, workload, KPI, approval chờ, rework (nếu có), billable (W6), margin (chỉ nếu finance cap + dữ liệu). Drill-down ≤3 click (SYS-UC-007).

Không thay Owner Weekly / CEO Tower — **deeplink + chip IWRS**.

---

### 4.8. Notification — W1 in-app / W4 đa kênh

#### FR-NOTI-01 Nhắc nộp

Trước due, đúng due, overdue, tần suất, kênh, nhận (NV, QLTT, HR), skip nếu leave/lễ/đã nộp/waived.

#### FR-NOTI-02 Cảnh báo

Blocker high/critical, P1 overdue, yêu cầu bổ sung, mention, báo cáo mới tới mình, approval due, tỷ lệ nộp team thấp, đổi RAG, đổi quyền bất thường, export xong/fail, chưa đọc quá SLA.

#### FR-NOTI-03 Digest

Leader/PM/BOD: chưa nộp, blocker, overdue, approval, đổi RAG, KPI lệch, chưa đọc, ưu tiên ngày.

---

### 4.9. Phê duyệt — W1 ack / W5 entity

#### FR-APR-01 Workflow báo cáo

Xem, xác nhận, yêu cầu bổ sung, chuyển tiếp, escalate, invalid, đóng/lưu trữ. Cấu hình theo loại/phòng/vai/dự án/khách/rủi ro/KPI.

#### FR-APR-02 Yêu cầu phát sinh — W5

Từ báo cáo: duyệt ngân sách, duyệt creative, đổi scope, gia hạn, thêm người, lỗi kỹ thuật, xin data khách, ưu tiên.  
Entity `iwr_approvals`: mã, loại, requester, approver, ưu tiên, due, payload, status, lịch sử, quyết định, file.

Duyệt ngân sách **không** ghi payroll; có thể deeplink module tài chính nếu có.

---

### 4.10. AI — W6 (spec đủ từ đầu)

Cờ `PTT_IWR_LLM=0` mặc định (VPS 3.3GiB). Bật mới gọi gateway. Core W1–W5 **không** phụ thuộc LLM.

#### FR-AI-01 Tóm tắt

Ngày, ngày→tuần, team/phòng/dự án, executive BOD, digest theo quyền nhận. Nguồn + `intent`/citations.

#### FR-AI-02 Chất lượng

Quá ngắn, thiếu đầu ra, xong không evidence, lặp ngày, kế hoạch lệch task, có blocker chưa tạo risk, thuật ngữ nhạy.

#### FR-AI-03 Rủi ro

Trễ hạn, blocker lặp, reopen, overload, scope creep, KPI xuống, issue khách, chưa đọc quá SLA.

Mọi cảnh báo: độ tin / lý do, link nguồn, dismiss/sai/xác nhận; không tự đổi KPI/đánh giá; **không** đưa data vượt quyền vào prompt.

---

### 4.11. Xuất & audit

#### FR-EXP-01 — W1 PDF / W2 XLSX+CSV / W5 JSON+link

Tôn trọng quyền, field ẩn, watermark (W5), secure link (W6).

#### FR-AUD-01 — W1 sự kiện lõi / W3 phân phối / W6 AI

Log: login (hệ sẵn); tạo/sửa/gửi/rút/bổ sung/ack/archive; xem nhạy; template; đổi quyền; xuất; lịch; To/Cc/Bcc; DL; reply/forward/mention; delivery/read/retry; risk/approval; AI đề xuất/chấp nhận.

Gồm time, actor, IP/UA nếu policy, object, before/after, kết quả.  
Chọn **một**: `iwr_audit` hoặc `csd_audit_logs` `entity_type='iwr_*'`.

---

## 5. Quy tắc nghiệp vụ

Giữ **BR-01 … BR-31** của IWRS 1.1 (nguyên văn ý). Bổ sung RNOSAI:

| Mã | Quy tắc |
|---|---|
| BR-32 | IWRS không ghi `csd_reports` / không `shareToClientChat` / không portal khách |
| BR-33 | Staff id trên mọi bảng IWRS = INTEGER `crm_staff.id` |
| BR-34 | Cây duyệt mặc định = `reports_to_id`; ủy quyền W4 không xoá snapshot To lúc nộp |
| BR-35 | `PTT_IWR_LLM=0` ⇒ không gọi model; UI không badge Stub |
| BR-36 | Copy UI tiếng Việt |
| BR-37 | Unique `(author, template, period_start, period_end)` trừ bản `is_deleted` |
| BR-38 | Comment bắt buộc trước `changes_requested` (insert-first hoặc transaction) |
| BR-39 | Ack/waived/archived: sections immutable; Admin mở lại = `iwr.manage` + lý do + audit (W5) |
| BR-40 | Worker nhắc tối đa 1 lần / (user, kỳ, template, event_key) |

---

## 6. Mô hình dữ liệu

`tenant_id` NOT NULL mặc định `PTT`. `IF NOT EXISTS`.

| Bảng | Sóng | Vai trò |
|---|---|---|
| `iwr_templates` / `iwr_template_versions` / `iwr_template_fields` | W1 / W5 / W5 | Mẫu |
| `iwr_calendars` / `iwr_calendar_exceptions` | W4 | Lịch |
| `iwr_delegations` | W4 | Duyệt thay |
| `iwr_reports` | W1 | Báo cáo |
| `iwr_report_versions` | W1 | Phiên bản + sections snapshot |
| `iwr_report_items` | W2 | Dòng kết quả / wip |
| `iwr_report_recipients` | W1 | to/cc/bcc |
| `iwr_distributions` / `iwr_delivery_logs` | W3 | Lần gửi + kênh |
| `iwr_distribution_lists` / `iwr_list_members` | W3 | DL |
| `iwr_recipient_policies` | W3 | Policy |
| `iwr_comments` / `iwr_threads` | W1 / W3 | Hội thoại |
| `iwr_mentions` | W3 | @ |
| `iwr_risks` | W3 | Blocker entity |
| `iwr_approvals` | W5 | Yêu cầu phê duyệt |
| `iwr_report_sources` | W1 | Gộp cấp |
| `iwr_saved_reports` / `iwr_dash_widgets` | W5 / W4 | Builder + dashboard |
| `iwr_schedules` / `iwr_jobs` | W4 | Lịch |
| `iwr_okrs` | W5 nếu thiếu | OKR |
| `iwr_projects` | W3 nếu thiếu | Dự án mỏng |
| `iwr_attachments` hoặc `csd_attachments` entity `iwr_*` | W4 | File |
| `iwr_audit` hoặc `csd_audit_logs` | W1 | Audit |
| Notify | `csd_notifications` entity `iwr_*` | W1 |

**`iwr_reports` cột lõi:** author, reviewer snapshot, period, tz, status, version, rag, is_late, late_reason, first_viewed_*, metrics_json/at, sensitivity, template_id + template_version, submitted/ack timestamps.

Unique author+template+period. Index reviewer+status, recipients.staff_id.

---

## 7. API

Prefix `/api/crm/iwr`. JWT. Pagination, filter, sort. Idempotency-Key trên POST gửi/lịch (W4). Route tĩnh trước `:id`.

### 7.1. Nhóm endpoint (đầy đủ đích)

- `GET/POST /reports` · `GET/PATCH /reports/:id` · sections · items · submit · withdraw · acknowledge · request-changes · waive · reopen · sources · metrics/refresh · export.pdf|.xlsx|.csv  
- `GET/PATCH /reports/:id/recipients`  
- `GET/POST /reports/:id/comments` · resolve · mention  
- `POST /reports/:id/reply` · `reply-all` · `forward` (W3)  
- `GET /inbox` (box=…)  
- `GET /directory`  
- `GET /team`  
- `GET/POST /templates` · versions · archive  
- `GET/POST /lists` · members · preview-dynamic (W3)  
- `GET/POST /policies` (W3)  
- `GET/POST /risks` · close · assign (W3)  
- `GET/POST /approvals` · decide (W5)  
- `GET /dashboards/:role` (W4)  
- `GET/POST /saved-reports` · run · share (W5)  
- `GET/POST /schedules` · run · jobs (W4)  
- `GET /delivery-logs` (W3)  
- `GET /audit` (manage)  
- `POST /ai/summaries` · `insights` · `feedback` (W6, 404 nếu flag off)  
- `POST /webhooks/:id/test` (W5)

### 7.2. Lỗi ổn định

`iwr_not_workday` `iwr_period_exists` `iwr_immutable` `iwr_bad_transition` `iwr_not_author` `iwr_not_direct_manager` `iwr_cc_not_allowed` `iwr_bcc_forbidden` `iwr_to_locked` `late_reason_required` `rag_required` `comment_required` `iwr_source_not_eligible` `iwr_recipient_masked` `iwr_external_needs_approval` `iwr_llm_disabled`

### 7.3. Tích hợp

| Hệ | Hướng | Sóng |
|---|---|---|
| JWT / Keycloak dual | Auth | Có sẵn |
| crm_staff / org | Đọc | W1 |
| CSD tickets | Đọc; tạo từ dòng W3 | W2–W3 |
| Leads / customers | Đọc | W2 |
| KPI | Đọc | W2 |
| HR leave | Đọc | W4 |
| csd_notifications | Ghi | W1 |
| CsdEmailService | SMTP **nội bộ** | W4 |
| Slack/Teams/Zalo | Ra | W6 |
| Webhook | Ra | W5 |
| CEO / Owner Weekly | Deeplink | W4 |
| **Không** | csd_reports write, portal, ceo_command_turns | — |

---

## 8. Màn hình (SCR)

| Mã | Tên | Route | Sóng |
|---|---|---|---|
| SCR-CRM-031 | Hộp thư IWRS | `/crm/internal-reports` | W1 |
| SCR-CRM-032 | Soạn / đọc / phân phối | `/crm/internal-reports/[id]` | W1 |
| SCR-CRM-033 | Cần xử lý (deep box) | `/crm/internal-reports/inbox` | W1 |
| SCR-CRM-034 | Cây kỳ | `/crm/internal-reports/team` | W1 |
| SCR-CRM-035 | Mẫu | `/crm/internal-reports/templates` | W1/W5 |
| SCR-CRM-036 | Dashboard IWRS | `/crm/internal-reports/dashboards` | W4 |
| SCR-CRM-037 | Report builder | `/crm/internal-reports/builder` | W5 |
| SCR-CRM-038 | Distribution lists | `/crm/internal-reports/lists` | W3 |
| SCR-CRM-039 | Lịch gửi / jobs | `/crm/internal-reports/schedules` | W4 |

Nav **BC công việc** (Tổ chức). Không đặt Service Desk. Badge: `Nội bộ — không gửi khách trừ khi đã duyệt ngoại`.

---

## 9. NFR

Giữ IWRS 1.1 §8, điều chỉnh hạ tầng thật:

| Mã | Yêu cầu |
|---|---|
| NFR-PERF-01 | Dashboard phổ biến p95 ≤3s khi đã aggregate (W4 materialize nightly + refresh 15p) |
| NFR-PERF-02 | Lưu/nộp p95 ≤2s trừ upload |
| NFR-PERF-03 | Custom &lt;100k dòng ≤10s; lớn hơn async job (W5) |
| NFR-PERF-04 | Export lớn async + notify |
| NFR-PERF-05 | Blocker critical notify ≤60s |
| NFR-PERF-06 | Inbox nội bộ ≤30s |
| NFR-PERF-07 | Directory p95 ≤1s LIMIT 20 |
| NFR-SEC-01 | JWT + MFA Keycloak nếu position yêu cầu (đã có dual) |
| NFR-SEC-02 | RBAC cap + scope phòng/dự án/khách + sensitivity |
| NFR-SEC-03 | TLS (prod sẵn); cột nhạy encrypt-at-rest W5 nếu PO yêu cầu |
| NFR-SEC-04 | File: mime allowlist, max 100MB (pattern CSD), quét W6 |
| NFR-SEC-05 | Secure link expiry + revoke (W6) |
| NFR-SEC-06 | Không leak qua API/export/cache/notify/AI |
| NFR-SEC-07 | Audit append-only, retention 7 năm (cùng policy CSD) |
| NFR-SEC-08 | Masking field (W5) |
| NFR-SEC-09 | Bcc không lộ UI/API/export/reply-all |
| NFR-SEC-10 | Kênh ngoài: secure link nếu nhạy (W6) |
| NFR-REL | Backup VPS hiện tại; job fail có log + retry tay; idempotent send |
| NFR-UX | VI mặc định; daily 1 scroll template cơ bản; &lt;5 phút nếu đã cập nhật ticket; a11y cơ bản |
| NFR-SCALE | Hàng trăm user PTT; queue khi W4 (Redis/Bull **nếu chưa có thì thêm có kiểm soát** — không Kafka W1) |

---

## 10. User stories & nghiệm thu

Giữ US-01…US-09 IWRS 1.1; bổ sung RNOSAI:

**US-10 Tách CSD:** Là AM, tôi không thấy IWRS trong «Báo cáo SD»; gửi khách vẫn `/crm/csd/reports`.

**US-11 Gắn ticket:** Là NV, tôi chọn ticket CSD closed hôm nay vào dòng xong (W2).

**US-12 RAG:** Là TL, tuần có blocker critical — hệ gợi ý Đỏ, tôi giữ Vàng và lý do được lưu (W2).

**US-13 Bcc:** Là GDKD (`iwr.bcc`), tôi Bcc HR compliance; NV Reply-all không thấy HR (W3).

**US-14 AI tắt:** VPS `PTT_IWR_LLM=0` — không nút Tóm tắt AI; nộp vẫn được (W1–W5).

Tiêu chí US-01…09: như file đính kèm; thay «task hệ ngoài» bằng ticket/lead RNOSAI khi chưa bật connector.

---

## 11. Kiến trúc trên RNOSAI

```
ops-web /crm/internal-reports
        → /api/crm/iwr  (IwrModule)
                → IwrReportsService / Distribution / Inbox / Template / Risk / Schedule / Ai
                → đọc: CrmStaff, CsdTickets (read), Leads, Kpi, HrLeave
                → ghi: iwr_*, csd_notifications, csd_audit_logs (entity iwr)
                → W4: IwrScheduleWorker (setInterval rồi chuyển queue)
                → W4: CsdEmailService (domain nội bộ)
                → W6: IwrLlmGateway (tắt mặc định)
```

- Domain: Report, Item, Template, Risk, Approval, Distribution, Recipient, List, Thread, Schedule.  
- Không free SQL.  
- CQRS nhẹ W4: bảng `iwr_dash_snapshots` cho dashboard.  
- Policy engine W3: một hàm `assertCanReceive(actor, recipient, reportView)`.  
- Event nội bộ (in-process W1, table-outbox W4): `ReportSubmitted`, `ReportDistributed`, `ReportRead`, `RiskCreated`, `DeadlineMissed`.

---

## 12. Roadmap sóng (chi tiết làm plan)

### W1 — Nhân + hộp cơ bản

DDL reports/templates/recipients(to,cc)/comments/sources; daily+weekly+monthly; submit/withdraw/ack/request-changes/waive/late; inbox 4 tab; cây; PDF; notify 5 event; directory Cc; guide 30; Jest+e2e.  
**UAT:** vòng A↔B ngày/tuần; Cc cùng phòng; không Gửi khách.

### W2 — Bằng chứng + gộp

Items + gợi ý ticket/lead; metrics refresh; RAG hint; first_viewed; XLSX; rollup ngày→tuần chọn dòng; báo cáo bù.  
**UAT:** ≥1 dòng có ref; PDF/XLSX; viewed.

### W3 — Phân phối DN

Bcc cap; DL; reply/all/forward; mention; distributions+delivery_logs; policies; risks entity; FTS.  
**UAT:** US-02/04/08/13.

### W4 — Dashboard + lịch

4 dashboard; digest; schedules; SMTP nội bộ; leave→waive; delegations; file đính kèm.  
**UAT:** US-06 (một phần), US-09 in-app+email nội bộ.

### W5 — Builder + bảo mật field

Saved reports, widgets, API/webhook, approvals, template fields+version, masking, reopen, JSON export.  
**UAT:** US-05/07, BR-23/25.

### W6 — AI + ngoài

LLM flag, Slack/Teams/Zalo, email ngoài + allowlist + secure link, PWA.  
**UAT:** US-14; AI không vượt quyền; ngoài org phải duyệt.

Deploy mỗi sóng: `APPLY=1 ./scripts/deploy_iwr_vps.sh` (DDL iwr + build). Không `deploy_csd_vps.sh`. Không bật `PTT_IWR_LLM` cho đến W6 + PO.

---

## 13. File map (khi code)

| Path | Việc |
|---|---|
| `docs/specs/2026-09-03-postgresql-ddl-iwr.sql` | DDL tăng dần theo sóng |
| `services/ptt-crm-api/src/iwr/**` | Nest module |
| `services/ops-web/src/app/crm/internal-reports/**` | App router |
| `services/ops-web/src/lib/crm/iwr-api.ts` | Client |
| `services/ops-web/src/components/crm/iwr/**` | UI |
| `services/ops-web/e2e/iwr-*.spec.ts` | E2E theo sóng |
| `docs/huong-dan-su-dung/30-bao-cao-cong-viec-noi-bo.md` | Guide |
| `OpsNav.tsx` | BC công việc |
| `scripts/deploy_iwr_vps.sh` | Deploy |

---

## 14. Định hướng agency (IWRS §13 — giữ)

```
Khách → Campaign/Delivery → Ticket/Lead → Deliverable
  → Báo cáo ngày/tuần → Risk → Inbox/To/Cc → KPI → Dashboard
```

Ví dụ: Content gửi ngày To TL, Cc AM+PM; blocker «khách chưa duyệt» Cao → AM+PM+Head; campaign Đỏ → COO vào digest.

Câu BOD trả lời được: khách rủi ro, deliverable trễ, team quá tải, blocker nội bộ vs chờ khách, ai đã đọc, KPI lệch, quyết định nào chờ.

---

## 15. Quyết định đã chốt cho PTT (trả lời IWRS §12)

| # | Hỏi IWRS | Chốt v2.0 |
|---|----------|-----------|
| 1 | Ai nộp ngày? | Mọi staff active có login; root cây không bắt buộc ngày; waived/leave miễn |
| 2 | Khi nào nộp ngày? | 17:00 cùng ngày (VN) |
| 3 | Billable? | Không W1–W5; W6 optional nếu có time source |
| 4 | Nguồn task? | CSD ticket + lead (+ delivery W2); không bắt ClickUp |
| 5 | Tách báo cáo khách? | **Có — CSD Reports** |
| 6 | Ack bắt buộc? | Có, với bản có To (QLTT) |
| 7 | Nhạy cảm? | Cấm lương/đánh giá HR/chi phí ads trong field thường; finance/HR confidential = sensitivity + masking W5 |
| 8 | Thêm người nhận? | Cc theo policy; To không bỏ |
| 9 | To/Cc/Bcc | To+Cc mọi NV (Cc bị policy); Bcc chỉ `iwr.bcc` |
| 10 | Forward | Có từ W3; cấm forward HR/finance confidential |
| 11 | Email ngoài | W6 + approval + allowlist; mặc định tắt |
| 12 | Read receipt | Có; QLTT + sender; không dùng làm KPI đơn |
| 13 | DL | W3; owner + `iwr.lists`; động từ phòng/role/khách |
| 14 | Host/AI | Self-host VPS; AI W6 flag off |
| 15 | KPI đâu? | Module KPI hiện có |
| 16 | Profitability | Không IWRS trừ deeplink financials + cap |

---

## 16. Self-review

- Đủ phân hệ IWRS 1.1 (ngày, tuần, custom, dist, inbox, dash, AI, NFR, US, kiến trúc, roadmap).  
- Mỗi FR có adapter RNOSAI + sóng — **không** bắt stack Kafka/GraphQL/.NET.  
- Tầm sản phẩm = cao cấp quy mô công ty; W1 vẫn ship được.  
- CSD khách / IWRS nội bộ tách.  
- Không TBD bắt buộc trước W1; W5–W6 có điều kiện flag/PO.

---

## 17. Từ điển

| Thuật ngữ | Nghĩa |
|-----------|--------|
| IWRS 1.1 | File đính kèm — tầm nhìn gốc |
| IWRS / SRS 2.0 | Đặc tả gắn RNOSAI (tài liệu này) |
| To / Cc / Bcc | Người duyệt chính / thông báo / ẩn |
| W1…W6 | Sóng triển khai |
| CSD Reports | Báo cáo gửi **khách** |

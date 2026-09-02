# Service Desk (CSD) — Hướng dẫn nhanh AM/PM

**Đường dẫn:** `/crm/csd` · **Quyền:** `csd:view` (xem) · `csd:write` (phản hồi/tạo) · `csd:assign` · `csd:manage`

Service Desk là kênh ticket **agency** (PTT-2026-xxxxx), tách biệt **Ticket CS** tại `/crm/tickets`.

## 1. Tổng quan (`/crm/csd`)

- **Cần xử lý** — ticket chưa gán hoặc đang mở.
- **SLA rủi ro** — ticket sắp trễ hạn xử lý.
- **Báo cáo đến hạn** — báo cáo tuần/tháng cần gửi khách.
- **Email chờ xử lý** — inbound chưa khớp hoặc chưa tạo ticket.

## 2. Ticket (`/crm/csd/tickets`)

1. **Tạo ticket** — tiêu đề, loại, ưu tiên P1–P4; hệ thống sinh mã `PTT-YYYY-NNNNNN` và SLA due.
2. **Chi tiết 3 cột** — meta trái · timeline giữa · composer phải.
3. **Gửi cho khách hàng** — phản hồi công khai (tab Public).
4. **Ghi chú nội bộ** — không gửi SMTP, chỉ staff thấy.
5. **Bản nháp AI** — chèn vào composer; **luôn rà soát** trước khi bấm gửi.
6. **Resolve** — bắt buộc ghi chú xử lý; có thể tick gửi tóm tắt công khai.

## 3. Chat (`/crm/csd/chat`)

- **Mới** mở dialog: Khách / Nội bộ nhóm / DM / Dự án. Không còn tạo im lặng `demo-client`.
- **DM** đúng 2 người — tạo lại cùng cặp thì mở thread cũ. **Nhóm** cần tên + ít nhất 1 staff id.
- Filter chips: Tất cả · Chưa đọc · Khách · Dự án · Nội bộ (DM + nhóm).
- **Tìm** hội thoại / nội dung tin (≥ 2 ký tự). Gõ `@staffId` để nhắc; `#PTT-YYYY-NNNNNN` gợi ý ticket (không tự tạo).
- Panel phải **Ticket liên quan** — mở cùng tab. Pill hiện `mã · priority · status`.
- Hội thoại khách — banner **Bạn đang gửi cho khách hàng**. Nội bộ không có banner vàng.
- **Tạo ticket từ tin nhắn** — trùng nguồn chỉ sinh **một** mã ticket; pill mở cùng tab. Thông báo (announcement) không tạo ticket.
- **Trả lời** tin (Enter gửi, Shift+Enter xuống dòng).
- **Đính file** (tối đa 100MB). Chat khách: file luôn `client`. Chat nội bộ/DM/nhóm: file `internal` — tạo ticket từ tin **không** copy file internal.
- **Sửa** tin của mình trong 15 phút. **Xóa** tin của mình — timeline hiện **Đã xóa**, không trả lại nội dung.
- Thành viên: thêm staff id / xóa (không xóa chủ hội thoại). Đóng / Mở lại khóa composer.
- **Tóm tắt AI** trên panel phải (24h / 7d / all) — chỉ nháp, không gửi khách.
- Poll tin nhắn mỗi 5 giây (MVP, không WebSocket).
- **Gợi ý P1/P2** từ keyword (vd. “ngưng chạy”) — chip gợi ý tạo ticket, **không** tự sinh mã.
- Tạo ticket trùng nguồn → dialog **Đã có {code} [Mở]** (không tạo ticket con).
- **Lưu trữ** hội thoại — ẩn composer (khác đóng: reopen được).
- **Tóm tắt AI** → từng action có nút **Tạo ticket** (`source_type=ai_draft`).
- Copy link `/crm/csd/chat?c={id}&m={mid}` · Chuyển tiếp (quote, không file).
- Mobile ≤960px: một cột (list / thread / ngữ cảnh). Sidebar **Chat (n)** khi có hội thoại chưa đọc.

## 3b. Hộp thoại Chat (dock)

- Góc phải CRM: nút Chat + badge. Không hiện trên `/crm/csd/chat`.
- NV đăng nhập CRM bằng `/login`. Mở hộp thoại Chat phải nhập **tên + mật khẩu chat** do Admin cấp tại `/admin/crm/csd/chat-accounts` (không phải mật khẩu /login).
- Tab Tin nhắn / Danh bạ / Lời mời. DM mới cần kết bạn.
- Nhóm / chat khách / dự án không cần kết bạn.
- Mở rộng → `/crm/csd/chat?c=`.

## 4. Email (`/crm/csd/email`)

- Hộp thư dùng chung `support@…` — inbound IMAP → ticket hoặc unmatched.
- Subject có `[PTT-2026-000123]` → append ticket hiện có.
- Email nhạy cảm (báo giá, hoàn tiền, khiếu nại…) cần duyệt trước khi gửi.

## 5. Báo cáo (`/crm/csd/reports`)

Luồng chuẩn: **Tạo** (4 mẫu) → **Gộp ticket / rollup** → **Gửi duyệt / Duyệt** (tháng/SLA/điều hành) → **Xuất PDF** → **Gửi khách / Lên lịch / Chia sẻ chat**.

- **Tạo báo cáo** — chọn 1 trong 4 mẫu (`weekly_ops`, `monthly_marketing`, `monthly_sla`, `executive`), khách (tuỳ chọn), kỳ `period_start` / `period_end`, tiêu đề tuỳ chọn.
- Filter chips: **Tất cả · Đến hạn · Chờ duyệt · Đã gửi** (`status=due|in_review|sent`).
- Outline lấy `template_sections` của mẫu — không cố định 4 mục.
- **Nhận xét theo mục** — dưới editor mục đang mở (`GET/POST :id/comments`). **Yêu cầu sửa** cũng ghi nhận xét chung (`section_key=''`).
- **Mẫu báo cáo** (`/crm/csd/reports/templates`, `csd:manage`) — sửa `name_vi` / mục / `requires_approval`. **Lưu trữ** = `active=false`, không xóa seed.
- CTA theo trạng thái:
  - **Nháp** — Lưu · Chờ dữ liệu · Gửi duyệt · (tuần `weekly_ops`) Gửi PDF.
  - **Chờ dữ liệu** — Đủ dữ liệu · Gửi duyệt.
  - **Chờ duyệt** — Duyệt · Yêu cầu sửa (cần `csd:manage` + nhận xét ≥ 3 ký tự).
  - **Yêu cầu sửa** — Sửa · Gửi lại.
  - **Đã duyệt** — Xuất PDF · Gửi khách · Lên lịch · Chia sẻ chat.
  - **Đã lên lịch** — Hủy lịch · Gửi ngay.
  - **Đã gửi** — Tạo bản sửa / Xem log; editor chỉ xem; **Chia sẻ chat**.
  - **Huỷ / Lưu trữ** — chỉ xem.
- Báo cáo tuần gửi thẳng từ nháp qua **Gửi PDF** (`POST :id/send`). Tháng/SLA/điều hành **không** hiện nút gửi khi còn nháp — phải Gửi duyệt → Duyệt rồi mới Gửi khách. Không dùng `POST :id/transition` với `to=sent`.
- **Gửi khách** dùng `CsdEmailService` (`PTT_EMAIL_SEND_ENABLED`). PDF gửi khách được lưu đính kèm `visibility=client` trên dòng email (`entity_type=email`) và ghi trong body (`Tệp: …`). Form gửi giữ checkbox **Đính kèm PDF**.

## Phân biệt quan trọng

| | Service Desk | Ticket CS |
|---|--------------|-----------|
| URL | `/crm/csd/*` | `/crm/tickets` |
| Mã | `PTT-2026-…` | ID số CSKH |
| Đối tượng | Khách agency / AM-PM | CSKH vận hành |

## UAT tối thiểu

1. Tạo P2 → có mã + SLA due.  
2. Chat → tạo ticket 2 lần → 1 mã.  
2b. Chat C-1: tạo DM hai staff → 1 thread khi tạo lại; chip Nội bộ ẩn hội thoại khách.  
2c. Chat C-2: tìm theo nội dung tin; `@8` in đậm trong tin; panel phải list ticket cùng thread.  
2d. Chat C-3: gửi tin + file trên nhóm; sửa trong 15 phút; xóa hiện “Đã xóa”; ticket từ tin không mang file internal.  
2e. Chat C-4: tin “ngưng chạy” gợi ý P1; tạo ticket 2 lần → dialog mã cũ; lưu trữ ẩn composer; deep link `?c=`.  
2f. Dock trên `/crm/leads` hoặc `/crm/csd`: nhập tên+mật khẩu chat → gửi tin; ẩn trên trang Chat.  
2g. Admin bật 2 NV; A mời B; B chấp nhận; DM gửi được; DM C chưa bạn bị chặn.  
3. Internal note không SMTP.  
4. Resolve thiếu note → lỗi 422.  
5. `/crm/tickets` không list ticket CSD.

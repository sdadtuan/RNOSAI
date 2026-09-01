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

- Hội thoại khách (bắt buộc gắn client).
- **Tạo ticket từ tin nhắn** — trùng nguồn chỉ sinh **một** mã ticket.
- Poll tin nhắn mỗi 5 giây (MVP, không WebSocket).

## 4. Email (`/crm/csd/email`)

- Hộp thư dùng chung `support@…` — inbound IMAP → ticket hoặc unmatched.
- Subject có `[PTT-2026-000123]` → append ticket hiện có.
- Email nhạy cảm (báo giá, hoàn tiền, khiếu nại…) cần duyệt trước khi gửi.

## 5. Báo cáo (`/crm/csd/reports`)

- Mẫu weekly/monthly — biên tập theo mục.
- **Gửi duyệt → Duyệt → Gửi PDF**; báo cáo đã gửi không sửa được.

## Phân biệt quan trọng

| | Service Desk | Ticket CS |
|---|--------------|-----------|
| URL | `/crm/csd/*` | `/crm/tickets` |
| Mã | `PTT-2026-…` | ID số CSKH |
| Đối tượng | Khách agency / AM-PM | CSKH vận hành |

## UAT tối thiểu

1. Tạo P2 → có mã + SLA due.  
2. Chat → tạo ticket 2 lần → 1 mã.  
3. Internal note không SMTP.  
4. Resolve thiếu note → lỗi 422.  
5. `/crm/tickets` không list ticket CSD.

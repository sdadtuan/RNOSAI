# Hướng dẫn — Báo cáo công việc nội bộ (IWRS)

Module **BC công việc** (`/crm/internal-reports`) dùng cho báo cáo **nội bộ** theo cây quản lý. Khác hoàn toàn **Báo cáo SD** (`/crm/csd/reports`) gửi khách.

## Ai dùng gì

| Vai | Việc chính |
|-----|------------|
| Nhân viên | Mở báo cáo ngày/tuần, nộp trước 17:00 (VN), Cc cùng phòng nếu cần |
| Quản lý trực tiếp (To) | Inbox **Cần xử lý** → xác nhận hoặc yêu cầu bổ sung |
| HR / Admin (`iwr.manage`) | Miễn nộp (waived), sửa tên mẫu |

## Luồng cơ bản

1. **Mở hôm nay** — tạo báo cáo ngày (T2–T6).
2. Điền các mục (việc xong, đang làm, blocker…).
3. **Nộp** — To = QLTT (`reports_to_id`), không đổi được.
4. QLTT **Xác nhận** hoặc **Yêu cầu bổ sung** (bắt buộc ghi chú).
5. Tải **PDF** nội bộ khi cần lưu.

## Hộp thư (4 tab)

- **Cần xử lý** — bạn là To, chờ ack/bổ sung
- **Chưa đọc** — chưa mở lần đầu
- **Đã nhận** — To/Cc
- **Đã gửi** — bản bạn đã nộp

## Cây kỳ

`/crm/internal-reports/team` — xem ai trong nhóm đã nộp / thiếu / muộn theo kỳ.

## Lưu ý

- **Không** có nút gửi khách / Client Chat.
- **Không** bật AI tóm tắt ở W1 (`PTT_IWR_LLM=0`).
- Nộp muộn sau 17:00 cần **lý do**.
- Báo cáo tuần/tháng cần chọn **RAG** trước khi nộp.

## Quyền

Sau deploy, đăng xuất/đăng nhập lại để nhận cap `iwr.*`. Menu: **Tổ chức → BC công việc**.

## Deploy (ops)

```bash
APPLY=1 ./scripts/deploy_iwr_vps.sh
```

Không dùng `deploy_csd_vps.sh` cho module IWR.

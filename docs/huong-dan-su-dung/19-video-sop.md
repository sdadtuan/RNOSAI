# Hướng dẫn — Video SOP Studio (Module 7)

> **Module:** MOD-VD · S3 (Brief + Script)  
> **Đối tượng:** AM, Copy, Art, Motion, Editor  
> **Hub:** `/crm/video` · **Overview:** `/crm/video/[id]`  
> **Spec:** [`2026-08-20-video-sop-module-7-design.md`](../superpowers/specs/2026-08-20-video-sop-module-7-design.md)  
> **Flags:** `PTT_CMKT_VIDEO_CINEMATIC=1`, `NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1`

Studio **Video chiến dịch (SOP)** — brief 8 nhóm → ý tưởng / script → shotlist. **S3 chưa có Gate 1** (cổng duyệt sang keyframe thuộc S5).

---

## 1. Hai studio — đừng nhầm

| | Video tuần (Media AI) | Video chiến dịch (hub này) |
|--|------------------------|----------------------------|
| Ở đâu | Content Board → tab Media AI | `/crm/video` + `/crm/video/[id]` |
| Đơn vị | Content item, 4 beat FFmpeg | `vd_projects` + brief + script + shot |
| Flag | `PTT_CMKT_VIDEO_SOCIAL` | `PTT_CMKT_VIDEO_CINEMATIC` |
| Cap | job social/ngày | `PTT_CMKT_VIDEO_CINEMATIC_DAILY_CAP` (mặc định **1 project/ngày/lifecycle**) |

Picker trên Content Board: **Video tuần (FFmpeg)** vs **Video chiến dịch (SOP)**. Khóa studio xong thì không đổi.

Hub trống: *Chọn Video chiến dịch từ Content Board*.

---

## 2. Hub & overview

1. Mở `/crm/video?lifecycle_id=…` — danh sách project SOP.
2. Click project → `/crm/video/[id]` (SC-02). Banner: *S3 — Brief + Script. Gate 1 vẫn S5.*
3. Link **Brief (SC-03)** → `/crm/video/[id]/brief` · **Script (SC-04)** → `/crm/video/[id]/script`.

Cần cap `crm_vd.project` view/edit (hoặc `crm_content.view` để thấy menu). Flag tắt → hub ẩn / *Module tắt*.

---

## 3. SC-03 — Brief 8 nhóm

Route: `/crm/video/[id]/brief`. Banner: *S3 — 8 nhóm SOP. Insight M6 được để trống.*

| Nhóm | Field | Ghi chú |
|------|--------|---------|
| Mục tiêu | `objective` | ≥ 8 ký tự |
| Đối tượng | `audience` | ≥ 8 ký tự |
| Offer | `offer` | ≥ 8 ký tự |
| Thời lượng | `duration_sec` | 15–60 |
| Nền tảng | `platform` | `reels` · `shorts` · `feed_square` |
| Tone | `tone` | ≥ 4 ký tự |
| Ràng buộc | `constraints` | ≥ 8 ký tự |
| Insights M6 | `insight_ids` | **Được để trống** `[]` |

Thao tác:

1. Điền 8 nhóm (insight không bắt buộc — *Không có insight approved — được để trống.*).
2. **Lưu brief** — lưu draft, chưa đổi stage.
3. **Đánh dấu brief sẵn sàng** — đủ 8 nhóm → `stage=brief_ready`. Thiếu/ngắn → lỗi `brief_incomplete`.

---

## 4. SC-04 — 3 cột template · ý tưởng · shotlist

Route: `/crm/video/[id]/script`. Banner: *S3 — 3 cột template · ý tưởng · shotlist.*

| Cột | Việc |
|-----|------|
| Template | Prompt seed (trống: *Chưa có template — seed DDL S3.*) |
| Ý tưởng / Script | **Sinh 3 ý tưởng** → **Chọn ý tưởng** → sửa markdown → **Lưu script** |
| Shotlist | `duration_ms` · `camera` · `action` · `aspect` (`9:16` / `1:1`) → **Thêm shot** |

Cột feasibility hiện badge **FR-R01…FR-R10** (hoặc `OK`). Shot `duration_ms` > 15000 bị chặn (`feasibility_blocked`). Shot hợp lệ vào `status=draft`.

Sinh ý tưởng tùy chọn trên S3 — có thể **Lưu script** thẳng từ `brief_ready` (stage → `scripting`).

---

## 5. Flag, cap, Gate

- API: `PTT_CMKT_VIDEO_CINEMATIC=1`. UI: `NEXT_PUBLIC_CMKT_VIDEO_CINEMATIC=1`.
- Cap project: `PTT_CMKT_VIDEO_CINEMATIC_DAILY_CAP` (mặc định 1). Hết cap → đợi ngày mới hoặc tăng env.
- **S3 chưa có Gate 1.** Không duyệt sang keyframe / Kling trên sprint này.

Cap: `crm_vd.script` edit để sửa script/shot; `crm_vd.project` view để đọc hub.

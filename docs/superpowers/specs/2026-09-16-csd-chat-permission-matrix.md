# Ma trận phân quyền CSD Chat & Service Desk

**Ngày:** 2026-09-16  
**Phạm vi:** Communication & Service Desk (CSD) — Chat nhóm kiểu Zalo + tài khoản chat + ticket workspace  
**Nguồn SoT (code):**
- `scripts/seed_csd_rbac.sh` — cap theo chức vụ / job function
- `services/ptt-crm-api/src/csd/csd-chat-group-admin.util.ts` — quyền trong nhóm
- `services/ptt-crm-api/src/csd/csd-chat-accounts.controller.ts` — admin console
- Wave A/B: `docs/superpowers/specs/2026-09-16-csd-chat-group-admin-wave-a-design.md`, `…-wave-b-design.md`

**Hai lớp quyền (bắt buộc hiểu trước khi đọc bảng):**

```
Lớp 1 — Chức vụ / job function  →  csd.view | write | assign | manage | admin
Lớp 2 — Vai trò trong nhóm chat →  owner | admin (phó) | member | viewer
```

Thao tác nhóm chat chỉ thành công khi **đủ cả hai lớp** (trừ bypass nền tảng — xem §3).

---

## 1. Thang quyền nền tảng (`section = csd`)

| Cap | Ý nghĩa vận hành | Truy cập điển hình |
|-----|------------------|--------------------|
| `view` | Xem Service Desk / Chat | `/crm/csd`, đọc hội thoại (là thành viên) |
| `write` | Gửi tin, tạo hội thoại, thao tác nhóm (nếu đủ vai trò nhóm) | Composer, mời/sửa nhóm |
| `assign` | Gán ticket CSD | Ticket assign |
| `manage` | Báo cáo / vận hành; **bypass vai trò nhóm** | Pin, chuyển chủ, chỉnh nhóm dù không phải Chủ |
| `admin` | Quản trị tài khoản chat + console nhóm toàn hệ thống | `/admin/crm/csd/chat-accounts` |

`hasPlatformManage` trong code = có `csd.manage` **hoặc** `csd.admin`.

---

## 2. Ma trận chức vụ × `csd.*` (seed)

Nguồn: `scripts/seed_csd_rbac.sh`. Cột **admin** = truy cập tab *Quản lý nhóm* / *Tài khoản Chat*.

| Mã chức vụ | Tầng | view | write | assign | manage | admin |
|------------|------|:----:|:-----:|:------:|:------:|:-----:|
| `SUPER-ADMIN` | Siêu quản trị | ✅ | ✅ | ✅ | ✅ | ✅ |
| `CEO` | Lãnh đạo | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GD` | Giám đốc | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MD` | Management / PM | ✅ | ✅ | ✅ | ✅ | — |
| `PD` | Project / PM | ✅ | ✅ | ✅ | ✅ | — |
| `GDKD` | GD Kinh doanh (staging) | ✅ | ✅ | ✅ | ✅ | — |
| `ACM` | Account / AM | ✅ | ✅ | — | — | — |
| `AE` | Account Executive | ✅ | ✅ | — | — | — |
| `CE` | Client / delivery | ✅ | ✅ | — | — | — |
| `MEP` | Delivery | ✅ | ✅ | — | — | — |
| `KD-01` | AM B2B Sales | ✅ | ✅ | — | — | — |
| `MKT-01` | Marketing / Solution | ✅ | ✅ | — | — | — |
| Mọi chức vụ `active` | Tối thiểu | ✅ | —* | — | — | — |
| Chức vụ có `crm_agency.view` | Agency inherit | ✅ | ✅ | — | — | — |

\*Mọi chức vụ active được seed `view`. Một số chức vụ chỉ có `view` trừ khi được gán thêm qua job function hoặc seed riêng.

### 2.1 Job function (cộng dồn / additive)

Nguồn: `staff_job_function_grants` trong cùng script seed.

| Function | view | write | assign | manage | admin |
|----------|:----:|:-----:|:------:|:------:|:-----:|
| `leader` | ✅ | ✅ | ✅ | ✅ | — |
| `sales` | ✅ | ✅ | — | — | — |
| `content` | ✅ | ✅ | — | — | — |
| `design` | ✅ | ✅ | — | — | — |
| `technical` | ✅ | ✅ | — | — | — |
| `ops` | ✅ | — | — | — | — |
| `analyst` | ✅ | — | — | — | — |

Quyền thực tế của user = **union** (chức vụ ∪ job function ∪ permission set ∪ break-glass).  
`SUPER-ADMIN` luôn nhận đủ 5 cap `csd.*`.

---

## 3. Ma trận vai trò trong nhóm chat

Áp dụng khi `conversation.kind = 'group'`.  
Cột **Platform** = user có `csd.manage` hoặc `csd.admin` (không cần là Chủ/Phó trong nhóm).

| Thao tác | Chủ (`owner`) | Phó (`admin`) | Thành viên / Viewer | Platform manage/admin |
|----------|:-------------:|:-------------:|:-------------------:|:---------------------:|
| Xem danh sách thành viên | ✅ | ✅ | ✅ | ✅* |
| Sửa tên / mô tả / ảnh nhóm | ✅ | ✅ | — | ✅ |
| Bật *Cần duyệt khi mời* | ✅ | ✅ | — | ✅ |
| Bật *Chỉ Chủ/Phó được gửi* | ✅ | ✅ | — | ✅ |
| Mời bạn bè vào nhóm | ✅ | ✅ | — | ✅† |
| Duyệt / từ chối yêu cầu vào nhóm | ✅ | ✅ | — | ✅ |
| Đặt Phó / Gỡ Phó | ✅ | — | — | ✅‡ |
| Chuyển Chủ | ✅ | — | — | ✅‡ |
| Xóa thành viên (`member`/`viewer`) | ✅ | ✅§ | — | ✅ |
| Xóa Phó (`admin`) | ✅ | — | — | ✅ |
| Xóa Chủ | — | — | — | — |
| Gửi tin khi khóa gửi bật | ✅ | ✅ | — | ✅ |
| Ghim / bỏ ghim tin | ✅ | ✅ | — | ✅ |
| Rời nhóm | — | ✅ | ✅ | — (không áp nếu là Chủ) |

\*Platform admin xem mọi nhóm qua `/admin/crm/csd/chat-accounts` → tab **Quản lý nhóm** (không cần là thành viên).  
†Platform mời bỏ qua kiểm tra bạn bè; nếu bật duyệt mời vẫn có thể thêm trực tiếp.  
‡UI Chat thường: nút Đặt Phó / Chuyển Chủ / Xóa chỉ hiện cho **Chủ nhóm**; Platform can thiệp đầy đủ qua **Admin → Tài khoản Chat → Quản lý nhóm**.  
§API cho phép Phó xóa `member`/`viewer`; UI Chat hiện chỉ Chủ thấy nút Xóa (đồng bộ yêu cầu sản phẩm 2026-09-16).

Vai trò có thể gán qua promote/demote: chỉ `admin` ↔ `member` (không gán trực tiếp `owner` / `viewer` qua form đó).

---

## 4. Ma trận theo tầng chức vụ → khả năng Chat (tóm tắt vận hành)

| Tầng chức vụ | Caps CSD | Chat cá nhân | Quản lý nhóm (là Chủ/Phó) | Bypass mọi nhóm | Admin console `/admin/.../chat-accounts` |
|--------------|----------|--------------|---------------------------|-----------------|------------------------------------------|
| SUPER-ADMIN / CEO / GD | view…admin | ✅ | ✅ | ✅ | ✅ |
| MD / PD / GDKD | view…manage | ✅ | ✅ | ✅ (manage) | — |
| ACM / AE / CE / MEP / KD-01 / MKT-01 | view+write | ✅ | ✅ nếu là Chủ/Phó | — | — |
| Chỉ `view` (ops/analyst hoặc chức vụ tối thiểu) | view | Đọc (nếu được cấp tài khoản chat + là thành viên) | — | — | — |

**Tài khoản chat** (`csd_chat_accounts.enabled`) là cổng riêng: có `csd.write` vẫn cần Admin bật tài khoản chat + đăng nhập hộp thoại mới gửi tin.

---

## 5. Admin console — Tài khoản Chat

Trang: `/admin/crm/csd/chat-accounts` — yêu cầu **`csd.admin`**.

| Tab / thao tác | SUPER-ADMIN / CEO / GD | MD/PD (manage) | AM/write | view |
|----------------|:----------------------:|:--------------:|:--------:|:----:|
| Bật/tắt tài khoản chat, directory | ✅ | — | — | — |
| Tab **Quản lý nhóm** — list mọi nhóm | ✅ | — | — | — |
| Sửa thông tin / moderation nhóm bất kỳ | ✅ | — | — | — |
| Đặt Phó / Gỡ Phó / Chuyển Chủ / Xóa TV | ✅ | — | — | — |
| Thêm thành viên (bỏ qua bạn bè) | ✅ | — | — | — |
| Duyệt / từ chối join request | ✅ | — | — | — |

API: `GET|PATCH|POST|DELETE /api/crm/csd/admin/chat-accounts/groups…` — `@RequireCsdAction('admin')`.

---

## 6. Ticket / workspace CSD (ngoài nhóm chat)

| Thao tác | view | write | assign | manage | admin |
|----------|:----:|:-----:|:------:|:------:|:-----:|
| Mở `/crm/csd`, xem ticket/dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Tạo / bình luận ticket | — | ✅ | ✅ | ✅ | ✅ |
| Gán ticket | — | — | ✅ | ✅ | ✅ |
| Báo cáo / quản trị nâng cao | — | — | — | ✅ | ✅ |
| Cấu hình tài khoản chat | — | — | — | — | ✅ |

---

## 7. Checklist kiểm thử nhanh

1. User `KD-01` (write), là **Chủ** nhóm → thấy Đặt Phó / Chuyển Chủ / Xóa; mời bạn được.  
2. Cùng user là **Phó** → mời / sửa thông tin / duyệt mời / ghim; **không** thấy Đặt Phó / Chuyển Chủ / Xóa trên UI Chat.  
3. Thành viên → xem danh sách thành viên; **Rời nhóm**; không chỉnh moderation.  
4. User `MD` (manage) không phải thành viên → can thiệp qua API bypass nếu biết `conversationId`; UI Chat chỉ hiện nếu đang mở hội thoại mà họ là thành viên **hoặc** vào Admin (cần `admin`).  
5. User `CEO` → vào `/admin/crm/csd/chat-accounts` → tab Quản lý nhóm thấy mọi nhóm (VD Team SEO).

---

## 8. Liên kết

| Tài liệu / code | Vai trò |
|-----------------|---------|
| `docs/exports/ma-tran-phan-quyen-csd-chat-2026-09-16.md` | Bản xuất vận hành (rút gọn) |
| `docs/exports/ma-tran-phan-quyen-CSKH-KD-MKT-2026-08-06.md` | Ma trận CRM CSKH/KD/MKT (không thay thế CSD) |
| `docs/PHAN_QUYEN_HUONG_DAN.md` | Hướng dẫn RBAC tổng |
| `scripts/seed_csd_rbac.sh` | Seed cap theo chức vụ |
| `csd-chat-group-admin.util.ts` | SoT ma trận trong nhóm |

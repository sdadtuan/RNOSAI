# Ma trận phân quyền CSD — theo chức vụ (xuất vận hành)

**Ngày xuất:** 2026-09-16  
**Hệ thống:** PTT ops-web + Nest API (`section_id = csd` × `action`)  
**SoT đầy đủ:** [`docs/superpowers/specs/2026-09-16-csd-chat-permission-matrix.md`](../superpowers/specs/2026-09-16-csd-chat-permission-matrix.md)  
**Seed:** `scripts/seed_csd_rbac.sh`

***

## 1. Chức vụ × quyền CSD nền tảng

| Mã chức vụ | Vai trò vận hành | view | write | assign | manage | admin |
|------------|------------------|:----:|:-----:|:------:|:------:|:-----:|
| **SUPER-ADMIN** | Siêu quản trị hệ thống | ✓ | ✓ | ✓ | ✓ | ✓ |
| **CEO** | Lãnh đạo | ✓ | ✓ | ✓ | ✓ | ✓ |
| **GD** | Giám đốc | ✓ | ✓ | ✓ | ✓ | ✓ |
| **MD** | Management / PM | ✓ | ✓ | ✓ | ✓ | — |
| **PD** | Project Director / PM | ✓ | ✓ | ✓ | ✓ | — |
| **GDKD** | GD Kinh doanh | ✓ | ✓ | ✓ | ✓ | — |
| **ACM** | Account Manager | ✓ | ✓ | — | — | — |
| **AE** | Account Executive | ✓ | ✓ | — | — | — |
| **CE** | Client / delivery | ✓ | ✓ | — | — | — |
| **MEP** | Delivery | ✓ | ✓ | — | — | — |
| **KD-01** | AM B2B Sales | ✓ | ✓ | — | — | — |
| **MKT-01** | Trưởng phòng Marketing / Solution | ✓ | ✓ | — | — | — |
| *Mọi chức vụ active* | Tối thiểu — thấy menu Service Desk | ✓ | — | — | — | — |
| *Có `crm_agency.view`* | Inherit agency → CSD | ✓ | ✓ | — | — | — |

### Job function (cộng thêm)

| Function | view | write | assign | manage | admin |
|----------|:----:|:-----:|:------:|:------:|:-----:|
| leader | ✓ | ✓ | ✓ | ✓ | — |
| sales / content / design / technical | ✓ | ✓ | — | — | — |
| ops / analyst | ✓ | — | — | — | — |

***

## 2. Ý nghĩa từng cap với Chat

| Cap | Được làm gì |
|-----|-------------|
| **view** | Mở `/crm/csd`, đọc hội thoại nếu là thành viên |
| **write** | Gửi tin (khi đã bật tài khoản chat), tạo nhóm/DM, thao tác nhóm nếu đủ vai trò trong nhóm |
| **assign** | Gán ticket CSD |
| **manage** | Bypass vai trò nhóm (API); báo cáo / vận hành |
| **admin** | Trang **Tài khoản Chat** + tab **Quản lý nhóm** toàn hệ thống |

***

## 3. Vai trò trong nhóm chat (Chủ / Phó / TV)

| Thao tác | Chủ | Phó | TV / Viewer | User có manage/admin |
|----------|:---:|:---:|:-----------:|:--------------------:|
| Sửa thông tin nhóm, moderation | ✓ | ✓ | — | ✓ |
| Mời thành viên, duyệt mời | ✓ | ✓ | — | ✓ |
| Đặt Phó / Chuyển Chủ / Xóa (UI Chat) | ✓ | — | — | Qua Admin console |
| Ghim tin; gửi khi khóa gửi | ✓ | ✓ | — | ✓ |
| Rời nhóm | — | ✓ | ✓ | — |
| Xóa Chủ nhóm | — | — | — | — |

***

## 4. Ai vào Admin → Tài khoản Chat?

| Chức vụ | Vào `/admin/crm/csd/chat-accounts` |
|---------|:----------------------------------:|
| SUPER-ADMIN, CEO, GD | ✓ |
| MD, PD, GDKD, ACM, AE, … | — (thiếu `csd.admin`) |

***

## 5. Ghi chú vận hành

1. **Tài khoản chat** phải được Admin bật riêng — có `csd.write` chưa đủ để mở hộp thoại.  
2. Đăng xuất / đăng nhập lại sau khi seed hoặc đổi chức vụ để menu cập nhật.  
3. Ma trận CRM CSKH/KD/MKT cũ: `ma-tran-phan-quyen-CSKH-KD-MKT-2026-08-06.md` (không bao gồm CSD Chat).

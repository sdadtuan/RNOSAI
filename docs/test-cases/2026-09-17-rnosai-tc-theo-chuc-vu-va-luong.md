# Bộ Test Case — Theo chức vụ & luồng nghiệp vụ RNOSAI

> **Document ID:** RNOSAI-TC-ROLE-20260917  
> **Version:** 1.0 · **Date:** 2026-09-17  
> **App:** ops-web (`https://rs.pttads.vn`) + ptt-crm-api  
> **RBAC SoT:** `staff_section_permissions` · seed `scripts/data/rnosai_handover_rbac_*.json`  
> **Related:** [TC tổng thể](./2026-09-17-rnosai-tc-tong-the-he-thong.md) · [TC theo màn hình](./2026-09-17-rnosai-tc-theo-man-hinh.md) · Ma trận bàn giao `docs/exports/ma-tran-phan-quyen-RNOSAI-ban-giao-2026-09-16.md`

---

## 0. Quy ước chung

| Mục | Nội dung |
|-----|----------|
| Môi trường | Staging/VPS: `https://rs.pttads.vn` · Login staff SSO/Keycloak |
| Ưu tiên | **P0** bắt buộc release · **P1** quan trọng · **P2** bổ sung |
| Kết quả | Pass / Fail / Blocked / Skip / Not Run |
| Evidence | Screenshot + role code + URL + timestamp |
| Fail-closed | User **không** có cap → 403 hoặc menu ẩn; không lộ data |

**Chức vụ trọng tâm (bàn giao):** `SUPER-ADMIN`, `CEO`, `AE`, `ACM`/`KD-01`, `CE`, `MEP`, `GD`, `MKL`/`MKT-01`, `MKT-02`, `PD`, `MD` (CSD), `GDKD`, `CSKH-01`.

**Cột bảng TC:** ID · P · Luồng · Tiền điều kiện · Bước · Kết quả mong muốn

---

## 1. Ma trận luồng × chức vụ (tóm tắt)

| Luồng nghiệp vụ | SUPER-ADMIN | CEO | AE | ACM | CE | MEP | GD | MKL | PD | CSKH-01 |
|-----------------|:-----------:|:---:|:--:|:---:|:--:|:---:|:--:|:---:|:--:|:-------:|
| Auth / shell nav | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Lead B2B → Inbox → Review | ✅ | V | ✅ | ✅ | — | — | — | V | V | V |
| CSKH board / khách / ticket CS | ✅ | V | V | ✅ | V | — | — | V | V | ✅ |
| Service Desk ticket + chat | ✅ | A | W | W | W | W | W | M | M | W* |
| Account Management / Agency | ✅ | V | V | ✅ | — | — | — | — | — | — |
| Content OS / Creative / Media / Video | ✅ | V | — | V | ✅ | ✅ | ✅ | ✅ | V | — |
| SEO / Email / Ads | ✅ | V | — | ✅ | SEO/Email | Ads creatives | CP | ✅ | Research | — |
| KPI Hub / Forecast / CEO Command | ✅ | ✅ | V | V | V | V | V | V | ✅ | V |
| Admin org / RBAC | ✅ | — | — | — | — | — | — | — | — | — |

*V = view · W = write · M = manage · A = admin · ✅ = full trong phạm vi · — = không kỳ vọng menu/API · \* theo seed CSD thực tế

---

## 2. SUPER-ADMIN — toàn quyền hệ thống

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-SA-01 | P0 | Login + shell | User SUPER-ADMIN active | 1. Login 2. Mở `/` | Vào ops-web; sidebar accordion đầy đủ nhóm; không 403 |
| TC-ROLE-SA-02 | P0 | Admin hub | — | 1. `/admin` 2. Vào Org users + Permissions | Xem/sửa org & RBAC; seed bàn giao nếu có UI |
| TC-ROLE-SA-03 | P0 | CSD admin | Cap `csd.admin` | 1. `/crm/csd` 2. `/admin/crm/csd/chat-accounts` | Quản trị ticket + bật chat account |
| TC-ROLE-SA-04 | P1 | Cross-module smoke | — | Mở lần lượt B2B, CRM, CSD, AM, Content OS, KPI Hub, CEO | Mỗi module load; PageHeader/Canopy không lỗi JS |
| TC-ROLE-SA-05 | P1 | Impersonation/audit | Có audit UI | 1. `/admin/audit` 2. Lọc theo actor | Có log thao tác; không lộ secret |

---

## 3. CEO — lãnh đạo / điều hành

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-CEO-01 | P0 | CEO Command | Cap `ceo_command` | 1. `/crm/ceo` | Dashboard/command hiển thị; cấu hình nếu có quyền configure |
| TC-ROLE-CEO-02 | P0 | KPI Hub executive | — | 1. `/crm/kpi-hub/executive` | Số liệu executive; không lỗi embed |
| TC-ROLE-CEO-03 | P0 | Forecast / Business dash | — | 1. `/crm/forecast` 2. `/crm/business-dashboard` | Xem được; không nút ghi nếu chỉ view |
| TC-ROLE-CEO-04 | P1 | CSD oversight | `csd.admin` hoặc manage | 1. `/crm/csd/tickets` 2. Assign/escalate | Assign được; báo cáo CSD mở được |
| TC-ROLE-CEO-05 | P1 | Nav negative | — | Kiểm tra Admin org/RBAC | Không thấy hoặc 403 khi vào `/admin/crm/permissions` |
| TC-ROLE-CEO-06 | P2 | IWR / nội bộ | Cap IWR | 1. `/crm/internal-reports` | Xem báo cáo nội bộ theo quyền |

---

## 4. AE — Account Executive (bán hàng)

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-AE-01 | P0 | Lead B2B list | Cap `crm_leads` write | 1. `/crm/b2b/leads` 2. Filter + mở lead | Danh sách/kanban load; chi tiết lead mở |
| TC-ROLE-AE-02 | P0 | Tạo lead B2B | — | 1. `/crm/b2b/leads/new` 2. Submit bắt buộc | Lead tạo thành công; redirect chi tiết |
| TC-ROLE-AE-03 | P0 | Inbox B2B | — | 1. `/crm/b2b-inbox` 2. Mở thread | Inbox + thread; trả lời nếu write |
| TC-ROLE-AE-04 | P0 | Assign lead | Cap assign | 1. Lead detail 2. Phân bổ owner | Owner cập nhật; audit/activity có dòng |
| TC-ROLE-AE-05 | P1 | Solution queue | Cap solution | 1. `/crm/solution/queue` | Queue hiển thị; thao tác theo quyền |
| TC-ROLE-AE-06 | P1 | Báo giá / Hub HĐ | — | 1. `/crm/proposals` 2. `/crm/hub` | Xem/tạo theo cap; không vào AM configure |
| TC-ROLE-AE-07 | P1 | CSD write | Cap `csd.write` | 1. Tạo ticket `/crm/csd/tickets` | Ticket tạo được; không admin chat-accounts |
| TC-ROLE-AE-08 | P0 | Negative Admin | — | Vào `/admin` | 403 hoặc hub rỗng theo `canViewAdminSection` |

---

## 5. ACM / KD-01 — Account Manager

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-ACM-01 | P0 | AM Dashboard | Cap `crm_am` | 1. `/crm/account-management` | KPI tiles + sổ khách; sidebar AM xanh Canopy/white theo theme |
| TC-ROLE-ACM-02 | P0 | Tạo / mở khách AM | — | 1. Tạo khách 2. Mở 360 | Client tạo/mở; health/MRR hiện |
| TC-ROLE-ACM-03 | P0 | Agency portal | Cap `crm_agency` | 1. `/agency` 2. Ingest/notif | Agency hub; provisioning theo quyền |
| TC-ROLE-ACM-04 | P1 | Onboarding / renewal | — | 1. Onboarding 2. Renewals 90d | Luồng AM theo UI; status cập nhật |
| TC-ROLE-ACM-05 | P1 | Lead + CSKH song song | — | B2B leads + `/crm` board | Cả hai module dùng được |
| TC-ROLE-ACM-06 | P1 | Meta/SEO/Email view-write | Theo grant ACM | Mở `/meta/facebook-ads`, `/seo/hub`, `/email/hub` | Không 403 nếu grant có; ghi theo cap |
| TC-ROLE-ACM-07 | P0 | Negative SUPER-ADMIN only | — | Sửa permission-set | Bị chặn |

---

## 6. CE — Content Editor

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-CE-01 | P0 | Content OS Command | Cap `crm_content` | 1. `/crm/content-os` | Sidebar trắng Canopy; Command Center active |
| TC-ROLE-CE-02 | P0 | Content Requests | — | 1. `/crm/content-os/requests` 2. Tạo request | Request tạo; hiện trong list |
| TC-ROLE-CE-03 | P0 | Production workspace | — | 1. Vào `/crm/content-os/w/{id}` | Workspace item; edit/publish theo cap |
| TC-ROLE-CE-04 | P1 | Approval Center | — | 1. `/crm/content-os/approvals` | Submit duyệt; CE không tự approve nếu chỉ write |
| TC-ROLE-CE-05 | P1 | Library / Intelligence | — | Library + Intelligence | Xem asset/insight; không Governance admin |
| TC-ROLE-CE-06 | P1 | SEO write nhẹ | Cap SEO | `/seo/content` hoặc hub | Ghi nội dung SEO theo quyền |
| TC-ROLE-CE-07 | P0 | Negative AM configure | — | `/crm/account-management` settings sâu | 403 hoặc ẩn |

---

## 7. MEP — Media / Delivery production

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-MEP-01 | P0 | Media OS | Cap media | 1. `/crm/media-os` | Module mở; package/workflow theo UI |
| TC-ROLE-MEP-02 | P0 | Video SOP | Cap `crm_vd` | 1. `/crm/video` | Studio/SOP video dùng được |
| TC-ROLE-MEP-03 | P1 | Content OS collab | Cap content view/write | Content OS + Media liên kết | Không mất quyền content |
| TC-ROLE-MEP-04 | P1 | Creatives / Ads assets | — | `/crm/creatives` | Upload/gắn creative theo cap |
| TC-ROLE-MEP-05 | P0 | Negative GDKD command | — | `/crm/b2b-gdkd` | 403 nếu không grant |

---

## 8. GD — Graphic / Creative (handover pack)

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-GD-01 | P0 | Creative OS | Cap `crm_cp` | 1. `/crm/creative-os` | Studio/queue CP mở |
| TC-ROLE-GD-02 | P0 | Image SOP | Cap `crm_img` + flag | 1. `/crm/creative-os/image` | Image SOP enable; job chạy theo quyền |
| TC-ROLE-GD-03 | P1 | Content view | — | Content OS xem request | View OK; không approve nếu không cap |
| TC-ROLE-GD-04 | P1 | CSD write | Cap csd.write | Tạo ticket CSD | Tạo OK |
| TC-ROLE-GD-05 | P2 | Lưu ý dual meaning GD | DB display name | Xác nhận label «Graphic» vs «Giám đốc» | Đúng pack creative; nếu Giám đốc thì TC CSD admin riêng |

---

## 9. MKL / MKT-01 — Trưởng Marketing / Solution

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-MKL-01 | P0 | Approve content | Cap content approve | 1. Approvals Content OS 2. Approve/Reject | Status đổi; notify nếu có |
| TC-ROLE-MKL-02 | P0 | SEO/Email approve | — | Hub SEO + Email governance | Duyệt/gate theo UI |
| TC-ROLE-MKL-03 | P1 | CSD manage | Cap csd.manage | Assign + SLA ticket | Assign/queue manage OK |
| TC-ROLE-MKL-04 | P1 | Research approve | Cap research | `/crm/research` | Approve plan/research |
| TC-ROLE-MKL-05 | P1 | Playbook MKT AI | — | `/crm/admin/mkt-ai/playbooks` hoặc playbooks | Catalog theo quyền |
| TC-ROLE-MKL-06 | P0 | Negative full Admin RBAC | — | Sửa permission matrix | Bị chặn |

---

## 10. MKT-02 — NV Marketing / production

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-MKT02-01 | P0 | Content write | — | Tạo/sửa request + workspace | Ghi được; không approve |
| TC-ROLE-MKT02-02 | P0 | CP / Media / Video | — | Mở 3 module sản xuất | Dùng được theo grant |
| TC-ROLE-MKT02-03 | P1 | SEO/Email write | — | Sửa bản nháp | Save OK; không gate admin |
| TC-ROLE-MKT02-04 | P0 | Negative approve | — | Bấm Approve trên item người khác | Nút ẩn hoặc 403 API |

---

## 11. PD — Planning Director

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-PD-01 | P0 | Research / MKT plan | — | `/crm/research` + `/crm/marketing-plan` | Xem/lập kế hoạch theo cap |
| TC-ROLE-PD-02 | P0 | Delivery supervise | — | `/crm/service-delivery` | Theo dõi delivery |
| TC-ROLE-PD-03 | P1 | KPI supervise | — | KPI Hub + `/crm/kpi` | Xem/supervise; không spoof CEO configure |
| TC-ROLE-PD-04 | P1 | B2B projects | — | `/crm/b2b-projects` | Theo dõi dự án |
| TC-ROLE-PD-05 | P1 | CSD manage | — | Manage ticket queue | Manage OK |

---

## 12. MD — Project Manager (CSD tier)

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-MD-01 | P0 | CSD queue manage | Cap csd.manage | Tickets list assign/reassign | Assign OK |
| TC-ROLE-MD-02 | P0 | Chat nội bộ | Chat account enabled | `/crm/csd/chat` | Inbox/thread; không dock hỏng |
| TC-ROLE-MD-03 | P1 | Báo cáo CSD | — | `/crm/csd/reports` | Xem/roll-up theo quyền |
| TC-ROLE-MD-04 | P0 | Negative csd.admin | — | Chat-accounts admin | 403 |

---

## 13. GDKD — Giám đốc Kinh doanh

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-GDKD-01 | P0 | GDKD command | Cap `crm_gdkd` | `/crm/b2b-gdkd` + enterprise KPI | Command board OK |
| TC-ROLE-GDKD-02 | P0 | Review queue | Cap assign | `/crm/leads/review-queue` | Duyệt phân bổ |
| TC-ROLE-GDKD-03 | P1 | MFA path | Keycloak MFA | Login GDKD | MFA challenge nếu bật |
| TC-ROLE-GDKD-04 | P1 | CSD manage | — | Manage tickets | Theo seed |

---

## 14. CSKH-01 — Chăm sóc khách hàng vận hành

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-CSKH-01 | P0 | Bảng CSKH | Cap board | `/crm` | Board module cards theo quyền |
| TC-ROLE-CSKH-02 | P0 | CSKH SLA board | — | `/crm/cskh-board` | Kanban/list SLA; filter |
| TC-ROLE-CSKH-03 | P0 | Lead vận hành | — | `/crm/operational/leads` | List + care lead |
| TC-ROLE-CSKH-04 | P0 | Khách hàng 360 | Cap customers | `/crm/customers` | Hồ sơ KH |
| TC-ROLE-CSKH-05 | P1 | Ticket CS | — | `/crm/tickets` | Ticket CS (không nhầm CSD) |
| TC-ROLE-CSKH-06 | P0 | Negative B2B create nếu không cap | — | `/crm/b2b/leads/new` | 403 hoặc ẩn |

---

## 15. Luồng nghiệp vụ cắt ngang (mọi role liên quan)

### 15.1. Lead B2B → CSKH

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-FLOW-B2B-01 | P0 | Tạo → qualify → assign | AE/ACM | Tạo lead → cập nhật stage → assign | Stage/owner đúng |
| TC-ROLE-FLOW-B2B-02 | P0 | Inbox → lead | AE | Inbox map/unmatched → lead | Lead liên kết |
| TC-ROLE-FLOW-B2B-03 | P1 | Review queue | GDKD/assigner | Duyệt hàng đợi | Lead ra queue đúng owner |
| TC-ROLE-FLOW-B2B-04 | P1 | Handover sang CSKH | Sau win/hand-off | Mở CSKH board / operational | Case hiện phía CSKH |
| TC-ROLE-FLOW-B2B-05 | P1 | Báo giá | AE/ACM | Tạo proposal | Proposal lưu; link lead |

### 15.2. Service Desk

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-FLOW-CSD-01 | P0 | Tạo ticket → SLA | csd.write | Tạo ticket P1–P3 | Code + SLA status |
| TC-ROLE-FLOW-CSD-02 | P0 | Assign → resolve | manage/assign | Assign → comment → done | Status/SLA cập nhật |
| TC-ROLE-FLOW-CSD-03 | P0 | Chat ↔ ticket | Chat enabled | Tạo ticket từ chat hoặc link | Liên kết message–ticket |
| TC-ROLE-FLOW-CSD-04 | P1 | Email → ticket | Mailbox cấu hình | Inbound mail | Ticket/unmatched đúng |
| TC-ROLE-FLOW-CSD-05 | P1 | Report rollup | — | Reports + templates | Số liệu khớp filter |

### 15.3. AM / Agency

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-FLOW-AM-01 | P0 | Client lifecycle | ACM | Tạo → onboard → health | Trạng thái/health đúng |
| TC-ROLE-FLOW-AM-02 | P1 | Renewal 90d | — | Mở renewals | Case đúng window |
| TC-ROLE-FLOW-AM-03 | P1 | Portal user | agency configure | Provision portal | User portal login được |

### 15.4. Content → Publish

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-FLOW-CM-01 | P0 | Request → workspace → approve → calendar | CE + MKL | Full path Content OS | Item publish/lịch đúng |
| TC-ROLE-FLOW-CM-02 | P1 | Creative/Image gắn content | GD/MEP | Gắn asset CP/Image | Asset hiện library |
| TC-ROLE-FLOW-CM-03 | P1 | Governance settings | MKL/admin content | Settings | Chỉ role đủ cap |

### 15.5. Auth & phân quyền âm

| TC-ID | P | Luồng | Tiền điều kiện | Bước | Kết quả mong muốn |
|-------|---|-------|-----------------|------|-------------------|
| TC-ROLE-FLOW-NEG-01 | P0 | User hết hạn / inactive | Position inactive | Login | Từ chối hoặc không grant |
| TC-ROLE-FLOW-NEG-02 | P0 | Deep-link 403 | Role thiếu cap | Paste URL module cấm | 403 + from= |
| TC-ROLE-FLOW-NEG-03 | P0 | Menu ẩn đúng | So sánh 2 role | Đếm item sidebar | Khớp ma trận bàn giao |
| TC-ROLE-FLOW-NEG-04 | P1 | API không lộ qua UI ẩn | — | Gọi API trực tiếp thiếu token/cap | 401/403 |

---

## 16. Checklist thực thi theo chức vụ

1. Seed/verify position grants trên VPS (handover SQL + CSD caps).  
2. Chuẩn bị ≥1 user/role (hoặc job-function union).  
3. Chạy **P0** của role đó + **FLOW** liên quan.  
4. Ghi Evidence theo `docs/crm/bo-test-case-huong-dan-tester.md`.  
5. Fail nào thuộc RBAC → đối chiếu `ma-tran-phan-quyen-RNOSAI-ban-giao-2026-09-16.md`.

---

## 17. Thống kê

| Nhóm | Số TC (ước lượng bảng trên) |
|------|-----------------------------|
| Theo role SUPER-ADMIN→CSKH | ~55 |
| Luồng cắt ngang | ~20 |
| **Tổng file này** | **~75** |

Bổ sung TC chi tiết màn hình: xem file [theo màn hình](./2026-09-17-rnosai-tc-theo-man-hinh.md).

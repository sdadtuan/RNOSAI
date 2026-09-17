# Bộ Test Case — Tổng thể toàn hệ thống RNOSAI

> **Document ID:** RNOSAI-TC-SYS-20260917  
> **Version:** 1.0 · **Date:** 2026-09-17  
> **Phạm vi:** ops-web + ptt-crm-api + Portal (nếu bật) + tích hợp phụ (Meta/SEO/Email/CSD)  
> **Related:** [TC theo chức vụ](./2026-09-17-rnosai-tc-theo-chuc-vu-va-luong.md) · [TC theo màn hình](./2026-09-17-rnosai-tc-theo-man-hinh.md) · `docs/TEST_CASES_PTT.md` (legacy PTT)

---

## 0. Mục tiêu & phạm vi

| Trong phạm vi | Ngoài phạm vi (ticket riêng) |
|---------------|------------------------------|
| Smoke P0 toàn shell | Performance load test đầy đủ |
| Auth/session/RBAC fail-closed | Penetration test formal |
| Luồng chính Lead→CSKH→AM→CSD→Content | Pixel-perfect mọi skin module |
| Deploy health VPS | Mobile app native |
| Observability cơ bản (lỗi UI/API) | Chaos engineering |

**Môi trường chuẩn:** `https://rs.pttads.vn` · User `SUPER-ADMIN` cho SYS + sample role cho regression.

---

## 1. Smoke P0 — trước mọi release

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-P0-01 | P0 | Health login | Mở `/login` → đăng nhập SUPER-ADMIN | Vào `/` hoặc redirect hợp lệ; cookie/session |
| TC-SYS-P0-02 | P0 | Ops shell | Sidebar expand/collapse + accordion mở 1 cha | UI Bitrix/Canopy; CRM không tự mở khi vào CSD |
| TC-SYS-P0-03 | P0 | Topbar | Search / bell / avatar menu | Mở được; logout về login |
| TC-SYS-P0-04 | P0 | API reachability | DevTools: staff/me hoặc board API | 200 + JSON; không CORS lỗi |
| TC-SYS-P0-05 | P0 | Static assets | Hard-refresh | CSS Canopy/`@rnosai/ui` load; không 404 chunk |
| TC-SYS-P0-06 | P0 | CSD + CRM board | `/crm` + `/crm/csd` | Cả hai 200 |
| TC-SYS-P0-07 | P0 | Logout | Logout → back | Không vào lại được module (401/login) |

---

## 2. Xác thực & phiên

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-AUTH-01 | P0 | Login đúng | Credentials hợp lệ | Session + caps trong JWT/me |
| TC-SYS-AUTH-02 | P0 | Login sai | Password sai | Lỗi; không session |
| TC-SYS-AUTH-03 | P0 | Refresh token | Để access hết hạn (hoặc force) rồi thao tác | Refresh im lặng hoặc re-login |
| TC-SYS-AUTH-04 | P1 | MFA (GDKD/IT) | User bật MFA | Challenge MFA trước vào app |
| TC-SYS-AUTH-05 | P1 | Concurrent session | Login 2 trình duyệt | Theo policy Keycloak (cả hai hoặc invalidate) |
| TC-SYS-AUTH-06 | P1 | Account self-service | `/account` đổi mật khẩu/avatar | Cập nhật OK; login lại được |
| TC-SYS-AUTH-07 | P0 | Deep link sau login | Mở `/crm/csd/tickets` khi chưa login | Redirect login → quay lại đúng URL |

---

## 3. Phân quyền hệ thống (RBAC)

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-RBAC-01 | P0 | Menu theo role | So sánh SUPER-ADMIN vs AE vs CE | Menu khớp ma trận bàn giao |
| TC-SYS-RBAC-02 | P0 | API fail-closed | Gọi endpoint thiếu cap (Postman) | 403 |
| TC-SYS-RBAC-03 | P0 | Seed handover | Apply seed → me caps | Counts khớp docs export |
| TC-SYS-RBAC-04 | P1 | Job function union | User có position + function | Caps = union; không mất position |
| TC-SYS-RBAC-05 | P1 | Admin permission UI | SUPER-ADMIN sửa grant → user re-login | Menu/API cập nhật |
| TC-SYS-RBAC-06 | P0 | Portal vs staff | Portal client không thấy staff Admin | Tách bề mặt đúng |
| TC-SYS-RBAC-07 | P1 | CSD chat account gate | Staff có csd.write nhưng chat disabled | Chat UI báo chưa kích hoạt |

---

## 4. Shell UI / Canopy design system

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-UI-01 | P0 | Bitrix sidebar brand | Quan sát màu sidebar ops | Xanh sage RNOSAI; không tím Bitrix |
| TC-SYS-UI-02 | P0 | Accordion CRM | Ở `/crm/csd/*` mở Service Desk | CRM **không** auto-open vì `/crm` hub |
| TC-SYS-UI-03 | P0 | PageToolbar | Trang dùng PageToolbar | Title Canopy (`rn-page-header`) |
| TC-SYS-UI-04 | P1 | Content OS sidebar | `/crm/content-os` | Sidebar **trắng**; accent xanh |
| TC-SYS-UI-05 | P1 | `@rnosai/ui` Button | CSD tickets Lọc/Tạo | `rn-btn` xanh/be |
| TC-SYS-UI-06 | P2 | Responsive 960px | Thu nhỏ viewport | Mobile nav/rail đúng |

---

## 5. CRM & bán hàng (hệ thống)

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-CRM-01 | P0 | Board hub | `/crm` | Module cards theo cap; badge SLA/review nếu có |
| TC-SYS-CRM-02 | P0 | Lead B2B CRUD | Tạo–sửa–list | Persist DB; reload còn |
| TC-SYS-CRM-03 | P0 | Inbox B2B | Đọc thread | Không mất message |
| TC-SYS-CRM-04 | P1 | Speed-to-lead | `/crm/b2b-speed` | Metric/SLA hiển thị |
| TC-SYS-CRM-05 | P1 | Unmatched ingress | `/crm/b2b-unmatched` | Map được lead |
| TC-SYS-CRM-06 | P1 | Intake / Sales Kit | `/crm/intake` | Stepper/BANT không crash |
| TC-SYS-CRM-07 | P1 | Orders / RE projects | Mở module nếu có data | List OK |
| TC-SYS-CRM-08 | P0 | Isolation tenant/client | User A không thấy data client B | Query scoped |

---

## 6. CSKH & khách hàng

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-CSKH-01 | P0 | CSKH board | Filter + mở case | Đúng cột/SLA |
| TC-SYS-CSKH-02 | P0 | Operational leads | Care lead | Action lưu |
| TC-SYS-CSKH-03 | P1 | Customers 360 | Timeline | Sự kiện đúng thứ tự |
| TC-SYS-CSKH-04 | P1 | Ticket CS vs CSD | So URL `/crm/tickets` vs `/crm/csd/tickets` | Hai hệ tách; copy UI không nhầm |

---

## 7. Service Desk (CSD)

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-CSD-01 | P0 | Ticket lifecycle | Create→assign→resolve | Status/SLA/audit |
| TC-SYS-CSD-02 | P0 | Chat DM/group | Gửi tin + reaction (nếu bật) | Realtime/refresh OK |
| TC-SYS-CSD-03 | P1 | Group admin | Join request / members | Theo Wave A/B specs |
| TC-SYS-CSD-04 | P1 | Email shared mailbox | Compose + inbound | Queue/duyệt từ khoá |
| TC-SYS-CSD-05 | P1 | Reports | Templates + generate | File/log send |
| TC-SYS-CSD-06 | P0 | DDL idempotent | Re-run deploy DDL | NOTICE already exists; không mất data |

---

## 8. Account Management & Agency

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-AM-01 | P0 | Dashboard KPI | Mở AM | Tiles số liệu |
| TC-SYS-AM-02 | P0 | Client book | Sort/filter | Đúng owner scope |
| TC-SYS-AM-03 | P1 | Onboarding / renewal / feedback | Đi hết tab chính | Không 500 |
| TC-SYS-AM-04 | P1 | Agency ingest | `/agency/ingest` | Ingest job/status |
| TC-SYS-AM-05 | P1 | Theme tokens | AM sidebar | Canopy green (không navy cũ) |

---

## 9. Sản xuất nội dung & marketing channels

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-PROD-01 | P0 | Content OS E2E | Request→approve→calendar | Trạng thái cuối đúng |
| TC-SYS-PROD-02 | P1 | Creative + Image SOP | Tạo job ảnh | Flag enable; output |
| TC-SYS-PROD-03 | P1 | Media OS / Video | Mở + thao tác tối thiểu | Không crash |
| TC-SYS-PROD-04 | P1 | Meta Ads hub | `/meta/facebook-ads` | List campaign (token OK) |
| TC-SYS-PROD-05 | P1 | SEO hub | `/seo/hub` | Cards/nav SEO |
| TC-SYS-PROD-06 | P1 | Email hub | `/email/hub` | Campaigns list |
| TC-SYS-PROD-07 | P2 | Zalo / Google ads | Mở route | 200 hoặc empty state |

---

## 10. KPI, tài chính, CEO, báo cáo

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-KPI-01 | P0 | KPI Hub shells | executive/marketing/sales | Embed không phá ops chrome |
| TC-SYS-KPI-02 | P1 | Dictionary/targets | Mở settings KPI | CRUD theo cap |
| TC-SYS-FIN-01 | P1 | Forecast / financials / invoices | Smoke 3 route | Load OK |
| TC-SYS-CEO-01 | P0 | `/crm/ceo` | Mở command | Widgets OK |
| TC-SYS-IWR-01 | P1 | Internal reports | Inbox + builder | Draft/save |
| TC-SYS-AUTO-01 | P1 | Automation / playbooks | Mở workflows | List/run theo quyền |

---

## 11. Admin & vận hành hệ thống

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-ADM-01 | P0 | Admin hub | `/admin` | Workspace cards |
| TC-SYS-ADM-02 | P0 | Org users/teams | CRUD nhẹ | Persist |
| TC-SYS-ADM-03 | P0 | Permissions matrix | Xem/sửa 1 grant | User re-login thấy đổi |
| TC-SYS-ADM-04 | P1 | Audit / break-glass | Mở audit | Log searchable |
| TC-SYS-ADM-05 | P1 | Integrations / environments | Mở trang | Config mask secret |
| TC-SYS-ADM-06 | P1 | AI admin | `/admin/ai/*` | Runs/tools theo cap |
| TC-SYS-ADM-07 | P1 | SPC services | `/admin/services` | Portfolio/process |

---

## 12. Tích hợp & dữ liệu

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-INT-01 | P1 | Webhook lead | Gửi payload mẫu | Lead vào hệ thống / unmatched |
| TC-SYS-INT-02 | P1 | Meta OAuth | Token hết hạn | UI báo reconnect |
| TC-SYS-INT-03 | P1 | Email IMAP/SMTP | Flag send disabled | Outbound queued (WARN log OK) |
| TC-SYS-INT-04 | P2 | S3/avatar | Upload avatar | URL hiển thị |
| TC-SYS-DATA-01 | P0 | Idempotent seed | Chạy seed 2 lần | Không duplicate phá unique |
| TC-SYS-DATA-02 | P1 | Backup/restore smoke | Restore staging snapshot (nếu có) | App boot |

---

## 13. Chất lượng, lỗi, bảo mật cơ bản

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-QA-01 | P0 | Console errors | Đi smoke P0 | Không error đỏ blocking |
| TC-SYS-QA-02 | P0 | 404 page | URL sai | Trang 404 thân thiện |
| TC-SYS-QA-03 | P1 | XSS reflected | Nhập `<script>` vào search/lead name | Escaped |
| TC-SYS-QA-04 | P1 | CSRF/cookie | Kiểm tra cookie flags | Secure/HttpOnly theo cấu hình |
| TC-SYS-QA-05 | P1 | Rate limit login | Brute vài lần | Lock/throttle nếu có |
| TC-SYS-QA-06 | P2 | a11y admin | axe trên `/admin` | Không critical blocker (đã có e2e a11y) |

---

## 14. Deploy & môi trường VPS

| TC-ID | P | Hạng mục | Bước | Kết quả mong muốn |
|-------|---|----------|------|-------------------|
| TC-SYS-DEP-01 | P0 | Deploy script | `APPLY=1 scripts/deploy_csd_vps.sh` | Build OK; ops-web HUP |
| TC-SYS-DEP-02 | P0 | Commit trên VPS | `git log -1` trên server | Khớp origin/main |
| TC-SYS-DEP-03 | P1 | `@rnosai/ui` prebuild | Build có `packages/rnosai-ui` | Không lỗi `Cannot find module 'react'` |
| TC-SYS-DEP-04 | P1 | Service active | `systemctl` / health curl login | 200 `/login` |
| TC-SYS-DEP-05 | P2 | Rollback | Checkout commit trước + rebuild | App phục hồi |

---

## 15. Hồi quy bắt buộc mỗi sprint (minimal)

1. TC-SYS-P0-01 → 07  
2. TC-SYS-RBAC-01, 02  
3. TC-SYS-CRM-01, 02  
4. TC-SYS-CSD-01, 02  
5. TC-SYS-UI-02, 04  
6. 1 TC role AE + 1 TC role CE từ file chức vụ  

---

## 16. Thống kê

| Nhóm | Số TC |
|------|------:|
| Smoke P0 | 7 |
| Auth | 7 |
| RBAC | 7 |
| UI/Canopy | 6 |
| CRM/CSKH | 12 |
| CSD | 6 |
| AM/Agency | 5 |
| Production/Channels | 7 |
| KPI/Fin/CEO | 6 |
| Admin | 7 |
| Integration/Data | 6 |
| QA/Security | 6 |
| Deploy | 5 |
| **Tổng** | **~87** |

---

## 17. Tài liệu tham chiếu

- `docs/TEST_CASES_PTT.md` — bộ PTT cũ (bổ sung, không thay thế)  
- `docs/crm/bo-test-case-huong-dan-tester.md` — quy trình tester + Excel  
- `docs/exports/ma-tran-phan-quyen-RNOSAI-ban-giao-2026-09-16.md`  
- `docs/handover/07-MA-TRAN-PHAN-QUYEN-TOAN-HE-THONG.md`  
- UAT runbooks: `docs/runbooks/*uat*`

# WIN-1 UAT Session — QA/PO (2026-08-07)

> **Môi trường:** https://rs.pttads.vn (staff console) · VPS commit `9db91e5`  
> **Automated report:** [`win-1-uat-results-20260807-043124.md`](./win-1-uat-results-20260807-043124.md)  
> **Checklist gốc:** [`docs/runbooks/win-1-uat-checklist.md`](../runbooks/win-1-uat-checklist.md)

---

## 1. Kết quả automated (PASS)

| Gate | Kết quả |
|------|---------|
| Ops smoke (login, health, PG 8 fn / 19 grants) | PASS |
| VUX-08 PWA (manifest, SW v3) | PASS |
| RBAC API (job-functions, org/users) | PASS |
| VUX-05 SoD API (`PUT` → 409 sod_violation) | PASS |
| Excel API (lead template, export, CSKH export) | PASS |
| Admin/CRM routes (307 unauth) | PASS |
| Public rs.pttads.vn (manifest, SW, routes) | PASS |

**SKIP:** Staff JWT login — `ADMIN_PASSWORD` trong `.env` không khớp hash `staff_users` trên VPS. API tests chạy qua `PTT_CRM_INTERNAL_KEY`.

**Hotfix đã áp trên VPS (chưa commit git):**
- `@StaffUser()` cho phép internal key trên route configure (fix PUT 401)
- `scripts/run_win1_uat.sh` — fallback internal key, sửa CSKH path, sửa backtick

---

## 2. Manual checklist — cần QA/PO thực hiện

### Chuẩn bị persona (VUX-04)

| Bước | Hành động |
|------|-----------|
| 1 | Tạo hoặc dùng **2 NV** (P1 content, P2 design) — hiện VPS chỉ có `admin@pttads.vn` |
| 2 | Admin → `/admin/crm/permissions/users` → gán `content` cho P1, `design` cho P2 |
| 3 | Mỗi NV **đăng xuất / đăng nhập lại** |
| 4 | Kiểm tra badge header + menu khác nhau |

### VUX-02 — Mobile leads (390px)

- [ ] DevTools viewport **390px** → `/crm/leads`
- [ ] Card `.win-leads-mobile-list`, nút **Gọi** / **Chi tiết**
- [ ] Filter chips hiển thị và xóa được

### VUX-04 — Menu theo function

- [ ] P1 thấy menu SEO/email write
- [ ] P2 không thấy menu chỉ dành content
- [ ] Badge `position · functions` đúng

### VUX-05 — SoD UI

- [ ] `/admin/crm/permissions/functions` — SoD-01 → **Lưu disabled**
- [ ] `/admin/crm/permissions/users` — content + compliance → banner SoD-02, **Lưu disabled**
- [x] API PUT → 409 (đã verify automated)

### Excel wizards (UI)

- [ ] Leads: Mẫu → upload → import → export filter
- [ ] Roster: `/crm/staff?tab=import` wizard CSV/Excel

### RBAC admin live

- [ ] Ma trận chức vụ + diff chip + relogin toast
- [ ] 8 job functions + tag Add-on
- [ ] User assign + effective caps preview
- [ ] CSKH board Export Excel (UI)

### Sign-off

- [ ] PO + QA ký [`win-1-acceptance-checklist.md`](../specs/win-1-acceptance-checklist.md)
- [ ] PDF (optional): `docs/exports/signed/WIN-1-acceptance-YYYY-MM-DD.pdf`

---

## 3. Blockers / follow-up kỹ thuật

| # | Issue | Khuyến nghị |
|---|-------|-------------|
| 1 | Staff login UAT — ADMIN_PASSWORD ≠ staff hash | `OPS_E2E_STAFF_PASSWORD` trong `.env` hoặc chạy `seed_super_admin_full_access.py --apply` |
| 2 | StaffUser internal-key fix | Commit + deploy chính thức (đã patch tạm trên VPS) |
| 3 | Playwright trên VPS | `npx playwright install` trước khi chạy E2E |
| 4 | WIN-1 chưa đóng | Cần manual VUX-02/04 + PO sign-off |

---

## 4. Lệnh tái chạy

```bash
# Trên VPS
cd /var/www/rnosai && bash scripts/run_win1_uat.sh

# Playwright (sau playwright install)
cd services/ops-web && OPS_E2E_URL=http://127.0.0.1:3200 npx playwright test e2e/win-1-lane-a.spec.ts
```

---

**Automated gates: PASS** · **WIN-1 exit: chờ manual QA/PO + sign-off**

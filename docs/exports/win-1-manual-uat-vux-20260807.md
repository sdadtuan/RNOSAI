# WIN-1 Manual UAT — VUX-02/04/05 (2026-08-07)

> **Môi trường:** https://rs.pttads.vn  
> **Commit:** `933a670` (login `/me` fix + UAT spec)  
> **Thực hiện:** Playwright headless + API verify  
> **Thời gian:** ~45 ph QA scope

---

## Tài khoản test

| Persona | Email | Job function | Mật khẩu |
|---------|-------|--------------|----------|
| Admin | `admin@pttads.vn` | SUPER-ADMIN | `ADMIN_PASSWORD` (VPS `.env`) |
| P1 Content | `win1-content@pttads.vn` | `content` · MKT-02 | cùng password |
| P2 Design | `win1-design@pttads.vn` | `design` · MKT-02 | cùng password |

---

## Kết quả

| Gate | Kết quả | Ghi chú |
|------|---------|---------|
| **VUX-02** Mobile leads 390px | **PASS** | `.win-leads-mobile-list` visible; no body horizontal scroll |
| **VUX-04** Badge content vs design | **PASS** | Badge `MKT-02 · content` vs `MKT-02 · design` |
| **VUX-04** Menu sidebar khác nhau | **CONDITIONAL** | Sidebar links **giống nhau**; cap diff chỉ `crm_facebook_ads.edit` (design) — cần PO xác nhận Meta Ads hub |
| **VUX-05** SoD UI users (content+compliance) | **PASS** | Banner SoD-02 + nút **Lưu job functions** disabled |
| **VUX-05** SoD UI functions (write+approve) | **PASS** | Nút **Lưu ma trận function** disabled khi SoD-01 |
| **VUX-05** SoD API 409 | **PASS** | (automated trước đó) |

**Playwright:** `e2e/win-1-manual-uat-vux.spec.ts` — **3/3 passed** (11.4s)

---

## Bug đã sửa trong phiên UAT

| Bug | Triệu chứng | Fix |
|-----|-------------|-----|
| Login thiếu caps trong session | Mọi NV (kể cả content) → **403** trên `/crm/leads` ngay sau login | `login/page.tsx` gọi `staffMe()` + `updateStoredUser()` sau login (`933a670`) |

---

## Follow-up PO / Product

1. **VUX-04 menu:** Job function `design` có thêm cap `crm_facebook_ads.edit` nhưng sidebar chưa tách menu rõ — cân nhắc ẩn/hiện sub-route Meta Ads theo cap `edit` vs `view` only.
2. **PO sign-off:** cập nhật [`win-1-acceptance-checklist.md`](../specs/win-1-acceptance-checklist.md).
3. **Screenshot archive (optional):** `docs/exports/win-ux-screenshots/WIN-1/`.

---

## Tái chạy QA (~5 ph)

```bash
cd services/ops-web
export OPS_E2E_SKIP_SERVER=1
export OPS_E2E_URL=https://rs.pttads.vn
export OPS_E2E_STAFF_PASSWORD='…'   # ADMIN_PASSWORD từ VPS .env
npx playwright test e2e/win-1-manual-uat-vux.spec.ts
```

---

## Manual checklist (PO tick)

- [x] VUX-02 mobile 390px — card, Gọi/Chi tiết, filter chips
- [x] VUX-04 badge `position · functions`
- [ ] VUX-04 menu SEO/email **khác biệt rõ** (conditional — sidebar giống nhau)
- [x] VUX-05 SoD UI (functions + users)
- [x] VUX-05 API 409
- [ ] PO ký acceptance PDF

**Trạng thái WIN-1:** Automated + UI gates **PASS** (VUX-04 menu conditional) — chờ PO sign-off.

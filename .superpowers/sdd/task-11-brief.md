### Task 11: Wave 1 UAT + VPS

**Files:**
- Create: `scripts/deploy_am_w1_vps.sh` only if existing deploy scripts cannot apply one extra DDL — prefer reuse.

**UAT (local then `https://rs.pttads.vn`):**

1. User without cap → 403 on `/crm/account-management`.
2. User with `view` sees OpsNav + Dashboard. KPI is `—` or live numbers — never 48 / 1,28 tỷ hard-coded in HTML/JS.
3. Exactly 6 tiles + today work + attention + forecast + 4-band donut + my book.
4. Period change does not change today-work rows.
5. Scope `me` hides others; `all` needs `view_all`.
6. Nhận xử lý assigns current user; refresh keeps it.
7. Tạo khách appears in `clients` + `crm_am_account_ext`; `/agency/clients/{id}` opens.
8. Renewal plan without contract is blocked.
9. ⌘K does not leak out-of-scope accounts.
10. All child routes render placeholder, not 404.
11. No nested `<main>`. KPI Hub layout unchanged.
12. Sidebar has no numeric badges.

- [ ] **Step 1: Local UAT against the 12 items.**
- [ ] **Step 2: Apply DDL on VPS, rebuild `ops-web` + `ptt-crm-api`, grant `crm_am` to 1 AM + 1 Director via Admin RBAC.**
- [ ] **Step 3: Prod smoke.** Stop here until PO signs Wave 1.

---

# Wave 2 — List, 360, handover, onboard, contract, renewal, settings

**Entry:** Wave 1 UAT green.  
**UAT gate:** parent/child, Lost reason, Go-live gate, no contract amount edit.


# WIN-3 acceptance checklist (Sprint C — UAT enterprise)

**Program:** RNOSAI Competitive WIN · **Sprint:** WIN-3-C  
**Spec:** [`2026-08-07-win-3-implementation-plan.md`](2026-08-07-win-3-implementation-plan.md) §1.2, §7  
**Environment:** Staging `rs.pttads.vn` (pilot flags on)

## Preconditions

- [ ] `STAFF_SCOPE_PILOT=1` on Nest (`ptt-crm-api`)
- [ ] `NEXT_PUBLIC_WIN_SCOPE_PILOT=1` on ops-web build
- [ ] DDL `staff_user_clients` applied (`apply_pg_ddl_staff_user_clients_r3_a.sh`)
- [ ] WIN-3-A/B flags still on (permission sets, simulator, break-glass)

## EC-W3 exit criteria

| ID | Scenario | Steps | Expected | Status |
|----|----------|-------|----------|--------|
| **EC-W3-01** | Permission Set demo | Gắn `SET-SOLUTION-BACKUP` cho user KD-01 → re-login → thử claim OK → revoke set → 403 | Caps union đúng; revoke fail-closed | ☐ |
| **EC-W3-02** | Simulator 5 personas | `/admin/crm/permissions/simulator` — 5 position/function/set combos; so sánh menu sau login | Menu preview = prod menu 100% | ☐ |
| **EC-W3-03** | Access review quý | `GET /staff/permissions/access-review.zip?quarter=YYYY-QN` | ZIP mở được (MD+JSON/user); lưu archive IT | ☐ |
| **EC-W3-04** | GDKD cap split | Ma trận supplement ký; lead override | Audit log có override/view_all | ☐ |
| **EC-W3-05** | Break-glass | Request → GDKD approve → dùng cap tạm → cron/auto-revoke ≤24h | Grant hết hạn; audit trail | ☐ |
| **EC-W3-06** | Forecast + renewal UI | `/crm/forecast` MAPE badge; home/dashboard T-90 strip | Badge + amber cards visible staging | ☐ |
| **EC-W3-07** | VUX-04 | Content vs design persona — diff menu | Pass theo script UAT WIN-1 | ☐ |
| **EC-W3-08** | PO sign-off | PO ký `WIN-3-acceptance-YYYY-MM-DD.pdf` | File archived | ☐ |

## R3 client scope pilot (WIN-3-C)

| ID | Scenario | Steps | Expected | Status |
|----|----------|-------|----------|--------|
| **R3-C-01** | Bind AM scope | Admin org user → Client scope picker → chọn 1–2 clients → lưu → re-login | JWT/`/auth/me` có `client_ids[]` | ☐ |
| **R3-C-02** | Lead list filter | AM scoped login → `GET /leads` | Chỉ lead `agency_client_id` trong scope | ☐ |
| **R3-C-03** | Lead detail deny | AM mở lead client ngoài scope (direct URL) | 403 `client_scope_denied` | ☐ |
| **R3-C-04** | Internal unrestricted | User không có binding `staff_user_clients` | Full lead list (như trước pilot) | ☐ |
| **R3-C-05** | Super-admin bypass | Position `super-admin` + có bindings | Bypass scope (full access) | ☐ |
| **R3-C-06** | UI badges | Lead list + org users list + UserIdentityCard | `WinScopeBadge` hiển thị khi flag on | ☐ |

## UAT scripts (manual)

### W3-UAT-01 — Simulator 5 personas

1. AM-01 (position only)  
2. KD-01 + job function `content`  
3. CSKH + `SET-SOLUTION-BACKUP`  
4. GDKD + override caps  
5. Compare mode: nhập `compare_user_id` → diff caps/menu

Record: screenshot menu preview vs prod sidebar per persona.

### W3-UAT-02 — Permission Set demo

Record screen capture: assign set → effective caps preview → login → action OK → revoke → 403.

### W3-UAT-03 — Access review archive

Download ZIP for current quarter; store under IT compliance folder; verify MD renders.

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| PO | | | |
| IT Lead | | | |
| QA | | | |

**Gate WIN-3-C:** All EC-W3-01…08 checked + R3-C-01…06 on staging.

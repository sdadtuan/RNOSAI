### Task 15: Account 360 Overview (UI-AM-03)

**Files:** `GET/PATCH /api/crm/am/accounts/:agencyClientId`, `AmAccount360.tsx`, `clients/[id]/page.tsx`

10 tabs. Wave 2 **implements** Tổng quan + Hợp đồng & Tài chính (read) + Audit. Other tabs: real headings + `Mở ở Wave n` panel (not 404).

Header: name, lifecycle, health badge → `/health/[id]`, code, industry, tier, team, Owner ▾ (assign), Delivery/Media labels if present. Quick actions: Log (W3 disable), Tạo việc, Tạo rủi ro (W3 disable), Bắt đầu gia hạn, Tạo cơ hội (W4 disable), no AI. `⋮` sửa / contact / đổi owner / lifecycle / archive (`manage`) / merge (`manage`, can 403 with tooltip). Deep-link `/agency/clients/[id]`. Parent lists children.

PATCH may update ext (tier, team, status, parent) — **not** `clients` legal identity except name via AgencyService if caller also has agency write.

- [ ] Tests: out-of-scope 404 not 200; parent returns children[]; PATCH amount on a contract endpoint does not exist.
- [ ] Commit: `feat(am): add Account 360 overview with parent/child`.

---


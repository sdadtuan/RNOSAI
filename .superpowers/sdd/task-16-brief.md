### Task 16: Create/Edit account + Contact drawer (UI-AM-05/06)

**Files:** `AmAccountForm.tsx`, `clients/new/page.tsx`, `AmContactDrawer.tsx`

Create reuses Task 7 API (full page). Edit: identity *, owner, ≥1 primary contact, tags. CTA: Hủy · Lưu nháp (status pending) · Lưu và tạo onboarding · Lưu. Dirty leave → `window` confirm (BR-024).

Contact: name, buying-committee role, sentiment, channel Gọi/Email/Zalo, renewal attitude.

- [ ] Tests: Active without primary contact → 400 `primary_contact_required`.
- [ ] Commit: `feat(am): add account form and contact drawer`.

---


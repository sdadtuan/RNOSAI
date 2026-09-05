### Task 13: Accounts list API + UI-AM-02

**Files:** `am-accounts.service.ts` (list), `AmAccountsList.tsx`, `clients/page.tsx`

**Interfaces:**

```ts
GET /api/crm/am/accounts?scope&q&owner&team&band&lifecycle&industry&sort&page&page_size=50
→ { items, total, page }
item: {
  agency_client_id, code, name, parent_id, parent_name, is_parent, child_count,
  owner_staff_id, owner_label, delegated_until, team_label,
  am_status, band, score, mrr_vnd, ends_on, sla_label
}
```

Default hide `churned`. Saved-view chips: Tất cả · Của tôi · Cần chú ý · Gia hạn 90 ngày · Chưa gán owner · Parent group — implemented as query presets, not hard-coded rows. URL is source of filter. Sticky header. Density from shell.

- [ ] Tests: churned hidden; `view` cannot see other owner; sort `ends_on` server-side.
- [ ] UI: empty → `—`; parent row shows child count; unassigned only visible to assign/view_all.
- [ ] Commit: `feat(am): add scoped account list with saved-view chips`.

---


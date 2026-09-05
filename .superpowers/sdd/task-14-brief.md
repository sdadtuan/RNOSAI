### Task 14: Saved views + bulk owner transfer

**Files:** settings/views endpoints, `AmAccountsList.tsx` bulk bar

```ts
GET/POST /api/crm/am/views
POST /api/crm/am/accounts/transfer
body: { agency_client_ids: string[]; to_staff_id: number; reason: string; keep_secondary?: boolean; move_open_tasks?: boolean }
cap: assign
```

Rules: reason required; one owner at a time; optional `backup_staff_id` if `keep_secondary`; audit `account.transfer`. Max 10 views / user; `shared=true` needs manage or team-lead (`assign`+`view_all`).

- [ ] Tests: missing reason 400; view user 403; task move optional flag.
- [ ] UI modal Đổi Owner.
- [ ] Commit: `feat(am): add saved views and bulk owner transfer`.

---


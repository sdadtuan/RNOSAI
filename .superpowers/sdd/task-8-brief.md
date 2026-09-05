### Task 8: Command palette ⌘K

**Files:**
- Create: `services/ptt-crm-api/src/am/am-search.service.ts`
- Create: `services/ptt-crm-api/src/am/am-search.service.spec.ts`
- Create: `services/ops-web/src/components/crm/am/AmPalette.tsx`

**Interfaces:**

```ts
GET /api/crm/am/search?q=
cap: view
// q.trim().length < 2 → { items: [] } (not 500)
// groups Wave 1: account | contract | task
// apply amScopeSql — never return out-of-scope account
// exact code (clients.code ILIKE q) first, then name ILIKE
```

- [ ] **Step 1: Tests** — 1-char empty; view user cannot see other owner; exact code ranks first.

- [ ] **Step 2: UI** — ⌘/Ctrl+K, Esc closes, Enter opens. Account → `/crm/account-management/clients/[id]` (placeholder Wave 1). Debounce 300ms.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add scoped command palette search

EOF
)"
```

---


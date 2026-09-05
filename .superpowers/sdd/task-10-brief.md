### Task 10: Settings GET + notify stub + freshness

**Files:**
- Modify: `am-settings.service.ts`, `am.controller.ts`
- Create: `services/ptt-crm-api/src/am/am-notifications.service.ts`
- Modify: `AmShell.tsx` — freshness chip + bell (empty list OK; **no** hard-coded `5`)

**Interfaces:**

```ts
GET /api/crm/am/settings          cap: view
GET /api/crm/am/notifications     cap: view   → { items, unread }
```

`work_left_label` from `am-freshness.util.ts`: VN 08:30–17:30 Mon–Fri. Weekend / after hours → `Giờ LV còn 0p` or `Ngoài giờ LV`.

- [ ] **Step 1: Freshness spec** — Tuesday 09:30 → remaining 8h; Saturday → ngoài giờ.

- [ ] **Step 2: Bell shows dot only when `unread > 0`.**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add settings read, notifications stub, and work-hours freshness

EOF
)"
```

---


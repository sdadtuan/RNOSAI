### Task 6: Nhận việc + Tạo việc

**Files:**
- Create: `services/ptt-crm-api/src/am/am-tasks.service.ts`
- Create: `services/ptt-crm-api/src/am/am-tasks.service.spec.ts`
- Modify: `am.controller.ts`
- Modify: `AmDashboard.tsx` + `AmCreateMenu.tsx` (drawer UI-AM-16 subset)

**Interfaces:**

```ts
POST /api/crm/am/tasks
body: { agency_client_id: string; title: string; kind?: AmTaskKind; priority?: 'low'|'medium'|'high'; due_at?: string; source?: string; source_ref?: string }
cap: edit

POST /api/crm/am/tasks/:id/accept
cap: edit
→ assignee_staff_id = me, status = in_progress, audit action=task.accept

POST /api/crm/am/tasks/dismiss
body: { source: string; source_ref: string }
cap: edit
→ dismissed_at = now(); unique index allows a later real task
```

- [ ] **Step 1: Failing tests** (service with mocked repo)

```ts
it('accept assigns current staff and writes audit', async () => {
  const out = await service.accept('task-1', 42);
  expect(out.assignee_staff_id).toBe(42);
  expect(out.status).toBe('in_progress');
  expect(audit.calls[0].action).toBe('task.accept');
});

it('rejects duplicate open source_ref', async () => {
  await expect(service.create({
    agency_client_id: 'c1', title: 'A', source: 'csd', source_ref: 'T-1',
  }, 1)).rejects.toMatchObject({ status: 409 });
});
```

- [ ] **Step 2: Implement + UI “Nhận xử lý”** → toast → refetch command-center.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): claim today work items and create AM tasks

EOF
)"
```

---


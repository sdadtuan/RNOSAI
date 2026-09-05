### Task 7: Tạo khách + Tạo plan

**Files:**
- Create: `services/ptt-crm-api/src/am/am-accounts.service.ts`
- Create: `services/ptt-crm-api/src/am/am-accounts.service.spec.ts`
- Create: `services/ptt-crm-api/src/am/am-plans.service.ts`
- Create: `services/ptt-crm-api/src/am/am-plans.service.spec.ts`
- UI drawers in `AmCreateMenu.tsx`

**Interfaces:**

```ts
POST /api/crm/am/accounts
cap: edit
body:
  | { mode: 'create'; code: string; name: string; industry_slug?: string; owner_am_id?: string }
  | { mode: 'attach'; agency_client_id: string; owner_staff_id?: number }

// create → AgencyService.createClient then UPSERT crm_am_account_ext
// attach → UPSERT ext only; 404 if clients.id missing
// create without crm_agency write → 403 { error: 'agency_write_required', fallback: '/agency/clients/new' }

POST /api/crm/am/plans
cap: edit
body: { agency_client_id: string; kind: AmPlanKind; period_key: string; contract_id?: number; due_on?: string }
// kind=renewal without contract_id → 400 { error: 'contract_required' }
// unique (client, kind, period_key) → 409
// seed tasks:
//   qbr: ['Chuẩn bị số liệu QBR','Đặt lịch QBR','Gửi biên bản']
//   renewal: ['Rà soát phạm vi','Liên hệ stakeholder','Soạn đề xuất gia hạn']
//   care: ['Gọi health-check','Lập recovery nếu Critical']
//   expand: ['Xác nhận nhu cầu','Tạo bước next']
```

- [ ] **Step 1: Tests**

```ts
it('create does not INSERT into a second customer table', async () => {
  await service.createAccount({ mode: 'create', code: 'AP01', name: 'An Phu' }, actor);
  expect(agency.createClient).toHaveBeenCalled();
  expect(db.inserts.some((s) => /insert into clients/i.test(s) && s.includes('am_'))).toBe(false);
});

it('attach does not call createClient', async () => {
  await service.createAccount({ mode: 'attach', agency_client_id: 'uuid' }, actor);
  expect(agency.createClient).not.toHaveBeenCalled();
});

it('renewal plan without contract_id is 400', async () => {
  await expect(plans.create({ agency_client_id: 'c', kind: 'renewal', period_key: '2026-Q3' }, 1))
    .rejects.toMatchObject({ error: 'contract_required' });
});
```

Inject `AgencyService` via `AmModule` importing `AgencyModule` (`forwardRef` if needed).

- [ ] **Step 2: UI** — create form fields match `/agency/clients/new` (code, name, industry_slug, owner). Tab **Gắn đã có** searches existing `clients`.

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): wrap agency client create and seed AM plans

EOF
)"
```

---


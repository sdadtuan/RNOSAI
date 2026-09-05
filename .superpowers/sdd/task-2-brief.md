### Task 2: Caps + route guard

**Files:**
- Modify: `services/ptt-crm-api/src/staff-permissions/rbac-admin-catalog.json`
- Create: `scripts/seed_am_rbac.sh` (catalog only; no auto-grant prod)
- Modify: `services/ops-web/src/lib/rbac-routes.ts` — insert **before** `{ prefix: '/crm', ... }`
- Modify: `services/ops-web/src/lib/auth.spec.ts`
- Create: `services/ops-web/src/lib/crm/am-nav.util.ts`
- Create: `services/ops-web/src/lib/crm/am-nav.util.spec.ts`

**Interfaces:**
- Consumes: `hasCap`, `canAccessPath`
- Produces: `canSeeAmNav(user)`, route prefix `/crm/account-management`

- [ ] **Step 1: Write failing route tests** in `auth.spec.ts`

```ts
it('AM path requires crm_am.view or view_all — agency-only is 403', () => {
  const agency = user([{ section: 'crm_agency', action: 'view' }]);
  expect(canAccessPath('/crm/account-management', agency, 'crm')).toBe(false);
  expect(canAccessPath('/crm/account-management/clients', agency, 'crm')).toBe(false);
});

it('crm_am.view can open AM routes', () => {
  const am = user([{ section: 'crm_am', action: 'view' }]);
  expect(canAccessPath('/crm/account-management', am, 'crm')).toBe(true);
  expect(canAccessPath('/crm/account-management/renewals/x', am, 'crm')).toBe(true);
});

it('crm_am.view_all can open AM routes', () => {
  const dir = user([{ section: 'crm_am', action: 'view_all' }]);
  expect(canAccessPath('/crm/account-management', dir, 'crm')).toBe(true);
});
```

Run: `cd services/ops-web && npx vitest run src/lib/auth.spec.ts`
Expected: FAIL — prefix missing, agency user matches generic `/crm`.

- [ ] **Step 2: Catalog**

In `section_actions` add next to `"csd"`:

```json
"crm_am": ["view", "view_all", "edit", "assign", "manage"],
"crm_am.finance": ["view"]
```

In `sections` add after the `csd` object:

```json
{
  "id": "crm_am",
  "label": "Account Management",
  "group": "CRM",
  "page": "/crm/account-management",
  "description": "AM post-contract: retain / renew / expand / health."
},
{
  "id": "crm_am.finance",
  "label": "Account Management — Tài chính",
  "group": "CRM",
  "page": "/crm/account-management",
  "description": "Xem snapshot công nợ / invoice AM. Không sửa Paid."
}
```

- [ ] **Step 3: Prefix in `PATH_CAP_RULES` immediately before `/crm/csd` (must be longer than `/crm`)**

```ts
{
  prefix: '/crm/account-management',
  anyOf: [
    { section: 'crm_am', action: 'view' },
    { section: 'crm_am', action: 'view_all' },
  ],
},
```

- [ ] **Step 4: `am-nav.util.ts`**

```ts
import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeAmNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  return hasCap(user, 'crm_am', 'view') || hasCap(user, 'crm_am', 'view_all');
}

export type AmNavItem = {
  href: string;
  label: string;
  group: 'TỔNG QUAN' | 'KHÁCH HÀNG' | 'CÔNG VIỆC' | 'HỢP ĐỒNG' | 'PHÂN TÍCH' | 'CẤU HÌNH';
};

export const AM_NAV: AmNavItem[] = [
  { group: 'TỔNG QUAN', href: '/crm/account-management', label: 'Dashboard' },
  { group: 'KHÁCH HÀNG', href: '/crm/account-management/clients', label: 'Danh sách' },
  { group: 'KHÁCH HÀNG', href: '/crm/account-management/onboarding', label: 'Onboarding' },
  { group: 'CÔNG VIỆC', href: '/crm/account-management/work', label: 'Work Queue' },
  { group: 'HỢP ĐỒNG', href: '/crm/account-management/renewals', label: 'Gia hạn' },
  { group: 'PHÂN TÍCH', href: '/crm/account-management/reports', label: 'Báo cáo' },
  { group: 'PHÂN TÍCH', href: '/crm/account-management/health', label: 'Health & Risk' },
  { group: 'CẤU HÌNH', href: '/crm/account-management/settings', label: 'Cấu hình' },
];
```

Spec: `AM_NAV` has 8 items, group order as above, no `badge` field.

- [ ] **Step 5: Re-run vitest** — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): register crm_am caps and fail-closed route guard

EOF
)"
```

---


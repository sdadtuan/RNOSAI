### Task 5: AmShell + Dashboard UI + placeholders

**Files:**
- Create: `services/ops-web/src/lib/crm/am-api.ts`
- Create: `services/ops-web/src/lib/crm/am-format.ts`
- Create: `services/ops-web/src/lib/crm/am-format.spec.ts`
- Create: `services/ops-web/src/components/crm/am/AmShell.tsx`
- Create: `services/ops-web/src/components/crm/am/AmCreateMenu.tsx`
- Create: `services/ops-web/src/components/crm/am/AmDashboard.tsx`
- Create: `services/ops-web/src/components/crm/am/AmPlaceholder.tsx`
- Create: `services/ops-web/src/app/crm/account-management/am.css`
- Create: `services/ops-web/src/app/crm/account-management/layout.tsx`
- Create: pages: `page.tsx`, `clients/page.tsx`, `clients/[id]/page.tsx`, `onboarding/page.tsx`, `onboarding/[id]/page.tsx`, `work/page.tsx`, `work/[id]/page.tsx`, `renewals/page.tsx`, `renewals/[id]/page.tsx`, `contracts/[id]/page.tsx`, `reports/page.tsx`, `health/page.tsx`, `health/[id]/page.tsx`, `settings/page.tsx`, `feedback/page.tsx`, `opportunities/page.tsx`
- Modify: `services/ops-web/src/components/OpsNav.tsx` — TITLE_MAP + section after Service Desk
- Modify: `services/ops-web/src/lib/crm/am-nav.util.spec.ts` if needed

**Interfaces:**
- Consumes: `AmCommandCenter`, `AM_NAV`, `canSeeAmNav`
- Produces: working `/crm/account-management` page

`am-format.ts`:

```ts
export function dash(n: number | null | undefined): string {
  return n == null ? '—' : String(n);
}

export function bandCopy(band: AmHealthBand | null | undefined): string {
  if (band === 'healthy') return 'Khỏe mạnh';
  if (band === 'watch') return 'Cần theo dõi';
  if (band === 'at_risk') return 'Có rủi ro';
  if (band === 'critical') return 'Nghiêm trọng';
  return '—';
}
```

Layout **must** be:

```tsx
export default function AmLayout({ children }: { children: React.ReactNode }) {
  return <AmShell>{children}</AmShell>;
}
```

`AmShell` renders one page column. **Do not** wrap `{children}` in a second `<main>` if Ops chrome already has `<main>` — render a `<div className="am-root">`. Collapse control stores `localStorage.am-sidebar-collapsed`. Density stores `localStorage.am-density` = `comfortable | compact`. Scope is query `?scope=me|team|all` (default `me`). Role label is the real job/cap (`Admin` if `manage`, `Director` if `view_all`, else `AM`) — **not** a fake dropdown.

KPI tiles (copy exact):
1. Khách hàng active → `/crm/account-management/clients`
2. MRR hiện tại → `/crm/account-management/clients?sort=mrr`
3. Gia hạn 90 ngày (value + case count) → `/crm/account-management/renewals?window=90`
4. Revenue at risk → `/crm/account-management/health?band=at_risk,critical`
5. SLA quá hạn → `/crm/account-management/work?sla=breached`
6. CSAT → `/crm/account-management/feedback`

Placeholder copy: `Onboarding — mở ở Wave 2` (and Wave 3/4 as SRS §5.2).

OpsNav: after Service Desk block:

```ts
if (canSeeAmNav(user)) {
  sections.push({
    label: 'Account Management',
    links: [{ href: '/crm/account-management', label: 'Account Management' }],
    defaultOpen: true,
  });
}
```

Add `'/crm/account-management': 'Account Management'` to TITLE_MAP. Do **not** put AM under KPI Hub.

- [ ] **Step 1: Format spec** — `dash(null)==='—'`, `bandCopy('watch')==='Cần theo dõi'`.

- [ ] **Step 2: Implement shell/dashboard.** Widget errors: keep height + Retry. Empty today-work: `Bạn đã xử lý xong các việc ưu tiên hôm nay.` Empty book + `edit`: CTA Tạo khách.

- [ ] **Step 3: Create-menu Wave 1:** Khách · Việc · Renewal/Plan enabled if `edit`. Cơ hội + Log tương tác **disabled** with tooltip `Mở ở Wave 4` / `Mở ở Wave 3`.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): add AmShell and Wave 1 dashboard matching UI-AM-01

EOF
)"
```

---


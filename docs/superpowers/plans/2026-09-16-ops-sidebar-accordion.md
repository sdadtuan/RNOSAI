# Ops Sidebar Accordion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor ops-web `OpsNav` into a Bitrix-style accordion tree (leaf vs parent, RNOSAI brand, hybrid open rules, group highlight) per `docs/superpowers/specs/2026-09-16-ops-sidebar-accordion-design.md`.

**Architecture:** Extract pure `buildNavTree` + accordion helpers into testable modules; keep all existing RBAC/flag gates; `OpsNav` only renders `NavItem[]` with CSS grid-row animation and group highlight. No URL or API changes.

**Tech Stack:** Next.js 14 (ops-web), React client component, Vitest, CSS in `globals.css`.

## Global Constraints

- Brand: RNOSAI green tokens only — no Bitrix purple gradient.
- Leaf = no chevron; parent only if ≥2 children after RBAC/flags.
- Accordion lai: opening parent A closes others except the parent that contains the active pathname.
- Preserve every previous href when user still has caps (no orphan routes).
- localStorage key: `ops-nav-accordion-v2` (do not reuse `ops-nav-sections-collapsed` schema).
- Animation ~220ms; respect `prefers-reduced-motion`.
- Spec SoT: `docs/superpowers/specs/2026-09-16-ops-sidebar-accordion-design.md`.

## File map

| File | Responsibility |
|------|----------------|
| `services/ops-web/src/components/ops-nav-tree.types.ts` | `NavLeaf` / `NavParent` / `NavChild` / `NavItem` types |
| `services/ops-web/src/components/ops-nav-accordion.ts` | Pure open-set logic + localStorage read/write |
| `services/ops-web/src/components/ops-nav-tree.ts` | `buildNavTree(...)` — move gates from `buildSections` |
| `services/ops-web/src/components/ops-nav-tree.spec.ts` | Tree structure, labels, leaf collapse, href coverage |
| `services/ops-web/src/components/ops-nav-accordion.spec.ts` | Hybrid accordion rules |
| `services/ops-web/src/components/OpsNav.tsx` | Render tree; wire accordion; rail flyout for parents |
| `services/ops-web/src/components/layout/nav-icons.tsx` | Parent icons + `sectionIcon`/`sectionShortLabel` for new ids |
| `services/ops-web/src/app/globals.css` | Accordion animation + group highlight block |

---

### Task 1: Types + accordion pure helpers (TDD)

**Files:**
- Create: `services/ops-web/src/components/ops-nav-tree.types.ts`
- Create: `services/ops-web/src/components/ops-nav-accordion.ts`
- Create: `services/ops-web/src/components/ops-nav-accordion.spec.ts`

**Interfaces:**
- Produces:
  - Types `NavLeaf`, `NavParent`, `NavChild`, `NavItem`
  - `NAV_ACCORDION_STORAGE_KEY = 'ops-nav-accordion-v2'`
  - `itemContainsPath(item: NavItem, pathname: string): boolean`
  - `isActiveHref(pathname: string, href: string): boolean` (prefix-safe like current `isActive`)
  - `nextOpenIdsAfterToggle(args: { openIds: string[]; toggledId: string; items: NavItem[]; pathname: string }): string[]`
  - `ensureActiveParentOpen(openIds: string[], items: NavItem[], pathname: string): string[]`
  - `readOpenIds(): string[] | null` / `writeOpenIds(ids: string[]): void`

- [ ] **Step 1: Write failing tests**

```ts
// ops-nav-accordion.spec.ts
import { describe, expect, it } from 'vitest';
import {
  ensureActiveParentOpen,
  isActiveHref,
  itemContainsPath,
  nextOpenIdsAfterToggle,
  type NavItem,
} from './ops-nav-accordion';
// re-export types from types file via accordion or import types separately

const items: NavItem[] = [
  { kind: 'leaf', id: 'overview', label: 'Tổng quan', href: '/', icon: 'home' },
  {
    kind: 'parent',
    id: 'sales',
    label: 'Bán hàng',
    icon: 'sales',
    children: [
      { id: 'b2b', label: 'Lead B2B', href: '/crm/b2b/leads', icon: 'leads' },
      { id: 'inbox', label: 'Inbox B2B', href: '/crm/b2b-inbox', icon: 'inbox' },
    ],
  },
  {
    kind: 'parent',
    id: 'csd',
    label: 'Service Desk',
    icon: 'ticket',
    children: [
      { id: 'csd-home', label: 'Tổng quan', href: '/crm/csd', icon: 'hub' },
      { id: 'chat', label: 'Chat nội bộ', href: '/crm/csd/chat', icon: 'chat' },
    ],
  },
];

describe('isActiveHref', () => {
  it('matches exact and nested paths (same semantics as OpsNav isActive)', () => {
    expect(isActiveHref('/crm/csd/chat', '/crm/csd/chat')).toBe(true);
    expect(isActiveHref('/crm/csd/chat', '/crm/csd')).toBe(true); // pathname.startsWith(href + '/')
    expect(isActiveHref('/crm/b2b/leads/123', '/crm/b2b/leads')).toBe(true);
    expect(isActiveHref('/crm', '/')).toBe(false);
  });
});

describe('nextOpenIdsAfterToggle', () => {
  it('opens one parent and closes others except active pathname parent', () => {
    const open = nextOpenIdsAfterToggle({
      openIds: ['csd'],
      toggledId: 'sales',
      items,
      pathname: '/crm/csd/chat',
    });
    expect(open.sort()).toEqual(['csd', 'sales'].sort());
  });

  it('closes parent when toggled while open', () => {
    const open = nextOpenIdsAfterToggle({
      openIds: ['sales'],
      toggledId: 'sales',
      items,
      pathname: '/',
    });
    expect(open).toEqual([]);
  });
});

describe('ensureActiveParentOpen', () => {
  it('forces parent of active route open', () => {
    expect(ensureActiveParentOpen([], items, '/crm/b2b/leads')).toEqual(['sales']);
  });
});
```

**Note:** Copy the real `isActive` semantics from `OpsNav.tsx` (read function at ~line 336) into `isActiveHref` so nested routes behave identically.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd services/ops-web && npx vitest run src/components/ops-nav-accordion.spec.ts
```

Expected: FAIL module not found / exports missing.

- [ ] **Step 3: Implement types + accordion helpers**

```ts
// ops-nav-tree.types.ts — exact shapes from spec §3
export type NavChild = { id: string; label: string; href: string; icon: string; badge?: number };
export type NavLeaf = {
  kind: 'leaf';
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
};
export type NavParent = {
  kind: 'parent';
  id: string;
  label: string;
  icon: string;
  children: NavChild[];
};
export type NavItem = NavLeaf | NavParent;
```

Implement `nextOpenIdsAfterToggle`:
- If `toggledId` already in `openIds` → remove it.
- Else add it, then remove every other parent id **except** parent(s) where `itemContainsPath(item, pathname)`.
- Never put leaf ids in open set.

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd services/ops-web && npx vitest run src/components/ops-nav-accordion.spec.ts
```

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/components/ops-nav-tree.types.ts \
  services/ops-web/src/components/ops-nav-accordion.ts \
  services/ops-web/src/components/ops-nav-accordion.spec.ts
git commit -m "feat(ops-nav): add accordion helpers and nav item types"
```

---

### Task 2: `buildNavTree` + structure tests (TDD)

**Files:**
- Create: `services/ops-web/src/components/ops-nav-tree.ts`
- Create: `services/ops-web/src/components/ops-nav-tree.spec.ts`
- Modify later: move logic out of `OpsNav.tsx` `buildSections`

**Interfaces:**
- Consumes: types from Task 1; existing `@/lib/auth` `hasCap`, flag helpers, `buildAdminSidebarLinks`, `shouldShow*` from ops-nav-* modules (same imports as current `buildSections`).
- Produces:
  - `buildNavTree(user, opts): NavItem[]`
  - `opts`: `{ emailPendingApprovals?: number; agencyUnread?: number; reviewQueueCount?: number; csdChatUnread?: number; imageSopEnabled?: boolean }`
  - `collapseThinParents(items: NavItem[]): NavItem[]` — parent with `<2` children → leaf
  - `collectHrefs(items: NavItem[]): string[]`

- [ ] **Step 1: Write failing tests for IA order + labels + leaf rule**

```ts
import { describe, expect, it } from 'vitest';
import { buildNavTree, collapseThinParents, collectHrefs } from './ops-nav-tree';
import type { StoredStaffUser } from '@/lib/auth';

function superUser(): StoredStaffUser {
  // large caps list covering csd, crm_leads, crm_agency, seo, email, etc.
  // Mirror patterns from existing OpsNav.*.spec.ts user() helpers
  return { id: '1', email: 'a@pttads.vn', display_name: 'Admin', position_id: 1, caps: [/* ... */] };
}

describe('buildNavTree IA', () => {
  it('orders top-level ids per spec', () => {
    const ids = buildNavTree(superUser(), {}).map((i) => i.id);
    // assert relative order using indexOf
    expect(ids.indexOf('overview')).toBeLessThan(ids.indexOf('sales'));
    expect(ids.indexOf('sales')).toBeLessThan(ids.indexOf('crm'));
    expect(ids.indexOf('csd')).toBeLessThan(ids.indexOf('agency'));
    expect(ids.indexOf('ads')).toBeLessThan(ids.indexOf('seo'));
    expect(ids.indexOf('seo')).toBeLessThan(ids.indexOf('email'));
    expect(ids.indexOf('production')).toBeLessThan(ids.indexOf('plan'));
    expect(ids.indexOf('kpi')).toBeLessThan(ids.indexOf('hr'));
    expect(ids.indexOf('finance')).toBeLessThan(ids.indexOf('ceo'));
  });

  it('uses Vietnamese child labels from spec', () => {
    const sales = buildNavTree(superUser(), {}).find((i) => i.id === 'sales');
    expect(sales?.kind).toBe('parent');
    if (sales?.kind === 'parent') {
      expect(sales.children.map((c) => c.label)).toContain('Hàng đợi Solution');
      expect(sales.children.map((c) => c.label)).toContain('Hub hợp đồng');
    }
  });

  it('collapses single-child parents to leaves', () => {
    const collapsed = collapseThinParents([
      {
        kind: 'parent',
        id: 'am',
        label: 'Account Management',
        icon: 'customers',
        children: [{ id: 'am-hub', label: 'Trung tâm AM', href: '/crm/account-management', icon: 'customers' }],
      },
    ]);
    expect(collapsed[0]).toMatchObject({
      kind: 'leaf',
      id: 'am',
      href: '/crm/account-management',
      label: 'Account Management',
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd services/ops-web && npx vitest run src/components/ops-nav-tree.spec.ts
```

- [ ] **Step 3: Implement `buildNavTree`**

Port gates from `OpsNav.tsx` `buildSections` (lines ~369–818) into parent buckets per spec §4:

| `id` | label |
|------|--------|
| `overview` | Tổng quan |
| `sales` | Bán hàng |
| `crm` | CRM |
| `csd` | Service Desk |
| `am` | Account Management |
| `agency` | Agency |
| `ads` | Quảng cáo |
| `seo` | SEO / AEO |
| `email` | Email Marketing |
| `production` | Sản xuất |
| `plan` | Kế hoạch |
| `kpi` | KPI Hub |
| `hr` | Nhân sự |
| `finance` | Tài chính |
| `ceo` | CEO |
| `iwr` | Báo cáo nội bộ |
| `automation` | Tự động hóa |
| `admin` | Admin |

Map leftover old sections (Chuẩn bị, Revenue Ops, orders, delivery-projects…) into `sales` or `crm` as spec §4.19 — **do not drop hrefs**.

End of function: `return collapseThinParents(items.filter(...non-empty))`.

Helper for pushing children only when cap/flag allows (same conditions as today).

- [ ] **Step 4: Add href coverage test**

```ts
it('keeps critical hrefs reachable for super-like user', () => {
  const hrefs = collectHrefs(buildNavTree(superUser(), { imageSopEnabled: true }));
  for (const h of [
    '/',
    '/crm/b2b/leads',
    '/crm/csd/chat',
    '/crm/account-management',
    '/agency',
    '/seo/hub',
    '/email/hub',
    '/crm/content-os',
    '/crm/kpi-hub',
    '/crm/ceo',
    '/crm/internal-reports',
  ]) {
    expect(hrefs).toContain(h);
  }
});
```

Enable flags in test via `process.env.NEXT_PUBLIC_*` like existing specs.

- [ ] **Step 5: Run — expect PASS**

```bash
cd services/ops-web && npx vitest run src/components/ops-nav-tree.spec.ts src/components/ops-nav-accordion.spec.ts
```

- [ ] **Step 6: Commit**

```bash
git add services/ops-web/src/components/ops-nav-tree.ts \
  services/ops-web/src/components/ops-nav-tree.spec.ts
git commit -m "feat(ops-nav): buildNavTree IA per sidebar accordion spec"
```

---

### Task 3: Icons + short labels for new parent ids

**Files:**
- Modify: `services/ops-web/src/components/layout/nav-icons.tsx`

**Interfaces:**
- Consumes: parent `id` / label strings from Task 2
- Produces: `sectionIcon(labelOrId)` and `sectionShortLabel` work for new names; `iconForHref` unchanged for children

- [ ] **Step 1: Extend `sectionIcon` / `sectionShortLabel` maps**

Map both Vietnamese labels and ids:

```ts
// examples
'Tổng quan' | 'overview' → home
'Bán hàng' | 'sales' → sales
'CRM' | 'crm' → board
'Service Desk' | 'csd' → ticket
'Account Management' | 'am' → customers
'Agency' | 'agency' → hub
'Quảng cáo' | 'ads' → ads (or existing meta glyph)
'SEO / AEO' | 'seo' → existing seo
'Email Marketing' | 'email' → mail
'Sản xuất' | 'production' → creative
'Kế hoạch' | 'plan' → research
'KPI Hub' | 'kpi' → chart
'Nhân sự' | 'hr' → staff
'Tài chính' | 'finance' → money
'CEO' | 'ceo' → ceo
'Báo cáo nội bộ' | 'iwr' → report
'Tự động hóa' | 'automation' → automation
'Admin' | 'admin' → settings
```

Add any missing `GLYPHS` keys if referenced.

- [ ] **Step 2: Smoke via vitest if there is an existing nav-icons test; else skip**

```bash
cd services/ops-web && npx vitest run src/components/layout/nav-icons 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/components/layout/nav-icons.tsx
git commit -m "feat(ops-nav): icons and short labels for accordion parents"
```

---

### Task 4: CSS — group highlight + smooth expand

**Files:**
- Modify: `services/ops-web/src/app/globals.css` (ops-nav section ~250–360 and ~7767–7870)

- [ ] **Step 1: Replace collapse display:none with animated grid**

```css
.ops-nav-group {
  border-radius: 12px;
  padding: 0.15rem;
  transition: background 0.2s ease, box-shadow 0.2s ease;
}

.ops-nav-group.is-open,
.ops-nav-group.has-active {
  background: color-mix(in srgb, var(--primary-700) 8%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-700) 18%, transparent);
}

.ops-nav-group-panel {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.22s ease;
}

.ops-nav-group.is-open .ops-nav-group-panel {
  grid-template-rows: 1fr;
}

.ops-nav-group-panel-inner {
  overflow: hidden;
}

.ops-nav-group-links {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.15rem 0 0.35rem 0.15rem;
}

.ops-nav-link--child {
  padding-left: 0.85rem; /* indent like Bitrix children */
}

@media (prefers-reduced-motion: reduce) {
  .ops-nav-group-panel {
    transition: none;
  }
}
```

Remove or override `.ops-nav-group-links.is-collapsed { display: none }` so animation works.

Leaf item class: `.ops-nav-item--leaf` — single-row highlight when active, no group box unless active.

- [ ] **Step 2: Manual visual check note** (document in commit body): expand sidebar, open Service Desk, confirm block highlight + push-down.

- [ ] **Step 3: Commit**

```bash
git add services/ops-web/src/app/globals.css
git commit -m "style(ops-nav): accordion panel animation and group highlight"
```

---

### Task 5: Wire `OpsNav.tsx` to tree + accordion

**Files:**
- Modify: `services/ops-web/src/components/OpsNav.tsx`

**Interfaces:**
- Consumes: `buildNavTree`, accordion helpers, types
- Produces: same exported `OpsNav` component API (props unchanged)

- [ ] **Step 1: Replace `sections` useMemo**

```ts
const items = useMemo(
  () =>
    buildNavTree(sidebarUser, {
      emailPendingApprovals,
      agencyUnread,
      reviewQueueCount,
      csdChatUnread,
      imageSopEnabled,
    }),
  [sidebarUser, emailPendingApprovals, agencyUnread, reviewQueueCount, csdChatUnread, imageSopEnabled],
);
```

- [ ] **Step 2: State `openIds: string[]`**

- On mount: `readOpenIds()` or default `ensureActiveParentOpen([], items, pathname)`.
- On pathname change: `setOpenIds((prev) => ensureActiveParentOpen(prev, items, pathname))`.
- Toggle parent header:

```ts
function toggleParent(id: string) {
  setOpenIds((prev) => {
    const next = nextOpenIdsAfterToggle({ openIds: prev, toggledId: id, items, pathname });
    writeOpenIds(next);
    return next;
  });
}
```

Remove old `collapsedSections` + `NAV_SECTIONS_COLLAPSED_KEY` usage.

- [ ] **Step 3: Render expanded nav**

```tsx
{items.map((item) => {
  if (item.kind === 'leaf') {
    return (
      <button
        key={item.id}
        type="button"
        className={`ops-nav-link ops-nav-item--leaf${isActiveHref(pathname, item.href) ? ' is-active' : ''}`}
        onClick={() => navigateTo(item.href)}
      >
        <span className="ops-nav-link-icon"><NavIcon name={item.icon} /></span>
        <span>{item.label}</span>
        {item.badge ? <span className="ops-nav-badge">{item.badge}</span> : null}
      </button>
    );
  }
  const open = openIds.includes(item.id);
  const active = itemContainsPath(item, pathname);
  return (
    <div key={item.id} className={`ops-nav-group${open ? ' is-open' : ''}${active ? ' has-active' : ''}`}>
      <button type="button" className="ops-nav-group-header" aria-expanded={open} onClick={() => toggleParent(item.id)}>
        <span className="ops-nav-group-icon"><NavIcon name={item.icon} /></span>
        <span className="ops-nav-group-label">{item.label}</span>
        <span className="ops-nav-group-toggle" aria-hidden>▾</span>
      </button>
      <div className="ops-nav-group-panel">
        <div className="ops-nav-group-panel-inner">
          <div className="ops-nav-group-links">
            {item.children.map((child) => (
              <button
                key={child.href}
                type="button"
                className={`ops-nav-link ops-nav-link--child${isActiveHref(pathname, child.href) ? ' is-active' : ''}`}
                onClick={() => navigateTo(child.href)}
              >
                <span className="ops-nav-link-icon"><NavIcon name={child.icon} /></span>
                <span>{child.label}</span>
                {child.badge ? <span className="ops-nav-badge">{child.badge}</span> : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
})}
```

- [ ] **Step 4: Rail mode**

- Leaf rail button → `navigateTo(href)`.
- Parent rail button → set flyout to that parent id; flyout lists children (same as today).

- [ ] **Step 5: Delete dead `buildSections` / old NavSection types from file** (after tree covers all links).

- [ ] **Step 6: Run existing OpsNav-related vitests**

```bash
cd services/ops-web && npx vitest run src/components/OpsNav src/components/ops-nav
```

Expected: PASS (content-os / video / cp / image-sop helpers still pass; new tree/accordion pass).

- [ ] **Step 7: Commit**

```bash
git add services/ops-web/src/components/OpsNav.tsx
git commit -m "feat(ops-nav): wire accordion tree UI in OpsNav"
```

---

### Task 6: Badge CSS + final verification

**Files:**
- Modify: `services/ops-web/src/app/globals.css` (badge)
- Optionally: `docs/superpowers/specs/2026-09-16-ops-sidebar-accordion-design.md` status → Approved/Implemented

- [ ] **Step 1: Badge styles**

```css
.ops-nav-badge {
  margin-left: auto;
  min-width: 1.1rem;
  height: 1.1rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  background: #e11d48;
  color: #fff;
  font-size: 0.65rem;
  font-weight: 700;
  line-height: 1.1rem;
  text-align: center;
}
```

- [ ] **Step 2: Full test pass**

```bash
cd services/ops-web && npx vitest run src/components/ops-nav-tree.spec.ts src/components/ops-nav-accordion.spec.ts src/components/OpsNav.content-os.spec.ts src/components/OpsNav.video-sop.spec.ts src/components/OpsNav.cp.spec.ts src/components/OpsNav.image-sop.spec.ts
```

Expected: all PASS.

- [ ] **Step 3: Manual checklist (dev server)**

1. Login SUPER-ADMIN → sidebar shows ~12–15 top items.
2. `Tổng quan` / `CEO` = no chevron; click navigates.
3. Open `Service Desk` → children animate; other parents close except active.
4. Navigate to `/crm/csd/chat` → Service Desk stays open + group highlight.
5. Rail collapsed → parent flyout still works.
6. Unread chat badge visible on Chat nội bộ.

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/app/globals.css
git commit -m "feat(ops-nav): badge polish and accordion verification"
```

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| RNOSAI brand, no purple | Task 4–5 (CSS tokens) |
| Leaf vs parent / no chevron | Task 2 collapse + Task 5 render |
| ≤15-ish parents + VI labels + order | Task 2 |
| Hybrid accordion | Task 1 + 5 |
| Animate push-down | Task 4 |
| Group highlight | Task 4–5 |
| Badges | Task 5–6 |
| No orphan hrefs | Task 2 coverage test |
| `ops-nav-accordion-v2` | Task 1 |
| Rail / mobile | Task 5 |
| Icons | Task 3 |

**Placeholder scan:** none intentional.  
**Type consistency:** `NavItem` / `openIds: string[]` / `buildNavTree` / `nextOpenIdsAfterToggle` used consistently across tasks.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-09-16-ops-sidebar-accordion.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — same session, batch with checkpoints  

Which approach?

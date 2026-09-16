# RNOSAI UI Canopy (`@rnosai/ui`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `@rnosai/ui` Canopy primitives matching Lead B2B Sales visuals, wire them into ops-web, and migrate Wave 2 modules (CRM board, CSD tickets list, AM, Admin hub) without restyling CSD Chat or KPI Hub.

**Architecture:** New package `packages/rnosai-ui` owns tokens + `rn-*` React primitives. ops-web depends via `file:` and transpiles the package; `bitrix-theme.css` keeps sidebar/topbar shell. `PageToolbar` thin-wraps `PageHeader` so existing pages pick up Canopy chrome with minimal churn. Wave 2 pages swap local controls to `@rnosai/ui` where markup is light.

**Tech Stack:** React 18, Next.js 14 (ops-web), TypeScript, Vitest (`renderToStaticMarkup` / `createElement` — no Testing Library), CSS (`tokens.css` + `theme.css`).

**Spec SoT:** `docs/superpowers/specs/2026-09-16-rnosai-ui-canopy-design-system-design.md`

## Global Constraints

- Class prefix **`rn-`** only — do not overwrite `.btn` / `.card` / `.data-table` in Wave 0–2.
- Tokens verbatim: `--ptt #17692f`, `--ptt-deep #114d24`, `--forest #0d3a22`, `--cream/#f3efe6`, `--paper/#fffdf8`, `--surface-soft/#efeae0`, `--surface-column/#ebe6dc`, `--border/#d8d2c6`, `--text/#1c221d`, `--muted/#4a544c`.
- **Skip:** CSD Chat dock/bubble, KPI Hub embed — no restyle.
- Do not change routes, RBAC, or sidebar accordion IA.
- Prefer `file:../../packages/rnosai-ui` over root npm workspaces (deploy scripts `cd services/ops-web && npm install`).
- Tests: Vitest from ops-web; package specs as `*.spec.ts` using `react.createElement` + `renderToStaticMarkup` (ops-web vitest `include` is `*.spec.ts` only; environment `node`).
- No Storybook, Turbo, or Nx in this plan.
- No modal/drawer/toast in Wave 0–2.

## File map

| File | Responsibility |
|------|----------------|
| `packages/rnosai-ui/package.json` | Package name `@rnosai/ui`, peer React, `exports` |
| `packages/rnosai-ui/tsconfig.json` | Strict TS, `jsx: react-jsx`, declaration optional |
| `packages/rnosai-ui/src/tokens.css` | Canopy CSS variables on `:root` |
| `packages/rnosai-ui/src/theme.css` | Styles for all `rn-*` primitives |
| `packages/rnosai-ui/src/Button.tsx` | `Button` |
| `packages/rnosai-ui/src/Input.tsx` | `Input` |
| `packages/rnosai-ui/src/Select.tsx` | `Select` |
| `packages/rnosai-ui/src/Chip.tsx` | `Chip` |
| `packages/rnosai-ui/src/Card.tsx` | `Card` |
| `packages/rnosai-ui/src/Tabs.tsx` | `Tabs` |
| `packages/rnosai-ui/src/StatCard.tsx` | `StatCard` |
| `packages/rnosai-ui/src/Table.tsx` | `Table` wrapper |
| `packages/rnosai-ui/src/Breadcrumb.tsx` | Package `Breadcrumb` (independent of ops-web layout Breadcrumb) |
| `packages/rnosai-ui/src/PageHeader.tsx` | `PageHeader` |
| `packages/rnosai-ui/src/index.ts` | Barrel exports |
| `packages/rnosai-ui/src/*.spec.ts` | Smoke tests per primitive |
| `services/ops-web/package.json` | Add `"@rnosai/ui": "file:../../packages/rnosai-ui"` |
| `services/ops-web/next.config.mjs` | `transpilePackages: ['@rnosai/ui']` |
| `services/ops-web/vitest.config.ts` | Include package specs |
| `services/ops-web/src/app/layout.tsx` | Import `@rnosai/ui/theme.css` |
| `services/ops-web/src/components/layout/PageToolbar.tsx` | Wrap `PageHeader` |
| Wave 2 page files | Light TSX swaps (listed per task) |

---

### Task 1: Scaffold `@rnosai/ui` + tokens + Button (TDD)

**Files:**
- Create: `packages/rnosai-ui/package.json`
- Create: `packages/rnosai-ui/tsconfig.json`
- Create: `packages/rnosai-ui/src/tokens.css`
- Create: `packages/rnosai-ui/src/theme.css` (Button rules only for now; later tasks append)
- Create: `packages/rnosai-ui/src/Button.tsx`
- Create: `packages/rnosai-ui/src/index.ts`
- Create: `packages/rnosai-ui/src/Button.spec.ts`
- Modify: `services/ops-web/vitest.config.ts` (include package specs)

**Interfaces:**
- Produces:
  - Package `@rnosai/ui` with export `"."` → `./src/index.ts` and `"./theme.css"` → `./src/theme.css` (theme file `@import` tokens)
  - `Button` props: `React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md' }`
  - Default `variant='primary'`, `size='md'`
  - Class: `rn-btn rn-btn--{variant} rn-btn--{size}` plus `className`

- [ ] **Step 1: Write failing Button smoke test**

```ts
// packages/rnosai-ui/src/Button.spec.ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders primary md classes by default', () => {
    const html = renderToStaticMarkup(createElement(Button, null, 'Lưu'));
    expect(html).toContain('rn-btn');
    expect(html).toContain('rn-btn--primary');
    expect(html).toContain('rn-btn--md');
    expect(html).toContain('Lưu');
  });

  it('supports secondary + sm', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: 'secondary', size: 'sm' }, 'Huỷ'),
    );
    expect(html).toContain('rn-btn--secondary');
    expect(html).toContain('rn-btn--sm');
  });
});
```

- [ ] **Step 2: Point vitest at package specs and run (expect FAIL)**

Update `services/ops-web/vitest.config.ts`:

```ts
include: [
  'src/**/*.spec.ts',
  'src/**/*.test.ts',
  '../../packages/rnosai-ui/src/**/*.spec.ts',
],
```

Run:

```bash
cd services/ops-web && npx vitest run ../../packages/rnosai-ui/src/Button.spec.ts
```

Expected: FAIL (module not found / Button missing)

- [ ] **Step 3: Scaffold package + minimal Button**

`packages/rnosai-ui/package.json`:

```json
{
  "name": "@rnosai/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./theme.css": "./src/theme.css"
  },
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  }
}
```

`packages/rnosai-ui/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*"]
}
```

`packages/rnosai-ui/src/tokens.css` — set all Global Constraints tokens on `:root` (copy values from spec §3).

`packages/rnosai-ui/src/theme.css`:

```css
@import './tokens.css';

.rn-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border-radius: var(--radius-sm, 6px);
  min-height: 40px;
  padding: 0 1rem;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  background: var(--ptt);
  color: #fff;
}
.rn-btn--sm { min-height: 32px; padding: 0 0.75rem; font-size: 0.75rem; }
.rn-btn--md { min-height: 40px; }
.rn-btn--primary { background: var(--ptt); color: #fff; }
.rn-btn--primary:hover { background: var(--ptt-deep); }
.rn-btn--secondary {
  background: var(--paper);
  color: var(--text);
  border-color: var(--border);
}
.rn-btn--secondary:hover { background: var(--mist, #e7f0e8); border-color: var(--ptt); color: var(--forest); }
.rn-btn--ghost { background: transparent; color: var(--ptt); }
.rn-btn--ghost:hover { background: var(--mist, #e7f0e8); }
.rn-btn--danger {
  background: var(--paper);
  color: #b42318;
  border-color: #f0c4c0;
}
.rn-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.rn-btn:focus-visible { outline: 2px solid var(--ptt); outline-offset: 2px; }
```

Also define `--mist: #e7f0e8`, `--radius-sm/md/lg`, accent colors (`--hot`, `--sky`, `--iris`, `--cold`, `--won`) in `tokens.css`.

`Button.tsx` + `index.ts` export `Button`.

- [ ] **Step 4: Re-run test — PASS**

```bash
cd services/ops-web && npx vitest run ../../packages/rnosai-ui/src/Button.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/rnosai-ui services/ops-web/vitest.config.ts
git commit -m "feat(ui): scaffold @rnosai/ui with Canopy Button"
```

---

### Task 2: Wire package into ops-web (layout + Next transpile)

**Files:**
- Modify: `services/ops-web/package.json`
- Modify: `services/ops-web/next.config.mjs`
- Modify: `services/ops-web/src/app/layout.tsx`
- Create: `services/ops-web/src/lib/rnosai-ui-smoke.spec.ts` (optional import smoke)

**Interfaces:**
- Consumes: `@rnosai/ui` package from Task 1
- Produces: app can `import { Button } from '@rnosai/ui'` and loads `@rnosai/ui/theme.css`

- [ ] **Step 1: Write failing import smoke**

```ts
// services/ops-web/src/lib/rnosai-ui-smoke.spec.ts
import { describe, expect, it } from 'vitest';

describe('@rnosai/ui wiring', () => {
  it('resolves Button export', async () => {
    const mod = await import('@rnosai/ui');
    expect(typeof mod.Button).toBe('function');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (package not in deps)**

```bash
cd services/ops-web && npx vitest run src/lib/rnosai-ui-smoke.spec.ts
```

Expected: FAIL cannot find module `@rnosai/ui`

- [ ] **Step 3: Add dependency + transpile + CSS import**

In `services/ops-web/package.json` dependencies:

```json
"@rnosai/ui": "file:../../packages/rnosai-ui"
```

`next.config.mjs`:

```js
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  transpilePackages: ['@rnosai/ui'],
  // ...keep existing headers/redirects
};
```

`layout.tsx` — after bitrix-theme import:

```ts
import '@rnosai/ui/theme.css';
```

Run:

```bash
cd services/ops-web && npm install
```

- [ ] **Step 4: Re-run smoke — PASS**

```bash
cd services/ops-web && npx vitest run src/lib/rnosai-ui-smoke.spec.ts ../../packages/rnosai-ui/src/Button.spec.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/package.json services/ops-web/package-lock.json services/ops-web/next.config.mjs services/ops-web/src/app/layout.tsx services/ops-web/src/lib/rnosai-ui-smoke.spec.ts
git commit -m "feat(ops-web): wire @rnosai/ui package and theme CSS"
```

---

### Task 3: Input, Select, Chip, Card primitives (TDD)

**Files:**
- Create: `packages/rnosai-ui/src/Input.tsx`, `Select.tsx`, `Chip.tsx`, `Card.tsx`
- Create: `packages/rnosai-ui/src/field-card.spec.ts`
- Modify: `packages/rnosai-ui/src/theme.css` (append field/chip/card rules)
- Modify: `packages/rnosai-ui/src/index.ts`

**Interfaces:**
- Produces:
  - `Input`: `React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }` → `rn-input` + `rn-input--error` when error
  - `Select`: `React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }` → `rn-select` (+ error)
  - `Chip`: `React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }` → `rn-chip` + `rn-chip--active`
  - `Card`: `{ children: React.ReactNode; className?: string }` → `rn-card`

- [ ] **Step 1: Write failing tests**

```ts
// packages/rnosai-ui/src/field-card.spec.ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';
import { Chip } from './Chip';
import { Input } from './Input';
import { Select } from './Select';

describe('field + card primitives', () => {
  it('Input marks error', () => {
    const html = renderToStaticMarkup(createElement(Input, { error: true, 'aria-label': 'q' }));
    expect(html).toContain('rn-input');
    expect(html).toContain('rn-input--error');
  });

  it('Select marks error', () => {
    const html = renderToStaticMarkup(
      createElement(Select, { error: true, 'aria-label': 's' }, createElement('option', null, 'A')),
    );
    expect(html).toContain('rn-select--error');
  });

  it('Chip active', () => {
    const html = renderToStaticMarkup(createElement(Chip, { active: true }, 'Tất cả'));
    expect(html).toContain('rn-chip--active');
  });

  it('Card wraps children', () => {
    const html = renderToStaticMarkup(createElement(Card, null, 'body'));
    expect(html).toContain('rn-card');
    expect(html).toContain('body');
  });
});
```

- [ ] **Step 2: Run — FAIL**

```bash
cd services/ops-web && npx vitest run ../../packages/rnosai-ui/src/field-card.spec.ts
```

- [ ] **Step 3: Implement components + CSS**

Theme additions (match Lead B2B / bitrix field look):

```css
.rn-input, .rn-select {
  width: 100%;
  min-height: 40px;
  padding: 0 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 8px);
  background: var(--paper);
  color: var(--text);
  font-size: 0.875rem;
}
.rn-input--error, .rn-select--error { border-color: #e11d48; }
.rn-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--paper);
  color: var(--text);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
}
.rn-chip--active {
  background: var(--ptt);
  border-color: var(--ptt);
  color: #fff;
}
.rn-card {
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 8px);
  padding: 0.75rem 1rem;
}
```

Export all from `index.ts`.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/rnosai-ui
git commit -m "feat(ui): add Input Select Chip Card primitives"
```

---

### Task 4: Tabs, StatCard, Table primitives (TDD)

**Files:**
- Create: `packages/rnosai-ui/src/Tabs.tsx`, `StatCard.tsx`, `Table.tsx`
- Create: `packages/rnosai-ui/src/tabs-stat-table.spec.ts`
- Modify: `theme.css`, `index.ts`

**Interfaces:**
- Produces:
  - `Tabs`: `{ items: { id: string; label: string }[]; value: string; onChange: (id: string) => void; className?: string }`
    - Root `rn-tabs`; tab button `rn-tabs__tab` + `rn-tabs__tab--active`
  - `StatCard`: `{ value: React.ReactNode; label: React.ReactNode; accent?: 'hot' | 'sky' | 'iris' | 'cold' | 'won' | 'warm'; className?: string }`
    - `rn-stat-card rn-stat-card--{accent}` (default `cold`)
  - `Table`: `{ children: React.ReactNode; className?: string }` wraps `<table className="rn-table">` — children must be valid table content (`thead`/`tbody`)

- [ ] **Step 1: Write failing tests**

```ts
// packages/rnosai-ui/src/tabs-stat-table.spec.ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StatCard } from './StatCard';
import { Table } from './Table';
import { Tabs } from './Tabs';

describe('Tabs StatCard Table', () => {
  it('Tabs marks active item', () => {
    const html = renderToStaticMarkup(
      createElement(Tabs, {
        items: [
          { id: 'kanban', label: 'Kanban' },
          { id: 'list', label: 'Danh sách' },
        ],
        value: 'list',
        onChange: vi.fn(),
      }),
    );
    expect(html).toContain('rn-tabs');
    expect(html).toContain('rn-tabs__tab--active');
    expect(html).toContain('Danh sách');
  });

  it('StatCard accent class', () => {
    const html = renderToStaticMarkup(
      createElement(StatCard, { value: '3', label: 'Nóng', accent: 'hot' }),
    );
    expect(html).toContain('rn-stat-card--hot');
    expect(html).toContain('3');
  });

  it('Table sets rn-table', () => {
    const html = renderToStaticMarkup(
      createElement(
        Table,
        null,
        createElement('thead', null, createElement('tr', null, createElement('th', null, 'ID'))),
      ),
    );
    expect(html).toContain('rn-table');
    expect(html).toContain('ID');
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement + CSS**

```css
.rn-tabs {
  display: flex;
  gap: 0.25rem;
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 8px);
  padding: 0.25rem;
}
.rn-tabs__tab {
  border: 0;
  background: transparent;
  min-height: 36px;
  padding: 0 0.9rem;
  font-weight: 600;
  color: var(--muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  border-radius: var(--radius-sm, 6px);
}
.rn-tabs__tab--active {
  color: var(--ptt);
  border-bottom-color: var(--ptt);
  background: var(--paper);
}
.rn-stat-card {
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: var(--radius-md, 8px);
  border-top-width: 3px;
  padding: 0.85rem 1rem;
  text-align: center;
}
.rn-stat-card__value { font-size: 1.5rem; font-weight: 700; color: var(--text); }
.rn-stat-card__label { margin-top: 0.25rem; font-size: 0.8125rem; color: var(--muted); }
.rn-stat-card--hot { border-top-color: var(--hot); }
.rn-stat-card--sky { border-top-color: var(--sky); }
.rn-stat-card--iris { border-top-color: var(--iris); }
.rn-stat-card--cold { border-top-color: var(--cold); }
.rn-stat-card--won { border-top-color: var(--won); }
.rn-stat-card--warm { border-top-color: var(--warm, #ea580c); }
.rn-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--paper);
}
.rn-table thead th {
  background: var(--surface-column);
  text-align: left;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border);
  color: var(--text);
}
.rn-table tbody td {
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.875rem;
}
.rn-table tbody tr:hover { background: var(--mist, #e7f0e8); }
```

`Tabs` must set `type="button"` and `aria-selected` on active tab.

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add packages/rnosai-ui
git commit -m "feat(ui): add Tabs StatCard Table primitives"
```

---

### Task 5: PageHeader + Breadcrumb; PageToolbar wraps PageHeader

**Files:**
- Create: `packages/rnosai-ui/src/Breadcrumb.tsx`, `PageHeader.tsx`
- Create: `packages/rnosai-ui/src/page-header.spec.ts`
- Modify: `theme.css`, `index.ts`
- Modify: `services/ops-web/src/components/layout/PageToolbar.tsx`

**Interfaces:**
- Produces:
  - `BreadcrumbItem = { label: string; href?: string }`
  - `Breadcrumb({ items: BreadcrumbItem[] })` → `rn-breadcrumb` (links are `<a href>` — no next/link inside package)
  - `PageHeader({ title: string; subtitle?: string; breadcrumb?: BreadcrumbItem[]; actions?: React.ReactNode; className?: string })` → `rn-page-header`
- Consumes: package components from prior tasks
- Side effect: all ops-web `PageToolbar` call sites get Canopy header chrome

- [ ] **Step 1: Write failing tests**

```ts
// packages/rnosai-ui/src/page-header.spec.ts
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Breadcrumb } from './Breadcrumb';
import { PageHeader } from './PageHeader';

describe('PageHeader + Breadcrumb', () => {
  it('Breadcrumb renders separators and link', () => {
    const html = renderToStaticMarkup(
      createElement(Breadcrumb, {
        items: [
          { label: 'CRM', href: '/crm' },
          { label: 'Tickets' },
        ],
      }),
    );
    expect(html).toContain('rn-breadcrumb');
    expect(html).toContain('href="/crm"');
    expect(html).toContain('Tickets');
  });

  it('PageHeader renders title and actions slot', () => {
    const html = renderToStaticMarkup(
      createElement(PageHeader, {
        title: 'Ticket',
        subtitle: 'CSD',
        actions: createElement('button', { type: 'button' }, 'Tạo'),
      }),
    );
    expect(html).toContain('rn-page-header');
    expect(html).toContain('Ticket');
    expect(html).toContain('CSD');
    expect(html).toContain('Tạo');
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement + wrap PageToolbar**

CSS:

```css
.rn-breadcrumb { font-size: 0.75rem; color: var(--muted); margin-bottom: 0.5rem; }
.rn-breadcrumb__sep { margin: 0 0.35rem; opacity: 0.7; }
.rn-breadcrumb a { color: var(--muted); text-decoration: none; }
.rn-breadcrumb a:hover { color: var(--ptt); }
.rn-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.85rem;
}
.rn-page-header__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--forest);
}
.rn-page-header__subtitle { margin: 0.25rem 0 0; color: var(--muted); font-size: 0.875rem; }
.rn-page-header__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
```

`PageToolbar.tsx`:

```tsx
import type { ReactNode } from 'react';
import { PageHeader } from '@rnosai/ui';

type PageToolbarProps = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function PageToolbar({ title, subtitle, actions }: PageToolbarProps) {
  return <PageHeader title={title} subtitle={subtitle} actions={actions} />;
}
```

Keep exporting `PageToolbar` from layout barrel unchanged.

- [ ] **Step 4: Run package tests + ops-web unit subset**

```bash
cd services/ops-web && npx vitest run ../../packages/rnosai-ui/src
```

Expected: all package specs PASS

- [ ] **Step 5: Commit**

```bash
git add packages/rnosai-ui services/ops-web/src/components/layout/PageToolbar.tsx
git commit -m "feat(ui): PageHeader/Breadcrumb; PageToolbar uses Canopy header"
```

---

### Task 6: Wave 2 sample — CSD tickets list uses Button + Table

**Files:**
- Modify: `services/ops-web/src/app/crm/csd/tickets/page.tsx`
- Do **not** modify any `csd/chat/**` or chat dock components

**Interfaces:**
- Consumes: `Button`, `Table` (and existing `PageToolbar`) from `@rnosai/ui` / layout
- Produces: list page primary/secondary actions use `rn-btn`; main data table wrapped with `Table` if markup is a plain `<table>`

- [ ] **Step 1: Audit current markup**

Open `tickets/page.tsx`. Note every `className="btn..."` and any `<table` / `data-table`.

- [ ] **Step 2: Write a tiny regression assertion (optional inline smoke)**

If the page exports nothing testable, skip automated test; use manual checklist in Step 4.

- [ ] **Step 3: Swap controls**

Example pattern (adjust to real JSX):

```tsx
import { Button, Table } from '@rnosai/ui';

// replace:
// <button type="button" className="btn btn-sm btn-secondary" ...>
<Button type="button" variant="secondary" size="sm" onClick={() => void reload()}>
  Làm mới
</Button>

// replace primary submit similarly with variant="primary"
// wrap table:
<Table>{/* existing thead/tbody */}</Table>
```

If the table already uses `table.data-table` and wrapping would break CSS, keep `data-table` and only swap buttons — document that choice in the commit message.

- [ ] **Step 4: Manual checklist**

With `npm run dev` in ops-web, open `/crm/csd/tickets`:

- [ ] Page bg cream (shell)
- [ ] Header title via PageHeader/Canopy
- [ ] Buttons match Lead B2B green/be
- [ ] Chat dock still unchanged if opened

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/app/crm/csd/tickets/page.tsx
git commit -m "feat(csd): use @rnosai/ui controls on tickets list"
```

---

### Task 7: Wave 2 — CRM board (`/crm`) light migrate

**Files:**
- Modify: `services/ops-web/src/app/crm/page.tsx` (and any board-only child it renders inline)
- Skip KPI hub routes under `crm/kpi-hub/**`

**Interfaces:**
- Consumes: `Button`, `Card`, `StatCard` as applicable
- Produces: board module cards / CTA buttons use `rn-*` where currently generic `btn`/`card`

- [ ] **Step 1: Audit `/crm` page for `btn`, `card`, stat tiles**

- [ ] **Step 2: Replace obvious CTAs with `Button`; module tiles with `Card` or `StatCard` if they are simple metric tiles**

Do not rewrite data-fetch logic. Prefer wrapping/class swaps over restructuring layout.

- [ ] **Step 3: Manual check `/crm`**

- [ ] Cream page + green CTAs
- [ ] No change to KPI Hub when navigating there

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/app/crm/page.tsx
git commit -m "feat(crm): adopt @rnosai/ui on CRM board"
```

---

### Task 8: Wave 2 — Account Management shell bridge

**Files:**
- Modify: `services/ops-web/src/app/crm/account-management/am.css` (map key AM surfaces to Canopy tokens / `rn-*` coexistence)
- Modify: at most 1–2 high-traffic AM shells that use raw `btn` (identify via `rg 'className=.btn' src/app/crm/account-management src/components/crm/am`)

**Interfaces:**
- Consumes: tokens already on `:root` from `@rnosai/ui/theme.css`
- Produces: AM pages inherit cream/paper/ptt without rewriting every AM component

- [ ] **Step 1: List AM btn/card hotspots**

```bash
cd services/ops-web && rg -n "className=.[^\"]*btn|am-" src/app/crm/account-management src/components/crm/am --glob '*.tsx' | head -40
```

- [ ] **Step 2: In `am.css`, reassign AM CSS variables to Canopy tokens where AM defines its own greens/greys**

Example pattern (only if AM defines overrides):

```css
.am-shell {
  --am-primary: var(--ptt);
  --am-bg: var(--cream);
  --am-surface: var(--paper);
  --am-border: var(--border);
}
```

- [ ] **Step 3: Swap 2–3 primary action buttons on the main AM landing/list to `<Button>`**

- [ ] **Step 4: Manual check `/crm/account-management` (or primary AM route)**

- [ ] **Step 5: Commit**

```bash
git add services/ops-web/src/app/crm/account-management services/ops-web/src/components/crm/am
git commit -m "feat(am): bridge AM shell to Canopy tokens and Button"
```

---

### Task 9: Wave 2 — Admin hub surfaces

**Files:**
- Identify admin hub entry (e.g. `services/ops-web/src/app/crm/admin/**` or agency/admin shell using `PageToolbar`)
- Modify: admin hub landing + one list page that still uses raw `btn`

**Interfaces:**
- Consumes: `Button`, `PageToolbar` (already Canopy), optionally `Card`/`Tabs`

- [ ] **Step 1: Find admin hub page(s)**

```bash
cd services/ops-web && rg -n "PageToolbar|AdminHub|admin" src/app/crm/admin src/components/admin --glob '*.tsx' | head -40
```

- [ ] **Step 2: Replace primary/secondary buttons with `Button`; use `Tabs` or `Chip` only if hub already has equivalent filter UI**

- [ ] **Step 3: Manual check admin hub**

- [ ] **Step 4: Commit**

```bash
git add services/ops-web/src/app/crm/admin services/ops-web/src/components/admin
git commit -m "feat(admin): adopt @rnosai/ui on admin hub surfaces"
```

---

### Task 10: Spec status + Wave 3 backlog note

**Files:**
- Modify: `docs/superpowers/specs/2026-09-16-rnosai-ui-canopy-design-system-design.md` (Status → Implemented Wave 0–2 locally)
- Create or append: short Wave 3 backlog list at bottom of spec (remaining modules — no implementation)

- [ ] **Step 1: Update Status line** to `Implemented Wave 0–2 locally — Wave 3 backlog`

- [ ] **Step 2: Append §11 Wave 3 backlog** with concrete leftover clusters (SEO, Meta, Creative OS, RevOps, Zalo, etc.) — list only, no code

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-16-rnosai-ui-canopy-design-system-design.md
git commit -m "docs(ui): mark Canopy Wave 0-2 done; note Wave 3 backlog"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Package `packages/rnosai-ui` + tokens/theme | 1 |
| Wire ops-web + layout CSS + transpile | 2 |
| Primitives §5 (Button…Table, PageHeader, Breadcrumb) | 1, 3, 4, 5 |
| PageToolbar wrap | 5 |
| Wave 2: CSD tickets (not chat) | 6 |
| Wave 2: CRM board | 7 |
| Wave 2: AM | 8 |
| Wave 2: Admin hub | 9 |
| Skip Chat + KPI Hub | Explicit in Tasks 6–7 |
| Wave 3 backlog only | 10 |
| Vitest smoke | 1–5 |
| No full globals rewrite / no shell move | Constraints + File map |

No TBD placeholders remain. Types are consistent (`variant`/`size`/`accent`/`BreadcrumbItem`) across tasks.

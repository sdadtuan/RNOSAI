# Spec — RNOSAI UI Canopy design system (`@rnosai/ui`)

> **Document ID:** RNOSAI-UI-20260916  
> **Version:** 1.0 · **Date:** 2026-09-16  
> **Status:** Implemented Wave 0–2 locally — Wave 3 backlog  
> **App:** `packages/rnosai-ui` (mới) + consumer `services/ops-web`  
> **Visual SoT:** Lead B2B Sales (ops-web) — cream page, PTT green controls, tab underline, be table header, colored-top stat cards  
> **Related:** `services/ops-web/src/app/bitrix-theme.css` (Canopy tokens / shell), `docs/superpowers/specs/2026-09-16-ops-sidebar-accordion-design.md`

---

## 1. Mục tiêu

Đưa **toàn bộ module ops-web** (trừ ngoại lệ) về cùng hệ visual với Lead B2B Sales bằng **design system React** `@rnosai/ui`, không copy CSS từng trang.

**Không đổi:** route URL, RBAC/caps, API contracts, sidebar accordion IA đã ship.

**Không làm trong spec này:** dark mode; Bitrix purple; rewrite `globals.css` toàn bộ; portal-web / mobile-shell (có thể consume sau).

---

## 2. Quyết định đã chốt

| # | Quyết định | Chọn |
|---|------------|------|
| 1 | Phạm vi rollout | **B** — primitives dùng chung + audit/sửa top module lệch |
| 2 | Ngoại lệ không ép | **A** — CSD Chat (dock/bubble) + KPI Hub embed |
| 3 | Mức đụng TSX | **B** — CSS trong package + sửa TSX nhẹ khi class lệch |
| 4 | Hướng kỹ thuật | **2** — package design system `@rnosai/ui` (không chỉ overlay CSS) |

---

## 3. Visual tokens (Canopy)

Nguồn: Lead B2B + `bitrix-theme.css` hiện có. Package sở hữu `tokens.css`; ops-web shell tiếp tục map tương đương vào `html.ops-shell-bitrix` để sidebar/topbar không lệch.

| Token | Giá trị | Dùng cho |
|-------|---------|----------|
| `--ptt` | `#17692f` | Primary button, active tab underline, links |
| `--ptt-deep` | `#114d24` | Primary hover |
| `--forest` | `#0d3a22` | Strong text / focus accents |
| `--cream` / `--page-bg` | `#f3efe6` | Page background |
| `--paper` / `--surface` | `#fffdf8` | Cards, inputs, panels |
| `--surface-soft` | `#efeae0` | Tab bar / filter strip |
| `--surface-column` | `#ebe6dc` | Table header |
| `--border` | `#d8d2c6` | Borders |
| `--text` | `#1c221d` | Body |
| `--muted` | `#4a544c` | Breadcrumb / secondary |
| `--hot` / `--sky` / `--iris` / `--cold` | existing Bitrix accents | `StatCard` top border |
| `--radius-sm/md/lg` | `6` / `8` / `10` px | Controls / cards |
| `--shadow-green-sm/md` | existing | Optional elevation (mặc định flat như B2B) |

Typography: sans hiện có của ops-web (không đổi font stack toàn hệ trong Wave 0–2).

---

## 4. Kiến trúc package

### 4.1. Vị trí

```
packages/rnosai-ui/
  package.json          # name: @rnosai/ui
  src/
    tokens.css
    theme.css           # styles for rn-* primitives
    index.ts            # barrel exports
    Button.tsx
    Input.tsx
    Select.tsx
    Tabs.tsx
    Chip.tsx
    Card.tsx
    StatCard.tsx
    Table.tsx
    PageHeader.tsx
    Breadcrumb.tsx
  tsconfig.json
```

Root repo: npm workspaces gồm `packages/*` và `services/ops-web`.  
`ops-web` depends on `"@rnosai/ui": "workspace:*"` (hoặc `file:` tương đương nếu workspace root chưa sẵn).

### 4.2. Ranh giới

**Trong package:** UI thuần (markup + CSS + a11y props).  
**Ngoài package:** data fetching, RBAC, domain hooks, sidebar/topbar shell.

### 4.3. CSS strategy

- Class prefix **`rn-`** (`rn-btn`, `rn-tabs`, `rn-table`, …) — không ghi đè `.btn` / `.card` cũ.
- Import theme **một lần** trong ops-web root layout (cạnh `bitrix-theme.css`).
- `bitrix-theme.css` **giữ** cho sidebar, topbar, shell chrome; không chuyển shell vào `@rnosai/ui` trong Wave 0–2.

### 4.4. Build

- Wave 0: xuất TypeScript source + CSS; Next.js transpile package (`transpilePackages: ['@rnosai/ui']`).
- Không bắt buộc Storybook trong Wave 0; smoke vitest đủ.

---

## 5. Component API

| Component | Props chính | Visual map (Lead B2B) |
|-----------|-------------|------------------------|
| `Button` | `variant`: `primary` \| `secondary` \| `ghost` \| `danger`; `size`: `sm` \| `md`; native button attrs | Nút xanh / be / ghost |
| `Input` | standard input attrs + `error?: boolean` | Field bo góc, border cream |
| `Select` | standard select attrs + `error?: boolean` | Cùng field language |
| `Tabs` | `items: { id, label }[]`; `value`; `onChange` | Bar be + underline xanh khi active |
| `Chip` | `active?: boolean`; button attrs | Filter pill |
| `Card` | `children`; `className?` | Paper + border |
| `StatCard` | `value`; `label`; `accent`: `hot` \| `sky` \| `iris` \| `cold` \| `won` \| … | Card số + viền trên màu |
| `Table` | slot/`children` cho `<table>` hoặc wrapper quanh `thead`/`tbody` | Header be, row hover mist |
| `PageHeader` | `title`; `subtitle?`; `breadcrumb?`; `actions?` | Toolbar title + actions |
| `Breadcrumb` | `items: { label; href? }[]` | `CRM > …` muted |

**Compat:** `PageToolbar` hiện có có thể thin-wrap `PageHeader` trong Wave 1 (cùng class ngoài hoặc chuyển sang `rn-page-header`) để ít churn.

**Không** ship modal/drawer/toast trong Wave 0–2 trừ khi Wave 2 bắt buộc — YAGNI.

---

## 6. Đợt migrate (ops-web)

| Wave | Việc | Done khi |
|------|------|----------|
| **0** | Scaffold package, tokens, theme, barrel; wire workspace + import CSS; vitest smoke Button/Tabs | Build ops-web xanh; import `@rnosai/ui` OK |
| **1** | Implement đủ primitives mục §5; migrate layout helpers (`PageToolbar` → `PageHeader` hoặc wrap); 1 trang mẫu đã “đúng Canopy” (Lead B2B hoặc CRM list) dùng package | Trang mẫu không regress; primitives có test |
| **2** | Audit + migrate module lệch rõ: CRM board, leads/list surfaces, CSD **list/ticket** (không chat), Account Management, Admin hub | Các màn Wave 2 cùng hệ màu/spacing/control với Lead B2B |
| **3** | Backlog còn lại trong ops-web; dọn CSS trùng trên màn đã migrate (tuỳ chọn) | Backlog triệt tiêu hoặc ticket riêng |

**Skip vĩnh viễn (trong scope spec này):** CSD Chat dock/bubble; KPI Hub embed.

**Thứ tự Wave 2 gợi ý:** CRM board → CSD tickets list → AM → Admin hub → leads surfaces còn lệch.

---

## 7. Tương thích & rủi ro

| Rủi ro | Giảm thiểu |
|--------|------------|
| Double-style nếu quên import theme | Import 1 lần ở root layout; checklist Wave 0 |
| Monorepo chưa có workspace | Thêm config tối thiểu (npm workspaces); tránh Turbo/Nx |
| Trang cũ `.btn` lẫn `rn-btn` | Song song có chủ đích; không xóa globals ồ ạt |
| Shell Bitrix lệch | Không đụng accordion/sidebar trong package waves |
| Scope phình | Wave 2 giới hạn 4–5 cụm module; Wave 3 backlog |

---

## 8. Test & deploy

**Test**
- Vitest: render smoke mỗi primitive (variant/size tối thiểu).
- Manual: checklist so screenshot Lead B2B (bg cream, primary green, tab underline, table header be, stat accent).
- E2E: không bắt buộc Wave 0–1; Wave 2 thêm smoke route nếu đã có Playwright cho module đó.

**Deploy**
- Package bundle vào Next build ops-web (không service riêng).
- Wave 0+1: một PR scaffold; Wave 2: PR theo cụm module.

---

## 9. Out of scope (nhắc lại)

- portal-web / mobile-shell migrate (chỉ cần peer API ổn định).
- Thay thế toàn bộ `bitrix-theme.css` shell.
- Pixel-perfect mọi trang trong một PR.
- Đổi IA sidebar hoặc RBAC.

---

## 10. Success criteria

1. `@rnosai/ui` tồn tại, build được cùng ops-web.  
2. Wave 2 modules nhìn cùng hệ Canopy với Lead B2B (tokens + controls).  
3. CSD Chat + KPI Hub không bị ép restyle.  
4. Sidebar/topbar Bitrix không regress.

---

## 11. Wave 3 backlog (chưa làm)

Các cụm còn lại trong ops-web — ticket riêng, không nằm Wave 0–2:

- SEO / Meta / Zalo channel hubs  
- Creative OS / Content OS / Media OS  
- RevOps / Revenue Ops shells  
- Lead B2B deep surfaces chưa dùng `@rnosai/ui` (nếu còn class ad-hoc)  
- Agency hub pages ngoài shell đã Canopy qua `PageToolbar`  
- Dọn CSS trùng trên màn đã migrate (tuỳ chọn)

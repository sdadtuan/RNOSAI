# Task 19 Report — Media OS chrome and empty routes

**Branch:** `feat/msos-w1-win`  
**Commit message:** `feat(msos): Media OS chrome and empty routes`

## Summary

Implemented Media OS frontend chrome: 8-route hub at `/crm/media-os` with shell sidebar, design tokens, empty-state copy, denylist guard, and nav/RBAC wiring. All screens render `MsosEmpty` until Task 20 binds live APIs.

## Created

| File | Purpose |
|---|---|
| `src/lib/crm/msos-nav.ts` | `MSOS_NAV` (8 items) + ref links + active-route helpers |
| `src/lib/crm/msos-empty.ts` | `MSOS_EMPTY` copy + `MSOS_UI_DENYLIST` |
| `src/lib/crm/msos-empty.spec.ts` | Denylist scan on empty copy |
| `src/lib/crm/msos-api.ts` | `msosFetch(token, path, init)` → `/api/crm/media-os` |
| `src/styles/msos.css` | Mockup tokens (`--nav`, `--blue`, …); **no `.winbar`** |
| `src/components/media-os/MsosShell.tsx` | 258px sidebar, 8 nav, CRM/Creative/Finance ref links, help box |
| `src/components/media-os/MsosEmpty.tsx` | Empty card component |
| `src/components/media-os/MsosSpine.tsx` | Workflow chips + §4 lock chips |
| `src/components/ops-nav-media-os.ts` | `shouldShowMediaOsNav` |
| `src/app/crm/media-os/layout.tsx` | Shell + CSS import |
| `src/app/crm/media-os/page.tsx` | Command Center (empty) |
| `src/app/crm/media-os/inventory/page.tsx` | Inventory & Rate (empty) |
| `src/app/crm/media-os/packages/page.tsx` | Packages (empty) |
| `src/app/crm/media-os/campaigns/page.tsx` | Campaigns (empty) |
| `src/app/crm/media-os/evidence/page.tsx` | Evidence (empty) |
| `src/app/crm/media-os/outcomes/page.tsx` | Outcomes (empty) |
| `src/app/crm/media-os/margin/page.tsx` | Margin & Deal (empty) |
| `src/app/crm/media-os/settings/page.tsx` | Governance (empty) |

## Modified

| File | Change |
|---|---|
| `OpsNav.tsx` | "Media OS" link when `shouldShowMediaOsNav` |
| `delivery-module-nav.ts` | Same delivery-module link |
| `rbac-routes.ts` | `/crm/media-os` cap rule (`crm_media` view/write/publish/admin) |

## Patterns

- Shell/auth mirrors `CmktEShell`: `canViewMediaOs`, flag gate via `isMediaOsFeEnabled()`, flag-off copy **"Media OS chưa bật"**
- Nav visibility: `isMediaOsFeEnabled() && canViewMediaOs(user)`
- Prod UI: label **Media OS** only; no WIN ribbon; no demo dataset strings in copy or components

## Verification

```bash
cd services/ops-web && npx vitest run src/lib/crm/msos-empty.spec.ts
```

**Result:** 1 test passed (denylist scan clean).

## Next (Task 20)

Replace empty pages with `MsosCommand`, `MsosInventory`, … bound to `msosFetch` list APIs; add `msos-gates-ui.ts` and screen-level denylist spec.

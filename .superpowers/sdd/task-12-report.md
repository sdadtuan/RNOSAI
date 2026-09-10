# Task 12 Report: Approval Center + Publication + Library/Intelligence/Settings

**Date:** 2026-09-10  
**Branch:** `feat/cmkte-e0`  
**Commit:** *(filled after commit)*  
**Status:** DONE

## What was implemented

Five COS screens under `/crm/content-os/{approvals,calendar,library,intelligence,settings}` with matching `CmktE*` components. Review opens workspace tab 7 via `?tab=approvaltab`.

| Surface | Behavior |
|---|---|
| Approvals | `GET portfolio/approvals`. Empty Vietnamese, no seed. Review → `/crm/content-os/w/{id}?tab=approvaltab`. Escalate / Open portal use spec toasts. Approve/reject reuse lifecycle APIs when lifecycle+item exist; reject ≥ 10 chars |
| Calendar | `GET portfolio/publications`. Empty when no slots. Gate Blocked row hides “Vào queue” |
| Library | Brand Kit deep link `/crm/creative-os/brand-kits` only if `canOpenCreativeOsBrandKit` (`crm_cp.view`). Assets from last item media. No DAM clone |
| Intelligence | Draft + warning `Copilot không dùng`. Approve insight disabled. Summary only when `?lifecycle=` is scoped. No hardcoded CTR |
| Settings | Display-only `approval_required` / `client_gate` from `GET context` or `—`. Connector switch off + disabled. Save does not persist |

## TDD Evidence

### RED — brand kit helper missing

```
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/auth.spec.ts src/lib/crm/cmkte-brand-kit.spec.ts

FAIL  src/lib/crm/cmkte-brand-kit.spec.ts
Error: Cannot find module './cmkte-brand-kit'
```

`auth.spec.ts` already passed (prefix `/crm/content-os` covers `/approvals`).

### GREEN

```
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/auth.spec.ts src/lib/crm/cmkte-brand-kit.spec.ts

✓ src/lib/crm/cmkte-brand-kit.spec.ts (2 tests)
✓ src/lib/auth.spec.ts (24 tests)
```

Also green: approvals / publications / tabs / workspace / api specs (50 tests / 7 files).

## Files

- Create: `approvals/calendar/library/intelligence/settings/page.tsx`
- Create: `CmktEApprovals.tsx` `CmktECalendar.tsx` `CmktELibrary.tsx` `CmktEIntelligence.tsx` `CmktESettings.tsx`
- Create: `cmkte-brand-kit.ts` + spec, `cmkte-approvals.ts` + spec, `cmkte-publications.ts` + spec, `use-cmkte-page.ts`
- Modify: `auth.spec.ts`, `cmkte-api.ts` + spec, `cmkte-tabs.ts` + spec, `cmkte-workspace.ts` + spec, workspace page (`?tab=`), `content-os-api.ts` (`/intelligence/summary`), `cmkte.css`

## Concerns

- Intelligence and Settings call per-lifecycle APIs only when `?lifecycle=` is present; otherwise empty / `—` (no invented scoped lifecycle list).
- Library assets come from `cmkte-last-item` media only; no portfolio DAM listing.
- Escalate / Open portal are toast-only in E0 (no escalate/portal APIs).
- Browser login flow was not exercised.

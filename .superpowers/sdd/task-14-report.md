# Task 14 Report: E0 E2E + UAT exit

**Date:** 2026-09-10  
**Branch:** `feat/cmkte-e0`  
**Commit:** `ec41ee7a` — `test(cmkte): e2e COS shell and update operator guide IA`  
**Status:** DONE_WITH_CONCERNS

## What was implemented

| Surface | Behavior |
|---|---|
| `e2e/cmkte-shell.spec.ts` | 6 cases: OpsNav **Content Marketing OS**, Command Center H1, create-dialog sample test verbatim, missing-field stays on `role=dialog`, 8 `CMKTE_TABS` on mocked item `Item thử`, Save & validate → `/BLOCKED/` |
| Operator guide | Short COS IA table at top of `18-content-marketing-os.md` (8 routes + legacy redirect). Doc body not rewritten |
| Playwright webServer | Default `NEXT_PUBLIC_CONTENT_MARKETING=1` so flag-on nav can render when Playwright starts ops-web |

`apiReachable` + `loginAsStaff`; `test.skip` if Nest API unreachable. Workspace uses `/crm/content-os/w/1` + `GET **/portfolio/items/**` mock (`w/0` never fetches). No Sunlight/Nova.

## Test evidence

### Jest (ptt-crm-api)

```
cd services/ptt-crm-api && ./node_modules/.bin/jest src/content-os-portfolio --no-coverage
Test Suites: 5 passed, 5 total
Tests:       37 passed, 37 total
```

### Vitest (ops-web)

```
cd services/ops-web && ./node_modules/.bin/vitest run src/lib/crm/cmkte- src/lib/crm/content-os-hub.util.spec.ts src/lib/auth.spec.ts
Test Files  13 passed (13)
Tests  66 passed (66)
```

### Playwright

```
cd services/ops-web && ./node_modules/.bin/playwright test e2e/cmkte-shell.spec.ts
```

WebServer started. **PLAYWRIGHT_SKIPPED:** 6 skipped — `Nest API not reachable` (`apiReachable` probes on `127.0.0.1:3000` failed). First attempt also lacked Chromium until `playwright install chromium`.

**UAT screenshots:** not taken. Exit E0 click-through (`tiep-thi-noi-dung` Request → 8 tab → Save & validate → Send to approval / Mark published vs mockup) was not run.

## Files

- Create: `services/ops-web/e2e/cmkte-shell.spec.ts`
- Modify: `docs/huong-dan-su-dung/18-content-marketing-os.md`
- Modify: `services/ops-web/playwright.config.ts` (`NEXT_PUBLIC_CONTENT_MARKETING` default `1`)

## Concerns

- Playwright E2E did not execute assertions (API down). Re-run with Nest on `:3000` and demo staff caps `crm_board.view` + `crm_content.view`.
- `/crm/content-os/w/0` is always empty (`itemId` must be `> 0`); spec mocks item `1`.
- Command Center H1 depends on a mocked empty portfolio payload (avoids Sunlight/Nova seed).
- UAT lifecycle screenshots vs mockup chrome were not captured.

## Fix

Review: e2e `expandOpsNav` matched `/Triển khai dịch vụ/` but OpsNav renders the group via `sectionShortLabel` as **Triển khai DV**. Updated to expand `.ops-nav-group-header` with that label (`aria-expanded`), then assert sidebar **Content Marketing OS**.

```
cd services/ops-web && ./node_modules/.bin/playwright test e2e/cmkte-shell.spec.ts
```

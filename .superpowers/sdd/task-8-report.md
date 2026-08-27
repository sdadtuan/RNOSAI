# Task 8 Report — CRM config PostgreSQL cutover

## Status

Complete. CRM custom-field definitions, sales pipeline stages, and lead source/channel
lookups are now served by `CrmConfigPgRepository`. `CrmConfigService` and
`CrmConfigModule` no longer reference the SQLite repository.

The PostgreSQL repository:

- creates `crm_custom_field_defs`, `crm_pipeline_stages`, and
  `crm_lead_lookup_options`;
- seeds default sales stages and source/channel lookup options idempotently;
- preserves existing API payload shapes and validation errors;
- uses PostgreSQL parameters, booleans, JSONB, timestamps, and a transaction for
  full pipeline replacement;
- preloads and refreshes the in-memory sales pipeline runtime cache from
  PostgreSQL so synchronous sales/forecast consumers keep their existing contract.

## Verification

- `npx jest src/crm-config --no-coverage --runInBand`
  - 2 suites passed
  - 6 tests passed
- `npm run build`
  - passed

Task 9 was not started.
# Task 8 Report: Verify + QA cổng (không deploy)

**Date:** 2026-08-25  
**Workspace:** `/Users/quoctuan/Documents/CursorAI/RNOSAI`  
**Status:** VERIFY PASS (automated + overlay); browser NOT RUN; deploy SKIPPED; commit SKIPPED  
**Commits:** None (per instructions)

## Summary

- Helper suite: **4 files / 15 tests PASS**
- Overlay-only: **PASS** — `layout.tsx` still imports `./bitrix-theme.css`; no second Canopy CSS file
- Browser checklist: **NOT RUN** — no local ops-web HTTP server on `:3200`
- Deploy (Step 4): **SKIPPED**
- Commit (Step 5): **SKIPPED**

---

## Step 1 — Full helper suite

**Command (verbatim):**

```bash
cd services/ops-web && npx vitest run \
  src/lib/crm/work-signals.spec.ts \
  src/lib/crm/kanban-card-cta.spec.ts \
  src/lib/crm/lead-signal-kpis.spec.ts \
  src/lib/crm/lead-property-rows.spec.ts
```

**Cwd:** `/Users/quoctuan/Documents/CursorAI/RNOSAI/services/ops-web`  
**Exit code:** `0`

**Output:**

```
npm warn Unknown env config "devdir". This will stop working in the next major version of npm. See `npm help npmrc` for supported config options.
npm warn exec The following package was not found and will be installed: vitest@4.1.11

 RUN  v4.1.11 /Users/quoctuan/Documents/CursorAI/RNOSAI


 Test Files  4 passed (4)
      Tests  15 passed (15)
   Start at  14:05:49
   Duration  224ms (transform 106ms, setup 0ms, import 158ms, tests 13ms, environment 0ms)
```

**Result:** PASS — 4/4 files, 15/15 tests.

Note: `npx` resolved/installed `vitest@4.1.11` for this run (npm warn). Tests still completed with exit 0.

---

## Step 2 — Overlay-only check

**Command (verbatim):**

```bash
rg "bitrix-theme" services/ops-web/src/app/layout.tsx
```

**Cwd:** `/Users/quoctuan/Documents/CursorAI/RNOSAI`  
**Exit code:** `0`

**Output:**

```
import './bitrix-theme.css';
```

**CSS imports in the same file (context):**

```
import './globals.css';
import './bitrix-theme.css';
```

**Result:** PASS

- Still imports `./bitrix-theme.css`
- No second Canopy CSS file (no `canopy-*.css` import in `layout.tsx`)
- `globals.css` is the existing baseline, not a Canopy overlay

---

## Step 3 — Browser / local checklist

**Server probe:**

| Check | Result |
|-------|--------|
| Terminal `282565.txt` metadata | Stale `status: running` for `npm run dev` (started 02:46, title: Start ops-web Next.js from service dir) |
| `ps -p 7219` | Process gone (empty PID row) |
| `lsof -nP -iTCP:3200 -sTCP:LISTEN` | No listener |
| `curl -sI --max-time 5 http://127.0.0.1:3200/login` | No HTTP response (connection failed / empty headers) |
| Last lines of stale terminal | Prior session served `GET /login 404`, `GET /crm/leads 404`, plus Watchpack `EMFILE: too many open files` |

**Decision:** Local ops-web is **not serving**. Per brief, do not start a production deploy. Starting a fresh `next dev` is not treated as quick (prior EMFILE + 404s; CRM pages need auth). Browser checklist skipped.

| # | Item | Result | Why |
|---|------|--------|-----|
| 1 | `/crm/b2b/leads` kanban: cột Tư vấn sky, Đề xuất gold, Won emerald; card hot band rose; 1 CTA màu theo kind | **NOT RUN** | No local ops-web on `:3200` |
| 2 | KPI 4 ô trên toolbar, không đẩy title xuống 2 hàng | **NOT RUN** | No local ops-web on `:3200` |
| 3 | Breadcrumb + next-action không chồng | **NOT RUN** | No local ops-web on `:3200` |
| 4 | Lead detail: Band chip hồng/cam, không text thuần | **NOT RUN** | No local ops-web on `:3200` |
| 5 | Sidebar vẫn sage, icon trắng, **không** mint neon `#62b072`, **không** rừng đen `#0d3a22` | **NOT RUN** | No local ops-web on `:3200` |
| 6 | `/login` vẫn cream + form giấy — không regress P2 | **NOT RUN** | No local ops-web on `:3200` |
| 7 | Một nút PTT trên toolbar lead (`+ Tạo lead`) | **NOT RUN** | No local ops-web on `:3200` |

---

## Step 4 — Deploy

**SKIPPED.** User did not request commit + deploy. No push, no `npm run build` for rsync, no VPS `git pull`, no `ops_web_publish_release`, no `systemctl restart`.

---

## Step 5 — Commit

**SKIPPED.** User did not request a git commit. No `git add` / `git commit`.

---

## Checklist vs brief

| Step | Expected | Actual |
|------|----------|--------|
| 1 Helper suite | all PASS | **PASS** 15/15 |
| 2 Overlay-only | still `./bitrix-theme.css`, no second Canopy CSS | **PASS** |
| 3 Browser | visual QA if server running | **NOT RUN** (no listener on `:3200`) |
| 4 Deploy | only if user asks | **SKIPPED** |
| 5 Commit | only if user asks | **SKIPPED** |

## Ngoài phạm vi (not touched)

- `GlobalSearchBar` height / `--ops-chrome-h`
- Bitrix tím / sidebar neon vivid-demo
- Rewrite lead detail / kanban card markup
- KPI click-to-filter
- Commit of untracked demo HTML

## Concerns / follow-ups

1. Browser QA is still open until a healthy local `next dev` (or user-requested deploy) is available.
2. Stale terminal `282565` previously returned **404** for `/login` and `/crm/leads` under EMFILE watcher errors — if a server is restarted, confirm routes compile before visual QA.
3. `npx vitest` pulled `vitest@4.1.11` for this invocation; prefer `./node_modules/.bin/vitest` next time if a local pin exists.

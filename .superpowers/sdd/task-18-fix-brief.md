# Task 18-FIX — Go-live / PATCH / publish races

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Reviewer Important (must fix):

1. **Go-live vs unsaved checklist** — `AmOnboarding.tsx` `confirmGoLive` uses API against persisted items; modal uses draft. If user ticks required items and clicks Go-live without Lưu → 400 `required_open`.
   - Fix: if draft is dirty, PATCH items first then go-live; **or** disable Go-live CTA while dirty with a clear message. Prefer PATCH-then-go-live so the natural path works.

2. **PATCH after concurrent close** — `patchCase` checks closed in memory then `UPDATE` by tenant+id only. Concurrent go-live can still overwrite `items_json`.
   - Fix: `UPDATE … AND status = 'open'`. `rowCount === 0` → 409 `case_closed`. Add Jest: mocked `rowCount 0` → 409, no successful item persist claim.

3. **Xuất bản publishes last saved row** — `AmSettings.tsx` `onPublish` does not save the editor first.
   - Fix: if draft dirty, PATCH then publish (or disable Xuất bản while dirty). Prefer save-then-publish.

Do not add scorecard. Do not change go-live gate codes.

Commit: `fix(am): persist onboarding drafts before go-live and publish`

Report: `.superpowers/sdd/task-18-fix-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT

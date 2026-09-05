# Task 27-FIX — Open risks exclude churned

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

`countOpenRisks` must exclude `e.am_status = 'churned'` (same as sparkline / band tiles).

Jest: assert the COUNT SQL includes `am_status` / `churned`.

Commit: `fix(am): exclude churned from open-risks tile`

Report: `.superpowers/sdd/task-27-fix-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT

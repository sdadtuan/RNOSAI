# Task 21-FIX — Override carry-forward + band gaps

Work in `/Users/quoctuan/Documents/CursorAI/RNOSAI/.worktrees/feat-am-os` on `feat/am-os`.

Reviewer Important:

1. **Override dies on the next new `as_of` snapshot.** Recompute INSERTs a new day without copying `override_*`. 360 reads latest → banner disappears before `until`.
   - When inserting a new snapshot row, copy `override_band`, `override_reason`, `override_until` from the previous latest snapshot if `override_until >=` today ICT.
   - Jest: previous row has active override; upsert new as_of → INSERT includes those three columns (assert SQL/params). Same-day ON CONFLICT still must not overwrite `scorecard_version`.

2. **`bandFromScore` maps 79.1–79.9 (and 59.x / 39.x) to `critical`.** Integer inclusive bands + `round1` scores.
   - Treat each band as `[lo, next.lo)` except the last band inclusive to 100, **or** walk bands high-to-low (`score >= lo`). Default 80/60/40 behavior must stay: 79.5 → `watch`, 80 → `healthy`.
   - Jest: 79.5 → watch; 39.5 → critical; 59.5 → at_risk with default bands.

Do not change PUT 400 codes. Do not add field/SLA UI.

Commit: `fix(am): carry health override across snapshots`

Report: `.superpowers/sdd/task-21-fix-report.md`
DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT

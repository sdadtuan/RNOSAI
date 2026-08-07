# WIN-1 Acceptance — Competitive Win Wave 1

> **Program:** RNOSAI Competitive Win  
> **Scope:** WIN-1-A (PWA/mobile) · WIN-1-B (filters/CSKH export) · WIN-1-C (Excel + R1.5 RBAC UI) · Lane A (user job function assign)  
> **Environment:** https://ops.pttads.vn  
> **Reference:** [`2026-08-07-rnosai-competitive-win-implementation-plan.md`](./2026-08-07-rnosai-competitive-win-implementation-plan.md) §5.4

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Design tokens + WIN components | ☐ Pass ☐ Fail | `components/win/*` |
| PWA + mobile leads | ☐ Pass ☐ Fail | VUX-02, VUX-08 |
| Excel import/export wizards | ☐ Pass ☐ Fail | Leads + roster |
| RBAC matrix chức vụ + function | ☐ Pass ☐ Fail | Admin permissions |
| User job function assign (R1.5-S3) | ☐ Pass ☐ Fail | `/permissions/users` |
| Persona menu isolation | ☐ Pass ☐ Fail | VUX-04 — **PASS** hướng B (`eac00e0`): MKT-02 trim + content/design job functions; evidence [`win-1-manual-uat-vux-20260807.md`](../exports/win-1-manual-uat-vux-20260807.md) |
| SoD client + API | ☐ Pass ☐ Fail | VUX-05 |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-------------|
| Product Owner | | | |
| QA Lead | | | |
| HR Ops | | | |
| Tech Lead | | | |

**Decision:** ☐ Accepted for WIN-2 kickoff ☐ Accepted with conditions ☐ Rejected

**Conditions / follow-ups:**

1. 
2. 

---

## Evidence links

- UAT checklist: [`docs/runbooks/win-1-uat-checklist.md`](../runbooks/win-1-uat-checklist.md)
- Deploy commit: `git log -1 --oneline` on VPS
- Screenshots (optional): `docs/exports/win-ux-screenshots/WIN-1/`

---

*Template v1.0 — 2026-08-07. Export to PDF for `docs/exports/signed/` after sign-off.*

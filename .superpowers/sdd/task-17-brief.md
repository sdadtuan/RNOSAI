### Task 17: Sales→AM Handover (UI-AM-07)

**Files:** `am-onboarding.service.ts`, `AmHandover.tsx`, `onboarding/page.tsx` (queue) + handover modal

4 steps: Thương mại → Scope & KPI → Stakeholder → Xác nhận. AM checklist required before accept. Reject / needs_info requires reason. Accept → `am_status=onboarding` + create onboarding case from published template (or empty checklist).

- [ ] Tests: accept without checklist 400; reject without reason 400; accept writes audit `handover.accept`.
- [ ] Commit: `feat(am): add Sales-to-AM handover workspace`.

---


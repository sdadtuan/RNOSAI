# Task 13 Report: Admin UI Sinh / Duyệt / Active (P2)

**Status:** DONE  
**Branch:** `feat/mkt-ai-playbook-learn`  
**Commit:** (pending) — feat(mkt-ai): admin UI playbook learn review activate  
**Pushed:** no

## What shipped

Admin UI at `/crm/admin/mkt-ai/playbooks` for MKT Lead to review corpus, generate learned playbooks, approve, and activate versions — Vietnamese copy per spec §9.

| File | Role |
|------|------|
| `services/ops-web/src/lib/mkt-ai-playbook-admin-api.ts` | REST client for Task 12 admin API (list, detail, policy, learn, version lifecycle) |
| `services/ops-web/src/app/crm/admin/mkt-ai/playbooks/page.tsx` | List table + detail `?slug=` — 3 columns Corpus / Playbook / Hành động |
| `services/ops-web/src/components/OpsNav.tsx` | Nav link "Playbook DV" under AI & Automation when generate or approve cap |
| `services/ops-web/src/lib/rbac-routes.ts` | Prefix `/crm/admin/mkt-ai` — view / approve / ai_admin.view |
| `services/ops-web/src/lib/auth.spec.ts` | RBAC test for playbook admin route |

## UI (spec §9)

### Danh sách

- Cột: Dịch vụ (label + slug), rollout chip, playbook active (version + depth), mẫu `n/5 · m/3`, CTA **Mở**

### Chi tiết (`?slug=`)

| Cột | Nội dung |
|-----|----------|
| Corpus | Thanh ứng viên/thắng, danh sách HĐ, checkbox loại khỏi lần Sinh |
| Playbook | Dropdown version, form field schema (không raw JSON dump), Lưu nháp |
| Hành động | Sinh (disabled `Còn N HĐ…`), Gửi duyệt, Duyệt, Yêu cầu sửa, **Active chỉ khi approved**, Rollback, rollout toggle |

- Không nút **Active** trên bản `draft` / `pending_review`
- Job panel theo dõi learn job (poll 3s)

## Step checklist

- [x] `mkt-ai-playbook-admin-api.ts` client
- [x] List + detail page (query `?slug=`)
- [x] OpsNav link "Playbook DV"
- [x] `rbac-routes` prefix
- [x] UI Vietnamese
- [x] Sinh disabled + `Còn N HĐ…` when `!canLearn`
- [x] **Commit** `feat(mkt-ai): admin UI playbook learn review activate`

## What I tested

```bash
cd services/ops-web && npx vitest run src/lib/auth.spec.ts
```

```
✓ src/lib/auth.spec.ts (14 tests)
  ✓ /crm/admin/mkt-ai requires mkt_ai view, approve, or ai_admin view
```

## Notes

- Detail uses `StaffPageShell` + staff fetch pattern (same as CEO learn / CRM playbooks).
- `crm/layout.tsx` `StaffRouteGuard` enforces RBAC via new prefix rule.
- Nav visible only for `crm_mkt_ai.generate` or `crm_mkt_ai.approve`; page view also allows `crm_mkt_ai.view` and `ai_admin.view`.
- Preview / channel_mix warning (§9.3) deferred — optional P2 stretch.
- E2e Playwright spec planned in Task 16.

## Next

Task 14: Planner resolve from `active_version_id` in `marketing-ai-playbook.service.ts`.

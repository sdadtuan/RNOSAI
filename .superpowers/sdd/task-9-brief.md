### Task 9: Health snapshot + recompute

**Files:**
- Create: `services/ptt-crm-api/src/am/am-health.service.ts`
- Create: `services/ptt-crm-api/src/am/am-health.service.spec.ts`
- Modify: `am.controller.ts` — `POST /health/recompute` `@RequireAmAction('manage')`
- Create: `services/ptt-crm-api/src/am/am-settings.service.ts` — GET settings (all viewers)

**Interfaces:**

Wave 1 component stubs (replace in W3/W4 when sources exist):

| Component | Stub if missing |
|-----------|-----------------|
| kpi_delivery | 70 + thin_data |
| engagement | 70 + thin_data |
| financial | 80 if Active contract else 70 |
| satisfaction | 70 (no CSAT yet) |
| contract_support | 40 if any CSD breached else 70 |

Account Active < 30 days → `thin_data=true`. Churned clients skipped. Critical does **not** yet require recovery (Wave 3).

- [ ] **Step 1: Tests** — weights 30/20/20/15/15; score 72 → watch; churned excluded from dist.

- [ ] **Step 2: Implement upsert snapshot `ON CONFLICT (tenant_id, agency_client_id, as_of)`.**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(am): compute 4-band health snapshots for dashboard

EOF
)"
```

---


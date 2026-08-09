# PTT Ops DV01–DV21 — Implementation Status

**Last updated:** 2026-08-10  
**Overall:** 0% — Spec complete, implementation not started  
**Plan:** `docs/superpowers/plans/2026-08-10-ptt-ops-dv-phase0-implementation.md`

---

## Milestone summary

| Milestone | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **Spec** | Design + integration + DDL + route map | ✅ Done | This session |
| **Ops-M0 plan** | WS-OPS-00…06 milestone doc | ✅ Done | `2026-08-10-ptt-ops-dv-ops-m0-milestone.md` |
| **Ops-M0** | Catalog + hub read-only | ✅ Done | BE+FE M0 |
| **Ops-M1** | Weekly spawn | ⬜ Not started | |
| **Ops-M2** | KPI records | ⬜ Not started | |
| **Ops-M3** | Tier + quotes | ⬜ Deferred | Stretch |

---

## Artifact checklist

| Artifact | Path | Status |
|----------|------|--------|
| Design spec | `docs/superpowers/specs/2026-08-10-ptt-ops-dv-os-design.md` | ✅ |
| Design spec | `docs/superpowers/specs/2026-08-10-ptt-ops-dv-os-design.md` | ✅ |
| Integration spec (Ops API) | `docs/specs/2026-08-10-ptt-ops-dv-integration-spec.md` | ✅ |
| **Integration spec (full SRS)** | `docs/specs/2026-08-10-ptt-ops-rnosai-integration-spec.md` | ✅ |
| Implementation plan | `docs/superpowers/plans/2026-08-10-ptt-ops-dv-phase0-implementation.md` | ✅ |
| Route map | `docs/specs/ops-dv01-dv21-route-map.json` | ✅ (prior) |
| DDL | `docs/specs/2026-08-10-postgresql-ddl-ptt-ops-dv.sql` | ✅ |
| Staging fixtures | `docs/specs/ops-staging-fixtures.md` | ⬜ After seed |

---

## Backend (ptt-crm-api)

| Component | Status |
|-----------|--------|
| `ops` Nest module | ✅ |
| Route map loader | ✅ |
| Slug resolver | ✅ |
| `ops_service_profile` repository | ✅ |
| GET `/api/ops/catalog` | ✅ |
| GET `/api/ops/lifecycle/:id/hub` | ✅ |
| POST spawn-week | ⬜ |
| KPI GET/PUT | ⬜ |
| VALID_SLUGS extension | ⬜ |
| Seed script | ✅ `scripts/seed_ops_dv_catalog.js` |
| Unit tests | ✅ 10 ops tests |

---

## Frontend (ops-web)

| Component | Status |
|-----------|--------|
| `ops-dv-api.ts` | ✅ |
| `OpsServiceHubPanel` | ✅ |
| Service delivery tab | ✅ |
| Weekly panel | ⬜ |
| KPI summary | ⬜ |

---

## Pilot DV (P0)

| DV | Slug | Hub | Spawn | KPI | Staging lifecycle |
|----|------|-----|-------|-----|-------------------|
| DV02 | `tiep-thi-noi-dung` | ⬜ | ⬜ | ⬜ | ❌ Missing — seed required |
| DV05 | `seo-retainer` | ⬜ | ⬜ | ⬜ | ✅ Exists |
| DV04 | `meta-lead-gen` / ads | ⬜ | ⬜ | ⬜ | Partial |
| DV20 | `email-marketing` | ⬜ | ⬜ | ⬜ | TBD |

---

## Environment (staging)

| Variable | Current | Target |
|----------|---------|--------|
| `PTT_OPS_DV_ENABLED` | unset | `1` |
| `PTT_OPS_WEEKLY_SPAWN` | unset | `0` → `1` after M1 |
| `PTT_CMKT_BRIEF_GATE` | `1` | unchanged |
| M16 smoke lifecycle | fail (no slug) | fix with seed |

---

## Verification log

| Date | Command | Result |
|------|---------|--------|
| — | — | — |

---

## Next action

**Start Ops-M0:** scaffold `src/ops` module + DDL bootstrap + seed from route map JSON.

```bash
cd services/ptt-crm-api
# After implementation:
npm test -- --testPathPattern=ops
cd ../ops-web && npm run build
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-08-10 | Initial spec suite + status baseline |

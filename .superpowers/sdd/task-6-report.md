# Task 6 Report: Admin UI + túi phiên + e2e S4 + AEO label

**Status:** DONE  
**Branch:** `feat/intake-sales-kit-s3-s4`

## Summary

S4 admin + session bag UI on Task 5 APIs. TDD first: `intakeServiceLabel('dich-vu-aeo') === 'AEO'` failed (`received 'dich-vu-aeo'`), then GREEN. Sample xlsx util test failed (`Cannot find module`), then GREEN with exceljs 5 SEO Q&A rows including `KH nói đắt` / `Neo gói TC 3 tháng, không giảm dưới band`. Chip Hỏi kho / Bảng giá work without `llmEnabled`; form “KH vừa nói…” posts `{ intent, message }`.

## Files

| File | Action |
|------|--------|
| `services/ops-web/src/lib/crm/intake-service-resolve.ts` | LABELS `'dich-vu-aeo': 'AEO'` |
| `services/ops-web/src/lib/crm/intake-service-resolve.spec.ts` | AEO label test |
| `services/ops-web/src/app/crm/intake/sales-kit/page.tsx` | Created — StaffPageShell admin |
| `services/ops-web/src/components/crm/intake/IntakeSalesKitAdminPanel.tsx` | Created — tree / upload / Duyệt / Tải mẫu |
| `services/ops-web/src/components/crm/intake/IntakeSalesKitLibrarySheet.tsx` | Created — túi phiên dropzone + org read-only |
| `services/ops-web/src/components/OpsNav.tsx` | Kho Sales Kit in Bán hàng |
| `services/ops-web/src/components/crm/intake/IntakeSalesKitPanel.tsx` | Library chat without LLM |
| `services/ops-web/src/app/crm/intake/IntakeContent.tsx` | Nút **Kho** |
| `services/ops-web/src/lib/api.ts` | list / upload / approve / sample download |
| `services/ops-web/src/app/globals.css` | Admin + sheet styles |
| `services/ops-web/e2e/intake-deal-bar-sales-kit.spec.ts` | UAT-13–18 header + sample.xlsx skip |
| `services/ptt-crm-api/src/intake/sales-kit-sample.util.ts` | Created — exceljs sample |
| `services/ptt-crm-api/src/intake/sales-kit-sample.util.spec.ts` | Created |
| `services/ptt-crm-api/src/intake/intake.controller.ts` | `GET /api/crm/intake/sales-kit/sample.xlsx` |
| `scripts/deploy_intake_sales_kit_s4_vps.sh` | Created — DDL + ingest/retrieve/library jest |
| `docs/huong-dan-su-dung/27-lifecycle-ui-huong-dan-day-du.md` | Intake kho section only |

## Tests

TDD RED:

```
FAIL intakeServiceLabel('dich-vu-aeo') expected 'AEO', received 'dich-vu-aeo'
FAIL Cannot find module './sales-kit-sample.util'
```

After implement:

```
PASS ops-web vitest intake-service-resolve + intake-sales-kit-apply — 14/14
  ✓ labels dich-vu-aeo as AEO
PASS ptt-crm-api jest sample + library + ingest + retrieve + controller — 20/20
  ✓ builds 5 SEO Q&A rows including KH nói đắt
```

E2E Playwright not run here (no guaranteed live API / staff cap). Spec skips UAT-13–18 when API/token/cap missing.

## Self-review

- Admin folder tree is 3 pilots + `_common` × 4 kinds via `?folder=`.
- Org upload/approve still configure-only (Task 5). Session bag uses `crm_leads.edit`.
- Sample.xlsx is ViewGuard only (class-level); Tải mẫu does not require configure beyond page gate.
- Citations already rendered; library form is 1-line input when chip 7–8 active.

## Concerns

1. **Org browse in túi phiên** still needs configure (`listFiles` folder_key). AM without configure only sees session bag + link copy.
2. **No live Playwright / browser UAT** in this environment — S4 ship gate (upload mẫu → Hỏi kho “KH nói đắt” → citation) needs VPS/staff after DDL.
3. **Org POST still configure**; `playbooks.configure`-only users can open admin (page checks that cap).
4. **xlsx sample assertion in e2e** is byte-size + string sniff; full Excel parse is unit-tested.

## Out of scope

- LLM safety / vision ingest (Task 7+)
- Live `ai_agent_runs` ingest audit

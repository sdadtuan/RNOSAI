# Task 10 Report

Status: PASS

## RED

Command:

`npm --prefix services/ptt-crm-api test -- --runInBand src/cp/cp-settings.service.spec.ts src/cp/cp-ledger.service.spec.ts`

Observed expected failures before implementation:

- settings service module was absent, so both secret-omission and model-allowlist tests failed
- `CpLedgerService.grant` was absent, so the idempotent grant test failed
- Result: 2 suites failed; 3 tests failed and 2 existing ledger tests passed

## GREEN

The same focused command passes:

- 2 suites passed
- 5 tests passed
- 0 snapshots

Additional verification:

- `npm --prefix services/ptt-crm-api run build` passed
- `git diff --check` passed
- IDE diagnostics report no errors in Task 10 files

## Delivered

- GET and PATCH settings routes with `view` and `manage` capability requirements
- recursive provider-secret omission from `models_json` and `policy_json`
- model PATCH allowlist enforcement
- finance `execute`-guarded credit grant route
- atomic grant-ledger insertion and allocation upsert with idempotent replay
- settings query-port provider registration in `CpModule`

## Concerns

- npm prints an existing `devdir` configuration deprecation warning.

## Follow-up: GET allowlist hardening

Commit target: `fix(cp): allowlist settings GET so secrets cannot leak`

RED:

- `npx jest src/cp/cp-settings.service.spec.ts`
- 1 suite failed; 1 test failed and 1 passed
- the response exposed `tenant_id`, an unknown settings column,
  `access_token`, and an unknown model field

GREEN:

- GET now selects only documented response columns and projects the row through
  the same explicit allowlist
- every returned model is projected through the model allowlist
- policy keys matching `/secret|token|password|credential|api_key/i` are removed;
  non-object policies become `{}`
- requested focused Jest command: 1 suite passed; 2 tests passed

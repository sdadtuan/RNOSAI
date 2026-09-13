# Task 11 Report — UI pane Comfy

**Branch:** `feat/cp-ai-ops`  
**HEAD before:** `d103f01f63cbc4fd7b13b32a384b7e893b922466`  
**Commit:** `099f90c5` `feat(cp): Comfy pane gated on GPU health.`  
**Status:** DONE_WITH_CONCERNS

## Summary

Wave C composer is now `CpAiOpsComfyPane`. Submit stays off unless `flags.comfy` **and** `GET /api/crm/cp/provider-health` returns `comfy.ok === true` with `checked_at` younger than 30s. Health `gpu_building` (or any `ok !== true`) shows the locked copy **Đang xây GPU — chưa nhận job.** Settings Integrations has a Comfy block “GPU chưa sẵn sàng” plus a write-only gateway field that never appears on the composer and is never echoed from GET.

FE never displays `COMFYUI_GATEWAY_URL` or `:8188`. Health JSON has no host; the pane does not invent one. Browser does not POST `:8188`.

## What shipped

### Composer (`CpAiOpsComfyPane`)

- Replaces the workspace placeholder (`comfyHealth = false`).
- Loads `getProviderHealth()` → `/api/crm/cp/provider-health`.
- Fetch error fail-closes to `{ ok: false, reason: 'gpu_building' }`.
- Locked copy via `COMFY_LOCKED_COPY` (period included).
- VRAM uses `dash()` → `—` when down / missing.
- Submit `disabled` unless `isComfySubmitEnabled`.
- Submit has no click handler that talks to a gateway. Classes `cp-ai-ops-*`. No `/crm/aco`.

### Disable rules (`cp-ai-ops-panes.util.ts`)

| Condition | Submit |
|---|---|
| `flags.comfy !== true` | off |
| health missing / `ok !== true` / `reason: gpu_building` | off + locked copy |
| `ok === true` but `checked_at` missing, invalid, or age `>= 30s` | off |
| `ok === true` and heartbeat `< 30s` | on; hide locked copy |

`comfyGatewayInputValue()` always returns `''` so a saved URL cannot be painted back.

### Settings Integrations

- Block `data-testid="cp-settings-comfy"` with copy **GPU chưa sẵn sàng** (`comfySettingsStatusCopy`, Wave C constant — not flipped when health is later `ok`).
- Manage-only password field “URL gateway (nội bộ)”. Never prefilled. Save clears the input and does **not** PATCH `/settings` or any GET-able store.
- Composer does not render this field.

### E2E (`e2e/cp-ai-ops-comfy.spec.ts`)

Same session + `page.route('**/api/crm/cp/**')` pattern as Magnific.

- Mock `{ comfy: { ok: false, reason: 'gpu_building' } }` + `comfy: true` → pane visible, locked copy exact, Submit disabled.
- Scan `page.content()` and request URLs for `:8188` / `COMFYUI_GATEWAY`.
- Settings Integrations: “GPU chưa sẵn sàng”, empty gateway input, no composer pane, no `:8188`.

## Tests (TDD)

1. Helper + health client specs written first; failed (`COMFY_LOCKED_COPY` undefined, `isComfySubmitEnabled` / `getProviderHealth` missing).
2. Implemented helpers + `GET /provider-health`; Vitest green.
3. Playwright spec written; pane/settings implemented; e2e green.

## Verification

```bash
cd services/ops-web && npm run test:unit -- src/lib/crm/cp-ai-ops-panes.util.spec.ts src/lib/crm/cp-ai-ops-api.spec.ts
# 2 files, 18 passed

cd services/ops-web && npx playwright test e2e/cp-ai-ops-comfy.spec.ts
# 2 passed
```

No live GPU / Cửa C pentest (Task 13). No Task 12 recommend work.

## Files

| File | Change |
|---|---|
| `services/ops-web/src/components/crm/cp/CpAiOpsComfyPane.tsx` | New pane |
| `services/ops-web/src/components/crm/cp/CpAiOpsWorkspace.tsx` | Mount pane |
| `services/ops-web/src/components/crm/cp/CpSettings.tsx` | Comfy integrations block |
| `services/ops-web/src/lib/crm/cp-ai-ops-panes.util.ts` + spec | Health / disable / no-echo |
| `services/ops-web/src/lib/crm/cp-ai-ops-api.ts` + spec | `getProviderHealth` |
| `services/ops-web/e2e/cp-ai-ops-comfy.spec.ts` | Mocked Playwright |

Dirty tree left unstaged: `CsdChat*`, `csd-chat-display*`, `globals.css`, `.DS_Store`, `test-results`, untracked docs.

## Self-review

- Prefix stays `/api/crm/cp`. No `/api/v1`. Flags unchanged.
- Health client and pane source have no `:8188` / `COMFYUI_GATEWAY`.
- Task 12 not started.

## Concerns

1. Settings “Lưu URL gateway” is write-only UI. It does not persist to env (`COMFYUI_GATEWAY_URL` remains server-only). That is intentional so GET/list cannot echo a host to the composer, but operators cannot set the gateway from Settings.
2. Settings status copy stays **GPU chưa sẵn sàng** even if a later heartbeat is `ok` (Wave C constant).
3. Enabled Submit is a no-op (no CRM `/jobs` draft/submit from this pane). Job provider=`comfyui` stays backend-only until a later wave.
4. 30s freshness is FE-only; mocked e2e covers `gpu_building`, not a live `ok` + stale `checked_at` path in the browser.
5. No live Cửa C pentest (Task 13).

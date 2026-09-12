# Task 10 Report — Comfy adapter + health + job provider=comfyui

**Branch:** `feat/cp-ai-ops`  
**HEAD before:** `dae8f59110decffb92431a4ae81b6c6ec9965cf3`  
**Commit:** `69765c04` `feat(cp): ComfyUI gateway adapter and health.`  
**Status:** DONE_WITH_CONCERNS

## Summary

`CpComfyAdapter` talks only to `COMFYUI_GATEWAY_URL` (mocked fetch in tests). Flag off or heartbeat failure never POSTs `/prompt` and never reads the public `:8188` path. Jobs now accept `provider=comfyui` on the same draft/confirm/submit gate as Magnific; submit returns `409 WORKER_UNAVAILABLE` (GT-C01) when `readAiOpsFlags().comfy` is false or `systemStats()` is not ok. `GET /api/crm/cp/provider-health` (`@RequireCpAction('view')`) returns `{ comfy: { ok, vram_mb, checked_at } }` or `{ comfy: { ok: false, reason: 'gpu_building' } }` with no host/URL. Ingest reuses the Task 6 DAM/checksum path via `history` + `download`; empty bytes → `failed` + `ASSET_SYNC_FAILED`. OOM retries once (`attempt+1`) then persists `OUT_OF_MEMORY`.

## What shipped

### `CpComfyAdapter` (`cp-comfy.adapter.ts`)

```ts
export class CpComfyAdapter {
  systemStats(): Promise<{ vram_mb: number | null; ok: boolean }>;
  prompt(jobId: string, boundWorkflow: unknown): Promise<{ promptId: string }>;
  history(promptId: string): Promise<{ outputFiles: string[] }>;
  interrupt(promptId: string): Promise<void>;
  download(fileRef: string): Promise<{ bytes: Buffer; mime: string }>;
  providerHealth(): Promise<ComfyProviderHealth>;
}
```

- `client_id` = `ptt-{jobId}` on `POST {gateway}/prompt`.
- Flag off (`COMFYUI_WORKER_ENABLED` not `1`/`true`) → `systemStats` `{ ok: false }` and `prompt` `409 WORKER_UNAVAILABLE` **without** fetching `COMFYUI_GATEWAY_URL`.
- Heartbeat fail (`/system_stats` error/non-OK, 5s timeout) → no `/prompt`; health `gpu_building`.
- `vram_mb` from `devices[0].vram_total` (bytes → MiB when `>= 1_000_000`).
- History OOM (`CUDA out of memory`) → `409 OUT_OF_MEMORY`.
- Extra methods: `download` (GT-C04 ingest) and `providerHealth` (route JSON).

### Jobs (`cp-jobs.service.ts`)

- `requiredProvider` / `CpJobDraftInput.provider` now includes `comfyui`.
- Magnific draft/confirm/submit/getBalance path unchanged.
- Comfy skips Magnific GT-M05 (RESTRICTED may draft on-prem).
- Same confirm gate: `confirm !== true` → `400 human_confirm_required`.
- Submit: flag off → `409 WORKER_UNAVAILABLE` **before** `systemStats`/`prompt`. Heartbeat fail → same, no `prompt`.
- Submit success: `bindComfyWorkflow` on `inputs.workflow/bindings/values` → `prompt` → run `queued` with `external_run_id = promptId`.
- Ingest: `history` + `download` + sha256 + `probeIngestBytes` (null, never 0) + DAM prefix `comfyui/{jobId}/{checksum}.ext`.
- Empty download → `ASSET_SYNC_FAILED` (GT-C04 / GT-M06-style).
- OOM on first prompt: release, `attempt+1` reserve, prompt once more; second OOM → `failed` + `OUT_OF_MEMORY`.
- Cancel interrupts the prompt id when present.

### Health route (`cp.controller.ts`)

```
GET /api/crm/cp/provider-health
@RequireCpAction('view')
```

- Flag off or missing adapter → `{ comfy: { ok: false, reason: 'gpu_building' } }` (no `checked_at` required).
- Live ok → `{ comfy: { ok: true, vram_mb, checked_at } }`.
- JSON never contains `COMFYUI_GATEWAY_URL`, `:8188`, or a host.

### Worker

`pollMagnificQueuedJobs` / `process` also ingest `provider = 'comfyui'` so queued Comfy jobs follow the Task 6 claim path.

## Tests (TDD)

1. Adapter + jobs + controller specs written first → fail (module missing, `comfyui` rejected, 6th ctor arg).
2. Implemented adapter / job branch / health → green.

| Suite | Asserts |
|---|---|
| flag off | no fetch; `WORKER_UNAVAILABLE`; health `gpu_building` without URL |
| bind+prompt | packshot bind → `POST {gateway}/prompt` `client_id=ptt-{jobId}` |
| heartbeat fail | no `/prompt` |
| health JSON | omits gateway / `:8188` / host |
| ingest checksum | empty bytes → `ASSET_SYNC_FAILED`; success → DAM + probe ≠ 0 |
| OOM | two prompts, reserve `:2`, persist `OUT_OF_MEMORY` |
| RESTRICTED | comfy draft allowed |

## Verification

```bash
cd services/ptt-crm-api && npx jest --testPathPattern='src/cp/cp-(comfy.adapter|jobs.service|ai-ops.flags)|src/cp/cp.controller' --no-coverage
# 4 suites, 54 passed

cd services/ptt-crm-api && npx jest --testPathPattern='src/cp/cp-(comfy-bind|render.worker|provider-runs)' --no-coverage
# 3 suites, 11 passed
```

Did **not** hit a live ComfyUI gateway or GPU.

## Files

| File | Change |
|---|---|
| `services/ptt-crm-api/src/cp/cp-comfy.adapter.ts` | Created — gateway adapter + health |
| `services/ptt-crm-api/src/cp/cp-comfy.adapter.spec.ts` | Created — mock fetch |
| `services/ptt-crm-api/src/cp/cp-jobs.service.ts` | `comfyui` draft/confirm/submit/ingest/OOM |
| `services/ptt-crm-api/src/cp/cp-jobs.service.spec.ts` | Comfy job + ingest + OOM cases |
| `services/ptt-crm-api/src/cp/cp-jobs.repository.ts` | insert provider includes `comfyui` |
| `services/ptt-crm-api/src/cp/cp.controller.ts` | `GET provider-health` view |
| `services/ptt-crm-api/src/cp/cp.controller.spec.ts` | health omits host |
| `services/ptt-crm-api/src/cp/cp.module.ts` | provide `CpComfyAdapter` |
| `services/ptt-crm-api/src/cp/cp-render.worker.ts` | poll/ingest `comfyui` |

Dirty tree left unstaged: CSD chat files, `globals.css`, `.DS_Store`, `test-results`, untracked docs.

## Self-review

- Reused `bindComfyWorkflow`; did not rewrite it.
- Magnific getBalance / generate path untouched.
- No Task 11 pane or Settings UI.
- No POST to public `:8188`.

## Concerns

1. **Extra adapter methods:** brief listed four methods; `download` and `providerHealth` were added so ingest and the health route do not leak the gateway URL.
2. **History is a single GET** (no Magnific-style poll loop). Ingest expects outputs already present; worker polls queued jobs every 10s.
3. **Draft/confirm allowed while flag is off.** Only submit/prompt/health enforce GT-C01.
4. **No live GPU UAT.** All gateway I/O is mocked fetch.

---

## Fix pass — history poll + execution OOM retry

**HEAD before:** `69765c04f120dbd9d1445fd93623d2edda5081ee`  
**Commit:** `fix(cp): poll Comfy history and retry execution OOM once.`  
**Status:** DONE_WITH_CONCERNS

Critical/Important review findings only. Did not start Task 11. Did not stage CSD chat files.

### What changed

- `CpComfyAdapter.history()` polls `GET /history/{promptId}` until outputs exist, vendor OOM/fail, or timeout. Default wait `COMFY_WAIT_MS` / `MAGNIFIC_VIDEO_WAIT_DEFAULT_MS` (600s), interval 3s (2–5s), per-GET abort 15s.
- Empty/running history is not `ASSET_SYNC_FAILED` / `missing_output_url`. Timeout reason is `wait_timeout` after more than one GET.
- Ingest `pullComfyOutput` also waits on empty mocked snapshots (so claim+wait can last minutes; the 10s worker tick will not see the already-claimed row).
- History `OUT_OF_MEMORY`: release, `attempt+1` reserve, `prompt` again (same bind), wait history again. Persist `OUT_OF_MEMORY` only after the second failure. Prompt-OOM retry unchanged.
- Empty download after a completed history with no bytes remains `ASSET_SYNC_FAILED`.

### Tests (TDD)

RED: adapter rejected `waitTimeoutMs`; ingest failed first empty snapshot as `missing_output_url`; first history OOM called `failOom` with one prompt. GREEN after poll + retry.

```
cd services/ptt-crm-api && npx jest --testPathPattern='src/cp/cp-(comfy.adapter|jobs.service|render.worker)' --no-coverage
# 3 suites, 48 passed
```

### Concerns

1. Peek-before-claim “leave queued” is not a separate early return; ingest claims then waits. Worker 10s poll misses the row because it is already `processing`.
2. Worker first-tick spec mocks `ingest` (worker itself never writes `ASSET_SYNC_FAILED`). Real empty-snapshot coverage is in adapter + jobs specs.
3. Adapter wait timeout reuses `throwMagnificWaitFailed` for the same `ASSET_SYNC_FAILED` + `wait_timeout` / `vendor_failed` body.
4. Still no live ComfyUI / GPU UAT.

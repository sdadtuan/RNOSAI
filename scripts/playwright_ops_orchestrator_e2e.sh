#!/usr/bin/env bash
# RNOS-31 — Playwright multi-agent orchestrator smoke
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export OPS_E2E_URL="${OPS_E2E_URL:-http://127.0.0.1:3200}"
export OPS_E2E_API_URL="${OPS_E2E_API_URL:-http://127.0.0.1:3000}"
export OPS_E2E_SKIP_SERVER="${OPS_E2E_SKIP_SERVER:-1}"
export PTT_AI_ORCHESTRATOR_ENABLED="${PTT_AI_ORCHESTRATOR_ENABLED:-1}"
export PTT_AI_ORCHESTRATOR_CRON_ENABLED="${PTT_AI_ORCHESTRATOR_CRON_ENABLED:-0}"
export PTT_AI_COPILOT_ENABLED="${PTT_AI_COPILOT_ENABLED:-1}"

cd "$ROOT/services/ops-web"
if [[ ! -d node_modules/@playwright/test ]]; then npm install; fi
npx playwright install chromium
npx playwright test e2e/orchestrator-rnos31.spec.ts

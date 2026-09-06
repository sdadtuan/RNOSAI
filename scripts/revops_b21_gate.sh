#!/usr/bin/env bash
# RevOps B21 gate — mobile nav + 12-view smoke (plan Task B21).
#
# Usage:
#   ./scripts/revops_b21_gate.sh
#   ./scripts/revops_b21_gate.sh --skip-e2e
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_E2E=0

for arg in "$@"; do
  case "$arg" in
    --skip-e2e) SKIP_E2E=1 ;;
  esac
done

echo "== RevOps B21 gate @ $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local) =="

echo "== 1/3 ops-web revops unit (nav + flags) =="
cd "$ROOT/services/ops-web"
npm run test:unit:revops-w3

echo "== 2/3 revops nav + flags unit =="
npx vitest run src/lib/crm/revops-flags.spec.ts src/lib/crm/revops-nav.util.spec.ts

if [[ "$SKIP_E2E" == "1" ]]; then
  echo "== 3/3 playwright revops-full — SKIPPED (--skip-e2e) =="
else
  echo "== 3/3 playwright revops-full =="
  npm run test:e2e:revops-full
fi

echo "OK  RevOps B21 gates passed."
echo "    Manual: mobile 5-tab on embed ?revops=1 · Command Center LCP note on staging"

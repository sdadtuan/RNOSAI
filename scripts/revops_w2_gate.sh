#!/usr/bin/env bash
# RevOps Wave 2 UAT automated gate (plan Task B13).
#
# Usage:
#   ./scripts/revops_w2_gate.sh
#   ./scripts/revops_w2_gate.sh --skip-e2e
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKIP_E2E=0

for arg in "$@"; do
  case "$arg" in
    --skip-e2e) SKIP_E2E=1 ;;
  esac
done

echo "== RevOps W2 UAT gate @ $(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo local) =="

echo "== 1/3 ptt-crm-api revops tests =="
cd "$ROOT/services/ptt-crm-api"
npm run test:revops

echo "== 2/3 ops-web unit tests (revops W2) =="
cd "$ROOT/services/ops-web"
npm run test:unit:revops-w2

if [[ "$SKIP_E2E" == "1" ]]; then
  echo "== 3/3 playwright revops W2 — SKIPPED (--skip-e2e) =="
else
  echo "== 3/3 playwright revops W2 =="
  npm run test:e2e:revops-w2
fi

echo "OK  RevOps W2 automated gates passed."
echo "    Complete manual PO checklist: docs/evidence/revops-w2-signoff.template.json"

#!/usr/bin/env bash
# RNOS-41 — PWA lead care gate (manifest + SW + mobile cards + build + E2E)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

OPS_URL="${OPS_E2E_URL:-http://127.0.0.1:3200}"
REPORT="${REPORT:-$ROOT/.local-dev/rnos41-pwa-gate-report.json}"
pass=0
fail=0
results=()

log_ok() { pass=$((pass + 1)); results+=("{\"id\":\"$1\",\"status\":\"pass\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "PASS  $1 — $2"; }
log_fail() { fail=$((fail + 1)); results+=("{\"id\":\"$1\",\"status\":\"fail\",\"detail\":$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$2")}"); echo "FAIL  $1 — $2"; }

echo "== RNOS-41 PWA Gate =="

for f in \
  services/ops-web/src/app/manifest.ts \
  services/ops-web/public/sw.js \
  services/ops-web/public/icons/icon.svg \
  services/ops-web/src/components/pwa/PwaShell.tsx \
  services/ops-web/src/components/crm/CrmLeadsList.tsx \
  services/ops-web/e2e/pwa-rnos41.spec.ts \
  scripts/playwright_ops_pwa_e2e.sh; do
  if [[ -f "$ROOT/$f" ]]; then
    log_ok "artifact-${f//\//-}" "Present"
  else
    log_fail "artifact-${f//\//-}" "Missing $f"
  fi
done

if grep -q 'crm-leads-cards' "$ROOT/services/ops-web/src/app/globals.css"; then
  log_ok "css-mobile-cards" "crm-leads-cards in globals.css"
else
  log_fail "css-mobile-cards" "Missing mobile card CSS"
fi

if grep -q 'test:e2e:pwa' "$ROOT/services/ops-web/package.json"; then
  log_ok "npm-script" 'test:e2e:pwa in package.json'
else
  log_fail "npm-script" 'Add test:e2e:pwa script'
fi

echo "==> ops-web TypeScript check"
if (
  cd "$ROOT/services/ops-web"
  export NEXT_PUBLIC_PWA_ENABLED=1
  npx tsc --noEmit
); then
  log_ok "ops-web-typecheck" "tsc --noEmit OK"
else
  log_fail "ops-web-typecheck" "TypeScript check failed"
fi

WEB_PID=""
_wait_http() {
  local url="$1" tries="${2:-60}"
  for _ in $(seq 1 "$tries"); do
    curl -sf "$url" >/dev/null 2>&1 && return 0
    sleep 1
  done
  return 1
}

if ! curl -sf "${OPS_URL}/manifest.webmanifest" >/dev/null 2>&1; then
  echo "==> Start ops-web for manifest/SW checks"
  (
    cd "$ROOT/services/ops-web"
    export OPS_PORT="${OPS_PORT:-$(node -e "console.log(new URL(process.argv[1]).port||3200)" "$OPS_URL")}"
    export NEXT_PUBLIC_PWA_ENABLED=1
    npm run dev
  ) >/tmp/rnos41-gate-ops-web.log 2>&1 &
  WEB_PID=$!
  if _wait_http "${OPS_URL}/manifest.webmanifest" 90; then
    log_ok "ops-web-dev" "Started for gate checks"
  else
    log_fail "ops-web-dev" "Could not start ops-web — see /tmp/rnos41-gate-ops-web.log"
  fi
fi

if curl -sf "${OPS_URL}/manifest.webmanifest" >/dev/null 2>&1; then
  log_ok "manifest-http" "${OPS_URL}/manifest.webmanifest"
else
  log_fail "manifest-http" "manifest not reachable"
fi

if curl -sf "${OPS_URL}/sw.js" | grep -q 'ptt-ops-pwa-v1'; then
  log_ok "sw-http" "${OPS_URL}/sw.js"
else
  log_fail "sw-http" "Service worker not served at /sw.js"
fi

[[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
WEB_PID=""

if bash "$ROOT/scripts/playwright_ops_pwa_e2e.sh"; then
  log_ok "playwright-e2e" "pwa-rnos41.spec.ts PASS"
else
  log_fail "playwright-e2e" "Playwright PWA E2E failed"
fi

mkdir -p "$(dirname "$REPORT")"
TMP_RESULTS="$(mktemp)"
printf '%s\n' "${results[@]}" > "$TMP_RESULTS"
python3 - <<PY
import json, datetime
from pathlib import Path
lines = [l for l in Path("$TMP_RESULTS").read_text().splitlines() if l.strip()]
checks = [json.loads(l) for l in lines]
report = {
  "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  "rnos": "RNOS-41",
  "summary": {"pass": $pass, "fail": $fail},
  "checks": checks,
}
Path("$REPORT").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\\n")
print(json.dumps(report, indent=2, ensure_ascii=False))
PY
rm -f "$TMP_RESULTS"

echo ""
echo "Gate report: $REPORT"
echo "PASS=$pass FAIL=$fail"
[[ "$fail" -eq 0 ]]

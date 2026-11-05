#!/usr/bin/env bash
# RED/GREEN gate for portal standalone static copy.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=portal_web_standalone.sh
. "$ROOT/scripts/lib/portal_web_standalone.sh"

tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/portal-standalone.XXXXXX")"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

export RNOSAI_ROOT="$tmpdir"
app="$tmpdir/services/portal-web"
mkdir -p "$app"

if portal_web_verify_static; then
  echo "FAIL  verify should reject missing standalone static"
  exit 1
fi

mkdir -p "$app/.next/static/css" "$app/.next/static/chunks" "$app/public"
printf 'body{}\n' > "$app/.next/static/css/app.css"
for i in 1 2 3 4 5; do
  printf 'console.log(%s)\n' "$i" > "$app/.next/static/chunks/c$i.js"
done
printf '/* sw */\n' > "$app/public/sw.js"
printf 'window.bridge=1\n' > "$app/public/capacitor-native-bridge.js"

portal_web_sync_static

test -f "$app/.next/standalone/.next/static/css/app.css"
test -f "$app/.next/standalone/public/sw.js"
test -f "$app/.next/standalone/public/capacitor-native-bridge.js"
portal_web_verify_static >/dev/null

echo "OK  portal_web_standalone.test.sh"

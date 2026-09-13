#!/usr/bin/env bash
# systemd ExecStartPre — refuse to boot portal-web without standalone static.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/portal_web_standalone.sh
. "$ROOT/scripts/lib/portal_web_standalone.sh"
portal_web_verify_static

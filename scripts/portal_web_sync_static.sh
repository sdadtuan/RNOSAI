#!/usr/bin/env bash
# Copy .next/static + public into Next standalone. Used by npm postbuild.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=lib/portal_web_standalone.sh
. "$ROOT/scripts/lib/portal_web_standalone.sh"
portal_web_sync_static

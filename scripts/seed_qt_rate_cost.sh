#!/usr/bin/env bash
# Seed HCM 2026 Rate Card + Cost Card for package DVs + DV19.
# Idempotent. Does not grant crm_quote caps.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then set -a; # shellcheck disable=SC1091
  source "$ROOT/.env"; set +a; fi
if [[ -z "${DATABASE_URL:-}" ]]; then echo "Set DATABASE_URL in .env" >&2; exit 1; fi
node "$ROOT/scripts/seed_qt_rate_cost.js"

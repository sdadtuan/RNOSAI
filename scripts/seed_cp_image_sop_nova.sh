#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then set -a; source "$ROOT/.env"; set +a; fi
URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then echo "Set DATABASE_URL in .env" >&2; exit 1; fi

rows="$(psql "$URL" -v ON_ERROR_STOP=1 -tA -c \
  "SELECT id FROM agency_client WHERE lower(name) LIKE '%nova%' ORDER BY id LIMIT 5")"

if [[ -z "${rows// /}" ]]; then
  echo "SKIP no Nova client"
  exit 0
fi

echo "Nova agency_client id(s) for UAT bind:"
while IFS= read -r id; do
  [[ -n "$id" ]] && echo "  agency_client_id=$id"
done <<< "$rows"

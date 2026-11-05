#!/bin/sh
# Apply P13.b pricing DDL. Does not enable P13_ENABLED and does not import the catalog.
set -eu
: "${DATABASE_URL:?Set DATABASE_URL to the database you want to migrate}"
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
for f in \
  docs/specs/2026-10-02-p13-04-pricing.sql \
  docs/specs/2026-10-02-p13-09-price-caps.sql
do
  echo "apply $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/$f"
done
echo "P13.b migrations applied"

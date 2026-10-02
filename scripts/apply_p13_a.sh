#!/bin/sh
# Apply P13.a DDL on the database in DATABASE_URL.
# Does not pick a host. Point DATABASE_URL at local or staging yourself.
set -eu
: "${DATABASE_URL:?Set DATABASE_URL to the database you want to migrate}"
ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
for f in \
  docs/specs/2026-10-02-p13-01-service-catalog.sql \
  docs/specs/2026-10-02-p13-02-holidays.sql \
  docs/specs/2026-10-02-p13-03-settings-flags.sql \
  docs/specs/2026-10-02-p13-08-permissions.sql
do
  echo "apply $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/$f"
done
echo "P13.a migrations applied"

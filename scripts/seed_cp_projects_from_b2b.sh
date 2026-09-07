#!/usr/bin/env bash
# Copy crm_b2b_projects (Dự án PTT) into crm_cp_projects. Idempotent via tag b2b:<uuid>.
# Does not grant RBAC. Owner defaults to admin@pttads.vn (override CP_IMPORT_OWNER_EMAIL).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ ! -f "$ROOT/.env" && -f "${PWD}/.env" ]]; then
  ROOT="$PWD"
fi
cd "$ROOT"
if [[ -f "$ROOT/.env" ]]; then set -a; source "$ROOT/.env"; set +a; fi
URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then echo "Set DATABASE_URL in .env" >&2; exit 1; fi
OWNER_EMAIL="${CP_IMPORT_OWNER_EMAIL:-admin@pttads.vn}"

psql "$URL" -v ON_ERROR_STOP=1 -v owner_email="$OWNER_EMAIL" <<'SQL'
SELECT set_config('cp.import_owner', :'owner_email', true);

DO $$
DECLARE
  owner_email TEXT := current_setting('cp.import_owner');
  owner_id INTEGER;
  rec RECORD;
  client_id UUID;
  project_id UUID;
  tag TEXT;
  client_code TEXT;
  project_status TEXT;
BEGIN
  SELECT s.id INTO owner_id
    FROM crm_staff s
   WHERE lower(trim(s.email)) = lower(trim(owner_email))
   LIMIT 1;
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'cp import owner not found: %', owner_email;
  END IF;

  FOR rec IN
    SELECT id, code, name, status FROM crm_b2b_projects ORDER BY code
  LOOP
    tag := 'b2b:' || rec.id::text;
    IF EXISTS (
      SELECT 1 FROM crm_cp_projects p
       WHERE p.tenant_id = 'PTT' AND p.tags @> ARRAY[tag]
    ) THEN
      CONTINUE;
    END IF;

    client_code := left(upper(trim(rec.code)), 32);
    IF client_code = '' THEN
      client_code := 'PTT';
    END IF;

    INSERT INTO clients (code, name, status)
    VALUES (client_code, rec.name, 'active')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
    RETURNING id INTO client_id;

    project_status := CASE WHEN rec.status = 'active' THEN 'active' ELSE 'draft' END;

    INSERT INTO crm_cp_projects (
      tenant_id, agency_client_id, owner_staff_id, name, objective, status, tags
    ) VALUES (
      'PTT',
      client_id,
      owner_id,
      rec.name,
      'Lấy từ Dự án PTT (' || rec.code || ')',
      project_status,
      ARRAY[tag, 'b2b-code:' || rec.code]
    )
    RETURNING id INTO project_id;

    INSERT INTO crm_cp_project_members (project_id, staff_id, role)
    SELECT project_id, staff_id, 'editor'
      FROM (
        SELECT owner_id AS staff_id
        UNION
        SELECT bs.staff_id FROM crm_b2b_project_staff bs WHERE bs.project_id = rec.id
      ) m
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
SQL
echo "OK  CP projects imported from crm_b2b_projects (owner $OWNER_EMAIL)"

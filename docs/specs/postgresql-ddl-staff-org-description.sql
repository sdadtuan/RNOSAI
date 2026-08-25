-- Staff org — description (Mô tả) on departments, teams, positions
-- Apply: bash scripts/apply_pg_ddl_staff_org_description.sh

ALTER TABLE crm_departments
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE staff_teams
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

ALTER TABLE crm_positions
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN crm_departments.description IS 'Mô tả phòng ban (HR org metadata)';
COMMENT ON COLUMN staff_teams.description IS 'Mô tả team (HR org metadata)';
COMMENT ON COLUMN crm_positions.description IS 'Mô tả chức vụ (HR org metadata)';

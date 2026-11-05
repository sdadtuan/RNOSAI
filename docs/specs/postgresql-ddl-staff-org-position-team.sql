-- Staff org — positions belong to team (not department directly)
-- Apply: bash scripts/apply_pg_ddl_staff_org_position_team.sh

ALTER TABLE crm_positions
    ADD COLUMN IF NOT EXISTS team_id BIGINT REFERENCES staff_teams (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_positions_team
    ON crm_positions (team_id, active);

-- Legacy: positions no longer link to department directly.
UPDATE crm_positions SET department_id = NULL WHERE department_id IS NOT NULL;

COMMENT ON COLUMN crm_positions.team_id IS 'Team mà chức vụ thuộc về (HR org metadata)';

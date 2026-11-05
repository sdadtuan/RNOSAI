-- P13.a permissions. View for every active position. Manage for CEO and SUPER-ADMIN.
-- Down: docs/specs/2026-10-02-p13-08-permissions.down.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, 'p13_catalog', 'view'
FROM crm_positions p
WHERE COALESCE(p.active, TRUE) IS TRUE
ON CONFLICT (position_id, section_id, action) DO NOTHING;

INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, v.section_id, v.action
FROM crm_positions p
CROSS JOIN (VALUES
    ('p13_catalog', 'manage'),
    ('p13_holidays', 'manage')
) AS v(section_id, action)
WHERE lower(trim(p.code)) IN ('ceo', 'super-admin', 'super_admin')
  AND COALESCE(p.active, TRUE) IS TRUE
ON CONFLICT (position_id, section_id, action) DO NOTHING;

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-10-02-p13-08-permissions', 'P13.a p13_catalog view/manage and p13_holidays manage')
ON CONFLICT (version) DO NOTHING;

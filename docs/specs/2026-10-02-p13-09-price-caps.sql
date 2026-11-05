-- P13.b pricing caps. CEO and SUPER-ADMIN can activate. Finance can edit drafts.
-- Down: docs/specs/2026-10-02-p13-09-price-caps.down.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, v.section_id, v.action
FROM crm_positions p
CROSS JOIN (VALUES
    ('p13_pricing', 'view'),
    ('p13_pricing', 'cost.view'),
    ('p13_pricing', 'edit_draft')
) AS v(section_id, action)
WHERE lower(trim(p.code)) IN ('ceo', 'super-admin', 'super_admin', 'finance', 'svc-finance', 'ke-toan', 'tai-chinh', 'ketoan', 'accounting')
  AND COALESCE(p.active, TRUE) IS TRUE
ON CONFLICT (position_id, section_id, action) DO NOTHING;

INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, 'p13_pricing', 'activate'
FROM crm_positions p
WHERE lower(trim(p.code)) IN ('ceo', 'super-admin', 'super_admin')
  AND COALESCE(p.active, TRUE) IS TRUE
ON CONFLICT (position_id, section_id, action) DO NOTHING;

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-10-02-p13-09-price-caps', 'P13.b pricing view, cost, edit, and activate caps')
ON CONFLICT (version) DO NOTHING;

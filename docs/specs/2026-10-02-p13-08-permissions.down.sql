DELETE FROM staff_section_permissions
WHERE section_id IN ('p13_catalog', 'p13_holidays');

DELETE FROM schema_migrations WHERE version = '2026-10-02-p13-08-permissions';

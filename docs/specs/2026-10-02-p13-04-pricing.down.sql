DROP TABLE IF EXISTS crm_pricing_settings;
DROP TABLE IF EXISTS crm_pricing_roles;
DROP TABLE IF EXISTS crm_pricing_versions;
DELETE FROM schema_migrations WHERE version = '2026-10-02-p13-04-pricing';

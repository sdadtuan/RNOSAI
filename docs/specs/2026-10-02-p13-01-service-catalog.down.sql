-- Down for P13.a catalog. Drops only P13 catalog tables.

DROP TABLE IF EXISTS crm_catalog_imports;
DROP TABLE IF EXISTS crm_service_risks;
DROP TABLE IF EXISTS crm_service_kpis;
DROP TABLE IF EXISTS crm_service_deliverables;
DROP TABLE IF EXISTS crm_service_inputs;
DROP TABLE IF EXISTS crm_service_items;
DROP TABLE IF EXISTS crm_service_scope_rows;
DROP TABLE IF EXISTS crm_services;
DROP TABLE IF EXISTS crm_service_phases;
DROP TABLE IF EXISTS crm_service_levels;
DROP TABLE IF EXISTS crm_service_groups;
DROP TABLE IF EXISTS crm_p13_catalog_meta;

DELETE FROM schema_migrations WHERE version = '2026-10-02-p13-01-service-catalog';

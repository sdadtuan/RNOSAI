-- P13.a catalog. New tables only. Leaves the existing SPC catalog and lead contracts untouched.
-- Down: docs/specs/2026-10-02-p13-01-service-catalog.down.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

CREATE TABLE IF NOT EXISTS crm_service_groups (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(8) NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  TEXT,
    updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS crm_service_levels (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(16) NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    rank        INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  TEXT,
    updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS crm_service_phases (
    code        VARCHAR(1) PRIMARY KEY,
    name        TEXT NOT NULL,
    seq         INTEGER NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  TEXT,
    updated_by  TEXT
);

CREATE TABLE IF NOT EXISTS crm_services (
    id                BIGSERIAL PRIMARY KEY,
    code              VARCHAR(8) NOT NULL UNIQUE,
    group_id          BIGINT NOT NULL REFERENCES crm_service_groups(id),
    name              TEXT NOT NULL,
    sort_order        INTEGER NOT NULL DEFAULT 0,
    objective         TEXT,
    problem           TEXT,
    target_customers  TEXT,
    prerequisites     TEXT,
    exclusions        JSONB NOT NULL DEFAULT '[]'::jsonb,
    billing_model     TEXT,
    meta_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
    legacy_sku_code   VARCHAR(64),
    catalog_version   TEXT,
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by        TEXT,
    updated_by        TEXT
);

CREATE TABLE IF NOT EXISTS crm_service_scope_rows (
    id            BIGSERIAL PRIMARY KEY,
    service_id    BIGINT NOT NULL REFERENCES crm_services(id),
    sort_order    INTEGER NOT NULL,
    feature       TEXT NOT NULL,
    basic_text    TEXT,
    standard_text TEXT,
    advanced_text TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT,
    UNIQUE (service_id, sort_order)
);

CREATE TABLE IF NOT EXISTS crm_service_items (
    id                       BIGSERIAL PRIMARY KEY,
    code                     VARCHAR(32) NOT NULL UNIQUE,
    service_id               BIGINT NOT NULL REFERENCES crm_services(id),
    phase_code               VARCHAR(1) NOT NULL REFERENCES crm_service_phases(code),
    seq_in_phase             INTEGER NOT NULL DEFAULT 0,
    sort_order               INTEGER NOT NULL DEFAULT 0,
    task                     TEXT NOT NULL,
    subtask                  TEXT,
    standard                 TEXT,
    raci                     JSONB NOT NULL DEFAULT '{}'::jsonb,
    main_role_code           TEXT NOT NULL,
    tool                     TEXT,
    deliverable              TEXT,
    approval_gate            BOOLEAN NOT NULL DEFAULT FALSE,
    gate_approver            TEXT,
    min_level                TEXT NOT NULL,
    est_hours                NUMERIC(8,2) NOT NULL,
    est_hours_is_assumption  BOOLEAN NOT NULL DEFAULT TRUE,
    est_hours_source         TEXT NOT NULL DEFAULT 'seed',
    unit                     TEXT NOT NULL,
    default_qty              NUMERIC(8,2) NOT NULL DEFAULT 1,
    billable                 BOOLEAN NOT NULL DEFAULT TRUE,
    client_only              BOOLEAN NOT NULL DEFAULT FALSE,
    is_common                BOOLEAN NOT NULL DEFAULT FALSE,
    is_active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by               TEXT,
    updated_by               TEXT,
    CONSTRAINT crm_service_items_level_chk CHECK (min_level IN ('basic', 'standard', 'advanced')),
    CONSTRAINT crm_service_items_unit_chk CHECK (unit IN ('times', 'month', 'shoot_day')),
    CONSTRAINT crm_service_items_source_chk CHECK (est_hours_source IN ('seed', 'edited')),
    CONSTRAINT crm_service_items_gate_chk CHECK (gate_approver IS NULL OR gate_approver IN ('client', 'internal'))
);

CREATE INDEX IF NOT EXISTS idx_crm_service_items_service ON crm_service_items (service_id, sort_order);

CREATE TABLE IF NOT EXISTS crm_service_inputs (
    id                    BIGSERIAL PRIMARY KEY,
    service_id            BIGINT NOT NULL REFERENCES crm_services(id),
    code                  VARCHAR(32) NOT NULL UNIQUE,
    type                  TEXT,
    name                  TEXT NOT NULL,
    format_or_permission  TEXT,
    is_required           BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order            INTEGER NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by            TEXT,
    updated_by            TEXT
);

CREATE TABLE IF NOT EXISTS crm_service_deliverables (
    id                   BIGSERIAL PRIMARY KEY,
    service_id           BIGINT NOT NULL REFERENCES crm_services(id),
    code                 VARCHAR(32) NOT NULL UNIQUE,
    name                 TEXT NOT NULL,
    format               TEXT,
    owner_role_code      TEXT,
    acceptance_criteria  TEXT,
    revision_limit_text  TEXT,
    approval_gate        BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order           INTEGER NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by           TEXT,
    updated_by           TEXT
);

CREATE TABLE IF NOT EXISTS crm_service_kpis (
    id               BIGSERIAL PRIMARY KEY,
    service_id       BIGINT NOT NULL REFERENCES crm_services(id),
    code             VARCHAR(32) NOT NULL UNIQUE,
    type             TEXT,
    name             TEXT NOT NULL,
    formula          TEXT,
    data_source      TEXT,
    frequency        TEXT,
    owner_role_code  TEXT,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       TEXT,
    updated_by       TEXT
);

CREATE TABLE IF NOT EXISTS crm_service_risks (
    id               BIGSERIAL PRIMARY KEY,
    service_id       BIGINT NOT NULL REFERENCES crm_services(id),
    code             VARCHAR(32) NOT NULL UNIQUE,
    risk             TEXT NOT NULL,
    likelihood       TEXT,
    impact           TEXT,
    mitigation       TEXT,
    owner_role_code  TEXT,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by       TEXT,
    updated_by       TEXT
);

CREATE TABLE IF NOT EXISTS crm_catalog_imports (
    id               BIGSERIAL PRIMARY KEY,
    file_name        TEXT NOT NULL,
    file_sha256      TEXT NOT NULL,
    schema_version   TEXT,
    catalog_version  TEXT,
    mode             TEXT NOT NULL,
    summary_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
    run_by           TEXT,
    run_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crm_catalog_imports_mode_chk CHECK (mode IN ('dry_run', 'apply'))
);

CREATE TABLE IF NOT EXISTS crm_p13_catalog_meta (
    id                   INTEGER PRIMARY KEY DEFAULT 1,
    retainer_templates   JSONB NOT NULL DEFAULT '[]'::jsonb,
    catalog_version      TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT crm_p13_catalog_meta_one CHECK (id = 1)
);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-10-02-p13-01-catalog', 'P13.a new service catalog tables')
ON CONFLICT (version) DO NOTHING;

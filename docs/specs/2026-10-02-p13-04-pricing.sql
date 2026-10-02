-- P13.b pricing versions. New tables only.
-- Down: docs/specs/2026-10-02-p13-04-pricing.down.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

CREATE TABLE IF NOT EXISTS crm_pricing_versions (
    id                   BIGSERIAL PRIMARY KEY,
    code                 VARCHAR(32) NOT NULL UNIQUE,
    status               VARCHAR(16) NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'active', 'retired')),
    effective_from       DATE,
    effective_to         DATE,
    approved_by          TEXT,
    approved_at          TIMESTAMPTZ,
    inversion_ack        BOOLEAN NOT NULL DEFAULT FALSE,
    inversion_ack_note   TEXT,
    notes                TEXT,
    cloned_from_id       BIGINT REFERENCES crm_pricing_versions(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by           TEXT,
    updated_by           TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_pricing_one_active
    ON crm_pricing_versions ((1))
    WHERE status = 'active';

CREATE TABLE IF NOT EXISTS crm_pricing_roles (
    id                 BIGSERIAL PRIMARY KEY,
    version_id         BIGINT NOT NULL REFERENCES crm_pricing_versions(id) ON DELETE CASCADE,
    role_code          VARCHAR(32) NOT NULL,
    name               TEXT NOT NULL,
    monthly_salary     BIGINT,
    insurance_pct      NUMERIC(7,6),
    monthly_benefits   BIGINT,
    productive_hours   NUMERIC(8,2) NOT NULL DEFAULT 132,
    hourly_rate        NUMERIC(20,8),
    note               TEXT,
    UNIQUE (version_id, role_code)
);

CREATE TABLE IF NOT EXISTS crm_pricing_settings (
    version_id                         BIGINT PRIMARY KEY REFERENCES crm_pricing_versions(id) ON DELETE CASCADE,
    overhead_pct                       NUMERIC(7,6),
    margin_pct                         NUMERIC(7,6),
    vat_pct                            NUMERIC(7,6),
    rounding_unit                      INTEGER NOT NULL DEFAULT 1000,
    discount_basic_pct                 NUMERIC(7,6) NOT NULL DEFAULT 0,
    discount_standard_pct              NUMERIC(7,6),
    discount_advanced_pct              NUMERIC(7,6),
    ads_fee_pct                        NUMERIC(7,6),
    ads_fee_min_monthly                BIGINT,
    booking_fee_pct                    NUMERIC(7,6),
    discount_approval_threshold_pct    NUMERIC(7,6),
    min_margin_after_discount_pct      NUMERIC(7,6)
);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-10-02-p13-04-pricing', 'P13.b pricing versions, roles, and settings')
ON CONFLICT (version) DO NOTHING;

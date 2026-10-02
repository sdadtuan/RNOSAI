-- P13.a WorkingDayService calendar. Seed is empty.
-- Down: docs/specs/2026-10-02-p13-02-holidays.down.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

CREATE TABLE IF NOT EXISTS crm_holidays (
    id            BIGSERIAL PRIMARY KEY,
    holiday_date  DATE NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    TEXT,
    updated_by    TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    ('2026-10-02-p13-02-holidays', 'P13.a crm_holidays empty calendar')
ON CONFLICT (version) DO NOTHING;

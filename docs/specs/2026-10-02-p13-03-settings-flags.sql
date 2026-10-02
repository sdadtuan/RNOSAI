-- P13.a flags. crm_quote_settings already exists (policy_json).
-- No column change and no update of existing rows, so Quote OS behavior stays the same.
-- Override shape, written later by CEO/SUPER-ADMIN:
--   policy_json.p13_flags = { "P13_ENABLED": true }
-- Env P13_* wins until that object contains the key.
-- Down: docs/specs/2026-10-02-p13-03-settings-flags.down.sql

CREATE TABLE IF NOT EXISTS schema_migrations (
    version     VARCHAR(64) PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_migrations (version, description) VALUES
    (
        '2026-10-02-p13-03-settings-flags',
        'P13 flags: env P13_* with optional crm_quote_settings.policy_json.p13_flags override'
    )
ON CONFLICT (version) DO NOTHING;

-- AE team desk, phase 1. version 20261013_ae_team_g1 (19 chars)

CREATE TABLE IF NOT EXISTS crm_ae_intake (
  staff_id INTEGER PRIMARY KEY,
  accepting BOOLEAN NOT NULL DEFAULT TRUE,
  note TEXT NOT NULL DEFAULT '',
  updated_by INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_ae_targets (
  staff_id INTEGER NOT NULL,
  month CHAR(7) NOT NULL,
  quota_vnd BIGINT,
  PRIMARY KEY (staff_id, month)
);

CREATE TABLE IF NOT EXISTS crm_ae_team_daily (
  staff_id INTEGER NOT NULL,
  day DATE NOT NULL,
  counts_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (staff_id, day)
);

CREATE TABLE IF NOT EXISTS crm_ae_instruction_reads (
  activity_id BIGINT NOT NULL,
  staff_id INTEGER NOT NULL,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, staff_id)
);

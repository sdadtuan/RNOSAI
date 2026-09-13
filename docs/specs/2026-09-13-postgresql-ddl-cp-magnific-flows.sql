-- Wave B+ — Magnific Spaces Flows (SPEC-CP-MAGNIFIC-FLOWS v1.0)
-- Cache GET /v1/ai/flows/{sqid} definitions; TTL enforced in application code.

CREATE TABLE IF NOT EXISTS crm_cp_magnific_flow_cache (
  sqid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  inputs_schema_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_cost INT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS crm_cp_magnific_flow_cache_expires_idx
  ON crm_cp_magnific_flow_cache (expires_at);

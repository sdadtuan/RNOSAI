-- MKT-AI Planner Phase 4 depth Wave 3 (WS-P4-09 / MKTP-UC-028)
-- Run once before enabling PTT_MKT_AI_KPI_CLOSED_LOOP=1

ALTER TABLE mkt_ai_drafts
  ADD COLUMN IF NOT EXISTS competitor_snapshot_json JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE mkt_ai_drafts
  ADD COLUMN IF NOT EXISTS kpi_tree_applied_json JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN mkt_ai_drafts.competitor_snapshot_json IS 'Competitor positioning snapshot for strategy step (MKTP-UC-028)';
COMMENT ON COLUMN mkt_ai_drafts.kpi_tree_applied_json IS 'KPI tree snapshot at last TMMT Apply — source for closed-loop targets';

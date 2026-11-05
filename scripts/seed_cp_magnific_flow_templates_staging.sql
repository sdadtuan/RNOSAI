-- Seed Magnific Flow templates for staging (Wave B+).
-- Run ONLY after publishing the Flow in Magnific Spaces and replacing REPLACE_WITH_SQID.
--
-- Apply:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/seed_cp_magnific_flow_templates_staging.sql
--
-- Pilot template_key: social_916_i2v
-- Prompt samples: docs/magnific/social-916-flow-api-runs.json

BEGIN;

-- Stable UUID — do not change after first staging apply (batch/job refs may point here).
-- social_916_i2v · Social 9:16 · Image → Video
INSERT INTO crm_cp_templates (
  id,
  tenant_id,
  name,
  version,
  variables_json,
  rules_json,
  status
) VALUES (
  'f9169160-0009-4116-8000-000000000001',
  'PTT',
  'Social 9:16 · Image → Video',
  1,
  '["image_prompt", "motion_prompt"]'::jsonb,
  '{"template_key":"social_916_i2v","unit_credits":5,"description":"Magnific Flow pilot — text prompts only"}'::jsonb,
  'published'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  variables_json = EXCLUDED.variables_json,
  rules_json = EXCLUDED.rules_json,
  status = EXCLUDED.status;

INSERT INTO crm_cp_provider_template_map (
  template_id,
  provider,
  external_ref,
  bindings_json,
  active
) VALUES (
  'f9169160-0009-4116-8000-000000000001',
  'magnific_rest',
  'REPLACE_WITH_SQID',
  jsonb_build_object(
    'execution_kind', 'flow',
    'flow_sqid', 'REPLACE_WITH_SQID',
    'input_bindings', jsonb_build_object(
      'image_prompt', jsonb_build_object(
        'source', 'prompt_field',
        'key', 'image_prompt',
        'required', true
      ),
      'motion_prompt', jsonb_build_object(
        'source', 'prompt_field',
        'key', 'motion_prompt',
        'required', true
      )
    ),
    'defaults', jsonb_build_object(
      'aspect_ratio', '9:16',
      'duration_sec', 5
    ),
    'estimate_credits', 5,
    'requires_render_high_cost', true,
    'output_expectation', jsonb_build_object(
      'videos_min', 1,
      'mime', jsonb_build_array('video/mp4')
    )
  ),
  TRUE
)
ON CONFLICT (template_id, provider) DO UPDATE SET
  external_ref = EXCLUDED.external_ref,
  bindings_json = EXCLUDED.bindings_json,
  active = EXCLUDED.active;

COMMIT;

-- Post-check (manual):
-- SELECT t.name, m.external_ref, m.bindings_json->>'flow_sqid'
--   FROM crm_cp_templates t
--   JOIN crm_cp_provider_template_map m ON m.template_id = t.id
--  WHERE t.id = 'f9169160-0009-4116-8000-000000000001';

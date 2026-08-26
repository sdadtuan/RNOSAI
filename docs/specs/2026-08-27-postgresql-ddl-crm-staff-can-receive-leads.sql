-- Flag on crm_staff: employee may be added to B2B project lead pools.
BEGIN;

ALTER TABLE crm_staff
    ADD COLUMN IF NOT EXISTS can_receive_leads BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE crm_staff s
SET can_receive_leads = TRUE
WHERE s.can_receive_leads = FALSE
  AND (
    EXISTS (
      SELECT 1
      FROM crm_staff_assign_scope sc
      WHERE sc.staff_id = s.id AND sc.active IS TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM crm_b2b_project_staff ps
      WHERE ps.staff_id = s.id AND ps.assign_enabled IS TRUE
    )
  );

INSERT INTO schema_migrations (version, description)
VALUES (
    '2026-08-27-crm-staff-can-receive-leads',
    'crm_staff.can_receive_leads for B2B project staff picker'
)
ON CONFLICT (version) DO NOTHING;

COMMIT;

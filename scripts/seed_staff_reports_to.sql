-- Wire active staff reports_to when empty, by position.
-- Safe to re-run. Does not change SUPER-ADMIN or CEO (top of tree).
--
-- Hierarchy (interim ops tree):
--   AE  → ACM
--   ACM → CEO
--   CE  → MKL
--   GD  → MKL
--   MEP → MKL
--   MKL → CEO
--   PD  → CEO
--   GDKD → CEO

WITH first_by_pos AS (
  SELECT upper(trim(p.code)) AS code, min(s.id) AS staff_id
    FROM crm_staff s
    JOIN crm_positions p ON p.id = s.position_id
   WHERE s.active = TRUE
   GROUP BY upper(trim(p.code))
),
wanted AS (
  SELECT s.id AS staff_id, target.staff_id AS manager_id
    FROM crm_staff s
    JOIN crm_positions p ON p.id = s.position_id
    JOIN first_by_pos target ON target.code = CASE upper(trim(p.code))
      WHEN 'AE' THEN 'ACM'
      WHEN 'ACM' THEN 'CEO'
      WHEN 'CE' THEN 'MKL'
      WHEN 'GD' THEN 'MKL'
      WHEN 'MEP' THEN 'MKL'
      WHEN 'MKL' THEN 'CEO'
      WHEN 'PD' THEN 'CEO'
      WHEN 'GDKD' THEN 'CEO'
      ELSE NULL
    END
   WHERE s.active = TRUE
     AND s.reports_to_id IS NULL
     AND target.staff_id IS NOT NULL
     AND s.id <> target.staff_id
)
UPDATE crm_staff s
SET reports_to_id = w.manager_id,
    updated_at = NOW()
FROM wanted w
WHERE s.id = w.staff_id;

-- Prefill empty To on open daily drafts from author's reports_to (or ACM/CEO fallback).
WITH draft AS (
  SELECT r.id AS report_id,
         r.author_staff_id,
         COALESCE(
           a.reports_to_id,
           (SELECT m.id FROM crm_staff m
              JOIN crm_positions mp ON mp.id = m.position_id
             WHERE m.active AND upper(trim(mp.code)) = 'ACM'
             ORDER BY m.id LIMIT 1),
           (SELECT m.id FROM crm_staff m
              JOIN crm_positions mp ON mp.id = m.position_id
             WHERE m.active AND upper(trim(mp.code)) = 'CEO'
             ORDER BY m.id LIMIT 1)
         ) AS to_id
    FROM iwr_reports r
    JOIN iwr_templates t ON t.id = r.template_id
    JOIN crm_staff a ON a.id = r.author_staff_id
   WHERE r.is_deleted = FALSE
     AND r.status IN ('draft', 'changes_requested')
     AND t.code = 'daily_work'
     AND NOT EXISTS (
       SELECT 1 FROM iwr_report_recipients rec
        WHERE rec.report_id = r.id AND rec.kind = 'to'
     )
),
upd AS (
  UPDATE iwr_reports r
     SET reviewer_staff_id = d.to_id
    FROM draft d
   WHERE r.id = d.report_id
     AND d.to_id IS NOT NULL
     AND r.author_staff_id <> d.to_id
  RETURNING r.id, d.to_id
)
INSERT INTO iwr_report_recipients (tenant_id, report_id, staff_id, kind)
SELECT 'PTT', u.id, u.to_id, 'to'
  FROM upd u
 WHERE NOT EXISTS (
   SELECT 1 FROM iwr_report_recipients rec
    WHERE rec.report_id = u.id AND rec.kind = 'to'
 );

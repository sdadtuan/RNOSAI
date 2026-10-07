-- Point active AE staff at the first active ACM when reports_to is empty.
-- Safe to re-run.
UPDATE crm_staff s
SET reports_to_id = mgr.id,
    updated_at = NOW()
FROM crm_positions p,
     LATERAL (
       SELECT m.id
         FROM crm_staff m
         JOIN crm_positions mp ON mp.id = m.position_id
        WHERE m.active = TRUE AND upper(trim(mp.code)) = 'ACM'
        ORDER BY m.id
        LIMIT 1
     ) mgr
WHERE s.position_id = p.id
  AND s.active = TRUE
  AND upper(trim(p.code)) = 'AE'
  AND s.reports_to_id IS NULL
  AND mgr.id IS NOT NULL
  AND s.id <> mgr.id;

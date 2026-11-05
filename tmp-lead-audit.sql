SET statement_timeout = '30s';

SELECT count(*) AS total,
       count(*) FILTER (WHERE is_duplicate IS TRUE) AS duplicates,
       count(*) FILTER (WHERE created_at > now() - interval '24 hours') AS created_24h,
       count(*) FILTER (WHERE created_at > now() - interval '7 days') AS created_7d
FROM crm_leads;

SELECT status, count(*) AS n
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
GROUP BY 1
ORDER BY 2 DESC
LIMIT 20;

SELECT COALESCE(NULLIF(lower(trim(meta_json->>'lead_flow_kind')), ''), '(unset)') AS flow, count(*) AS n
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
  AND created_at > now() - interval '30 days'
GROUP BY 1
ORDER BY 2 DESC;

SELECT count(*) AS in_queue,
       count(*) FILTER (WHERE owner_id IS NULL) AS no_owner,
       count(*) FILTER (WHERE owner_id IS NOT NULL) AS still_owned,
       count(*) FILTER (WHERE COALESCE(care_stages_done_json->>'first_contact','') <> '') AS b2_done_but_queued
FROM crm_leads
WHERE COALESCE(meta_json->'review_queue'->>'active','') = 'true'
  AND is_duplicate IS NOT TRUE;

SELECT COALESCE(NULLIF(meta_json->'review_queue'->>'reason',''), '(none)') AS reason, count(*) AS n
FROM crm_leads
WHERE COALESCE(meta_json->'review_queue'->>'active','') = 'true'
  AND is_duplicate IS NOT TRUE
GROUP BY 1
ORDER BY 2 DESC;

SELECT count(*) FILTER (WHERE age_h < 24) AS under_24h,
       count(*) FILTER (WHERE age_h >= 24 AND age_h < 72) AS h24_72,
       count(*) FILTER (WHERE age_h >= 72) AS over_72h,
       round(max(age_h)::numeric, 1) AS max_h
FROM (
  SELECT EXTRACT(EPOCH FROM (now() - (meta_json->'review_queue'->>'queued_at')::timestamptz)) / 3600 AS age_h
  FROM crm_leads
  WHERE COALESCE(meta_json->'review_queue'->>'active','') = 'true'
    AND is_duplicate IS NOT TRUE
    AND (meta_json->'review_queue'->>'queued_at') ~ '^[0-9]{4}-'
) s;

SELECT count(*) AS overdue_not_queued
FROM crm_leads l
WHERE l.is_duplicate IS NOT TRUE
  AND l.owner_id IS NOT NULL
  AND l.status NOT IN ('lost', 'won', 'chot')
  AND COALESCE(l.meta_json->'review_queue'->>'active','') <> 'true'
  AND COALESCE(l.care_stages_done_json->>'first_contact','') = ''
  AND l.assigned_at IS NOT NULL
  AND l.assigned_at < now() - interval '24 hours';

SELECT status, count(*) AS n
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
  AND status IN ('won', 'chot')
  AND COALESCE(care_stages_done_json->>'first_contact','') = ''
GROUP BY 1;

SELECT status, count(*) AS n
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
  AND COALESCE(care_stages_done_json->>'first_contact','') <> ''
GROUP BY 1
ORDER BY 2 DESC
LIMIT 15;

SELECT COALESCE(NULLIF(last_call_result, ''), '(none)') AS result, count(*) AS n
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
  AND status NOT IN ('lost', 'won', 'chot')
  AND COALESCE(care_stages_done_json->>'first_contact','') = ''
GROUP BY 1
ORDER BY 2 DESC
LIMIT 12;

SELECT count(*) AS open_short_phone
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
  AND status NOT IN ('lost', 'won', 'chot')
  AND length(trim(COALESCE(phone, ''))) < 8;

SELECT count(*) AS fresh_24h_no_call
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
  AND created_at > now() - interval '24 hours'
  AND last_call_at IS NULL;

SELECT count(*) AS unassigned_7d_not_queued
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
  AND owner_id IS NULL
  AND created_at > now() - interval '7 days'
  AND COALESCE(meta_json->'review_queue'->>'active','') <> 'true';

SELECT count(*) FILTER (WHERE active IS TRUE) AS active_staff,
       count(*) FILTER (WHERE active IS TRUE AND COALESCE(can_receive_leads, FALSE)) AS can_receive,
       count(*) FILTER (
         WHERE active IS TRUE
           AND COALESCE(can_receive_leads, FALSE)
           AND NOT EXISTS (
             SELECT 1 FROM crm_ae_intake i
             WHERE i.staff_id = crm_staff.id AND i.accepting IS FALSE
           )
       ) AS eligible_now
FROM crm_staff;

SELECT config_json->>'b2_review_queue_enabled' AS review_on,
       config_json->>'b2_contact_deadline_hours' AS deadline_h
FROM crm_lead_settings
WHERE config_key = 'global';

SELECT payload->'feature_flags'->>'lead_sla_reassign_enabled' AS reassign_on,
       payload->'feature_flags'->>'lead_sla_reassign_dry_run' AS reassign_dry_run,
       is_active,
       published_at
FROM crm_lead_sla_settings
WHERE tenant_id = 'default';

SELECT COALESCE(NULLIF(source, ''), '(empty)') AS source, count(*) AS n
FROM crm_leads
WHERE is_duplicate IS NOT TRUE
  AND created_at > now() - interval '7 days'
GROUP BY 1
ORDER BY 2 DESC
LIMIT 12;

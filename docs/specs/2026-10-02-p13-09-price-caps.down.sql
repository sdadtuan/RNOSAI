DELETE FROM staff_section_permissions
WHERE section_id = 'p13_pricing'
  AND action IN ('view', 'cost.view', 'edit_draft', 'activate');
DELETE FROM schema_migrations WHERE version = '2026-10-02-p13-09-price-caps';

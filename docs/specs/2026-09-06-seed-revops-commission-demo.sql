-- RevOps W3 commission demo seed — idempotent (2026-09-06)
-- 2 published plans (AE + AM), 1 draft plan, tiers, sample transactions, Sep 2026 payout batch.

-- AE Standard 2026 v1 (published)
INSERT INTO crm_revops_commission_plans (
  id, tenant_id, name, version, effective_from, effective_to, revenue_basis, role_code, status
) VALUES (
  'c0000001-0000-4000-8000-000000000001',
  'PTT',
  'AE Standard 2026',
  1,
  '2026-01-01',
  NULL,
  'collected',
  'ae',
  'published'
) ON CONFLICT (tenant_id, name, version) DO NOTHING;

INSERT INTO crm_revops_commission_tiers (id, plan_id, min_attainment_pct, max_attainment_pct, rate_pct)
VALUES
  ('c0000011-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 0, 79.99, 3),
  ('c0000012-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 80, 99.99, 5),
  ('c0000013-0000-4000-8000-000000000001', 'c0000001-0000-4000-8000-000000000001', 100, NULL, 7)
ON CONFLICT (id) DO NOTHING;

-- AM Retention 2026 v1 (published)
INSERT INTO crm_revops_commission_plans (
  id, tenant_id, name, version, effective_from, effective_to, revenue_basis, role_code, status
) VALUES (
  'c0000002-0000-4000-8000-000000000002',
  'PTT',
  'AM Retention 2026',
  1,
  '2026-01-01',
  NULL,
  'booked',
  'am',
  'published'
) ON CONFLICT (tenant_id, name, version) DO NOTHING;

INSERT INTO crm_revops_commission_tiers (id, plan_id, min_attainment_pct, max_attainment_pct, rate_pct)
VALUES
  ('c0000021-0000-4000-8000-000000000002', 'c0000002-0000-4000-8000-000000000002', 0, 89.99, 2),
  ('c0000022-0000-4000-8000-000000000002', 'c0000002-0000-4000-8000-000000000002', 90, NULL, 4)
ON CONFLICT (id) DO NOTHING;

-- AE Pilot Q4 (draft — for Plan modal UAT)
INSERT INTO crm_revops_commission_plans (
  id, tenant_id, name, version, effective_from, effective_to, revenue_basis, role_code, status
) VALUES (
  'c0000003-0000-4000-8000-000000000003',
  'PTT',
  'AE Pilot Q4',
  1,
  '2026-10-01',
  '2026-12-31',
  'weighted',
  'ae',
  'draft'
) ON CONFLICT (tenant_id, name, version) DO NOTHING;

INSERT INTO crm_revops_commission_tiers (id, plan_id, min_attainment_pct, max_attainment_pct, rate_pct)
VALUES
  ('c0000031-0000-4000-8000-000000000003', 'c0000003-0000-4000-8000-000000000003', 0, NULL, 4)
ON CONFLICT (id) DO NOTHING;

-- Payout batch Sep 2026 (draft)
INSERT INTO crm_revops_payout_batches (id, tenant_id, period, status)
VALUES (
  'c0000100-0000-4000-8000-000000000001',
  'PTT',
  '2026-09',
  'draft'
) ON CONFLICT (id) DO NOTHING;

-- Sample transactions (staff from crm_staff on prod VPS)
INSERT INTO crm_revops_commission_transactions (
  id, tenant_id, deal_ref, staff_id, eligible_vnd, rate_pct, split_pct, commission_vnd, status, payout_batch_id
) VALUES
  (
    'c0000201-0000-4000-8000-000000000001',
    'PTT',
    'DEAL-DEMO-001',
    6,
    500000000,
    5,
    100,
    25000000,
    'approved',
    'c0000100-0000-4000-8000-000000000001'
  ),
  (
    'c0000202-0000-4000-8000-000000000002',
    'PTT',
    'DEAL-DEMO-002',
    8,
    200000000,
    5,
    100,
    10000000,
    'pending_collection',
    NULL
  ),
  (
    'c0000203-0000-4000-8000-000000000003',
    'PTT',
    'DEAL-DEMO-003',
    9,
    150000000,
    7,
    100,
    10500000,
    'pending_finance',
    NULL
  ),
  (
    'c0000204-0000-4000-8000-000000000004',
    'PTT',
    'DEAL-DEMO-004',
    6,
    80000000,
    3,
    100,
    2400000,
    'paid',
    'c0000100-0000-4000-8000-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

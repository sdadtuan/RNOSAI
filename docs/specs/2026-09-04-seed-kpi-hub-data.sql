-- KPI Hub seed data — idempotent (2026-09-04)
-- 22 KPI dictionary, 7 connections, Sep 2026 targets

-- Workspace (already in P1 DDL, safe to re-run)
INSERT INTO crm_kpi_hub_workspaces (
  id, tenant_id, name, company, timezone, locale, currency, week_start,
  default_period_grain, close_day, reconcile_day, lock_closed_periods,
  allow_reopen, require_kpi_approval, auto_quality, alerts_enabled, maintenance_mode
) VALUES (
  'a0000000-0000-4000-8000-000000000001',
  'PTT',
  'KPI Hub - Marketing & Sales',
  'PTT Digital',
  'Asia/Ho_Chi_Minh',
  'vi',
  'VND',
  'MONDAY',
  'MONTH',
  3,
  5,
  TRUE,
  FALSE,
  TRUE,
  TRUE,
  TRUE,
  FALSE
) ON CONFLICT (id) DO NOTHING;

-- Source connections (7)
INSERT INTO crm_kpi_source_connections (id, tenant_id, workspace_id, system, name, external_ref, sla_minutes, last_success_at, last_error, status)
VALUES
  ('b0000001-0000-4000-8000-000000000001', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'CRM', 'CRM Leads & Deals', 'crm-leads-prod', 60, '2026-09-04T01:30:00Z', NULL, 'FRESH'),
  ('b0000002-0000-4000-8000-000000000002', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'META_ADS', 'Meta Ads Insights', 'meta-ads-act_123', 120, '2026-09-04T01:15:00Z', NULL, 'FRESH'),
  ('b0000003-0000-4000-8000-000000000003', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SHAREPOINT', 'SharePoint Campaign Mapping', 'sp-campaign-lookup', 60, '2026-09-03T23:30:00Z', NULL, 'DELAYED'),
  ('b0000004-0000-4000-8000-000000000004', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'ERP', 'ERP Finance', 'erp-finance-prod', 240, '2026-09-04T00:00:00Z', NULL, 'FRESH'),
  ('b0000005-0000-4000-8000-000000000005', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'GOOGLE_ADS', 'Google Ads', 'google-ads-prod', 120, '2026-09-04T01:00:00Z', NULL, 'FRESH'),
  ('b0000006-0000-4000-8000-000000000006', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'GA4', 'Google Analytics 4', 'ga4-prod', 180, NULL, 'Connector chưa kích hoạt', 'UNKNOWN'),
  ('b0000007-0000-4000-8000-000000000007', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'GOOGLE_ADS', 'TikTok Ads', 'tiktok-ads-prod', 120, '2026-09-04T00:45:00Z', NULL, 'FRESH')
ON CONFLICT (id) DO NOTHING;

-- Dictionary (22 KPI)
INSERT INTO crm_kpi_dictionary (
  id, tenant_id, workspace_id, code, name, description, kpi_group, kpi_group_color,
  direction, unit, decimal_places, calc_kind, formula_display, tech_preview, business_formula,
  blank_if_zero, non_additive_ratio, allow_manual, numerator_code, denominator_code,
  primary_source, sync_frequency, kpi_owner_json, data_owner_json, status, current_version,
  published_at, row_version
) VALUES
  ('a0000001-0000-4000-8000-000000000001', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_001', 'Tổng Raw Leads', 'Tổng lead thô trước lọc valid.', 'Acquisition', '#3B82F6', 'HIGHER_IS_BETTER', 'Lead', 0, 'COUNT', 'DISTINCTCOUNT(Leads[Lead_ID])', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'SharePoint/CRM', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000002-0000-4000-8000-000000000002', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_002', 'Tổng Valid Leads', 'Lead hợp lệ, không trùng, không test.', 'Acquisition', '#3B82F6', 'HIGHER_IS_BETTER', 'Lead', 0, 'COUNT', 'DISTINCTCOUNT(Leads[Lead_ID]) WHERE Is_Valid=TRUE', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000003-0000-4000-8000-000000000003', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_003', 'Valid Lead Rate', NULL, 'Acquisition', '#3B82F6', 'HIGHER_IS_BETTER', '%', 1, 'RATIO', NULL, 'DIVIDE([MKT_002], [MKT_001])', 'Valid Lead Rate = MKT_002 ÷ MKT_001', TRUE, TRUE, FALSE, 'MKT_002', 'MKT_001', 'CRM/SharePoint', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000004-0000-4000-8000-000000000004', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_004', 'Tổng chi tiêu quảng cáo', NULL, 'Media Efficiency', '#10B981', 'LOWER_IS_BETTER', 'VND', 0, 'SUM', 'SUM(AdInsights[Spend])', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'Meta/Google/TikTok Ads', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000005-0000-4000-8000-000000000005', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_005', 'CPL Raw Lead', NULL, 'Media Efficiency', '#10B981', 'LOWER_IS_BETTER', 'VND/Lead', 0, 'RATIO', NULL, 'DIVIDE([MKT_004], [MKT_001])', 'CPL Raw Lead = Chi tiêu quảng cáo ÷ Raw Leads', TRUE, TRUE, FALSE, 'MKT_004', 'MKT_001', 'Ads + SharePoint', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000006-0000-4000-8000-000000000006', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_006', 'CPL Valid Lead', 'Chi phí trên mỗi Valid Lead từ các kênh quảng cáo trả phí.', 'Media Efficiency', '#10B981', 'LOWER_IS_BETTER', 'VND/Lead', 0, 'RATIO', 'DIVIDE([Tổng chi tiêu quảng cáo], [Tổng Valid Leads])', 'DIVIDE([MKT_004], [MKT_002])', 'CPL Valid Lead = Tổng chi tiêu quảng cáo ÷ Tổng Valid Leads', TRUE, TRUE, FALSE, 'MKT_004', 'MKT_002', 'Ads + CRM', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000007-0000-4000-8000-000000000007', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_007', 'Tổng MQL', NULL, 'Funnel', '#8B5CF6', 'HIGHER_IS_BETTER', 'Lead', 0, 'COUNT', 'DISTINCTCOUNT(Leads[Lead_ID]) WHERE status=''MQL''', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000008-0000-4000-8000-000000000008', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_008', 'MQL Rate', NULL, 'Funnel', '#8B5CF6', 'HIGHER_IS_BETTER', '%', 1, 'RATIO', NULL, 'DIVIDE([MKT_007], [MKT_002])', 'MQL Rate = MKT_007 ÷ MKT_002', TRUE, TRUE, FALSE, 'MKT_007', 'MKT_002', 'CRM', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000009-0000-4000-8000-000000000009', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'MKT_009', 'ROAS', NULL, 'Media Efficiency', '#10B981', 'HIGHER_IS_BETTER', 'x', 1, 'RATIO', NULL, 'DIVIDE([SAL_008], [MKT_004])', 'ROAS = Doanh thu ký mới ÷ Chi tiêu quảng cáo', TRUE, TRUE, FALSE, 'SAL_008', 'MKT_004', 'Ads/CRM/ERP', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000010-0000-4000-8000-000000000010', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SAL_001', 'Tổng SQL', NULL, 'Funnel', '#8B5CF6', 'HIGHER_IS_BETTER', 'Lead', 0, 'COUNT', 'DISTINCTCOUNT(Leads[Lead_ID]) WHERE status=''SQL''', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":103,"name":"Trần Văn Hùng","email":"sales.mgr@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000011-0000-4000-8000-000000000011', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SAL_002', 'SQL Rate', NULL, 'Funnel', '#8B5CF6', 'HIGHER_IS_BETTER', '%', 1, 'RATIO', NULL, NULL, NULL, TRUE, TRUE, FALSE, 'SAL_001', 'MKT_007', 'CRM', 'Hàng ngày 08:00', '{"id":103,"name":"Trần Văn Hùng","email":"sales.mgr@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000012-0000-4000-8000-000000000012', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SAL_003', 'Tổng cuộc hẹn', NULL, 'Funnel', '#8B5CF6', 'HIGHER_IS_BETTER', 'Cuộc hẹn', 0, 'COUNT', NULL, NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":103,"name":"Trần Văn Hùng","email":"sales.mgr@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000013-0000-4000-8000-000000000013', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SAL_004', 'Show-up Rate', NULL, 'Funnel', '#8B5CF6', 'HIGHER_IS_BETTER', '%', 1, 'RATIO', NULL, NULL, 'Show-up Rate = Completed appointments ÷ Valid appointments', TRUE, TRUE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":103,"name":"Trần Văn Hùng","email":"sales.mgr@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000014-0000-4000-8000-000000000014', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SAL_005', 'Pipeline Value', NULL, 'Sales Outcome', '#F59E0B', 'HIGHER_IS_BETTER', 'VND', 0, 'SUM', 'SUM(Deals[Amount]) WHERE status=Open', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":103,"name":"Trần Văn Hùng","email":"sales.mgr@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000015-0000-4000-8000-000000000015', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SAL_007', 'Win Rate', NULL, 'Sales Outcome', '#F59E0B', 'HIGHER_IS_BETTER', '%', 1, 'RATIO', NULL, NULL, 'Win Rate = Won ÷ (Won + Lost)', TRUE, TRUE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":103,"name":"Trần Văn Hùng","email":"sales.mgr@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000016-0000-4000-8000-000000000016', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SAL_008', 'Doanh thu ký mới', 'Doanh thu hợp đồng ký mới — khác FIN_001/FIN_002.', 'Sales Outcome', '#F59E0B', 'HIGHER_IS_BETTER', 'VND', 0, 'SUM', 'SUM(Contracts[Value]) WHERE status=Won/Signed', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":103,"name":"Trần Văn Hùng","email":"sales.mgr@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000017-0000-4000-8000-000000000017', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'SAL_WON', 'Deal Won (count)', NULL, 'Sales Outcome', '#F59E0B', 'HIGHER_IS_BETTER', 'Deal', 0, 'COUNT', NULL, NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'CRM', 'Hàng ngày 08:00', '{"id":103,"name":"Trần Văn Hùng","email":"sales.mgr@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000018-0000-4000-8000-000000000018', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'FIN_001', 'Doanh thu xuất hóa đơn', NULL, 'Finance', '#6366F1', 'HIGHER_IS_BETTER', 'VND', 0, 'SUM', 'SUM(Invoices[Amount]) WHERE valid=TRUE', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'ERP', 'Hàng ngày 08:00', '{"id":104,"name":"Lê Minh Tuấn","email":"finance@ptt.vn"}', '{"id":104,"name":"Lê Minh Tuấn","email":"finance@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000019-0000-4000-8000-000000000019', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'FIN_002', 'Doanh thu thu tiền', NULL, 'Finance', '#6366F1', 'HIGHER_IS_BETTER', 'VND', 0, 'SUM', 'SUM(Payments[Amount]) WHERE cleared=TRUE', NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'ERP/Bank', 'Hàng ngày 08:00', '{"id":104,"name":"Lê Minh Tuấn","email":"finance@ptt.vn"}', '{"id":104,"name":"Lê Minh Tuấn","email":"finance@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000020-0000-4000-8000-000000000020', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'FIN_003', 'CAC', NULL, 'Finance', '#6366F1', 'LOWER_IS_BETTER', 'VND/KH', 0, 'RATIO', NULL, NULL, 'CAC = (Marketing Cost + Sales Cost) ÷ New Customers', TRUE, TRUE, FALSE, NULL, NULL, 'Ads/CRM/Finance', 'Hàng ngày 08:00', '{"id":104,"name":"Lê Minh Tuấn","email":"finance@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000021-0000-4000-8000-000000000021', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'OPS_001', 'Lead Response Time', NULL, 'Operations', '#64748B', 'LOWER_IS_BETTER', 'Phút', 0, 'AVG', NULL, NULL, NULL, FALSE, FALSE, FALSE, NULL, NULL, 'CRM/Call Center', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'ACTIVE', 1, '2026-08-15T03:00:00Z', 1),
  ('a0000022-0000-4000-8000-000000000022', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'OPS_002', 'Lead Contact Rate', 'Contacted Valid Leads ÷ MKT_002 — cần rà soát mapping.', 'Operations', '#64748B', 'HIGHER_IS_BETTER', '%', 1, 'RATIO', NULL, NULL, NULL, TRUE, TRUE, FALSE, 'MKT_002', 'MKT_002', 'CRM/Call Center', 'Hàng ngày 08:00', '{"id":101,"name":"Performance MKT","email":"perf.mkt@ptt.vn"}', '{"id":102,"name":"Nguyễn Thị Lan","email":"data.steward@ptt.vn"}', 'NEED_REVIEW', 1, '2026-08-15T03:00:00Z', 1)
ON CONFLICT DO NOTHING;

-- Period targets Sep 2026
INSERT INTO crm_kpi_period_targets (
  id, tenant_id, workspace_id, dictionary_id, period_start, period_end, grain,
  scope_type, scope_hash, target_value, warning_value, critical_value, direction, alerts_enabled, hierarchy_level
) VALUES
  ('c0000001-0000-4000-8000-000000000001', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'a0000006-0000-4000-8000-000000000006', '2026-09-01', '2026-09-30', 'MONTH', 'ORGANIZATION', 'org', 150000, 180000, 220000, 'LOWER_IS_BETTER', TRUE, 'WORKSPACE'),
  ('c0000002-0000-4000-8000-000000000002', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'a0000008-0000-4000-8000-000000000008', '2026-09-01', '2026-09-30', 'MONTH', 'ORGANIZATION', 'org', 30, 25, 20, 'HIGHER_IS_BETTER', TRUE, 'WORKSPACE'),
  ('c0000003-0000-4000-8000-000000000003', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'a0000015-0000-4000-8000-000000000015', '2026-09-01', '2026-09-30', 'MONTH', 'ORGANIZATION', 'org', 20, 15, 12, 'HIGHER_IS_BETTER', TRUE, 'WORKSPACE'),
  ('c0000004-0000-4000-8000-000000000004', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'a0000016-0000-4000-8000-000000000016', '2026-09-01', '2026-09-30', 'MONTH', 'ORGANIZATION', 'org', 1200000000, 1000000000, 800000000, 'HIGHER_IS_BETTER', TRUE, 'WORKSPACE'),
  ('c0000005-0000-4000-8000-000000000005', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'a0000002-0000-4000-8000-000000000002', '2026-09-01', '2026-09-30', 'MONTH', 'ORGANIZATION', 'org', 1400, 1200, 1000, 'HIGHER_IS_BETTER', TRUE, 'WORKSPACE'),
  ('c0000006-0000-4000-8000-000000000006', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'a0000004-0000-4000-8000-000000000004', '2026-09-01', '2026-09-30', 'MONTH', 'ORGANIZATION', 'org', 220000000, 250000000, 280000000, 'LOWER_IS_BETTER', TRUE, 'WORKSPACE'),
  ('c0000007-0000-4000-8000-000000000007', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'a0000020-0000-4000-8000-000000000020', '2026-09-01', '2026-09-30', 'MONTH', 'ORGANIZATION', 'org', 5000000, 6000000, 7500000, 'LOWER_IS_BETTER', TRUE, 'WORKSPACE'),
  ('c0000008-0000-4000-8000-000000000008', 'PTT', 'a0000000-0000-4000-8000-000000000001', 'a0000009-0000-4000-8000-000000000009', '2026-09-01', '2026-09-30', 'MONTH', 'ORGANIZATION', 'org', 3.5, 2.5, 2.0, 'HIGHER_IS_BETTER', TRUE, 'WORKSPACE')
ON CONFLICT DO NOTHING;

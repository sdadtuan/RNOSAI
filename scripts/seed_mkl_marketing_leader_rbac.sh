#!/usr/bin/env bash
# Seed Marketing Leader (MKL / MKT-01) caps for the 4 bàn-giao clusters:
#   1) Marketing plan + AI draft → đề xuất CEO duyệt   (/crm/marketing-plan)
#   2) KPI Hub campaigns / marketing                    (/crm/kpi-hub/…)
#   3) Service Delivery task [AI draft]                 (/crm/service-delivery)
#   4) Brief / sáng tạo: Creative · Campaign Write · Content · Media · SEO ads sidebar
#
# Additive (ON CONFLICT DO NOTHING). Does not revoke existing grants.
#
# Usage:
#   ./scripts/seed_mkl_marketing_leader_rbac.sh          # dry-run
#   ./scripts/seed_mkl_marketing_leader_rbac.sh --apply
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

: "${DATABASE_URL:?DATABASE_URL required}"

APPLY="${1:-}"
POSITION_CODES="'mkl','mkt-01'"

grant_sql() {
  cat <<SQL
INSERT INTO staff_section_permissions (position_id, section_id, action)
SELECT p.id, g.section_id, g.action
FROM crm_positions p
CROSS JOIN (VALUES
  -- 1) Kế hoạch Marketing + AI draft
  ('crm_mktplan', 'view'),
  ('crm_mktplan', 'edit'),
  ('crm_mktplan', 'create'),
  ('crm_mktplan', 'export'),
  ('crm_mkt_ai', 'view'),
  ('crm_mkt_ai', 'generate'),
  ('crm_mkt_ai', 'export'),
  ('crm_mkt_ai', 'approve'),
  ('crm_board', 'view'),
  ('crm_board', 'edit'),

  -- 2) KPI Hub — Campaigns / Marketing
  ('crm_kpi_hub', 'view'),
  ('crm_kpi_dictionary', 'view'),
  ('crm_kpi_hub_targets', 'view'),
  ('crm_kpi_hub_targets', 'manage'),
  ('crm_kpi_hub_sources', 'view'),
  ('crm_kpi_quality', 'view'),
  ('crm_kpi_hub_reports', 'view'),
  ('crm_kpi_hub_reports', 'send'),
  ('crm_kpi_alerts', 'view'),
  ('crm_kpi_chart', 'view'),
  ('crm_kpi_metrics', 'view'),
  ('crm_kpi_records', 'view'),
  ('crm_kpi_records', 'edit'),
  ('crm_kpi_records', 'create'),
  ('crm_kpi_groups', 'view'),
  ('crm_kpi_types', 'view'),

  -- 3) Service Delivery board + SOP
  ('crm_delivery_projects', 'view'),
  ('crm_delivery_projects', 'edit'),
  ('crm_delivery_projects', 'manage'),
  ('crm_delivery_budget', 'view'),
  ('crm_delivery_budget', 'edit'),
  ('crm_sop_runs', 'view'),
  ('crm_sop_runs', 'edit'),
  ('crm_sop_runs', 'create'),
  ('crm_sop_templates', 'view'),
  ('crm_sop_overdue', 'view'),

  -- 4) Brief / sáng tạo (Creative · Content · Media · Campaign Write · Ads/SEO)
  ('crm_content', 'view'),
  ('crm_content', 'write'),
  ('crm_content', 'production'),
  ('crm_content', 'publish'),
  ('crm_content', 'generate'),
  ('crm_content', 'qa'),
  ('crm_content', 'assign'),
  ('crm_content', 'approve_internal'),
  ('crm_content', 'admin'),
  ('crm_cp', 'view'),
  ('crm_cp', 'view_all'),
  ('crm_cp', 'edit'),
  ('crm_cp', 'manage'),
  ('crm_cp.brand', 'edit'),
  ('crm_cp.render', 'execute'),
  ('crm_cp.render_high_cost', 'execute'),
  ('crm_cp.publish', 'execute'),
  ('crm_cp.export_final', 'execute'),
  ('crm_cp.approve_legal', 'execute'),
  ('crm_cp.manage_brand_rule', 'manage'),
  ('crm_cp.view_audit', 'view'),
  ('crm_cp.finance', 'view'),
  ('crm_img', 'view'),
  ('crm_img', 'view_all'),
  ('crm_img', 'edit'),
  ('crm_img', 'manage'),
  ('crm_img.render', 'execute'),
  ('crm_img.render_high_cost', 'execute'),
  ('crm_img.gate1', 'execute'),
  ('crm_img.gate2', 'execute'),
  ('crm_img.gate3', 'execute'),
  ('crm_img.sop', 'edit'),
  ('crm_img.admin', 'manage'),
  ('crm_img.finance', 'view'),
  ('crm_media', 'view'),
  ('crm_media', 'write'),
  ('crm_media', 'publish'),
  ('crm_media.inventory', 'view'),
  ('crm_media.inventory', 'write'),
  ('crm_media.packages', 'view'),
  ('crm_media.packages', 'write'),
  ('crm_media.campaigns', 'view'),
  ('crm_media.campaigns', 'write'),
  ('crm_media.campaigns', 'publish'),
  ('crm_media.evidence', 'view'),
  ('crm_media.evidence', 'write'),
  ('crm_media.outcomes', 'view'),
  ('crm_media.outcomes', 'write'),
  ('crm_media.margin', 'view'),
  ('crm_media.settings', 'view'),
  ('meta_campaign_write', 'view'),
  ('meta_campaign_write', 'approve'),
  ('meta_ads_ops', 'view'),
  ('meta_ads_ops', 'edit'),
  ('crm_facebook_ads', 'view'),
  ('crm_facebook_ads', 'edit'),
  ('crm_facebook_ads', 'create'),
  ('crm_facebook_ads', 'configure'),
  ('crm_google_ads', 'view'),
  ('crm_google_ads', 'export'),
  ('crm_zalo_ads', 'view'),
  ('crm_zalo_ads', 'edit'),
  ('crm_seo_aeo', 'view'),
  ('crm_seo_aeo', 'edit'),
  ('crm_seo_aeo', 'create'),
  ('crm_seo_aeo', 'approve'),
  ('crm_seo_aeo', 'configure'),
  ('crm_seo_aeo', 'export'),
  ('crm_vd.project', 'view'),
  ('crm_vd.project', 'edit'),
  ('crm_vd.project', 'create'),
  ('crm_vd.script', 'view'),
  ('crm_vd.script', 'edit'),
  ('crm_vd.bible', 'view'),
  ('crm_vd.bible', 'edit'),
  ('crm_vd.keyframe', 'view'),
  ('crm_vd.keyframe', 'edit'),
  ('crm_vd.gate1', 'view'),
  ('crm_vd.gate1', 'approve'),
  ('crm_vd.gate2', 'view'),
  ('crm_vd.gate2', 'approve'),
  ('crm_vd.motion', 'view'),
  ('crm_vd.motion', 'edit'),
  ('crm_vd.gate3', 'view'),
  ('crm_vd.gate3', 'approve'),
  ('crm_vd.budget', 'view'),
  ('crm_vd.budget', 'edit'),
  ('crm_vd.post', 'view'),
  ('crm_vd.post', 'edit'),
  ('crm_vd.qc', 'view'),
  ('crm_vd.qc', 'edit'),
  ('crm_vd.delivery', 'view'),
  ('crm_vd.delivery', 'edit'),
  ('crm_vd.report', 'view'),
  ('crm_vd.admin', 'view'),
  ('crm_vd.admin', 'create')
) AS g(section_id, action)
WHERE lower(trim(p.code)) IN (${POSITION_CODES})
ON CONFLICT (position_id, section_id, action) DO NOTHING;
SQL
}

echo "== Marketing Leader (MKL / MKT-01) RBAC — 4 clusters =="

if [[ "$APPLY" != "--apply" ]]; then
  echo "Dry-run — positions: MKL, MKT-01"
  psql "$DATABASE_URL" -c "
    SELECT p.code, p.name,
      COUNT(*) FILTER (WHERE s.section_id = 'crm_mkt_ai') AS mkt_ai,
      COUNT(*) FILTER (WHERE s.section_id = 'crm_mktplan') AS mktplan,
      COUNT(*) FILTER (WHERE s.section_id LIKE 'crm_kpi%') AS kpi,
      COUNT(*) FILTER (WHERE s.section_id IN ('crm_board','crm_delivery_projects','crm_sop_runs')) AS delivery,
      COUNT(*) FILTER (WHERE s.section_id LIKE 'crm_content%' OR s.section_id LIKE 'crm_cp%' OR s.section_id LIKE 'crm_media%' OR s.section_id LIKE 'meta_%') AS creative
    FROM crm_positions p
    LEFT JOIN staff_section_permissions s ON s.position_id = p.id
    WHERE lower(trim(p.code)) IN (${POSITION_CODES})
    GROUP BY 1, 2
    ORDER BY 1;
  " 2>/dev/null || echo "(query failed)"
  echo ""
  echo "crm_mkt_ai detail:"
  psql "$DATABASE_URL" -c "
    SELECT p.code, s.action
    FROM staff_section_permissions s
    JOIN crm_positions p ON p.id = s.position_id
    WHERE lower(trim(p.code)) IN (${POSITION_CODES})
      AND s.section_id = 'crm_mkt_ai'
    ORDER BY 1, 2;
  " 2>/dev/null || true
  echo ""
  echo "Run: \$0 --apply"
  exit 0
fi

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<<"$(grant_sql)"

echo "OK  Marketing Leader caps applied"
psql "$DATABASE_URL" -c "
  SELECT p.code, s.section_id, string_agg(s.action, ',' ORDER BY s.action) AS actions
  FROM staff_section_permissions s
  JOIN crm_positions p ON p.id = s.position_id
  WHERE lower(trim(p.code)) IN (${POSITION_CODES})
    AND s.section_id IN (
      'crm_mktplan','crm_mkt_ai','crm_board','crm_kpi_hub',
      'crm_delivery_projects','crm_content','meta_campaign_write','crm_media'
    )
  GROUP BY 1, 2
  ORDER BY 1, 2;
"
echo "Nhắc staff Marketing Leader đăng xuất / đăng nhập lại để JWT caps cập nhật."

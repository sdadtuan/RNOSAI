import type { StoredStaffUser } from '@/lib/auth';
import { hasCap } from '@/lib/auth';

export function canSeeCeoNav(user: StoredStaffUser | null | undefined): boolean {
  if (!user) return false;
  return (
    hasCap(user, 'ceo_command', 'view') ||
    hasCap(user, 'ai_analytics', 'query') ||
    hasCap(user, 'crm_business_dashboard', 'view') ||
    hasCap(user, 'ai_admin', 'view') ||
    hasCap(user, 'crm_owner_weekly_dashboard', 'view')
  );
}

export function ceoBadge(opts: {
  llmEnabled: boolean;
  stubMode: boolean;
}): 'Facts' | 'OSS' | 'Stub' {
  if (opts.llmEnabled && !opts.stubMode) return 'OSS';
  if (opts.stubMode) return 'Stub';
  return 'Facts';
}

export type CeoBriefingCard = {
  severity: 'red' | 'amber' | 'ok';
  title: string;
  metric?: string;
  href: string;
  source?: string;
  suggest_action?: string;
  alert_id?: number;
  recommendation_id?: string;
};

export function parseCards(raw: unknown): CeoBriefingCard[] {
  if (!Array.isArray(raw)) return [];
  const out: CeoBriefingCard[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title = String(row.title ?? '').trim();
    const href = String(row.href ?? '').trim();
    if (!title || !href) continue;
    const sev = String(row.severity ?? 'ok');
    out.push({
      severity: sev === 'red' || sev === 'amber' ? sev : 'ok',
      title,
      metric: row.metric != null ? String(row.metric) : undefined,
      href,
      source: row.source != null ? String(row.source) : undefined,
      suggest_action: row.suggest_action != null ? String(row.suggest_action) : undefined,
      alert_id: row.alert_id != null ? Number(row.alert_id) : undefined,
      recommendation_id:
        row.recommendation_id != null ? String(row.recommendation_id) : undefined,
    });
  }
  return out;
}

export const CHIPS_A: Array<{ intent: string; label: string }> = [
  { intent: 'briefing_today', label: 'Hôm nay' },
  { intent: 'briefing_pipeline', label: 'Pipeline rủi ro' },
  { intent: 'briefing_sla', label: 'SLA' },
  { intent: 'briefing_ops', label: 'Delivery' },
  { intent: 'briefing_finance', label: 'Tài chính' },
  { intent: 'briefing_coach', label: 'Coach tuần' },
];

export const CHIPS_B: Array<{ intent_id: string; label: string }> = [
  { intent_id: 'revenue_received_30d', label: 'DT 30 ngày' },
  { intent_id: 'leads_new_30d', label: 'Lead mới 30n' },
  { intent_id: 'cpl_meta_t30_overview', label: 'CPL Meta T-30' },
  { intent_id: 'open_deals_count', label: 'Deal mở' },
  { intent_id: 'pipeline_at_risk_count', label: 'Pipeline at-risk' },
  { intent_id: 'ops_payments_overdue', label: 'Overdue ₫' },
  { intent_id: 'sla_breach_summary', label: 'SLA breach' },
  { intent_id: 'forecast_month_summary', label: 'Forecast tháng' },
  { intent_id: 'churn_health_top10', label: 'Churn top 10' },
  { intent_id: 'leads_unassigned', label: 'Lead chưa owner' },
  { intent_id: 'roas_overview_30d', label: 'ROAS 30n' },
  { intent_id: 'marketing_spend_current_month', label: 'Chi MKT tháng' },
];

import { normalizeQueryText } from '../ai-intelligence/nl-query.engine';
import { maskSalesKitPii } from '../intake/sales-kit-pii.util';

export const CEO_NUMBER_TOKEN =
  /\d[\d.,]*\s*(?:₫|đ|vnd|%|tỷ|triệu|lead|deal)/gi;

const VN_TZ_OFFSET_MS = 7 * 60 * 60 * 1000;

export function ceoThreadId(staffId: number, now = new Date()): string {
  const vn = new Date(now.getTime() + VN_TZ_OFFSET_MS);
  const y = vn.getUTCFullYear();
  const m = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const d = String(vn.getUTCDate()).padStart(2, '0');
  return `ceo:${staffId}:${y}-${m}-${d}`;
}

export function nearestNlAliases(
  question: string,
  catalog: Array<{ id: string; label: string; aliases: string[] }>,
  limit = 3,
): Array<{ id: string; label: string }> {
  const qTokens = new Set(normalizeQueryText(question).split(' ').filter(Boolean));
  if (!qTokens.size) return [];

  const scored = catalog
    .map((entry) => {
      const corpus = [entry.label, ...entry.aliases].map(normalizeQueryText).join(' ');
      const tokens = corpus.split(' ').filter(Boolean);
      let overlap = 0;
      for (const t of tokens) {
        if (qTokens.has(t)) overlap += 1;
      }
      return { id: entry.id, label: entry.label, overlap };
    })
    .filter((r) => r.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.label.localeCompare(b.label, 'vi'));

  return scored.slice(0, limit).map(({ id, label }) => ({ id, label }));
}

export function assertReplyNumbersInFacts(replyVi: string, facts: unknown): boolean {
  const hay = JSON.stringify(facts ?? {});
  const matches = String(replyVi ?? '').match(CEO_NUMBER_TOKEN) ?? [];
  for (const token of matches) {
    const normalized = token.trim();
    if (!hay.includes(normalized)) {
      const compact = normalized.replace(/\s+/g, '');
      if (!hay.includes(compact)) return false;
    }
  }
  return true;
}

export function maskCeoPii(text: string): string {
  return maskSalesKitPii(text);
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

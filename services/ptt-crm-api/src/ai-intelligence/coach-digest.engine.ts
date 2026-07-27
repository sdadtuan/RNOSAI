import {
  buildChannelAnomalyCard,
  channelAnomalyNarrativeLine,
} from './channel-anomaly.engine';
import {
  CoachDigestCard,
  CoachDigestContext,
  CoachDigestSeverity,
  CoachDigestSnapshot,
} from './coach-digest.types';

export function isoWeekKey(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function weekWindow(date = new Date()): { week_start: string; week_end: string; week_label: string } {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    week_start: fmt(start),
    week_end: fmt(end),
    week_label: `${fmt(start)} → ${fmt(end)}`,
  };
}

function worstSeverity(cards: CoachDigestCard[]): CoachDigestSeverity {
  if (cards.some((c) => c.severity === 'critical')) return 'critical';
  if (cards.some((c) => c.severity === 'warning')) return 'warning';
  return 'info';
}

export function buildCoachDigest(context: CoachDigestContext): CoachDigestSnapshot {
  const cards: CoachDigestCard[] = [];

  const slaSeverity: CoachDigestSeverity =
    context.sla_breach >= 5 ? 'critical' : context.sla_breach > 0 || context.sla_warning >= 3 ? 'warning' : 'info';
  cards.push({
    key: 'sla',
    title: 'SLA gọi lead đầu tiên',
    summary:
      context.sla_breach > 0
        ? `${context.sla_breach} lead vi phạm SLA · ${context.sla_warning} cảnh báo`
        : `Không vi phạm SLA · ${context.sla_ok} đúng hạn`,
    severity: slaSeverity,
    metrics: {
      breach: context.sla_breach,
      warning: context.sla_warning,
      ok: context.sla_ok,
    },
    drill_href: '/crm/cskh-board?sla_filter=breach',
  });

  const rate = context.acceptance_rate_pct;
  const aiSeverity: CoachDigestSeverity =
    rate == null ? 'info' : rate < 20 ? 'critical' : rate < 35 ? 'warning' : 'info';
  const topReason = context.top_dismiss_reasons[0];
  cards.push({
    key: 'ai_acceptance',
    title: 'AI acceptance (7 ngày)',
    summary:
      rate == null
        ? 'Chưa đủ dữ liệu feedback AI'
        : `Tỷ lệ chấp nhận ${rate}% · ${context.dismissed} bỏ / ${context.accepted} chấp nhận`,
    severity: aiSeverity,
    metrics: {
      acceptance_rate_pct: rate,
      accepted: context.accepted,
      dismissed: context.dismissed,
      pending: context.pending,
      top_dismiss_reason: topReason?.reason ?? null,
      top_dismiss_count: topReason?.count ?? 0,
    },
    drill_href: '/crm/ai/insights?status=dismissed',
  });

  const pipelineSeverity: CoachDigestSeverity =
    context.pipeline_at_risk >= 10 ? 'critical' : context.pipeline_at_risk >= 3 ? 'warning' : 'info';
  cards.push({
    key: 'pipeline_risk',
    title: 'Pipeline at-risk',
    summary:
      context.pipeline_at_risk > 0
        ? `${context.pipeline_at_risk} deal đang at-risk (stalled)`
        : 'Không có deal at-risk đang mở',
    severity: pipelineSeverity,
    metrics: {
      at_risk_count: context.pipeline_at_risk,
    },
    drill_href: '/crm/ai/insights',
  });

  cards.push(
    buildChannelAnomalyCard({
      meta_open_alerts: context.meta_open_alerts,
      zalo_open_alerts: context.zalo_open_alerts,
      cpl_spike_count: context.cpl_spike_count,
      zero_leads_24h_count: context.zero_leads_24h_count,
      roas_low_count: context.roas_low_count,
      spend_spike_count: context.spend_spike_count,
      top_anomaly_message: context.top_anomaly_message,
      top_anomaly_channel: context.top_anomaly_channel,
      top_anomaly_campaign_id: context.top_anomaly_campaign_id,
    }),
  );

  const narrativeParts = [
    `Tuần ${context.week_label} — tóm tắt coach cho team.`,
    context.sla_breach > 0
      ? `Ưu tiên: xử lý ${context.sla_breach} lead SLA breach trên CSKH board.`
      : 'SLA lead ổn định.',
    rate != null ? `AI acceptance ${rate}% (${context.accepted} chấp nhận, ${context.dismissed} bỏ).` : '',
    context.pipeline_at_risk > 0
      ? `${context.pipeline_at_risk} deal cần manager review trên pipeline risk.`
      : 'Pipeline không có deal stalled nghiêm trọng.',
    channelAnomalyNarrativeLine({
      meta_open_alerts: context.meta_open_alerts,
      zalo_open_alerts: context.zalo_open_alerts,
      cpl_spike_count: context.cpl_spike_count,
      zero_leads_24h_count: context.zero_leads_24h_count,
      roas_low_count: context.roas_low_count,
      spend_spike_count: context.spend_spike_count,
      top_anomaly_message: context.top_anomaly_message,
      top_anomaly_channel: context.top_anomaly_channel,
      top_anomaly_campaign_id: context.top_anomaly_campaign_id,
    }),
  ].filter(Boolean);

  const narrative = narrativeParts.join(' ');
  const severity = worstSeverity(cards);

  const emailPreview = [
    `Coach digest — ${context.week_label}`,
    '',
    ...cards.map((card) => `- ${card.title}: ${card.summary}`),
    '',
    'Xem chi tiết: /crm/ai/coach',
    'Read-only — không có hành động HR tự động.',
  ].join('\n');

  return {
    week_key: context.week_key,
    week_label: context.week_label,
    week_start: context.week_start,
    week_end: context.week_end,
    team_id: context.team_id,
    narrative,
    severity,
    cards,
    email_preview: emailPreview,
  };
}

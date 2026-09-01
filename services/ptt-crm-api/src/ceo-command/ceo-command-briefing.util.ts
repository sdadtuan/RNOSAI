export type CeoBriefingCard = {
  severity: 'red' | 'amber' | 'ok';
  title: string;
  metric?: string;
  href: string;
  source: 'ops_exec' | 'ops_alerts' | 'pipeline' | 'sla' | 'finance' | 'coach';
  suggest_action?: 'ack_ops_alert' | 'assign_pipeline_risk' | 'remind_staff' | 'assign_lead';
  alert_id?: number;
  recommendation_id?: string;
};

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function severityRank(s: CeoBriefingCard['severity']): number {
  if (s === 'red') return 0;
  if (s === 'amber') return 1;
  return 2;
}

export function cardsFromSources(input: {
  opsExec?: { alerts_open: number; kpi_dat_pct: number } | null;
  opsAlerts?: Array<{ id: number; title?: string }>;
  pipeline?: Array<{ recommendation_id: string; title: string }>;
  sla?: { breach: number; warning: number } | null;
  finance?: { overdue: number; rev7: number; rev30: number } | null;
  coach?: { week_key: string; created_at: string } | null;
  hasFinanceCap: boolean;
}): { cards: CeoBriefingCard[]; reply_vi: string; facts_json: Record<string, unknown> } {
  const cards: CeoBriefingCard[] = [];
  const facts: Record<string, unknown> = {};

  if (input.opsExec) {
    facts.ops_exec = input.opsExec;
    const sev: CeoBriefingCard['severity'] =
      input.opsExec.alerts_open > 0 || input.opsExec.kpi_dat_pct < 70 ? 'red' : 'ok';
    cards.push({
      severity: sev,
      title: 'Ops executive',
      metric: `${input.opsExec.alerts_open} alert · KPI đạt ${input.opsExec.kpi_dat_pct}%`,
      href: '/crm/ops/dashboard',
      source: 'ops_exec',
    });
  }

  for (const alert of input.opsAlerts ?? []) {
    cards.push({
      severity: 'red',
      title: String(alert.title ?? `Alert #${alert.id}`),
      metric: `#${alert.id}`,
      href: '/crm/ops/dashboard',
      source: 'ops_alerts',
      suggest_action: 'ack_ops_alert',
      alert_id: alert.id,
    });
  }
  if (input.opsAlerts?.length) {
    facts.ops_alerts = input.opsAlerts.map((a) => ({ id: a.id, title: a.title ?? '' }));
  }

  for (const deal of input.pipeline ?? []) {
    cards.push({
      severity: 'amber',
      title: deal.title,
      href: '/crm/ai/pipeline-risk',
      source: 'pipeline',
      suggest_action: 'assign_pipeline_risk',
      recommendation_id: deal.recommendation_id,
    });
  }
  if (input.pipeline?.length) {
    facts.pipeline = input.pipeline;
  }

  if (input.sla) {
    facts.sla = input.sla;
    const sev: CeoBriefingCard['severity'] =
      input.sla.breach > 0 ? 'red' : input.sla.warning > 0 ? 'amber' : 'ok';
    cards.push({
      severity: sev,
      title: 'CSKH SLA',
      metric: `${input.sla.breach} breach · ${input.sla.warning} warning`,
      href: '/crm/cskh-board',
      source: 'sla',
    });
  }

  if (input.hasFinanceCap && input.finance) {
    facts.finance = input.finance;
    const sev: CeoBriefingCard['severity'] = input.finance.overdue > 0 ? 'amber' : 'ok';
    cards.push({
      severity: sev,
      title: 'Tài chính',
      metric: `Overdue ${input.finance.overdue} · DT 7n/30n`,
      href: '/crm/business-dashboard',
      source: 'finance',
    });
  }

  if (input.coach) {
    facts.coach = input.coach;
    cards.push({
      severity: 'ok',
      title: 'Coach digest tuần',
      metric: input.coach.week_key,
      href: '/crm/ai/coach',
      source: 'coach',
    });
  }

  const sorted = [...cards].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity) || a.title.localeCompare(b.title, 'vi'),
  );
  const trimmed = sorted.slice(0, 8);
  const bullets = trimmed.map((c) => (c.metric ? `• ${c.title} — ${c.metric}` : `• ${c.title}`));
  let reply_vi = bullets.join('\n');
  if (!reply_vi) reply_vi = 'Không có thẻ cảnh báo — mọi nguồn ổn định.';
  if (reply_vi.length > 1200) reply_vi = `${reply_vi.slice(0, 1197)}…`;

  return { cards: trimmed, reply_vi, facts_json: facts };
}

export const BRIEFING_INTENTS = new Set([
  'briefing_today',
  'briefing_pipeline',
  'briefing_sla',
  'briefing_ops',
  'briefing_finance',
  'briefing_coach',
]);

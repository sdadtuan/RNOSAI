import { workingHoursBetween } from '../lead-sla-settings/lead-sla-working-hours.util';
import {
  computeKanbanFirstContactSla,
  computeKanbanPriority,
  defaultKanbanCardSettings,
  isKanbanStale,
  kanbanNeedText,
  type KanbanCardSettings,
} from '../leads/kanban-card.util';

const COLUMNS: Array<{ id: string; statuses: string[] }> = [
  { id: 'moi', statuses: ['moi', 'new', 'intake'] },
  { id: 'da_lien_he', statuses: ['da_lien_he', 'first_contact', 'contacted', 'qualified', 'qualify'] },
  { id: 'dang_tu_van', statuses: ['dang_tu_van', 'nurturing', 'hen_gap'] },
  { id: 'bao_gia', statuses: ['bao_gia', 'proposal', 'dam_phan', 'negotiation'] },
  { id: 'won', statuses: ['won', 'chot'] },
  { id: 'lost', statuses: ['lost'] },
  { id: 'nurture', statuses: ['nurture'] },
];

const HOLDING = new Set(['moi', 'da_lien_he', 'dang_tu_van', 'bao_gia']);

export interface AeTeamThresholds {
  hot_uncalled_minutes: number;
  quote_followup_days: number;
  max_unanswered_calls: number;
  ae_sla_breach_yellow: number;
  ae_sla_breach_red: number;
  ae_sla_breach_alert: number;
  ae_idle_hours: number;
  ae_drop_percent: number;
  alert_interval_minutes: number;
  alert_cooldown_minutes: number;
  escalate_minutes: number;
  show_rank_to_ae: boolean;
}

export interface AeTeamLeadFact {
  id: number;
  status: string;
  receivedAt: string | null;
  updatedAt: string | null;
  firstCallAt: string | null;
  lastCallAt: string | null;
  nextCallAt: string | null;
  hasCall: boolean;
  source: string | null;
  channel: string | null;
  need: string | null;
  valueVnd: number | null;
  callAttemptCount: number;
  lastCallResult: string;
  /** Oldest to newest. When set, R5 uses this streak instead of the last-result proxy. */
  callResults?: string[];
}

export interface AeTeamCallFact {
  at: string;
  content: string;
}

export interface AeStatusCounts {
  moi: number;
  da_lien_he: number;
  dang_tu_van: number;
  bao_gia: number;
}

export interface AeMemberStats {
  by_status: AeStatusCounts;
  open_leads: number;
  sla_breach: number;
  sla_warning: number;
  within_sla_pct: number | null;
  avg_first_response_minutes: number | null;
  calls: number;
  answer_pct: number | null;
  stale: number;
  missed_callbacks: number;
  lead_to_quote_pct: number | null;
  quote_to_won_pct: number | null;
  revenue_vnd: number | null;
  quota_vnd: number | null;
  attainment_pct: number | null;
  tone: 'green' | 'yellow' | 'red';
  attention: number;
}

function positive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function aeTeamSettingsFromPayload(raw: unknown): AeTeamThresholds {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const kanban = root.kanban && typeof root.kanban === 'object' ? (root.kanban as Record<string, unknown>) : root;
  const block = kanban.ae_team && typeof kanban.ae_team === 'object' ? (kanban.ae_team as Record<string, unknown>) : {};
  return {
    hot_uncalled_minutes: positive(block.hot_uncalled_minutes, 30),
    quote_followup_days: positive(block.quote_followup_days, 7),
    max_unanswered_calls: positive(block.max_unanswered_calls, 3),
    ae_sla_breach_yellow: positive(block.ae_sla_breach_yellow, 1),
    ae_sla_breach_red: positive(block.ae_sla_breach_red, 3),
    ae_sla_breach_alert: positive(block.ae_sla_breach_alert, 3),
    ae_idle_hours: positive(block.ae_idle_hours, 2),
    ae_drop_percent: positive(block.ae_drop_percent, 20),
    alert_interval_minutes: positive(block.alert_interval_minutes, 15),
    alert_cooldown_minutes: positive(block.alert_cooldown_minutes, 120),
    escalate_minutes: positive(block.escalate_minutes, 60),
    show_rank_to_ae: block.show_rank_to_ae === true,
  };
}

export function aeTeamRankWeights(raw: unknown): { sla: number; calls: number; conversion: number; revenue: number } {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const kanban = root.kanban && typeof root.kanban === 'object' ? (root.kanban as Record<string, unknown>) : root;
  const block = kanban.ae_team && typeof kanban.ae_team === 'object' ? (kanban.ae_team as Record<string, unknown>) : {};
  const weights = block.rank_weights && typeof block.rank_weights === 'object'
    ? (block.rank_weights as Record<string, unknown>)
    : {};
  return {
    sla: positive(weights.sla, 0.3),
    calls: positive(weights.calls, 0.2),
    conversion: positive(weights.conversion, 0.2),
    revenue: positive(weights.revenue, 0.3),
  };
}

export function rankingPreset(grain: string | undefined): 'today' | 'week' | 'month' {
  if (grain === 'week') return 'week';
  if (grain === 'month') return 'month';
  return 'today';
}

export function canSeeOwnRank(teamAccess: boolean, showRankToAe: boolean): boolean {
  return teamAccess || showRankToAe;
}

export function aeTeamColumnId(status: string | null | undefined): string | null {
  const raw = String(status ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  return COLUMNS.find((column) => column.statuses.includes(raw))?.id ?? null;
}

export function aeRowTone(breachCount: number, thresholds: AeTeamThresholds): 'green' | 'yellow' | 'red' {
  if (breachCount >= thresholds.ae_sla_breach_red) return 'red';
  if (breachCount >= thresholds.ae_sla_breach_yellow) return 'yellow';
  return 'green';
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function inPeriod(value: string | null, period: { from: Date; to: Date }): boolean {
  const date = asDate(value);
  if (!date) return false;
  return date.getTime() >= period.from.getTime() && date.getTime() <= period.to.getTime();
}

function workingMinutes(from: Date | null, to: Date | null, kanban: KanbanCardSettings): number | null {
  if (!from || !to) return null;
  return Math.max(0, Math.round(workingHoursBetween(from, to, kanban.working_hours, kanban.holidays) * 60));
}

function columnSince(lead: AeTeamLeadFact): Date | null {
  const status = String(lead.status ?? '').trim().toLowerCase();
  const received = asDate(lead.receivedAt);
  if (status === 'moi' || status === 'new' || status === 'intake') return received;
  return asDate(lead.updatedAt) ?? received;
}

export type AeRuleCode = 'R1' | 'R2' | 'R4' | 'R3' | 'R5';

export interface AeInterventionHit {
  codes: AeRuleCode[];
  primary: AeRuleCode;
  delay: number;
  delayUnit: 'minutes' | 'days' | 'count';
}

const RULE_RANK: Record<AeRuleCode, number> = { R1: 0, R2: 1, R4: 2, R3: 3, R5: 4 };

export function consecutiveNoAnswers(results: string[]): number {
  let streak = 0;
  for (let index = results.length - 1; index >= 0; index -= 1) {
    if (results[index] !== 'no_answer') break;
    streak += 1;
  }
  return streak;
}

export function callResultFromContent(content: string): string | null {
  const text = content.trim();
  if (text.startsWith('Không nghe') || text === 'no_answer') return 'no_answer';
  if (text.startsWith('Nghe máy') || text === 'answered') return 'answered';
  if (text.startsWith('Sai số') || text === 'wrong_number') return 'wrong_number';
  if (text.startsWith('Hẹn lại') || text === 'callback') return 'callback';
  return null;
}

export function classifyAeIntervention(
  lead: AeTeamLeadFact,
  kanban: KanbanCardSettings,
  thresholds: AeTeamThresholds,
  now: Date,
): AeInterventionHit | null {
  const column = aeTeamColumnId(lead.status);
  const receivedAt = asDate(lead.receivedAt);
  const since = columnSince(lead);
  const sla = computeKanbanFirstContactSla({
    status: lead.status,
    receivedAt,
    columnSince: since,
    hasCall: lead.hasCall,
    now,
    settings: kanban,
  });
  const nextCall = asDate(lead.nextCallAt);
  const lastCall = asDate(lead.lastCallAt);
  const missed = Boolean(
    nextCall && nextCall.getTime() < now.getTime() && (!lastCall || lastCall.getTime() < nextCall.getTime()),
  );
  const age = workingMinutes(receivedAt, now, kanban);
  const hot = computeKanbanPriority({
    source: lead.source,
    channel: lead.channel,
    need: lead.need,
    receivedAt,
    now,
    settings: kanban,
  }) === 'hot';
  const quoteDays = since ? Math.floor((now.getTime() - since.getTime()) / 86_400_000) : 0;
  const streak = lead.callResults
    ? consecutiveNoAnswers(lead.callResults)
    : lead.lastCallResult === 'no_answer'
      ? lead.callAttemptCount
      : 0;
  const codes: AeRuleCode[] = [];
  if (sla.state === 'breach') codes.push('R1');
  if (hot && !lead.hasCall && age != null && age >= thresholds.hot_uncalled_minutes) codes.push('R2');
  if (missed) codes.push('R4');
  if (column === 'bao_gia' && quoteDays >= thresholds.quote_followup_days) codes.push('R3');
  if (streak >= thresholds.max_unanswered_calls) codes.push('R5');
  if (!codes.length) return null;
  const primary = codes[0];
  if (primary === 'R1') return { codes, primary, delay: sla.lateMinutes ?? 0, delayUnit: 'minutes' };
  if (primary === 'R2') return { codes, primary, delay: age ?? 0, delayUnit: 'minutes' };
  if (primary === 'R4') {
    const minutes = nextCall ? Math.max(0, Math.floor((now.getTime() - nextCall.getTime()) / 60_000)) : 0;
    return { codes, primary, delay: minutes, delayUnit: 'minutes' };
  }
  if (primary === 'R3') return { codes, primary, delay: quoteDays, delayUnit: 'days' };
  return { codes, primary, delay: streak, delayUnit: 'count' };
}

export function hotUncalledAlert(
  lead: AeTeamLeadFact,
  kanban: KanbanCardSettings,
  thresholds: AeTeamThresholds,
  now: Date,
): 'HOT-AE' | 'HOT-AM' | null {
  const hit = classifyAeIntervention(lead, kanban, thresholds, now);
  if (!hit?.codes.includes('R2')) return null;
  const age = workingMinutes(asDate(lead.receivedAt), now, kanban);
  if (age == null || age < thresholds.hot_uncalled_minutes) return null;
  if (age < thresholds.hot_uncalled_minutes + thresholds.alert_interval_minutes) return 'HOT-AE';
  return 'HOT-AM';
}

export function sortAeInterventions<T extends { primary: AeRuleCode; delay: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => RULE_RANK[a.primary] - RULE_RANK[b.primary] || b.delay - a.delay);
}

export function aeTeamSuggestWeights(raw: unknown): { open_leads: number; win_rate: number; accepting: number } {
  const root = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const kanban = root.kanban && typeof root.kanban === 'object' ? (root.kanban as Record<string, unknown>) : root;
  const block = kanban.ae_team && typeof kanban.ae_team === 'object' ? (kanban.ae_team as Record<string, unknown>) : {};
  const weights = block.suggest_weights && typeof block.suggest_weights === 'object'
    ? (block.suggest_weights as Record<string, unknown>)
    : {};
  return {
    open_leads: positive(weights.open_leads, 0.5),
    win_rate: positive(weights.win_rate, 0.3),
    accepting: positive(weights.accepting, 0.2),
  };
}

export function suggestAeReceivers(input: {
  rows: Array<{
    staffId: number;
    name: string;
    accepting: boolean;
    assignEnabled: boolean;
    openLeads: number;
    winRate: number | null;
  }>;
  weights: { open_leads: number; win_rate: number; accepting: number };
  excludeStaffId?: number | null;
}): Array<{ staff_id: number; name: string; score: number }> {
  const eligible = input.rows.filter(
    (row) => row.accepting && row.assignEnabled && row.staffId !== input.excludeStaffId,
  );
  const maxOpen = eligible.reduce((max, row) => Math.max(max, row.openLeads), 0);
  const scored = eligible.map((row) => {
    const parts: Array<{ weight: number; value: number }> = [
      { weight: input.weights.open_leads, value: maxOpen > 0 ? 1 - row.openLeads / maxOpen : 1 },
      { weight: input.weights.accepting, value: 1 },
    ];
    if (row.winRate != null) parts.push({ weight: input.weights.win_rate, value: row.winRate });
    const sum = parts.reduce((total, part) => total + part.weight, 0);
    const score = sum > 0 ? parts.reduce((total, part) => total + (part.weight / sum) * part.value, 0) : 0;
    return { staff_id: row.staffId, name: row.name, score: Math.round(score * 10000) / 10000 };
  });
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'vi'));
  return scored;
}

export function staffIdsAcceptingIntake(ids: number[], pausedIds: Iterable<number>): number[] {
  const paused = new Set(pausedIds);
  return ids.filter((id) => !paused.has(id));
}

export function reassignAuditRows(input: {
  leads: Array<{ id: number; fromOwnerId: number | null }>;
  toStaffId: number;
  reason: string;
  assignedBy: string;
}): Array<{ lead_id: number; from_owner_id: number | null; to_owner_id: number; reason: string; assigned_by: string }> {
  const reason = input.reason.trim();
  if (!reason) throw new Error('reason_required');
  return input.leads.map((lead) => ({
    lead_id: lead.id,
    from_owner_id: lead.fromOwnerId,
    to_owner_id: input.toStaffId,
    reason,
    assigned_by: input.assignedBy.slice(0, 120),
  }));
}

export function isAeHoldingStatus(status: string | null | undefined): boolean {
  const column = aeTeamColumnId(status);
  return column === 'moi' || column === 'da_lien_he' || column === 'dang_tu_van' || column === 'bao_gia';
}

export function buildAeMemberStats(input: {
  leads: AeTeamLeadFact[];
  calls: AeTeamCallFact[];
  kanban: KanbanCardSettings;
  thresholds: AeTeamThresholds;
  now: Date;
  period: { from: Date; to: Date };
  quotaVnd: number | null;
}): AeMemberStats {
  const kanban = input.kanban;
  const counts: AeStatusCounts = { moi: 0, da_lien_he: 0, dang_tu_van: 0, bao_gia: 0 };
  let slaBreach = 0;
  let slaWarning = 0;
  let stale = 0;
  let missed = 0;
  let attention = 0;
  let slaHit = 0;
  let slaClosed = 0;
  let responseSum = 0;
  let responseCount = 0;
  let received = 0;
  let quotedOrWon = 0;
  let wonFromQuoted = 0;
  let revenue: number | null = null;

  for (const lead of input.leads) {
    const column = aeTeamColumnId(lead.status);
    if (column && column in counts) counts[column as keyof AeStatusCounts] += 1;
    const receivedAt = asDate(lead.receivedAt);
    const since = columnSince(lead);
    const sla = computeKanbanFirstContactSla({
      status: lead.status,
      receivedAt,
      columnSince: since,
      hasCall: lead.hasCall,
      now: input.now,
      settings: kanban,
    });
    if (HOLDING.has(column ?? '')) {
      if (sla.state === 'breach') slaBreach += 1;
      if (sla.state === 'warning') slaWarning += 1;
      if (isKanbanStale({ status: lead.status, columnSince: since, now: input.now, settings: kanban })) stale += 1;
    }
    const nextCall = asDate(lead.nextCallAt);
    const lastCall = asDate(lead.lastCallAt);
    const missedCall = Boolean(nextCall && nextCall.getTime() < input.now.getTime() && (!lastCall || lastCall.getTime() < nextCall.getTime()));
    if (missedCall) missed += 1;

    if (classifyAeIntervention(lead, kanban, input.thresholds, input.now)) attention += 1;

    if (inPeriod(lead.receivedAt, input.period)) {
      received += 1;
      const first = asDate(lead.firstCallAt);
      const minutes = workingMinutes(receivedAt, first, kanban);
      if (first && minutes != null) {
        responseSum += minutes;
        responseCount += 1;
        slaClosed += 1;
        if (minutes <= kanban.sla_first_contact_minutes) slaHit += 1;
      } else if (sla.state === 'breach') {
        slaClosed += 1;
      }
      if (column === 'bao_gia' || column === 'won') quotedOrWon += 1;
      if (column === 'won') wonFromQuoted += 1;
    }
    if (column === 'won' && lead.valueVnd != null && lead.valueVnd > 0 && (inPeriod(lead.updatedAt, input.period) || inPeriod(lead.receivedAt, input.period))) {
      revenue = (revenue ?? 0) + lead.valueVnd;
    }
  }

  const answered = input.calls.filter((call) => call.content.startsWith('Nghe máy')).length;
  const results = input.calls.filter((call) =>
    ['Nghe máy', 'Không nghe', 'Sai số', 'Hẹn lại'].some((label) => call.content.startsWith(label)),
  ).length;

  const quota = input.quotaVnd != null && input.quotaVnd > 0 ? input.quotaVnd : null;
  return {
    by_status: counts,
    open_leads: counts.moi + counts.da_lien_he + counts.dang_tu_van + counts.bao_gia,
    sla_breach: slaBreach,
    sla_warning: slaWarning,
    within_sla_pct: slaClosed > 0 ? Math.round((slaHit / slaClosed) * 100) : null,
    avg_first_response_minutes: responseCount > 0 ? Math.round(responseSum / responseCount) : null,
    calls: input.calls.length,
    answer_pct: results > 0 ? Math.round((answered / results) * 100) : null,
    stale,
    missed_callbacks: missed,
    lead_to_quote_pct: received > 0 ? Math.round((quotedOrWon / received) * 100) : null,
    quote_to_won_pct: quotedOrWon > 0 ? Math.round((wonFromQuoted / quotedOrWon) * 100) : null,
    revenue_vnd: revenue,
    quota_vnd: quota,
    attainment_pct: revenue != null && quota != null ? Math.round((revenue / quota) * 100) : null,
    tone: aeRowTone(slaBreach, input.thresholds),
    attention,
  };
}

export function emptyKanbanSettings(): KanbanCardSettings {
  return defaultKanbanCardSettings();
}

export function leadNeed(meta: Record<string, unknown>): string {
  return kanbanNeedText(meta);
}

/** view_all sees every team. A team lead sees only teams they lead. Anyone else is denied. */
export function scopeFromAccess(
  viewAll: boolean,
  leadTeamIds: number[],
): { mode: 'all' } | { mode: 'teams'; teamIds: number[] } | { mode: 'deny' } {
  if (viewAll) return { mode: 'all' };
  const teamIds = leadTeamIds.filter((id) => Number.isFinite(id) && id > 0);
  if (teamIds.length) return { mode: 'teams', teamIds };
  return { mode: 'deny' };
}

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

function ictParts(date: Date): { y: number; m: number; d: number; jsDay: number } {
  const local = new Date(date.getTime() + ICT_OFFSET_MS);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
    jsDay: local.getUTCDay(),
  };
}

function ictStamp(y: number, m: number, d: number, h = 0, mi = 0, s = 0): Date {
  return new Date(Date.UTC(y, m, d, h, mi, s) - ICT_OFFSET_MS);
}

export function resolveAeTeamPeriod(
  preset: string | undefined,
  from: string | undefined,
  to: string | undefined,
  now: Date,
): { preset: 'today' | 'week' | 'month' | 'custom'; from: Date; to: Date } {
  const parts = ictParts(now);
  const end = ictStamp(parts.y, parts.m, parts.d, 23, 59, 59);
  if (preset === 'custom' && from && to) {
    const start = new Date(`${from}T00:00:00+07:00`);
    const stop = new Date(`${to}T23:59:59+07:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(stop.getTime())) {
      return { preset: 'custom', from: start, to: stop };
    }
  }
  if (preset === 'week') {
    const back = parts.jsDay === 0 ? 6 : parts.jsDay - 1;
    const start = ictStamp(parts.y, parts.m, parts.d - back);
    return { preset: 'week', from: start, to: end };
  }
  if (preset === 'month') {
    return { preset: 'month', from: ictStamp(parts.y, parts.m, 1), to: end };
  }
  return { preset: 'today', from: ictStamp(parts.y, parts.m, parts.d), to: end };
}

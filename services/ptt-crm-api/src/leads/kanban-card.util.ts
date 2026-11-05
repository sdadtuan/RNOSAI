import { addWorkingHours, workingHoursBetween, type WorkingHoursConfig } from '../lead-sla-settings/lead-sla-working-hours.util';
import { preB2HoldState } from '../leads-funnel/pre-b2-hold.util';

export type KanbanBand = 'hot' | 'warm' | 'cold';
export type KanbanSlaState = 'ok' | 'warning' | 'breach';

export interface KanbanPriorityRules {
  hot_sources: string[];
  source_points: number;
  need_points: number;
  fresh_within_minutes: number;
  fresh_points: number;
  hot_min_score: number;
  warm_min_score: number;
}

export interface KanbanCardSettings {
  sla_first_contact_minutes: number;
  sla_warning_remaining_minutes: number;
  working_hours: WorkingHoursConfig;
  holidays: string[];
  priority: KanbanPriorityRules;
  /** Calendar days a card may stand in a status before it is marked đứng yên. */
  stale_days: Record<string, number>;
  quote_stale_days: number;
  dedupe_days: number;
}

export function defaultKanbanCardSettings(): KanbanCardSettings {
  return {
    sla_first_contact_minutes: 15,
    sla_warning_remaining_minutes: 5,
    working_hours: { days: [1, 2, 3, 4, 5, 6, 7], start: '08:00', end: '21:00' },
    holidays: [],
    priority: {
      hot_sources: ['meta', 'facebook', 'zalo', 'hotline', 'form', 'google', 'google_ads', 'ads_form'],
      source_points: 1,
      need_points: 1,
      fresh_within_minutes: 120,
      fresh_points: 1,
      hot_min_score: 2,
      warm_min_score: 1,
    },
    stale_days: {
      moi: 1,
      da_lien_he: 2,
      dang_tu_van: 3,
      bao_gia: 7,
      nurture: 2,
    },
    quote_stale_days: 7,
    dedupe_days: 30,
  };
}

function asObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  return raw as Record<string, unknown>;
}

function positive(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function stringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const rows = value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
  return rows.length ? rows : fallback;
}

/** Read kanban card thresholds. Missing keys keep the seed. */
export function kanbanCardSettingsFromPayload(raw: unknown): KanbanCardSettings {
  const seed = defaultKanbanCardSettings();
  const root = asObject(raw);
  const kanban = asObject(root.kanban ?? root);
  const hours = asObject(kanban.working_hours);
  const priority = asObject(kanban.priority);
  const holidays = Array.isArray(root.holidays)
    ? root.holidays.map((item) => String(item))
    : Array.isArray(kanban.holidays)
      ? (kanban.holidays as unknown[]).map((item) => String(item))
      : seed.holidays;
  const days = Array.isArray(hours.days)
    ? hours.days.map((day) => Number(day)).filter((day) => Number.isFinite(day))
    : seed.working_hours.days;
  return {
    sla_first_contact_minutes: positive(kanban.sla_first_contact_minutes, seed.sla_first_contact_minutes),
    sla_warning_remaining_minutes: positive(
      kanban.sla_warning_remaining_minutes,
      seed.sla_warning_remaining_minutes,
    ),
    working_hours: {
      days: days.length ? days : seed.working_hours.days,
      start: String(hours.start ?? seed.working_hours.start),
      end: String(hours.end ?? seed.working_hours.end),
    },
    holidays,
    priority: {
      hot_sources: stringList(priority.hot_sources, seed.priority.hot_sources),
      source_points: positive(priority.source_points, seed.priority.source_points),
      need_points: positive(priority.need_points, seed.priority.need_points),
      fresh_within_minutes: positive(priority.fresh_within_minutes, seed.priority.fresh_within_minutes),
      fresh_points: positive(priority.fresh_points, seed.priority.fresh_points),
      hot_min_score: positive(priority.hot_min_score, seed.priority.hot_min_score),
      warm_min_score: positive(priority.warm_min_score, seed.priority.warm_min_score),
    },
    stale_days: staleDayMap(kanban.stale_days, seed.stale_days),
    quote_stale_days: positive(kanban.quote_stale_days, seed.quote_stale_days),
    dedupe_days: positive(kanban.dedupe_days, seed.dedupe_days),
  };
}

function staleDayMap(raw: unknown, seed: Record<string, number>): Record<string, number> {
  const out = { ...seed };
  const obj = asObject(raw);
  for (const [key, value] of Object.entries(obj)) {
    const name = key.trim().toLowerCase();
    const days = Number(value);
    if (name && Number.isFinite(days) && days > 0) out[name] = days;
  }
  return out;
}

const QUOTED_STATUSES = new Set(['bao_gia', 'proposal', 'dam_phan']);

export function kanbanStatusKey(status: string | null | undefined): string {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'new' || value === 'intake') return 'moi';
  if (value === 'first_contact' || value === 'contacted' || value === 'qualified' || value === 'qualify') {
    return 'da_lien_he';
  }
  if (value === 'proposal' || value === 'dam_phan') return 'bao_gia';
  return value;
}

export function calendarDaysSince(from: Date | null, now: Date): number {
  if (!from || Number.isNaN(from.getTime())) return 0;
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

export function isKanbanStale(input: {
  status?: string | null;
  columnSince: Date | null;
  now: Date;
  settings: KanbanCardSettings;
}): boolean {
  const limit = input.settings.stale_days[kanbanStatusKey(input.status)];
  if (!limit) return false;
  return calendarDaysSince(input.columnSince, input.now) >= limit;
}

export function isQuoteStale(input: {
  status?: string | null;
  receivedAt: Date | null;
  now: Date;
  settings: KanbanCardSettings;
}): boolean {
  const status = String(input.status ?? '').trim().toLowerCase();
  if (!QUOTED_STATUSES.has(status)) return false;
  return calendarDaysSince(input.receivedAt, input.now) >= input.settings.quote_stale_days;
}

export function isCallbackToday(nextCallAt: Date | null, now: Date): boolean {
  if (!nextCallAt || Number.isNaN(nextCallAt.getTime())) return false;
  const day = (value: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(value);
  return day(nextCallAt) === day(now);
}

export function kanbanNeedText(meta: Record<string, unknown>): string {
  for (const key of ['need', 'nhu_cau', 'customer_need', 'demand']) {
    const value = meta[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function sourceHit(source: string, channel: string, hotSources: string[]): boolean {
  const values = [source, channel].map((item) => item.trim().toLowerCase()).filter(Boolean);
  return hotSources.some((hot) => values.some((value) => value === hot || value.includes(hot)));
}

/** Nóng / Ấm / Lạnh from source, need, and working-minute age. */
export function computeKanbanPriority(input: {
  source?: string | null;
  channel?: string | null;
  need?: string | null;
  receivedAt: Date | null;
  now: Date;
  settings: KanbanCardSettings;
}): KanbanBand {
  const rules = input.settings.priority;
  const age =
    input.receivedAt && !Number.isNaN(input.receivedAt.getTime())
      ? Math.round(
          workingHoursBetween(input.receivedAt, input.now, input.settings.working_hours, input.settings.holidays) *
            60,
        )
      : Number.POSITIVE_INFINITY;
  let score = 0;
  if (sourceHit(String(input.source ?? ''), String(input.channel ?? ''), rules.hot_sources)) {
    score += rules.source_points;
  }
  if (String(input.need ?? '').trim()) score += rules.need_points;
  if (age <= rules.fresh_within_minutes) score += rules.fresh_points;
  if (score >= rules.hot_min_score) return 'hot';
  if (score >= rules.warm_min_score) return 'warm';
  return 'cold';
}

const OPEN_STATUSES = new Set(['moi', 'new', 'intake']);

export function computeKanbanFirstContactSla(input: {
  status?: string | null;
  receivedAt: Date | null;
  columnSince: Date | null;
  hasCall: boolean;
  now: Date;
  settings: KanbanCardSettings;
}): { state: KanbanSlaState; lateMinutes: number | null; columnMinutes: number } {
  const hours = input.settings.working_hours;
  const holidays = input.settings.holidays;
  const columnMinutes =
    input.columnSince && !Number.isNaN(input.columnSince.getTime())
      ? Math.max(
          0,
          Math.round(workingHoursBetween(input.columnSince, input.now, hours, holidays) * 60),
        )
      : 0;
  const status = String(input.status ?? '').trim().toLowerCase();
  if (!OPEN_STATUSES.has(status) || input.hasCall || !input.receivedAt) {
    return { state: 'ok', lateMinutes: null, columnMinutes };
  }
  const elapsed = Math.max(
    0,
    Math.round(workingHoursBetween(input.receivedAt, input.now, hours, holidays) * 60),
  );
  const limit = input.settings.sla_first_contact_minutes;
  if (elapsed >= limit) {
    return { state: 'breach', lateMinutes: elapsed - limit, columnMinutes };
  }
  if (limit - elapsed < input.settings.sla_warning_remaining_minutes) {
    return { state: 'warning', lateMinutes: null, columnMinutes };
  }
  return { state: 'ok', lateMinutes: null, columnMinutes };
}

export function kanbanCallOutcome(result: string): {
  nextStatus: 'da_lien_he' | 'nurture' | null;
  suggestLost: boolean;
} {
  if (result === 'answered') {
    return { nextStatus: 'da_lien_he', suggestLost: false };
  }
  if (result === 'callback') {
    return { nextStatus: 'nurture', suggestLost: false };
  }
  if (result === 'wrong_number') return { nextStatus: null, suggestLost: true };
  return { nextStatus: null, suggestLost: false };
}

const CALL_GAP_HOURS = { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' };

export function kanbanHoldPatch(input: {
  result: string;
  assignedAt: Date;
  callbackAt: Date | null;
  lastCallAt: Date | null;
  attemptsSinceAssign: number;
  reassignCount: number;
  isHot: boolean;
  now: Date;
}): {
  hold_until: string | null;
  hold_reason: string;
  status: 'nurture' | null;
  callback_at: string | null;
  warn: string | null;
} {
  const warn = callGapWarn(input.lastCallAt, input.now);
  const result = input.result.trim().toLowerCase();
  if (result === 'answered' || result.startsWith('connected_')) {
    return { hold_until: null, hold_reason: '', status: null, callback_at: null, warn };
  }
  const state = preB2HoldState({
    lastCallResult: result,
    assignedAt: input.assignedAt,
    callbackAt: input.callbackAt,
    lastCallAt: input.lastCallAt,
    attemptsSinceAssign: input.attemptsSinceAssign + 1,
    reassignCount: input.reassignCount,
    isHot: input.isHot,
    now: input.now,
  });
  const holdReason =
    state.kind === 'no_answer'
      ? input.isHot
        ? 'hot_lead'
        : 'fr_chain_1b'
      : state.kind === 'busy'
        ? 'fr_chain_1c'
        : state.kind === 'callback'
          ? 'callback'
          : '';
  return {
    hold_until: state.holdUntil ? state.holdUntil.toISOString() : null,
    hold_reason: holdReason,
    status: result === 'callback' ? 'nurture' : null,
    callback_at: result === 'callback' && input.callbackAt ? input.callbackAt.toISOString() : null,
    warn,
  };
}

function callGapWarn(lastCallAt: Date | null, now: Date): string | null {
  if (!lastCallAt) return null;
  const ageMs = now.getTime() - lastCallAt.getTime();
  if (ageMs >= 0 && ageMs < 15 * 60_000) return null;
  const earliest = addWorkingHours(lastCallAt, 2, CALL_GAP_HOURS, []);
  if (earliest.getTime() > now.getTime()) return 'Cuộc gọi trước cách chưa đủ 2 giờ làm việc.';
  return null;
}

/** Foreign book leads stay masked. Own leads and a full-book director may reveal. */
export function kanbanCallMayRevealPhone(input: {
  memberProjectPool: boolean;
  ownerId: number | null;
  staffId: number;
}): boolean {
  if (!input.memberProjectPool) return true;
  return input.ownerId != null && Number(input.ownerId) === Number(input.staffId);
}

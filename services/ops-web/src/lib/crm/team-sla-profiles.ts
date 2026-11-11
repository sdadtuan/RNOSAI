/** Admin-editable lead clocks per team. Local defaults follow the 03/11/2026 process spec. */

export const TEAM_SLA_CODES = ['sale_service', 'marketing', 'sale_real_estate'] as const;

export type TeamSlaCode = (typeof TEAM_SLA_CODES)[number];

export type TeamSlaKind = 'sale' | 'marketing';

export type TeamSlaCalendar = {
  days: number[];
  start: string;
  end: string;
};

export type SaleTeamClocks = {
  claim_in_hours_minutes: number | null;
  claim_after_hours_time: string;
  update_after_claim_hours: number | null;
  reassign_after_claim_hours: number | null;
  retry_gap_hours: number | null;
  max_calls_per_day: number | null;
  no_contact_days: number | null;
  reassign_within_days: number | null;
  feedback_hours: number | null;
  missing_info_hours: number | null;
  max_open_leads: number | null;
};

export type MarketingTeamClocks = {
  claim_in_hours_minutes: number | null;
  claim_after_hours_time: string;
  claim_weekend_time: string;
  solution_cutoff_time: string;
  solution_before_cutoff_hours: number | null;
  solution_after_cutoff_time: string;
  revision_hours: number | null;
};

export type TeamSlaProfile = {
  code: TeamSlaCode;
  label: string;
  kind: TeamSlaKind;
  calendar: TeamSlaCalendar;
  sale: SaleTeamClocks;
  marketing: MarketingTeamClocks;
};

export type TeamSlaDocument = {
  version: 1;
  profiles: TeamSlaProfile[];
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const WEEKDAY = [1, 2, 3, 4, 5];

function blankSale(): SaleTeamClocks {
  return {
    claim_in_hours_minutes: null,
    claim_after_hours_time: '',
    update_after_claim_hours: null,
    reassign_after_claim_hours: null,
    retry_gap_hours: null,
    max_calls_per_day: null,
    no_contact_days: null,
    reassign_within_days: null,
    feedback_hours: null,
    missing_info_hours: null,
    max_open_leads: null,
  };
}

function blankMarketing(): MarketingTeamClocks {
  return {
    claim_in_hours_minutes: null,
    claim_after_hours_time: '',
    claim_weekend_time: '',
    solution_cutoff_time: '',
    solution_before_cutoff_hours: null,
    solution_after_cutoff_time: '',
    revision_hours: null,
  };
}

function saleServiceClocks(): SaleTeamClocks {
  return {
    claim_in_hours_minutes: 15,
    claim_after_hours_time: '09:00',
    update_after_claim_hours: 1,
    reassign_after_claim_hours: 2,
    retry_gap_hours: 2,
    max_calls_per_day: 3,
    no_contact_days: 2,
    reassign_within_days: 3,
    feedback_hours: 8,
    missing_info_hours: 1,
    max_open_leads: 6,
  };
}

function marketingClocks(): MarketingTeamClocks {
  return {
    claim_in_hours_minutes: 15,
    claim_after_hours_time: '09:00',
    claim_weekend_time: '09:00',
    solution_cutoff_time: '15:30',
    solution_before_cutoff_hours: 4,
    solution_after_cutoff_time: '11:00',
    revision_hours: 2,
  };
}

function calendar(start: string, end: string): TeamSlaCalendar {
  return { days: [...WEEKDAY], start, end };
}

export function defaultTeamSlaDocument(): TeamSlaDocument {
  return {
    version: 1,
    profiles: [
      {
        code: 'sale_service',
        label: 'Sale dịch vụ',
        kind: 'sale',
        calendar: calendar('08:30', '18:30'),
        sale: saleServiceClocks(),
        marketing: blankMarketing(),
      },
      {
        code: 'marketing',
        label: 'Marketing',
        kind: 'marketing',
        calendar: calendar('08:30', '18:30'),
        sale: blankSale(),
        marketing: marketingClocks(),
      },
      {
        code: 'sale_real_estate',
        label: 'Sale bất động sản',
        kind: 'sale',
        calendar: { days: [...WEEKDAY], start: '', end: '' },
        sale: blankSale(),
        marketing: blankMarketing(),
      },
    ],
  };
}

function asClock(raw: unknown): string {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  return TIME_RE.test(text) ? text : '';
}

function asNum(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function asDays(raw: unknown, fallback: number[]): number[] {
  if (!Array.isArray(raw)) return [...fallback];
  const days = raw
    .map((d) => Number(d))
    .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7);
  return [...new Set(days)].sort((a, b) => a - b);
}

function hasKey(o: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, key);
}

function pickNum(o: Record<string, unknown>, key: string, fallback: number | null): number | null {
  return hasKey(o, key) ? asNum(o[key]) : fallback;
}

function pickClock(o: Record<string, unknown>, key: string, fallback: string): string {
  return hasKey(o, key) ? asClock(o[key]) : fallback;
}

function mergeSale(base: SaleTeamClocks, raw: unknown): SaleTeamClocks {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    claim_in_hours_minutes: pickNum(o, 'claim_in_hours_minutes', base.claim_in_hours_minutes),
    claim_after_hours_time: pickClock(o, 'claim_after_hours_time', base.claim_after_hours_time),
    update_after_claim_hours: pickNum(o, 'update_after_claim_hours', base.update_after_claim_hours),
    reassign_after_claim_hours: pickNum(o, 'reassign_after_claim_hours', base.reassign_after_claim_hours),
    retry_gap_hours: pickNum(o, 'retry_gap_hours', base.retry_gap_hours),
    max_calls_per_day: pickNum(o, 'max_calls_per_day', base.max_calls_per_day),
    no_contact_days: pickNum(o, 'no_contact_days', base.no_contact_days),
    reassign_within_days: pickNum(o, 'reassign_within_days', base.reassign_within_days),
    feedback_hours: pickNum(o, 'feedback_hours', base.feedback_hours),
    missing_info_hours: pickNum(o, 'missing_info_hours', base.missing_info_hours),
    max_open_leads: pickNum(o, 'max_open_leads', base.max_open_leads),
  };
}

function mergeMarketing(base: MarketingTeamClocks, raw: unknown): MarketingTeamClocks {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    claim_in_hours_minutes: pickNum(o, 'claim_in_hours_minutes', base.claim_in_hours_minutes),
    claim_after_hours_time: pickClock(o, 'claim_after_hours_time', base.claim_after_hours_time),
    claim_weekend_time: pickClock(o, 'claim_weekend_time', base.claim_weekend_time),
    solution_cutoff_time: pickClock(o, 'solution_cutoff_time', base.solution_cutoff_time),
    solution_before_cutoff_hours: pickNum(
      o,
      'solution_before_cutoff_hours',
      base.solution_before_cutoff_hours,
    ),
    solution_after_cutoff_time: pickClock(
      o,
      'solution_after_cutoff_time',
      base.solution_after_cutoff_time,
    ),
    revision_hours: pickNum(o, 'revision_hours', base.revision_hours),
  };
}

export function normalizeTeamSlaDocument(raw: unknown): TeamSlaDocument {
  const base = defaultTeamSlaDocument();
  const incoming =
    raw && typeof raw === 'object' && Array.isArray((raw as { profiles?: unknown }).profiles)
      ? ((raw as { profiles: unknown[] }).profiles)
      : [];
  const byCode = new Map<string, unknown>();
  for (const row of incoming) {
    if (!row || typeof row !== 'object') continue;
    const code = String((row as { code?: unknown }).code ?? '');
    if (code) byCode.set(code, row);
  }
  return {
    version: 1,
    profiles: base.profiles.map((profile) => {
      const row = byCode.get(profile.code);
      if (!row || typeof row !== 'object') return profile;
      const o = row as Record<string, unknown>;
      const cal = (o.calendar ?? {}) as Record<string, unknown>;
      return {
        ...profile,
        label: String(o.label ?? profile.label).trim() || profile.label,
        calendar: {
          days: asDays(cal.days, profile.calendar.days),
          start: asClock(cal.start != null ? cal.start : profile.calendar.start),
          end: asClock(cal.end != null ? cal.end : profile.calendar.end),
        },
        sale: mergeSale(profile.sale, o.sale),
        marketing: mergeMarketing(profile.marketing, o.marketing),
      };
    }),
  };
}

export function teamSlaProfile(doc: TeamSlaDocument, code: TeamSlaCode): TeamSlaProfile {
  const found = doc.profiles.find((p) => p.code === code);
  if (found) return found;
  const fallback = defaultTeamSlaDocument().profiles.find((p) => p.code === code);
  if (!fallback) throw new Error(`missing profile ${code}`);
  return fallback;
}

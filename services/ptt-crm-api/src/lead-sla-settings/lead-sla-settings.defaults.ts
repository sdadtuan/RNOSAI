/** P10 §5.4 + §16 — default Lead FR SLA tenant payload. */

export const LEAD_SLA_SETTINGS_SCHEMA_VERSION = 1;

export type LeadSlaFr1Channel = 'phone' | 'zalo' | 'sms' | 'email';

export interface LeadSlaSettingsPayload {
  schema_version: number;
  timezone: string;
  working_hours: { days: number[]; start: string; end: string };
  holidays: string[];
  fr1_hours: number;
  fr1_channels: LeadSlaFr1Channel[];
  case_1a: {
    meeting_book_max_working_days: number;
    escalate_if_no_meeting_after_working_days: number;
    post_meeting_update_hours: number;
  };
  case_1b: {
    max_working_days: number;
    min_attempts: number;
    min_gap_working_hours: number;
    hot_max_working_days: number;
    hot_min_attempts: number;
    cooldown_days_same_am: number;
    max_extends: number;
    extend_working_days: number;
  };
  case_1c: {
    wrong_number_max_working_hours: number;
    unreachable_max_working_days: number;
    unreachable_min_attempts: number;
    max_reassign_rounds: number;
  };
  hot_rules: { sources: string[]; tags: string[] };
  redistribute: {
    strategy: 'round_robin_least_open' | 'manual_only';
    assign_queue_max_wait_working_hours: number;
    max_open_attempting_per_am: number;
  };
  eligible_pipeline_stages: string[];
  feature_flags: {
    lead_sla_reassign_enabled: boolean;
    lead_sla_reassign_dry_run: boolean;
    reassign_on_1a_timeout: boolean;
    allow_hold_recalc: boolean;
    min_dry_run_days: number;
    dry_run_started_at: string | null;
  };
  settings_version: number;
}

export function defaultLeadSlaSettingsPayload(
  settingsVersion = 1,
): LeadSlaSettingsPayload {
  return {
    schema_version: LEAD_SLA_SETTINGS_SCHEMA_VERSION,
    timezone: 'Asia/Saigon',
    working_hours: { days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' },
    holidays: [],
    fr1_hours: 2,
    fr1_channels: ['phone'],
    case_1a: {
      meeting_book_max_working_days: 3,
      escalate_if_no_meeting_after_working_days: 3,
      post_meeting_update_hours: 4,
    },
    case_1b: {
      max_working_days: 3,
      min_attempts: 5,
      min_gap_working_hours: 2,
      hot_max_working_days: 2,
      hot_min_attempts: 4,
      cooldown_days_same_am: 7,
      max_extends: 1,
      extend_working_days: 1,
    },
    case_1c: {
      wrong_number_max_working_hours: 4,
      unreachable_max_working_days: 2,
      unreachable_min_attempts: 3,
      max_reassign_rounds: 1,
    },
    hot_rules: {
      sources: ['ads_form', 'callback_request'],
      tags: ['hot', 'goi_gap'],
    },
    redistribute: {
      strategy: 'round_robin_least_open',
      assign_queue_max_wait_working_hours: 1,
      max_open_attempting_per_am: 30,
    },
    eligible_pipeline_stages: ['new', 'moi', 'qualified', 'lead_b2b', 'attempting', 'da_lien_he'],
    feature_flags: {
      lead_sla_reassign_enabled: false,
      lead_sla_reassign_dry_run: true,
      reassign_on_1a_timeout: false,
      allow_hold_recalc: false,
      min_dry_run_days: 3,
      dry_run_started_at: null,
    },
    settings_version: settingsVersion,
  };
}

export function mergeLeadSlaSettingsPayload(
  raw: unknown,
  settingsVersion?: number,
): LeadSlaSettingsPayload {
  const base = defaultLeadSlaSettingsPayload(settingsVersion ?? 1);
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const ff = (o.feature_flags ?? {}) as Record<string, unknown>;
  const wh = (o.working_hours ?? {}) as Record<string, unknown>;
  const c1a = (o.case_1a ?? {}) as Record<string, unknown>;
  const c1b = (o.case_1b ?? {}) as Record<string, unknown>;
  const c1c = (o.case_1c ?? {}) as Record<string, unknown>;
  const hot = (o.hot_rules ?? {}) as Record<string, unknown>;
  const red = (o.redistribute ?? {}) as Record<string, unknown>;

  return {
    ...base,
    schema_version: Number(o.schema_version ?? base.schema_version),
    timezone: String(o.timezone ?? base.timezone),
    working_hours: {
      days: Array.isArray(wh.days) ? (wh.days as number[]) : base.working_hours.days,
      start: String(wh.start ?? base.working_hours.start),
      end: String(wh.end ?? base.working_hours.end),
    },
    holidays: Array.isArray(o.holidays) ? (o.holidays as string[]) : base.holidays,
    fr1_hours: Number(o.fr1_hours ?? base.fr1_hours),
    fr1_channels: Array.isArray(o.fr1_channels)
      ? (o.fr1_channels as LeadSlaFr1Channel[])
      : base.fr1_channels,
    case_1a: { ...base.case_1a, ...c1a } as LeadSlaSettingsPayload['case_1a'],
    case_1b: { ...base.case_1b, ...c1b } as LeadSlaSettingsPayload['case_1b'],
    case_1c: { ...base.case_1c, ...c1c } as LeadSlaSettingsPayload['case_1c'],
    hot_rules: {
      sources: Array.isArray(hot.sources) ? (hot.sources as string[]) : base.hot_rules.sources,
      tags: Array.isArray(hot.tags) ? (hot.tags as string[]) : base.hot_rules.tags,
    },
    redistribute: {
      ...base.redistribute,
      ...red,
      strategy:
        red.strategy === 'manual_only' ? 'manual_only' : 'round_robin_least_open',
    } as LeadSlaSettingsPayload['redistribute'],
    eligible_pipeline_stages: Array.isArray(o.eligible_pipeline_stages)
      ? (o.eligible_pipeline_stages as string[])
      : base.eligible_pipeline_stages,
    feature_flags: {
      ...base.feature_flags,
      lead_sla_reassign_enabled: Boolean(
        ff.lead_sla_reassign_enabled ?? base.feature_flags.lead_sla_reassign_enabled,
      ),
      lead_sla_reassign_dry_run: Boolean(
        ff.lead_sla_reassign_dry_run ?? base.feature_flags.lead_sla_reassign_dry_run,
      ),
      reassign_on_1a_timeout: Boolean(
        ff.reassign_on_1a_timeout ?? base.feature_flags.reassign_on_1a_timeout,
      ),
      allow_hold_recalc: Boolean(ff.allow_hold_recalc ?? base.feature_flags.allow_hold_recalc),
      min_dry_run_days: Number(ff.min_dry_run_days ?? base.feature_flags.min_dry_run_days),
      dry_run_started_at:
        ff.dry_run_started_at == null
          ? base.feature_flags.dry_run_started_at
          : String(ff.dry_run_started_at),
    },
    settings_version: Number(settingsVersion ?? o.settings_version ?? base.settings_version),
  };
}

/** P10.c — GĐKD Lead Ops desk (§9.2). */

export type LeadOpsTab = 'p0' | 'p1' | 'p2' | 'p3';

export type LeadOpsRow = {
  lead_id: number;
  full_name: string;
  company_name: string;
  owner_id: number | null;
  owner_name: string | null;
  pipeline_stage: string;
  contact_status: string;
  last_call_result: string;
  attempts_since_assign: number;
  fr1_due_at: string | null;
  hold_until: string | null;
  reassign_count: number;
  is_hot: boolean;
  fr1_breached: boolean;
  hold_profile: string;
  hold_reason: string;
  sla_extend_count: number;
  meeting_at: string | null;
  last_call_at: string | null;
  assigned_at: string | null;
  updated_at: string | null;
  queue_age_hours: number | null;
  list_kind: 'fr1_breach' | 'hold_expiry' | 'queue' | 'meet_pending_lag' | 'no_touch' | 'dry_run';
};

export type LeadOpsWidgets = {
  fr1_breached: number;
  hold_due_within_4wh: number;
  redistribute_queue: number;
  queue_max_age_hours: number | null;
  queue_alert_over_1wh: number;
  meet_pending_no_meeting_over_1wd: number;
  no_touch_over_48h: number;
  dry_run_would_reassign: number;
};

export type FrOnTimeByAm = {
  owner_id: number;
  owner_name: string;
  today_on_time: number;
  today_total: number;
  today_pct: number | null;
  week_on_time: number;
  week_total: number;
  week_pct: number | null;
};

export type LeadOpsDeskSummary = {
  widgets: LeadOpsWidgets;
  fr_on_time_by_am: FrOnTimeByAm[];
  flags: {
    lead_sla_reassign_enabled: boolean;
    lead_sla_reassign_dry_run: boolean;
  };
  tabs: Record<LeadOpsTab, { label: string; count: number; hint: string }>;
};

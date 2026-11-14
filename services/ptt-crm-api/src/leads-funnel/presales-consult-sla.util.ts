export const CONSULT_PROPOSAL_SLA_HOURS = 48;
export const CONSULT_PROPOSAL_WARN_HOURS_BEFORE = 12;

export type PresalesConsultSlaState = 'na' | 'ok' | 'warning' | 'breach';

export interface PresalesConsultProposalSla {
  tier: 'consult_proposal_48h';
  sla_state: PresalesConsultSlaState;
  started_at: string | null;
  deadline_at: string | null;
  hours_elapsed: number | null;
  hours_remaining: number | null;
  minutes_remaining: number | null;
  message: string;
  reminder_cta: string;
}

function parseTimestamp(raw: string | null | undefined): Date | null {
  const text = String(raw ?? '').trim();
  if (!text) return null;
  const normalized = text.includes('T') ? text : text.replace(' ', 'T');
  const d = new Date(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(text);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return d;
}

function formatHoursRemaining(hours: number): string {
  if (hours <= 0) return '0h';
  if (hours >= 48) return `${Math.round(hours)}h`;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h${m}p` : `${h}h`;
}

export function resolveConsultStartedAt(input: {
  consultEnteredAt: string | null | undefined;
  stageEnteredAt: string | null | undefined;
}): string | null {
  const consult = String(input.consultEnteredAt ?? '').trim();
  if (consult) return consult;
  return String(input.stageEnteredAt ?? '').trim() || null;
}

export function buildPresalesConsultProposalSla(input: {
  presalesStage: string;
  consultEnteredAt: string | null | undefined;
  stageEnteredAt: string | null | undefined;
  now?: Date;
}): PresalesConsultProposalSla {
  const base: PresalesConsultProposalSla = {
    tier: 'consult_proposal_48h',
    sla_state: 'na',
    started_at: null,
    deadline_at: null,
    hours_elapsed: null,
    hours_remaining: null,
    minutes_remaining: null,
    message: 'Đã bỏ SLA Consult → Báo giá 48 giờ. Hạn Submit to AM là 1 ngày làm việc (08:30–18:30 T2–T6).',
    reminder_cta: '',
  };

  // Retired: the 48h consult→proposal clock counted Marketing/Solutions time. Always na.
  return base;
}

export interface PresalesConsultSlaSummary {
  active_consult: number;
  sla_ok: number;
  sla_warning: number;
  sla_breach: number;
  consult_to_proposal_48h_pct: number;
  consult_to_proposal_48h_num: number;
  consult_to_proposal_48h_denom: number;
}

export function hoursBetween(startRaw: string | null, endRaw: string | null): number | null {
  const start = parseTimestamp(startRaw);
  const end = parseTimestamp(endRaw);
  if (!start || !end) return null;
  return (end.getTime() - start.getTime()) / 3_600_000;
}

export function isConsultToProposalWithin48h(
  consultEnteredAt: string | null,
  proposalEnteredAt: string | null,
): boolean {
  const hrs = hoursBetween(consultEnteredAt, proposalEnteredAt);
  if (hrs == null || hrs < 0) return false;
  return hrs <= CONSULT_PROPOSAL_SLA_HOURS;
}

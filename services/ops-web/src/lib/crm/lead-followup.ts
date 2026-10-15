export type LeadFollowupKind = 'no_answer' | 'busy' | 'callback';

export type LeadFollowup = {
  kind: LeadFollowupKind;
  label: string;
  when: string;
};

const NO_ANSWER = new Set(['ring_no_answer', 'no_answer', 'khong_nghe_may']);
const BUSY = new Set(['unreachable', 'khong_goi_duoc', 'khong_lien_lac_duoc']);
const CALLBACK = new Set(['callback_requested', 'callback', 'khach_hen_goi_lai']);

function formatWhen(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('day')}/${pick('month')} ${pick('hour')}:${pick('minute')}`;
}

export function leadFollowup(lead: {
  last_call_result?: string | null;
  next_call_at?: string | null;
  callback_at?: string | null;
}): LeadFollowup | null {
  const result = String(lead.last_call_result ?? '').trim().toLowerCase();
  if (CALLBACK.has(result)) {
    const when = formatWhen(lead.next_call_at || lead.callback_at);
    return { kind: 'callback', label: 'Hẹn gọi lại', when };
  }
  if (BUSY.has(result)) return { kind: 'busy', label: 'Máy bận', when: '' };
  if (NO_ANSWER.has(result)) return { kind: 'no_answer', label: 'Không nghe máy', when: '' };
  return null;
}

export function followupChip(followup: LeadFollowup): string {
  return followup.when ? `${followup.label} · ${followup.when}` : followup.label;
}

export type LeadCareChip = {
  kind: LeadFollowupKind | 'deadline';
  label: 'Hẹn gọi lại' | 'Máy bận' | 'Không nghe máy' | 'Sắp hết hạn liên hệ';
  sentence: string;
};

export function leadCareChip(
  lead: {
    b2_complete?: boolean;
    last_call_result?: string | null;
    hold_until?: string | null;
    b2_assigned_at?: string | null;
    next_call_at?: string | null;
    callback_at?: string | null;
  },
  now = new Date(),
): LeadCareChip | null {
  if (lead.b2_complete) return null;
  const followup = leadFollowup(lead);
  const holdUntil = parseDate(lead.hold_until);
  if (followup && holdUntil && holdUntil.getTime() > now.getTime()) {
    return {
      kind: followup.kind,
      label: followup.label,
      sentence: `Giữ đến ${formatFull(holdUntil)}`,
    };
  }
  const assigned = parseDate(lead.b2_assigned_at);
  if (!assigned) return null;
  const hoursLeft = (assigned.getTime() + 24 * 3600_000 - now.getTime()) / 3600_000;
  if (!(hoursLeft > 0 && hoursLeft < 4)) return null;
  const hours = Math.max(1, Math.ceil(hoursLeft - 1e-6));
  return {
    kind: 'deadline',
    label: 'Sắp hết hạn liên hệ',
    sentence: `Còn ${hours} giờ để Liên hệ OK`,
  };
}

function parseDate(raw: string | null | undefined): Date | null {
  const value = String(raw ?? '').trim();
  if (!value) return null;
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatFull(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('day')}/${pick('month')}/${pick('year')} ${pick('hour')}:${pick('minute')}`;
}

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

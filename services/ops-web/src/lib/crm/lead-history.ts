import { leadStatusLabel } from '@/lib/crm/lead-status';

export type LeadHistoryInput = {
  id: number;
  user_name?: string | null;
  created_by?: string | null;
  content?: string | null;
  activity_type?: string | null;
  activity_type_label?: string | null;
  created_at?: string | null;
};

export type LeadStatusHistoryInput = {
  id: string | number;
  old_status: string;
  new_status: string;
  changed_by: string;
  note?: string | null;
  created_at: string;
};

export type LeadHistoryLine = {
  key: string;
  id: number;
  who: string;
  what: string;
  when: string;
};

const SYSTEM_ACTORS = new Set(['', 'system', 'revops-sla-worker', 'ae']);

function formatWhen(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function whoLabel(row: LeadHistoryInput): string {
  const name = String(row.user_name ?? '').trim();
  if (name && !name.startsWith('#')) return name;
  const actor = String(row.created_by ?? '').trim().toLowerCase();
  if (SYSTEM_ACTORS.has(actor) || actor.startsWith('staff:')) return 'Hệ thống';
  return 'Hệ thống';
}

function plainWhat(row: LeadHistoryInput): string {
  const raw = String(row.content ?? '').trim();
  const flat = raw.replace(/\s+/g, ' ');
  if (/revops sla reminder/i.test(flat) || /lead first response/i.test(flat)) {
    return 'Nhắc sắp hết giờ gọi khách lần đầu.';
  }
  if (/nhắc leader/i.test(flat)) {
    return 'Nhắc trưởng nhóm: lead chưa được chăm thêm 1 ngày.';
  }
  if (/đứng yên quá hạn/i.test(flat)) {
    return 'Nhắc người phụ trách: lead quá hạn chưa được chăm.';
  }
  if (/^ae bắt đầu gọi$/i.test(flat)) return 'Bắt đầu gọi';

  const lines = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('Trạng thái lead') && !line.startsWith('Kênh:'));
  const text = lines
    .join('. ')
    .replace(/Đổ chuông — khách không bắt máy/g, 'Không nghe máy')
    .replace(/Đã gọi, khách không nghe máy/g, 'Không nghe máy')
    .replace(
      /Không liên lạc được \(máy bận hoặc không kết nối\)/g,
      'Máy bận',
    )
    .replace(/Đã gọi, máy bận hoặc không kết nối được/g, 'Máy bận')
    .replace(/Khách hẹn gọi lại/g, 'Hẹn gọi lại')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return text;
  const label = String(row.activity_type_label ?? '').trim();
  if (label && !/solution|deal room|export|inbox|breach|sla/i.test(label)) return label;
  return 'Cập nhật lead';
}

function stamp(raw: string | null | undefined): number {
  const value = String(raw ?? '').trim();
  if (!value) return 0;
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function statusWho(actor: string): string {
  const value = actor.trim();
  if (!value || SYSTEM_ACTORS.has(value.toLowerCase()) || value.toLowerCase().startsWith('staff:')) return 'Hệ thống';
  if (/^[0-9a-f-]{16,}$/i.test(value)) return 'Hệ thống';
  return value;
}

export function presentLeadHistory(row: LeadHistoryInput): LeadHistoryLine {
  return {
    key: `activity-${row.id}`,
    id: row.id,
    who: whoLabel(row),
    what: plainWhat(row),
    when: formatWhen(row.created_at),
  };
}

export function mergeLeadCareHistory(
  activities: LeadHistoryInput[],
  statusLogs: LeadStatusHistoryInput[],
): LeadHistoryLine[] {
  const care = activities.map((row) => ({ line: presentLeadHistory(row), at: stamp(row.created_at) }));
  const status = statusLogs.map((row) => {
    const from = leadStatusLabel(row.old_status);
    const to = leadStatusLabel(row.new_status);
    const note = String(row.note ?? '').trim();
    const change = `Trạng thái: ${from} → ${to}`;
    return {
      line: {
        key: `status-${row.id}`,
        id: Number(row.id) || 0,
        who: statusWho(row.changed_by),
        what: note && !change.includes(note) ? `${change}. ${note}` : change,
        when: formatWhen(row.created_at),
      },
      at: stamp(row.created_at),
    };
  });
  return [...care, ...status].sort((a, b) => b.at - a.at || b.line.id - a.line.id).map((row) => row.line);
}

export type LeadOwnerChangeInput = {
  id: string | number;
  from_name?: string | null;
  to_name?: string | null;
  would_to_name?: string | null;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
  dry_run?: boolean;
};

export function formatHistoryClock(raw: string | null | undefined): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Saigon',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('hour')}:${get('minute')} ${get('day')}/${get('month')}/${get('year')}`;
}

function actorDisplay(createdBy: string | null | undefined): string {
  const value = String(createdBy ?? '').trim();
  if (!value) return '';
  if (SYSTEM_ACTORS.has(value.toLowerCase()) || value.toLowerCase().startsWith('staff:')) return 'Hệ thống';
  return value;
}

export function ownerChangeReasonLabel(
  reason: string | null | undefined,
  createdBy?: string | null,
  dryRun?: boolean,
): string {
  const raw = String(reason ?? '').trim();
  const lower = raw.toLowerCase();
  let core = '';
  if (
    /tre\s*nhan|trễ\s*nhận|claim_timeout|1a_timeout|sla_hold_expired_1a|would_reassign:.*1a/.test(lower)
  ) {
    core = 'trễ nhận';
  } else if (
    /tre\s*cập|trễ\s*cập|update_timeout|sla_hold_expired_1[bc]|would_reassign:.*1[bc]|hold_expired/.test(lower)
  ) {
    core = 'trễ cập nhật';
  } else {
    const who = actorDisplay(createdBy);
    core = who ? `thủ công bởi ${who}` : 'thủ công';
  }
  if (dryRun) core = `${core} (dự kiến)`;
  return core;
}

export function presentOwnerChange(row: LeadOwnerChangeInput): LeadHistoryLine {
  const from = String(row.from_name ?? '').trim() || '—';
  const to = String(row.would_to_name || row.to_name || '').trim() || '—';
  const why = ownerChangeReasonLabel(row.reason, row.created_by, row.dry_run);
  const when = formatHistoryClock(row.created_at);
  return {
    key: `owner-${row.id}`,
    id: Number(row.id) || 0,
    who: actorDisplay(row.created_by) || 'Hệ thống',
    what: `Chuyển từ Sales ${from} → Sales ${to} · ${why} · ${when}`,
    when: '',
  };
}

export function firstAcceptorName(
  logs: LeadOwnerChangeInput[],
  currentOwner?: string | null,
): string | null {
  const real = logs
    .filter((row) => !row.dry_run)
    .slice()
    .sort((a, b) => stamp(a.created_at) - stamp(b.created_at));
  if (!real.length) return null;
  const first = real[0];
  const from = String(first?.from_name ?? '').trim();
  const to = String(first?.to_name ?? '').trim();
  const name = from && from !== '—' ? from : to;
  if (!name || name === '—') return null;
  const current = String(currentOwner ?? '').trim();
  if (current && current === name) return null;
  return name;
}

export function presentOwnerChanges(rows: LeadOwnerChangeInput[]): LeadHistoryLine[] {
  return rows
    .map((row) => ({ line: presentOwnerChange(row), at: stamp(row.created_at) }))
    .sort((a, b) => b.at - a.at || b.line.id - a.line.id)
    .map((row) => row.line);
}


export function resolveStaffDisplayName(
  id: number | null | undefined,
  fallback?: string | null,
  staff: Array<{ id: number; name: string }> = [],
): string {
  const hit = id != null ? staff.find((row) => row.id === id) : undefined;
  if (hit?.name?.trim()) return hit.name.trim();
  const raw = String(fallback ?? '').trim();
  if (raw && raw !== '—' && !/^#\d+$/.test(raw)) return raw;
  if (id != null && id > 0) return `#${id}`;
  return '—';
}

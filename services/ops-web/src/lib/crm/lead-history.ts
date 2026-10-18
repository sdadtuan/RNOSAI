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

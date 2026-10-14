export type LeadHistoryInput = {
  id: number;
  user_name?: string | null;
  created_by?: string | null;
  content?: string | null;
  activity_type?: string | null;
  activity_type_label?: string | null;
  created_at?: string | null;
};

export type LeadHistoryLine = {
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
    .replace(/Đổ chuông — khách không bắt máy/g, 'Đã gọi, khách không nghe máy')
    .replace(
      /Không liên lạc được \(máy bận hoặc không kết nối\)/g,
      'Đã gọi, máy bận hoặc không kết nối được',
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (text) return text;
  const label = String(row.activity_type_label ?? '').trim();
  if (label && !/solution|deal room|export|inbox|breach|sla/i.test(label)) return label;
  return 'Cập nhật lead';
}

export function presentLeadHistory(row: LeadHistoryInput): LeadHistoryLine {
  return {
    id: row.id,
    who: whoLabel(row),
    what: plainWhat(row),
    when: formatWhen(row.created_at),
  };
}

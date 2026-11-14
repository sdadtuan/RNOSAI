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
  kind?: 'solution' | 'care' | 'owner' | 'call';
  tag?: string;
};

export function isSolutionHistoryLine(line: LeadHistoryLine | null | undefined): boolean {
  if (!line) return false;
  if (line.kind === 'solution') return true;
  const text = `${line.what ?? ''} ${line.key ?? ''}`;
  return /Nộp Solution|Sales nhận Solution|Sales xem Solution|AI tạo Solution|Tải file Solution|Đổi Deadline Solutions|solution_file_uploaded|solution_ai_draft|solution_released|solution_received|solution_viewed|solution_deadline/i.test(text);
}

const SYSTEM_ACTORS = new Set(['', 'system', 'revops-sla-worker', 'ae', 'auto_assign', 'auto-assign']);

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

const SOLUTION_FLOW_ACTIVITY_TYPES = new Set([
  'solution_file_uploaded',
  'solution_ai_draft',
  'solution_released',
  'solution_received',
  'solution_viewed',
  'solution_deadline_changed',
]);

function solutionFlowAction(row: LeadHistoryInput): string {
  const raw = String(row.content ?? '').trim();
  if (raw.includes(' · ')) {
    const parts = raw.split(' · ').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2) return parts.slice(1).join(' · ');
  }
  const type = String(row.activity_type ?? '').trim();
  if (type === 'solution_file_uploaded') return raw || 'Tải file Solution';
  if (type === 'solution_ai_draft') return 'AI tạo Solution';
  if (type === 'solution_released') return 'Nộp Solution cho Sales';
  if (type === 'solution_received') return 'Sales nhận Solution';
  if (type === 'solution_viewed') return 'Sales xem Solution';
  if (type === 'solution_deadline_changed') return raw || 'Đổi Deadline Solutions';
  return raw;
}

export function presentLeadHistory(row: LeadHistoryInput): LeadHistoryLine {
  const type = String(row.activity_type ?? '').trim();
  const when = formatHistoryClock(row.created_at) || formatWhen(row.created_at);
  const who = whoLabel(row);
  // API createActivity remaps unknown solution_* types (AI, upload, viewed, received, deadline) to `note`.
  if (
    SOLUTION_FLOW_ACTIVITY_TYPES.has(type) ||
    /Nộp Solution|Sales nhận Solution|Sales xem Solution|AI tạo Solution|Tải file Solution|Đổi Deadline Solutions/i.test(
      String(row.content ?? ''),
    )
  ) {
    const action = solutionFlowAction(row);
    const whoFromContent = String(row.content ?? '').split(' · ')[0]?.trim();
    const actor =
      who && who !== 'Hệ thống'
        ? who
        : whoFromContent && whoFromContent !== 'Hệ thống'
          ? whoFromContent
          : who || 'Hệ thống';
    return {
      key: `activity-${row.id}`,
      id: row.id,
      who: actor,
      what: `${actor} · ${action} · ${when}`.trim(),
      when,
      kind: 'solution',
    };
  }
  return {
    key: `activity-${row.id}`,
    id: row.id,
    who,
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
  from_user_id?: number | null;
  to_user_id?: number | null;
  reason?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  dry_run?: boolean;
  owner_kind?: string | null;
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

function isSystemActor(createdBy: string | null | undefined): boolean {
  const value = String(createdBy ?? '').trim().toLowerCase();
  return !value || SYSTEM_ACTORS.has(value) || value.startsWith('staff:');
}

function actorDisplay(createdBy: string | null | undefined, createdByName?: string | null): string {
  if (isSystemActor(createdBy)) return 'Hệ thống';
  const named = displayStaffName(createdByName);
  if (named !== '—') return named;
  const value = String(createdBy ?? '').trim();
  return value;
}

/** Map assigned_by email/code to a staff display name when one exists. */
export function resolveActorDisplayName(
  createdBy: string | null | undefined,
  staff: Array<{ id: number; name: string; email?: string | null }> = [],
): string {
  if (isSystemActor(createdBy)) return '';
  const raw = String(createdBy ?? '').trim();
  const lower = raw.toLowerCase();
  const hit = staff.find((row) => String(row.email ?? '').trim().toLowerCase() === lower);
  if (hit?.name?.trim()) return hit.name.trim();
  return raw;
}

export function ownerChangeReasonLabel(
  reason: string | null | undefined,
  createdBy?: string | null,
  dryRun?: boolean,
  createdByName?: string | null,
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
  } else if (isSystemActor(createdBy) || lower === 'auto_assign' || lower === 'auto-assign') {
    core = 'tự động';
  } else {
    const who = actorDisplay(createdBy, createdByName);
    core = who && who !== 'Hệ thống' ? `thủ công bởi ${who}` : 'thủ công';
  }
  if (dryRun) core = `${core} (chạy thử, chưa chuyển)`;
  return core;
}

const OWNER_ROLE_LABEL: Record<string, string> = {
  sales: 'Sales',
  am: 'AM',
  acm: 'ACM',
  solution: 'AM',
  quote_am: 'AM',
};

export function ownerRoleLabel(kind?: string | null): string {
  const key = String(kind ?? 'sales').trim().toLowerCase() || 'sales';
  return OWNER_ROLE_LABEL[key] ?? 'Sales';
}

/** Staff label for history / management: never a bare #id. */
export function displayStaffName(name?: string | null): string {
  const raw = String(name ?? '').trim();
  if (!raw || raw === '—' || /^#\d+$/.test(raw)) return '—';
  return raw;
}

function staffIdOf(value?: number | null): number | null {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function sameStaff(
  leftId?: number | null,
  leftName?: string | null,
  rightId?: number | null,
  rightName?: string | null,
): boolean {
  const aId = staffIdOf(leftId);
  const bId = staffIdOf(rightId);
  if (aId && bId && aId === bId) return true;
  const a = displayStaffName(leftName);
  const b = displayStaffName(rightName);
  return a !== '—' && b !== '—' && a.toLowerCase() === b.toLowerCase();
}

export function presentOwnerChange(row: LeadOwnerChangeInput): LeadHistoryLine {
  const role = ownerRoleLabel(row.owner_kind);
  const from = displayStaffName(row.from_name);
  const to = displayStaffName(row.would_to_name || row.to_name);
  const why = ownerChangeReasonLabel(row.reason, row.created_by, row.dry_run, row.created_by_name);
  const when = formatHistoryClock(row.created_at);
  if (/^solution_auto_assign/i.test(String(row.reason ?? '').trim())) {
    return {
      key: `owner-${row.id}`,
      id: Number(row.id) || 0,
      who: 'Hệ thống',
      what: `Giao Solution cho ${to} (tự động) · ${when}`,
      when: '',
      kind: 'owner',
    };
  }
  const core =
    from === '—'
      ? `Giao ban đầu cho ${role} ${to}`
      : `Chuyển từ ${role} ${from} → ${role} ${to}`;
  return {
    key: `owner-${row.id}`,
    id: Number(row.id) || 0,
    who: actorDisplay(row.created_by, row.created_by_name) || 'Hệ thống',
    what: `${core} · ${why} · ${when}`,
    when: '',
    kind: 'owner',
  };
}

export function firstAcceptorName(
  logs: LeadOwnerChangeInput[],
  currentOwner?: string | null,
  currentOwnerId?: number | null,
): string | null {
  const real = logs
    .filter((row) => !row.dry_run)
    .filter((row) => {
      const kind = String(row.owner_kind ?? 'sales').trim().toLowerCase() || 'sales';
      return kind === 'sales';
    })
    .slice()
    .sort((a, b) => stamp(a.created_at) - stamp(b.created_at));
  if (!real.length) return null;
  const first = real[0];
  const fromId = staffIdOf(first?.from_user_id);
  const toId = staffIdOf(first?.to_user_id);
  const fromName = displayStaffName(first?.from_name);
  const toName = displayStaffName(first?.to_name);
  const firstId = fromId ?? toId;
  const firstName = fromName !== '—' ? fromName : toName;
  if (sameStaff(firstId, firstName, currentOwnerId, currentOwner)) return null;
  if (firstName === '—') return null;
  return firstName;
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
  return '—';
}


export type LeadCallAttemptInput = {
  id: number;
  attempt_no?: number;
  channel?: string | null;
  started_at?: string | null;
  call_result?: string | null;
  counts_toward_fr1?: boolean;
  warn_call_too_soon?: boolean;
  notes?: string | null;
};

const CALL_CHANNEL_VI: Record<string, string> = {
  phone: 'Điện thoại',
  zalo: 'Zalo',
  sms: 'SMS',
  email: 'Email',
};

const CALL_RESULT_VI: Record<string, string> = {
  ring_no_answer: 'Không nghe máy',
  unreachable: 'Máy bận',
  wrong_number: 'Sai số',
  connected_meet_pending: 'Đã nói chuyện — chờ gặp mặt (1a)',
  connected_qualified: 'Đã nói chuyện — đủ thông tin',
  callback_requested: 'Hẹn gọi lại',
  connected_other: 'Đã nói chuyện — kết quả khác',
};

export type HistoryColumn = 'sale' | 'lead';

const CLOCK_RE = /(\d{2}:\d{2})(?::\d{2})?\s+(\d{2}\/\d{2}\/\d{4})/;
const CLOCK_VI_RE = /(\d{2}\/\d{2}\/\d{4})[,\s]+(\d{2}:\d{2})(?::\d{2})?/;

const CALL_LIKE_RE =
  /Bắt đầu gọi|Máy bận|Không nghe máy|Sai số|Hẹn gọi lại|Đã nói chuyện|cuộc gọi|Gọi khách|Gọi quá sát|Không tính phản hồi đầu/i;

const SALE_PROCESS_RE =
  /Discovery|tư vấn Sale|Sales tư vấn|nộp bản tư vấn|ghi chú chăm sóc|Nhắc sắp hết giờ gọi|Nhắc trưởng nhóm|lead quá hạn chưa được chăm|bước Sales|Sales bước/i;

const LEAD_EVENT_RE =
  /Submit to AM|Nộp lên AM|Giao cho AM|AM nhận|Nhận case|bàn giao AM|Chuyển từ |Giao ban đầu|Trạng thái\s*:/i;

export function presentCallHistoryLine(row: LeadCallAttemptInput): LeadHistoryLine {
  const when = formatHistoryClock(row.started_at);
  const channelKey = String(row.channel ?? '').trim().toLowerCase();
  const channel = CALL_CHANNEL_VI[channelKey] ?? (channelKey || '—');
  const resultKey = String(row.call_result ?? '').trim();
  const result = CALL_RESULT_VI[resultKey] ?? (resultKey || '—');
  const flags: string[] = [];
  if (row.counts_toward_fr1) flags.push('Phản hồi đầu');
  if (row.warn_call_too_soon) flags.push('Gọi quá sát');
  const notes = String(row.notes ?? '').trim();
  const action = [channel, result, ...flags, notes].filter(Boolean).join(', ');
  const who = 'Sale';
  return {
    key: `call-${row.id}`,
    id: row.id,
    who,
    what: `${who} · ${action} · ${when}`.trim(),
    when,
    kind: 'call',
    tag: row.counts_toward_fr1 ? 'Phản hồi đầu' : undefined,
  };
}

function rowClock(line: LeadHistoryLine): string {
  const what = String(line.what ?? '');
  const when = String(line.when ?? '');
  const fromWhat = what.match(CLOCK_RE);
  if (fromWhat) return `${fromWhat[1]} ${fromWhat[2]}`;
  const fromWhenClock = when.match(CLOCK_RE);
  if (fromWhenClock) return `${fromWhenClock[1]} ${fromWhenClock[2]}`;
  const fromWhenVi = when.match(CLOCK_VI_RE);
  if (fromWhenVi) return `${fromWhenVi[2]} ${fromWhenVi[1]}`;
  return formatHistoryClock(when) || when;
}

function stripClock(text: string): string {
  return String(text ?? '')
    .replace(/\s*·\s*\d{2}:\d{2}(?::\d{2})?\s+\d{2}\/\d{2}\/\d{4}\s*$/, '')
    .replace(/\s*·\s*\d{2}\/\d{2}\/\d{4}[,\s]+\d{2}:\d{2}(?::\d{2})?\s*$/, '')
    .trim();
}

export function formatHistoryClockShort(raw: string | null | undefined): string {
  const full = formatHistoryClock(raw) || rowClock({ key: '', id: 0, who: '', what: '', when: String(raw ?? '') });
  return full.replace(/\/\d{4}$/, '');
}

function shortClockFromLine(line: LeadHistoryLine): string {
  return rowClock(line).replace(/\/\d{4}$/, '');
}

function isoToShortClock(raw: string): string {
  return formatHistoryClock(raw).replace(/\/\d{4}$/, '') || raw;
}

export function shortenHistoryAction(action: string): string {
  let text = String(action ?? '').trim();
  text = text.replace(/\s*·?\s*Dịch vụ:\s*[^·]*/gi, '');
  text = text.replace(/(?:^|[,\s/])scope:\d+/gi, '');
  text = text.replace(/\s*,\s*,+/g, ',').replace(/^,+|,+$/g, '');

  if (/Sales Discovery/i.test(text) && /nộp cho AM|đã nộp/i.test(text)) {
    text = 'Nộp Sales Discovery cho AM';
  }

  if (/Submit to AM/i.test(text)) {
    text = 'Submit to AM';
  } else if (/Lead chờ AM nhận|chờ AM nhận/i.test(text)) {
    text = 'Chờ AM nhận';
  }
  text = text.replace(/\s*[—\-–]?\s*lead vào Chờ Solutions\.?/gi, '');
  text = text.replace(/\s*Hạn nhận case[^·.]*(?:\.|$)/gi, '');

  text = text.replace(/^Trạng thái:\s*/i, 'Trạng thái ');
  text = text.replace(/Hẹn gọi lại\s*[—\-–]\s*Hẹn gọi lại/gi, 'Hẹn gọi lại');
  text = text.replace(
    /Hẹn gọi lại:\s*(\d{4}-\d{2}-\d{2}T[0-9:.Z+\-]+)/gi,
    (_, iso: string) => `Hẹn gọi lại ${isoToShortClock(iso)}`,
  );
  text = text.replace(/\d{4}-\d{2}-\d{2}T[0-9:.]+Z/g, (iso) => isoToShortClock(iso));

  text = text.replace(/\.\s*Ghi chú:\s*[^·]*/g, '');

  text = text.replace(
    /^Giao ban đầu cho (?:Sales|AM)\s+(.+?)\s*·\s*(tự động|thủ công)\b.*/i,
    'Giao $1 ($2)',
  );
  text = text.replace(
    /^Chuyển từ (?:Sales|AM)\s+(.+?)\s*→\s*(?:Sales|AM)\s+(.+?)\s*·\s*(.+)$/i,
    (_m, from: string, to: string, why: string) => {
      const shortWhy = String(why)
        .replace(/^thủ công bởi .*/i, 'thủ công')
        .replace(/\(chạy thử, chưa chuyển\)/g, 'chạy thử')
        .trim();
      return `Chuyển ${from} → ${to} (${shortWhy})`;
    },
  );

  text = text.replace(/,?\s*Không tính phản hồi đầu/gi, '');
  text = text.replace(/,?\s*Phản hồi đầu/gi, '');
  text = text.replace(/,?\s*Gọi quá sát/gi, '');

  // Call "SMS, Hẹn gọi lại" → "SMS · Hẹn gọi lại"
  if (/^(Điện thoại|Zalo|SMS|Email)\s*,\s*/i.test(text) && text.split('·').length === 1) {
    text = text.replace(/\s*,\s*/g, ' · ');
  }

  text = text.replace(/\s{2,}/g, ' ').replace(/\s*·\s*·+/g, ' · ').replace(/^[\s·]+|[\s·]+$/g, '').trim();
  return text;
}

export type ShortHistoryRowView = {
  who: string;
  action: string;
  clock: string;
  title: string;
  tag?: string;
};

export function presentShortHistoryRow(line: LeadHistoryLine): ShortHistoryRowView {
  const who = String(line.who ?? '').trim();
  let action = stripClock(String(line.what ?? '').trim());
  if (who && (action === who || action.startsWith(`${who} · `))) {
    action = action.slice(who.length).replace(/^\s*·\s*/, '');
  }
  action = shortenHistoryAction(action);
  const clock = shortClockFromLine(line);
  const title = [who, stripClock(String(line.what ?? '').trim()).replace(new RegExp('^' + who.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*·\\s*'), ''), rowClock(line)]
    .filter(Boolean)
    .join(' · ');
  const fullTitle = String(line.what ?? '').trim() || title;
  return { who, action, clock, title: fullTitle, tag: line.tag };
}

export function formatCompactHistoryRow(line: LeadHistoryLine): string {
  const row = presentShortHistoryRow(line);
  return [row.who, row.action, row.clock].filter(Boolean).join(' · ');
}

export function historyColumnOf(line: LeadHistoryLine): HistoryColumn {
  if (line.kind === 'solution' || isSolutionHistoryLine(line)) return 'lead';
  if (line.kind === 'owner' || String(line.key).startsWith('owner-')) return 'lead';
  if (String(line.key).startsWith('status-') || /Trạng thái\s*:/.test(String(line.what ?? ''))) return 'lead';
  if (line.kind === 'call' || String(line.key).startsWith('call-')) return 'sale';
  if (LEAD_EVENT_RE.test(String(line.what ?? ''))) return 'lead';
  if (CALL_LIKE_RE.test(String(line.what ?? '')) || SALE_PROCESS_RE.test(String(line.what ?? ''))) return 'sale';
  if (String(line.key).startsWith('activity-') || line.kind === 'care') return 'sale';
  return 'lead';
}

function lineStamp(line: LeadHistoryLine): number {
  const clock = rowClock(line);
  const m = clock.match(/^(\d{2}):(\d{2})\s+(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const iso = `${m[5]}-${m[4]}-${m[3]}T${m[1]}:${m[2]}:00+07:00`;
    const t0 = new Date(iso).getTime();
    if (!Number.isNaN(t0)) return t0;
  }
  return stamp(line.when);
}

function fingerprint(line: LeadHistoryLine): string {
  return stripClock(formatCompactHistoryRow(line)).toLowerCase().replace(/\s+/g, ' ').trim();
}

function semanticBucket(line: LeadHistoryLine): string {
  const action = presentShortHistoryRow(line).action.toLowerCase();
  if (/submit to am|chờ am nhận|nộp lên am/.test(action)) return 'submit-to-am';
  return action;
}

function preferSemantic(current: LeadHistoryLine, next: LeadHistoryLine): LeadHistoryLine {
  const a = presentShortHistoryRow(current).action;
  const b = presentShortHistoryRow(next).action;
  const score = (value: string) => (value === 'Submit to AM' ? 3 : value === 'Chờ AM nhận' ? 1 : 2);
  if (score(a) !== score(b)) return score(a) > score(b) ? current : next;
  return String(current.what ?? '').length >= String(next.what ?? '').length ? current : next;
}

function dedupeSemanticLines(lines: LeadHistoryLine[]): LeadHistoryLine[] {
  const byKey = new Map<string, LeadHistoryLine>();
  const order: string[] = [];
  for (const line of lines) {
    const key = `${semanticBucket(line)}@${Math.floor(lineStamp(line) / 60000)}`;
    if (!byKey.has(key)) {
      byKey.set(key, line);
      order.push(key);
    } else {
      byKey.set(key, preferSemantic(byKey.get(key) as LeadHistoryLine, line));
    }
  }
  return order.map((key) => byKey.get(key) as LeadHistoryLine);
}

function mergeUniqueLines(lines: LeadHistoryLine[]): LeadHistoryLine[] {
  const byKey = new Map<string, LeadHistoryLine>();
  for (const line of lines) {
    const key = line.key || `activity-${line.id}`;
    if (!byKey.has(key)) byKey.set(key, line);
  }
  return [...byKey.values()];
}

export function splitLeadHistoryColumns(input: {
  activityLines?: LeadHistoryLine[];
  ownerLines?: LeadHistoryLine[];
  callAttempts?: LeadCallAttemptInput[];
}): { saleLines: LeadHistoryLine[]; leadLines: LeadHistoryLine[] } {
  const calls = (input.callAttempts ?? []).map((row) => presentCallHistoryLine(row));
  const merged = mergeUniqueLines([...(input.activityLines ?? []), ...(input.ownerLines ?? [])]);
  const sale: LeadHistoryLine[] = [...calls];
  const lead: LeadHistoryLine[] = [];
  const seen = new Set(calls.map((line) => fingerprint(line)));
  const hasCalls = calls.length > 0;
  for (const line of merged) {
    const callLike =
      line.kind === 'call' ||
      String(line.key).startsWith('call-') ||
      (CALL_LIKE_RE.test(String(line.what ?? '')) &&
        historyColumnOf(line) === 'sale' &&
        !isSolutionHistoryLine(line));
    if (hasCalls && callLike) continue;
    const fp = fingerprint(line);
    if (fp && seen.has(fp)) continue;
    if (fp) seen.add(fp);
    if (historyColumnOf(line) === 'sale') sale.push(line);
    else lead.push(line);
  }
  const byTime = (a: LeadHistoryLine, b: LeadHistoryLine) =>
    lineStamp(b) - lineStamp(a) || (b.id || 0) - (a.id || 0);
  sale.sort(byTime);
  lead.sort(byTime);
  return { saleLines: dedupeSemanticLines(sale), leadLines: dedupeSemanticLines(lead) };
}

export const LEAD_STATUS_LABELS: Record<string, string> = {
  moi: 'Mới',
  da_lien_he: 'Đã liên hệ',
  dang_tu_van: 'Đang tư vấn',
  hen_gap: 'Hẹn gặp',
  bao_gia: 'Báo giá',
  dam_phan: 'Đàm phán',
  chot: 'Chốt',
  post_sale: 'Sau bán',
  won: 'Chốt',
  proposal: 'Báo giá',
  lost: 'Thất bại',
  nurture: 'Chăm sóc lại',
  pending_cleanup: 'Chờ dọn',
  __other__: 'Khác',
};

/** Align with ptt-crm-api `lead-status-gate.util` — funnel stage keys ≠ CRM kanban columns. */
const STATUS_ALIASES: Record<string, string> = {
  new: 'moi',
  contacted: 'da_lien_he',
  qualified: 'da_lien_he',
  first_contact: 'moi',
  intake: 'moi',
  qualify: 'da_lien_he',
  nurturing: 'dang_tu_van',
  negotiation: 'dam_phan',
};

export function normalizeLeadStatus(status: string | null | undefined): string {
  const raw = String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if (!raw) return 'moi';
  return STATUS_ALIASES[raw] ?? raw;
}

export function leadStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  const key = normalizeLeadStatus(status);
  return LEAD_STATUS_LABELS[key] ?? LEAD_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

export type LeadStatusTone = 'new' | 'active' | 'won' | 'lost' | 'neutral';

export function leadStatusTone(status: string | null | undefined): LeadStatusTone {
  if (!status) return 'neutral';
  const st = normalizeLeadStatus(status);
  if (st === 'moi') return 'new';
  if (st === 'chot' || st === 'post_sale' || st === 'won') return 'won';
  if (st === 'lost' || st === 'pending_cleanup') return 'lost';
  if (['da_lien_he', 'dang_tu_van', 'hen_gap', 'bao_gia', 'dam_phan', 'proposal'].includes(st)) return 'active';
  return 'neutral';
}

/** Bucket leads into kanban columns; unknown statuses land in `__other__`. */
export function bucketLeadsByKanbanStage<T extends { status?: string | null }>(
  rows: T[],
  stages: readonly string[],
): { stageKeys: string[]; byStage: Record<string, T[]> } {
  const byStage: Record<string, T[]> = {};
  for (const st of stages) byStage[st] = [];
  byStage.__other__ = [];

  for (const row of rows) {
    const st = normalizeLeadStatus(row.status);
    if (byStage[st]) byStage[st].push(row);
    else byStage.__other__.push(row);
  }

  const stageKeys = [...stages];
  if (byStage.__other__.length > 0) stageKeys.push('__other__');
  return { stageKeys, byStage };
}

export interface KanbanColumnDef {
  id: string;
  label: string;
  statuses: readonly string[];
  collapsible: boolean;
  sumValue: boolean;
}

/** B2B board. Stored status codes sit on the column they name. first_contact is Đã liên hệ. */
export const B2B_KANBAN_COLUMNS: readonly KanbanColumnDef[] = [
  { id: 'moi', label: 'Mới', statuses: ['moi', 'new', 'intake'], collapsible: false, sumValue: false },
  {
    id: 'da_lien_he',
    label: 'Đã liên hệ',
    statuses: ['da_lien_he', 'first_contact', 'contacted', 'qualified', 'qualify'],
    collapsible: false,
    sumValue: false,
  },
  {
    id: 'dang_tu_van',
    label: 'Đang tư vấn',
    statuses: ['dang_tu_van', 'nurturing', 'hen_gap'],
    collapsible: false,
    sumValue: false,
  },
  {
    id: 'bao_gia',
    label: 'Báo giá',
    statuses: ['bao_gia', 'proposal', 'dam_phan', 'negotiation'],
    collapsible: false,
    sumValue: true,
  },
  { id: 'won', label: 'Chốt', statuses: ['won', 'chot'], collapsible: true, sumValue: false },
  { id: 'lost', label: 'Thất bại', statuses: ['lost'], collapsible: true, sumValue: false },
  { id: 'nurture', label: 'Chăm sóc lại', statuses: ['nurture'], collapsible: true, sumValue: false },
];

export type LeadStatusSearchOption = {
  id: string;
  label: string;
  statuses?: readonly string[];
  callResults?: readonly string[];
  handoffs?: readonly string[];
};

const CHO_DON: LeadStatusSearchOption = {
  id: 'pending_cleanup',
  label: 'Chờ dọn',
  statuses: ['pending_cleanup'],
};

const SPA_STATUS_SEARCH: readonly LeadStatusSearchOption[] = [
  { id: 'moi', label: 'Mới', statuses: ['moi', 'new', 'intake'] },
  {
    id: 'da_lien_he',
    label: 'Đã liên hệ',
    statuses: ['da_lien_he', 'first_contact', 'contacted', 'qualified', 'qualify'],
  },
  { id: 'dang_tu_van', label: 'Đang tư vấn', statuses: ['dang_tu_van', 'nurturing'] },
  { id: 'hen_gap', label: 'Hẹn gặp', statuses: ['hen_gap'] },
  { id: 'chot', label: 'Chốt', statuses: ['chot', 'won'] },
  { id: 'lost', label: 'Thất bại', statuses: ['lost'] },
  CHO_DON,
];

/** Kết quả cuộc gọi và bàn giao Solution. These sit beside the board columns in the filter. */
const CALL_SITUATIONS: readonly LeadStatusSearchOption[] = [
  {
    id: 'khong_nghe_may',
    label: 'Không nghe máy',
    callResults: ['ring_no_answer', 'no_answer', 'khong_nghe_may'],
  },
  {
    id: 'may_ban',
    label: 'Máy bận',
    callResults: ['unreachable', 'khong_goi_duoc', 'khong_lien_lac_duoc'],
  },
  {
    id: 'hen_goi_lai',
    label: 'Hẹn gọi lại',
    callResults: ['callback_requested', 'callback', 'khach_hen_goi_lai'],
  },
  { id: 'sai_so', label: 'Sai số', callResults: ['wrong_number'] },
  {
    id: 'da_noi_chuyen',
    label: 'Đã nói chuyện',
    callResults: ['answered', 'connected_meet_pending', 'connected_qualified', 'connected_other'],
  },
  {
    id: 'da_chuyen_solution',
    label: 'Đã chuyển Solution',
    handoffs: ['pending', 'with_solution'],
  },
];

/** Filter choices match the board columns. One choice covers every stored code in that column. */
export function leadStatusSearchOptions(
  flow?: 'spa_operational' | 'b2b_prospect' | null,
): readonly LeadStatusSearchOption[] {
  if (flow === 'spa_operational') return SPA_STATUS_SEARCH;
  return [...B2B_KANBAN_COLUMNS.map((column) => ({
    id: column.id,
    label: column.label,
    statuses: column.statuses,
  })), CHO_DON];
}

/** Board columns plus the call and Solution labels shown on each lead. */
export function leadListFilterOptions(
  flow?: 'spa_operational' | 'b2b_prospect' | null,
): readonly LeadStatusSearchOption[] {
  const columns = leadStatusSearchOptions(flow);
  const board = columns.filter((option) => option.id !== 'pending_cleanup');
  const cleanup = columns.filter((option) => option.id === 'pending_cleanup');
  return [...board, ...CALL_SITUATIONS, ...cleanup];
}

function findListFilter(
  id: string,
  flow?: 'spa_operational' | 'b2b_prospect' | null,
): LeadStatusSearchOption | undefined {
  return leadListFilterOptions(flow).find((option) => option.id === id);
}

export function leadStatusSearchStatuses(
  id: string | null | undefined,
  flow?: 'spa_operational' | 'b2b_prospect' | null,
): string[] {
  const key = String(id ?? '').trim();
  if (!key) return [];
  const match = findListFilter(key, flow);
  if (!match) return [key];
  return match.statuses ? [...match.statuses] : [];
}

export function leadStatusSearchCallResults(
  id: string | null | undefined,
  flow?: 'spa_operational' | 'b2b_prospect' | null,
): string[] {
  const key = String(id ?? '').trim();
  if (!key) return [];
  const match = findListFilter(key, flow);
  return match?.callResults ? [...match.callResults] : [];
}

export function leadStatusSearchHandoffs(
  id: string | null | undefined,
  flow?: 'spa_operational' | 'b2b_prospect' | null,
): string[] {
  const key = String(id ?? '').trim();
  if (!key) return [];
  const match = findListFilter(key, flow);
  return match?.handoffs ? [...match.handoffs] : [];
}

export function leadStatusSearchLabel(
  id: string | null | undefined,
  flow?: 'spa_operational' | 'b2b_prospect' | null,
): string {
  const key = String(id ?? '').trim();
  if (!key) return '';
  return findListFilter(key, flow)?.label ?? leadStatusLabel(key);
}

function rawLeadStatus(status: string | null | undefined): string {
  return String(status ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

/** Column for the status stored on the lead. Raw code wins over the funnel alias. */
export function kanbanColumnIdForStatus(
  status: string | null | undefined,
  columns: readonly KanbanColumnDef[] = B2B_KANBAN_COLUMNS,
): string | null {
  const raw = rawLeadStatus(status);
  const direct = columns.find((column) => column.statuses.includes(raw));
  if (direct) return direct.id;
  const normalized = normalizeLeadStatus(raw);
  return columns.find((column) => column.statuses.includes(normalized))?.id ?? null;
}

export function bucketLeadsByKanbanColumns<T extends { status?: string | null }>(
  rows: T[],
  columns: readonly KanbanColumnDef[],
): Record<string, T[]> {
  const byColumn: Record<string, T[]> = {};
  for (const column of columns) byColumn[column.id] = [];
  for (const row of rows) {
    const columnId = kanbanColumnIdForStatus(row.status, columns);
    if (columnId) byColumn[columnId].push(row);
  }
  return byColumn;
}

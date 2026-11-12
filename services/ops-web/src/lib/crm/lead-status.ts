export const LEAD_STATUS_LABELS: Record<string, string> = {
  moi: 'Mới',
  da_lien_he: 'Đã liên hệ',
  dang_tu_van: 'Đang tư vấn',
  hen_gap: 'Hẹn gặp',
  bao_gia: 'Báo giá',
  trien_khai: 'Triển Khai',
  dam_phan: 'Đàm phán',
  chot: 'Chốt',
  post_sale: 'Sau bán',
  won: 'Chốt',
  proposal: 'Đề xuất',
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

/**
 * Receive SLA (Nhận lead / Quá hạn nhận lead) applies only before Tư vấn.
 * `nurturing` and `negotiation` fold in through normalizeLeadStatus.
 */
const CONSULT_OR_LATER_STATUSES = new Set([
  'dang_tu_van',
  'hen_gap',
  'consult',
  'bao_gia',
  'proposal',
  'trien_khai',
  'dam_phan',
  'chot',
  'won',
  'post_sale',
]);

export function leadStatusAtOrAfterConsult(status: string | null | undefined): boolean {
  return CONSULT_OR_LATER_STATUSES.has(normalizeLeadStatus(status));
}

export function leadStatusLabel(status: string | null | undefined): string {
  if (!status) return '—';
  const key = normalizeLeadStatus(status);
  return LEAD_STATUS_LABELS[key] ?? LEAD_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

/**
 * Extra English / mixed API labels that are not already in LEAD_STATUS_LABELS
 * (looked up after folding: lower-case, strip diacritics and punctuation).
 */
const STATUS_LABEL_FALLBACKS: Record<string, string> = {
  proposal: 'Đề xuất',
  'de xuat': 'Đề xuất',
  won: 'Chốt',
  'won hd ky': 'Chốt',
  consult: 'Đang tư vấn',
  'tu van': 'Đang tư vấn',
  negotiating: 'Đàm phán',
  negotiation: 'Đàm phán',
  lost: 'Thất bại',
  nurture: 'Chăm sóc lại',
  nurturing: 'Chăm sóc lại',
  qualified: 'Đã liên hệ',
  contacted: 'Đã liên hệ',
  new: 'Mới',
  closed: 'Chốt',
  'closed won': 'Chốt',
};

function foldStatusKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'd')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[()[\]{}.,;:/\\-]+/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Known catalog label for a status id or alias; null when not in LEAD_STATUS_LABELS. */
export function knownLeadStatusLabel(status: string | null | undefined): string | null {
  if (status == null) return null;
  const trimmed = String(status).trim();
  if (!trimmed) return null;
  const key = normalizeLeadStatus(trimmed);
  if (Object.prototype.hasOwnProperty.call(LEAD_STATUS_LABELS, key)) {
    return LEAD_STATUS_LABELS[key]!;
  }
  if (Object.prototype.hasOwnProperty.call(LEAD_STATUS_LABELS, trimmed)) {
    return LEAD_STATUS_LABELS[trimmed]!;
  }
  return null;
}

function fallbackStatusLabel(value: string | null | undefined): string | null {
  if (value == null) return null;
  const folded = foldStatusKey(String(value));
  if (!folded) return null;
  if (Object.prototype.hasOwnProperty.call(STATUS_LABEL_FALLBACKS, folded)) {
    return STATUS_LABEL_FALLBACKS[folded]!;
  }
  const first = folded.split(' ')[0] ?? '';
  if (first && Object.prototype.hasOwnProperty.call(STATUS_LABEL_FALLBACKS, first)) {
    return STATUS_LABEL_FALLBACKS[first]!;
  }
  return null;
}

function looksLikeVietnameseDisplay(label: string): boolean {
  const s = label.trim();
  if (!s) return false;
  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(s)) return false;
  if (/^(proposal|won|lost|nurture|negotiation|negotiating|qualified|contacted|new|consult|closed)\b/i.test(s)) {
    return false;
  }
  return /[\u00e0\u00e1\u1ea3\u00e3\u1ea1\u0103\u1eb1\u1eaf\u1eb3\u1eb5\u00e2\u1ea7\u1ea5\u1ea9\u1eab\u1ead\u00e8\u00e9\u1ebb\u1ebd\u1eb9\u00ea\u1ec1\u1ebf\u1ec3\u1ec5\u1ec7\u00ec\u00ed\u1ec9\u0129\u1ecb\u00f2\u00f3\u1ecf\u00f5\u1ecd\u00f4\u1ed3\u1ed1\u1ed5\u1ed7\u1ed9\u01a1\u1edd\u1edb\u1edf\u1ee1\u1ee3\u00f9\u00fa\u1ee7\u0169\u1ee5\u01b0\u1eeb\u1ee9\u1eed\u1eef\u1ef1\u1ef3\u00fd\u1ef7\u1ef9\u1ef5\u0111\u00c0\u00c1\u1ea2\u00c3\u1ea0\u0102\u1eb0\u1eae\u1eb2\u1eb4\u00c2\u1ea6\u1ea4\u1ea8\u1eaa\u1eac\u00c8\u00c9\u1eba\u1ebc\u1eb8\u00ca\u1ec0\u1ebe\u1ec2\u1ec4\u1ec6\u00cc\u00cd\u1ec8\u0128\u1eca\u00d2\u00d3\u1ece\u00d5\u1ecc\u00d4\u1ed2\u1ed0\u1ed4\u1ed6\u1ed8\u01a0\u1edc\u1eda\u1ede\u1ee0\u1ee2\u00d9\u00da\u1ee6\u0168\u1ee4\u01af\u1eea\u1ee8\u1eec\u1eee\u1ef0\u1ef2\u00dd\u1ef6\u1ef8\u1ef4\u0110]/.test(s);
}

/**
 * Display label for a TRANG THAI picker option.
 * Prefer LEAD_STATUS_LABELS (via the option id), then a Vietnamese fallback
 * map, then an already-Vietnamese API label. Never return a raw slug or
 * English API name such as "Proposal" or "Won (HD ky)".
 */
export function leadStatusOptionLabel(
  id: string | null | undefined,
  apiLabel?: string | null,
): string {
  const fromId = knownLeadStatusLabel(id);
  if (fromId) return fromId;
  const fromApiKey = knownLeadStatusLabel(apiLabel);
  if (fromApiKey) return fromApiKey;
  const fromFb = fallbackStatusLabel(id) ?? fallbackStatusLabel(apiLabel);
  if (fromFb) return fromFb;
  if (apiLabel && looksLikeVietnameseDisplay(apiLabel)) return apiLabel.trim();
  if (id && looksLikeVietnameseDisplay(id)) return id.trim();
  return '—';
}

export function localizeLeadStatusOptions<T extends { id: string; label: string }>(
  rows: readonly T[],
): T[] {
  return rows.map((row) => ({ ...row, label: leadStatusOptionLabel(row.id, row.label) }));
}


export type LeadStatusTone = 'new' | 'active' | 'won' | 'lost' | 'neutral';

export function leadStatusTone(status: string | null | undefined): LeadStatusTone {
  if (!status) return 'neutral';
  const st = normalizeLeadStatus(status);
  if (st === 'moi') return 'new';
  if (st === 'chot' || st === 'post_sale' || st === 'won') return 'won';
  if (st === 'lost' || st === 'pending_cleanup') return 'lost';
  if (['da_lien_he', 'dang_tu_van', 'hen_gap', 'bao_gia', 'trien_khai', 'dam_phan', 'proposal'].includes(st)) return 'active';
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
    sumValue: false,
  },
  { id: 'trien_khai', label: 'Triển Khai', statuses: ['trien_khai'], collapsible: false, sumValue: false },
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

/** Fields the board already loads. Missing fields mean the caller only has a status. */
export type LeadStageSignals = {
  status?: string | null;
  solution_handoff?: string | null;
  quote_sheet_saved?: boolean | null;
  quote_sent_to_sale?: boolean | null;
  quote_approved?: boolean | null;
  has_contract?: boolean | null;
};

export function leadStageSignalsPresent(lead: LeadStageSignals): boolean {
  return (
    lead.solution_handoff !== undefined ||
    lead.quote_sheet_saved !== undefined ||
    lead.quote_sent_to_sale !== undefined ||
    lead.quote_approved !== undefined ||
    lead.has_contract !== undefined
  );
}

/** Solution was nộp (released) or the quote flow already started from that Solution. */
export function leadHasSubmittedSolution(lead: LeadStageSignals): boolean {
  const handoff = String(lead.solution_handoff ?? '').trim().toLowerCase();
  if (handoff === 'released') return true;
  return Boolean(lead.quote_sheet_saved || lead.quote_sent_to_sale || lead.quote_approved);
}

/**
 * Column of the last step that already has its artifact.
 * A stored Báo giá / Triển Khai / Chốt status without that artifact does not stay there.
 * No signals → the stored status column (older callers).
 */
export function kanbanColumnIdForLead(
  lead: LeadStageSignals,
  columns: readonly KanbanColumnDef[] = B2B_KANBAN_COLUMNS,
): string | null {
  const stored = kanbanColumnIdForStatus(lead.status, columns);
  if (!stored || !leadStageSignalsPresent(lead)) return stored;
  const solution = leadHasSubmittedSolution(lead);
  const quoteApproved = lead.quote_approved === true;
  const hasContract = lead.has_contract === true;
  if (stored === 'won') {
    if (quoteApproved || hasContract) return 'won';
    if (solution) return 'bao_gia';
    return 'dang_tu_van';
  }
  if (stored === 'trien_khai') {
    if (quoteApproved) return 'trien_khai';
    if (hasContract) return 'won';
    if (solution) return 'bao_gia';
    return 'dang_tu_van';
  }
  if (stored === 'bao_gia') {
    if (solution) return 'bao_gia';
    return 'dang_tu_van';
  }
  return stored;
}

/** Lead sits on the Báo giá board column, including Đàm phán / proposal. */
export function isBaoGiaKanbanColumn(status: string | null | undefined): boolean {
  return kanbanColumnIdForStatus(status) === 'bao_gia';
}

export function bucketLeadsByKanbanColumns<T extends LeadStageSignals>(
  rows: T[],
  columns: readonly KanbanColumnDef[],
): Record<string, T[]> {
  const byColumn: Record<string, T[]> = {};
  for (const column of columns) byColumn[column.id] = [];
  for (const row of rows) {
    const columnId = kanbanColumnIdForLead(row, columns);
    if (columnId && byColumn[columnId]) byColumn[columnId].push(row);
  }
  return byColumn;
}

/** Sale columns that sit before Solution. Marketing Leader does not render these. */
export const EARLY_SALE_KANBAN_IDS = ['moi', 'da_lien_he', 'dang_tu_van'] as const;

export const SOLUTION_WAIT_COLUMN: KanbanColumnDef = {
  id: 'solution',
  label: 'Đợi Solution',
  statuses: [],
  collapsible: false,
  sumValue: false,
};

const EARLY_SALE_KANBAN_ID_SET = new Set<string>(EARLY_SALE_KANBAN_IDS);

export function kanbanColumnsFromSolution(): readonly KanbanColumnDef[] {
  return [
    SOLUTION_WAIT_COLUMN,
    ...B2B_KANBAN_COLUMNS.filter((column) => !EARLY_SALE_KANBAN_ID_SET.has(column.id)),
  ];
}

/** Leads still stored on an early Sale status but already handed to Solution land on Đợi Solution. */
export function bucketLeadsFromSolution<T extends LeadStageSignals>(
  rows: T[],
): Record<string, T[]> {
  const columns = kanbanColumnsFromSolution();
  const byColumn: Record<string, T[]> = {};
  for (const column of columns) byColumn[column.id] = [];
  for (const row of rows) {
    const columnId = kanbanColumnIdForLead(row, B2B_KANBAN_COLUMNS);
    if (columnId && byColumn[columnId] && !EARLY_SALE_KANBAN_ID_SET.has(columnId)) {
      byColumn[columnId].push(row);
      continue;
    }
    byColumn.solution.push(row);
  }
  return byColumn;
}

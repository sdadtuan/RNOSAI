import type { AmHealthBand } from './am-format';
import { bandCopy, vnd } from './am-format';
import type { AmRenewalCard, AmRenewalForecast, AmRenewalStatus } from './am-api';

export type AmRenewalColumnId = 'not_started' | 'evaluating' | 'negotiating' | 'decided';

export type AmRenewalColumnDef = {
  id: AmRenewalColumnId;
  label: string;
  statuses: AmRenewalStatus[];
};

export const AM_RENEWAL_COLUMNS: AmRenewalColumnDef[] = [
  { id: 'not_started', label: 'Chưa bắt đầu', statuses: ['not_started'] },
  { id: 'evaluating', label: 'Đang đánh giá', statuses: ['evaluating'] },
  { id: 'negotiating', label: 'Đàm phán', statuses: ['negotiating'] },
  { id: 'decided', label: 'Đã quyết định', statuses: ['decided', 'renewed', 'lost', 'paused'] },
];

export const AM_RENEWAL_FORECASTS: Array<{ id: AmRenewalForecast; label: string }> = [
  { id: 'committed', label: 'Committed' },
  { id: 'likely', label: 'Likely' },
  { id: 'risk', label: 'Risk' },
  { id: 'unlikely', label: 'Unlikely' },
];

export type AmRenewalLostInput = {
  lost_reason?: string;
  lost_on?: string;
  lessons?: string;
};

export function amRenewalLostError(input: AmRenewalLostInput): 'lost_fields_required' | null {
  const reason = String(input.lost_reason ?? '').trim();
  const lostOn = String(input.lost_on ?? '').trim();
  const lessons = String(input.lessons ?? '').trim();
  if (!reason || !lostOn || !lessons) return 'lost_fields_required';
  return null;
}

export function amRenewalColumnId(status: string | null | undefined): AmRenewalColumnId {
  const hit = AM_RENEWAL_COLUMNS.find((col) => col.statuses.includes(status as AmRenewalStatus));
  return hit?.id ?? 'not_started';
}

export function amRenewalMoveStatus(columnId: AmRenewalColumnId): AmRenewalStatus {
  if (columnId === 'evaluating' || columnId === 'negotiating' || columnId === 'decided') return columnId;
  return 'not_started';
}

export function parseAmRenewalView(raw: string | null | undefined): 'kanban' | 'list' {
  return raw === 'list' ? 'list' : 'kanban';
}

export function parseAmRenewalWindow(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 90;
}

export function amRenewalMoneyDisplay(hide: boolean, amount: number | null | undefined): string {
  if (hide || amount == null) return '—';
  return vnd(amount);
}

export function amRenewalDash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function amRenewalDaysCopy(days: number | null | undefined): string {
  if (days == null) return '—';
  return `${days} ngày`;
}

export function amRenewalStatusCopy(status: string | null | undefined): string {
  const hit = AM_RENEWAL_COLUMNS.find((col) => col.statuses.includes(status as AmRenewalStatus));
  if (status === 'renewed') return 'Renewed';
  if (status === 'lost') return 'Lost';
  if (status === 'paused') return 'Paused';
  if (status === 'decided') return 'Đã quyết định';
  return hit?.label ?? (status || '—');
}

export function amRenewalScoreCopy(
  score: number | null | undefined,
  band: string | null | undefined,
): string {
  const scorePart = score == null ? '—' : String(score);
  const bandPart = bandCopy(band as AmHealthBand | null);
  if (scorePart === '—' && bandPart === '—') return '—';
  return `${scorePart} · ${bandPart}`;
}

export function amRenewalPatchErrorCopy(code: string): string {
  if (code === 'forecast_required') return 'Cần forecast và next action trước khi chuyển cột.';
  if (code === 'new_contract_required') return 'Cần new_contract_id để đánh Renewed.';
  if (code === 'lost_fields_required') return 'Cần lý do, ngày và lessons để đánh Lost.';
  if (code === 'case_closed') return 'Case đã đóng.';
  if (code === 'open_case_exists') return 'Hợp đồng đã có renewal case mở.';
  if (code === 'not_found') return 'Không tìm thấy renewal case trong phạm vi của bạn.';
  return code;
}

export function amRenewalCsv(cards: AmRenewalCard[]): string {
  const headers = [
    'id',
    'name',
    'owner_label',
    'status',
    'forecast',
    'forecast_pct',
    'next_action',
    'mrr_vnd',
    'days_remaining',
    'score',
    'band',
    'ends_on',
    'contract_id',
  ];
  const lines = [headers.join(',')];
  for (const card of cards) {
    const row = [
      card.id,
      card.name,
      card.owner_label,
      card.status,
      card.forecast ?? '',
      card.forecast_pct ?? '',
      card.next_action ?? '',
      card.mrr_vnd ?? '',
      card.days_remaining ?? '',
      card.score ?? '',
      card.band ?? '',
      card.ends_on ?? '',
      card.contract_id,
    ].map(csvCell);
    lines.push(row.join(','));
  }
  return `${lines.join('\n')}\n`;
}

function csvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

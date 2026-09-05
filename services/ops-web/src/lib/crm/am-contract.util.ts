import { vnd } from './am-format';

export type AmContractTabId =
  | 'overview'
  | 'services'
  | 'payments'
  | 'renewal'
  | 'amendments'
  | 'documents'
  | 'audit';

export type AmContractTab = {
  id: AmContractTabId;
  label: string;
};

export const AM_CONTRACT_TABS: AmContractTab[] = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'services', label: 'Dịch vụ & giá' },
  { id: 'payments', label: 'Lịch thanh toán' },
  { id: 'renewal', label: 'Gia hạn' },
  { id: 'amendments', label: 'Phụ lục' },
  { id: 'documents', label: 'Tài liệu' },
  { id: 'audit', label: 'Audit' },
];

export type AmContractLoadError = 'not_found' | 'load_failed';

export function parseAmContractTab(raw: string | null | undefined): AmContractTabId {
  const hit = AM_CONTRACT_TABS.find((tab) => tab.id === raw);
  return hit?.id ?? 'overview';
}

export function amContractAmountDisplay(hide: boolean, amount: number | null | undefined): string {
  if (hide || amount == null) return '—';
  return vnd(amount);
}

export function amContractDash(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return String(value);
}

export function formatAmContractDate(value: string | null | undefined): string {
  if (!value) return '—';
  const ymd = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return ymd;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function amContractDaysCopy(days: number | null | undefined): string {
  if (days == null) return '—';
  return `Còn ${days} ngày`;
}

export function amContractLoadErrorKind(status: number | undefined): AmContractLoadError {
  return status === 404 ? 'not_found' : 'load_failed';
}

export function amContractLoadErrorCopy(kind: AmContractLoadError): string {
  if (kind === 'not_found') return 'Không tìm thấy hợp đồng trong phạm vi của bạn.';
  return 'Không tải được hợp đồng. Thử lại.';
}

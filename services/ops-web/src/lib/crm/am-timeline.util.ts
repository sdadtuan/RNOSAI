import { isSafeAmDocumentHref } from './am-document-href';

export type AmTimelineKind = 'note' | 'call' | 'meeting' | 'email' | 'system';

export type AmTimelineComposerInput = {
  kind: string;
  attendees?: string[];
  summary?: string;
};

export const AM_TIMELINE_KINDS: Array<{ value: Exclude<AmTimelineKind, 'system'>; label: string }> = [
  { value: 'note', label: 'Ghi chú' },
  { value: 'call', label: 'Cuộc gọi' },
  { value: 'meeting', label: 'Cuộc họp' },
  { value: 'email', label: 'Email' },
];

export function amTimelineAttachError(input: { href?: string; title?: string }): string {
  const href = String(input.href ?? '').trim();
  const title = String(input.title ?? '').trim();
  if (!href && !title) return '';
  if (!title) return 'Cần tiêu đề tài liệu';
  if (!isSafeAmDocumentHref(href)) return 'Link phải là http(s) hoặc đường dẫn /';
  return '';
}

export function amTimelineComposerError(input: AmTimelineComposerInput): string {
  if (!String(input.summary ?? '').trim()) return 'Cần tóm tắt';
  if (input.kind === 'meeting') {
    const attendees = (input.attendees ?? []).map((item) => item.trim()).filter(Boolean);
    if (attendees.length < 1) return 'Meeting cần người tham gia (attendees)';
  }
  return '';
}

export function amTimelineRowEditable(row: { kind: string }): boolean {
  return row.kind !== 'system';
}

export function amTimelineErrorCopy(code: string): string {
  if (code === 'attendees_required') return 'Meeting cần người tham gia (attendees)';
  if (code === 'system_readonly') return 'Sự kiện hệ thống không sửa được';
  if (code === 'summary_required') return 'Cần tóm tắt';
  if (code === 'invalid_kind') return 'Loại tương tác không hợp lệ';
  if (code === 'agency_client_id_required' || code === 'invalid_agency_client_id') {
    return 'Cần chọn account';
  }
  if (code === 'action_item_not_found') return 'Không thấy action item';
  return code;
}

export function amTimelineKindLabel(kind: string | null | undefined): string {
  const value = String(kind ?? '').trim();
  if (!value) return '—';
  return AM_TIMELINE_KINDS.find((item) => item.value === value)?.label ?? value;
}

export function formatAmTimelineOccurredAt(occurredAt: string | null | undefined): string {
  const value = String(occurredAt ?? '').trim();
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('vi-VN');
}

export function parseAttendeesInput(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

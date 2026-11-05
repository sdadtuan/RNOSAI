const TICKET_CODE_RE = /\[?(PTT-\d{4}-\d{6})\]?/i;

const APPROVAL_KEYWORDS = [
  'báo giá',
  'hoàn tiền',
  'cam kết',
  'khiếu nại',
  'phạt',
  'hủy hợp đồng',
];

export function parseTicketCodeFromSubject(subject: string): string | null {
  const match = String(subject ?? '').match(TICKET_CODE_RE);
  if (!match?.[1]) return null;
  return match[1].toUpperCase();
}

export function isIgnorableInbound(headers: Record<string, string>): boolean {
  const auto =
    headers['auto-submitted'] ??
    headers['Auto-Submitted'] ??
    headers['AUTO-SUBMITTED'] ??
    '';
  if (auto && auto.toLowerCase() !== 'no') return true;

  const prec =
    headers['precedence'] ??
    headers['Precedence'] ??
    headers['PRECEDENCE'] ??
    '';
  const precNorm = prec.trim().toLowerCase();
  if (precNorm && ['bulk', 'junk', 'list'].includes(precNorm)) return true;

  return false;
}

export function needsEmailApproval(subject: string, body: string): boolean {
  const text = `${subject ?? ''}\n${body ?? ''}`.toLowerCase();
  return APPROVAL_KEYWORDS.some((kw) => text.includes(kw));
}

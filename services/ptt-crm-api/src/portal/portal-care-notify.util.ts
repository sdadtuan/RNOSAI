export type CareNotifyReason = 'auto' | 'manual' | 'hop' | 'unassign';

export function careCaseLink(kind: string, caseId: string): string {
  const id = encodeURIComponent(caseId);
  if (kind === 'lead') return `/crm/leads?case=${id}`;
  return `/crm/messages?case=${id}`;
}

export function careAssignedCopy(title: string, kind: string): { title: string; body: string } {
  const label = title.trim() || (kind === 'lead' ? 'lead mới' : 'cuộc trò chuyện');
  const kindLabel = kind === 'lead' ? 'Lead' : 'Tin nhắn';
  return {
    title: `Bạn được phân công: ${label}`,
    body: `${kindLabel} “${label}” đã được gán cho bạn.`,
  };
}

export function careReassignedCopy(title: string, kind: string): { title: string; body: string } {
  const label = title.trim() || (kind === 'lead' ? 'lead' : 'cuộc trò chuyện');
  const kindLabel = kind === 'lead' ? 'Lead' : 'Cuộc trò chuyện';
  return {
    title: `${kindLabel} đã chuyển sang người khác`,
    body: `Bạn không còn phụ trách “${label}”.`,
  };
}

export function careMessageCopy(title: string, preview: string): { title: string; body: string } {
  const label = title.trim() || 'khách hàng';
  const body = preview.trim().slice(0, 200) || 'Bạn có tin nhắn mới.';
  return {
    title: `Tin nhắn mới từ ${label}`,
    body,
  };
}

/** Skip a second unread care_message for the same case+assignee. */
export function shouldSkipDuplicateMessage(hasUnreadForCase: boolean): boolean {
  return hasUnreadForCase;
}

export function sameAssignee(previousId: string | null | undefined, nextId: string | null | undefined): boolean {
  const a = previousId?.trim() || '';
  const b = nextId?.trim() || '';
  return Boolean(a) && a === b;
}

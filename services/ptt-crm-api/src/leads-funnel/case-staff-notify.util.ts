/** Payloads for case handoff notifies - only the person responsible, with reason + link. */

export type CaseNotifyKind =
  | 'return_missing_info'
  | 'request_solution_edits'
  | 'release_to_sales'
  | 'request_quote_edits'
  | 'auto_reclaim_solution'
  | 'lead_assigned'
  | 'quote_submitted_ceo'
  | 'quote_ceo_rejected'
  | 'quote_ceo_approved';

export type CaseNotifyPayload = {
  kind: string;
  title: string;
  body: string;
  link_href: string;
  meta_json: Record<string, unknown>;
};

export function solutionHandoffMode(
  lastOwnerStaffId: number | null | undefined,
): 'auto_reclaim' | 'claim_queue' {
  const id = Number(lastOwnerStaffId ?? 0);
  return Number.isFinite(id) && id > 0 ? 'auto_reclaim' : 'claim_queue';
}

export function caseStaffNotify(input: {
  kind: CaseNotifyKind;
  leadId: number;
  reason?: string;
}): CaseNotifyPayload {
  const leadId = Number(input.leadId);
  const reason = String(input.reason ?? '').trim();
  const link = '/crm/leads/' + leadId;
  const reasonBit = reason ? ('  Lý do: ' + reason) : '';

  if (input.kind === 'return_missing_info') {
    return {
      kind: 'presales_solution',
      title: 'Solutions trả lại — cần bổ sung thông tin',
      body: ('Lead #' + leadId + '  được AM trả lại vì thông tin chưa đủ.' + reasonBit),
      link_href: link,
      meta_json: { lead_id: leadId, action: 'open_lead', reason },
    };
  }
  if (input.kind === 'request_solution_edits') {
    return {
      kind: 'presales_solution',
      title: 'Sales yêu cầu chỉnh Solutions',
      body: ('Lead #' + leadId + '  cần chỉnh Solutions.' + reasonBit),
      link_href: link,
      meta_json: { lead_id: leadId, action: 'open_lead', reason },
    };
  }
  if (input.kind === 'release_to_sales') {
    return {
      kind: 'presales_solution',
      title: 'Solutions đã nộp cho bạn',
      body: ('Lead #' + leadId + '  — AM đã nộp Solutions. Vui lòng xem và phản hồi khách.'),
      link_href: link,
      meta_json: { lead_id: leadId, action: 'open_lead' },
    };
  }
  if (input.kind === 'request_quote_edits') {
    return {
      kind: 'presales_quote',
      title: 'Yêu cầu chỉnh báo giá',
      body: ('Lead #' + leadId + '  cần chỉnh báo giá.' + reasonBit),
      link_href: link,
      meta_json: { lead_id: leadId, action: 'open_lead', reason },
    };
  }
  if (input.kind === 'auto_reclaim_solution') {
    return {
      kind: 'presales_solution',
      title: 'Case Solutions được giao lại cho bạn',
      body: ('Lead #' + leadId + '  — Sales đã gửi lại. SLA Solutions 4 giờ làm việc (8:30–16:00).'),
      link_href: link,
      meta_json: { lead_id: leadId, action: 'open_lead' },
    };
  }
  if (input.kind === 'quote_submitted_ceo') {
    return {
      kind: 'presales_quote',
      title: 'Báo giá chờ CEO duyệt',
      body: ('Lead #' + leadId + '  — AM đã nộp báo giá. Vui lòng duyệt hoặc từ chối kèm lý do.'),
      link_href: link,
      meta_json: { lead_id: leadId, action: 'open_lead' },
    };
  }
  if (input.kind === 'quote_ceo_rejected') {
    return {
      kind: 'presales_quote',
      title: 'CEO từ chối báo giá',
      body: ('Lead #' + leadId + '  — CEO từ chối báo giá.' + reasonBit),
      link_href: link,
      meta_json: { lead_id: leadId, action: 'open_lead', reason },
    };
  }
  if (input.kind === 'quote_ceo_approved') {
    return {
      kind: 'presales_quote',
      title: 'CEO đã duyệt báo giá',
      body: ('Lead #' + leadId + '  — CEO đã duyệt. Sales có thể xem và tải báo giá.'),
      link_href: link,
      meta_json: { lead_id: leadId, action: 'open_lead' },
    };
  }
  return {
    kind: 'lead_assigned',
    title: 'Lead mới được giao cho bạn',
    body: ('Lead #' + leadId + '  — nhận trong 15 phút kể từ lúc được giao.'),
    link_href: link,
    meta_json: { lead_id: leadId, action: 'claim_lead' },
  };
}

/**
 * Staff who must be notified on a Sales-facing return / release / CEO-approve.
 * Never the AM who acted (or any Account Manager), even if they are in handed_off_by.
 * Prefers the Sales who submitted (handed_off_by) when that person is Sales, plus the lead owner.
 */
export function salesNotifyStaffIds(input: {
  handedOffBy?: number | null;
  leadOwner?: number | null;
  actorStaffId?: number | null;
  accountManagerStaffIds?: number[];
}): number[] {
  const am = new Set((input.accountManagerStaffIds ?? []).map((id) => Number(id)));
  const actor = Number(input.actorStaffId ?? 0);
  const usable = (raw: number | null | undefined): number | null => {
    const id = Number(raw ?? 0);
    if (!Number.isFinite(id) || id <= 0) return null;
    if (id === actor) return null;
    if (am.has(id)) return null;
    return id;
  };
  const ids = new Set<number>();
  const handed = usable(input.handedOffBy);
  const owner = usable(input.leadOwner);
  if (handed) ids.add(handed);
  if (owner) ids.add(owner);
  // If the only candidate was filtered (AM / actor) and owner equals actor, still skip.
  // If owner is a valid staff id that equals actor (shouldn't happen on an AM return), skip.
  return [...ids];
}

/** Operational SLA toasts always belong to the current staff, never a manager overview. */
export function slaAlertPredictionScope(input: {
  queryScope?: string | null;
  selfOwnerId?: number | null;
  hasAssignCap: boolean;
}): { viewAll: boolean; ownerId: number | undefined } {
  const self =
    input.selfOwnerId != null && Number.isFinite(Number(input.selfOwnerId))
      ? Number(input.selfOwnerId)
      : undefined;
  if (String(input.queryScope ?? '').trim().toLowerCase() === 'self') {
    return { viewAll: false, ownerId: self };
  }
  if (input.hasAssignCap) {
    return { viewAll: true, ownerId: undefined };
  }
  return { viewAll: false, ownerId: self };
}

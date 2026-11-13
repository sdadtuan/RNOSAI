export type StaffNotifyClaimKind = 'claim_lead' | 'claim_case';

type NotifyLike = {
  kind?: string | null;
  title?: string | null;
  read?: boolean;
  meta_json?: Record<string, unknown> | null;
};

export function staffNotifyLeadId(n: NotifyLike): number | null {
  const raw = Number(n.meta_json?.lead_id);
  return Number.isFinite(raw) && raw > 0 ? raw : null;
}

export function staffNotifyClaimKind(n: NotifyLike): StaffNotifyClaimKind | null {
  if (n.read) return null;
  const leadId = staffNotifyLeadId(n);
  if (leadId == null) return null;
  const action = String(n.meta_json?.action ?? '').trim();
  if (action === 'claim_lead') return 'claim_lead';
  if (action === 'claim_case') return 'claim_case';
  const title = String(n.title ?? '');
  if (n.kind === 'presales_solution' && title.includes('chờ AM nhận')) return 'claim_case';
  return null;
}

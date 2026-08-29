const UPSTREAM_SKIP = new Set(['no_pending_approval', 'contract_draft']);

export function contractCreateReady(checks: Array<{ key: string; ok: boolean }>): boolean {
  const upstream = checks.filter((c) => !UPSTREAM_SKIP.has(c.key));
  return upstream.length > 0 && upstream.every((c) => c.ok);
}

export function contractSubmitReady(checks: Array<{ key: string; ok: boolean }>): boolean {
  return checks.filter((c) => c.key !== 'no_pending_approval').every((c) => c.ok);
}

export function readinessCheckHref(key: string, leadId: number): string | null {
  switch (key) {
    case 'b2_complete':
      return '#funnel-b2';
    case 'presales_active':
    case 'presales_consult':
      return '#funnel-presales';
    case 'presales_lead':
      return `/crm/intake?lead_id=${leadId}`;
    case 'presales_proposal':
    case 'marketing_plan':
      return `/crm/leads/${leadId}/deal-room`;
    case 'contract_draft':
      return '#lead-contract-amount';
    case 'no_pending_approval':
      return '/crm/hub';
    default:
      return null;
  }
}

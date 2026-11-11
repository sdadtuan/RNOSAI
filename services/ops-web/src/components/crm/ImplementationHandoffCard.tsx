'use client';

import { useState } from 'react';
import { claimLeadImplementation, type LeadFunnelSnapshot } from '@/lib/api';
import { isMarketingLeader, isSuperAdmin } from '@/lib/crm/lead-ae-visibility';
import type { StoredStaffUser } from '@/lib/auth';

type ImplementationHandoff = NonNullable<
  NonNullable<LeadFunnelSnapshot['presales']>['implementation_handoff']
>;

export function ImplementationHandoffCard({
  token,
  leadId,
  handoff,
  user,
  onFunnelChange,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  handoff: ImplementationHandoff;
  user: StoredStaffUser | null;
  onFunnelChange: (funnel: LeadFunnelSnapshot) => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const canClaim =
    handoff.status === 'pending' && Boolean(user && (isMarketingLeader(user) || isSuperAdmin(user)));

  async function onClaim() {
    setBusy(true);
    try {
      const out = await claimLeadImplementation(token, leadId);
      onFunnelChange(out.funnel);
      onMessage?.('Đã nhận case Triển khai');
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Không nhận được case Triển khai');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page-card" aria-label="Case Triển khai">
      <h3>{handoff.step_label || 'Case Triển khai'}</h3>
      {handoff.status === 'pending' ? (
        <p>
          Marketing Leader nhận case trong 15 phút
          {handoff.accept_due_at ? ` · Hạn: ${handoff.accept_due_at}` : ''}.
        </p>
      ) : (
        <p>
          Đang Triển khai
          {handoff.owner_name ? ` · ${handoff.owner_name}` : ''}
          {handoff.claimed_at ? ` · Nhận lúc ${handoff.claimed_at}` : ''}.
        </p>
      )}
      {handoff.timer_overdue ? (
        <p className="form-error">Quá hạn nhận case Triển khai (15 phút).</p>
      ) : null}
      {canClaim ? (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onClaim()}>
          Nhận case
        </button>
      ) : null}
    </section>
  );
}

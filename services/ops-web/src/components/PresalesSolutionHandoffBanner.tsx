'use client';

import Link from 'next/link';
import type { LeadFunnelSnapshot } from '@/lib/api';
import { isConsultWorkspaceReadOnly, resolvePresalesSolutionCaps } from '@/lib/crm/presales-solution-caps';
import type { StoredStaffUser } from '@/lib/auth';

function badgeText(funnel: LeadFunnelSnapshot): string | null {
  const handoff = funnel.presales?.handoff;
  if (!handoff) return null;
  if (handoff.status === 'pending') return 'Đang ở Chờ Solutions — AM sẽ kiểm tra Brief và giao cho Marketing.';
  if (handoff.status === 'with_solution') {
    const who = handoff.solution_owner_name?.trim();
    return who ? `Đang làm Solutions — ${who}` : 'Đang làm Solutions';
  }
  return null;
}

export function PresalesSolutionHandoffBanner({
  funnel,
  user,
}: {
  funnel: LeadFunnelSnapshot | null;
  user?: StoredStaffUser | null;
}) {
  if (!funnel?.presales_on_lead_enabled || !funnel.presales) return null;
  const text = badgeText(funnel);
  if (!text) return null;
  const readOnly = isConsultWorkspaceReadOnly(funnel, resolvePresalesSolutionCaps(user ?? null));

  return (
    <div className="banner banner-info" data-testid="presales-solution-handoff-banner">
      <strong>Giai đoạn Chờ Solutions</strong>
      <p style={{ margin: '0.35rem 0 0' }}>{text}</p>
      {readOnly ? (
        <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
          Bạn chỉ xem — không chỉnh kế hoạch tư vấn. Marketing sẽ nộp Solution khi xong; lead chuyển sang Chờ báo giá.
        </p>
      ) : null}
      <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
        <Link href="/crm/solution/queue" className="nav-link">
          Mở Chờ Solutions →
        </Link>
      </p>
    </div>
  );
}

'use client';

import { SalesDiscoveryEmbed } from '@/components/crm/discovery/SalesDiscoveryEmbed';
import type { IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';
import type { LeadFunnelSnapshot, LeadRow } from '@/lib/api';
import type { StoredStaffUser } from '@/lib/auth';

/** @deprecated Kept so existing imports of the old BANT deep-link compile. Redirects to the lead Pre Sale panel. */
export function bantDetailHref(
  leadId: number,
  _sessionId?: number,
  _serviceSlug?: string | null,
): string {
  if (leadId > 0) return `/crm/leads/${leadId}?tab=pipeline&step=intake_bant`;
  return '/crm/leads';
}

export function LeadPipelineIntakePanel({
  leadId = 0,
  token,
  lead,
  user,
  canEdit,
  intakeSummary,
  loading = false,
  pastBant = false,
  onFunnelChange,
  onSubmitted,
  onMessage,
  onError,
}: {
  leadId?: number;
  token?: string;
  lead?: LeadRow | null;
  user?: StoredStaffUser | null;
  canEdit?: boolean;
  serviceSlug?: string | null;
  intakeSummary?: IntakeStepSummary | null;
  readOnly?: boolean;
  onSaved?: () => void;
  editRequest?: number;
  loading?: boolean;
  pastBant?: boolean;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onSubmitted?: () => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  if (!token || leadId <= 0) {
    if (loading || pastBant) return null;
    if (intakeSummary?.preview || intakeSummary?.latest_completed) {
      return (
        <div className="card-inner" id="funnel-intake-discovery" data-testid="funnel-intake-discovery">
          <p className="muted" style={{ margin: 0 }}>
            Sales Discovery đã có phiên — mở tab Pipeline bán hàng để xem brief.
          </p>
        </div>
      );
    }
    return (
      <div className="card-inner" id="funnel-intake-discovery">
        <p className="muted" style={{ margin: 0 }}>
          Chưa có phiên Sales Discovery.
        </p>
      </div>
    );
  }
  return (
    <div className="card-inner" id="funnel-intake-discovery" data-testid="funnel-intake-discovery">
      <SalesDiscoveryEmbed
        token={token}
        leadId={leadId}
        lead={lead}
        user={user}
        canEdit={canEdit}
        onFunnelChange={onFunnelChange}
        onSubmitted={onSubmitted}
        onMessage={onMessage}
        onError={onError}
      />
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SalesDiscoveryWizard } from '@/components/crm/discovery/SalesDiscoveryWizard';
import {
  createIntakeSession,
  fetchDiscoveryOptions,
  fetchIntakeSessions,
  fetchLead,
  fetchLeadFunnel,
  type DiscoveryOptionsPayload,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
} from '@/lib/api';
import { hasCap, type StoredStaffUser } from '@/lib/auth';
import {
  normalizeIntakeSessionList,
  pickWorkingSession,
  shouldCreateIntakeDraft,
} from '@/lib/crm/sales-discovery-session';
import './sd-embed.css';

export function SalesDiscoveryEmbed({
  token,
  leadId,
  lead: leadProp,
  user,
  canEdit: canEditProp,
  onFunnelChange,
  onSubmitted,
  onMessage,
  onError,
}: {
  token: string;
  leadId: number;
  lead?: LeadRow | null;
  user?: StoredStaffUser | null;
  canEdit?: boolean;
  onFunnelChange?: (funnel: LeadFunnelSnapshot) => void;
  onSubmitted?: () => void;
  onMessage?: (message: string) => void;
  onError?: (message: string) => void;
}) {
  const canEdit = canEditProp ?? hasCap(user ?? null, 'crm_leads', 'edit');
  const [lead, setLead] = useState<LeadRow | null>(leadProp ?? null);
  const [sessions, setSessions] = useState<IntakeSessionRow[]>([]);
  const [active, setActive] = useState<IntakeSessionRow | null>(null);
  const [options, setOptions] = useState<DiscoveryOptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [handoffStatus, setHandoffStatus] = useState('');

  const loadAll = useCallback(async () => {
    if (!token || leadId <= 0) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [opt, sessionList, leadRow, funnelSnap] = await Promise.all([
        fetchDiscoveryOptions(token),
        fetchIntakeSessions(token, { lead_id: leadId }),
        leadProp ? Promise.resolve(leadProp) : fetchLead(token, leadId).catch(() => null),
        fetchLeadFunnel(token, leadId).catch(() => null),
      ]);
      setOptions(opt);
      if (leadRow) setLead(leadRow);
      if (funnelSnap) onFunnelChange?.(funnelSnap);
      let list = normalizeIntakeSessionList(sessionList);
      let working = pickWorkingSession(list);
      const handoffStatus = String(
        (funnelSnap?.presales?.handoff as { status?: string } | undefined)?.status ?? '',
      ).toLowerCase();
      setHandoffStatus(handoffStatus);
      if (!working && canEdit && shouldCreateIntakeDraft(list)) {
        working = await createIntakeSession(token, {
          lead_id: leadId,
          mode: 'phone',
          company_name: leadRow?.company_name ?? '',
          contact_name: leadRow?.full_name ?? '',
        });
        list = [working, ...list];
      }
      setSessions(list);
      setActive(working);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không tải được Sales Discovery.';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [token, leadId, canEdit, leadProp, onFunnelChange, onError]);

  useEffect(() => {
    void loadAll();
    // reload when the lead or token changes, not when callbacks identity-churn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leadId]);

  const historical = useMemo(
    () => sessions.filter((row) => row.id !== active?.id),
    [sessions, active?.id],
  );

  if (loading) {
    return (
      <div className="sd-embed" data-testid="sd-embed-loading">
        <p className="muted">Đang tải Sales Discovery…</p>
      </div>
    );
  }
  if (error && !active) {
    return (
      <div className="sd-embed" data-testid="sd-embed-error">
        <p className="muted">{error}</p>
      </div>
    );
  }
  if (!active) {
    return (
      <div className="sd-embed" data-testid="sd-embed-empty">
        <p className="muted">Chưa có phiên Sales Discovery. Cần quyền sửa lead để tạo phiên.</p>
      </div>
    );
  }

  return (
    <div className="sd-embed" data-testid="sd-embed">
      {error ? <p className="muted">{error}</p> : null}
      <SalesDiscoveryWizard
        token={token}
        lead={lead}
        session={active}
        options={options}
        canEdit={canEdit}
        historicalSessions={historical}
        embedded
        handoffStatus={handoffStatus}
        onSessionChange={(next) => {
          setActive(next);
          setSessions((prev) => {
            const rest = prev.filter((row) => row.id !== next.id);
            return [next, ...rest];
          });
          if (next.status === 'completed') {
            onSubmitted?.();
            onMessage?.('Đã Submit to AM. Lead đang ở Chờ Solutions.');
            void fetchLeadFunnel(token, leadId)
              .then((funnel) => onFunnelChange?.(funnel))
              .catch(() => undefined);
          }
        }}
      />
    </div>
  );
}

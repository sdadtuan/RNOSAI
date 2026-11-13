'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { SalesDiscoveryWizard } from '@/components/crm/discovery/SalesDiscoveryWizard';
import {
  createIntakeSession,
  fetchDiscoveryOptions,
  fetchIntakeSessions,
  fetchLead,
  fetchLeadFunnel,
  staffMe,
  staffRefresh,
  type DiscoveryOptionsPayload,
  type IntakeSessionRow,
  type LeadFunnelSnapshot,
  type LeadRow,
} from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getStoredUser,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

function pickWorkingSession(sessions: IntakeSessionRow[], preferredId?: number): IntakeSessionRow | null {
  if (preferredId) {
    const preferred = sessions.find((row) => row.id === preferredId);
    if (preferred) return preferred;
  }
  const drafts = sessions.filter((row) => row.status === 'draft').sort((a, b) => b.id - a.id);
  if (drafts[0]) return drafts[0];
  const done = sessions.filter((row) => row.status === 'completed').sort((a, b) => b.id - a.id);
  return done[0] ?? null;
}

export function IntakeContent({
  initialLeadId = 0,
  initialLifecycleId = 0,
  initialSessionId = 0,
}: {
  initialLeadId?: number;
  initialLifecycleId?: number;
  initialSessionId?: number;
  initialOpenBant?: boolean;
}) {
  const router = useRouter();
  const [leadId, setLeadId] = useState(initialLeadId);
  const [user, setUser] = useState<StoredStaffUser | null>(() => getStoredUser());
  const [authReady, setAuthReady] = useState(false);
  const [token, setToken] = useState('');
  const [lead, setLead] = useState<LeadRow | null>(null);
  const [sessions, setSessions] = useState<IntakeSessionRow[]>([]);
  const [active, setActive] = useState<IntakeSessionRow | null>(null);
  const [options, setOptions] = useState<DiscoveryOptionsPayload | null>(null);
  const [funnel, setFunnel] = useState<LeadFunnelSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canEdit = useMemo(() => hasCap(user, 'crm_leads', 'edit'), [user]);

  const logout = useCallback(() => {
    clearSession();
    router.replace('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return null;
    }
    const cached = getStoredUser();
    if (cached) setUser(cached);
    try {
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      if (!hasCap(me, 'crm_leads', 'view')) {
        setError('Kh?ng c? quy?n xem Sales Discovery.');
        return null;
      }
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      const out = await staffRefresh(refresh);
      updateAccessToken(out.access_token);
      access = out.access_token;
      const me = await staffMe(access);
      setUser(me);
      updateStoredUser(me);
      return access;
    }
  }, [router]);

  const loadAll = useCallback(
    async (access: string, lid: number) => {
      setLoading(true);
      setError('');
      try {
        const [opt, sessionList, leadRow, funnelSnap] = await Promise.all([
          fetchDiscoveryOptions(access),
          lid > 0 ? fetchIntakeSessions(access, { lead_id: lid }) : Promise.resolve([] as IntakeSessionRow[]),
          lid > 0 ? fetchLead(access, lid).catch(() => null) : Promise.resolve(null),
          lid > 0 ? fetchLeadFunnel(access, lid).catch(() => null) : Promise.resolve(null),
        ]);
        setOptions(opt);
        setLead(leadRow);
        setFunnel(funnelSnap);
        let list = sessionList;
        let working = pickWorkingSession(list, initialSessionId || undefined);
        if (!working && lid > 0 && canEdit) {
          working = await createIntakeSession(access, {
            lead_id: lid,
            mode: 'phone',
            company_name: leadRow?.company_name ?? '',
            contact_name: leadRow?.full_name ?? '',
          });
          list = [working, ...list];
        }
        setSessions(list);
        setActive(working);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Kh?ng t?i ???c Sales Discovery.');
      } finally {
        setLoading(false);
      }
    },
    [canEdit, initialSessionId],
  );

  useEffect(() => {
    setLeadId(initialLeadId);
  }, [initialLeadId]);

  useEffect(() => {
    if (leadId > 0) return;
    if (typeof window === 'undefined') return;
    const lid = Number(new URLSearchParams(window.location.search).get('lead_id') || 0);
    if (lid > 0) setLeadId(lid);
  }, [leadId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const access = await ensureAuth();
      if (cancelled) return;
      setAuthReady(true);
      if (!access) {
        setLoading(false);
        return;
      }
      setToken(access);
      const lid = leadId || Number(new URLSearchParams(window.location.search).get('lead_id') || 0);
      if (lid > 0) setLeadId(lid);
      await loadAll(access, lid);
    })();
    return () => {
      cancelled = true;
    };
  }, [ensureAuth, leadId, loadAll]);

  if (!authReady) {
    return (
      <StaffPageShell user={user} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  const historical = sessions.filter((row) => row.id !== active?.id);
  const handoff = String(funnel?.presales?.handoff?.status ?? '');

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { label: 'CRM', href: '/crm/leads' },
        { label: 'Sales Discovery' },
      ]}
    >
      <PageToolbar
        title="CRM ? Sales Discovery"
        subtitle="Brief 3 b??c ?? giao Solution cho AM"
      />

      <div className="page-card">
        {leadId > 0 ? (
          <p className="intake-page__context">
            <Link href={`/crm/leads/${leadId}`} className="nav-link">
              ? Lead #{leadId}
            </Link>
            {handoff ? <span className="muted"> ? Handoff: {handoff}</span> : null}
          </p>
        ) : null}

        {loading ? <p className="muted">?ang t?i?</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {!loading && leadId <= 0 ? (
          <p className="muted">
            <Link href="/crm/leads" className="nav-link">
              ? M? danh s?ch leads
            </Link>{' '}
            ?? ch?n lead v? b?t ??u Sales Discovery.
          </p>
        ) : null}

        {!loading && leadId > 0 && token && active ? (
          <SalesDiscoveryWizard
            token={token}
            lead={lead}
            session={active}
            options={options}
            canEdit={canEdit}
            historicalSessions={historical}
            onSessionChange={(next) => {
              setActive(next);
              setSessions((prev) => {
                const rest = prev.filter((row) => row.id !== next.id);
                return [next, ...rest];
              });
              if (token && leadId > 0) {
                void fetchLeadFunnel(token, leadId)
                  .then(setFunnel)
                  .catch(() => undefined);
              }
            }}
          />
        ) : null}

        {!loading && leadId > 0 && !active && !error ? (
          <p className="muted">Ch?a c? phi?n Discovery. T?i l?i trang ho?c ki?m tra quy?n s?a lead.</p>
        ) : null}
      </div>
    </StaffPageShell>
  );
}

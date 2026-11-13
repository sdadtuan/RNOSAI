'use client';

import { type ReactNode } from 'react';
import { PortalMobileBottomNav } from '@/components/PortalMobileBottomNav';
import { PortalAppNav, PortalPage, type BreadcrumbItem } from '@/components/layout';
import {
  fetchPendingCreativeCount,
  fetchPortalNotificationSummary,
  fetchPortalSettings,
  fetchPortalAdsChannels,
  fetchPortalDesk,
  subscribePortalDesk,
  portalSeoStatus,
  type PortalNotificationSummaryResponse,
  type PortalSettingsResponse,
} from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';
import { applyPortalBranding, clearPortalBranding } from '@/lib/portal/branding';
import { PortalAdsChannelProvider } from '@/lib/portal/ads-channels';
import { usePortalChrome } from '@/components/PersistentPortalChrome';

interface PortalPageShellProps {
  children: (ctx: {
    token: string;
    user: NonNullable<ReturnType<typeof usePortalAuth>['user']>;
    branding: PortalSettingsResponse | null;
    refreshBranding: () => Promise<void>;
  }) => ReactNode;
  breadcrumb?: BreadcrumbItem[];
  width?: 'default' | 'wide' | 'narrow';
}

/** Page body only. Sidebar / topbar live in PersistentPortalChrome so they do not remount on navigation. */
export function PortalPageShell({ children, breadcrumb, width = 'wide' }: PortalPageShellProps) {
  const chrome = usePortalChrome();
  if (chrome) {
    return (
      <PortalPage breadcrumb={breadcrumb} width={width}>
        {chrome.sessionWarning ? <p className="badge portal-session-warning">{chrome.sessionWarning}</p> : null}
        {children({
          token: chrome.token,
          user: chrome.user,
          branding: chrome.branding,
          refreshBranding: chrome.refreshBranding,
        })}
      </PortalPage>
    );
  }
  // Fallback if a page is rendered outside the persistent chrome (should not happen).
  return <LegacyPortalPageShell breadcrumb={breadcrumb} width={width}>{children}</LegacyPortalPageShell>;
}

function LegacyPortalPageShell({ children, breadcrumb, width = 'wide' }: PortalPageShellProps) {
  const { user, token, loading, sessionWarning, logout } = usePortalAuth();
  const seoEnabled = usePortalSeoNav(token);
  const { emailEnabled, pendingEmail } = usePortalEmailNav(token);
  const [pendingCount, setPendingCount] = useState(0);
  const [seoPending, setSeoPending] = useState(0);
  const [notificationSummary, setNotificationSummary] = useState<PortalNotificationSummaryResponse | null>(null);
  const [branding, setBranding] = useState<PortalSettingsResponse | null>(null);
  const [adsChannelIds, setAdsChannelIds] = useState<string[] | null>(null);
  const [openLeads, setOpenLeads] = useState(0);
  const [openMessages, setOpenMessages] = useState(0);

  const refreshBranding = useCallback(async () => {
    if (!token) return;
    try {
      const data = await fetchPortalSettings(token);
      setBranding(data);
    } catch {
      setBranding(null);
    }
  }, [token]);

  useEffect(() => {
    if (branding) {
      applyPortalBranding(branding);
      return;
    }
    clearPortalBranding();
  }, [branding]);

  useEffect(() => {
    if (!token) return;
    void fetchPendingCreativeCount(token).then(setPendingCount).catch(() => setPendingCount(0));
    void refreshBranding();
    void fetchPortalNotificationSummary(token)
      .then(setNotificationSummary)
      .catch(() => setNotificationSummary(null));
    void fetchPortalAdsChannels(token)
      .then((out) => setAdsChannelIds((out.channels ?? []).map((item) => item.id)))
      .catch(() => setAdsChannelIds([]));
    const applyDesk = (out: { leads: unknown[]; messages: unknown[] }) => {
      setOpenLeads(out.leads.length);
      setOpenMessages(out.messages.length);
    };
    const unsubDesk = subscribePortalDesk(applyDesk);
    void fetchPortalDesk(token, {})
      .then(applyDesk)
      .catch(() => {
        setOpenLeads(0);
        setOpenMessages(0);
      });
    if (seoEnabled) {
      void portalSeoStatus(token)
        .then((status) => setSeoPending(Number(status.pending_client_review ?? 0)))
        .catch(() => setSeoPending(0));
    } else {
      setSeoPending(0);
    }
    return () => {
      unsubDesk();
    };
  }, [token, seoEnabled, refreshBranding]);

  if (loading || !user || !token) {
    return (
      <main className="portal-page portal-page--wide">
        <p className="muted">Đang tải.</p>
      </main>
    );
  }

  return (
    <PortalAdsChannelProvider ids={adsChannelIds}>
      <PortalAppNav
        user={user}
        onLogout={logout}
        pendingCount={pendingCount}
        notificationUnread={notificationSummary?.unread ?? 0}
        emailPending={pendingEmail}
        seoPending={seoPending}
        branding={branding}
        seoEnabled={seoEnabled}
        emailEnabled={emailEnabled}
        adsChannelIds={adsChannelIds ?? []}
        openLeads={openLeads}
        openMessages={openMessages}
      />
      <PortalPage breadcrumb={breadcrumb} width={width}>
        {sessionWarning ? <p className="badge portal-session-warning">{sessionWarning}</p> : null}
        {children({ token, user, branding, refreshBranding })}
      </PortalPage>
      <PortalMobileBottomNav
        pendingCreatives={pendingCount}
        notificationUnread={notificationSummary?.unread ?? 0}
        emailPending={pendingEmail}
        emailEnabled={emailEnabled}
        isApprover={user.role === 'approver'}
      />
    </PortalAdsChannelProvider>
  );
}

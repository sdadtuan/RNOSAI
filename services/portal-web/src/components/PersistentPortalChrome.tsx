'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { PortalMobileBottomNav } from '@/components/PortalMobileBottomNav';
import { NavTransitionSlot } from '@/components/NavTransitionSlot';
import { PortalAppNav } from '@/components/layout';
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
import { usePortalAuth } from '@/hooks/usePortalAuth';
import { usePortalEmailNav } from '@/hooks/usePortalEmailNav';
import { usePortalSeoNav } from '@/hooks/usePortalSeoNav';
import { applyPortalBranding, clearPortalBranding } from '@/lib/portal/branding';
import { PortalAdsChannelProvider } from '@/lib/portal/ads-channels';
import type { StoredUser } from '@/lib/auth';

export type PortalChromeValue = {
  user: StoredUser;
  token: string;
  branding: PortalSettingsResponse | null;
  refreshBranding: () => Promise<void>;
  sessionWarning: string;
};

const PortalChromeContext = createContext<PortalChromeValue | null>(null);

export function usePortalChrome(): PortalChromeValue | null {
  return useContext(PortalChromeContext);
}

const PUBLIC_PATH = [
  /^\/login$/,
  /^\/forgot-password/,
  /^\/reset-password/,
  /^\/privacy/,
  /^\/archived/,
  /^\/p(\/|$)/,
  /^\/proposals(\/|$)/,
  /^\/video-review(\/|$)/,
];

export function isPublicPortalPath(pathname: string): boolean {
  const p = pathname || '/';
  return PUBLIC_PATH.some((re) => re.test(p));
}

export function PersistentPortalChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isPublicPortalPath(pathname)) {
    return <>{children}</>;
  }
  return <AuthenticatedPortalChrome>{children}</AuthenticatedPortalChrome>;
}

function AuthenticatedPortalChrome({ children }: { children: ReactNode }) {
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
      // Do not clear branding on unmount: this chrome is persistent, and
      // clearing CSS variables mid-navigation flashes the whole shell.
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

  if (loading && !user) {
    return (
      <main className="portal-page portal-page--wide">
        <p className="muted">Đang tải.</p>
      </main>
    );
  }
  if (!user || !token) {
    return null;
  }

  const value: PortalChromeValue = { user, token, branding, refreshBranding, sessionWarning };

  return (
    <PortalChromeContext.Provider value={value}>
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
        <NavTransitionSlot>{children}</NavTransitionSlot>
        <PortalMobileBottomNav
          pendingCreatives={pendingCount}
          notificationUnread={notificationSummary?.unread ?? 0}
          emailPending={pendingEmail}
          emailEnabled={emailEnabled}
          isApprover={user.role === 'approver'}
        />
      </PortalAdsChannelProvider>
    </PortalChromeContext.Provider>
  );
}

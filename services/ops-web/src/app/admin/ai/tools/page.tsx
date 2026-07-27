'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AiToolKeysPanel } from '@/components/ai/AiToolKeysPanel';
import { OpsNav } from '@/components/OpsNav';
import { staffMe, staffRefresh } from '@/lib/api';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  hasCap,
  updateAccessToken,
  updateStoredUser,
  type StoredStaffUser,
} from '@/lib/auth';

export default function AdminAiToolsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');

  const authorize = useCallback((me: StoredStaffUser): boolean => {
    if (!hasCap(me, 'ai_admin', 'view')) {
      setError('Không có quyền AI admin (ai_admin.view)');
      return false;
    }
    setUser(me);
    updateStoredUser(me);
    return true;
  }, []);

  const ensureAuth = useCallback(async (): Promise<void> => {
    let access = getAccessToken();
    if (!access) {
      router.replace('/login');
      return;
    }
    try {
      const me = await staffMe(access);
      if (authorize(me)) setToken(access);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      try {
        const refreshed = await staffRefresh(refresh);
        access = refreshed.access_token;
        updateAccessToken(access);
        const me = await staffMe(access);
        if (authorize(me)) setToken(access);
      } catch {
        clearSession();
        router.replace('/login');
      }
    }
  }, [authorize, router]);

  useEffect(() => {
    void ensureAuth();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!user || !token) {
    return (
      <main style={{ padding: '2rem' }}>
        {error ? <p className="error">{error}</p> : <p className="muted">Đang tải…</p>}
      </main>
    );
  }

  return (
    <main
      className="kpi-page admin-ai-tools-page"
      style={{ maxWidth: 1280, margin: '0 auto', padding: '1.5rem' }}
    >
      <OpsNav user={user} onLogout={logout} />
      <div className="card">
        <AiToolKeysPanel token={token} />
      </div>
    </main>
  );
}

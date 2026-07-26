'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AutomationWorkflowsPanel } from '@/components/automation/AutomationWorkflowsPanel';
import { OpsNav } from '@/components/OpsNav';
import { fetchAutomationWorkflows } from '@/lib/automation-api';
import { staffMe, staffRefresh } from '@/lib/api';
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

export default function CrmAutomationPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchAutomationWorkflows>>['data']['rows']>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
      if (!hasCap(me, 'automation_workflows', 'view')) {
        setError('Không có quyền automation_workflows.view');
        return null;
      }
      setToken(access);
      return access;
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return null;
      }
      try {
        const refreshed = await staffRefresh(refresh);
        updateAccessToken(refreshed.access_token);
        const me = await staffMe(refreshed.access_token);
        setUser(me);
        updateStoredUser(me);
        if (!hasCap(me, 'automation_workflows', 'view')) {
          setError('Không có quyền automation_workflows.view');
          return null;
        }
        setToken(refreshed.access_token);
        return refreshed.access_token;
      } catch {
        clearSession();
        router.replace('/login');
        return null;
      }
    }
  }, [router]);

  const reload = useCallback(async () => {
    const access = token ?? (await ensureAuth());
    if (!access) return;
    try {
      const list = await fetchAutomationWorkflows(access, { limit: 50, offset: 0 });
      setRows(list.data.rows);
      setTotal(list.data.total);
      setError('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không tải workflows';
      setError(msg);
      setRows([]);
      setTotal(0);
    }
  }, [ensureAuth, token]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const access = await ensureAuth();
      if (!access) {
        setLoading(false);
        return;
      }
      try {
        const list = await fetchAutomationWorkflows(access, { limit: 50, offset: 0 });
        setRows(list.data.rows);
        setTotal(list.data.total);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không tải workflows');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  if (error && !token) {
    return (
      <>
        <OpsNav user={user} onLogout={() => { clearSession(); router.replace('/login'); }} />
        <main className="container">
          <div className="card">
            <p>{error}</p>
          </div>
        </main>
      </>
    );
  }

  const canConfigure = user ? hasCap(user, 'automation_workflows', 'configure') : false;
  const canSimulate = user ? hasCap(user, 'automation_workflows', 'simulate') : false;

  return (
    <>
      <OpsNav user={user} onLogout={() => { clearSession(); router.replace('/login'); }} />
      <main className="container automation-workflows-page">
        <div className="card">
          <h2>Workflow automation</h2>
          <p className="muted">UI-R2-04 · /crm/automation · AI nodes + simulate trước khi publish</p>
          {loading ? <p>Đang tải…</p> : null}
          {error && token ? <p className="automation-workflows-error">{error}</p> : null}
          {token ? (
            <AutomationWorkflowsPanel
              token={token}
              canConfigure={canConfigure}
              canSimulate={canSimulate}
              initialRows={rows}
              initialTotal={total}
              onReload={reload}
            />
          ) : null}
        </div>
      </main>
    </>
  );
}

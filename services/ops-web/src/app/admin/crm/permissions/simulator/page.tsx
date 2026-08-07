'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminPageShell } from '@/components/admin';
import { AdminPermissionsSubNav } from '@/components/rbac/AdminPermissionsSubNav';
import {
  fetchStaffJobFunctions,
  fetchStaffPermissionPositions,
  fetchStaffPermissionSets,
  simulateStaffPermissions,
  staffMe,
  staffRefresh,
  type StaffPermissionSimulateMenuItem,
  type StaffPermissionSimulateResponse,
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
import { winSimulatorEnabled } from '@/lib/win/flags';

export default function AdminPermissionsSimulatorPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [positions, setPositions] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [jobFunctions, setJobFunctions] = useState<Array<{ code: string; name: string }>>([]);
  const [sets, setSets] = useState<Array<{ code: string; name: string }>>([]);
  const [positionId, setPositionId] = useState<number | null>(null);
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  const [selectedSets, setSelectedSets] = useState<string[]>([]);
  const [compareUserId, setCompareUserId] = useState('');
  const [result, setResult] = useState<StaffPermissionSimulateResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const logout = useCallback(() => {
    clearSession();
    router.push('/login');
  }, [router]);

  const ensureAuth = useCallback(async (): Promise<string | null> => {
    if (!winSimulatorEnabled()) {
      setError('Simulator chưa bật (NEXT_PUBLIC_WIN_SIMULATOR=1)');
      return null;
    }
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
      if (!hasCap(me, 'crm_data_config', 'configure')) {
        setError('Cần quyền crm_data_config.configure');
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

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      try {
        const [posRows, fnRows, setRows] = await Promise.all([
          fetchStaffPermissionPositions(access),
          fetchStaffJobFunctions(access),
          fetchStaffPermissionSets(access),
        ]);
        setPositions(posRows);
        setJobFunctions(fnRows.map((r) => ({ code: r.code, name: r.label })));
        setSets(setRows.map((r) => ({ code: r.code, name: r.name })));
        if (posRows.length) setPositionId(posRows[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải catalog thất bại');
      }
    })();
  }, [ensureAuth]);

  async function runSimulate() {
    const access = getAccessToken();
    if (!access || positionId == null) return;
    setBusy(true);
    setError('');
    try {
      const out = await simulateStaffPermissions(access, {
        position_id: positionId,
        job_functions: selectedFunctions,
        set_codes: selectedSets,
        compare_user_id: compareUserId.trim() || undefined,
      });
      setResult(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulate thất bại');
    } finally {
      setBusy(false);
    }
  }

  const visibleMenu = useMemo(
    () => (result?.menu ?? []).filter((m: StaffPermissionSimulateMenuItem) => m.visible),
    [result],
  );
  const hiddenMenu = useMemo(
    () => (result?.menu ?? []).filter((m: StaffPermissionSimulateMenuItem) => !m.visible),
    [result],
  );

  function toggleFunction(code: string) {
    setSelectedFunctions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  function toggleSet(code: string) {
    setSelectedSets((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  if (!user) {
    return (
      <AdminPageShell user={null} onLogout={logout} section="crm-config" title="Simulator" loading>
        <span />
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      user={user}
      onLogout={logout}
      section="crm-config"
      title="Permission Simulator"
      subtitle="Preview menu ops-web theo position + job function + permission sets (VUX-04)"
    >
      <div className="page-card stack-gap" data-testid="permissions-simulator-page">
        <AdminPermissionsSubNav />
        {error ? <p className="error">{error}</p> : null}

        <div className="kpi-page__filters">
          <label className="muted">
            Chức vụ
            <select
              value={positionId ?? ''}
              onChange={(e) => setPositionId(Number(e.target.value))}
              disabled={busy}
            >
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="muted">
            So sánh user (UUID, tuỳ chọn)
            <input
              type="text"
              value={compareUserId}
              onChange={(e) => setCompareUserId(e.target.value)}
              className="kpi-input"
              placeholder="00000000-0000-4000-8000-…"
            />
          </label>
          <button type="button" className="btn btn-primary" disabled={busy || positionId == null} onClick={() => void runSimulate()}>
            Chạy simulate
          </button>
        </div>

        <section className="stack-gap">
          <h3 className="section-title">Job functions</h3>
          <div className="win-filter-chips">
            {jobFunctions.map((fn) => (
              <button
                key={fn.code}
                type="button"
                className={`win-filter-chip${selectedFunctions.includes(fn.code) ? ' win-filter-chip--active' : ''}`}
                onClick={() => toggleFunction(fn.code)}
              >
                {fn.code}
              </button>
            ))}
          </div>
        </section>

        <section className="stack-gap">
          <h3 className="section-title">Permission sets</h3>
          <div className="win-filter-chips">
            {sets.map((set) => (
              <button
                key={set.code}
                type="button"
                className={`win-filter-chip${selectedSets.includes(set.code) ? ' win-filter-chip--active' : ''}`}
                onClick={() => toggleSet(set.code)}
              >
                {set.code}
              </button>
            ))}
          </div>
        </section>

        {result ? (
          <>
            <section className="stack-gap">
              <h3 className="section-title">Menu hiển thị ({visibleMenu.length})</h3>
              <ul className="simulator-menu-list">
                {visibleMenu.map((item) => (
                  <li key={item.href}>
                    <strong>{item.label}</strong>
                    <span className="muted"> {item.href}</span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="stack-gap">
              <h3 className="section-title">Menu ẩn ({hiddenMenu.length})</h3>
              <ul className="simulator-menu-list simulator-menu-list--hidden">
                {hiddenMenu.map((item) => (
                  <li key={item.href}>
                    {item.label} <span className="muted">{item.href}</span>
                  </li>
                ))}
              </ul>
            </section>
            {(result.diff.added.length > 0 || result.diff.removed.length > 0) ? (
              <section className="stack-gap">
                <h3 className="section-title">Diff so với user</h3>
                {result.diff.added.length ? (
                  <p className="muted">+ {result.diff.added.join(', ')}</p>
                ) : null}
                {result.diff.removed.length ? (
                  <p className="muted">− {result.diff.removed.join(', ')}</p>
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </AdminPageShell>
  );
}

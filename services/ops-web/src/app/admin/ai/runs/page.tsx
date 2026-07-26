'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminAiRunsPanel, type AdminAiRunsFilters } from '@/components/ai/AdminAiRunsPanel';
import { OpsNav } from '@/components/OpsNav';
import {
  fetchAiAgentRunById,
  fetchAiAgentRuns,
  type AiAgentRunRow,
} from '@/lib/ai-api';
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

const PAGE_SIZE = 50;

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toFilterRange(from: string, to: string): { from?: string; to?: string } {
  const out: { from?: string; to?: string } = {};
  if (from) out.from = `${from}T00:00:00.000Z`;
  if (to) out.to = `${to}T23:59:59.999Z`;
  return out;
}

export default function AdminAiRunsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [filters, setFilters] = useState<AdminAiRunsFilters>({
    from: isoDateDaysAgo(7),
    to: todayIsoDate(),
    status: '',
    useCase: '',
  });
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<AiAgentRunRow[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<AiAgentRunRow | null>(null);
  const [detail, setDetail] = useState<AiAgentRunRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (!hasCap(me, 'ai_admin', 'view')) {
        setError('Không có quyền AI admin (ai_admin.view)');
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

  const loadRuns = useCallback(
    async (access: string, nextOffset: number, nextFilters = filters) => {
      setLoading(true);
      setError('');
      try {
        const range = toFilterRange(nextFilters.from, nextFilters.to);
        const out = await fetchAiAgentRuns(access, {
          ...range,
          status: nextFilters.status || undefined,
          use_case: nextFilters.useCase.trim() || undefined,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        setRows(out.data.rows);
        setTotal(out.data.total);
        setOffset(out.data.offset);
        setSelected(null);
        setDetail(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải AI runs thất bại');
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void (async () => {
      const access = await ensureAuth();
      if (!access) return;
      await loadRuns(access, 0);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, [ensureAuth]);

  const loadDetail = useCallback(async (access: string, row: AiAgentRunRow) => {
    setSelected(row);
    setDetailLoading(true);
    setDetail(row);
    try {
      const out = await fetchAiAgentRunById(access, row.id);
      setDetail(out.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải chi tiết run thất bại');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  function logout() {
    clearSession();
    router.push('/login');
  }

  const periodHint = useMemo(
    () => `Audit RNOS-05 · ${filters.from || '—'} → ${filters.to || '—'}`,
    [filters.from, filters.to],
  );

  if (!user) {
    return (
      <main style={{ padding: '2rem' }}>
        {error ? <p className="error">{error}</p> : <p className="muted">Đang tải…</p>}
      </main>
    );
  }

  return (
    <main className="kpi-page admin-ai-runs-page" style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem' }}>
      <OpsNav user={user} onLogout={logout} />
      <div className="card">
        <div className="kpi-page__head">
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem' }}>AI agent runs</h2>
            <p className="muted" style={{ margin: '0.35rem 0 0' }}>
              {periodHint}
            </p>
          </div>
        </div>

        {error ? <p className="error">{error}</p> : null}

        <AdminAiRunsPanel
          rows={rows}
          total={total}
          limit={PAGE_SIZE}
          offset={offset}
          filters={filters}
          loading={loading}
          selected={selected}
          detail={detail}
          detailLoading={detailLoading}
          onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onApplyFilters={() => {
            const access = getAccessToken();
            if (!access) return;
            setOffset(0);
            void loadRuns(access, 0);
          }}
          onSelectRow={(row) => {
            const access = getAccessToken();
            if (!access) return;
            void loadDetail(access, row);
          }}
          onPrevPage={() => {
            const access = getAccessToken();
            if (!access) return;
            const next = Math.max(0, offset - PAGE_SIZE);
            void loadRuns(access, next);
          }}
          onNextPage={() => {
            const access = getAccessToken();
            if (!access) return;
            void loadRuns(access, offset + PAGE_SIZE);
          }}
        />
      </div>
    </main>
  );
}

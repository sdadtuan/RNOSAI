'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StaffPageShell } from '@/components/layout';
import { ResearchStatusChip } from '@/components/research/ResearchStatusChip';
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
import {
  fetchResearchOpsAnalytics,
  type OpsAnalyticsPayload,
} from '@/lib/market-research-api';
import { isMarketResearchFeEnabled } from '@/lib/market-research-flags';

export default function CrmResearchAnalyticsPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredStaffUser | null>(null);
  const [data, setData] = useState<OpsAnalyticsPayload | null>(null);
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
      if (!hasCap(me, 'crm_research', 'view')) {
        setError('Không có quyền xem nghiên cứu thị trường');
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
      if (!isMarketResearchFeEnabled()) {
        setUser(getStoredUser());
        return;
      }
      const access = await ensureAuth();
      if (!access) return;
      setLoading(true);
      setError('');
      try {
        setData(await fetchResearchOpsAnalytics(access));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải phân tích thất bại');
      } finally {
        setLoading(false);
      }
    })();
  }, [ensureAuth]);

  function logout() {
    clearSession();
    router.push('/login');
  }

  if (!isMarketResearchFeEnabled()) {
    const body = (
      <div className="page-card">
        <p>Module nghiên cứu thị trường chưa bật.</p>
      </div>
    );
    if (!user) return body;
    return (
      <StaffPageShell user={user} onLogout={logout}>
        {body}
      </StaffPageShell>
    );
  }

  if (!user) {
    return (
      <StaffPageShell user={null} onLogout={logout} loading>
        <span />
      </StaffPageShell>
    );
  }

  const p50 = data?.cycle_time_hours.designed_to_approved_p50;
  const cards = [
    {
      label: 'Thời gian chu kỳ (p50 giờ)',
      value: p50 == null ? '—' : String(p50),
    },
    {
      label: '% project có evidence đã verify',
      value: data ? `${data.evidence_completeness.with_verified_pct}` : '—',
    },
    {
      label: 'Project đã giao',
      value: data ? String(data.activation.distributed_projects) : '—',
    },
  ];

  return (
    <StaffPageShell
      user={user}
      onLogout={logout}
      breadcrumb={[
        { href: '/crm/research', label: 'Nghiên cứu thị trường' },
        { href: '/crm/research/analytics', label: 'Phân tích nghiên cứu' },
      ]}
    >
      <div className="page-card stack-gap">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Phân tích nghiên cứu</h1>
          <Link href="/crm/research" className="btn btn-sm btn-secondary">
            Nghiên cứu thị trường
          </Link>
        </div>
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <div className="agency-stat-grid channel-hub-summary">
          {cards.map((card) => (
            <div key={card.label} className="agency-stat-card">
              <strong>{card.value}</strong>
              <span className="muted">{card.label}</span>
            </div>
          ))}
        </div>
        {data?.projects.length ? (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Client</th>
                <th>Trạng thái</th>
                <th>Evidence đã verify</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/crm/research/${p.id}?tab=brief`} className="nav-link">
                      {p.id}
                    </Link>
                  </td>
                  <td>{p.client_id}</td>
                  <td>
                    <ResearchStatusChip status={p.status} />
                  </td>
                  <td>{p.verified_ev}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {data && data.projects.length === 0 && !loading ? (
          <p className="muted">Chưa có dự án nghiên cứu</p>
        ) : null}
      </div>
    </StaffPageShell>
  );
}

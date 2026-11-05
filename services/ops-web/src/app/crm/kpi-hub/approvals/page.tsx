'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import {
  approveKpiHubItem,
  fetchKpiHubApprovals,
  rejectKpiHubItem,
  type HubApprovalGroup,
} from '@/lib/kpi-hub-api';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken } from '@/lib/auth';
import { staffRefresh } from '@/lib/api';

export default function KpiHubApprovalsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<HubApprovalGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [acting, setActing] = useState('');

  const load = useCallback(async () => {
    let token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await fetchKpiHubApprovals(token);
      setGroups(out.groups);
      setTotal(out.total);
    } catch {
      const refresh = getRefreshToken();
      if (!refresh) {
        clearSession();
        router.replace('/login');
        return;
      }
      try {
        const out = await staffRefresh(refresh);
        updateAccessToken(out.access_token);
        token = out.access_token;
        const data = await fetchKpiHubApprovals(token);
        setGroups(data.groups);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải Approval Center thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(kind: string, id: string, action: 'approve' | 'reject') {
    const token = getAccessToken();
    if (!token) return;
    setActing(`${action}:${id}`);
    try {
      if (action === 'approve') await approveKpiHubItem(token, kind, id);
      else await rejectKpiHubItem(token, kind, id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác duyệt thất bại');
    } finally {
      setActing('');
    }
  }

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="Approval Center"
        subtitle="KPI, target, mapping và dự án chờ phê duyệt."
        breadcrumb={[{ label: 'Governance' }, { label: 'Approval Center' }]}
      >
        <div data-testid="hub-approvals">
          {loading ? <p className="muted">Đang tải…</p> : null}
          {error ? <p className="error">{error}</p> : null}
          {!loading && total === 0 ? (
            <div className="kpi-hub-empty">
              <p>Chưa có mục chờ duyệt.</p>
            </div>
          ) : null}
          {groups.map((group) =>
            group.count > 0 ? (
              <section key={group.id} className="hub-approvals-group">
                <h2 className="hub-approvals-group__title">
                  {group.label} ({group.count})
                </h2>
                <ul className="hub-approvals-list">
                  {group.items.map((item) => (
                    <li key={`${item.kind}-${item.id}`} className="hub-approvals-item">
                      <div>
                        {item.href ? (
                          <Link href={item.href} className="delivery-link">
                            {item.label}
                          </Link>
                        ) : (
                          <span>{item.label}</span>
                        )}
                        <span className="hub-approvals-item__meta"> · {item.status}</span>
                        {item.policy?.length ? (
                          <p className="hub-approvals-item__policy">
                            Luồng: {item.policy.map((p) => p.label).join(' → ')}
                          </p>
                        ) : null}
                      </div>
                      {['change_request', 'delivery_project', 'delivery_budget'].includes(item.kind) ? (
                        <div className="hub-approvals-item__actions">
                          <button
                            type="button"
                            className="kpi-hub-btn kpi-hub-btn--ghost"
                            disabled={acting !== ''}
                            onClick={() => void act(item.kind, item.id, 'reject')}
                          >
                            Từ chối
                          </button>
                          <button
                            type="button"
                            className="kpi-hub-btn kpi-hub-btn--primary"
                            disabled={acting !== ''}
                            onClick={() => void act(item.kind, item.id, 'approve')}
                          >
                            Duyệt
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </div>
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

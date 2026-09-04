'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KpiHubPageGate } from '@/components/kpi-hub/KpiHubPageGate';
import { KpiHubShell } from '@/components/kpi-hub/KpiHubShell';
import { fetchKpiHubLineage, type KpiLineageResponse } from '@/lib/kpi-hub-api';
import { clearSession, getAccessToken, getRefreshToken, updateAccessToken } from '@/lib/auth';
import { staffRefresh } from '@/lib/api';

export default function KpiHubLineagePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? 'SAL_008';

  const [data, setData] = useState<KpiLineageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    let token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await fetchKpiHubLineage(token, code);
      setData(out);
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
        setData(await fetchKpiHubLineage(out.access_token, code));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Tải lineage thất bại');
      }
    } finally {
      setLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <KpiHubPageGate section="crm_kpi_hub">
      <KpiHubShell
        title="KPI Lineage"
        subtitle="Dictionary → nguồn dữ liệu → fact gần nhất."
        breadcrumb={[
          { label: 'Governance' },
          { label: 'Lineage', href: `/crm/kpi-hub/lineage?code=${encodeURIComponent(code)}` },
        ]}
        actions={
          <input
            className="delivery-filter-input"
            defaultValue={code}
            aria-label="Mã KPI"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const v = (e.target as HTMLInputElement).value.trim();
                router.push(`/crm/kpi-hub/lineage?code=${encodeURIComponent(v || 'SAL_008')}`);
              }
            }}
          />
        }
      >
        {loading ? <p className="muted">Đang tải…</p> : null}
        {error ? <p className="error">{error}</p> : null}
        {data ? (
          <div className="kpi-lineage" data-testid="kpi-lineage">
            <p className="delivery-hint">
              Mã: <strong>{data.code}</strong>
              {data.last_fact_at ? ` · Fact gần nhất: ${data.last_fact_at.slice(0, 19)}` : ' · Chưa có fact'}
            </p>
            {!data.dictionary ? (
              <div className="kpi-hub-empty">
                <p>Không tìm thấy KPI trong Dictionary.</p>
              </div>
            ) : (
              <div className="kpi-lineage-flow">
                {data.nodes.map((node) => (
                  <div key={node.id} className={`kpi-lineage-node kpi-lineage-node--${node.kind}`}>
                    <span className="kpi-lineage-node__kind">{node.kind}</span>
                    <strong>{node.label}</strong>
                  </div>
                ))}
              </div>
            )}
            <p className="delivery-hint">
              <Link href="/crm/kpi-hub/dictionary" className="delivery-link">
                Mở KPI Dictionary
              </Link>
            </p>
          </div>
        ) : null}
      </KpiHubShell>
    </KpiHubPageGate>
  );
}

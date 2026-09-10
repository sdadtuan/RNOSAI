'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CpDataTable } from '@/components/crm/cp/CpDataTable';
import { CP_SUBTITLES } from '@/lib/crm/cp-copy';
import { getAccessToken } from '@/lib/auth';
import {
  getOverviewActions,
  type CpOverviewAction,
  type CpOverviewQuery,
  type CpScope,
} from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function asScope(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function severityClass(severity: string): string {
  if (severity === 'critical' || severity === 'danger') return 'cp-pill cp-pill--danger';
  if (severity === 'warning') return 'cp-pill cp-pill--warning';
  if (severity === 'info') return 'cp-pill cp-pill--info';
  return 'cp-pill';
}

export default function CpActionsPage() {
  const searchParams = useSearchParams();
  const query = useMemo<CpOverviewQuery>(() => ({
    scope: asScope(searchParams.get('scope')),
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    client: searchParams.get('client') ?? undefined,
    lifecycle: searchParams.get('lifecycle') ?? undefined,
    owner: searchParams.get('owner') ?? undefined,
  }), [searchParams]);
  const [rows, setRows] = useState<CpOverviewAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setRows(await getOverviewActions(token, query));
    } catch (err) {
      setRows([]);
      setError(err instanceof Error ? err.message : 'Không tải Action Center');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="cp-overview" aria-busy={loading}>
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Action Center</p>
          <h1>Action Center</h1>
          <p className="cp-muted">{CP_SUBTITLES.ovrActions}</p>
        </div>
        <div className="cp-overview__actions">
          <Link className="cp-btn cp-btn--primary" href="/crm/creative-os">
            Về dashboard
          </Link>
        </div>
      </header>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p></section> : null}

      <CpDataTable
        rows={rows}
        rowKey={(row) => `${row.kind}:${row.resource_id ?? row.title}`}
        empty="Không có việc cần xử lý"
        columns={[
          { key: 'sev', header: 'Sev', render: (row) => (
            <span className={severityClass(row.severity)}>{row.severity}</span>
          ) },
          { key: 'title', header: 'Impact', render: (row) => row.title },
          { key: 'owner', header: 'Owner', render: (row) => (
            row.owner_staff_id != null ? String(row.owner_staff_id) : dash(null)
          ) },
          { key: 'sla', header: 'SLA', render: (row) => row.sla_at ?? dash(null) },
          { key: 'cta', header: 'CTA', render: (row) => (
            row.href ? <Link className="cp-btn" href={row.href}>Mở</Link> : dash(null)
          ) },
        ]}
      />
    </div>
  );
}

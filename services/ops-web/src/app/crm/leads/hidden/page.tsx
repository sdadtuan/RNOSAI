'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LeadLockedBadge } from '@/components/crm/LeadLockedBadge';
import { PageToolbar, StaffPageShell } from '@/components/layout';
import { useAdminCrmAuth } from '@/lib/admin/use-admin-crm-auth';
import { fetchLeads } from '@/lib/api';
import { isSuperAdmin } from '@/lib/crm/lead-ae-visibility';

const PAGE_SIZE = 50;

export default function HiddenLeadsPage() {
  const { user, token, error: authError, loading, logout } = useAdminCrmAuth(isSuperAdmin);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [result, setResult] = useState<Awaited<ReturnType<typeof fetchLeads>> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setResult(null);
    setError('');
    void fetchLeads(token, {
      hidden_only: true,
      hide_review_queue: false,
      q: query || undefined,
      limit: PAGE_SIZE,
      offset,
    }).then((data) => {
      if (!cancelled) setResult(data);
    }).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được Lead Ẩn.');
    });
    return () => { cancelled = true; };
  }, [token, query, offset]);

  return (
    <StaffPageShell user={user} onLogout={logout} loading={loading} width="wide">
      <PageToolbar
        title="Lead Ẩn"
        actions={<Link href="/crm/leads" className="btn btn-sm">Về danh sách lead</Link>}
      />
      {authError || error ? <p role="alert">{authError || error}</p> : null}
      {token ? (
        <section className="page-card stack-gap" aria-label="Danh sách Lead Ẩn">
          <form onSubmit={(event) => {
            event.preventDefault();
            setOffset(0);
            setQuery(search.trim());
          }}>
            <label>
              Tìm lead đã ẩn{' '}
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, số điện thoại hoặc email" />
            </label>{' '}
            <button type="submit" className="btn btn-sm">Tìm</button>
          </form>
          {!result && !error ? <p role="status">Đang tải Lead Ẩn…</p> : null}
          {result?.total === 0 ? <p>Không tìm thấy lead đã ẩn.</p> : null}
          {result && result.total > 0 ? (
            <>
              <p>{result.total} lead đã ẩn</p>
              <ul>
                {result.leads.map((lead) => (
                  <li key={lead.id}>
                    <Link href={`/crm/leads/${lead.id}`}>#{lead.id} · {lead.full_name || lead.company_name || 'Lead'}</Link>
                    {' '}<LeadLockedBadge compact kind="hidden" />
                    {lead.owner_name ? ` · Phụ trách: ${lead.owner_name}` : ''}
                  </li>
                ))}
              </ul>
              {result.total > PAGE_SIZE ? (
                <div>
                  <button type="button" className="btn btn-sm" disabled={offset === 0} onClick={() => setOffset(offset - PAGE_SIZE)}>
                    Trang trước
                  </button>
                  <button type="button" className="btn btn-sm" disabled={offset + PAGE_SIZE >= result.total} onClick={() => setOffset(offset + PAGE_SIZE)}>
                    Trang sau
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}
    </StaffPageShell>
  );
}

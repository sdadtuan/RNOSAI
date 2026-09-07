'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { listCpProjects, type CpProjectSummary, type CpScope } from '@/lib/crm/cp-api';
import { dash } from '@/lib/crm/cp-format';

function formatDate(value: string | null): string {
  if (!value) return dash(null);
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN').format(date)
    : value;
}

export function CpProjectsList() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/creative-os/projects';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentSearch = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const [projects, setProjects] = useState<CpProjectSummary[]>([]);
  const [q, setQ] = useState(currentSearch.get('q') ?? '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const scopeValue = currentSearch.get('scope');
      const scope: CpScope =
        scopeValue === 'team' || scopeValue === 'all' ? scopeValue : 'me';
      const out = await listCpProjects(token, {
        q: currentSearch.get('q') || undefined,
        status: currentSearch.get('status') || undefined,
        scope,
      });
      const client = currentSearch.get('client');
      const owner = currentSearch.get('owner');
      setProjects(
        out.items
          .filter((project) => !client || project.agency_client_id === client)
          .filter((project) => !owner || String(project.owner_staff_id) === owner),
      );
    } catch (err) {
      setProjects([]);
      setError(err instanceof Error ? err.message : 'Không tải được danh mục dự án');
    } finally {
      setLoading(false);
    }
  }, [currentSearch]);

  useEffect(() => {
    setQ(currentSearch.get('q') ?? '');
    void load();
  }, [currentSearch, load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ['q', 'status', 'client', 'owner', 'scope']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Danh mục dự án</p>
          <h1>Danh mục dự án</h1>
          <p className="cp-muted">Theo dõi project theo trạng thái, khách hàng và owner.</p>
        </div>
        <Link className="cp-btn cp-btn--primary" href="/crm/creative-os/projects/new">
          Tạo project
        </Link>
      </header>

      <form className="cp-filters" onSubmit={applyFilters}>
        <label>
          <span>Tìm kiếm</span>
          <input name="q" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tên hoặc mục tiêu" />
        </label>
        <label>
          <span>Trạng thái</span>
          <select name="status" defaultValue={currentSearch.get('status') ?? ''}>
            <option value="">Tất cả</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="at_risk">At Risk</option>
            <option value="in_review">In Review</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label>
          <span>Khách</span>
          <input name="client" defaultValue={currentSearch.get('client') ?? ''} placeholder="Agency client ID" />
        </label>
        <label>
          <span>Owner</span>
          <input name="owner" defaultValue={currentSearch.get('owner') ?? ''} placeholder="Staff ID" />
        </label>
        <label>
          <span>Phạm vi</span>
          <select name="scope" defaultValue={currentSearch.get('scope') ?? 'me'}>
            <option value="me">Của tôi</option>
            <option value="team">Team</option>
            <option value="all">Toàn bộ</option>
          </select>
        </label>
        <button className="cp-btn cp-btn--primary" type="submit">Áp dụng</button>
      </form>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p><button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button></section> : null}

      <section className="cp-card" aria-busy={loading}>
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr><th>Project</th><th>Khách / lifecycle</th><th>Hạn</th><th>Status</th><th>Owner</th><th>Credit budget</th></tr>
            </thead>
            <tbody>
              {projects.length ? projects.map((project) => (
                <tr key={project.id}>
                  <td><Link className="cp-link" href={`/crm/creative-os/projects/${project.id}`}>{project.name}</Link></td>
                  <td>
                    <a className="cp-link" href={`/crm/account-management/clients/${project.agency_client_id}`}>{project.agency_client_id}</a>
                    {' / '}
                    {project.lifecycle_id ? <a className="cp-link" href={`/crm/service-delivery/${project.lifecycle_id}?tab=content-os`}>{project.lifecycle_id}</a> : dash(null)}
                  </td>
                  <td>{formatDate(project.due_at)}</td>
                  <td><span className="cp-pill">{dash(project.status)}</span></td>
                  <td>{dash(project.owner_staff_id)}</td>
                  <td>{dash(project.credit_budget)}</td>
                </tr>
              )) : (
                <tr><td className="cp-empty" colSpan={6}>{loading ? 'Đang tải…' : dash(null)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

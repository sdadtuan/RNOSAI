'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  importCpProjectsFromB2b,
  listCpProjects,
  type CpProjectListSummary,
  type CpProjectSummary,
  type CpScope,
} from '@/lib/crm/cp-api';
import { CP_SUBTITLES } from '@/lib/crm/cp-copy';
import { dash } from '@/lib/crm/cp-format';
import {
  PORTFOLIO_STATUS_CHIPS,
  formatCreditPct,
  formatDeliverableCount,
  formatPortfolioChip,
  portfolioPillClass,
  portfolioStatusLabel,
  projectProgressPct,
  type PortfolioChipId,
} from '@/lib/crm/cp-portfolio.util';

type PortfolioViewMode = 'list' | 'grid';

function ProgressBar({ done, total }: { done?: number | null; total?: number | null }) {
  const pct = projectProgressPct(done, total);
  if (pct == null) return <span className="cp-muted">{dash(null)}</span>;
  return (
    <div className="cp-progress" aria-label={`Tiến độ ${pct}%`}>
      <div className="cp-progress__track">
        <div className="cp-progress__fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="cp-progress__label">{pct}%</span>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return dash(null);
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN').format(date)
    : value;
}

function emptySummary(): CpProjectListSummary {
  return {
    project_count: 0,
    deliverable_done: 0,
    credit_at_risk: 0,
    status_counts: {
      all: 0,
      draft: 0,
      active: 0,
      at_risk: 0,
      in_review: 0,
      completed: 0,
      archived: 0,
    },
  };
}

export function CpProjectsList() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/creative-os/projects';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentSearch = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const [projects, setProjects] = useState<CpProjectSummary[]>([]);
  const [summary, setSummary] = useState<CpProjectListSummary>(emptySummary);
  const [q, setQ] = useState(currentSearch.get('q') ?? '');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [viewMode, setViewMode] = useState<PortfolioViewMode>('list');
  const [error, setError] = useState('');

  const scope: CpScope = useMemo(() => {
    const value = currentSearch.get('scope');
    return value === 'team' || value === 'all' ? value : 'me';
  }, [currentSearch]);
  const status = currentSearch.get('status') ?? '';

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const out = await listCpProjects(token, {
        q: currentSearch.get('q') || undefined,
        status: currentSearch.get('status') || undefined,
        client: currentSearch.get('client') || undefined,
        owner: currentSearch.get('owner') || undefined,
        lifecycle: currentSearch.get('lifecycle') || undefined,
        scope,
      });
      setProjects(out.items);
      setSummary(out.summary ?? emptySummary());
    } catch (err) {
      setProjects([]);
      setSummary(emptySummary());
      setError(err instanceof Error ? err.message : 'Không tải được danh mục dự án');
    } finally {
      setLoading(false);
    }
  }, [currentSearch, scope]);

  useEffect(() => {
    setQ(currentSearch.get('q') ?? '');
    void load();
  }, [currentSearch, load]);

  function replaceFilters(patch: Record<string, string | null>) {
    const params = new URLSearchParams(currentSearch.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  function applyChip(id: PortfolioChipId) {
    if (id === 'me') {
      replaceFilters({ scope: 'me' });
      return;
    }
    if (id === 'all') {
      replaceFilters({ status: null });
      return;
    }
    replaceFilters({ status: id });
  }

  async function importFromB2b() {
    const token = getAccessToken();
    if (!token) {
      setError('Phiên đăng nhập không hợp lệ');
      return;
    }
    setImporting(true);
    setError('');
    try {
      await importCpProjectsFromB2b(token);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lấy được dự án PTT');
    } finally {
      setImporting(false);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const key of ['q', 'client', 'owner', 'lifecycle', 'scope']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) params.set(key, value);
    }
    if (status) params.set('status', status);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  function chipOn(id: PortfolioChipId): boolean {
    if (id === 'me') return scope === 'me';
    if (id === 'all') return !status;
    return status === id;
  }

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Danh mục dự án</p>
          <h1>Danh mục dự án</h1>
          <p className="cp-muted">{CP_SUBTITLES.prjPortfolio}</p>
        </div>
        <div className="cp-overview__actions">
          <div className="cp-chips" role="group" aria-label="Chế độ xem">
            <button
              type="button"
              className={`cp-chip${viewMode === 'grid' ? ' is-on' : ''}`}
              aria-pressed={viewMode === 'grid'}
              onClick={() => setViewMode('grid')}
            >
              Lưới
            </button>
            <button
              type="button"
              className={`cp-chip${viewMode === 'list' ? ' is-on' : ''}`}
              aria-pressed={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              Danh sách
            </button>
          </div>
          <button
            className="cp-btn"
            type="button"
            disabled={loading || importing}
            onClick={() => void importFromB2b()}
          >
            {importing ? 'Đang lấy…' : 'Lấy từ Dự án PTT'}
          </button>
          <Link className="cp-btn cp-btn--primary" href="/crm/creative-os/projects/new">
            Tạo project
          </Link>
        </div>
      </header>

      <div className="cp-kpi-grid">
        <section className="cp-kpi-tile">
          <span>Số project</span>
          <strong>{loading ? dash(null) : summary.project_count}</strong>
        </section>
        <section className="cp-kpi-tile">
          <span>Deliverable xong</span>
          <strong>{loading ? dash(null) : summary.deliverable_done}</strong>
        </section>
        <section className="cp-kpi-tile">
          <span>Credit at-risk</span>
          <strong>{loading ? dash(null) : summary.credit_at_risk}</strong>
        </section>
      </div>

      <div className="cp-chips" role="tablist" aria-label="Lọc trạng thái">
        {PORTFOLIO_STATUS_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`cp-chip${chipOn(chip.id) ? ' is-on' : ''}`}
            aria-pressed={chipOn(chip.id)}
            onClick={() => applyChip(chip.id)}
          >
            {formatPortfolioChip(chip.id, summary.status_counts)}
          </button>
        ))}
      </div>

      <form className="cp-filters cp-filters--portfolio" onSubmit={applyFilters}>
        <label>
          <span>Tìm kiếm</span>
          <input name="q" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Tên hoặc mục tiêu" />
        </label>
        <label>
          <span>Khách</span>
          <input key={`client-${searchKey}`} name="client" defaultValue={currentSearch.get('client') ?? ''} placeholder="Tên khách" />
        </label>
        <label>
          <span>Owner</span>
          <input key={`owner-${searchKey}`} name="owner" defaultValue={currentSearch.get('owner') ?? ''} placeholder="Tên owner" />
        </label>
        <label>
          <span>Lifecycle</span>
          <input key={`lifecycle-${searchKey}`} name="lifecycle" defaultValue={currentSearch.get('lifecycle') ?? ''} placeholder="Slug hoặc ID" />
        </label>
        <label>
          <span>Phạm vi</span>
          <select key={`scope-${scope}`} name="scope" defaultValue={scope}>
            <option value="me">Của tôi</option>
            <option value="team">Team</option>
            <option value="all">Toàn bộ</option>
          </select>
        </label>
        <button className="cp-btn cp-btn--primary" type="submit">Áp dụng</button>
      </form>

      {error ? <section className="cp-card cp-card--error"><p>{error}</p><button className="cp-btn" type="button" onClick={() => void load()}>Thử lại</button></section> : null}

      <section className="cp-card" aria-busy={loading}>
        {viewMode === 'grid' ? (
          <div className="cp-project-grid">
            {projects.length ? projects.map((project) => (
              <article key={project.id} className="cp-project-card">
                <div className="cp-card__head">
                  <Link className="cp-link" href={`/crm/creative-os/projects/${project.id}`}>
                    <strong>{project.name}</strong>
                  </Link>
                  <span className={portfolioPillClass(project.status)}>
                    {portfolioStatusLabel(project.status)}
                  </span>
                </div>
                <p className="cp-muted">
                  <a className="cp-link" href={`/crm/account-management/clients/${project.agency_client_id}`}>
                    {project.client_name || dash(null)}
                  </a>
                  {project.lifecycle_id ? (
                    <>
                      {' · '}
                      <a className="cp-link" href={`/crm/service-delivery/${project.lifecycle_id}?tab=content-os`}>
                        {project.lifecycle_name || project.lifecycle_id}
                      </a>
                    </>
                  ) : null}
                </p>
                <ProgressBar done={project.deliverable_done} total={project.deliverable_total} />
                <p className="cp-muted">
                  {formatDeliverableCount(project.deliverable_done, project.deliverable_total)}
                  {' · Hạn '}
                  {formatDate(project.due_at)}
                  {' · '}
                  {project.owner_name || dash(null)}
                  {' · Credit '}
                  {formatCreditPct(project.credit_used, project.credit_budget)}
                </p>
              </article>
            )) : (
              <p className="cp-empty">{loading ? 'Đang tải…' : 'Chưa có project. Lấy từ Dự án PTT hoặc tạo mới.'}</p>
            )}
          </div>
        ) : (
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Khách / lifecycle</th>
                  <th>Tiến độ</th>
                  <th>Deliverable</th>
                  <th>Hạn</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {projects.length ? projects.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <Link className="cp-link" href={`/crm/creative-os/projects/${project.id}`}>
                        {project.name}
                      </Link>
                    </td>
                    <td>
                      <a className="cp-link" href={`/crm/account-management/clients/${project.agency_client_id}`}>
                        {project.client_name || dash(null)}
                      </a>
                      {' / '}
                      {project.lifecycle_id ? (
                        <a className="cp-link" href={`/crm/service-delivery/${project.lifecycle_id}?tab=content-os`}>
                          {project.lifecycle_name || project.lifecycle_id}
                        </a>
                      ) : dash(null)}
                    </td>
                    <td>
                      <ProgressBar done={project.deliverable_done} total={project.deliverable_total} />
                    </td>
                    <td>{formatDeliverableCount(project.deliverable_done, project.deliverable_total)}</td>
                    <td>{formatDate(project.due_at)}</td>
                    <td>
                      <span className={portfolioPillClass(project.status)}>
                        {portfolioStatusLabel(project.status)}
                      </span>
                    </td>
                    <td>{project.owner_name || dash(null)}</td>
                    <td>{formatCreditPct(project.credit_used, project.credit_budget)}</td>
                  </tr>
                )) : (
                  <tr>
                    <td className="cp-empty" colSpan={8}>
                      {loading ? 'Đang tải…' : 'Chưa có project. Lấy từ Dự án PTT hoặc tạo mới.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

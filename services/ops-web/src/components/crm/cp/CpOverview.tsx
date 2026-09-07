'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  getOverviewActions,
  getOverviewHealth,
  getOverviewKpis,
  listActivity,
  listCpProjectMilestones,
  listCpProjects,
  type CpActivity,
  type CpMilestone,
  type CpOverviewAction,
  type CpOverviewHealth,
  type CpOverviewKpis,
  type CpOverviewQuery,
  type CpProjectSummary,
  type CpScope,
} from '@/lib/crm/cp-api';
import {
  dash,
  hasTrendData,
  KPI_TILES,
  normalizeCpHref,
  type CpKpiKey,
  type CpTrendPoint,
} from '@/lib/crm/cp-format';

const EMPTY_KPIS: CpOverviewKpis = {
  videos_created: null,
  videos_approved: null,
  render_success_rate: null,
  render_avg_duration_sec: null,
  credits_used: null,
  credits_remaining: null,
  assets_expiring: null,
  tasks_overdue: null,
};

const FILTER_KEYS = ['from', 'to', 'client', 'lifecycle', 'owner', 'scope'] as const;
const DAY_MS = 24 * 60 * 60 * 1_000;

type FilterDraft = Record<(typeof FILTER_KEYS)[number], string>;

type OverviewState = {
  lastUpdated: string | null;
  kpis: CpOverviewKpis;
  trend: CpTrendPoint[];
  actions: CpOverviewAction[];
  health: CpOverviewHealth | null;
  projects: CpProjectSummary[];
  milestones: CpMilestone[];
  activity: CpActivity[];
};

const EMPTY_STATE: OverviewState = {
  lastUpdated: null,
  kpis: EMPTY_KPIS,
  trend: [],
  actions: [],
  health: null,
  projects: [],
  milestones: [],
  activity: [],
};

function filterDraft(searchParams: URLSearchParams): FilterDraft {
  return {
    from: searchParams.get('from') ?? '',
    to: searchParams.get('to') ?? '',
    client: searchParams.get('client') ?? '',
    lifecycle: searchParams.get('lifecycle') ?? '',
    owner: searchParams.get('owner') ?? '',
    scope: searchParams.get('scope') ?? 'me',
  };
}

function asScope(value: string): CpScope {
  if (value === 'team' || value === 'all') return value;
  return 'me';
}

function apiQuery(searchParams: URLSearchParams): CpOverviewQuery {
  const draft = filterDraft(searchParams);
  return {
    from: draft.from || undefined,
    to: draft.to || undefined,
    client: draft.client || undefined,
    lifecycle: draft.lifecycle || undefined,
    owner: draft.owner || undefined,
    scope: asScope(draft.scope),
  };
}

function formatKpi(key: CpKpiKey, value: number | null): string {
  if (value == null) return dash(null);
  if (key === 'render_success_rate') {
    const percent = value <= 1 ? value * 100 : value;
    return `${percent.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
  }
  if (key === 'render_avg_duration_sec') {
    const seconds = Math.max(0, Math.round(value));
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return minutes > 0 ? `${minutes}p ${remainder}s` : `${remainder}s`;
  }
  return value.toLocaleString('vi-VN', { maximumFractionDigits: 1 });
}

function formatDate(value: string | null | undefined): string {
  if (!value) return dash(null);
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
    : value;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return dash(null);
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date)
    : value;
}

function severityClass(severity: string): string {
  if (severity === 'critical' || severity === 'danger') return 'cp-pill cp-pill--danger';
  if (severity === 'warning') return 'cp-pill cp-pill--warning';
  if (severity === 'info') return 'cp-pill cp-pill--info';
  return 'cp-pill';
}

function scopedHref(href: string, searchParams: URLSearchParams): string {
  const url = new URL(href, 'http://cp.local');
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) url.searchParams.set(key, value);
  }
  const query = url.searchParams.toString();
  return `${url.pathname}${query ? `?${query}` : ''}`;
}

export function CpOverview() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/creative-os';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const currentSearch = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const query = useMemo(() => apiQuery(currentSearch), [currentSearch]);
  const [draft, setDraft] = useState<FilterDraft>(() => filterDraft(currentSearch));
  const [data, setData] = useState<OverviewState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const actionDrawerOpen = currentSearch.get('panel') === 'actions';

  useEffect(() => {
    setDraft(filterDraft(currentSearch));
  }, [currentSearch]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const [kpiOut, actions, health, activityOut, projectOut] = await Promise.all([
        getOverviewKpis(token, query),
        getOverviewActions(token, query),
        getOverviewHealth(token, query),
        listActivity(token, query),
        listCpProjects(token, query),
      ]);
      const projects = projectOut.items
        .filter((project) => !['completed', 'archived'].includes(project.status))
        .filter((project) => !query.client || project.agency_client_id === query.client)
        .filter((project) => !query.lifecycle || project.lifecycle_id === query.lifecycle)
        .filter((project) => !query.owner || String(project.owner_staff_id) === query.owner)
        .slice(0, 6);
      const milestoneRows = await Promise.all(
        projects.map((project) =>
          listCpProjectMilestones(token, project.id).then((out) => out.items),
        ),
      );
      const trend =
        'trend' in kpiOut && Array.isArray(kpiOut.trend)
          ? (kpiOut.trend as CpTrendPoint[])
          : [];
      setData({
        lastUpdated: kpiOut.last_updated,
        kpis: kpiOut.kpis,
        trend,
        actions,
        health,
        projects,
        milestones: milestoneRows
          .flat()
          .filter((milestone) => {
            if (!milestone.due_at) return false;
            const due = new Date(milestone.due_at).getTime();
            const now = Date.now();
            return due >= now - DAY_MS && due <= now + 7 * DAY_MS;
          })
          .sort((a, b) => String(a.due_at).localeCompare(String(b.due_at)))
          .slice(0, 8),
        activity: activityOut.items.slice(0, 8),
      });
    } catch (err) {
      setData(EMPTY_STATE);
      setError(err instanceof Error ? err.message : 'Không tải được Tổng quan sản xuất');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(currentSearch);
    for (const key of FILTER_KEYS) {
      const value = draft[key].trim();
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.set('scope', asScope(draft.scope));
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  function setActionDrawer(open: boolean) {
    const params = new URLSearchParams(currentSearch);
    if (open) params.set('panel', 'actions');
    else params.delete('panel');
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  const criticalActions = data.actions.filter(
    (action) => action.severity === 'critical' || action.severity === 'danger',
  );
  const provider = data.health?.providers[0] ?? null;
  const showTrend = hasTrendData(data.trend);

  return (
    <div className="cp-overview">
      <header className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Tổng quan</p>
          <h1>Tổng quan sản xuất</h1>
          <p className="cp-muted">
            Cập nhật {formatDateTime(data.lastUpdated)} · phạm vi {query.scope ?? 'me'}
          </p>
        </div>
        <button type="button" className="cp-btn" onClick={() => setActionDrawer(true)}>
          Action Center ({data.actions.length})
        </button>
      </header>

      <form className="cp-filters" onSubmit={submitFilters}>
        <label>
          <span>Từ ngày</span>
          <input
            type="date"
            value={draft.from}
            onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
          />
        </label>
        <label>
          <span>Đến ngày</span>
          <input
            type="date"
            value={draft.to}
            onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
          />
        </label>
        <label>
          <span>Khách</span>
          <input
            value={draft.client}
            placeholder="Tất cả"
            onChange={(event) => setDraft((current) => ({ ...current, client: event.target.value }))}
          />
        </label>
        <label>
          <span>Lifecycle</span>
          <input
            value={draft.lifecycle}
            placeholder="Tất cả"
            onChange={(event) => setDraft((current) => ({ ...current, lifecycle: event.target.value }))}
          />
        </label>
        <label>
          <span>Owner</span>
          <input
            value={draft.owner}
            placeholder="Tất cả"
            onChange={(event) => setDraft((current) => ({ ...current, owner: event.target.value }))}
          />
        </label>
        <label>
          <span>Phạm vi</span>
          <select
            value={draft.scope}
            onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value }))}
          >
            <option value="me">Của tôi</option>
            <option value="team">Team</option>
            <option value="all">Toàn bộ</option>
          </select>
        </label>
        <button type="submit" className="cp-btn cp-btn--primary">
          Áp dụng
        </button>
      </form>

      {error ? (
        <section className="cp-card cp-card--error">
          <p>{error}</p>
          <button type="button" className="cp-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : null}

      <section className={`cp-alert${criticalActions.length ? ' cp-alert--active' : ''}`}>
        <span>
          {criticalActions.length
            ? `${criticalActions.length} cảnh báo critical cần xử lý.`
            : 'Không có cảnh báo critical.'}
        </span>
        <button type="button" className="cp-btn" onClick={() => setActionDrawer(true)}>
          Mở Action Center
        </button>
      </section>

      <div className="cp-kpi-grid" aria-busy={loading}>
        {KPI_TILES.map((tile) => (
          <Link
            key={tile.key}
            href={scopedHref(tile.href, currentSearch)}
            className="cp-kpi-tile"
          >
            <span>{tile.label}</span>
            <strong>{formatKpi(tile.key, data.kpis[tile.key])}</strong>
          </Link>
        ))}
      </div>

      <div className="cp-overview-grid cp-overview-grid--hero">
        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Xu hướng hiệu suất</h2>
            <span className="cp-muted">created / approved / published</span>
          </header>
          {showTrend ? (
            <div className="cp-trend" aria-label="Xu hướng hiệu suất">
              {data.trend.map((point, index) => (
                <div className="cp-trend__group" key={index}>
                  <i style={{ height: `${Math.max(2, point.created ?? 0)}%` }} />
                  <i style={{ height: `${Math.max(2, point.approved ?? 0)}%` }} />
                  <i style={{ height: `${Math.max(2, point.published ?? 0)}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <p className="cp-empty">—</p>
          )}
        </section>

        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Sức khỏe sản xuất</h2>
            <Link className="cp-link" href="/crm/creative-os/ops">
              Monitor
            </Link>
          </header>
          <dl className="cp-health">
            <div>
              <dt>Model allowlist</dt>
              <dd>{dash(provider?.id)}</dd>
            </div>
            <div>
              <dt>Ingest / queue</dt>
              <dd>{dash(data.health?.queue_depth)}</dd>
            </div>
            <div>
              <dt>Provider adapter</dt>
              <dd>
                {provider?.success_pct == null
                  ? dash(null)
                  : `${provider.success_pct.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`}
                {' · p95 '}
                {provider?.p95_sec == null ? dash(null) : `${Math.round(provider.p95_sec)}s`}
              </dd>
            </div>
            <div>
              <dt>Concurrent slots</dt>
              <dd>
                {dash(data.health?.slots.used)} / {dash(data.health?.slots.max)}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="cp-overview-grid">
        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Project đang chạy</h2>
            <Link className="cp-link" href={scopedHref('/crm/creative-os/projects', currentSearch)}>
              Portfolio
            </Link>
          </header>
          <div className="cp-table-wrap">
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Khách</th>
                  <th>Trạng thái</th>
                  <th>Hạn</th>
                  <th>Credit budget</th>
                </tr>
              </thead>
              <tbody>
                {data.projects.length ? (
                  data.projects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <Link className="cp-link" href={`/crm/creative-os/projects/${project.id}`}>
                          {project.name}
                        </Link>
                      </td>
                      <td>{dash(project.agency_client_id)}</td>
                      <td>
                        <span className="cp-pill">{dash(project.status)}</span>
                      </td>
                      <td>{formatDate(project.due_at)}</td>
                      <td>{dash(project.credit_budget)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="cp-empty">
                      —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cp-card">
          <header className="cp-card__head">
            <h2>Cột mốc 7 ngày</h2>
          </header>
          {data.milestones.length ? (
            <ol className="cp-timeline">
              {data.milestones.map((milestone) => (
                <li key={milestone.id}>
                  <time>{formatDate(milestone.due_at)}</time>
                  <Link className="cp-link" href={`/crm/creative-os/projects/${milestone.project_id}?tab=timeline`}>
                    {milestone.title}
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="cp-empty">—</p>
          )}
        </section>
      </div>

      <section className="cp-card">
        <header className="cp-card__head">
          <h2>Hoạt động gần đây</h2>
          <Link className="cp-link" href={scopedHref('/crm/creative-os/activity', currentSearch)}>
            Tất cả
          </Link>
        </header>
        {data.activity.length ? (
          <ul className="cp-activity">
            {data.activity.map((item) => (
              <li key={item.id}>
                <time>{formatDateTime(item.created_at)}</time>
                <span>{item.actor_id == null ? 'System' : `#${item.actor_id}`}</span>
                <b>{item.action}</b>
                <span>
                  {item.resource_type} {dash(item.resource_id)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="cp-empty">—</p>
        )}
      </section>

      {actionDrawerOpen ? (
        <div className="cp-drawer-layer">
          <button
            type="button"
            className="cp-drawer-backdrop"
            aria-label="Đóng Action Center"
            onClick={() => setActionDrawer(false)}
          />
          <aside className="cp-action-drawer" role="dialog" aria-modal="true" aria-labelledby="cp-actions-title">
            <header className="cp-action-drawer__head">
              <div>
                <p className="cp-crumb">OVR-02</p>
                <h2 id="cp-actions-title">Action Center</h2>
              </div>
              <button type="button" className="cp-btn" onClick={() => setActionDrawer(false)}>
                Đóng
              </button>
            </header>
            {data.actions.length ? (
              <ul className="cp-action-list">
                {data.actions.map((action, index) => (
                  <li key={`${action.kind}-${action.resource_id ?? index}`}>
                    <div className="cp-action-list__title">
                      <span className={severityClass(action.severity)}>{action.severity}</span>
                      <b>{action.title}</b>
                    </div>
                    <p className="cp-muted">
                      {action.resource_type} {dash(action.resource_id)} · Owner{' '}
                      {dash(action.owner_staff_id)} · SLA {formatDateTime(action.sla_at)}
                    </p>
                    <Link className="cp-btn cp-btn--primary" href={normalizeCpHref(action.href)}>
                      Xử lý
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="cp-empty">—</p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchRevopsCommandCenter,
  type RevopsCommandCenterDto,
} from '@/lib/crm/revops-api';
import {
  attainmentTag,
  formatRevopsDeltaPct,
  formatRevopsPct,
  formatRevopsVndCompact,
  revopsTagClass,
} from '@/lib/crm/revops-format';
import { RevOpsQuickCreateButton, useRevopsModals } from './RevOpsModalsProvider';
import { useRevopsPage } from './RevOpsShell';

const BU_OPTIONS = [
  { value: 'all', label: 'Tất cả Business Unit' },
  { value: 'hn', label: 'Hà Nội' },
  { value: 'hcm', label: 'Hồ Chí Minh' },
  { value: 'dn', label: 'Đà Nẵng' },
];

function currentPeriodValue(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-');
  if (!y || !m) return period;
  return `Tháng ${m}/${y}`;
}

function funnelHeight(count: number, max: number): number {
  if (max <= 0 || count <= 0) return 8;
  return Math.max(12, Math.round((count / max) * 140));
}

function barHeight(value: number | null, max: number): number {
  if (value == null || max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}

function teamViewHref(row: { teamLabel: string; staffId: number }): string {
  if (row.teamLabel.toLowerCase().includes('account')) {
    return '/crm/account-management/clients?revops=1';
  }
  return '/crm/kpi-hub/sales?revops=1';
}

function riskSeverityClass(severity: 'warning' | 'danger'): string {
  return severity === 'danger' ? 'revops-tag revops-tag--red' : 'revops-tag revops-tag--orange';
}

export function RevOpsCommandCenter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token } = useRevopsPage();
  const { openAssign } = useRevopsModals();

  const period = searchParams.get('period') ?? currentPeriodValue();
  const bu = searchParams.get('bu') ?? 'all';

  const [data, setData] = useState<RevopsCommandCenterDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const out = await fetchRevopsCommandCenter(token, {
        period,
        bu: bu === 'all' ? undefined : bu,
      });
      setData(out);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Không tải được Command Center');
    } finally {
      setLoading(false);
    }
  }, [bu, period, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function setFilters(next: { period?: string; bu?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.period) params.set('period', next.period);
    if (next.bu) params.set('bu', next.bu);
    router.replace(`/crm/revenue-ops?${params.toString()}`);
  }

  const funnelStages = useMemo(() => {
    const stages = data?.funnel ?? [];
    if (stages.length >= 5) return stages.slice(0, 5);
    const padded = [...stages];
    const defaults = ['Lead', 'Discovery', 'Qualified', 'Proposal', 'Won'];
    while (padded.length < 5) {
      padded.push({ stage: defaults[padded.length] ?? `Stage ${padded.length + 1}`, count: 0 });
    }
    return padded;
  }, [data?.funnel]);

  const funnelMax = useMemo(
    () => Math.max(1, ...funnelStages.map((s) => s.count)),
    [funnelStages],
  );

  const teamBars = data?.teamRevenue ?? [];
  const barMax = useMemo(() => {
    let max = 0;
    for (const row of teamBars) {
      if (row.actualVnd != null) max = Math.max(max, row.actualVnd);
      if (row.targetVnd != null) max = Math.max(max, row.targetVnd);
    }
    return max || 1;
  }, [teamBars]);

  const revenueTag = attainmentTag(data?.revenue.attainmentPct ?? null);

  return (
    <>
      <header className="revops-page-head">
        <div>
          <h1>Sales & Account Command Center</h1>
          <p>Toàn cảnh doanh thu, pipeline, hiệu suất đội ngũ và khách hàng có rủi ro.</p>
        </div>
        <div className="revops-page-actions">
          <label className="revops-filter">
            <span className="sr-only">Kỳ</span>
            <input
              type="month"
              className="revops-btn revops-btn--filter"
              value={period}
              onChange={(ev) => setFilters({ period: ev.target.value })}
              aria-label="Kỳ"
            />
          </label>
          <select
            className="revops-btn revops-btn--filter"
            value={bu}
            onChange={(ev) => setFilters({ bu: ev.target.value })}
            aria-label="Business Unit"
          >
            {BU_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <RevOpsQuickCreateButton />
        </div>
      </header>

      {loading && !data ? <p className="revops-muted">Đang tải Command Center…</p> : null}
      {error ? (
        <div className="revops-widget revops-widget--error">
          <p>{error}</p>
          <button type="button" className="revops-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="revops-kpi-grid">
            <article className="revops-metric-card">
              <p className="revops-metric-label">Doanh thu thực đạt</p>
              <p className="revops-metric-value">{formatRevopsVndCompact(data.revenue.actualVnd)}</p>
              <div className={`revops-progress${revenueTag === 'At risk' ? ' revops-progress--orange' : ''}`}>
                <span style={{ width: `${Math.min(100, data.revenue.attainmentPct ?? 0)}%` }} />
              </div>
              <small className="revops-metric-hint">
                {formatRevopsVndCompact(data.revenue.actualVnd)} /{' '}
                {formatRevopsVndCompact(data.revenue.targetVnd)} target
                {formatRevopsDeltaPct(data.revenue.deltaPct)
                  ? ` · ${formatRevopsDeltaPct(data.revenue.deltaPct)}`
                  : ''}
              </small>
              <span className={revopsTagClass(revenueTag)}>{revenueTag}</span>
            </article>

            <article className="revops-metric-card">
              <p className="revops-metric-label">Pipeline có trọng số</p>
              <p className="revops-metric-value">{formatRevopsVndCompact(data.pipeline.weightedVnd)}</p>
              <small className="revops-metric-hint">
                Coverage {data.pipeline.coverageX != null ? `${data.pipeline.coverageX}x` : '—'} ·{' '}
                {data.pipeline.activeDeals} deals active
              </small>
              <Link className="revops-link" href="/crm/revenue-ops/pipeline">
                Xem pipeline →
              </Link>
            </article>

            <article className="revops-metric-card">
              <p className="revops-metric-label">Lead SLA compliance</p>
              <p className="revops-metric-value">{formatRevopsPct(data.leadSla.compliancePct)}</p>
              <small className="revops-metric-hint">
                {data.leadSla.atRisk} at risk · {data.leadSla.breaches} breach
              </small>
              <Link className="revops-link" href="/crm/revenue-ops/sla">
                SLA center →
              </Link>
            </article>

            <article className="revops-metric-card">
              <p className="revops-metric-label">Hoa hồng tạm tính</p>
              <p className="revops-metric-value">{formatRevopsVndCompact(data.commission.estimatedVnd)}</p>
              <small className="revops-metric-hint">
                {formatRevopsVndCompact(data.commission.approvedVnd)} approved ·{' '}
                {formatRevopsVndCompact(data.commission.pendingVnd)} pending
              </small>
              {data.commission.estimatedVnd == null ? (
                <span className="revops-tag revops-tag--gray">Wave 3</span>
              ) : null}
            </article>
          </div>

          <div className="revops-grid-2 revops-section">
            <section className="revops-card revops-card--panel">
              <header className="revops-card__head">
                <h3>Pipeline theo giai đoạn</h3>
                <span className="revops-tag revops-tag--blue">
                  {data.pipeline.activeDeals} deals active
                </span>
              </header>
              <div className="revops-funnel">
                {funnelStages.map((stage, idx) => (
                  <div key={`${stage.stage}-${idx}`} className="revops-funnel-col">
                    <div
                      className={`revops-funnel-bar${idx === funnelStages.length - 1 ? ' revops-funnel-bar--won' : ''}`}
                      style={{ height: `${funnelHeight(stage.count, funnelMax)}px` }}
                    />
                    <b>{stage.count}</b>
                    <span>{stage.stage}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="revops-card revops-card--panel">
              <header className="revops-card__head">
                <h3>Doanh thu theo team</h3>
                <span className="revops-tag revops-tag--green">Actual vs Target</span>
              </header>
              {teamBars.length === 0 ? (
                <p className="revops-muted">—</p>
              ) : (
                <>
                  <div className="revops-chart-bars">
                    {teamBars.map((row) => (
                      <div key={row.teamId} className="revops-bar-group">
                        <div className="revops-bar-stack">
                          <div
                            className="revops-bar revops-bar--actual"
                            style={{ height: `${barHeight(row.actualVnd, barMax)}%` }}
                          />
                          <div
                            className="revops-bar revops-bar--target"
                            style={{ height: `${barHeight(row.targetVnd, barMax)}%` }}
                          />
                        </div>
                        <label>{row.label}</label>
                      </div>
                    ))}
                  </div>
                  <div className="revops-chart-legend">
                    <span>■ Actual</span>
                    <span className="revops-chart-legend__target">■ Target</span>
                  </div>
                </>
              )}
            </section>
          </div>

          <section className="revops-card revops-section">
            <header className="revops-card__head">
              <h3>Hiệu suất Team Account – Sales</h3>
              <div className="revops-page-actions">
                <Link className="revops-btn" href="/crm/kpi-hub/sales?revops=1">
                  Xem KPI & hoa hồng
                </Link>
                <button type="button" className="revops-btn revops-btn--primary" onClick={() => openAssign()}>
                  ＋ Phân bổ lead
                </button>
              </div>
            </header>
            <div className="revops-table-wrap">
              <table className="revops-table">
                <thead>
                  <tr>
                    <th>Nhân sự</th>
                    <th>Vai trò</th>
                    <th>Target</th>
                    <th>Actual</th>
                    <th>Attainment</th>
                    <th>Pipeline</th>
                    <th>Lead active</th>
                    <th>SLA</th>
                    <th>Trạng thái</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.teamPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="revops-muted">
                        —
                      </td>
                    </tr>
                  ) : (
                    data.teamPerformance.map((row) => (
                      <tr key={row.staffId}>
                        <td>
                          <div className="revops-person">
                            <div className="revops-avatar revops-avatar--sm" aria-hidden>
                              {row.name
                                .split(/\s+/)
                                .filter(Boolean)
                                .slice(0, 2)
                                .map((p) => p[0])
                                .join('')
                                .toUpperCase()}
                            </div>
                            <div>
                              <div className="revops-person__name">{row.name}</div>
                              <div className="revops-sub">
                                {row.teamLabel || '—'} · {row.leadActive} leads
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{row.role || '—'}</td>
                        <td>{formatRevopsVndCompact(row.targetVnd)}</td>
                        <td>{formatRevopsVndCompact(row.actualVnd)}</td>
                        <td>
                          <b>{formatRevopsPct(row.attainmentPct)}</b>
                          <div className="revops-progress revops-progress--inline">
                            <span style={{ width: `${Math.min(100, row.attainmentPct ?? 0)}%` }} />
                          </div>
                        </td>
                        <td>{formatRevopsVndCompact(row.pipelineVnd)}</td>
                        <td>{row.leadActive}</td>
                        <td>{formatRevopsPct(row.slaPct)}</td>
                        <td>
                          <span className={revopsTagClass(row.status)}>{row.status}</span>
                        </td>
                        <td>
                          <Link className="revops-btn revops-btn--sm" href={teamViewHref(row)}>
                            Xem
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="revops-grid-2 revops-section">
            <section className="revops-card revops-card--panel">
              <header className="revops-card__head">
                <h3>Việc cần xử lý hôm nay</h3>
                <span className="revops-tag revops-tag--blue">{data.todayQueue.length} việc</span>
              </header>
              <div className="revops-list">
                {data.todayQueue.length === 0 ? (
                  <p className="revops-muted">—</p>
                ) : (
                  data.todayQueue.map((item) => (
                    <div key={item.id} className="revops-list-row">
                      <div>
                        <b>{item.title}</b>
                        {item.dueAt ? <p className="revops-sub">Due: {item.dueAt.slice(0, 10)}</p> : null}
                      </div>
                      {item.href ? (
                        <Link className="revops-btn revops-btn--sm" href={item.href}>
                          Xem
                        </Link>
                      ) : (
                        <span className="revops-tag revops-tag--gray">{item.kind}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="revops-card revops-card--panel">
              <header className="revops-card__head">
                <h3>Khách hàng / deal có rủi ro</h3>
                <span className="revops-tag revops-tag--orange">{data.atRisk.length} at-risk</span>
              </header>
              <div className="revops-list">
                {data.atRisk.length === 0 ? (
                  <p className="revops-muted">—</p>
                ) : (
                  data.atRisk.map((item) => (
                    <div key={item.id} className="revops-list-row">
                      <div>
                        <b>{item.title}</b>
                        <p className="revops-sub">{item.kind.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="revops-list-row__actions">
                        <span className={riskSeverityClass(item.severity)}>{item.severity}</span>
                        {item.href ? (
                          <Link className="revops-btn revops-btn--sm" href={item.href}>
                            Xem
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          <p className="revops-muted revops-freshness">
            Dữ liệu lúc {new Date(data.fetchedAt).toLocaleString('vi-VN')} · {periodLabel(period)}
          </p>
        </>
      ) : null}
    </>
  );
}

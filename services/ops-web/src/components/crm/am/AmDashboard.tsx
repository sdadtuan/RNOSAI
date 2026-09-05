'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { isAmDashboardLoading, shouldShowEmptyWidget } from '@/lib/crm/am-dashboard.util';
import { acceptAmTask } from '@/lib/crm/am-api';
import { bandCopy, dash, vnd } from '@/lib/crm/am-format';
import type { AmHealthBand } from '@/lib/crm/am-format';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

const KPI_TILES = [
  {
    key: 'active',
    label: 'Khách hàng active',
    href: '/crm/account-management/clients',
  },
  {
    key: 'mrr',
    label: 'MRR hiện tại',
    href: '/crm/account-management/clients?sort=mrr',
  },
  {
    key: 'renewal',
    label: 'Gia hạn 90 ngày',
    href: '/crm/account-management/renewals?window=90',
  },
  {
    key: 'risk',
    label: 'Revenue at risk',
    href: '/crm/account-management/health?band=at_risk,critical',
  },
  {
    key: 'sla',
    label: 'SLA quá hạn',
    href: '/crm/account-management/work?sla=breached',
  },
  {
    key: 'csat',
    label: 'CSAT',
    href: '/crm/account-management/feedback',
  },
] as const;

const CHIP_COPY: Record<'overdue' | 'today' | 'soon' | 'unassigned', string> = {
  overdue: 'Quá hạn',
  today: 'Hôm nay',
  soon: 'Sắp hạn',
  unassigned: 'Chưa nhận',
};

function Widget({
  title,
  minClass,
  error,
  onRetry,
  extra,
  children,
}: {
  title: string;
  minClass?: string;
  error: string;
  onRetry: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`am-widget ${minClass ?? ''}`.trim()}>
      <div className="am-widget__head">
        <h2>{title}</h2>
        {extra}
      </div>
      {error ? (
        <div className="am-widget__error">
          <p>Không tải được khối này.</p>
          <button type="button" className="am-btn" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function bandClass(band: AmHealthBand | null | undefined): string {
  if (band === 'healthy') return 'am-pill am-pill--ok';
  if (band === 'watch') return 'am-pill am-pill--watch';
  if (band === 'at_risk') return 'am-pill am-pill--risk';
  if (band === 'critical') return 'am-pill am-pill--crit';
  return 'am-pill';
}

function kpiValue(key: (typeof KPI_TILES)[number]['key'], data: ReturnType<typeof useAmPage>['data']): string {
  if (!data) return '—';
  const k = data.kpis;
  if (key === 'active') return dash(k.active_accounts);
  if (key === 'mrr') return vnd(k.mrr_vnd);
  if (key === 'renewal') return vnd(k.renewal_90d_vnd);
  if (key === 'risk') return vnd(k.revenue_at_risk_vnd);
  if (key === 'sla') return dash(k.sla_overdue);
  return dash(k.csat);
}

function kpiHint(key: (typeof KPI_TILES)[number]['key'], data: ReturnType<typeof useAmPage>['data']): string | null {
  if (!data) return null;
  if (key === 'renewal' && data.kpis.renewal_90d_count != null) {
    return `${data.kpis.renewal_90d_count} case`;
  }
  if (key === 'risk' && data.kpis.revenue_at_risk_count != null) {
    return `${data.kpis.revenue_at_risk_count} account`;
  }
  const delta = data.kpis.deltas?.[key];
  if (delta == null) return null;
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta}`;
}

function withScope(href: string, scope: string): string {
  const [path, qs] = href.split('?');
  const params = new URLSearchParams(qs ?? '');
  params.set('scope', scope);
  return `${path}?${params.toString()}`;
}

function stackParts(values: Array<number | null | undefined>): number[] {
  const nums = values.map((n) => (n == null || n < 0 ? 0 : n));
  const total = nums.reduce((a, b) => a + b, 0);
  if (total <= 0) return nums.map(() => 0);
  return nums.map((n) => (n / total) * 100);
}

function WidgetLoading() {
  return <p className="am-muted">Đang tải…</p>;
}

export function AmDashboard() {
  const { data, error, loading, retry, canEdit, scope, token, openCreate } = useAmPage();
  const { push } = useToast();
  const [attentionSort, setAttentionSort] = useState<'health' | 'mrr' | 'renewal'>('health');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const isLoading = isAmDashboardLoading(loading, data);

  async function onAccept(id: string) {
    if (!canEdit || acceptingId) return;
    setAcceptingId(id);
    try {
      await acceptAmTask(token, id);
      push('Đã nhận việc', 'success');
      retry();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Không nhận được việc', 'error');
    } finally {
      setAcceptingId(null);
    }
  }

  const coverage = data?.coverage ?? null;
  const today = data?.today_work ?? [];
  const attention = [...(data?.attention ?? [])].sort((a, b) => {
    if (attentionSort === 'mrr') return (b.mrr_vnd ?? -1) - (a.mrr_vnd ?? -1);
    if (attentionSort === 'renewal') return (a.days_to_end ?? 9999) - (b.days_to_end ?? 9999);
    const rank: Record<AmHealthBand, number> = { critical: 0, at_risk: 1, watch: 2, healthy: 3 };
    return rank[a.band] - rank[b.band];
  });
  const book = data?.my_book ?? [];
  const forecast = data?.forecast;
  const health = data?.health_dist;
  const fcPct = stackParts([
    forecast?.committed_vnd,
    forecast?.likely_vnd,
    forecast?.risk_vnd,
    forecast?.unlikely_vnd,
  ]);
  const hPct = stackParts([health?.healthy, health?.watch, health?.at_risk, health?.critical]);

  const subtitleBits = [
    data?.period ? `${data.period.from} → ${data.period.to}` : null,
    scope === 'me' ? 'Phạm vi Của tôi' : scope === 'team' ? 'Phạm vi Team' : 'Phạm vi Toàn bộ',
    data ? `tải ${dash(data.load.accounts)}/${dash(data.load.quota)}` : null,
    data?.freshness.work_left_label,
  ].filter(Boolean);

  return (
    <div className="am-dash">
      <div className="am-dash__head">
        <div>
          <p className="am-crumb">Tổng quan / Account Management</p>
          <h1>Bàn làm việc hôm nay</h1>
          <p className="am-sub">{subtitleBits.join(' · ') || '—'}</p>
          {data?.freshness.stale ? <p className="am-banner">Dữ liệu đang cũ — kiểm tra đồng bộ.</p> : null}
        </div>
      </div>

      <div className="am-tiles">
        {KPI_TILES.map((tile) => (
          <Link key={tile.key} href={withScope(tile.href, scope)} className="am-tile">
            <span>{tile.label}</span>
            <strong>{error ? '—' : kpiValue(tile.key, data)}</strong>
            <em>{error ? '' : kpiHint(tile.key, data) ?? ''}</em>
          </Link>
        ))}
      </div>

      {coverage ? (
        <section className="am-widget">
          <div className="am-widget__head">
            <h2>Điều hành danh mục</h2>
          </div>
          <div className="am-cov">
            <div>
              <span className="am-muted">Tải trung bình</span>
              <strong>{dash(coverage.avg_load)}</strong>
            </div>
            <div>
              <span className="am-muted">Chưa gán</span>
              <strong>{dash(coverage.unassigned)}</strong>
            </div>
            <div>
              <span className="am-muted">Ủy quyền</span>
              <strong>{dash(coverage.delegated)}</strong>
            </div>
            <div>
              <span className="am-muted">QBR tuần này</span>
              <strong>{dash(coverage.qbr_this_week)}</strong>
            </div>
          </div>
        </section>
      ) : null}

      <div className="am-split">
        <Widget title="Hàng đợi 2 giờ tới" error={error} onRetry={retry} extra={
          <Link className="am-link" href={withScope('/crm/account-management/work', scope)}>
            Inbox đầy đủ →
          </Link>
        }>
          {isLoading ? (
            <WidgetLoading />
          ) : shouldShowEmptyWidget(loading, error, today) ? (
            <p className="am-empty">Bạn đã xử lý xong các việc ưu tiên hôm nay.</p>
          ) : (
            <ul className="am-work">
              {today.map((item) => (
                <li key={item.id} className="am-work__row">
                  <span className={`am-chip am-chip--${item.chip}`}>{CHIP_COPY[item.chip]}</span>
                  <div>
                    <b>{item.title}</b>
                    <div className="am-muted">
                      {item.account_name}
                      {item.sla_label ? ` · ${item.sla_label}` : ''}
                    </div>
                  </div>
                  {item.can_accept && canEdit ? (
                    <button
                      type="button"
                      className="am-btn"
                      disabled={acceptingId === item.id}
                      onClick={() => void onAccept(item.id)}
                    >
                      {acceptingId === item.id ? 'Đang nhận…' : 'Nhận xử lý'}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget
          title="Account cần chú ý"
          error={error}
          onRetry={retry}
          extra={
            <div className="am-chips">
              <button
                type="button"
                className={`am-chip${attentionSort === 'health' ? ' is-on' : ''}`}
                onClick={() => setAttentionSort('health')}
              >
                Health
              </button>
              <button
                type="button"
                className={`am-chip${attentionSort === 'mrr' ? ' is-on' : ''}`}
                onClick={() => setAttentionSort('mrr')}
              >
                Doanh thu
              </button>
              <button
                type="button"
                className={`am-chip${attentionSort === 'renewal' ? ' is-on' : ''}`}
                onClick={() => setAttentionSort('renewal')}
              >
                Gia hạn
              </button>
            </div>
          }
        >
          {isLoading ? (
            <WidgetLoading />
          ) : shouldShowEmptyWidget(loading, error, attention) ? (
            <p className="am-empty">Không có account cần chú ý.</p>
          ) : (
            <table className="am-table">
              <tbody>
                {attention.map((row) => (
                  <tr key={row.agency_client_id}>
                    <td>{row.name}</td>
                    <td>
                      <span className={bandClass(row.band)}>
                        {dash(row.score)} {bandCopy(row.band)}
                      </span>
                    </td>
                    <td>{vnd(row.mrr_vnd)}</td>
                    <td>{row.days_to_end == null ? '—' : `${row.days_to_end} ngày`}</td>
                    <td>
                      <Link className="am-link" href={`/crm/account-management/clients/${row.agency_client_id}`}>
                        Mở
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Link className="am-link" href={withScope('/crm/account-management/health', scope)}>
            Xem Risk Center →
          </Link>
        </Widget>
      </div>

      <div className="am-split">
        <Widget title="Renewal forecast" error={error} onRetry={retry}>
          {forecast && fcPct.some((n) => n > 0) ? (
            <>
              <div className="am-stack" aria-hidden>
                <i style={{ width: `${fcPct[0]}%`, background: '#16A34A' }} />
                <i style={{ width: `${fcPct[1]}%`, background: '#2563EB' }} />
                <i style={{ width: `${fcPct[2]}%`, background: '#D97706' }} />
                <i style={{ width: `${fcPct[3]}%`, background: '#DC2626' }} />
              </div>
              <p className="am-legend">
                <span>Committed {vnd(forecast.committed_vnd)}</span>
                <span>Likely {vnd(forecast.likely_vnd)}</span>
                <span>Risk {vnd(forecast.risk_vnd)}</span>
                <span>Unlikely {vnd(forecast.unlikely_vnd)}</span>
              </p>
            </>
          ) : (
            <p className="am-empty">—</p>
          )}
        </Widget>

        <Widget title="Phân bố Health" error={error} onRetry={retry}>
          {health ? (
            <>
              <p className="am-muted">TB {dash(health.avg)}</p>
              <div className="am-stack" aria-hidden>
                <i style={{ width: `${hPct[0]}%`, background: '#16A34A' }} />
                <i style={{ width: `${hPct[1]}%`, background: '#D97706' }} />
                <i style={{ width: `${hPct[2]}%`, background: '#EA580C' }} />
                <i style={{ width: `${hPct[3]}%`, background: '#DC2626' }} />
              </div>
              <p className="am-legend">
                <span className="am-pill am-pill--ok">Khỏe mạnh {health.healthy}</span>
                <span className="am-pill am-pill--watch">Cần theo dõi {health.watch}</span>
                <span className="am-pill am-pill--risk">Có rủi ro {health.at_risk}</span>
                <span className="am-pill am-pill--crit">Nghiêm trọng {health.critical}</span>
              </p>
            </>
          ) : (
            <p className="am-empty">—</p>
          )}
        </Widget>
      </div>

      <Widget title="Sổ khách đang giữ" error={error} onRetry={retry}>
        {isLoading ? (
          <WidgetLoading />
        ) : shouldShowEmptyWidget(loading, error, book) ? (
          <div className="am-empty-book">
            <p className="am-empty">Chưa có khách trong sổ.</p>
            {canEdit ? (
              <button
                type="button"
                className="am-btn am-btn--primary"
                onClick={() => openCreate('client')}
              >
                Tạo khách
              </button>
            ) : null}
          </div>
        ) : (
          <div className="am-tbl-wrap">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Khách hàng</th>
                  <th>Owner</th>
                  <th>Gói</th>
                  <th>Health</th>
                  <th>MRR</th>
                  <th>Gia hạn</th>
                  <th>Việc tiếp theo</th>
                </tr>
              </thead>
              <tbody>
                {book.map((row) => (
                  <tr key={row.agency_client_id}>
                    <td>
                      <Link href={`/crm/account-management/clients/${row.agency_client_id}`}>
                        {row.name}
                      </Link>
                      {row.is_parent && row.child_count > 0 ? (
                        <div className="am-muted">Parent · {row.child_count} đơn vị con</div>
                      ) : null}
                    </td>
                    <td>{row.owner_label || '—'}</td>
                    <td>{row.package_label || '—'}</td>
                    <td>
                      <span className={bandClass(row.band)}>
                        {dash(row.score)} {bandCopy(row.band)}
                      </span>
                    </td>
                    <td>{vnd(row.mrr_vnd)}</td>
                    <td>{row.ends_on || '—'}</td>
                    <td>{row.next_action || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Widget>
    </div>
  );
}

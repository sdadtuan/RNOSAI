'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  QT_WIN_RATE_FORMULA,
  getQtActions,
  getQtOverview,
  type QtActionRow,
  type QtByStatusRow,
  type QtOverviewHealth,
  type QtOverviewKpis,
  type QtOverviewQuery,
} from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';

export type { QtOverviewKpis };

export const QT_KPI_TILES = [
  {
    key: 'open_quote_value' as const,
    label: 'Giá trị quote đang mở',
    href: '/crm/proposals/list?open=1',
    hint: 'draft…negotiation · không gồm accepted',
  },
  {
    key: 'pending_approval_count' as const,
    label: 'Chờ phê duyệt',
    href: '/crm/proposals/approvals',
    hint: 'version submitted',
  },
  {
    key: 'quote_win_rate' as const,
    label: 'Tỷ lệ chốt',
    href: '/crm/proposals/reports',
    hint: QT_WIN_RATE_FORMULA,
  },
  {
    key: 'forecast_gross_margin' as const,
    label: 'GM dự kiến',
    href: '/crm/proposals/reports',
    hint: 'ẩn nếu thiếu crm_quote.finance',
  },
];

const EMPTY_KPIS: QtOverviewKpis = {
  open_quote_value: null,
  pending_approval_count: null,
  quote_win_rate: null,
  forecast_gross_margin: null,
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Nháp',
  in_review: 'Đang xem',
  pending_approval: 'Chờ phê duyệt',
  returned: 'Trả về',
  approved: 'Đã duyệt',
  sent: 'Đã gửi',
  viewed: 'Đã xem',
  negotiation: 'Thương lượng',
  accepted: 'Đã xác nhận',
  rejected: 'Từ chối',
  expired: 'Hết hạn',
  cancelled: 'Đã hủy',
  superseded: 'Thay thế',
  archived: 'Lưu trữ',
};

const HEALTH_ROWS: Array<{ key: keyof QtOverviewHealth; label: string }> = [
  { key: 'below_floor', label: 'Dưới GM floor' },
  { key: 'discount_over_cap', label: 'Discount vượt cap' },
  { key: 'cost_missing', label: 'Thiếu cost estimate' },
  { key: 'viewed_no_reply', label: 'Khách đã xem chưa phản hồi' },
];

function asScope(value: string | null): 'me' | 'team' | 'all' {
  if (value === 'team' || value === 'all') return value;
  return 'me';
}

export const QT_TZ = 'Asia/Ho_Chi_Minh';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function ictParts(now = new Date()): { year: number; month: number; day: number } {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: QT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
}

function shiftYmd(year: number, month: number, day: number, days: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return ymd(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

export function periodRange(preset: string, now = new Date()): { from: string; to: string } {
  const { year, month, day } = ictParts(now);
  const to = ymd(year, month, day);
  if (preset === '7d') return { from: shiftYmd(year, month, day, -6), to };
  if (preset === '30d') return { from: shiftYmd(year, month, day, -29), to };
  if (preset === 'quarter') {
    const startMonth = Math.floor((month - 1) / 3) * 3 + 1;
    return { from: ymd(year, startMonth, 1), to };
  }
  return { from: ymd(year, month, 1), to };
}

export function detectPeriod(from: string, to: string, now = new Date()): string {
  if (!from || !to) return '';
  for (const preset of ['7d', '30d', 'month', 'quarter'] as const) {
    const range = periodRange(preset, now);
    if (from === range.from && to === range.to) return preset;
  }
  return '';
}

export function withDefaultOverviewPeriod(
  search: URLSearchParams,
  now = new Date(),
): URLSearchParams {
  const next = new URLSearchParams(search);
  if (next.get('from') && next.get('to')) return next;
  const range = periodRange('month', now);
  next.set('from', range.from);
  next.set('to', range.to);
  return next;
}

export function formatQtKpi(key: keyof QtOverviewKpis, value: number | null): string {
  if (value == null) return dash(null);
  if (key === 'open_quote_value') {
    return `${value.toLocaleString('vi-VN')} ₫`;
  }
  if (key === 'quote_win_rate' || key === 'forecast_gross_margin') {
    const percent = value <= 1 ? value * 100 : value;
    return `${percent.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;
  }
  return String(value);
}

function formatMoney(value: number | null): string {
  if (value == null) return dash(null);
  return `${value.toLocaleString('vi-VN')} ₫`;
}

function severityClass(severity: string): string {
  if (severity === 'critical' || severity === 'danger') return 'qt-pill qt-pill--bad';
  if (severity === 'high' || severity === 'warning') return 'qt-pill qt-pill--warn';
  if (severity === 'medium' || severity === 'info') return 'qt-pill qt-pill--info';
  return 'qt-pill';
}

function actionCta(action: QtActionRow): string {
  if (action.impact === 'pending_approval') return 'Duyệt';
  if (action.impact.startsWith('valid_until')) return 'Mở builder';
  if (action.impact === 'viewed_no_reply') return 'Follow-up';
  return 'Mở';
}

export function QtKpiTiles({
  kpis,
  winRateFormula,
}: {
  kpis: QtOverviewKpis;
  winRateFormula: string;
}) {
  return (
    <div className="qt-tiles">
      {QT_KPI_TILES.map((tile) => (
        <a key={tile.key} href={tile.href} className="qt-tile" data-kpi={tile.key}>
          <span>{tile.label}</span>
          <strong>{formatQtKpi(tile.key, kpis[tile.key])}</strong>
          {tile.key === 'quote_win_rate' ? (
            <em className="qt-tile__formula">{winRateFormula}</em>
          ) : (
            <em>{tile.hint}</em>
          )}
        </a>
      ))}
    </div>
  );
}

export function QtAlertBar({
  actions,
  href = '/crm/proposals?panel=actions',
}: {
  actions: QtActionRow[];
  href?: string;
}) {
  if (actions.length === 0) return null;
  const critical = actions.filter(
    (action) => action.severity === 'critical' || action.severity === 'danger',
  );
  const summary = critical.length
    ? `${critical.length} việc critical · ${actions.length} việc cần xử lý.`
    : `${actions.length} việc cần xử lý.`;
  return (
    <div className="qt-alert">
      <span>{summary}</span>
      <Link className="qt-btn" href={href}>
        Mở Action Center
      </Link>
    </div>
  );
}

export function QtActionTable({ actions }: { actions: QtActionRow[] }) {
  return (
    <div className="qt-table-wrap">
      <table className="qt-table">
        <thead>
          <tr>
            <th>Sev</th>
            <th>Việc</th>
            <th>Impact</th>
            <th>Owner</th>
            <th>SLA</th>
            <th>CTA</th>
          </tr>
        </thead>
        <tbody>
          {actions.length ? (
            actions.map((action) => (
              <tr key={`${action.resource_type}-${action.resource_id}-${action.title}`}>
                <td>
                  <span className={severityClass(action.severity)}>{action.severity}</span>
                </td>
                <td>{action.title}</td>
                <td>{action.impact}</td>
                <td>{dash(action.owner_staff_id)}</td>
                <td>{dash(action.sla)}</td>
                <td>
                  <Link className="qt-btn" href={action.href}>
                    {actionCta(action)}
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="qt-empty" colSpan={6}>
                {dash(null)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function QtByStatus({ rows }: { rows: QtByStatusRow[] }) {
  const visible = rows.filter((row) => row.count > 0);
  return (
    <section className="qt-card">
      <header className="qt-card__head">
        <b>Quote theo trạng thái</b>
        <span className="qt-muted">count + value · kỳ filter</span>
      </header>
      {visible.length ? (
        visible.map((row) => (
          <div className="qt-side-row" key={row.status}>
            <span>{STATUS_LABEL[row.status] ?? row.status}</span>
            <b>
              {row.count} · {formatMoney(row.payable_vnd)}
            </b>
          </div>
        ))
      ) : (
        <p className="qt-empty">{dash(null)}</p>
      )}
    </section>
  );
}

function QtHealth({ health }: { health: QtOverviewHealth | null }) {
  return (
    <section className="qt-card">
      <header className="qt-card__head">
        <b>Sức khỏe thương mại</b>
        <Link className="qt-link" href="/crm/proposals/settings">
          Policy
        </Link>
      </header>
      {health ? (
        HEALTH_ROWS.map((row) => (
          <div className="qt-side-row" key={row.key}>
            <span>{row.label}</span>
            <b>{health[row.key]}</b>
          </div>
        ))
      ) : (
        <p className="qt-empty">{dash(null)}</p>
      )}
    </section>
  );
}

export function QtOverview() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/proposals';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const current = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const query = useMemo<QtOverviewQuery>(
    () => ({
      from: current.get('from') || undefined,
      to: current.get('to') || undefined,
      scope: asScope(current.get('scope')),
      owner: current.get('owner') || undefined,
    }),
    [current],
  );
  const panel = current.get('panel');
  const [kpis, setKpis] = useState<QtOverviewKpis>(EMPTY_KPIS);
  const [winRateFormula, setWinRateFormula] = useState<string>(QT_WIN_RATE_FORMULA);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [byStatus, setByStatus] = useState<QtByStatusRow[]>([]);
  const [health, setHealth] = useState<QtOverviewHealth | null>(null);
  const [actions, setActions] = useState<QtActionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.from && query.to) return;
    const next = withDefaultOverviewPeriod(current);
    router.replace(`${pathname}?${next.toString()}`);
  }, [current, pathname, query.from, query.to, router]);

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token || !query.from || !query.to) return;
    setLoading(true);
    setError('');
    try {
      const [overview, nextActions] = await Promise.all([
        getQtOverview(token, query),
        getQtActions(token, { scope: query.scope }),
      ]);
      setKpis(overview.kpis ?? EMPTY_KPIS);
      setWinRateFormula(overview.win_rate_formula || QT_WIN_RATE_FORMULA);
      setLastUpdated(overview.last_updated ?? null);
      setByStatus(overview.by_status ?? []);
      setHealth(overview.health ?? null);
      setActions(nextActions);
    } catch (caught) {
      setKpis(EMPTY_KPIS);
      setByStatus([]);
      setHealth(null);
      setActions([]);
      setError(caught instanceof Error ? caught.message : 'Không tải được Tổng quan');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(current);
    mutate(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  function changePeriod(preset: string) {
    const range = periodRange(preset);
    replaceParams((params) => {
      params.set('from', range.from);
      params.set('to', range.to);
    });
  }

  function setActionPanel(open: boolean) {
    replaceParams((params) => {
      if (open) params.set('panel', 'actions');
      else params.delete('panel');
    });
  }

  const actionPanelHref = (() => {
    const params = new URLSearchParams(current);
    params.set('panel', 'actions');
    const next = params.toString();
    return next ? `${pathname}?${next}` : `${pathname}?panel=actions`;
  })();
  const period = detectPeriod(query.from ?? '', query.to ?? '');

  if (panel === 'actions') {
    return (
      <div className="qt-overview">
        <header className="qt-head">
          <div>
            <p className="qt-crumb">Kinh doanh / Báo giá / Action Center</p>
            <h1>Action Center</h1>
            <p className="qt-muted">severity · resource · owner · SLA · CTA</p>
          </div>
          <div className="qt-head__actions">
            <button type="button" className="qt-btn qt-btn--primary" onClick={() => setActionPanel(false)}>
              Về dashboard
            </button>
          </div>
        </header>
        {error ? (
          <section className="qt-card qt-card--error">
            <p>{error}</p>
            <button type="button" className="qt-btn" onClick={() => void load()}>
              Thử lại
            </button>
          </section>
        ) : null}
        <QtActionTable actions={actions} />
        <section className="qt-card">
          <b>Escalate</b>
          <p className="qt-muted">
            Approval +24h → owner + GDKD. Expiry ≤3 ngày → AM. Viewed +48h không phản hồi → task Deal
            Room. GM dưới floor không được publish trước approve.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="qt-overview">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Tổng quan</p>
          <h1>Tổng quan Báo giá</h1>
          <p className="qt-muted">
            last_updated {lastUpdated ?? dash(null)} · URL filter share được
          </p>
        </div>
        <div className="qt-head__actions">
          <label className="qt-scope">
            <span>Kỳ</span>
            <select
              aria-label="Kỳ"
              value={period}
              onChange={(event) => changePeriod(event.target.value)}
            >
              {period === '' ? <option value="">Chọn kỳ</option> : null}
              <option value="7d">7 ngày</option>
              <option value="30d">30 ngày</option>
              <option value="month">Tháng này</option>
              <option value="quarter">Quý này</option>
            </select>
          </label>
          <button type="button" className="qt-btn" onClick={() => setActionPanel(true)}>
            Action Center ({actions.length})
          </button>
          <Link className="qt-btn qt-btn--primary" href="/crm/proposals/new">
            Tạo báo giá
          </Link>
        </div>
      </header>

      {error ? (
        <section className="qt-card qt-card--error">
          <p>{error}</p>
          <button type="button" className="qt-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : null}

      <QtAlertBar actions={actions} href={actionPanelHref} />

      <div aria-busy={loading}>
        <QtKpiTiles kpis={kpis} winRateFormula={winRateFormula} />
      </div>

      <div className="qt-grid2">
        <QtByStatus rows={byStatus} />
        <QtHealth health={health} />
      </div>

      <div className="qt-grid2">
        <section className="qt-card">
          <header className="qt-card__head">
            <b>Việc cần xử lý</b>
            <button type="button" className="qt-link" onClick={() => setActionPanel(true)}>
              Tất cả
            </button>
          </header>
          {actions.length ? (
            actions.slice(0, 5).map((action) => (
              <p key={`${action.resource_id}-${action.title}`}>
                {action.title} · {dash(action.sla)} ·{' '}
                <Link className="qt-link" href={action.href}>
                  {actionCta(action)}
                </Link>
              </p>
            ))
          ) : (
            <p className="qt-empty">{dash(null)}</p>
          )}
        </section>
        <section className="qt-card">
          <header className="qt-card__head">
            <b>Top dịch vụ theo giá trị</b>
            <Link className="qt-link" href="/crm/proposals/catalog">
              Catalog
            </Link>
          </header>
          <p className="qt-empty">{dash(null)}</p>
        </section>
      </div>
    </div>
  );
}

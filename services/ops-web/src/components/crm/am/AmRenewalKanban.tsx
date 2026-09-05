'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  fetchAmRenewals,
  patchAmRenewal,
  startAmRenewal,
  type AmRenewalCard,
  type AmRenewalPipeline,
} from '@/lib/crm/am-api';
import {
  AM_RENEWAL_COLUMNS,
  amRenewalCsv,
  amRenewalDaysCopy,
  amRenewalMoneyDisplay,
  amRenewalMoveStatus,
  amRenewalPatchErrorCopy,
  amRenewalScoreCopy,
  parseAmRenewalView,
  parseAmRenewalWindow,
  type AmRenewalColumnId,
} from '@/lib/crm/am-renewal.util';
import { useMediaQuery } from '@/lib/hooks/useMediaQuery';
import { useAmPage } from './AmShell';

export function AmRenewalKanban() {
  const { token, canEdit, scope } = useAmPage();
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/account-management/renewals';
  const searchParams = useSearchParams();
  const view = parseAmRenewalView(searchParams.get('view'));
  const isMobile = useMediaQuery('(max-width: 767px)');
  const effectiveView = isMobile ? 'list' : view;
  const windowDays = parseAmRenewalWindow(searchParams.get('window'));

  const [data, setData] = useState<AmRenewalPipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [banner, setBanner] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(await fetchAmRenewals(token, { scope, window: String(windowDays) }));
    } catch {
      setData(null);
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }, [scope, token, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  function setQuery(next: { view?: 'kanban' | 'list'; window?: number }) {
    const qs = new URLSearchParams(searchParams.toString());
    const nextView = next.view ?? view;
    const nextWindow = next.window ?? windowDays;
    if (nextView === 'kanban') qs.delete('view');
    else qs.set('view', nextView);
    if (nextWindow === 90) qs.delete('window');
    else qs.set('window', String(nextWindow));
    const suffix = qs.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  const cards = useMemo(() => data?.columns.flatMap((col) => col.items) ?? [], [data]);
  const hide = data?.hide_amounts === true;
  const header = data?.header;

  async function moveCard(card: AmRenewalCard, columnId: AmRenewalColumnId) {
    if (!canEdit || !card.id || busyId) return;
    const status = amRenewalMoveStatus(columnId);
    if (status === card.status) return;
    setBusyId(card.id);
    setBanner('');
    try {
      await patchAmRenewal(token, card.id, {
        status,
        forecast: card.forecast,
        forecast_pct: card.forecast_pct,
        next_action: card.next_action,
      });
      await load();
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'patch_failed';
      setBanner(amRenewalPatchErrorCopy(code));
    } finally {
      setBusyId('');
    }
  }

  async function startCase(card: AmRenewalCard) {
    if (!canEdit || !card.contract_id || busyId) return;
    setBusyId(`c-${card.contract_id}`);
    setBanner('');
    try {
      const created = await startAmRenewal(token, card.contract_id);
      router.push(`/crm/account-management/renewals/${created.id}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.message : 'start_failed';
      setBanner(amRenewalPatchErrorCopy(code));
    } finally {
      setBusyId('');
    }
  }

  function exportCsv() {
    const blob = new Blob([amRenewalCsv(cards)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'am-renewals.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <section className="am-page">
        <p className="am-muted">Đang tải gia hạn…</p>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className="am-page">
        <div className="am-widget__error">
          <p>Không tải được pipeline gia hạn. Thử lại.</p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="am-page">
      <header className="am-renewal__head">
        <div>
          <h1>Gia hạn hợp đồng</h1>
          <p className="am-sub">
            Renewable {amRenewalMoneyDisplay(hide, header?.renewable_vnd)} · Forecast weighted{' '}
            {amRenewalMoneyDisplay(hide, header?.weighted_vnd)} · At risk{' '}
            {amRenewalMoneyDisplay(hide, header?.at_risk_vnd)}
          </p>
        </div>
        <div className="am-renewal__actions">
          <label className="am-field">
            <span className="am-sr-only">Window</span>
            <select
              value={String(windowDays)}
              onChange={(ev) => setQuery({ window: Number(ev.target.value) })}
            >
              <option value="30">30 ngày</option>
              <option value="60">60 ngày</option>
              <option value="90">90 ngày</option>
            </select>
          </label>
          <button
            type="button"
            className={`am-btn am-m01-hide${effectiveView === 'kanban' ? ' am-btn--primary' : ''}`}
            onClick={() => setQuery({ view: 'kanban' })}
          >
            Kanban
          </button>
          <button
            type="button"
            className={`am-btn${effectiveView === 'list' ? ' am-btn--primary' : ''}`}
            onClick={() => setQuery({ view: 'list' })}
          >
            Danh sách
          </button>
          <button type="button" className="am-btn" onClick={exportCsv}>
            Export
          </button>
        </div>
      </header>

      {banner ? <p className="am-banner">{banner}</p> : null}

      {effectiveView === 'list' ? (
        <div className="am-widget">
          <table className="am-table">
            <thead>
              <tr>
                <th>Khách</th>
                <th>MRR</th>
                <th>Còn</th>
                <th>Health</th>
                <th>Owner</th>
                <th>Next</th>
                <th>Cột</th>
              </tr>
            </thead>
            <tbody>
              {cards.length ? (
                cards.map((card, index) => (
                  <tr key={card.id || `c-${card.contract_id}-${index}`}>
                    <td>
                      {card.id ? (
                        <Link href={`/crm/account-management/renewals/${card.id}`}>{card.name || '—'}</Link>
                      ) : (
                        card.name || '—'
                      )}
                    </td>
                    <td>{amRenewalMoneyDisplay(hide, card.mrr_vnd)}</td>
                    <td>{amRenewalDaysCopy(card.days_remaining)}</td>
                    <td>{amRenewalScoreCopy(card.score, card.band)}</td>
                    <td>{card.owner_label || '—'}</td>
                    <td>{card.next_action || '—'}</td>
                    <td>
                      <MoveSelect
                        card={card}
                        canEdit={canEdit}
                        busy={busyId === card.id}
                        onMove={(col) => void moveCard(card, col)}
                      />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="am-muted">
                    —
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="am-kanban">
          {data.columns.map((col) => (
            <div key={col.id} className="am-kanban__col">
              <h2>
                {col.label} ({col.count}) · {amRenewalMoneyDisplay(hide, col.mrr_vnd)}
              </h2>
              {col.items.length ? (
                col.items.map((card, index) => (
                  <article key={card.id || `c-${card.contract_id}-${index}`} className="am-kcard">
                    {card.id ? (
                      <Link href={`/crm/account-management/renewals/${card.id}`}>
                        <b>{card.name || '—'}</b>
                      </Link>
                    ) : (
                      <b>{card.name || '—'}</b>
                    )}
                    <p className="am-muted">
                      {amRenewalMoneyDisplay(hide, card.mrr_vnd)} · {amRenewalDaysCopy(card.days_remaining)}{' '}
                      · {amRenewalScoreCopy(card.score, card.band)} · {card.owner_label || '—'}
                      {card.next_action ? ` · ${card.next_action}` : ''}
                    </p>
                    {card.id ? (
                      <MoveSelect
                        card={card}
                        canEdit={canEdit}
                        busy={busyId === card.id}
                        onMove={(next) => void moveCard(card, next)}
                      />
                    ) : canEdit ? (
                      <button
                        type="button"
                        className="am-btn"
                        disabled={busyId === `c-${card.contract_id}`}
                        onClick={() => void startCase(card)}
                      >
                        Bắt đầu
                      </button>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="am-muted">—</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function MoveSelect({
  card,
  canEdit,
  busy,
  onMove,
}: {
  card: AmRenewalCard;
  canEdit: boolean;
  busy: boolean;
  onMove: (columnId: AmRenewalColumnId) => void;
}) {
  const current = AM_RENEWAL_COLUMNS.find((col) => col.statuses.includes(card.status))?.id ?? 'not_started';
  const closed = card.status === 'renewed' || card.status === 'lost';
  if (!canEdit || !card.id || closed) return <span className="am-muted">Chuyển cột</span>;
  return (
    <label className="am-field am-kcard__move">
      <span>Chuyển cột</span>
      <select
        value={current}
        disabled={busy}
        onChange={(ev) => onMove(ev.target.value as AmRenewalColumnId)}
      >
        {AM_RENEWAL_COLUMNS.map((col) => (
          <option key={col.id} value={col.id}>
            {col.label}
          </option>
        ))}
      </select>
    </label>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { fetchStaffRoster, type StaffRosterRow } from '@/lib/api';
import {
  createAmView,
  fetchAmAccounts,
  fetchAmViews,
  transferAmAccounts,
  type AmAccountListItem,
  type AmSavedView,
} from '@/lib/crm/am-api';
import { bandCopy, vnd } from '@/lib/crm/am-format';
import {
  accountCell,
  activeAccountView,
  applyAccountView,
  canAssignAmAccounts,
  canSeeUnassignedAccounts,
  canShareAmView,
  parentChildLabel,
  viewQueryFromSearch,
  visibleAccountViews,
  type AmAccountsViewPreset,
} from '@/lib/crm/am-accounts-views.util';
import { useAmPage } from './AmShell';

const LIFECYCLES = [
  { value: '', label: 'Lifecycle' },
  { value: 'pending_handover', label: 'Chờ handover' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'active', label: 'Active' },
  { value: 'at_risk', label: 'At risk' },
  { value: 'renewing', label: 'Renewing' },
  { value: 'paused', label: 'Paused' },
  { value: 'churned', label: 'Churned' },
];

const BANDS = [
  { value: '', label: 'Health' },
  { value: 'healthy', label: 'Khỏe mạnh' },
  { value: 'watch', label: 'Cần theo dõi' },
  { value: 'at_risk', label: 'Có rủi ro' },
  { value: 'critical', label: 'Nghiêm trọng' },
  { value: 'at_risk,critical', label: 'Cần chú ý' },
];

const STATUS_COPY: Record<string, string> = {
  pending_handover: 'Chờ handover',
  onboarding: 'Onboarding',
  active: 'Active',
  at_risk: 'At risk',
  renewing: 'Renewing',
  paused: 'Paused',
  churned: 'Churned',
};

function bandClass(band: AmAccountListItem['band']): string {
  if (band === 'healthy') return 'am-pill am-pill--ok';
  if (band === 'watch') return 'am-pill am-pill--watch';
  if (band === 'at_risk') return 'am-pill am-pill--risk';
  if (band === 'critical') return 'am-pill am-pill--crit';
  return 'am-pill';
}

function queryFromSearch(search: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  search.forEach((value, key) => {
    if (value) out[key] = value;
  });
  return out;
}

export function AmAccountsList() {
  const { token, user, scope } = useAmPage();
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/account-management/clients';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const search = useMemo(() => new URLSearchParams(searchKey), [searchKey]);

  const [items, setItems] = useState<AmAccountListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qDraft, setQDraft] = useState(search.get('q') ?? '');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [savedViews, setSavedViews] = useState<AmSavedView[]>([]);
  const [viewName, setViewName] = useState('');
  const [viewShared, setViewShared] = useState(false);
  const [viewBusy, setViewBusy] = useState(false);
  const [viewError, setViewError] = useState('');
  const [transferOpen, setTransferOpen] = useState(false);
  const [toStaffId, setToStaffId] = useState('');
  const [keepSecondary, setKeepSecondary] = useState(true);
  const [moveOpenTasks, setMoveOpenTasks] = useState(false);
  const [reason, setReason] = useState('');
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [roster, setRoster] = useState<StaffRosterRow[]>([]);

  const canUnassigned = canSeeUnassignedAccounts(user);
  const canAssign = canAssignAmAccounts(user);
  const canShare = canShareAmView(user);
  const views = visibleAccountViews(user);
  const activeView = activeAccountView(search);
  const pageSize = 50;
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, on]) => on).map(([id]) => id),
    [selected],
  );
  const selectedCount = selectedIds.length;
  const pageIds = items.map((row) => row.agency_client_id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected[id]);
  const activeSavedView = savedViews.find((view) => view.id === search.get('view'));

  const replaceSearch = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router],
  );

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(search.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      replaceSearch(next);
    },
    [replaceSearch, search],
  );

  const applyView = useCallback(
    (view: AmAccountsViewPreset) => {
      replaceSearch(applyAccountView(search, view));
    },
    [replaceSearch, search],
  );

  const toggleSort = useCallback(
    (key: string) => {
      const current = search.get('sort');
      setParam('sort', current === key ? `-${key}` : key);
    },
    [search, setParam],
  );

  useEffect(() => {
    setQDraft(search.get('q') ?? '');
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const out = await fetchAmViews(token);
        if (!cancelled) setSavedViews(out.items ?? []);
      } catch {
        if (!cancelled) setSavedViews([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!canAssign) return;
    let cancelled = false;
    void fetchStaffRoster(token)
      .then((out) => {
        if (!cancelled) setRoster(out.staff ?? []);
      })
      .catch(() => {
        if (!cancelled) setRoster([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canAssign, token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const query = queryFromSearch(search);
        if (!query.scope) query.scope = scope;
        const out = await fetchAmAccounts(token, query);
        if (cancelled) return;
        setItems(out.items);
        setTotal(out.total);
        setPage(out.page);
      } catch (err) {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : 'Không tải được danh sách');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, search, token]);

  function onSearch(ev: FormEvent) {
    ev.preventDefault();
    setParam('q', qDraft.trim());
  }

  function toggleRow(id: string, on: boolean) {
    setSelected((prev) => ({ ...prev, [id]: on }));
  }

  function togglePage(on: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const id of pageIds) next[id] = on;
      return next;
    });
  }

  function applySaved(view: AmSavedView) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(view.query_json ?? {})) {
      if (value) next.set(key, String(value));
    }
    next.set('view', view.id);
    replaceSearch(next);
  }

  async function onSaveView(ev: FormEvent) {
    ev.preventDefault();
    const name = viewName.trim();
    if (!name) {
      setViewError('Nhập tên view');
      return;
    }
    setViewBusy(true);
    setViewError('');
    try {
      const created = await createAmView(token, {
        name,
        shared: canShare && viewShared,
        page: 'accounts',
        query_json: viewQueryFromSearch(search),
      });
      setSavedViews((prev) => [created, ...prev.filter((row) => row.id !== created.id)]);
      setViewName('');
      setViewShared(false);
    } catch (err) {
      setViewError(err instanceof Error ? err.message : 'Không lưu được view');
    } finally {
      setViewBusy(false);
    }
  }

  async function onTransfer(ev: FormEvent) {
    ev.preventDefault();
    const staffId = Number(toStaffId);
    const why = reason.trim();
    if (!why) {
      setTransferError('Lý do chuyển giao là bắt buộc');
      return;
    }
    if (!Number.isFinite(staffId) || staffId <= 0) {
      setTransferError('Chọn owner mới');
      return;
    }
    setTransferBusy(true);
    setTransferError('');
    try {
      await transferAmAccounts(token, {
        agency_client_ids: selectedIds,
        to_staff_id: staffId,
        reason: why,
        keep_secondary: keepSecondary,
        move_open_tasks: moveOpenTasks,
      });
      setTransferOpen(false);
      setSelected({});
      setReason('');
      setToStaffId('');
      const query = queryFromSearch(search);
      if (!query.scope) query.scope = scope;
      const out = await fetchAmAccounts(token, query);
      setItems(out.items);
      setTotal(out.total);
      setPage(out.page);
    } catch (err) {
      setTransferError(err instanceof Error ? err.message : 'Không chuyển được owner');
    } finally {
      setTransferBusy(false);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const maxPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section className="am-list">
      <div className="am-list__head">
        <div>
          <h1>Khách hàng</h1>
          <p className="am-muted">{total ? `${total} khách` : 'Danh sách theo phạm vi hiện tại'}</p>
        </div>
      </div>

      <div className="am-chips" role="tablist" aria-label="Saved views">
        {views.map((view) => (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={!activeSavedView && activeView === view.id}
            className={`am-chip${!activeSavedView && activeView === view.id ? ' is-on' : ''}`}
            onClick={() => applyView(view)}
          >
            {view.label}
          </button>
        ))}
        {savedViews.map((view) => (
          <button
            key={view.id}
            type="button"
            role="tab"
            aria-selected={activeSavedView?.id === view.id}
            className={`am-chip${activeSavedView?.id === view.id ? ' is-on' : ''}`}
            onClick={() => applySaved(view)}
          >
            {view.name}
            {view.shared ? ' · chung' : ''}
          </button>
        ))}
      </div>

      <form className="am-list__save-view" onSubmit={(ev) => void onSaveView(ev)}>
        <input
          value={viewName}
          onChange={(ev) => setViewName(ev.target.value)}
          placeholder="Tên view"
          aria-label="Tên view"
        />
        {canShare ? (
          <label className="am-check">
            <input
              type="checkbox"
              checked={viewShared}
              onChange={(ev) => setViewShared(ev.target.checked)}
            />
            Chia sẻ
          </label>
        ) : null}
        <button type="submit" className="am-btn" disabled={viewBusy}>
          Lưu view
        </button>
        {viewError ? <span className="am-muted">{viewError}</span> : null}
      </form>

      <form className="am-list__filters" onSubmit={onSearch}>
        <input
          className="am-list__q"
          value={qDraft}
          onChange={(ev) => setQDraft(ev.target.value)}
          placeholder="Tên, mã…"
          aria-label="Tìm khách hàng"
        />
        <select
          aria-label="Owner"
          value={search.get('owner') ?? ''}
          onChange={(ev) => setParam('owner', ev.target.value)}
        >
          <option value="">Owner</option>
          <option value="me">Của tôi</option>
          {canUnassigned ? <option value="unassigned">Chưa gán</option> : null}
        </select>
        <input
          className="am-list__team"
          value={search.get('team') ?? ''}
          onChange={(ev) => setParam('team', ev.target.value.trim())}
          placeholder="Team"
          aria-label="Team"
          inputMode="numeric"
        />
        <select
          aria-label="Health"
          value={search.get('band') ?? ''}
          onChange={(ev) => setParam('band', ev.target.value)}
        >
          {BANDS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Lifecycle"
          value={search.get('lifecycle') ?? ''}
          onChange={(ev) => setParam('lifecycle', ev.target.value)}
        >
          {LIFECYCLES.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <input
          value={search.get('industry') ?? ''}
          onChange={(ev) => setParam('industry', ev.target.value.trim())}
          placeholder="Ngành"
          aria-label="Ngành"
        />
        <button type="submit" className="am-btn">
          Lọc
        </button>
      </form>

      {error ? (
        <div className="am-widget__error">
          <p>Không tải được danh sách.</p>
          <p className="am-muted">{error}</p>
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div className="am-bulk" role="region" aria-label="Bulk actions">
          <span>Đã chọn {selectedCount} khách hàng</span>
          {canAssign ? (
            <button
              type="button"
              className="am-btn am-btn--primary"
              onClick={() => {
                setTransferError('');
                setTransferOpen(true);
              }}
            >
              Đổi Owner
            </button>
          ) : null}
          <button type="button" className="am-btn" onClick={() => setSelected({})}>
            Bỏ chọn
          </button>
        </div>
      ) : null}

      <div className="am-tbl-wrap am-list__table">
        <table className="am-table">
          <thead>
            <tr>
              <th className="am-list__check">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={(ev) => togglePage(ev.target.checked)}
                  aria-label="Chọn trang này"
                />
              </th>
              <th>
                <button type="button" className="am-list__sort" onClick={() => toggleSort('name')}>
                  Khách hàng
                </button>
              </th>
              <th>Owner</th>
              <th>Team</th>
              <th>Lifecycle</th>
              <th>Health</th>
              <th>
                <button type="button" className="am-list__sort" onClick={() => toggleSort('mrr')}>
                  MRR
                </button>
              </th>
              <th>
                <button type="button" className="am-list__sort" onClick={() => toggleSort('ends_on')}>
                  Gia hạn
                </button>
              </th>
              <th>SLA</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="am-muted">
                  Đang tải…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={9} className="am-muted">
                  Không có khách trong bộ lọc này.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const childLabel = parentChildLabel(row.child_count, row.is_parent);
                const ownerText =
                  row.owner_label ??
                  (row.owner_staff_id == null && canUnassigned ? 'Chưa gán' : null);
                return (
                  <tr key={row.agency_client_id}>
                    <td className="am-list__check">
                      <input
                        type="checkbox"
                        checked={Boolean(selected[row.agency_client_id])}
                        onChange={(ev) => toggleRow(row.agency_client_id, ev.target.checked)}
                        aria-label={`Chọn ${row.name}`}
                      />
                    </td>
                    <td>
                      <Link
                        className="am-link"
                        href={`/crm/account-management/clients/${row.agency_client_id}`}
                      >
                        {accountCell(row.name)}
                      </Link>
                      <div className="am-muted">
                        {accountCell(row.code)}
                        {row.parent_name ? ` · ${row.parent_name}` : ''}
                        {childLabel ? ` · ${childLabel} công ty con` : ''}
                      </div>
                    </td>
                    <td>
                      {accountCell(ownerText)}
                      {row.delegated_until ? (
                        <div className="am-muted">ủy quyền đến {row.delegated_until}</div>
                      ) : null}
                    </td>
                    <td>{accountCell(row.team_label)}</td>
                    <td>{accountCell(STATUS_COPY[row.am_status] ?? row.am_status)}</td>
                    <td>
                      <span className={bandClass(row.band)}>
                        {accountCell(row.score)} {bandCopy(row.band)}
                      </span>
                    </td>
                    <td>{vnd(row.mrr_vnd)}</td>
                    <td>{accountCell(row.ends_on)}</td>
                    <td>{accountCell(row.sla_label)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="am-list__pager">
        <span className="am-muted">
          Hiển thị {from}–{to} / {total}
        </span>
        <div className="am-list__pager-btns">
          <button
            type="button"
            className="am-btn"
            disabled={page <= 1}
            onClick={() => setParam('page', String(page - 1))}
          >
            Trước
          </button>
          <button
            type="button"
            className="am-btn"
            disabled={page >= maxPage}
            onClick={() => setParam('page', String(page + 1))}
          >
            Tiếp
          </button>
        </div>
      </div>

      {transferOpen ? (
        <div
          className="am-drawer-bg"
          onMouseDown={(ev) => {
            if (ev.target === ev.currentTarget && !transferBusy) setTransferOpen(false);
          }}
        >
          <div className="am-drawer" role="dialog" aria-modal="true" aria-label="Đổi Owner">
            <div className="am-drawer__head">
              <h2>Đổi Owner</h2>
              <button type="button" className="am-btn" onClick={() => setTransferOpen(false)}>
                ×
              </button>
            </div>
            <p className="am-muted">Chuyển owner cho {selectedCount} khách hàng</p>
            <form className="am-form" onSubmit={(ev) => void onTransfer(ev)}>
              <label className="am-field">
                <span>Owner mới *</span>
                <select
                  value={toStaffId}
                  onChange={(ev) => setToStaffId(ev.target.value)}
                  aria-label="Owner mới"
                >
                  <option value="">Chọn owner</option>
                  {roster.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.display_name || row.email}
                      {row.email && row.display_name !== row.email ? ` · ${row.email}` : ''}
                    </option>
                  ))}
                </select>
                <input
                  inputMode="numeric"
                  value={toStaffId}
                  onChange={(ev) => setToStaffId(ev.target.value.trim())}
                  placeholder="crm_staff ID"
                  aria-label="crm_staff ID owner mới"
                  required
                />
                <span className="am-muted">
                  Owner là crm_staff.id. Roster staff_users.id được map theo email nếu chưa có trên crm_staff.
                </span>
              </label>
              <label className="am-check">
                <input
                  type="checkbox"
                  checked={keepSecondary}
                  onChange={(ev) => setKeepSecondary(ev.target.checked)}
                />
                Giữ owner cũ là secondary owner
              </label>
              <fieldset className="am-field">
                <legend>Chuyển các task đang mở</legend>
                <label className="am-check">
                  <input
                    type="radio"
                    name="move_open_tasks"
                    checked={!moveOpenTasks}
                    onChange={() => setMoveOpenTasks(false)}
                  />
                  Không chuyển
                </label>
                <label className="am-check">
                  <input
                    type="radio"
                    name="move_open_tasks"
                    checked={moveOpenTasks}
                    onChange={() => setMoveOpenTasks(true)}
                  />
                  Chuyển sang owner mới
                </label>
              </fieldset>
              <label className="am-field">
                <span>Lý do chuyển giao *</span>
                <textarea
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value)}
                  required
                  rows={3}
                  aria-label="Lý do chuyển giao"
                />
              </label>
              {transferError ? <p className="am-widget__error">{transferError}</p> : null}
              <div className="am-form__actions">
                <button type="button" className="am-btn" onClick={() => setTransferOpen(false)}>
                  Hủy
                </button>
                <button type="submit" className="am-btn am-btn--primary" disabled={transferBusy}>
                  Xác nhận chuyển
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  acceptAmTasksBulk,
  fetchAmWorkQueue,
  type AmTaskKind,
  type AmWorkQueueItem,
} from '@/lib/crm/am-api';
import {
  AM_WORK_BOARD_COLUMNS,
  amWorkBoardColumn,
  amWorkDash,
  amWorkDueYmd,
  amWorkSlaCopy,
  amWorkWeekDays,
  formatAmWorkWhen,
  parseAmWorkInbox,
  parseAmWorkView,
  type AmWorkView,
} from '@/lib/crm/am-work-queue.util';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

const KIND_OPTS: Array<{ value: AmTaskKind | ''; label: string }> = [
  { value: '', label: 'Tất cả loại' },
  { value: 'task', label: 'Task' },
  { value: 'client_request', label: 'Yêu cầu khách' },
  { value: 'issue', label: 'Issue' },
  { value: 'escalation', label: 'Escalate' },
  { value: 'approval', label: 'Approval' },
  { value: 'milestone', label: 'Milestone' },
];

const STATUS_OPTS = [
  { value: '', label: 'Status' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_client', label: 'Waiting Client' },
  { value: 'waiting_internal', label: 'Waiting Internal' },
  { value: 'resolved', label: 'Resolved' },
];

const PRI_COPY: Record<string, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
};

function countCopy(n: number | null | undefined): string {
  return n == null ? '—' : String(n);
}

export function AmWorkQueue() {
  const { token, canEdit, scope, data, openCreate } = useAmPage();
  const { push } = useToast();
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/account-management/work';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const search = useMemo(() => new URLSearchParams(searchKey), [searchKey]);

  const view = parseAmWorkView(search.get('view'));
  const inbox = parseAmWorkInbox(search.get('inbox'));
  const sla = search.get('sla') === 'breached' ? 'breached' : '';
  const kind = search.get('kind') ?? '';
  const status = search.get('status') ?? '';

  const [items, setItems] = useState<AmWorkQueueItem[]>([]);
  const [counts, setCounts] = useState<{ me: number | null; team: number | null; unassigned: number | null }>({
    me: null,
    team: null,
    unassigned: null,
  });
  const [workHours, setWorkHours] = useState('Giờ LV 08:30–17:30');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const out = await fetchAmWorkQueue(token, {
        scope,
        inbox,
        sla,
        kind,
        status,
      });
      setItems(out.items);
      setCounts(out.counts);
      if (out.work_hours) setWorkHours(out.work_hours);
    } catch {
      setItems([]);
      setError('load_failed');
    } finally {
      setLoading(false);
    }
  }, [inbox, kind, scope, sla, status, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const replaceSearch = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router],
  );

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(search.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    replaceSearch(next);
  }

  function setView(next: AmWorkView) {
    setParam('view', next === 'list' ? '' : next);
  }

  const unassignedIds = items.filter((row) => row.assignee_staff_id == null).map((row) => row.id);
  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, on]) => on).map(([id]) => id),
    [selected],
  );
  const weekDays = useMemo(() => amWorkWeekDays(), []);
  const workLeft = data?.freshness.work_left_label;

  async function acceptSelected() {
    if (!canEdit || busy || selectedIds.length === 0) return;
    setBusy(true);
    try {
      const out = await acceptAmTasksBulk(token, selectedIds);
      push(`Đã nhận ${out.accepted} việc`, 'success');
      setSelected({});
      await load();
    } catch (err) {
      push(err instanceof Error ? err.message : 'Không nhận được việc', 'error');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="am-page">
        <p className="am-muted">Đang tải Work Queue…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="am-page">
        <div className="am-widget__error">
          <p>Không tải được Work Queue. Thử lại.</p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="am-page am-workq">
      <header className="am-workq__head">
        <div>
          <h1>Work Queue</h1>
          <p className="am-sub">
            Của tôi {countCopy(counts.me)} · Team {countCopy(counts.team)} · Chưa gán{' '}
            {countCopy(counts.unassigned)} · {workHours}
            {workLeft ? ` · ${workLeft}` : ''}
          </p>
        </div>
        <div className="am-workq__actions">
          {canEdit ? (
            <button type="button" className="am-btn am-btn--primary" onClick={() => openCreate('task')}>
              + Tạo
            </button>
          ) : null}
        </div>
      </header>

      <div className="am-list__filters">
        <select value={inbox} onChange={(ev) => setParam('inbox', ev.target.value === 'me' ? '' : ev.target.value)}>
          <option value="me">Của tôi</option>
          <option value="team">Team</option>
          <option value="unassigned">Chưa gán</option>
        </select>
        <select value={kind} onChange={(ev) => setParam('kind', ev.target.value)}>
          {KIND_OPTS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(ev) => setParam('status', ev.target.value)}>
          {STATUS_OPTS.map((opt) => (
            <option key={opt.value || 'all'} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select value={sla} onChange={(ev) => setParam('sla', ev.target.value)}>
          <option value="">SLA</option>
          <option value="breached">Breached</option>
        </select>
        <div className="am-workq__views">
          <button type="button" className={`am-btn${view === 'list' ? ' am-btn--primary' : ''}`} onClick={() => setView('list')}>
            Danh sách
          </button>
          <button type="button" className={`am-btn am-m01-hide${view === 'board' ? ' am-btn--primary' : ''}`} onClick={() => setView('board')}>
            Board
          </button>
          <button type="button" className={`am-btn${view === 'week' ? ' am-btn--primary' : ''}`} onClick={() => setView('week')}>
            Tuần
          </button>
        </div>
        {canEdit && unassignedIds.length > 0 ? (
          <button type="button" className="am-btn am-m01-hide" disabled={busy || selectedIds.length === 0} onClick={() => void acceptSelected()}>
            Nhận việc hàng loạt
          </button>
        ) : null}
      </div>

      {view === 'list' ? (
        <ListView
          items={items}
          canEdit={canEdit}
          selected={selected}
          onToggle={(id, on) => setSelected((prev) => ({ ...prev, [id]: on }))}
          onToggleAll={(ids, on) => {
            setSelected((prev) => {
              const next = { ...prev };
              for (const id of ids) next[id] = on;
              return next;
            });
          }}
        />
      ) : null}
      {view === 'board' ? <BoardView items={items} /> : null}
      {view === 'week' ? <WeekView items={items} days={weekDays} /> : null}
    </section>
  );
}

function ListView({
  items,
  canEdit,
  selected,
  onToggle,
  onToggleAll,
}: {
  items: AmWorkQueueItem[];
  canEdit: boolean;
  selected: Record<string, boolean>;
  onToggle: (id: string, on: boolean) => void;
  onToggleAll: (ids: string[], on: boolean) => void;
}) {
  const unassigned = items.filter((row) => row.assignee_staff_id == null);
  const allOn = unassigned.length > 0 && unassigned.every((row) => selected[row.id]);
  return (
    <div className="am-list__table">
      <table className="am-table">
        <thead>
          <tr>
            {canEdit ? (
              <th className="am-m01-hide">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả chưa gán"
                  checked={allOn}
                  disabled={unassigned.length === 0}
                  onChange={(ev) => onToggleAll(unassigned.map((row) => row.id), ev.target.checked)}
                />
              </th>
            ) : null}
            <th>Pri</th>
            <th>Việc</th>
            <th>Account</th>
            <th>Assignee</th>
            <th>Status</th>
            <th>SLA</th>
            <th>Hạn</th>
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((row) => {
              const sla = amWorkSlaCopy(row);
              return (
                <tr key={row.id} className={sla.danger ? 'am-workq__row--danger' : undefined}>
                  {canEdit ? (
                    <td className="am-m01-hide">
                      {row.assignee_staff_id == null ? (
                        <input
                          type="checkbox"
                          aria-label={`Chọn ${row.title}`}
                          checked={Boolean(selected[row.id])}
                          onChange={(ev) => onToggle(row.id, ev.target.checked)}
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td>
                    <span className={`am-pill am-pill--pri-${row.priority}`}>{PRI_COPY[row.priority] ?? row.priority}</span>
                  </td>
                  <td>
                    <Link href={`/crm/account-management/work/${row.id}`}>{row.title || '—'}</Link>
                  </td>
                  <td>{amWorkDash(row.account_name)}</td>
                  <td>{amWorkDash(row.assignee_label)}</td>
                  <td>{row.status}</td>
                  <td>
                    <span className={`am-pill${sla.danger ? ' am-pill--crit' : ''}`}>{sla.label}</span>
                  </td>
                  <td>{formatAmWorkWhen(row.due_at)}</td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={canEdit ? 8 : 7} className="am-muted">
                —
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function BoardView({ items }: { items: AmWorkQueueItem[] }) {
  return (
    <div className="am-kanban am-m01-hide">
      {AM_WORK_BOARD_COLUMNS.map((col) => {
        const cards = items.filter((row) => amWorkBoardColumn(row.status) === col.id);
        return (
          <section key={col.id} className="am-kanban__col">
            <h2>
              {col.label} ({cards.length})
            </h2>
            {cards.length ? (
              cards.map((row) => <WorkCard key={row.id} row={row} />)
            ) : (
              <p className="am-muted">—</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function WeekView({
  items,
  days,
}: {
  items: AmWorkQueueItem[];
  days: Array<{ ymd: string; label: string }>;
}) {
  return (
    <div className="am-kanban am-workq__week">
      {days.map((day) => {
        const cards = items.filter((row) => amWorkDueYmd(row.due_at) === day.ymd);
        return (
          <section key={day.ymd} className="am-kanban__col">
            <h2>
              {day.label} ({cards.length})
            </h2>
            {cards.length ? (
              cards.map((row) => <WorkCard key={row.id} row={row} />)
            ) : (
              <p className="am-muted">—</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function WorkCard({ row }: { row: AmWorkQueueItem }) {
  const sla = amWorkSlaCopy(row);
  return (
    <article className="am-kcard">
      <Link href={`/crm/account-management/work/${row.id}`}>{row.title || '—'}</Link>
      <span className="am-muted">{amWorkDash(row.account_name)}</span>
      <span className={`am-pill${sla.danger ? ' am-pill--crit' : ''}`}>{sla.label}</span>
    </article>
  );
}

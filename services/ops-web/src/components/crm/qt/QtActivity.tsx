'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { getAccessToken } from '@/lib/auth';
import { getQtActivity, getQtActivityCsv, type QtActivityRow } from '@/lib/crm/qt-api';
import { dash } from '@/lib/crm/qt-format';

export const QT_ACTIVITY_FILTERS = [
  { id: 'all', label: 'Tất cả', action: '' },
  { id: 'status', label: 'Status', action: 'status' },
  { id: 'approval', label: 'Approval', action: 'submit_approval' },
  { id: 'share', label: 'Share', action: 'publication.viewed' },
  { id: 'accept', label: 'Accept', action: 'accept' },
  { id: 'convert', label: 'Convert', action: 'convert' },
] as const;

const EXACT_ACTIVITY_ACTIONS = new Set([
  'submit_approval',
  'accept',
  'convert',
  'publication.viewed',
  'quote.created',
]);

export function activityApiActions(filter: string): string[] {
  if (!filter) return [];
  if (filter === 'status') return [];
  if (filter === 'approval') return ['submit_approval'];
  if (EXACT_ACTIVITY_ACTIONS.has(filter) || filter.includes('.')) return [filter];
  return [filter];
}

export function activityChipNotice(filter: string): string | null {
  if (filter === 'status') {
    return 'Chip Status chưa map 1:1 với action= của API — không lọc client-side từ 100 bản ghi lẫn.';
  }
  return null;
}

export function mergeActivityPages<T extends { id: string }>(pages: T[][]): T[] {
  const seen = new Set<string>();
  const items: T[] = [];
  for (const page of pages) {
    for (const row of page) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      items.push(row);
    }
  }
  return items;
}

function formatWhen(value: string | null | undefined): string {
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

function formatActor(row: QtActivityRow): string {
  if (row.actor_kind === 'portal') return 'portal';
  if (row.actor_staff_id != null) return `#${row.actor_staff_id}`;
  return row.actor_kind || dash(null);
}

function formatSnapshot(snapshot: Record<string, unknown> | null | undefined): string {
  if (!snapshot || typeof snapshot !== 'object') return dash(null);
  const parts = Object.entries(snapshot)
    .filter(([key]) => !/otp|token|nsr/i.test(key))
    .map(([key, value]) => `${key}=${value == null || value === '' ? dash(null) : String(value)}`);
  return parts.length ? parts.join(' · ') : dash(null);
}

export function QtActivityChipNotice({ action }: { action: string }) {
  const note = activityChipNotice(action);
  if (!note) return null;
  return (
    <p className="qt-muted" role="status">
      {note}
    </p>
  );
}

function matchesQuery(row: QtActivityRow, q: string): boolean {
  if (!q) return true;
  const haystack = [
    row.action,
    row.resource,
    row.actor_kind,
    row.actor_staff_id == null ? '' : String(row.actor_staff_id),
    JSON.stringify(row.snapshot ?? {}),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

export function QtActivityFilters({
  active,
  onChange,
}: {
  active: string;
  onChange: (action: string) => void;
}) {
  return (
    <div className="qt-filters">
      {QT_ACTIVITY_FILTERS.map((filter) => (
        <button
          key={filter.id}
          type="button"
          className={`qt-chip${active === filter.action ? ' qt-chip--on' : ''}`}
          onClick={() => onChange(filter.action)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

export function QtActivityTable({ items }: { items: QtActivityRow[] }) {
  return (
    <div className="qt-table-wrap">
      <table className="qt-table">
        <thead>
          <tr>
            <th>Thời điểm</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Resource</th>
            <th>Snapshot</th>
          </tr>
        </thead>
        <tbody>
          {items.length ? (
            items.map((row) => (
              <tr key={row.id}>
                <td>{formatWhen(row.created_at)}</td>
                <td>{formatActor(row)}</td>
                <td>{row.action}</td>
                <td>{dash(row.resource)}</td>
                <td>{formatSnapshot(row.snapshot)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="qt-empty" colSpan={5}>
                {dash(null)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function QtActivity() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/proposals/activity';
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const current = useMemo(() => new URLSearchParams(searchKey), [searchKey]);
  const action = current.get('action') ?? '';
  const q = (current.get('q') ?? '').trim().toLowerCase();
  const [draftQ, setDraftQ] = useState(current.get('q') ?? '');
  const [items, setItems] = useState<QtActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const actions = activityApiActions(action);
      if (action && actions.length === 0) {
        setItems([]);
        return;
      }
      const base = {
        from: current.get('from') || undefined,
        to: current.get('to') || undefined,
        owner: current.get('owner') || undefined,
        scope: current.get('scope') === 'team' || current.get('scope') === 'all'
          ? current.get('scope')
          : 'me',
      } as const;
      const pages = await Promise.all(
        (actions.length ? actions : [undefined]).map((exact) =>
          getQtActivity(token, { ...base, action: exact }),
        ),
      );
      setItems(mergeActivityPages(pages.map((page) => page.items ?? [])));
    } catch (caught) {
      setItems([]);
      setError(caught instanceof Error ? caught.message : 'Không tải được nhật ký');
    } finally {
      setLoading(false);
    }
  }, [action, current]);

  useEffect(() => {
    setDraftQ(current.get('q') ?? '');
  }, [current]);

  useEffect(() => {
    void load();
  }, [load]);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(current);
    mutate(params);
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    replaceParams((params) => {
      const value = draftQ.trim();
      if (value) params.set('q', value);
      else params.delete('q');
    });
  }

  async function exportCsv() {
    const token = getAccessToken();
    if (!token) return;
    setExportError('');
    try {
      const actions = activityApiActions(action);
      if (action && actions.length === 0) {
        setExportError(activityChipNotice(action) || 'Chip này chưa map 1:1 với action= API.');
        return;
      }
      const out = await getQtActivityCsv(token, {
        from: current.get('from') || undefined,
        to: current.get('to') || undefined,
        owner: current.get('owner') || undefined,
        action: actions[0],
      });
      const blob = new Blob([out.csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = out.filename || 'quote-activity.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setExportError(caught instanceof Error ? caught.message : 'Không xuất được CSV');
    }
  }

  const visible = items.filter((row) => matchesQuery(row, q));

  return (
    <div className="qt-activity">
      <header className="qt-head">
        <div>
          <p className="qt-crumb">Kinh doanh / Báo giá / Nhật ký</p>
          <h1>Nhật ký báo giá</h1>
          <p className="qt-muted">filter actor / action / quote · export = crm_quote.audit</p>
        </div>
        <form className="qt-head__actions" onSubmit={submitSearch}>
          <input
            className="qt-inp"
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
            placeholder="Tìm QT-PTT, actor, lead"
            aria-label="Tìm nhật ký"
          />
          <button type="submit" className="qt-btn">
            Tìm
          </button>
          <button type="button" className="qt-btn" onClick={() => void exportCsv()}>
            Export CSV
          </button>
        </form>
      </header>

      <QtActivityFilters
        active={action}
        onChange={(next) =>
          replaceParams((params) => {
            if (next) params.set('action', next);
            else params.delete('action');
          })
        }
      />
      <QtActivityChipNotice action={action} />

      {error || exportError ? (
        <section className="qt-card qt-card--error">
          <p>{error || exportError}</p>
          <button type="button" className="qt-btn" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : null}

      <div aria-busy={loading}>
        <QtActivityTable items={visible} />
      </div>
    </div>
  );
}

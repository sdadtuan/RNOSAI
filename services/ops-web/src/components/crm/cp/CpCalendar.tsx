'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import { CpBulkSchedule } from './CpBulkSchedule';
import { CpDistribution } from './CpDistribution';
import { CpPublishComposer } from './CpPublishComposer';
import { CpPublishGate } from './CpPublishGate';
import {
  formatCpApiError,
  listCpPublishItems,
  type CpPublishItem,
  type CpScope,
} from '@/lib/crm/cp-api';
import {
  CP_CALENDAR_TABS,
  CP_DEFAULT_TZ,
  buildMonthCells,
  type CpCalendarTab,
  type CpCalendarView,
} from '@/lib/crm/cp-calendar.util';
import { CP_SUBTITLES } from '@/lib/crm/cp-copy';
import { dash } from '@/lib/crm/cp-format';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function asTab(value: string | null): CpCalendarTab {
  return CP_CALENDAR_TABS.some((tab) => tab.id === value)
    ? value as CpCalendarTab
    : 'calendar';
}

function asView(value: string | null): CpCalendarView {
  return value === 'week' || value === 'list' ? value : 'month';
}

function asScope(value: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

function hrefWith(
  pathname: string,
  searchParams: URLSearchParams,
  patch: Record<string, string | null>,
): string {
  const next = new URLSearchParams(searchParams.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value == null || value === '') next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function formatWhen(value: string | null | undefined, tz = CP_DEFAULT_TZ): string {
  if (!value) return dash(null);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: tz,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(parsed);
}

function CpCalendarInner() {
  const router = useRouter();
  const pathname = usePathname() ?? '/crm/creative-os/calendar';
  const searchParams = useSearchParams();
  const tab = asTab(searchParams.get('tab'));
  const view = asView(searchParams.get('view'));
  const scope = asScope(searchParams.get('scope'));
  const now = new Date();
  const year = Number(searchParams.get('year')) || now.getFullYear();
  const month = Number(searchParams.get('month')) || now.getMonth() + 1;
  const [items, setItems] = useState<CpPublishItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const filters = {
    channel: searchParams.get('channel') ?? '',
    client: searchParams.get('client') ?? '',
    project: searchParams.get('project') ?? '',
    approval: searchParams.get('approval') ?? '',
  };

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await listCpPublishItems(token, {
        scope,
        channel: filters.channel || undefined,
        client: filters.client || undefined,
        project: filters.project || undefined,
        approval: filters.approval || undefined,
      });
      setItems(result.items.filter((item) => item.video_version_id));
    } catch (caught) {
      setItems([]);
      setError(formatCpApiError(caught, 'Không tải được lịch'));
    } finally {
      setLoading(false);
    }
  }, [filters.approval, filters.channel, filters.client, filters.project, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  const cells = useMemo(
    () => buildMonthCells(year, month, items.map((item) => ({
      id: item.id,
      scheduled_at: item.scheduled_at,
      channel: item.channel,
      draft_name: item.draft_name,
      kind: 'video',
    }))),
    [items, month, year],
  );

  const weekStart = cells.find((cell) => cell.inMonth && cell.day === now.getDate())
    ?? cells.find((cell) => cell.inMonth);
  const weekIndex = weekStart ? Math.floor(cells.indexOf(weekStart) / 7) : 0;
  const weekCells = cells.slice(weekIndex * 7, weekIndex * 7 + 7);

  return (
    <section className="cp-overview">
      <div className="cp-overview__head">
        <div>
          <p className="cp-crumb">Vận hành / Sản xuất sáng tạo / Lịch xuất bản</p>
          <h1>Lịch xuất bản</h1>
          <p className="cp-muted">{CP_SUBTITLES.calCalendar}</p>
        </div>
        <Link className="cp-btn cp-btn--primary" href={hrefWith(pathname, searchParams, { tab: 'composer' })}>
          Composer
        </Link>
      </div>
      <nav className="cp-settings-tabs" aria-label="Calendar tabs">
        {CP_CALENDAR_TABS.map((item) => (
          <Link
            key={item.id}
            href={hrefWith(pathname, searchParams, { tab: item.id === 'calendar' ? null : item.id })}
            className={`cp-btn${tab === item.id ? ' cp-btn--primary' : ''}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === 'composer' ? (
        <CpPublishComposer scope={scope} onScheduled={() => void load()} />
      ) : null}
      {tab === 'gate' ? (
        <CpPublishGate scope={scope} versionId={searchParams.get('version')} />
      ) : null}
      {tab === 'distribution' ? (
        <CpDistribution scope={scope} />
      ) : null}
      {tab === 'bulk' ? (
        <CpBulkSchedule scope={scope} onScheduled={() => void load()} />
      ) : null}
      {tab === 'calendar' ? (
        <>
          <form
            className="cp-filters"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              router.replace(hrefWith(pathname, searchParams, {
                view: String(form.get('view') || 'month'),
                channel: String(form.get('channel') || '') || null,
                client: String(form.get('client') || '') || null,
                project: String(form.get('project') || '') || null,
                approval: String(form.get('approval') || '') || null,
              }));
            }}
          >
            <label>
              <span>Xem</span>
              <select name="view" defaultValue={view} aria-label="Kiểu xem">
                <option value="month">Tháng</option>
                <option value="week">Tuần</option>
                <option value="list">List</option>
              </select>
            </label>
            <label>
              <span>Kênh</span>
              <select name="channel" defaultValue={filters.channel} aria-label="Kênh">
                <option value="">Tất cả</option>
                <option value="tiktok">tiktok</option>
                <option value="reels">reels</option>
              </select>
            </label>
            <label>
              <span>Khách</span>
              <input name="client" defaultValue={filters.client} placeholder={dash(null)} />
            </label>
            <label>
              <span>Project</span>
              <input name="project" defaultValue={filters.project} placeholder={dash(null)} />
            </label>
            <label>
              <span>Approval</span>
              <select name="approval" defaultValue={filters.approval} aria-label="Approval">
                <option value="">Tất cả</option>
                <option value="final_approved">final_approved</option>
                <option value="client_review">client_review</option>
              </select>
            </label>
            <button className="cp-btn" type="submit">Lọc</button>
          </form>
          {error ? <p className="cp-card--error">{error}</p> : null}
          {loading ? <p className="cp-muted">Đang tải…</p> : null}
          {view === 'list' ? (
            <div className="cp-table-wrap cp-card">
              <table className="cp-table">
                <thead>
                  <tr>
                    <th>Video</th>
                    <th>Kênh</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Approval</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length ? items.map((item) => (
                    <tr key={item.id}>
                      <td>{dash(item.draft_name)}</td>
                      <td>{dash(item.channel)}</td>
                      <td>{formatWhen(item.scheduled_at, item.tz ?? CP_DEFAULT_TZ)}</td>
                      <td>{dash(item.status)}</td>
                      <td>{dash(item.approval_status)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td className="cp-empty" colSpan={5}>{dash(null)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="cp-cal">
              {WEEKDAYS.map((label) => (
                <div key={label} className="cp-cal__wd">{label}</div>
              ))}
              {(view === 'week' ? weekCells : cells).map((cell) => (
                <div
                  key={cell.date}
                  className={`cp-cal__day${cell.inMonth ? '' : ' cp-cal__day--out'}`}
                >
                  <b>{cell.day}</b>
                  {cell.items.length ? cell.items.map((item) => (
                    <span key={item.id} className="cp-cal__ev">
                      {dash(item.channel)} · {dash(item.draft_name)}
                    </span>
                  )) : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

export function CpCalendar() {
  return (
    <Suspense fallback={<p className="cp-muted">Đang tải…</p>}>
      <CpCalendarInner />
    </Suspense>
  );
}

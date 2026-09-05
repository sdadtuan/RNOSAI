'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  fetchAmOnboardingCase,
  goLiveAmOnboardingCase,
  patchAmOnboardingCase,
  type AmOnboardingCase,
  type AmOnboardingCaseItem,
} from '@/lib/crm/am-api';
import {
  AM_ONBOARDING_TABS,
  amGoLiveBlocked,
  amOnboardingDash,
  amRequiredOpenCount,
  amTrackCopy,
  formatAmOnboardingDate,
  parseAmOnboardingTab,
  type AmOnboardingTabId,
} from '@/lib/crm/am-onboarding.util';
import { useAmPage } from './AmShell';

type ChecklistFilter = 'all' | 'open' | 'overdue';

function trackClass(track: AmOnboardingCase['track']): string {
  if (track === 'on_track') return 'am-pill am-pill--ok';
  if (track === 'at_risk') return 'am-pill am-pill--watch';
  return 'am-pill am-pill--crit';
}

function isChecklist(item: AmOnboardingCaseItem): boolean {
  return item.kind !== 'milestone';
}

function isOverdue(item: AmOnboardingCaseItem, today: string): boolean {
  return !item.done && Boolean(item.due_on) && item.due_on < today;
}

function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function goLiveErrorCopy(code: string): string {
  if (code === 'required_open') return 'Còn hạng mục bắt buộc chưa hoàn thành.';
  if (code === 'override_reason_required') return 'Cần lý do override khi còn hạng mục bắt buộc.';
  if (code === 'invalid_go_live_on') return 'Ngày Go-live phải là YYYY-MM-DD.';
  if (code === 'already_closed') return 'Case đã đóng.';
  return code;
}

export function AmOnboarding({ caseId }: { caseId: string }) {
  const { token, canEdit } = useAmPage();
  const router = useRouter();
  const pathname = usePathname() ?? `/crm/account-management/onboarding/${caseId}`;
  const searchParams = useSearchParams();
  const tab = parseAmOnboardingTab(searchParams.get('tab'));

  const [data, setData] = useState<AmOnboardingCase | null>(null);
  const [draft, setDraft] = useState<AmOnboardingCaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<ChecklistFilter>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [goLiveOn, setGoLiveOn] = useState('');
  const [notes, setNotes] = useState('');
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [modalError, setModalError] = useState('');

  const load = useCallback(async () => {
    if (!token || !caseId) return;
    setLoading(true);
    setError('');
    try {
      const next = await fetchAmOnboardingCase(token, caseId);
      setData(next);
      setDraft(next.items);
    } catch (err) {
      setData(null);
      setDraft([]);
      setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [caseId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function setTab(next: AmOnboardingTabId) {
    const qs = new URLSearchParams(searchParams.toString());
    if (next === 'overview') qs.delete('tab');
    else qs.set('tab', next);
    const suffix = qs.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname);
  }

  const open = data?.status === 'open';
  const canToggle = Boolean(canEdit && open);
  const today = todayYmd();
  const checklist = useMemo(() => draft.filter(isChecklist), [draft]);
  const milestones = useMemo(() => draft.filter((item) => item.kind === 'milestone'), [draft]);
  const visibleChecklist = useMemo(() => {
    if (filter === 'open') return checklist.filter((item) => !item.done);
    if (filter === 'overdue') return checklist.filter((item) => isOverdue(item, today));
    return checklist;
  }, [checklist, filter, today]);
  const dirty = useMemo(() => {
    if (!data) return [];
    return draft.filter((item) => {
      const orig = data.items.find((row) => row.id === item.id);
      return orig && orig.done !== item.done;
    });
  }, [data, draft]);

  async function saveChecklist() {
    if (!token || !data || !canToggle || busy || !dirty.length) return;
    setBusy(true);
    setError('');
    try {
      const next = await patchAmOnboardingCase(
        token,
        data.id,
        dirty.map((item) => ({ id: item.id, done: item.done })),
      );
      setData(next);
      setDraft(next.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được checklist.');
    } finally {
      setBusy(false);
    }
  }

  function openGoLive() {
    if (!canEdit || !open || !data) return;
    setGoLiveOn(data.go_live_on ?? '');
    setNotes('');
    setOverride(false);
    setOverrideReason('');
    setModalError('');
    setModalOpen(true);
  }

  async function confirmGoLive() {
    if (!token || !data || !canEdit || !open || busy) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(goLiveOn)) {
      setModalError('invalid_go_live_on');
      return;
    }
    const blocked = amGoLiveBlocked(draft, override);
    if (blocked) {
      setModalError('required_open');
      return;
    }
    if (amGoLiveBlocked(draft, false) && !overrideReason.trim()) {
      setModalError('override_reason_required');
      return;
    }
    setBusy(true);
    setModalError('');
    try {
      const next = await goLiveAmOnboardingCase(token, data.id, {
        go_live_on: goLiveOn,
        override: amGoLiveBlocked(draft, false) ? true : undefined,
        override_reason: overrideReason.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setData(next);
      setDraft(next.items);
      setModalOpen(false);
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : 'go_live_failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="am-page">
        <p className="am-muted">Đang tải onboarding…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="am-page">
        <p className="am-crumb">
          <Link href="/crm/account-management/onboarding">Onboarding</Link>
        </p>
        <div className="am-widget__error">
          <p>
            {error === 'not_found'
              ? 'Không tìm thấy case onboarding trong phạm vi của bạn.'
              : 'Không tải được onboarding. Thử lại.'}
          </p>
        </div>
      </section>
    );
  }

  const required = amRequiredOpenCount(draft);
  const stakeholders = Object.entries(data.stakeholders ?? {});

  return (
    <section className="am-page am-onboard">
      <p className="am-crumb">
        <Link href="/crm/account-management/onboarding">Onboarding</Link>
        {' / '}
        {data.name || data.code}
      </p>
      <header className="am-360__head">
        <div>
          <h1>{data.name || data.code || '—'}</h1>
          <p className="am-muted">
            {amOnboardingDash(data.progress_pct)}% hoàn thành · Go-live {formatAmOnboardingDate(data.go_live_on)} ·
            Owner {amOnboardingDash(data.owner_name)} · Delivery {amOnboardingDash(data.delivery_owner)}
          </p>
        </div>
        <span className={trackClass(data.track)}>{amTrackCopy(data.track)}</span>
      </header>

      {error && error !== 'not_found' && error !== 'load_failed' ? (
        <p className="am-banner">{error}</p>
      ) : null}

      <div className="am-onboard__grid">
        <nav className="am-widget am-onboard__nav" aria-label="Onboarding">
          {AM_ONBOARDING_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === tab ? 'is-active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="am-widget">
          {tab === 'overview' ? (
            <div>
              <h2>Tổng quan</h2>
              <p>
                Tiến độ {amOnboardingDash(data.progress_pct)}% · {amTrackCopy(data.track)} · Go-live{' '}
                {formatAmOnboardingDate(data.go_live_on)}
              </p>
              <div className="am-milestone-strip">
                {milestones.length === 0 ? (
                  <span className="am-muted">—</span>
                ) : (
                  milestones.map((item) => (
                    <span key={item.id} className={item.done ? 'am-pill am-pill--ok' : 'am-pill'}>
                      {item.title || '—'} {item.done ? '✓' : ''}
                    </span>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {tab === 'checklist' ? (
            <div>
              <div className="am-widget__head">
                <h2>Checklist</h2>
                <div className="am-chips">
                  {(
                    [
                      ['all', 'Tất cả'],
                      ['open', 'Chưa làm'],
                      ['overdue', 'Quá hạn'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={`am-chip${filter === id ? ' is-on' : ''}`}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {visibleChecklist.length === 0 ? (
                <p className="am-muted">—</p>
              ) : (
                <ul className="am-onboard__items">
                  {visibleChecklist.map((item) => (
                    <li key={item.id}>
                      <label className="am-field am-field--check">
                        <span>
                          <input
                            type="checkbox"
                            checked={item.done}
                            disabled={!canToggle}
                            onChange={(ev) =>
                              setDraft((prev) =>
                                prev.map((row) =>
                                  row.id === item.id ? { ...row, done: ev.target.checked } : row,
                                ),
                              )
                            }
                          />
                          {item.title || '—'}
                        </span>
                      </label>
                      <p className="am-muted">
                        {item.owner_role || '—'} · {formatAmOnboardingDate(item.due_on)}
                        {item.required ? ' · Required' : ''}
                        {isOverdue(item, today) ? ' · Quá hạn' : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === 'milestones' ? (
            <div>
              <h2>Milestones</h2>
              {milestones.length === 0 ? (
                <p className="am-muted">—</p>
              ) : (
                <ul className="am-onboard__items">
                  {milestones.map((item) => (
                    <li key={item.id}>
                      {item.done ? '✓ ' : '☐ '}
                      {item.title || '—'}
                      <p className="am-muted">
                        {item.owner_role || '—'} · {formatAmOnboardingDate(item.due_on)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          {tab === 'stakeholders' ? (
            <div>
              <h2>Stakeholders</h2>
              {stakeholders.length === 0 ? (
                <p className="am-muted">—</p>
              ) : (
                <dl className="am-handover__dl">
                  {stakeholders.map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>
                        {value == null || value === ''
                          ? '—'
                          : typeof value === 'object'
                            ? JSON.stringify(value)
                            : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ) : null}

          {tab === 'documents' || tab === 'activity' ? (
            <div>
              <h2>{tab === 'documents' ? 'Tài liệu' : 'Activity'}</h2>
              <p className="am-muted">—</p>
            </div>
          ) : null}

          <div className="am-form__actions">
            {tab === 'checklist' ? (
              <button
                type="button"
                className="am-btn"
                disabled={!canToggle || busy || dirty.length === 0}
                onClick={() => void saveChecklist()}
              >
                Lưu thay đổi
              </button>
            ) : null}
            {canEdit && open ? (
              <button type="button" className="am-btn am-btn--primary" onClick={openGoLive}>
                Đánh dấu sẵn sàng Go-live
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="am-drawer-bg" role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className="am-onboard__modal"
            role="dialog"
            aria-labelledby="am-golive-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="am-widget__head">
              <h2 id="am-golive-title">Xác nhận Go-live</h2>
              <button type="button" className="am-btn" onClick={() => setModalOpen(false)}>
                ×
              </button>
            </div>
            <p>
              {required.done}/{required.required} hạng mục bắt buộc hoàn thành
            </p>
            {data.health_fresh_24h ? null : (
              <p className="am-banner">Báo cáo dashboard chưa có dữ liệu 24 giờ</p>
            )}
            {modalError ? <p className="am-banner">{goLiveErrorCopy(modalError)}</p> : null}
            <label className="am-field">
              <span>Ngày Go-live thực tế *</span>
              <input type="date" value={goLiveOn} onChange={(ev) => setGoLiveOn(ev.target.value)} />
            </label>
            <label className="am-field">
              <span>Ghi chú</span>
              <textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} rows={3} />
            </label>
            {amGoLiveBlocked(draft, false) ? (
              <>
                <label className="am-field am-field--check">
                  <span>
                    <input
                      type="checkbox"
                      checked={override}
                      onChange={(ev) => setOverride(ev.target.checked)}
                    />
                    Override hạng mục bắt buộc còn mở
                  </span>
                </label>
                {override ? (
                  <label className="am-field">
                    <span>Lý do override *</span>
                    <textarea
                      value={overrideReason}
                      onChange={(ev) => setOverrideReason(ev.target.value)}
                      rows={3}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            <div className="am-form__actions">
              <button type="button" className="am-btn" onClick={() => setModalOpen(false)}>
                Hủy
              </button>
              <button
                type="button"
                className="am-btn am-btn--primary"
                disabled={busy || !goLiveOn}
                onClick={() => void confirmGoLive()}
              >
                Xác nhận Go-live
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

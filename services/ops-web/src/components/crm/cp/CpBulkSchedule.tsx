'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  bulkCpPublishItems,
  formatCpApiError,
  listCpChannelProfiles,
  listCpPublishVersions,
  type CpChannelProfile,
  type CpPublishVersion,
  type CpScope,
} from '@/lib/crm/cp-api';
import { CP_DEFAULT_TZ, isComposerSchedulable } from '@/lib/crm/cp-calendar.util';
import { dash } from '@/lib/crm/cp-format';

const WEEKDAYS = [
  { id: 1, label: 'T2' },
  { id: 2, label: 'T3' },
  { id: 3, label: 'T4' },
  { id: 4, label: 'T5' },
  { id: 5, label: 'T6' },
  { id: 6, label: 'T7' },
  { id: 7, label: 'CN' },
];

function scopeFrom(value?: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

export function CpBulkSchedule({
  scope: scopeValue,
  onScheduled,
}: {
  scope?: string | null;
  onScheduled?: () => void;
}) {
  const scope = scopeFrom(scopeValue);
  const [versions, setVersions] = useState<CpPublishVersion[]>([]);
  const [profiles, setProfiles] = useState<CpChannelProfile[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [channel, setChannel] = useState('tiktok');
  const [nPerDay, setNPerDay] = useState(1);
  const [windowStart, setWindowStart] = useState('09:00');
  const [windowEnd, setWindowEnd] = useState('11:00');
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [tz, setTz] = useState(CP_DEFAULT_TZ);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [versionOut, profileOut] = await Promise.all([
        listCpPublishVersions(token, scope),
        listCpChannelProfiles(token),
      ]);
      setVersions(versionOut.items);
      setProfiles(profileOut.items);
      setChannel((current) => (
        profileOut.items.some((item) => item.channel === current)
          ? current
          : profileOut.items[0]?.channel || current
      ));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tải được lịch hàng loạt'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleVersion(id: string, on: boolean) {
    setSelected((current) => (
      on ? [...new Set([...current, id])] : current.filter((item) => item !== id)
    ));
  }

  function toggleWeekday(id: number, on: boolean) {
    setWeekdays((current) => (
      on ? [...new Set([...current, id])].sort() : current.filter((item) => item !== id)
    ));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token || !selected.length) {
      setError('Chọn ít nhất một video version');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const out = await bulkCpPublishItems(token, {
        video_version_ids: selected,
        channel,
        tz,
        rule: {
          n_per_day: nPerDay,
          windows: [{ start: windowStart, end: windowEnd }],
          weekdays,
        },
      }, scope);
      setNotice(
        `Đã tạo ${out.items.length} PublishItem · bỏ qua ${out.skipped.length}`,
      );
      onScheduled?.();
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không lên lịch hàng loạt được'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="cp-card cp-form" onSubmit={(event) => void submit(event)}>
      <div className="cp-card__head">
        <h2>Lịch hàng loạt</h2>
        <p className="cp-muted">Version chưa đủ điều kiện sẽ bị bỏ qua. TZ {tz}.</p>
      </div>
      {loading ? <p className="cp-muted">Đang tải…</p> : null}
      {error ? <p className="cp-card--error">{error}</p> : null}
      {notice ? <p className="cp-alert">{notice}</p> : null}
      <label className="cp-field">
        <span>Kênh</span>
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          aria-label="Kênh"
        >
          {profiles.map((item) => (
            <option key={item.id} value={item.channel}>{item.channel}</option>
          ))}
        </select>
      </label>
      <div className="cp-form-2">
        <label className="cp-field">
          <span>Số bài / ngày</span>
          <input
            type="number"
            min={1}
            value={nPerDay}
            onChange={(event) => setNPerDay(Number(event.target.value) || 1)}
            aria-label="Số bài mỗi ngày"
          />
        </label>
        <label className="cp-field">
          <span>TZ</span>
          <input value={tz} onChange={(event) => setTz(event.target.value)} />
        </label>
      </div>
      <div className="cp-form-2">
        <label className="cp-field">
          <span>Khung giờ bắt đầu</span>
          <input
            type="time"
            value={windowStart}
            onChange={(event) => setWindowStart(event.target.value)}
          />
        </label>
        <label className="cp-field">
          <span>Khung giờ kết thúc</span>
          <input
            type="time"
            value={windowEnd}
            onChange={(event) => setWindowEnd(event.target.value)}
          />
        </label>
      </div>
      <fieldset className="cp-field">
        <legend>Ngày trong tuần</legend>
        {WEEKDAYS.map((day) => (
          <label key={day.id}>
            <input
              type="checkbox"
              checked={weekdays.includes(day.id)}
              onChange={(event) => toggleWeekday(day.id, event.target.checked)}
            />
            {day.label}
          </label>
        ))}
      </fieldset>
      <fieldset className="cp-field">
        <legend>Video version</legend>
        {versions.length ? versions.map((version) => {
          const ok = isComposerSchedulable(version);
          return (
            <label key={version.id}>
              <input
                type="checkbox"
                checked={selected.includes(version.id)}
                onChange={(event) => toggleVersion(version.id, event.target.checked)}
              />
              {version.draft_name || version.id} — {version.approval_status}
              {ok ? '' : ` (${version.lock_reason || 'bỏ qua nếu không eligible'})`}
            </label>
          );
        }) : <p className="cp-muted">{dash(null)}</p>}
      </fieldset>
      <button className="cp-btn cp-btn--primary" type="submit" disabled={saving || !selected.length}>
        {saving ? 'Đang tạo…' : 'Tạo lịch hàng loạt'}
      </button>
    </form>
  );
}

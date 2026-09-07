'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '@/lib/auth';
import {
  createCpPublishItem,
  formatCpApiError,
  listCpChannelProfiles,
  listCpPublishVersions,
  type CpChannelProfile,
  type CpPublishVersion,
  type CpScope,
} from '@/lib/crm/cp-api';
import {
  CP_DEFAULT_TZ,
  isPublishLocked,
} from '@/lib/crm/cp-calendar.util';
import { dash } from '@/lib/crm/cp-format';

function scopeFrom(value?: string | null): CpScope {
  return value === 'team' || value === 'all' ? value : 'me';
}

export function CpPublishComposer({
  scope: scopeValue,
  onScheduled,
}: {
  scope?: string | null;
  onScheduled?: () => void;
}) {
  const scope = scopeFrom(scopeValue);
  const [versions, setVersions] = useState<CpPublishVersion[]>([]);
  const [profiles, setProfiles] = useState<CpChannelProfile[]>([]);
  const [versionId, setVersionId] = useState('');
  const [channel, setChannel] = useState('tiktok');
  const [scheduledAt, setScheduledAt] = useState('');
  const [tz, setTz] = useState(CP_DEFAULT_TZ);
  const [copy, setCopy] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [cta, setCta] = useState('');
  const [utm, setUtm] = useState('');
  const [audience, setAudience] = useState('');
  const [compliance, setCompliance] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = versions.find((item) => item.id === versionId) ?? null;
  const profile = profiles.find((item) => item.channel === channel) ?? null;
  const locked = selected ? isPublishLocked(selected) : true;

  const profileHint = useMemo(() => {
    if (!profile) return dash(null);
    const rules = profile.rules_json;
    const ratio = (rules.ratio ?? []).join(', ') || dash(null);
    const duration = rules.duration_sec?.length
      ? `${rules.duration_sec[0]}–${rules.duration_sec[1]}s`
      : dash(null);
    const caption = rules.caption_max != null ? `≤${rules.caption_max}` : dash(null);
    return `${profile.channel}: ${ratio} · ${duration} · caption ${caption}`;
  }, [profile]);

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
      setVersionId((current) => current || versionOut.items[0]?.id || '');
      setChannel((current) => (
        profileOut.items.some((item) => item.channel === current)
          ? current
          : profileOut.items[0]?.channel || current
      ));
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không tải được composer'));
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const token = getAccessToken();
    if (!token || !versionId) {
      setError('Chọn video version đã Final Approved');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await createCpPublishItem(token, {
        video_version_id: versionId,
        channel,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        tz,
        copy,
        hashtags,
        cta,
        audience,
        compliance_label: compliance,
        utm_json: utm ? { raw: utm } : null,
      }, scope);
      setNotice('Đã lưu PublishItem video');
      onScheduled?.();
    } catch (caught) {
      setError(formatCpApiError(caught, 'Không lên lịch được'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cp-overview-grid">
      <form className="cp-card cp-form" onSubmit={(event) => void submit(event)}>
        <div className="cp-card__head">
          <h2>Publish Composer</h2>
          <p className="cp-muted">Chỉ video version. Copy lịch ở Content OS.</p>
        </div>
        {loading ? <p className="cp-muted">Đang tải…</p> : null}
        {error ? <p className="cp-card--error">{error}</p> : null}
        {notice ? <p className="cp-alert">{notice}</p> : null}
        <label className="cp-field">
          <span>Video version</span>
          <select
            value={versionId}
            onChange={(event) => setVersionId(event.target.value)}
            aria-label="Video version"
          >
            <option value="">{dash(null)}</option>
            {versions.map((version) => (
              <option key={version.id} value={version.id}>
                {version.draft_name || version.id} — {version.approval_status}
                {version.eligible ? '' : ' (chưa eligible)'}
              </option>
            ))}
          </select>
        </label>
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
            <span>Schedule</span>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
            />
          </label>
          <label className="cp-field">
            <span>TZ</span>
            <input value={tz} onChange={(event) => setTz(event.target.value)} />
          </label>
        </div>
        <label className="cp-field">
          <span>Caption</span>
          <textarea value={copy} onChange={(event) => setCopy(event.target.value)} rows={4} />
        </label>
        <label className="cp-field">
          <span>Hashtag</span>
          <input value={hashtags} onChange={(event) => setHashtags(event.target.value)} />
        </label>
        <label className="cp-field">
          <span>CTA / UTM</span>
          <input value={utm || cta} onChange={(event) => {
            setUtm(event.target.value);
            setCta(event.target.value);
          }} />
        </label>
        <label className="cp-field">
          <span>Audience</span>
          <input value={audience} onChange={(event) => setAudience(event.target.value)} />
        </label>
        <label className="cp-field">
          <span>Compliance label</span>
          <input value={compliance} onChange={(event) => setCompliance(event.target.value)} />
        </label>
        <button className="cp-btn cp-btn--primary" type="submit" disabled={saving || locked}>
          {saving ? 'Đang lưu…' : 'Lên lịch'}
        </button>
      </form>
      <section className="cp-card">
        <h2>Channel profile</h2>
        <p>{profileHint}</p>
        {locked ? (
          <p className="cp-pill cp-pill--danger">
            {selected?.lock_reason || 'chưa Final Approved'} → không schedule
          </p>
        ) : (
          <p className="cp-muted">QC Blocked / rights expired / thiếu disclaimer → khóa.</p>
        )}
      </section>
    </div>
  );
}

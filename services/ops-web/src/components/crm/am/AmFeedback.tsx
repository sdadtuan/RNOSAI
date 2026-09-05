'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  createAmSurvey,
  fetchAmFeedback,
  followupAmFeedback,
  type AmFeedbackItem,
  type AmFeedbackList,
} from '@/lib/crm/am-api';
import {
  amFeedbackCsdHref,
  amFeedbackDash,
  amFeedbackDate,
  amFeedbackKindLabel,
} from '@/lib/crm/am-feedback.util';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

type AmFeedbackProps = {
  agencyClientId?: string;
  embedded?: boolean;
};

const emptyKpis = {
  csat: null,
  nps: null,
  response_pct: null,
  complaints_open: null,
};

export function AmFeedback({ agencyClientId, embedded }: AmFeedbackProps) {
  const { token, canEdit, scope } = useAmPage();
  const { push } = useToast();
  const searchParams = useSearchParams();
  const clientFromQuery = searchParams.get('agency_client_id') ?? '';
  const clientId = agencyClientId || clientFromQuery || '';
  const [data, setData] = useState<AmFeedbackList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      setData(
        await fetchAmFeedback(token, {
          scope,
          agency_client_id: clientId || undefined,
        }),
      );
    } catch (err) {
      setData(null);
      setError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [clientId, scope, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const kpis = data?.kpis ?? emptyKpis;
  const items = data?.items ?? [];

  async function onFollowup(row: AmFeedbackItem) {
    if (!canEdit || !token || row.followup_task_id || busyId) return;
    setBusyId(row.id);
    try {
      await followupAmFeedback(token, row.id);
      push('Đã tạo task follow-up', 'success');
      await load();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Không tạo được task';
      push(message === 'already_followed_up' ? 'Đã có follow-up' : message, 'error');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className={embedded ? 'am-360__panel' : 'am-page'}>
      <header className="am-page__head">
        <div>
          <h1>{embedded ? 'Phản hồi' : 'Phản hồi khách hàng'}</h1>
          <p className="am-muted">{loading && !data ? '—' : 'CSAT ≤ 3 → task 24h'}</p>
        </div>
        <div className="am-growth__tools">
          <button
            type="button"
            className="am-btn am-btn--primary"
            disabled={!canEdit}
            title={canEdit ? 'Tạo khảo sát' : 'Cần quyền crm_am.edit'}
            onClick={() => canEdit && setSurveyOpen(true)}
          >
            Tạo khảo sát
          </button>
        </div>
      </header>

      {error ? (
        <div className="am-widget__error">
          <p>{error === 'not_found' ? 'Không tìm thấy khách trong phạm vi của bạn.' : 'Không tải được phản hồi.'}</p>
          <button type="button" className="am-btn" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="am-tiles">
        <article className="am-tile">
          <span>CSAT TB</span>
          <strong>{amFeedbackDash(kpis.csat)}</strong>
        </article>
        <article className="am-tile">
          <span>NPS</span>
          <strong>{amFeedbackDash(kpis.nps)}</strong>
        </article>
        <article className="am-tile">
          <span>Response %</span>
          <strong>{amFeedbackDash(kpis.response_pct)}</strong>
        </article>
        <article className="am-tile">
          <span>Complaints mở</span>
          <strong>{amFeedbackDash(kpis.complaints_open)}</strong>
        </article>
      </div>

      <div className="am-list__table">
        <table className="am-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Loại</th>
              <th>Điểm</th>
              <th>Ngày</th>
              <th>Phản hồi</th>
              <th>Follow-up</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="am-muted">
                  —
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const csdHref = row.csd_href || amFeedbackCsdHref(row.csd_ticket_id);
                return (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/crm/account-management/clients/${row.agency_client_id}`}>
                        {amFeedbackDash(row.account_name)}
                      </Link>
                    </td>
                    <td>{amFeedbackKindLabel(row.kind)}</td>
                    <td>{amFeedbackDash(row.score)}</td>
                    <td>{amFeedbackDate(row.created_at)}</td>
                    <td>{amFeedbackDash(row.comment)}</td>
                    <td>
                      {row.followup_task_id ? (
                        <Link
                          className="am-btn"
                          href={`/crm/account-management/work/${row.followup_task_id}`}
                        >
                          Xem task
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="am-btn"
                          disabled={!canEdit || busyId === row.id}
                          title={canEdit ? 'Tạo task follow-up' : 'Cần quyền crm_am.edit'}
                          onClick={() => void onFollowup(row)}
                        >
                          Follow-up
                        </button>
                      )}
                      {row.kind === 'complaint' && csdHref ? (
                        <Link className="am-btn" href={csdHref}>
                          Mở CSD
                        </Link>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {surveyOpen ? (
        <SurveyDrawer
          canEdit={canEdit}
          onClose={() => setSurveyOpen(false)}
          onSaved={() => {
            setSurveyOpen(false);
            push('Đã lưu khảo sát', 'success');
          }}
        />
      ) : null}
    </section>
  );
}

function SurveyDrawer({
  canEdit,
  onClose,
  onSaved,
}: {
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAmPage();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('CSAT Standard');
  const [channel, setChannel] = useState('email');
  const [audience, setAudience] = useState('');
  const [noRecontact, setNoRecontact] = useState('30');
  const [threshold, setThreshold] = useState('3');

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!canEdit || saving || !token) return;
    if (!name.trim() || !template.trim()) {
      setError('Cần tên và template');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const audienceText = audience.trim();
      let audienceJson: unknown = audienceText || null;
      if (audienceText) {
        try {
          audienceJson = JSON.parse(audienceText);
        } catch {
          audienceJson = { label: audienceText };
        }
      }
      await createAmSurvey(token, {
        name: name.trim(),
        template: template.trim(),
        channel: channel.trim() || null,
        audience_json: audienceJson,
        no_recontact_days: noRecontact ? Number(noRecontact) : null,
        csat_task_threshold: threshold ? Number(threshold) : 3,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được khảo sát');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="am-drawer-bg"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !saving) onClose();
      }}
    >
      <div className="am-drawer" role="dialog" aria-modal="true" aria-label="Tạo khảo sát">
        <div className="am-drawer__head">
          <strong>Tạo khảo sát</strong>
          <button type="button" className="am-btn" onClick={onClose}>
            Đóng
          </button>
        </div>
        <form className="am-form" onSubmit={(ev) => void onSubmit(ev)}>
          <p className="am-muted">CSAT ≤ 3 → task 24h</p>
          <label className="am-field">
            <span>Tên *</span>
            <input required maxLength={200} value={name} onChange={(ev) => setName(ev.target.value)} />
          </label>
          <label className="am-field">
            <span>Template *</span>
            <input
              required
              maxLength={200}
              value={template}
              onChange={(ev) => setTemplate(ev.target.value)}
            />
          </label>
          <label className="am-field">
            <span>Kênh</span>
            <select value={channel} onChange={(ev) => setChannel(ev.target.value)}>
              <option value="email">Email</option>
              <option value="in_app">In-app</option>
              <option value="other">Khác</option>
            </select>
          </label>
          <label className="am-field">
            <span>Đối tượng</span>
            <input
              value={audience}
              onChange={(ev) => setAudience(ev.target.value)}
              placeholder="Audience / filter"
            />
          </label>
          <label className="am-field">
            <span>Không gửi lại (ngày)</span>
            <input
              type="number"
              min={0}
              step={1}
              value={noRecontact}
              onChange={(ev) => setNoRecontact(ev.target.value)}
            />
          </label>
          <label className="am-field">
            <span>Ngưỡng CSAT</span>
            <input
              type="number"
              min={1}
              max={5}
              step={1}
              value={threshold}
              onChange={(ev) => setThreshold(ev.target.value)}
            />
          </label>
          {error ? <p className="am-widget__error">{error}</p> : null}
          <div className="am-form__actions">
            <button type="button" className="am-btn" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button type="submit" className="am-btn am-btn--primary" disabled={!canEdit || saving}>
              Lưu khảo sát
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

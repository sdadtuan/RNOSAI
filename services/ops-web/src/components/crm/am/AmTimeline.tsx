'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  amActionItemToTask,
  createAmDocument,
  createAmInteraction,
  fetchAmInteractions,
  type AmInteraction,
  type AmInteractionActionItem,
  type AmInteractionKind,
} from '@/lib/crm/am-api';
import {
  AM_TIMELINE_KINDS,
  amTimelineAttachError,
  amTimelineComposerError,
  amTimelineErrorCopy,
  amTimelineKindLabel,
  amTimelineRowEditable,
  parseAttendeesInput,
} from '@/lib/crm/am-timeline.util';
import { useToast } from '@/lib/toast';
import { useAmPage } from './AmShell';

type BookRow = { agency_client_id: string; name: string };

type AmTimelineProps = {
  agencyClientId?: string;
  book?: BookRow[];
  composerOnly?: boolean;
  onSaved?: () => void;
};

type ComposerKind = Exclude<AmInteractionKind, 'system'>;

type ActionDraft = { title: string; done: boolean; due_at: string };

function localDateTimeValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AmTimeline({ agencyClientId, book = [], composerOnly, onSaved }: AmTimelineProps) {
  const { token, canEdit, scope } = useAmPage();
  const { push } = useToast();
  const [clientId, setClientId] = useState(agencyClientId ?? '');
  const [kind, setKind] = useState<ComposerKind>('note');
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue);
  const [attendees, setAttendees] = useState('');
  const [summary, setSummary] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [visibility, setVisibility] = useState('internal');
  const [attachmentTitle, setAttachmentTitle] = useState('');
  const [attachmentHref, setAttachmentHref] = useState('');
  const [items, setItems] = useState<ActionDraft[]>([{ title: '', done: false, due_at: '' }]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [rows, setRows] = useState<AmInteraction[]>([]);
  const [loading, setLoading] = useState(!composerOnly && Boolean(agencyClientId));
  const [loadError, setLoadError] = useState('');
  const [tickingKey, setTickingKey] = useState('');

  useEffect(() => {
    if (agencyClientId) setClientId(agencyClientId);
  }, [agencyClientId]);

  const load = useCallback(async () => {
    const id = (agencyClientId || clientId).trim();
    if (!token || !id || composerOnly) return;
    setLoading(true);
    setLoadError('');
    try {
      const out = await fetchAmInteractions(token, { agency_client_id: id, scope });
      setRows(out.items ?? []);
    } catch (err) {
      setRows([]);
      setLoadError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'load_failed');
    } finally {
      setLoading(false);
    }
  }, [agencyClientId, clientId, composerOnly, scope, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetComposer() {
    setKind('note');
    setOccurredAt(localDateTimeValue());
    setAttendees('');
    setSummary('');
    setSentiment('');
    setVisibility('internal');
    setAttachmentTitle('');
    setAttachmentHref('');
    setItems([{ title: '', done: false, due_at: '' }]);
    setFormError('');
  }

  async function onSave(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (!canEdit || saving) return;
    const accountId = (agencyClientId || clientId).trim();
    const attendeeList = parseAttendeesInput(attendees);
    const err = amTimelineComposerError({ kind, attendees: attendeeList, summary });
    const attachErr = amTimelineAttachError({ href: attachmentHref, title: attachmentTitle });
    if (!accountId) {
      setFormError('Cần chọn account');
      return;
    }
    if (err) {
      setFormError(err);
      return;
    }
    if (attachErr) {
      setFormError(attachErr);
      return;
    }
    const actionItems: AmInteractionActionItem[] = items
      .map((item) => ({
        title: item.title.trim(),
        done: item.done,
        due_at: item.due_at.trim() || undefined,
      }))
      .filter((item) => item.title);
    setSaving(true);
    setFormError('');
    try {
      const created = await createAmInteraction(token, {
        agency_client_id: accountId,
        kind,
        occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined,
        summary: summary.trim(),
        sentiment: sentiment || undefined,
        visibility,
        attendees: attendeeList,
        action_items: actionItems,
      });
      const href = attachmentHref.trim();
      if (href) {
        try {
          await createAmDocument(token, {
            agency_client_id: accountId,
            title: attachmentTitle.trim(),
            href,
            interaction_id: created.id,
          });
        } catch {
          push('Đã ghi tương tác — không lưu được link', 'info');
          resetComposer();
          if (!composerOnly) await load();
          onSaved?.();
          return;
        }
      }
      push('Đã lưu tương tác', 'success');
      resetComposer();
      if (!composerOnly) await load();
      onSaved?.();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.message : '';
      setFormError(code ? amTimelineErrorCopy(code) : 'Không lưu được tương tác');
    } finally {
      setSaving(false);
    }
  }

  async function onTickActionItem(row: AmInteraction, index: number) {
    const item = row.action_items[index];
    if (!canEdit || !token || !item || item.task_id || tickingKey) return;
    const key = `${row.id}:${index}`;
    setTickingKey(key);
    try {
      const out = await amActionItemToTask(token, row.id, index);
      setRows((prev) =>
        prev.map((entry) => (entry.id === row.id ? { ...entry, action_items: out.action_items } : entry)),
      );
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.message : '';
      push(code ? amTimelineErrorCopy(code) : 'Không tạo được task', 'error');
    } finally {
      setTickingKey('');
    }
  }

  return (
    <div className="am-timeline">
      {canEdit ? (
        <form className="am-form am-timeline__composer" onSubmit={(ev) => void onSave(ev)}>
          {!agencyClientId ? (
            <label className="am-field">
              <span>Account *</span>
              {book.length > 0 ? (
                <select value={clientId} onChange={(ev) => setClientId(ev.target.value)} required>
                  <option value="" disabled>
                    Chọn khách
                  </option>
                  {book.map((row) => (
                    <option key={row.agency_client_id} value={row.agency_client_id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={clientId}
                  onChange={(ev) => setClientId(ev.target.value)}
                  required
                  placeholder="agency_client_id"
                />
              )}
            </label>
          ) : null}
          <label className="am-field">
            <span>Loại *</span>
            <select value={kind} onChange={(ev) => setKind(ev.target.value as ComposerKind)}>
              {AM_TIMELINE_KINDS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="am-field">
            <span>Thời gian</span>
            <input
              type="datetime-local"
              value={occurredAt}
              onChange={(ev) => setOccurredAt(ev.target.value)}
            />
          </label>
          <label className="am-field">
            <span>{kind === 'meeting' ? 'Người tham gia *' : 'Người tham gia'}</span>
            <input
              value={attendees}
              onChange={(ev) => setAttendees(ev.target.value)}
              placeholder="Tên, cách nhau bằng dấu phẩy"
              required={kind === 'meeting'}
            />
          </label>
          <label className="am-field">
            <span>Tóm tắt *</span>
            <textarea
              value={summary}
              onChange={(ev) => setSummary(ev.target.value)}
              required
              rows={3}
              placeholder="Nội dung cuộc họp / ghi chú"
            />
          </label>
          <label className="am-field">
            <span>Sentiment</span>
            <select value={sentiment} onChange={(ev) => setSentiment(ev.target.value)}>
              <option value="">—</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </label>
          <label className="am-field">
            <span>Visibility</span>
            <select value={visibility} onChange={(ev) => setVisibility(ev.target.value)}>
              <option value="internal">Internal</option>
              <option value="shared">Shared with client</option>
            </select>
          </label>
          <label className="am-field">
            <span>Tiêu đề tài liệu</span>
            <input
              value={attachmentTitle}
              onChange={(ev) => setAttachmentTitle(ev.target.value)}
              maxLength={200}
              placeholder="Tùy chọn"
            />
          </label>
          <label className="am-field">
            <span>Link tài liệu</span>
            <input
              name="attachment_href"
              value={attachmentHref}
              onChange={(ev) => setAttachmentHref(ev.target.value)}
              placeholder="https:// hoặc /"
            />
          </label>
          <div className="am-timeline__actions">
            <span>Action items</span>
            {items.map((item, idx) => (
              <label key={idx} className="am-check am-timeline__item">
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(ev) => {
                    const next = items.slice();
                    next[idx] = { ...item, done: ev.target.checked };
                    setItems(next);
                  }}
                />
                <input
                  value={item.title}
                  onChange={(ev) => {
                    const next = items.slice();
                    next[idx] = { ...item, title: ev.target.value };
                    setItems(next);
                  }}
                  placeholder="Tiêu đề task"
                />
              </label>
            ))}
            <button
              type="button"
              className="am-btn"
              onClick={() => setItems([...items, { title: '', done: false, due_at: '' }])}
            >
              + Action item
            </button>
          </div>
          {formError ? <p className="am-banner">{formError}</p> : null}
          <div className="am-form__actions">
            <button type="submit" className="am-btn am-btn--primary" disabled={saving}>
              {saving ? 'Đang lưu…' : 'Lưu tương tác'}
            </button>
          </div>
        </form>
      ) : (
        <p className="am-muted">Cần quyền crm_am.edit để log tương tác.</p>
      )}

      {composerOnly ? null : loading ? (
        <p className="am-muted">Đang tải timeline…</p>
      ) : loadError === 'not_found' ? (
        <p className="am-muted">Không tìm thấy khách trong phạm vi của bạn.</p>
      ) : loadError ? (
        <p className="am-muted">Không tải được timeline. Thử lại.</p>
      ) : rows.length === 0 ? (
        <p className="am-muted">Chưa có tương tác.</p>
      ) : (
        <ol className="am-timeline__feed">
          {rows.map((row) => {
            const system = !amTimelineRowEditable(row);
            return (
              <li
                key={row.id}
                className={system ? 'am-timeline__row am-timeline__row--system' : 'am-timeline__row'}
              >
                <div className="am-timeline__meta">
                  <span className="am-timeline__kind">{amTimelineKindLabel(row.kind)}</span>
                  <time dateTime={row.occurred_at}>
                    {new Date(row.occurred_at).toLocaleString('vi-VN')}
                  </time>
                  {system ? <span>System</span> : null}
                </div>
                <p>{row.summary}</p>
                {row.attendees.length > 0 ? (
                  <p className="am-muted">Người tham gia: {row.attendees.join(', ')}</p>
                ) : null}
                {row.action_items.length > 0 ? (
                  <ul className="am-timeline__actions">
                    {row.action_items.map((item, idx) => {
                      const key = `${row.id}:${idx}`;
                      return (
                        <li key={key} className="am-check am-timeline__item">
                          <input
                            type="checkbox"
                            checked={Boolean(item.task_id)}
                            disabled={
                              Boolean(item.task_id) ||
                              !canEdit ||
                              system ||
                              tickingKey === key
                            }
                            onChange={(ev) => {
                              if (ev.target.checked) void onTickActionItem(row, idx);
                            }}
                          />
                          <span>{item.title}</span>
                          {item.task_id ? (
                            <Link
                              className="am-link"
                              href={`/crm/account-management/work/${item.task_id}`}
                            >
                              Task
                            </Link>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { AmAccountContact, AmContactInput } from '@/lib/crm/am-api';
import {
  AM_COMMITTEE_ROLES,
  AM_CONTACT_CHANNELS,
  AM_RENEWAL_ATTITUDES,
  AM_SENTIMENTS,
  amContactAttitudeLabel,
  amContactChannelHref,
  amContactRoleLabel,
  amContactSentimentLabel,
  amShouldCloseContactEdit,
} from '@/lib/crm/am-contact-drawer.util';

type AmContactDrawerProps = {
  contacts: AmAccountContact[];
  canEdit: boolean;
  busy?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (contact: AmContactInput) => boolean | void | Promise<boolean | void>;
};

function toDraft(row: AmAccountContact | null): AmContactInput {
  return {
    id: row?.id,
    full_name: row?.full_name ?? '',
    role_committee: row?.role_committee ?? 'decision_maker',
    is_primary: row?.is_primary ?? true,
    sentiment: row?.sentiment ?? 'neutral',
    channel: row?.channel ?? 'zalo',
    renewal_attitude: row?.renewal_attitude ?? 'neutral',
    email: row?.email ?? '',
    phone: row?.phone ?? '',
  };
}

export function AmContactDrawer({
  contacts,
  canEdit,
  busy,
  error,
  onClose,
  onSave,
}: AmContactDrawerProps) {
  const primary = contacts.find((row) => row.is_primary) ?? contacts[0] ?? null;
  const [selectedId, setSelectedId] = useState<string>(primary?.id ?? '');
  const selected = contacts.find((row) => row.id === selectedId) ?? primary;
  const [draft, setDraft] = useState<AmContactInput>(() => toDraft(selected));
  const [editing, setEditing] = useState(!contacts.length);

  useEffect(() => {
    const next = contacts.find((row) => row.id === selectedId) ?? contacts[0] ?? null;
    setDraft(toDraft(next));
  }, [contacts, selectedId]);

  function startNew() {
    setSelectedId('');
    setDraft(toDraft(null));
    setEditing(true);
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    if (!canEdit || busy) return;
    if (!String(draft.full_name ?? '').trim()) return;
    const ok = await onSave({
      ...draft,
      full_name: String(draft.full_name).trim(),
      id: selectedId || undefined,
    });
    if (amShouldCloseContactEdit(ok !== false)) setEditing(false);
  }

  const name = draft.full_name || 'Thông tin liên hệ';
  const role = amContactRoleLabel(draft.role_committee);
  const channel = String(draft.channel ?? 'zalo');

  return (
    <div
      className="am-drawer-bg"
      role="presentation"
      onClick={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
    >
      <div className="am-drawer" role="dialog" aria-modal="true" aria-label="Thông tin liên hệ">
        <div className="am-drawer__head">
          <strong>Thông tin liên hệ</strong>
          <button type="button" className="am-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {contacts.length > 1 ? (
          <label className="am-field">
            <span>Contact</span>
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setEditing(false);
              }}
            >
              {contacts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.full_name}
                  {row.is_primary ? ' · chính' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <p>
          <strong>{name}</strong>
        </p>
        <p className="am-muted">
          {role}
          {draft.is_primary ? ' · Contact chính' : ''}
        </p>

        <p>
          SĐT: {draft.phone || '—'}{' '}
          <ChannelLink channel="call" contact={draft} label="Gọi" />
        </p>
        <p>
          Email: {draft.email || '—'}{' '}
          <ChannelLink channel="email" contact={draft} label="Email" />
        </p>
        <p>
          Zalo:{' '}
          <ChannelLink channel="zalo" contact={draft} label="Mở hội thoại" />
        </p>
        <p className="am-muted">Sentiment gần nhất: {amContactSentimentLabel(draft.sentiment)}</p>
        <p className="am-muted">Thái độ renewal: {amContactAttitudeLabel(draft.renewal_attitude)}</p>
        {error ? <p className="am-banner">{error}</p> : null}

        {editing && canEdit ? (
          <form className="am-form" onSubmit={(ev) => void onSubmit(ev)}>
            <label className="am-field">
              <span>Họ tên *</span>
              <input
                value={draft.full_name}
                onChange={(e) => setDraft((prev) => ({ ...prev, full_name: e.target.value }))}
                required
              />
            </label>
            <label className="am-field">
              <span>Vai trò buying committee</span>
              <select
                value={draft.role_committee ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, role_committee: e.target.value }))}
              >
                {AM_COMMITTEE_ROLES.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="am-field">
              <span>Sentiment</span>
              <select
                value={draft.sentiment ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, sentiment: e.target.value }))}
              >
                {AM_SENTIMENTS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="am-field">
              <span>Kênh ưu tiên</span>
              <select
                value={channel}
                onChange={(e) => setDraft((prev) => ({ ...prev, channel: e.target.value }))}
              >
                {AM_CONTACT_CHANNELS.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="am-field">
              <span>Thái độ đối với renewal</span>
              <select
                value={draft.renewal_attitude ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, renewal_attitude: e.target.value }))}
              >
                {AM_RENEWAL_ATTITUDES.map((row) => (
                  <option key={row.value} value={row.value}>
                    {row.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="am-field">
              <span>SĐT</span>
              <input
                value={draft.phone ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </label>
            <label className="am-field">
              <span>Email</span>
              <input
                value={draft.email ?? ''}
                onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
              />
            </label>
            <label className="am-field am-field--check">
              <span>
                <input
                  type="checkbox"
                  checked={Boolean(draft.is_primary)}
                  onChange={(e) => setDraft((prev) => ({ ...prev, is_primary: e.target.checked }))}
                />{' '}
                Đặt làm contact chính
              </span>
            </label>
            <div className="am-form__actions">
              <button type="button" className="am-btn" onClick={() => setEditing(false)}>
                Hủy
              </button>
              <button type="submit" className="am-btn am-btn--primary" disabled={busy}>
                {busy ? 'Đang lưu…' : 'Lưu contact'}
              </button>
            </div>
          </form>
        ) : (
          <div className="am-form__actions">
            {canEdit ? (
              <>
                <button type="button" className="am-btn" onClick={startNew}>
                  + Thêm contact
                </button>
                <button type="button" className="am-btn am-btn--primary" onClick={() => setEditing(true)}>
                  Chỉnh sửa
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelLink({
  channel,
  contact,
  label,
}: {
  channel: string;
  contact: AmContactInput;
  label: string;
}) {
  const href = amContactChannelHref(channel, contact);
  if (!href) {
    return <span className="am-muted">{label}</span>;
  }
  return (
    <a className="am-link" href={href} target={channel === 'zalo' ? '_blank' : undefined} rel="noreferrer">
      {label}
    </a>
  );
}

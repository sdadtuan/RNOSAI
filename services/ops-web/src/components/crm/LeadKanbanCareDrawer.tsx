'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { LeadActivityRow, LeadRow } from '@/lib/api';
import { createLeadActivity, fetchLeadActivities, patchLead } from '@/lib/api';
import { presentLeadHistory } from '@/lib/crm/lead-history';
import { leadFollowup } from '@/lib/crm/lead-followup';
import { fetchB2bLeadEligibleStaff, type B2bLeadEligibleStaffRow } from '@/lib/b2b-projects-api';
import { B2B_KANBAN_COLUMNS, leadStatusLabel, normalizeLeadStatus } from '@/lib/crm/lead-status';

export function LeadKanbanCareDrawer({
  lead,
  token,
  canChangeOwner,
  onClose,
  onChanged,
  onMove,
}: {
  lead: LeadRow;
  token: string;
  canChangeOwner: boolean;
  onClose: () => void;
  onChanged: () => void;
  onMove: (status: string) => void;
}) {
  const [activities, setActivities] = useState<LeadActivityRow[]>([]);
  const [note, setNote] = useState('');
  const [staff, setStaff] = useState<B2bLeadEligibleStaffRow[]>([]);
  const [ownerId, setOwnerId] = useState(lead.owner_id != null ? String(lead.owner_id) : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const status = normalizeLeadStatus(lead.status);

  useEffect(() => {
    let cancelled = false;
    void fetchLeadActivities(token, lead.id, 20)
      .then((rows) => {
        if (!cancelled) setActivities(rows);
      })
      .catch(() => {
        if (!cancelled) setActivities([]);
      });
    if (canChangeOwner) {
      void fetchB2bLeadEligibleStaff(token)
        .then((rows) => {
          if (!cancelled) setStaff(rows);
        })
        .catch(() => {
          if (!cancelled) setStaff([]);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [token, lead.id, canChangeOwner]);

  async function saveNote() {
    const content = note.trim();
    if (content.length < 3) return;
    setBusy(true);
    setErr('');
    try {
      await createLeadActivity(token, lead.id, { activity_type: 'note', content });
      setNote('');
      setActivities(await fetchLeadActivities(token, lead.id, 20));
      onChanged();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Không lưu được ghi chú');
    } finally {
      setBusy(false);
    }
  }

  async function saveOwner() {
    const next = Number(ownerId);
    if (!Number.isFinite(next) || next === lead.owner_id) return;
    setBusy(true);
    setErr('');
    try {
      await patchLead(token, lead.id, { owner_id: next, assign_reason: 'Đổi người phụ trách trên Kanban' });
      onChanged();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không đổi được người phụ trách';
      setErr(message === 'split_required' ? 'Lead này cần chọn cách chia trên trang lead.' : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="crm-kanban-drawer" role="dialog" aria-modal="true" aria-label="Chăm sóc lead">
      <button type="button" className="crm-kanban-drawer__backdrop" aria-label="Đóng" onClick={onClose} />
      <aside className="crm-kanban-drawer__panel">
        <header className="crm-kanban-drawer__head">
          <strong>{lead.full_name || `Lead #${lead.id}`}</strong>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Đóng
          </button>
        </header>
        <p className="muted" style={{ margin: 0 }}>
          #{lead.id} · {leadStatusLabel(status)} · {lead.phone || 'Chưa có số'}
        </p>
        <p className="muted" style={{ margin: 0 }}>
          {[lead.project_code, lead.source || lead.channel].filter(Boolean).join(' · ') || 'Chưa rõ nguồn'}
          {lead.owner_name ? ` · ${lead.owner_name}` : ''}
        </p>
        <label>
          Trạng thái
          <select
            value={B2B_KANBAN_COLUMNS.some((column) => column.statuses.includes(status)) ? status : ''}
            onChange={(event) => {
              if (event.target.value) onMove(event.target.value);
            }}
          >
            <option value={status}>{leadStatusLabel(status)}</option>
            {B2B_KANBAN_COLUMNS.filter((column) => !column.statuses.includes(status)).map((column) => (
              <option key={column.id} value={column.statuses[0]}>
                {column.label}
              </option>
            ))}
          </select>
        </label>
        {canChangeOwner ? (
          <label>
            Người phụ trách
            <span className="crm-kanban-drawer__row">
              <select value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                <option value="">Chọn</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void saveOwner()}>
                Lưu
              </button>
            </span>
          </label>
        ) : null}
        <label>
          Ghi chú
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </label>
        <button type="button" className="btn btn-sm" disabled={busy || note.trim().length < 3} onClick={() => void saveNote()}>
          Lưu ghi chú
        </button>
        <h3>Lịch sử trao đổi</h3>
        {(() => {
          const followup = leadFollowup(lead);
          if (!followup) return null;
          return (
            <p className="crm-kanban-drawer__followup">
              {followup.when ? `${followup.label} lúc ${followup.when}` : `${followup.label}. Cần gọi lại.`}
            </p>
          );
        })()}
        {activities.length === 0 ? (
          <p className="muted">Chưa có lịch sử.</p>
        ) : (
          <ul className="crm-kanban-drawer__log">
            {activities.map((activity) => {
              const line = presentLeadHistory(activity);
              return (
                <li key={activity.id}>
                  <strong>{line.who}</strong>
                  <span>{line.what}</span>
                  {line.when ? <span className="muted">{line.when}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
        <p>
          <Link href={`/crm/leads/${lead.id}`}>Mở trang lead để nhắn tin</Link>
        </p>
        {err ? (
          <p className="error" role="alert">
            {err}
          </p>
        ) : null}
      </aside>
    </div>
  );
}

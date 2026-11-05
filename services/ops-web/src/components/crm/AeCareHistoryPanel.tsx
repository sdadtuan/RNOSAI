'use client';

import { useEffect, useMemo, useState } from 'react';
import type { LeadActivityRow, LeadAssignmentLogRow, LeadStatusLogRow } from '@/lib/api';
import { ApiError, fetchLeadActivities, fetchLeadAudit } from '@/lib/api';
import { fetchAeCareHistory, type AeCareHistory } from '@/lib/crm/ae-team-api';
import { assignmentReasonLabel, collapseCareHistory, hideContactText, type CareHistoryLead } from '@/lib/crm/ae-care-history';
import { presentLeadHistory } from '@/lib/crm/lead-history';
import { leadStatusLabel } from '@/lib/crm/lead-status';
import '@/app/crm/b2b/team/ae-team.css';

function whenLabel(raw: string): string {
  const value = raw.trim();
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function staffLabel(lead: CareHistoryLead): string {
  const names = lead.staff.map((person) => (person.code ? `${person.name} (${person.code})` : person.name));
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} và ${names.length - 2} người`;
}

function personName(actor: string): string | undefined {
  const value = actor.trim();
  if (!value || /^[0-9a-f-]{16,}$/i.test(value) || /^(system|staff:)/i.test(value)) return undefined;
  return value;
}

function assignmentLine(row: LeadAssignmentLogRow): string {
  const from = row.from_name && row.from_name !== '—' ? row.from_name : '';
  const to = row.to_name && row.to_name !== '—' ? row.to_name : '';
  if (from && to) return `${from} → ${to}`;
  if (to) return `Gán cho ${to}`;
  if (from) return `Thu hồi từ ${from}`;
  return 'Đổi người phụ trách';
}

function HistoryDrawer({
  token,
  lead,
  onClose,
}: {
  token: string;
  lead: CareHistoryLead;
  onClose: () => void;
}) {
  const [activities, setActivities] = useState<LeadActivityRow[]>([]);
  const [assignments, setAssignments] = useState<LeadAssignmentLogRow[]>([]);
  const [statusLogs, setStatusLogs] = useState<LeadStatusLogRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchLeadActivities(token, lead.lead_id, 50).catch(() => [] as LeadActivityRow[]),
      fetchLeadAudit(token, lead.lead_id).catch(() => null),
    ]).then(([rows, audit]) => {
      if (cancelled) return;
      setActivities(rows);
      setAssignments(audit?.assignment_logs ?? []);
      setStatusLogs(audit?.status_logs ?? []);
      if (!audit && rows.length === 0) setError('Không tải được lịch sử lead');
    });
    return () => {
      cancelled = true;
    };
  }, [token, lead.lead_id]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const notes = activities
    .filter((row) => row.activity_type === 'note')
    .map((row) => presentLeadHistory({ ...row, content: hideContactText(row.content) }));
  const care = [
    ...activities
      .filter((row) => row.activity_type !== 'note')
      .map((row) => ({ at: row.created_at, line: presentLeadHistory({ ...row, content: hideContactText(row.content) }) })),
    ...statusLogs.map((row) => ({
      at: row.created_at,
      line: presentLeadHistory({
        id: Number(row.id) || 0,
        user_name: personName(row.changed_by),
        created_by: row.changed_by,
        content: hideContactText(`Trạng thái: ${leadStatusLabel(row.old_status)} → ${leadStatusLabel(row.new_status)}`),
        created_at: row.created_at,
      }),
    })),
  ]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((row) => row.line);

  return (
    <div className="crm-kanban-drawer" role="dialog" aria-modal="true" aria-label="Lịch sử lead">
      <button type="button" className="crm-kanban-drawer__backdrop" aria-label="Đóng" onClick={onClose} />
      <aside className="crm-kanban-drawer__panel ae-history-drawer">
        <header className="crm-kanban-drawer__head">
          <strong>{lead.lead_name}</strong>
          <button type="button" className="btn btn-sm" onClick={onClose}>Đóng</button>
        </header>
        <p className="muted" style={{ margin: 0 }}>
          #{lead.lead_id} · {leadStatusLabel(lead.status)} · {staffLabel(lead)}
        </p>
        {error ? <p className="error" role="alert">{error}</p> : null}

        <h3>Lịch sử phân công</h3>
        {assignments.length === 0 ? <p className="muted">Chưa có lần phân công.</p> : (
          <ul className="crm-kanban-drawer__log">
            {assignments.map((row) => (
              <li key={String(row.id)}>
                <strong>{assignmentLine(row)}</strong>
                <span>{assignmentReasonLabel(row.reason) || '—'}</span>
                <span className="muted">{whenLabel(row.created_at)}</span>
              </li>
            ))}
          </ul>
        )}

        <h3>Chăm sóc</h3>
        {care.length === 0 ? <p className="muted">Chưa có lịch sử chăm sóc.</p> : (
          <ul className="crm-kanban-drawer__log">
            {care.map((line) => (
              <li key={line.key}>
                <strong>{line.who}</strong>
                <span>{line.what}</span>
                {line.when ? <span className="muted">{line.when}</span> : null}
              </li>
            ))}
          </ul>
        )}

        <h3>Ghi chú</h3>
        {notes.length === 0 ? <p className="muted">Chưa có ghi chú.</p> : (
          <ul className="crm-kanban-drawer__log">
            {notes.map((line) => (
              <li key={line.key}>
                <strong>{line.who}</strong>
                <span>{line.what}</span>
                {line.when ? <span className="muted">{line.when}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}

export function AeCareHistoryPanel({ token }: { token: string }) {
  const [data, setData] = useState<AeCareHistory | null>(null);
  const [staffId, setStaffId] = useState('');
  const [error, setError] = useState('');
  const [open, setOpen] = useState<CareHistoryLead | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAeCareHistory(token)
      .then((board) => {
        if (!cancelled) {
          setData(board);
          setError('');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Không tải được lịch sử chăm sóc');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const people = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of data?.rows ?? []) {
      if (!map.has(row.staff_id)) {
        map.set(row.staff_id, row.staff_code ? `${row.staff_name} (${row.staff_code})` : row.staff_name);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], 'vi'));
  }, [data]);

  const leads = useMemo(() => {
    const rows = (data?.rows ?? []).filter((row) => !staffId || String(row.staff_id) === staffId);
    return collapseCareHistory(rows);
  }, [data, staffId]);

  return (
    <section className="ae-team ae-perf-embed" aria-label="History">
      <div className="ae-team-bar">
        <strong>History</strong>
        {people.length > 1 ? (
          <label>
            AE{' '}
            <select value={staffId} onChange={(event) => setStaffId(event.target.value)}>
              <option value="">Mọi AE</option>
              {people.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        ) : null}
        {data?.note ? <span className="ae-perf-note">{data.note}</span> : null}
      </div>
      {error ? <p className="ae-team-error">{error}</p> : null}
      {data && leads.length === 0 ? <p className="ae-perf-note">Chưa có lead nào trong lịch sử chăm sóc.</p> : null}
      {leads.length ? (
        <div className="ae-team-panel">
          <div className="ae-perf-scroll">
            <table className="ae-perf-table ae-perf-table--history">
              <thead>
                <tr>
                  <th>AE</th>
                  <th>Lead</th>
                  <th>Trạng thái</th>
                  <th>Việc gần nhất</th>
                  <th>Thời điểm</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={`${lead.staff[0]?.id ?? 0}-${lead.lead_id}`}>
                    <td>{staffLabel(lead)}</td>
                    <td>
                      <button type="button" className="ae-history-lead" onClick={() => setOpen(lead)}>
                        {lead.lead_name}
                      </button>
                      <span className="ae-perf-code"> #{lead.lead_id}</span>
                    </td>
                    <td>{leadStatusLabel(lead.status)}</td>
                    <td>{lead.latest_event}</td>
                    <td>{whenLabel(lead.latest_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      {open ? <HistoryDrawer token={token} lead={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

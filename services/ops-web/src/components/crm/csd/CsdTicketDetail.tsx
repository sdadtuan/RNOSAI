'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  assignCsdTicket,
  changeCsdTicketStatus,
  CSD_PRIORITY_LABELS,
  CSD_SLA_LABELS,
  CSD_STATUS_LABELS,
  CSD_TICKET_STATUSES,
  CSD_TICKET_TYPES,
  formatCsdWhen,
  fetchCsdTicketActivities,
  fetchCsdTicketComments,
  getCsdTicket,
  postCsdComment,
  resolveCsdTicket,
  type CsdTicketActivityRow,
  type CsdTicketCommentRow,
  type CsdTicketRow,
  type CsdTicketStatus,
} from '@/lib/crm/csd-api';
import { fetchCrmStaffList as fetchStaff } from '@/lib/api';
import { CsdTicketComposer } from './CsdTicketComposer';

type CsdTicketDetailProps = {
  token: string;
  ticketId: string;
  canWrite: boolean;
};

export function CsdTicketDetail({ token, ticketId, canWrite }: CsdTicketDetailProps) {
  const [ticket, setTicket] = useState<CsdTicketRow | null>(null);
  const [comments, setComments] = useState<CsdTicketCommentRow[]>([]);
  const [activities, setActivities] = useState<CsdTicketActivityRow[]>([]);
  const [staffOptions, setStaffOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [sendPublic, setSendPublic] = useState(false);

  const reload = useCallback(async () => {
    setError('');
    try {
      const [t, c, a, staff] = await Promise.all([
        getCsdTicket(token, ticketId),
        fetchCsdTicketComments(token, ticketId),
        fetchCsdTicketActivities(token, ticketId),
        fetchStaff(token),
      ]);
      setTicket(t);
      setComments(c.items ?? []);
      setActivities(a.items ?? []);
      setStaffOptions((staff.staff ?? []).map((s) => ({ id: s.id, name: s.name ?? `#${s.id}` })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tải ticket thất bại');
    }
  }, [token, ticketId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleAssign(staffId: number) {
    if (!canWrite) return;
    setBusy(true);
    try {
      await assignCsdTicket(token, ticketId, staffId);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gán ticket thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleStatus(status: CsdTicketStatus) {
    if (!canWrite) return;
    setBusy(true);
    try {
      await changeCsdTicketStatus(token, ticketId, status);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi trạng thái thất bại');
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !resolveNote.trim()) return;
    setBusy(true);
    try {
      await resolveCsdTicket(token, ticketId, { resolution_note: resolveNote.trim(), send_public: sendPublic });
      setResolveOpen(false);
      setResolveNote('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resolve thất bại');
    } finally {
      setBusy(false);
    }
  }

  if (!ticket) {
    return (
      <div className="page-card">
        {error ? <p className="error">{error}</p> : <p className="muted">Đang tải ticket…</p>}
      </div>
    );
  }

  const timeline = [
    ...comments.map((c) => ({
      id: c.id,
      kind: 'comment' as const,
      visibility: c.visibility,
      title: c.visibility === 'public' ? 'Phản hồi khách' : 'Ghi chú nội bộ',
      body: c.body_text,
      author: c.author_staff_name ?? 'Nhân viên',
      at: c.created_at,
    })),
    ...activities.map((a) => ({
      id: a.id,
      kind: 'activity' as const,
      visibility: 'internal' as const,
      title: a.action,
      body: a.body_vi ?? '',
      author: a.actor_staff_name ?? 'Hệ thống',
      at: a.created_at,
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  return (
    <div className="csd-ticket-detail" data-testid="csd-ticket-detail">
      <aside className="csd-ticket-detail__meta page-card stack-gap">
        <div>
          <p className="csd-ticket-detail__code">{ticket.code}</p>
          <h2 className="kpi-section-title" style={{ margin: 0 }}>
            {ticket.title}
          </h2>
          <p className="muted">{ticket.client_account_name ?? ticket.client_account_id ?? '—'}</p>
        </div>
        {error ? <p className="error">{error}</p> : null}
        <dl className="csd-meta-list">
          <div>
            <dt>Trạng thái</dt>
            <dd>{CSD_STATUS_LABELS[ticket.status] ?? ticket.status}</dd>
          </div>
          <div>
            <dt>Ưu tiên</dt>
            <dd>{CSD_PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</dd>
          </div>
          <div>
            <dt>SLA</dt>
            <dd>{CSD_SLA_LABELS[ticket.sla_status] ?? ticket.sla_status}</dd>
          </div>
          <div>
            <dt>Hạn xử lý</dt>
            <dd>{formatCsdWhen(ticket.sla_resolution_due_at)}</dd>
          </div>
          <div>
            <dt>Loại</dt>
            <dd>{CSD_TICKET_TYPES.find((t) => t.value === ticket.ticket_type)?.label ?? ticket.ticket_type}</dd>
          </div>
        </dl>
        {canWrite ? (
          <div className="stack-gap">
            <label className="muted">
              Gán cho
              <select
                className="kpi-select"
                style={{ width: '100%', marginTop: '0.35rem' }}
                value={ticket.assignee_staff_id ?? ''}
                disabled={busy}
                onChange={(e) => void handleAssign(Number(e.target.value))}
              >
                <option value="">Chưa gán</option>
                {staffOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="muted">
              Đổi trạng thái
              <select
                className="kpi-select"
                style={{ width: '100%', marginTop: '0.35rem' }}
                disabled={busy}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) void handleStatus(e.target.value as CsdTicketStatus);
                  e.target.value = '';
                }}
              >
                <option value="">Chọn…</option>
                {CSD_TICKET_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CSD_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setResolveOpen(true)}>
              Đánh dấu đã xử lý
            </button>
          </div>
        ) : null}
      </aside>

      <section className="csd-ticket-detail__timeline page-card">
        <h3 className="kpi-section-title">Luồng hoạt động</h3>
        {ticket.description ? <p className="csd-ticket-detail__desc">{ticket.description}</p> : null}
        <ul className="csd-timeline" data-testid="csd-ticket-timeline">
          {timeline.length === 0 ? (
            <li className="muted">Chưa có hoạt động</li>
          ) : (
            timeline.map((item) => (
              <li
                key={item.id}
                className={`csd-timeline__item csd-timeline__item--${item.visibility}`}
                data-testid={item.kind === 'comment' ? `csd-comment-${item.visibility}` : undefined}
              >
                <div className="csd-timeline__head">
                  <strong>{item.title}</strong>
                  {item.kind === 'comment' && item.visibility === 'internal' ? (
                    <span className="csd-badge csd-badge--internal">Nội bộ</span>
                  ) : null}
                </div>
                <p className="csd-timeline__meta muted">
                  {item.author} · {formatCsdWhen(item.at)}
                </p>
                {item.body ? <p className="csd-timeline__body">{item.body}</p> : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <aside className="csd-ticket-detail__composer page-card">
        <h3 className="kpi-section-title">Soạn phản hồi</h3>
        {canWrite ? (
          <CsdTicketComposer
            token={token}
            ticketId={ticketId}
            disabled={busy}
            onSubmit={async (body) => {
              await postCsdComment(token, ticketId, body);
              await reload();
            }}
          />
        ) : (
          <p className="muted">Chế độ chỉ xem — cần quyền csd:write để phản hồi.</p>
        )}
      </aside>

      {resolveOpen ? (
        <div className="csd-modal-backdrop" role="presentation" onClick={() => setResolveOpen(false)}>
          <form
            className="csd-modal page-card stack-gap"
            onSubmit={(e) => void handleResolve(e)}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="kpi-section-title">Đánh dấu đã xử lý</h3>
            <textarea
              className="kpi-input"
              rows={4}
              required
              placeholder="Ghi chú xử lý (bắt buộc)"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
            />
            <label className="b2b-inbox-filter">
              <input type="checkbox" checked={sendPublic} onChange={(e) => setSendPublic(e.target.checked)} />
              Gửi tóm tắt công khai cho khách
            </label>
            <div className="csd-composer__actions">
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => setResolveOpen(false)}>
                Huỷ
              </button>
              <button type="submit" className="btn btn-sm" disabled={busy || !resolveNote.trim()}>
                Xác nhận resolve
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState, type DragEvent } from 'react';
import type { LeadRow } from '@/lib/api';
import { ApiError, fetchLeadStatusOptions, patchLead } from '@/lib/api';
import {
  kanbanCardActions,
  kanbanStageAccent,
  type KanbanCardAction,
} from '@/lib/crm/kanban-card-cta';
import {
  B2B_KANBAN_COLUMNS,
  bucketLeadsByKanbanColumns,
  bucketLeadsByKanbanStage,
  leadStatusLabel,
  normalizeLeadStatus,
} from '@/lib/crm/lead-status';
import { statusOptionsForFlowKind, type LeadFlowKind } from '@/lib/crm/lead-flow-kind';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

type LostReason = { id: string; label: string; needs_note?: boolean };
type ModalKind = 'contact' | 'quote' | 'lost' | 'nurture' | 'error';
type MoveModal = { lead: LeadRow; target: string; kind: ModalKind; message: string };

const LOST_REASON_SEED: LostReason[] = [
  { id: 'no_need', label: 'Không nhu cầu' },
  { id: 'price', label: 'Giá' },
  { id: 'competitor', label: 'Đối thủ' },
  { id: 'wrong_number', label: 'Sai số' },
  { id: 'unreachable', label: 'Không liên lạc được' },
  { id: 'other', label: 'Khác', needs_note: true },
];

function formatVnd(value: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function errorCode(err: unknown): string {
  return err instanceof ApiError ? String(err.code ?? '') : '';
}

function bandLabel(band: LeadRow['ai_band']): string | null {
  if (band === 'hot') return 'Nóng';
  if (band === 'warm') return 'Ấm';
  if (band === 'cold') return 'Lạnh';
  return null;
}

function slaLabel(sla: LeadRow['sla_state']): string | null {
  if (sla === 'breach') return 'SLA trễ';
  if (sla === 'warning') return 'SLA gần';
  return null;
}

function ActionButton({
  action,
  busy,
  onAction,
}: {
  action: KanbanCardAction;
  busy: boolean;
  onAction: (action: KanbanCardAction) => void;
}) {
  const ctaClass = `btn btn-sm crm-kanban-card__cta crm-kanban-card__cta--${action.kind}${
    action.primary ? ' is-primary' : ''
  }`;
  if (action.href?.startsWith('tel:')) {
    return (
      <a href={action.href} className={ctaClass}>
        {action.label}
      </a>
    );
  }
  if (action.href) {
    return (
      <Link href={action.href} className={ctaClass}>
        {action.label}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className={ctaClass}
      disabled={busy}
      onClick={() => onAction(action)}
    >
      {busy ? '…' : action.label}
    </button>
  );
}

export function LeadKanbanBoard({
  rows,
  flowKind = 'b2b_prospect',
  token,
  onLeadUpdated,
}: {
  rows: LeadRow[];
  flowKind?: LeadFlowKind;
  token?: string;
  onLeadUpdated?: () => void;
}) {
  const b2b = flowKind === 'b2b_prospect';
  const stages = statusOptionsForFlowKind(flowKind);
  const { stageKeys, byStage } = bucketLeadsByKanbanStage(rows, stages);
  const byColumn = bucketLeadsByKanbanColumns(rows, B2B_KANBAN_COLUMNS);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    won: true,
    lost: true,
    nurture: true,
  });
  const [dragOver, setDragOver] = useState('');
  const [modal, setModal] = useState<MoveModal | null>(null);
  const [lostReasons, setLostReasons] = useState<LostReason[]>(LOST_REASON_SEED);
  const [contactNote, setContactNote] = useState('');
  const [quoteUrl, setQuoteUrl] = useState('');
  const [quoteValueInput, setQuoteValueInput] = useState('');
  const [lostReason, setLostReason] = useState(LOST_REASON_SEED[0].id);
  const [lostNote, setLostNote] = useState('');
  const [callbackAt, setCallbackAt] = useState('');

  const columns = b2b
    ? B2B_KANBAN_COLUMNS.map((column) => ({
        key: column.id,
        title: column.label,
        items: byColumn[column.id] ?? [],
        accent: column.id,
        sum: column.sumValue,
        collapsible: column.collapsible,
      }))
    : stageKeys.map((stage) => ({
        key: stage,
        title: leadStatusLabel(stage),
        items: byStage[stage] ?? [],
        accent: stage,
        sum: false,
        collapsible: false,
      }));

  async function openLostModal(lead: LeadRow, message: string) {
    setModal({ lead, target: 'lost', kind: 'lost', message });
    if (!token) return;
    try {
      const options = await fetchLeadStatusOptions(token, lead.id);
      if (options.lost_reasons?.length) setLostReasons(options.lost_reasons);
    } catch {
      setLostReasons(LOST_REASON_SEED);
    }
  }

  async function moveLead(
    lead: LeadRow,
    status: string,
    extra: {
      audit_note?: string;
      contact_note?: string;
      quote_url?: string;
      expected_value?: number;
      lost_reason?: string;
      lost_reason_note?: string;
      next_call_at?: string;
    } = {},
  ) {
    if (!token) return;
    setBusyId(lead.id);
    setErr('');
    setMsg('');
    try {
      await patchLead(token, lead.id, {
        status,
        audit_note: extra.audit_note ?? 'Chuyển trên Kanban',
        ...extra,
      });
      setModal(null);
      setMsg(`Lead #${lead.id} đã chuyển.`);
      onLeadUpdated?.();
    } catch (e) {
      const code = errorCode(e);
      const message = e instanceof Error ? e.message : 'Không chuyển được trạng thái';
      if (code === 'outreach_required') {
        setModal({ lead, target: 'da_lien_he', kind: 'contact', message });
      } else if (code === 'quote_required') {
        setModal({ lead, target: 'bao_gia', kind: 'quote', message });
      } else if (code === 'lost_reason_required' || code === 'lost_reason_note_required') {
        void openLostModal(lead, message);
      } else if (code === 'callback_required') {
        setModal({ lead, target: 'nurture', kind: 'nurture', message });
      } else {
        setModal({ lead, target: status, kind: 'error', message });
      }
    } finally {
      setBusyId(null);
    }
  }

  function onDropLead(target: string, event: DragEvent) {
    event.preventDefault();
    setDragOver('');
    if (!b2b) return;
    const leadId = Number(event.dataTransfer.getData('text/plain'));
    const lead = rows.find((row) => row.id === leadId);
    if (!lead) return;
    const current = normalizeLeadStatus(lead.status);
    const from = B2B_KANBAN_COLUMNS.find((column) => column.statuses.includes(current));
    if (!from || from.id === target) return;
    if (target === 'bao_gia') {
      void moveLead(lead, 'bao_gia', { audit_note: 'Chuyển sang Báo giá' });
      return;
    }
    if (target === 'lost') {
      setLostNote('');
      void openLostModal(lead, 'Chọn lý do thất bại.');
      return;
    }
    if (target === 'nurture') {
      setCallbackAt('');
      setModal({ lead, target, kind: 'nurture', message: 'Chọn ngày hẹn gọi lại.' });
      return;
    }
    void moveLead(lead, target);
  }

  async function submitModal() {
    if (!modal) return;
    if (modal.kind === 'contact') {
      await moveLead(modal.lead, modal.target, {
        contact_note: contactNote,
        audit_note: contactNote,
      });
      return;
    }
    if (modal.kind === 'quote') {
      const value = Number(String(quoteValueInput).replace(/[^\d.]/g, ''));
      await moveLead(modal.lead, 'bao_gia', {
        quote_url: quoteUrl.trim(),
        expected_value: value,
        audit_note: 'Gắn báo giá trên Kanban',
      });
      return;
    }
    if (modal.kind === 'lost') {
      const reason = lostReasons.find((row) => row.id === lostReason);
      await moveLead(modal.lead, 'lost', {
        lost_reason: lostReason,
        lost_reason_note: lostNote,
        audit_note: lostNote || reason?.label || lostReason,
      });
      return;
    }
    if (modal.kind === 'nurture') {
      const parsed = new Date(callbackAt);
      await moveLead(modal.lead, 'nurture', {
        next_call_at: Number.isNaN(parsed.getTime()) ? callbackAt : parsed.toISOString(),
        audit_note: 'Hẹn gọi lại',
      });
    }
  }

  async function runStatusAction(leadId: number, action: KanbanCardAction) {
    if (!token || !action.nextStatus) return;
    setBusyId(leadId);
    setErr('');
    setMsg('');
    try {
      await patchLead(token, leadId, {
        status: action.nextStatus,
        audit_note: action.auditNote ?? action.label,
      });
      setMsg(`Lead #${leadId}: ${action.label}`);
      onLeadUpdated?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cập nhật trạng thái thất bại');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="crm-kanban" data-testid="crm-leads-kanban">
      {msg ? (
        <p className="muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
          {msg}
        </p>
      ) : null}
      {err ? (
        <p className="error" style={{ gridColumn: '1 / -1', margin: 0 }} role="alert">
          {err}
        </p>
      ) : null}
      {columns.map((column) => {
        const items = column.items;
        const isCollapsed = column.collapsible && collapsed[column.key];
        const valueSum = items.reduce((sum, lead) => sum + (Number(lead.expected_value) || 0), 0);
        return (
          <div
            key={column.key}
            className={`crm-kanban-column${isCollapsed ? ' is-collapsed' : ''}${
              dragOver === column.key ? ' is-drop' : ''
            }`}
            style={{ ['--kanban-accent' as string]: kanbanStageAccent(column.accent) }}
            onDragOver={(event) => {
              if (!b2b) return;
              event.preventDefault();
              setDragOver(column.key);
            }}
            onDragLeave={() => setDragOver((current) => (current === column.key ? '' : current))}
            onDrop={(event) => onDropLead(column.key, event)}
          >
            <div className="crm-kanban-column__head">
              <span className="crm-kanban-column__title">{column.title}</span>
              <span className="crm-kanban-column__count">{items.length}</span>
              {column.collapsible ? (
                <button
                  type="button"
                  className="crm-kanban-column__toggle"
                  onClick={() =>
                    setCollapsed((current) => ({ ...current, [column.key]: !current[column.key] }))
                  }
                >
                  {isCollapsed ? 'Mở' : 'Gọn'}
                </button>
              ) : null}
            </div>
            {column.sum ? (
              <span className="crm-kanban-column__sum">{formatVnd(valueSum)}</span>
            ) : null}
            <div className="crm-kanban-column__body">
              {items.length === 0 ? (
                <p className="crm-kanban-empty">Trống</p>
              ) : (
                items.map((lead) => {
                  const band = lead.ai_band ?? null;
                  const actions = kanbanCardActions(lead);
                  const sla = slaLabel(lead.sla_state);
                  const bandText = bandLabel(band);
                  return (
                    <article
                      key={lead.id}
                      className={`crm-kanban-card${band ? ` crm-kanban-card--${band}` : ''}`}
                      data-testid={`kanban-card-${lead.id}`}
                      draggable={b2b}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', String(lead.id));
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                    >
                      <div className="crm-kanban-card__chips">
                        {bandText ? (
                          <span className={`crm-kanban-card__chip crm-kanban-card__chip--${band}`}>
                            {bandText}
                          </span>
                        ) : (
                          <span className="crm-kanban-card__chip crm-kanban-card__chip--ai">AI</span>
                        )}
                        {sla ? (
                          <span className="crm-kanban-card__chip crm-kanban-card__chip--sla">{sla}</span>
                        ) : null}
                      </div>
                      <Link href={`/crm/leads/${lead.id}`} className="crm-kanban-card__title">
                        {lead.full_name || `Lead #${lead.id}`}
                      </Link>
                      <div className="crm-kanban-card__meta">
                        {lead.phone ? <span>{lead.phone}</span> : null}
                        {lead.project_code ? <span>· {lead.project_code}</span> : null}
                      </div>
                      <div className="crm-kanban-card__actions">
                        {actions.map((action) => (
                          <ActionButton
                            key={`${lead.id}-${action.kind}-${action.label}`}
                            action={action}
                            busy={busyId === lead.id}
                            onAction={(a) => void runStatusAction(lead.id, a)}
                          />
                        ))}
                      </div>
                      <div className="crm-kanban-card__footer">
                        <span>#{lead.id}</span>
                        <span>{formatWhen(lead.received_at || lead.created_at)}</span>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      {modal ? (
        <div className="crm-kanban-modal" role="dialog" aria-modal="true" aria-label="Bổ sung để chuyển trạng thái">
          <form
            className="crm-kanban-modal__card"
            onSubmit={(event) => {
              event.preventDefault();
              void submitModal();
            }}
          >
            <strong>{modal.lead.full_name || `Lead #${modal.lead.id}`}</strong>
            <p className="muted" style={{ margin: 0 }}>{modal.message}</p>
            {modal.kind === 'contact' ? (
              <label>
                Nội dung cuộc gọi hoặc activity
                <textarea value={contactNote} onChange={(event) => setContactNote(event.target.value)} required minLength={3} rows={3} />
              </label>
            ) : null}
            {modal.kind === 'quote' ? (
              <>
                <label>
                  Link báo giá
                  <input value={quoteUrl} onChange={(event) => setQuoteUrl(event.target.value)} required placeholder="https://" />
                </label>
                <label>
                  Giá trị dự kiến (VND)
                  <input value={quoteValueInput} onChange={(event) => setQuoteValueInput(event.target.value)} required inputMode="numeric" />
                </label>
              </>
            ) : null}
            {modal.kind === 'lost' ? (
              <>
                <label>
                  Lý do
                  <select value={lostReason} onChange={(event) => setLostReason(event.target.value)}>
                    {lostReasons.map((reason) => (
                      <option key={reason.id} value={reason.id}>{reason.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Ghi chú
                  <textarea value={lostNote} onChange={(event) => setLostNote(event.target.value)} rows={3} />
                </label>
              </>
            ) : null}
            {modal.kind === 'nurture' ? (
              <label>
                Ngày hẹn gọi lại
                <input type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} required />
              </label>
            ) : null}
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-sm" onClick={() => setModal(null)}>Đóng</button>
              {modal.kind === 'error' ? null : (
                <button type="submit" className="btn btn-sm" disabled={busyId != null}>Lưu và chuyển</button>
              )}
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

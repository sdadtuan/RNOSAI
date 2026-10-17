'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import type { LeadRow } from '@/lib/api';
import { ApiError, fetchLeadStatusOptions, patchLead, postKanbanCall } from '@/lib/api';
import { LeadKanbanCareDrawer } from '@/components/crm/LeadKanbanCareDrawer';
import {
  kanbanCardActions,
  kanbanStageAccent,
  type KanbanCardAction,
} from '@/lib/crm/kanban-card-cta';
import {
  B2B_KANBAN_COLUMNS,
  kanbanColumnIdForStatus,
  bucketLeadsByKanbanColumns,
  bucketLeadsByKanbanStage,
  leadStatusLabel,
  leadStatusTone,
} from '@/lib/crm/lead-status';
import { KANBAN_COLUMN_PAGE, sortKanbanLeads } from '@/lib/crm/kanban-column.util';
import { leadCareChip, leadFollowup, type LeadFollowupKind } from '@/lib/crm/lead-followup';
import { formatLeadArrived } from '@/lib/crm/lead-arrived';
import { leadListSituation } from '@/lib/crm/lead-list-situation';
import { statusOptionsForFlowKind, type LeadFlowKind } from '@/lib/crm/lead-flow-kind';

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

function legacySlaLabel(sla: LeadRow['sla_state']): string | null {
  if (sla === 'breach') return 'SLA trễ';
  if (sla === 'warning') return 'SLA gần';
  return null;
}

function slaLabel(lead: LeadRow): string | null {
  if (lead.sla_state === 'breach') {
    const minutes = Math.max(0, Math.round(Number(lead.sla_late_minutes ?? 0)));
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const rest = minutes % 60;
      return rest ? `SLA trễ +${hours}h${rest}p` : `SLA trễ +${hours}h`;
    }
    return `SLA trễ +${minutes}p`;
  }
  if (lead.sla_state === 'warning') return 'Sắp trễ';
  return null;
}

function stoodLabel(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes)) return null;
  const rounded = Math.max(0, Math.round(minutes));
  if (rounded < 60) return `Đứng ${rounded}p`;
  const hours = Math.floor(rounded / 60);
  if (hours < 48) return `Đứng ${hours}h`;
  return `Đứng ${Math.floor(hours / 24)} ngày`;
}

function ownerInitials(name: string | null | undefined): string {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '';
  return parts
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function phoneIsHidden(phone: string | null | undefined): boolean {
  return /[*×]/.test(String(phone ?? ''));
}

function ActionButton({
  action,
  busy,
  interceptBoard,
  onAction,
}: {
  action: KanbanCardAction;
  busy: boolean;
  interceptBoard?: boolean;
  onAction: (action: KanbanCardAction) => void;
}) {
  const ctaClass = `btn btn-sm crm-kanban-card__cta crm-kanban-card__cta--${action.kind}${
    action.primary ? ' is-primary' : ''
  }`;
  if (interceptBoard && (action.kind === 'call' || action.kind === 'care')) {
    return (
      <button type="button" className={ctaClass} disabled={busy} onClick={() => onAction(action)}>
        {busy ? '…' : action.label}
      </button>
    );
  }
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
  canChangeOwner = false,
  onLeadUpdated,
  readOnly = false,
}: {
  rows: LeadRow[];
  flowKind?: LeadFlowKind;
  token?: string;
  canChangeOwner?: boolean;
  onLeadUpdated?: () => void;
  readOnly?: boolean;
}) {
  const b2b = flowKind === 'b2b_prospect';
  const stages = statusOptionsForFlowKind(flowKind);
  const { stageKeys, byStage } = bucketLeadsByKanbanStage(rows, stages);
  const byColumn = bucketLeadsByKanbanColumns(rows, B2B_KANBAN_COLUMNS);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const collapsedByUser = useRef(new Set<string>());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    won: true,
    lost: true,
    nurture: true,
  });
  useEffect(() => {
    if (!b2b) return;
    setCollapsed((current) => {
      const next = { ...current };
      let changed = false;
      for (const column of B2B_KANBAN_COLUMNS) {
        if (!column.collapsible || collapsedByUser.current.has(column.id)) continue;
        if ((byColumn[column.id] ?? []).length > 0 && next[column.id]) {
          next[column.id] = false;
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [b2b, rows, byColumn]);
  const [dragOver, setDragOver] = useState('');
  const [modal, setModal] = useState<MoveModal | null>(null);
  const [lostReasons, setLostReasons] = useState<LostReason[]>(LOST_REASON_SEED);
  const [contactNote, setContactNote] = useState('');
  const [quoteUrl, setQuoteUrl] = useState('');
  const [quoteValueInput, setQuoteValueInput] = useState('');
  const [lostReason, setLostReason] = useState(LOST_REASON_SEED[0].id);
  const [lostNote, setLostNote] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [callLead, setCallLead] = useState<LeadRow | null>(null);
  const [callPhone, setCallPhone] = useState('');
  const [callResult, setCallResult] = useState<'answered' | 'no_answer' | 'unreachable' | 'wrong_number' | 'callback'>('answered');
  const [callNote, setCallNote] = useState('');
  const [callBackAt, setCallBackAt] = useState('');
  const [careLead, setCareLead] = useState<LeadRow | null>(null);
  const [columnLimit, setColumnLimit] = useState<Record<string, number>>({});
  const [followupFilter, setFollowupFilter] = useState<LeadFollowupKind | ''>('');

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
    if (!b2b || readOnly) return;
    const leadId = Number(event.dataTransfer.getData('text/plain'));
    const lead = rows.find((row) => row.id === leadId);
    if (!lead) return;
    const fromId = kanbanColumnIdForStatus(lead.status);
    if (!fromId || fromId === target) return;
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

  async function startCall(lead: LeadRow) {
    if (!token) return;
    if (phoneIsHidden(lead.phone)) {
      setErr('Số của lead này đã được che.');
      return;
    }
    setBusyId(lead.id);
    setErr('');
    try {
      const out = await postKanbanCall(token, lead.id, { phase: 'start' });
      const phone = out.phone || lead.phone;
      setCallLead(lead);
      setCallPhone(phone);
      setCallResult('answered');
      setCallNote('');
      setCallBackAt('');
      const dial = phone.replace(/[^\d+]/g, '');
      window.setTimeout(() => {
        window.location.href = `tel:${dial}`;
      }, 50);
      onLeadUpdated?.();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Không mở được cuộc gọi');
    } finally {
      setBusyId(null);
    }
  }

  async function submitCall() {
    if (!token || !callLead) return;
    setBusyId(callLead.id);
    setErr('');
    try {
      const out = await postKanbanCall(token, callLead.id, {
        phase: 'result',
        result: callResult,
        note: callNote,
        next_call_at:
          callResult === 'callback' && callBackAt ? new Date(callBackAt).toISOString() : undefined,
      });
      const lead = callLead;
      setCallLead(null);
      onLeadUpdated?.();
      if (out.suggest_lost) {
        setLostReason('wrong_number');
        await openLostModal(lead, 'Số sai. Có thể chuyển lead sang Thất bại.');
      } else {
        setMsg(`Đã ghi kết quả gọi cho #${lead.id}.`);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Không lưu được kết quả gọi');
    } finally {
      setBusyId(null);
    }
  }

  const followupCounts = rows.reduce(
    (counts, lead) => {
      const kind = leadFollowup(lead)?.kind;
      if (kind) counts[kind] += 1;
      return counts;
    },
    { no_answer: 0, busy: 0, callback: 0 } as Record<LeadFollowupKind, number>,
  );

  return (
    <div className="crm-kanban-wrap">
      {followupCounts ? (
        <div className="crm-kanban-followup" role="group" aria-label="Lead cần gọi lại">
          {(
            [
              ['no_answer', 'Không nghe máy'],
              ['busy', 'Máy bận'],
              ['callback', 'Hẹn gọi lại'],
            ] as const
          ).map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={`crm-kanban-followup__btn${followupFilter === kind ? ' is-on' : ''}`}
              aria-pressed={followupFilter === kind}
              onClick={() => setFollowupFilter((current) => (current === kind ? '' : kind))}
            >
              {label}
              <span>{followupCounts[kind]}</span>
            </button>
          ))}
        </div>
      ) : null}
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
        const items = followupFilter
          ? column.items.filter((lead) => leadFollowup(lead)?.kind === followupFilter)
          : column.items;
        const sortedItems = b2b ? sortKanbanLeads(items) : items;
        const visibleLimit = b2b ? columnLimit[column.key] ?? KANBAN_COLUMN_PAGE : sortedItems.length;
        const shownItems = sortedItems.slice(0, visibleLimit);
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
                  onClick={() => {
                    collapsedByUser.current.add(column.key);
                    setCollapsed((current) => ({ ...current, [column.key]: !current[column.key] }));
                  }}
                >
                  {isCollapsed ? 'Mở' : 'Gọn'}
                </button>
              ) : null}
            </div>
            {column.sum ? (
              <span className="crm-kanban-column__sum">{formatVnd(valueSum)}</span>
            ) : null}
            <div className="crm-kanban-column__body">
              {shownItems.length === 0 ? (
                <p className="crm-kanban-empty">Trống</p>
              ) : (
                shownItems.map((lead) => {
                  const band = lead.ai_band ?? null;
                  const actions = kanbanCardActions(lead);
                  const sla = b2b ? slaLabel(lead) : legacySlaLabel(lead.sla_state);
                  const bandText = bandLabel(band);
                  const tone = !b2b
                    ? band
                    : lead.sla_state === 'breach'
                      ? 'late'
                      : band === 'hot'
                        ? 'hot'
                        : 'plain';
                  const care = leadCareChip(lead);
                  const situation = leadListSituation(lead);
                  const showDeadline = care?.kind === 'deadline' && !situation.call;
                  const origin = [lead.project_code, lead.source || lead.channel].filter(Boolean).join(' · ');
                  const initials = ownerInitials(lead.owner_name);
                  const stood = stoodLabel(lead.column_minutes);
                  const stoodText = lead.stale
                    ? stood
                      ? `Đứng yên · ${stood.replace(/^Đứng /, '')}`
                      : 'Đứng yên'
                    : stood;
                  return (
                    <article
                      key={lead.id}
                      className={`crm-kanban-card${tone ? ` crm-kanban-card--${tone}` : ''}`}
                      data-testid={`kanban-card-${lead.id}`}
                      draggable={b2b && !readOnly}
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
                        <span className={`lead-status-badge lead-status-badge--${leadStatusTone(lead.status)}`}>
                          {situation.status}
                        </span>
                        {situation.call ? (
                          <span className="crm-kanban-card__chip crm-kanban-card__chip--followup">{situation.call}</span>
                        ) : null}
                        {situation.solution ? (
                          <span className="crm-kanban-card__chip crm-kanban-card__chip--sla">{situation.solution}</span>
                        ) : null}
                        {showDeadline ? (
                          <span className="crm-kanban-card__chip crm-kanban-card__chip--followup">{care?.label}</span>
                        ) : null}
                      </div>
                      <Link href={`/crm/leads/${lead.id}`} className="crm-kanban-card__title">
                        {lead.full_name || `Lead #${lead.id}`}
                      </Link>
                      <div className="crm-kanban-card__meta">
                        {lead.phone ? <span>{lead.phone}</span> : null}
                        {origin ? <span>· {origin}</span> : null}
                      </div>
                      {readOnly ? null : (
                      <div className="crm-kanban-card__actions">
                        {actions.map((action) => (
                          <ActionButton
                            key={`${lead.id}-${action.kind}-${action.label}`}
                            action={action}
                            busy={busyId === lead.id}
                            interceptBoard={b2b}
                            onAction={(chosen) => {
                              if (b2b && chosen.kind === 'call') {
                                void startCall(lead);
                                return;
                              }
                              if (b2b && chosen.kind === 'care') {
                                setCareLead(lead);
                                return;
                              }
                              void runStatusAction(lead.id, chosen);
                            }}
                          />
                        ))}
                      </div>
                      )}
                      <div className="crm-kanban-card__footer">
                        <div className="crm-kanban-card__footer-row">
                          <span>{formatLeadArrived(lead)}</span>
                          {b2b && initials ? (
                            <span className="crm-kanban-card__avatar" title={lead.owner_name ?? ''}>
                              {initials}
                            </span>
                          ) : null}
                        </div>
                        <div className="crm-kanban-card__footer-row">
                          <span>#{lead.id}</span>
                          {b2b && stoodText ? <span>{stoodText}</span> : null}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
              {b2b && sortedItems.length > shownItems.length ? (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() =>
                    setColumnLimit((current) => ({
                      ...current,
                      [column.key]: (current[column.key] ?? KANBAN_COLUMN_PAGE) + KANBAN_COLUMN_PAGE,
                    }))
                  }
                >
                  Xem thêm ({sortedItems.length - shownItems.length})
                </button>
              ) : null}
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
      {callLead ? (
        <div className="crm-kanban-modal" role="dialog" aria-modal="true" aria-label="Kết quả cuộc gọi">
          <form
            className="crm-kanban-modal__card"
            onSubmit={(event) => {
              event.preventDefault();
              void submitCall();
            }}
          >
            <strong>{callLead.full_name || `Lead #${callLead.id}`}</strong>
            <p className="muted" style={{ margin: 0 }}>
              {callPhone} — chọn kết quả để đóng.
            </p>
            <label>
              Kết quả
              <select value={callResult} onChange={(event) => setCallResult(event.target.value as typeof callResult)}>
                <option value="answered">Nghe máy</option>
                <option value="no_answer">Không nghe máy</option>
                <option value="unreachable">Máy bận</option>
                <option value="wrong_number">Sai số</option>
                <option value="callback">Hẹn gọi lại</option>
              </select>
            </label>
            {callResult === 'callback' ? (
              <label>
                Hẹn gọi lại
                <input type="datetime-local" value={callBackAt} onChange={(event) => setCallBackAt(event.target.value)} />
              </label>
            ) : null}
            <label>
              Ghi chú
              <textarea value={callNote} onChange={(event) => setCallNote(event.target.value)} rows={3} />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-sm" disabled={busyId != null}>
                Lưu kết quả
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {careLead && token ? (
        <LeadKanbanCareDrawer
          lead={careLead}
          token={token}
          canChangeOwner={canChangeOwner}
          onClose={() => setCareLead(null)}
          onChanged={() => onLeadUpdated?.()}
          onMove={(status) => {
            const lead = careLead;
            setCareLead(null);
            if (status === 'lost') {
              void openLostModal(lead, 'Chọn lý do thất bại.');
              return;
            }
            if (status === 'nurture') {
              setModal({ lead, target: 'nurture', kind: 'nurture', message: 'Chọn ngày hẹn gọi lại.' });
              return;
            }
            if (status === 'bao_gia') {
              setModal({ lead, target: 'bao_gia', kind: 'quote', message: 'Gắn link báo giá và giá trị.' });
              return;
            }
            void moveLead(lead, status);
          }}
        />
      ) : null}
    </div>
    </div>
  );
}

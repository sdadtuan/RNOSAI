'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LeadRow } from '@/lib/api';
import { patchLead } from '@/lib/api';
import {
  kanbanCardActions,
  kanbanStageAccent,
  type KanbanCardAction,
} from '@/lib/crm/kanban-card-cta';
import { bucketLeadsByKanbanStage, leadStatusLabel } from '@/lib/crm/lead-status';
import { statusOptionsForFlowKind, type LeadFlowKind } from '@/lib/crm/lead-flow-kind';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
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
  const stages = statusOptionsForFlowKind(flowKind);
  const { stageKeys, byStage } = bucketLeadsByKanbanStage(rows, stages);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

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
      {stageKeys.map((stage) => {
        const items = byStage[stage] ?? [];
        return (
          <div
            key={stage}
            className="crm-kanban-column"
            style={{ ['--kanban-accent' as string]: kanbanStageAccent(stage) }}
          >
            <div className="crm-kanban-column__head">
              <span className="crm-kanban-column__title">{leadStatusLabel(stage)}</span>
              <span className="crm-kanban-column__count">{items.length}</span>
            </div>
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
    </div>
  );
}

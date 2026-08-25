'use client';

import Link from 'next/link';
import type { LeadRow } from '@/lib/api';
import { kanbanCardCta, kanbanStageAccent } from '@/lib/crm/kanban-card-cta';
import { leadStatusLabel } from '@/lib/crm/lead-status';
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

export function LeadKanbanBoard({
  rows,
  flowKind = 'b2b_prospect',
}: {
  rows: LeadRow[];
  flowKind?: LeadFlowKind;
}) {
  const stages = statusOptionsForFlowKind(flowKind);
  const byStage: Record<string, LeadRow[]> = {};
  for (const st of stages) byStage[st] = [];
  for (const row of rows) {
    const st = String(row.status ?? 'moi');
    if (!byStage[st]) byStage[st] = [];
    byStage[st].push(row);
  }

  return (
    <div className="crm-kanban" data-testid="crm-leads-kanban">
      {stages.map((stage) => {
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
                  const cta = kanbanCardCta(lead);
                  const sla = slaLabel(lead.sla_state);
                  const bandText = bandLabel(band);
                  const ctaClass = `btn btn-sm crm-kanban-card__cta crm-kanban-card__cta--${cta.kind}`;
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
                      {cta.href.startsWith('tel:') ? (
                        <a href={cta.href} className={ctaClass}>
                          {cta.label}
                        </a>
                      ) : (
                        <Link href={cta.href} className={ctaClass}>
                          {cta.label}
                        </Link>
                      )}
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

'use client';

import { LeadMeetingPrepProgress } from '@/app/crm/leads/meeting-prep/LeadMeetingPrepProgress';
import { LeadMeetingPrepEntityPicker } from '@/app/crm/leads/meeting-prep/LeadMeetingPrepEntityPicker';
import { buildM1Script } from '@/app/crm/leads/meeting-prep/m1-script.util';
import { lmpSkipReasonMessageVi } from '@/app/crm/leads/meeting-prep/lmp-skip-reason-labels';
import type { LeadMeetingPrepResponse } from '@/app/crm/leads/meeting-prep/lead-meeting-prep.types';
import type { LeadNextAction, NextActionKind } from '@/lib/crm/lead-next-action';

type Props = {
  action: LeadNextAction;
  prep?: LeadMeetingPrepResponse | null;
  busy?: boolean;
  companyName: string;
  websiteUrl: string;
  onCompanyName: (v: string) => void;
  onWebsiteUrl: (v: string) => void;
  onAction: (kind: NextActionKind) => void;
  onPickEntity: (entityId: string) => void;
};

export function LeadNextActionCard({
  action,
  prep,
  busy,
  companyName,
  websiteUrl,
  onCompanyName,
  onWebsiteUrl,
  onAction,
  onPickEntity,
}: Props) {
  const opening =
    action.rule === 5 && prep?.status === 'ready' ? buildM1Script(prep).opening.slice(0, 280) : '';

  return (
    <section className="lead-nba" data-testid="lead-next-action" data-rule={action.rule}>
      <p className="lead-nba__kicker">Việc tiếp theo</p>
      <h2 className="lead-nba__title">{action.title_vi}</h2>
      <p className="lead-nba__body">{action.body_vi}</p>
      {action.rule === 4 && prep ? (
        <LeadMeetingPrepProgress
          status={prep.status}
          stepsCompleted={prep.progress?.steps_completed}
          message={prep.discover_message_vi || prep.progress?.message_vi}
        />
      ) : null}
      {opening ? <blockquote className="lead-nba__script">{opening}</blockquote> : null}
      {action.rule === 2 ? (
        <div className="lead-nba__form">
          <p>{lmpSkipReasonMessageVi(prep?.skip_reason ?? 'missing_company_name')}</p>
          <label>
            Tên công ty *
            <input value={companyName} onChange={(e) => onCompanyName(e.target.value)} required />
          </label>
          <label>
            Website (tuỳ chọn)
            <input value={websiteUrl} onChange={(e) => onWebsiteUrl(e.target.value)} />
          </label>
        </div>
      ) : null}
      {action.rule === 3 && prep?.entity_candidates?.length ? (
        <LeadMeetingPrepEntityPicker
          candidates={prep.entity_candidates}
          busy={busy}
          onSelect={(entityId) => onPickEntity(entityId)}
          discoverMode
        />
      ) : null}
      {action.rule !== 3 ? (
        <div className="lead-nba__actions">
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy || action.primary.action === 'wait_prep' || (action.rule === 2 && !companyName.trim())}
            onClick={() => onAction(action.primary.action)}
          >
            {action.primary.label_vi}
          </button>
          {action.secondary.map((s) => (
            <button
              key={s.action}
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={busy}
              onClick={() => onAction(s.action)}
            >
              {s.label_vi}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

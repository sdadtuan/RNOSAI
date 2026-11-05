'use client';

import type { LeadActivityRow } from '@/lib/api';
import { LeadPipelineIntakePanel } from '@/components/crm/LeadPipelineIntakePanel';
import type { IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';
import { normalizeLeadStatus } from '@/lib/crm/lead-status';

const NEEDS_CALL = new Set([
  'da_lien_he',
  'dang_tu_van',
  'hen_gap',
  'bao_gia',
  'proposal',
  'dam_phan',
  'won',
  'chot',
  'post_sale',
]);
const NEEDS_BANT = new Set(['bao_gia', 'proposal', 'dam_phan', 'won', 'chot', 'post_sale']);

export function LeadStageRecords({
  leadId,
  status,
  activities,
  intakeSummary,
  serviceSlug,
}: {
  leadId: number;
  status: string;
  activities: LeadActivityRow[];
  intakeSummary?: IntakeStepSummary | null;
  serviceSlug?: string | null;
}) {
  const stage = normalizeLeadStatus(status);
  const needsCall = NEEDS_CALL.has(stage);
  const needsBant = NEEDS_BANT.has(stage);
  const calls = activities.filter((row) => row.activity_type === 'call');
  const hasBant = Boolean(intakeSummary?.preview || intakeSummary?.latest_completed);

  if (!needsCall && !needsBant && !calls.length && !hasBant) {
    return null;
  }

  return (
    <section className="lead-zone" data-testid="lead-stage-records" style={{ marginTop: '0.75rem' }}>
      <span className="lead-zone__kicker">Hồ sơ đã có của lead</span>
      <div className="stack-gap" style={{ marginTop: '0.5rem' }}>
        {needsBant || hasBant ? (
          <LeadPipelineIntakePanel
            leadId={leadId}
            serviceSlug={serviceSlug}
            intakeSummary={intakeSummary}
          />
        ) : null}

        {needsCall || calls.length ? (
          <div data-testid="lead-stage-calls">
            <strong>Cuộc gọi</strong>
            {calls.length ? (
              <ul style={{ margin: '0.35rem 0 0', paddingLeft: '1.1rem' }}>
                {calls.slice(0, 3).map((row) => (
                  <li key={row.id}>{row.content?.trim() || 'Đã gọi'}</li>
                ))}
              </ul>
            ) : (
              <p className="muted" style={{ margin: '0.35rem 0 0' }}>
                Chưa có cuộc gọi.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

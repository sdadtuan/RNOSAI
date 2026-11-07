'use client';

import { LeadPipelineIntakePanel } from '@/components/crm/LeadPipelineIntakePanel';
import type { IntakeStepSummary } from '@/lib/crm/funnel-stepper.types';
import { normalizeLeadStatus } from '@/lib/crm/lead-status';

const NEEDS_BANT = new Set(['bao_gia', 'proposal', 'dam_phan', 'won', 'chot', 'post_sale']);

export function LeadStageRecords({
  leadId,
  status,
  intakeSummary,
  serviceSlug,
}: {
  leadId: number;
  status: string;
  intakeSummary?: IntakeStepSummary | null;
  serviceSlug?: string | null;
}) {
  const stage = normalizeLeadStatus(status);
  const needsBant = NEEDS_BANT.has(stage);
  const hasBant = Boolean(intakeSummary?.preview || intakeSummary?.latest_completed);

  if (!needsBant && !hasBant) {
    return null;
  }

  return (
    <section className="lead-zone" data-testid="lead-stage-records" style={{ marginTop: '0.75rem' }}>
      <span className="lead-zone__kicker">Hồ sơ đã có của lead</span>
      <div className="stack-gap" style={{ marginTop: '0.5rem' }}>
        <LeadPipelineIntakePanel
          leadId={leadId}
          serviceSlug={serviceSlug}
          intakeSummary={intakeSummary}
        />
      </div>
    </section>
  );
}

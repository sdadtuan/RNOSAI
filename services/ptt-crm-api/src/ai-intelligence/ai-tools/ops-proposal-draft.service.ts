import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SERVICE_LABELS } from '../../leads-contract/lifecycle-workflow-steps.util';
import { CONSULT_SERVICE_OK, parseServiceStatus } from './ops-consult-ready.util';
import { statusSatisfiesGate } from './ops-field-quality.util';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import { readP8QualityFromForms } from './ops-p8-quality-state.util';
import type { ProposalDraftResult } from './ops-presales-p8.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function trim(value: unknown, max = 800): string {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}

function maskPii(text: string): string {
  return text
    .replace(/\b0\d{9,10}\b/g, '[phone]')
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/gi, '[email]');
}

@Injectable()
export class OpsProposalDraftService {
  constructor(private readonly repo: OpsPresalesContextRepository) {}

  async draftFromConsult(
    input: Record<string, unknown>,
    actor: string,
  ): Promise<ProposalDraftResult> {
    const dryRun = Boolean(input.dry_run ?? input.dryRun);
    const leadId = positiveInt(input.lead_id ?? input.leadId);
    let lifecycleId = positiveInt(input.lifecycle_id ?? input.lifecycleId);
    if (lifecycleId == null && leadId != null) {
      lifecycleId = (await this.repo.findLifecycleByLead(leadId))?.id;
    }
    if (lifecycleId == null) {
      throw new BadRequestException({ error: 'lifecycle_id_required' });
    }

    const lifecycle = await this.repo.getLifecycleDetail(lifecycleId);
    if (!lifecycle) {
      throw new NotFoundException({ error: 'lifecycle_not_found', lifecycle_id: lifecycleId });
    }

    const leadTask = await this.repo.getStageTask(lifecycleId, 'lead');
    const consultTask = await this.repo.getStageTask(lifecycleId, 'consult');
    const quality = readP8QualityFromForms({
      leadForm: leadTask?.form_data,
      consultForm: consultTask?.form_data,
    });

    const blockers: string[] = [];
    if (!CONSULT_SERVICE_OK.has(quality.service_status)) {
      blockers.push(`service_status=${quality.service_status}`);
    }
    if (quality.need_pain.status === 'empty') {
      blockers.push('pain_empty');
    }
    if (blockers.length) {
      throw new UnprocessableEntityException({
        error: 'insufficient_for_proposal',
        blockers,
      });
    }

    const watermark = !statusSatisfiesGate(quality.need_pain);
    const serviceSlug =
      trim(lifecycle.service_slug) ||
      trim((quality.service_recommendation as { primary?: { sku?: string } } | undefined)?.primary?.sku) ||
      'lead-gen';
    const serviceLabel = SERVICE_LABELS[serviceSlug] ?? serviceSlug;

    const body = maskPii(
      [
        watermark ? '*** CHƯA CONFIRM — DRAFT ONLY — KHÔNG GỬI KHÁCH ***' : 'DRAFT ONLY — never auto-send',
        `Scope: ${serviceLabel}`,
        `Pain: ${trim(quality.need_pain.text, 600) || 'TBD'}`,
        `ICP / Đối tượng: ${trim(quality.icp.text, 600) || 'TBD'}`,
        '',
        'Package A (Starter): onboarding + setup tracking + 1 kênh chính — pricing TBD (price book).',
        'Package B (Growth): A + creative test + dashboard — pricing TBD.',
        '',
        'Assumptions: ngân sách media/fee chưa chốt; không bịa số hợp đồng.',
        'Exclusions: không bao gồm production lớn / retainer CSKH ngoài scope.',
        `Drafted by ${actor} via proposal.draft_from_consult`,
      ].join('\n'),
    );

    if (dryRun) {
      return {
        ok: true,
        phase: 'P8',
        proposal_id: 0,
        status: 'draft',
        watermark,
        never_sent: true,
        links: [`/crm/service-delivery/${lifecycleId}`],
      };
    }

    const proposalId = await this.repo.createProposalDraft({
      leadId: leadId ?? lifecycle.lead_id,
      lifecycleId,
      title: `Proposal draft — ${serviceLabel}`,
      notes: body,
      serviceSlug,
      aiOutput: {
        tool: 'proposal.draft_from_consult',
        watermark,
        never_sent: true,
        service_status: quality.service_status,
        pain_status: quality.need_pain.status,
        drafted_by: actor,
        drafted_at: new Date().toISOString(),
        packages: ['A', 'B'],
      },
    });

    return {
      ok: true,
      phase: 'P8',
      proposal_id: proposalId,
      status: 'draft',
      watermark,
      never_sent: true,
      links: [
        `/crm/service-delivery/${lifecycleId}`,
        `/crm/proposals/${proposalId}`,
      ],
    };
  }
}

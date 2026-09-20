import {
  BadRequestException,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import { OpsPresalesContextService } from './ops-presales-context.service';
import type { InsightDraftResult } from './ops-presales-p7.types';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function trim(value: unknown, max = 600): string {
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
export class OpsInsightDraftService {
  constructor(
    private readonly repo: OpsPresalesContextRepository,
    private readonly presales: OpsPresalesContextService,
  ) {}

  async draftFromPresales(
    input: Record<string, unknown>,
    actor: string,
  ): Promise<InsightDraftResult> {
    if (input.status === 'approved' || input.approve === true) {
      throw new BadRequestException({
        error: 'cannot_approve_via_tool',
        message: 'insight.draft_from_presales cannot approve insights',
      });
    }

    const dryRun = Boolean(input.dry_run ?? input.dryRun);
    const pack = await this.presales.buildPack(input);
    const tmmt = pack.presales.tmmt;
    const bant = pack.presales.bant;
    const contract = pack.presales.contract;
    const clientId = pack.client.id || pack.presales.hub_agency.client_id;
    const lifecycleId = tmmt.lifecycle_id;

    const blockers: string[] = [];
    if (!clientId) blockers.push('agency_client_missing');
    if (!bant.session_id && bant.score === '0/30') blockers.push('no_bant');
    if (tmmt.progress.startsWith('0/')) blockers.push('tmmt_empty');
    if (blockers.length >= 2 && !trim(tmmt.core_message) && !trim(contract.title)) {
      throw new UnprocessableEntityException({
        error: 'insufficient_presales',
        blockers,
        message: 'Presales pack too thin to draft insight',
      });
    }
    if (!clientId) {
      throw new UnprocessableEntityException({
        error: 'insufficient_presales',
        blockers: ['agency_client_missing'],
      });
    }

    const titleHint = trim(input.title) || trim(pack.client.name) || 'Presales';
    const bullets = [
      tmmt.geography_resolved ? 'Geography resolved in TMMT' : 'Geography still missing',
      `BANT ${bant.score} · ${bant.decision}`,
      `TMMT ${tmmt.progress} gate=${tmmt.gate_passed}`,
      contract.value_vnd != null
        ? `Contract value ${contract.value_vnd}₫ (media/fee split unknown)`
        : 'Contract value unknown',
      ...tmmt.audience_bullets.map((b) => trim(b, 200)).filter(Boolean).slice(0, 3),
      ...tmmt.channels.slice(0, 4).map((c) => `Channel: ${c}`),
    ].filter(Boolean);

    const summary = maskPii(
      [
        `Presales insight draft for ${titleHint}.`,
        tmmt.core_message ? `Core message: ${tmmt.core_message}` : '',
        `Sources: Intake/BANT ${bant.score}, TMMT ${tmmt.progress}, contract #${contract.id ?? 'n/a'}.`,
        'Status: pending human review - tool cannot approve.',
      ]
        .filter(Boolean)
        .join(' '),
    );

    if (dryRun) {
      return {
        ok: true,
        phase: 'P7',
        insight_id: 0,
        project_id: 0,
        status: 'pending_review',
        summary,
        bullets,
        evidence_links: pack.links.slice(0, 5),
        cannot_approve_via_tool: true,
        links: lifecycleId ? [`/crm/service-delivery/${lifecycleId}?tab=tmmt`] : [],
      };
    }

    const projectId = await this.repo.findOrCreatePresalesResearchProject({
      clientId,
      lifecycleId,
      title: `[P7] Presales insight — ${titleHint}`.slice(0, 240),
      actor: actor || 'ai-tool',
    });

    const created = await this.repo.createPendingInsight({
      projectId,
      statement: summary.slice(0, 2000),
      observation: maskPii(bullets.join('\n')),
      interpretation: maskPii(
        [
          `TMMT missing: ${(tmmt.missing_fields ?? []).slice(0, 6).join(', ') || '—'}`,
          `Hub campaign map rows: ${pack.presales.hub_agency.campaign_map_rows}`,
          `Contract map: ${contract.map_status}`,
        ].join('\n'),
      ),
      implication:
        'Cần AM/Marketing lead duyệt insight và hoàn TMMT/geo trước WinningPlanGate.',
      recommendation:
        'Duyệt insight → hoàn TMMT ≥6/12 + geography → Sinh plan review → CEO active.',
      actor: actor || 'ai-tool',
    });

    return {
      ok: true,
      phase: 'P7',
      insight_id: created.id,
      project_id: projectId,
      status: 'pending_review',
      summary,
      bullets,
      evidence_links: pack.links.slice(0, 5),
      cannot_approve_via_tool: true,
      links: [
        `/crm/research/projects/${projectId}`,
        lifecycleId ? `/crm/service-delivery/${lifecycleId}?tab=tmmt` : '',
      ].filter(Boolean),
    };
  }
}

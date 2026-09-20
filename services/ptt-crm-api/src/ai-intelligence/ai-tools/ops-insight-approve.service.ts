import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';
import {
  buildPresalesAssumedRubric,
  detectInsightOrigin,
  type InsightOrigin,
} from './ops-insight-origin.util';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export type InsightApproveMode = 'auto' | 'presales_auto' | 'strict';

export type InsightApproveResult = {
  ok: true;
  phase: 'P8.3';
  insight_id: number;
  research_id: number;
  status: 'approved_internal';
  origin: InsightOrigin;
  path: 'presales_auto_seed' | 'strict' | 'already_approved';
  evidence_ids: number[];
  rubric_seeded: boolean;
  approved_count: number;
  winning_insight_ok: boolean;
  dry_run?: boolean;
  already_approved?: boolean;
  links: string[];
};

const APPROVABLE = new Set(['draft', 'evidence_attached', 'analyst_verified', 'peer_reviewed']);
const APPROVED = new Set(['approved_internal', 'approved_client_facing', 'published']);

/**
 * P8.3 — insight.approve with modes auto|presales_auto|strict.
 * Presales AI: Option A auto-seed verified evidence + assumed rubric → approved_internal.
 * Manual: strict Evidence+rubric (this tool rejects — use Research UI).
 */
@Injectable()
export class OpsInsightApproveService {
  constructor(private readonly repo: OpsPresalesContextRepository) {}

  async approve(input: Record<string, unknown>, actor: string): Promise<InsightApproveResult> {
    const insightId = positiveInt(input.insight_id ?? input.insightId);
    if (insightId == null) {
      throw new BadRequestException({ error: 'insight_id_required' });
    }
    const dryRun = Boolean(input.dry_run ?? input.dryRun);
    const mode = parseMode(input.mode);
    const target = String(input.target_status ?? input.targetStatus ?? 'approved_internal').trim();
    if (target !== 'approved_internal') {
      throw new BadRequestException({
        error: 'invalid_target',
        message: 'insight.approve only supports target_status=approved_internal',
      });
    }

    const row = await this.repo.getInsightById(insightId);
    if (!row) {
      throw new NotFoundException({ error: 'insight_not_found', insight_id: insightId });
    }

    const researchId = positiveInt(input.research_id ?? input.researchId) ?? row.project_id;
    if (researchId !== row.project_id) {
      throw new BadRequestException({
        error: 'research_id_mismatch',
        message: `insight ${insightId} belongs to research ${row.project_id}`,
      });
    }

    const origin = detectInsightOrigin(row);
    if (mode === 'presales_auto' && origin !== 'presales_ai') {
      throw new UnprocessableEntityException({
        ok: false,
        error: 'invalid_transition',
        blockers: ['not_presales_origin'],
        hint: 'mode=presales_auto requires origin=presales_ai (P7 draft). Use mode=auto or Research UI.',
      });
    }

    if (APPROVED.has(row.status)) {
      const approvedCount = await this.repo.countApprovedInsights(row.project_id);
      return {
        ok: true,
        phase: 'P8.3',
        insight_id: row.id,
        research_id: row.project_id,
        status: 'approved_internal',
        origin,
        path: 'already_approved',
        evidence_ids: row.evidence_ids,
        rubric_seeded: false,
        approved_count: approvedCount,
        winning_insight_ok: approvedCount >= 1,
        already_approved: true,
        dry_run: dryRun || undefined,
        links: [`/crm/research/${row.project_id}?tab=insights`],
      };
    }

    if (!APPROVABLE.has(row.status)) {
      throw new ConflictException({
        ok: false,
        error: 'invalid_transition',
        blockers: [`status_${row.status}`],
        from: row.status,
        target,
        hint: 'Insight must be draft|evidence_attached|analyst_verified|peer_reviewed',
      });
    }

    const usePresalesPath = mode !== 'strict' && origin === 'presales_ai';
    if (!usePresalesPath) {
      const blockers: string[] = [];
      if (row.evidence_ids.length < 1) blockers.push('evidence_required');
      blockers.push('rubric_required');
      throw new ConflictException({
        ok: false,
        error: 'invalid_transition',
        blockers,
        origin,
        hint:
          origin === 'presales_ai'
            ? 'mode=strict requires Evidence+rubric even for P7 drafts — use mode=auto'
            : 'Manual insights: attach verified evidence + 5-dim rubric in Research UI, then approve',
      });
    }

    const confidenceJson = buildPresalesAssumedRubric(row.confidence_json);
    confidenceJson.approved_via = 'presales_fast_path';
    const lifecycleHint =
      positiveInt(input.lifecycle_id ?? input.lifecycleId) ??
      positiveInt((row.confidence_json as { lifecycle_id?: unknown } | null)?.lifecycle_id);
    if (lifecycleHint) confidenceJson.lifecycle_id = lifecycleHint;

    if (dryRun) {
      const approvedCount = (await this.repo.countApprovedInsights(row.project_id)) + 1;
      return {
        ok: true,
        phase: 'P8.3',
        insight_id: row.id,
        research_id: row.project_id,
        status: 'approved_internal',
        origin: 'presales_ai',
        path: 'presales_auto_seed',
        evidence_ids: row.evidence_ids.length ? row.evidence_ids : [0],
        rubric_seeded: true,
        approved_count: approvedCount,
        winning_insight_ok: true,
        dry_run: true,
        links: [`/crm/research/${row.project_id}?tab=insights`],
      };
    }

    let evidenceIds = [...row.evidence_ids];
    if (evidenceIds.length < 1) {
      evidenceIds = await this.repo.seedPresalesEvidenceAndRubric({
        insightId: row.id,
        projectId: row.project_id,
        actor: actor || 'ai-tool',
        excerpt: maskPii(
          [
            row.statement.slice(0, 400),
            String(row.confidence_rationale ?? ''),
            'Sources: BANT / TMMT / contract cites from insight.draft_from_presales',
          ]
            .filter(Boolean)
            .join(' · '),
        ),
        confidenceJson,
      });
    } else {
      await this.repo.patchInsightConfidence({
        insightId: row.id,
        confidenceJson,
      });
    }

    const updated = await this.repo.approveAiInsightInternal({
      insightId: row.id,
      projectId: row.project_id,
      reviewer: actor || 'ai-tool',
      comments: String(
        input.comments ?? 'insight.approve — P8.3 presales_auto_seed',
      ).slice(0, 500),
    });
    if (!updated) {
      throw new ConflictException({
        ok: false,
        error: 'approve_failed',
        insight_id: insightId,
      });
    }

    const approvedCount = await this.repo.countApprovedInsights(row.project_id);
    return {
      ok: true,
      phase: 'P8.3',
      insight_id: updated.id,
      research_id: updated.project_id,
      status: 'approved_internal',
      origin: 'presales_ai',
      path: 'presales_auto_seed',
      evidence_ids: evidenceIds,
      rubric_seeded: true,
      approved_count: approvedCount,
      winning_insight_ok: approvedCount >= 1,
      links: [`/crm/research/${updated.project_id}?tab=insights`],
    };
  }
}

function parseMode(raw: unknown): InsightApproveMode {
  const m = String(raw ?? 'auto').trim().toLowerCase();
  if (m === 'presales_auto' || m === 'strict' || m === 'auto') return m;
  return 'auto';
}

function maskPii(text: string): string {
  return text
    .replace(/\b0\d{9,10}\b/g, '[phone]')
    .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/gi, '[email]');
}

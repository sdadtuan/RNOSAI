import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OpsPresalesContextRepository } from './ops-presales-context.repository';

function positiveInt(raw: unknown): number | undefined {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

export type InsightApproveResult = {
  ok: true;
  phase: 'P7';
  insight_id: number;
  project_id: number;
  status: 'approved_internal';
  previous_status: string;
  ai_generated: boolean;
  dry_run?: boolean;
  links: string[];
};

/**
 * P7 — human-approved insight.approve for AI presales drafts.
 * Sets approved_internal so WinningPlanGate approved_insight_count increments.
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

    const from = String(row.status ?? '');
    const aiGenerated = Boolean(row.ai_generated);
    const allowedFrom = new Set(['draft', 'evidence_attached', 'analyst_verified', 'peer_reviewed']);
    if (!aiGenerated) {
      throw new ConflictException({
        error: 'not_ai_draft',
        message: 'insight.approve is for ai_generated P7 drafts only — use Research UI for analyst insights',
      });
    }
    if (!allowedFrom.has(from)) {
      throw new ConflictException({
        error: 'invalid_transition',
        from,
        target,
      });
    }
    if (from === 'approved_internal' || from === 'approved_client_facing' || from === 'published') {
      return {
        ok: true,
        phase: 'P7',
        insight_id: row.id,
        project_id: row.project_id,
        status: 'approved_internal',
        previous_status: from,
        ai_generated: aiGenerated,
        dry_run: dryRun || undefined,
        links: [`/crm/research/${row.project_id}`],
      };
    }

    if (dryRun) {
      return {
        ok: true,
        phase: 'P7',
        insight_id: row.id,
        project_id: row.project_id,
        status: 'approved_internal',
        previous_status: from,
        ai_generated: aiGenerated,
        dry_run: true,
        links: [`/crm/research/${row.project_id}`],
      };
    }

    const updated = await this.repo.approveAiInsightInternal({
      insightId: row.id,
      projectId: row.project_id,
      reviewer: actor || 'ai-tool',
      comments: String(input.comments ?? 'insight.approve — P7 AI draft').slice(0, 500),
    });
    if (!updated) {
      throw new ConflictException({ error: 'approve_failed', insight_id: insightId });
    }

    return {
      ok: true,
      phase: 'P7',
      insight_id: updated.id,
      project_id: updated.project_id,
      status: 'approved_internal',
      previous_status: from,
      ai_generated: true,
      links: [`/crm/research/${updated.project_id}`],
    };
  }
}

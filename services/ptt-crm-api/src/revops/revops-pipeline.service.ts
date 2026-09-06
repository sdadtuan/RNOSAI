import { Injectable } from '@nestjs/common';
import { classifyDealRisk, weightedPipeline } from '../kpi-hub/command-center/command-center.util';
import { RevopsPipelineRepository } from './revops-pipeline.repository';
import {
  isRevopsPipelineDealStale,
  mapRevopsPipelineStage,
  REVOPS_PIPELINE_STAGES,
  REVOPS_STAGE_WEIGHT,
  revopsPipelineRiskLabel,
} from './revops-pipeline-stage.util';
import { resolveRevopsScope } from './revops-scope.util';
import type {
  RevopsDashboardActor,
  RevopsPipelineDto,
  RevopsPipelineQuery,
  RevopsPipelineStage,
} from './revops.types';

function stageAgeDays(stageEnteredAt: string | null, today: Date): number {
  if (!stageEnteredAt) return 0;
  const entered = new Date(stageEnteredAt);
  if (Number.isNaN(entered.getTime())) return 0;
  return Math.max(0, Math.floor((today.getTime() - entered.getTime()) / (24 * 60 * 60 * 1000)));
}

function emptyPipeline(view: 'kanban' | 'list'): RevopsPipelineDto {
  return {
    view,
    kpis: { totalVnd: null, weightedVnd: null, commitVnd: null, staleCount: 0 },
    columns: REVOPS_PIPELINE_STAGES.map((stage) => ({
      stage,
      count: 0,
      valueVnd: null,
      cards: [],
    })),
    fetchedAt: new Date().toISOString(),
  };
}

@Injectable()
export class RevopsPipelineService {
  constructor(private readonly repo: RevopsPipelineRepository) {}

  async get(actor: RevopsDashboardActor, query: RevopsPipelineQuery): Promise<RevopsPipelineDto> {
    const view = query.view === 'list' ? 'list' : 'kanban';
    const scope = resolveRevopsScope({ requested: query.scope, caps: actor.caps });
    const today = new Date();
    const todayIso = today.toISOString();

    let rows: Awaited<ReturnType<RevopsPipelineRepository['listDeals']>>;
    try {
      rows = await this.repo.listDeals({ scope, staffId: actor.staffId });
    } catch {
      return emptyPipeline(view);
    }

    const buckets = new Map<
      RevopsPipelineStage,
      RevopsPipelineDto['columns'][number]['cards']
    >();
    for (const stage of REVOPS_PIPELINE_STAGES) {
      buckets.set(stage, []);
    }

    let totalVnd = 0;
    let weightedVnd = 0;
    let hasTotal = false;
    let hasWeighted = false;
    let commitVnd = 0;
    let hasCommit = false;
    let staleCount = 0;

    for (const row of rows) {
      const stage = mapRevopsPipelineStage(row);
      const flags = classifyDealRisk({
        lastActivityAt: row.lastActivityAt,
        closeDate: row.closeDate,
        todayIso,
        hasQuote: row.hasProposal,
        hasNextStep: Boolean(row.stageEnteredAt),
        stageAgeDays: stageAgeDays(row.stageEnteredAt, today),
        noActivityDaysThreshold: 14,
      });
      if (isRevopsPipelineDealStale(row.closeDate, row.leadStatus, todayIso)) {
        staleCount += 1;
      }

      const card = {
        id: `lead-${row.leadId}`,
        leadId: row.leadId,
        name: row.name,
        product: row.product?.trim() || '—',
        amountVnd: row.amountVnd,
        closeDate: row.closeDate,
        owner: row.ownerName?.trim() || '—',
        risk: revopsPipelineRiskLabel(flags),
        href: `/crm/leads/${row.leadId}/deal-room`,
      };
      buckets.get(stage)?.push(card);

      if (row.amountVnd != null) {
        hasTotal = true;
        totalVnd += row.amountVnd;
        const weighted = weightedPipeline(row.amountVnd, REVOPS_STAGE_WEIGHT[stage]);
        if (weighted.value != null) {
          hasWeighted = true;
          weightedVnd += weighted.value;
        }
        if (stage === 'contract_review' || stage === 'negotiation') {
          hasCommit = true;
          commitVnd += row.amountVnd;
        }
      }
    }

    const columns = REVOPS_PIPELINE_STAGES.map((stage) => {
      const cards = buckets.get(stage) ?? [];
      const valueVnd = cards.reduce<number | null>((sum, card) => {
        if (card.amountVnd == null) return sum;
        return (sum ?? 0) + card.amountVnd;
      }, null);
      return {
        stage,
        count: cards.length,
        valueVnd,
        cards: view === 'list' ? cards : cards,
      };
    });

    return {
      view,
      kpis: {
        totalVnd: hasTotal ? totalVnd : null,
        weightedVnd: hasWeighted ? Math.round(weightedVnd) : null,
        commitVnd: hasCommit ? commitVnd : null,
        staleCount,
      },
      columns,
      fetchedAt: new Date().toISOString(),
    };
  }
}

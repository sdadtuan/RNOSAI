import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { QuoteBuilderActor } from '../../proposals/quote-builder.service';
import { QuoteBuilderService } from '../../proposals/quote-builder.service';
import { flagMaterialReconcileRows } from './service-kpi-change-order';
import { ServiceKpiOperationsService } from './service-kpi-operations.service';
import { ServiceKpiRepository } from './service-kpi.repository';

export type ChangeOrderPreview = {
  source_id: string;
  quote_context: {
    proposal_id: number;
    version_id: string;
    quote_code: string | null;
  } | null;
  rows: ReturnType<typeof flagMaterialReconcileRows>;
  material_count: number;
};

export type ChangeOrderResult = {
  change_order_id: string;
  source_id: string;
  proposal_id: number;
  from_version_id: string;
  new_version_id: string;
  version_n: number;
  material_count: number;
  delivered_snapshots: number;
  builder_href: string;
};

@Injectable()
export class ServiceKpiChangeOrderService {
  constructor(
    private readonly repo: ServiceKpiRepository,
    private readonly operations: ServiceKpiOperationsService,
    @Inject(forwardRef(() => QuoteBuilderService))
    private readonly quoteBuilder: QuoteBuilderService,
  ) {}

  async preview(sourceId: string): Promise<ChangeOrderPreview> {
    const trimmed = sourceId.trim();
    if (!trimmed) throw new BadRequestException({ error: 'source_id_required' });
    const reconcile = await this.operations.reconcile(trimmed);
    const rows = flagMaterialReconcileRows(reconcile.rows);
    const quoteContext = await this.repo.resolveQuoteContext(trimmed);
    return {
      source_id: trimmed,
      quote_context: quoteContext,
      rows,
      material_count: rows.filter((r) => r.material_variance).length,
    };
  }

  async create(
    sourceId: string,
    actor: QuoteBuilderActor,
    reason?: string,
  ): Promise<ChangeOrderResult> {
    const preview = await this.preview(sourceId);
    if (!preview.quote_context?.proposal_id) {
      throw new NotFoundException({ error: 'quote_context_not_found', source_id: preview.source_id });
    }
    const material = preview.rows.filter((r) => r.material_variance);
    if (!material.length) {
      throw new BadRequestException({ error: 'no_material_variance', source_id: preview.source_id });
    }

    const fromVersionId = preview.quote_context.version_id;
    const newVersion = await this.quoteBuilder.createRevision(preview.quote_context.proposal_id, actor);
    const changeOrderId = randomUUID();
    let deliveredSnapshots = 0;

    for (const row of material) {
      await this.repo.insertSnapshot({
        instance_id: row.instance_id,
        quote_version_id: newVersion.id,
        ledger: 'delivered',
        payload_json: {
          change_order_id: changeOrderId,
          change_order: true,
          from_version_id: fromVersionId,
          source_id: preview.source_id,
          reason: reason?.trim() || null,
          dictionary_id: row.dictionary_id,
          quoted: row.quoted,
          delivered: row.delivered,
          variance_pct: row.variance_pct,
          quality_status: row.quality_status,
          required_reviewers: ['Finance', 'GDKD'],
        },
      });
      deliveredSnapshots += 1;
    }

    return {
      change_order_id: changeOrderId,
      source_id: preview.source_id,
      proposal_id: preview.quote_context.proposal_id,
      from_version_id: fromVersionId,
      new_version_id: newVersion.id,
      version_n: newVersion.n,
      material_count: material.length,
      delivered_snapshots: deliveredSnapshots,
      builder_href: `/crm/proposals/${preview.quote_context.proposal_id}?tab=kpi`,
    };
  }
}

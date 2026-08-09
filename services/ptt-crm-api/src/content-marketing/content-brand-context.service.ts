import { Injectable } from '@nestjs/common';
import { buildBrandContextJson } from './content-plan-snapshot.util';
import { ContentMarketingRepository } from './content-marketing.repository';

@Injectable()
export class ContentBrandContextService {
  constructor(private readonly repo: ContentMarketingRepository) {}

  buildFromBrief(brief: Record<string, unknown>): Record<string, unknown> {
    return buildBrandContextJson(brief);
  }

  /** Merge sealed snapshot brand context + brief fallback for AI prompts (M3). */
  async resolveForLifecycle(lifecycleId: number): Promise<Record<string, unknown>> {
    const snapshot = await this.repo.getActiveSnapshotSummary(lifecycleId);
    if (snapshot?.brand_context_json && Object.keys(snapshot.brand_context_json).length) {
      return { ...snapshot.brand_context_json, _source: snapshot.sealed ? 'snapshot_sealed' : 'snapshot' };
    }
    const planner = await this.repo.loadPlannerSource(lifecycleId);
    if (planner?.brief_json) {
      return { ...this.buildFromBrief(planner.brief_json), _source: 'planner_brief' };
    }
    return { brand_name: 'Thương hiệu', _source: 'default' };
  }
}

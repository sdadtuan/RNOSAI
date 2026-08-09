import { Injectable } from '@nestjs/common';
import { ContentBrandContextService } from './content-brand-context.service';
import { ContentJobWorkerService } from './content-job-worker.service';
import { ContentMarketingRepository } from './content-marketing.repository';
import { ContentMarketingService } from './content-marketing.service';
import {
  aggregateIntelligence,
  buildTopicSuggestions,
  parseMetricsRange,
  summarizeMetrics,
} from './content-intelligence.util';
import type { CmktIntelligenceResponse, CmktJobRow, CmktMetricsSummaryResponse } from './content-marketing.types';

@Injectable()
export class ContentIntelligenceService {
  constructor(
    private readonly core: ContentMarketingService,
    private readonly repo: ContentMarketingRepository,
    private readonly brandContext: ContentBrandContextService,
    private readonly worker: ContentJobWorkerService,
  ) {}

  async getIntelligence(lifecycleId: number, rangeInput?: string | null): Promise<CmktIntelligenceResponse> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const range = parseMetricsRange(rangeInput);
    const rows = await this.repo.listLifecycleMetricsInRange(lifecycleId, range.fromDate, range.toDate);
    const publishedByChannel = await this.repo.countPublishedItemsByChannel(
      lifecycleId,
      range.fromDate,
      range.toDate,
    );
    const cached = await this.repo.getLatestTopicSuggestions(lifecycleId);
    return aggregateIntelligence(rows, range, publishedByChannel, cached);
  }

  async getMetricsSummary(
    lifecycleId: number,
    rangeInput?: string | null,
  ): Promise<CmktMetricsSummaryResponse> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const range = parseMetricsRange(rangeInput);
    const rows = await this.repo.listLifecycleMetricsInRange(lifecycleId, range.fromDate, range.toDate);
    const publishedByChannel = await this.repo.countPublishedItemsByChannel(
      lifecycleId,
      range.fromDate,
      range.toDate,
    );
    return summarizeMetrics(rows, range, publishedByChannel);
  }

  async getSuggestions(lifecycleId: number, rangeInput?: string | null): Promise<{ suggestions: string[] }> {
    const intel = await this.getIntelligence(lifecycleId, rangeInput);
    return { suggestions: intel.suggestions };
  }

  async startTopicSuggestJob(
    lifecycleId: number,
    body: Record<string, unknown>,
    actorEmail: string,
  ): Promise<CmktJobRow> {
    await this.core.ensureLifecycleEnabled(lifecycleId);
    const range = parseMetricsRange(body.range != null ? String(body.range) : '30d');
    const job = await this.repo.createContentJob({
      lifecycle_id: lifecycleId,
      item_id: null,
      job_type: 'topic_suggest',
      input_json: { range: range.range },
      created_by: actorEmail,
    });
    const finished = await this.worker.processJob(job.id);
    return finished ?? job;
  }

  async buildSuggestionsForLifecycle(lifecycleId: number, rangeInput?: string | null): Promise<string[]> {
    const range = parseMetricsRange(rangeInput);
    const [rows, publishedByChannel, brand, pillars] = await Promise.all([
      this.repo.listLifecycleMetricsInRange(lifecycleId, range.fromDate, range.toDate),
      this.repo.countPublishedItemsByChannel(lifecycleId, range.fromDate, range.toDate),
      this.brandContext.resolveForLifecycle(lifecycleId),
      this.repo.listPillars(lifecycleId),
    ]);
    const intelligence = aggregateIntelligence(rows, range, publishedByChannel);
    return buildTopicSuggestions({
      intelligence,
      pillarNames: pillars.map((p) => p.name),
      brandName: String(brand.brand_name ?? 'Brand'),
    });
  }
}

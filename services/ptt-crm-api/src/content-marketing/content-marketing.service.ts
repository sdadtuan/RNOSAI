import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { CMKT_P0_CHANNEL_DEFAULTS } from './content-marketing.constants';
import { computePlannerSourceHash } from './content-plan-snapshot.util';
import { ContentMarketingRepository } from './content-marketing.repository';
import type { CmktContextPayload } from './content-marketing.types';

@Injectable()
export class ContentMarketingService {
  constructor(
    private readonly config: AppConfigService,
    @Inject(forwardRef(() => ServiceLifecycleService))
    private readonly lifecycle: ServiceLifecycleService,
    private readonly repo: ContentMarketingRepository,
  ) {}

  assertEnabled(serviceSlug?: string): void {
    if (!this.config.contentMarketingEnabled) {
      throw new NotFoundException({ error: 'content_marketing_disabled' });
    }
    const slugs = this.config.contentMarketingSlugs;
    if (slugs.length && serviceSlug && !slugs.includes(serviceSlug)) {
      throw new ForbiddenException({
        error: 'content_marketing_slug_not_pilot',
        service_slug: serviceSlug,
      });
    }
  }

  private async loadLifecycleRow(id: number): Promise<Record<string, unknown>> {
    const detail = await this.lifecycle.detail(id);
    return detail as Record<string, unknown>;
  }

  async ensureLifecycleEnabled(lifecycleId: number): Promise<Record<string, unknown>> {
    const lc = await this.loadLifecycleRow(lifecycleId);
    this.assertEnabled(String(lc.service_slug ?? ''));
    return lc;
  }

  async getContext(lifecycleId: number): Promise<CmktContextPayload> {
    const lc = await this.ensureLifecycleEnabled(lifecycleId);
    const serviceSlug = String(lc.service_slug ?? '');

    const [snapshotRow, counts] = await Promise.all([
      this.repo.getActiveSnapshotSummary(lifecycleId),
      this.repo.getContextCounts(lifecycleId),
    ]);

    const plannerSource = await this.repo.loadPlannerSource(lifecycleId);
    const currentHash = plannerSource ? computePlannerSourceHash(plannerSource) : null;
    const plannerDrift =
      Boolean(snapshotRow?.source_hash) &&
      Boolean(currentHash) &&
      snapshotRow!.source_hash !== currentHash;

    return {
      ok: true,
      lifecycle_id: lifecycleId,
      service_slug: serviceSlug,
      stage: String(lc.stage ?? ''),
      enabled: true,
      snapshot: snapshotRow
        ? {
            id: snapshotRow.id,
            sealed: snapshotRow.sealed,
            pillars_count: snapshotRow.pillars_count,
            ingested_at: snapshotRow.ingested_at.toISOString(),
            marketing_plan_id: snapshotRow.marketing_plan_id,
            source_hash: snapshotRow.source_hash,
            planner_drift: plannerDrift,
          }
        : null,
      counts,
      flags: {
        ai_enabled: this.config.contentMarketingAiEnabled,
        approval_required: this.config.contentMarketingApprovalRequired,
        media_enabled: this.config.contentMarketingMediaEnabled,
        image_gen_enabled: this.config.contentMarketingImageGenEnabled,
        video_gen_enabled: this.config.contentMarketingVideoGenEnabled,
        client_gate: this.config.contentMarketingClientGate,
        portal_summary_enabled: this.config.contentMarketingPortalSummaryEnabled,
        fe_enabled: this.config.contentMarketingFeEnabled,
      },
      channel_defaults: [...CMKT_P0_CHANNEL_DEFAULTS],
    };
  }
}

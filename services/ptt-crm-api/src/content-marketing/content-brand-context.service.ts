import { Inject, Injectable, forwardRef } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { ServiceLifecycleService } from '../service-lifecycle/service-lifecycle.service';
import { buildBrandContextJson } from './content-plan-snapshot.util';
import {
  injectLifecyclePiiIntoBrandContext,
  resolvePiiConsent,
  sanitizeBrandContextForPrompt,
} from './content-pii-consent.util';
import { selectCopilotSources } from '../content-os-portfolio/copilot-insights.util';
import { selectCopilotGlossary } from '../content-os-portfolio/copilot-glossary.util';
import { ContentMarketingRepository } from './content-marketing.repository';

@Injectable()
export class ContentBrandContextService {
  constructor(
    private readonly config: AppConfigService,
    private readonly repo: ContentMarketingRepository,
    @Inject(forwardRef(() => ServiceLifecycleService))
    private readonly lifecycle: ServiceLifecycleService,
  ) {}

  buildFromBrief(brief: Record<string, unknown>): Record<string, unknown> {
    return buildBrandContextJson(brief);
  }

  /** Merge sealed snapshot brand context + brief fallback for AI prompts (M3). */
  async resolveForLifecycle(lifecycleId: number): Promise<Record<string, unknown>> {
    const snapshot = await this.repo.getActiveSnapshotSummary(lifecycleId);
    let merged: Record<string, unknown>;
    if (snapshot?.brand_context_json && Object.keys(snapshot.brand_context_json).length) {
      merged = { ...snapshot.brand_context_json, _source: snapshot.sealed ? 'snapshot_sealed' : 'snapshot' };
    } else {
      const planner = await this.repo.loadPlannerSource(lifecycleId);
      if (planner?.brief_json) {
        merged = { ...this.buildFromBrief(planner.brief_json), _source: 'planner_brief' };
      } else {
        merged = { brand_name: 'Thương hiệu', _source: 'default' };
      }
    }

    const lcCtx = await this.lifecycle.context(lifecycleId).catch(() => null);
    const piiConsent =
      resolvePiiConsent(merged, lcCtx) || this.config.contentMarketingPiiConsentDefault;
    const withPii = injectLifecyclePiiIntoBrandContext(merged, lcCtx, piiConsent);
    const sanitized = sanitizeBrandContextForPrompt(withPii, piiConsent);
    const insights =
      typeof this.repo.listInsightsForLifecycle === 'function'
        ? await this.repo.listInsightsForLifecycle(lifecycleId).catch(() => [])
        : [];
    const copilotSources = selectCopilotSources(insights);
    const glossary =
      typeof this.repo.listGlossaryForLifecycle === 'function'
        ? await this.repo.listGlossaryForLifecycle(lifecycleId).catch(() => [])
        : [];
    const copilotGlossary = selectCopilotGlossary(glossary);
    return { ...sanitized, pii_consent: piiConsent, copilotSources, copilotGlossary };
  }
}

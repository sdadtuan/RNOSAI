import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { assertPlannerAllowed, throwPlannerAllowResult } from './mkt-ai-planner-allow.util';
import { MktAiServicePolicyRepository } from './mkt-ai-service-policy.repository';

@Injectable()
export class MktAiPlannerAllowService {
  constructor(
    private readonly config: AppConfigService,
    private readonly policyRepo: MktAiServicePolicyRepository,
  ) {}

  async ensure(slug: string): Promise<void> {
    const policy = await this.policyRepo.getPolicy(slug);
    throwPlannerAllowResult(
      assertPlannerAllowed(slug ?? '', policy, {
        plannerEnabled: this.config.mktAiPlannerEnabled,
        envSlugs: this.config.mktAiPlannerSlugs,
        pilotOnly: this.config.mktAiPilotOnlyEnabled,
        pilotSlugs: this.config.mktAiPilotServiceSlugs,
      }),
    );
  }
}

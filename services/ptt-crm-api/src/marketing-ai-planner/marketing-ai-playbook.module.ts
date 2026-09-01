import { Module } from '@nestjs/common';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { MktAiPlaybookVersionsRepository } from './mkt-ai-playbook-versions.repository';
import { MktAiServicePolicyRepository } from './mkt-ai-service-policy.repository';

@Module({
  providers: [
    MarketingAiPlannerRepository,
    MktAiServicePolicyRepository,
    MktAiPlaybookVersionsRepository,
    MarketingAiPlaybookService,
  ],
  exports: [MarketingAiPlaybookService],
})
export class MarketingAiPlaybookModule {}

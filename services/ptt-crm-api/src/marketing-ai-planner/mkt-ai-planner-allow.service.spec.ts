import { ForbiddenException } from '@nestjs/common';
import { MktAiPlannerAllowService } from './mkt-ai-planner-allow.service';

describe('MktAiPlannerAllowService', () => {
  const config = {
    mktAiPlannerEnabled: true,
    mktAiPlannerSlugs: [] as string[],
    mktAiPilotOnlyEnabled: false,
    mktAiPilotServiceSlugs: [] as string[],
  };

  it('ensure does not throw when policy is pilot and env allows', async () => {
    const policyRepo = {
      getPolicy: jest.fn().mockResolvedValue({ rollout: 'pilot', enabled: true }),
    };
    const allow = new MktAiPlannerAllowService(config as never, policyRepo as never);
    await expect(allow.ensure('quang-cao-facebook')).resolves.toBeUndefined();
    expect(policyRepo.getPolicy).toHaveBeenCalledWith('quang-cao-facebook');
  });

  it('ensure throws Forbidden mkt_ai_service_not_enabled when policy is off', async () => {
    const policyRepo = {
      getPolicy: jest.fn().mockResolvedValue({ rollout: 'off', enabled: true }),
    };
    const allow = new MktAiPlannerAllowService(config as never, policyRepo as never);
    await expect(allow.ensure('seo-retainer')).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'mkt_ai_service_not_enabled' }),
    });
    await expect(allow.ensure('seo-retainer')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

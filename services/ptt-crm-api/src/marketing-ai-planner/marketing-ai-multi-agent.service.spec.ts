import { ServiceUnavailableException } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';
import { MarketingAiMultiAgentService } from './marketing-ai-multi-agent.service';
import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { MarketingAiPlannerService } from './marketing-ai-planner.service';

describe('MarketingAiMultiAgentService', () => {
  const config = {
    mktAiPlannerEnabled: true,
    mktAiMultiAgentEnabled: true,
  } as AppConfigService;

  const repo = {
    listJobs: jest.fn(),
    getBrief: jest.fn(),
    getDraft: jest.fn(),
    createJob: jest.fn(),
    finishJob: jest.fn(),
  } as unknown as MarketingAiPlannerRepository;

  const playbooks = {
    isEnabled: jest.fn().mockReturnValue(true),
    listForLifecycle: jest.fn().mockReturnValue({ active_slug: 'meta-lead-gen' }),
    mergeAndPersistPlaybook: jest.fn(),
  } as unknown as MarketingAiPlaybookService;

  const planner = {
    loadLifecyclePublic: jest.fn().mockResolvedValue({ service_slug: 'meta-lead-gen' }),
    assertEnabledPublic: jest.fn(),
    getOrchestratorModelName: jest.fn().mockReturnValue('gpt-4o-mini'),
    isStubMode: jest.fn().mockReturnValue(true),
    runStrategyJob: jest.fn().mockResolvedValue({ job_id: 11, status: 'succeeded' }),
    runCampaignJob: jest.fn().mockResolvedValue({ job_id: 12, status: 'succeeded' }),
    runContentJob: jest.fn().mockResolvedValue({ job_id: 13, status: 'succeeded' }),
    runQualityJob: jest.fn().mockResolvedValue({ job_id: 14, status: 'succeeded' }),
  } as unknown as MarketingAiPlannerService;

  const service = new MarketingAiMultiAgentService(config, repo, playbooks, planner);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.listJobs = jest.fn().mockResolvedValue([]);
    repo.getBrief = jest.fn().mockResolvedValue({
      brief_json: {
        brand_name: 'ACME',
        industry: 'Logistics',
        service_slug: 'meta-lead-gen',
        objective: 'lead',
        budget_monthly_vnd: 50_000_000,
        geo_markets: ['HCM'],
        challenges: 'CPL cao',
      },
    });
    repo.getDraft = jest.fn().mockResolvedValue({
      strategy_framework: { target_market: 'x' },
      target_market_prof: { segmentation_icp: 'y'.repeat(90) },
      swot_json: {},
      campaigns_json: [{ name: 'A', objective: 'lead', channel_mix: ['Meta', 'Google'], budget_pct: 50, kpis: ['CPL'] }],
      content_json: { calendar: [{ date: '2026-08-01' }] },
      quality_score_json: {},
    });
    repo.createJob = jest.fn().mockResolvedValue({ id: 99, status: 'running', input_json: {} });
    repo.finishJob = jest.fn().mockResolvedValue(null);
  });

  it('runs all pipeline steps and returns succeeded', async () => {
    const out = await service.run(1, {}, 'sp@test.vn');
    expect(out.status).toBe('succeeded');
    expect(out.output.child_jobs).toHaveLength(4);
    expect(planner.runStrategyJob).toHaveBeenCalled();
    expect(repo.finishJob).toHaveBeenCalled();
  });

  it('returns partial when a middle step fails', async () => {
    planner.runCampaignJob = jest
      .fn()
      .mockRejectedValue(new ServiceUnavailableException({ job_id: 22, message: 'fail' }));
    const out = await service.run(1, {}, 'sp@test.vn');
    expect(out.status).toBe('partial');
    expect(out.output.failed_step).toBe('planner');
    expect(out.output.child_jobs).toHaveLength(2);
  });

  it('getStatus derives step states from latest parent job', async () => {
    repo.listJobs = jest.fn().mockResolvedValue([
      {
        id: 99,
        job_type: 'multi_agent',
        status: 'succeeded',
        input_json: { steps: ['strategist', 'planner', 'copywriter', 'analyst'] },
        output_json: {
          pipeline_key: 'default_v1',
          playbook_slug: 'meta-lead-gen',
          child_jobs: [
            { step: 'strategist', job_id: 11, status: 'succeeded' },
            { step: 'planner', job_id: 12, status: 'failed' },
          ],
          failed_step: 'planner',
          quality_score: 55,
        },
      },
    ]);
    const status = await service.getStatus(1);
    expect(status.rollup_status).toBe('partial');
    expect(status.steps[0].state).toBe('succeeded');
    expect(status.steps[1].state).toBe('failed');
  });
});

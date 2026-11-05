import { MarketingAiPlaybookService } from './marketing-ai-playbook.service';
import { AppConfigService } from '../config/app-config.service';
import { MarketingAiPlannerRepository } from './marketing-ai-planner.repository';
import { MktAiPlaybookVersionsRepository } from './mkt-ai-playbook-versions.repository';
import { MktAiServicePolicyRepository } from './mkt-ai-service-policy.repository';

describe('MarketingAiPlaybookService', () => {
  const config = {
    mktAiPlannerEnabled: true,
    mktAiPlaybooksEnabled: true,
    mktAiGovernanceBanner: true,
    mktAiLaunchQaQualityGate: true,
    mktAiPlannerSlugs: ['meta-lead-gen'],
  } as AppConfigService;

  const repo = {
    getBrief: jest.fn(),
    getDraft: jest.fn(),
    upsertBrief: jest.fn(),
    ensureDraft: jest.fn(),
    upsertDraft: jest.fn(),
  } as unknown as MarketingAiPlannerRepository;

  const policyRepo = {
    getPolicyRow: jest.fn().mockResolvedValue(null),
  } as unknown as MktAiServicePolicyRepository;

  const versionsRepo = {
    getVersion: jest.fn().mockResolvedValue(null),
    getActiveVersion: jest.fn().mockResolvedValue(null),
    listVersionsBySlug: jest.fn().mockResolvedValue([]),
  } as unknown as MktAiPlaybookVersionsRepository;

  const service = new MarketingAiPlaybookService(config, repo, policyRepo, versionsRepo);

  beforeEach(() => {
    jest.clearAllMocks();
    (policyRepo.getPolicyRow as jest.Mock).mockResolvedValue(null);
    (versionsRepo.getVersion as jest.Mock).mockResolvedValue(null);
    (versionsRepo.getActiveVersion as jest.Mock).mockResolvedValue(null);
    (versionsRepo.listVersionsBySlug as jest.Mock).mockResolvedValue([]);
  });

  it('listForLifecycle filters pilot slugs', () => {
    const out = service.listForLifecycle('meta-lead-gen', null);
    expect(out.ok).toBe(true);
    expect(out.playbooks.some((p) => p.slug === 'meta-lead-gen')).toBe(true);
    expect(out.playbooks.some((p) => p.slug === 'seo-retainer')).toBe(false);
  });

  it('listForLifecycle always includes _common fallback', () => {
    const out = service.listForLifecycle('quang-cao-facebook', null);
    expect(out.playbooks.some((p) => p.slug === '_common')).toBe(true);
    expect(out.active_slug).toBe('_common');
  });

  it('resolvePlaybook falls back to _common for unknown service slug', async () => {
    const pb = await service.resolvePlaybook(null, 'quang-cao-facebook');
    expect(pb.slug).toBe('_common');
    expect(pb.label_vi).toBe('Playbook chung');
  });

  it('resolvePlaybook uses policy active version over disk meta-lead-gen', async () => {
    const customDoc = {
      slug: 'meta-lead-gen',
      label_vi: 'Custom Meta DB',
      service_slugs: ['meta-lead-gen'],
      brief_defaults: {},
      strategy_prompt_hints: ['custom hint from DB'],
      campaign_kpi_templates: ['Custom CPL ≤99k VND'],
      quality_gate: { min_score_launch_qa: 75, require_campaign_count: 2 },
    };

    (policyRepo.getPolicyRow as jest.Mock).mockResolvedValue({ active_version_id: 42 });
    (versionsRepo.getVersion as jest.Mock).mockResolvedValue({
      id: 42,
      service_slug: 'meta-lead-gen',
      status: 'active',
      document_json: customDoc,
    });

    const pb = await service.resolvePlaybook(null, 'meta-lead-gen');
    expect(pb.label_vi).toBe('Custom Meta DB');
    expect(pb.strategy_prompt_hints).toContain('custom hint from DB');
    expect(pb.campaign_kpi_templates[0]).toContain('Custom CPL');
    expect(versionsRepo.getActiveVersion).not.toHaveBeenCalledWith('meta-lead-gen');
  });

  it('buildPromptHints returns strategy and campaign blocks', async () => {
    const pb = await service.getPlaybook('meta-lead-gen');
    const hints = service.buildPromptHints(pb);
    expect(hints.strategyBlock).toContain('Industry playbook hints');
    expect(hints.campaignBlock).toContain('CPL Meta');
  });

  it('checkLaunchQaQualityGate uses draft quality score', async () => {
    repo.getBrief = jest.fn().mockResolvedValue({
      brief_json: { _playbook_slug: 'meta-lead-gen', brand_name: 'X', challenges: 'Y', budget_monthly_vnd: 1_000_000 },
    });
    repo.getDraft = jest.fn().mockResolvedValue({
      strategy_framework: { target_market: 'abc' },
      target_market_prof: {
        segmentation_icp: 'x'.repeat(90),
        buy_triggers_obstacles: 'competition',
      },
      swot_json: {},
      campaigns_json: [
        { name: 'A', objective: 'lead', channel_mix: ['Meta', 'Google'], budget_pct: 50, kpis: ['CPL'] },
        { name: 'B', objective: 'lead', channel_mix: ['Meta', 'Landing'], budget_pct: 50, kpis: ['CTR'] },
      ],
      content_json: {},
      quality_score_json: {},
    });
    const gate = await service.checkLaunchQaQualityGate(1, 'meta-lead-gen');
    expect(gate.required).toBe(true);
    expect(gate.min_score).toBe(70);
    expect(typeof gate.current_score).toBe('number');
  });

  it('mergeAndPersistPlaybook upserts brief and draft metadata', async () => {
    repo.ensureDraft = jest.fn().mockResolvedValue({
      strategy_framework: {},
      target_market_prof: {},
      swot_json: {},
      campaigns_json: [],
      content_json: {},
      quality_score_json: {},
    });
    repo.upsertBrief = jest.fn().mockResolvedValue(undefined);
    repo.upsertDraft = jest.fn().mockResolvedValue(undefined);

    const out = await service.mergeAndPersistPlaybook({
      lifecycleId: 9,
      slug: 'meta-lead-gen',
      serviceSlug: 'meta-lead-gen',
      existingBrief: null,
      actorEmail: 'sp@test.vn',
    });
    expect(out.playbook_slug).toBe('meta-lead-gen');
    expect(repo.upsertBrief).toHaveBeenCalled();
    expect(repo.upsertDraft).toHaveBeenCalled();
  });
});

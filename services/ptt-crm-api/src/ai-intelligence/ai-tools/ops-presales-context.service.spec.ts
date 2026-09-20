import { BadRequestException } from '@nestjs/common';
import { OpsPresalesContextService } from './ops-presales-context.service';

describe('OpsPresalesContextService', () => {
  const repo = {
    resolveClientId: jest.fn(),
    getLifecycleDetail: jest.fn(),
    findLifecycleByPlan: jest.fn(),
    findLifecycleByLead: jest.fn(),
    findLifecycleByClient: jest.fn(),
    getLead: jest.fn(),
    getLatestCompletedIntake: jest.fn(),
    getOfficialPlan: jest.fn(),
    getContract: jest.fn(),
    listProposals: jest.fn(),
    getPresalesL2Docs: jest.fn(),
    listApprovedInsightIds: jest.fn(),
    countHubCampaignMaps: jest.fn(),
    staffName: jest.fn(),
    parseOfficialPlan: jest.fn(),
    validateOfficialPlan: jest.fn(),
    getStageTask: jest.fn(),
  };

  let svc: OpsPresalesContextService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.resolveClientId.mockResolvedValue({
      id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd',
      name: '360 AUTO DETAILING',
      code: '360-AUTO',
      status: 'active',
    });
    repo.getLifecycleDetail.mockResolvedValue({
      id: 5,
      lead_id: 5,
      contract_id: 1,
      marketing_plan_id: 8,
      stage: 'onboard',
      status: 'active',
      service_slug: 'quang-cao-facebook',
      assigned_am: null,
      assigned_sp: null,
      agency_client_id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd',
    });
    repo.getLead.mockResolvedValue({
      id: 5,
      full_name: '360 AUTO',
      status: 'qualified',
      source: 'facebook_meta',
      owner_name: 'AM',
      created_at: '2026-09-01',
    });
    repo.getLatestCompletedIntake.mockResolvedValue({
      id: 12,
      bant_total: 30,
      decision: 'go',
      completed_at: '2026-09-18',
      ai_summary: 'BANT 0/30 · DV quang-cao-facebook',
      answers_json: {},
      lead_id: 5,
      lifecycle_id: 5,
    });
    repo.getOfficialPlan.mockResolvedValue({
      id: 8,
      strategy_framework_json: {},
      target_market_prof_json: {},
    });
    repo.parseOfficialPlan.mockReturnValue({
      strategy_framework: {},
      target_market_prof: {},
    });
    repo.validateOfficialPlan.mockReturnValue({
      ok: false,
      complete: false,
      messages: ['TMMT chi tiết cần ít nhất 6 mục (hiện 0/12).'],
    });
    repo.getContract.mockResolvedValue({
      id: 1,
      title: 'HD 360 AUTO DETAILING — Meta Lead Gen',
      amount_vnd: 45_000_000,
      agency_client_id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd',
      campaign_id: null,
      campaign_code: '',
      campaign_name: '',
    });
    repo.listProposals.mockResolvedValue([]);
    repo.getPresalesL2Docs.mockResolvedValue({});
    repo.listApprovedInsightIds.mockResolvedValue([]);
    repo.countHubCampaignMaps.mockResolvedValue(0);
    repo.staffName.mockResolvedValue('');
    repo.getStageTask.mockResolvedValue(null);
    svc = new OpsPresalesContextService(repo as never);
  });

  it('requires a context id', async () => {
    await expect(svc.buildPack({})).rejects.toBeInstanceOf(BadRequestException);
  });

  it('builds P8 pack for lifecycle 5 with winning-plan blockers', async () => {
    const pack = await svc.buildPack({ lifecycle_id: 5 });
    expect(pack.phase).toBe('P8');
    expect(pack.presales.tmmt.gate_passed).toBe(false);
    expect(pack.presales.tmmt.progress).toBe('0/12');
    expect(pack.presales.contract.value_vnd).toBe(45_000_000);
    expect(pack.presales.contract.map_status).toBe('contract_unmapped');
    expect(pack.presales.insight.approved_count).toBe(0);
    expect(pack.presales.bant.score).toBe('30/30');
    expect(pack.presales.bant.sync_ok).toBe(true);
    expect(pack.presales.bant.sync_issues.some((i) => i.includes('0_30'))).toBe(true);
    expect(pack.winning_plan_ready).toBe(false);
    expect(pack.consult_ready).toBe(false);
    expect(pack.gate_copy?.consult).toMatch(/BANT/);
    expect(pack.gate_copy?.consult).not.toMatch(/TMMT/);
    expect(pack.blockers_for_winning_plan.map((b) => b.code)).toEqual(
      expect.arrayContaining(['tmmt_gate', 'no_approved_insight', 'geography_missing']),
    );
  });
});

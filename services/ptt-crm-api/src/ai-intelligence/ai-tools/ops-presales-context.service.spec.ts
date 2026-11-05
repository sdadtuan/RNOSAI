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
    findRichestTmmtPlanForLifecycle: jest.fn(),
    getContract: jest.fn(),
    listProposals: jest.fn(),
    getPresalesL2Docs: jest.fn(),
    listApprovedInsightIds: jest.fn(),
    countHubCampaignMaps: jest.fn(),
    staffName: jest.fn(),
    parseOfficialPlan: jest.fn(),
    validateOfficialPlan: jest.fn(),
    getStageTask: jest.fn(),
    patchOfficialPlanContent: jest.fn(),
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
    repo.patchOfficialPlanContent.mockResolvedValue(undefined);
    repo.findRichestTmmtPlanForLifecycle.mockResolvedValue(null);
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
    expect(pack.blockers_for_winning_plan.map((b) => b.code)).not.toEqual(
      expect.arrayContaining(['hub_campaign_map', 'proposal_totals_zero']),
    );
    expect(pack.warnings?.map((w) => w.code)).toEqual(
      expect.arrayContaining(['hub_campaign_map', 'proposal_totals_zero']),
    );
  });

  it('P8.4 fixture: lifecycle 5 TMMT confirmed + plan 15 active → hard pass with soft warnings', async () => {
    const confirmed = (text: string) => ({
      status: 'assumed_confirmed',
      text,
      confirmed_by: 'ceo',
      confirmed_at: '2026-09-21T00:00:00.000Z',
    });
    const filledProf = {
      market_context: 'Detailing VN',
      tam_sam_som: 'TAM',
      geo_behavior: 'Việt Nam HCM',
      segmentation_icp: 'SME auto',
      personas_roles: 'Owner',
      jobs_to_be_done: 'JTBD',
      pains_desired_outcomes: 'Lead ổn định',
      buy_triggers_obstacles: 'CPL',
    };
    const fieldMeta = {
      market_context: confirmed('Detailing VN'),
      segmentation_icp: confirmed('SME auto'),
      personas_roles: confirmed('Owner'),
      pains_desired_outcomes: confirmed('Lead ổn định'),
    };
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
    repo.getOfficialPlan.mockImplementation(async (id: number | null) => {
      if (id === 8) {
        return {
          id: 8,
          strategy_framework_json: {
            target_market: 'Việt Nam',
            ai_tmmt_field_meta: JSON.stringify(fieldMeta),
          },
          target_market_prof_json: filledProf,
        };
      }
      if (id === 15) {
        return {
          id: 15,
          status: 'active',
          strategy_framework_json: {},
          target_market_prof_json: { market_context: 'stale empty snap' },
        };
      }
      return null;
    });
    repo.parseOfficialPlan.mockImplementation((plan: Record<string, unknown> | null) => {
      if (!plan) return { strategy_framework: {}, target_market_prof: {} };
      const sf =
        typeof plan.strategy_framework_json === 'string'
          ? JSON.parse(plan.strategy_framework_json as string)
          : (plan.strategy_framework_json as Record<string, unknown>) ?? {};
      const prof =
        typeof plan.target_market_prof_json === 'string'
          ? JSON.parse(plan.target_market_prof_json as string)
          : (plan.target_market_prof_json as Record<string, unknown>) ?? {};
      return { strategy_framework: sf, target_market_prof: prof };
    });
    repo.validateOfficialPlan.mockImplementation((plan: Record<string, unknown> | null) => {
      const prof =
        (plan?.target_market_prof_json as Record<string, string>) ??
        {};
      const filled = Object.values(prof).filter((v) => String(v ?? '').trim()).length;
      return { ok: filled >= 6, complete: filled >= 6, messages: [] };
    });
    repo.listApprovedInsightIds.mockResolvedValue([1]);
    repo.countHubCampaignMaps.mockResolvedValue(0);
    repo.listProposals.mockResolvedValue([]);

    const pack = await svc.buildPack({ lifecycle_id: 5, plan_id: 15 });
    expect(pack.winning_plan_ready).toBe(true);
    expect(pack.blockers_for_winning_plan).toEqual([]);
    expect(pack.warnings?.map((w) => w.code)).toEqual(
      expect.arrayContaining(['hub_campaign_map', 'proposal_totals_zero']),
    );
    expect(pack.presales.tmmt.progress).toMatch(/^[6-9]\/12$|^1[0-2]\/12$/);
    expect(pack.known.some((k) => k.includes('lifecycle plan #8'))).toBe(true);

    const gate = await svc.evaluateGateForIds({ lifecycle_id: 5, plan_id: 15 });
    expect(gate.pass).toBe(true);
    expect(gate.blockers).toEqual([]);
    expect(gate.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(['hub_campaign_map', 'proposal_totals_zero']),
    );
  });

  it('P8.4 remaps from richest sibling when activated plan 15 wiped TMMT', async () => {
    const confirmed = (text: string) => ({
      status: 'assumed_confirmed',
      text,
      confirmed_by: 'ceo',
      confirmed_at: '2026-09-21T00:00:00.000Z',
    });
    const filledProf = {
      market_context: 'Detailing VN',
      tam_sam_som: 'TAM',
      geo_behavior: 'Việt Nam HCM',
      segmentation_icp: 'SME auto',
      personas_roles: 'Owner',
      jobs_to_be_done: 'JTBD',
      pains_desired_outcomes: 'Lead ổn định',
      buy_triggers_obstacles: 'CPL',
    };
    const fieldMeta = {
      market_context: confirmed('Detailing VN'),
      segmentation_icp: confirmed('SME auto'),
      personas_roles: confirmed('Owner'),
      pains_desired_outcomes: confirmed('Lead ổn định'),
    };
    repo.getLifecycleDetail.mockResolvedValue({
      id: 5,
      lead_id: 5,
      contract_id: 1,
      marketing_plan_id: 15,
      stage: 'onboard',
      status: 'active',
      service_slug: 'quang-cao-facebook',
      assigned_am: null,
      assigned_sp: null,
      agency_client_id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd',
    });
    repo.getOfficialPlan.mockResolvedValue({
      id: 15,
      status: 'active',
      strategy_framework_json: { target_market: '' },
      target_market_prof_json: {},
    });
    repo.findRichestTmmtPlanForLifecycle.mockResolvedValue({
      id: 8,
      strategy_framework_json: {
        target_market: 'Việt Nam',
        ai_tmmt_field_meta: JSON.stringify(fieldMeta),
      },
      target_market_prof_json: filledProf,
    });
    repo.parseOfficialPlan.mockImplementation((plan: Record<string, unknown> | null) => {
      if (!plan) return { strategy_framework: {}, target_market_prof: {} };
      const sf =
        typeof plan.strategy_framework_json === 'string'
          ? JSON.parse(plan.strategy_framework_json as string)
          : (plan.strategy_framework_json as Record<string, unknown>) ?? {};
      const prof =
        typeof plan.target_market_prof_json === 'string'
          ? JSON.parse(plan.target_market_prof_json as string)
          : (plan.target_market_prof_json as Record<string, unknown>) ?? {};
      return { strategy_framework: sf, target_market_prof: prof };
    });
    repo.validateOfficialPlan.mockImplementation((plan: Record<string, unknown> | null) => {
      const prof = (plan?.target_market_prof_json as Record<string, string>) ?? {};
      const filled = Object.values(prof).filter((v) => String(v ?? '').trim()).length;
      return { ok: filled >= 6, complete: filled >= 6, messages: [] };
    });
    repo.listApprovedInsightIds.mockResolvedValue([1]);

    const pack = await svc.buildPack({ lifecycle_id: 5, plan_id: 15 });
    expect(pack.winning_plan_ready).toBe(true);
    expect(repo.patchOfficialPlanContent).toHaveBeenCalledWith(
      15,
      expect.objectContaining({
        target_market_prof: expect.objectContaining({
          pains_desired_outcomes: 'Lead ổn định',
        }),
      }),
    );
  });
});

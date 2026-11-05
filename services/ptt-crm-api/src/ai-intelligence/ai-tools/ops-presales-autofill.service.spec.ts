import { OpsPresalesAutofillService } from './ops-presales-autofill.service';

describe('OpsPresalesAutofillService', () => {
  const plan = {
    id: 8,
    strategy_framework_json: {},
    target_market_prof_json: {},
  };
  const repo = {
    getLifecycleDetail: jest.fn(async () => ({
      id: 5,
      lead_id: 5,
      marketing_plan_id: 8,
      contract_id: 1,
      agency_client_id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd',
    })),
    getOfficialPlan: jest.fn(async () => plan),
    patchOfficialPlanContent: jest.fn(async () => undefined),
    getStageTask: jest.fn(async () => null),
    getLatestCompletedIntake: jest.fn(async () => null),
  };
  const lifecycle = {
    consultBrief: jest.fn(async () => ({
      highlights: { pain: 'CPL cao', niche: 'Detailing', domain: 'Auto', goal: 'Lead' },
      readiness: { decision: 'go', bant_total: 30 },
      service_label: 'QC Facebook',
      stakeholders: [{ role_label: 'Owner', name: 'AM' }],
      latest_intake_summary: 'BANT: 30/30 · Go',
    })),
  };
  const presales = {
    buildPack: jest.fn(async () => ({
      presales: {
        contract: { title: 'HD 360 AUTO', value_vnd: 45_000_000 },
      },
    })),
  };

  let svc: OpsPresalesAutofillService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OpsPresalesAutofillService(repo as never, presales as never, lifecycle as never);
  });

  it('dry_run previews fields without DB write', async () => {
    const out = await svc.autofill({ lifecycle_id: 5, dry_run: true });
    expect(out.phase).toBe('P7');
    expect(out.dry_run).toBe(true);
    expect(out.fields_written.length).toBeGreaterThan(0);
    if (out.missing_required.length > 0) expect(out.gate_passed).toBe(false);
    expect(repo.patchOfficialPlanContent).not.toHaveBeenCalled();
  });

  it('fill_empty_only writes; never claims gate when required missing', async () => {
    const out = await svc.autofill({ lifecycle_id: 5, dry_run: false });
    expect(out.dry_run).toBe(false);
    expect(repo.patchOfficialPlanContent).toHaveBeenCalled();
    expect(out.tmmt_progress.after).not.toBe('0/12');
    if (out.missing_required.length > 0) expect(out.gate_passed).toBe(false);
  });

  it('maps confirmed Đối tượng mục tiêu → segmentation_icp and Need/Pain → pains', async () => {
    repo.getStageTask.mockImplementation(async (_id: number, stage: string) => {
      if (stage === 'consult') {
        return {
          id: 77,
          form_data: {
            target_audience: 'SME auto detailing HCM',
            p8_quality: {
              icp: {
                status: 'assumed_confirmed',
                text: 'SME auto detailing HCM — Owner quyết định',
              },
              need_pain: {
                status: 'assumed_confirmed',
                text: 'Cần lead ổn định, CPL thấp',
              },
            },
          },
          notes: '',
          is_done: false,
        };
      }
      return null;
    });
    const out = await svc.autofill({ lifecycle_id: 5, dry_run: true });
    const writtenKeys = out.fields_written.map((f) => f.key);
    expect(writtenKeys).toEqual(
      expect.arrayContaining(['segmentation_icp', 'pains_desired_outcomes']),
    );
    expect(out.fields_skipped.find((s) => s.key === 'segmentation_icp')?.reason).not.toBe(
      'empty_source',
    );
  });
});

import { OpsConsultDraftService } from './ops-consult-draft.service';

describe('OpsConsultDraftService persist', () => {
  const repo = {
    findLifecycleByLead: jest.fn(),
    getLifecycleDetail: jest.fn(),
    getStageTask: jest.fn(),
    ensureStageTask: jest.fn(),
    getLatestCompletedIntake: jest.fn(),
    patchStageTaskFormData: jest.fn(),
    patchIntakeAnswersMeta: jest.fn(),
  };
  const lifecycle = {
    consultBrief: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getLifecycleDetail.mockResolvedValue({
      id: 5,
      lead_id: 5,
      service_slug: 'quang-cao-facebook',
    });
    repo.getStageTask.mockResolvedValue(null);
    repo.ensureStageTask.mockResolvedValue({
      id: 77,
      form_data: {},
      notes: '',
      is_done: false,
    });
    repo.getLatestCompletedIntake.mockResolvedValue({
      id: 12,
      bant_total: 24,
      decision: 'go',
      answers_json: {},
    });
    lifecycle.consultBrief.mockResolvedValue({
      service_label: 'Facebook Ads',
      highlights: { niche: 'auto detailing', pain: '', domain: '', goal: '' },
    });
  });

  it('creates consult task and persists instead of consult_or_lead_task_missing', async () => {
    const svc = new OpsConsultDraftService(repo as never, lifecycle as never);
    const out = await svc.draftFromResearch(
      { lifecycle_id: 5, dry_run: false },
      'am@test',
    );
    expect(repo.ensureStageTask).toHaveBeenCalledWith(5, 'consult');
    expect(repo.patchStageTaskFormData).toHaveBeenCalled();
    expect(out.task_id).toBe(77);
    expect(out.fields_written.some((f) => f.key === 'need_pain')).toBe(true);
  });

  it('dry_run does not patch task', async () => {
    const svc = new OpsConsultDraftService(repo as never, lifecycle as never);
    await svc.draftFromResearch({ lifecycle_id: 5, dry_run: true }, 'am@test');
    expect(repo.ensureStageTask).toHaveBeenCalled();
    expect(repo.patchStageTaskFormData).not.toHaveBeenCalled();
  });
});

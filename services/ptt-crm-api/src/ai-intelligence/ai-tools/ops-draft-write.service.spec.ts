import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OpsDraftWriteService } from './ops-draft-write.service';

describe('OpsDraftWriteService', () => {
  const repo = {
    getPlan: jest.fn(),
    getPlanForWrite: jest.fn(),
    getLifecycle: jest.fn(),
    getProject: jest.fn(),
    findPrimaryLifecycleByClient: jest.fn(),
    findPlanByLifecycle: jest.fn(),
    insertPlanDraft: jest.fn(),
    patchPlanDraft: jest.fn(),
    clonePlanToDraft: jest.fn(),
    insertAiDraftTask: jest.fn(),
  };
  const meta = { actor: 'test-key', approvedAt: '2026-09-19T12:00:00.000Z' };
  let svc: OpsDraftWriteService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OpsDraftWriteService(repo as never);
  });

  it('patches draft plan without changing status', async () => {
    repo.getPlanForWrite.mockResolvedValue({
      id: 10,
      name: 'Old',
      status: 'draft',
      period_label: '',
      lifecycle_id: 5,
      objectives: '',
      notes: '',
      strategy_framework_json: {},
      success_metrics_json: [],
    });
    repo.patchPlanDraft.mockResolvedValue({
      id: 10,
      name: 'New',
      status: 'draft',
      period_label: 'Q4',
      lifecycle_id: 5,
      success_metrics_json: [],
    });

    const out = await svc.writeMarketingPlanDraft(
      { plan_id: 10, title: 'New', period: 'Q4', status: 'active' },
      meta,
    );

    expect(out.phase).toBe('P3');
    expect(out.entity_ids).toEqual({ plan_id: 10 });
    expect(out.links).toEqual(['/crm/marketing-plan/10']);
    expect(repo.patchPlanDraft).toHaveBeenCalledWith(
      10,
      expect.not.objectContaining({ status: 'active' }),
    );
  });

  it('404 when plan missing', async () => {
    repo.getPlanForWrite.mockResolvedValue(null);
    await expect(
      svc.writeMarketingPlanDraft({ plan_id: 999, title: 'X' }, meta),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409 when live plan without clone_to_draft', async () => {
    repo.getPlanForWrite.mockResolvedValue({
      id: 8,
      name: 'Live',
      status: 'active',
      period_label: '',
      lifecycle_id: 5,
      objectives: '',
      notes: '',
      strategy_framework_json: {},
      success_metrics_json: [],
    });
    await expect(
      svc.writeMarketingPlanDraft({ plan_id: 8, title: 'X' }, meta),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('clones live plan to draft when clone_to_draft=true', async () => {
    repo.getPlanForWrite.mockResolvedValue({
      id: 8,
      name: 'Live',
      status: 'active',
      period_label: 'Q3',
      lifecycle_id: 5,
      objectives: '',
      notes: '',
      strategy_framework_json: {},
      success_metrics_json: [],
    });
    repo.clonePlanToDraft.mockResolvedValue({
      id: 20,
      name: 'Live (draft)',
      status: 'draft',
      period_label: 'Q3',
      lifecycle_id: 5,
      success_metrics_json: [],
    });

    const out = await svc.writeMarketingPlanDraft(
      { plan_id: 8, clone_to_draft: true },
      meta,
    );
    expect(out.entity_ids.plan_id).toBe(20);
    expect(repo.clonePlanToDraft).toHaveBeenCalled();
  });

  it('inserts draft when no plan_id', async () => {
    repo.insertPlanDraft.mockResolvedValue({
      id: 30,
      name: 'Fresh',
      status: 'draft',
      period_label: '',
      lifecycle_id: null,
      success_metrics_json: [],
    });
    const out = await svc.writeMarketingPlanDraft({ title: 'Fresh' }, meta);
    expect(out.entity_ids.plan_id).toBe(30);
  });

  it('400 title_required when insert without name', async () => {
    await expect(svc.writeMarketingPlanDraft({}, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates AI draft task on resolved lifecycle stage', async () => {
    repo.getLifecycle.mockResolvedValue({
      id: 5,
      stage: 'onboard',
      status: 'active',
      marketing_plan_id: 8,
      agency_client_id: null,
    });
    repo.insertAiDraftTask.mockResolvedValue({
      id: 42,
      lifecycle_id: 5,
      title: '[AI draft] Kickoff',
      stage: 'onboard',
    });

    const out = await svc.createTaskDraft(
      { lifecycle_id: 5, title: 'Kickoff', acceptance_criteria: 'Done when…' },
      meta,
    );

    expect(out.entity_ids).toEqual({ task_id: 42, lifecycle_id: 5 });
    expect(out.links).toEqual(['/crm/service-delivery/5']);
    expect(repo.insertAiDraftTask).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'onboard',
        title: '[AI draft] Kickoff',
        form_data: expect.objectContaining({ ai_draft: true }),
      }),
    );
  });

  it('400 lifecycle_required when unresolved', async () => {
    await expect(svc.createTaskDraft({ title: 'X' }, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('falls back stage to deliver when lifecycle stage invalid', async () => {
    repo.getLifecycle.mockResolvedValue({
      id: 5,
      stage: 'weird',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: null,
    });
    repo.insertAiDraftTask.mockResolvedValue({
      id: 1,
      lifecycle_id: 5,
      title: '[AI draft] T',
      stage: 'deliver',
    });
    await svc.createTaskDraft({ lifecycle_id: 5, title: 'T' }, meta);
    expect(repo.insertAiDraftTask.mock.calls[0][0].stage).toBe('deliver');
  });
});

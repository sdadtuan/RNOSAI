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
    getAiDraftTaskForWrite: jest.fn(),
    updateAiDraftTask: jest.fn(),
  };
  const meta = { actor: 'test-key', approvedAt: '2026-09-19T12:00:00.000Z' };
  const presalesContext = {
    evaluateGateForIds: jest.fn().mockResolvedValue({ pass: true, blockers: [], links: [] }),
  };
  let svc: OpsDraftWriteService;

  beforeEach(() => {
    jest.clearAllMocks();
    presalesContext.evaluateGateForIds.mockResolvedValue({ pass: true, blockers: [], links: [] });
    svc = new OpsDraftWriteService(repo as never, presalesContext as never);
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

  it('409 winning_plan_gate_failed for scale-ads style task when gate fails', async () => {
    repo.getLifecycle.mockResolvedValue({
      id: 5,
      stage: 'deliver',
      status: 'active',
      marketing_plan_id: 8,
      agency_client_id: null,
    });
    presalesContext.evaluateGateForIds.mockResolvedValue({
      pass: false,
      blockers: [{ code: 'tmmt_gate', detail: '0/12' }],
      links: ['/crm/service-delivery/5?tab=tmmt'],
    });
    await expect(
      svc.createTaskDraft(
        { lifecycle_id: 5, title: 'Scale winning ads — Meta CPL' },
        meta,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'winning_plan_gate_failed' }),
    });
    expect(repo.insertAiDraftTask).not.toHaveBeenCalled();
  });

  it('allows TMMT research task even when winning gate fails', async () => {
    repo.getLifecycle.mockResolvedValue({
      id: 5,
      stage: 'onboard',
      status: 'active',
      marketing_plan_id: 8,
      agency_client_id: null,
    });
    presalesContext.evaluateGateForIds.mockResolvedValue({
      pass: false,
      blockers: [{ code: 'tmmt_gate', detail: '0/12' }],
      links: [],
    });
    repo.insertAiDraftTask.mockResolvedValue({
      id: 99,
      lifecycle_id: 5,
      title: '[AI draft] Hoàn thiện TMMT chi tiết',
      stage: 'onboard',
    });
    const out = await svc.createTaskDraft(
      { lifecycle_id: 5, title: 'Hoàn thiện TMMT chi tiết' },
      meta,
    );
    expect(out.entity_ids.task_id).toBe(99);
    expect(presalesContext.evaluateGateForIds).not.toHaveBeenCalled();
  });

  it('400 lifecycle_required when unresolved', async () => {
    await expect(svc.createTaskDraft({ title: 'X' }, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('400 when plan_id has no lifecycle (no silent client fallthrough)', async () => {
    repo.getPlan.mockResolvedValue({
      id: 99,
      name: 'Unlinked',
      status: 'draft',
      period_label: '',
      lifecycle_id: null,
      success_metrics_json: [],
    });
    repo.findPrimaryLifecycleByClient.mockResolvedValue({
      id: 5,
      stage: 'deliver',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: 'c1',
    });

    await expect(
      svc.createTaskDraft(
        {
          title: 'Should fail',
          plan_id: 99,
          client_id: 'd437cc78-0757-44ba-aaa3-9ffb941121dd',
        },
        meta,
      ),
    ).rejects.toMatchObject({
      response: { error: 'lifecycle_required' },
    });
    expect(repo.insertAiDraftTask).not.toHaveBeenCalled();
    expect(repo.findPrimaryLifecycleByClient).not.toHaveBeenCalled();
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

  it('createTaskDraft stores assignee/priority/due in form_data', async () => {
    repo.getLifecycle.mockResolvedValue({
      id: 5,
      stage: 'deliver',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: null,
    });
    repo.insertAiDraftTask.mockResolvedValue({
      id: 7,
      lifecycle_id: 5,
      title: '[AI draft] Own me',
      stage: 'deliver',
    });

    await svc.createTaskDraft(
      {
        lifecycle_id: 5,
        title: 'Own me',
        owner: 'AM 360',
        priority: 'high',
        due_in_days: 3,
      },
      meta,
    );

    expect(repo.insertAiDraftTask.mock.calls[0][0].form_data).toMatchObject({
      assignee: 'AM 360',
      owner: 'AM 360',
      priority: 'high',
      due_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
  });

  it('updateTaskDraft patches owner/priority/due', async () => {
    repo.getAiDraftTaskForWrite.mockResolvedValue({
      id: 42,
      lifecycle_id: 5,
      title: '[AI draft] Kickoff',
      stage: 'onboard',
      description: 'old',
      form_data: { ai_draft: true, role_key: 'content' },
    });
    repo.updateAiDraftTask.mockResolvedValue({
      id: 42,
      lifecycle_id: 5,
      title: '[AI draft] Kickoff',
      stage: 'onboard',
      description: 'old',
      form_data: {},
    });

    const out = await svc.updateTaskDraft(
      { task_id: 42, owner: 'Lê Hoàng', priority: 'urgent', due_date: '2026-10-12' },
      meta,
    );

    expect(out.tool).toBe('task.update_draft');
    expect(out.entity_ids).toEqual({ task_id: 42, lifecycle_id: 5 });
    expect(repo.updateAiDraftTask).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        form_data: expect.objectContaining({
          assignee: 'Lê Hoàng',
          owner: 'Lê Hoàng',
          priority: 'urgent',
          due_date: '2026-10-12',
          source_tool: 'task.update_draft',
        }),
      }),
    );
  });

  it('updateTaskDraft 404 when missing', async () => {
    repo.getAiDraftTaskForWrite.mockResolvedValue(null);
    await expect(
      svc.updateTaskDraft({ task_id: 999, priority: 'high' }, meta),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updateTaskDraft 400 without patch fields', async () => {
    repo.getAiDraftTaskForWrite.mockResolvedValue({
      id: 1,
      lifecycle_id: 5,
      title: 't',
      stage: 'deliver',
      description: '',
      form_data: {},
    });
    await expect(svc.updateTaskDraft({ task_id: 1 }, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

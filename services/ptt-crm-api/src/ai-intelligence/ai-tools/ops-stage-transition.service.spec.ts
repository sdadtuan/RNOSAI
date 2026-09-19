import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OpsStageTransitionService } from './ops-stage-transition.service';

describe('OpsStageTransitionService', () => {
  const repo = {
    getLifecycleForTransition: jest.fn(),
    listOpenTasks: jest.fn(),
    countTasksByStage: jest.fn(),
    applyLifecycleStageTransition: jest.fn(),
  };
  const meta = { actor: 'test-key', approvedAt: '2026-09-19T12:00:00.000Z' };
  let svc: OpsStageTransitionService;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OpsStageTransitionService(repo as never);
    repo.listOpenTasks.mockResolvedValue([]);
    repo.countTasksByStage.mockResolvedValue({ total: 1, open: 0, done: 1 });
  });

  it('dry_run proposes forward next without persisting', async () => {
    repo.getLifecycleForTransition.mockResolvedValue({
      id: 5,
      stage: 'onboard',
      status: 'active',
      marketing_plan_id: 8,
      agency_client_id: null,
      notes: 'stakeholders ok',
    });

    const out = await svc.proposeTransition(
      { lifecycle_id: 5, dry_run: true },
      meta,
      { humanApproved: false },
    );

    expect(out.phase).toBe('P4');
    expect(out.status).toBe('proposed');
    expect(out.from_stage).toBe('onboard');
    expect(out.to_stage).toBe('deliver');
    expect(out.dry_run).toBe(true);
    expect(repo.applyLifecycleStageTransition).not.toHaveBeenCalled();
  });

  it('403 when apply without human approval', async () => {
    repo.getLifecycleForTransition.mockResolvedValue({
      id: 5,
      stage: 'onboard',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: null,
      notes: 'ok',
    });
    await expect(
      svc.proposeTransition({ lifecycle_id: 5, dry_run: false }, meta, {
        humanApproved: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies forward transition when approved and DoD ok', async () => {
    repo.getLifecycleForTransition.mockResolvedValue({
      id: 5,
      stage: 'onboard',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: null,
      notes: 'ok',
    });
    const out = await svc.proposeTransition(
      { lifecycle_id: 5, dry_run: false, notes: 'go' },
      meta,
      { humanApproved: true },
    );
    expect(out.status).toBe('transitioned');
    expect(out.to_stage).toBe('deliver');
    expect(repo.applyLifecycleStageTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        lifecycleId: 5,
        fromStage: 'onboard',
        toStage: 'deliver',
      }),
    );
  });

  it('409 invalid_transition on backward', async () => {
    repo.getLifecycleForTransition.mockResolvedValue({
      id: 5,
      stage: 'deliver',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: null,
      notes: '',
    });
    await expect(
      svc.proposeTransition(
        { lifecycle_id: 5, to_stage: 'onboard', dry_run: true },
        meta,
        { humanApproved: false },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('409 invalid_transition on skip', async () => {
    repo.getLifecycleForTransition.mockResolvedValue({
      id: 5,
      stage: 'onboard',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: null,
      notes: '',
    });
    await expect(
      svc.proposeTransition(
        { lifecycle_id: 5, to_stage: 'handover', dry_run: true },
        meta,
        { humanApproved: false },
      ),
    ).rejects.toMatchObject({ response: { error: 'invalid_transition' } });
  });

  it('400 dod_incomplete on apply when tasks open', async () => {
    repo.getLifecycleForTransition.mockResolvedValue({
      id: 5,
      stage: 'onboard',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: null,
      notes: '',
    });
    repo.countTasksByStage.mockResolvedValue({ total: 2, open: 2, done: 0 });
    repo.listOpenTasks.mockResolvedValue([
      { id: 1, title: 'Setup', stage: 'onboard' },
    ]);
    await expect(
      svc.proposeTransition({ lifecycle_id: 5, dry_run: false }, meta, {
        humanApproved: true,
      }),
    ).rejects.toMatchObject({ response: { error: 'dod_incomplete' } });
    expect(repo.applyLifecycleStageTransition).not.toHaveBeenCalled();
  });

  it('maps quote alias to proposal', async () => {
    repo.getLifecycleForTransition.mockResolvedValue({
      id: 5,
      stage: 'consult',
      status: 'active',
      marketing_plan_id: null,
      agency_client_id: null,
      notes: 'brief ready',
    });
    const out = await svc.proposeTransition(
      { lifecycle_id: 5, to_stage: 'quote', dry_run: true },
      meta,
      { humanApproved: false },
    );
    expect(out.to_stage).toBe('proposal');
  });

  it('400 force_forbidden', async () => {
    await expect(
      svc.proposeTransition({ lifecycle_id: 5, force: true, dry_run: true }, meta, {
        humanApproved: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404 lifecycle_not_found', async () => {
    repo.getLifecycleForTransition.mockResolvedValue(null);
    await expect(
      svc.proposeTransition({ lifecycle_id: 999, dry_run: true }, meta, {
        humanApproved: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

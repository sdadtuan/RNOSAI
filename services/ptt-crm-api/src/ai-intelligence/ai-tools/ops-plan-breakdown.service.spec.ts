import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OpsPlanBreakdownService, parseKpiTargetFromCorpus } from './ops-plan-breakdown.service';
import type { OpsDraftWriteService } from './ops-draft-write.service';

describe('parseKpiTargetFromCorpus', () => {
  it('parses explicit CPL number and does not invent when missing', () => {
    const kpi = { name: 'cpl', unit: 'currency', parseKeys: ['CPL'] };
    expect(parseKpiTargetFromCorpus('Target CPL: 120000', kpi)).toEqual({
      target: 120000,
      matched: true,
    });
    expect(parseKpiTargetFromCorpus('Grow awareness for detailing', kpi)).toEqual({
      target: null,
      matched: false,
    });
  });
});

describe('OpsPlanBreakdownService', () => {
  const repo = {
    getPlanForWrite: jest.fn(),
  };
  const draftWrite = {
    createTaskDraft: jest.fn(),
  };

  let svc: OpsPlanBreakdownService;
  const meta = { actor: 'tester', approvedAt: '2026-09-19T00:00:00.000Z' };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OpsPlanBreakdownService(repo as never, draftWrite as unknown as OpsDraftWriteService);
  });

  function activePlan(overrides: Record<string, unknown> = {}) {
    return {
      id: 8,
      name: '360 AUTO DETAILING',
      status: 'active',
      period_label: 'Q4',
      lifecycle_id: 5,
      success_metrics_json: [],
      objectives: 'Grow showroom leads',
      notes: 'No numeric KPIs yet',
      strategy_framework_json: {},
      ...overrides,
    };
  }

  it('requires plan_id', async () => {
    await expect(
      svc.breakdownToRoles({}, meta, { humanApproved: false }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects draft plan with plan_not_approved', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan({ status: 'draft' }));
    await expect(
      svc.breakdownToRoles({ plan_id: 8 }, meta, { humanApproved: false }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'plan_not_approved' }),
    });
  });

  it('allows review only when allow_review=true', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan({ status: 'review' }));
    await expect(
      svc.breakdownToRoles({ plan_id: 8 }, meta, { humanApproved: false }),
    ).rejects.toBeInstanceOf(ConflictException);

    const out = await svc.breakdownToRoles(
      { plan_id: 8, allow_review: true, roles: ['graphic', 'content'] },
      meta,
      { humanApproved: false },
    );
    expect(out.matrix).toHaveLength(2);
    expect(out.persist_tasks).toBe(false);
    expect(out.task_ids).toEqual([]);
  });

  it('dry-run active plan returns matrix ≥4 with null KPI targets and unknown', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan());
    const out = await svc.breakdownToRoles(
      {
        plan_id: 8,
        persist_tasks: false,
        roles: ['am', 'graphic', 'content', 'video', 'ads'],
      },
      meta,
      { humanApproved: false },
    );
    expect(out.phase).toBe('P5');
    expect(out.matrix.length).toBeGreaterThanOrEqual(4);
    expect(out.task_ids).toEqual([]);
    expect(out.known.length).toBeGreaterThan(0);
    expect(out.assumed).toEqual([]);
    expect(out.unknown).toEqual(expect.arrayContaining(['kpi_targets_numeric']));
    expect(out.matrix.every((m) => m.kpis.every((k) => k.target === null))).toBe(true);
    expect(draftWrite.createTaskDraft).not.toHaveBeenCalled();
  });

  it('maps parsed KPI when present in notes', async () => {
    repo.getPlanForWrite.mockResolvedValue(
      activePlan({ notes: 'CPL: 85000 and valid_leads: 40' }),
    );
    const out = await svc.breakdownToRoles(
      { plan_id: 8, roles: ['ads'] },
      meta,
      { humanApproved: false },
    );
    const ads = out.matrix[0];
    expect(ads.kpis.find((k) => k.name === 'cpl')?.target).toBe(85000);
    expect(ads.kpis.find((k) => k.name === 'valid_leads')?.target).toBe(40);
    expect(out.unknown).not.toContain('kpi_targets_numeric');
  });

  it('persist_tasks without approval → 403', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan());
    await expect(
      svc.breakdownToRoles(
        { plan_id: 8, persist_tasks: true, lifecycle_id: 5, roles: ['graphic'] },
        meta,
        { humanApproved: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(draftWrite.createTaskDraft).not.toHaveBeenCalled();
  });

  it('persist_tasks without lifecycle → 400', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan({ lifecycle_id: null }));
    await expect(
      svc.breakdownToRoles(
        { plan_id: 8, persist_tasks: true, roles: ['graphic'] },
        meta,
        { humanApproved: true },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'lifecycle_required' }),
    });
  });

  it('persist_tasks + approve creates drafts via P3 with role_key', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan());
    draftWrite.createTaskDraft
      .mockResolvedValueOnce({
        entity_ids: { task_id: 101, lifecycle_id: 5 },
      })
      .mockResolvedValueOnce({
        entity_ids: { task_id: 102, lifecycle_id: 5 },
      });

    const out = await svc.breakdownToRoles(
      {
        plan_id: 8,
        lifecycle_id: 5,
        persist_tasks: true,
        roles: ['graphic', 'content'],
      },
      meta,
      { humanApproved: true },
    );
    expect(out.task_ids).toEqual([101, 102]);
    expect(draftWrite.createTaskDraft).toHaveBeenCalledTimes(2);
    expect(draftWrite.createTaskDraft.mock.calls[0][0]).toMatchObject({
      lifecycle_id: 5,
      plan_id: 8,
      role_key: 'graphic',
    });
    expect(String(draftWrite.createTaskDraft.mock.calls[0][0].title)).toContain(
      'graphic',
    );
  });

  it('plan_not_found', async () => {
    repo.getPlanForWrite.mockResolvedValue(null);
    await expect(
      svc.breakdownToRoles({ plan_id: 999 }, meta, { humanApproved: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

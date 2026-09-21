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
  const kpiTargetWrite = {
    writeDraft: jest.fn(),
  };
  const presalesContext = {
    evaluateGateForIds: jest.fn().mockResolvedValue({ pass: true, blockers: [], warnings: [], links: [] }),
  };

  let svc: OpsPlanBreakdownService;
  const meta = { actor: 'tester', approvedAt: '2026-09-19T00:00:00.000Z' };

  beforeEach(() => {
    jest.clearAllMocks();
    presalesContext.evaluateGateForIds.mockResolvedValue({
      pass: true,
      blockers: [],
      warnings: [],
      links: [],
    });
    svc = new OpsPlanBreakdownService(
      repo as never,
      draftWrite as unknown as OpsDraftWriteService,
      kpiTargetWrite as never,
      presalesContext as never,
    );
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

  it('409 winning_plan_gate_failed when TMMT/insight/geo missing (plan 8 fixture)', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan({ id: 8 }));
    presalesContext.evaluateGateForIds.mockResolvedValue({
      pass: false,
      blockers: [
        { code: 'tmmt_gate', detail: '0/12' },
        { code: 'no_approved_insight', detail: '' },
        { code: 'geography_missing', detail: '' },
      ],
      warnings: [],
      links: ['/crm/service-delivery/5?tab=tmmt', '/crm/marketing-plan/8'],
    });
    await expect(
      svc.breakdownToRoles({ plan_id: 8 }, meta, { humanApproved: false }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        error: 'winning_plan_gate_failed',
        blockers: expect.arrayContaining([
          expect.objectContaining({ code: 'tmmt_gate' }),
        ]),
      }),
    });
  });

  it('review plan returns plan_not_approved before winning gate (P8.4)', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan({ status: 'review' }));
    await expect(
      svc.breakdownToRoles({ plan_id: 15 }, meta, { humanApproved: false }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'plan_not_approved' }),
    });
    expect(presalesContext.evaluateGateForIds).not.toHaveBeenCalled();
  });

  it('active plan 15 succeeds with hub/proposal soft warnings only', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan({ id: 15, status: 'active' }));
    presalesContext.evaluateGateForIds.mockResolvedValue({
      pass: true,
      blockers: [],
      warnings: [
        { code: 'hub_campaign_map', message: '0 rows — map campaign before scale ads' },
        { code: 'proposal_totals_zero', message: 'Proposal totals 0 — price lines when ready' },
      ],
      links: [],
    });
    const out = await svc.breakdownToRoles(
      { plan_id: 15, lifecycle_id: 5, roles: ['graphic'] },
      meta,
      { humanApproved: false },
    );
    expect(out.ok).toBe(true);
    expect(out.warnings?.map((w) => w.code)).toEqual(
      expect.arrayContaining(['hub_campaign_map', 'proposal_totals_zero']),
    );
    expect(out.matrix.length).toBeGreaterThan(0);
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

  it('persist_tasks passes owner_map + due_in_days into create_draft', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan());
    draftWrite.createTaskDraft.mockResolvedValue({
      entity_ids: { task_id: 201, lifecycle_id: 5 },
    });

    const out = await svc.breakdownToRoles(
      {
        plan_id: 8,
        lifecycle_id: 5,
        persist_tasks: true,
        roles: ['content'],
        due_in_days: 5,
        owner_map: { content: 'Content Lead' },
      },
      meta,
      { humanApproved: true },
    );

    expect(out.known).toEqual(expect.arrayContaining(['due_in_days:5']));
    expect(out.matrix[0]).toMatchObject({
      role_key: 'content',
      owner_id: 'Content Lead',
      due: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(draftWrite.createTaskDraft.mock.calls[0][0]).toMatchObject({
      owner: 'Content Lead',
      due_date: out.matrix[0].due,
      priority: 'normal',
    });
  });

  it('persist_kpis + approve creates role KPI drafts', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan());
    kpiTargetWrite.writeDraft.mockResolvedValue({
      kpi_target_ids: [201, 202],
    });
    const out = await svc.breakdownToRoles(
      { plan_id: 8, persist_kpis: true, roles: ['graphic'] },
      meta,
      { humanApproved: true },
    );
    expect(out.persist_kpis).toBe(true);
    expect(out.kpi_target_ids).toEqual([201, 202]);
    expect(kpiTargetWrite.writeDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        plan_id: 8,
        items: expect.arrayContaining([
          expect.objectContaining({ role_key: 'graphic', kpi_key: 'assets_on_brief' }),
        ]),
      }),
      meta,
      { humanApproved: true },
    );
  });

  it('persist_kpis without approval → 403', async () => {
    repo.getPlanForWrite.mockResolvedValue(activePlan());
    await expect(
      svc.breakdownToRoles(
        { plan_id: 8, persist_kpis: true, roles: ['graphic'] },
        meta,
        { humanApproved: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('plan_not_found', async () => {
    repo.getPlanForWrite.mockResolvedValue(null);
    await expect(
      svc.breakdownToRoles({ plan_id: 999 }, meta, { humanApproved: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

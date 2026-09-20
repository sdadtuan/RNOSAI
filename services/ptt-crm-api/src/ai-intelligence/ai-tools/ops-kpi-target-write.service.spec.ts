import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { OpsKpiTargetWriteService } from './ops-kpi-target-write.service';

describe('OpsKpiTargetWriteService', () => {
  const repo = {
    getById: jest.fn(),
    findUpsertMatch: jest.fn(),
    insert: jest.fn(),
    patch: jest.fn(),
    list: jest.fn(),
  };
  const crmRepo = {
    getPlan: jest.fn(),
  };

  let svc: OpsKpiTargetWriteService;
  const meta = { actor: 'tester', approvedAt: '2026-09-19T00:00:00.000Z' };

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new OpsKpiTargetWriteService(repo as never, crmRepo as never);
  });

  it('requires human approval', async () => {
    await expect(
      svc.writeDraft(
        {
          plan_id: 8,
          role_key: 'graphic',
          kpi_key: 'assets_on_brief',
          period_start: '2026-10-01',
          period_end: '2026-12-31',
        },
        meta,
        { humanApproved: false },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects invalid role_key', async () => {
    await expect(
      svc.writeDraft(
        { role_key: 'ceo', kpi_key: 'x', period_start: '2026-10-01', period_end: '2026-12-31' },
        meta,
        { humanApproved: true },
      ),
    ).rejects.toMatchObject({ response: expect.objectContaining({ error: 'role_key_invalid' }) });
  });

  it('creates draft and strips actual_value', async () => {
    crmRepo.getPlan.mockResolvedValue({ id: 8, status: 'active' });
    repo.findUpsertMatch.mockResolvedValue(null);
    repo.insert.mockResolvedValue({
      id: 101,
      plan_id: 8,
      role_key: 'graphic',
      kpi_key: 'assets_on_brief',
      status: 'draft',
      actual_value: null,
    });

    const out = await svc.writeDraft(
      {
        plan_id: 8,
        lifecycle_id: 5,
        role_key: 'graphic',
        kpi_key: 'assets_on_brief',
        kpi_label: 'Assets on-brief',
        period_start: '2026-10-01',
        period_end: '2026-12-31',
        target_value: 8,
        target_unit: 'count',
        actual_value: 999,
      },
      meta,
      { humanApproved: true },
    );

    expect(out).toMatchObject({
      phase: 'P5-KPI',
      status: 'persisted',
      kpi_target_id: 101,
      role_key: 'graphic',
    });
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        target_value: 8,
        status: 'draft',
        form_data: expect.objectContaining({ ai_draft: true }),
      }),
    );
    expect(repo.insert.mock.calls[0][0]).not.toHaveProperty('actual_value');
  });

  it('rejects patch of approved row', async () => {
    repo.getById.mockResolvedValue({
      id: 50,
      status: 'approved',
      plan_id: 8,
      role_key: 'graphic',
      kpi_key: 'assets_on_brief',
      period_start: '2026-10-01',
      period_end: '2026-12-31',
      target_value: 8,
      target_unit: 'count',
    });
    await expect(
      svc.writeDraft(
        {
          id: 50,
          role_key: 'graphic',
          kpi_key: 'assets_on_brief',
          period_start: '2026-10-01',
          period_end: '2026-12-31',
          target_value: 9,
        },
        meta,
        { humanApproved: true },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('plan_not_found', async () => {
    crmRepo.getPlan.mockResolvedValue(null);
    await expect(
      svc.writeDraft(
        {
          plan_id: 999,
          role_key: 'content',
          kpi_key: 'posts_shipped',
          period_start: '2026-10-01',
          period_end: '2026-12-31',
        },
        meta,
        { humanApproved: true },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('read returns known/assumed/unknown', async () => {
    repo.list.mockResolvedValue([
      {
        id: 1,
        role_key: 'ads',
        kpi_key: 'cpl',
        status: 'draft',
        target_value: null,
        actual_value: null,
        form_data: { unknown_target: true },
        plan_id: 8,
      },
    ]);
    const out = await svc.read({ plan_id: 8 });
    expect(out.tool).toBe('kpi_target.read');
    expect(out.rows).toHaveLength(1);
    expect(out.unknown).toEqual(expect.arrayContaining(['ads.cpl:target']));
  });

  it('batch limit exceeded', async () => {
    await expect(
      svc.writeDraft(
        { items: Array.from({ length: 51 }, () => ({ role_key: 'am', kpi_key: 'x' })) },
        meta,
        { humanApproved: true },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('transition draft→review', async () => {
    repo.getById.mockResolvedValue({ id: 7, status: 'draft' });
    repo.patch.mockResolvedValue({ id: 7, status: 'review' });
    const out = await svc.transitionStatus(7, 'review', 'lead@ptt');
    expect(out.status).toBe('review');
  });

  it('patchDraftFields updates target/owner/due on draft', async () => {
    repo.getById.mockResolvedValue({
      id: 11,
      status: 'draft',
      period_start: '2026-10-01',
      period_end: '2026-12-31',
      target_value: 5,
      owner_staff_id: null,
    });
    repo.patch.mockResolvedValue({
      id: 11,
      status: 'draft',
      period_end: '2026-11-15',
      target_value: 12,
      owner_staff_id: 'AM 360',
    });

    const out = await svc.patchDraftFields(
      11,
      { target_value: 12, owner_staff_id: 'AM 360', due_date: '2026-11-15' },
      'lead@ptt',
    );

    expect(out.target_value).toBe(12);
    expect(repo.patch).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        target_value: 12,
        owner_staff_id: 'AM 360',
        period_end: '2026-11-15',
        form_data: expect.objectContaining({ staff_edited_by: 'lead@ptt' }),
      }),
    );
  });

  it('patchDraftFields rejects approved rows', async () => {
    repo.getById.mockResolvedValue({ id: 3, status: 'approved', period_start: null });
    await expect(
      svc.patchDraftFields(3, { target_value: 9 }, 'lead@ptt'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

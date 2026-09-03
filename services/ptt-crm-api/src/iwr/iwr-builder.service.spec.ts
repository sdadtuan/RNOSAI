import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { IwrBuilderService } from './iwr-builder.service';
import type { IwrActor } from './iwr.types';

describe('IwrBuilderService', () => {
  const actor: IwrActor = {
    staffId: 5,
    staffLabel: 'Viewer',
    departmentId: 1,
    caps: [{ section: 'iwr', action: 'view' }],
  };

  const otherReport = {
    id: 'r-other',
    template_id: 't1',
    template_code: 'daily_work',
    template_name_vi: 'Ngày',
    title: 'Other',
    author_staff_id: 99,
    reviewer_staff_id: 1,
    period_start: '2026-09-01',
    period_end: '2026-09-01',
    due_at: '2026-09-01T10:00:00Z',
    status: 'submitted' as const,
    version: 'v1.0',
    rag: null,
    is_late: false,
    late_reason: null,
    first_viewed_at: null,
    submitted_at: null,
    acknowledged_at: null,
    sections_json: { done: { body: 'secret', items: [] } },
  };

  const saved = {
    id: 's1',
    name_vi: 'Mine',
    owner_staff_id: 5,
    query_json: {},
    viz: 'table' as const,
    shared_staff_ids: [],
  };

  function makeService(overrides?: {
    rawRows?: typeof otherReport[];
    isRecipient?: boolean;
  }) {
    const repo = {
      getSavedReport: jest.fn().mockResolvedValue(saved),
      countBuilderQuery: jest.fn().mockResolvedValue(1),
      runBuilderQuery: jest.fn().mockResolvedValue(overrides?.rawRows ?? [otherReport]),
      listFieldsForReport: jest.fn().mockResolvedValue([]),
      queueExportJob: jest.fn(),
    };
    const reports = {
      isRecipient: jest.fn().mockResolvedValue(overrides?.isRecipient ?? false),
    };
    const org = {
      listActiveStaff: jest.fn().mockResolvedValue([
        { id: 5, name: 'Viewer', email: null, department_id: 1, reports_to_id: 2, active: true },
        { id: 99, name: 'Other', email: null, department_id: 2, reports_to_id: 2, active: true },
      ]),
    };
    const svc = new IwrBuilderService(repo as never, reports as never, org as never);
    return { svc, repo, reports };
  }

  it('run does not return reports outside actor visibility tree', async () => {
    const { svc } = makeService();
    const out = await svc.run(actor, 's1');
    expect(out.rows).toEqual([]);
  });

  it('run returns own-author reports', async () => {
    const own = { ...otherReport, author_staff_id: 5 };
    const { svc } = makeService({ rawRows: [own], isRecipient: false });
    const out = await svc.run(actor, 's1');
    expect(out.rows).toHaveLength(1);
    expect((out.rows[0] as { author_staff_id: number }).author_staff_id).toBe(5);
  });

  it('throws when saved report missing', async () => {
    const { svc, repo } = makeService();
    repo.getSavedReport.mockResolvedValue(null);
    await expect(svc.run(actor, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forbids run when not owner or shared', async () => {
    const { svc, repo } = makeService();
    repo.getSavedReport.mockResolvedValue({ ...saved, owner_staff_id: 99, shared_staff_ids: [] });
    await expect(svc.run(actor, 's1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

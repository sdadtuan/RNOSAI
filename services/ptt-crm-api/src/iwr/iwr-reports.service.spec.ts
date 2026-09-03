import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { emptySectionsForCode } from './iwr-sections.util';
import { IwrReportsService } from './iwr-reports.service';
import type { IwrActor } from './iwr.types';

function actor(id = 3): IwrActor {
  return {
    staffId: id,
    staffLabel: 'NV',
    departmentId: 10,
    caps: [{ section: 'iwr', action: 'write' }],
  };
}

function makeSvc(now?: Date) {
  const repo = {
    getTemplateByCode: jest.fn(),
    insertReport: jest.fn(),
    getReport: jest.fn(),
    listRecipients: jest.fn().mockResolvedValue([]),
    listComments: jest.fn().mockResolvedValue([]),
    insertComment: jest.fn(),
    listVersions: jest.fn().mockResolvedValue([]),
    listItems: jest.fn().mockResolvedValue([]),
    listDailyInRange: jest.fn().mockResolvedValue([]),
    findByAuthorPeriod: jest.fn().mockResolvedValue(null),
    updateSections: jest.fn(),
    replaceSources: jest.fn(),
    replaceRecipients: jest.fn(),
    insertVersionSnapshot: jest.fn(),
    updateStatus: jest.fn(),
    hasReviewerComment: jest.fn(),
    isRecipient: jest.fn().mockResolvedValue(false),
  };
  const org = {
    getStaff: jest.fn(),
    listActiveStaff: jest.fn().mockResolvedValue([
      { id: 2, name: 'TL', email: 't', department_id: 10, reports_to_id: 1, active: true },
      { id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true },
    ]),
  };
  const notify = { insert: jest.fn() };
  const audit = { insert: jest.fn() };
  const policy = { getActiveRules: jest.fn().mockResolvedValue(null) };
  const lists = { resolveMembers: jest.fn().mockResolvedValue([]) };
  const distRepo = { insertDeliveryLog: jest.fn() };
  const delegations = { isDelegateFor: jest.fn().mockResolvedValue(false) };
  const svc = new IwrReportsService(
    repo as never,
    org as never,
    notify as never,
    audit as never,
    policy as never,
    lists as never,
    distRepo as never,
    delegations as never,
  );
  if (now) svc.nowFn = () => now;
  return { svc, repo, org, notify, audit };
}

describe('IwrReportsService', () => {
  it('creates today daily and rejects weekend daily', async () => {
    const { svc, repo, org } = makeSvc(new Date('2026-09-03T09:00:00+07:00'));
    repo.getTemplateByCode.mockResolvedValue({
      id: 't1',
      code: 'daily_work',
      name_vi: 'Báo cáo ngày',
      kind: 'daily',
      sections_json: ['general', 'done', 'wip', 'next', 'blocked', 'approvals', 'notes'],
      due_rule_json: {},
      active: true,
    });
    org.getStaff.mockResolvedValue({
      id: 3,
      name: 'NV',
      email: 'n',
      department_id: 10,
      reports_to_id: 2,
      active: true,
    });
    repo.insertReport.mockResolvedValue({ id: 'r1', status: 'draft', template_code: 'daily_work' });
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'draft',
      template_code: 'daily_work',
      author_staff_id: 3,
      sections_json: emptySectionsForCode('daily_work'),
    });

    await expect(svc.create(actor(), { template_code: 'daily_work' })).resolves.toBeTruthy();
    await expect(
      svc.create(actor(), {
        template_code: 'daily_work',
        period_start: '2026-09-05',
        period_end: '2026-09-05',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submit requires late_reason after due', async () => {
    const { svc, repo, org } = makeSvc(new Date('2026-09-03T18:00:00+07:00'));
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'draft',
      author_staff_id: 3,
      template_code: 'daily_work',
      title: 'Báo cáo ngày',
      due_at: '2026-09-03T17:00:00.000+07:00',
      sections_json: emptySectionsForCode('daily_work'),
      version: 'v1.0',
    });
    org.getStaff.mockResolvedValue({
      id: 3,
      name: 'NV',
      email: 'n',
      department_id: 10,
      reports_to_id: 2,
      active: true,
    });
    org.listActiveStaff.mockResolvedValue([
      { id: 2, name: 'TL', email: 't', department_id: 10, reports_to_id: 1, active: true },
      { id: 3, name: 'NV', email: 'n', department_id: 10, reports_to_id: 2, active: true },
    ]);

    await expect(svc.submit(actor(), 'r1', {})).rejects.toMatchObject({
      response: { error: 'late_reason_required' },
    });
  });

  it('acks only the To reviewer', async () => {
    const { svc, repo } = makeSvc();
    const base = {
      id: 'r1',
      status: 'submitted' as const,
      author_staff_id: 3,
      reviewer_staff_id: 2,
      sections_json: {},
      template_code: 'daily_work',
      template_name_vi: 'x',
      template_id: 't',
      title: 't',
      period_start: '2026-09-03',
      period_end: '2026-09-03',
      due_at: '',
      version: 'v1.0',
      rag: null,
      is_late: false,
      late_reason: null,
      first_viewed_at: null,
      submitted_at: null,
      acknowledged_at: null,
    };
    let acked = false;
    repo.getReport.mockImplementation(async () => ({
      ...base,
      status: acked ? 'acknowledged' : 'submitted',
      acknowledged_at: acked ? '2026-09-03T10:00:00.000Z' : null,
    }));
    repo.listRecipients.mockResolvedValue([]);
    repo.listComments.mockResolvedValue([]);
    repo.listVersions.mockResolvedValue([]);
    repo.updateStatus.mockImplementation(async (_id, patch) => {
      if (patch.status === 'acknowledged') acked = true;
      return { ...base, status: patch.status };
    });

    await expect(svc.acknowledge(actor(3), 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      svc.acknowledge(
        { ...actor(2), caps: [{ section: 'iwr', action: 'review' }] },
        'r1',
      ),
    ).resolves.toMatchObject({ status: 'acknowledged' });
  });

  it('inserts comment before changes_requested', async () => {
    const { svc, repo } = makeSvc();
    const order: string[] = [];
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'submitted',
      author_staff_id: 3,
      reviewer_staff_id: 2,
      title: 't',
      sections_json: {},
    });
    repo.listRecipients.mockResolvedValue([]);
    repo.listComments.mockResolvedValue([]);
    repo.listVersions.mockResolvedValue([]);
    repo.insertComment.mockImplementation(async () => {
      order.push('comment');
      return { id: 'c1' };
    });
    repo.updateStatus.mockImplementation(async () => {
      order.push('status');
      return { id: 'r1', status: 'changes_requested' };
    });
    repo.getReport
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'submitted',
        author_staff_id: 3,
        reviewer_staff_id: 2,
        title: 't',
        sections_json: {},
      })
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'changes_requested',
        author_staff_id: 3,
        reviewer_staff_id: 2,
        title: 't',
        sections_json: {},
        template_code: 'daily_work',
        template_name_vi: 'x',
        template_id: 't',
        period_start: '2026-09-03',
        period_end: '2026-09-03',
        due_at: '',
        version: 'v1.0',
        rag: null,
        is_late: false,
        late_reason: null,
        first_viewed_at: null,
        submitted_at: null,
        acknowledged_at: null,
      });

    await svc.requestChanges(
      { ...actor(2), caps: [{ section: 'iwr', action: 'review' }] },
      'r1',
      { body_text: 'Thiếu evidence' },
    );
    expect(order).toEqual(['comment', 'status']);

    await expect(
      svc.requestChanges(
        { ...actor(2), caps: [{ section: 'iwr', action: 'review' }] },
        'r1',
        { body_text: 'x' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a daily outside the weekly period', async () => {
    const { svc, repo } = makeSvc();
    repo.getReport
      .mockResolvedValueOnce({
        id: 'w1',
        template_code: 'weekly_work',
        author_staff_id: 3,
        period_start: '2026-08-31',
        period_end: '2026-09-04',
        status: 'draft',
        sections_json: {},
        rag: null,
      })
      .mockResolvedValueOnce({
        id: 'd1',
        template_code: 'daily_work',
        author_staff_id: 3,
        period_start: '2026-08-20',
        period_end: '2026-08-20',
        status: 'submitted',
        sections_json: {},
      });
    await expect(svc.applySources(actor(3), 'w1', ['d1'])).rejects.toMatchObject({
      response: { error: 'iwr_source_not_eligible' },
    });
  });

  it('backfill weekend → iwr_not_workday', async () => {
    const { svc } = makeSvc(new Date('2026-09-03T09:00:00+07:00'));
    await expect(svc.createBackfill(actor(), { ymd: '2026-08-30' })).rejects.toMatchObject({
      response: { error: 'iwr_not_workday' },
    });
  });
});

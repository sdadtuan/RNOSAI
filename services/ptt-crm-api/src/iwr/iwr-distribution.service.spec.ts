import { ForbiddenException } from '@nestjs/common';
import { IwrDistributionService } from './iwr-distribution.service';
import { replyAllRecipientIds } from './iwr-recipient.util';
import type { IwrActor, IwrRecipientRow, IwrReportRow } from './iwr.types';

describe('IwrDistributionService', () => {
  const report: IwrReportRow = {
    id: 'r1',
    template_id: 't',
    template_code: 'daily_work',
    template_name_vi: 'Ngày',
    title: 'BC',
    author_staff_id: 3,
    reviewer_staff_id: 2,
    period_start: '2026-09-03',
    period_end: '2026-09-03',
    due_at: '2026-09-03T17:00:00+07:00',
    status: 'submitted',
    version: 'v1.0',
    rag: null,
    is_late: false,
    late_reason: null,
    first_viewed_at: null,
    submitted_at: '2026-09-03T10:00:00+07:00',
    acknowledged_at: null,
    sections_json: {},
    sensitivity: 'internal',
  };

  const recipients: IwrRecipientRow[] = [
    { id: '1', report_id: 'r1', staff_id: 2, kind: 'to' },
    { id: '2', report_id: 'r1', staff_id: 5, kind: 'cc' },
    { id: '3', report_id: 'r1', staff_id: 99, kind: 'bcc' },
  ];

  it('replyAll excludes bcc staff 99 from mentions', async () => {
    const actor: IwrActor = { staffId: 5, staffLabel: 'Cc', departmentId: 10, caps: [] };
    const notify = { insert: jest.fn().mockResolvedValue(undefined) };
    const distRepo = {
      insertComment: jest.fn().mockResolvedValue({
        id: 'c1',
        report_id: 'r1',
        section_key: '',
        body_text: 'ok',
        created_by_staff_id: 5,
        created_at: '2026-09-03T11:00:00+07:00',
      }),
      insertMentions: jest.fn(),
      insertDistribution: jest.fn().mockResolvedValue('d1'),
      insertDeliveryLog: jest.fn(),
    };
    const repo = {
      getReport: jest.fn().mockResolvedValue(report),
      listRecipients: jest.fn().mockResolvedValue(recipients),
      isRecipient: jest.fn().mockResolvedValue(true),
    };
    const org = { getStaff: jest.fn(), listActiveStaff: jest.fn() };
    const policy = { getActiveRules: jest.fn() };
    const svc = new IwrDistributionService(
      repo as never,
      distRepo as never,
      org as never,
      policy as never,
      notify as never,
    );

    await svc.replyAll(actor, 'r1', { body_text: 'Thanks all' });

    const mentionCall = distRepo.insertMentions.mock.calls[0]?.[2] as number[] | undefined;
    expect(mentionCall).toBeDefined();
    expect(mentionCall).not.toContain(99);
    expect(replyAllRecipientIds(recipients, 3, 5)).not.toContain(99);
  });

  it('forward confidential report returns 403 for non-manage', async () => {
    const hrReport = { ...report, sensitivity: 'hr' };
    const repo = {
      getReport: jest.fn().mockResolvedValue(hrReport),
      isRecipient: jest.fn().mockResolvedValue(true),
    };
    const actor: IwrActor = { staffId: 5, staffLabel: 'X', departmentId: 10, caps: [] };
    const org = {
      getStaff: jest.fn().mockResolvedValue({
        id: 3,
        name: 'A',
        email: null,
        department_id: 10,
        reports_to_id: 2,
        active: true,
      }),
      listActiveStaff: jest.fn().mockResolvedValue([]),
    };
    const policy = { getActiveRules: jest.fn().mockResolvedValue({ allow_bcc: true, cc_mode: 'w1' }) };
    const svc = new IwrDistributionService(
      repo as never,
      { insertDistribution: jest.fn(), insertDeliveryLog: jest.fn() } as never,
      org as never,
      policy as never,
      { insert: jest.fn() } as never,
    );

    await expect(
      svc.forward(actor, 'r1', { to_staff_ids: [6], note: 'FYI' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

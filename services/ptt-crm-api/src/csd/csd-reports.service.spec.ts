import { ConflictException } from '@nestjs/common';
import { CsdReportsService } from './csd-reports.service';
import type { CsdActor } from './csd.types';

describe('CsdReportsService', () => {
  const actor: CsdActor = { staffId: 5, staffLabel: 'pm@test.vn', caps: [{ section: 'csd', action: 'write' }] };

  const repo = {
    getTemplateByCode: jest.fn(),
    insertReport: jest.fn(),
    getReport: jest.fn(),
    updateReportStatus: jest.fn(),
    getCurrentVersion: jest.fn(),
    updateSections: jest.fn(),
    insertSendLog: jest.fn(),
    createRevisedVersion: jest.fn(),
  };

  function svc() {
    return new CsdReportsService(repo as never);
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('send-before-approve returns 409 for monthly_marketing', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'draft',
      current_version: 'v1.0',
      requires_approval: true,
      template_code: 'monthly_marketing',
    });

    await expect(
      svc().send(actor, 'r1', { to: ['client@test.vn'], subject: 'BC tháng', body: 'Nội dung' }),
    ).rejects.toMatchObject({ status: 409, response: { error: 'report_not_approved' } });
    expect(repo.insertSendLog).not.toHaveBeenCalled();
  });

  it('blocks section update after sent', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'sent',
      current_version: 'v1.0',
      requires_approval: true,
    });

    await expect(
      svc().updateSections(actor, 'r1', { executive_summary: { body: 'changed' } }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repo.updateSections).not.toHaveBeenCalled();
  });

  it('weekly_ops can send without director approval step', async () => {
    repo.getTemplateByCode.mockResolvedValue({
      id: 'tpl-weekly',
      code: 'weekly_ops',
      name_vi: 'Báo cáo vận hành tuần',
      requires_approval: false,
      sections_json: ['cover', 'executive_summary'],
    });
    repo.insertReport.mockResolvedValue({
      id: 'r2',
      status: 'draft',
      current_version: 'v1.0',
      requires_approval: false,
      template_code: 'weekly_ops',
    });
    repo.getReport
      .mockResolvedValueOnce({
        id: 'r2',
        status: 'draft',
        current_version: 'v1.0',
        requires_approval: false,
        template_code: 'weekly_ops',
      })
      .mockResolvedValueOnce({
        id: 'r2',
        status: 'draft',
        current_version: 'v1.0',
        requires_approval: false,
        template_code: 'weekly_ops',
      });
    repo.updateReportStatus.mockResolvedValue({
      id: 'r2',
      status: 'sent',
      current_version: 'v1.0',
    });
    repo.insertSendLog.mockResolvedValue({
      id: 'log1',
      report_id: 'r2',
      version: 'v1.0',
      result: 'sent',
    });

    const created = await svc().createReport(actor, {
      template_code: 'weekly_ops',
      period_start: '2026-08-25',
      period_end: '2026-08-31',
    });
    expect(created.requires_approval).toBe(false);

    const log = await svc().send(actor, 'r2', {
      to: ['client@test.vn'],
      subject: 'BC tuần',
      body: 'Tuần ổn định',
    });
    expect(log.result).toBe('sent');
    expect(repo.updateReportStatus).toHaveBeenCalledWith('r2', 'sent', expect.any(Object));
  });

  it('createRevisedVersion requires sent status', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r3',
      status: 'approved',
      current_version: 'v1.0',
      requires_approval: true,
    });

    await expect(svc().createRevisedVersion(actor, 'r3')).rejects.toMatchObject({
      status: 409,
      response: { error: 'report_not_sent' },
    });
  });
});

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
    listReports: jest.fn(),
    listVersions: jest.fn(),
    listSendLogs: jest.fn(),
    insertVersion: jest.fn(),
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

  it('snapshots v1.1 with changelog before send', async () => {
    repo.getReport.mockResolvedValue({ id: 'r1', status: 'draft', current_version: 'v1.0', requires_approval: true });
    repo.getCurrentVersion.mockResolvedValue({ sections_json: { cover: { body: 'a' } } });
    repo.insertVersion.mockResolvedValue({ version: 'v1.1', changelog: 'Sửa KPI' });
    const out = await svc().snapshotVersion(actor, 'r1', { kind: 'minor', changelog: 'Sửa KPI' });
    expect(repo.insertVersion).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'v1.1', changelog: 'Sửa KPI' }),
    );
    expect(out.current_version).toBe('v1.1');
  });

  it('snapshotVersion requires changelog of 3+ chars', async () => {
    repo.getReport.mockResolvedValue({ id: 'r1', status: 'draft', current_version: 'v1.0' });
    await expect(svc().snapshotVersion(actor, 'r1', { kind: 'minor', changelog: 'ab' })).rejects.toMatchObject({
      status: 400,
      response: { error: 'changelog_required' },
    });
    expect(repo.insertVersion).not.toHaveBeenCalled();
  });

  it('revise after sent uses major bump', async () => {
    repo.getReport.mockResolvedValue({ id: 'r1', status: 'sent', current_version: 'v1.1' });
    repo.getCurrentVersion.mockResolvedValue({ sections_json: {} });
    repo.createRevisedVersion.mockResolvedValue({ id: 'r1', status: 'draft', current_version: 'v2.0' });
    const out = await svc().createRevisedVersion(actor, 'r1');
    expect(out.current_version).toBe('v2.0');
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

  it('lists reports and due filter uses period_end window', async () => {
    repo.listReports.mockResolvedValue([{ id: 'r1', status: 'draft', period_end: '2026-09-05' }]);
    const out = await svc().list(actor, { status: 'due' });
    expect(repo.listReports).toHaveBeenCalledWith(expect.objectContaining({ status: 'due' }));
    expect(out.items).toHaveLength(1);
  });

  it('get returns current sections and version history', async () => {
    repo.getReport.mockResolvedValue({ id: 'r1', status: 'draft', current_version: 'v1.0' });
    repo.getCurrentVersion.mockResolvedValue({ version: 'v1.0', sections_json: { cover: { body: 'x' } } });
    repo.listVersions.mockResolvedValue([{ version: 'v1.0' }]);
    repo.listSendLogs.mockResolvedValue([]);
    const d = await svc().getDetail(actor, 'r1');
    expect(d.sections_json).toEqual({ cover: { body: 'x' } });
  });

  it('requestChanges without comment is 400', async () => {
    repo.getReport.mockResolvedValue({ id: 'r1', status: 'in_review', requires_approval: true });
    await expect(svc().transition(actor, 'r1', { to: 'changes_requested' })).rejects.toMatchObject({
      status: 400,
      response: { error: 'comment_required' },
    });
  });

  it('writer cannot approve in_review when requires_approval; manage succeeds', async () => {
    const report = { id: 'r1', status: 'in_review', requires_approval: true };
    repo.getReport.mockResolvedValue(report);
    repo.updateReportStatus.mockResolvedValue({ ...report, status: 'approved' });

    await expect(svc().transition(actor, 'r1', { to: 'approved' })).rejects.toMatchObject({
      status: 403,
      response: { error: 'csd_manage_required' },
    });
    expect(repo.updateReportStatus).not.toHaveBeenCalled();

    const manager: CsdActor = {
      staffId: 9,
      staffLabel: 'director@test.vn',
      caps: [{ section: 'csd', action: 'manage' }],
    };
    const out = await svc().transition(manager, 'r1', { to: 'approved' });
    expect(out.status).toBe('approved');
    expect(repo.updateReportStatus).toHaveBeenCalledWith('r1', 'approved', expect.any(Object));
  });

  it('transition to sent is 409 and does not mark sent', async () => {
    repo.getReport.mockResolvedValue({ id: 'r1', status: 'approved', requires_approval: true });
    await expect(svc().transition(actor, 'r1', { to: 'sent' })).rejects.toMatchObject({
      status: 409,
      response: { error: 'use_send_endpoint' },
    });
    expect(repo.updateReportStatus).not.toHaveBeenCalledWith('r1', 'sent', expect.anything());
  });

  it('writer cannot request changes; manage required', async () => {
    repo.getReport.mockResolvedValue({ id: 'r1', status: 'in_review', requires_approval: true });
    await expect(
      svc().transition(actor, 'r1', { to: 'changes_requested', comment: 'Cần sửa KPI' }),
    ).rejects.toMatchObject({
      status: 403,
      response: { error: 'csd_manage_required' },
    });
    expect(repo.updateReportStatus).not.toHaveBeenCalled();
  });
});

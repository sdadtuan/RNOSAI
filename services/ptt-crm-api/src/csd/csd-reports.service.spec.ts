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
    insertAttachment: jest.fn(),
    upsertScheduleNextRun: jest.fn(),
    insertSchedule: jest.fn(),
    listSchedules: jest.fn(),
    insertComment: jest.fn(),
    listComments: jest.fn(),
    resolveComment: jest.fn(),
    listTemplates: jest.fn(),
    getTemplateById: jest.fn(),
    insertTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    archiveTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    countReportsForTemplate: jest.fn(),
  };

  const tickets = {
    listForReportPeriod: jest.fn(),
  };

  const email = {
    send: jest.fn(),
  };

  const notify = {
    insert: jest.fn(),
  };

  const chat = {
    sendMessage: jest.fn(),
  };

  const chatRepo = {
    getConversation: jest.fn(),
  };

  function svc() {
    return new CsdReportsService(
      repo as never,
      tickets as never,
      email as never,
      notify as never,
      chat as never,
      chatRepo as never,
    );
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
    repo.getReport.mockResolvedValue({
      id: 'r2',
      status: 'draft',
      current_version: 'v1.0',
      requires_approval: false,
      template_code: 'weekly_ops',
    });
    repo.getCurrentVersion.mockResolvedValue({ sections_json: { cover: { body: 'ok' } } });
    repo.listVersions.mockResolvedValue([]);
    repo.listSendLogs.mockResolvedValue([]);
    repo.insertAttachment.mockResolvedValue({ id: 'att1', file_name: 'PTT-weekly_ops-v1.0.pdf' });
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
    email.send.mockResolvedValue({ id: 'e1', send_status: 'sent' });

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

  it('does not mark sent when email send fails', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1', status: 'approved', current_version: 'v1.0', requires_approval: true, owner_staff_id: 5,
    });
    repo.getCurrentVersion.mockResolvedValue({ sections_json: { cover: { body: 'ok' } } });
    email.send.mockRejectedValue(new Error('smtp_down'));
    await expect(svc().send(actor, 'r1', { to: ['a@b.c'], subject: 'BC', body: 'gui' })).rejects.toMatchObject({
      response: { error: 'report_send_failed' },
    });
    expect(repo.updateReportStatus).not.toHaveBeenCalledWith('r1', 'sent', expect.anything());
    expect(repo.insertSendLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'failed' }));
    expect(notify.insert).toHaveBeenCalledWith(expect.objectContaining({ event_key: 'report_send_failed', staff_id: 5 }));
  });

  it('does not mark sent when email stays queued', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1', status: 'approved', current_version: 'v1.0', requires_approval: true, owner_staff_id: 5,
    });
    repo.getCurrentVersion.mockResolvedValue({ sections_json: { cover: { body: 'ok' } } });
    email.send.mockResolvedValue({ id: 'e1', send_status: 'queued' });
    await expect(svc().send(actor, 'r1', { to: ['a@b.c'], subject: 'BC', body: 'gui' })).rejects.toMatchObject({
      response: { error: 'report_send_failed' },
    });
    expect(repo.updateReportStatus).not.toHaveBeenCalledWith('r1', 'sent', expect.anything());
    expect(repo.insertSendLog).toHaveBeenCalledWith(expect.objectContaining({ result: 'failed' }));
  });

  it('schedules future send without SMTP', async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'approved',
      current_version: 'v1.0',
      requires_approval: true,
      template_id: 'tpl1',
      owner_staff_id: 5,
    });
    repo.upsertScheduleNextRun.mockResolvedValue(undefined);
    repo.updateReportStatus.mockResolvedValue({ id: 'r1', status: 'scheduled' });
    repo.insertSendLog.mockResolvedValue({ id: 'log1', result: 'queued' });

    const log = await svc().send(actor, 'r1', {
      to: ['a@b.c'],
      subject: 'BC',
      body: 'gui',
      schedule_at: future,
    });

    expect(log.result).toBe('queued');
    expect(email.send).not.toHaveBeenCalled();
    expect(repo.updateReportStatus).toHaveBeenCalledWith('r1', 'scheduled', expect.any(Object));
    expect(repo.upsertScheduleNextRun).toHaveBeenCalledWith(
      expect.objectContaining({ template_id: 'tpl1', next_run_at: future }),
    );
  });

  it('retrySend requires last log failed and report not sent', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'approved',
      current_version: 'v1.0',
      requires_approval: true,
    });
    repo.listSendLogs.mockResolvedValue([{ result: 'sent', to_json: ['a@b.c'] }]);
    await expect(svc().retrySend(actor, 'r1')).rejects.toMatchObject({
      response: { error: 'retry_not_allowed' },
    });
    expect(email.send).not.toHaveBeenCalled();
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

  it('rollup is 409 when report is sent', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'sent',
      current_version: 'v1.0',
      client_account_id: 'acc-1',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
    });

    await expect(svc().rollupTickets(actor, 'r1')).rejects.toMatchObject({
      status: 409,
      response: { error: 'report_sent_immutable' },
    });
    expect(tickets.listForReportPeriod).not.toHaveBeenCalled();
    expect(repo.updateSections).not.toHaveBeenCalled();
  });

  it('rollup writes OOS tickets into risks', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'draft',
      current_version: 'v1.0',
      client_account_id: 'acc-1',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
    });
    repo.getCurrentVersion.mockResolvedValue({ sections_json: {} });
    tickets.listForReportPeriod.mockResolvedValue([
      { id: 't2', code: 'PTT-2026-000002', title: 'Làm app', status: 'new', sla_status: 'on_track', scope_status: 'out_of_scope' },
    ]);
    repo.updateSections.mockResolvedValue({ version: 'v1.0', sections_json: { risks: { blocks: [] } } });

    const out = await svc().rollupTickets(actor, 'r1');
    expect(tickets.listForReportPeriod).toHaveBeenCalledWith('acc-1', '2026-08-01', '2026-08-31');
    expect(repo.updateSections).toHaveBeenCalledWith(
      'r1',
      'v1.0',
      expect.objectContaining({
        risks: expect.objectContaining({
          blocks: expect.arrayContaining([
            expect.objectContaining({ type: 'ticket_rollup', ticket_ids: expect.arrayContaining(['t2']) }),
          ]),
        }),
      }),
      5,
    );
    expect(out.version).toBe('v1.0');
  });

  it('createSchedule requires manage and does not send', async () => {
    await expect(
      svc().createSchedule(actor, {
        template_code: 'monthly_marketing',
        recurrence: 'monthly',
        next_run_at: '2026-10-01T00:00:00.000Z',
        owner_staff_id: 5,
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { error: 'csd_manage_required' },
    });
    expect(repo.insertSchedule).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('createSchedule inserts recurring draft schedule', async () => {
    const manager: CsdActor = {
      staffId: 9,
      staffLabel: 'director@test.vn',
      caps: [{ section: 'csd', action: 'manage' }],
    };
    repo.getTemplateByCode.mockResolvedValue({
      id: 'tpl1',
      code: 'monthly_marketing',
      name_vi: 'Báo cáo marketing tháng',
      requires_approval: true,
      sections_json: [],
    });
    repo.insertSchedule.mockResolvedValue({
      id: 's1',
      recurrence: 'monthly',
      template_code: 'monthly_marketing',
    });

    const out = await svc().createSchedule(manager, {
      template_code: 'monthly_marketing',
      recurrence: 'monthly',
      next_run_at: '2026-10-01T00:00:00.000Z',
      owner_staff_id: 5,
    });

    expect(out.id).toBe('s1');
    expect(repo.insertSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        template_id: 'tpl1',
        recurrence: 'monthly',
        owner_staff_id: 5,
      }),
    );
    expect(email.send).not.toHaveBeenCalled();
  });

  it('shareToClientChat returns 409 when conversation client mismatches', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'sent',
      current_version: 'v1.0',
      title: 'BC tháng',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      client_account_id: 'acc-1',
    });
    chatRepo.getConversation.mockResolvedValue({
      id: 'c-other',
      kind: 'client',
      client_account_id: 'acc-2',
      status: 'active',
    });

    await expect(
      svc().shareToClientChat(actor, 'r1', { conversation_id: 'c-other' }),
    ).rejects.toMatchObject({
      status: 409,
      response: { error: 'chat_client_mismatch' },
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
    expect(repo.insertSendLog).not.toHaveBeenCalled();
    expect(repo.updateReportStatus).not.toHaveBeenCalled();
  });

  it('shareToClientChat posts client-visible message and logs chat without changing sent status', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'sent',
      current_version: 'v1.2',
      title: 'BC tháng',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      client_account_id: 'acc-1',
    });
    chatRepo.getConversation.mockResolvedValue({
      id: 'c1',
      kind: 'client',
      client_account_id: 'acc-1',
      status: 'active',
    });
    chat.sendMessage.mockResolvedValue({ id: 'm1', visibility: 'client' });
    repo.insertSendLog.mockResolvedValue({ id: 'log-chat', channel: 'chat', result: 'sent' });

    const out = await svc().shareToClientChat(actor, 'r1', { conversation_id: 'c1' });

    expect(out).toEqual({ message_id: 'm1' });
    expect(chat.sendMessage).toHaveBeenCalledWith(
      actor,
      'c1',
      expect.objectContaining({
        visibility: 'client',
        body_text: 'Báo cáo BC tháng · v1.2\n2026-08-01 → 2026-08-31\nTải PDF: /crm/csd/reports/r1',
      }),
    );
    expect(repo.insertSendLog).toHaveBeenCalledWith(
      expect.objectContaining({
        report_id: 'r1',
        version: 'v1.2',
        channel: 'chat',
        result: 'sent',
      }),
    );
    expect(repo.updateReportStatus).not.toHaveBeenCalled();
  });

  it('shareToClientChat returns 404 when conversation is missing', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'approved',
      current_version: 'v1.0',
      title: 'BC',
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      client_account_id: 'acc-1',
    });
    chatRepo.getConversation.mockResolvedValue(null);

    await expect(
      svc().shareToClientChat(actor, 'r1', { conversation_id: 'missing' }),
    ).rejects.toMatchObject({
      status: 404,
      response: { error: 'client_chat_not_found' },
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();
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

  it('adds comment with section_key risks', async () => {
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'draft',
      current_version: 'v1.0',
    });
    repo.insertComment.mockResolvedValue({
      id: 'c1',
      report_id: 'r1',
      version: 'v1.0',
      section_key: 'risks',
      body_text: 'Thiếu upsell',
      created_by_staff_id: 5,
      resolved_at: null,
    });

    const out = await svc().addComment(actor, 'r1', {
      section_key: 'risks',
      body_text: 'Thiếu upsell',
    });

    expect(out.section_key).toBe('risks');
    expect(repo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({
        report_id: 'r1',
        version: 'v1.0',
        section_key: 'risks',
        body_text: 'Thiếu upsell',
        created_by_staff_id: 5,
      }),
    );
  });

  it('requestChanges inserts a general comment with empty section_key', async () => {
    const manager: CsdActor = {
      staffId: 9,
      staffLabel: 'director@test.vn',
      caps: [{ section: 'csd', action: 'manage' }],
    };
    repo.getReport.mockResolvedValue({
      id: 'r1',
      status: 'in_review',
      current_version: 'v1.0',
      requires_approval: true,
    });
    repo.updateReportStatus.mockResolvedValue({ id: 'r1', status: 'changes_requested' });
    repo.insertComment.mockResolvedValue({
      id: 'c1',
      report_id: 'r1',
      section_key: '',
      body_text: 'Cần sửa KPI',
    });

    await svc().transition(manager, 'r1', { to: 'changes_requested', comment: 'Cần sửa KPI' });

    expect(repo.insertComment).toHaveBeenCalledWith(
      expect.objectContaining({
        report_id: 'r1',
        version: 'v1.0',
        section_key: '',
        body_text: 'Cần sửa KPI',
        created_by_staff_id: 9,
      }),
    );
  });

  it('archive template in use does not delete the row', async () => {
    const manager: CsdActor = {
      staffId: 9,
      staffLabel: 'director@test.vn',
      caps: [{ section: 'csd', action: 'manage' }],
    };
    repo.getTemplateById.mockResolvedValue({
      id: 'tpl1',
      code: 'weekly_ops',
      name_vi: 'Báo cáo vận hành tuần',
      active: true,
    });
    repo.countReportsForTemplate.mockResolvedValue(3);
    repo.archiveTemplate.mockResolvedValue({
      id: 'tpl1',
      code: 'weekly_ops',
      name_vi: 'Báo cáo vận hành tuần',
      active: false,
    });

    const out = await svc().archiveTemplate(manager, 'tpl1');

    expect(out.active).toBe(false);
    expect(repo.archiveTemplate).toHaveBeenCalledWith('tpl1');
    expect(repo.deleteTemplate).not.toHaveBeenCalled();
  });
});

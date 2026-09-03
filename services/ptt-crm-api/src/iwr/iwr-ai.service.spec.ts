import { NotFoundException } from '@nestjs/common';
import { IwrAiService } from './iwr-ai.service';
import type { IwrActor } from './iwr.types';

describe('IwrAiService', () => {
  const actor: IwrActor = {
    staffId: 3,
    staffLabel: 'NV',
    departmentId: 1,
    caps: [{ section: 'iwr', action: 'view' }],
  };

  afterEach(() => {
    delete process.env.PTT_IWR_LLM;
  });

  it('returns disabled status when flag off', () => {
    process.env.PTT_IWR_LLM = '0';
    const svc = new IwrAiService({} as never, { insert: jest.fn() } as never);
    expect(svc.status()).toEqual({ enabled: false });
  });

  it('summarize throws 404 when LLM disabled', async () => {
    process.env.PTT_IWR_LLM = '0';
    const reports = { get: jest.fn() };
    const svc = new IwrAiService(reports as never, { insert: jest.fn() } as never);
    await expect(svc.summarize(actor, 'r1')).rejects.toBeInstanceOf(NotFoundException);
    expect(reports.get).not.toHaveBeenCalled();
  });

  it('summarize uses reports.get for visibility when enabled', async () => {
    process.env.PTT_IWR_LLM = '1';
    const report = {
      id: 'r1',
      title: 'BC',
      template_code: 'daily_work',
      template_name_vi: 'Ngày',
      template_id: 't1',
      author_staff_id: 3,
      reviewer_staff_id: 2,
      period_start: '2026-09-01',
      period_end: '2026-09-01',
      due_at: '2026-09-01',
      status: 'submitted',
      version: 'v1.0',
      rag: null,
      is_late: false,
      late_reason: null,
      first_viewed_at: null,
      submitted_at: null,
      acknowledged_at: null,
      sections_json: { done: { body: 'x', items: [] } },
      recipients: [],
      comments: [],
      versions: [],
    };
    const reports = { get: jest.fn().mockResolvedValue(report) };
    const audit = { insert: jest.fn().mockResolvedValue(undefined) };
    const svc = new IwrAiService(reports as never, audit as never);
    const out = await svc.summarize(actor, 'r1');
    expect(reports.get).toHaveBeenCalledWith(actor, 'r1');
    expect(out.citations).toEqual(['r1']);
    expect(out.text).toContain('Tóm tắt');
  });
});

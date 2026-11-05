import { buildIwrSummarizePrompt } from './iwr-ai-prompt.util';
import type { IwrReportDetail } from './iwr.types';

describe('iwr-ai-prompt.util', () => {
  it('prompt uses masked section body not raw hr content', () => {
    const report: IwrReportDetail = {
      id: 'r1',
      template_id: 't1',
      template_code: 'monthly_work',
      template_name_vi: 'Tháng',
      title: 'BC tháng 8',
      author_staff_id: 3,
      reviewer_staff_id: 2,
      period_start: '2026-08-01',
      period_end: '2026-08-31',
      due_at: '2026-09-01T10:00:00Z',
      status: 'submitted',
      version: 'v1.0',
      rag: null,
      is_late: false,
      late_reason: null,
      first_viewed_at: null,
      submitted_at: null,
      acknowledged_at: null,
      sections_json: {
        done: { body: 'Hoàn thành sprint', items: [] },
        people: { body: '***', items: [] },
      },
      recipients: [],
      comments: [],
      versions: [],
    };
    const prompt = buildIwrSummarizePrompt(report);
    expect(prompt).toContain('Hoàn thành sprint');
    expect(prompt).not.toContain('salary');
    expect(prompt).not.toMatch(/lương|payroll/i);
    expect(prompt).toContain('***');
  });
});

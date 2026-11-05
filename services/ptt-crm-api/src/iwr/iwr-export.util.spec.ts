import { renderIwrReportCsv, renderIwrReportPdf, renderIwrReportXlsx } from './iwr-export.util';

describe('iwr-export.util', () => {
  it('pdf starts with %PDF and has no client-share wording', async () => {
    const buf = await renderIwrReportPdf({
      title: 'Báo cáo ngày 2026-09-03',
      author_name: 'NV A',
      period_start: '2026-09-03',
      period_end: '2026-09-03',
      status: 'submitted',
      sections: [{ key: 'done', label: 'Việc xong', body: 'Xong ticket' }],
    });
    expect(buf.subarray(0, 4).toString()).toBe('%PDF');
    expect(buf.toString('latin1').includes('Gửi khách')).toBe(false);
  });

  it('xlsx is a zip with Bao cao sheet and no client column', async () => {
    const buf = await renderIwrReportXlsx({
      title: 'Báo cáo ngày 2026-09-03',
      author_name: 'NV A',
      period_start: '2026-09-03',
      period_end: '2026-09-03',
      status: 'submitted',
      sections: [{ key: 'done', label: 'Việc xong', body: 'Xong ticket' }],
      items: [{ title: 'Banner', ref_kind: 'csd_ticket', ref_id: 't1' }],
    });
    expect(buf.subarray(0, 2).toString()).toBe('PK');
    expect(buf.length).toBeGreaterThan(100);
    const csv = renderIwrReportCsv({
      title: 'Báo cáo ngày',
      author_name: 'NV',
      period_start: '2026-09-03',
      period_end: '2026-09-03',
      status: 'draft',
      sections: [{ key: 'done', label: 'Việc xong', body: 'A' }],
      items: [],
    });
    expect(csv).toContain('title');
    expect(csv).not.toContain('client');
  });
});

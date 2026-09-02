import { renderIwrReportPdf } from './iwr-export.util';

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
});

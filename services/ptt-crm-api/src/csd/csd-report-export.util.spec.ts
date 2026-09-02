import { renderCsdReportPdf, renderCsdReportXlsx } from './csd-report-export.util';

describe('csd-report-export.util', () => {
  it('pdf starts with %PDF and xlsx is zip', async () => {
    const detail = {
      title: 'BC tuần',
      version: 'v1.0',
      period_start: '2026-08-25',
      period_end: '2026-08-31',
      client_label: 'ABC Land',
      sections: [
        { key: 'cover', label: 'Bìa', section: { blocks: [{ type: 'rich_text' as const, body: 'Xin chào' }] } },
      ],
    };
    const pdf = await renderCsdReportPdf(detail);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    const xlsx = await renderCsdReportXlsx(detail);
    expect(xlsx.subarray(0, 2).toString()).toBe('PK');
  });
});

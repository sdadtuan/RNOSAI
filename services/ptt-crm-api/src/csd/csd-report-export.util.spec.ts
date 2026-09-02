import ExcelJS from 'exceljs';
import { renderCsdReportPdf, renderCsdReportXlsx, sectionExportText } from './csd-report-export.util';

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

  it('renders ticket_rollup file and chart as text in pdf and xlsx', async () => {
    const section = {
      blocks: [
        { type: 'ticket_rollup' as const, ticket_ids: ['t1', 't2'], summary: 'Dong 2 ticket' },
        { type: 'file' as const, attachment_id: 'att-1', caption: 'SLA chart' },
        { type: 'chart' as const, title: 'SLA', labels: ['ok', 'breach'], values: [8, 1] },
      ],
    };
    const text = sectionExportText(section);
    expect(text).toContain('Dong 2 ticket');
    expect(text).toContain('t1');
    expect(text).toContain('SLA chart');
    expect(text).toContain('SLA');

    const detail = {
      title: 'BC tuan',
      version: 'v1.0',
      period_start: '2026-08-25',
      period_end: '2026-08-31',
      client_label: 'ABC Land',
      sections: [{ key: 'ticket_sla', label: 'Ticket & SLA', section }],
    };
    const pdf = await renderCsdReportPdf(detail);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');

    const xlsx = await renderCsdReportXlsx(detail);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as unknown as ArrayBuffer);
    const sheet = wb.getWorksheet('Sections');
    const cells = (sheet?.getColumn(2).values ?? []).map(String).join('\n');
    expect(cells).toContain('Dong 2 ticket');
    expect(cells).toContain('t1, t2');
    expect(cells).toContain('SLA chart');
    expect(cells).toContain('ok: 8');
  });
});

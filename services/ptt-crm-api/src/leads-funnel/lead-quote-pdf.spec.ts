import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { hourlyFromPosition, assembleQuoteSheet, type QuoteSheetItem, type QuoteSheetStaff } from './quote-sheet.util';
import { renderLeadQuotePdf } from './lead-quote-pdf';

function pdfText(buffer: Buffer): string {
  const dir = mkdtempSync(join(tmpdir(), 'lead-quote-'));
  const file = join(dir, 'quote.pdf');
  writeFileSync(file, buffer);
  const parserPath = join(__dirname, '../../node_modules/pdf-parse/dist/pdf-parse/cjs/index.cjs');
  const script = `
    const { PDFParse } = require(${JSON.stringify(parserPath)});
    const { readFileSync } = require('fs');
    (async () => {
      const parser = new PDFParse({ data: readFileSync(process.argv[1]) });
      const text = await parser.getText();
      process.stdout.write(text.text || '');
      await parser.destroy();
    })().catch((error) => { console.error(error); process.exit(1); });
  `;
  return execFileSync(process.execPath, ['-e', script, file], { encoding: 'utf8' });
}

const staff: QuoteSheetStaff[] = [
  {
    id: 7,
    name: 'An',
    position_code: 'AE',
    position_name: 'Account Executive',
    monthly_salary_vnd: 15_000_000,
    hours_per_month: 176,
    hourly_vnd: hourlyFromPosition(15_000_000, 176),
  },
];

const item: QuoteSheetItem = {
  code: 'WEB-01-01',
  service_code: 'WEB',
  service_name: 'Website',
  phase_code: 'K',
  phase_name: 'Khởi động',
  task: 'Tiếp nhận handover',
  subtask: 'Đọc brief và chốt phạm vi.',
  role_code: 'am',
  est_hours: 2,
  qty: 1,
  unit: 'times',
  billable: true,
  client_only: false,
};

describe('lead quote pdf', () => {
  it('renders a downloadable quote with VAT and promotion', async () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item],
      selectedServiceCodes: ['WEB'],
      overrides: [],
      promoPercent: 10,
      vatPercent: 8,
    });
    const pdf = await renderLeadQuotePdf(view, 'Công ty Lan');
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(800);
    const text = pdfText(pdf);
    expect(text).toContain('BÁO GIÁ');
    expect(text).toContain('Công ty Lan');
    expect(text).toContain('Phần việc');
    expect(text).toContain('Thành tiền');
    expect(text).toContain('Tổng thanh toán');
    expect(text).not.toContain('An');
    expect(text).not.toContain('Account Executive');
    expect(text).not.toContain('Chưa gán');
  });

  it('renders an empty quote without staff fields', async () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [],
      selectedServiceCodes: [],
      overrides: [],
    });
    const pdf = await renderLeadQuotePdf(view, '   ');
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(800);
    const text = pdfText(pdf);
    expect(text).toContain('Khách hàng');
    expect(text).toContain('Chưa có hạng mục');
    expect(text).toContain('Tổng thanh toán');
    expect(text).not.toContain('An');
  });

  it('keeps going when the table crosses a page', async () => {
    const items = Array.from({ length: 36 }, (_, index) => ({
      ...item,
      code: `WEB-01-${index + 1}`,
      task: `Hạng mục ${index + 1}`,
      subtask: 'Mô tả đủ dài để xuống dòng trong ô mô tả mà không tràn sang cột thành tiền.',
    }));
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items,
      selectedServiceCodes: ['WEB'],
      overrides: [],
      promoPercent: 10,
      vatPercent: 8,
    });
    const pdf = await renderLeadQuotePdf(view, 'Công ty Lan');
    expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(800);
    const text = pdfText(pdf);
    expect(text).toContain('Hạng mục 1');
    expect(text).toContain('Hạng mục 36');
    expect(text).not.toContain('An');
  });
});
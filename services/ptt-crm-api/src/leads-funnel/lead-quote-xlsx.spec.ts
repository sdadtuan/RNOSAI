import ExcelJS from 'exceljs';
import { hourlyFromPosition, assembleQuoteSheet, type QuoteSheetItem, type QuoteSheetStaff } from './quote-sheet.util';
import { renderLeadQuoteXlsx } from './lead-quote-xlsx';

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

async function rowsOf(buffer: Buffer): Promise<ExcelJS.Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.getWorksheet('BÁO GIÁ PTT ADS');
  if (!sheet) throw new Error('missing sheet');
  const rows: ExcelJS.Row[] = [];
  sheet.eachRow((row) => rows.push(row));
  return rows;
}

function textOf(rows: ExcelJS.Row[]): string {
  return rows.map((row) => (row.values as unknown[]).filter((cell) => cell != null).join(' | ')).join('\n');
}

describe('lead quote xlsx', () => {
  it('builds the quote file without staff names or rates', async () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item, { ...item, code: 'WEB-01-02', task: 'Việc không xuất', subtask: 'Chi tiết nội bộ' }],
      selectedServiceCodes: ['WEB'],
      overrides: [{ item_code: 'WEB-01-02', staff_id: 7, hours: 3, included: false }],
      promoPercent: 10,
      vatPercent: 8,
    });
    const xlsx = await renderLeadQuoteXlsx(view, 'Công ty Lan');
    expect(xlsx.subarray(0, 2).toString()).toBe('PK');
    const text = textOf(await rowsOf(xlsx));
    expect(text).toContain('MEDIA PLAN | PTT ADS');
    expect(text).toContain('Tên Khách Hàng');
    expect(text).toContain('Công ty Lan');
    expect(text).toContain('Tên Dự Án');
    expect(text).toContain('Website');
    expect(text).toContain('Hình thức');
    expect(text).toContain('Mô tả');
    expect(text).toContain('Estimated KPIs');
    expect(text).toContain('Tiếp nhận handover');
    expect(text).toContain('Đọc brief và chốt phạm vi.');
    expect(text).toContain('Website · Khởi động');
    expect(text).toContain('THÀNH TIỀN');
    expect(text).toContain('PTT ADS');
    expect(text).not.toContain('Việc không xuất');
    expect(text).not.toContain('An');
    expect(text).not.toContain('Account Executive');
  });

  it('renders an empty quote with zero totals', async () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [],
      selectedServiceCodes: [],
      overrides: [],
    });
    const text = textOf(await rowsOf(await renderLeadQuoteXlsx(view, '   ')));
    expect(text).toContain('Khách hàng');
    expect(text).toContain('MEDIA PLAN | PTT ADS');
    expect(text).toContain('Chưa có hạng mục');
    expect(text).toContain('Chưa có phạm vi công việc');
    expect(text).toContain('THÀNH TIỀN');
    expect(text).toContain('0');
    expect(text).not.toContain('An');
  });
});

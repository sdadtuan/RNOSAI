import ExcelJS from 'exceljs';
import { hourlyFromPosition, assembleQuoteSheet, type QuoteSheetItem, type QuoteSheetStaff } from './quote-sheet.util';
import {
  renderLeadQuoteXlsx,
  resolveBaoGiaTemplatePath,
  resolvePttLogoPath,
  normalizeCtr,
} from './lead-quote-xlsx';

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

async function loadSheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = wb.getWorksheet('BÁO GIÁ PTT ADS');
  if (!sheet) throw new Error('missing sheet');
  return sheet;
}

async function rowsOf(buffer: Buffer): Promise<ExcelJS.Row[]> {
  const sheet = await loadSheet(buffer);
  const rows: ExcelJS.Row[] = [];
  sheet.eachRow((row) => rows.push(row));
  return rows;
}

function textOf(rows: ExcelJS.Row[]): string {
  return rows.map((row) => (row.values as unknown[]).filter((cell) => cell != null).join(' | ')).join('\n');
}

function fillArgb(cell: ExcelJS.Cell): string | undefined {
  const fill = cell.fill as ExcelJS.FillPattern | undefined;
  if (!fill || fill.type !== 'pattern' || fill.pattern === 'none') return undefined;
  return fill.fgColor?.argb || fill.bgColor?.argb;
}

describe('lead quote xlsx', () => {
  it('builds the quote file without staff names or rates', async () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item, { ...item, code: 'WEB-01-02', task: 'Việc không xuất', subtask: 'Chi tiết nội bộ' }],
      selectedServiceCodes: ['WEB'],
      overrides: [
        { item_code: 'WEB-01-01', staff_id: 7, hours: 2, included: true },
        { item_code: 'WEB-01-02', staff_id: 7, hours: 3, included: false },
      ],
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
    expect(text).toContain('Khuyến mại');
    expect(text).toContain('VAT');
    expect(text).not.toContain('Việc không xuất');
    expect(text).not.toContain('An');
    expect(text).not.toContain('Account Executive');
    expect(text).not.toContain('KHANG THỊNH');
    expect(text).not.toContain('THE COLLECTORS');
    expect(text).not.toContain('VAT FACEBOOK');
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

  it('embeds the PTT Ads logo in the workbook', async () => {
    expect(resolveBaoGiaTemplatePath()).toBeTruthy();
    expect(resolvePttLogoPath()).toBeTruthy();
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item],
      selectedServiceCodes: ['WEB'],
      overrides: [],
      promoPercent: 0,
      vatPercent: 0,
    });
    const xlsx = await renderLeadQuoteXlsx(view, 'Công ty Lan');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as unknown as ExcelJS.Buffer);
    const media = (wb.model as { media?: Array<{ extension?: string }> }).media ?? [];
    expect(media.length).toBeGreaterThan(0);
    expect(media.some((entry) => entry.extension === 'png')).toBe(true);
    const sheet = wb.getWorksheet('BÁO GIÁ PTT ADS');
    expect(sheet).toBeTruthy();
    const images = typeof sheet!.getImages === 'function' ? sheet!.getImages() : [];
    expect(images.length).toBeGreaterThan(0);
  });

  it('keeps the logo in its own cells and formats numbers like the template', async () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [
        { ...item, qty: 1, unit: 'lần' },
        { ...item, code: 'WEB-01-02', task: 'Họp nghiệm thu', subtask: 'Trình bày kết quả.', qty: 1, unit: 'lần' },
      ],
      selectedServiceCodes: ['WEB'],
      overrides: [
        { item_code: 'WEB-01-01', staff_id: null, hours: 1, included: true },
        { item_code: 'WEB-01-02', staff_id: null, hours: 1, included: true },
      ],
      promoPercent: 0,
      vatPercent: 0,
    });
    const xlsx = await renderLeadQuoteXlsx(view, 'chien test 20', {
      goal: 'Nghiệm thu và bàn giao hệ thống nhận diện thương hiệu',
      ta: 'Khách hàng doanh nghiệp',
      comms_period: '1 tháng',
      impression: 3000,
      reach: 2400,
      click: 150,
      ctr: 0.05,
      lead: 0,
      channels: [
        { name: 'Tiếp nhận handover', impression: 1000, reach: 800, click: 50, ctr: 0.05 },
        { name: 'Họp nghiệm thu', impression: 1000, reach: 800, click: 50, ctr: 5 },
      ],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsx as unknown as ExcelJS.Buffer);
    const sheet = wb.getWorksheet('BÁO GIÁ PTT ADS');
    expect(sheet).toBeTruthy();

    expect(String(sheet!.getCell('C2').value ?? '')).toBe('MEDIA PLAN | PTT ADS');
    expect(String(sheet!.getCell('A2').value ?? '')).not.toContain('MEDIA PLAN');
    const images = sheet!.getImages();
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      const tlCol = image.range?.tl?.nativeCol ?? image.range?.tl?.col ?? 0;
      const brCol = image.range?.br?.nativeCol ?? image.range?.br?.col ?? 0;
      expect(tlCol).toBeLessThan(2);
      expect(brCol).toBeLessThanOrEqual(2);
    }

    expect(sheet!.getCell('E12').value).toBe('Số lượng');
    expect(sheet!.getCell('F12').value).toBe('Đơn vị');
    expect(fillArgb(sheet!.getCell('A12'))).toBe('FF174F31');
    expect(fillArgb(sheet!.getCell('I12'))).toBe('FF8DC448');
    expect(fillArgb(sheet!.getCell('N12'))).toBe('FF8DC448');

    const budget = sheet!.getCell('C9');
    expect(typeof budget.value).toBe('number');
    expect(budget.numFmt).toBe('#,##0');
    expect(fillArgb(budget)).toBe('FFEAF4E4');
    expect(budget.font?.color?.argb).toBe('FF20382B');

    let dataRow = 0;
    sheet!.eachRow((row, rowNumber) => {
      if (rowNumber < 13) return;
      const first = row.getCell(1).value;
      if (typeof first !== 'number') return;
      dataRow += 1;
      const expectedFill = dataRow % 2 === 1 ? 'FFEAF4E4' : 'FFFFFFFF';
      for (let col = 1; col <= 14; col += 1) {
        const cell = row.getCell(col);
        const argb = fillArgb(cell);
        expect(argb).not.toBe('FF000000');
        expect(argb).not.toBe('00000000');
        expect(argb).toBe(expectedFill);
      }
      expect(typeof row.getCell(7).value).toBe('number');
      expect(row.getCell(7).numFmt).toBe('#,##0');
      expect(row.getCell(8).numFmt).toBe('#,##0');
      expect(row.getCell(8).numFmt).not.toContain('####');
      expect(row.getCell(10).numFmt).toBe('#,##0');
      expect(row.getCell(13).numFmt).toBe('0.00%');
      const ctr = row.getCell(13).value;
      if (typeof ctr === 'number') {
        expect(ctr).toBeGreaterThan(0);
        expect(ctr).toBeLessThanOrEqual(1);
      }
    });
    expect(dataRow).toBeGreaterThan(0);
  });

  it('normalizes CTR percents into a 0–1 ratio', () => {
    expect(normalizeCtr(0.05)).toBe(0.05);
    expect(normalizeCtr(5)).toBe(0.05);
    expect(normalizeCtr(null)).toBeNull();
  });
});

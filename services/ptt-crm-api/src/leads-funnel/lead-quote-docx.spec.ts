import JSZip from 'jszip';
import { hourlyFromPosition, assembleQuoteSheet, type QuoteSheetItem, type QuoteSheetStaff } from './quote-sheet.util';
import { renderLeadQuoteDocx } from './lead-quote-docx';

async function documentXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('missing word/document.xml');
  return file.async('string');
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

const hidden: QuoteSheetItem = {
  ...item,
  code: 'WEB-01-02',
  task: 'Việc không xuất',
  subtask: 'Chi tiết nội bộ',
};

describe('lead quote docx', () => {
  it('builds an editable quote table without staff names', async () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item, hidden],
      selectedServiceCodes: ['WEB'],
      overrides: [{ item_code: hidden.code, staff_id: 7, hours: 3, included: false }],
      promoPercent: 10,
      vatPercent: 8,
    });
    const docx = await renderLeadQuoteDocx(view, 'Công ty Lan');
    expect(docx.subarray(0, 4).toString('binary')).toBe('PK\u0003\u0004');
    expect(docx.length).toBeGreaterThan(800);
    const xml = await documentXml(docx);
    const amount = `${new Intl.NumberFormat('vi-VN').format(view.groups[0].rows[0].amount_vnd)} đ`;
    expect(xml).toContain('Tiếp nhận handover');
    expect(xml).toContain('Đọc brief và chốt phạm vi.');
    expect(xml).toContain('Website · Khởi động');
    expect(xml).toContain(amount);
    expect(xml).toContain('Tổng thanh toán');
    expect(xml).not.toContain('Việc không xuất');
    expect(xml).not.toContain('An');
    expect(xml).not.toContain('Account Executive');
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
    const docx = await renderLeadQuoteDocx(view, '   ');
    expect(docx.subarray(0, 4).toString('binary')).toBe('PK\u0003\u0004');
    expect(docx.length).toBeGreaterThan(800);
    const xml = await documentXml(docx);
    expect(xml).toContain('Khách hàng');
    expect(xml).toContain('Chưa có hạng mục');
    expect(xml).toContain('Tổng thanh toán');
    expect(xml).toContain(`${new Intl.NumberFormat('vi-VN').format(0)} đ`);
    expect(xml).not.toContain('An');
  });
});

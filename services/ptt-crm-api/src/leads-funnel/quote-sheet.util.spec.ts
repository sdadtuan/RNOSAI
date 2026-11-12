import {
  assembleQuoteSheet,
  defaultStaffId,
  hourlyFromPosition,
  implementationPlanFromSheet,
  parseQuoteServiceCodes,
  quoteCommercial,
  quoteLineAmount,
  quoteUnitLabel,
  readStoredQuoteSheet,
  type QuoteSheetItem,
  type QuoteSheetStaff,
} from './quote-sheet.util';

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
  {
    id: 8,
    name: 'Bình',
    position_code: 'MKL',
    position_name: 'Marketing Leader',
    monthly_salary_vnd: 18_000_000,
    hours_per_month: 176,
    hourly_vnd: hourlyFromPosition(18_000_000, 176),
  },
];

function item(partial: Partial<QuoteSheetItem> = {}): QuoteSheetItem {
  return {
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
    ...partial,
  };
}

describe('quote sheet money', () => {
  it('divides the position salary by monthly hours', () => {
    expect(hourlyFromPosition(15_000_000, 176)).toBe(85227);
    expect(quoteLineAmount(2, 1, 85227)).toBe(170454);
  });

  it('suggests a person from the catalog role position', () => {
    expect(defaultStaffId('am', staff)).toBe(7);
    expect(defaultStaffId('content', staff)).toBe(8);
    expect(defaultStaffId('client', staff)).toBeNull();
  });

  it('prices the small task from the chosen person’s position rate', () => {
    const view = assembleQuoteSheet({
      editable: true,
      services: [],
      staff,
      items: [item()],
      selectedServiceCodes: ['WEB'],
      overrides: [],
    });
    const row = view.groups[0]?.rows[0];
    expect(row?.staff_id).toBe(7);
    expect(row?.subtask).toBe('Đọc brief và chốt phạm vi.');
    expect(row?.amount_vnd).toBe(170454);
    expect(view.total_vnd).toBe(170454);
  });

  it('keeps at most four catalog services', () => {
    expect(parseQuoteServiceCodes('WEB,SEO,ADS,CRM,BOT')).toEqual(['WEB', 'SEO', 'ADS', 'CRM']);
    expect(readStoredQuoteSheet({ service_codes: ['web', 'seo'], lines: [{ item_code: 'WEB-01-01', staff_id: 7, hours: 1.5, included: true }] }).service_codes).toEqual([
      'WEB',
      'SEO',
    ]);
  });

  it('applies promotion before VAT', () => {
    expect(quoteCommercial(170454, 10, 8)).toEqual({
      promo_percent: 10,
      vat_percent: 8,
      promo_vnd: 17045,
      vat_vnd: 12273,
      grand_total_vnd: 165682,
    });
    const view = assembleQuoteSheet({
      editable: true,
      services: [],
      staff,
      items: [item()],
      selectedServiceCodes: ['WEB'],
      overrides: [],
      promoPercent: 10,
      vatPercent: 8,
    });
    expect(view.total_vnd).toBe(170454);
    expect(view.grand_total_vnd).toBe(165682);
    expect(readStoredQuoteSheet({ service_codes: ['WEB'], lines: [], vat_percent: 8, promo_percent: 10 }).vat_percent).toBe(8);
  });

  it('does not charge client-only work', () => {
    const view = assembleQuoteSheet({
      editable: true,
      services: [],
      staff,
      items: [item({ client_only: true, role_code: 'client' })],
      selectedServiceCodes: ['WEB'],
      overrides: [{ item_code: 'WEB-01-01', staff_id: 7, hours: 2, included: true }],
    });
    expect(view.groups[0]?.rows[0]?.included).toBe(false);
    expect(view.total_vnd).toBe(0);
  });

  it('builds the implementation plan from included quote lines only', () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item(), item({ code: 'WEB-01-02', task: 'Khách duyệt', client_only: true, role_code: 'client' })],
      selectedServiceCodes: ['WEB'],
      overrides: [],
    });
    const plan = implementationPlanFromSheet(view);
    expect(plan).toHaveLength(1);
    expect(plan[0]?.lines.map((line) => line.task)).toEqual(['Tiếp nhận handover']);
    expect(plan[0]?.lines[0]).not.toHaveProperty('staff_name');
  });

  it('translates quantity units and the AM role to Vietnamese labels', () => {
    expect(quoteUnitLabel('times')).toBe('lần');
    expect(quoteUnitLabel('month')).toBe('tháng');
    expect(quoteUnitLabel('shoot_day')).toBe('ngày quay');
    expect(quoteUnitLabel('lần')).toBe('lần');
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [item()],
      selectedServiceCodes: ['WEB'],
      overrides: [],
    });
    expect(view.groups[0]?.rows[0]?.unit).toBe('lần');
    expect(view.groups[0]?.rows[0]?.role_label).toBe('AM');
  });
});

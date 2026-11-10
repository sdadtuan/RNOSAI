import { assembleQuoteSheet, hourlyFromPosition, type QuoteSheetItem, type QuoteSheetStaff } from './quote-sheet.util';
import { deliveryHours, deliveryKpiFromSheet, deliveryPeriod } from './quote-delivery-kpi.util';

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
    subtask: 'Đọc brief',
    role_code: 'am',
    est_hours: 2,
    qty: 1,
    unit: 'times',
    billable: true,
    client_only: false,
    ...partial,
  };
}

describe('quote delivery kpi', () => {
  it('uses the Asia/Ho_Chi_Minh month of approval', () => {
    expect(deliveryPeriod(new Date('2026-11-09T17:30:00.000Z'))).toEqual({ year: 2026, month: 11 });
  });

  it('multiplies hours by quantity', () => {
    expect(deliveryHours(1.5, 2)).toBe(3);
    expect(deliveryHours(0, 4)).toBe(0);
  });

  it('groups included lines by the staff assigned on the quote', () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff,
      items: [
        item(),
        item({ code: 'WEB-01-02', task: 'Lập kế hoạch', est_hours: 1.5, qty: 2, role_code: 'mkt_lead' }),
        item({ code: 'WEB-01-03', task: 'Việc bỏ', est_hours: 9 }),
        item({ code: 'WEB-01-04', task: 'Khách tự làm', role_code: 'client', client_only: true }),
      ],
      selectedServiceCodes: ['WEB'],
      overrides: [
        { item_code: 'WEB-01-02', staff_id: 8, hours: 1.5, included: true },
        { item_code: 'WEB-01-03', staff_id: 7, hours: 9, included: false },
      ],
    });
    const split = deliveryKpiFromSheet(view);
    expect(split.people.map((person) => person.staff_name)).toEqual(['An', 'Bình']);
    expect(split.people[0]).toMatchObject({ staff_id: 7, hours: 2, tasks: ['Tiếp nhận handover'] });
    expect(split.people[1]).toMatchObject({ staff_id: 8, position_name: 'Marketing Leader', hours: 3, tasks: ['Lập kế hoạch'] });
    expect(split.unassigned_tasks).toEqual([]);
    expect(JSON.stringify(split)).not.toContain('15000000');
    expect(JSON.stringify(split)).not.toContain('hourly');
  });

  it('keeps a charged line with no staff on the unassigned list', () => {
    const view = assembleQuoteSheet({
      editable: false,
      services: [],
      staff: [],
      items: [item({ role_code: 'am' })],
      selectedServiceCodes: ['WEB'],
      overrides: [{ item_code: 'WEB-01-01', staff_id: null, hours: 2, included: true }],
    });
    const split = deliveryKpiFromSheet(view);
    expect(split.people).toEqual([]);
    expect(split.unassigned_tasks).toEqual(['Tiếp nhận handover']);
  });
});

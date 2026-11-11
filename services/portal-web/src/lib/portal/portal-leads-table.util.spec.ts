import { describe, expect, it } from 'vitest';
import {
  EMPTY_LEAD_FILTERS,
  filterLeadRows,
  leadKpis,
  formatLeadPhoneDisplay,
  humanizeLeadFieldLabel,
  humanizeLeadFieldValue,
  leadEmail,
  leadPhone,
  paginateRows,
  sortLeadsByRecent,
  type LeadTableRow,
} from './portal-leads-table.util';

function row(partial: Partial<LeadTableRow> & Pick<LeadTableRow, 'id'>): LeadTableRow {
  return {
    title: 'Lead',
    page_id: 'page-a',
    status: 'waiting_receive',
    assignee_user_id: 'staff-1',
    assignee_email: 'a@x.com',
    customer_id: null,
    created_at: '2026-11-11T03:00:00.000Z',
    ...partial,
  };
}

describe('portal leads table', () => {
  const pages = new Map([['page-a', 'Lotus'], ['page-b', 'Old Page']]);

  it('computes KPI cards from the visible list', () => {
    const rows = [
      row({ id: '1', status: 'waiting_receive', assignee_user_id: 's1', created_at: '2026-11-11T03:00:00.000Z' }),
      row({ id: '2', status: 'caring', assignee_user_id: 's2', customer_id: 'c1', created_at: '2026-11-10T03:00:00.000Z' }),
      row({ id: '3', status: 'waiting_receive', assignee_user_id: null, created_at: '2026-11-11T04:00:00.000Z' }),
    ];
    expect(leadKpis(rows, new Date('2026-11-11T10:00:00+07:00'))).toEqual({
      total: 3,
      waiting: 2,
      assigned: 2,
      converted: 1,
      today: 0,
    });
  });

  it('does not treat backfill created_at as today', () => {
    const rows = [
      row({ id: 'backfill', created_at: '2026-11-11T10:30:18.699Z', last_interaction_at: '2026-11-10T08:11:27.000Z' }),
      row({ id: 'unknown', created_at: '2026-11-11T10:30:18.699Z' }),
      row({ id: 'real', created_at: '2026-11-11T10:30:18.699Z', last_interaction_at: '2026-11-11T03:00:00.000Z' }),
    ];
    expect(leadKpis(rows, new Date('2026-11-11T10:00:00+07:00')).today).toBe(1);
  });

  it('filters by page, status, assignee, search and date', () => {
    const rows = [
      row({ id: '1', title: 'Huy Manh', page_id: 'page-a', phone: '0901', source: 'Form A', last_interaction_at: '2026-11-11T03:00:00.000Z' }),
      row({
        id: '2',
        title: 'Old',
        page_id: 'page-b',
        status: 'caring',
        assignee_user_id: null,
        assignee_email: '',
        source: 'Form B',
        created_at: '2026-11-01T00:00:00.000Z',
        last_interaction_at: '2026-11-01T00:00:00.000Z',
      }),
    ];
    expect(filterLeadRows(rows, { ...EMPTY_LEAD_FILTERS, pageId: 'page-a' }, pages).map((item) => item.id)).toEqual(['1']);
    expect(filterLeadRows(rows, { ...EMPTY_LEAD_FILTERS, status: 'caring' }, pages).map((item) => item.id)).toEqual(['2']);
    expect(filterLeadRows(rows, { ...EMPTY_LEAD_FILTERS, assignee: 'unassigned' }, pages).map((item) => item.id)).toEqual(['2']);
    expect(filterLeadRows(rows, { ...EMPTY_LEAD_FILTERS, query: '0901' }, pages).map((item) => item.id)).toEqual(['1']);
    expect(filterLeadRows(rows, { ...EMPTY_LEAD_FILTERS, source: 'Form A' }, pages).map((item) => item.id)).toEqual(['1']);
    expect(filterLeadRows(rows, { ...EMPTY_LEAD_FILTERS, from: '2026-11-10' }, pages).map((item) => item.id)).toEqual(['1']);
  });

  it('sorts by recent interaction then paginates', () => {
    const rows = [
      row({ id: 'old', last_interaction_at: '2026-11-01T00:00:00.000Z' }),
      row({ id: 'new', last_interaction_at: '2026-11-11T00:00:00.000Z' }),
      row({ id: 'mid', last_interaction_at: '2026-11-05T00:00:00.000Z' }),
    ];
    const sorted = sortLeadsByRecent(rows).map((item) => item.id);
    expect(sorted).toEqual(['new', 'mid', 'old']);
    expect(paginateRows(sorted, 1, 2)).toEqual({ items: ['new', 'mid'], page: 1, pages: 2, total: 3 });
    expect(paginateRows(sorted, 2, 2).items).toEqual(['old']);
  });

  it('prefers order phone over raw phone', () => {
    expect(leadPhone(row({ id: '1', phone: '111', order: { phone: '222' } }))).toBe('222');
  });

  it('reads email from answers and humanizes snake_case form labels', () => {
    expect(leadEmail(row({ id: '1', answers: [{ name: 'email', value: 'a@x.com' }] }))).toBe('a@x.com');
    expect(humanizeLeadFieldLabel('ngân_sách_hàng_tháng?')).toBe('Ngân sách hàng tháng?');
    expect(humanizeLeadFieldLabel('phone_number')).toBe('Số điện thoại');
    expect(humanizeLeadFieldValue('20_-_50_triệu')).toBe('20 - 50 triệu');
    expect(formatLeadPhoneDisplay('+84901234567')).toBe('0901234567');
    expect(formatLeadPhoneDisplay('+84 901 234 567')).toBe('0901234567');
    expect(formatLeadPhoneDisplay('0901234567')).toBe('0901234567');
    expect(humanizeLeadFieldLabel('doanh_nghiệp_của_anh/chị_đang_hoạt_động_trong_lĩnh_vực_nào:')).toBe(
      'Doanh nghiệp của anh/chị đang hoạt động trong lĩnh vực nào:',
    );
  });
});

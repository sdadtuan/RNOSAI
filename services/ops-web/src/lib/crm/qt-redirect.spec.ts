import { describe, expect, it } from 'vitest';
import { qtOverviewRedirect } from './qt-redirect';

describe('qtOverviewRedirect', () => {
  it('sends id to the builder even when wizard and lead_id are present', () => {
    expect(qtOverviewRedirect({ id: '42', wizard: '1', lead_id: '9' })).toBe('/crm/proposals/42');
  });

  it('forwards live query fields to NEW-01 and drops only wizard and id', () => {
    expect(
      qtOverviewRedirect({
        wizard: '1',
        lead_id: '88',
        customer_id: 'c1',
        service_slugs: 'seo',
        notes: 'hello',
        prefill_dv: '1',
        extra: 'keep',
        id: '',
      }),
    ).toBe('/crm/proposals/new?lead_id=88&customer_id=c1&service_slugs=seo&notes=hello&prefill_dv=1&extra=keep');
  });

  it('sends Deal Room lead_id without wizard to NEW-01', () => {
    expect(qtOverviewRedirect({ lead_id: '77', customer_id: 'c2' })).toBe(
      '/crm/proposals/new?lead_id=77&customer_id=c2',
    );
  });

  it('stays on overview without id, wizard=1, or lead_id', () => {
    expect(qtOverviewRedirect({})).toBeNull();
    expect(qtOverviewRedirect({ customer_id: 'c1', notes: 'x' })).toBeNull();
  });
});

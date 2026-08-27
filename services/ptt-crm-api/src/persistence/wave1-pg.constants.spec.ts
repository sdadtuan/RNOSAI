import { WAVE1_PG_MODULES } from './wave1-pg.constants';

describe('WAVE1_PG_MODULES', () => {
  it('lists every sqlite-only nest module to cut over', () => {
    expect(WAVE1_PG_MODULES).toEqual([
      'customers',
      'tickets',
      'cases',
      'orders',
      'invoices',
      'sales',
      'proposals',
      'marketing-plans',
      'crm-config',
      'owner-weekly',
      're-projects',
    ]);
  });
});

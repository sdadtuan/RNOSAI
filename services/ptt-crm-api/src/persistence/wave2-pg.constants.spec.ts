import { WAVE2_PG_MODULES } from './wave2-pg.constants';

describe('WAVE2_PG_MODULES', () => {
  it('lists dual modules to hard-cut in Wave 2', () => {
    expect(WAVE2_PG_MODULES).toEqual([
      'crm-staff',
      'crm-leads-legacy',
      'intake',
      'leads-contract',
      'leads-funnel',
      'leads',
      'kpi',
      'finance',
      'svc-finance',
      'sop',
      'service-lifecycle',
      'payroll',
    ]);
  });
});
